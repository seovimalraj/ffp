"""Phase 5 tests: outer profile, distance checks, patterns/symmetry, complexity.

Unit tests exercise the new modules directly against synthetic
``ShapeModel``/``FaceRecord``/``EdgeRecord`` objects and schema records (no
CAD kernel required). Integration tests run the full ``analyze_sheet_metal()``
pipeline end-to-end against real STEP fixtures (``requires_kernel``),
mirroring ``test_holes_cutouts_units.py``'s convention.
"""

from __future__ import annotations

import math

import pytest

from app.machining.records import PLANE, EdgeRecord, FaceRecord, ShapeModel
from app.machining.schemas import Detection, DetectionMethod, InformationSource, Vector3
from app.sheet_metal.complexity import compute_complexity
from app.sheet_metal.config import SheetMetalConfig
from app.sheet_metal.detectors.profile import detect_outer_profile, select_outer_loop
from app.sheet_metal.distance_checks import compute_distance_checks
from app.sheet_metal.patterns import detect_patterns, detect_symmetry
from app.sheet_metal.schemas import (
    BendFeature,
    BendLine,
    Cutout,
    Hem,
    SheetMetalFaces,
    SheetMetalHole,
    SheetMetalSlot,
)

from . import fixtures
from .conftest import requires_kernel

CONFIG = SheetMetalConfig()


# ---------------------------------------------------------------------------
# Synthetic model builders
# ---------------------------------------------------------------------------


def _rect_plate_model() -> tuple[ShapeModel, SheetMetalFaces]:
    """A 150 x 100 flat plate face - outer boundary only, no inner loops."""
    pts = [(0, 0, 0), (150, 0, 0), (150, 100, 0), (0, 100, 0)]
    edges = {}
    for i in range(4):
        a, b = pts[i], pts[(i + 1) % 4]
        eid = i + 1
        edges[eid] = EdgeRecord(
            id=eid,
            curve_type="LINE",
            length_mm=math.dist(a, b),
            start=a,
            end=b,
            midpoint=tuple((a[j] + b[j]) / 2 for j in range(3)),
            face_ids=[1],
        )
    face = FaceRecord(
        id=1,
        surface_type=PLANE,
        area_mm2=150.0 * 100.0,
        bbox_min=(0, 0, 0),
        bbox_max=(150, 100, 0),
        centroid=(75, 50, 0),
        normal=(0.0, 0.0, 1.0),
        edge_ids=sorted(edges.keys()),
    )
    model = ShapeModel(faces={1: face}, edges=edges, bbox_min=(0, 0, 0), bbox_max=(150, 100, 1.5))
    faces = SheetMetalFaces(base_face_id=1, flange_faces=[])
    return model, faces


def _bend(id_: str, start, end, radius: float = 3.0) -> BendFeature:
    return BendFeature(
        id=id_,
        angle_deg=90.0,
        inner_radius_mm=radius,
        bend_line=BendLine(
            start=Vector3(x=start[0], y=start[1], z=start[2]),
            end=Vector3(x=end[0], y=end[1], z=end[2]),
        ),
        axis=Vector3(x=1.0, y=0.0, z=0.0),
        length_mm=math.dist(start, end),
        direction="down",
        sequence_hint=1,
        k_factor_assumed=0.44,
        adjacent_flange_ids=["1", "2"],
        detection=Detection(
            method=DetectionMethod.TOPOLOGY_AND_SURFACE,
            confidence=0.9,
            evidence=["synthetic"],
            source=InformationSource.GEOMETRY,
        ),
    )


def _hole(id_: str, position, diameter: float = 8.0) -> SheetMetalHole:
    return SheetMetalHole(
        id=id_,
        diameter_mm=diameter,
        position=Vector3(x=position[0], y=position[1], z=position[2]),
        shape="round",
        quantity=1,
    )


# ---------------------------------------------------------------------------
# Outer profile
# ---------------------------------------------------------------------------


