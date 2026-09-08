"""Phase 4 tests: hole, cutout, slot and hem detectors.

Unit tests exercise the detector functions directly against synthetic
``ShapeModel``/``FaceRecord``/``EdgeRecord`` objects (no CAD kernel
required). Integration tests run the full ``analyze_sheet_metal()`` pipeline
against real STEP fixtures and require the OCC kernel (``requires_kernel``),
mirroring ``test_analysis_units.py``/``test_bends_units.py``'s convention.
"""

from __future__ import annotations

import math

from app.machining.records import CYLINDER, PLANE, EdgeRecord, FaceRecord, ShapeModel
from app.sheet_metal.config import SheetMetalConfig
from app.sheet_metal.detectors.cutouts import (
    detect_cutouts,
    face_loops,
    inner_profile_loops,
    is_slot_like,
    profile_metrics,
)
from app.sheet_metal.detectors.hems import detect_hems
from app.sheet_metal.detectors.holes import detect_holes
from app.sheet_metal.detectors.slots import detect_slots
from app.sheet_metal.schemas import Cutout, Hem, SheetMetalHole, SheetMetalSlot

from . import fixtures
from .conftest import requires_kernel

CONFIG = SheetMetalConfig()


# ---------------------------------------------------------------------------
# Synthetic ShapeModel builders
# ---------------------------------------------------------------------------


def _hole_model(count: int = 1, radius: float = 4.0, wrap: float = 360.0) -> ShapeModel:
    """A flat plate with ``count`` coaxial-distinct internal cylindrical holes."""
    faces = {}
    for i in range(count):
        cx = 25.0 + i * 50.0
        faces[i + 1] = FaceRecord(
            id=i + 1,
            surface_type=CYLINDER,
            area_mm2=2 * math.pi * radius * 1.5,
            bbox_min=(cx - radius, 25.0 - radius, -1.0),
            bbox_max=(cx + radius, 25.0 + radius, 2.5),
            centroid=(cx, 25.0, 0.75),
            axis=(0.0, 0.0, 1.0),
            axis_location=(cx, 25.0, -1.0),
            radius_mm=radius,
            angular_span_deg=wrap,
            axial_extent_mm=1.5,
            is_internal=True,
        )
    return ShapeModel(faces=faces, bbox_min=(0, 0, -1), bbox_max=(150, 100, 2.5))


def _rect_cutout_face() -> tuple[ShapeModel, FaceRecord]:
    """One planar face (the top skin of a plate) with an outer boundary loop
    plus one rectangular inner loop (a cutout), built directly from
    ``EdgeRecord``s so the loop-chaining logic can be unit-tested precisely.
    """
    # Outer boundary: 150 x 100 rectangle.
    outer_pts = [(0, 0, 0), (150, 0, 0), (150, 100, 0), (0, 100, 0)]
    outer_edges = {}
    for i in range(4):
        a, b = outer_pts[i], outer_pts[(i + 1) % 4]
        eid = 100 + i
        outer_edges[eid] = EdgeRecord(
            id=eid,
            curve_type="LINE",
            length_mm=math.dist(a, b),
            start=a,
            end=b,
            midpoint=tuple((a[j] + b[j]) / 2 for j in range(3)),
            face_ids=[1],
        )

    # Inner cutout: 30 x 15 rectangle centred at (75, 50).
    inner_pts = [(60, 42.5, 0), (90, 42.5, 0), (90, 57.5, 0), (60, 57.5, 0)]
    inner_edges = {}
    for i in range(4):
        a, b = inner_pts[i], inner_pts[(i + 1) % 4]
        eid = 200 + i
        inner_edges[eid] = EdgeRecord(
            id=eid,
            curve_type="LINE",
            length_mm=math.dist(a, b),
            start=a,
            end=b,
            midpoint=tuple((a[j] + b[j]) / 2 for j in range(3)),
            face_ids=[1],
        )

    all_edges = {**outer_edges, **inner_edges}
    face = FaceRecord(
        id=1,
        surface_type=PLANE,
        area_mm2=150.0 * 100.0 - 30.0 * 15.0,
        bbox_min=(0, 0, 0),
        bbox_max=(150, 100, 0),
        centroid=(75, 50, 0),
        normal=(0.0, 0.0, 1.0),
        edge_ids=sorted(all_edges.keys()),
    )
    model = ShapeModel(faces={1: face}, edges=all_edges, bbox_min=(0, 0, 0), bbox_max=(150, 100, 1.5))
    return model, face


