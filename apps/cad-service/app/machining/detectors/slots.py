"""Slot detection.

Slots are elongated pockets, so they come from the same recessed-floor pass as
pockets and are split out by aspect ratio. Splitting rather than detecting
independently guarantees a floor is never reported as both a pocket and a slot.
"""

from __future__ import annotations

import logging
from typing import List, Optional, Tuple

from ..config import MachiningConfig
from ..records import CYLINDER, PLANE, FaceRecord, ShapeModel
from ..schemas import Detection, DetectionMethod, FeatureStatus, SlotFeature, Vector3
from ..vectors import is_parallel
from .pockets import PocketCandidate
from .shared import feature_id

logger = logging.getLogger(__name__)


class SlotDetector:
    """Separates slot-shaped floors from general pockets and sub-types them."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def split(
        self, candidates: List[PocketCandidate]
    ) -> Tuple[List[PocketCandidate], List[PocketCandidate]]:
        """Partition candidates into ``(slots, pockets)``."""
        slots, pockets = [], []
        for candidate in candidates:
            if self._is_slot(candidate):
                slots.append(candidate)
            else:
                pockets.append(candidate)
        return slots, pockets

    def _is_slot(self, candidate: PocketCandidate) -> bool:
        if candidate.width_mm > self.config.slot_max_width_mm:
            return False
        return candidate.aspect_ratio >= self.config.slot_min_aspect_ratio

    # -- sub-typing --------------------------------------------------------

    def _subtype(
        self, model: ShapeModel, candidate: PocketCandidate
    ) -> Tuple[str, float, Optional[str]]:
        """Return ``(subtype, confidence, ambiguity_reason)``.

        A T-slot is only claimed when a wall genuinely undercuts the opening;
        otherwise the honest answer is the plain through/blind distinction.
        """
        through = not candidate.closed

        if self._has_undercut_wall(model, candidate):
            return "t_slot", 0.7, (
                "A wall face overhangs the slot opening, which is consistent "
                "with a T-slot or a dovetail; the exact profile cannot be "
                "resolved from face adjacency alone."
            )

        rounded = self._has_rounded_ends(candidate)

        if through:
            return "through_slot", 0.85, None
        if rounded:
            if candidate.width_mm <= self.config.keyway_max_width_mm and (
                candidate.corner_radius_mm
                and abs(candidate.corner_radius_mm * 2.0 - candidate.width_mm)
                <= self.config.linear_tolerance_mm * 100
            ):
                # End radius equal to half the width is the signature of an
                # end-mill plunge - a keyway or a milled rounded-end slot.
                return "rounded_end_slot", 0.8, None
            return "rounded_end_slot", 0.75, None
        return "blind_slot", 0.8, None

    def _has_rounded_ends(self, candidate: PocketCandidate) -> bool:
        for wall in candidate.walls:
            if wall.surface_type != CYLINDER or not wall.radius_mm:
                continue
            if is_parallel(wall.axis or (0, 0, 1), candidate.normal, self.config.angular_tolerance_deg * 5):
                if abs(wall.radius_mm * 2.0 - candidate.width_mm) <= max(
                    0.1, candidate.width_mm * 0.15
                ):
                    return True
        return False

    def _has_undercut_wall(self, model: ShapeModel, candidate: PocketCandidate) -> bool:
        """True when a wall's neighbour leans back over the slot mouth."""
        wall_ids = {w.id for w in candidate.walls}
        for wall in candidate.walls:
            for neighbor in model.neighbors(wall.id):
                if neighbor.id in wall_ids or neighbor.id == candidate.floor.id:
                    continue
                if neighbor.surface_type != PLANE or neighbor.normal is None:
                    continue
                # A face whose outward normal opposes the slot's opening
                # direction, sitting above the floor, overhangs the mouth.
                from ..vectors import dot, project_scalar

                if dot(neighbor.normal, candidate.normal) < -0.85:
                    floor_level = project_scalar(
                        candidate.floor.centroid, (0.0, 0.0, 0.0), candidate.normal
                    )
                    neighbor_level = project_scalar(
                        neighbor.centroid, (0.0, 0.0, 0.0), candidate.normal
                    )
                    if neighbor_level > floor_level + self.config.linear_tolerance_mm:
                        return True
        return False

    # -- output ------------------------------------------------------------

    def build(self, model: ShapeModel, candidates: List[PocketCandidate]) -> List[SlotFeature]:
        features: List[SlotFeature] = []
        for index, candidate in enumerate(candidates, start=1):
            subtype, confidence, reason = self._subtype(model, candidate)
            features.append(
                SlotFeature(
                    id=feature_id("SLOT", index),
                    subtype=subtype,
                    length_mm=candidate.length_mm,
                    width_mm=candidate.width_mm,
                    depth_mm=candidate.depth_mm,
                    through=not candidate.closed,
                    corner_radius_mm=candidate.corner_radius_mm,
                    orientation=Vector3.from_tuple(candidate.long_axis),
                    machining_direction=list(candidate.normal),
                    position=Vector3.from_tuple(candidate.floor.centroid),
                    depth_width_ratio=(
                        candidate.depth_mm / candidate.width_mm
                        if candidate.width_mm > 0
                        else None
                    ),
                    face_ids=candidate.face_ids,
                    status=(
                        FeatureStatus.AMBIGUOUS if reason else FeatureStatus.RESOLVED
                    ),
                    reason=reason,
                    detection=Detection(
                        method=DetectionMethod.TOPOLOGY_AND_SURFACE,
                        confidence=confidence,
                        evidence=candidate.evidence
                        + [
                            f"length/width aspect ratio {round(candidate.aspect_ratio, 2)}"
                            f" >= {self.config.slot_min_aspect_ratio}",
                        ],
                    ),
                )
            )
        return features
