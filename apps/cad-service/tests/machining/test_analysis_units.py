"""Unit tests for configuration, patterns, flags, tool constraints, stock,
thin walls, thread parsing and unit conversion.

All kernel-free: they drive the analysis modules with synthetic feature objects.
"""

from __future__ import annotations

import json
import math

import pytest

from app.machining.complexity import ComplexityIndicatorBuilder, ThinWallAnalyzer
from app.machining.config import (
    MachiningConfig,
    get_machining_config,
    reset_config_cache,
)
from app.machining.constraints import MachiningComplexityAnalyzer
from app.machining.detectors.threads import ThreadDetector
from app.machining.parser import sanitize_filename, validate_extension, CADParseError
from app.machining.patterns import PatternDetector, classify_arrangement
from app.machining.records import (
    CYLINDER,
    PLANE,
    EdgeRecord,
    FaceRecord,
    MassProperties,
    ShapeModel,
)
from app.machining.schemas import (
    Detection,
    DetectionMethod,
    FeatureCollection,
    HoleFeature,
    PocketFeature,
    SlotFeature,
    SurfaceSummary,
    Vector3,
)
from app.machining.stock import StockAnalyzer
from app.machining.units import to_imperial


@pytest.fixture
def config() -> MachiningConfig:
    return MachiningConfig()


def _detection() -> Detection:
    return Detection(method=DetectionMethod.TOPOLOGY_AND_SURFACE, confidence=0.9)


def _hole(hole_id: str, diameter: float, depth: float, position) -> HoleFeature:
    return HoleFeature(
        id=hole_id,
        subtype="through",
        diameter_mm=diameter,
        radius_mm=diameter / 2,
        depth_mm=depth,
        through=True,
        position=Vector3.from_tuple(position),
        axis=Vector3(x=0, y=0, z=1),
        depth_diameter_ratio=depth / diameter,
        detection=_detection(),
    )


def _pocket(pocket_id: str, length, width, depth, corner=None, position=(0, 0, 0)):
    return PocketFeature(
        id=pocket_id,
        length_mm=length,
        width_mm=width,
        depth_mm=depth,
        area_mm2=length * width,
        bottom_type="planar",
        closed=True,
        corner_radius_mm=corner,
        minimum_internal_radius_mm=corner,
        machining_direction=[0.0, 0.0, 1.0],
        position=Vector3.from_tuple(position),
        depth_width_ratio=depth / width,
        detection=_detection(),
    )


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


class TestConfiguration:
    def test_defaults_load_from_the_bundled_json(self):
        reset_config_cache()
        config = get_machining_config()
        assert config.stock_allowance_mm == 2.5
        assert config.deep_hole_depth_diameter_ratio == 5.0

    def test_comment_keys_in_the_json_are_ignored(self):
        # The shipped config carries a "_comment" block; extra="forbid" would
        # reject it if the loader did not strip underscore keys.
        reset_config_cache()
        assert get_machining_config() is not None

    def test_environment_variable_overrides_a_threshold(self, monkeypatch):
        monkeypatch.setenv("MACHINING_DEEP_HOLE_DEPTH_DIAMETER_RATIO", "3.5")
        reset_config_cache()
        try:
            assert get_machining_config().deep_hole_depth_diameter_ratio == 3.5
        finally:
            reset_config_cache()

    def test_invalid_environment_override_is_ignored_not_fatal(self, monkeypatch):
        monkeypatch.setenv("MACHINING_MAX_FACES", "not-a-number")
        reset_config_cache()
        try:
            assert get_machining_config().max_faces == 50000
        finally:
            reset_config_cache()

    def test_config_is_immutable(self, config):
        with pytest.raises(Exception):
            config.stock_allowance_mm = 99.0


# ---------------------------------------------------------------------------
# Upload safety
# ---------------------------------------------------------------------------


