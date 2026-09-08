"""DFM distance checks: feature-to-edge, feature-to-bend, min-size, bend radius.

Per design doc section 4/5 (stage 15): hole/cutout-to-outer-edge distance,
hole/cutout/slot-to-nearest-bend-line distance, minimum feature size, and
minimum bend-radius-to-thickness ratio. Every threshold lives in
``SheetMetalConfig`` (see ``config.py``'s "DFM flag thresholds" section) - this
module only measures and compares, it never invents a number of its own.

Distance geometry
------------------
The outer profile's raw edge loop (:func:`app.sheet_metal.detectors.profile.select_outer_loop`)
and each bend's ``bend_line`` are both approximated as straight polylines for
this purpose - a curved outer edge or an arc-shaped bend line is measured via
its endpoint-to-endpoint chord, the same "coarse but honest" approximation
``detectors/cutouts.py`` already documents for its own profile-metric
calculations. This is adequate for a point-to-boundary proximity check (the
actual DFM-relevant distance is usually to a straight run near a corner, not
mid-arc) without pulling in curve-tessellation machinery for this phase.

This module mutates the ``distance_to_nearest_edge_mm`` / IsA
``distance_to_nearest_bend_mm`` fields on the passed-in hole/cutout/slot
records in place (they are plain, non-frozen Pydantic models) and returns the
list of :class:`~app.sheet_metal.schemas.DistanceFlag` entries produced -
only for thresholds actually violated, never a flag for "no news".
"""

from __future__ import annotations

from typing import List, Optional, Sequence

from ..machining.vectors import Vec, add, distance, dot, scale, sub  # type: ignore[import]
from .config import SheetMetalConfig
from .detectors.cutouts import Loop
from .detectors.profile import select_outer_loop
from .schemas import (
    BendFeature,
    Cutout,
    DistanceFlag,
    SheetMetalFaces,
    SheetMetalHole,
    SheetMetalSlot,
)


def _segment_distance(point: Vec, a: Vec, b: Vec) -> float:
    """Point-to-line-segment distance in 3D."""
    ab = sub(b, a)
    denom = dot(ab, ab)
    if denom < 1e-12:
        return distance(point, a)
    t = max(0.0, min(1.0, dot(sub(point, a), ab) / denom))
    closest = add(a, scale(ab, t))
    return distance(point, closest)


def _min_distance_to_loop(point: Vec, loop: Optional[Loop]) -> Optional[float]:
    if not loop:
        return None
    if len(loop) == 1 and loop[0].is_closed:
        # A single full-circle boundary (e.g. a circular flange face): the
        # nearest-edge distance is the offset from the circle itself.
        center = loop[0].midpoint
        radius = loop[0].radius_mm or 0.0
        return abs(distance(point, center) - radius)
    return min(_segment_distance(point, edge.start, edge.end) for edge in loop)


def _min_distance_to_bends(point: Vec, bends: Sequence[BendFeature]) -> Optional[float]:
    if not bends:
        return None
    dists = []
    for bend in bends:
        start = (bend.bend_line.start.x, bend.bend_line.start.y, bend.bend_line.start.z)
        end = (bend.bend_line.end.x, bend.bend_line.end.y, bend.bend_line.end.z)
        dists.append(_segment_distance(point, start, end))
    return min(dists) if dists else None


def _flag(
    feature_id: str,
    feature_type: str,
    flag: str,
    reason: str,
    threshold: Optional[float],
    value: Optional[float],
) -> DistanceFlag:
    return DistanceFlag(
        feature_id=feature_id,
        feature_type=feature_type,
        flag=flag,
        reason=reason,
        threshold=threshold,
        value=value,
    )


