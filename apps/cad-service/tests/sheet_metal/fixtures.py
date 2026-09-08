"""Representative STEP fixtures for sheet-metal analysis, built with the CAD
kernel at test time.

Mirrors ``tests/machining/fixtures.py``'s convention: generating the parts
rather than committing binary STEP files keeps the repo free of opaque blobs
and makes each fixture's intent readable from the construction below. Every
builder returns a path to a STEP file inside ``tmp_path``. If no kernel is
installed the module-level :data:`KERNEL` flag is False and tests that need
these fixtures skip via ``conftest.requires_kernel``.
"""

from __future__ import annotations

from pathlib import Path

from app.machining import occ

KERNEL = occ.kernel_available()

if KERNEL:  # pragma: no branch - import guard
    import importlib

    _ROOT = "OCP" if occ.kernel_name() == "OCP" else "OCC.Core"

    def _mod(name: str):
        return importlib.import_module(f"{_ROOT}.{name}")

    _prim = _mod("BRepPrimAPI")
    _algo = _mod("BRepAlgoAPI")
    _fillet = _mod("BRepFilletAPI")
    _gp = _mod("gp")
    _step = _mod("STEPControl")
    _explorer = _mod("TopExp")
    _abs = _mod("TopAbs")
    _builder = _mod("BRepBuilderAPI")
    _gc = _mod("GC")


def _write_step(shape, path: Path) -> str:
    writer = _step.STEPControl_Writer()
    writer.Transfer(shape, _step.STEPControl_StepModelType.STEPControl_AsIs)
    writer.Write(str(path))
    return str(path)


def _box(x: float, y: float, z: float, dx: float, dy: float, dz: float):
    return _prim.BRepPrimAPI_MakeBox(_gp.gp_Pnt(x, y, z), dx, dy, dz).Shape()


def _cylinder(x: float, y: float, z: float, radius: float, height: float, axis=(0, 0, 1)):
    frame = _gp.gp_Ax2(_gp.gp_Pnt(x, y, z), _gp.gp_Dir(*axis))
    return _prim.BRepPrimAPI_MakeCylinder(frame, radius, height).Shape()


def _cut(base, tool):
    return _algo.BRepAlgoAPI_Cut(base, tool).Shape()


def _fuse(a, b):
    return _algo.BRepAlgoAPI_Fuse(a, b).Shape()


def _edges(shape):
    edges = []
    explorer = _explorer.TopExp_Explorer(shape, _abs.TopAbs_ShapeEnum.TopAbs_EDGE)
    while explorer.More():
        edges.append(occ.to_edge(explorer.Current()))
        explorer.Next()
    return edges


def _fillet_edge_near(shape, radius: float, predicate):
    """Fillet the first edge in ``shape`` for which ``predicate(edge)`` is True.

    Falls back to the unfilleted shape if OCCT refuses the fillet (e.g. the
    matched edge sits on a non-manifold face-to-face contact rather than a
    clean two-face dihedral edge) - callers that only need the sheet-metal
    candidate/thickness evidence (uniform wall thickness, paired planar
    faces) still get a usable fixture even without the corner rounded; only
    a future bend-detection test would need the fillet to actually apply.
    """
    maker = _fillet.BRepFilletAPI_MakeFillet(shape)
    added = 0
    for edge in _edges(shape):
        try:
            curve = occ.BRepAdaptor_Curve(edge)
            start = curve.Value(curve.FirstParameter())
            end = curve.Value(curve.LastParameter())
        except Exception:
            continue
        if predicate(start, end):
            maker.Add(radius, edge)
            added += 1
            break  # only the first matching edge - see docstring
    if not added:
        return shape
    try:
        return maker.Shape()
    except Exception:
        return shape


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def single_bend_l_bracket(tmp_path: Path) -> str:
    """An L-bracket: two 2 mm thick plates joined by one bend.

    Modelled as a single 2 mm thick block bent through a filleted corner:

    * Base leg: 80 x 60 x 2 mm, lying flat in the XY plane (Z in [0, 2]).
    * Upright leg: 60 x 40 x 2 mm, standing up from the far edge of the base
      leg along Y so the two legs meet at a shared 60 mm edge (X in [0, 60]).
    * The inside corner edge (running along X at Y=60, Z=0..2) is filleted
      with a 3 mm radius - small relative to the envelope but well above the
      2 mm wall thickness, approximating a single ~90 degree press-brake bend
      with an inner bend radius of 3 mm.

    Expected once bend detection ships: exactly one bend, angle ~90 deg,
    inner_radius_mm ~3.0, uniform thickness ~2.0 mm.
    """
    thickness = 2.0
    base = _box(0, 0, 0, 80, 60, thickness)
    upright = _box(0, 60, 0, 60, thickness, 40)
    shape = _fuse(base, upright)

    def _is_inner_corner_edge(start, end) -> bool:
        # The shared edge between the two legs runs along X in [0, 60] at
        # Y=60, Z=0. The X bound matters: without it this predicate also
        # matches the base plate's own leftover top edge from X=60..80 (the
        # part of the base not covered by the upright), which is not a real
        # bend edge and fails to fillet (BRep_API: command not done).
        return (
            abs(start.Y() - 60.0) < 1e-6
            and abs(end.Y() - 60.0) < 1e-6
            and abs(start.Z()) < 1e-6
            and abs(end.Z()) < 1e-6
            and max(start.X(), end.X()) <= 60.0 + 1e-6
        )

    shape = _fillet_edge_near(shape, radius=3.0, predicate=_is_inner_corner_edge)
    return _write_step(shape, tmp_path / "single_bend_l_bracket.step")


