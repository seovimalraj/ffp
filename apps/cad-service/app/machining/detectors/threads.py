"""Thread detection.

Threads are claimed from evidence only, in this order:

1. **CAD metadata / PMI** - the file states a designation. Confidence
   ``explicit``.
2. **Helical geometry** - a modelled helix wraps a cylindrical face. The thread
   is real, but the designation stays ``null`` unless the pitch can be measured
   from the helix itself. Confidence ``geometric``.

A designation is never inferred from diameter. A 6.8 mm hole is a 6.8 mm hole,
not an M8 tapped hole, unless the model says so - the tap-drill relationship is
a manufacturing decision, not a geometric fact.
"""

from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from ..config import MachiningConfig
from ..records import CYLINDER, FaceRecord, ShapeModel
from ..schemas import (
    Detection,
    DetectionMethod,
    FeatureStatus,
    HoleFeature,
    InformationSource,
    ThreadConfidence,
    ThreadFeature,
)
from ..vectors import Vec, cross, dot, normalize, scale, sub
from .shared import axial_range, cluster_by_axial_contiguity, feature_id, group_coaxial

logger = logging.getLogger(__name__)

#: Designations as written in CAD metadata. Matching text is *reading* the
#: file's own statement, never deriving a size from a measured diameter.
_THREAD_PATTERNS = (
    re.compile(r"\bM(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\b"),  # M8x1.25
    re.compile(r"\bM(\d+(?:\.\d+)?)\b(?!\s*[xX])"),  # M8
    re.compile(r"\b(\d+/\d+|\#\d+|\d+(?:\.\d+)?)\s*-\s*(\d+)\s*(UNC|UNF|UNEF|NPT|BSP)\b", re.I),
    re.compile(r"\b(G|R|Rc|Rp)\s?(\d+/\d+|\d+)\b"),  # pipe threads
)

#: A helix must climb through at least this much rotation to be a thread and
#: not a curved edge that happens to rise.
_MIN_HELIX_TURNS = 1.0


@dataclass
class HelixEvidence:
    face_ids: List[int]
    axis: Vec
    radius_mm: float
    pitch_mm: Optional[float]
    turns: float
    depth_mm: float
    edge_ids: List[int]


