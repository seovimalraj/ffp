"""Phase 2 tests: sheet-candidate + thickness detectors.

Unit tests exercise the detector functions directly against synthetic
``ShapeModel``/``FaceRecord`` objects (no CAD kernel required). Integration
tests run the full ``analyze_sheet_metal()`` pipeline against the real STEP
fixtures and require the OCC kernel (``requires_kernel``).
"""

from __future__ import annotations

from app.machining.records import PLANE, FaceRecord, ShapeModel
from app.sheet_metal.config import SheetMetalConfig
from app.sheet_metal.detectors.sheet_candidate import (
    detect_sheet_candidate,
    find_opposed_planar_pairs,
)
from app.sheet_metal.detectors.thickness import detect_thickness

from . import fixtures
from .conftest import requires_kernel

CONFIG = SheetMetalConfig()


# ---------------------------------------------------------------------------
# Synthetic ShapeModel builders
# ---------------------------------------------------------------------------


def _plane_pair(
    face_id_start: int,
    thickness: float,
    size: float = 100.0,
    normal_axis: int = 2,
) -> list:
    """Two opposed planar faces ``thickness`` apart, each ``size`` x ``size``."""
    normal = [0.0, 0.0, 0.0]
    normal[normal_axis] = 1.0
    normal = tuple(normal)
    opposite = tuple(-v for v in normal)

    lo = [0.0, 0.0, 0.0]
    hi = [size, size, size]
    lo[normal_axis] = 0.0
    hi[normal_axis] = 0.0

    centroid_a = [size / 2.0, size / 2.0, size / 2.0]
    centroid_a[normal_axis] = 0.0
    centroid_b = list(centroid_a)
    centroid_b[normal_axis] = thickness

    hi_b = list(hi)
    hi_b[normal_axis] = thickness
    lo_b = list(lo)
    lo_b[normal_axis] = thickness

    face_a = FaceRecord(
        id=face_id_start,
        surface_type=PLANE,
        area_mm2=size * size,
        bbox_min=tuple(lo),
        bbox_max=tuple(hi),
        centroid=tuple(centroid_a),
        normal=normal,
    )
    face_b = FaceRecord(
        id=face_id_start + 1,
        surface_type=PLANE,
        area_mm2=size * size,
        bbox_min=tuple(lo_b),
        bbox_max=tuple(hi_b),
        centroid=tuple(centroid_b),
        normal=opposite,
    )
    return [face_a, face_b]


def _flat_plate_model(thickness: float = 2.0, size: float = 100.0) -> ShapeModel:
    """A synthetic flat plate: one dominant thin pair of large planar faces."""
    faces = _plane_pair(1, thickness, size=size, normal_axis=2)
    model = ShapeModel(
        faces={f.id: f for f in faces},
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(size, size, thickness),
    )
    return model


def _solid_block_model(size: float = 60.0) -> ShapeModel:
    """A synthetic cube: opposed faces exist but far outside the sheet-thickness
    window on every axis, so it must not read as a sheet-metal candidate."""
    faces = []
    faces += _plane_pair(1, size, size=size, normal_axis=0)
    faces += _plane_pair(3, size, size=size, normal_axis=1)
    faces += _plane_pair(5, size, size=size, normal_axis=2)
    model = ShapeModel(
        faces={f.id: f for f in faces},
        bbox_min=(0.0, 0.0, 0.0),
        bbox_max=(size, size, size),
    )
    return model


def _no_faces_model() -> ShapeModel:
    return ShapeModel(faces={})


# ---------------------------------------------------------------------------
# Unit tests: sheet_candidate
# ---------------------------------------------------------------------------


def test_sheet_candidate_flat_plate_is_candidate():
    model = _flat_plate_model(thickness=2.0, size=100.0)
    result = detect_sheet_candidate(model, CONFIG)

    assert result.is_candidate is True
    assert result.status == "resolved"
    assert result.confidence > 0.5
    assert result.evidence.dominant_thickness_mm == 2.0
    # Only the two paired faces exist in this synthetic model; the pairing
    # support area is min(face_a, face_b) - one "skin" - against a total
    # surface area that counts both skins, so the fraction is 0.5 here (a
    # real part's non-wall faces are a small share of a much larger total,
    # so paired_area_fraction reads far closer to 1.0 there).
    assert result.evidence.paired_area_fraction == 0.5
    assert result.evidence.method == "paired_planar_faces"


