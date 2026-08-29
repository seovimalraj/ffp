"""Detector tests against real B-Rep geometry.

Each test builds a STEP file whose expected features follow directly from its
construction, then asserts the pipeline recovers them. Skipped when no CAD
kernel is installed.
"""

from __future__ import annotations

import math
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

    def test_a_bore_split_into_sub_threshold_arcs_is_still_found(
        self, analyze, step_dir
    ):
        # Every surviving arc is under the 180 deg wrap threshold on its own;
        # only summing the fragments of the segment recovers the hole.
        result = analyze(fixtures.block_with_hole_split_into_arcs(step_dir))
        holes = result["features"]["holes"]
        assert len(holes) == 1, "the fragmented bore was lost"
        assert holes[0]["diameter_mm"] == pytest.approx(20.0)

    def test_a_fragmented_bore_reports_its_summed_wrap(self, analyze, step_dir):
        hole = analyze(fixtures.block_with_hole_split_into_arcs(step_dir))["features"][
            "holes"
        ][0]
        assert len(hole["face_ids"]) > 1
        evidence = " ".join(hole["detection"]["evidence"])
        assert "summed across" in evidence

    def test_a_fragmented_bore_keeps_its_full_depth(self, analyze, step_dir):
        hole = analyze(fixtures.block_with_hole_split_into_arcs(step_dir))["features"][
            "holes"
        ][0]
        assert hole["depth_mm"] == pytest.approx(40.0, abs=1e-3)

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
        assert hole["detection"]["method"] in ("coaxial_grouping", "ray_casting")
        assert 0.0 < hole["detection"]["confidence"] <= 1.0
        assert hole["detection"]["evidence"]
        assert hole["detection"]["source"] == "GEOMETRY"

    def test_through_status_is_measured_not_inferred_from_a_missing_face(
        self, analyze, step_dir
    ):
        # Sampling for material past each end is a positive test; the absence of
        # a closing face is not, since an open shell looks identical.
        hole = analyze(fixtures.simple_block_with_through_hole(step_dir))["features"][
            "holes"
        ][0]
        evidence = " ".join(hole["detection"]["evidence"])
        assert "sampling for material" in evidence
        assert hole["detection"]["confidence"] >= 0.9

    def test_a_blind_hole_is_confirmed_by_two_independent_signals(
        self, analyze, step_dir
    ):
        # Closing face *and* material beyond it - the strongest case available.
        hole = analyze(fixtures.block_with_blind_hole(step_dir))["features"]["holes"][0]
        evidence = " ".join(hole["detection"]["evidence"])
        assert "confirmed by material beyond that end" in evidence
        assert hole["detection"]["confidence"] >= 0.95
        assert hole["status"] == "resolved"


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

    def test_flat_part_classifies_as_sheet(self, analyze, step_dir):
        form = analyze(fixtures.thin_sheet_part(step_dir))["stock_analysis"][
            "stock_form"
        ]
        assert form["form"] == "SHEET"
        assert form["thickness_mm"] == pytest.approx(2.0, abs=1e-6)
        assert form["round_evidence"] is None

    def test_round_bar_is_separated_from_square_bar(self, analyze, step_dir):
        """Identical extents - only the external cylinder tells them apart."""
        round_form = analyze(fixtures.round_bar_with_face_groove(step_dir))[
            "stock_analysis"
        ]["stock_form"]
        square_form = analyze(fixtures.square_bar(step_dir))["stock_analysis"][
            "stock_form"
        ]

        assert round_form["form"] == "ROUND_BAR"
        assert round_form["round_evidence"]["radius_mm"] == pytest.approx(
            10.0, abs=1e-6
        )
        assert square_form["form"] == "SQUARE_BAR"
        assert square_form["round_evidence"] is None

    def test_ring_turning_about_its_shortest_extent_is_round(self, analyze, step_dir):
        """A ring is nearly as tall as it is wide, so the ratios alone say
        block. The rotational axis is what makes it round stock."""
        form = analyze(fixtures.ring(step_dir))["stock_analysis"]["stock_form"]
        assert form["form"] == "ROUND_BAR"
        assert form["round_evidence"]["radius_mm"] == pytest.approx(19.45, abs=1e-6)

    def test_stepped_shaft_is_round_despite_several_diameters(
        self, analyze, step_dir
    ):
        """No single cylinder spans the part - the OD is a union of faces."""
        form = analyze(fixtures.stepped_shaft(step_dir))["stock_analysis"][
            "stock_form"
        ]
        assert form["form"] == "ROUND_BAR"
        # The stock diameter is the largest section, not the first one found.
        assert form["round_evidence"]["radius_mm"] == pytest.approx(1.76, abs=1e-6)

    def test_bent_bracket_is_sheet_not_block(self, analyze, step_dir):
        """Folding gives a sheet part the envelope of a block, so the wall is
        the only evidence left."""
        form = analyze(fixtures.bent_sheet_bracket(step_dir))["stock_analysis"][
            "stock_form"
        ]
        assert form["form"] == "SHEET"
        evidence = form["sheet_evidence"]
        assert evidence["wall_thickness_mm"] == pytest.approx(2.0, abs=0.05)
        assert evidence["formed"] is True

    def test_formed_enclosure_is_sheet(self, analyze, step_dir):
        form = analyze(fixtures.formed_sheet_enclosure(step_dir))["stock_analysis"][
            "stock_form"
        ]
        assert form["form"] == "SHEET"
        assert form["sheet_evidence"]["wall_thickness_mm"] == pytest.approx(
            2.0, abs=0.05
        )

    def test_solid_block_is_not_mistaken_for_sheet(self, analyze, step_dir):
        """The area guard has to hold, or every part becomes sheet."""
        form = analyze(fixtures.simple_block_with_through_hole(step_dir))[
            "stock_analysis"
        ]["stock_form"]
        assert form["form"] == "BLOCK"
        assert form["sheet_evidence"] is None

    def test_block_fixture_classifies_as_block(self, analyze, step_dir):
        form = analyze(fixtures.simple_block_with_through_hole(step_dir))[
            "stock_analysis"
        ]["stock_form"]
        assert form["form"] == "BLOCK"

    def test_stock_form_carries_no_material_or_cost(self, analyze, step_dir):
        form = analyze(fixtures.square_bar(step_dir))["stock_analysis"]["stock_form"]
        assert not [
            key
            for key in form
            if any(
                word in key
                for word in ("cost", "price", "material", "grade", "supplier")
            )
        ]

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

    def test_a_shell_only_file_is_repaired_rather_than_rejected(
        self, analyze, step_dir
    ):
        # The common `..._converted.stp` case: complete geometry that the
        # exporter never sewed into a solid.
        result = analyze(fixtures.shell_without_solid(step_dir))
        assert result["success"] is True
        assert result["model"]["solid_count"] == 1
        assert "GEOMETRY_REPAIRED" in {w["code"] for w in result["warnings"]}

    def test_a_repaired_model_still_measures_correctly(self, analyze, step_dir):
        import math

        result = analyze(fixtures.shell_without_solid(step_dir))
        expected = 100 * 60 * 20 - math.pi * 25 * 20
        assert result["geometry"]["volume_mm3"] == pytest.approx(expected, rel=1e-4)
        assert len(result["features"]["holes"]) == 1
        assert result["features"]["holes"][0]["subtype"] == "through"

    def test_the_repair_warning_says_what_was_changed(self, analyze, step_dir):
        warning = next(
            w
            for w in analyze(fixtures.shell_without_solid(step_dir))["warnings"]
            if w["code"] == "GEOMETRY_REPAIRED"
        )
        assert "sewn" in warning["message"]
        assert warning["detail"]["solids_after_repair"] == 1

    def test_a_genuine_surface_model_is_still_rejected(self, parser, step_dir):
        # Two loose faces cannot bound a volume, and sewing must not pretend
        # otherwise.
        import os

        from app.machining.parser import CADParseError

        path = fixtures.open_surface_patch(step_dir)
        with pytest.raises(CADParseError) as exc:
            parser.load(path, os.path.basename(path), os.path.getsize(path), "0")
        assert exc.value.code == "NO_SOLID_GEOMETRY"
        assert "sewing" in exc.value.message.lower()

    def test_repair_can_be_disabled(self, step_dir):
        import os

        from app.machining.config import MachiningConfig
        from app.machining.parser import CADParseError, CADParser

        strict = CADParser(MachiningConfig(repair_open_shells=False))
        path = fixtures.shell_without_solid(step_dir)
        with pytest.raises(CADParseError) as exc:
            strict.load(path, os.path.basename(path), os.path.getsize(path), "0")
        assert exc.value.code == "NO_SOLID_GEOMETRY"

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


