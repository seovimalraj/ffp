"""Detector tests against real B-Rep geometry.

Each test builds a STEP file whose expected features follow directly from its
construction, then asserts the pipeline recovers them. Skipped when no CAD
kernel is installed.
"""

from __future__ import annotations

import pytest

from . import fixtures
from .conftest import requires_kernel

pytestmark = requires_kernel


# ---------------------------------------------------------------------------
# Geometry and model information
# ---------------------------------------------------------------------------


class TestGeometryExtraction:
    def test_volume_matches_the_exact_analytical_value(self, analyze, step_dir):
        # 100 x 60 x 20 block minus a 10 mm through hole.
        result = analyze(fixtures.simple_block_with_through_hole(step_dir))
        import math

        expected = 100 * 60 * 20 - math.pi * 5.0**2 * 20
        assert result["geometry"]["volume_mm3"] == pytest.approx(expected, rel=1e-4)

    def test_bounding_box_matches_the_construction(self, analyze, step_dir):
        box = analyze(fixtures.simple_block_with_through_hole(step_dir))["geometry"][
            "bounding_box"
        ]
        assert (box["length_mm"], box["width_mm"], box["height_mm"]) == (100.0, 60.0, 20.0)

    def test_centre_of_mass_shifts_away_from_the_hole(self, analyze, step_dir):
        # The hole sits at x=30, so material is removed from the -X half and the
        # centroid moves towards +X of the 50 mm midpoint.
        com = analyze(fixtures.simple_block_with_through_hole(step_dir))["geometry"][
            "center_of_mass"
        ]
        assert com["x"] > 50.0
        assert com["y"] == pytest.approx(30.0, abs=1e-6)

    def test_surface_area_is_positive_and_from_the_kernel(self, analyze, step_dir):
        geometry = analyze(fixtures.simple_block_with_through_hole(step_dir))["geometry"]
        assert geometry["surface_area_mm2"] > 0
        assert geometry["source"] == "GEOMETRY"

    def test_moments_of_inertia_are_reported(self, analyze, step_dir):
        inertia = analyze(fixtures.simple_block_with_through_hole(step_dir))["geometry"][
            "moments_of_inertia"
        ]
        assert inertia is not None and inertia["ixx"] > 0

    def test_model_counts_are_populated(self, analyze, step_dir):
        model = analyze(fixtures.simple_block_with_through_hole(step_dir))["model"]
        assert model["solid_count"] == 1
        assert model["face_count"] == 7  # six planes plus one bore wall
        assert model["edge_count"] > 0
        assert model["vertex_count"] > 0
        assert model["is_multi_body"] is False

    def test_a_closed_solid_reports_no_open_shells(self, analyze, step_dir):
        # The cylinder's seam edge is bounded twice by one face and must not be
        # mistaken for a hole in the shell.
        model = analyze(fixtures.simple_block_with_through_hole(step_dir))["model"]
        assert model["has_open_shells"] is False


class TestSurfaceClassification:
    def test_face_types_are_counted(self, analyze, step_dir):
        summary = analyze(fixtures.simple_block_with_through_hole(step_dir))[
            "surface_summary"
        ]
        assert summary["planar_faces"] == 6
        assert summary["cylindrical_faces"] == 1
        assert summary["total_faces"] == 7

    def test_a_bore_wall_is_classified_as_internal(self, analyze, step_dir):
        summary = analyze(fixtures.simple_block_with_through_hole(step_dir))[
            "surface_summary"
        ]
        assert summary["internal_cylindrical_faces"] == 1
        assert summary["external_cylindrical_faces"] == 0

    def test_a_boss_wall_is_classified_as_external(self, analyze, step_dir):
        summary = analyze(fixtures.plate_with_boss(step_dir))["surface_summary"]
        assert summary["external_cylindrical_faces"] == 1
        assert summary["internal_cylindrical_faces"] == 0

    def test_face_details_are_omitted_by_default(self, analyze, step_dir):
        result = analyze(fixtures.simple_block_with_through_hole(step_dir))
        assert result["face_details"] is None

    def test_face_details_are_returned_on_request(self, analyze, step_dir):
        result = analyze(
            fixtures.simple_block_with_through_hole(step_dir), include_face_details=True
        )
        details = result["face_details"]
        assert len(details) == 7
        cylinder = next(d for d in details if d["surface_type"] == "CYLINDER")
        assert cylinder["radius_mm"] == pytest.approx(5.0)
        assert cylinder["is_internal"] is True
        assert cylinder["axis"] is not None


