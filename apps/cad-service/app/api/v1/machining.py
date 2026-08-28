"""``POST /api/v1/cad/analyze-machining``.

The controller is intentionally thin: it validates the upload, hands the file
to :class:`~app.machining.service.MachiningAnalysisService`, and guarantees the
temporary file is removed. All geometry work lives in ``app.machining``.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from ...machining import occ
from ...machining.config import get_machining_config
from ...machining.openapi import error_responses, success_responses
from ...machining.parser import (
    SUPPORTED_FORMATS,
    CADParseError,
    CADParser,
    remove_quietly,
    sanitize_filename,
    validate_extension,
)
from ...machining.schemas import (
    ANALYSIS_VERSION,
    AnalysisError,
    MachiningAnalysisOptions,
    MachiningAnalysisResponse,
    MachiningErrorResponse,
    UnitSystem,
)
from ...machining.service import analyze_machining

logger = logging.getLogger(__name__)

router = APIRouter()


def _error(status_code: int, code: str, message: str, detail: Optional[dict] = None) -> JSONResponse:
    body = MachiningErrorResponse(
        analysis_version=ANALYSIS_VERSION,
        errors=[AnalysisError(code=code, message=message, detail=detail)],
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json"))


ENDPOINT_DESCRIPTION = """
Deterministically extracts geometry, topology and machining features from a
**STEP**, **IGES** or **BREP** file using the OpenCASCADE kernel.

This endpoint answers one question: **what geometry exists?**

It deliberately does *not* answer how much machining costs, which machine or
process to use, what the hourly rate is, or what the price should be. Those
belong to downstream services. **No LLM is involved** - the same file always
produces the same JSON.

### What you get back

| Section | Contents |
|---|---|
| `model`, `topology` | Solid/shell/face/edge/vertex counts, validity, open shells |
| `geometry` | Bounding box, volume, surface area, centre of mass, inertia |
| `surface_summary` | Face-type histogram (plane, cylinder, cone, torus, freeform) |
| `features` | Holes, bores, pockets, slots, bosses, threads, fillets, chamfers |
| `feature_patterns` | Repeated features grouped as linear / circular / rectangular |
| `machining_flags` | `DEEP_HOLE`, `NARROW_SLOT`, ... against configurable thresholds |
| `machining_constraints` | Geometric maximum tool diameter per feature |
| `accessibility`, `setup_analysis` | Ray-cast reachability from the six principal directions |
| `stock_analysis` | Bounding-box estimate, always marked `estimated`, plus `stock_form` |
| `complexity_indicators` | Deterministic counts - no score, no difficulty rating |
| `pmi` | Metadata the file declares, tagged `CAD_METADATA` |

### Evidence, not guesses

Every feature carries a `detection` block naming the method, a confidence and
the supporting evidence. When geometry genuinely cannot settle a
classification, the feature is returned with `status: "ambiguous"` and a
`reason` instead of a guess - see the **ambiguous** response example.

A thread designation is **never** inferred from diameter: a 6.8 mm hole is the
tap drill for M8, but that is a manufacturing decision, not a geometric fact.

### Stock form

`stock_analysis.stock_form` classifies the envelope as `SHEET`, `PLATE`,
`ROUND_BAR`, `SQUARE_BAR`, `RECTANGULAR_BAR` or `BLOCK`.

Flat stock is decided on extent ratios. Everything else is first checked for
being a body of revolution, since extents alone cannot tell round bar from
square bar: coaxial external cylinders are grouped, and a group qualifies when
the cross-section is round, its largest diameter fills that cross-section, and
its faces span most of the axis. The axis need not be the long one - a ring
turns about its shortest extent - and the outside diameter need not be a single
face, so a stepped shaft is read as the union of its coaxial faces.

The cutoffs are configuration, and a part sitting on a boundary comes back
`status: "ambiguous"` with both candidates rather than a coin flip.

