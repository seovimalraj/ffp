"""Groove detection - recessed bands around an axis.

A groove is not recognisable from one face. A cylinder of radius 31.4 is a
groove floor, a plain turned diameter, or a bore wall depending entirely on
what sits either side of it along the axis - so the rule here is *relative*:
a short coaxial section whose radius steps the wrong way compared with its
neighbours.

External groove: the band is narrower than the material on both sides.
Internal groove: a bore widens over a short length and narrows again.

Both need material on *both* sides. A section narrower than its neighbour on
one side only is a shoulder or a step, not a groove, and claiming it would put
a form-tool operation into the costing input that the part does not need.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

from ..config import MachiningConfig
from ..records import CYLINDER, FaceRecord, ShapeModel
from ..schemas import (
    Detection,
    DetectionMethod,
    FeatureStatus,
    GrooveFeature,
    Vector3,
)
from ..vectors import Vec, canonical_axis, scale
from .shared import axial_range, axis_point, feature_id, group_coaxial

logger = logging.getLogger(__name__)


class GrooveDetector:
    """Finds coaxial bands that step away from their neighbours."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def detect(self, model: ShapeModel) -> List[GrooveFeature]:
        """Grooves in every coaxial stack, claimed faces included.

        A circlip groove inside a bore is cut with a form tool after boring -
        a separate operation on faces the bore already owns. Skipping claimed
        faces would make an internal groove undetectable in the one place it
        normally occurs. The three-band rule keeps this safe: a counterbore
        sits at an end and so has a neighbour on one side only.
        """
        features: List[GrooveFeature] = []
        for internal in (False, True):
            candidates = [
                face
                for face in model.faces_of_type(CYLINDER)
                if face.is_internal is internal
                and face.radius_mm
                and face.radius_mm > 0
            ]
            for group in group_coaxial(candidates, self.config):
                features.extend(self._grooves_in(group, internal, len(features)))
        return features

    # -- one coaxial stack -------------------------------------------------

    def _sections(
        self, group: List[FaceRecord], axis: Vec, origin: Vec
    ) -> List[Tuple[float, float, float, List[int]]]:
        """Merge the stack into ``(t_low, t_high, radius, face_ids)`` bands.

        Faces of one radius that share an axial span are arcs of the same band -
        a groove interrupted by a keyway or a flat would otherwise read as
        several narrow grooves.
        """
        bands: Dict[Tuple[float, float, float], List[int]] = {}
        for face in group:
            low, high = axial_range(face, axis, origin)
            radius = round(face.radius_mm or 0.0, 4)
            key = (round(low, 4), round(high, 4), radius)
            bands.setdefault(key, []).append(face.id)
        return sorted(
            (low, high, radius, sorted(ids))
            for (low, high, radius), ids in bands.items()
        )

    def _grooves_in(
        self, group: List[FaceRecord], internal: bool, offset: int
    ) -> List[GrooveFeature]:
        if len(group) < 2:
            return []
        axis = canonical_axis(group[0].axis)
        origin = group[0].axis_location
        sections = self._sections(group, axis, origin)
        if len(sections) < 3:
            # A groove needs a neighbour on each side, so the stack must hold at
            # least three bands. Two bands are a single step.
            return []

        found: List[GrooveFeature] = []
        for index in range(1, len(sections) - 1):
            low, high, radius, face_ids = sections[index]
            before_radius = sections[index - 1][2]
            after_radius = sections[index + 1][2]

            # A groove floor steps away from the material on *both* sides:
            # inward for an external groove, outward for an internal one.
            if internal:
                recessed = radius > before_radius and radius > after_radius
                neighbour = min(before_radius, after_radius)
                depth = radius - neighbour
            else:
                recessed = radius < before_radius and radius < after_radius
                neighbour = max(before_radius, after_radius)
                depth = neighbour - radius
            if not recessed:
                continue

            width = high - low
            if width <= 0 or width > self.config.groove_max_width_mm:
                continue
            if depth < self.config.groove_min_depth_mm:
                continue
            if width / depth > self.config.groove_max_width_depth_ratio:
                # Wide and shallow is a change of diameter, not a groove.
                continue

            found.append(
                self._build(
                    feature_id("GROOVE", offset + len(found) + 1),
                    axis,
                    origin,
                    low,
                    high,
                    radius,
                    neighbour,
                    depth,
                    face_ids,
                    internal,
                )
            )
        return found

    def _build(
        self,
        groove_id: str,
        axis: Vec,
        origin: Vec,
        low: float,
        high: float,
        radius: float,
        neighbour_radius: float,
        depth: float,
        face_ids: List[int],
        internal: bool,
    ) -> GrooveFeature:
        width = high - low
        centre = axis_point(origin, axis, (low + high) / 2.0)
        return GrooveFeature(
            id=groove_id,
            subtype="internal" if internal else "outer_diameter",
            diameter_mm=round(radius * 2.0, 4),
            width_mm=round(width, 4),
            depth_mm=round(depth, 4),
            neighbour_diameter_mm=round(neighbour_radius * 2.0, 4),
            width_depth_ratio=round(width / depth, 4) if depth > 0 else None,
            position=Vector3.from_tuple(centre),
            axis=Vector3.from_tuple(axis),
            is_internal=internal,
            face_ids=face_ids,
            status=FeatureStatus.RESOLVED,
            detection=Detection(
                method=DetectionMethod.COAXIAL_GROUPING,
                confidence=0.9,
                evidence=[
                    (
                        "coaxial band "
                        + ("wider" if internal else "narrower")
                        + f" than the {round(neighbour_radius * 2.0, 3)} mm "
                        "diameter on both sides"
                    ),
                    f"width {round(width, 3)} mm, depth {round(depth, 3)} mm",
                ],
            ),
        )