def test_detect_outer_profile_closed_rectangle():
    model, faces = _rect_plate_model()
    profile = detect_outer_profile(model, CONFIG, faces)
    assert profile.is_closed is True
    assert abs(profile.perimeter_mm - (2 * 150 + 2 * 100)) < 1e-3
    assert profile.validity_issues == []


def test_detect_outer_profile_open_loop_flagged():
    model, faces = _rect_plate_model()
    # Drop the last edge so the chain no longer closes.
    face = model.faces[1]
    face.edge_ids = face.edge_ids[:-1]
    del model.edges[4]
    profile = detect_outer_profile(model, CONFIG, faces)
    assert profile.is_closed is False
    assert any(issue.code == "OPEN_LOOP" for issue in profile.validity_issues)


def test_detect_outer_profile_no_face_data_returns_none_perimeter():
    model = ShapeModel(faces={}, bbox_min=(0, 0, 0), bbox_max=(1, 1, 1))
    profile = detect_outer_profile(model, CONFIG, SheetMetalFaces())
    assert profile.perimeter_mm is None
    assert profile.is_closed is None
    assert any(issue.code == "NO_PROFILE_FACE" for issue in profile.validity_issues)


# ---------------------------------------------------------------------------
# Distance checks
# ---------------------------------------------------------------------------


def test_hole_close_to_edge_flags():
    model, faces = _rect_plate_model()
    # 1mm from the x=0 edge - well below the 2mm default minimum.
    hole = _hole("HOLE-001", (1.0, 50.0, 0.0))
    flags = compute_distance_checks(model, CONFIG, faces, [hole], [], [], [], None)
    assert hole.distance_to_nearest_edge_mm is not None
    assert hole.distance_to_nearest_edge_mm < CONFIG.min_hole_to_edge_distance_mm
    assert any(f.flag == "HOLE_TOO_CLOSE_TO_EDGE" for f in flags)


def test_hole_far_from_edge_does_not_flag():
    model, faces = _rect_plate_model()
    hole = _hole("HOLE-001", (75.0, 50.0, 0.0))  # dead centre, far from every edge
    flags = compute_distance_checks(model, CONFIG, faces, [hole], [], [], [], None)
    assert hole.distance_to_nearest_edge_mm is not None
    assert hole.distance_to_nearest_edge_mm >= CONFIG.min_hole_to_edge_distance_mm
    assert not any(f.flag == "HOLE_TOO_CLOSE_TO_EDGE" for f in flags)


def test_hole_close_to_bend_flags():
    model, faces = _rect_plate_model()
    bend = _bend("bend_1", (0.0, 50.0, 0.0), (150.0, 50.0, 0.0))
    hole = _hole("HOLE-001", (75.0, 51.0, 0.0))  # 1mm from the bend line
    flags = compute_distance_checks(model, CONFIG, faces, [hole], [], [], [bend], None)
    assert hole.distance_to_nearest_bend_mm is not None
    assert hole.distance_to_nearest_bend_mm < CONFIG.min_hole_to_bend_distance_mm
    assert any(f.flag == "HOLE_TOO_CLOSE_TO_BEND" for f in flags)


def test_hole_far_from_bend_does_not_flag():
    model, faces = _rect_plate_model()
    bend = _bend("bend_1", (0.0, 50.0, 0.0), (150.0, 50.0, 0.0))
    hole = _hole("HOLE-001", (75.0, 10.0, 0.0))  # 40mm from the bend line
    flags = compute_distance_checks(model, CONFIG, faces, [hole], [], [], [bend], None)
    assert hole.distance_to_nearest_bend_mm >= CONFIG.min_hole_to_bend_distance_mm
    assert not any(f.flag == "HOLE_TOO_CLOSE_TO_BEND" for f in flags)


def test_hole_below_min_feature_size_flags():
    model, faces = _rect_plate_model()
    hole = _hole("HOLE-001", (75.0, 50.0, 0.0), diameter=0.5)  # below 1.0mm default
    flags = compute_distance_checks(model, CONFIG, faces, [hole], [], [], [], None)
    assert any(f.flag == "FEATURE_BELOW_MIN_SIZE" for f in flags)


