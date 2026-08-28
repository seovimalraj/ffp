"""Unit tests for stock-form classification.

These build ``ShapeModel`` instances by hand, so they run everywhere - no CAD
kernel required. The kernel-backed counterparts live in
``test_detectors_with_kernel.py``.
"""

from __future__ import annotations

import pytest

from app.machining.config import MachiningConfig
from app.machining.records import CYLINDER, FaceRecord, ShapeModel
from app.machining.schemas import FeatureStatus, StockFormKind
from app.machining.stock_form import StockFormClassifier


@pytest.fixture
def config() -> MachiningConfig:
    return MachiningConfig()


@pytest.fixture
def classifier(config) -> StockFormClassifier:
    return StockFormClassifier(config)


def _model(dx: float, dy: float, dz: float) -> ShapeModel:
    """An axis-aligned model of the given extents, with no faces."""
    model = ShapeModel()
    model.bbox_min = (0.0, 0.0, 0.0)
    model.bbox_max = (dx, dy, dz)
    return model


def _with_obb(model: ShapeModel, size, axes) -> ShapeModel:
    model.obb_size = size
    model.obb_axes = axes
    model.obb_center = (0.0, 0.0, 0.0)
    return model


def _outer_cylinder(
    face_id: int,
    radius: float,
    axis=(0.0, 0.0, 1.0),
    extent: float = 100.0,
) -> FaceRecord:
    return FaceRecord(
        id=face_id,
        surface_type=CYLINDER,
        radius_mm=radius,
        axis=axis,
        axis_location=(0.0, 0.0, 0.0),
        axial_extent_mm=extent,
        is_internal=False,
    )


class TestFlatForms:
    def test_thin_flat_part_is_sheet(self, classifier):
        result = classifier.classify(_model(300.0, 200.0, 2.0))
        assert result.form is StockFormKind.SHEET
        assert result.status is FeatureStatus.RESOLVED
        assert result.thickness_mm == 2.0

    def test_thick_flat_part_is_plate(self, classifier):
        result = classifier.classify(_model(300.0, 200.0, 25.0))
        assert result.form is StockFormKind.PLATE
        assert result.status is FeatureStatus.RESOLVED

    def test_thickness_above_sheet_cutoff_is_plate(self, classifier):
        # 8 mm clears the 6 mm sheet cutoff by more than the ambiguity margin.
        result = classifier.classify(_model(400.0, 300.0, 8.0))
        assert result.form is StockFormKind.PLATE

    def test_sorted_dimensions_are_descending(self, classifier):
        result = classifier.classify(_model(2.0, 300.0, 200.0))
        dims = result.sorted_dimensions_mm
        assert (dims.length, dims.width, dims.height) == (300.0, 200.0, 2.0)


class TestBarForms:
    def test_slender_part_with_outer_cylinder_is_round_bar(self, classifier):
        model = _model(20.0, 20.0, 200.0)
        model.faces[1] = _outer_cylinder(1, radius=10.0, extent=200.0)
        result = classifier.classify(model)
        assert result.form is StockFormKind.ROUND_BAR
        assert result.round_evidence is not None
        assert result.round_evidence.face_id == 1
        assert result.round_evidence.radius_mm == 10.0

    def test_slender_part_without_cylinder_is_square_bar(self, classifier):
        result = classifier.classify(_model(20.0, 20.0, 200.0))
        assert result.form is StockFormKind.SQUARE_BAR
        assert result.round_evidence is None

    def test_unequal_cross_section_is_rectangular_bar(self, classifier):
        result = classifier.classify(_model(40.0, 15.0, 300.0))
        assert result.form is StockFormKind.RECTANGULAR_BAR

    def test_internal_cylinder_is_not_round_evidence(self, classifier):
        """A bore down a square bar must not make it read as round."""
        model = _model(20.0, 20.0, 200.0)
        bore = _outer_cylinder(1, radius=10.0, extent=200.0)
        bore.is_internal = True
        model.faces[1] = bore
        result = classifier.classify(model)
        assert result.form is StockFormKind.SQUARE_BAR

    def test_cylinder_across_the_axis_is_not_round_evidence(self, classifier):
        """A cross-drilled hole runs the wrong way to be the bar's outside."""
        model = _model(20.0, 20.0, 200.0)
        model.faces[1] = _outer_cylinder(
            1, radius=10.0, axis=(1.0, 0.0, 0.0), extent=200.0
        )
        result = classifier.classify(model)
        assert result.form is StockFormKind.SQUARE_BAR

    def test_short_cylinder_is_not_round_evidence(self, classifier):
        """A boss on the end covers too little of the length to define the form."""
        model = _model(20.0, 20.0, 200.0)
        model.faces[1] = _outer_cylinder(1, radius=10.0, extent=20.0)
        result = classifier.classify(model)
        assert result.form is StockFormKind.SQUARE_BAR

    def test_outer_diameter_split_by_a_groove_still_reads_as_round(self, classifier):
        """A turned part rarely carries its OD as one face - grooves and
        shoulders split it, so coaxial faces must be summed."""
        model = _model(20.0, 20.0, 200.0)
        model.faces[1] = _outer_cylinder(1, radius=10.0, extent=100.0)
        model.faces[2] = _outer_cylinder(2, radius=10.0, extent=80.0)
        result = classifier.classify(model)
        assert result.form is StockFormKind.ROUND_BAR
        assert result.round_evidence.axial_coverage == pytest.approx(0.9)
        # The larger of the two faces is cited as the evidence.
        assert result.round_evidence.face_id == 1

    def test_parallel_but_offset_cylinders_are_not_summed(self, classifier):
        """Two cylinders on different axis lines are two features, not one OD."""
        model = _model(20.0, 20.0, 200.0)
        near = _outer_cylinder(1, radius=10.0, extent=100.0)
        far = _outer_cylinder(2, radius=10.0, extent=80.0)
        far.axis_location = (500.0, 0.0, 0.0)
        model.faces[1] = near
        model.faces[2] = far
        result = classifier.classify(model)
        assert result.form is StockFormKind.SQUARE_BAR

    def test_wrong_radius_is_not_round_evidence(self, classifier):
        model = _model(20.0, 20.0, 200.0)
        model.faces[1] = _outer_cylinder(1, radius=4.0, extent=200.0)
        result = classifier.classify(model)
        assert result.form is StockFormKind.SQUARE_BAR