class TestTopologyEntities:
    """Selectable faces, edges and vertices for the 3D viewer."""

    def test_entities_are_opt_in(self, analyze, step_dir):
        result = analyze(fixtures.simple_block_with_through_hole(step_dir))
        assert result["topology_entities"] is None

    def test_every_entity_category_is_returned(self, analyze, step_dir):
        entities = analyze(
            fixtures.simple_block_with_through_hole(step_dir),
            include_topology_entities=True,
        )["topology_entities"]
        assert entities["face_count"] == 7
        assert entities["edge_count"] > 0
        assert entities["vertex_count"] > 0
        assert len(entities["faces"]) == entities["face_count"]

    def test_counts_agree_with_the_model_block(self, analyze, step_dir):
        result = analyze(
            fixtures.simple_block_with_through_hole(step_dir),
            include_topology_entities=True,
        )
        entities = result["topology_entities"]
        assert entities["face_count"] == result["model"]["face_count"]
        assert entities["edge_count"] == result["model"]["edge_count"]
        assert entities["vertex_count"] == result["model"]["vertex_count"]

    def test_faces_carry_a_centroid_to_anchor_a_marker(self, analyze, step_dir):
        faces = analyze(
            fixtures.simple_block_with_through_hole(step_dir),
            include_topology_entities=True,
        )["topology_entities"]["faces"]
        assert all(face["centroid"] is not None for face in faces)

    def test_edges_carry_endpoints_and_length(self, analyze, step_dir):
        edges = analyze(
            fixtures.simple_block_with_through_hole(step_dir),
            include_topology_entities=True,
        )["topology_entities"]["edges"]
        for edge in edges:
            assert edge["length_mm"] > 0
            assert edge["start"] and edge["end"] and edge["midpoint"]
        assert any(edge["curve_type"] == "CIRCLE" for edge in edges), "bore rim missing"

    def test_vertices_carry_positions(self, analyze, step_dir):
        vertices = analyze(
            fixtures.simple_block_with_through_hole(step_dir),
            include_topology_entities=True,
        )["topology_entities"]["vertices"]
        assert vertices
        # A 100 x 60 x 20 block: every corner sits on the bounding box.
        assert any(
            v["position"] == {"x": 0.0, "y": 0.0, "z": 0.0} for v in vertices
        )

    def test_entity_coordinates_share_the_model_frame(self, analyze, step_dir):
        # A viewer applies one transform to everything, so entity coordinates
        # must sit inside the reported bounding box.
        result = analyze(
            fixtures.simple_block_with_through_hole(step_dir),
            include_topology_entities=True,
        )
        box = result["geometry"]["bounding_box"]
        for vertex in result["topology_entities"]["vertices"]:
            position = vertex["position"]
            for axis in ("x", "y", "z"):
                assert box["min"][axis] - 1e-6 <= position[axis] <= box["max"][axis] + 1e-6

    def test_the_cap_is_configurable_and_reports_truncation(self, parser, step_dir):
        import os

        from app.machining.config import MachiningConfig
        from app.machining.schemas import MachiningAnalysisOptions
        from app.machining.service import analyze_machining

        path = fixtures.simple_block_with_through_hole(step_dir)
        loaded = parser.load(path, os.path.basename(path), os.path.getsize(path), "0")
        result = analyze_machining(
            loaded,
            MachiningAnalysisOptions(include_topology_entities=True),
            MachiningConfig(max_topology_entities=3),
        )
        entities = result["topology_entities"]
        assert len(entities["faces"]) == 3
        assert entities["truncated"] is True
        # Counts still describe the whole model, not the truncated list.
        assert entities["face_count"] == 7
        assert "LARGE_MODEL" in {w["code"] for w in result["warnings"]}


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