def test_bend_radius_too_tight_flags():
    model, faces = _rect_plate_model()
    bend = _bend("bend_1", (0.0, 50.0, 0.0), (150.0, 50.0, 0.0), radius=0.2)
    flags = compute_distance_checks(model, CONFIG, faces, [], [], [], [bend], 1.0)
    assert any(f.flag == "BEND_RADIUS_TOO_TIGHT" for f in flags)


def test_bend_radius_healthy_ratio_does_not_flag():
    model, faces = _rect_plate_model()
    bend = _bend("bend_1", (0.0, 50.0, 0.0), (150.0, 50.0, 0.0), radius=3.0)
    flags = compute_distance_checks(model, CONFIG, faces, [], [], [], [bend], 1.0)
    assert not any(f.flag == "BEND_RADIUS_TOO_TIGHT" for f in flags)


def test_cutout_min_feature_size_flags():
    model, faces = _rect_plate_model()
    cutout = Cutout(
        id="CUTOUT-001",
        perimeter_mm=10.0,
        area_mm2=1.0,
        shape_type="rectangular",
        min_feature_size_mm=0.3,
        position=Vector3(x=75.0, y=50.0, z=0.0),
    )
    flags = compute_distance_checks(model, CONFIG, faces, [], [cutout], [], [], None)
    assert any(f.flag == "FEATURE_BELOW_MIN_SIZE" and f.feature_type == "cutout" for f in flags)


def test_slot_below_min_width_flags():
    model, faces = _rect_plate_model()
    slot = SheetMetalSlot(
        id="SLOT-001",
        length_mm=20.0,
        width_mm=0.4,
        orientation=Vector3(x=1.0, y=0.0, z=0.0),
        position=Vector3(x=75.0, y=50.0, z=0.0),
    )
    flags = compute_distance_checks(model, CONFIG, faces, [], [], [slot], [], None)
    assert any(f.flag == "FEATURE_BELOW_MIN_SIZE" and f.feature_type == "slot" for f in flags)


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------


def test_detect_patterns_groups_identical_linear_holes():
    holes = [_hole(f"HOLE-{i:03d}", (25.0 + i * 50.0, 25.0, 0.0)) for i in range(3)]
    patterns = detect_patterns(holes, [], [], CONFIG)
    assert len(patterns) == 1
    pattern = patterns[0]
    assert pattern.feature_type == "hole"
    assert pattern.feature_count == 3
    assert pattern.pattern_type == "linear"
    assert pattern.spacing_mm is not None and abs(pattern.spacing_mm - 50.0) < 0.5


def test_detect_patterns_no_repeats_returns_empty():
    holes = [_hole("HOLE-001", (10.0, 10.0, 0.0)), _hole("HOLE-002", (20.0, 20.0, 0.0), diameter=12.0)]
    assert detect_patterns(holes, [], [], CONFIG) == []


# ---------------------------------------------------------------------------
# Symmetry
# ---------------------------------------------------------------------------


def test_detect_symmetry_rectangle_is_mirror_symmetric():
    model, faces = _rect_plate_model()
    symmetry = detect_symmetry(model, CONFIG, faces)
    assert symmetry.has_symmetry is True
    assert symmetry.symmetry_type == "mirror"


def test_detect_symmetry_no_profile_returns_false():
    model = ShapeModel(faces={}, bbox_min=(0, 0, 0), bbox_max=(1, 1, 1))
    symmetry = detect_symmetry(model, CONFIG, SheetMetalFaces())
    assert symmetry.has_symmetry is False
    assert symmetry.symmetry_type == "none"


