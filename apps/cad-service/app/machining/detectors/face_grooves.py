"""Face-groove detection - a ring cut into a flat end.

``GrooveDetector`` (see ``grooves.py``) deliberately refuses this pattern: a
face groove is not bounded by a coaxial neighbour on *both* sides the way an
OD or internal groove is. One side genuinely has no neighbour at all - the
top of the channel simply meets the surrounding flat stock face - so the
three-band, step-away-from-both-neighbours rule that makes ``GrooveDetector``
trustworthy would either never fire here or, if loosened, would start
claiming grooves from radius and span alone wherever two cylinders happen to
be coaxial and the same length, which is exactly the guess the schema's own
docstring warns against.

This detector claims the pattern anyway, but only once it has independent,
positive evidence a coaxial radius match alone cannot provide: a real planar
floor, topologically adjacent to *both* of the candidate walls, closing one
end of their shared span. Two coaxial cylinders of the right radii and
matching axial extent are necessary but not sufficient; the floor is what
turns a coincidence into a confirmed feature. That verification step mirrors
``HoleDetector._bottom_cap``'s convention for confirming a genuine closing
face (a plane whose normal runs parallel to the axis, not perpendicular to
it), adapted to require adjacency to two walls rather than one.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Set, Tuple

from ..config import MachiningConfig
from ..records import CYLINDER, PLANE, FaceRecord, ShapeModel
from ..schemas import (
    Detection,
    DetectionMethod,
    FeatureStatus,
    GrooveFeature,
    Vector3,
)
from ..vectors import Vec, canonical_axis, is_parallel
from .shared import axial_range, axis_point, feature_id, group_coaxial

logger = logging.getLogger(__name__)

# (low, high, radius, face_ids, is_internal)
_Band = Tuple[float, float, float, List[int], bool]


class FaceGrooveDetector:
    """Finds a ring channel cut into a flat face, verified by a real floor.

    Reported as ``GrooveFeature(subtype="face")`` - a new subtype value, not a
    schema change, since ``GrooveFeature.subtype`` is a plain ``str``.

    ``is_internal`` is reported ``False`` for every face groove this detector
    finds. The channel's *outer* wall is internal (concave) by construction -
    that is one of the two things this detector requires - but the feature as
    a whole sits open on an externally-accessible face and is machined from
    outside the part, the same way an OD groove is (``is_internal=False``)
    and unlike an internal groove buried inside a bore
    (``is_internal=True``, reached only once a tool is already inside the
    bore). ``is_internal`` here describes the feature's own accessibility,
    not the concavity of any one wall that composes it.

    A verified floor at one end is necessary but, on its own, still not
    quite sufficient: a boss standing through the middle of an annular
    channel produces the same inner-wall/outer-wall/floor evidence at the
    channel's closed end, yet its "open" end is not actually open to
    unrelated stock - it continues the very same coaxial stack, at the same
    radius, into the boss's own wall above. That case already has material
    on both axial sides of the recessed band and is exactly what
    ``GrooveDetector``'s own three-band rule already claims as an internal
    groove; ``_continues_past`` checks for precisely that continuation so
    this detector does not report the same physical feature a second time
    under a different subtype.
    """

    def __init__(self, config: MachiningConfig):
        self.config = config

    def detect(self, model: ShapeModel, id_offset: int = 0) -> List[GrooveFeature]:
        """Face grooves across every coaxial stack.

        ``id_offset`` lets a caller running this alongside ``GrooveDetector``
        (see ``service.py``) continue the same ``GROOVE-NNN`` numbering
        instead of both detectors independently starting at 1 and colliding.
        Neither detector needs to know about the other beyond that offset.
        """
        candidates = [
            face
            for face in model.faces_of_type(CYLINDER)
            if face.radius_mm and face.radius_mm > 0
        ]
        features: List[GrooveFeature] = []
        for group in group_coaxial(candidates, self.config):
            features.extend(
                self._face_grooves_in(model, group, id_offset + len(features))
            )
        return features

    # -- one coaxial stack ---------------------------------------------------

    def _bands(
        self, group: List[FaceRecord], axis: Vec, origin: Vec
    ) -> List[_Band]:
        """Merge the stack into ``(low, high, radius, face_ids, is_internal)`` bands.

        Adapted from ``GrooveDetector._sections`` (same merge rule: faces at
        one radius sharing an axial span are arcs of the same physical wall,
        so a wall interrupted by a keyway or a flat should not read as
        several separate bands).

        Kept as a small, local duplicate rather than a shared extraction:
        ``GrooveDetector._sections`` only exists to feed
        ``GrooveDetector._neighbour_radius``/``_grooves_in``, which resolve a
        whole chain of neighbours-on-both-sides for every band in a stack.
        This detector never needs that machinery - it only ever compares two
        specific bands (one external, one internal) directly against each
        other, not a band against its neighbours in a sorted chain - so
        factoring out just the merge step would either drag the neighbour
        machinery along for no reason or leave two half-shared helpers that
        are harder to follow than either original. If a third caller ever
        needs the same band-merge step, that is the point to revisit.
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

    def _face_grooves_in(
        self, model: ShapeModel, group: List[FaceRecord], offset: int
    ) -> List[GrooveFeature]:
        if len(group) < 2:
            return []
        axis = canonical_axis(group[0].axis)
        origin = group[0].axis_location
        bands = self._bands(group, axis, origin)

        found: List[GrooveFeature] = []
        for o_low, o_high, o_radius, outer_ids, outer_internal in bands:
            if not outer_internal:
                # The channel's outer wall must be internal (concave) -
                # material lies outside it, the way it does around any bore.
                continue
            for i_low, i_high, i_radius, inner_ids, inner_internal in bands:
                if inner_internal:
                    # The channel's inner wall must be external (convex) -
                    # material lies inside it, standing through the channel
                    # the way a boss or an unrelieved plateau does.
                    continue
                if i_low != o_low or i_high != o_high:
                    # Both walls must share the exact same axial span - this
                    # is what makes them one channel rather than two
                    # unrelated coaxial cylinders elsewhere on the part.
                    continue
                if i_radius >= o_radius:
                    continue

                width = o_high - o_low
                depth = o_radius - i_radius
                if width <= 0 or width > self.config.groove_max_width_mm:
                    continue
                if depth < self.config.groove_min_depth_mm:
                    continue
                if width / depth > self.config.groove_max_width_depth_ratio:
                    # Wide and shallow reads as a shallow relief or a
                    # diameter change, not a groove cut with a form tool -
                    # same reasoning as GrooveDetector's own ratio check.
                    continue

                floor = self._verify_floor(model, axis, set(inner_ids), set(outer_ids))
                if floor is None:
                    # No independent evidence of a real floor - refuse
                    # rather than guess from radius and span alone (see the
                    # module docstring).
                    continue

                far_end = self._far_end(floor, axis, origin, o_low, o_high)
                exclude = {(i_low, i_high, i_radius), (o_low, o_high, o_radius)}
                if self._continues_past(bands, i_radius, o_radius, far_end, exclude):
                    # A third band at one of these same two radii touches the
                    # far end - so that end is not actually open to
                    # unrelated surrounding stock, it continues the coaxial
                    # stack (a boss standing through the channel, say). That
                    # is a genuine coaxial-neighbour groove, already fully
                    # explained by GrooveDetector's own three-band rule;
                    # claiming it again here as a face groove would report
                    # one physical feature twice, under two subtypes.
                    continue

                found.append(
                    self._build(
                        feature_id("GROOVE", offset + len(found) + 1),
                        axis,
                        origin,
                        o_low,
                        o_high,
                        i_radius,
                        o_radius,
                        width,
                        depth,
                        sorted(set(inner_ids) | set(outer_ids) | {floor.id}),
                    )
                )
        return found

    def _far_end(
        self, floor: FaceRecord, axis: Vec, origin: Vec, low: float, high: float
    ) -> float:
        """Which of the span's two ends does *not* carry the verified floor.

        The floor is a thin planar slice, so its own axial range collapses to
        (very nearly) one value; whichever of ``low``/``high`` that value
        sits closer to is the floor's end, and the other is the one this
        detector must not require to be closed (see ``_verify_floor``) but
        does still check for a coaxial continuation (see ``_continues_past``).
        """
        f_low, f_high = axial_range(floor, axis, origin)
        floor_t = (f_low + f_high) / 2.0
        return high if abs(floor_t - low) <= abs(floor_t - high) else low

    def _continues_past(
        self,
        bands: List[_Band],
        inner_radius: float,
        outer_radius: float,
        far_end: float,
        exclude: Set[Tuple[float, float, float]],
    ) -> bool:
        """True when some other band at either wall's own radius touches ``far_end``.

        Distinguishes a genuine face groove (whose open end meets only the
        surrounding stock's own, unrelated face - or nothing this detector
        looks at) from a channel whose "open" end actually continues the
        same coaxial stack at one of these two exact radii - a boss standing
        through the middle of a channel, most concretely, where the boss's
        own wall picks up at precisely the radius and the axial position the
        channel's wall leaves off. That case already has material on both
        axial sides of the recessed band, at this same radius, which is
        exactly what ``GrooveDetector``'s own three-band rule is for; this
        detector must not re-claim it as a face groove.
        """
        for low, high, radius, _ids, _internal in bands:
            if (low, high, radius) in exclude:
                continue
            if radius != inner_radius and radius != outer_radius:
                continue
            if low == far_end or high == far_end:
                return True
        return False

    def _verify_floor(
        self,
        model: ShapeModel,
        axis: Vec,
        inner_ids: Set[int],
        outer_ids: Set[int],
    ) -> Optional[FaceRecord]:
        """A planar face adjacent to both walls, normal parallel to the axis.

        Mirrors ``HoleDetector._bottom_cap``'s convention for verifying a
        genuine closing face - a plane perpendicular to the cylindrical
        walls' own circumference, i.e. whose normal runs parallel to their
        shared axis - adapted to require topological adjacency to *two*
        walls (the floor spans between them, from one wall to the other)
        rather than to just the one wall a hole's bottom closes.

        Only one end needs a floor. The far end of a face groove is, by
        definition, simply open to the surrounding stock face - requiring a
        matching closure there would reject every genuine face groove, so
        this deliberately does not check the opposite end at all.
        """
        for face_id in inner_ids:
            for neighbor in model.neighbors(face_id):
                if neighbor.surface_type != PLANE or neighbor.normal is None:
                    continue
                if not is_parallel(
                    neighbor.normal, axis, self.config.angular_tolerance_deg * 5
                ):
                    continue
                outer_neighbor_ids = {n.id for n in model.neighbors(neighbor.id)}
                if outer_neighbor_ids & outer_ids:
                    return neighbor
        return None

    def _build(
        self,
        groove_id: str,
        axis: Vec,
        origin: Vec,
        low: float,
        high: float,
        inner_radius: float,
        outer_radius: float,
        width: float,
        depth: float,
        face_ids: List[int],
    ) -> GrooveFeature:
        centre = axis_point(origin, axis, (low + high) / 2.0)
        return GrooveFeature(
            id=groove_id,
            subtype="face",
            diameter_mm=round(inner_radius * 2.0, 4),
            width_mm=round(width, 4),
            depth_mm=round(depth, 4),
            neighbour_diameter_mm=round(outer_radius * 2.0, 4),
            width_depth_ratio=round(width / depth, 4) if depth > 0 else None,
            position=Vector3.from_tuple(centre),
            axis=Vector3.from_tuple(axis),
            is_internal=False,
            face_ids=face_ids,
            status=FeatureStatus.RESOLVED,
            detection=Detection(
                method=DetectionMethod.COAXIAL_GROUPING,
                confidence=0.9,
                evidence=[
                    (
                        f"coaxial pair, inner wall Ø{round(inner_radius * 2.0, 3)} mm, "
                        f"outer wall Ø{round(outer_radius * 2.0, 3)} mm, sharing one "
                        f"{round(width, 3)} mm axial span"
                    ),
                    (
                        "planar floor confirmed topologically adjacent to both "
                        "walls, with its normal parallel to the shared axis - "
                        "the far end is open to the surrounding face, as a face "
                        "groove's definition requires"
                    ),
                    (
                        "axial extent reported as width_mm, radial span as "
                        "depth_mm, consistent with GrooveFeature's existing "
                        "field convention - for a face groove these read the "
                        "reverse of how a machinist might describe them"
                    ),
                ],
            ),
        )