# ---------------------------------------------------------------------------
# Holes
# ---------------------------------------------------------------------------


class TestHoleDetector:
    def test_a_through_hole_is_measured_and_typed(self, analyze, step_dir):
        holes = analyze(fixtures.simple_block_with_through_hole(step_dir))["features"][
            "holes"
        ]
        assert len(holes) == 1
        hole = holes[0]
        assert hole["subtype"] == "through"
        assert hole["through"] is True
        assert hole["diameter_mm"] == pytest.approx(10.0)
        assert hole["depth_mm"] == pytest.approx(20.0, abs=1e-3)
        assert hole["depth_diameter_ratio"] == pytest.approx(2.0, abs=1e-3)

    def test_hole_axis_and_entry_position_are_correct(self, analyze, step_dir):
        hole = analyze(fixtures.simple_block_with_through_hole(step_dir))["features"][
            "holes"
        ][0]
        assert hole["axis"]["z"] == pytest.approx(1.0)
        assert (hole["position"]["x"], hole["position"]["y"]) == pytest.approx((30.0, 30.0))
        assert hole["position"]["z"] == pytest.approx(20.0, abs=1e-3)

    def test_a_blind_hole_is_recognised_by_its_closing_face(self, analyze, step_dir):
        hole = analyze(fixtures.block_with_blind_hole(step_dir))["features"]["holes"][0]
        assert hole["subtype"] == "blind"
        assert hole["through"] is False
        assert hole["depth_mm"] == pytest.approx(12.0, abs=1e-3)
        assert hole["diameter_mm"] == pytest.approx(8.0)

    def test_a_blind_hole_axis_points_out_of_the_hole(self, analyze, step_dir):
        # The tool retracts away from the closed end.
        hole = analyze(fixtures.block_with_blind_hole(step_dir))["features"]["holes"][0]
        assert hole["axis"]["z"] == pytest.approx(1.0)

    def test_a_counterbore_is_identified_not_just_reported_as_stepped(
        self, analyze, step_dir
    ):
        hole = analyze(fixtures.block_with_counterbored_hole(step_dir))["features"][
            "holes"
        ][0]
        assert hole["subtype"] == "counterbore"
        assert hole["has_counterbore"] is True
        assert hole["is_stepped"] is True
        assert hole["counterbore_diameter_mm"] == pytest.approx(12.0)
        assert hole["counterbore_depth_mm"] == pytest.approx(5.0, abs=1e-3)
        assert hole["diameter_mm"] == pytest.approx(6.0)

    def test_a_counterbore_shoulder_is_not_mistaken_for_a_hole_bottom(
        self, analyze, step_dir
    ):
        # The annulus between the two diameters is planar and perpendicular to
        # the axis, exactly like a blind bottom; only its adjacency differs.
        hole = analyze(fixtures.block_with_counterbored_hole(step_dir))["features"][
            "holes"
        ][0]
        assert hole["through"] is True

    def test_stepped_geometry_lists_each_diameter(self, analyze, step_dir):
        hole = analyze(fixtures.block_with_counterbored_hole(step_dir))["features"][
            "holes"
        ][0]
        diameters = sorted(step["diameter_mm"] for step in hole["steps"])
        assert diameters == pytest.approx([6.0, 12.0])

    def test_multiple_holes_are_found_separately(self, analyze, step_dir):
        holes = analyze(fixtures.plate_with_hole_pattern(step_dir))["features"]["holes"]
        assert len(holes) == 4
        assert len({h["id"] for h in holes}) == 4
        assert all(h["diameter_mm"] == pytest.approx(6.0) for h in holes)

    def test_an_external_cylinder_is_never_reported_as_a_hole(self, analyze, step_dir):
        result = analyze(fixtures.plate_with_boss(step_dir))
        assert result["features"]["holes"] == []
        assert result["features"]["bores"] == []

    def test_every_hole_carries_its_detection_evidence(self, analyze, step_dir):
        hole = analyze(fixtures.simple_block_with_through_hole(step_dir))["features"][
            "holes"
        ][0]
        assert hole["detection"]["method"] == "coaxial_grouping"
        assert 0.0 < hole["detection"]["confidence"] <= 1.0
        assert hole["detection"]["evidence"]
        assert hole["detection"]["source"] == "GEOMETRY"