# ---------------------------------------------------------------------------
# Import paths: formats and units
# ---------------------------------------------------------------------------


class TestImportPaths:
    """Regressions for silent import failures found on the OCP binding.

    Both bugs were invisible: BREP raised a 415 claiming the kernel could not
    do BREP at all, and the unit pinning simply did nothing, so an inch part
    was reported as millimetres at 1/25.4 of its size.
    """

    def test_brep_files_import_and_yield_the_same_geometry_as_step(
        self, analyze, step_dir
    ):
        result = analyze(fixtures.simple_block_brep(step_dir))
        box = result["geometry"]["bounding_box"]
        assert result["geometry"]["volume_mm3"] == pytest.approx(40 * 30 * 20, rel=1e-6)
        assert sorted(
            (box["length_mm"], box["width_mm"], box["height_mm"])
        ) == pytest.approx([20.0, 30.0, 40.0], rel=1e-6)
        assert result["model"]["face_count"] == 6

    def test_a_step_file_declaring_inches_is_reported_in_millimetres(
        self, analyze, step_dir
    ):
        result = analyze(fixtures.block_declared_in_inches(step_dir))
        box = result["geometry"]["bounding_box"]
        assert sorted(
            (box["length_mm"], box["width_mm"], box["height_mm"])
        ) == pytest.approx([2 * 25.4, 3 * 25.4, 4 * 25.4], rel=1e-4)


