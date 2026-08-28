"""Pydantic request/response models for ``POST /api/v1/cad/analyze-machining``.

The response is the contract a downstream costing engine consumes. It is
deliberately free of anything cost-, machine-, or price-related: it describes
geometry and nothing else.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

ANALYSIS_VERSION = "1.0"


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class UnitSystem(str, Enum):
    metric = "metric"
    imperial = "imperial"


class SurfaceType(str, Enum):
    PLANE = "PLANE"
    CYLINDER = "CYLINDER"
    CONE = "CONE"
    SPHERE = "SPHERE"
    TORUS = "TORUS"
    BSPLINE = "BSPLINE"
    BEZIER = "BEZIER"
    REVOLUTION = "REVOLUTION"
    EXTRUSION = "EXTRUSION"
    OFFSET = "OFFSET"
    OTHER = "OTHER"


class DetectionMethod(str, Enum):
    """How a feature was identified - recorded on every feature."""

    TOPOLOGY_AND_SURFACE = "topology_and_surface_analysis"
    SURFACE_TYPE = "surface_type_analysis"
    TANGENCY = "tangency_analysis"
    COAXIAL_GROUPING = "coaxial_grouping"
    ADJACENCY = "adjacency_analysis"
    RAY_CASTING = "ray_casting"
    CAD_METADATA = "cad_metadata"
    HELICAL_GEOMETRY = "helical_geometry"
    BOUNDING_BOX = "bounding_box"


class FeatureStatus(str, Enum):
    RESOLVED = "resolved"
    AMBIGUOUS = "ambiguous"


class InformationSource(str, Enum):
    """Distinguishes what the kernel measured from what the file declared."""

    GEOMETRY = "GEOMETRY"
    CAD_METADATA = "CAD_METADATA"


class ThreadConfidence(str, Enum):
    EXPLICIT = "explicit"
    GEOMETRIC = "geometric"
    UNKNOWN = "unknown"


class WarningCode(str, Enum):
    MULTIPLE_SOLIDS = "MULTIPLE_SOLIDS"
    NO_SOLID = "NO_SOLID"
    OPEN_SHELL = "OPEN_SHELL"
    GEOMETRY_REPAIRED = "GEOMETRY_REPAIRED"
    INVALID_GEOMETRY = "INVALID_GEOMETRY"
    UNIT_ASSUMED = "UNIT_ASSUMED"
    DETECTOR_FAILED = "DETECTOR_FAILED"
    LARGE_MODEL = "LARGE_MODEL"
    AMBIGUOUS_FEATURE = "AMBIGUOUS_FEATURE"
    PMI_UNAVAILABLE = "PMI_UNAVAILABLE"
    ACCESSIBILITY_UNRELIABLE = "ACCESSIBILITY_UNRELIABLE"


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------


class Vector3(BaseModel):
    """A point or a direction. Direction fields are always unit length."""

    x: float
    y: float
    z: float

    model_config = {"json_schema_extra": {"example": {"x": 0.0, "y": 0.0, "z": 1.0}}}

    @classmethod
    def from_tuple(cls, values) -> "Vector3":
        return cls(x=float(values[0]), y=float(values[1]), z=float(values[2]))

    def as_tuple(self):
        return (self.x, self.y, self.z)


class BoundingBox(BaseModel):
    min: Vector3
    max: Vector3
    length_mm: float = Field(description="Extent along X.")
    width_mm: float = Field(description="Extent along Y.")
    height_mm: float = Field(description="Extent along Z.")
    diagonal_mm: float


class Detection(BaseModel):
    """Provenance for a detected feature."""

    method: DetectionMethod
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Calibrated to the strength of the geometric evidence, not to a "
            "measurement precision. Discrete: 1.0 exact kernel fact, 0.9 "
            "unambiguous topology, 0.7 heuristic with corroboration, 0.5 "
            "single weak signal."
        ),
    )
    evidence: List[str] = Field(
        default_factory=list, description="Human-readable facts supporting the call."
    )
    source: InformationSource = InformationSource.GEOMETRY


class FeatureBase(BaseModel):
    id: str
    type: str
    detection: Detection
    status: FeatureStatus = FeatureStatus.RESOLVED
    reason: Optional[str] = Field(
        default=None, description="Set when status is 'ambiguous'."
    )
    face_ids: List[int] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# File / model / geometry / topology
# ---------------------------------------------------------------------------


class FileInfo(BaseModel):
    filename: str
    format: str
    file_size_bytes: int
    sha256: Optional[str] = None


class ModelInfo(BaseModel):
    solid_count: int = 0
    shell_count: int = 0
    face_count: int = 0
    edge_count: int = 0
    vertex_count: int = 0
    wire_count: int = 0
    compound_count: int = 0
    is_valid: bool = True
    has_open_shells: bool = False
    is_multi_body: bool = False


class TopologyInfo(BaseModel):
    """Raw topology counts plus adjacency statistics."""

    faces_per_solid: List[int] = Field(default_factory=list)
    closed_shell_count: int = 0
    open_shell_count: int = 0
    free_edge_count: int = Field(
        default=0, description="Edges bounded by fewer than two faces."
    )
    seam_edge_count: int = 0
    max_faces_per_edge: int = 0
    euler_characteristic: Optional[int] = None


class MomentsOfInertia(BaseModel):
    """Inertia about the centre of mass, in mm^5 (unit-density second moments)."""

    ixx: float
    iyy: float
    izz: float
    ixy: float
    ixz: float
    iyz: float
    principal: Optional[List[float]] = None


class GeometryInfo(BaseModel):
    bounding_box: BoundingBox
    volume_mm3: float
    surface_area_mm2: float
    center_of_mass: Vector3
    moments_of_inertia: Optional[MomentsOfInertia] = None
    is_closed_volume: bool = True
    source: InformationSource = InformationSource.GEOMETRY


class SurfaceSummary(BaseModel):
    planar_faces: int = 0
    cylindrical_faces: int = 0
    conical_faces: int = 0
    spherical_faces: int = 0
    toroidal_faces: int = 0
    freeform_faces: int = Field(
        default=0, description="B-spline and Bezier surfaces combined."
    )
    other_faces: int = 0
    total_faces: int = 0
    internal_cylindrical_faces: int = 0
    external_cylindrical_faces: int = 0


class FaceDetail(BaseModel):
    """Per-face record, returned only when ``include_face_details=true``."""

    face_id: int
    surface_type: SurfaceType
    area_mm2: float
    bounding_box: BoundingBox
    centroid: Optional[Vector3] = Field(
        default=None, description="Area centroid - the anchor for a marker."
    )
    normal: Optional[Vector3] = Field(
        default=None, description="Outward normal at the face centre (planar faces)."
    )
    axis: Optional[Vector3] = Field(
        default=None, description="Axis of revolution for cylinder/cone/torus."
    )
    axis_location: Optional[Vector3] = None
    radius_mm: Optional[float] = None
    minor_radius_mm: Optional[float] = Field(
        default=None, description="Tube radius for toroidal faces."
    )
    cone_half_angle_deg: Optional[float] = None
    angular_span_deg: Optional[float] = None
    is_internal: Optional[bool] = Field(
        default=None, description="True when the surface is concave (encloses material)."
    )
    is_planar_extreme: bool = Field(
        default=False, description="Face lies on the outer silhouette of the model."
    )
    edge_count: int = 0


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------


class HoleFeature(FeatureBase):
    """A cylindrical internal feature below the bore diameter threshold.

    Built by grouping *concave* cylinders that share an axis line. An external
    cylinder is a shaft or a boss and never appears here.
    """

    type: str = "hole"
    subtype: str = Field(
        description="through | blind | counterbore | countersink | stepped | unknown"
    )
    diameter_mm: float
    radius_mm: float
    depth_mm: float
    through: Optional[bool] = None
    position: Vector3 = Field(description="Centre of the hole entry.")
    axis: Vector3
    quantity: int = Field(default=1, description="1 unless merged into a pattern.")
    depth_diameter_ratio: Optional[float] = None
    is_stepped: bool = False
    has_counterbore: bool = False
    has_countersink: bool = False
    counterbore_diameter_mm: Optional[float] = None
    counterbore_depth_mm: Optional[float] = None
    countersink_diameter_mm: Optional[float] = None
    countersink_angle_deg: Optional[float] = None
    coaxial_feature_ids: List[str] = Field(default_factory=list)
    steps: List[Dict[str, Any]] = Field(
        default_factory=list, description="Ordered diameter/depth pairs when stepped."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "HOLE-001",
                "type": "hole",
                "subtype": "through",
                "diameter_mm": 10.0,
                "radius_mm": 5.0,
                "depth_mm": 25.0,
                "through": True,
                "position": {"x": 40.0, "y": 25.0, "z": 20.0},
                "axis": {"x": 0.0, "y": 0.0, "z": 1.0},
                "quantity": 1,
                "depth_diameter_ratio": 2.5,
                "status": "resolved",
                "detection": {
                    "method": "coaxial_grouping",
                    "confidence": 0.95,
                    "evidence": ["1 coaxial concave cylindrical face(s)"],
                    "source": "GEOMETRY",
                },
            }
        }
    }


class BoreFeature(FeatureBase):
    type: str = "bore"
    diameter_mm: float
    depth_mm: float
    blind: Optional[bool] = None
    position: Vector3
    axis: Vector3
    depth_diameter_ratio: Optional[float] = None
    is_stepped: bool = False


class PocketFeature(FeatureBase):
    type: str = "pocket"
    length_mm: float
    width_mm: float
    depth_mm: float
    area_mm2: float
    bottom_type: str = Field(description="planar | curved | stepped | open | unknown")
    closed: Optional[bool] = None
    corner_radius_mm: Optional[float] = None
    minimum_internal_radius_mm: Optional[float] = None
    machining_direction: List[float] = Field(
        description="Unit vector a tool would approach along."
    )
    position: Vector3
    depth_width_ratio: Optional[float] = None
    wall_count: int = 0


class SlotFeature(FeatureBase):
    type: str = "slot"
    subtype: str = Field(
        description="through_slot | blind_slot | rounded_end_slot | keyway | t_slot | unknown"
    )
    length_mm: float
    width_mm: float
    depth_mm: float
    through: Optional[bool] = None
    corner_radius_mm: Optional[float] = None
    orientation: Vector3 = Field(description="Direction of the slot's long axis.")
    machining_direction: List[float]
    position: Vector3
    depth_width_ratio: Optional[float] = None


class BossFeature(FeatureBase):
    type: str = "boss"
    subtype: str = Field(default="cylindrical", description="cylindrical | prismatic")
    diameter_mm: Optional[float] = None
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    height_mm: float
    position: Vector3
    axis: Vector3


class FilletFeature(FeatureBase):
    type: str = "fillet"
    radius_mm: float
    edge_count: int = 1
    length_mm: Optional[float] = Field(default=None, description="Swept edge length.")
    position: Optional[Vector3] = None
    internal: Optional[bool] = Field(
        default=None, description="True for concave (material-side) fillets."
    )
    is_corner_fillet: bool = Field(
        default=False, description="Toroidal corner blend rather than an edge blend."
    )


class ChamferFeature(FeatureBase):
    type: str = "chamfer"
    size_mm: float
    angle_deg: Optional[float] = None
    edge_count: int = 1
    length_mm: Optional[float] = None
    position: Optional[Vector3] = None


class ThreadFeature(FeatureBase):
    """A thread claimed from CAD metadata or modelled helical geometry.

    A designation is never derived from diameter alone - see ``designation``.
    """

    type: str = "thread"
    thread_type: str = Field(
        default="unknown", description="internal_thread | external_thread | unknown"
    )
    designation: Optional[str] = Field(
        default=None,
        description=(
            "Only populated when the CAD file states it. Never inferred from "
            "diameter alone."
        ),
    )
    nominal_diameter_mm: Optional[float] = None
    pitch_mm: Optional[float] = None
    depth_mm: Optional[float] = None
    confidence: ThreadConfidence = ThreadConfidence.UNKNOWN
    related_feature_id: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "THREAD-001",
                "type": "thread",
                "thread_type": "internal_thread",
                "designation": None,
                "nominal_diameter_mm": 6.8,
                "pitch_mm": None,
                "confidence": "unknown",
                "status": "ambiguous",
                "reason": (
                    "Helical geometry detected but no thread designation is "
                    "present in the CAD file. The designation is not inferred "
                    "from diameter."
                ),
                "detection": {
                    "method": "helical_geometry",
                    "confidence": 0.8,
                    "evidence": ["2.9 turns, pitch not measurable"],
                    "source": "GEOMETRY",
                },
            }
        }
    }


class FilletSummary(BaseModel):
    count: int = 0
    unique_radii_mm: List[float] = Field(default_factory=list)
    minimum_radius_mm: Optional[float] = None
    minimum_internal_radius_mm: Optional[float] = Field(
        default=None,
        description="Drives the tool-diameter constraint for milled corners.",
    )


class ChamferSummary(BaseModel):
    count: int = 0
    sizes_mm: List[float] = Field(default_factory=list)
    unique_angles_deg: List[float] = Field(default_factory=list)


class FeatureCollection(BaseModel):
    holes: List[HoleFeature] = Field(default_factory=list)
    bores: List[BoreFeature] = Field(default_factory=list)
    internal_cylindrical_features: List[BoreFeature] = Field(
        default_factory=list,
        description="Internal cylinders that could not be resolved to hole or bore.",
    )
    pockets: List[PocketFeature] = Field(default_factory=list)
    slots: List[SlotFeature] = Field(default_factory=list)
    bosses: List[BossFeature] = Field(default_factory=list)
    threads: List[ThreadFeature] = Field(default_factory=list)
    fillets: List[FilletFeature] = Field(default_factory=list)
    chamfers: List[ChamferFeature] = Field(default_factory=list)
    fillet_summary: FilletSummary = Field(default_factory=FilletSummary)
    chamfer_summary: ChamferSummary = Field(default_factory=ChamferSummary)


# ---------------------------------------------------------------------------
# Patterns, flags, constraints, accessibility, setups, stock
# ---------------------------------------------------------------------------


class FeaturePattern(BaseModel):
    type: str = Field(description="e.g. repeated_hole, repeated_pocket")
    feature_type: str
    feature_count: int
    feature_ids: List[str] = Field(default_factory=list)
    pattern_type: str = Field(description="linear | circular | rectangular | grouped")
    diameter_mm: Optional[float] = None
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    depth_mm: Optional[float] = None
    spacing_mm: Optional[float] = None
    axis: Optional[Vector3] = None
    detection: Detection


class FeatureDimensionRatio(BaseModel):
    feature_id: str
    feature_type: str
    diameter_mm: Optional[float] = None
    width_mm: Optional[float] = None
    depth_mm: Optional[float] = None
    depth_diameter_ratio: Optional[float] = None
    depth_width_ratio: Optional[float] = None


class MachiningFlag(BaseModel):
    feature_id: str
    flag: str = Field(description="DEEP_HOLE, VERY_DEEP_HOLE, DEEP_POCKET, ...")
    reason: str
    threshold: Optional[float] = None
    value: Optional[float] = None


class ToolingConstraint(BaseModel):
    """The largest tool that geometrically fits an internal corner.

    A tool of diameter *d* cannot produce a corner of radius below *d/2*, so
    ``maximum_tool_diameter_mm = 2 x minimum_internal_radius_mm``.
    """

    minimum_internal_radius_mm: float
    maximum_tool_diameter_mm: float
    note: str = (
        "Geometric limit only. No cutting parameters, tool selection, or feeds "
        "and speeds are implied."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "minimum_internal_radius_mm": 2.0,
                "maximum_tool_diameter_mm": 4.0,
            }
        }
    }


class MachiningConstraint(BaseModel):
    feature_id: str
    feature_type: str
    tooling_constraints: ToolingConstraint


class FeatureAccessibility(BaseModel):
    feature_id: str
    feature_type: str
    accessibility: Dict[str, bool]
    accessible_direction_count: int
    primary_direction: Optional[str] = None
    requires_rotation: bool = Field(
        description="True when the feature is not reachable from the primary setup."
    )
    requires_advanced_axis_analysis: bool = Field(
        default=False,
        description=(
            "Set when the six principal directions cannot settle the question. "
            "This endpoint does not claim 4- or 5-axis requirements."
        ),
    )
    detection: Detection


class SetupCandidate(BaseModel):
    direction: str
    accessible_feature_count: int
    feature_ids: List[str] = Field(default_factory=list)


class SetupAnalysis(BaseModel):
    candidate_directions: List[SetupCandidate] = Field(default_factory=list)
    minimum_direction_count_covering_all: Optional[int] = Field(
        default=None,
        description="Greedy set-cover size over the six principal directions.",
    )
    unreachable_feature_ids: List[str] = Field(default_factory=list)
    requires_rotation: bool = False
    note: str = (
        "Geometric evidence for a downstream planner. This is not a setup plan."
    )


class StockDimensions(BaseModel):
    length: float
    width: float
    height: float


class StockFormKind(str, Enum):
    """Geometric stock form. Not a purchasing recommendation."""

    SHEET = "SHEET"
    PLATE = "PLATE"
    ROUND_BAR = "ROUND_BAR"
    SQUARE_BAR = "SQUARE_BAR"
    RECTANGULAR_BAR = "RECTANGULAR_BAR"
    BLOCK = "BLOCK"


class RoundStockEvidence(BaseModel):
    """The external cylinder that separates round bar from square bar."""

    face_id: int
    radius_mm: float
    axis: List[float] = Field(
        description="Unit direction of the cylinder axis. Never unit-converted."
    )
    axial_coverage: float = Field(
        description="Fraction of the long extent this cylinder spans."
    )


class SheetEvidence(BaseModel):
    """Wall measurements behind a sheet classification."""

    method: str = "opposed_planar_faces"
    wall_thickness_mm: float = Field(
        description="Dominant separation between opposed planar faces."
    )
    paired_area_fraction: float = Field(
        description=(
            "Fraction of the total surface area sitting on walls of this "
            "thickness. A solid block with one thin web scores low here, and "
            "so does a turned part whose end faces happen to sit close."
        )
    )
    formed: bool = Field(
        description=(
            "True when the part is bent or drawn, so `sorted_dimensions_mm` is "
            "the folded envelope and not the flat blank. This endpoint does "
            "not unfold the part, so the blank size is not reported."
        )
    )


class StockForm(BaseModel):
    """Which mill form the envelope resembles, from extents and face evidence.

    Purely geometric. It says a part *could* be cut from bar, plate or sheet of
    these proportions; it does not say that stock is available, appropriate for
    the material, or cheapest - those need context this endpoint does not have.
    """

    method: str = "extent_ratios_and_surface_evidence"
    form: Optional[StockFormKind] = None
    status: FeatureStatus = FeatureStatus.RESOLVED
    reason: Optional[str] = Field(
        default=None,
        description="Why the classification is ambiguous. Null when resolved.",
    )
    candidate_forms: List[StockFormKind] = Field(
        default_factory=list,
        description="Forms in contention when status is ambiguous.",
    )
    bounds_method: str = Field(
        description=(
            "`obb` when an oriented bounding box was available, `aabb` when the "
            "classification fell back to the axis-aligned box - which "
            "misjudges parts modelled off-axis."
        )
    )
    sorted_dimensions_mm: StockDimensions = Field(
        description="Extents sorted descending: length >= width >= height."
    )
    thickness_mm: float = Field(description="Smallest extent.")
    flatness_ratio: float = Field(description="thickness / width.")
    slenderness_ratio: float = Field(description="width / length.")
    cross_section_ratio: float = Field(
        description="Relative difference between the two smaller extents."
    )
    round_evidence: Optional[RoundStockEvidence] = None
    sheet_evidence: Optional[SheetEvidence] = None
    note: str = (
        "Geometric form of the envelope. No material, grade, availability or "
        "cost is implied, and this is not a purchasing recommendation."
    )


class StockAnalysis(BaseModel):
    """Bounding box plus a configurable allowance. Always an estimate."""

    method: str = "bounding_box_plus_allowance"
    estimated: bool = Field(
        default=True,
        description="Always true - this is not a purchased stock specification.",
    )
    allowance_per_side_mm: float
    stock_dimensions_mm: StockDimensions
    stock_volume_mm3: float
    finished_volume_mm3: float
    removed_volume_mm3: float
    material_removal_ratio: float
    stock_form: Optional[StockForm] = Field(
        default=None,
        description=(
            "Which mill form the envelope resembles - sheet, plate, or bar. "
            "Null when the extents are degenerate."
        ),
    )
    note: str = (
        "Bounding-box estimate. Not a commercially purchased stock size, and no "
        "material, grade, or cost is implied."
    )


class ComplexityIndicators(BaseModel):
    """Deterministic counts only - no difficulty or price score.

    Weighing these against each other is a judgement that needs context this
    endpoint does not have (quantity, material, machine, tolerances), so it is
    left to the downstream costing engine.
    """

    hole_count: int = 0
    deep_hole_count: int = 0
    pocket_count: int = 0
    slot_count: int = 0
    bore_count: int = 0
    thread_count: int = 0
    fillet_count: int = 0
    chamfer_count: int = 0
    boss_count: int = 0
    freeform_surface_count: int = 0
    thin_wall_count: int = 0
    unique_tool_diameter_constraints: int = 0
    accessible_directions: int = 0
    distinct_hole_diameter_count: int = 0
    minimum_internal_radius_mm: Optional[float] = None
    maximum_depth_diameter_ratio: Optional[float] = None
    feature_count_total: int = 0


class PMIEntry(BaseModel):
    key: str
    value: Any
    source: InformationSource = InformationSource.CAD_METADATA


class PMIInfo(BaseModel):
    available: bool = False
    part_name: Optional[str] = None
    part_number: Optional[str] = None
    revision: Optional[str] = None
    material: Optional[str] = None
    surface_finish: Optional[str] = None
    gdt: List[Dict[str, Any]] = Field(default_factory=list)
    datums: List[str] = Field(default_factory=list)
    annotations: List[str] = Field(default_factory=list)
    feature_names: List[str] = Field(default_factory=list)
    raw: List[PMIEntry] = Field(default_factory=list)
    source: InformationSource = InformationSource.CAD_METADATA
    note: str = (
        "Everything here is declared by the CAD file, not measured from the "
        "geometry."
    )


class AnalysisWarning(BaseModel):
    code: WarningCode
    message: str
    detail: Optional[Dict[str, Any]] = None


class AnalysisError(BaseModel):
    code: str
    message: str
    detail: Optional[Dict[str, Any]] = None


class EdgeEntity(BaseModel):
    """One topological edge, positioned for selection and overlay drawing."""

    edge_id: int
    curve_type: str = Field(description="LINE | CIRCLE | ELLIPSE | BSPLINE | OTHER")
    start: Vector3
    end: Vector3
    midpoint: Vector3
    length_mm: float
    radius_mm: Optional[float] = None
    axis: Optional[Vector3] = None
    is_closed: bool = False
    is_seam: bool = Field(
        default=False, description="Closing line of a periodic surface, not a real boundary."
    )
    face_ids: List[int] = Field(default_factory=list)


class VertexEntity(BaseModel):
    """One topological vertex."""

    vertex_id: int
    position: Vector3


class TopologyEntities(BaseModel):
    """Selectable B-Rep entities, returned when ``include_topology_entities=true``.

    Coordinates are in the same CAD frame as every other position in this
    response, so a viewer can place them with one shared transform.
    """

    faces: List[FaceDetail] = Field(default_factory=list)
    edges: List[EdgeEntity] = Field(default_factory=list)
    vertices: List[VertexEntity] = Field(default_factory=list)
    face_count: int = Field(default=0, description="Total in the model, before any cap.")
    edge_count: int = 0
    vertex_count: int = 0
    truncated: bool = Field(
        default=False,
        description="True when a list was capped; counts still report the true totals.",
    )
    entity_limit: int = 0


class DebugGeometry(BaseModel):
    """Only populated when ``include_debug_geometry=true``."""

    face_adjacency: Dict[str, List[int]] = Field(default_factory=dict)
    unclassified_face_ids: List[int] = Field(default_factory=list)
    detector_timings_ms: Dict[str, float] = Field(default_factory=dict)
    kernel: Optional[str] = None


# ---------------------------------------------------------------------------
# Response envelope
# ---------------------------------------------------------------------------


class MachiningAnalysisOptions(BaseModel):
    unit_system: UnitSystem = UnitSystem.metric
    include_face_details: bool = False
    include_feature_details: bool = True
    include_debug_geometry: bool = False
    include_topology_entities: bool = False


class MachiningAnalysisResponse(BaseModel):
    success: bool = True
    analysis_version: str = ANALYSIS_VERSION
    kernel: Optional[str] = None
    units: str = Field(
        default="mm",
        description="Linear unit of every *_mm field. 'in' when unit_system=imperial.",
    )
    options: MachiningAnalysisOptions = Field(default_factory=MachiningAnalysisOptions)
    analysis_duration_ms: Optional[float] = None

    file: FileInfo
    model: ModelInfo
    geometry: Optional[GeometryInfo] = None
    topology: TopologyInfo = Field(default_factory=TopologyInfo)
    surface_summary: SurfaceSummary = Field(default_factory=SurfaceSummary)
    face_details: Optional[List[FaceDetail]] = None
    topology_entities: Optional[TopologyEntities] = Field(
        default=None,
        description=(
            "Selectable faces, edges and vertices for a 3D viewer. Opt-in: the "
            "list is large for real parts."
        ),
    )

    features: FeatureCollection = Field(default_factory=FeatureCollection)
    feature_patterns: List[FeaturePattern] = Field(default_factory=list)
    feature_dimensions: List[FeatureDimensionRatio] = Field(default_factory=list)
    machining_flags: List[MachiningFlag] = Field(default_factory=list)
    machining_constraints: List[MachiningConstraint] = Field(default_factory=list)
    accessibility: List[FeatureAccessibility] = Field(default_factory=list)
    setup_analysis: SetupAnalysis = Field(default_factory=SetupAnalysis)
    stock_analysis: Optional[StockAnalysis] = None
    complexity_indicators: ComplexityIndicators = Field(
        default_factory=ComplexityIndicators
    )
    pmi: PMIInfo = Field(default_factory=PMIInfo)

    warnings: List[AnalysisWarning] = Field(default_factory=list)
    errors: List[AnalysisError] = Field(default_factory=list)
    debug_geometry: Optional[DebugGeometry] = None


class MachiningErrorResponse(BaseModel):
    """Body returned with every 4xx/5xx from this endpoint."""

    success: bool = False
    analysis_version: str = ANALYSIS_VERSION
    errors: List[AnalysisError]
    warnings: List[AnalysisWarning] = Field(default_factory=list)
