"""Bend-zone detection: curvature clustering over cylindrical faces.

Ported from ``app.core.bend_detection.AdvancedBendDetector``'s core insight -
a bend is a curvature transition between two flat regions within a plausible
angle window - but adapted to the exact B-Rep IR this package already builds
instead of the legacy detector's mesh-normal-clustering-on-a-triangulated-STL
approach. Where the legacy code has to *discover* face identity from a
triangle soup (hence normal clustering, dihedral-angle histograms, vertex
curvature), this package already has exact face/edge identity via
``ShapeModel``/``FaceRecord`` (see ``app.machining.topology``), so the
equivalent, more precise approach is:

1. Every ``CYLINDER`` face is a bend *candidate* - a press-brake bend forms
   a cylindrical intrados (and, geometrically, a concentric extrados on the
   opposite skin) between the two flat legs it joins, with a radius that
   reads directly off the surface (no ray-casting or curvature sampling
   needed). Candidates whose axis lines coincide are the same physical bend
   seen from its two skins; only the smaller (inner) radius is kept - see
   the dedup step in :func:`detect_bends`.
2. For each candidate, find its two planar neighbours whose shared edge with
   the cylinder is a straight line running parallel to the cylinder's axis
   the full length of the bend (this is what actually distinguishes a real
   bend from an incidental fillet neighbour or an end-cap edge at the
   cylinder's rim).
3. The bend angle is the angle between those two flanges' outward normals -
   0 deg for an unbent sheet, 90 deg for the canonical right-angle bend. Only
   candidates whose angle falls inside the configured clustering window
   (``min_bend_angle_deg``/``max_bend_angle_deg``, seeded from the legacy
   detector's 45-135 deg window) are reported as bends - this is the "cluster
   by angle window" step the legacy module calls out in its 45-135 deg
   comment, applied per-candidate instead of via a mesh-wide histogram since
   exact face identity makes that unnecessary here.
4. Bend allowance / bend deduction use the standard sheet-metal formulas
   (design doc section 4):
   ``BA = (pi/180) * angle_deg * (radius + k*thickness)``
   ``BD = 2*(radius+thickness)*tan(angle_deg/2 in rad) - BA``
   using ``config.default_k_factor`` and the pipeline's already-detected
   dominant thickness (``None`` when thickness is unknown - the formulas are
   then skipped rather than guessed).
"""

from __future__ import annotations

import math
from typing import List, Optional, Tuple

from ...machining.records import CYLINDER, PLANE, EdgeRecord, FaceRecord, ShapeModel
from ...machining.schemas import Detection, DetectionMethod, InformationSource, Vector3
from ...machining.vectors import (
    add,
    angle_between_deg,
    canonical_axis,
    is_parallel,
    point_line_distance,
    project_scalar,
    scale,
    sub,
)
from ..config import SheetMetalConfig
from ..schemas import BendFeature, BendLine

#: Straight bend-line edges must run within this many degrees of the
#: cylinder's own axis to count as the flange-joining edge (as opposed to an
#: incidental edge at the cylinder's rim, which runs circumferentially).
_AXIS_PARALLEL_TOL_DEG = 10.0


def _flange_candidates(
    model: ShapeModel, cyl: FaceRecord
) -> List[Tuple[FaceRecord, EdgeRecord]]:
    """Planar neighbours of ``cyl`` joined by a straight edge along its axis.

    Returns each candidate paired with the longest such edge, so end-cap or
    trim edges (short, and not necessarily axis-parallel) never win over the
    real flange-joining edge.
    """
    candidates: List[Tuple[FaceRecord, EdgeRecord]] = []
    for neighbor in model.neighbors(cyl.id):
        if neighbor.surface_type != PLANE or neighbor.normal is None:
            continue
        best_edge: Optional[EdgeRecord] = None
        for edge in model.shared_edge_records(cyl.id, neighbor.id):
            if edge.curve_type != "LINE":
                continue
            direction = sub(edge.end, edge.start)
            if is_parallel(direction, cyl.axis, _AXIS_PARALLEL_TOL_DEG):  # type: ignore[arg-type]
                if best_edge is None or edge.length_mm > best_edge.length_mm:
                    best_edge = edge
        if best_edge is not None:
            candidates.append((neighbor, best_edge))
    return candidates


def _bend_line(cyl: FaceRecord, length_mm: float) -> BendLine:
    """Segment of the cylinder's axis nearest the face - the geometric bend line."""
    t = project_scalar(cyl.centroid, cyl.axis_location, cyl.axis)  # type: ignore[arg-type]
    mid = add(cyl.axis_location, scale(cyl.axis, t))  # type: ignore[arg-type]
    half = scale(cyl.axis, length_mm / 2.0)  # type: ignore[arg-type]
    start = sub(mid, half)
    end = add(mid, half)
    return BendLine(
        start=Vector3(x=start[0], y=start[1], z=start[2]),
        end=Vector3(x=end[0], y=end[1], z=end[2]),
    )


def _direction(cyl: FaceRecord) -> str:
    """"up" (material folds away from the viewer) vs "down" - a heuristic.

    Concavity is the only signal available without a declared "outside" of
    the part: a concave (bore-like) transition surface is reported as "up",
    a convex one as "down". This is a best-effort label, not load-bearing for
    any downstream DFM check.
    """
    return "up" if cyl.is_internal else "down"


