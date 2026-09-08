"""Phase 3 tests: base/flange, bend, and bend-relief detectors.

Unit tests exercise the detector functions directly against synthetic
``ShapeModel``/``FaceRecord`` objects (no CAD kernel required). Integration
tests run the full ``analyze_sheet_metal()`` pipeline against the real STEP
fixtures and require the OCC kernel (``requires_kernel``), mirroring
``test_analysis_units.py``'s Phase 2 convention.
"""

from __future__ import annotations

import math

from app.machining.records import CYLINDER, PLANE, EdgeRecord, FaceRecord, ShapeModel
from app.machining.schemas import Detection, DetectionMethod, InformationSource
from app.sheet_metal.config import SheetMetalConfig
from app.sheet_metal.detectors.base_flange import detect_base_flange
from app.sheet_metal.detectors.bend_relief import detect_bend_reliefs
from app.sheet_metal.detectors.bends import detect_bends
from app.sheet_metal.schemas import BendFeature, BendLine, Vector3

from . import fixtures
from .conftest import requires_kernel

CONFIG = SheetMetalConfig()


# ---------------------------------------------------------------------------
# Synthetic ShapeModel: an L-bracket-shaped bend, built directly from
# FaceRecord/EdgeRecord so the detector can be unit-tested with no kernel.
# ---------------------------------------------------------------------------


def _synthetic_l_bracket(radius: float = 3.0, angle_deg: float = 90.0) -> ShapeModel:
    """Two planar flanges joined by one cylindrical bend face.

    Base flange lies in the XY plane (normal +Z), the second flange is
    rotated ``angle_deg`` around the shared bend axis (the X axis at
    y=60, z=radius) so the angle between their normals is exactly
    ``angle_deg``. The cylindrical face bridges them, axis along +X.
    """
    length_x = 60.0

    base = FaceRecord(
        id=1,
        surface_type=PLANE,
        area_mm2=80.0 * 60.0,
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(80.0, 60.0, 0.0),
        centroid=(40.0, 30.0, 0.0),
        normal=(0.0, 0.0, 1.0),
    )

    angle_rad = math.radians(angle_deg)
    # Second flange's outward normal, rotated by angle_deg from +Z around X.
    upright_normal = (0.0, -math.sin(angle_rad), math.cos(angle_rad))
    upright = FaceRecord(
        id=2,
        surface_type=PLANE,
        area_mm2=60.0 * 40.0,
        bbox_min=(0.0, 60.0, 0.0),
        bbox_max=(60.0, 60.0 + 40.0 * abs(math.sin(angle_rad)), 40.0 * abs(math.cos(angle_rad))),
        centroid=(30.0, 80.0, 20.0),
        normal=upright_normal,
    )

    cyl = FaceRecord(
        id=3,
        surface_type=CYLINDER,
        area_mm2=length_x * radius * angle_rad,
        bbox_min=(0.0, 59.0, 0.0),
        bbox_max=(60.0, 61.0, radius),
        centroid=(30.0, 60.0, radius),
        axis=(1.0, 0.0, 0.0),
        axis_location=(0.0, 60.0, radius),
        radius_mm=radius,
        angular_span_deg=angle_deg,
        axial_extent_mm=length_x,
        is_internal=True,
    )

    # Straight edges along the bend axis, shared between the cylinder and
    # each flange - what the detector uses to confirm a real flange joint.
    edge_a = EdgeRecord(
        id=10,
        curve_type="LINE",
        length_mm=length_x,
        start=(0.0, 60.0, 0.0),
        end=(60.0, 60.0, 0.0),
        midpoint=(30.0, 60.0, 0.0),
        face_ids=[1, 3],
    )
    edge_b = EdgeRecord(
        id=11,
        curve_type="LINE",
        length_mm=length_x,
        start=(0.0, 60.0, radius),
        end=(60.0, 60.0, radius),
        midpoint=(30.0, 60.0, radius),
        face_ids=[2, 3],
    )

    model = ShapeModel(
        faces={1: base, 2: upright, 3: cyl},
        edges={10: edge_a, 11: edge_b},
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(80.0, 100.0, 40.0),
        face_neighbors={1: {3}, 2: {3}, 3: {1, 2}},
        shared_edges={(1, 3): [10], (2, 3): [11]},
    )
    return model


def _flat_no_bend_model() -> ShapeModel:
    """A single flat plate - no cylindrical faces at all, so no bends."""
    plate = FaceRecord(
        id=1,
        surface_type=PLANE,
        area_mm2=150.0 * 100.0,
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(150.0, 100.0, 1.5),
        centroid=(75.0, 50.0, 0.75),
        normal=(0.0, 0.0, 1.0),
    )
    return ShapeModel(faces={1: plate}, bbox_min=(0.0, 0.0, 0.0), bbox_max=(150.0, 100.0, 1.5))


# ---------------------------------------------------------------------------
# Unit tests: bends
# ---------------------------------------------------------------------------


def test_detect_bends_finds_one_ninety_degree_bend():
    model = _synthetic_l_bracket(radius=3.0, angle_deg=90.0)
    bends = detect_bends(model, CONFIG, thickness_mm=2.0)

    assert len(bends) == 1
    bend = bends[0]
    assert isinstance(bend, BendFeature)
    assert bend.id == "bend_1"
    assert abs(bend.angle_deg - 90.0) < 1e-6
    assert bend.inner_radius_mm == 3.0
    assert bend.length_mm == 60.0
    assert bend.sequence_hint == 1
    assert bend.k_factor_assumed == CONFIG.default_k_factor
    assert set(bend.adjacent_flange_ids) == {"1", "2"}
    assert bend.detection.confidence > 0.5
    assert bend.detection.evidence

    # BA = (pi/180)*angle*(r + k*t); BD = 2*(r+t)*tan(angle/2) - BA
    k = CONFIG.default_k_factor
    expected_ba = math.radians(90.0) * (3.0 + k * 2.0)
    expected_bd = 2.0 * (3.0 + 2.0) * math.tan(math.radians(90.0) / 2.0) - expected_ba
    assert bend.bend_allowance_mm == round(expected_ba, CONFIG.length_decimals)
    assert bend.bend_deduction_mm == round(expected_bd, CONFIG.length_decimals)


