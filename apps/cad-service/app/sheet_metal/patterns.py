"""Repeated-feature grouping + bounding-profile mirror symmetry.

The grouping half is adapted from ``app.machining.patterns``'s arrangement
classifier (``classify_arrangement`` and its collinear/rectangular/circular
sub-tests) - the geometric reasoning is identical (a set of feature positions
either lies on a line, a filled grid, a circle, or none of those), only
re-implemented locally against this package's ``SheetMetalFeaturePattern``/
``SheetMetalConfig`` types instead of importing ``app.machining``'s feature
schemas, to keep this package decoupled from ``app.machining``'s config/schema
surface (see the design doc's "explicit reuse, not duplication" note - the
*algorithm* is reused, not the module).

Symmetry detection is intentionally scoped down per design doc section 9's
documented fallback: a bounding-box/profile-based mirror-plane check about the
outer profile's centroid, tested against the two in-plane principal axes
(local X/Y, i.e. the axes the outer loop's own coordinates are expressed in)
rather than a full topological symmetry match. This is a coarse but honest
approximation - see :func:`detect_symmetry`'s docstring for its limits.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional, Sequence, Tuple

from ..machining.vectors import (
    Vec,
    add,
    centroid,
    cross,
    distance,
    dot,
    normalize,
    scale,
    sub,
)
from .config import SheetMetalConfig
from .detectors.profile import select_outer_loop
from .schemas import (
    Cutout,
    SheetMetalFaces,
    SheetMetalFeaturePattern,
    SheetMetalHole,
    SheetMetalSlot,
    Symmetry,
)
from ..machining.schemas import Detection, DetectionMethod


def _key(*values) -> Tuple:
    return tuple(round(v, 3) if isinstance(v, (int, float)) else v for v in values)


def _is_collinear(positions: Sequence[Vec], tolerance: float) -> bool:
    base = positions[0]
    axis = None
    for point in positions[1:]:
        delta = sub(point, base)
        if (dot(delta, delta) ** 0.5) < tolerance:
            continue
        axis = normalize(delta)
        break
    if axis is None:
        return False
    for point in positions:
        delta = sub(point, base)
        perpendicular = sub(delta, scale(axis, dot(delta, axis)))
        if (dot(perpendicular, perpendicular) ** 0.5) > tolerance:
            return False
    return True


def _is_coplanar(positions: Sequence[Vec], tolerance: float) -> bool:
    if len(positions) < 4:
        return True
    origin = positions[0]
    normal: Optional[Vec] = None
    for i in range(1, len(positions)):
        for j in range(i + 1, len(positions)):
            candidate = cross(sub(positions[i], origin), sub(positions[j], origin))
            if (dot(candidate, candidate) ** 0.5) > tolerance:
                normal = normalize(candidate)
                break
        if normal:
            break
    if normal is None:
        return True
    return all(abs(dot(sub(p, origin), normal)) <= tolerance for p in positions)


def _distinct_count(values: Sequence[float], tolerance: float) -> int:
    ordered = sorted(values)
    count = 1
    for previous, current in zip(ordered, ordered[1:]):
        if current - previous > tolerance:
            count += 1
    return count


def _is_rectangular(positions: Sequence[Vec], tolerance: float) -> bool:
    if len(positions) < 4 or not _is_coplanar(positions, tolerance):
        return False
    origin = positions[0]
    directions: List[Vec] = []
    for point in positions[1:]:
        delta = sub(point, origin)
        if (dot(delta, delta) ** 0.5) < tolerance:
            continue
        unit = normalize(delta)
        if not any(abs(abs(dot(unit, d)) - 1.0) < 1e-3 for d in directions):
            directions.append(unit)
        if len(directions) >= 2:
            break
    if len(directions) < 2:
        return False
    u, v = directions[0], directions[1]
    if abs(dot(u, v)) > 1e-6:
        v = normalize(sub(v, scale(u, dot(u, v))))
        if (dot(v, v) ** 0.5) < 1e-6:
            return False
    rows = _distinct_count([dot(sub(p, origin), u) for p in positions], tolerance)
    columns = _distinct_count([dot(sub(p, origin), v) for p in positions], tolerance)
    if rows < 2 or columns < 2:
        return False
    return rows * columns == len(positions)


def _circular_diameter(positions: Sequence[Vec], tolerance: float) -> Optional[float]:
    center = centroid(positions)
    radii = [distance(p, center) for p in positions]
    mean_radius = sum(radii) / len(radii)
    if mean_radius < tolerance:
        return None
    if any(abs(r - mean_radius) > max(tolerance, mean_radius * 0.02) for r in radii):
        return None
    if not _is_coplanar(positions, tolerance):
        return None
    return mean_radius * 2.0


def classify_arrangement(
    positions: Sequence[Vec], config: SheetMetalConfig
) -> Tuple[str, Optional[float]]:
    """Return ``(pattern_type, spacing_mm)`` for a set of feature positions.

    Adapted from ``app.machining.patterns.classify_arrangement`` - see module
    docstring.
    """
    count = len(positions)
    if count < 2:
        return "grouped", None
    if count == 2:
        return "linear", distance(positions[0], positions[1])

    tolerance = max(config.linear_tolerance_mm * 100, 0.01)

    if _is_collinear(positions, tolerance):
        axis = normalize(sub(positions[-1], positions[0]))
        projected = sorted(dot(sub(p, positions[0]), axis) for p in positions)
        gaps = [projected[i + 1] - projected[i] for i in range(len(projected) - 1)]
        return "linear", (sum(gaps) / len(gaps)) if gaps else None

    if _is_rectangular(positions, tolerance):
        return "rectangular", None

    circle = _circular_diameter(positions, tolerance)
    if circle is not None:
        return "circular", circle

    return "grouped", None


def _detection(count: int, arrangement: str, matched_on: str) -> Detection:
    return Detection(
        method=DetectionMethod.TOPOLOGY_AND_SURFACE,
        confidence=0.95 if arrangement != "grouped" else 0.8,
        evidence=[
            f"{count} features identical on {matched_on}",
            f"positions form a {arrangement} arrangement",
        ],
    )


def _group_holes(
    holes: Sequence[SheetMetalHole], config: SheetMetalConfig
) -> List[SheetMetalFeaturePattern]:
    buckets: Dict[Tuple, List[SheetMetalHole]] = defaultdict(list)
    for hole in holes:
        buckets[_key(hole.diameter_mm, hole.shape)].append(hole)

    results = []
    for key in sorted(buckets, key=lambda k: str(k)):
        group = buckets[key]
        if len(group) < 2:
            continue
        positions = [h.position.as_tuple() for h in group]
        arrangement, spacing = classify_arrangement(positions, config)
        results.append(
            SheetMetalFeaturePattern(
                type="repeated_hole",
                feature_type="hole",
                feature_count=len(group),
                feature_ids=[h.id for h in group],
                pattern_type=arrangement,
                spacing_mm=spacing,
                axis=None,
                detection=_detection(len(group), arrangement, "diameter and shape"),
            )
        )
    return results


def _group_cutouts(
    cutouts: Sequence[Cutout], config: SheetMetalConfig
) -> List[SheetMetalFeaturePattern]:
    buckets: Dict[Tuple, List[Cutout]] = defaultdict(list)
    for cutout in cutouts:
        buckets[_key(cutout.shape_type, round(cutout.area_mm2, 1))].append(cutout)

    results = []
    for key in sorted(buckets, key=lambda k: str(k)):
        group = buckets[key]
        if len(group) < 2:
            continue
        positions = [c.position.as_tuple() for c in group]
        arrangement, spacing = classify_arrangement(positions, config)
        results.append(
            SheetMetalFeaturePattern(
                type="repeated_cutout",
                feature_type="cutout",
                feature_count=len(group),
                feature_ids=[c.id for c in group],
                pattern_type=arrangement,
                spacing_mm=spacing,
                axis=None,
                detection=_detection(len(group), arrangement, "shape type and area"),
            )
        )
    return results


def _group_slots(
    slots: Sequence[SheetMetalSlot], config: SheetMetalConfig
) -> List[SheetMetalFeaturePattern]:
    buckets: Dict[Tuple, List[SheetMetalSlot]] = defaultdict(list)
    for slot in slots:
        buckets[_key(slot.length_mm, slot.width_mm)].append(slot)

    results = []
    for key in sorted(buckets, key=lambda k: str(k)):
        group = buckets[key]
        if len(group) < 2:
            continue
        positions = [s.position.as_tuple() for s in group]
        arrangement, spacing = classify_arrangement(positions, config)
        results.append(
            SheetMetalFeaturePattern(
                type="repeated_slot",
                feature_type="slot",
                feature_count=len(group),
                feature_ids=[s.id for s in group],
                pattern_type=arrangement,
                spacing_mm=spacing,
                axis=None,
                detection=_detection(len(group), arrangement, "length and width"),
            )
        )
    return results


def detect_patterns(
    holes: Sequence[SheetMetalHole],
    cutouts: Sequence[Cutout],
    slots: Sequence[SheetMetalSlot],
    config: SheetMetalConfig,
) -> List[SheetMetalFeaturePattern]:
    """Group identical holes/cutouts/slots and name their arrangement.

    Never raises: no repeated features simply yields an empty list.
    """
    patterns: List[SheetMetalFeaturePattern] = []
    patterns.extend(_group_holes(holes, config))
    patterns.extend(_group_cutouts(cutouts, config))
    patterns.extend(_group_slots(slots, config))
    return patterns


# ---------------------------------------------------------------------------
# Symmetry (bounding-profile mirror check, design doc section 9's fallback)
# ---------------------------------------------------------------------------


def _loop_points(loop) -> List[Vec]:
    """Coarse polygon vertices for a loop: each edge's own endpoints.

    Deliberately simpler than ``detectors/cutouts.py``'s ``_ordered_points``
    (which also samples curve midpoints) - a mirror-symmetry test only needs a
    reasonably dense, evenly-treated point set, not a precise polygon area, so
    the extra curve-midpoint samples there are not worth the added coupling to
    a private helper in another module.
    """
    if not loop:
        return []
    if len(loop) == 1 and loop[0].is_closed:
        return []  # a full circle - trivially symmetric, handled separately
    points: List[Vec] = []
    for edge in loop:
        points.append(edge.start)
        points.append(edge.end)
    return points


def _is_mirror_symmetric(points: Sequence[Vec], axis: Vec, origin: Vec, tolerance: float) -> bool:
    """True when reflecting every point about ``origin``+``axis`` finds a match.

    Each reflected point must find some original point within ``tolerance``;
    matches are consumed (not reused) so a symmetric point set can't cheat by
    matching every reflection to the same single point.
    """
    remaining = list(points)
    for point in points:
        d = dot(sub(point, origin), axis)
        reflected = sub(point, scale(axis, 2.0 * d))
        best_index, best_dist = None, tolerance
        for index, candidate in enumerate(remaining):
            dist = distance(candidate, reflected)
            if dist <= best_dist:
                best_index, best_dist = index, dist
        if best_index is None:
            return False
        remaining.pop(best_index)
    return True


def detect_symmetry(model, config: SheetMetalConfig, faces: SheetMetalFaces) -> Symmetry:
    """Bounding-box/profile-based mirror-plane check about the outer profile's centroid.

    This is deliberately narrow, per design doc section 9: it tests only the
    two in-plane principal axes implied by the outer loop's own coordinate
    frame (its local X and Y directions) for a mirror line through the
    centroid, and only on the outer profile's own boundary vertices - it does
    not attempt full topological (bend/hole/cutout-aware) symmetry matching.
    A part whose true mirror axis is diagonal, or whose symmetry depends on
    internal features rather than the outer silhouette, will report
    ``has_symmetry=False`` here even if a human would call it symmetric.
    """
    loop = select_outer_loop(model, faces)
    if not loop:
        return Symmetry(
            has_symmetry=False,
            symmetry_type="none",
            confidence=0.0,
            note="No outer profile was available to test for symmetry.",
        )

    points = _loop_points(loop)
    if len(points) < 3:
        return Symmetry(
            has_symmetry=False,
            symmetry_type="none",
            confidence=0.0,
            note=(
                "Outer profile has too few boundary vertices for a mirror-plane "
                "check (bounding-profile symmetry only, see design doc section 9)."
            ),
        )

    center = centroid(points)
    tolerance = max(config.linear_tolerance_mm * 100, 0.5)

    for label, axis in (("X", (1.0, 0.0, 0.0)), ("Y", (0.0, 1.0, 0.0))):
        if _is_mirror_symmetric(points, axis, center, tolerance):
            return Symmetry(
                has_symmetry=True,
                axis_or_plane=f"mirror plane normal to local {label}, through the profile centroid",
                symmetry_type="mirror",
                confidence=0.7,
                note=(
                    "Bounding-profile mirror check only against the outer "
                    "silhouette - not full topological symmetry (design doc "
                    "section 9)."
                ),
            )

    return Symmetry(
        has_symmetry=False,
        symmetry_type="none",
        confidence=0.0,
        note=(
            "No mirror symmetry detected about the local X or Y axis through "
            "the outer profile's centroid (bounding-profile check only)."
        ),
    )