This is a statement about *proportions*, not procurement: it does not claim the
stock exists in the required alloy, is available in that size, or is the
cheapest route. `bounds_method` reports `obb` when an oriented bounding box was
available and `aabb` when it was not - the axis-aligned fallback misjudges
parts modelled off-axis.

### Units

Analysis always runs in millimetres. With `unit_system=imperial` values are
converted to inches and `units` becomes `"in"`; field names keep their `_mm`
suffix so the schema is stable across unit systems, and direction vectors are
never scaled.

### Performance

Detection is O(faces) with an O(faces²) thin-wall scan that is skipped above
1500 planar faces. Uploads are streamed to disk and capped, and the file is
removed on every exit path.
"""


@router.post(
    "/analyze-machining",
    summary="Extract machining-relevant geometry from a CAD file",
    description=ENDPOINT_DESCRIPTION,
    response_model=MachiningAnalysisResponse,
    response_description=(
        "Normalized geometry and machining features. Contains no cost, machine "
        "selection or pricing information by design."
    ),
    responses={**success_responses(), **error_responses()},
    openapi_extra={
        "requestBody": {
            "content": {
                "multipart/form-data": {
                    "encoding": {"file": {"contentType": "model/step, model/iges"}}
                }
            }
        }
    },
)
async def analyze_machining_endpoint(
    request: Request,
    file: UploadFile = File(
        ...,
        description=(
            "The CAD file. Accepted extensions: `.step`, `.stp`, `.iges`, "
            "`.igs`, `.brep`, `.brp`. The extension is validated before the "
            "body is read, and the upload is size-capped while streaming."
        ),
    ),
    unit_system: UnitSystem = Form(
        UnitSystem.metric,
        description=(
            "`metric` returns millimetres (default). `imperial` returns inches "
            "and sets `units` to `in`; field names keep their `_mm` suffix so "
            "the schema is stable across unit systems."
        ),
    ),
    include_face_details: bool = Form(
        False,
        description=(
            "Return one `face_details` record per face - surface type, area, "
            "bounding box, axis, radius, cone angle, concavity. Adds roughly "
            "300 bytes per face, so it is off by default."
        ),
    ),
    include_feature_details: bool = Form(
        True,
        description=(
            "Return individual features. Set `false` for aggregate counts only "
            "(`complexity_indicators` and the fillet/chamfer summaries still "
            "reflect every feature found)."
        ),
    ),
    include_debug_geometry: bool = Form(
        False,
        description=(
            "Return the face-adjacency graph, unclassified face ids and "
            "per-stage timings. For diagnosing detection, not for production "
            "consumers."
        ),
    ),
    include_topology_entities: bool = Form(
        False,
        description=(
            "Return selectable faces, edges and vertices with their "
            "coordinates, for a 3D viewer. Capped per category; the counts "
            "always report the model total."
        ),
    ),
):
    config = get_machining_config()

    if not occ.kernel_available():
        return _error(
            503,
            "CAD_KERNEL_UNAVAILABLE",
            (
                "No OpenCASCADE binding is installed. Install 'OCP' (preferred) "
                "or 'pythonocc-core' from conda-forge."
            ),
        )

    filename = sanitize_filename(file.filename)
    try:
        # Reject the extension before reading a single byte off the wire.
        validate_extension(filename)
    except CADParseError as exc:
        return _error(
            exc.status_code,
            exc.code,
            exc.message,
            {"filename": filename, "supported": sorted(SUPPORTED_FORMATS)},
        )

    parser = CADParser(config)
    temp_path: Optional[str] = None

    try:
        temp_path, size, digest = await parser.stream_upload_to_temp(file, filename)

        options = MachiningAnalysisOptions(
            unit_system=unit_system,
            include_face_details=include_face_details,
            include_feature_details=include_feature_details,
            include_debug_geometry=include_debug_geometry,
            include_topology_entities=include_topology_entities,
        )

        # Import and analysis are CPU-bound OCCT work; keep the event loop free.
        payload = await run_in_threadpool(
            _load_and_analyze, parser, temp_path, filename, size, digest, options
        )

        # A payload that reports success=False means the pipeline could not
        # produce an analysis; returning 200 for that would make a total
        # failure indistinguishable from a clean result.
        if not payload.get("success", False):
            first = (payload.get("errors") or [{}])[0]
            logger.error(
                "machining analysis produced no result for %s: %s",
                filename,
                first.get("code"),
            )
            return JSONResponse(status_code=500, content=payload)

        logger.info(
            "machining analysis complete",
            extra={
                "filename": filename,
                "sha256": digest,
                "faces": payload.get("model", {}).get("face_count"),
                "duration_ms": payload.get("analysis_duration_ms"),
            },
        )
        return JSONResponse(status_code=200, content=payload)

    except CADParseError as exc:
        logger.info("machining analysis rejected: %s (%s)", exc.message, exc.code)
        return _error(exc.status_code, exc.code, exc.message, {"filename": filename})
    except occ.KernelUnavailable as exc:
        return _error(503, "CAD_KERNEL_UNAVAILABLE", str(exc))
    except Exception as exc:
        logger.exception("machining analysis failed for %s", filename)
        return _error(
            500,
            "ANALYSIS_FAILED",
            f"Analysis failed unexpectedly: {type(exc).__name__}: {exc}",
            {"filename": filename},
        )
    finally:
        # The temp file is removed on every path, including client disconnect.
        remove_quietly(temp_path)
        try:
            await file.close()
        except Exception:
            pass


def _load_and_analyze(parser, path, filename, size, digest, options):
    loaded = parser.load(path, filename, size, digest)
    return analyze_machining(loaded, options, parser.config)


@router.get(
    "/analyze-machining/capabilities",
    summary="Report kernel availability and effective analysis thresholds",
    description=(
        "Cheap pre-flight check. Confirms a CAD kernel is loaded and reports "
        "every threshold currently in force, so you can see what the detectors "
        "will do before uploading anything.\n\n"
        "Thresholds come from `app/machining/machining_config.json`, overridden "
        "by `$MACHINING_CONFIG_PATH` and then by `MACHINING_<FIELD>` "
        "environment variables."
    ),
    response_description="Kernel status, accepted formats, limits and thresholds",
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "analysis_version": "1.0",
                        "kernel_available": True,
                        "kernel": "OCP",
                        "supported_input_formats": ["BREP", "IGES", "STEP"],
                        "supported_extensions": [
                            ".brep", ".brp", ".iges", ".igs", ".step", ".stp",
                        ],
                        "max_upload_bytes": 104857600,
                        "max_faces": 50000,
                        "unit_systems": ["metric", "imperial"],
                        "thresholds": {
                            "deep_hole_depth_diameter_ratio": 5.0,
                            "stock_allowance_mm": 2.5,
                            "slot_min_aspect_ratio": 3.0,
                        },
                        "note": (
                            "This service extracts geometry only. It produces no "
                            "cost, process selection, machine selection, or price."
                        ),
                    }
                }
            }
        }
    },
)
async def capabilities():
    config = get_machining_config()
    return {
        "analysis_version": ANALYSIS_VERSION,
        "kernel_available": occ.kernel_available(),
        "kernel": occ.kernel_name(),
        "supported_input_formats": sorted({v for v in SUPPORTED_FORMATS.values()}),
        "supported_extensions": sorted(SUPPORTED_FORMATS),
        "max_upload_bytes": config.max_upload_bytes,
        "max_faces": config.max_faces,
        "unit_systems": [u.value for u in UnitSystem],
        "thresholds": config.model_dump(),
        "note": (
            "This service extracts geometry only. It produces no cost, process "
            "selection, machine selection, or price."
        ),
    }
