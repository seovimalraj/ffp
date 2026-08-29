"""Pipeline orchestration for machining analysis.

The controller does none of this work - it hands a file path here and gets a
finished :class:`MachiningAnalysisResponse` back.

Pipeline order::

    file validation -> import -> shape validation -> topology -> geometry
    -> face classification -> holes -> pockets -> slots -> bosses
    -> fillets -> chamfers -> threads -> patterns -> ratios and flags
    -> tool constraints -> accessibility -> setups -> stock -> indicators
    -> PMI -> response

Every detector runs inside :meth:`_stage`, so a failure in one detector
degrades that section to a warning instead of failing the whole request.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, Dict, List, Optional, TypeVar

from . import occ
from .accessibility import AccessibilityAnalyzer, SetupAnalyzer
from .complexity import ComplexityIndicatorBuilder, ThinWallAnalyzer
from .config import MachiningConfig, get_machining_config
from .constraints import MachiningComplexityAnalyzer
from .detectors import (
    BossDetector,
    ChamferDetector,
    FilletDetector,
    HoleDetector,
    PocketDetector,
    SlotDetector,
    ThreadDetector,
)
from .faces import summarize_surfaces, to_surface_type_enum
from .parser import CADParser, LoadedModel
from .patterns import PatternDetector
from .pmi import PMIExtractor, thread_name_candidates
from .records import PLANE, MassProperties, ShapeModel
from .schemas import (
    ANALYSIS_VERSION,
    AnalysisError,
    AnalysisWarning,
    BoundingBox,
    DebugGeometry,
    EdgeEntity,
    FaceDetail,
    FeatureCollection,
    FileInfo,
    GeometryInfo,
    MachiningAnalysisOptions,
    MachiningAnalysisResponse,
    ModelInfo,
    MomentsOfInertia,
    TopologyEntities,
    UnitSystem,
    Vector3,
    VertexEntity,
    WarningCode,
)
from .stock import StockAnalyzer
from .topology import GeometryAnalyzer, TopologyAnalyzer
from .units import to_imperial

logger = logging.getLogger(__name__)

T = TypeVar("T")


class MachiningAnalysisService:
    """Runs the full deterministic pipeline over one loaded CAD model."""

    def __init__(self, config: Optional[MachiningConfig] = None):
        self.config = config or get_machining_config()

        self.parser = CADParser(self.config)
        self.topology_analyzer = TopologyAnalyzer(self.config)
        self.geometry_analyzer = GeometryAnalyzer(self.config)

        self.hole_detector = HoleDetector(self.config)
        self.pocket_detector = PocketDetector(self.config)
        self.slot_detector = SlotDetector(self.config)
        self.boss_detector = BossDetector(self.config)
        self.fillet_detector = FilletDetector(self.config)
        self.chamfer_detector = ChamferDetector(self.config)
        self.thread_detector = ThreadDetector(self.config)

        self.pattern_detector = PatternDetector(self.config)
        self.complexity_analyzer = MachiningComplexityAnalyzer(self.config)
        self.accessibility_analyzer = AccessibilityAnalyzer(self.config)
        self.setup_analyzer = SetupAnalyzer(self.config)
        self.stock_analyzer = StockAnalyzer(self.config)
        self.thin_wall_analyzer = ThinWallAnalyzer(self.config)
        self.indicator_builder = ComplexityIndicatorBuilder(self.config)
        self.pmi_extractor = PMIExtractor(self.config)

    # -- public API --------------------------------------------------------

    def analyze(
        self, loaded: LoadedModel, options: MachiningAnalysisOptions
    ) -> MachiningAnalysisResponse:
        started = time.perf_counter()
        warnings: List[AnalysisWarning] = list(loaded.warnings)
        timings: Dict[str, float] = {}

        response = MachiningAnalysisResponse(
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
            # losing it means there is no analysis to return. Surface that as a
            # hard failure rather than an empty but nominally successful body.
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

        response.surface_summary = self._stage(
            "face_classification",
            timings,
            warnings,
            lambda: summarize_surfaces(model),
            default=response.surface_summary,
        )
        if options.include_face_details:
            response.face_details = self._face_details(model)
        if options.include_topology_entities:
            response.topology_entities = self._stage(
                "topology_entities",
                timings,
                warnings,
                lambda: self._topology_entities(model, warnings),
            )

        pmi = self._stage(
            "pmi",
            timings,
            warnings,
            lambda: self.pmi_extractor.extract(loaded.path, loaded.file_format, warnings),
        )
        if pmi is not None:
            response.pmi = pmi

        features = self._detect_features(model, response, timings, warnings)
        if options.include_feature_details:
            response.features = features
        else:
            # Counts and aggregates still flow through complexity_indicators.
            response.features = FeatureCollection(
                fillet_summary=features.fillet_summary,
                chamfer_summary=features.chamfer_summary,
            )

        response.feature_patterns = (
            self._stage(
                "patterns", timings, warnings, lambda: self.pattern_detector.detect(features)
            )
            or []
        )
        response.feature_dimensions = (
            self._stage(
                "dimensions",
                timings,
                warnings,
                lambda: self.complexity_analyzer.dimensions(features),
            )
            or []
        )
        response.machining_flags = (
            self._stage(
                "flags", timings, warnings, lambda: self.complexity_analyzer.flags(features)
            )
            or []
        )
        response.machining_constraints = (
            self._stage(
                "tooling_constraints",
                timings,
                warnings,
                lambda: self.complexity_analyzer.tooling_constraints(features),
            )
            or []
        )
        response.accessibility = (
            self._stage(
                "accessibility",
                timings,
                warnings,
                lambda: self.accessibility_analyzer.analyze(model, features, warnings),
            )
            or []
        )
        response.setup_analysis = self._stage(
            "setups",
            timings,
            warnings,
            lambda: self.setup_analyzer.analyze(response.accessibility),
            default=response.setup_analysis,
        )
        response.stock_analysis = self._stage(
            "stock", timings, warnings, lambda: self.stock_analyzer.analyze(model, mass)
        )

        thin_walls = (
            self._stage(
                "thin_walls",
                timings,
                warnings,
                lambda: self.thin_wall_analyzer.count(model, warnings),
            )
            or 0
        )
        response.complexity_indicators = self._stage(
            "indicators",
            timings,
            warnings,
            lambda: self.indicator_builder.build(
                features,
                response.surface_summary,
                response.machining_flags,
                response.machining_constraints,
                response.accessibility,
                thin_walls,
            ),
            default=response.complexity_indicators,
        )

        self._append_ambiguity_warnings(features, warnings)

        if options.include_debug_geometry:
            response.debug_geometry = DebugGeometry(
                face_adjacency={
                    str(face_id): sorted(neighbors)
                    for face_id, neighbors in sorted(model.face_neighbors.items())
                },
                unclassified_face_ids=sorted(
                    face.id for face in model.faces.values() if face.surface_type == "OTHER"
                ),
                detector_timings_ms={k: round(v, 3) for k, v in sorted(timings.items())},
                kernel=occ.kernel_name(),
            )

        response.warnings = warnings
        response.analysis_duration_ms = round((time.perf_counter() - started) * 1000.0, 3)
        return response

    # -- feature detection -------------------------------------------------

    def _detect_features(
        self,
        model: ShapeModel,
        response: MachiningAnalysisResponse,
        timings: Dict[str, float],
        warnings: List[AnalysisWarning],
    ) -> FeatureCollection:
        features = FeatureCollection()

        holes_result = self._stage(
            "holes", timings, warnings, lambda: self.hole_detector.detect(model)
        )
        if holes_result is not None:
            features.holes, features.bores, features.internal_cylindrical_features = holes_result

        candidates = (
            self._stage(
                "pocket_candidates",
                timings,
                warnings,
                lambda: self.pocket_detector.find_candidates(model),
            )
            or []
        )
        slot_candidates, pocket_candidates = self.slot_detector.split(candidates)

        features.pockets = (
            self._stage(
                "pockets", timings, warnings, lambda: self.pocket_detector.build(pocket_candidates)
            )
            or []
        )
        features.slots = (
            self._stage(
                "slots",
                timings,
                warnings,
                lambda: self.slot_detector.build(model, slot_candidates),
            )
            or []
        )
        features.bosses = (
            self._stage("bosses", timings, warnings, lambda: self.boss_detector.detect(model))
            or []
        )
        features.fillets = (
            self._stage("fillets", timings, warnings, lambda: self.fillet_detector.detect(model))
            or []
        )
        features.chamfers = (
            self._stage(
                "chamfers", timings, warnings, lambda: self.chamfer_detector.detect(model)
            )
            or []
        )
        features.threads = (
            self._stage(
                "threads",
                timings,
                warnings,
                lambda: self.thread_detector.detect(
                    model, features.holes, thread_name_candidates(response.pmi)
                ),
            )
            or []
        )

        features.fillet_summary = self.fillet_detector.summarize(features.fillets)
        features.chamfer_summary = self.chamfer_detector.summarize(features.chamfers)
        return features

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
                        "Volume, centre of mass and the stock estimate should be "
                        "treated as unreliable."
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

    def _face_details(self, model: ShapeModel) -> List[FaceDetail]:
        return [
            self._face_detail(face, model)
            for face in sorted(model.faces.values(), key=lambda f: f.id)
        ]

    def _is_planar_extreme(self, face, model: ShapeModel) -> bool:
        """True when a planar face lies on the model's outer silhouette.

        A face qualifies when it is flat against one of the six sides of the
        model bounding box and its outward normal points away from the solid
        along that axis - the top and bottom of a plate, the sides of a block.
        Both tests matter: flatness alone would also catch a wall that merely
        reaches the extreme, and the normal alone would catch every up-facing
        pocket floor.
        """
        if face.surface_type != PLANE or face.normal is None:
            return False
        tolerance = self.config.linear_tolerance_mm * 10
        for axis in range(3):
            if face.bbox_max[axis] - face.bbox_min[axis] > tolerance:
                continue  # not flat along this axis, so not lying in that plane
            if (
                abs(face.bbox_max[axis] - model.bbox_max[axis]) <= tolerance
                and face.normal[axis] > 0
            ):
                return True
            if (
                abs(face.bbox_min[axis] - model.bbox_min[axis]) <= tolerance
                and face.normal[axis] < 0
            ):
                return True
        return False

    def _face_detail(self, face, model: ShapeModel) -> FaceDetail:
        return FaceDetail(
            face_id=face.id,
            surface_type=to_surface_type_enum(face.surface_type),
            area_mm2=round(face.area_mm2, self.config.area_decimals),
            bounding_box=self._bounding_box(face.bbox_min, face.bbox_max),
            centroid=Vector3.from_tuple(face.centroid),
            normal=Vector3.from_tuple(face.normal) if face.normal else None,
            axis=Vector3.from_tuple(face.axis) if face.axis else None,
            axis_location=(
                Vector3.from_tuple(face.axis_location)
                if face.axis_location
                else None
            ),
            radius_mm=face.radius_mm,
            minor_radius_mm=face.minor_radius_mm,
            cone_half_angle_deg=face.cone_half_angle_deg,
            angular_span_deg=face.angular_span_deg,
            is_internal=face.is_internal,
            is_planar_extreme=self._is_planar_extreme(face, model),
            edge_count=len(face.edge_ids),
        )

    def _topology_entities(
        self, model: ShapeModel, warnings: List[AnalysisWarning]
    ) -> TopologyEntities:
        """Faces, edges and vertices, capped, for a selectable viewer.

        The counts always report the model's true totals; ``truncated``
        says whether the lists themselves were cut short, so a viewer can
        tell 'this part has 40 edges' from 'you are seeing 4000 of 90000'.
        """
        limit = self.config.max_topology_entities
        face_ids = sorted(model.faces)
        edge_ids = sorted(model.edges)
        vertex_ids = sorted(model.vertices)

        truncated = (
            len(face_ids) > limit
            or len(edge_ids) > limit
            or len(vertex_ids) > limit
        )
        if truncated:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.LARGE_MODEL,
                    message=(
                        f"Topology entity lists were capped at {limit} per "
                        "category. Counts still reflect the whole model."
                    ),
                    detail={
                        "faces": len(face_ids),
                        "edges": len(edge_ids),
                        "vertices": len(vertex_ids),
                        "limit": limit,
                    },
                )
            )

        return TopologyEntities(
            faces=[self._face_detail(model.faces[i], model) for i in face_ids[:limit]],
            edges=[self._edge_entity(model.edges[i]) for i in edge_ids[:limit]],
            vertices=[
                VertexEntity(
                    vertex_id=i,
                    position=Vector3.from_tuple(model.vertices[i].position),
                )
                for i in vertex_ids[:limit]
            ],
            face_count=len(face_ids),
            edge_count=len(edge_ids),
            vertex_count=len(vertex_ids),
            truncated=truncated,
            entity_limit=limit,
        )

    def _edge_entity(self, edge) -> EdgeEntity:
        return EdgeEntity(
            edge_id=edge.id,
            curve_type=edge.curve_type,
            start=Vector3.from_tuple(edge.start),
            end=Vector3.from_tuple(edge.end),
            midpoint=Vector3.from_tuple(edge.midpoint),
            length_mm=round(edge.length_mm, self.config.length_decimals),
            radius_mm=edge.radius_mm,
            axis=Vector3.from_tuple(edge.axis) if edge.axis else None,
            is_closed=edge.is_closed,
            is_seam=edge.is_seam,
            face_ids=list(edge.face_ids),
        )

    def _append_ambiguity_warnings(
        self, features: FeatureCollection, warnings: List[AnalysisWarning]
    ) -> None:
        ambiguous = [
            feature.id
            for group in (
                features.holes,
                features.bores,
                features.internal_cylindrical_features,
                features.pockets,
                features.slots,
                features.bosses,
                features.threads,
                features.chamfers,
            )
            for feature in group
            if getattr(feature, "status", None) == "ambiguous"
        ]
        if ambiguous:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.AMBIGUOUS_FEATURE,
                    message=(
                        f"{len(ambiguous)} feature(s) could not be resolved "
                        "unambiguously from geometry; each carries a 'reason'."
                    ),
                    detail={"feature_ids": sorted(ambiguous)},
                )
            )

    # -- helpers -----------------------------------------------------------

    def _stage(
        self,
        name: str,
        timings: Dict[str, float],
        warnings: List[AnalysisWarning],
        fn: Callable[[], T],
        default: Optional[T] = None,
    ) -> Optional[T]:
        """Run one pipeline stage, converting a crash into a warning.

        A single detector failing on unusual geometry should not cost the
        client the other twelve sections of the analysis.
        """
        started = time.perf_counter()
        try:
            return fn()
        except Exception as exc:
            logger.exception("Machining stage '%s' failed", name)
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


def analyze_machining(
    loaded: LoadedModel,
    options: Optional[MachiningAnalysisOptions] = None,
    config: Optional[MachiningConfig] = None,
) -> Dict[str, Any]:
    """Analyse a loaded model and return a JSON-ready dict in the requested units."""
    options = options or MachiningAnalysisOptions()
    service = MachiningAnalysisService(config)
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
