"""Pocket detection.

A pocket is recognised topologically: a planar face that is *recessed* below
the model silhouette and enclosed by faces rising from it. A planar face with
no surrounding walls is just a flat surface, and is never reported as a pocket.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from ..config import MachiningConfig
from ..raycast import RayProbe
from ..records import CYLINDER, PLANE, FaceRecord, ShapeModel
from ..schemas import Detection, DetectionMethod, FeatureStatus, PocketFeature, Vector3
from ..vectors import Vec, dot, project_scalar, scale
from .shared import (
    axial_range,
    feature_id,
    is_outer_face,
    min_corner_radius,
    planar_dimensions,
    wall_faces_of,
)

logger = logging.getLogger(__name__)


@dataclass
class PocketCandidate:
    """A recessed floor face plus everything measured about it.

    Shared with :mod:`.slots` so slots and pockets come from one detection pass
    and can never both claim the same floor.
    """

    floor: FaceRecord
    walls: List[FaceRecord]
    normal: Vec
    depth_mm: float
    length_mm: float
    width_mm: float
    long_axis: Vec
    short_axis: Vec
    area_mm2: float
    corner_radius_mm: Optional[float]
    closed: bool
    bottom_type: str
    evidence: List[str] = field(default_factory=list)

    @property
    def aspect_ratio(self) -> float:
        return self.length_mm / self.width_mm if self.width_mm > 0 else 0.0

    @property
    def face_ids(self) -> List[int]:
        return sorted({self.floor.id} | {w.id for w in self.walls})


class PocketDetector:
    """Finds recessed planar floors and reports the non-slot ones as pockets."""

    def __init__(self, config: MachiningConfig):
        self.config = config
        #: ``face_id -> reason`` for planar faces turned down as pocket floors.
        #: Reported through ``debug_geometry`` so an empty pocket list can be
        #: told apart from a detector that quietly dropped everything.
        self.rejections: Dict[int, str] = {}

    # -- candidate discovery ----------------------------------------------

    def find_candidates(self, model: ShapeModel) -> List[PocketCandidate]:
        # Face ids restart per model; a reused detector must not carry the
        # previous part's rejections into this one.
        self.rejections = {}
        probe = RayProbe(model, self.config)
        if not probe.available:
            logger.warning(
                "Ray probing unavailable; pocket floors cannot be distinguished "
                "from pocket walls and no pockets will be reported."
            )
            return []
        candidates: List[PocketCandidate] = []
        for face in sorted(model.faces.values(), key=lambda f: f.id):
            candidate = self._evaluate(model, face, probe)
            if candidate is not None:
                candidates.append(candidate)
        return candidates

    def _reject(self, floor: FaceRecord, reason: str) -> None:
        """Record why a planar face was not accepted as a pocket floor.

        Only planar faces are recorded: every other surface type is not a
        candidate in the first place, and listing them would bury the
        interesting rejections in noise.
        """
        self.rejections[floor.id] = reason

    def _evaluate(
        self, model: ShapeModel, floor: FaceRecord, probe: RayProbe
    ) -> Optional[PocketCandidate]:
        if floor.surface_type != PLANE or floor.normal is None:
            return None
        if floor.claimed_by == "hole":
            self._reject(floor, "already claimed by a hole or bore")
            return None
        if floor.area_mm2 < self.config.pocket_min_area_mm2:
            self._reject(
                floor,
                f"area {round(floor.area_mm2, 2)} mm2 is below "
                f"pocket_min_area_mm2 ({self.config.pocket_min_area_mm2})",
            )
            return None
        if is_outer_face(model, floor, self.config):
            # Sits on the silhouette - this is stock surface, not a pocket floor.
            self._reject(floor, "lies on the model silhouette - stock surface")
            return None

        # A pocket *wall* also has a recessed position and perpendicular
        # neighbours, so geometry alone cannot separate it from a floor. The
        # difference is that a floor is visible looking down its own normal,
        # while a wall is edge-on to that view and hidden behind the part.
        if not probe.is_face_exposed(floor.centroid, floor.normal):
            self._reject(
                floor, "not visible along its own normal - a wall, not a floor"
            )
            return None

        walls = wall_faces_of(model, floor, self.config)
        if len(walls) < self.config.pocket_min_wall_count:
            self._reject(
                floor,
                f"{len(walls)} surrounding wall face(s), below "
                f"pocket_min_wall_count ({self.config.pocket_min_wall_count})",
            )
            return None

        normal = floor.normal
        depth = self._depth(floor, walls, normal)
        if depth < self.config.pocket_min_depth_mm:
            self._reject(
                floor,
                f"depth {round(depth, 3)} mm is below pocket_min_depth_mm "
                f"({self.config.pocket_min_depth_mm})",
            )
            return None

        length, width, long_axis, short_axis = planar_dimensions(floor, normal)
        if width <= 0:
            self._reject(floor, "degenerate in-plane dimensions")
            return None

        return PocketCandidate(
            floor=floor,
            walls=walls,
            normal=normal,
            depth_mm=depth,
            length_mm=length,
            width_mm=width,
            long_axis=long_axis,
            short_axis=short_axis,
            area_mm2=floor.area_mm2,
            corner_radius_mm=min_corner_radius(walls),
            closed=self._is_closed(model, floor, walls),
            bottom_type="planar",
            evidence=[
                f"planar floor face {floor.id} recessed below the silhouette",
                f"{len(walls)} enclosing wall face(s)",
                f"depth {round(depth, 3)} mm along the floor normal",
            ],
        )

    def _depth(self, floor: FaceRecord, walls: List[FaceRecord], normal: Vec) -> float:
        """Height the walls rise above the floor, along the floor normal."""
        origin = (0.0, 0.0, 0.0)
        floor_level = project_scalar(floor.centroid, origin, normal)
        wall_tops = [axial_range(w, normal, origin)[1] for w in walls]
        if not wall_tops:
            return 0.0
        return max(0.0, max(wall_tops) - floor_level)

    def _is_closed(
        self, model: ShapeModel, floor: FaceRecord, walls: List[FaceRecord]
    ) -> bool:
        """True when every boundary edge of the floor is met by a wall.

        An edge that runs out to a face which is not a wall means the pocket
        opens out to the side - an open pocket, which a downstream planner may
        machine very differently.
        """
        wall_ids = {w.id for w in walls}
        for edge_id in floor.edge_ids:
            edge = model.edges.get(edge_id)
            if edge is None:
                continue
            others = [fid for fid in edge.face_ids if fid != floor.id]
            if not others:
                return False  # free edge - open boundary
            if not any(fid in wall_ids for fid in others):
                return False
        return True

    # -- output ------------------------------------------------------------

    def build(self, candidates: List[PocketCandidate]) -> List[PocketFeature]:
        features: List[PocketFeature] = []
        for index, candidate in enumerate(candidates, start=1):
            features.append(
                PocketFeature(
                    id=feature_id("POCKET", index),
                    length_mm=candidate.length_mm,
                    width_mm=candidate.width_mm,
                    depth_mm=candidate.depth_mm,
                    area_mm2=candidate.area_mm2,
                    bottom_type=candidate.bottom_type,
                    closed=candidate.closed,
                    corner_radius_mm=candidate.corner_radius_mm,
                    minimum_internal_radius_mm=candidate.corner_radius_mm,
                    machining_direction=list(candidate.normal),
                    position=Vector3.from_tuple(candidate.floor.centroid),
                    depth_width_ratio=(
                        candidate.depth_mm / candidate.width_mm
                        if candidate.width_mm > 0
                        else None
                    ),
                    wall_count=len(candidate.walls),
                    face_ids=candidate.face_ids,
                    detection=Detection(
                        method=DetectionMethod.TOPOLOGY_AND_SURFACE,
                        confidence=0.9 if candidate.closed else 0.75,
                        evidence=candidate.evidence
                        + (
                            ["floor boundary fully enclosed by walls"]
                            if candidate.closed
                            else ["floor boundary opens to a non-wall face"]
                        ),
                    ),
                    status=(
                        FeatureStatus.RESOLVED
                        if candidate.closed
                        else FeatureStatus.AMBIGUOUS
                    ),
                    reason=(
                        None
                        if candidate.closed
                        else (
                            "Floor is recessed and walled but its boundary is not "
                            "closed; this may be an open pocket, a step, or a face "
                            "adjoining another feature."
                        )
                    ),
                )
            )
        return features
