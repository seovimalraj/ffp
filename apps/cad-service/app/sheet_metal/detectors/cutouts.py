"""Non-circular pierced profile ("cutout") detection.

New detector - no direct machining equivalent to adapt (machining's pockets
have a floor and a depth; a sheet-metal cutout goes all the way through, so
it is a *profile on a flat face*, not a recessed volume). The approach:

``ShapeModel``/``FaceRecord`` does not retain wire-level grouping (each face
only carries a flat ``edge_ids`` list - see ``app.machining.topology``), so
this module reconstructs closed loops itself by chaining edges end-to-end via
shared endpoints. A planar face with more than one closed loop has an outer
boundary (the profile of the flange itself) plus one inner loop per pierced
feature (hole, cutout or slot) cut into it. The outer loop is identified as
the one with the largest bounding-box diagonal; every other loop is an inner
profile.

An inner loop that is a single full-circle edge is a plain round hole,
already reported by :mod:`app.sheet_metal.detectors.holes` (which finds it
independently via the cylindrical wall face, not the planar face's boundary)
- it is skipped here to avoid double-reporting. Everything else is either a
cutout (this module) or, if sufficiently elongated with rounded ends, a slot
(:mod:`app.sheet_metal.detectors.slots`, which reuses
:func:`inner_profile_loops` from here rather than re-deriving the loop logic -
mirrors ``app.machining.detectors.slots`` importing ``PocketCandidate`` from
``pockets.py``).

``min_feature_size_mm`` approximation
--------------------------------------
A true "narrowest local neck width" measurement needs a medial-axis /
erosion-distance computation over the profile polygon, which is out of scope
here. Instead this uses the smaller of the profile's two in-plane
bounding-box extents (measured in the face's own ``u``/``v`` basis, not the
world axes) as a coarse proxy for the smallest feature dimension. This is a
reasonable approximation for compact, roughly-convex cutouts (rectangles,
D-shapes, simple polygons) but **understates the true minimum width for an
L-shaped or dogbone-style profile** - such a shape's bounding box can be much
wider than its narrowest neck. Treat ``min_feature_size_mm`` as an upper
bound / sanity check, not a precise DFM measurement, until a real
erosion-distance detector replaces this.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

from ...machining.records import PLANE, EdgeRecord, FaceRecord, ShapeModel
from ...machining.vectors import Vec, dot, perpendicular_basis
from ..config import SheetMetalConfig
from ..schemas import Cutout, Vector3

Loop = List[EdgeRecord]


def _point_key(p: Vec, decimals: int = 4) -> Tuple[float, float, float]:
    return (round(p[0], decimals), round(p[1], decimals), round(p[2], decimals))


def face_loops(model: ShapeModel, face: FaceRecord) -> List[Loop]:
    """Reconstruct closed edge loops bounding ``face``.

    Pure endpoint-chaining over the face's edges - see module docstring for
    why this is needed instead of reading wire structure directly.
    """
    edges = [model.edges[eid] for eid in face.edge_ids if eid in model.edges]
    loops: List[Loop] = []
    remaining: List[EdgeRecord] = []
    for edge in edges:
        if edge.is_closed:
            # A single edge that closes on itself (a full circle) is already
            # a complete loop on its own.
            loops.append([edge])
        else:
            remaining.append(edge)

    unused = list(remaining)
    while unused:
        chain = [unused.pop(0)]
        start_key = _point_key(chain[0].start)
        end_key = _point_key(chain[0].end)
        changed = True
        # Guard against a malformed/open wire looping forever: bounded by the
        # number of edges left to consider.
        guard = len(unused) + 1
        while changed and end_key != start_key and guard > 0:
            changed = False
            guard -= 1
            for index, edge in enumerate(unused):
                if _point_key(edge.start) == end_key:
                    chain.append(edge)
                    end_key = _point_key(edge.end)
                    unused.pop(index)
                    changed = True
                    break
                if _point_key(edge.end) == end_key:
                    chain.append(edge)
                    end_key = _point_key(edge.start)
                    unused.pop(index)
                    changed = True
                    break
        loops.append(chain)
    return loops


def _ordered_points(chain: Loop) -> List[Vec]:
    """Approximate polygon vertices for ``chain``, in traversal order.

    Curved (non-``LINE``) edges contribute their midpoint in addition to
    their endpoints - a coarse one-sample approximation of the arc's bulge,
    just enough for the bounding-box/area estimates this module makes to
    account for a rounded slot end or a filleted corner rather than
    collapsing it to a straight chord. This is not curve sampling in the
    sense of :mod:`app.machining.topology`'s helix detection (which samples
    many points); one midpoint per arc is a deliberate, documented
    simplification (see module docstring).
    """
    if len(chain) == 1 and chain[0].is_closed:
        return []  # a full circle - callers special-case this

    def _extend(points: List[Vec], edge: EdgeRecord, tail: Vec) -> None:
        if edge.curve_type != "LINE":
            points.append(edge.midpoint)
        points.append(tail)

    points: List[Vec] = []
    cur_end: Optional[Vec] = None
    for index, edge in enumerate(chain):
        if index == 0:
            points.append(edge.start)
            _extend(points, edge, edge.end)
            cur_end = edge.end
            continue
        if cur_end is not None and _point_key(edge.start) == _point_key(cur_end):
            _extend(points, edge, edge.end)
            cur_end = edge.end
        else:
            _extend(points, edge, edge.start)
            cur_end = edge.start
    return points


def _loop_bbox_diagonal(chain: Loop) -> float:
    points = _ordered_points(chain)
    if not points:
        # Full-circle loop: use its own radius as a stand-in "diagonal" so it
        # can still be compared against polygonal loops for outer/inner
        # selection (a circular flange face is a legitimate, if unusual,
        # outer boundary).
        radius = chain[0].radius_mm or 0.0
        return radius * 2.0
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    zs = [p[2] for p in points]
    dx, dy, dz = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
    return (dx * dx + dy * dy + dz * dz) ** 0.5


def inner_profile_loops(
    model: ShapeModel, face: FaceRecord
) -> List[Loop]:
    """Every closed loop on ``face`` other than its outer boundary."""
    loops = face_loops(model, face)
    if len(loops) <= 1:
        return []
    outer = max(loops, key=_loop_bbox_diagonal)
    return [loop for loop in loops if loop is not outer]


def _is_plain_circle(chain: Loop) -> bool:
    return len(chain) == 1 and chain[0].is_closed and chain[0].curve_type == "CIRCLE"


def profile_metrics(
    face: FaceRecord, chain: Loop
) -> Tuple[float, float, float, float, Vec]:
    """Return ``(perimeter_mm, area_mm2, extent_long_mm, extent_short_mm, centroid)``.

    ``extent_long``/``extent_short`` are the in-plane bounding-box extents in
    the face's own ``u``/``v`` basis (``extent_long >= extent_short``) - used
    both for ``min_feature_size_mm`` (cutouts) and the length/width/aspect
    ratio split (slots).
    """
    perimeter = sum(edge.length_mm for edge in chain)
    points = _ordered_points(chain)
    if not points:
        radius = chain[0].radius_mm or 0.0
        area = 3.14159265358979 * radius * radius
        return perimeter, area, radius * 2.0, radius * 2.0, chain[0].midpoint

    normal = face.normal or (0.0, 0.0, 1.0)
    u, v = perpendicular_basis(normal)
    proj = [(dot(p, u), dot(p, v)) for p in points]
    n = len(proj)
    shoelace = 0.0
    for i in range(n):
        x1, y1 = proj[i]
        x2, y2 = proj[(i + 1) % n]
        shoelace += x1 * y2 - x2 * y1
    area = abs(shoelace) / 2.0

    us = [p[0] for p in proj]
    vs = [p[1] for p in proj]
    extent_u = max(us) - min(us)
    extent_v = max(vs) - min(vs)
    extent_long, extent_short = (
        (extent_u, extent_v) if extent_u >= extent_v else (extent_v, extent_u)
    )

    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    cz = sum(p[2] for p in points) / len(points)
    return perimeter, area, extent_long, extent_short, (cx, cy, cz)


def _shape_type(chain: Loop) -> str:
    curve_types = {edge.curve_type for edge in chain}
    if curve_types == {"LINE"}:
        return "rectangular" if len(chain) == 4 else "polygonal"
    if "CIRCLE" in curve_types or "ELLIPSE" in curve_types:
        return "slotted" if "LINE" in curve_types else "irregular"
    return "irregular"


def detect_cutouts(model: ShapeModel, config: SheetMetalConfig) -> List[Cutout]:
    """Detect non-circular pierced profiles on planar flange/base faces.

    Never raises: a model with no inner loops (or no edge data at all - e.g.
    a synthetic ``ShapeModel`` built without ``EdgeRecord``s) returns an
    empty list.
    """
    cutouts: List[Cutout] = []
    for face in sorted(model.faces_of_type(PLANE), key=lambda f: f.id):
        if face.normal is None or not face.edge_ids:
            continue
        for chain in inner_profile_loops(model, face):
            if _is_plain_circle(chain):
                continue  # reported by detectors/holes.py instead
            if is_slot_like(face, chain, config):
                continue  # reported by detectors/slots.py instead

            perimeter, area, extent_long, extent_short, centroid = profile_metrics(
                face, chain
            )
            cutouts.append(
                Cutout(
                    id=f"CUTOUT-{len(cutouts) + 1:03d}",
                    perimeter_mm=round(perimeter, config.length_decimals),
                    area_mm2=round(area, config.area_decimals),
                    shape_type=_shape_type(chain),
                    min_feature_size_mm=round(extent_short, config.length_decimals),
                    position=Vector3(
                        x=round(centroid[0], config.length_decimals),
                        y=round(centroid[1], config.length_decimals),
                        z=round(centroid[2], config.length_decimals),
                    ),
                    distance_to_nearest_edge_mm=None,
                    distance_to_nearest_bend_mm=None,
                )
            )
    return cutouts


#: Aspect ratio (long/short in-plane extent) at or above which an inner
#: profile reads as a slot rather than a general cutout. Conceptually the
#: same "elongated recess" idea as ``MachiningConfig.slot_min_aspect_ratio``
#: (default 3.0 there); duplicated here as a module constant rather than a
#: new ``SheetMetalConfig`` field to avoid growing the shared config surface
#: for a single internal threshold - see :mod:`app.sheet_metal.detectors.slots`.
SLOT_MIN_ASPECT_RATIO = 3.0


def is_slot_like(face: FaceRecord, chain: Loop, config: SheetMetalConfig) -> bool:
    """True when an inner loop's proportions and end geometry read as a slot."""
    if _is_plain_circle(chain):
        return False
    if len(chain) < 2:
        return False
    _, _, extent_long, extent_short, _ = profile_metrics(face, chain)
    if extent_short <= 0:
        return False
    if (extent_long / extent_short) < SLOT_MIN_ASPECT_RATIO:
        return False
    # A slot's two ends are typically rounded (an end-mill/punch profile) -
    # require at least one non-line (arc) edge to avoid classifying a long,
    # sharp-cornered rectangular cutout as a slot.
    return any(edge.curve_type in ("CIRCLE", "ELLIPSE") for edge in chain)