class TestInterruptedBores:
    """A bore whose wall is broken by ribs is still a bore.

    Found on a real part: a Ø28.58 back-face counterbore, coaxial with the main
    bore, survived as four 37.2 deg arcs. Summed to 148.8 deg it fell under the
    180 deg wrap threshold and was dropped silently - it appeared in neither
    the features nor the warnings.
    """

    def test_a_bore_interrupted_by_ribs_is_detected(self, analyze, step_dir):
        result = analyze(fixtures.block_with_rib_interrupted_bore(step_dir))
        found = (
            result["features"]["holes"]
            + result["features"]["bores"]
            + result["features"]["internal_cylindrical_features"]
        )
        assert len(found) == 1, "the rib-interrupted bore was not reported"
        assert found[0]["diameter_mm"] == pytest.approx(20.0, rel=1e-3)

    def test_the_evidence_says_the_wall_was_interrupted(self, analyze, step_dir):
        result = analyze(fixtures.block_with_rib_interrupted_bore(step_dir))
        evidence = " ".join(result["features"]["holes"][0]["detection"]["evidence"])
        assert "wall interrupted" in evidence
        # The wrap is genuinely below the threshold - this is not a bore that
        # would have passed the ordinary test anyway.
        assert "120.0 deg" in evidence

    def test_a_continuous_bore_still_reports_no_interruption(self, analyze, step_dir):
        result = analyze(fixtures.simple_block_with_through_hole(step_dir))
        evidence = " ".join(result["features"]["holes"][0]["detection"]["evidence"])
        assert "wall interrupted" not in evidence

    def test_irregularly_spaced_arcs_are_still_rejected(self, config):
        """Regular spacing is the discriminator, so uneven arcs must not pass.

        Without this the rule would degrade into "any three concave slivers",
        readmitting exactly the blends and partial walls the wrap threshold
        exists to reject.
        """
        from app.machining.detectors.holes import HoleDetector
        from app.machining.records import CYLINDER, FaceRecord

        axis, origin = (0.0, 0.0, 1.0), (0.0, 0.0, 0.0)
        detector = HoleDetector(config)

        def arc(face_id, bearing_deg, span=40.0):
            angle = math.radians(bearing_deg)
            return FaceRecord(
                id=face_id,
                surface_type=CYLINDER,
                centroid=(10.0 * math.cos(angle), 10.0 * math.sin(angle), 2.5),
                bbox_min=(-10.0, -10.0, 0.0),
                bbox_max=(10.0, 10.0, 5.0),
                axis=axis,
                axis_location=origin,
                radius_mm=10.0,
                angular_span_deg=span,
                is_internal=True,
            )

        even = [arc(i, b) for i, b in enumerate((0, 90, 180, 270), start=1)]
        uneven = [arc(i, b) for i, b in enumerate((0, 20, 40, 200), start=1)]

        assert detector._is_interrupted_bore(even, 160.0, axis, origin) is True
        assert detector._is_interrupted_bore(uneven, 160.0, axis, origin) is False

    def test_too_few_arcs_are_rejected(self, config):
        """Two arcs cannot establish a pattern - any two are 'evenly' spaced."""
        from app.machining.detectors.holes import HoleDetector
        from app.machining.records import CYLINDER, FaceRecord

        axis, origin = (0.0, 0.0, 1.0), (0.0, 0.0, 0.0)
        pair = [
            FaceRecord(
                id=i,
                surface_type=CYLINDER,
                centroid=(10.0 * s, 0.0, 2.5),
                bbox_min=(-10.0, -10.0, 0.0),
                bbox_max=(10.0, 10.0, 5.0),
                axis=axis,
                axis_location=origin,
                radius_mm=10.0,
                angular_span_deg=60.0,
                is_internal=True,
            )
            for i, s in ((1, 1.0), (2, -1.0))
        ]
        assert HoleDetector(config)._is_interrupted_bore(pair, 120.0, axis, origin) is False


