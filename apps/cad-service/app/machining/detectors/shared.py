"""Geometry helpers shared by the feature detectors.

Everything here is pure Python over :class:`FaceRecord`, so each helper can be
unit-tested with synthetic faces and no CAD kernel present.
"""

from __future__ import annotations

import math
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from ..config import MachiningConfig
from ..records import PLANE, FaceRecord, ShapeModel
from ..vectors import (
    Vec,
    add,
    angle_between_deg,
    canonical_axis,
    dot,
    is_parallel,
    is_perpendicular,
    normalize,
    perpendicular_basis,
    project_scalar,
    scale,
    sub,
)


def bbox_corners(face: FaceRecord) -> List[Vec]:
    """The eight corners of a face's axis-aligned bounding box."""
    (x0, y0, z0), (x1, y1, z1) = face.bbox_min, face.bbox_max
    return [
        (x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)
    ]


def axial_range(face: FaceRecord, axis: Vec, origin: Vec) -> Tuple[float, float]:
    """Signed extent of a face along ``axis``, measured from ``origin``.

    Derived from the face bounding box, which slightly over-estimates for
    curved faces but never under-estimates a depth - the safe direction for a
    machining consumer.
    """
    projections = [project_scalar(corner, origin, axis) for corner in bbox_corners(face)]
    return min(projections), max(projections)


def axis_point(origin: Vec, axis: Vec, t: float) -> Vec:
    """Point at parameter ``t`` along the axis line through ``origin``."""
    return add(origin, scale(normalize(axis), t))


def face_extent_along(face: FaceRecord, direction: Vec) -> float:
    """Length of a face's bounding box measured along ``direction``."""
    low, high = axial_range(face, direction, (0.0, 0.0, 0.0))
    return high - low


def planar_dimensions(face: FaceRecord, normal: Vec) -> Tuple[float, float, Vec, Vec]:
    """In-plane bounding extents of a face.

    Returns ``(length, width, long_axis, short_axis)`` with ``length >= width``.
    The two in-plane basis vectors come from :func:`perpendicular_basis`, which
    is deterministic for a given normal, so repeated runs agree exactly.
    """
    u, v = perpendicular_basis(normal)
    corners = bbox_corners(face)
    us = [dot(c, u) for c in corners]
    vs = [dot(c, v) for c in corners]
    extent_u = max(us) - min(us)
    extent_v = max(vs) - min(vs)
    if extent_u >= extent_v:
        return extent_u, extent_v, u, v
    return extent_v, extent_u, v, u


def is_tangent_across(
    model: ShapeModel, face_a: FaceRecord, face_b: FaceRecord, config: MachiningConfig
) -> bool:
    """True when two faces meet smoothly (no visible edge) along a shared edge.

    Tangency is the defining property of a fillet: a blend surface flows into
    both neighbours, while a chamfer or a pocket wall meets them at an angle.
    Compared at the shared edge midpoint using each face's local direction.
    """
    edges = model.shared_edge_records(face_a.id, face_b.id)
    if not edges:
        return False
    edge = max(edges, key=lambda e: e.length_mm)
    normal_a = local_normal(face_a, edge.midpoint)
    normal_b = local_normal(face_b, edge.midpoint)
    if normal_a is None or normal_b is None:
        return False
    return angle_between_deg(normal_a, normal_b) <= config.tangency_tolerance_deg


def local_normal(face: FaceRecord, point: Vec) -> Optional[Vec]:
    """Outward normal of ``face`` at (or near) ``point``.

    Exact for planes and for the analytic surfaces we care about; ``None`` when
    the face type carries no closed-form normal.
    """
    if face.surface_type == PLANE:
        return face.normal
    if face.axis is not None and face.axis_location is not None and face.radius_mm:
        # Radial direction at the point, flipped for concave surfaces.
        to_point = sub(point, face.axis_location)
        axial = dot(to_point, face.axis)
        radial = normalize(sub(to_point, scale(face.axis, axial)))
        if radial == (0.0, 0.0, 0.0):
            return None
        return scale(radial, -1.0) if face.is_internal else radial
    return None