class TestUploadSafety:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("part.step", "part.step"),
            ("../../../etc/passwd", "passwd"),
            (r"..\..\windows\system32\evil.stp", "evil.stp"),
            ("/absolute/path/part.STEP", "part.STEP"),
            ("C:\\Users\\x\\part.stp", "part.stp"),
            ("weird name;rm -rf.step", "weird_name_rm_-rf.step"),
            ("", "upload"),
            (None, "upload"),
            ("..", "upload"),
        ],
    )
    def test_filenames_are_reduced_to_a_safe_basename(self, raw, expected):
        assert sanitize_filename(raw) == expected

    def test_null_bytes_are_stripped(self):
        assert "\x00" not in sanitize_filename("pa\x00rt.step")

    def test_long_filenames_are_truncated(self):
        assert len(sanitize_filename("a" * 500 + ".step")) <= 180

    @pytest.mark.parametrize("name", ["a.step", "a.STP", "a.iges", "a.igs"])
    def test_supported_extensions_are_accepted(self, name):
        assert validate_extension(name) in ("STEP", "IGES")

    @pytest.mark.parametrize("name", ["a.stl", "a.dxf", "a.exe", "noextension"])
    def test_unsupported_extensions_raise_415(self, name):
        with pytest.raises(CADParseError) as exc:
            validate_extension(name)
        assert exc.value.status_code == 415


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------


class TestPatternArrangement:
    def test_evenly_spaced_points_on_a_line(self, config):
        positions = [(0, 0, 0), (10, 0, 0), (20, 0, 0), (30, 0, 0)]
        kind, spacing = classify_arrangement(positions, config)
        assert kind == "linear"
        assert spacing == pytest.approx(10.0)

    def test_bolt_circle_is_circular_with_pitch_diameter(self, config):
        radius = 25.0
        positions = [
            (radius * math.cos(i * math.pi / 3), radius * math.sin(i * math.pi / 3), 0)
            for i in range(6)
        ]
        kind, spacing = classify_arrangement(positions, config)
        assert kind == "circular"
        assert spacing == pytest.approx(50.0)

    def test_square_grid_is_reported_as_rectangular(self, config):
        positions = [(0, 0, 0), (60, 0, 0), (0, 60, 0), (60, 60, 0)]
        kind, _ = classify_arrangement(positions, config)
        assert kind == "rectangular"

    def test_two_features_are_linear(self, config):
        kind, spacing = classify_arrangement([(0, 0, 0), (5, 0, 0)], config)
        assert (kind, spacing) == ("linear", 5.0)

    def test_scattered_points_fall_back_to_grouped(self, config):
        positions = [(0, 0, 0), (13, 41, 7), (77, 2, 19), (5, 60, 33)]
        assert classify_arrangement(positions, config)[0] == "grouped"

    def test_identical_holes_are_grouped_into_one_pattern(self, config):
        holes = [
            _hole("HOLE-001", 6.0, 12.0, (0, 0, 0)),
            _hole("HOLE-002", 6.0, 12.0, (20, 0, 0)),
            _hole("HOLE-003", 6.0, 12.0, (40, 0, 0)),
        ]
        patterns = PatternDetector(config).detect(FeatureCollection(holes=holes))
        assert len(patterns) == 1
        assert patterns[0].feature_count == 3
        assert patterns[0].feature_ids == ["HOLE-001", "HOLE-002", "HOLE-003"]

    def test_differing_diameters_are_not_merged(self, config):
        holes = [
            _hole("HOLE-001", 6.0, 12.0, (0, 0, 0)),
            _hole("HOLE-002", 8.0, 12.0, (20, 0, 0)),
        ]
        assert PatternDetector(config).detect(FeatureCollection(holes=holes)) == []

    def test_a_lone_feature_is_not_a_pattern(self, config):
        holes = [_hole("HOLE-001", 6.0, 12.0, (0, 0, 0))]
        assert PatternDetector(config).detect(FeatureCollection(holes=holes)) == []


# ---------------------------------------------------------------------------
# Flags and tooling constraints
# ---------------------------------------------------------------------------