def _slot_face() -> tuple[ShapeModel, FaceRecord]:
    """A planar face with one elongated inner loop with two rounded ends."""
    outer_pts = [(0, 0, 0), (150, 0, 0), (150, 100, 0), (0, 100, 0)]
    outer_edges = {}
    for i in range(4):
        a, b = outer_pts[i], outer_pts[(i + 1) % 4]
        eid = 100 + i
        outer_edges[eid] = EdgeRecord(
            id=eid,
            curve_type="LINE",
            length_mm=math.dist(a, b),
            start=a,
            end=b,
            midpoint=tuple((a[j] + b[j]) / 2 for j in range(3)),
            face_ids=[1],
        )

    # Slot: straight top/bottom edges (length 30, width 10) plus two
    # half-circle arc ends (radius 5) - length ~40, width 10, aspect ratio 4.
    top = (60.0, 55.0, 0.0)
    top2 = (90.0, 55.0, 0.0)
    bottom2 = (90.0, 45.0, 0.0)
    bottom = (60.0, 45.0, 0.0)
    slot_edges = {
        201: EdgeRecord(
            id=201, curve_type="LINE", length_mm=30.0, start=top, end=top2,
            midpoint=(75.0, 55.0, 0.0), face_ids=[1],
        ),
        202: EdgeRecord(
            id=202, curve_type="CIRCLE", length_mm=math.pi * 5.0, radius_mm=5.0,
            start=top2, end=bottom2, midpoint=(95.0, 50.0, 0.0), face_ids=[1],
        ),
        203: EdgeRecord(
            id=203, curve_type="LINE", length_mm=30.0, start=bottom2, end=bottom,
            midpoint=(75.0, 45.0, 0.0), face_ids=[1],
        ),
        204: EdgeRecord(
            id=204, curve_type="CIRCLE", length_mm=math.pi * 5.0, radius_mm=5.0,
            start=bottom, end=top, midpoint=(55.0, 50.0, 0.0), face_ids=[1],
        ),
    }

    all_edges = {**outer_edges, **slot_edges}
    face = FaceRecord(
        id=1,
        surface_type=PLANE,
        area_mm2=150.0 * 100.0,
        bbox_min=(0, 0, 0),
        bbox_max=(150, 100, 0),
        centroid=(75, 50, 0),
        normal=(0.0, 0.0, 1.0),
        edge_ids=sorted(all_edges.keys()),
    )
    model = ShapeModel(faces={1: face}, edges=all_edges, bbox_min=(0, 0, 0), bbox_max=(150, 100, 1.5))
    return model, face


def _single_neighbor_hem_model(radius: float = 1.0, wrap: float = 350.0) -> ShapeModel:
    """One flange face joined to a tight-radius cylinder with no second flange."""
    flange = FaceRecord(
        id=1,
        surface_type=PLANE,
        area_mm2=100.0 * 50.0,
        bbox_min=(0, 0, 0),
        bbox_max=(100, 50, 0),
        centroid=(50, 25, 0),
        normal=(0.0, 0.0, 1.0),
    )
    cyl = FaceRecord(
        id=2,
        surface_type=CYLINDER,
        area_mm2=2 * math.pi * radius * 100.0,
        bbox_min=(0, 48, 0),
        bbox_max=(100, 50 + 2 * radius, 2 * radius),
        centroid=(50, 50 + radius, radius),
        axis=(1.0, 0.0, 0.0),
        axis_location=(0.0, 50.0, radius),
        radius_mm=radius,
        angular_span_deg=wrap,
        axial_extent_mm=100.0,
        is_internal=True,
    )
    return ShapeModel(
        faces={1: flange, 2: cyl},
        bbox_min=(0, 0, 0),
        bbox_max=(100, 50 + 2 * radius, 2 * radius),
        face_neighbors={1: {2}, 2: {1}},
    )