class TestPlanarExtremeFaces:
    """`is_planar_extreme` was declared, documented and never populated.

    Every response reported false for every face, including the top and bottom
    of a plate - a field that always carries the same value is worse than an
    absent one, because callers trust it.
    """

    def test_every_side_of_a_block_is_an_extreme(self, analyze, step_dir):
        result = analyze(
            fixtures.simple_block_with_through_hole(step_dir),
            include_face_details=True,
        )
        planes = [f for f in result["face_details"] if f["surface_type"] == "PLANE"]
        assert len(planes) == 6
        assert all(f["is_planar_extreme"] for f in planes)

    def test_the_bore_wall_is_not_an_extreme(self, analyze, step_dir):
        result = analyze(
            fixtures.simple_block_with_through_hole(step_dir),
            include_face_details=True,
        )
        cylinders = [
            f for f in result["face_details"] if f["surface_type"] == "CYLINDER"
        ]
        assert cylinders and not any(f["is_planar_extreme"] for f in cylinders)

    def test_a_recessed_floor_is_not_an_extreme(self, analyze, step_dir):
        """The floor of a blind hole faces the same way as the top, but is sunk."""
        result = analyze(
            fixtures.block_with_blind_hole(step_dir), include_face_details=True
        )
        extremes = [f for f in result["face_details"] if f["is_planar_extreme"]]
        z_top = result["geometry"]["bounding_box"]["max"]["z"]
        sunk_upward_faces = [
            f
            for f in result["face_details"]
            if f["surface_type"] == "PLANE"
            and (f["normal"] or {}).get("z", 0) > 0.5
            and f["bounding_box"]["max"]["z"] < z_top - 1e-6
        ]
        assert sunk_upward_faces, "fixture should have a sunk upward-facing floor"
        assert not any(f in extremes for f in sunk_upward_faces)