class TestFlagsAndConstraints:
    def test_deep_hole_flag_uses_the_configured_threshold(self, config):
        # ratio 8.0: at or above the DEEP_HOLE limit of 5, below VERY_DEEP at 10.
        features = FeatureCollection(holes=[_hole("HOLE-001", 6.0, 48.0, (0, 0, 0))])
        names = {f.flag for f in MachiningComplexityAnalyzer(config).flags(features)}
        assert "DEEP_HOLE" in names
        assert "VERY_DEEP_HOLE" not in names

    def test_very_deep_hole_supersedes_deep_hole(self, config):
        features = FeatureCollection(holes=[_hole("HOLE-001", 4.0, 48.0, (0, 0, 0))])
        names = {f.flag for f in MachiningComplexityAnalyzer(config).flags(features)}
        assert "VERY_DEEP_HOLE" in names
        assert "DEEP_HOLE" not in names

    def test_ratio_below_threshold_raises_no_flag(self, config):
        features = FeatureCollection(holes=[_hole("HOLE-001", 10.0, 20.0, (0, 0, 0))])
        flags = MachiningComplexityAnalyzer(config).flags(features)
        assert [f.flag for f in flags if f.flag.endswith("DEEP_HOLE")] == []

    def test_threshold_is_configurable_without_touching_detector_code(self):
        strict = MachiningConfig(deep_hole_depth_diameter_ratio=1.5)
        features = FeatureCollection(holes=[_hole("HOLE-001", 10.0, 20.0, (0, 0, 0))])
        flags = MachiningComplexityAnalyzer(strict).flags(features)
        assert "DEEP_HOLE" in {f.flag for f in flags}

    def test_flag_records_both_value_and_threshold(self, config):
        features = FeatureCollection(holes=[_hole("HOLE-005", 6.0, 48.0, (0, 0, 0))])
        flag = next(
            f
            for f in MachiningComplexityAnalyzer(config).flags(features)
            if f.flag == "DEEP_HOLE"
        )
        assert flag.value == pytest.approx(8.0)
        assert flag.threshold == 5.0
        assert "8.0" in flag.reason

    def test_small_diameter_hole_is_flagged(self, config):
        features = FeatureCollection(holes=[_hole("HOLE-001", 1.5, 3.0, (0, 0, 0))])
        flags = MachiningComplexityAnalyzer(config).flags(features)
        assert "SMALL_DIAMETER_HOLE" in {f.flag for f in flags}

    def test_maximum_tool_diameter_is_twice_the_corner_radius(self, config):
        features = FeatureCollection(pockets=[_pocket("POCKET-002", 50, 25, 8, corner=2.0)])
        constraint = MachiningComplexityAnalyzer(config).tooling_constraints(features)[0]
        assert constraint.tooling_constraints.minimum_internal_radius_mm == 2.0
        assert constraint.tooling_constraints.maximum_tool_diameter_mm == 4.0

    def test_pocket_without_a_corner_radius_yields_no_constraint(self, config):
        features = FeatureCollection(pockets=[_pocket("POCKET-001", 50, 25, 8)])
        assert MachiningComplexityAnalyzer(config).tooling_constraints(features) == []

    def test_flags_are_ordered_deterministically(self, config):
        features = FeatureCollection(
            holes=[
                _hole("HOLE-003", 1.0, 30.0, (0, 0, 0)),
                _hole("HOLE-001", 1.0, 30.0, (5, 0, 0)),
            ]
        )
        flags = MachiningComplexityAnalyzer(config).flags(features)
        assert [f.feature_id for f in flags] == sorted(f.feature_id for f in flags)


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------