# ---------------------------------------------------------------------------
# Pockets and slots
# ---------------------------------------------------------------------------


class TestPocketDetector:
    def test_a_rectangular_pocket_is_measured(self, analyze, step_dir):
        pockets = analyze(fixtures.block_with_pocket(step_dir))["features"]["pockets"]
        assert len(pockets) == 1
        pocket = pockets[0]
        assert pocket["length_mm"] == pytest.approx(50.0, abs=1e-3)
        assert pocket["width_mm"] == pytest.approx(25.0, abs=1e-3)
        assert pocket["depth_mm"] == pytest.approx(8.0, abs=1e-3)

    def test_pocket_machining_direction_is_the_floor_normal(self, analyze, step_dir):
        pocket = analyze(fixtures.block_with_pocket(step_dir))["features"]["pockets"][0]
        assert pocket["machining_direction"] == pytest.approx([0.0, 0.0, 1.0])
        assert pocket["bottom_type"] == "planar"

    def test_pocket_walls_are_not_themselves_reported_as_pockets(
        self, analyze, step_dir
    ):
        # A wall is recessed and has perpendicular neighbours just like a floor;
        # only the ray probe separates them.
        result = analyze(fixtures.block_with_pocket(step_dir))
        assert len(result["features"]["pockets"]) == 1
        assert result["features"]["slots"] == []

    def test_a_closed_pocket_is_marked_closed(self, analyze, step_dir):
        pocket = analyze(fixtures.block_with_pocket(step_dir))["features"]["pockets"][0]
        assert pocket["closed"] is True
        assert pocket["wall_count"] >= 3

    def test_a_flat_top_face_is_not_a_pocket(self, analyze, step_dir):
        assert analyze(fixtures.simple_block_with_through_hole(step_dir))["features"][
            "pockets"
        ] == []


class TestSlotDetector:
    def test_an_elongated_recess_is_a_slot_not_a_pocket(self, analyze, step_dir):
        result = analyze(fixtures.block_with_slot(step_dir))
        assert len(result["features"]["slots"]) == 1
        assert result["features"]["pockets"] == []

    def test_slot_dimensions_and_orientation(self, analyze, step_dir):
        slot = analyze(fixtures.block_with_slot(step_dir))["features"]["slots"][0]
        assert slot["length_mm"] == pytest.approx(64.0, abs=1e-3)
        assert slot["width_mm"] == pytest.approx(8.0, abs=1e-3)
        assert slot["depth_mm"] == pytest.approx(5.0, abs=1e-3)
        assert abs(slot["orientation"]["x"]) == pytest.approx(1.0, abs=1e-6)

    def test_slot_subtype_is_reported(self, analyze, step_dir):
        slot = analyze(fixtures.block_with_slot(step_dir))["features"]["slots"][0]
        assert slot["subtype"] in (
            "blind_slot",
            "through_slot",
            "rounded_end_slot",
            "t_slot",
        )

    def test_aspect_ratio_threshold_is_configurable(self, parser, step_dir):
        # Raising the threshold above 8:1 reclassifies the same recess a pocket.
        from app.machining.config import MachiningConfig
        from app.machining.schemas import MachiningAnalysisOptions
        from app.machining.service import analyze_machining
        import os

        path = fixtures.block_with_slot(step_dir)
        loaded = parser.load(path, os.path.basename(path), os.path.getsize(path), "0")
        result = analyze_machining(
            loaded, MachiningAnalysisOptions(), MachiningConfig(slot_min_aspect_ratio=20.0)
        )
        assert result["features"]["slots"] == []
        assert len(result["features"]["pockets"]) == 1


