"""Boss detection - external raised cylindrical features.

Only convex cylinders that stand proud of a surrounding planar face are
reported. Prismatic bosses are not claimed: separating a prismatic boss from an
ordinary step or rib needs more than face adjacency, and guessing would put
false features into the costing input.
"""

from __future__ import annotations

import logging
import math
from typing import List, Optional, Tuple

from ..config import MachiningConfig
from ..records import CYLINDER, PLANE, FaceRecord, ShapeModel
from ..schemas import BossFeature, Detection, DetectionMethod, FeatureStatus, Vector3
from ..vectors import Vec, canonical_axis, dot, is_parallel, project_scalar, scale
from .shared import axial_range, axis_point, feature_id, group_coaxial

logger = logging.getLogger(__name__)

#: A boss must wrap essentially all the way round; anything less is a wall.
_MIN_ANGULAR_SPAN_DEG = 270.0


class BossDetector:
    """Finds convex cylindrical stand-offs."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def detect(self, model: ShapeModel) -> List[BossFeature]:
        candidates = [
            face
            for face in model.faces_of_type(CYLINDER)
            if self._is_candidate(face)
        ]

        features: List[BossFeature] = []
        for group in group_coaxial(candidates, self.config):
            feature = self._build(model, group, len(features) + 1)
            if feature is not None:
                features.append(feature)
        return features

    def _is_candidate(self, face: FaceRecord) -> bool:
        if face.is_internal is not False:
            return False  # concave -> a hole, not a boss
        if not face.radius_mm or face.radius_mm * 2.0 < self.config.boss_min_diameter_mm:
            return False
        span = face.angular_span_deg
        return span is None or span >= _MIN_ANGULAR_SPAN_DEG

    def _build(
        self, model: ShapeModel, group: List[FaceRecord], index: int
    ) -> Optional[BossFeature]:
        axis = canonical_axis(group[0].axis)
        origin = group[0].axis_location
        ranges = [axial_range(face, axis, origin) for face in group]
        t_min = min(r[0] for r in ranges)
        t_max = max(r[1] for r in ranges)
        height = t_max - t_min
        if height < self.config.boss_min_height_mm:
            return None

        radius = max(f.radius_mm or 0.0 for f in group)
        top, base = self._caps(model, group, axis, origin, radius)
        if top is None and base is None:
            # Nothing to stand proud of - this is a shaft or the outer wall of
            # a turned part, not a boss on a face.
            return None

        # Report the free end as the boss top.
        if top is not None:
            top_level = (
                axial_range(top, axis, origin)[0] + axial_range(top, axis, origin)[1]
            ) / 2.0
            up = axis if abs(top_level - t_max) < abs(top_level - t_min) else scale(axis, -1.0)
            position = axis_point(origin, axis, top_level)
        else:
            up = axis
            position = axis_point(origin, axis, t_max)

        evidence = [
            f"{len(group)} coaxial convex cylindrical face(s)",
            f"axial height {round(height, 3)} mm",
        ]
        if top is not None:
            evidence.append(f"capped by planar face {top.id}")
        if base is not None:
            evidence.append(f"rises from planar face {base.id}")

        return BossFeature(
            id=feature_id("BOSS", index),
            subtype="cylindrical",
            diameter_mm=radius * 2.0,
            height_mm=height,
            position=Vector3.from_tuple(position),
            axis=Vector3.from_tuple(up),
            face_ids=sorted(
                {f.id for f in group}
                | ({top.id} if top else set())
                | ({base.id} if base else set())
            ),
            status=FeatureStatus.RESOLVED if top is not None else FeatureStatus.AMBIGUOUS,
            reason=(
                None
                if top is not None
                else (
                    "Convex cylinder rises from a planar face but has no planar "
                    "cap; it may be a boss, a shaft, or a blended protrusion."
                )
            ),
            detection=Detection(
                method=DetectionMethod.TOPOLOGY_AND_SURFACE,
                confidence=0.85 if top is not None else 0.6,
                evidence=evidence,
            ),
        )

    def _caps(
        self,
        model: ShapeModel,
        group: List[FaceRecord],
        axis: Vec,
        origin: Vec,
        radius: float,
    ) -> Tuple[Optional[FaceRecord], Optional[FaceRecord]]:
        """Return ``(top_cap, base_face)`` adjoining the cylinder stack.

        The cap is a small planar face roughly the size of the cylinder
        cross-section; the base is a markedly larger planar face the boss sits on.
        """
        member_ids = {f.id for f in group}
        cap_area = math.pi * radius * radius
        top: Optional[FaceRecord] = None
        base: Optional[FaceRecord] = None

        for face in group:
            for neighbor in model.neighbors(face.id):
                if neighbor.id in member_ids or neighbor.surface_type != PLANE:
                    continue
                if neighbor.normal is None or not is_parallel(
                    neighbor.normal, axis, self.config.angular_tolerance_deg * 5
                ):
                    continue
                if neighbor.area_mm2 <= cap_area * 1.3:
                    if top is None or neighbor.area_mm2 < top.area_mm2:
                        top = neighbor
                elif neighbor.area_mm2 > cap_area * 1.5:
                    if base is None or neighbor.area_mm2 > base.area_mm2:
                        base = neighbor
        return top, base