class TestStock:
    def _model(self) -> ShapeModel:
        model = ShapeModel()
        model.bbox_min = (0.0, 0.0, 0.0)
        model.bbox_max = (120.0, 80.0, 35.0)
        return model

    def test_allowance_is_applied_to_both_sides_of_each_axis(self, config):
        stock = StockAnalyzer(config).analyze(
            self._model(), MassProperties(volume_mm3=182450.0)
        )
        assert stock.stock_dimensions_mm.length == 125.0
        assert stock.stock_dimensions_mm.width == 85.0
        assert stock.stock_dimensions_mm.height == 40.0

    def test_removal_ratio_is_removed_over_stock(self, config):
        stock = StockAnalyzer(config).analyze(
            self._model(), MassProperties(volume_mm3=182450.0)
        )
        assert stock.stock_volume_mm3 == pytest.approx(425000.0)
        assert stock.removed_volume_mm3 == pytest.approx(242550.0)
        assert stock.material_removal_ratio == pytest.approx(0.5707, abs=1e-4)

    def test_allowance_is_configurable(self):
        stock = StockAnalyzer(MachiningConfig(stock_allowance_mm=10.0)).analyze(
            self._model(), MassProperties(volume_mm3=1000.0)
        )
        assert stock.stock_dimensions_mm.length == 140.0

    def test_dimensions_can_be_rounded_up_to_an_increment(self):
        stock = StockAnalyzer(
            MachiningConfig(stock_allowance_mm=2.5, stock_round_up_to_mm=5.0)
        ).analyze(self._model(), MassProperties(volume_mm3=1000.0))
        assert stock.stock_dimensions_mm.length == 125.0
        assert stock.stock_dimensions_mm.height == 40.0

    def test_result_is_always_marked_as_an_estimate(self, config):
        stock = StockAnalyzer(config).analyze(self._model(), MassProperties(volume_mm3=1.0))
        assert stock.estimated is True
        assert "not a commercially purchased stock size" in stock.note.lower()

    def test_degenerate_bounding_box_returns_no_estimate(self, config):
        empty = ShapeModel()
        assert StockAnalyzer(config).analyze(empty, MassProperties()) is None


# ---------------------------------------------------------------------------
# Thin walls
# ---------------------------------------------------------------------------


def _wall_face(face_id, normal, z, x0=0.0, x1=50.0) -> FaceRecord:
    return FaceRecord(
        id=face_id,
        surface_type=PLANE,
        normal=normal,
        bbox_min=(x0, 0.0, z),
        bbox_max=(x1, 30.0, z),
        centroid=((x0 + x1) / 2, 15.0, z),
        area_mm2=(x1 - x0) * 30.0,
    )


class TestThinWalls:
    def _model_with(self, faces) -> ShapeModel:
        model = ShapeModel()
        model.faces = {f.id: f for f in faces}
        return model

    def test_opposed_faces_closer_than_the_threshold_count_as_a_wall(self, config):
        model = self._model_with(
            [_wall_face(1, (0, 0, 1), 1.0), _wall_face(2, (0, 0, -1), 0.0)]
        )
        assert ThinWallAnalyzer(config).count(model, []) == 1

    def test_thick_walls_are_not_counted(self, config):
        model = self._model_with(
            [_wall_face(1, (0, 0, 1), 20.0), _wall_face(2, (0, 0, -1), 0.0)]
        )
        assert ThinWallAnalyzer(config).count(model, []) == 0

    def test_faces_pointing_the_same_way_are_not_a_wall(self, config):
        model = self._model_with(
            [_wall_face(1, (0, 0, 1), 1.0), _wall_face(2, (0, 0, 1), 0.0)]
        )
        assert ThinWallAnalyzer(config).count(model, []) == 0

    def test_non_overlapping_faces_are_not_a_wall(self, config):
        model = self._model_with(
            [
                _wall_face(1, (0, 0, 1), 1.0, x0=0.0, x1=10.0),
                _wall_face(2, (0, 0, -1), 0.0, x0=90.0, x1=100.0),
            ]
        )
        assert ThinWallAnalyzer(config).count(model, []) == 0

    def test_threshold_is_configurable(self):
        model = ShapeModel()
        faces = [_wall_face(1, (0, 0, 1), 4.0), _wall_face(2, (0, 0, -1), 0.0)]
        model.faces = {f.id: f for f in faces}
        assert ThinWallAnalyzer(MachiningConfig(thin_wall_thickness_mm=5.0)).count(
            model, []
        ) == 1