def _two_neighbor_bend_model(radius: float = 3.0, wrap: float = 90.0) -> ShapeModel:
    """A cylinder with two planar neighbours - must NOT be reported as a hem."""
    flange_a = FaceRecord(
        id=1, surface_type=PLANE, area_mm2=100 * 50, bbox_min=(0, 0, 0),
        bbox_max=(100, 50, 0), centroid=(50, 25, 0), normal=(0.0, 0.0, 1.0),
    )
    flange_b = FaceRecord(
        id=2, surface_type=PLANE, area_mm2=100 * 50, bbox_min=(0, 50, 0),
        bbox_max=(100, 50, 50), centroid=(50, 50, 25), normal=(0.0, 1.0, 0.0),
    )
    cyl = FaceRecord(
        id=3, surface_type=CYLINDER, area_mm2=100 * radius * math.radians(wrap),
        bbox_min=(0, 49, 0), bbox_max=(100, 51, radius), centroid=(50, 50, radius),
        axis=(1.0, 0.0, 0.0), axis_location=(0.0, 50.0, radius), radius_mm=radius,
        angular_span_deg=wrap, axial_extent_mm=100.0, is_internal=True,
    )
    return ShapeModel(
        faces={1: flange_a, 2: flange_b, 3: cyl},
        bbox_min=(0, 0, 0), bbox_max=(100, 50, 50),
        face_neighbors={1: {3}, 2: {3}, 3: {1, 2}},
    )


# ---------------------------------------------------------------------------
# Unit tests: holes
# ---------------------------------------------------------------------------


def test_detect_holes_finds_full_circle_group():
    model = _hole_model(count=3, radius=4.0)
    holes = detect_holes(model, CONFIG)
    assert len(holes) == 3
    for hole in holes:
        assert isinstance(hole, SheetMetalHole)
        assert hole.diameter_mm == 8.0
        assert hole.shape == "round"
        assert hole.quantity == 1
        assert hole.distance_to_nearest_edge_mm is None
        assert hole.distance_to_nearest_bend_mm is None


def test_detect_holes_rejects_partial_wrap():
    model = _hole_model(count=1, radius=4.0, wrap=120.0)
    assert detect_holes(model, CONFIG) == []


def test_detect_holes_no_cylinders_returns_empty():
    plate = FaceRecord(
        id=1, surface_type=PLANE, area_mm2=150 * 100, bbox_min=(0, 0, 0),
        bbox_max=(150, 100, 1.5), centroid=(75, 50, 0.75), normal=(0, 0, 1),
    )
    model = ShapeModel(faces={1: plate}, bbox_min=(0, 0, 0), bbox_max=(150, 100, 1.5))
    assert detect_holes(model, CONFIG) == []


# ---------------------------------------------------------------------------
# Unit tests: loop reconstruction + cutouts
# ---------------------------------------------------------------------------


def test_face_loops_splits_outer_and_inner():
    model, face = _rect_cutout_face()
    loops = face_loops(model, face)
    assert len(loops) == 2
    inner = inner_profile_loops(model, face)
    assert len(inner) == 1
    assert len(inner[0]) == 4


def test_profile_metrics_rectangle_area_and_perimeter():
    model, face = _rect_cutout_face()
    inner = inner_profile_loops(model, face)[0]
    perimeter, area, extent_long, extent_short, _ = profile_metrics(face, inner)
    assert abs(perimeter - (2 * 30.0 + 2 * 15.0)) < 1e-6
    assert abs(area - (30.0 * 15.0)) < 1e-6
    assert abs(extent_long - 30.0) < 1e-6
    assert abs(extent_short - 15.0) < 1e-6


def test_detect_cutouts_finds_rectangular_profile():
    model, _face = _rect_cutout_face()
    cutouts = detect_cutouts(model, CONFIG)
    assert len(cutouts) == 1
    cutout = cutouts[0]
    assert isinstance(cutout, Cutout)
    assert cutout.shape_type == "rectangular"
    assert abs(cutout.area_mm2 - 450.0) < 0.5
    assert abs(cutout.min_feature_size_mm - 15.0) < 0.5
    assert cutout.distance_to_nearest_edge_mm is None


def test_detect_cutouts_ignores_slot_like_profiles():
    model, _face = _slot_face()
    assert detect_cutouts(model, CONFIG) == []


def test_detect_cutouts_no_edges_returns_empty():
    model = _hole_model(count=0)
    assert detect_cutouts(model, CONFIG) == []


# ---------------------------------------------------------------------------
# Unit tests: slots
# ---------------------------------------------------------------------------


def test_is_slot_like_true_for_elongated_rounded_profile():
    model, face = _slot_face()
    inner = inner_profile_loops(model, face)[0]
    assert is_slot_like(face, inner, CONFIG) is True


def test_is_slot_like_false_for_square_profile():
    model, face = _rect_cutout_face()
    inner = inner_profile_loops(model, face)[0]
    assert is_slot_like(face, inner, CONFIG) is False