class TestBlock:
    def test_comparable_extents_are_block(self, classifier):
        result = classifier.classify(_model(100.0, 90.0, 80.0))
        assert result.form is StockFormKind.BLOCK
        assert result.status is FeatureStatus.RESOLVED


class TestAmbiguity:
    def test_thickness_on_the_sheet_cutoff_is_ambiguous(self, classifier):
        result = classifier.classify(_model(600.0, 400.0, 6.0))
        assert result.status is FeatureStatus.AMBIGUOUS
        assert set(result.candidate_forms) == {
            StockFormKind.SHEET,
            StockFormKind.PLATE,
        }
        assert result.reason

    def test_ratio_on_the_plate_block_cutoff_is_ambiguous(self, classifier):
        # thickness/width == 0.25, exactly the plate cutoff.
        result = classifier.classify(_model(200.0, 100.0, 25.0))
        assert result.status is FeatureStatus.AMBIGUOUS
        assert StockFormKind.PLATE in result.candidate_forms

    def test_resolved_results_carry_no_reason(self, classifier):
        result = classifier.classify(_model(300.0, 200.0, 2.0))
        assert result.reason is None
        assert result.candidate_forms == []


class TestBounds:
    def test_axis_aligned_box_is_reported_as_aabb(self, classifier):
        result = classifier.classify(_model(300.0, 200.0, 2.0))
        assert result.bounds_method == "aabb"

    def test_oriented_box_wins_over_axis_aligned(self, classifier):
        """A rotated plate reads as a block from its AABB, and as a plate from
        its OBB. This is the whole reason the OBB is computed."""
        rotated = _model(210.0, 210.0, 150.0)
        assert classifier.classify(rotated).form is StockFormKind.BLOCK

        oriented = _with_obb(
            _model(210.0, 210.0, 150.0),
            (300.0, 200.0, 3.0),
            ((0.7071, 0.7071, 0.0), (-0.7071, 0.7071, 0.0), (0.0, 0.0, 1.0)),
        )
        result = classifier.classify(oriented)
        assert result.bounds_method == "obb"
        assert result.form is StockFormKind.SHEET

    def test_round_bar_probe_uses_the_oriented_long_axis(self, classifier):
        """The cylinder runs along the OBB's long axis, not a world axis."""
        axis = (0.0, 0.6, 0.8)
        model = _with_obb(
            _model(120.0, 130.0, 160.0),
            (200.0, 20.0, 20.0),
            (axis, (0.0, -0.8, 0.6), (1.0, 0.0, 0.0)),
        )
        model.faces[1] = _outer_cylinder(1, radius=10.0, axis=axis, extent=200.0)
        result = classifier.classify(model)
        assert result.form is StockFormKind.ROUND_BAR


class TestDegenerate:
    def test_zero_extent_returns_none(self, classifier):
        assert classifier.classify(_model(100.0, 50.0, 0.0)) is None

    def test_empty_model_returns_none(self, classifier):
        assert classifier.classify(ShapeModel()) is None