# ---------------------------------------------------------------------------
# Complexity indicators
# ---------------------------------------------------------------------------


class TestComplexityIndicators:
    def test_indicators_are_counts_only_and_carry_no_score(self, config):
        features = FeatureCollection(
            holes=[_hole("HOLE-001", 6.0, 12.0, (0, 0, 0))],
            pockets=[_pocket("POCKET-001", 50, 25, 8, corner=3.0)],
        )
        indicators = ComplexityIndicatorBuilder(config).build(
            features, SurfaceSummary(freeform_faces=2), [], [], [], 0
        )
        assert indicators.hole_count == 1
        assert indicators.pocket_count == 1
        assert indicators.freeform_surface_count == 2
        assert indicators.feature_count_total == 2
        payload = indicators.model_dump()
        forbidden = ("score", "price", "cost", "difficulty", "rate", "time")
        assert not [k for k in payload if any(word in k for word in forbidden)]

    def test_deep_hole_count_comes_from_the_flags(self, config):
        analyzer = MachiningComplexityAnalyzer(config)
        features = FeatureCollection(holes=[_hole("HOLE-001", 6.0, 48.0, (0, 0, 0))])
        flags = analyzer.flags(features)
        indicators = ComplexityIndicatorBuilder(config).build(
            features, SurfaceSummary(), flags, [], [], 0
        )
        assert indicators.deep_hole_count == 1

    def test_distinct_hole_diameters_are_counted_once_each(self, config):
        features = FeatureCollection(
            holes=[
                _hole("HOLE-001", 6.0, 12.0, (0, 0, 0)),
                _hole("HOLE-002", 6.0, 12.0, (10, 0, 0)),
                _hole("HOLE-003", 8.0, 12.0, (20, 0, 0)),
            ]
        )
        indicators = ComplexityIndicatorBuilder(config).build(
            features, SurfaceSummary(), [], [], [], 0
        )
        assert indicators.distinct_hole_diameter_count == 2


# ---------------------------------------------------------------------------
# Threads
# ---------------------------------------------------------------------------


class TestThreadDesignationParsing:
    @pytest.fixture
    def detector(self, config) -> ThreadDetector:
        return ThreadDetector(config)

    def test_metric_designation_with_pitch(self, detector):
        assert detector.parse_designation("TAPPED HOLE M8x1.25") == ("M8x1.25", 8.0, 1.25)

    def test_metric_designation_without_pitch(self, detector):
        assert detector.parse_designation("M6 THREAD") == ("M6", 6.0, None)

    def test_imperial_designation_is_passed_through_as_text(self, detector):
        designation, diameter, pitch = detector.parse_designation("1/4-20 UNC")
        assert designation.startswith("1/4-20")
        # Not converted to millimetres: the file did not state a metric size.
        assert diameter is None and pitch is None

    def test_plain_text_yields_nothing(self, detector):
        assert detector.parse_designation("BRACKET ASSEMBLY") is None

    def test_a_bare_diameter_is_never_read_as_a_thread(self, detector):
        # The tap-drill size for M8 is 6.8 mm; that inference is forbidden.
        assert detector.parse_designation("6.8") is None
        assert detector.parse_designation("HOLE 6.8 DIA") is None

    def test_helix_measurement_recovers_pitch(self, detector):
        radius, pitch, turns = 4.0, 1.25, 3.0
        samples = []
        steps = 60
        for i in range(steps + 1):
            angle = 2 * math.pi * turns * i / steps
            samples.append(
                (radius * math.cos(angle), radius * math.sin(angle), pitch * turns * i / steps)
            )
        measured = detector._measure_helix(samples, (0, 0, 1), (0, 0, 0), radius)
        assert measured is not None
        measured_turns, measured_pitch = measured
        assert measured_turns == pytest.approx(turns, abs=0.05)
        assert measured_pitch == pytest.approx(pitch, abs=0.05)

    def test_a_plain_circle_is_not_a_helix(self, detector):
        samples = [
            (5 * math.cos(a), 5 * math.sin(a), 0.0)
            for a in [i * math.pi / 8 for i in range(17)]
        ]
        assert detector._measure_helix(samples, (0, 0, 1), (0, 0, 0), 5.0) is None

    def test_a_curve_off_the_cylinder_is_not_a_helix(self, detector):
        samples = [(0.0, 0.0, z) for z in range(10)]
        assert detector._measure_helix(samples, (0, 0, 1), (0, 0, 0), 5.0) is None

    def test_metadata_threads_are_marked_explicit(self, detector):
        threads = detector._from_metadata(["POCKET", "M10x1.5 TAPPED"], 0)
        assert len(threads) == 1
        assert threads[0].designation == "M10x1.5"
        assert threads[0].confidence.value == "explicit"


