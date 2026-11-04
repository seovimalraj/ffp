"""Process identification rules that need no CAD kernel."""

from types import SimpleNamespace

from app.core.classification import classification_needs_review, credible_step_bends
from app.extractors.bend_angles import BendFeature
from app.sheet_metal.config import SheetMetalConfig
from app.sheet_metal.detectors.cutouts import is_opposite_skin_duplicate


def _bend(is_sharp_edge: bool) -> BendFeature:
    return BendFeature(
        id="BEND-001",
        angle_deg=90.0,
        radius_mm=1.0,
        length_mm=50.0,
        orientation=(0.0, 0.0, 1.0),
        position=(0.0, 0.0, 0.0),
        bend_type="v-bend",
        k_factor=0.44,
        bend_deduction_mm=1.0,
        is_acute=False,
        is_obtuse=False,
        is_sharp_edge=is_sharp_edge,
    )


def _faces(pair_thickness, pair_count=4) -> SimpleNamespace:
    return SimpleNamespace(dominant_pair_thickness=pair_thickness, paired_plane_count=pair_count)


class TestOppositeSkinDuplicate:
    CONFIG = SheetMetalConfig()
    TOP = ((0.0, 0.0, 1.0), (10.0, 10.0, 2.0), 40.0)

    def _is_duplicate(self, normal, centroid, perimeter):
        return is_opposite_skin_duplicate(normal, centroid, perimeter, [self.TOP], self.CONFIG)

    def test_same_profile_on_the_opposite_skin_is_a_duplicate(self):
        assert self._is_duplicate((0.0, 0.0, -1.0), (10.0, 10.0, 0.0), 40.0)

    def test_profile_elsewhere_on_the_wall_is_separate(self):
        assert not self._is_duplicate((0.0, 0.0, -1.0), (50.0, 10.0, 0.0), 40.0)

    def test_different_shape_at_the_same_spot_is_separate(self):
        assert not self._is_duplicate((0.0, 0.0, -1.0), (10.0, 10.0, 0.0), 80.0)

    def test_matching_profile_on_a_distant_wall_is_separate(self):
        assert not self._is_duplicate((0.0, 0.0, -1.0), (10.0, 10.0, -60.0), 40.0)

    def test_same_facing_profile_is_separate(self):
        assert not self._is_duplicate((0.0, 0.0, 1.0), (10.0, 10.0, 0.0), 40.0)


class TestCredibleStepBends:
    def test_machined_block_corners_are_not_bends(self):
        bends = [_bend(is_sharp_edge=True) for _ in range(12)]
        assert credible_step_bends(bends, _faces(None, 0)) == []

    def test_thick_paired_faces_do_not_make_sharp_edges_credible(self):
        assert credible_step_bends([_bend(is_sharp_edge=True)], _faces(25.0)) == []

    def test_sharp_edges_count_on_a_part_with_thin_paired_walls(self):
        bends = [_bend(is_sharp_edge=True)]
        assert credible_step_bends(bends, _faces(2.0)) == bends

    def test_radiused_bends_always_count(self):
        bends = [_bend(is_sharp_edge=False)]
        assert credible_step_bends(bends, None) == bends

    def test_no_bends(self):
        assert credible_step_bends(None, None) == []


class TestClassificationNeedsReview:
    def test_flags_exactly_seventy_percent(self):
        assert classification_needs_review(0.70) is True

    def test_does_not_flag_higher_confidence(self):
        assert classification_needs_review(0.71) is False

    def test_always_flags_the_default_cnc_tier(self):
        assert classification_needs_review(0.90, {"is_default_tier": True}) is True

    def test_default_tier_stays_flagged_after_ml_agreement(self):
        metadata = {"classification_method": "rule_ml_ensemble", "is_default_tier": True}
        assert classification_needs_review(0.95, metadata) is True

    def test_does_not_flag_a_confident_positive_identification(self):
        metadata = {"classification_method": "face_classification"}
        assert classification_needs_review(0.90, metadata) is False