def swept_l_bracket_bend(tmp_path: Path) -> str:
    """An L-bracket built from an explicit 2D profile + prism, not a fillet.

    ``single_bend_l_bracket`` builds its corner via ``BRepFilletAPI_MakeFillet``
    on a fused box pair, which - per that fixture's own docstring - silently
    falls back to the sharp, unfilleted shape on kernels/geometry where OCCT
    refuses the fillet (confirmed happening in this environment: the fillet
    add is a no-op here, so that fixture has zero cylindrical faces and is
    unusable for bend-detection assertions). This fixture instead constructs
    the swept cross-section directly - two concentric circular arcs (radius
    3 mm inner, 5 mm outer = inner + 2 mm sheet thickness) connecting a
    60 mm base leg and a 40 mm upright leg - so the resulting solid is
    *guaranteed* to have exactly one concave (inner) and one convex (outer)
    cylindrical bend face, independent of any fillet-operation success.

    Cross-section is drawn in the X=0 plane (Y, Z) and extruded 60 mm along
    +X, so the bend axis is the X axis - matching the coordinate convention
    used by :mod:`app.sheet_metal.detectors.bends`' axis-parallel-edge check.

    Expected once bend detection ships: exactly one bend (from the concave
    inner arc only - the convex outer arc bridges the same two flanges and
    is deliberately not double-counted), angle ~90 deg, inner_radius_mm
    ~3.0, uniform thickness ~2.0 mm.
    """
    import math

    thickness = 2.0
    inner_r = 3.0
    outer_r = inner_r + thickness
    base_len = 60.0
    upright_len = 40.0
    extrude_len = 60.0
    # Concentric arc center, chosen so the outer arc's bottom tangent point
    # sits at Z=0 and the inner arc's bottom tangent point sits at Z=thickness.
    center_z = outer_r

    def _pnt(y: float, z: float):
        return _gp.gp_Pnt(0.0, y, z)

    def _arc_point(radius: float, theta_deg: float):
        theta = math.radians(theta_deg)
        y = -radius * math.sin(theta)
        z = center_z - radius * math.cos(theta)
        return _pnt(y, z)

    p1 = _pnt(-base_len, 0.0)
    p2 = _arc_point(outer_r, 0.0)
    p2m = _arc_point(outer_r, 45.0)
    p3 = _arc_point(outer_r, 90.0)
    p4 = _pnt(p3.Y(), p3.Z() + upright_len)
    p5 = _pnt(p4.Y() + thickness, p4.Z())
    p6 = _arc_point(inner_r, 90.0)
    p6m = _arc_point(inner_r, 45.0)
    p7 = _arc_point(inner_r, 0.0)
    p8 = _pnt(-base_len, p7.Z())

    def _line_edge(a, b):
        return _builder.BRepBuilderAPI_MakeEdge(a, b).Edge()

    def _arc_edge(a, m, b):
        curve = _gc.GC_MakeArcOfCircle(a, m, b).Value()
        return _builder.BRepBuilderAPI_MakeEdge(curve).Edge()

    edges = [
        _line_edge(p1, p2),
        _arc_edge(p2, p2m, p3),
        _line_edge(p3, p4),
        _line_edge(p4, p5),
        _line_edge(p5, p6),
        _arc_edge(p6, p6m, p7),
        _line_edge(p7, p8),
        _line_edge(p8, p1),
    ]

    wire_maker = _builder.BRepBuilderAPI_MakeWire()
    for edge in edges:
        wire_maker.Add(edge)
    wire = wire_maker.Wire()
    face = _builder.BRepBuilderAPI_MakeFace(wire).Face()
    shape = _prim.BRepPrimAPI_MakePrism(face, _gp.gp_Vec(extrude_len, 0.0, 0.0)).Shape()
    return _write_step(shape, tmp_path / "swept_l_bracket_bend.step")


