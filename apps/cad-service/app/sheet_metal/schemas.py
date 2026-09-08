"""Pydantic request/response models for ``POST /api/v1/cad/analyze-sheet-metal``.

Mirrors ``app.machining.schemas``'s envelope, error and detection conventions
exactly (see design doc section 4). The ``file``/``model``/``topology``/
``geometry``/``pmi``/``debug_geometry`` sections are reused verbatim - not
re-declared - by importing the machining models directly, since the design
calls those shapes "literally reused". Everything sheet-metal-specific
(candidate scoring, thickness, bends, holes, cutouts, ...) is new here.

Phase 1 note: no detector exists yet. Every sheet-metal-specific section below
is Optional/empty-default and is populated starting in later phases; today's
``service.py`` only fills file/model/topology/geometry.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# Reused verbatim from machining - same field names, same semantics.
from ..machining.schemas import (
    AnalysisError,
    AnalysisWarning,
    Detection,
    DebugGeometry,
    FileInfo,
    GeometryInfo,
    ModelInfo,
    PMIInfo,
    TopologyInfo,
    UnitSystem,
    Vector3,
    WarningCode,
)

ANALYSIS_VERSION = "0.1"


# ---------------------------------------------------------------------------
# Sheet-metal candidate scoring
# ---------------------------------------------------------------------------


class SheetMetalCandidateEvidence(BaseModel):
    paired_area_fraction: Optional[float] = Field(
        default=None,
        description="Fraction of surface area sitting on opposed thin-wall face pairs.",
    )
    flatness_ratio: Optional[float] = Field(
        default=None, description="thickness / largest planar extent."
    )
    dominant_thickness_mm: Optional[float] = None
    method: Optional[str] = None


class SheetMetalCandidate(BaseModel):
    """Gate for the rest of the pipeline - see design doc section 5, stage 5.

    A rejected candidate is not a hard failure: the response is still
    returned, with every sheet-metal-specific section left empty and this
    field's ``reason`` explaining why.
    """

    is_candidate: bool = False
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence: SheetMetalCandidateEvidence = Field(default_factory=SheetMetalCandidateEvidence)
    status: str = Field(default="resolved", description="resolved | ambiguous | rejected")
    reason: Optional[str] = Field(
        default="Sheet-metal candidate scoring has not run yet (detectors ship in a later phase).",
    )


# ---------------------------------------------------------------------------
# Thickness
# ---------------------------------------------------------------------------


class ThicknessInfo(BaseModel):
    dominant_thickness_mm: Optional[float] = None
    is_uniform: Optional[bool] = None
    variance_mm: Optional[float] = None
    method: Optional[str] = None
    sample_count: int = 0
    note: Optional[str] = "Thickness detection has not run yet."


# ---------------------------------------------------------------------------
# Faces / base+flange
# ---------------------------------------------------------------------------


class FlangeFace(BaseModel):
    face_id: int
    area_mm2: float
    plane_normal: Vector3
    adjacent_bend_ids: List[str] = Field(default_factory=list)


class SheetMetalFaces(BaseModel):
    base_face_id: Optional[int] = None
    flange_faces: List[FlangeFace] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Bends / bend reliefs
# ---------------------------------------------------------------------------


class BendLine(BaseModel):
    start: Vector3
    end: Vector3


class BendFeature(BaseModel):
    id: str
    angle_deg: float
    inner_radius_mm: float
    bend_line: BendLine
    axis: Vector3
    length_mm: float
    direction: str = Field(description="up | down")
    sequence_hint: int = Field(
        description="Geometric adjacency order - not a manufacturing sequence guarantee."
    )
    k_factor_assumed: float
    bend_allowance_mm: Optional[float] = None
    bend_deduction_mm: Optional[float] = None
    adjacent_flange_ids: List[str] = Field(default_factory=list)
    detection: Detection


class BendRelief(BaseModel):
    id: str
    bend_id: str
    type: str = Field(description="rectangular | round | none-detected")
    width_mm: Optional[float] = None
    depth_mm: Optional[float] = None
    position: Optional[Vector3] = None
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Holes / cutouts / slots / hems
# ---------------------------------------------------------------------------


class SheetMetalHole(BaseModel):
    id: str
    diameter_mm: float
    position: Vector3
    shape: str = Field(default="round", description="round | slotted")
    quantity: int = 1
    distance_to_nearest_edge_mm: Optional[float] = None
    distance_to_nearest_bend_mm: Optional[float] = None


class Cutout(BaseModel):
    id: str
    perimeter_mm: float
    area_mm2: float
    shape_type: str
    min_feature_size_mm: Optional[float] = None
    position: Vector3
    distance_to_nearest_edge_mm: Optional[float] = None
    distance_to_nearest_bend_mm: Optional[float] = None


class SheetMetalSlot(BaseModel):
    id: str
    length_mm: float
    width_mm: float
    corner_radius_mm: Optional[float] = None
    orientation: Vector3
    position: Vector3
    distance_to_nearest_bend_mm: Optional[float] = None


class Hem(BaseModel):
    id: str
    type: str = Field(description="open | closed | teardrop")
    length_mm: float
    position: Vector3
    adjacent_flange_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Outer profile / DFM distance flags
# ---------------------------------------------------------------------------


class ProfileValidityIssue(BaseModel):
    code: str
    message: str
    location: Optional[Vector3] = None


class OuterProfile(BaseModel):
    perimeter_mm: Optional[float] = None
    is_closed: Optional[bool] = None
    validity_issues: List[ProfileValidityIssue] = Field(default_factory=list)


class DistanceFlag(BaseModel):
    feature_id: str
    feature_type: str
    flag: str = Field(
        description=(
            "HOLE_TOO_CLOSE_TO_EDGE | HOLE_TOO_CLOSE_TO_BEND | "
            "BEND_RADIUS_TOO_TIGHT | FEATURE_BELOW_MIN_SIZE | ..."
        )
    )
    reason: str
    threshold: Optional[float] = None
    value: Optional[float] = None


# ---------------------------------------------------------------------------
# Patterns / symmetry / complexity
# ---------------------------------------------------------------------------


class SheetMetalFeaturePattern(BaseModel):
    type: str = Field(description="e.g. repeated_hole")
    feature_type: str
    feature_count: int
    feature_ids: List[str] = Field(default_factory=list)
    pattern_type: str = Field(description="linear | circular | rectangular | grouped")
    spacing_mm: Optional[float] = None
    axis: Optional[Vector3] = None
    detection: Detection


class Symmetry(BaseModel):
    has_symmetry: bool = False
    axis_or_plane: Optional[str] = None
    symmetry_type: str = Field(default="none", description="mirror | rotational | none")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    note: Optional[str] = "Symmetry detection has not run yet."


class SheetMetalComplexityIndicators(BaseModel):
    """Deterministic counts only - no difficulty or price score.

    Matches machining's documented stance: cost/difficulty judgement is left
    to a downstream costing engine.
    """

    bend_count: int = 0
    unique_bend_angle_count: int = 0
    unique_bend_radius_count: int = 0
    hole_count: int = 0
    cutout_count: int = 0
    slot_count: int = 0
    hem_count: int = 0
    distinct_hole_diameter_count: int = 0
    minimum_bend_radius_mm: Optional[float] = None
    minimum_feature_to_edge_distance_mm: Optional[float] = None
    minimum_feature_to_bend_distance_mm: Optional[float] = None
    feature_count_total: int = 0


# ---------------------------------------------------------------------------
# Response envelope
# ---------------------------------------------------------------------------


class SheetMetalAnalysisOptions(BaseModel):
    unit_system: UnitSystem = UnitSystem.metric
    include_face_details: bool = False
    include_feature_details: bool = True
    include_debug_geometry: bool = False
    include_topology_entities: bool = False


class SheetMetalAnalysisResponse(BaseModel):
    success: bool = True
    analysis_version: str = ANALYSIS_VERSION
    kernel: Optional[str] = None
    units: str = Field(
        default="mm",
        description="Linear unit of every *_mm field. 'in' when unit_system=imperial.",
    )
    options: SheetMetalAnalysisOptions = Field(default_factory=SheetMetalAnalysisOptions)
    analysis_duration_ms: Optional[float] = None

    # Reused verbatim from machining.
    file: FileInfo
    model: ModelInfo = Field(default_factory=ModelInfo)
    topology: TopologyInfo = Field(default_factory=TopologyInfo)
    geometry: Optional[GeometryInfo] = None

    # Sheet-metal specific. All Optional/empty-default: no detector runs
    # before Phase 2 onward, so these are structurally present but inert.
    sheet_metal_candidate: SheetMetalCandidate = Field(default_factory=SheetMetalCandidate)
    thickness: ThicknessInfo = Field(default_factory=ThicknessInfo)
    faces: SheetMetalFaces = Field(default_factory=SheetMetalFaces)
    bends: List[BendFeature] = Field(default_factory=list)
    bend_reliefs: List[BendRelief] = Field(default_factory=list)
    holes: List[SheetMetalHole] = Field(default_factory=list)
    cutouts: List[Cutout] = Field(default_factory=list)
    slots: List[SheetMetalSlot] = Field(default_factory=list)
    hems: List[Hem] = Field(default_factory=list)
    outer_profile: OuterProfile = Field(default_factory=OuterProfile)
    distance_flags: List[DistanceFlag] = Field(default_factory=list)
    feature_patterns: List[SheetMetalFeaturePattern] = Field(default_factory=list)
    symmetry: Symmetry = Field(default_factory=Symmetry)
    complexity_indicators: SheetMetalComplexityIndicators = Field(
        default_factory=SheetMetalComplexityIndicators
    )
    pmi: PMIInfo = Field(default_factory=PMIInfo)

    warnings: List[AnalysisWarning] = Field(default_factory=list)
    errors: List[AnalysisError] = Field(default_factory=list)
    debug_geometry: Optional[DebugGeometry] = None


class SheetMetalErrorResponse(BaseModel):
    """Body returned with every 4xx/5xx from this endpoint."""

    success: bool = False
    analysis_version: str = ANALYSIS_VERSION
    errors: List[AnalysisError]
    warnings: List[AnalysisWarning] = Field(default_factory=list)
