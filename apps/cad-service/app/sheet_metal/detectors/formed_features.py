"""Formed-feature detection: embosses and draws.

An emboss or a draw is a *displaced*, not a *removed*, region of the sheet: a
patch of material parallel to the base skin but offset from it along the base
normal, fully enclosed by wall faces so its boundary never reaches the outer
profile. That closed-island shape is exactly what
``app.machining.detectors.pockets`` already recognises in solid stock (a
recessed floor plus surrounding walls) - the difference here is *how* floor is
told apart from wall. Machining's ``PocketDetector`` needs a ray-cast visibility
check because a solid part's floor and wall can otherwise look alike; a sheet
part does not need that, because its base face is already known
(``SheetMetalFaces.base_face_id``), so any other planar face
parallel to that base normal is floor-like by construction, and everything
perpendicular to it is a wall. ``group_coplanar`` / ``wall_faces_of`` /
``planar_dimensions_from_corners`` are reused verbatim from
``app.machining.detectors.shared`` rather than re-derived, matching this
package's "explicit reuse, not duplication" convention.

Two guards keep this from mistaking the sheet's *own opposite skin* for a
formed feature (which would otherwise pass every check above: it is planar,
parallel to the base normal, offset by the sheet thickness, and its edges are
"walled" by the part's own edge band):

* ``formed_feature_max_area_fraction`` - an island covering most of the base
  face's own area is the opposite skin, not a nested feature.
* the island's in-plane footprint must fit inside the base face's own
  footprint (not just be smaller) - a co-extensive parallel face is rejected
  even if some kernel quirk shrinks its reported area.

Scope: only a flat-bottomed island is recognised (a planar floor). A pure
dome (a single curved cap blending straight into the base with no distinct
floor face) is not detected - that needs curvature-based recognition, not the
face-pair approach here. Round vs. rectangular is told apart by whether the
walls include a cylinder/cone whose axis runs along the base normal; a tapered
(conical) draw wall is accepted for the round/diameter measurement using its
radius at the floor, same approximation ``app.machining.detectors.bosses``
already makes for a boss cap.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Sequence

from ...machining.detectors.shared import (
    bbox_corners,
    feature_id,
    group_coplanar,
    planar_dimensions_from_corners,
    wall_faces_of,
)
from ...machining.records import CONE, CYLINDER, PLANE, FaceRecord, ShapeModel
from ...machining.schemas import Detection, DetectionMethod
from ...machining.vectors import (
    Vec,
    add,
    dot,
    is_parallel,
    normalize,
    perpendicular_basis,
    scale,
)
from ..config import SheetMetalConfig
from ..schemas import FormedFeature, SheetMetalFaces, Vector3

#: A wrap below this is a corner fillet, not the single wall of a round island.
_MIN_ROUND_WRAP_DEG = 300.0


def detect_formed_features(
    model: ShapeModel,
    config: SheetMetalConfig,
    faces: SheetMetalFaces,
    rejections: Optional[Dict[int, str]] = None,
) -> List[FormedFeature]:
    """Detect embosses and draws: closed, walled islands offset from the base.

    Never raises: no resolved base face, or no qualifying island, simply
    returns an empty list, matching every other detector's "no hard failure"
    contract in this package.

    ``rejections``, when passed, is populated in place with ``face_id ->
    reason`` for every candidate face considered and turned down - mirroring
    ``app.machining.detectors.pockets.PocketDetector.rejections``. An empty
    ``formed_features`` list is otherwise indistinguishable from a part that
    genuinely has none; this is what lets ``include_debug_geometry=true``
    answer "why wasn't X detected" instead of just "it wasn't".
    """
    base = model.faces.get(faces.base_face_id) if faces.base_face_id is not None else None
    if base is None or base.normal is None or base.area_mm2 <= 0:
        return []
    base_normal = normalize(base.normal)

    excluded_ids = {base.id} | {f.face_id for f in faces.flange_faces}
    candidates = [
        f
        for f in model.faces.values()
        if f.surface_type == PLANE
        and f.normal is not None
        and f.id not in excluded_ids
        and is_parallel(f.normal, base_normal, config.angular_tolerance_deg)
    ]
    if not candidates:
        return []

    base_u_range, base_v_range = _footprint(base, base_normal)
    levels_by_face_id = _reference_levels(model, config, base, base_normal)

    features: List[FormedFeature] = []
    for group in group_coplanar(model, candidates, config):
        feature = _evaluate_group(
            model,
            config,
            base,
            base_normal,
            base_u_range,
            base_v_range,
            levels_by_face_id,
            group,
            len(features) + 1,
            rejections,
        )
        if feature is not None:
            features.append(feature)
    return features


def _reject(rejections: Optional[Dict[int, str]], group: Sequence[FaceRecord], reason: str) -> None:
    if rejections is None:
        return
    for face in group:
        rejections[face.id] = reason


def _reference_levels(
    model: ShapeModel, config: SheetMetalConfig, base: FaceRecord, base_normal: Vec
) -> Dict[int, float]:
    """``face_id -> level`` (along ``base_normal``) for every candidate an
    island's depth can be measured from.

    Always includes the base face itself, plus every other planar face in the
    model parallel to the base normal - typically fragments of the same
    logical skin split apart by a local island's own cutout (a ring, in the
    common case), regardless of whether ``detect_base_flange`` happened to
    reach that fragment through a bend. Depth is then measured from whichever
    of these sits closest to the island (excluding the island's own faces -
    see :func:`_evaluate_group`), not always the base: a feature formed from
    a fragment other than the chosen base would otherwise be measured against
    the wrong skin and over- or under-state its depth by roughly the gap
    between them.

    Deliberately independent of ``SheetMetalFaces.flange_faces`` - that set
    answers "is this reachable from the base via a real fold", a different
    question from "is this plane close enough to measure this island from".
    An unrelated but same-normal panel elsewhere on a folded part could in
    principle be picked up here too, but nearest-level selection makes that
    harmless: a genuinely local ring is, by construction, the closest
    candidate in practice.
    """
    levels: Dict[int, float] = {base.id: dot(base.centroid, base_normal)}
    for face in model.faces.values():
        if face.id == base.id or face.surface_type != PLANE or face.normal is None:
            continue
        if is_parallel(face.normal, base_normal, config.angular_tolerance_deg):
            levels[face.id] = dot(face.centroid, base_normal)
    return levels


def _footprint(face: FaceRecord, normal: Vec):
    u, v = _basis(normal)
    corners = bbox_corners(face)
    us = [dot(c, u) for c in corners]
    vs = [dot(c, v) for c in corners]
    return (min(us), max(us)), (min(vs), max(vs))


def _basis(normal: Vec):
    return perpendicular_basis(normal)


def _fits_inside(
    group: Sequence[FaceRecord], normal: Vec, base_u_range, base_v_range, tolerance: float
) -> bool:
    u, v = _basis(normal)
    corners = [c for face in group for c in bbox_corners(face)]
    us = [dot(c, u) for c in corners]
    vs = [dot(c, v) for c in corners]
    (bu0, bu1), (bv0, bv1) = base_u_range, base_v_range
    return (
        min(us) >= bu0 - tolerance
        and max(us) <= bu1 + tolerance
        and min(vs) >= bv0 - tolerance
        and max(vs) <= bv1 + tolerance
    )


def _is_closed(model: ShapeModel, face: FaceRecord, ok_ids: set) -> bool:
    for edge_id in face.edge_ids:
        edge = model.edges.get(edge_id)
        if edge is None:
            continue
        others = [fid for fid in edge.face_ids if fid != face.id]
        if not others:
            return False
        if not any(fid in ok_ids for fid in others):
            return False
    return True


def _area_weighted_centroid(faces: Sequence[FaceRecord], total_area: float) -> Vec:
    if total_area <= 0:
        return faces[0].centroid
    weighted = (0.0, 0.0, 0.0)
    for face in faces:
        weighted = add(weighted, scale(face.centroid, face.area_mm2))
    return scale(weighted, 1.0 / total_area)


def _round_wall(walls: Sequence[FaceRecord], base_normal: Vec, config: SheetMetalConfig) -> Optional[FaceRecord]:
    """A single cylindrical/conical wall wrapping (most of) the island."""
    for wall in walls:
        if wall.surface_type not in (CYLINDER, CONE):
            continue
        if wall.axis is None:
            continue
        if not is_parallel(wall.axis, base_normal, config.angular_tolerance_deg):
            continue
        if (wall.angular_span_deg or 0.0) >= _MIN_ROUND_WRAP_DEG:
            return wall
    return None


def _evaluate_group(
    model: ShapeModel,
    config: SheetMetalConfig,
    base: FaceRecord,
    base_normal: Vec,
    base_u_range,
    base_v_range,
    levels_by_face_id: Dict[int, float],
    group: List[FaceRecord],
    index: int,
    rejections: Optional[Dict[int, str]] = None,
) -> Optional[FormedFeature]:
    total_area = sum(f.area_mm2 for f in group)
    if total_area <= 0:
        _reject(rejections, group, "degenerate area")
        return None
    if total_area > config.formed_feature_max_area_fraction * base.area_mm2:
        _reject(
            rejections,
            group,
            f"area {round(total_area, 2)} mm2 exceeds "
            f"{config.formed_feature_max_area_fraction * 100:.0f}% of base face "
            f"{base.id}'s area ({round(base.area_mm2, 2)} mm2) - likely the "
            "sheet's opposite skin, not a nested feature",
        )
        return None
    if not _fits_inside(group, base_normal, base_u_range, base_v_range, config.linear_tolerance_mm * 10):
        _reject(
            rejections,
            group,
            f"footprint extends outside base face {base.id}'s own footprint - "
            "not a nested island",
        )
        return None

    member_ids = {f.id for f in group}
    walls: List[FaceRecord] = []
    seen_wall_ids: set = set()
    for face in group:
        for wall in wall_faces_of(model, face, config):
            if wall.id in member_ids or wall.id in seen_wall_ids:
                continue
            seen_wall_ids.add(wall.id)
            walls.append(wall)
    if not walls:
        _reject(
            rejections,
            group,
            "no enclosing wall face(s) found - a bare parallel face with no "
            "enclosure is not a formed feature",
        )
        return None

    floor_level = dot(group[0].centroid, base_normal)
    other_levels = [
        level for fid, level in levels_by_face_id.items() if fid not in member_ids
    ]
    if not other_levels:
        _reject(rejections, group, "no other skin-plane face found to measure depth from")
        return None
    depth = min(abs(floor_level - level) for level in other_levels)
    if depth < config.min_formed_feature_depth_mm:
        _reject(
            rejections,
            group,
            f"offset {round(depth, 4)} mm from the nearest skin plane is below "
            f"min_formed_feature_depth_mm ({config.min_formed_feature_depth_mm})",
        )
        return None

    ok_ids = member_ids | seen_wall_ids
    closed = all(_is_closed(model, face, ok_ids) for face in group)
    position = _area_weighted_centroid(group, total_area)

    round_wall = _round_wall(walls, base_normal, config)
    shape = "round" if round_wall is not None else "rectangular"
    diameter_mm: Optional[float] = None
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    characteristic_width: Optional[float] = None

    if round_wall is not None and round_wall.radius_mm:
        diameter_mm = round(round_wall.radius_mm * 2.0, config.length_decimals)
        characteristic_width = diameter_mm
    else:
        corners = [c for face in group for c in bbox_corners(face)]
        length, width, _, _ = planar_dimensions_from_corners(corners, base_normal)
        if width <= 0:
            _reject(rejections, group, "degenerate in-plane dimensions")
            return None
        length_mm = round(length, config.length_decimals)
        width_mm = round(width, config.length_decimals)
        characteristic_width = width

    ratio = depth / characteristic_width if characteristic_width and characteristic_width > 0 else None
    subtype = (
        "emboss"
        if ratio is not None and ratio <= config.emboss_max_depth_to_width_ratio
        else "draw"
    )

    evidence = [
        f"{len(group)} coplanar face(s) parallel to base face {base.id}, "
        f"offset {round(depth, 3)} mm along its normal",
        f"{len(walls)} enclosing wall face(s)",
    ]
    if round_wall is not None:
        evidence.append(f"wrapped by cylindrical/conical wall face {round_wall.id}")

    return FormedFeature(
        id=feature_id("FORMED", index),
        subtype=subtype,
        shape=shape,
        depth_mm=round(depth, config.length_decimals),
        depth_to_width_ratio=round(ratio, 4) if ratio is not None else None,
        diameter_mm=diameter_mm,
        length_mm=length_mm,
        width_mm=width_mm,
        area_mm2=round(total_area, config.area_decimals),
        closed=closed,
        position=Vector3.from_tuple(position),
        wall_count=len(walls),
        face_ids=sorted(member_ids | seen_wall_ids),
        detection=Detection(
            method=DetectionMethod.TOPOLOGY_AND_SURFACE,
            confidence=0.85 if closed else 0.65,
            evidence=evidence
            + (
                ["floor boundary fully enclosed by walls"]
                if closed
                else ["floor boundary opens to a non-wall face"]
            ),
        ),
        status="resolved" if closed else "ambiguous",
        reason=(
            None
            if closed
            else (
                "Offset island is walled but its boundary is not fully closed; "
                "this may be an open formed feature or a face adjoining another "
                "feature."
            )
        ),
    )
