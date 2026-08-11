"""Unit tests for the kernel-free geometry helpers.

These run everywhere, including CI images with no CAD kernel.
"""

from __future__ import annotations

import math

import pytest

from app.machining.config import MachiningConfig
from app.machining.detectors.shared import (
    axial_range,
    group_coaxial,
    min_corner_radius,
    planar_dimensions,
)
from app.machining.records import CYLINDER, PLANE, FaceRecord
from app.machining.vectors import (
    angle_between_deg,
    canonical_axis,
    cluster_values,
    is_parallel,
    is_perpendicular,
    nearest_direction_label,
    normalize,
    point_line_distance,
    project_scalar,
    unique_rounded,
)


@pytest.fixture
def config() -> MachiningConfig:
    return MachiningConfig()


class TestVectorMath:
    def test_normalize_returns_unit_length(self):
        assert normalize((0.0, 0.0, 5.0)) == (0.0, 0.0, 1.0)

    def test_normalize_of_zero_vector_is_zero_not_a_crash(self):
        assert normalize((0.0, 0.0, 0.0)) == (0.0, 0.0, 0.0)

    @pytest.mark.parametrize(
        "a,b,expected",
        [
            ((1, 0, 0), (1, 0, 0), 0.0),
            ((1, 0, 0), (0, 1, 0), 90.0),
            ((1, 0, 0), (-1, 0, 0), 180.0),
        ],
    )
    def test_angle_between(self, a, b, expected):
        assert angle_between_deg(a, b) == pytest.approx(expected)

    def test_antiparallel_counts_as_parallel(self):
        # Two faces of the same wall have opposed normals but one orientation.
        assert is_parallel((0, 0, 1), (0, 0, -1), tol_deg=1.0)

    def test_perpendicular_detection(self):
        assert is_perpendicular((1, 0, 0), (0, 1, 0), tol_deg=1.0)
        assert not is_perpendicular((1, 0, 0), (1, 1, 0), tol_deg=1.0)

    def test_canonical_axis_folds_opposite_directions_together(self):
        # +Z and -Z name the same axis line, so coaxial grouping must agree.
        assert canonical_axis((0, 0, -1)) == canonical_axis((0, 0, 1))

    def test_point_line_distance(self):
        assert point_line_distance((3, 4, 10), (0, 0, 0), (0, 0, 1)) == pytest.approx(5.0)

    def test_project_scalar_is_signed(self):
        assert project_scalar((0, 0, -7), (0, 0, 0), (0, 0, 1)) == pytest.approx(-7.0)

    def test_nearest_direction_label(self):
        assert nearest_direction_label((0.0, 0.0, 0.99)) == "+Z"
        assert nearest_direction_label((0.0, -1.0, 0.0)) == "-Y"

    def test_nearest_direction_label_returns_none_when_nothing_is_close(self):
        assert nearest_direction_label((1, 1, 1), tol_deg=10.0) is None

    def test_cluster_values_groups_within_tolerance(self):
        assert cluster_values([1.0, 1.02, 5.0], 0.05) == [[1.0, 1.02], [5.0]]

    def test_unique_rounded_is_sorted_and_deduplicated(self):
        assert unique_rounded([2.0001, 2.0002, 1.0], 3) == [1.0, 2.0]


def _plane(face_id: int, normal, bbox_min, bbox_max, area=100.0) -> FaceRecord:
    return FaceRecord(
        id=face_id,
        surface_type=PLANE,
        normal=normal,
        bbox_min=bbox_min,
        bbox_max=bbox_max,
        area_mm2=area,
        centroid=tuple((a + b) / 2 for a, b in zip(bbox_min, bbox_max)),
    )


def _cylinder(face_id: int, radius, axis, location, internal=True) -> FaceRecord:
    return FaceRecord(
        id=face_id,
        surface_type=CYLINDER,
        radius_mm=radius,
        axis=axis,
        axis_location=location,
        is_internal=internal,
    )


class TestFaceHelpers:
    def test_axial_range_spans_the_face_bounding_box(self):
        face = _plane(1, (0, 0, 1), (0, 0, 5), (10, 10, 5))
        assert axial_range(face, (0, 0, 1), (0, 0, 0)) == (5.0, 5.0)

    def test_planar_dimensions_returns_length_first(self):
        face = _plane(1, (0, 0, 1), (0, 0, 0), (50, 20, 0))
        length, width, _, _ = planar_dimensions(face, (0, 0, 1))
        assert (round(length, 6), round(width, 6)) == (50.0, 20.0)

    def test_min_corner_radius_ignores_external_cylinders(self):
        walls = [
            _cylinder(1, 3.0, (0, 0, 1), (0, 0, 0), internal=True),
            _cylinder(2, 0.5, (0, 0, 1), (0, 0, 0), internal=False),
        ]
        assert min_corner_radius(walls) == 3.0

    def test_min_corner_radius_is_none_without_cylindrical_walls(self):
        assert min_corner_radius([_plane(1, (1, 0, 0), (0, 0, 0), (0, 10, 10))]) is None


class TestCoaxialGrouping:
    def test_same_axis_line_groups_together(self, config):
        faces = [
            _cylinder(1, 3.0, (0, 0, 1), (10, 10, 0)),
            _cylinder(2, 6.0, (0, 0, 1), (10, 10, 25)),
        ]
        assert len(group_coaxial(faces, config)) == 1

    def test_parallel_but_offset_axes_stay_separate(self, config):
        # Two holes 40 mm apart are two holes, not one stepped hole.
        faces = [
            _cylinder(1, 3.0, (0, 0, 1), (10, 10, 0)),
            _cylinder(2, 3.0, (0, 0, 1), (50, 10, 0)),
        ]
        assert len(group_coaxial(faces, config)) == 2

    def test_opposed_axis_directions_still_group(self, config):
        faces = [
            _cylinder(1, 3.0, (0, 0, 1), (0, 0, 0)),
            _cylinder(2, 3.0, (0, 0, -1), (0, 0, 10)),
        ]
        assert len(group_coaxial(faces, config)) == 1

    def test_faces_without_an_axis_are_skipped(self, config):
        assert group_coaxial([_plane(1, (0, 0, 1), (0, 0, 0), (1, 1, 0))], config) == []