# ---------------------------------------------------------------------------
# Helix accumulation across fragmented coaxial thread faces
# ---------------------------------------------------------------------------


def _helix_samples(radius, pitch, turns, start_turn=0.0, steps=12):
    """Sample points on a helix of ``radius``/``pitch`` from ``start_turn``.

    Mirrors the construction used by ``test_helix_measurement_recovers_pitch``
    above, but allows slicing out an arbitrary sub-span of turns so a single
    continuous helix can be cut into several short fragments - exactly what a
    kernel does when it splits a modelled thread into many small coaxial
    "wedge" faces.
    """
    samples = []
    for i in range(steps + 1):
        turn = start_turn + turns * i / steps
        angle = 2 * math.pi * turn
        samples.append(
            (radius * math.cos(angle), radius * math.sin(angle), pitch * turn)
        )
    return samples


def _cylinder_face(face_id, radius, edge_ids, axis=(0.0, 0.0, 1.0), axis_location=(0.0, 0.0, 0.0)):
    return FaceRecord(
        id=face_id,
        surface_type=CYLINDER,
        radius_mm=radius,
        axis=axis,
        axis_location=axis_location,
        edge_ids=edge_ids,
        bbox_min=(-radius, -radius, 0.0),
        bbox_max=(radius, radius, 100.0),
    )


