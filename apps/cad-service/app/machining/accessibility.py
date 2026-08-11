"""Machining accessibility and setup-candidate analysis.

Accessibility is measured, not assumed: a ray is cast from outside the model
towards each feature along each of the six principal directions, and the
feature is accessible from that direction only when nothing else is hit first.

This module deliberately stops at *geometric reachability*. It never concludes
that a part requires 4- or 5-axis machining - when the six principal directions
cannot settle the question, it says so via
``requires_advanced_axis_analysis``.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .config import MachiningConfig
from .raycast import RayProbe
from .records import ShapeModel
from .schemas import (
    AnalysisWarning,
    Detection,
    DetectionMethod,
    FeatureAccessibility,
    FeatureCollection,
    SetupAnalysis,
    SetupCandidate,
    WarningCode,
)
from .vectors import (
    PRINCIPAL_DIRECTIONS,
    Vec,
    add,
    angle_between_deg,
    dot,
    normalize,
    scale,
)

logger = logging.getLogger(__name__)


class _Probe:
    """A feature reduced to the two things accessibility needs."""

    __slots__ = ("feature_id", "feature_type", "position", "direction")

    def __init__(self, feature_id: str, feature_type: str, position: Vec, direction: Optional[Vec]):
        self.feature_id = feature_id
        self.feature_type = feature_type
        self.position = position
        self.direction = normalize(direction) if direction else None


class AccessibilityAnalyzer:
    """Ray-casts every feature against the six principal directions."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    # -- entry point -------------------------------------------------------

    def analyze(
        self,
        model: ShapeModel,
        features: FeatureCollection,
        warnings: List[AnalysisWarning],
    ) -> List[FeatureAccessibility]:
        probes = list(self._probes(features))
        if not probes:
            return []

        probe = RayProbe(model, self.config)
        if not probe.available:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.ACCESSIBILITY_UNRELIABLE,
                    message=(
                        "Ray casting is unavailable in this kernel build. "
                        "Accessibility is reported from feature orientation "
                        "alone and does not account for obstructions."
                    ),
                )
            )

        results: List[FeatureAccessibility] = []
        for feature_probe in probes:
            results.append(self._analyze_probe(feature_probe, probe))
        return results

    def _inside(self, position: Vec, axis: Vec, depth: float) -> Vec:
        """Move a hole's probe point off the surface and into the bore.

        A hole's reported position is the centre of its *opening*, which lies
        exactly on the outer face. A ray arriving from the side would grate
        along that face and register a spurious hit-or-miss, so the probe is
        sunk a short way into the feature where the answer is unambiguous.
        """
        inset = max(min(depth * 0.25, 2.0), self.config.accessibility_hit_tolerance_mm * 2)
        return (
            position[0] - axis[0] * inset,
            position[1] - axis[1] * inset,
            position[2] - axis[2] * inset,
        )

    def _probes(self, features: FeatureCollection):
        for hole in features.holes:
            axis = normalize(hole.axis.as_tuple())
            yield _Probe(
                hole.id,
                "hole",
                self._inside(hole.position.as_tuple(), axis, hole.depth_mm),
                axis,
            )
        for bore in features.bores:
            axis = normalize(bore.axis.as_tuple())
            yield _Probe(
                bore.id,
                "bore",
                self._inside(bore.position.as_tuple(), axis, bore.depth_mm),
                axis,
            )
        for icf in features.internal_cylindrical_features:
            axis = normalize(icf.axis.as_tuple())
            yield _Probe(
                icf.id,
                "internal_cylindrical_feature",
                self._inside(icf.position.as_tuple(), axis, icf.depth_mm),
                axis,
            )
        for pocket in features.pockets:
            yield _Probe(
                pocket.id, "pocket", pocket.position.as_tuple(), tuple(pocket.machining_direction)
            )
        for slot in features.slots:
            yield _Probe(
                slot.id, "slot", slot.position.as_tuple(), tuple(slot.machining_direction)
            )
        for boss in features.bosses:
            yield _Probe(boss.id, "boss", boss.position.as_tuple(), boss.axis.as_tuple())

    # -- ray casting -------------------------------------------------------

    def _is_reachable(self, feature: _Probe, direction: Vec, probe: RayProbe) -> bool:
        """True when a tool approaching along ``-direction`` reaches the feature.

        ``direction`` points *outward*: "+Z" means the tool comes down from
        above.
        """
        if not probe.available:
            return self._orientation_only(feature, direction)
        return probe.is_clear(feature.position, direction)

    def _orientation_only(self, feature: _Probe, direction: Vec) -> bool:
        """Degraded fallback: alignment without obstruction testing."""
        if feature.direction is None:
            return False
        return angle_between_deg(feature.direction, direction) <= 45.0

    # -- per-feature -------------------------------------------------------

    def _analyze_probe(
        self, feature: _Probe, probe: RayProbe
    ) -> FeatureAccessibility:
        accessibility: Dict[str, bool] = {}
        for label in self.config.accessibility_directions:
            axis = PRINCIPAL_DIRECTIONS.get(label)
            if axis is None:
                continue
            accessibility[label] = self._is_reachable(feature, axis, probe)

        accessible = [label for label, ok in accessibility.items() if ok]
        primary = self._primary_direction(feature, accessible)

        # The feature's own orientation does not line up with any principal
        # axis - a 6-direction test cannot answer the question for it.
        needs_advanced = (
            feature.direction is not None
            and not any(
                angle_between_deg(feature.direction, PRINCIPAL_DIRECTIONS[label]) <= 5.0
                for label in PRINCIPAL_DIRECTIONS
            )
        ) or not accessible

        return FeatureAccessibility(
            feature_id=feature.feature_id,
            feature_type=feature.feature_type,
            accessibility=accessibility,
            accessible_direction_count=len(accessible),
            primary_direction=primary,
            # Provisional: whether a feature needs the part rotated depends on
            # which direction the rest of the part is machined from, so
            # SetupAnalyzer finalises this once every feature has been probed.
            requires_rotation=False,
            requires_advanced_axis_analysis=needs_advanced,
            detection=Detection(
                method=(
                    DetectionMethod.RAY_CASTING
                    if probe.available
                    else DetectionMethod.SURFACE_TYPE
                ),
                confidence=0.9 if probe.available else 0.5,
                evidence=[
                    f"{len(accessible)} of {len(accessibility)} principal directions clear",
                    (
                        "obstruction tested by ray casting against the solid"
                        if probe.available
                        else "orientation only - no obstruction test available"
                    ),
                ],
            ),
        )

    def _primary_direction(
        self, feature: _Probe, accessible: Sequence[str]
    ) -> Optional[str]:
        """Best approach direction: closest to the feature's own axis."""
        if not accessible:
            return None
        if feature.direction is None:
            return sorted(accessible)[0]
        return min(
            sorted(accessible),
            key=lambda label: angle_between_deg(
                feature.direction, PRINCIPAL_DIRECTIONS[label]
            ),
        )


