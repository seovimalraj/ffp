"""Repeated-feature grouping.

Eight identical holes are one manufacturing decision repeated eight times, not
eight independent decisions, so they are reported as a group with a recognised
arrangement (linear / circular / rectangular) alongside the individual features.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from typing import Dict, List, Optional, Sequence, Tuple

from .config import MachiningConfig
from .schemas import (
    ChamferFeature,
    Detection,
    DetectionMethod,
    FeatureCollection,
    FeaturePattern,
    FilletFeature,
    HoleFeature,
    PocketFeature,
    SlotFeature,
    Vector3,
)
from .vectors import (
    Vec,
    add,
    centroid,
    cross,
    distance,
    dot,
    norm,
    normalize,
    scale,
    sub,
)

logger = logging.getLogger(__name__)


def _key(*values) -> Tuple:
    """Rounded grouping key so float noise does not split a real pattern."""
    return tuple(
        round(v, 3) if isinstance(v, (int, float)) else v for v in values
    )


def classify_arrangement(
    positions: Sequence[Vec], config: MachiningConfig
) -> Tuple[str, Optional[float]]:
    """Return ``(pattern_type, spacing_mm)`` for a set of feature positions.

    ``spacing_mm`` is only meaningful for linear and rectangular arrangements;
    for circular it is the pitch-circle diameter, and ``None`` otherwise.
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

    # Rectangular is checked before circular because the corners of a square
    # also lie on a circle, and "rectangular" is the more useful description of
    # that arrangement. A genuine bolt circle fails the lattice test and falls
    # through to circular.
    if _is_rectangular(positions, tolerance):
        return "rectangular", None

    circle = _circular_diameter(positions, tolerance)
    if circle is not None:
        return "circular", circle

    return "grouped", None


def _is_collinear(positions: Sequence[Vec], tolerance: float) -> bool:
    base = positions[0]
    axis = None
    for point in positions[1:]:
        delta = sub(point, base)
        if norm(delta) < tolerance:
            continue
        axis = normalize(delta)
        break
    if axis is None:
        return False
    for point in positions:
        delta = sub(point, base)
        perpendicular = sub(delta, scale(axis, dot(delta, axis)))
        if norm(perpendicular) > tolerance:
            return False
    return True


def _circular_diameter(positions: Sequence[Vec], tolerance: float) -> Optional[float]:
    """Pitch-circle diameter when all positions sit on one circle."""
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


def _is_coplanar(positions: Sequence[Vec], tolerance: float) -> bool:
    if len(positions) < 4:
        return True
    origin = positions[0]
    normal: Optional[Vec] = None
    for i in range(1, len(positions)):
        for j in range(i + 1, len(positions)):
            candidate = cross(sub(positions[i], origin), sub(positions[j], origin))
            if norm(candidate) > tolerance:
                normal = normalize(candidate)
                break
        if normal:
            break
    if normal is None:
        return True
    return all(abs(dot(sub(p, origin), normal)) <= tolerance for p in positions)


def _is_rectangular(positions: Sequence[Vec], tolerance: float) -> bool:
    """True when the positions form a filled rows-by-columns grid on a plane.

    Projecting onto the two in-plane axes is not enough on its own - any two
    independent directions span the plane, so every coplanar point set would
    pass. A grid is identified by the projections collapsing into a small number
    of distinct rows and columns whose product is exactly the point count.
    """
    if len(positions) < 4 or not _is_coplanar(positions, tolerance):
        return False

    origin = positions[0]
    directions: List[Vec] = []
    for point in positions[1:]:
        delta = sub(point, origin)
        if norm(delta) < tolerance:
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
        if norm(v) < 1e-6:
            return False

    rows = _distinct_count([dot(sub(p, origin), u) for p in positions], tolerance)
    columns = _distinct_count([dot(sub(p, origin), v) for p in positions], tolerance)
    if rows < 2 or columns < 2:
        return False
    return rows * columns == len(positions)


def _distinct_count(values: Sequence[float], tolerance: float) -> int:
    """Number of value clusters, treating values within ``tolerance`` as equal."""
    ordered = sorted(values)
    count = 1
    for previous, current in zip(ordered, ordered[1:]):
        if current - previous > tolerance:
            count += 1
    return count