# ---------------------------------------------------------------------------
# Bosses, fillets, chamfers
# ---------------------------------------------------------------------------


class TestBossDetector:
    def test_a_raised_cylinder_is_a_boss(self, analyze, step_dir):
        bosses = analyze(fixtures.plate_with_boss(step_dir))["features"]["bosses"]
        assert len(bosses) == 1
        boss = bosses[0]
        assert boss["diameter_mm"] == pytest.approx(30.0)
        assert boss["height_mm"] == pytest.approx(12.0, abs=1e-3)
        assert boss["axis"]["z"] == pytest.approx(1.0)

    def test_a_bore_is_not_reported_as_a_boss(self, analyze, step_dir):
        assert analyze(fixtures.simple_block_with_through_hole(step_dir))["features"][
            "bosses"
        ] == []


class TestFilletDetector:
    def test_tangent_blends_are_found_with_their_radius(self, analyze, step_dir):
        features = analyze(fixtures.filleted_block(step_dir))["features"]
        assert len(features["fillets"]) == 4
        assert all(f["radius_mm"] == pytest.approx(5.0) for f in features["fillets"])

    def test_fillet_summary_aggregates_radii(self, analyze, step_dir):
        summary = analyze(fixtures.filleted_block(step_dir))["features"]["fillet_summary"]
        assert summary["count"] == 4
        assert summary["unique_radii_mm"] == [5.0]
        assert summary["minimum_radius_mm"] == pytest.approx(5.0)

    def test_external_fillets_do_not_constrain_tool_diameter(self, analyze, step_dir):
        # Only concave corners cap the tool; a rounded outside edge does not.
        summary = analyze(fixtures.filleted_block(step_dir))["features"]["fillet_summary"]
        assert summary["minimum_internal_radius_mm"] is None

    def test_a_bore_wall_is_not_reported_as_a_fillet(self, analyze, step_dir):
        assert analyze(fixtures.simple_block_with_through_hole(step_dir))["features"][
            "fillets"
        ] == []

    def test_a_plain_block_has_no_blends(self, analyze, step_dir):
        features = analyze(fixtures.block_with_pocket(step_dir))["features"]
        assert features["fillets"] == []
        assert features["chamfers"] == []


# ---------------------------------------------------------------------------
# Threads
# ---------------------------------------------------------------------------


class TestThreadDetector:
    def test_a_plain_hole_is_never_called_threaded(self, analyze, step_dir):
        # A 6.8 mm hole is the tap drill for M8, and must still not be reported
        # as an M8 thread.
        assert analyze(fixtures.block_with_blind_hole(step_dir))["features"]["threads"] == []

    def test_no_thread_designation_is_invented_from_diameter(self, analyze, step_dir):
        for thread in analyze(fixtures.plate_with_hole_pattern(step_dir))["features"][
            "threads"
        ]:
            assert thread["designation"] is None or thread["confidence"] == "explicit"


# ---------------------------------------------------------------------------
# Patterns, accessibility, setups, stock, indicators
# ---------------------------------------------------------------------------


class TestPatternsOnRealGeometry:
    def test_four_identical_holes_form_one_group(self, analyze, step_dir):
        patterns = analyze(fixtures.plate_with_hole_pattern(step_dir))["feature_patterns"]
        assert len(patterns) == 1
        assert patterns[0]["feature_count"] == 4
        assert patterns[0]["type"] == "repeated_hole"
        assert patterns[0]["diameter_mm"] == pytest.approx(6.0)

    def test_a_square_layout_is_named_rectangular(self, analyze, step_dir):
        pattern = analyze(fixtures.plate_with_hole_pattern(step_dir))["feature_patterns"][0]
        assert pattern["pattern_type"] == "rectangular"

    def test_the_individual_features_are_still_returned(self, analyze, step_dir):
        result = analyze(fixtures.plate_with_hole_pattern(step_dir))
        assert len(result["features"]["holes"]) == 4
        assert result["feature_patterns"][0]["feature_ids"] == [
            h["id"] for h in result["features"]["holes"]
        ]


