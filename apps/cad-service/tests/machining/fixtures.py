"""Representative STEP fixtures, built with the CAD kernel at test time.

Generating the parts rather than committing binary STEP files keeps the repo
free of opaque blobs and makes each fixture's intent readable: the expected
feature counts follow directly from the construction below.

Every builder returns a path to a STEP file inside ``tmp_path``. If no kernel is
installed the module-level :data:`KERNEL` flag is False and the tests that need
these fixtures skip.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import List, Optional, Tuple

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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def simple_block_with_through_hole(tmp_path: Path) -> str:
    """100 x 60 x 20 block, one 10 mm through hole on the Z axis.

    Expected: volume 120000 - pi*25*20, one through hole, six planar faces plus
    one internal cylinder.
    """
    shape = _cut(_box(0, 0, 0, 100, 60, 20), _cylinder(30, 30, -5, 5.0, 30.0))
    return _write_step(shape, tmp_path / "simple_block_with_through_hole.step")


def block_with_blind_hole(tmp_path: Path) -> str:
    """Blind hole 12 mm deep in a 60 x 60 x 25 block - flat bottom."""
    shape = _cut(_box(0, 0, 0, 60, 60, 25), _cylinder(30, 30, 13, 4.0, 20.0))
    return _write_step(shape, tmp_path / "block_with_blind_hole.step")


def plate_with_hole_pattern(tmp_path: Path) -> str:
    """120 x 120 x 12 plate with four identical 6 mm through holes.

    The holes sit on the corners of a 60 mm square, so they are both a
    rectangular arrangement and a circle about the plate centre.
    """
    shape = _box(0, 0, 0, 120, 120, 12)
    for x, y in ((30, 30), (90, 30), (30, 90), (90, 90)):
        shape = _cut(shape, _cylinder(x, y, -5, 3.0, 25.0))
    return _write_step(shape, tmp_path / "plate_with_hole_pattern.step")


def block_with_pocket(tmp_path: Path) -> str:
    """100 x 60 x 25 block with one open-top rectangular pocket 8 mm deep."""
    shape = _cut(_box(0, 0, 0, 100, 60, 25), _box(25, 18, 17, 50, 25, 20))
    return _write_step(shape, tmp_path / "block_with_pocket.step")


def block_with_slot(tmp_path: Path) -> str:
    """100 x 60 x 25 block with a long narrow channel - aspect ratio 8:1."""
    shape = _cut(_box(0, 0, 0, 100, 60, 25), _box(20, 26, 20, 64, 8, 12))
    return _write_step(shape, tmp_path / "block_with_slot.step")


def block_with_counterbored_hole(tmp_path: Path) -> str:
    """6 mm through hole with a 12 mm counterbore 5 mm deep at the top face."""
    shape = _box(0, 0, 0, 60, 60, 30)
    shape = _cut(shape, _cylinder(30, 30, -5, 3.0, 45.0))
    shape = _cut(shape, _cylinder(30, 30, 25, 6.0, 10.0))
    return _write_step(shape, tmp_path / "block_with_counterbored_hole.step")


def plate_with_boss(tmp_path: Path) -> str:
    """80 x 80 x 10 plate with a 30 mm diameter, 12 mm tall cylindrical boss."""
    shape = _fuse(_box(0, 0, 0, 80, 80, 10), _cylinder(40, 40, 10, 15.0, 12.0))
    return _write_step(shape, tmp_path / "plate_with_boss.step")


def filleted_block(tmp_path: Path) -> str:
    """60 x 40 x 20 block with every vertical edge filleted R5."""
    box = _box(0, 0, 0, 60, 40, 20)
    maker = _fillet.BRepFilletAPI_MakeFillet(box)

    explorer = _explorer.TopExp_Explorer(box, _abs.TopAbs_ShapeEnum.TopAbs_EDGE)
    added = 0
    while explorer.More():
        edge = occ.to_edge(explorer.Current())
        if _is_vertical_edge(edge):
            maker.Add(5.0, edge)
            added += 1
        explorer.Next()
    shape = maker.Shape() if added else box
    return _write_step(shape, tmp_path / "filleted_block.step")


def _is_vertical_edge(edge) -> bool:
    """True for a straight edge running along Z."""
    try:
        curve = occ.BRepAdaptor_Curve(edge)
        if curve.GetType() != occ.GeomAbs_Line:
            return False
        start = curve.Value(curve.FirstParameter())
        end = curve.Value(curve.LastParameter())
        dz = abs(end.Z() - start.Z())
        dxy = math.hypot(end.X() - start.X(), end.Y() - start.Y())
        return dz > 1e-6 and dxy < 1e-6
    except Exception:
        return False


def block_with_hole_split_into_arcs(tmp_path: Path) -> str:
    """A through hole whose wall is broken into two arcs, each under 180 deg.

    A 20 mm bore runs through a 100 x 60 x 40 block. Two channels, one on each
    side, cut from the outside into the bore across a 10 mm band centred on the
    axis. Each channel removes a 60 deg wedge of bore wall over the full depth,
    leaving two surviving arcs of about 120 deg.

    Neither arc reaches the 180 deg wrap threshold on its own, so a per-face
    test discards both and loses the hole entirely. Summing the fragments of the
    segment gives ~240 deg and recovers it.
    """
    shape = _cut(_box(0, 0, 0, 100, 60, 40), _cylinder(50, 30, -5, 10.0, 50.0))
    # +Y channel: |x - 50| <= 5 spans the arc from 60 deg to 120 deg.
    shape = _cut(shape, _box(45, 30, -5, 10, 40, 50))
    # -Y channel: the mirror image.
    shape = _cut(shape, _box(45, -10, -5, 10, 40, 50))
    return _write_step(shape, tmp_path / "block_with_hole_split_into_arcs.step")


def two_body_assembly(tmp_path: Path) -> str:
    """Two disjoint solids in one file - must produce a MULTIPLE_SOLIDS warning."""
    compound = _fuse(_box(0, 0, 0, 20, 20, 20), _box(50, 0, 0, 20, 20, 20))
    return _write_step(compound, tmp_path / "two_body_assembly.step")


def deep_hole_block(tmp_path: Path) -> str:
    """4 mm hole, 48 mm deep - depth/diameter 12, above both deep-hole limits."""
    shape = _cut(_box(0, 0, 0, 40, 40, 50), _cylinder(20, 20, 2, 2.0, 60.0))
    return _write_step(shape, tmp_path / "deep_hole_block.step")


ALL_FIXTURES = (
    simple_block_with_through_hole,
    block_with_blind_hole,
    plate_with_hole_pattern,
    block_with_pocket,
    block_with_slot,
    block_with_counterbored_hole,
    plate_with_boss,
    filleted_block,
    block_with_hole_split_into_arcs,
    two_body_assembly,
    deep_hole_block,
)
