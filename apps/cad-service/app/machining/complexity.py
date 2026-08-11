"""Deterministic machining complexity indicators.

Counts and measured extremes only. There is deliberately no score, no
difficulty rating and no price here - weighing these numbers against each other
is a judgement call that belongs to the downstream costing engine, which has
context this endpoint does not (quantity, material, machine, tolerances).
"""

from __future__ import annotations

import logging
from typing import List, Optional, Sequence, Tuple

from .config import MachiningConfig
from .records import PLANE, FaceRecord, ShapeModel
from .schemas import (
    AnalysisWarning,
    ComplexityIndicators,
    FeatureAccessibility,
    FeatureCollection,
    MachiningConstraint,
    MachiningFlag,
    SurfaceSummary,
    WarningCode,
)
from .vectors import Vec, dot, is_parallel, normalize, perpendicular_basis, sub

logger = logging.getLogger(__name__)

#: Above this many planar faces the O(n^2) wall scan is skipped.
_MAX_PLANAR_FACES_FOR_WALL_SCAN = 1500


class ThinWallAnalyzer:
    """Counts pairs of opposed planar faces closer than the wall threshold."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def count(self, model: ShapeModel, warnings: List[AnalysisWarning]) -> int:
        planar = [
            face
            for face in model.faces.values()
            if face.surface_type == PLANE and face.normal is not None
        ]
        if len(planar) > _MAX_PLANAR_FACES_FOR_WALL_SCAN:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.LARGE_MODEL,
                    message=(
                        f"{len(planar)} planar faces exceed the thin-wall scan "
                        f"limit of {_MAX_PLANAR_FACES_FOR_WALL_SCAN}; "
                        "thin_wall_count is reported as 0 and should be treated "
                        "as unmeasured."
                    ),
                )
            )
            return 0

        planar.sort(key=lambda f: f.id)
        count = 0
        for i, face_a in enumerate(planar):
            for face_b in planar[i + 1 :]:
                if self._is_thin_wall(face_a, face_b):
                    count += 1
        return count

    def _is_thin_wall(self, a: FaceRecord, b: FaceRecord) -> bool:
        """Two faces form a thin wall when they face away from each other,
        overlap in plan, and are separated by less than the threshold."""
        normal_a, normal_b = a.normal, b.normal
        if normal_a is None or normal_b is None:
            return False
        # Outward normals of a wall's two sides point in opposite directions.
        if dot(normalize(normal_a), normalize(normal_b)) > -0.98:
            return False

        thickness = abs(dot(sub(b.centroid, a.centroid), normalize(normal_a)))
        if thickness <= self.config.linear_tolerance_mm:
            return False  # coincident faces, not a wall
        if thickness >= self.config.thin_wall_thickness_mm:
            return False

        return self._overlaps_in_plane(a, b, normal_a)

    def _overlaps_in_plane(self, a: FaceRecord, b: FaceRecord, normal: Vec) -> bool:
        """Axis-aligned overlap test in the plane perpendicular to ``normal``."""
        u, v = perpendicular_basis(normal)
        for axis in (u, v):
            a_lo, a_hi = self._extent(a, axis)
            b_lo, b_hi = self._extent(b, axis)
            if a_hi < b_lo or b_hi < a_lo:
                return False
        return True

    def _extent(self, face: FaceRecord, axis: Vec) -> Tuple[float, float]:
        corners = [
            (x, y, z)
            for x in (face.bbox_min[0], face.bbox_max[0])
            for y in (face.bbox_min[1], face.bbox_max[1])
            for z in (face.bbox_min[2], face.bbox_max[2])
        ]
        projections = [dot(c, axis) for c in corners]
        return min(projections), max(projections)


class ComplexityIndicatorBuilder:
    """Assembles the deterministic indicator block."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def build(
        self,
        features: FeatureCollection,
        surface_summary: SurfaceSummary,
        flags: Sequence[MachiningFlag],
        constraints: Sequence[MachiningConstraint],
        accessibility: Sequence[FeatureAccessibility],
        thin_wall_count: int,
    ) -> ComplexityIndicators:
        deep_hole_ids = {
            flag.feature_id
            for flag in flags
            if flag.flag in ("DEEP_HOLE", "VERY_DEEP_HOLE")
        }

        tool_diameters = {
            round(c.tooling_constraints.maximum_tool_diameter_mm, 3)
            for c in constraints
        }

        hole_diameters = {round(h.diameter_mm, 3) for h in features.holes}

        internal_radii = [
            c.tooling_constraints.minimum_internal_radius_mm for c in constraints
        ]
        if features.fillet_summary.minimum_internal_radius_mm is not None:
            internal_radii.append(features.fillet_summary.minimum_internal_radius_mm)

        ratios = [
            h.depth_diameter_ratio for h in features.holes if h.depth_diameter_ratio
        ] + [
            b.depth_diameter_ratio for b in features.bores if b.depth_diameter_ratio
        ]

        accessible_directions = {
            label
            for entry in accessibility
            for label, ok in entry.accessibility.items()
            if ok
        }

        total = (
            len(features.holes)
            + len(features.bores)
            + len(features.internal_cylindrical_features)
            + len(features.pockets)
            + len(features.slots)
            + len(features.bosses)
            + len(features.threads)
            + len(features.fillets)
            + len(features.chamfers)
        )

        return ComplexityIndicators(
            hole_count=len(features.holes),
            deep_hole_count=len(deep_hole_ids),
            pocket_count=len(features.pockets),
            slot_count=len(features.slots),
            bore_count=len(features.bores),
            thread_count=len(features.threads),
            fillet_count=len(features.fillets),
            chamfer_count=len(features.chamfers),
            boss_count=len(features.bosses),
            freeform_surface_count=surface_summary.freeform_faces,
            thin_wall_count=thin_wall_count,
            unique_tool_diameter_constraints=len(tool_diameters),
            accessible_directions=len(accessible_directions),
            distinct_hole_diameter_count=len(hole_diameters),
            minimum_internal_radius_mm=(
                round(min(internal_radii), self.config.length_decimals)
                if internal_radii
                else None
            ),
            maximum_depth_diameter_ratio=(
                round(max(ratios), 4) if ratios else None
            ),
            feature_count_total=total,
        )
