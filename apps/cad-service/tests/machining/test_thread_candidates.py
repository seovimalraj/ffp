"""Unit tests for the heuristic tap-drill diameter matcher.

Pure function tests - no CAD kernel needed. See
``app/machining/thread_candidates.py`` for the formula and its source.
"""

from __future__ import annotations

from app.machining.schemas import ThreadCandidateConfidence
from app.machining.thread_candidates import match_tap_drill


class TestMatchTapDrill:
    def test_exact_tap_drill_diameter_returns_a_candidate(self):
        # M8x1.25 coarse: 8.0 - 1.25 = 6.8mm.
        candidate = match_tap_drill(6.8, tolerance_mm=0.05)
        assert candidate is not None
        assert candidate.designation == "M8x1.25"
        assert candidate.confidence == ThreadCandidateConfidence.HEURISTIC

    def test_diameter_within_tolerance_still_matches(self):
        candidate = match_tap_drill(6.83, tolerance_mm=0.05)
        assert candidate is not None
        assert candidate.designation == "M8x1.25"

    def test_diameter_slightly_outside_tolerance_returns_none(self):
        assert match_tap_drill(6.9, tolerance_mm=0.05) is None

    def test_ordinary_clearance_hole_diameter_returns_none(self):
        # 10.0mm matches nothing in the table within a tight tolerance -
        # closest entries are M12 coarse (10.2) and M12 fine (10.5).
        assert match_tap_drill(10.0, tolerance_mm=0.05) is None

    def test_note_reads_sensibly_and_names_the_size(self):
        candidate = match_tap_drill(8.5, tolerance_mm=0.05)
        assert candidate is not None
        assert candidate.designation == "M10x1.5"
        assert "M10x1.5" in candidate.note
        assert "8.5" in candidate.note
        assert "not confirmed" in candidate.note.lower()

    def test_zero_and_negative_diameters_never_match(self):
        assert match_tap_drill(0.0, tolerance_mm=0.05) is None
        assert match_tap_drill(-6.8, tolerance_mm=0.05) is None

    def test_fine_series_size_also_matches(self):
        # M20x1.5 fine: 20.0 - 1.5 = 18.5mm.
        candidate = match_tap_drill(18.5, tolerance_mm=0.05)
        assert candidate is not None
        assert candidate.designation == "M20x1.5"
