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
3. Reject groups whose angular wrap falls well short of 360 degrees - those
   are corner blends or partial fillets, not holes. A single-fragment group
   uses its own span; a multi-fragment group sums the fragments' spans, since
   a full circle is routinely written as two or more seam-split arcs by some
   STEP export paths - two coaxial 180-degree half-cylinders are one hole,
   not two candidates that each fail the wrap check alone.
4. Report one ``SheetMetalHole`` per surviving group: diameter from the
   smallest-radius member (guards against a slightly countersunk/chamfered
   edge being read as a second, wider "hole"), position at the group's face
   centroid average.
5. A second, independent pass (:func:`_loop_based_holes`) catches a hole whose
   wall never resolved to a usable ``CYLINDER`` face at all - fully faceted
   geometry, or an export quirk the fragment-summing above doesn't cover - by
   fitting a circle to the pierced face's own inner boundary loop instead,
   reusing :func:`app.sheet_metal.detectors.cutouts.circle_fit_from_loop`.
   Without this, such a hole falls through to
   :mod:`app.sheet_metal.detectors.cutouts` and is reported as a generic
   "irregular" cutout - present in the output, but unrecognisable as a hole
   and missing the diameter a downstream consumer needs. A candidate that
   nearly coincides with a hole the cylinder pass already found is skipped,
   so the two passes never double-report one physical hole.

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

from ...machining.records import CYLINDER, PLANE, FaceRecord, ShapeModel
from ...machining.vectors import (
    Vec,
    canonical_axis,
    distance,
    is_parallel,
    point_line_distance,
)
from ..config import SheetMetalConfig
from ..schemas import SheetMetalHole, Vector3
from .cutouts import circle_fit_from_loop, inner_profile_loops

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
    groups = _group_coaxial(cylinders, config) if cylinders else []

    holes: List[SheetMetalHole] = []
    # Deterministic ordering independent of kernel traversal order.
    for group in sorted(
        groups, key=lambda g: (min(f.id for f in g),)
    ):
        if len(group) == 1:
            wrap = group[0].angular_span_deg or 360.0
        else:
            # Several coaxial fragments together forming one hole - sum their
            # spans rather than taking the largest, so e.g. two seam-split
            # 180-degree half-cylinders are recognised as one 360-degree hole
            # instead of each individually failing the wrap check below.
            wrap = min(360.0, sum(f.angular_span_deg or 0.0 for f in group))
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

    holes.extend(_loop_based_holes(model, config, holes))
    return holes


def _loop_based_holes(
    model: ShapeModel, config: SheetMetalConfig, already_found: List[SheetMetalHole]
) -> List[SheetMetalHole]:
    """Recognise round holes directly from a pierced face's inner loop.

    See module docstring point 5. Skips any loop whose fitted centre nearly
    coincides with a hole ``already_found`` via the cylinder-grouping pass
    above, so the two passes never double-report one physical hole.
    """
    existing_positions: List[Vec] = [
        (h.position.x, h.position.y, h.position.z) for h in already_found
    ]
    extra: List[SheetMetalHole] = []

    for face in sorted(model.faces_of_type(PLANE), key=lambda f: f.id):
        if face.normal is None or not face.edge_ids:
            continue
        for chain in inner_profile_loops(model, face):
            fit = circle_fit_from_loop(chain)
            if fit is None:
                continue
            center, radius = fit
            if radius <= 0:
                continue
            if any(distance(center, pos) <= max(radius, 1.0) for pos in existing_positions):
                continue
            existing_positions.append(center)
            extra.append(
                SheetMetalHole(
                    id=_feature_id(len(already_found) + len(extra) + 1),
                    diameter_mm=round(radius * 2.0, config.length_decimals),
                    position=Vector3(
                        x=round(center[0], config.length_decimals),
                        y=round(center[1], config.length_decimals),
                        z=round(center[2], config.length_decimals),
                    ),
                    shape="round",
                    quantity=1,
                    distance_to_nearest_edge_mm=None,
                    distance_to_nearest_bend_mm=None,
                )
            )
    return extra
