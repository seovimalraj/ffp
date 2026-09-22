"""Tests for emboss/draw (formed-feature) detection.

Unit tests exercise :func:`detect_formed_features` directly against synthetic
``ShapeModel``/``FaceRecord``/``EdgeRecord`` objects (no CAD kernel required).
Integration tests run the full ``analyze_sheet_metal()`` pipeline against a
real STEP fixture and require the OCC kernel (``requires_kernel``), mirroring
``test_bends_units.py``'s convention.
"""

from __future__ import annotations

import math

from app.machining.records import CYLINDER, PLANE, EdgeRecord, FaceRecord, ShapeModel
from app.sheet_metal.config import SheetMetalConfig
from app.sheet_metal.detectors.formed_features import detect_formed_features
from app.sheet_metal.schemas import SheetMetalFaces

from . import fixtures
from .conftest import requires_kernel

CONFIG = SheetMetalConfig()


# ---------------------------------------------------------------------------
# Synthetic ShapeModel builders
# ---------------------------------------------------------------------------


def _base_face() -> FaceRecord:
    """A 150 x 100 base plate skin at z=0."""
    return FaceRecord(
        id=1,
        surface_type=PLANE,
        area_mm2=150.0 * 100.0,
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(150.0, 100.0, 0.0),
        centroid=(75.0, 50.0, 0.0),
        normal=(0.0, 0.0, 1.0),
        edge_ids=[],
    )