def test_detect_bends_without_thickness_skips_allowance_and_deduction():
    model = _synthetic_l_bracket(radius=3.0, angle_deg=90.0)
    bends = detect_bends(model, CONFIG, thickness_mm=None)

    assert len(bends) == 1
    assert bends[0].bend_allowance_mm is None
    assert bends[0].bend_deduction_mm is None


def test_detect_bends_outside_angle_window_is_not_reported():
    # 20 degrees is below the default min_bend_angle_deg (45).
    model = _synthetic_l_bracket(radius=3.0, angle_deg=20.0)
    bends = detect_bends(model, CONFIG, thickness_mm=2.0)
    assert bends == []


def test_detect_bends_no_cylindrical_faces_returns_empty():
    model = _flat_no_bend_model()
    bends = detect_bends(model, CONFIG, thickness_mm=1.5)
    assert bends == []


# ---------------------------------------------------------------------------
# Unit tests: base_flange
# ---------------------------------------------------------------------------


def test_detect_base_flange_picks_largest_face_as_base():
    model = _synthetic_l_bracket(radius=3.0, angle_deg=90.0)
    faces = detect_base_flange(model, CONFIG)

    # Base leg (id=1, 80x60) is larger than the upright (id=2, 60x40); the
    # cylindrical bend face (id=3) is never a candidate base/flange.
    assert faces.base_face_id == 1
    flange_ids = {f.face_id for f in faces.flange_faces}
    assert 3 not in flange_ids


def test_detect_base_flange_no_pairs_falls_back_to_largest_planar():
    model = _flat_no_bend_model()
    faces = detect_base_flange(model, CONFIG)
    assert faces.base_face_id == 1
    assert faces.flange_faces == []


# ---------------------------------------------------------------------------
# Unit tests: bend_relief (stub)
# ---------------------------------------------------------------------------


def test_detect_bend_reliefs_stub_reports_none_detected_per_bend():
    bend = BendFeature(
        id="bend_1",
        angle_deg=90.0,
        inner_radius_mm=3.0,
        bend_line=BendLine(
            start=Vector3(x=0, y=0, z=0), end=Vector3(x=60, y=0, z=0)
        ),
        axis=Vector3(x=1, y=0, z=0),
        length_mm=60.0,
        direction="up",
        sequence_hint=1,
        k_factor_assumed=0.44,
        adjacent_flange_ids=["1", "2"],
        detection=Detection(
            method=DetectionMethod.TOPOLOGY_AND_SURFACE,
            confidence=0.9,
            evidence=["e"],
            source=InformationSource.GEOMETRY,
        ),
    )
    reliefs = detect_bend_reliefs([bend])
    assert len(reliefs) == 1
    assert reliefs[0].bend_id == "bend_1"
    assert reliefs[0].type == "none-detected"
    assert reliefs[0].note is not None


def test_detect_bend_reliefs_empty_bends_returns_empty():
    assert detect_bend_reliefs([]) == []


# ---------------------------------------------------------------------------
# Integration tests against real STEP fixtures (kernel required)
# ---------------------------------------------------------------------------


@requires_kernel
def test_single_bend_l_bracket_fixture_reports_one_plausible_bend(analyze, step_dir):
    # NOTE: uses ``swept_l_bracket_bend``, not ``single_bend_l_bracket``.
    # ``single_bend_l_bracket`` builds its corner via ``BRepFilletAPI_MakeFillet``
    # on a fused pair of boxes; in this environment that fillet silently
    # no-ops (see that fixture's own docstring on the fallback), so the
    # resulting solid has zero cylindrical faces and can never exercise bend
    # detection. ``swept_l_bracket_bend`` builds the same L-bracket shape via
    # an explicit swept profile with two concentric arcs instead, which is
    # guaranteed to produce a real cylindrical bend face - see its docstring
    # in ``fixtures.py`` for the full rationale.
    step_path = fixtures.swept_l_bracket_bend(step_dir)
    payload = analyze(step_path)

    bends = payload["bends"]
    assert len(bends) == 1
    bend = bends[0]
    # Fixture is modelled with a ~90 deg bend and a 3 mm fillet radius.
    assert abs(bend["angle_deg"] - 90.0) <= 3.0
    assert abs(bend["inner_radius_mm"] - 3.0) <= 0.1
    assert bend["k_factor_assumed"] == CONFIG.default_k_factor
    assert bend["bend_allowance_mm"] is not None
    assert bend["bend_deduction_mm"] is not None
    assert len(bend["adjacent_flange_ids"]) == 2

    faces = payload["faces"]
    assert faces["base_face_id"] is not None

    reliefs = payload["bend_reliefs"]
    assert len(reliefs) == 1
    assert reliefs[0]["type"] == "none-detected"


@requires_kernel
def test_flat_plate_with_holes_fixture_reports_zero_bends(analyze, step_dir):
    step_path = fixtures.flat_plate_with_holes(step_dir)
    payload = analyze(step_path)

    assert payload["bends"] == []
    assert payload["bend_reliefs"] == []
    # base/flange still resolves even with no bends present.
    assert payload["faces"]["base_face_id"] is not None