def test_detect_slots_finds_elongated_rounded_profile():
    model, _face = _slot_face()
    slots = detect_slots(model, CONFIG)
    assert len(slots) == 1
    slot = slots[0]
    assert isinstance(slot, SheetMetalSlot)
    assert abs(slot.length_mm - 40.0) < 0.5
    assert abs(slot.width_mm - 10.0) < 0.5
    assert slot.corner_radius_mm is not None
    assert abs(slot.corner_radius_mm - 5.0) < 1e-6
    assert slot.distance_to_nearest_bend_mm is None


def test_detect_slots_no_slot_present_returns_empty():
    model, _face = _rect_cutout_face()
    assert detect_slots(model, CONFIG) == []


# ---------------------------------------------------------------------------
# Unit tests: hems (heuristic)
# ---------------------------------------------------------------------------


def test_detect_hems_finds_tight_radius_single_neighbor_fold():
    model = _single_neighbor_hem_model(radius=1.0, wrap=350.0)
    hems = detect_hems(model, CONFIG, thickness_mm=1.5)
    assert len(hems) == 1
    hem = hems[0]
    assert isinstance(hem, Hem)
    assert hem.type == "closed"
    assert hem.adjacent_flange_id == "1"


def test_detect_hems_classifies_open_and_teardrop():
    open_model = _single_neighbor_hem_model(radius=1.0, wrap=180.0)
    assert detect_hems(open_model, CONFIG, thickness_mm=1.5)[0].type == "open"

    teardrop_model = _single_neighbor_hem_model(radius=1.0, wrap=260.0)
    assert detect_hems(teardrop_model, CONFIG, thickness_mm=1.5)[0].type == "teardrop"


def test_detect_hems_does_not_claim_a_two_flange_bend():
    model = _two_neighbor_bend_model(radius=3.0, wrap=90.0)
    assert detect_hems(model, CONFIG, thickness_mm=2.0) == []


def test_detect_hems_rejects_large_radius_relative_to_thickness():
    # radius 5mm is well above 1.5x a 1.5mm sheet thickness.
    model = _single_neighbor_hem_model(radius=5.0, wrap=350.0)
    assert detect_hems(model, CONFIG, thickness_mm=1.5) == []


def test_detect_hems_no_cylinders_returns_empty():
    model = _hole_model(count=0)
    assert detect_hems(model, CONFIG, thickness_mm=1.5) == []


# ---------------------------------------------------------------------------
# Integration tests against real STEP fixtures (kernel required)
# ---------------------------------------------------------------------------


@requires_kernel
def test_flat_plate_with_holes_fixture_reports_three_holes(analyze, step_dir):
    step_path = fixtures.flat_plate_with_holes(step_dir)
    payload = analyze(step_path)

    holes = payload["holes"]
    assert len(holes) == 3
    diameters = sorted(h["diameter_mm"] for h in holes)
    for d in diameters:
        assert abs(d - 8.0) <= 0.2
    assert payload["cutouts"] == []
    assert payload["slots"] == []


@requires_kernel
def test_flat_plate_with_rectangular_cutout_fixture(analyze, step_dir):
    step_path = fixtures.flat_plate_with_rectangular_cutout(step_dir)
    payload = analyze(step_path)

    assert payload["holes"] == []
    cutouts = payload["cutouts"]
    assert len(cutouts) >= 1
    cutout = cutouts[0]
    assert cutout["shape_type"] in ("rectangular", "polygonal", "irregular")
    assert cutout["area_mm2"] > 0
    assert cutout["perimeter_mm"] > 0


@requires_kernel
def test_flat_plate_with_slot_fixture(analyze, step_dir):
    step_path = fixtures.flat_plate_with_slot(step_dir)
    payload = analyze(step_path)

    slots = payload["slots"]
    assert len(slots) >= 1
    slot = slots[0]
    assert slot["length_mm"] > slot["width_mm"]
    assert slot["width_mm"] > 0


@requires_kernel
def test_swept_l_bracket_bend_fixture_hems_run_without_crashing(analyze, step_dir):
    # No dedicated hem fixture exists yet (see hems.py's documented
    # limitations); this just confirms the stage runs cleanly end-to-end on
    # real kernel geometry and always returns a list.
    step_path = fixtures.swept_l_bracket_bend(step_dir)
    payload = analyze(step_path)
    assert isinstance(payload["hems"], list)