def group_coaxial(
    faces: Sequence[FaceRecord], config: MachiningConfig
) -> List[List[FaceRecord]]:
    """Group faces sharing one axis line (same direction *and* same location).

    Two cylinders with parallel axes 40 mm apart are two different holes, so
    both the direction and the perpendicular offset are compared.
    """
    groups: List[List[FaceRecord]] = []
    axes: List[Tuple[Vec, Vec]] = []  # (canonical direction, point on the line)

    ordered = sorted(
        (f for f in faces if f.axis is not None and f.axis_location is not None),
        key=lambda f: (f.id,),
    )

    for face in ordered:
        axis = canonical_axis(face.axis)
        placed = False
        for index, (group_axis, group_point) in enumerate(axes):
            if not is_parallel(axis, group_axis, config.angular_tolerance_deg):
                continue
            offset = sub(face.axis_location, group_point)
            axial = dot(offset, group_axis)
            radial = sub(offset, scale(group_axis, axial))
            if math.sqrt(dot(radial, radial)) <= config.coaxial_tolerance_mm:
                groups[index].append(face)
                placed = True
                break
        if not placed:
            groups.append([face])
            axes.append((axis, face.axis_location))
    return groups


def model_extreme_along(model: ShapeModel, direction: Vec) -> float:
    """Highest projection of the model bounding box along ``direction``."""
    corners = [
        (x, y, z)
        for x in (model.bbox_min[0], model.bbox_max[0])
        for y in (model.bbox_min[1], model.bbox_max[1])
        for z in (model.bbox_min[2], model.bbox_max[2])
    ]
    return max(project_scalar(c, (0.0, 0.0, 0.0), direction) for c in corners)


def is_outer_face(model: ShapeModel, face: FaceRecord, config: MachiningConfig) -> bool:
    """True when a planar face sits on the model's outer silhouette.

    Used to separate a pocket floor (recessed) from the top face of the stock.
    """
    if face.normal is None:
        return False
    face_top = axial_range(face, face.normal, (0.0, 0.0, 0.0))[1]
    model_top = model_extreme_along(model, face.normal)
    return abs(model_top - face_top) <= config.linear_tolerance_mm * 10


def wall_faces_of(
    model: ShapeModel, floor: FaceRecord, config: MachiningConfig
) -> List[FaceRecord]:
    """Neighbouring faces that rise from a floor face like a pocket wall.

    A wall is either planar and perpendicular to the floor, or a cylinder whose
    axis is parallel to the floor normal (a corner radius).
    """
    if floor.normal is None:
        return []
    walls: List[FaceRecord] = []
    for neighbor in model.neighbors(floor.id):
        if neighbor.surface_type == PLANE and neighbor.normal is not None:
            if is_perpendicular(neighbor.normal, floor.normal, config.angular_tolerance_deg * 5):
                walls.append(neighbor)
        elif neighbor.axis is not None:
            if is_parallel(neighbor.axis, floor.normal, config.angular_tolerance_deg * 5):
                walls.append(neighbor)
    return walls


def min_corner_radius(walls: Iterable[FaceRecord]) -> Optional[float]:
    """Smallest internal corner radius among a pocket's wall faces."""
    radii = [
        w.radius_mm
        for w in walls
        if w.radius_mm and w.radius_mm > 0 and w.is_internal is not False
    ]
    return min(radii) if radii else None


def round_vec(vec: Vec, decimals: int = 6) -> Vec:
    return (round(vec[0], decimals), round(vec[1], decimals), round(vec[2], decimals))


def feature_id(prefix: str, index: int) -> str:
    """Stable, zero-padded identifier - ``HOLE-001``."""
    return f"{prefix}-{index:03d}"