def detect_bends(
    model: ShapeModel,
    config: SheetMetalConfig,
    thickness_mm: Optional[float] = None,
) -> List[BendFeature]:
    """Detect bend zones from cylindrical faces bridging two flanges.

    Never raises: geometry that yields no plausible bend candidates simply
    returns an empty list, matching every other detector's "no hard failure"
    contract in this package.
    """
    cylinders = sorted(
        (f for f in model.faces.values() if f.surface_type == CYLINDER and f.radius_mm),
        key=lambda f: f.id,
    )

    candidate_entries: List[tuple] = []
    for cyl in cylinders:
        if cyl.axis is None or cyl.axis_location is None:
            continue

        candidates = _flange_candidates(model, cyl)
        if len(candidates) < 2:
            continue
        # The two longest axis-parallel shared edges are the real flange
        # joints; anything past that (e.g. a third planar neighbour at a
        # cylinder's trimmed end) is not part of this bend.
        candidates.sort(key=lambda c: c[1].length_mm, reverse=True)
        (flange_a, edge_a), (flange_b, edge_b) = candidates[0], candidates[1]

        angle_deg = angle_between_deg(flange_a.normal, flange_b.normal)  # type: ignore[arg-type]
        if not (config.min_bend_angle_deg <= angle_deg <= config.max_bend_angle_deg):
            continue

        candidate_entries.append((cyl, flange_a, flange_b, edge_a, edge_b, angle_deg))

    # A press-brake bend has both a concave intrados (inner surface) and a
    # convex extrados (outer surface) - two concentric cylindrical faces
    # sharing the same axis line but bridging *different* flange-pair faces
    # (the inner skin's two faces vs. the outer skin's two faces), so
    # deduplicating by flange-pair identity alone is not enough. Instead,
    # candidates whose axis lines coincide (parallel, and within a
    # plausible sheet-thickness perpendicular distance of each other) are
    # treated as the same physical bend, and only the smallest-radius one -
    # the true inner surface, by definition the smaller of two concentric
    # radii - is kept. This is robust to the concavity flag
    # (``FaceRecord.is_internal``) being orientation-dependent and thus an
    # unreliable way to tell intrados from extrados directly.
    max_axis_gap = config.max_sheet_thickness_mm * 2.0
    groups: List[List[tuple]] = []
    for entry in candidate_entries:
        cyl = entry[0]
        axis = canonical_axis(cyl.axis)  # type: ignore[arg-type]
        placed = False
        for group in groups:
            g_cyl = group[0][0]
            g_axis = canonical_axis(g_cyl.axis)  # type: ignore[arg-type]
            if not is_parallel(axis, g_axis, tol_deg=2.0):
                continue
            gap = point_line_distance(cyl.axis_location, g_cyl.axis_location, g_axis)  # type: ignore[arg-type]
            if gap <= max_axis_gap:
                group.append(entry)
                placed = True
                break
        if not placed:
            groups.append([entry])

    deduped = [min(group, key=lambda entry: entry[0].radius_mm) for group in groups]

    bends: List[BendFeature] = []
    sequence = 0
    for cyl, flange_a, flange_b, edge_a, edge_b, angle_deg in sorted(
        deduped, key=lambda entry: entry[0].id
    ):
        radius = float(cyl.radius_mm)  # type: ignore[arg-type]
        length_mm = cyl.axial_extent_mm or max(edge_a.length_mm, edge_b.length_mm)

        k_factor = config.default_k_factor
        bend_allowance: Optional[float] = None
        bend_deduction: Optional[float] = None
        if thickness_mm is not None and thickness_mm > 0:
            angle_rad = math.radians(angle_deg)
            bend_allowance = angle_rad * (radius + k_factor * thickness_mm)
            bend_deduction = (
                2.0 * (radius + thickness_mm) * math.tan(angle_rad / 2.0) - bend_allowance
            )

        sequence += 1
        bends.append(
            BendFeature(
                id=f"bend_{sequence}",
                angle_deg=round(angle_deg, 2),
                inner_radius_mm=round(radius, config.length_decimals),
                bend_line=_bend_line(cyl, length_mm),
                axis=Vector3(x=cyl.axis[0], y=cyl.axis[1], z=cyl.axis[2]),
                length_mm=round(length_mm, config.length_decimals),
                direction=_direction(cyl),
                sequence_hint=sequence,
                k_factor_assumed=k_factor,
                bend_allowance_mm=(
                    round(bend_allowance, config.length_decimals)
                    if bend_allowance is not None
                    else None
                ),
                bend_deduction_mm=(
                    round(bend_deduction, config.length_decimals)
                    if bend_deduction is not None
                    else None
                ),
                adjacent_flange_ids=[str(flange_a.id), str(flange_b.id)],
                detection=Detection(
                    method=DetectionMethod.TOPOLOGY_AND_SURFACE,
                    confidence=0.9,
                    evidence=[
                        f"cylindrical face {cyl.id} (r={radius:.3f}mm) bridges planar "
                        f"faces {flange_a.id} and {flange_b.id}",
                        f"flange normals {angle_deg:.1f} deg apart, within the "
                        f"configured [{config.min_bend_angle_deg}, "
                        f"{config.max_bend_angle_deg}] deg bend window",
                    ],
                    source=InformationSource.GEOMETRY,
                ),
            )
        )

    return bends