def test_detect_symmetry_asymmetric_profile_returns_false():
    # An irregular quadrilateral with no mirror axis about its centroid.
    pts = [(0, 0, 0), (150, 0, 0), (140, 100, 0), (5, 90, 0)]
    edges = {}
    for i in range(4):
        a, b = pts[i], pts[(i + 1) % 4]
        eid = i + 1
        edges[eid] = EdgeRecord(
            id=eid, curve_type="LINE", length_mm=math.dist(a, b), start=a, end=b,
            midpoint=tuple((a[j] + b[j]) / 2 for j in range(3)), face_ids=[1],
        )
    face = FaceRecord(
        id=1, surface_type=PLANE, area_mm2=10000.0, bbox_min=(0, 0, 0), bbox_max=(150, 100, 0),
        centroid=(70, 50, 0), normal=(0.0, 0.0, 1.0), edge_ids=sorted(edges.keys()),
    )
    model = ShapeModel(faces={1: face}, edges=edges, bbox_min=(0, 0, 0), bbox_max=(150, 100, 1.5))
    symmetry = detect_symmetry(model, CONFIG, SheetMetalFaces(base_face_id=1))
    assert symmetry.has_symmetry is False


# ---------------------------------------------------------------------------
# Complexity
# ---------------------------------------------------------------------------


def test_compute_complexity_counts_and_minima():
    bends = [_bend("bend_1", (0, 50, 0), (150, 50, 0), radius=3.0)]
    holes = [_hole("HOLE-001", (10, 10, 0), diameter=8.0), _hole("HOLE-002", (20, 20, 0), diameter=8.0)]
    holes[0].distance_to_nearest_edge_mm = 5.0
    holes[1].distance_to_nearest_edge_mm = 2.5
    holes[0].distance_to_nearest_bend_mm = 12.0
    hems = [Hem(id="HEM-001", type="closed", length_mm=10.0, position=Vector3(x=0, y=0, z=0))]

    complexity = compute_complexity(bends, holes, [], [], hems)
    assert complexity.bend_count == 1
    assert complexity.hole_count == 2
    assert complexity.distinct_hole_diameter_count == 1
    assert complexity.hem_count == 1
    assert complexity.feature_count_total == 4
    assert complexity.minimum_bend_radius_mm == 3.0
    assert complexity.minimum_feature_to_edge_distance_mm == 2.5
    assert complexity.minimum_feature_to_bend_distance_mm == 12.0


def test_compute_complexity_empty_inputs():
    complexity = compute_complexity([], [], [], [], [])
    assert complexity.feature_count_total == 0
    assert complexity.minimum_bend_radius_mm is None
    assert complexity.minimum_feature_to_edge_distance_mm is None


# ---------------------------------------------------------------------------
# End-to-end pipeline (kernel required)
# ---------------------------------------------------------------------------


@requires_kernel
@pytest.mark.parametrize(
    "fixture_name",
    ["flat_plate_with_holes", "flat_plate_with_rectangular_cutout", "flat_plate_with_slot"],
)
def test_pipeline_runs_end_to_end_without_exceptions(analyze, step_dir, fixture_name):
    builder = getattr(fixtures, fixture_name)
    step_path = builder(step_dir)
    payload = analyze(step_path)

    assert payload["success"] is True
    assert "complexity_indicators" in payload
    ci = payload["complexity_indicators"]
    assert ci["feature_count_total"] >= 0
    assert isinstance(payload["distance_flags"], list)
    assert isinstance(payload["feature_patterns"], list)
    assert "symmetry" in payload
    assert "outer_profile" in payload
    assert "pmi" in payload


@requires_kernel
def test_pipeline_degrades_to_warning_on_stage_failure(analyze, step_dir, monkeypatch):
    """Breaking one detector's input should not fail the whole request."""
    import app.sheet_metal.service as service_module

    def _boom(*args, **kwargs):
        raise RuntimeError("synthetic detector failure")

    monkeypatch.setattr(service_module, "detect_outer_profile", _boom)

    step_path = fixtures.flat_plate_with_holes(step_dir)
    payload = analyze(step_path)

    assert payload["success"] is True
    assert any(w["detail"] and w["detail"].get("stage") == "outer_profile" for w in payload["warnings"])