class PatternDetector:
    """Groups identical features and names their arrangement."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def detect(self, features: FeatureCollection) -> List[FeaturePattern]:
        patterns: List[FeaturePattern] = []
        patterns.extend(self._holes(features.holes))
        patterns.extend(self._pockets(features.pockets))
        patterns.extend(self._slots(features.slots))
        patterns.extend(self._chamfers(features.chamfers))
        patterns.extend(self._fillets(features.fillets))
        return patterns

    # -- per feature type --------------------------------------------------

    def _holes(self, holes: Sequence[HoleFeature]) -> List[FeaturePattern]:
        buckets: Dict[Tuple, List[HoleFeature]] = defaultdict(list)
        for hole in holes:
            buckets[_key(hole.diameter_mm, hole.depth_mm, hole.subtype)].append(hole)

        results = []
        for key in sorted(buckets, key=lambda k: (str(k))):
            group = buckets[key]
            if len(group) < 2:
                continue
            positions = [h.position.as_tuple() for h in group]
            arrangement, spacing = classify_arrangement(positions, self.config)
            axis = group[0].axis
            results.append(
                FeaturePattern(
                    type="repeated_hole",
                    feature_type="hole",
                    feature_count=len(group),
                    feature_ids=[h.id for h in group],
                    pattern_type=arrangement,
                    diameter_mm=group[0].diameter_mm,
                    depth_mm=group[0].depth_mm,
                    spacing_mm=spacing,
                    axis=axis,
                    detection=self._detection(len(group), arrangement, "diameter and depth"),
                )
            )
        return results

    def _pockets(self, pockets: Sequence[PocketFeature]) -> List[FeaturePattern]:
        buckets: Dict[Tuple, List[PocketFeature]] = defaultdict(list)
        for pocket in pockets:
            buckets[_key(pocket.length_mm, pocket.width_mm, pocket.depth_mm)].append(pocket)

        results = []
        for key in sorted(buckets, key=lambda k: str(k)):
            group = buckets[key]
            if len(group) < 2:
                continue
            positions = [p.position.as_tuple() for p in group]
            arrangement, spacing = classify_arrangement(positions, self.config)
            results.append(
                FeaturePattern(
                    type="repeated_pocket",
                    feature_type="pocket",
                    feature_count=len(group),
                    feature_ids=[p.id for p in group],
                    pattern_type=arrangement,
                    length_mm=group[0].length_mm,
                    width_mm=group[0].width_mm,
                    depth_mm=group[0].depth_mm,
                    spacing_mm=spacing,
                    detection=self._detection(
                        len(group), arrangement, "length, width and depth"
                    ),
                )
            )
        return results

    def _slots(self, slots: Sequence[SlotFeature]) -> List[FeaturePattern]:
        buckets: Dict[Tuple, List[SlotFeature]] = defaultdict(list)
        for slot in slots:
            buckets[_key(slot.length_mm, slot.width_mm, slot.depth_mm, slot.subtype)].append(slot)

        results = []
        for key in sorted(buckets, key=lambda k: str(k)):
            group = buckets[key]
            if len(group) < 2:
                continue
            positions = [s.position.as_tuple() for s in group]
            arrangement, spacing = classify_arrangement(positions, self.config)
            results.append(
                FeaturePattern(
                    type="repeated_slot",
                    feature_type="slot",
                    feature_count=len(group),
                    feature_ids=[s.id for s in group],
                    pattern_type=arrangement,
                    length_mm=group[0].length_mm,
                    width_mm=group[0].width_mm,
                    depth_mm=group[0].depth_mm,
                    spacing_mm=spacing,
                    detection=self._detection(
                        len(group), arrangement, "length, width, depth and subtype"
                    ),
                )
            )
        return results

    def _chamfers(self, chamfers: Sequence[ChamferFeature]) -> List[FeaturePattern]:
        buckets: Dict[Tuple, List[ChamferFeature]] = defaultdict(list)
        for chamfer in chamfers:
            buckets[_key(chamfer.size_mm, chamfer.angle_deg or 0.0)].append(chamfer)

        results = []
        for key in sorted(buckets, key=lambda k: str(k)):
            group = buckets[key]
            if len(group) < 2:
                continue
            positions = [
                c.position.as_tuple() for c in group if c.position is not None
            ]
            arrangement, spacing = (
                classify_arrangement(positions, self.config)
                if len(positions) == len(group)
                else ("grouped", None)
            )
            results.append(
                FeaturePattern(
                    type="repeated_chamfer",
                    feature_type="chamfer",
                    feature_count=len(group),
                    feature_ids=[c.id for c in group],
                    pattern_type=arrangement,
                    width_mm=group[0].size_mm,
                    spacing_mm=spacing,
                    detection=self._detection(len(group), arrangement, "size and angle"),
                )
            )
        return results

    def _fillets(self, fillets: Sequence[FilletFeature]) -> List[FeaturePattern]:
        buckets: Dict[Tuple, List[FilletFeature]] = defaultdict(list)
        for fillet in fillets:
            buckets[_key(fillet.radius_mm, fillet.is_corner_fillet)].append(fillet)

        results = []
        for key in sorted(buckets, key=lambda k: str(k)):
            group = buckets[key]
            if len(group) < 2:
                continue
            positions = [f.position.as_tuple() for f in group if f.position is not None]
            arrangement, spacing = (
                classify_arrangement(positions, self.config)
                if len(positions) == len(group)
                else ("grouped", None)
            )
            results.append(
                FeaturePattern(
                    type="repeated_fillet",
                    feature_type="fillet",
                    feature_count=len(group),
                    feature_ids=[f.id for f in group],
                    pattern_type=arrangement,
                    diameter_mm=group[0].radius_mm * 2.0,
                    spacing_mm=spacing,
                    detection=self._detection(len(group), arrangement, "radius"),
                )
            )
        return results

    def _detection(self, count: int, arrangement: str, matched_on: str) -> Detection:
        return Detection(
            method=DetectionMethod.TOPOLOGY_AND_SURFACE,
            confidence=0.95 if arrangement != "grouped" else 0.8,
            evidence=[
                f"{count} features identical on {matched_on}",
                f"positions form a {arrangement} arrangement",
            ],
        )
