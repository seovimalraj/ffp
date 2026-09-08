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
from typing import Dict, List, Optional, Sequence, Tuple

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

        Internal and external cylinders are grouped together, one coaxial
        stack per axis line, rather than in two separate pools. A ring
        channel milled around a boss straddles both: the channel's outer
        wall is internal (concave - material lies outside it), the boss
        standing through the middle is external (convex - material lies
        inside it), yet they sit on the same axis and the channel is only a
        recess relative to the boss's own wall. Splitting the pools by
        ``is_internal`` before grouping would keep such a pair permanently
        apart. ``group_coaxial`` itself does not care about ``is_internal``
        (it only groups by axis line), so nothing else needs to change to
        combine them - only how a band's own recessed-ness is judged, which
        ``_grooves_in`` now derives per band instead of assuming one
        constant flag for the whole stack.
        """
        candidates = [
            face
            for face in model.faces_of_type(CYLINDER)
            if face.radius_mm and face.radius_mm > 0
        ]
        features: List[GrooveFeature] = []
        for group in group_coaxial(candidates, self.config):
            features.extend(self._grooves_in(group, len(features)))
        return features

    # -- one coaxial stack -------------------------------------------------

    def _sections(
        self, group: List[FaceRecord], axis: Vec, origin: Vec
    ) -> List[Tuple[float, float, float, List[int], bool]]:
        """Merge the stack into ``(t_low, t_high, radius, face_ids, is_internal)`` bands.

        Faces of one radius that share an axial span are arcs of the same band -
        a groove interrupted by a keyway or a flat would otherwise read as
        several narrow grooves. A band's ``is_internal`` comes from the faces
        that compose it (they always agree - a band is one physical wall),
        not from any assumption about the rest of the stack.
        """
        bands: Dict[Tuple[float, float, float], List[int]] = {}
        internal_of: Dict[Tuple[float, float, float], bool] = {}
        for face in group:
            low, high = axial_range(face, axis, origin)
            radius = round(face.radius_mm or 0.0, 4)
            key = (round(low, 4), round(high, 4), radius)
            bands.setdefault(key, []).append(face.id)
            internal_of.setdefault(key, bool(face.is_internal))
        return sorted(
            (low, high, radius, sorted(ids), internal_of[(low, high, radius)])
            for (low, high, radius), ids in bands.items()
        )

    def _neighbour_radius(
        self,
        sections: Sequence[Tuple[float, float, float, List[int], bool]],
        index: int,
        before: bool,
    ) -> Optional[float]:
        """Radius of the band immediately beside ``sections[index]``.

        A groove's neighbours are found by touching a boundary, not by list
        position - the two no longer coincide once internal and external
        bands share one stack, because a band that spans the *whole* stack
        (a shaft's OD running the full length, say) can sort in between two
        bore bands without ever actually bordering either of them.

        Two kinds of boundary count:

        * an axial touch - another band's high edge meets this band's low
          edge (or vice versa for the far side) - the ordinary case of one
          section ending where the next begins;
        * a radial companion - another band spanning the *exact same* axial
          range at a different radius, e.g. a boss's own wall standing
          through a channel cut into the material around it. That band sits
          beside the tested one just as genuinely as an axial neighbour
          does, only sideways rather than end-to-end.

        Only bands that actually touch this one are considered - a band
        that merely overlaps it (spans across it without sharing an edge)
        is not a valid neighbour, e.g. a full-length OD face never borders
        a short internal groove band cut somewhere along a bore.
        """
        low, high, _radius, _ids, _internal = sections[index]
        target = low if before else high
        for other_index, (o_low, o_high, o_radius, _o_ids, _o_internal) in enumerate(
            sections
        ):
            if other_index == index:
                continue
            if before and o_high == target:
                return o_radius
            if not before and o_low == target:
                return o_radius
        for other_index, (o_low, o_high, o_radius, _o_ids, _o_internal) in enumerate(
            sections
        ):
            if other_index == index:
                continue
            if o_low == low and o_high == high:
                return o_radius
        return None

    def _grooves_in(
        self, group: List[FaceRecord], offset: int
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
        for index, (low, high, radius, face_ids, internal) in enumerate(sections):
            before_radius = self._neighbour_radius(sections, index, before=True)
            after_radius = self._neighbour_radius(sections, index, before=False)
            if before_radius is None or after_radius is None:
                # No material context on one side (an open end, or a band
                # that never actually touches another) - not a groove.
                continue

            # A groove floor steps away from the material on *both* sides:
            # inward for an external band, outward for an internal one. The
            # comparison is always against the band's *own* is_internal -
            # the neighbours' own internal/external-ness plays no part, only
            # their raw radius, so a band is judged the same way whether its
            # neighbours are both the same type as it (the original,
            # single-pool cases) or not (a channel wall recessed between two
            # external boss faces on either side of it).
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