class TestThinWallFlags:
    """`thin_wall_count` was reported but raised no flag.

    A part with nine thin walls and a part with none produced an identical
    (empty) flag list, so the one machining risk that most affects fixturing
    and scrap never reached anything that reads flags.
    """

    def _thin_walled_box(self, tmp_path):
        # 40 x 40 x 20 block hollowed to leave a 1.0 mm wall on all four sides,
        # under the 1.5 mm default threshold.
        shape = fixtures._cut(
            fixtures._box(0, 0, 0, 40, 40, 20),
            fixtures._box(1.0, 1.0, 5, 38.0, 38.0, 20),
        )
        return fixtures._write_step(shape, tmp_path / "thin_walled_box.step")

    def test_each_thin_wall_raises_a_flag(self, analyze, step_dir):
        result = analyze(self._thin_walled_box(step_dir))
        walls = [f for f in result["machining_flags"] if f["flag"] == "THIN_WALL"]
        assert len(walls) == 4
        assert result["complexity_indicators"]["thin_wall_count"] == 4

    def test_the_flag_carries_the_measured_thickness_and_threshold(
        self, analyze, step_dir
    ):
        result = analyze(self._thin_walled_box(step_dir))
        wall = next(f for f in result["machining_flags"] if f["flag"] == "THIN_WALL")
        assert wall["value"] == pytest.approx(1.0, abs=1e-3)
        assert wall["threshold"] == pytest.approx(1.5)
        # A wall is a pair of faces, not a feature, so the reason has to name
        # them - there is no feature id to look up.
        assert "faces" in wall["reason"]

    def test_flag_count_and_indicator_count_agree(self, analyze, step_dir):
        result = analyze(self._thin_walled_box(step_dir))
        flagged = len(
            [f for f in result["machining_flags"] if f["flag"] == "THIN_WALL"]
        )
        assert flagged == result["complexity_indicators"]["thin_wall_count"]

    def test_a_solid_block_raises_no_thin_wall_flag(self, analyze, step_dir):
        result = analyze(fixtures.simple_block_with_through_hole(step_dir))
        assert [f for f in result["machining_flags"] if f["flag"] == "THIN_WALL"] == []

    def test_feature_flags_still_come_through_alongside(self, analyze, step_dir):
        """Thin-wall flags are appended, so they must not displace the others."""
        result = analyze(fixtures.deep_hole_block(step_dir))
        assert "VERY_DEEP_HOLE" in {f["flag"] for f in result["machining_flags"]}


class TestPocketRejectionDiagnostics:
    """An empty pocket list must say why it is empty.

    `pockets: []` is indistinguishable between "this part has no pockets" and
    "every candidate was silently dropped", which is what made a real part's
    zero impossible to triage.
    """

    def test_rejections_are_reported_with_debug_geometry(self, analyze, step_dir):
        result = analyze(
            fixtures.simple_block_with_through_hole(step_dir),
            include_debug_geometry=True,
        )
        rejections = result["debug_geometry"]["pocket_rejections"]
        assert result["features"]["pockets"] == []
        # Six faces of the block, each turned down for a stated reason.
        assert len(rejections) == 6
        assert all("silhouette" in reason for reason in rejections.values())

    def test_a_wall_is_reported_as_a_wall_not_silently_dropped(
        self, analyze, step_dir
    ):
        result = analyze(
            fixtures.block_with_pocket(step_dir), include_debug_geometry=True
        )
        reasons = set(result["debug_geometry"]["pocket_rejections"].values())
        assert any("a wall, not a floor" in reason for reason in reasons)

    def test_an_accepted_floor_is_not_listed_as_rejected(self, analyze, step_dir):
        result = analyze(
            fixtures.block_with_pocket(step_dir), include_debug_geometry=True
        )
        pocket_faces = set(result["features"]["pockets"][0]["face_ids"])
        rejected = {int(k) for k in result["debug_geometry"]["pocket_rejections"]}
        floor_ids = pocket_faces - rejected
        assert floor_ids, "the accepted floor must not appear in the rejections"

    def test_diagnostics_stay_behind_the_debug_flag(self, analyze, step_dir):
        result = analyze(fixtures.block_with_pocket(step_dir))
        assert result["debug_geometry"] is None