def flat_plate_with_holes(tmp_path: Path) -> str:
    """A flat 150 x 100 x 1.5 mm plate with three through holes, no bends.

    Thickness is 1.5 mm - inside the sheet-metal candidate window
    (0.4 - 6.0 mm). Three 8 mm through holes sit on a line 25 mm in from one
    long edge, spaced 50 mm apart, so hole detection has more than one
    feature to find and a clean distance-to-edge to check once that detector
    ships.
    """
    thickness = 1.5
    shape = _box(0, 0, 0, 150, 100, thickness)
    for x in (25.0, 75.0, 125.0):
        shape = _cut(shape, _cylinder(x, 25.0, -1.0, 4.0, thickness + 2.0))
    return _write_step(shape, tmp_path / "flat_plate_with_holes.step")


def solid_block_non_candidate(tmp_path: Path) -> str:
    """A 60 x 60 x 40 mm solid block - not a sheet-metal candidate.

    Thickness (the smallest extent, 40 mm) is far above
    ``max_sheet_thickness_mm`` (6.0 mm default) and the block has no pair of
    parallel faces separated by a thin, uniform wall - it is solid stock, not
    a formed sheet part. Used to validate candidate-rejection once
    ``detectors/sheet_candidate.py`` ships.
    """
    shape = _box(0, 0, 0, 60, 60, 40)
    return _write_step(shape, tmp_path / "solid_block_non_candidate.step")


def flat_plate_with_rectangular_cutout(tmp_path: Path) -> str:
    """A flat 150 x 100 x 1.5 mm plate with one rectangular through-cutout.

    The cutout is a 30 x 15 mm rectangular window centred at (75, 50), cut
    all the way through the 1.5 mm sheet - a non-circular pierced profile for
    ``detectors/cutouts.py`` to find (its inner loop is four straight edges,
    not a circle, so it must not be picked up by ``detectors/holes.py``).
    """
    thickness = 1.5
    shape = _box(0, 0, 0, 150, 100, thickness)
    cutout = _box(60.0, 42.5, -1.0, 30.0, 15.0, thickness + 2.0)
    shape = _cut(shape, cutout)
    return _write_step(shape, tmp_path / "flat_plate_with_rectangular_cutout.step")


def flat_plate_with_slot(tmp_path: Path) -> str:
    """A flat 150 x 100 x 1.5 mm plate with one rounded-end through-slot.

    The slot is built from a 30 x 10 mm rectangular body plus two 5 mm-radius
    end caps (so overall length ~40 mm, width 10 mm), centred at (75, 50) and
    running along X - an elongated pierced profile with rounded ends for
    ``detectors/slots.py`` to find (length/width aspect ratio 4:1, well above
    the slot classification threshold).
    """
    thickness = 1.5
    shape = _box(0, 0, 0, 150, 100, thickness)
    body = _box(60.0, 45.0, -1.0, 30.0, 10.0, thickness + 2.0)
    cap_a = _cylinder(60.0, 50.0, -1.0, 5.0, thickness + 2.0)
    cap_b = _cylinder(90.0, 50.0, -1.0, 5.0, thickness + 2.0)
    tool = _fuse(_fuse(body, cap_a), cap_b)
    shape = _cut(shape, tool)
    return _write_step(shape, tmp_path / "flat_plate_with_slot.step")


ALL_FIXTURES = (
    single_bend_l_bracket,
    swept_l_bracket_bend,
    flat_plate_with_holes,
    solid_block_non_candidate,
    flat_plate_with_rectangular_cutout,
    flat_plate_with_slot,
)