class ThreadDetector:
    """Finds threads from CAD metadata and modelled helical geometry."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    # -- entry point -------------------------------------------------------

    def detect(
        self,
        model: ShapeModel,
        holes: Sequence[HoleFeature],
        metadata_names: Optional[Iterable[str]] = None,
    ) -> List[ThreadFeature]:
        features: List[ThreadFeature] = []

        for evidence in self._find_helices(model):
            features.append(
                self._from_helix(evidence, holes, len(features) + 1)
            )

        declared = self._from_metadata(metadata_names or [], len(features))
        features.extend(declared)
        return features

    # -- metadata ----------------------------------------------------------

    def parse_designation(self, text: str) -> Optional[Tuple[str, Optional[float], Optional[float]]]:
        """Extract ``(designation, nominal_diameter_mm, pitch_mm)`` from text.

        Only metric designations yield numeric diameter and pitch; imperial and
        pipe designations are passed through as text because converting them
        would be asserting a size the file did not state in millimetres.
        """
        if not text:
            return None

        match = _THREAD_PATTERNS[0].search(text)
        if match:
            diameter, pitch = float(match.group(1)), float(match.group(2))
            return f"M{match.group(1)}x{match.group(2)}", diameter, pitch

        match = _THREAD_PATTERNS[1].search(text)
        if match:
            return f"M{match.group(1)}", float(match.group(1)), None

        for pattern in _THREAD_PATTERNS[2:]:
            match = pattern.search(text)
            if match:
                return match.group(0).strip(), None, None
        return None

    def _from_metadata(
        self, names: Iterable[str], offset: int
    ) -> List[ThreadFeature]:
        features: List[ThreadFeature] = []
        seen: set = set()
        for name in names:
            parsed = self.parse_designation(str(name))
            if parsed is None:
                continue
            designation, diameter, pitch = parsed
            if designation in seen:
                continue
            seen.add(designation)
            features.append(
                ThreadFeature(
                    id=feature_id("THREAD", offset + len(features) + 1),
                    thread_type="unknown",
                    designation=designation,
                    nominal_diameter_mm=diameter,
                    pitch_mm=pitch,
                    confidence=ThreadConfidence.EXPLICIT,
                    detection=Detection(
                        method=DetectionMethod.CAD_METADATA,
                        confidence=1.0,
                        evidence=[f"designation '{designation}' declared in CAD metadata"],
                        source=InformationSource.CAD_METADATA,
                    ),
                )
            )
        return features

    # -- helical geometry --------------------------------------------------

    def _find_helices(self, model: ShapeModel) -> List[HelixEvidence]:
        """Find helical thread evidence, accumulated across coaxial faces.

        A genuinely modelled thread is sometimes represented as a single
        continuous helical edge on one cylindrical face, but it is just as
        often fragmented by the CAD kernel into many small coaxial "wedge"
        faces - each carrying one short helical edge covering only a
        fraction of a turn. Neither an individual edge nor an individual
        face is the right unit of evidence: the whole coaxial family is. So
        every candidate cylinder is grouped by axis first (via the same
        ``group_coaxial`` helper the hole/boss/groove detectors use), every
        edge on every face in a family is measured, and the turns threshold
        is applied to the family's accumulated total rather than to any one
        edge or face in isolation.

        Sharing an axis *line* is not the same as being the same physical
        thread: two radially opposed holes (for example diametrically
        opposite side holes drilled 90 degrees apart around a part) have
        exactly negated axis vectors, which sit on the very same infinite
        axis line and so land in the same ``group_coaxial`` family despite
        being two entirely separate, non-touching bores. Before accumulating
        turns, each coaxial family is re-split by axial contiguity (mirroring
        the same "same line, different feature" guard ``HoleDetector``
        already applies to holes, via the shared
        :func:`cluster_by_axial_contiguity` helper) so two physically
        distinct threads on the same line are never merged into one bloated
        feature.
        """
        results: List[HelixEvidence] = []
        candidates = [
            f
            for f in model.faces_of_type(CYLINDER)
            if f.axis is not None and f.axis_location is not None and f.radius_mm
        ]
        coaxial_groups: List[List[FaceRecord]] = []
        for coaxial_family in group_coaxial(candidates, self.config):
            axis = coaxial_family[0].axis
            origin = coaxial_family[0].axis_location
            coaxial_groups.extend(
                cluster_by_axial_contiguity(
                    coaxial_family, axis, origin, self.config.linear_tolerance_mm
                )
            )
        for group in coaxial_groups:
            group = sorted(group, key=lambda f: f.id)
            helical_edges: List[int] = []
            total_turns = 0.0
            pitches: List[float] = []
            seen_edge_ids: set = set()

            for face in group:
                for edge_id in face.edge_ids:
                    if edge_id in seen_edge_ids:
                        continue
                    seen_edge_ids.add(edge_id)
                    edge = model.edges.get(edge_id)
                    if edge is None or len(edge.samples) < 4:
                        continue
                    measurement = self._measure_helix(
                        edge.samples, face.axis, face.axis_location, face.radius_mm
                    )
                    if measurement is None:
                        continue
                    turns, pitch = measurement
                    # Accumulate every genuinely helical edge regardless of
                    # its own turn count - the threshold below applies to
                    # the family total, not to this one edge.
                    helical_edges.append(edge_id)
                    total_turns += turns
                    if pitch is not None:
                        pitches.append(pitch)

            if not helical_edges or total_turns < _MIN_HELIX_TURNS:
                continue

            axis = group[0].axis
            origin = group[0].axis_location
            lows: List[float] = []
            highs: List[float] = []
            for face in group:
                lo, hi = axial_range(face, axis, origin)
                lows.append(lo)
                highs.append(hi)

            results.append(
                HelixEvidence(
                    face_ids=[f.id for f in group],
                    axis=axis,
                    radius_mm=float(group[0].radius_mm),
                    pitch_mm=(sum(pitches) / len(pitches)) if pitches else None,
                    turns=total_turns,
                    depth_mm=max(highs) - min(lows),
                    edge_ids=sorted(helical_edges),
                )
            )
        return results

    def _measure_helix(
        self, samples: Sequence[Vec], axis: Vec, origin: Vec, radius: float
    ) -> Optional[Tuple[float, Optional[float]]]:
        """Return ``(turns, pitch_mm)`` when the sampled curve is a helix.

        A helix keeps a constant distance from the axis while its axial position
        advances monotonically with rotation. Both conditions must hold - a
        circle satisfies the first, a straight edge the second.
        """
        axis = normalize(axis)
        if axis == (0.0, 0.0, 0.0) or radius <= 0:
            return None

        # Build a stable frame perpendicular to the axis.
        helper = (0.0, 0.0, 1.0) if abs(dot(axis, (0.0, 0.0, 1.0))) < 0.9 else (1.0, 0.0, 0.0)
        u = normalize(cross(axis, helper))
        v = normalize(cross(axis, u))

        heights: List[float] = []
        angles: List[float] = []
        for point in samples:
            offset = sub(point, origin)
            axial = dot(offset, axis)
            radial = sub(offset, scale(axis, axial))
            distance = math.sqrt(dot(radial, radial))
            if abs(distance - radius) > max(0.05, radius * 0.05):
                return None  # not riding on the cylinder
            heights.append(axial)
            angles.append(math.atan2(dot(radial, v), dot(radial, u)))

        # Unwrap the angle sequence so a helix accumulates rather than resets.
        unwrapped = [angles[0]]
        for angle in angles[1:]:
            delta = angle - unwrapped[-1]
            while delta > math.pi:
                delta -= 2 * math.pi
            while delta < -math.pi:
                delta += 2 * math.pi
            unwrapped.append(unwrapped[-1] + delta)

        total_rotation = unwrapped[-1] - unwrapped[0]
        total_rise = heights[-1] - heights[0]
        if abs(total_rotation) < 1e-6 or abs(total_rise) < 1e-6:
            return None

        # Monotonic climb - reject curves that go up then come back down.
        deltas = [heights[i + 1] - heights[i] for i in range(len(heights) - 1)]
        if not (all(d >= -1e-9 for d in deltas) or all(d <= 1e-9 for d in deltas)):
            return None

        turns = abs(total_rotation) / (2 * math.pi)
        pitch = abs(total_rise) / turns if turns > 0 else None
        return turns, pitch

    def _from_helix(
        self, evidence: HelixEvidence, holes: Sequence[HoleFeature], index: int
    ) -> ThreadFeature:
        related = next(
            (
                h.id
                for h in holes
                if any(fid in h.face_ids for fid in evidence.face_ids)
            ),
            None,
        )
        return ThreadFeature(
            id=feature_id("THREAD", index),
            thread_type="internal_thread" if related else "external_thread",
            designation=None,
            nominal_diameter_mm=round(evidence.radius_mm * 2.0, 4),
            pitch_mm=round(evidence.pitch_mm, 4) if evidence.pitch_mm else None,
            depth_mm=round(evidence.depth_mm, 4) or None,
            confidence=ThreadConfidence.GEOMETRIC,
            related_feature_id=related,
            face_ids=evidence.face_ids,
            status=FeatureStatus.AMBIGUOUS,
            reason=(
                "Helical geometry detected but no thread designation is present "
                "in the CAD file. The designation is not inferred from diameter."
                if evidence.pitch_mm is None
                else (
                    "Helical geometry detected and pitch measured, but no "
                    "designation is declared in the CAD file; the standard "
                    "series cannot be established from geometry alone."
                )
            ),
            detection=Detection(
                method=DetectionMethod.HELICAL_GEOMETRY,
                confidence=0.8,
                evidence=[
                    f"helical edge(s) {evidence.edge_ids} riding cylindrical face(s) "
                    f"{evidence.face_ids}",
                    f"{round(evidence.turns, 2)} turns"
                    + (
                        f", measured pitch {round(evidence.pitch_mm, 3)} mm"
                        if evidence.pitch_mm
                        else ", pitch not measurable"
                    ),
                ],
            ),
        )