def compute_distance_checks(
    model,
    config: SheetMetalConfig,
    faces: SheetMetalFaces,
    holes: List[SheetMetalHole],
    cutouts: List[Cutout],
    slots: List[SheetMetalSlot],
    bends: List[BendFeature],
    thickness_mm: Optional[float],
) -> List[DistanceFlag]:
    """Measure and flag DFM distance/size violations.

    Populates ``distance_to_nearest_edge_mm`` / ``distance_to_nearest_bend_mm``
    on ``holes``/``cutouts``/``slots`` in place and returns the flags raised.
    Never raises on missing geometry: an absent outer loop or bend list simply
    means the corresponding distance stays ``None`` and no flag is produced
    for it.
    """
    flags: List[DistanceFlag] = []
    outer_loop = select_outer_loop(model, faces)

    for hole in holes:
        point = (hole.position.x, hole.position.y, hole.position.z)
        edge_dist = _min_distance_to_loop(point, outer_loop)
        bend_dist = _min_distance_to_bends(point, bends)
        if edge_dist is not None:
            hole.distance_to_nearest_edge_mm = round(edge_dist, config.length_decimals)
        if bend_dist is not None:
            hole.distance_to_nearest_bend_mm = round(bend_dist, config.length_decimals)

        if edge_dist is not None and edge_dist < config.min_hole_to_edge_distance_mm:
            flags.append(
                _flag(
                    hole.id,
                    "hole",
                    "HOLE_TOO_CLOSE_TO_EDGE",
                    (
                        f"Hole {hole.id} is {edge_dist:.3f} mm from the outer "
                        f"edge, below the {config.min_hole_to_edge_distance_mm} mm minimum."
                    ),
                    config.min_hole_to_edge_distance_mm,
                    round(edge_dist, config.length_decimals),
                )
            )
        if bend_dist is not None and bend_dist < config.min_hole_to_bend_distance_mm:
            flags.append(
                _flag(
                    hole.id,
                    "hole",
                    "HOLE_TOO_CLOSE_TO_BEND",
                    (
                        f"Hole {hole.id} is {bend_dist:.3f} mm from the nearest "
                        f"bend line, below the {config.min_hole_to_bend_distance_mm} mm minimum."
                    ),
                    config.min_hole_to_bend_distance_mm,
                    round(bend_dist, config.length_decimals),
                )
            )
        if hole.diameter_mm < config.min_feature_size_mm:
            flags.append(
                _flag(
                    hole.id,
                    "hole",
                    "FEATURE_BELOW_MIN_SIZE",
                    (
                        f"Hole {hole.id} diameter {hole.diameter_mm:.3f} mm is "
                        f"below the {config.min_feature_size_mm} mm minimum feature size."
                    ),
                    config.min_feature_size_mm,
                    hole.diameter_mm,
                )
            )

    for cutout in cutouts:
        point = (cutout.position.x, cutout.position.y, cutout.position.z)
        edge_dist = _min_distance_to_loop(point, outer_loop)
        bend_dist = _min_distance_to_bends(point, bends)
        if edge_dist is not None:
            cutout.distance_to_nearest_edge_mm = round(edge_dist, config.length_decimals)
        if bend_dist is not None:
            cutout.distance_to_nearest_bend_mm = round(bend_dist, config.length_decimals)

        if edge_dist is not None and edge_dist < config.min_hole_to_edge_distance_mm:
            flags.append(
                _flag(
                    cutout.id,
                    "cutout",
                    "HOLE_TOO_CLOSE_TO_EDGE",
                    (
                        f"Cutout {cutout.id} is {edge_dist:.3f} mm from the outer "
                        f"edge, below the {config.min_hole_to_edge_distance_mm} mm minimum."
                    ),
                    config.min_hole_to_edge_distance_mm,
                    round(edge_dist, config.length_decimals),
                )
            )
        if bend_dist is not None and bend_dist < config.min_hole_to_bend_distance_mm:
            flags.append(
                _flag(
                    cutout.id,
                    "cutout",
                    "HOLE_TOO_CLOSE_TO_BEND",
                    (
                        f"Cutout {cutout.id} is {bend_dist:.3f} mm from the "
                        f"nearest bend line, below the {config.min_hole_to_bend_distance_mm} mm minimum."
                    ),
                    config.min_hole_to_bend_distance_mm,
                    round(bend_dist, config.length_decimals),
                )
            )
        if cutout.min_feature_size_mm is not None and cutout.min_feature_size_mm < config.min_feature_size_mm:
            flags.append(
                _flag(
                    cutout.id,
                    "cutout",
                    "FEATURE_BELOW_MIN_SIZE",
                    (
                        f"Cutout {cutout.id} minimum feature size "
                        f"{cutout.min_feature_size_mm:.3f} mm is below the "
                        f"{config.min_feature_size_mm} mm minimum."
                    ),
                    config.min_feature_size_mm,
                    cutout.min_feature_size_mm,
                )
            )

    for slot in slots:
        point = (slot.position.x, slot.position.y, slot.position.z)
        bend_dist = _min_distance_to_bends(point, bends)
        if bend_dist is not None:
            slot.distance_to_nearest_bend_mm = round(bend_dist, config.length_decimals)
            if bend_dist < config.min_hole_to_bend_distance_mm:
                flags.append(
                    _flag(
                        slot.id,
                        "slot",
                        "HOLE_TOO_CLOSE_TO_BEND",
                        (
                            f"Slot {slot.id} is {bend_dist:.3f} mm from the "
                            f"nearest bend line, below the {config.min_hole_to_bend_distance_mm} mm minimum."
                        ),
                        config.min_hole_to_bend_distance_mm,
                        round(bend_dist, config.length_decimals),
                    )
                )
        if slot.width_mm < config.min_feature_size_mm:
            flags.append(
                _flag(
                    slot.id,
                    "slot",
                    "FEATURE_BELOW_MIN_SIZE",
                    (
                        f"Slot {slot.id} width {slot.width_mm:.3f} mm is below "
                        f"the {config.min_feature_size_mm} mm minimum feature size."
                    ),
                    config.min_feature_size_mm,
                    slot.width_mm,
                )
            )

    if thickness_mm is not None and thickness_mm > 0:
        for bend in bends:
            ratio = bend.inner_radius_mm / thickness_mm
            if ratio < config.min_bend_radius_to_thickness_ratio:
                flags.append(
                    _flag(
                        bend.id,
                        "bend",
                        "BEND_RADIUS_TOO_TIGHT",
                        (
                            f"Bend {bend.id} inner radius {bend.inner_radius_mm:.3f} mm "
                            f"is {ratio:.2f}x the {thickness_mm:.3f} mm sheet thickness, "
                            f"below the {config.min_bend_radius_to_thickness_ratio}x minimum ratio."
                        ),
                        config.min_bend_radius_to_thickness_ratio,
                        round(ratio, 4),
                    )
                )

    return flags