class SetupAnalyzer:
    """Groups features by the directions that can reach them.

    The result is evidence for a downstream planner, not a setup plan: it does
    not decide fixturing, ordering, or how many operations are economical.
    """

    def __init__(self, config: MachiningConfig):
        self.config = config

    def analyze(self, accessibility: Sequence[FeatureAccessibility]) -> SetupAnalysis:
        candidates: List[SetupCandidate] = []
        by_direction: Dict[str, List[str]] = {
            label: [] for label in self.config.accessibility_directions
        }

        for entry in accessibility:
            for label, ok in entry.accessibility.items():
                if ok and label in by_direction:
                    by_direction[label].append(entry.feature_id)

        for label in self.config.accessibility_directions:
            ids = sorted(by_direction.get(label, []))
            candidates.append(
                SetupCandidate(
                    direction=label, accessible_feature_count=len(ids), feature_ids=ids
                )
            )

        # Most productive direction first; ties broken by name for stable output.
        candidates.sort(key=lambda c: (-c.accessible_feature_count, c.direction))

        unreachable = sorted(
            entry.feature_id
            for entry in accessibility
            if entry.accessible_direction_count == 0
        )
        cover = self._greedy_cover(accessibility, by_direction)

        # A feature "requires rotation" when the direction that reaches the most
        # features cannot reach it - i.e. it cannot be done in the same setup as
        # the bulk of the work. This is geometric evidence, not a setup plan.
        dominant = candidates[0].direction if candidates else None
        if dominant:
            reachable_from_dominant = set(by_direction.get(dominant, []))
            for entry in accessibility:
                entry.requires_rotation = (
                    entry.accessible_direction_count > 0
                    and entry.feature_id not in reachable_from_dominant
                )

        return SetupAnalysis(
            candidate_directions=candidates,
            minimum_direction_count_covering_all=cover,
            unreachable_feature_ids=unreachable,
            requires_rotation=bool(cover and cover > 1),
        )

    def _greedy_cover(
        self,
        accessibility: Sequence[FeatureAccessibility],
        by_direction: Dict[str, List[str]],
    ) -> Optional[int]:
        """Smallest number of principal directions that reaches every feature.

        Greedy set cover - an upper bound, which is the honest thing to report
        for a lower-bound question a planner will refine anyway.
        """
        remaining = {
            entry.feature_id
            for entry in accessibility
            if entry.accessible_direction_count > 0
        }
        if not remaining:
            return None

        sets = {label: set(ids) for label, ids in by_direction.items()}
        chosen = 0
        while remaining:
            best_label, best_gain = None, 0
            for label in sorted(sets):
                gain = len(sets[label] & remaining)
                if gain > best_gain:
                    best_label, best_gain = label, gain
            if best_label is None:
                break
            remaining -= sets[best_label]
            chosen += 1
        return chosen
