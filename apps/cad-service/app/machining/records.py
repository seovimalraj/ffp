"""Kernel-independent intermediate representation.

The B-Rep is traversed exactly once and flattened into these plain dataclasses.
Every detector then reasons over ``ShapeModel`` instead of touching OCCT again,
which keeps the detectors fast, deterministic and unit-testable without a CAD
kernel installed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from .vectors import Vec

# Surface type identifiers - mirror ``schemas.SurfaceType`` values.
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

FREEFORM_TYPES = frozenset({BSPLINE, BEZIER})


@dataclass
class EdgeRecord:
    """One topological edge."""

    id: int
    curve_type: str = OTHER
    length_mm: float = 0.0
    start: Vec = (0.0, 0.0, 0.0)
    end: Vec = (0.0, 0.0, 0.0)
    midpoint: Vec = (0.0, 0.0, 0.0)
    radius_mm: Optional[float] = None
    axis: Optional[Vec] = None
    is_closed: bool = False
    is_seam: bool = False
    face_ids: List[int] = field(default_factory=list)
    #: Sparse point sample, populated only for free-form curves so helical
    #: thread geometry can be recognised without re-opening the kernel.
    samples: List[Vec] = field(default_factory=list)

    @property
    def is_free(self) -> bool:
        """An edge bounded by fewer than two faces - indicates an open shell.

        A seam edge is excluded: it is bounded twice by the *same* face (the
        closing line of a cylinder), which is a closed surface, not a hole in
        the shell.
        """
        return len(self.face_ids) < 2 and not self.is_seam

    @property
    def is_helical(self) -> bool:
        """A closed-ish B-spline that climbs along its own axis reads as helical."""
        return self.curve_type == "HELIX"


@dataclass
class FaceRecord:
    """One topological face with its resolved surface parameters."""

    id: int
    surface_type: str = OTHER
    area_mm2: float = 0.0
    bbox_min: Vec = (0.0, 0.0, 0.0)
    bbox_max: Vec = (0.0, 0.0, 0.0)
    centroid: Vec = (0.0, 0.0, 0.0)

    # Planar
    normal: Optional[Vec] = None

    # Revolved surfaces (cylinder / cone / torus / sphere)
    axis: Optional[Vec] = None
    axis_location: Optional[Vec] = None
    radius_mm: Optional[float] = None
    minor_radius_mm: Optional[float] = None
    cone_half_angle_deg: Optional[float] = None
    angular_span_deg: Optional[float] = None
    axial_extent_mm: Optional[float] = None

    # Orientation / concavity
    is_internal: Optional[bool] = None
    reversed_orientation: bool = False

    edge_ids: List[int] = field(default_factory=list)
    solid_index: int = 0

    # Set by detectors so later stages know what has already been claimed.
    claimed_by: Optional[str] = None

    @property
    def is_freeform(self) -> bool:
        return self.surface_type in FREEFORM_TYPES

    @property
    def bbox_size(self) -> Vec:
        return (
            self.bbox_max[0] - self.bbox_min[0],
            self.bbox_max[1] - self.bbox_min[1],
            self.bbox_max[2] - self.bbox_min[2],
        )

    def diameter_mm(self) -> Optional[float]:
        return None if self.radius_mm is None else self.radius_mm * 2.0


@dataclass
class VertexRecord:
    """One topological vertex."""

    id: int
    position: Vec = (0.0, 0.0, 0.0)


@dataclass
class ShapeModel:
    """Flattened B-Rep plus the adjacency indices detectors need."""

    faces: Dict[int, FaceRecord] = field(default_factory=dict)
    edges: Dict[int, EdgeRecord] = field(default_factory=dict)
    vertices: Dict[int, VertexRecord] = field(default_factory=dict)

    solid_count: int = 0
    shell_count: int = 0
    wire_count: int = 0
    vertex_count: int = 0
    compound_count: int = 0

    bbox_min: Vec = (0.0, 0.0, 0.0)
    bbox_max: Vec = (0.0, 0.0, 0.0)

    #: face id -> ids of faces sharing at least one edge
    face_neighbors: Dict[int, Set[int]] = field(default_factory=dict)
    #: (face_a, face_b) -> shared edge ids
    shared_edges: Dict[Tuple[int, int], List[int]] = field(default_factory=dict)

    #: Live handles, only present when a real kernel produced this model.
    _occ_faces: Dict[int, Any] = field(default_factory=dict, repr=False)
    _occ_shape: Any = field(default=None, repr=False)

    def neighbors(self, face_id: int) -> List[FaceRecord]:
        return [
            self.faces[n]
            for n in sorted(self.face_neighbors.get(face_id, ()))
            if n in self.faces
        ]

    def shared_edge_records(self, face_a: int, face_b: int) -> List[EdgeRecord]:
        key = (face_a, face_b) if face_a <= face_b else (face_b, face_a)
        return [self.edges[e] for e in self.shared_edges.get(key, []) if e in self.edges]

    def faces_of_type(self, *types: str) -> List[FaceRecord]:
        wanted = set(types)
        return [f for f in self.faces.values() if f.surface_type in wanted]

    @property
    def bbox_size(self) -> Vec:
        return (
            self.bbox_max[0] - self.bbox_min[0],
            self.bbox_max[1] - self.bbox_min[1],
            self.bbox_max[2] - self.bbox_min[2],
        )

    @property
    def bbox_diagonal(self) -> float:
        sx, sy, sz = self.bbox_size
        return (sx * sx + sy * sy + sz * sz) ** 0.5


@dataclass
class MassProperties:
    """Kernel mass properties for the whole model."""

    volume_mm3: float = 0.0
    surface_area_mm2: float = 0.0
    center_of_mass: Vec = (0.0, 0.0, 0.0)
    ixx: float = 0.0
    iyy: float = 0.0
    izz: float = 0.0
    ixy: float = 0.0
    ixz: float = 0.0
    iyz: float = 0.0
    principal: Optional[List[float]] = None
    is_closed_volume: bool = True
