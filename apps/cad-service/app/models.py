from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Literal, Tuple, Optional, Dict, Any


HoleType = Literal["through", "blind", "countersink", "counterbore"]


@dataclass
class HoleFeature:
    id: str
    type: HoleType
    diameter_mm: float
    depth_mm: float
    axis: Tuple[float, float, float]
    entry_face_id: Optional[int] = None
    exit_face_id: Optional[int] = None
    tri_indices: List[int] = field(default_factory=list)
    position: Optional[Tuple[float, float, float]] = None  # Center position


@dataclass
class PocketFeature:
    id: str
    planar_face_ids: List[int]
    depth_mm: float
    mouth_area_mm2: float
    aspect_ratio: float
    # Enhanced fields for classification
    step_count: int = 1  # Number of depth levels (multi-step = CNC)
    corner_radius_mm: float = 0.0  # Tool radius at corners (R3-R6mm = CNC)
    is_through: bool = False  # Through pocket vs blind (through = more sheet-metal-like)


@dataclass
class ThreadFeature:
    """Detected threaded hole or boss."""
    id: str
    hole_id: Optional[str]  # Reference to parent hole if detected from hole
    diameter_mm: float
    pitch_mm: float
    depth_mm: float
    thread_type: Literal["internal", "external"]
    is_standard: bool  # Whether it matches a standard thread size
    standard_name: Optional[str] = None  # e.g. "M6x1.0"
    position: Optional[Tuple[float, float, float]] = None


@dataclass
class SlotFeature:
    """Detected slot (elongated pocket with parallel walls)."""
    id: str
    length_mm: float
    width_mm: float
    depth_mm: float
    slot_type: Literal["through", "blind", "t_slot", "dovetail"]
    orientation: Tuple[float, float, float] = (0.0, 0.0, 0.0)  # Slot axis direction
    face_ids: List[int] = field(default_factory=list)


@dataclass
class UndercutFeature:
    """Detected undercut (inaccessible region for standard tooling)."""
    id: str
    undercut_type: Literal["internal", "external", "groove", "recess"]
    severity: Literal["minor", "moderate", "severe"]
    depth_mm: float
    width_mm: float
    requires_special_tooling: bool
    face_ids: List[int] = field(default_factory=list)
    description: str = ""


@dataclass
class FilletFeature:
    """Detected fillet or chamfer."""
    id: str
    feature_type: Literal["fillet", "chamfer"]
    radius_mm: float  # Radius for fillet, leg size for chamfer
    length_mm: float  # Edge length
    edge_id: Optional[int] = None
    # Enhanced classification
    is_tool_radius: bool = False  # True if R3-R6mm (CNC tool radius)
    is_bend_relief: bool = False  # True if ≤R2mm on sheet metal context


@dataclass
class DraftAngleInfo:
    """Draft angle analysis for a face."""
    face_id: int
    draft_angle_deg: float
    is_sufficient: bool  # Meets minimum for injection molding
    area_mm2: float


@dataclass
class NestingEstimate:
    """Sheet metal nesting efficiency estimate."""
    sheet_width_mm: float
    sheet_height_mm: float
    parts_per_sheet: int
    utilization_pct: float
    flat_width_mm: float
    flat_length_mm: float
    rotation_deg: float = 0.0


@dataclass
class GrainDirectionInfo:
    """Grain/rolling direction analysis for sheet metal."""
    recommended_direction: Tuple[float, float, float]
    bend_axes: List[Tuple[float, float, float]]
    alignment_score: float  # 0-1, 1 = all bends perpendicular to grain
    notes: List[str] = field(default_factory=list)


@dataclass
class MinWallSample:
    at: Tuple[float, float, float]
    thickness_mm: float
    face_ids: List[int]


@dataclass
class MinWallData:
    global_min_mm: float
    samples: List[MinWallSample]
    all_distances: Optional[List[float]] = None  # All sampled distances for clustering
    thickness_median: float = 0.0
    thickness_mode: float = 0.0
    is_uniform: bool = False


@dataclass
class MassProps:
    volume_mm3: float
    surface_area_mm2: float


@dataclass
class BBox:
    x: float
    y: float
    z: float


@dataclass
class FeaturesJson:
    version: str
    units: str
    bbox: BBox
    mass_props: MassProps
    holes: List[HoleFeature]
    pockets: List[PocketFeature]
    min_wall: MinWallData
    source: Dict[str, Any]
    threads: List[ThreadFeature] = field(default_factory=list)
    slots: List[SlotFeature] = field(default_factory=list)
    undercuts: List[UndercutFeature] = field(default_factory=list)
    fillets: List[FilletFeature] = field(default_factory=list)

