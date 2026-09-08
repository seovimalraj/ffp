"""``POST /api/v1/cad/analyze-sheet-metal``.

Mirrors ``app/api/v1/machining.py``: a thin controller that validates the
upload, hands the file to
:class:`~app.sheet_metal.service.SheetMetalAnalysisService`, and guarantees
the temporary file is removed. All geometry work lives in ``app.sheet_metal``.

Phase 1 note: no detector exists yet, so a successful analysis only
populates ``file``/``model``/``topology``/``geometry`` - every sheet-metal
specific section (bends, holes, ...) is present with its schema default.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from ...machining import occ
from ...machining.parser import (
    SUPPORTED_FORMATS,
    CADParseError,
    CADParser,
    remove_quietly,
    sanitize_filename,
    validate_extension,
)
from ...sheet_metal.config import get_sheet_metal_config
from ...sheet_metal.schemas import (
    ANALYSIS_VERSION,
    AnalysisError,
    SheetMetalAnalysisOptions,
    SheetMetalAnalysisResponse,
    SheetMetalErrorResponse,
    UnitSystem,
)
from ...sheet_metal.service import analyze_sheet_metal

logger = logging.getLogger(__name__)

router = APIRouter()


def _error(status_code: int, code: str, message: str, detail: Optional[dict] = None) -> JSONResponse:
    body = SheetMetalErrorResponse(
        analysis_version=ANALYSIS_VERSION,
        errors=[AnalysisError(code=code, message=message, detail=detail)],
    )
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json"))


ENDPOINT_DESCRIPTION = """
Deterministically extracts geometry and (in later phases) sheet-metal
features - thickness, bends, flanges, holes/cutouts, hems, DFM distance
checks - from a **STEP**, **IGES** or **BREP** file, using the OpenCASCADE
kernel.

This endpoint is structurally parallel to `analyze-machining` but targets
sheet-metal parts instead of milled/turned parts. **Flat-pattern unfolding is
out of scope** for this iteration.

**Phase 1 status:** the backend package skeleton, schema and route are wired
end-to-end, but detectors have not shipped yet. A successful analysis today
returns `file`, `model`, `topology` and `geometry` populated from the kernel;
every sheet-metal-specific section (`sheet_metal_candidate`, `thickness`,
`bends`, `holes`, `cutouts`, `slots`, `hems`, ...) is present in the response
at its documented schema shape, but empty/default until later phases land.

No cost, process, or machine-selection information is ever returned by this
endpoint.
"""


@router.post(
    "/analyze-sheet-metal",
    summary="Extract sheet-metal-relevant geometry from a CAD file",
    description=ENDPOINT_DESCRIPTION,
    response_model=SheetMetalAnalysisResponse,
    response_description=(
        "Normalized geometry and (in later phases) sheet-metal features. "
        "Contains no cost, machine selection or pricing information by design."
    ),
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
async def analyze_sheet_metal_endpoint(
    file: UploadFile = File(
        ...,
        description=(
            "The CAD file. Accepted extensions: `.step`, `.stp`, `.iges`, "
            "`.igs`, `.brep`, `.brp`."
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
        description="Reserved for a later phase (face-level detail is not yet emitted).",
    ),
    include_feature_details: bool = Form(
        True,
        description="Reserved for a later phase (feature detail is not yet emitted).",
    ),
    include_debug_geometry: bool = Form(
        False,
        description="Reserved for a later phase (debug geometry is not yet emitted).",
    ),
    include_topology_entities: bool = Form(
        False,
        description="Reserved for a later phase (topology entities are not yet emitted).",
    ),
):
    config = get_sheet_metal_config()

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

    parser = CADParser(config)  # type: ignore[arg-type]
    temp_path: Optional[str] = None

    try:
        temp_path, size, digest = await parser.stream_upload_to_temp(file, filename)

        options = SheetMetalAnalysisOptions(
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

        if not payload.get("success", False):
            first = (payload.get("errors") or [{}])[0]
            logger.error(
                "sheet-metal analysis produced no result for %s: %s",
                filename,
                first.get("code"),
            )
            return JSONResponse(status_code=500, content=payload)

        logger.info(
            "sheet-metal analysis complete",
            extra={
                "filename": filename,
                "sha256": digest,
                "faces": payload.get("model", {}).get("face_count"),
                "duration_ms": payload.get("analysis_duration_ms"),
            },
        )
        return JSONResponse(status_code=200, content=payload)

    except CADParseError as exc:
        logger.info("sheet-metal analysis rejected: %s (%s)", exc.message, exc.code)
        return _error(exc.status_code, exc.code, exc.message, {"filename": filename})
    except occ.KernelUnavailable as exc:
        return _error(503, "CAD_KERNEL_UNAVAILABLE", str(exc))
    except Exception as exc:
        logger.exception("sheet-metal analysis failed for %s", filename)
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
    return analyze_sheet_metal(loaded, options, parser.config)


@router.get(
    "/analyze-sheet-metal/capabilities",
    summary="Report kernel availability and effective analysis thresholds",
    description=(
        "Cheap pre-flight check. Confirms a CAD kernel is loaded and reports "
        "every threshold currently in force.\n\n"
        "Thresholds come from `app/sheet_metal/sheet_metal_config.json`, "
        "overridden by `$SHEET_METAL_CONFIG_PATH` and then by "
        "`SHEET_METAL_<FIELD>` environment variables."
    ),
    response_description="Kernel status, accepted formats, limits and thresholds",
)
async def capabilities():
    config = get_sheet_metal_config()
    return {
        "analysis_version": ANALYSIS_VERSION,
        # A binding can import and still be unusable - a partial OCCT install
        # loads TopoDS but not STEPControl. Reporting only `kernel_available`
        # made this class of failure look like a healthy 200/True right up to
        # the 500 on upload.
        "kernel_available": occ.kernel_available() and not occ.broken_symbols(),
        "kernel": occ.kernel_name(),
        "kernel_binding_importable": occ.kernel_available(),
        "kernel_missing_symbols": occ.broken_symbols(),
        "kernel_import_failures": occ.import_failures,
        "supported_input_formats": sorted({v for v in SUPPORTED_FORMATS.values()}),
        "supported_extensions": sorted(SUPPORTED_FORMATS),
        "max_upload_bytes": config.max_upload_bytes,
        "max_faces": config.max_faces,
        "unit_systems": [u.value for u in UnitSystem],
        "thresholds": config.model_dump(),
        "note": (
            "This service extracts geometry only. It produces no cost, process "
            "selection, machine selection, or price. Detectors beyond "
            "model/topology/geometry are not implemented yet (Phase 1)."
        ),
    }