def test_sheet_candidate_solid_block_is_rejected():
    model = _solid_block_model(size=60.0)
    result = detect_sheet_candidate(model, CONFIG)

    assert result.is_candidate is False
    assert result.status == "rejected"
    assert result.reason is not None


def test_sheet_candidate_no_faces_is_rejected_without_raising():
    model = _no_faces_model()
    result = detect_sheet_candidate(model, CONFIG)

    assert result.is_candidate is False
    assert result.status == "rejected"


def test_sheet_candidate_thickness_outside_range_is_rejected():
    # 20 mm thickness is above max_sheet_thickness_mm (6.0 default).
    model = _flat_plate_model(thickness=20.0, size=100.0)
    result = detect_sheet_candidate(model, CONFIG)

    assert result.is_candidate is False
    assert result.status == "rejected"


def test_find_opposed_planar_pairs_respects_gap_bounds():
    model = _flat_plate_model(thickness=2.0, size=100.0)
    pairs = find_opposed_planar_pairs(model, min_gap=0.0001, max_gap=1.0)
    assert pairs == []  # 2mm gap is outside the (0, 1) window

    pairs = find_opposed_planar_pairs(model, min_gap=0.0001, max_gap=5.0)
    assert len(pairs) == 1
    assert pairs[0].gap_mm == 2.0


# ---------------------------------------------------------------------------
# Unit tests: thickness
# ---------------------------------------------------------------------------


def test_thickness_flat_plate_reports_dominant_thickness():
    model = _flat_plate_model(thickness=1.5, size=100.0)
    result = detect_thickness(model, CONFIG)

    assert result.dominant_thickness_mm == 1.5
    assert result.is_uniform is True
    assert result.sample_count == 1
    assert result.method == "paired_planar_faces"
    assert result.note is not None


def test_thickness_no_pairs_reports_none_with_note():
    model = _no_faces_model()
    result = detect_thickness(model, CONFIG)

    assert result.dominant_thickness_mm is None
    assert result.is_uniform is None
    assert result.sample_count == 0
    assert "No opposed planar face pairs" in (result.note or "")


# ---------------------------------------------------------------------------
# Integration tests against real STEP fixtures (kernel required)
# ---------------------------------------------------------------------------


@requires_kernel
def test_flat_plate_with_holes_fixture_is_candidate_with_plausible_thickness(
    analyze, step_dir
):
    step_path = fixtures.flat_plate_with_holes(step_dir)
    payload = analyze(step_path)

    candidate = payload["sheet_metal_candidate"]
    assert candidate["is_candidate"] is True

    thickness = payload["thickness"]
    assert thickness["dominant_thickness_mm"] is not None
    # Fixture is modelled at 1.5 mm.
    assert 1.0 <= thickness["dominant_thickness_mm"] <= 2.5


@requires_kernel
def test_single_bend_l_bracket_fixture_is_candidate_with_plausible_thickness(
    analyze, step_dir
):
    step_path = fixtures.single_bend_l_bracket(step_dir)
    payload = analyze(step_path)

    candidate = payload["sheet_metal_candidate"]
    assert candidate["is_candidate"] is True

    thickness = payload["thickness"]
    assert thickness["dominant_thickness_mm"] is not None
    # Fixture is modelled at 2.0 mm walls.
    assert 1.0 <= thickness["dominant_thickness_mm"] <= 3.0


@requires_kernel
def test_solid_block_fixture_is_not_a_candidate(analyze, step_dir):
    step_path = fixtures.solid_block_non_candidate(step_dir)
    payload = analyze(step_path)

    candidate = payload["sheet_metal_candidate"]
    assert candidate["is_candidate"] is False
    assert candidate["status"] == "rejected"


@requires_kernel
def test_pipeline_degrades_gracefully_when_candidate_rejected(analyze, step_dir):
    """A non-candidate part still returns a full, successful response - later
    sections just stay at their schema defaults, per the design doc's
    "never a hard failure" contract for this gate."""
    step_path = fixtures.solid_block_non_candidate(step_dir)
    payload = analyze(step_path)

    assert payload["success"] is True
    assert payload["sheet_metal_candidate"]["is_candidate"] is False
    # Later, not-yet-implemented sections remain at their empty defaults.
    assert payload["bends"] == []
    assert payload["holes"] == []
