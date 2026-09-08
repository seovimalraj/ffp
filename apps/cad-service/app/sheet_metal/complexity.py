"""Deterministic complexity/count indicators - no derived difficulty score.

Matches ``app.machining``'s documented stance (see design doc section 4):
this module only counts and finds minima across already-detected features,
never blends them into a single "complexity score" - that judgement is left
to a downstream costing engine, same as machining's
``ComplexityIndicatorBuilder``.
"""

from __future__ import annotations

from typing import List, Optional, Sequence

from ..machining.vectors import unique_rounded
from .schemas import (
    BendFeature,
    Cutout,
    Hem,
    SheetMetalComplexityIndicators,
    SheetMetalHole,
    SheetMetalSlot,
)


def _min_or_none(values: Sequence[float]) -> Optional[float]:
    return min(values) if values else None


def compute_complexity(
    bends: Sequence[BendFeature],
    holes: Sequence[SheetMetalHole],
    cutouts: Sequence[Cutout],
    slots: Sequence[SheetMetalSlot],
    hems: Sequence[Hem],
    decimals: int = 3,
) -> SheetMetalComplexityIndicators:
    """Tally deterministic counts/minima across every detected feature type.

    Never raises: empty feature lists simply yield zero counts and ``None``
    minima, matching every other detector's "no hard failure" contract.
    """
    bend_angles = unique_rounded((b.angle_deg for b in bends), decimals) if bends else []
    bend_radii = unique_rounded((b.inner_radius_mm for b in bends), decimals) if bends else []
    hole_diameters = unique_rounded((h.diameter_mm for h in holes), decimals) if holes else []

    min_bend_radius = _min_or_none([b.inner_radius_mm for b in bends])

    edge_distances: List[float] = [
        h.distance_to_nearest_edge_mm for h in holes if h.distance_to_nearest_edge_mm is not None
    ] + [
        c.distance_to_nearest_edge_mm
        for c in cutouts
        if c.distance_to_nearest_edge_mm is not None
    ]
    bend_distances: List[float] = (
        [h.distance_to_nearest_bend_mm for h in holes if h.distance_to_nearest_bend_mm is not None]
        + [
            c.distance_to_nearest_bend_mm
            for c in cutouts
            if c.distance_to_nearest_bend_mm is not None
        ]
        + [
            s.distance_to_nearest_bend_mm
            for s in slots
            if s.distance_to_nearest_bend_mm is not None
        ]
    )

    total = len(bends) + len(holes) + len(cutouts) + len(slots) + len(hems)

    return SheetMetalComplexityIndicators(
        bend_count=len(bends),
        unique_bend_angle_count=len(bend_angles),
        unique_bend_radius_count=len(bend_radii),
        hole_count=len(holes),
        cutout_count=len(cutouts),
        slot_count=len(slots),
        hem_count=len(hems),
        distinct_hole_diameter_count=len(hole_diameters),
        minimum_bend_radius_mm=(
            round(min_bend_radius, decimals) if min_bend_radius is not None else None
        ),
        minimum_feature_to_edge_distance_mm=_min_or_none(edge_distances),
        minimum_feature_to_bend_distance_mm=_min_or_none(bend_distances),
        feature_count_total=total,
    )
