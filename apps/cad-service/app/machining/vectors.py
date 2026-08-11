"""Small pure-Python vector helpers.

Deliberately dependency-free so the geometry reasoning in the detectors can be
unit-tested without a CAD kernel installed.
"""

from __future__ import annotations

import math
from typing import Iterable, List, Optional, Sequence, Tuple

Vec = Tuple[float, float, float]

PRINCIPAL_DIRECTIONS: dict = {
    "+X": (1.0, 0.0, 0.0),
    "-X": (-1.0, 0.0, 0.0),
    "+Y": (0.0, 1.0, 0.0),
    "-Y": (0.0, -1.0, 0.0),
    "+Z": (0.0, 0.0, 1.0),
    "-Z": (0.0, 0.0, -1.0),
}


def add(a: Vec, b: Vec) -> Vec:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a: Vec, b: Vec) -> Vec:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def scale(a: Vec, k: float) -> Vec:
    return (a[0] * k, a[1] * k, a[2] * k)


def dot(a: Vec, b: Vec) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a: Vec, b: Vec) -> Vec:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def norm(a: Vec) -> float:
    return math.sqrt(dot(a, a))


def normalize(a: Vec) -> Vec:
    n = norm(a)
    if n < 1e-12:
        return (0.0, 0.0, 0.0)
    return (a[0] / n, a[1] / n, a[2] / n)


def distance(a: Vec, b: Vec) -> float:
    return norm(sub(a, b))


def angle_between_deg(a: Vec, b: Vec) -> float:
    """Angle in [0, 180] between two vectors."""
    na, nb = normalize(a), normalize(b)
    if norm(na) == 0 or norm(nb) == 0:
        return 0.0
    return math.degrees(math.acos(max(-1.0, min(1.0, dot(na, nb)))))


def is_parallel(a: Vec, b: Vec, tol_deg: float) -> bool:
    """True when ``a`` and ``b`` are parallel *or* antiparallel within ``tol_deg``."""
    ang = angle_between_deg(a, b)
    return ang <= tol_deg or ang >= 180.0 - tol_deg


def is_same_direction(a: Vec, b: Vec, tol_deg: float) -> bool:
    """True only when the vectors point the same way."""
    return angle_between_deg(a, b) <= tol_deg


def is_perpendicular(a: Vec, b: Vec, tol_deg: float) -> bool:
    return abs(angle_between_deg(a, b) - 90.0) <= tol_deg


def point_line_distance(point: Vec, origin: Vec, direction: Vec) -> float:
    """Perpendicular distance from ``point`` to the infinite line."""
    d = normalize(direction)
    if norm(d) == 0:
        return distance(point, origin)
    v = sub(point, origin)
    return norm(sub(v, scale(d, dot(v, d))))


def project_scalar(point: Vec, origin: Vec, direction: Vec) -> float:
    """Signed distance of ``point`` along ``direction`` from ``origin``."""
    return dot(sub(point, origin), normalize(direction))


def canonical_axis(axis: Vec) -> Vec:
    """Fold an axis onto a canonical hemisphere so +Z and -Z group together."""
    a = normalize(axis)
    for component in a:
        if abs(component) > 1e-9:
            return a if component > 0 else scale(a, -1.0)
    return a


def perpendicular_basis(direction: Vec) -> Tuple[Vec, Vec]:
    """Return two unit vectors spanning the plane normal to ``direction``."""
    d = normalize(direction)
    helper = (0.0, 0.0, 1.0)
    if abs(dot(d, helper)) > 0.9:
        helper = (1.0, 0.0, 0.0)
    u = normalize(cross(d, helper))
    v = normalize(cross(d, u))
    return u, v


def centroid(points: Sequence[Vec]) -> Vec:
    if not points:
        return (0.0, 0.0, 0.0)
    n = float(len(points))
    return (
        sum(p[0] for p in points) / n,
        sum(p[1] for p in points) / n,
        sum(p[2] for p in points) / n,
    )


def round_to(value: float, decimals: int) -> float:
    """Round and normalise ``-0.0`` to ``0.0`` so output is byte-stable."""
    result = round(float(value), decimals)
    return 0.0 if result == 0 else result


def cluster_values(
    values: Iterable[float], tolerance: float
) -> List[List[float]]:
    """Group nearby scalars into ascending clusters. Deterministic."""
    ordered = sorted(float(v) for v in values)
    clusters: List[List[float]] = []
    for value in ordered:
        if clusters and abs(value - clusters[-1][-1]) <= tolerance:
            clusters[-1].append(value)
        else:
            clusters.append([value])
    return clusters


def unique_rounded(values: Iterable[float], decimals: int = 3) -> List[float]:
    """Sorted unique values, rounded. Stable ordering for reproducible output."""
    return sorted({round_to(v, decimals) for v in values})


def nearest_direction_label(direction: Vec, tol_deg: float = 45.0) -> Optional[str]:
    """Label of the closest principal axis, or ``None`` when nothing is close."""
    best_label, best_angle = None, tol_deg
    for label, axis in PRINCIPAL_DIRECTIONS.items():
        ang = angle_between_deg(direction, axis)
        if ang < best_angle:
            best_label, best_angle = label, ang
    return best_label
