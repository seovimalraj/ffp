"""Circular through-hole detection on sheet-metal faces.

Adapted from ``app.machining.detectors.holes.HoleDetector``'s coaxial-cylinder
grouping, but deliberately much simpler: sheet-metal holes are *pierced*, not
bored. There is no through/blind distinction, no counterbore/countersink
stepping, and no solid-classification probe needed to decide "does this hole
have a bottom" - a thin sheet wall never has one. A punched or laser-cut hole
is, geometrically, just one (or occasionally two, if the plate has coincident
faces at each skin) coaxial internal cylindrical face(s) wrapping close to a
full circle.

Algorithm
---------
1. Collect every concave (``is_internal is True``) cylindrical face with a
   resolved axis and a positive radius.
2. Group faces sharing one axis line (same direction *and* location, within
   tolerance) - mirrors ``app.machining.detectors.shared.group_coaxial``,
   reimplemented locally so this package stays decoupled from
   ``app.machining.config``'s field set (see design doc section 3.1).
3. Reject groups whose largest angular wrap falls well short of 360 degrees -
   those are corner blends or partial fillets, not holes.
4. Report one ``SheetMetalHole`` per surviving group: diameter from the
   smallest-radius member (guards against a slightly countersunk/chamfered
   edge being read as a second, wider "hole"), position at the group's face
   centroid average.

``distance_to_nearest_edge_mm`` / ``distance_to_nearest_bend_mm`` are left as
``None`` here by design - the design doc assigns real distance-to-edge / -bend
computation to Phase 5's ``distance_checks.py``. This detector only guarantees
the fields are structurally present with a safe default.

``quantity`` is always ``1``: each geometrically distinct hole gets its own
record rather than being folded into a repeated-feature count. Grouping
identical holes into one record with ``quantity > 1`` is a reasonable future
enhancement (it would pair naturally with Phase 5's pattern detection), not
implemented here to keep this detector's contract simple - "one physical hole
per record" - and unambiguous.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

from ...machining.records import CYLINDER, FaceRecord, ShapeModel
from ...machining.vectors import (
    Vec,
    canonical_axis,
    is_parallel,
    point_line_distance,
)
from ..config import SheetMetalConfig
from ..schemas import SheetMetalHole, Vector3

#: A group must wrap at least this many degrees (summed isn't attempted here -
#: sheet holes are almost never interrupted the way a machined bore can be by
#: ribs, so a single-fragment wrap check is enough) to be considered a full
#: circular hole rather than a partial arc/fillet.
_MIN_WRAP_DEG = 300.0

#: Coaxial grouping tolerance. ``SheetMetalConfig`` has no
#: ``coaxial_tolerance_mm`` field of its own (see module docstring on
#: decoupling from ``MachiningConfig``), so a small fixed tolerance - the same
#: order of magnitude as machining's default - is used instead.
_COAXIAL_TOLERANCE_MM = 0.05


def _feature_id(index: int) -> str:
    return f"HOLE-{index:03d}"


def _group_coaxial(
    cylinders: List[FaceRecord], config: SheetMetalConfig
) -> List[List[FaceRecord]]:
    """Group cylindrical faces sharing one axis line.

    Local reimplementation of
    ``app.machining.detectors.shared.group_coaxial`` - see module docstring.
    """
    groups: List[List[FaceRecord]] = []
    axes: List[Tuple[Vec, Vec]] = []

    for face in sorted(cylinders, key=lambda f: f.id):
        axis = canonical_axis(face.axis)  # type: ignore[arg-type]
        placed = False
        for index, (group_axis, group_point) in enumerate(axes):
            if not is_parallel(axis, group_axis, config.angular_tolerance_deg):
                continue
            if point_line_distance(face.axis_location, group_point, group_axis) <= _COAXIAL_TOLERANCE_MM:  # type: ignore[arg-type]
                groups[index].append(face)
                placed = True
                break
        if not placed:
            groups.append([face])
            axes.append((axis, face.axis_location))  # type: ignore[arg-type]
    return groups


def detect_holes(model: ShapeModel, config: SheetMetalConfig) -> List[SheetMetalHole]:
    """Detect circular pierced holes.

    Never raises: geometry with no qualifying cylindrical faces simply
    returns an empty list, matching every other detector's "no hard failure"
    contract in this package.
    """
    cylinders = [
        f
        for f in model.faces.values()
        if f.surface_type == CYLINDER
        and f.is_internal is True
        and f.radius_mm
        and f.radius_mm > 0
        and f.axis is not None
        and f.axis_location is not None
    ]
    if not cylinders:
        return []

    groups = _group_coaxial(cylinders, config)

    holes: List[SheetMetalHole] = []
    # Deterministic ordering independent of kernel traversal order.
    for group in sorted(
        groups, key=lambda g: (min(f.id for f in g),)
    ):
        wrap = max((f.angular_span_deg or 360.0) for f in group)
        if wrap < _MIN_WRAP_DEG:
            continue  # partial arc / corner blend, not a hole

        radius = min(f.radius_mm for f in group)  # type: ignore[type-var]
        cx = sum(f.centroid[0] for f in group) / len(group)
        cy = sum(f.centroid[1] for f in group) / len(group)
        cz = sum(f.centroid[2] for f in group) / len(group)

        holes.append(
            SheetMetalHole(
                id=_feature_id(len(holes) + 1),
                diameter_mm=round(radius * 2.0, config.length_decimals),
                position=Vector3(
                    x=round(cx, config.length_decimals),
                    y=round(cy, config.length_decimals),
                    z=round(cz, config.length_decimals),
                ),
                shape="round",
                quantity=1,
                distance_to_nearest_edge_mm=None,
                distance_to_nearest_bend_mm=None,
            )
        )
    return holes
