from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Literal, Tuple, Optional, Dict, Any


HoleType = Literal["through", "blind"]


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


@dataclass
class PocketFeature:
    id: str
    planar_face_ids: List[int]
    depth_mm: float
    mouth_area_mm2: float
    aspect_ratio: float


@dataclass
class MinWallSample:
    at: Tuple[float, float, float]
    thickness_mm: float
    face_ids: List[int]


@dataclass
class MinWallData:
    global_min_mm: float
    samples: List[MinWallSample]
    all_distances: List[float] = None  # All sampled distances for clustering
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