class TestAccessibility:
    def test_a_through_hole_is_reachable_from_both_ends(self, analyze, step_dir):
        entry = analyze(fixtures.simple_block_with_through_hole(step_dir))["accessibility"][0]
        assert entry["accessibility"]["+Z"] is True
        assert entry["accessibility"]["-Z"] is True

    def test_a_blind_hole_is_reachable_only_from_its_open_end(self, analyze, step_dir):
        entry = analyze(fixtures.block_with_blind_hole(step_dir))["accessibility"][0]
        assert entry["accessibility"]["+Z"] is True
        assert entry["accessibility"]["-Z"] is False
        assert entry["accessible_direction_count"] == 1

    def test_side_directions_are_blocked_by_material(self, analyze, step_dir):
        entry = analyze(fixtures.block_with_blind_hole(step_dir))["accessibility"][0]
        assert entry["accessibility"]["+X"] is False
        assert entry["accessibility"]["-Y"] is False

    def test_a_pocket_is_reachable_only_from_above(self, analyze, step_dir):
        entry = analyze(fixtures.block_with_pocket(step_dir))["accessibility"][0]
        assert entry["accessibility"]["+Z"] is True
        assert entry["accessible_direction_count"] == 1

    def test_all_six_principal_directions_are_reported(self, analyze, step_dir):
        entry = analyze(fixtures.simple_block_with_through_hole(step_dir))["accessibility"][0]
        assert set(entry["accessibility"]) == {"+X", "-X", "+Y", "-Y", "+Z", "-Z"}

    def test_accessibility_is_measured_by_ray_casting(self, analyze, step_dir):
        entry = analyze(fixtures.simple_block_with_through_hole(step_dir))["accessibility"][0]
        assert entry["detection"]["method"] == "ray_casting"


class TestSetupAnalysis:
    def test_directions_are_ranked_by_feature_count(self, analyze, step_dir):
        setup = analyze(fixtures.plate_with_hole_pattern(step_dir))["setup_analysis"]
        counts = [d["accessible_feature_count"] for d in setup["candidate_directions"]]
        assert counts == sorted(counts, reverse=True)

    def test_a_single_direction_covers_a_single_sided_part(self, analyze, step_dir):
        setup = analyze(fixtures.plate_with_hole_pattern(step_dir))["setup_analysis"]
        assert setup["minimum_direction_count_covering_all"] == 1
        assert setup["requires_rotation"] is False

    def test_setup_analysis_is_labelled_as_evidence_not_a_plan(self, analyze, step_dir):
        setup = analyze(fixtures.plate_with_hole_pattern(step_dir))["setup_analysis"]
        assert "not a setup plan" in setup["note"].lower()


class TestStockAndIndicators:
    def test_stock_estimate_wraps_the_bounding_box(self, analyze, step_dir):
        result = analyze(fixtures.simple_block_with_through_hole(step_dir))
        stock = result["stock_analysis"]
        assert stock["stock_dimensions_mm"]["length"] == pytest.approx(105.0)
        assert stock["finished_volume_mm3"] == pytest.approx(
            result["geometry"]["volume_mm3"]
        )
        assert 0.0 < stock["material_removal_ratio"] < 1.0

    def test_deep_hole_is_flagged_with_its_ratio(self, analyze, step_dir):
        result = analyze(fixtures.deep_hole_block(step_dir))
        flags = {f["flag"] for f in result["machining_flags"]}
        assert "VERY_DEEP_HOLE" in flags
        assert result["complexity_indicators"]["deep_hole_count"] == 1

    def test_indicators_contain_no_score_or_price(self, analyze, step_dir):
        indicators = analyze(fixtures.block_with_pocket(step_dir))["complexity_indicators"]
        assert not [
            key
            for key in indicators
            if any(word in key for word in ("cost", "price", "score", "rate"))
        ]


# ---------------------------------------------------------------------------
# Validation and determinism
# ---------------------------------------------------------------------------


