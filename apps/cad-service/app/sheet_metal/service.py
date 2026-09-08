"""Pipeline orchestration for sheet-metal analysis.

Phase 2 scope: file validation/import, topology, geometry, sheet-metal
candidate scoring and dominant-thickness detection. Every detector-driven
section past that (bends, holes, cutouts, ...) stays at its schema default
until later phases wire in the rest of ``app/sheet_metal/detectors/*``.

Geometry primitives (``TopologyAnalyzer``, ``GeometryAnalyzer``) and file
intake (``CADParser``) are imported directly from ``app.machining`` rather
than duplicated - see the design doc section 3.1's "explicit reuse, not
duplication" note.

Every stage runs inside :meth:`SheetMetalAnalysisService._stage`, matching
machining's resilience model: one stage failing degrades to a warning instead
of failing the whole request.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, Dict, List, Optional, TypeVar

from ..machining import occ
from ..machining.parser import CADParser, LoadedModel
from ..machining.pmi import PMIExtractor
from ..machining.records import MassProperties, ShapeModel
from ..machining.schemas import AnalysisWarning, WarningCode
from ..machining.topology import GeometryAnalyzer, TopologyAnalyzer
from ..machining.schemas import BoundingBox, GeometryInfo, ModelInfo, MomentsOfInertia, Vector3
from ..machining.units import to_imperial

from .complexity import compute_complexity
from .config import SheetMetalConfig, get_sheet_metal_config
from .detectors.base_flange import detect_base_flange
from .detectors.bend_relief import detect_bend_reliefs
from .detectors.bends import detect_bends
from .detectors.cutouts import detect_cutouts
from .detectors.hems import detect_hems
from .detectors.holes import detect_holes
from .detectors.profile import detect_outer_profile
from .detectors.sheet_candidate import detect_sheet_candidate
from .detectors.slots import detect_slots
from .detectors.thickness import detect_thickness
from .distance_checks import compute_distance_checks
from .patterns import detect_patterns, detect_symmetry
from .schemas import (
    ANALYSIS_VERSION,
    AnalysisError,
    FileInfo,
    SheetMetalAnalysisOptions,
    SheetMetalAnalysisResponse,
    UnitSystem,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")


class SheetMetalAnalysisService:
    """Runs the deterministic pipeline over one loaded CAD model.

    Phase 1: only the shared geometry primitives run. Every sheet-metal
    specific stage (candidate scoring, thickness, bends, ...) is wired in by
    later phases per the implementation plan.
    """

    def __init__(self, config: Optional[SheetMetalConfig] = None):
        self.config = config or get_sheet_metal_config()

        self.parser = CADParser(self.config)  # type: ignore[arg-type]
        self.topology_analyzer = TopologyAnalyzer(self.config)  # type: ignore[arg-type]
        self.geometry_analyzer = GeometryAnalyzer(self.config)  # type: ignore[arg-type]
        self.pmi_extractor = PMIExtractor(self.config)  # type: ignore[arg-type]

    def analyze(
        self, loaded: LoadedModel, options: SheetMetalAnalysisOptions
    ) -> SheetMetalAnalysisResponse:
        started = time.perf_counter()
        warnings: List[AnalysisWarning] = list(loaded.warnings)
        timings: Dict[str, float] = {}

        response = SheetMetalAnalysisResponse(
            analysis_version=ANALYSIS_VERSION,
            kernel=occ.kernel_name(),
            options=options,
            file=FileInfo(
                filename=loaded.filename,
                format=loaded.file_format,
                file_size_bytes=loaded.file_size_bytes,
                sha256=loaded.sha256,
            ),
            model=ModelInfo(),
            warnings=warnings,
        )

        model = self._stage(
            "topology", timings, warnings, lambda: self.topology_analyzer.build(loaded.shape)
        )
        if model is None:
            # Topology is the foundation every later stage reads from, so
            # losing it means there is no analysis to return - same hard
            # failure semantics as machining.
            response.success = False
            response.errors.append(
                AnalysisError(
                    code="TOPOLOGY_EXTRACTION_FAILED",
                    message=(
                        "The B-Rep could not be traversed, so no geometry could "
                        "be extracted. See warnings for the underlying error."
                    ),
                    detail={"stage": "topology"},
                )
            )
            return response

        response.model = self._model_info(model, loaded)
        response.topology = self._stage(
            "topology_summary",
            timings,
            warnings,
            lambda: self.topology_analyzer.summarize(loaded.shape, model, warnings),
            default=response.topology,
        )

        mass = self._stage(
            "geometry", timings, warnings, lambda: self.geometry_analyzer.analyze(loaded.shape)
        ) or MassProperties()
        response.geometry = self._geometry_info(model, mass, warnings)

        # Stages 4-6: face pairing is done inside the candidate detector
        # itself (opposed, overlapping planar face pairs), so a separate
        # "face classification" stage is folded into stage 5 here.
        candidate = self._stage(
            "sheet_candidate",
            timings,
            warnings,
            lambda: detect_sheet_candidate(model, self.config),
        )
        if candidate is not None:
            response.sheet_metal_candidate = candidate

        # Thickness detection still runs even when the candidate gate was
        # rejected: the pipeline never hard-fails on "this doesn't look like
        # sheet metal" - later phases' sections are the ones that stay empty.
        thickness = self._stage(
            "thickness",
            timings,
            warnings,
            lambda: detect_thickness(model, self.config),
        )
        if thickness is not None:
            response.thickness = thickness

        # Stage 7: base/flange face identification. Runs regardless of the
        # candidate gate, same rationale as thickness above.
        faces = self._stage(
            "base_flange",
            timings,
            warnings,
            lambda: detect_base_flange(model, self.config),
        )
        if faces is not None:
            response.faces = faces

        # Stage 8: bend detection (curvature clustering over cylindrical
        # faces - see detectors/bends.py). Uses the dominant thickness from
        # stage 6 for the bend-allowance/-deduction formulas when available.
        bends = self._stage(
            "bends",
            timings,
            warnings,
            lambda: detect_bends(
                model, self.config, response.thickness.dominant_thickness_mm
            ),
        )
        if bends is not None:
            response.bends = bends
            self._link_flanges_to_bends(response.faces, response.bends)

        # Stage 9: bend-relief detection - a documented stub in this phase
        # (see detectors/bend_relief.py / design doc section 9).
        bend_reliefs = self._stage(
            "bend_relief",
            timings,
            warnings,
            lambda: detect_bend_reliefs(response.bends),
        )
        if bend_reliefs is not None:
            response.bend_reliefs = bend_reliefs

        # Stage 10: circular pierced-hole detection.
        holes = self._stage(
            "holes", timings, warnings, lambda: detect_holes(model, self.config)
        )
        if holes is not None:
            response.holes = holes

        # Stage 11: non-circular pierced profile ("cutout") detection.
        cutouts = self._stage(
            "cutouts", timings, warnings, lambda: detect_cutouts(model, self.config)
        )
        if cutouts is not None:
            response.cutouts = cutouts

        # Stage 12: elongated pierced profile ("slot") detection.
        slots = self._stage(
            "slots", timings, warnings, lambda: detect_slots(model, self.config)
        )
        if slots is not None:
            response.slots = slots

        # Stage 13: folded-edge ("hem") detection - a documented heuristic,
        # see detectors/hems.py.
        hems = self._stage(
            "hems",
            timings,
            warnings,
            lambda: detect_hems(
                model, self.config, response.thickness.dominant_thickness_mm
            ),
        )
        if hems is not None:
            response.hems = hems

        # Stage 14: outer profile perimeter + closed-loop validity.
        outer_profile = self._stage(
            "outer_profile",
            timings,
            warnings,
            lambda: detect_outer_profile(model, self.config, response.faces),
        )
        if outer_profile is not None:
            response.outer_profile = outer_profile

        # Stage 15: DFM distance checks (hole/cutout-to-edge, -to-bend, min
        # feature size, bend radius/thickness ratio). Mutates the
        # distance_to_nearest_*_mm fields on holes/cutouts/slots in place.
        distance_flags = self._stage(
            "distance_checks",
            timings,
            warnings,
            lambda: compute_distance_checks(
                model,
                self.config,
                response.faces,
                response.holes,
                response.cutouts,
                response.slots,
                response.bends,
                response.thickness.dominant_thickness_mm,
            ),
        )
        if distance_flags is not None:
            response.distance_flags = distance_flags

        # Stage 16: repeated-feature grouping + bounding-profile symmetry.
        feature_patterns = self._stage(
            "patterns",
            timings,
            warnings,
            lambda: detect_patterns(
                response.holes, response.cutouts, response.slots, self.config
            ),
        )
        if feature_patterns is not None:
            response.feature_patterns = feature_patterns

        symmetry = self._stage(
            "symmetry",
            timings,
            warnings,
            lambda: detect_symmetry(model, self.config, response.faces),
        )
        if symmetry is not None:
            response.symmetry = symmetry

        # Stage 17: deterministic complexity/count indicators.
        complexity = self._stage(
            "complexity",
            timings,
            warnings,
            lambda: compute_complexity(
                response.bends,
                response.holes,
                response.cutouts,
                response.slots,
                response.hems,
                self.config.length_decimals,
            ),
        )
        if complexity is not None:
            response.complexity_indicators = complexity

        # Stage 18: PMI extraction (reused verbatim from app.machining.pmi).
        pmi = self._stage(
            "pmi",
            timings,
            warnings,
            lambda: self.pmi_extractor.extract(loaded.path, loaded.file_format, warnings),
        )
        if pmi is not None:
            response.pmi = pmi

        # Stage 19: response assembly - already effectively done above; every
        # section has been attached to `response` as its stage completed.

        response.warnings = warnings
        response.analysis_duration_ms = round((time.perf_counter() - started) * 1000.0, 3)
        return response

    # -- response building -------------------------------------------------

    def _model_info(self, model: ShapeModel, loaded: LoadedModel) -> ModelInfo:
        return ModelInfo(
            solid_count=model.solid_count,
            shell_count=model.shell_count,
            face_count=len(model.faces),
            edge_count=len(model.edges),
            vertex_count=model.vertex_count,
            wire_count=model.wire_count,
            compound_count=model.compound_count,
            is_valid=loaded.is_valid,
            has_open_shells=any(edge.is_free for edge in model.edges.values()),
            is_multi_body=model.solid_count > 1,
        )

    def _bounding_box(self, low, high) -> BoundingBox:
        size = (high[0] - low[0], high[1] - low[1], high[2] - low[2])
        diagonal = (size[0] ** 2 + size[1] ** 2 + size[2] ** 2) ** 0.5
        r = self.config.length_decimals
        return BoundingBox(
            min=Vector3(x=round(low[0], r), y=round(low[1], r), z=round(low[2], r)),
            max=Vector3(x=round(high[0], r), y=round(high[1], r), z=round(high[2], r)),
            length_mm=round(size[0], r),
            width_mm=round(size[1], r),
            height_mm=round(size[2], r),
            diagonal_mm=round(diagonal, r),
        )

    def _geometry_info(
        self, model: ShapeModel, mass: MassProperties, warnings: List[AnalysisWarning]
    ) -> GeometryInfo:
        if not mass.is_closed_volume:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.INVALID_GEOMETRY,
                    message=(
                        "The kernel could not compute a positive closed volume. "
                        "Volume, centre of mass and any thickness estimate built "
                        "from it should be treated as unreliable."
                    ),
                )
            )
        r = self.config.length_decimals
        return GeometryInfo(
            bounding_box=self._bounding_box(model.bbox_min, model.bbox_max),
            volume_mm3=round(mass.volume_mm3, self.config.volume_decimals),
            surface_area_mm2=round(mass.surface_area_mm2, self.config.area_decimals),
            center_of_mass=Vector3(
                x=round(mass.center_of_mass[0], r),
                y=round(mass.center_of_mass[1], r),
                z=round(mass.center_of_mass[2], r),
            ),
            moments_of_inertia=MomentsOfInertia(
                ixx=mass.ixx,
                iyy=mass.iyy,
                izz=mass.izz,
                ixy=mass.ixy,
                ixz=mass.ixz,
                iyz=mass.iyz,
                principal=mass.principal,
            ),
            is_closed_volume=mass.is_closed_volume,
        )

    # -- helpers -------------------------------------------------------------

    def _link_flanges_to_bends(self, faces, bends) -> None:
        """Populate ``FlangeFace.adjacent_bend_ids`` from each bend's flanges.

        Bends are detected after base/flange identification (stage 8 depends
        on stage 7's face set for nothing but happens to run later in the
        pipeline order), so this small cross-reference step stitches the two
        sections together rather than having ``detectors/bends.py`` reach
        back into the faces section itself.
        """
        by_face_id = {str(flange.face_id): flange for flange in faces.flange_faces}
        for bend in bends:
            for flange_id in bend.adjacent_flange_ids:
                flange = by_face_id.get(flange_id)
                if flange is not None and bend.id not in flange.adjacent_bend_ids:
                    flange.adjacent_bend_ids.append(bend.id)

    def _stage(
        self,
        name: str,
        timings: Dict[str, float],
        warnings: List[AnalysisWarning],
        fn: Callable[[], T],
        default: Optional[T] = None,
    ) -> Optional[T]:
        """Run one pipeline stage, converting a crash into a warning.

        A single stage failing on unusual geometry should not cost the client
        the rest of the analysis - same resilience model as
        ``app.machining.service.MachiningAnalysisService._stage``.
        """
        started = time.perf_counter()
        try:
            return fn()
        except Exception as exc:
            logger.exception("Sheet-metal stage '%s' failed", name)
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.DETECTOR_FAILED,
                    message=f"Stage '{name}' failed and was skipped: {exc}",
                    detail={"stage": name},
                )
            )
            return default
        finally:
            timings[name] = (time.perf_counter() - started) * 1000.0


def analyze_sheet_metal(
    loaded: LoadedModel,
    options: Optional[SheetMetalAnalysisOptions] = None,
    config: Optional[SheetMetalConfig] = None,
) -> Dict[str, Any]:
    """Analyse a loaded model and return a JSON-ready dict in the requested units."""
    options = options or SheetMetalAnalysisOptions()
    service = SheetMetalAnalysisService(config)
    response = service.analyze(loaded, options)

    payload = response.model_dump(mode="json", exclude_none=False)
    if options.unit_system == UnitSystem.imperial:
        payload = to_imperial(payload)
        payload["units"] = "in"
        payload.setdefault("warnings", []).append(
            {
                "code": WarningCode.UNIT_ASSUMED.value,
                "message": (
                    "Values are converted to inches. Field names keep their "
                    "'_mm' suffix so the schema is stable across unit systems; "
                    "the 'units' field is authoritative."
                ),
                "detail": None,
            }
        )
    else:
        payload["units"] = "mm"
    return payload