class TestHelixAccumulationAcrossFragments:
    """Regression coverage for the fragmented-thread accumulation fix.

    A real, genuinely helical thread is sometimes modelled as one continuous
    edge on one cylindrical face (turns >= 1 already, on its own), and
    sometimes fragmented by the CAD kernel into many small coaxial wedge
    faces, each carrying a short helical edge covering only a fraction of a
    turn. Both must be recognised; a family whose accumulated turns never
    reach a full turn, or whose edges are not actually helical, must not be.
    """

    @pytest.fixture
    def detector(self, config) -> ThreadDetector:
        return ThreadDetector(config)

    def test_a_single_face_already_at_or_above_one_turn_is_unaffected(self, detector):
        # The pre-existing case this detector was written for: one face, one
        # edge, already >= 1 turn on its own. Must still be found, as a
        # family of size one.
        radius, pitch, turns = 4.0, 1.25, 1.5
        samples = _helix_samples(radius, pitch, turns)
        model = ShapeModel()
        model.edges[1] = EdgeRecord(id=1, samples=samples)
        model.faces[10] = _cylinder_face(10, radius, edge_ids=[1])

        evidence = detector._find_helices(model)
        assert len(evidence) == 1
        assert evidence[0].face_ids == [10]
        assert evidence[0].edge_ids == [1]
        assert evidence[0].turns == pytest.approx(turns, abs=0.05)
        assert evidence[0].pitch_mm == pytest.approx(pitch, abs=0.05)

    def test_many_sub_turn_fragments_on_the_same_axis_accumulate_to_a_thread(
        self, detector
    ):
        # The real-world case: a thread split into several small coaxial
        # cylindrical fragments, each with one short helical edge covering
        # well under one full turn individually, whose combined total
        # reaches >= 1 turn.
        radius, pitch = 1.5, 0.5
        turns_per_fragment = 0.3
        fragment_count = 5  # 5 * 0.3 = 1.5 turns combined
        model = ShapeModel()
        for i in range(fragment_count):
            edge_id = 100 + i
            face_id = 10 + i
            samples = _helix_samples(
                radius, pitch, turns_per_fragment, start_turn=turns_per_fragment * i
            )
            model.edges[edge_id] = EdgeRecord(id=edge_id, samples=samples)
            model.faces[face_id] = _cylinder_face(face_id, radius, edge_ids=[edge_id])

        evidence = detector._find_helices(model)
        assert len(evidence) == 1
        result = evidence[0]
        assert result.face_ids == [10, 11, 12, 13, 14]
        assert sorted(result.edge_ids) == [100, 101, 102, 103, 104]
        assert result.turns == pytest.approx(fragment_count * turns_per_fragment, abs=0.05)
        assert result.pitch_mm == pytest.approx(pitch, abs=0.05)

    def test_fragments_whose_combined_total_stays_under_one_turn_are_rejected(
        self, detector
    ):
        # Same fragmentation pattern, but too few fragments for the family to
        # ever reach a full turn - must not be admitted just because there
        # happen to be several small pieces on the same axis.
        radius, pitch = 1.5, 0.5
        turns_per_fragment = 0.3
        fragment_count = 2  # 2 * 0.3 = 0.6 turns combined, below the threshold
        model = ShapeModel()
        for i in range(fragment_count):
            edge_id = 200 + i
            face_id = 20 + i
            samples = _helix_samples(
                radius, pitch, turns_per_fragment, start_turn=turns_per_fragment * i
            )
            model.edges[edge_id] = EdgeRecord(id=edge_id, samples=samples)
            model.faces[face_id] = _cylinder_face(face_id, radius, edge_ids=[edge_id])

        assert detector._find_helices(model) == []

    def test_non_helical_fragments_on_the_same_axis_are_never_admitted(self, detector):
        # Several small coaxial cylindrical faces, each bounded by a plain
        # circular arc (constant height, no rise) rather than a helix. No
        # amount of fragmentation should turn non-helical geometry into a
        # thread.
        radius = 2.0
        model = ShapeModel()
        for i in range(6):
            edge_id = 300 + i
            face_id = 30 + i
            angles = [j * math.pi / 8 for j in range(9)]
            samples = [(radius * math.cos(a), radius * math.sin(a), 0.0) for a in angles]
            model.edges[edge_id] = EdgeRecord(id=edge_id, samples=samples)
            model.faces[face_id] = _cylinder_face(face_id, radius, edge_ids=[edge_id])

        assert detector._find_helices(model) == []

    def test_a_family_relates_to_a_hole_via_any_member_face(self, detector):
        radius, pitch = 1.5, 0.5
        turns_per_fragment = 0.3
        model = ShapeModel()
        for i in range(4):
            edge_id = 400 + i
            face_id = 40 + i
            samples = _helix_samples(
                radius, pitch, turns_per_fragment, start_turn=turns_per_fragment * i
            )
            model.edges[edge_id] = EdgeRecord(id=edge_id, samples=samples)
            model.faces[face_id] = _cylinder_face(face_id, radius, edge_ids=[edge_id])

        hole = _hole("HOLE-001", diameter=3.0, depth=10.0, position=(0.0, 0.0, 0.0))
        # The hole only references one of the family's fragment faces - the
        # relationship must still be found via that single overlapping id.
        hole.face_ids = [42]

        threads = detector.detect(model, holes=[hole])
        assert len(threads) == 1
        assert threads[0].thread_type == "internal_thread"
        assert threads[0].related_feature_id == "HOLE-001"
        assert threads[0].face_ids == [40, 41, 42, 43]

    def test_cad_metadata_thread_path_is_unaffected(self, detector):
        # The metadata-declared thread path shares no code with the helix
        # accumulation change and must behave identically.
        model = ShapeModel()
        threads = detector.detect(model, holes=[], metadata_names=["M8x1.25 TAPPED"])
        assert len(threads) == 1
        assert threads[0].designation == "M8x1.25"
        assert threads[0].confidence.value == "explicit"
        assert threads[0].detection.method.value == "cad_metadata"