class TestValidationBehaviour:
    def test_multiple_solids_produce_a_warning_and_are_not_ignored(
        self, analyze, step_dir
    ):
        result = analyze(fixtures.two_body_assembly(step_dir))
        codes = {w["code"] for w in result["warnings"]}
        assert "MULTIPLE_SOLIDS" in codes
        assert result["model"]["solid_count"] == 2
        assert result["model"]["is_multi_body"] is True

    def test_a_corrupt_file_is_rejected(self, parser, tmp_path):
        from app.machining.parser import CADParseError

        bad = tmp_path / "broken.step"
        bad.write_text("this is not a STEP file at all")
        with pytest.raises(CADParseError) as exc:
            parser.load(str(bad), "broken.step", bad.stat().st_size, "0")
        assert exc.value.status_code in (400, 422)

    def test_an_empty_step_file_is_rejected(self, parser, tmp_path):
        from app.machining.parser import CADParseError

        bad = tmp_path / "empty.step"
        bad.write_text("ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n")
        with pytest.raises(CADParseError):
            parser.load(str(bad), "empty.step", bad.stat().st_size, "0")

    def test_face_count_limit_is_enforced(self, step_dir, config):
        import os
        from app.machining.config import MachiningConfig
        from app.machining.parser import CADParseError, CADParser

        tiny = CADParser(MachiningConfig(max_faces=2))
        path = fixtures.simple_block_with_through_hole(step_dir)
        with pytest.raises(CADParseError) as exc:
            tiny.load(path, "x.step", os.path.getsize(path), "0")
        assert exc.value.status_code == 422


class TestDeterminism:
    def test_the_same_file_produces_byte_identical_json(self, analyze, step_dir):
        import json

        path = fixtures.block_with_counterbored_hole(step_dir)
        first = analyze(path)
        second = analyze(path)
        # Timing fields legitimately differ between runs.
        for payload in (first, second):
            payload.pop("analysis_duration_ms", None)
        assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)

    def test_feature_ids_are_stable_across_runs(self, analyze, step_dir):
        path = fixtures.plate_with_hole_pattern(step_dir)
        first = [h["id"] for h in analyze(path)["features"]["holes"]]
        second = [h["id"] for h in analyze(path)["features"]["holes"]]
        assert first == second == ["HOLE-001", "HOLE-002", "HOLE-003", "HOLE-004"]


class TestOptions:
    def test_feature_details_can_be_suppressed(self, analyze, step_dir):
        result = analyze(
            fixtures.plate_with_hole_pattern(step_dir), include_feature_details=False
        )
        assert result["features"]["holes"] == []
        # Counts still flow through, so a consumer keeps the aggregate view.
        assert result["complexity_indicators"]["hole_count"] == 4

    def test_debug_geometry_is_opt_in(self, analyze, step_dir):
        assert (
            analyze(fixtures.block_with_pocket(step_dir))["debug_geometry"] is None
        )

    def test_debug_geometry_reports_adjacency_and_timings(self, analyze, step_dir):
        debug = analyze(
            fixtures.block_with_pocket(step_dir), include_debug_geometry=True
        )["debug_geometry"]
        assert debug["face_adjacency"]
        assert debug["detector_timings_ms"]
        assert debug["kernel"]

    def test_imperial_output_converts_lengths_and_labels_units(self, analyze, step_dir):
        result = analyze(
            fixtures.simple_block_with_through_hole(step_dir), unit_system="imperial"
        )
        assert result["units"] == "in"
        box = result["geometry"]["bounding_box"]
        assert box["length_mm"] == pytest.approx(100.0 / 25.4, rel=1e-6)
        hole = result["features"]["holes"][0]
        assert hole["diameter_mm"] == pytest.approx(10.0 / 25.4, rel=1e-6)
        # Direction vectors stay unit length.
        assert hole["axis"]["z"] == pytest.approx(1.0)

    def test_metric_is_the_default(self, analyze, step_dir):
        result = analyze(fixtures.simple_block_with_through_hole(step_dir))
        assert result["units"] == "mm"