def _rect_island_model(depth: float = 5.0, width: float = 20.0, length: float = 30.0) -> ShapeModel:
    """A base plate with one rectangular island offset ``depth`` above it,
    enclosed by four planar walls."""
    base = _base_face()

    cx, cy = 75.0, 50.0
    half_l, half_w = length / 2.0, width / 2.0
    x0, x1 = cx - half_l, cx + half_l
    y0, y1 = cy - half_w, cy + half_w
    floor = FaceRecord(
        id=2,
        surface_type=PLANE,
        area_mm2=length * width,
        bbox_min=(x0, y0, depth),
        bbox_max=(x1, y1, depth),
        centroid=(cx, cy, depth),
        normal=(0.0, 0.0, 1.0),
        edge_ids=[101, 102, 103, 104],
    )

    wall_normals = [(0.0, -1.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (-1.0, 0.0, 0.0)]
    walls = {}
    for i, normal in enumerate(wall_normals):
        wid = 3 + i
        walls[wid] = FaceRecord(
            id=wid,
            surface_type=PLANE,
            area_mm2=10.0,
            bbox_min=(x0, y0, 0.0),
            bbox_max=(x1, y1, depth),
            centroid=(cx, cy, depth / 2.0),
            normal=normal,
            edge_ids=[],
        )

    edges = {
        101 + i: EdgeRecord(id=101 + i, curve_type="LINE", face_ids=[2, 3 + i])
        for i in range(4)
    }

    faces = {1: base, 2: floor, **walls}
    model = ShapeModel(
        faces=faces,
        edges=edges,
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(150.0, 100.0, depth),
        face_neighbors={2: {3, 4, 5, 6}, 3: {2}, 4: {2}, 5: {2}, 6: {2}},
    )
    return model


def _round_island_model(depth: float = 2.0, radius: float = 5.0) -> ShapeModel:
    """A base plate with one round island (a dimple/boss) walled by a single
    cylindrical face wrapping the full 360 degrees."""
    base = _base_face()
    cx, cy = 75.0, 50.0
    floor = FaceRecord(
        id=2,
        surface_type=PLANE,
        area_mm2=math.pi * radius * radius,
        bbox_min=(cx - radius, cy - radius, depth),
        bbox_max=(cx + radius, cy + radius, depth),
        centroid=(cx, cy, depth),
        normal=(0.0, 0.0, 1.0),
        edge_ids=[201],
    )
    wall = FaceRecord(
        id=3,
        surface_type=CYLINDER,
        area_mm2=2 * math.pi * radius * depth,
        bbox_min=(cx - radius, cy - radius, 0.0),
        bbox_max=(cx + radius, cy + radius, depth),
        centroid=(cx, cy, depth / 2.0),
        axis=(0.0, 0.0, 1.0),
        axis_location=(cx, cy, 0.0),
        radius_mm=radius,
        angular_span_deg=360.0,
        is_internal=False,
        edge_ids=[],
    )
    edges = {201: EdgeRecord(id=201, curve_type="CIRCLE", face_ids=[2, 3], is_closed=True)}
    faces = {1: base, 2: floor, 3: wall}
    return ShapeModel(
        faces=faces,
        edges=edges,
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(150.0, 100.0, depth),
        face_neighbors={2: {3}, 3: {2}},
    )


# ---------------------------------------------------------------------------
# Rectangular island -> emboss vs draw
# ---------------------------------------------------------------------------


def test_shallow_rectangular_island_is_an_emboss():
    model = _rect_island_model(depth=2.0, width=20.0, length=30.0)  # 2/20 = 0.1 <= 0.15
    faces = SheetMetalFaces(base_face_id=1, flange_faces=[])
    features = detect_formed_features(model, CONFIG, faces)

    assert len(features) == 1
    feature = features[0]
    assert feature.subtype == "emboss"
    assert feature.shape == "rectangular"
    assert feature.depth_mm == 2.0
    assert feature.length_mm == 30.0
    assert feature.width_mm == 20.0
    assert feature.closed is True
    assert feature.status == "resolved"


def test_deep_rectangular_island_is_a_draw():
    model = _rect_island_model(depth=8.0, width=20.0, length=30.0)  # 8/20 = 0.4 > 0.15
    faces = SheetMetalFaces(base_face_id=1, flange_faces=[])
    features = detect_formed_features(model, CONFIG, faces)

    assert len(features) == 1
    assert features[0].subtype == "draw"
    assert features[0].depth_mm == 8.0


def test_open_island_is_reported_ambiguous_not_dropped():
    model = _rect_island_model(depth=5.0)
    # Drop one wall so the floor boundary no longer closes.
    del model.faces[6]
    model.face_neighbors[2] = {3, 4, 5}
    faces = SheetMetalFaces(base_face_id=1, flange_faces=[])
    features = detect_formed_features(model, CONFIG, faces)

    assert len(features) == 1
    assert features[0].closed is False
    assert features[0].status == "ambiguous"
    assert features[0].reason is not None


# ---------------------------------------------------------------------------
# Round island -> diameter
# ---------------------------------------------------------------------------


def test_round_island_reports_diameter_not_length_width():
    model = _round_island_model(depth=2.0, radius=5.0)
    faces = SheetMetalFaces(base_face_id=1, flange_faces=[])
    features = detect_formed_features(model, CONFIG, faces)

    assert len(features) == 1
    feature = features[0]
    assert feature.shape == "round"
    assert feature.diameter_mm == 10.0
    assert feature.length_mm is None
    assert feature.width_mm is None
    # 2 / 10 = 0.2 > 0.15 default threshold -> draw.
    assert feature.subtype == "draw"


# ---------------------------------------------------------------------------
# Rejections
# ---------------------------------------------------------------------------


def test_bare_face_with_no_walls_is_not_reported():
    """A planar face parallel to the base but with no enclosing walls (e.g. a
    stray coplanar face elsewhere) is not a formed feature."""
    base = _base_face()
    stray = FaceRecord(
        id=2,
        surface_type=PLANE,
        area_mm2=100.0,
        bbox_min=(10.0, 10.0, 5.0),
        bbox_max=(20.0, 20.0, 5.0),
        centroid=(15.0, 15.0, 5.0),
        normal=(0.0, 0.0, 1.0),
        edge_ids=[],
    )
    model = ShapeModel(
        faces={1: base, 2: stray},
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(150.0, 100.0, 5.0),
        face_neighbors={2: set()},
    )
    faces = SheetMetalFaces(base_face_id=1, flange_faces=[])
    rejections: dict = {}
    assert detect_formed_features(model, CONFIG, faces, rejections) == []
    assert "wall" in rejections[2]


def test_no_base_face_returns_empty():
    model = ShapeModel(faces={}, bbox_min=(0, 0, 0), bbox_max=(1, 1, 1))
    faces = SheetMetalFaces(base_face_id=None, flange_faces=[])
    assert detect_formed_features(model, CONFIG, faces) == []


def test_island_covering_most_of_the_base_is_rejected_as_opposite_skin():
    """A face the same size as the base (the sheet's own opposite skin, not a
    nested feature) must not be reported, even if topologically 'walled'."""
    base = _base_face()
    opposite = FaceRecord(
        id=2,
        surface_type=PLANE,
        area_mm2=150.0 * 100.0,
        bbox_min=(0.0, 0.0, 1.5),
        bbox_max=(150.0, 100.0, 1.5),
        centroid=(75.0, 50.0, 1.5),
        normal=(0.0, 0.0, 1.0),
        edge_ids=[301, 302, 303, 304],
    )
    rim_normals = [(0.0, -1.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (-1.0, 0.0, 0.0)]
    rims = {}
    for i, normal in enumerate(rim_normals):
        rid = 3 + i
        rims[rid] = FaceRecord(
            id=rid,
            surface_type=PLANE,
            area_mm2=10.0,
            bbox_min=(0.0, 0.0, 0.0),
            bbox_max=(150.0, 100.0, 1.5),
            centroid=(75.0, 50.0, 0.75),
            normal=normal,
            edge_ids=[],
        )
    edges = {
        301 + i: EdgeRecord(id=301 + i, curve_type="LINE", face_ids=[2, 3 + i])
        for i in range(4)
    }
    model = ShapeModel(
        faces={1: base, 2: opposite, **rims},
        edges=edges,
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(150.0, 100.0, 1.5),
        face_neighbors={2: {3, 4, 5, 6}, 3: {2}, 4: {2}, 5: {2}, 6: {2}},
    )
    faces = SheetMetalFaces(base_face_id=1, flange_faces=[])
    rejections: dict = {}
    assert detect_formed_features(model, CONFIG, faces, rejections) == []
    assert "opposite skin" in rejections[2]


def test_shallow_offset_is_rejected_below_min_depth():
    model = _rect_island_model(depth=0.02, width=20.0, length=30.0)  # default min is 0.1
    faces = SheetMetalFaces(base_face_id=1, flange_faces=[])
    rejections: dict = {}
    assert detect_formed_features(model, CONFIG, faces, rejections) == []
    assert "min_formed_feature_depth_mm" in rejections[2]


def test_rejections_left_untouched_when_no_dict_is_passed():
    """The optional out-param must not be required - existing callers that
    don't care about diagnostics keep working unchanged."""
    model = _rect_island_model(depth=5.0)
    del model.faces[6]
    model.face_neighbors[2] = {3, 4, 5}
    faces = SheetMetalFaces(base_face_id=1, flange_faces=[])
    # No rejections dict - and the open-boundary case above isn't even a
    # rejection (it's returned as an ambiguous feature), so nothing to check
    # beyond "this doesn't raise".
    features = detect_formed_features(model, CONFIG, faces)
    assert len(features) == 1


# ---------------------------------------------------------------------------
# Integration
# ---------------------------------------------------------------------------


@requires_kernel
def test_flat_plate_with_holes_fixture_has_no_formed_features(analyze, step_dir):
    """A flat plate with only pierced holes has no offset islands."""
    payload = analyze(fixtures.flat_plate_with_holes(step_dir))
    assert payload["formed_features"] == []
    assert payload["complexity_indicators"]["emboss_count"] == 0
    assert payload["complexity_indicators"]["draw_count"] == 0


@requires_kernel
def test_raised_pad_fixture_is_detected_as_a_draw(analyze, step_dir):
    """8 mm tall pad on 20 mm width -> 0.4 ratio, above the emboss cutoff."""
    payload = analyze(fixtures.flat_plate_with_raised_pad(step_dir, pad_height=8.0))

    formed = payload["formed_features"]
    assert len(formed) == 1
    feature = formed[0]
    assert feature["subtype"] == "draw"
    assert feature["shape"] == "rectangular"
    assert math.isclose(feature["depth_mm"], 8.0, abs_tol=0.05)
    assert math.isclose(feature["length_mm"], 30.0, abs_tol=0.05)
    assert math.isclose(feature["width_mm"], 20.0, abs_tol=0.05)
    assert feature["closed"] is True
    assert payload["complexity_indicators"]["draw_count"] == 1
    assert payload["complexity_indicators"]["emboss_count"] == 0


@requires_kernel
def test_shallow_raised_pad_fixture_is_detected_as_an_emboss(analyze, step_dir):
    """2 mm tall pad on 20 mm width -> 0.1 ratio, at/below the emboss cutoff."""
    payload = analyze(fixtures.flat_plate_with_raised_pad(step_dir, pad_height=2.0))

    formed = payload["formed_features"]
    assert len(formed) == 1
    assert formed[0]["subtype"] == "emboss"
    assert math.isclose(formed[0]["depth_mm"], 2.0, abs_tol=0.05)
    assert payload["complexity_indicators"]["emboss_count"] == 1


@requires_kernel
def test_debug_geometry_is_absent_unless_requested(analyze, step_dir):
    payload = analyze(fixtures.flat_plate_with_raised_pad(step_dir, pad_height=8.0))
    assert payload["debug_geometry"] is None


@requires_kernel
def test_debug_geometry_plumbing_reaches_the_endpoint(analyze, step_dir):
    """include_debug_geometry=true surfaces the adjacency graph, per-stage
    timings and (empty-or-not) formed_feature_rejections through the same
    analyze_sheet_metal() path the API uses - not just the unit-level
    detect_formed_features() call the synthetic tests exercise directly."""
    payload = analyze(
        fixtures.flat_plate_with_raised_pad(step_dir, pad_height=8.0),
        include_debug_geometry=True,
    )

    debug = payload["debug_geometry"]
    assert debug is not None
    assert debug["kernel"]
    assert debug["face_adjacency"]
    assert debug["detector_timings_ms"].get("formed_features") is not None
    assert isinstance(debug["formed_feature_rejections"], dict)


@requires_kernel
def test_face_details_are_absent_unless_requested(analyze, step_dir):
    payload = analyze(fixtures.flat_plate_with_raised_pad(step_dir, pad_height=8.0))
    assert payload["face_details"] is None


@requires_kernel
def test_face_details_report_every_face_with_surface_type_and_normal(
    analyze, step_dir
):
    payload = analyze(
        fixtures.flat_plate_with_raised_pad(step_dir, pad_height=8.0),
        include_face_details=True,
    )

    details = payload["face_details"]
    assert details is not None
    assert len(details) == payload["model"]["face_count"]
    by_id = {d["face_id"]: d for d in details}
    pad_top = next(
        d
        for d in details
        if d["surface_type"] == "PLANE"
        and d["normal"] is not None
        and abs(d["normal"]["z"] - 1.0) < 1e-6
        and abs(d["area_mm2"] - 30.0 * 20.0) < 1e-3
    )
    assert pad_top["face_id"] not in {
        f["face_id"] for f in payload["faces"]["flange_faces"]
    }


@requires_kernel
def test_a_near_thickness_offset_gets_absorbed_as_a_flange_not_a_formed_feature(
    analyze, step_dir
):
    """Regression/documentation case: when a raised island's height happens
    to put its top face within the base/flange clustering tolerance of the
    dominant sheet thickness, detect_base_flange's global (non-local)
    clustering sweeps that face into flange_faces before
    detect_formed_features ever sees it as a candidate - zero rejections,
    zero formed_features, even though include_face_details confirms the
    face is there. This is the mechanism suspected behind a real part's
    raised, grille-topped collar going undetected: a genuinely formed
    (constant-thickness) feature can be silently absorbed the same way a
    solid-added one wrongly wasn't, here."""
    payload = analyze(
        fixtures.flat_plate_with_raised_pad(step_dir, pad_height=0.05),
        include_face_details=True,
        include_debug_geometry=True,
    )

    assert payload["formed_features"] == []
    assert payload["debug_geometry"]["formed_feature_rejections"] == {}

    pad_top_area = 30.0 * 20.0
    pad_top_ids = {
        d["face_id"]
        for d in payload["face_details"]
        if d["surface_type"] == "PLANE"
        and d["normal"] is not None
        and abs(d["normal"]["z"] - 1.0) < 1e-6
        and abs(d["area_mm2"] - pad_top_area) < 1e-3
    }
    assert pad_top_ids, "expected to find the pad's own top face in face_details"
    flange_ids = {f["face_id"] for f in payload["faces"]["flange_faces"]}
    assert pad_top_ids & flange_ids, (
        "expected the pad top face to have been swept into flange_faces - "
        "if this now fails, the clustering bug this test documents may have "
        "been fixed and the assertions above (empty formed_features) should "
        "be revisited"
    )