# ---------------------------------------------------------------------------
# Unit conversion
# ---------------------------------------------------------------------------


class TestUnitConversion:
    def test_lengths_areas_and_volumes_use_the_right_power(self):
        payload = {"a_mm": 25.4, "b_mm2": 25.4**2, "c_mm3": 25.4**3}
        converted = to_imperial(payload)
        assert converted["a_mm"] == pytest.approx(1.0)
        assert converted["b_mm2"] == pytest.approx(1.0)
        assert converted["c_mm3"] == pytest.approx(1.0)

    def test_direction_vectors_are_never_scaled(self):
        payload = {
            "axis": {"x": 0.0, "y": 0.0, "z": 1.0},
            "normal": {"x": 1.0, "y": 0.0, "z": 0.0},
            "machining_direction": [0.0, 0.0, 1.0],
        }
        converted = to_imperial(payload)
        assert converted["axis"]["z"] == 1.0
        assert converted["normal"]["x"] == 1.0
        assert converted["machining_direction"] == [0.0, 0.0, 1.0]

    def test_positions_are_converted_componentwise(self):
        converted = to_imperial({"position": {"x": 25.4, "y": 50.8, "z": 0.0}})
        assert converted["position"]["x"] == pytest.approx(1.0)
        assert converted["position"]["y"] == pytest.approx(2.0)

    def test_bare_dimension_keys_inside_a_suffixed_parent_are_converted(self):
        converted = to_imperial(
            {"stock_dimensions_mm": {"length": 25.4, "width": 50.8, "height": 76.2}}
        )
        assert converted["stock_dimensions_mm"]["length"] == pytest.approx(1.0)
        assert converted["stock_dimensions_mm"]["height"] == pytest.approx(3.0)

    def test_stock_form_converts_lengths_but_not_ratios(self):
        converted = to_imperial(
            {
                "stock_form": {
                    "form": "PLATE",
                    "bounds_method": "obb",
                    "sorted_dimensions_mm": {
                        "length": 25.4,
                        "width": 50.8,
                        "height": 76.2,
                    },
                    "thickness_mm": 25.4,
                    "flatness_ratio": 0.25,
                    "slenderness_ratio": 0.5,
                    "cross_section_ratio": 0.75,
                    "round_evidence": {
                        "face_id": 7,
                        "radius_mm": 25.4,
                        "axis": [0.0, 0.0, 1.0],
                        "axial_coverage": 0.95,
                    },
                }
            }
        )["stock_form"]
        assert converted["thickness_mm"] == pytest.approx(1.0)
        assert converted["sorted_dimensions_mm"]["width"] == pytest.approx(2.0)
        assert converted["round_evidence"]["radius_mm"] == pytest.approx(1.0)
        # Ratios and the axis direction are dimensionless.
        assert converted["flatness_ratio"] == 0.25
        assert converted["cross_section_ratio"] == 0.75
        assert converted["round_evidence"]["axis"] == [0.0, 0.0, 1.0]
        assert converted["round_evidence"]["axial_coverage"] == 0.95
        assert converted["form"] == "PLATE"
        assert converted["bounds_method"] == "obb"

    def test_nested_feature_lists_are_converted(self):
        converted = to_imperial({"features": {"holes": [{"diameter_mm": 25.4}]}})
        assert converted["features"]["holes"][0]["diameter_mm"] == pytest.approx(1.0)

    def test_non_numeric_values_pass_through_untouched(self):
        converted = to_imperial({"id_mm": None, "subtype": "through", "through": True})
        assert converted == {"id_mm": None, "subtype": "through", "through": True}

    def test_booleans_are_not_treated_as_numbers(self):
        assert to_imperial({"closed": True})["closed"] is True
