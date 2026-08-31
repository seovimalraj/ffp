"""Depth ratios, machining flags and geometric tool-diameter constraints.

Two things live here, and both are purely geometric:

* **flags** - dimensionless ratios crossing configurable thresholds
  (``DEEP_HOLE``, ``DEEP_POCKET``, ...). The thresholds come from
  :class:`~app.machining.config.MachiningConfig`, never from the detectors.
* **tool constraints** - the largest tool diameter that can physically enter an
  internal corner: ``d_max = 2 * r_corner``. No cutting parameters, tool
  selection, feeds, speeds or cost follow from this.
"""

from __future__ import annotations

import logging
from typing import List, Optional, Sequence, Tuple

from .config import MachiningConfig
from .detectors.shared import feature_id
from .records import FaceRecord
from .schemas import (
    FeatureCollection,
    FeatureDimensionRatio,
    MachiningConstraint,
    MachiningFlag,
    PocketFeature,
    SlotFeature,
    ToolingConstraint,
)

logger = logging.getLogger(__name__)


class MachiningComplexityAnalyzer:
    """Derives ratios, flags and tooling constraints from detected features."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    # -- dimension ratios --------------------------------------------------

    def dimensions(self, features: FeatureCollection) -> List[FeatureDimensionRatio]:
        rows: List[FeatureDimensionRatio] = []

        for hole in features.holes:
            rows.append(
                FeatureDimensionRatio(
                    feature_id=hole.id,
                    feature_type="hole",
                    diameter_mm=hole.diameter_mm,
                    depth_mm=hole.depth_mm,
                    depth_diameter_ratio=hole.depth_diameter_ratio,
                )
            )
        for bore in list(features.bores) + list(features.internal_cylindrical_features):
            rows.append(
                FeatureDimensionRatio(
                    feature_id=bore.id,
                    feature_type=bore.type,
                    diameter_mm=bore.diameter_mm,
                    depth_mm=bore.depth_mm,
                    depth_diameter_ratio=bore.depth_diameter_ratio,
                )
            )
        for pocket in features.pockets:
            rows.append(
                FeatureDimensionRatio(
                    feature_id=pocket.id,
                    feature_type="pocket",
                    width_mm=pocket.width_mm,
                    depth_mm=pocket.depth_mm,
                    depth_width_ratio=pocket.depth_width_ratio,
                )
            )
        for slot in features.slots:
            rows.append(
                FeatureDimensionRatio(
                    feature_id=slot.id,
                    feature_type="slot",
                    width_mm=slot.width_mm,
                    depth_mm=slot.depth_mm,
                    depth_width_ratio=slot.depth_width_ratio,
                )
            )
        return rows

    # -- flags -------------------------------------------------------------

    def flags(self, features: FeatureCollection) -> List[MachiningFlag]:
        flags: List[MachiningFlag] = []

        for hole in features.holes:
            ratio = hole.depth_diameter_ratio
            if ratio is not None:
                if ratio >= self.config.very_deep_hole_depth_diameter_ratio:
                    flags.append(
                        self._flag(
                            hole.id,
                            "VERY_DEEP_HOLE",
                            "depth_diameter_ratio",
                            ratio,
                            self.config.very_deep_hole_depth_diameter_ratio,
                        )
                    )
                elif ratio >= self.config.deep_hole_depth_diameter_ratio:
                    flags.append(
                        self._flag(
                            hole.id,
                            "DEEP_HOLE",
                            "depth_diameter_ratio",
                            ratio,
                            self.config.deep_hole_depth_diameter_ratio,
                        )
                    )
            if hole.diameter_mm < self.config.small_hole_diameter_mm:
                flags.append(
                    MachiningFlag(
                        feature_id=hole.id,
                        flag="SMALL_DIAMETER_HOLE",
                        reason=(
                            f"diameter_mm = {round(hole.diameter_mm, 3)} < "
                            f"{self.config.small_hole_diameter_mm}"
                        ),
                        value=hole.diameter_mm,
                        threshold=self.config.small_hole_diameter_mm,
                    )
                )

        for pocket in features.pockets:
            if (
                pocket.depth_width_ratio is not None
                and pocket.depth_width_ratio >= self.config.deep_pocket_depth_width_ratio
            ):
                flags.append(
                    self._flag(
                        pocket.id,
                        "DEEP_POCKET",
                        "depth_width_ratio",
                        pocket.depth_width_ratio,
                        self.config.deep_pocket_depth_width_ratio,
                    )
                )

        for slot in features.slots:
            if slot.width_mm < self.config.narrow_slot_width_mm:
                flags.append(
                    MachiningFlag(
                        feature_id=slot.id,
                        flag="NARROW_SLOT",
                        reason=(
                            f"width_mm = {round(slot.width_mm, 3)} < "
                            f"{self.config.narrow_slot_width_mm}"
                        ),
                        value=slot.width_mm,
                        threshold=self.config.narrow_slot_width_mm,
                    )
                )
            if (
                slot.depth_width_ratio is not None
                and slot.depth_width_ratio >= self.config.deep_pocket_depth_width_ratio
            ):
                flags.append(
                    self._flag(
                        slot.id,
                        "DEEP_SLOT",
                        "depth_width_ratio",
                        slot.depth_width_ratio,
                        self.config.deep_pocket_depth_width_ratio,
                    )
                )

        # Stable ordering so identical input always serialises identically.
        flags.sort(key=lambda f: (f.feature_id, f.flag))
        return flags

    def thin_wall_flags(
        self, walls: Sequence[Tuple[FaceRecord, FaceRecord, float]]
    ) -> List[MachiningFlag]:
        """One ``THIN_WALL`` flag per measured wall, thinnest first.

        ``thin_wall_count`` was already reported but raised nothing, so a part
        with nine thin walls looked identical to a part with none in the flag
        list. Wall thickness drives fixturing, chatter and scrap risk, so it
        belongs with the other machining flags rather than only in a count.

        A wall is a pair of faces, not a feature, so ``feature_id`` carries a
        synthetic ``WALL-nnn`` id and the two face ids go in the reason - there
        is no feature to point at.
        """
        ordered = sorted(walls, key=lambda w: (w[2], w[0].id, w[1].id))
        threshold = self.config.thin_wall_thickness_mm
        return [
            MachiningFlag(
                feature_id=feature_id("WALL", index),
                flag="THIN_WALL",
                reason=(
                    f"faces {face_a.id} and {face_b.id} are "
                    f"{round(thickness, 3)} mm apart, below the {threshold} mm "
                    "wall threshold"
                ),
                value=round(thickness, 4),
                threshold=threshold,
            )
            for index, (face_a, face_b, thickness) in enumerate(ordered, start=1)
        ]

    def _flag(
        self, feature_id: str, name: str, metric: str, value: float, threshold: float
    ) -> MachiningFlag:
        return MachiningFlag(
            feature_id=feature_id,
            flag=name,
            reason=f"{metric} = {round(value, 3)} >= {threshold}",
            value=round(value, 4),
            threshold=threshold,
        )

    # -- tooling constraints ----------------------------------------------

    def tooling_constraints(
        self, features: FeatureCollection
    ) -> List[MachiningConstraint]:
        """Largest tool that fits each milled internal corner.

        A tool of diameter ``d`` cannot produce an internal corner of radius
        less than ``d/2``, so the corner radius caps the tool: ``d_max = 2r``.
        This is geometry, not a tool recommendation.
        """
        constraints: List[MachiningConstraint] = []

        for feature in list(features.pockets) + list(features.slots):
            radius = self._corner_radius(feature)
            if radius is None or radius <= 0:
                continue
            diameter = 2.0 * radius * self.config.tool_diameter_safety_factor
            if diameter < self.config.min_practical_tool_diameter_mm:
                diameter = self.config.min_practical_tool_diameter_mm
            constraints.append(
                MachiningConstraint(
                    feature_id=feature.id,
                    feature_type=feature.type,
                    tooling_constraints=ToolingConstraint(
                        minimum_internal_radius_mm=round(
                            radius, self.config.length_decimals
                        ),
                        maximum_tool_diameter_mm=round(
                            diameter, self.config.length_decimals
                        ),
                    ),
                )
            )

        constraints.sort(key=lambda c: c.feature_id)
        return constraints

    def _corner_radius(self, feature) -> Optional[float]:
        radius = getattr(feature, "minimum_internal_radius_mm", None)
        if radius is None:
            radius = getattr(feature, "corner_radius_mm", None)
        return radius
