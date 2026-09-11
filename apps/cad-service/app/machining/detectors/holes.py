"""Hole, bore and generic internal-cylindrical-feature detection.

Only cylinders the kernel reports as *concave* are considered, and only those
that wrap far enough around their axis to be a bore rather than a corner blend.
A cylindrical surface is never assumed to be a hole simply because it is
cylindrical.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from ..config import MachiningConfig
from ..raycast import PointClassifier
from ..records import CONE, CYLINDER, PLANE, FaceRecord, ShapeModel
from ..schemas import (
    BoreFeature,
    CounterboreStep,
    Detection,
    DetectionMethod,
    FeatureStatus,
    HoleFeature,
    ThreadCandidate,
    Vector3,
)
from ..thread_candidates import match_tap_drill
from ..vectors import (
    Vec,
    add,
    canonical_axis,
    dot,
    is_parallel,
    perpendicular_basis,
    normalize,
    project_scalar,
    scale,
    sub,
)
from .shared import axial_range, axis_point, feature_id, group_coaxial

logger = logging.getLogger(__name__)


@dataclass
class CylindricalGroup:
    """One coaxial stack of internal faces - a hole and everything on top of it."""

    axis: Vec
    origin: Vec
    cylinders: List[FaceRecord]
    cones: List[FaceRecord]
    t_min: float
    t_max: float
    #: Largest wrap found on any one bore segment, summed over its fragments.
    wrap_span_deg: float = 360.0

    @property
    def primary(self) -> FaceRecord:
        """The functional bore: the smallest-radius cylinder in the stack."""
        return min(self.cylinders, key=lambda f: (f.radius_mm or 0.0, f.id))

    @property
    def depth(self) -> float:
        return self.t_max - self.t_min


class HoleDetector:
    """Groups concave cylinders into holes, bores and stepped features."""

    def __init__(self, config: MachiningConfig):
        self.config = config
        #: Face ids admitted by the interrupted-bore rule rather than by wrap
        #: alone, so the detection evidence can say which test carried them.
        self._interrupted: set = set()
        #: Face ids admitted because a lone sub-threshold arc's missing wall
        #: was confirmed to be open space (the bore exits the part boundary)
        #: rather than a blend - see :meth:`_is_edge_broken_hole`.
        self._edge_broken: set = set()

    # -- entry point -------------------------------------------------------

    def detect(
        self, model: ShapeModel
    ) -> Tuple[List[HoleFeature], List[BoreFeature], List[BoreFeature]]:
        """Return ``(holes, bores, unresolved_internal_cylindrical_features)``."""
        # Face ids restart per model, so a reused detector would otherwise
        # attribute a previous part's interruptions to this one.
        self._interrupted.clear()
        self._edge_broken.clear()
        # One classifier for the whole model: construction is the costly
        # part, each query after that is cheap. Built before grouping so the
        # edge-broken-hole radial probe (inside _qualifying_faces) can use it.
        classifier = PointClassifier(model, self.config)
        groups = self._build_groups(model, classifier)

        holes: List[HoleFeature] = []
        bores: List[BoreFeature] = []
        unresolved: List[BoreFeature] = []

        for group in groups:
            classification = self._classify(group)
            if classification == "hole":
                split = self._split_oversized_counterbore(model, group, classifier)
                if split is not None:
                    wide_group, narrow_group, boundary_t, full = split
                    wide_id = feature_id("HOLE", len(holes) + 1)
                    narrow_id = feature_id("HOLE", len(holes) + 2)
                    wide_hole, narrow_hole = self._build_split_holes(
                        model,
                        wide_group,
                        narrow_group,
                        boundary_t,
                        full,
                        wide_id,
                        narrow_id,
                    )
                    holes.append(wide_hole)
                    holes.append(narrow_hole)
                else:
                    holes.append(
                        self._build_hole(
                            model, group, feature_id("HOLE", len(holes) + 1), classifier
                        )
                    )
            elif classification == "bore":
                bores.append(
                    self._build_bore(
                        model,
                        group,
                        feature_id("BORE", len(bores) + 1),
                        "bore",
                        classifier,
                    )
                )
            else:
                unresolved.append(
                    self._build_bore(
                        model,
                        group,
                        feature_id("ICF", len(unresolved) + 1),
                        "internal_cylindrical_feature",
                        classifier,
                    )
                )

        for face_id in self._claimed_face_ids(groups):
            if face_id in model.faces:
                model.faces[face_id].claimed_by = "hole"

        return holes, bores, unresolved

    # -- grouping ----------------------------------------------------------

    def _candidate_cylinders(self, model: ShapeModel) -> List[FaceRecord]:
        """Concave cylinders large enough to bound a hole.

        Angular wrap is deliberately *not* filtered here. A boolean that cuts
        into a bore - a pocket breaking through its wall, an intersecting hole -
        splits one cylindrical face into several arcs, each below the wrap
        threshold on its own. Rejecting them individually loses the whole hole,
        so the test is deferred until the fragments have been reassembled by
        :meth:`_bore_segments`.
        """
        candidates = []
        for face in model.faces_of_type(CYLINDER):
            if face.is_internal is not True:
                continue  # external cylinder -> shaft or boss, not a hole
            if not face.radius_mm or face.radius_mm <= 0:
                continue
            if face.radius_mm * 2.0 < self.config.min_hole_diameter_mm:
                continue
            candidates.append(face)
        return candidates

    def _bore_segments(
        self, members: List[FaceRecord], axis: Vec, origin: Vec
    ) -> List[List[FaceRecord]]:
        """Cluster one coaxial stack into physical bore segments.

        Faces belong to the same segment when they share a radius *and* overlap
        along the axis - that is, when they are arcs of the same physical bore
        rather than different diameters stacked above one another (a
        counterbore) or separate bores on a shared axis.
        """
        segments: List[List[FaceRecord]] = []
        for face in sorted(members, key=lambda f: f.id):
            radius = face.radius_mm or 0.0
            low, high = axial_range(face, axis, origin)
            placed = False
            for segment in segments:
                reference = segment[0]
                if abs((reference.radius_mm or 0.0) - radius) > self.config.coaxial_tolerance_mm:
                    continue
                if any(
                    self._overlaps(axial_range(other, axis, origin), (low, high))
                    for other in segment
                ):
                    segment.append(face)
                    placed = True
                    break
            if not placed:
                segments.append([face])
        return segments

    def _overlaps(self, a: Tuple[float, float], b: Tuple[float, float]) -> bool:
        """True when two axial intervals share any extent."""
        tolerance = self.config.linear_tolerance_mm
        return a[0] <= b[1] + tolerance and b[0] <= a[1] + tolerance

    def _qualifying_faces(
        self,
        members: List[FaceRecord],
        axis: Vec,
        origin: Vec,
        classifier: Optional[PointClassifier] = None,
    ) -> Tuple[List[FaceRecord], Dict[int, float]]:
        """Keep only fragments belonging to a sufficiently wrapped bore.

        Returns the surviving faces and, per face id, the summed wrap of the
        bore segment it came from - :meth:`_split_into_axial_clusters` uses
        this to report the right wrap for each physically separate hole,
        rather than the largest wrap found anywhere on the axis.
        """
        kept: List[FaceRecord] = []
        span_by_face: Dict[int, float] = {}
        for segment in self._bore_segments(members, axis, origin):
            span = sum(face.angular_span_deg or 360.0 for face in segment)
            below_threshold = span < self.config.hole_min_angular_span_deg
            interrupted = below_threshold and self._is_interrupted_bore(
                segment, span, axis, origin
            )
            edge_broken = (
                below_threshold
                and not interrupted
                and self._is_edge_broken_hole(segment, span, axis, origin, classifier)
            )
            if span >= self.config.hole_min_angular_span_deg or interrupted or edge_broken:
                kept.extend(segment)
                for face in segment:
                    span_by_face[face.id] = span
                if interrupted:
                    self._interrupted.update(face.id for face in segment)
                if edge_broken:
                    self._edge_broken.update(face.id for face in segment)
        return sorted(kept, key=lambda f: f.id), span_by_face

    def _split_into_axial_clusters(
        self, members: List[FaceRecord], axis: Vec, origin: Vec
    ) -> List[List[FaceRecord]]:
        """Split one coaxial axis's qualifying faces into physically separate holes.

        Sharing an axis line is necessary but not sufficient: two blind holes
        drilled from opposite faces of a part, perfectly aligned, are two
        holes with material (or open air) between them, not one hole spanning
        the gap. Faces only belong to the same hole when their axial extents
        are contiguous - touching or overlapping - so this re-clusters the
        faces :meth:`_qualifying_faces` already vetted, this time ignoring
        radius: a counterbore's steps differ in radius but still touch end to
        end, so that case still merges into one cluster.
        """
        ranges = {f.id: axial_range(f, axis, origin) for f in members}
        ordered = sorted(members, key=lambda f: (ranges[f.id][0], f.id))
        tolerance = self.config.linear_tolerance_mm

        clusters: List[List[FaceRecord]] = []
        cluster_high: Optional[float] = None
        for face in ordered:
            low, high = ranges[face.id]
            if clusters and cluster_high is not None and low <= cluster_high + tolerance:
                clusters[-1].append(face)
                cluster_high = max(cluster_high, high)
            else:
                clusters.append([face])
                cluster_high = high
        return clusters

    def _arc_bearing_deg(self, face: FaceRecord, axis: Vec, origin: Vec) -> float:
        """Angle of ``face``'s centroid about ``axis``, in [0, 360).

        The bore's own axis frame is used rather than world XY so the bearing
        is meaningful for a bore in any orientation.
        """
        u, v = perpendicular_basis(axis)
        offset = sub(face.centroid, origin)
        return math.degrees(math.atan2(dot(offset, v), dot(offset, u))) % 360.0

    def _is_interrupted_bore(
        self, segment: List[FaceRecord], span: float, axis: Vec, origin: Vec
    ) -> bool:
        """True when ``segment`` is one bore whose wall is broken by ribs.

        A bore crossed by webs survives only as arcs, so its summed wrap falls
        below :attr:`hole_min_angular_span_deg` and the plain wrap test drops a
        real feature - a back-face counterbore interrupted by four corner webs
        being the case that motivated this.

        Lowering the wrap threshold instead would readmit the blends and
        partial walls it exists to reject, so the discriminator is rotational
        symmetry: several arcs of one radius and one depth, spaced evenly about
        the axis, are a machined bore. Slivers of a fillet are not evenly
        spaced, and a lone partial wall has no siblings at all.
        """
        if len(segment) < self.config.interrupted_bore_min_fragments:
            return False
        if span < self.config.interrupted_bore_min_total_span_deg:
            return False

        # One depth: arcs of a single bore start and end together.
        ranges = [axial_range(face, axis, origin) for face in segment]
        if max(r[0] for r in ranges) - min(r[0] for r in ranges) > self.config.coaxial_tolerance_mm:
            return False
        if max(r[1] for r in ranges) - min(r[1] for r in ranges) > self.config.coaxial_tolerance_mm:
            return False

        # Regular spacing: consecutive bearings 360/N apart, wrapping around.
        bearings = sorted(self._arc_bearing_deg(f, axis, origin) for f in segment)
        expected = 360.0 / len(bearings)
        gaps = [
            (bearings[(i + 1) % len(bearings)] - bearings[i]) % 360.0
            for i in range(len(bearings))
        ]
        tolerance = self.config.interrupted_bore_spacing_tolerance_deg
        return all(abs(gap - expected) <= tolerance for gap in gaps)

    def _is_edge_broken_hole(
        self,
        segment: List[FaceRecord],
        span: float,
        axis: Vec,
        origin: Vec,
        classifier: Optional[PointClassifier],
    ) -> bool:
        """True when a lone sub-threshold arc is a hole broken by the part edge.

        :meth:`_is_interrupted_bore` only ever admits *several* regularly
        spaced fragments - a lone partial wall has no siblings to test
        regularity against, and is rejected there as a blend or a wall. But a
        lone arc has two distinct physical causes that look identical by wrap
        angle alone:

        * a hole drilled near the part's own edge, so the missing wall simply
          never existed as material - a real hole, just one the model cannot
          fully characterise from the remaining wall alone;
        * a corner fillet or blend, where the "missing" wall is exactly
          accounted for by the solid material the blend transitions into.

        The two are told apart the same way :meth:`_probe_ends` tells through
        from blind: by sampling the solid directly rather than reasoning from
        face topology. Two points are placed at the bore's own radius (nudged
        outward by ``hole_radial_probe_offset_mm``), just past each end of the
        surviving arc, into the missing portion of the circle.

        The probe is deliberately placed just past each *end* of the arc
        rather than diametrically opposite its centre. A genuine blend is
        tangent to the flat wall(s) it transitions into, so material
        continues right past the tangent point - a point diametrically
        opposite could easily fall inside a completely unrelated cavity
        further round the same axis (an embedded pocket, say) and read as
        open there for reasons that have nothing to do with this arc,
        wrongly admitting a blend. Right past the tangent point is exactly
        where a real blend's continuing wall would be, and exactly where a
        genuine edge-broken hole - whose wall simply stops because the part
        does - has nothing at all.

        Both ends must read as open (not merely one) for the hole to be
        admitted; either end reading as material means a wall continues
        there and this is rejected as a blend, exactly as before.

        At most two fragments are considered: a lone arc is the case this
        exists for, but the kernel's own cylindrical parametrisation has a
        seam, and an arc that happens to straddle it is reported as two
        touching fragments rather than one - an implementation artefact, not
        a second physical arc. Three or more fragments are left to
        :meth:`_is_interrupted_bore`, which is the rule for a wall genuinely
        broken into several pieces.
        """
        if len(segment) > 2:
            return False
        if classifier is None or not classifier.available:
            return False

        radius = segment[0].radius_mm or 0.0
        if radius <= 0:
            return False

        # Circular mean of the fragments' bearings, weighted by span, stands
        # in for "the arc's centre" whether there are one or two of them.
        sin_sum = cos_sum = 0.0
        for face in segment:
            bearing = math.radians(self._arc_bearing_deg(face, axis, origin))
            weight = face.angular_span_deg or 1.0
            sin_sum += weight * math.sin(bearing)
            cos_sum += weight * math.cos(bearing)
        center_bearing = math.degrees(math.atan2(sin_sum, cos_sum)) % 360.0
        half_span = span / 2.0

        ranges = [axial_range(face, axis, origin) for face in segment]
        mid_t = (min(r[0] for r in ranges) + max(r[1] for r in ranges)) / 2.0
        center = axis_point(origin, axis, mid_t)

        u, v = perpendicular_basis(axis)
        probe_radius = radius + self.config.hole_radial_probe_offset_mm

        def probe(bearing_deg: float) -> Optional[bool]:
            angle = math.radians(bearing_deg % 360.0)
            offset = add(
                scale(u, probe_radius * math.cos(angle)),
                scale(v, probe_radius * math.sin(angle)),
            )
            return classifier.is_material(add(center, offset))

        # A small angular margin clear of the nominal tangent point: sampled
        # exactly at the arc's own boundary the point can land right on the
        # kernel's face/edge boundary itself, which is unreliable; a few
        # degrees into the missing side is unambiguous while still short of
        # a genuine blend's own tangent wall.
        margin = self.config.interrupted_bore_spacing_tolerance_deg
        low_material = probe(center_bearing - half_span - margin)
        high_material = probe(center_bearing + half_span + margin)
        if low_material is None or high_material is None:
            return False
        return not low_material and not high_material

    def _build_groups(
        self, model: ShapeModel, classifier: Optional[PointClassifier] = None
    ) -> List[CylindricalGroup]:
        cylinders = self._candidate_cylinders(model)
        groups: List[CylindricalGroup] = []

        for coaxial_members in group_coaxial(cylinders, self.config):
            axis = canonical_axis(coaxial_members[0].axis)
            origin = coaxial_members[0].axis_location

            members, span_by_face = self._qualifying_faces(
                coaxial_members, axis, origin, classifier
            )
            if not members:
                continue  # only partial wraps - a blend or a wall, not a bore

            for cluster in self._split_into_axial_clusters(members, axis, origin):
                ranges = [axial_range(face, axis, origin) for face in cluster]
                t_min = min(r[0] for r in ranges)
                t_max = max(r[1] for r in ranges)
                best_span = max(span_by_face[f.id] for f in cluster)

                cones = self._coaxial_cones(model, axis, origin, t_min, t_max)
                if cones:
                    cone_ranges = [axial_range(c, axis, origin) for c in cones]
                    t_min = min(t_min, min(r[0] for r in cone_ranges))
                    t_max = max(t_max, max(r[1] for r in cone_ranges))

                groups.append(
                    CylindricalGroup(
                        axis=axis,
                        origin=origin,
                        cylinders=sorted(cluster, key=lambda f: f.id),
                        cones=cones,
                        t_min=t_min,
                        t_max=t_max,
                        wrap_span_deg=best_span,
                    )
                )

        # Deterministic ordering independent of kernel traversal order.
        groups.sort(key=lambda g: (round(g.t_max, 6), min(f.id for f in g.cylinders)))
        return groups

    def _coaxial_cones(
        self, model: ShapeModel, axis: Vec, origin: Vec, t_min: float, t_max: float
    ) -> List[FaceRecord]:
        """Internal cones sharing the group's axis *and* sitting at this hole's ends.

        Restricted to ``[t_min, t_max]`` (plus a small margin) so a
        countersink or drill point belonging to a *different* hole further
        along the same axis line - two holes drilled from opposite faces,
        perfectly aligned - is not pulled into this one's group.
        """
        result = []
        margin = self.config.linear_tolerance_mm * 100
        for face in model.faces_of_type(CONE):
            if face.is_internal is not True or face.axis is None or face.axis_location is None:
                continue
            if not is_parallel(face.axis, axis, self.config.angular_tolerance_deg):
                continue
            offset = sub(face.axis_location, origin)
            axial = dot(offset, axis)
            radial = sub(offset, scale(axis, axial))
            if (radial[0] ** 2 + radial[1] ** 2 + radial[2] ** 2) ** 0.5 > self.config.coaxial_tolerance_mm:
                continue
            low, high = axial_range(face, axis, origin)
            if high < t_min - margin or low > t_max + margin:
                continue
            result.append(face)
        return sorted(result, key=lambda f: f.id)

    def _claimed_face_ids(self, groups: List[CylindricalGroup]) -> List[int]:
        ids: List[int] = []
        for group in groups:
            ids.extend(f.id for f in group.cylinders)
            ids.extend(f.id for f in group.cones)
        return ids

    # -- classification ----------------------------------------------------

    def _classify(self, group: CylindricalGroup) -> str:
        """``hole`` | ``bore`` | ``internal_cylindrical_feature``.

        The third bucket exists so an ambiguous feature is reported honestly
        rather than forced into one of the other two.
        """
        diameter = (group.primary.radius_mm or 0.0) * 2.0
        depth = group.depth

        if diameter < self.config.max_hole_diameter_mm:
            return "hole"
        if diameter >= self.config.bore_min_diameter_mm and depth >= self.config.bore_min_depth_mm:
            return "bore"
        return "internal_cylindrical_feature"

    # -- geometry ----------------------------------------------------------

    def _bottom_cap(
        self,
        model: ShapeModel,
        group: CylindricalGroup,
        closed_t: Optional[float] = None,
    ) -> Tuple[Optional[FaceRecord], Optional[float]]:
        """Find a planar or conical face closing one end of the stack.

        Returns ``(cap_face, cap_parameter)``. ``None`` means no closing face
        was found.

        When ``closed_t`` is given the search is restricted to that end. The
        material probe knows which end is actually closed, and without that
        constraint any planar face perpendicular to the bore can pass for a
        bottom - a pocket floor the hole runs through being the common case.
        """
        member_ids = {f.id for f in group.cylinders} | {f.id for f in group.cones}
        for face in group.cylinders:
            for neighbor in model.neighbors(face.id):
                if neighbor.id in member_ids:
                    continue
                if neighbor.surface_type == PLANE and neighbor.normal is not None:
                    if not is_parallel(neighbor.normal, group.axis, self.config.angular_tolerance_deg * 5):
                        continue
                    # The annular shoulder between a counterbore and the hole
                    # below it is also planar and perpendicular to the axis. It
                    # is told apart by touching *two* cylinders of the stack,
                    # where a true bottom touches only the one it closes.
                    touching = sum(
                        1 for n in model.neighbors(neighbor.id) if n.id in member_ids
                    )
                    if touching >= 2:
                        continue
                    # An annular groove floor is also planar, perpendicular to
                    # the axis, and touches only one member of *this* stack -
                    # the same signature as a genuine disk bottom. What tells
                    # them apart is whether the cap actually reaches the axis:
                    # an annulus has its own inner boundary, formed by some
                    # other coaxial cylindrical or conical face (a boss, pin,
                    # or unrelated bore wall) that is not part of this hole's
                    # stack at all, sitting inside the ring at a smaller
                    # radius. A true solid disk has no such neighbour.
                    cap_radius = face.radius_mm or 0.0
                    is_annulus = False
                    for cap_neighbor in model.neighbors(neighbor.id):
                        if cap_neighbor.id in member_ids:
                            continue
                        if cap_neighbor.surface_type not in (CYLINDER, CONE):
                            continue
                        if cap_neighbor.axis is None:
                            continue
                        if not is_parallel(
                            cap_neighbor.axis, group.axis, self.config.angular_tolerance_deg
                        ):
                            continue
                        if (cap_neighbor.radius_mm or 0.0) < cap_radius:
                            is_annulus = True
                            break
                    if is_annulus:
                        continue
                    # A cap must not be wider than the surrounding stock face:
                    # require it to be comparable to the bore cross-section.
                    radius = face.radius_mm or 0.0
                    max_cap_area = math.pi * (radius * 1.5) ** 2
                    if neighbor.area_mm2 > max_cap_area:
                        continue
                    low, high = axial_range(neighbor, group.axis, group.origin)
                    if not self._touches_end(low, high, closed_t):
                        continue
                    return neighbor, (low + high) / 2.0

        # A conical drill point also closes the hole.
        for cone in group.cones:
            if cone.cone_half_angle_deg is None:
                continue
            if cone.cone_half_angle_deg > self.config.countersink_max_half_angle_deg:
                continue
            low, high = axial_range(cone, group.axis, group.origin)
            mid = (low + high) / 2.0
            if not self._touches_end(low, high, closed_t):
                continue
            # Only a cone at an *end* of the stack is a bottom, not a countersink
            # (which sits at the entry and is handled separately).
            if closed_t is not None or abs(mid - group.t_min) < abs(mid - group.t_max):
                return cone, mid
        return None, None

    def _touches_end(
        self, low: float, high: float, closed_t: Optional[float]
    ) -> bool:
        """True when an axial interval reaches the known closed end."""
        if closed_t is None:
            return True  # no constraint available - accept either end
        tolerance = self.config.linear_tolerance_mm * 100
        return low <= closed_t + tolerance and high >= closed_t - tolerance

    def _probe_ends(
        self, group: CylindricalGroup, classifier: Optional[PointClassifier]
    ) -> Tuple[Optional[bool], Optional[bool]]:
        """Is there material immediately past each end of the bore?

        Returns ``(material_beyond_t_min, material_beyond_t_max)``; ``None``
        where the kernel could not answer.

        This is the positive counterpart to :meth:`_bottom_cap`. Sampling a
        point just past the end and asking the solid classifier whether it sits
        in material settles through-vs-blind by measurement, rather than by the
        absence of a face - which an open shell or a dropped face imitates
        exactly.
        """
        if classifier is None or not classifier.available:
            return None, None

        offset = self.config.hole_end_probe_offset_mm
        below = axis_point(group.origin, group.axis, group.t_min - offset)
        above = axis_point(group.origin, group.axis, group.t_max + offset)
        return classifier.is_material(below), classifier.is_material(above)

    def _resolve_ends(
        self,
        model: ShapeModel,
        group: CylindricalGroup,
        ends: Tuple[Optional[bool], Optional[bool]],
    ) -> Tuple[Optional[bool], Optional[FaceRecord], Optional[float], str, float, Optional[str]]:
        """Decide through vs blind, and find the face that closes a blind end.

        Returns ``(through, cap, closed_t, method, confidence, reason)``.

        The material probe decides *whether* and *which* end is closed,
        because it measures the solid directly. The cap face is then looked
        for only at that end, where it characterises the bottom geometry
        rather than being asked to prove the bore is blind.
        """
        material_below, material_above = ends

        if material_below is None and material_above is None:
            # No classifier: fall back to inferring from the face alone.
            cap, cap_t = self._bottom_cap(model, group)
            if cap is None:
                return True, None, None, "cap_absence", 0.7, None
            return False, cap, cap_t, "cap_face", 0.9, None

        if not material_below and not material_above:
            return True, None, None, "solid_classification", 0.95, None

        closed_t = group.t_min if material_below else group.t_max
        cap, cap_t = self._bottom_cap(model, group, closed_t)
        if cap is not None:
            return (
                False,
                cap,
                cap_t,
                "cap_face_and_solid_classification",
                0.98,
                None,
            )
        return (
            False,
            None,
            closed_t,
            "solid_classification",
            0.8,
            (
                "Material lies beyond one end of the bore but no closing face "
                "was identified; the hole is blind, though its bottom geometry "
                "could not be characterised."
            ),
        )

    def _entry_direction(
        self, group: CylindricalGroup, closed_t: Optional[float]
    ) -> Tuple[Vec, float]:
        """Axis pointing out of the hole, plus the entry parameter.

        For a blind hole the tool retracts away from the closed end. For a
        through hole either end is valid, so the canonical axis is kept to keep
        the output reproducible.
        """
        if closed_t is not None and abs(closed_t - group.t_max) < abs(
            closed_t - group.t_min
        ):
            return scale(group.axis, -1.0), group.t_min
        return group.axis, group.t_max

    def _counter_features(
        self, group: CylindricalGroup, entry_axis: Vec, entry_t: float
    ) -> Dict[str, Any]:
        """Identify counterbore / countersink / stepped geometry at the entry."""
        info: Dict[str, Any] = {
            "has_counterbore": False,
            "has_countersink": False,
            "counterbore_diameter_mm": None,
            "counterbore_depth_mm": None,
            "countersink_diameter_mm": None,
            "countersink_angle_deg": None,
            "is_stepped": False,
            "steps": [],
            "counterbores": [],
        }

        primary_radius = group.primary.radius_mm or 0.0
        if primary_radius <= 0:
            return info

        # Steps are the distinct radii present in the stack, ordered along the
        # tool approach direction.
        steps = []
        for face in group.cylinders:
            low, high = axial_range(face, group.axis, group.origin)
            steps.append(
                {
                    "diameter_mm": round((face.radius_mm or 0.0) * 2.0, 4),
                    "depth_mm": round(high - low, 4),
                    "face_id": face.id,
                    "_from_entry": abs(entry_t - (high if entry_t >= high else low)),
                }
            )
        steps.sort(key=lambda s: (s["_from_entry"], s["face_id"]))
        for step in steps:
            step.pop("_from_entry", None)

        distinct_radii = sorted({round(f.radius_mm or 0.0, 4) for f in group.cylinders})
        if len(distinct_radii) > 1:
            info["is_stepped"] = True
            info["steps"] = steps

            # The counterbore is the widest section *at the entry*, so the
            # entry test has to select the candidate rather than veto it. The
            # other order silently loses a real counterbore whenever some wider
            # section exists further down the bore - a relief or an interrupted
            # recess at the far end is enough to do it.
            entry_tolerance = self.config.linear_tolerance_mm * 100
            far_t = group.t_min if entry_t >= group.t_max else group.t_max

            def widest_at(end_t: float) -> Optional[FaceRecord]:
                """Widest cylinder touching ``end_t``, or None.

                A ratio below ``counterbore_min_diameter_ratio`` is too close
                to the bore diameter to read as a deliberate counterbore.
                """
                touching = [
                    face
                    for face in group.cylinders
                    if min(
                        abs(end_t - bound)
                        for bound in axial_range(face, group.axis, group.origin)
                    )
                    <= entry_tolerance
                ]
                if not touching:
                    return None
                widest = max(touching, key=lambda f: (f.radius_mm or 0.0, -f.id))
                ratio = round(widest.radius_mm or 0.0, 4) / primary_radius
                if ratio < self.config.counterbore_min_diameter_ratio:
                    return None
                return widest

            # Both ends are examined: a through hole recessed at each end takes
            # two setups, and reporting only the entry silently loses the
            # second one. The scalar fields keep describing the entry.
            for label, end_t in (("entry", entry_t), ("far", far_t)):
                face = widest_at(end_t)
                if face is None:
                    continue
                radius = round(face.radius_mm or 0.0, 4)
                if (
                    label == "entry"
                    and radius / primary_radius > self.config.counterbore_max_diameter_ratio
                ):
                    # Too large a jump to merge as one counterbore step - this
                    # is instead offered to _split_oversized_counterbore,
                    # which reports it as two linked coaxial hole features. A
                    # far-side jump of the same size has no single entry axis
                    # to split cleanly around, so it is left as before.
                    continue
                low, high = axial_range(face, group.axis, group.origin)
                siblings = [
                    other.id
                    for other in group.cylinders
                    if abs((other.radius_mm or 0.0) - radius)
                    <= self.config.coaxial_tolerance_mm
                ]
                info["counterbores"].append(
                    {
                        "diameter_mm": round(radius * 2.0, 4),
                        "depth_mm": round(high - low, 4),
                        "end": label,
                        "face_ids": sorted(siblings),
                    }
                )
                if label == "entry":
                    info["has_counterbore"] = True
                    info["counterbore_diameter_mm"] = round(radius * 2.0, 4)
                    info["counterbore_depth_mm"] = round(high - low, 4)

        for cone in group.cones:
            if cone.cone_half_angle_deg is None:
                continue
            low, high = axial_range(cone, group.axis, group.origin)
            near_entry = min(abs(entry_t - low), abs(entry_t - high))
            if near_entry > self.config.linear_tolerance_mm * 100:
                continue
            if cone.cone_half_angle_deg <= self.config.countersink_max_half_angle_deg:
                info["has_countersink"] = True
                info["countersink_angle_deg"] = round(cone.cone_half_angle_deg * 2.0, 3)
                if cone.radius_mm:
                    info["countersink_diameter_mm"] = round(cone.radius_mm * 2.0, 4)
        return info

    def _subtype(self, through: Optional[bool], counters: Dict[str, Any]) -> str:
        if counters["has_counterbore"]:
            return "counterbore"
        if counters["has_countersink"]:
            return "countersink"
        if counters["is_stepped"]:
            return "stepped"
        if through is True:
            return "through"
        if through is False:
            return "blind"
        return "unknown"

    # -- thread candidate heuristic -----------------------------------------

    #: Subtypes where a tap is plausible enough to run the diameter heuristic
    #: on. `counterbore` and `countersink` are excluded: both are the classic
    #: signature of a *clearance* hole for a fastener head (a socket-head cap
    #: screw's shank, a flat-head screw's cone), so flagging them as tap
    #: candidates from diameter alone would be misleading more often than
    #: not. Nothing on HoleFeature positively marks a hole as a dowel or
    #: clearance hole, so beyond this the heuristic is not narrowed further.
    _TAP_PLAUSIBLE_SUBTYPES = frozenset({"through", "blind", "stepped", "unknown"})

    def _thread_candidate(
        self, diameter_mm: float, subtype: str
    ) -> Optional[ThreadCandidate]:
        if subtype not in self._TAP_PLAUSIBLE_SUBTYPES:
            return None
        return match_tap_drill(
            diameter_mm, self.config.tap_drill_diameter_tolerance_mm
        )

    # -- builders ----------------------------------------------------------

    def _common(
        self,
        model: ShapeModel,
        group: CylindricalGroup,
        classifier: Optional[PointClassifier],
    ) -> Dict[str, Any]:
        ends = self._probe_ends(group, classifier)
        through, cap, closed_t, method, confidence, conflict = self._resolve_ends(
            model, group, ends
        )
        entry_axis, entry_t = self._entry_direction(group, closed_t)
        counters = self._counter_features(group, entry_axis, entry_t)

        position = axis_point(group.origin, group.axis, entry_t)
        diameter = (group.primary.radius_mm or 0.0) * 2.0
        depth = group.depth
        ratio = depth / diameter if diameter > 0 else None

        face_ids = sorted(
            {f.id for f in group.cylinders}
            | {f.id for f in group.cones}
            | ({cap.id} if cap else set())
        )
        return {
            "cap": cap,
            "through": through,
            "method": method,
            "confidence": confidence,
            "conflict": conflict,
            "entry_axis": entry_axis,
            "position": position,
            "diameter": diameter,
            "depth": depth,
            "ratio": ratio,
            "counters": counters,
            "face_ids": face_ids,
        }

    _METHOD_EVIDENCE = {
        "cap_face_and_solid_classification": (
            "closed by a face and confirmed by material beyond that end"
        ),
        "solid_classification": "decided by sampling for material past each end",
        "cap_face": "closed by a face; no material probe available",
        "cap_absence": (
            "no closing face and no material probe - through inferred from "
            "absence, which an open shell would imitate"
        ),
        "conflicting": "the closing face and the material probe disagree",
    }

    def _detection(self, group: CylindricalGroup, common: Dict[str, Any]) -> Detection:
        cap = common["cap"]
        fragments = len(group.cylinders)
        evidence = [
            f"{fragments} coaxial concave cylindrical face(s)",
            (
                f"bore wrap {round(group.wrap_span_deg, 1)} deg"
                + (f" summed across {fragments} fragments" if fragments > 1 else "")
            ),
            self._METHOD_EVIDENCE.get(common["method"], common["method"]),
        ]
        interrupted = self._interrupted.intersection(f.id for f in group.cylinders)
        if interrupted:
            # Count the interrupted arcs, not every face in the stack: a
            # counterbored hole carries continuous sections too, and reporting
            # the stack total misdescribes what the rule actually admitted.
            evidence.append(
                f"wall interrupted - {len(interrupted)} equal arcs evenly "
                "spaced about the axis, admitted below the wrap threshold"
            )
        edge_broken = self._edge_broken.intersection(f.id for f in group.cylinders)
        if edge_broken:
            evidence.append(
                "edge_broken - lone arc below the wrap threshold, admitted "
                "because a radial probe found open space (not material) where "
                "the rest of the circle would be, confirming the bore exits "
                "the part boundary rather than being a blend"
            )
        if cap is not None:
            evidence.append(f"closing face {cap.id}")
        evidence.append("through" if common["through"] else "blind")
        return Detection(
            method=(
                DetectionMethod.RAY_CASTING
                if "solid_classification" in common["method"]
                else DetectionMethod.COAXIAL_GROUPING
            ),
            confidence=common["confidence"],
            evidence=evidence,
        )

    # -- oversized coaxial ratio: two linked holes instead of one merged one --

    def _split_oversized_counterbore(
        self,
        model: ShapeModel,
        group: CylindricalGroup,
        classifier: Optional[PointClassifier],
    ) -> Optional[Tuple[CylindricalGroup, CylindricalGroup, float, Dict[str, Any]]]:
        """Split a coaxial stack whose entry section is disproportionately wide.

        The geometry here is genuinely one coaxial bore system - a narrower,
        deeper section with a wider, shallower section on top of it. Below
        ``counterbore_max_diameter_ratio`` that is reported as one hole with
        counterbore metadata. Above it, this method reports two linked coaxial
        hole features instead: it is *not* a claim that these are two distinct
        physical holes or two distinct manufacturing operations, only that the
        diameter jump is large enough that collapsing it into one counterbored
        hole would overstate what the geometry alone supports.

        Only an oversized section at the *entry* is handled: a single entry
        axis and position can no longer describe two independently-approached
        features cleanly once the wide section sits at the far end instead,
        so that case is left to the ordinary (merged) counterbore path, which
        still records its geometry in ``steps`` without calling it a
        counterbore.

        Returns ``(wide_group, narrow_group, boundary_t, full)`` or ``None``
        when no split applies. ``full`` carries the whole stack's own
        through/blind resolution, which the narrow section inherits.
        """
        if len(group.cylinders) < 2:
            return None
        primary_radius = group.primary.radius_mm or 0.0
        if primary_radius <= 0:
            return None

        ends = self._probe_ends(group, classifier)
        through, cap, closed_t, method, confidence, conflict = self._resolve_ends(
            model, group, ends
        )
        entry_axis, entry_t = self._entry_direction(group, closed_t)

        entry_tolerance = self.config.linear_tolerance_mm * 100
        touching = [
            face
            for face in group.cylinders
            if min(
                abs(entry_t - bound)
                for bound in axial_range(face, group.axis, group.origin)
            )
            <= entry_tolerance
        ]
        if not touching:
            return None
        widest = max(touching, key=lambda f: (f.radius_mm or 0.0, -f.id))
        widest_radius = round(widest.radius_mm or 0.0, 4)
        ratio = widest_radius / primary_radius
        if ratio <= self.config.counterbore_max_diameter_ratio:
            return None

        wide_ids = {
            f.id
            for f in group.cylinders
            if abs((f.radius_mm or 0.0) - widest_radius) <= self.config.coaxial_tolerance_mm
        }
        wide_faces = [f for f in group.cylinders if f.id in wide_ids]
        narrow_faces = [f for f in group.cylinders if f.id not in wide_ids]
        if not narrow_faces:
            return None  # nothing left to be the linked, narrower feature

        wide_ranges = [axial_range(f, group.axis, group.origin) for f in wide_faces]
        w_t_min = min(r[0] for r in wide_ranges)
        w_t_max = max(r[1] for r in wide_ranges)
        narrow_ranges = [axial_range(f, group.axis, group.origin) for f in narrow_faces]
        n_t_min = min(r[0] for r in narrow_ranges)
        n_t_max = max(r[1] for r in narrow_ranges)

        margin = self.config.linear_tolerance_mm * 100

        def cones_within(lo: float, hi: float) -> List[FaceRecord]:
            result = []
            for cone in group.cones:
                clo, chi = axial_range(cone, group.axis, group.origin)
                if chi < lo - margin or clo > hi + margin:
                    continue
                result.append(cone)
            return result

        wide_group = CylindricalGroup(
            axis=group.axis,
            origin=group.origin,
            cylinders=sorted(wide_faces, key=lambda f: f.id),
            cones=cones_within(w_t_min, w_t_max),
            t_min=w_t_min,
            t_max=w_t_max,
            wrap_span_deg=group.wrap_span_deg,
        )
        narrow_group = CylindricalGroup(
            axis=group.axis,
            origin=group.origin,
            cylinders=sorted(narrow_faces, key=lambda f: f.id),
            cones=cones_within(n_t_min, n_t_max),
            t_min=n_t_min,
            t_max=n_t_max,
            wrap_span_deg=group.wrap_span_deg,
        )

        # The boundary is whichever end of the wide section is *not* the true
        # part-exterior entry - i.e. the end it shares with the narrow group.
        boundary_t = w_t_min if abs(entry_t - w_t_max) < abs(entry_t - w_t_min) else w_t_max

        full = {
            "through": through,
            "cap": cap,
            "closed_t": closed_t,
            "method": method,
            "confidence": confidence,
            "conflict": conflict,
            "entry_axis": entry_axis,
            "entry_t": entry_t,
        }
        return wide_group, narrow_group, boundary_t, full

    def _split_detection(
        self, group: CylindricalGroup, common: Dict[str, Any]
    ) -> Detection:
        fragments = len(group.cylinders)
        evidence = [
            f"{fragments} coaxial concave cylindrical face(s)",
            (
                "diameter ratio to its linked coaxial section exceeds "
                f"{self.config.counterbore_max_diameter_ratio} - reported as "
                "two linked coaxial hole features rather than one merged "
                "counterbore, without asserting they are separate physical "
                "holes or separate manufacturing operations"
            ),
        ]
        if common.get("cap") is not None:
            evidence.append(f"closing face {common['cap'].id}")
        evidence.append("through" if common["through"] else "blind")
        return Detection(
            method=DetectionMethod.COAXIAL_GROUPING,
            confidence=common["confidence"],
            evidence=evidence,
        )

    def _build_split_holes(
        self,
        model: ShapeModel,
        wide_group: CylindricalGroup,
        narrow_group: CylindricalGroup,
        boundary_t: float,
        full: Dict[str, Any],
        wide_id: str,
        narrow_id: str,
    ) -> Tuple[HoleFeature, HoleFeature]:
        """Build the wide/shallow and narrow/deep halves of a ratio split.

        Neither record claims to be a distinct physical hole or a distinct
        manufacturing operation - see :meth:`_split_oversized_counterbore`.
        """
        # -- wide (entry) side: always resolved against the boundary it
        # shares with the narrow section, since that is the one question this
        # split exists to answer honestly - it is typically blind/shallow.
        wide_cap, _wide_cap_t = self._bottom_cap(model, wide_group, boundary_t)
        wide_diameter = (wide_group.primary.radius_mm or 0.0) * 2.0
        wide_depth = wide_group.depth
        wide_position = axis_point(wide_group.origin, wide_group.axis, full["entry_t"])
        wide_counters = self._counter_features(wide_group, full["entry_axis"], full["entry_t"])
        wide_face_ids = sorted(
            {f.id for f in wide_group.cylinders}
            | {f.id for f in wide_group.cones}
            | ({wide_cap.id} if wide_cap else set())
        )
        wide_reason = None
        if wide_cap is None:
            wide_reason = (
                "This coaxial section is reported linked to a narrower, "
                "deeper coaxial section rather than merged into one "
                "counterbored hole, because the diameter ratio between them "
                "exceeds the configured ceiling; the boundary between them "
                "could not be characterised with a closing face."
            )
        wide_common = {
            "cap": wide_cap,
            "through": False,
            "confidence": 0.9 if wide_cap is not None else 0.6,
        }
        wide_subtype = self._subtype(False, wide_counters)
        wide_hole = HoleFeature(
            id=wide_id,
            subtype=wide_subtype,
            diameter_mm=wide_diameter,
            radius_mm=wide_diameter / 2.0,
            depth_mm=wide_depth,
            through=False,
            position=Vector3.from_tuple(wide_position),
            axis=Vector3.from_tuple(full["entry_axis"]),
            depth_diameter_ratio=(wide_depth / wide_diameter if wide_diameter > 0 else None),
            face_ids=wide_face_ids,
            detection=self._split_detection(wide_group, wide_common),
            status=FeatureStatus.RESOLVED if wide_cap is not None else FeatureStatus.AMBIGUOUS,
            reason=wide_reason,
            is_stepped=wide_counters["is_stepped"],
            has_counterbore=wide_counters["has_counterbore"],
            has_countersink=wide_counters["has_countersink"],
            counterbore_diameter_mm=wide_counters["counterbore_diameter_mm"],
            counterbore_depth_mm=wide_counters["counterbore_depth_mm"],
            counterbores=[CounterboreStep(**cb) for cb in wide_counters["counterbores"]],
            countersink_diameter_mm=wide_counters["countersink_diameter_mm"],
            countersink_angle_deg=wide_counters["countersink_angle_deg"],
            steps=wide_counters["steps"],
            coaxial_feature_ids=[narrow_id],
            thread_candidate=self._thread_candidate(wide_diameter, wide_subtype),
        )

        # -- narrow (deep) side: inherits the whole stack's own through/blind
        # resolution, since the far end that decides it is entirely within
        # this section regardless of where the wide section was cut away.
        narrow_diameter = (narrow_group.primary.radius_mm or 0.0) * 2.0
        narrow_depth = narrow_group.depth
        narrow_entry_axis, _ = self._entry_direction(narrow_group, full["closed_t"])
        narrow_entry_t = boundary_t
        narrow_position = axis_point(narrow_group.origin, narrow_group.axis, narrow_entry_t)
        narrow_counters = self._counter_features(narrow_group, narrow_entry_axis, narrow_entry_t)
        narrow_face_ids = sorted(
            {f.id for f in narrow_group.cylinders}
            | {f.id for f in narrow_group.cones}
            | ({full["cap"].id} if full["cap"] else set())
        )
        narrow_common = {
            "cap": full["cap"],
            "through": full["through"],
            "confidence": full["confidence"],
        }
        narrow_subtype = self._subtype(full["through"], narrow_counters)
        narrow_hole = HoleFeature(
            id=narrow_id,
            subtype=narrow_subtype,
            diameter_mm=narrow_diameter,
            radius_mm=narrow_diameter / 2.0,
            depth_mm=narrow_depth,
            through=full["through"],
            position=Vector3.from_tuple(narrow_position),
            axis=Vector3.from_tuple(narrow_entry_axis),
            depth_diameter_ratio=(
                narrow_depth / narrow_diameter if narrow_diameter > 0 else None
            ),
            face_ids=narrow_face_ids,
            detection=self._split_detection(narrow_group, narrow_common),
            status=FeatureStatus.AMBIGUOUS if full["conflict"] else FeatureStatus.RESOLVED,
            reason=full["conflict"],
            is_stepped=narrow_counters["is_stepped"],
            has_counterbore=narrow_counters["has_counterbore"],
            has_countersink=narrow_counters["has_countersink"],
            counterbore_diameter_mm=narrow_counters["counterbore_diameter_mm"],
            counterbore_depth_mm=narrow_counters["counterbore_depth_mm"],
            counterbores=[CounterboreStep(**cb) for cb in narrow_counters["counterbores"]],
            countersink_diameter_mm=narrow_counters["countersink_diameter_mm"],
            countersink_angle_deg=narrow_counters["countersink_angle_deg"],
            steps=narrow_counters["steps"],
            coaxial_feature_ids=[wide_id],
            thread_candidate=self._thread_candidate(narrow_diameter, narrow_subtype),
        )
        return wide_hole, narrow_hole

    def _edge_broken_reason(self, group: CylindricalGroup) -> str:
        """Why a lone sub-threshold arc admitted via the radial probe is ambiguous."""
        return (
            f"Bore wraps only {round(group.wrap_span_deg, 1)} deg because it "
            "exits the stock at the part boundary; the hole's full circular "
            "extent could not be confirmed from the remaining material alone "
            "- verify against design intent."
        )

    def _build_hole(
        self,
        model: ShapeModel,
        group: CylindricalGroup,
        hole_id: str,
        classifier: Optional[PointClassifier] = None,
    ) -> HoleFeature:
        c = self._common(model, group, classifier)
        counters = c["counters"]
        edge_broken = self._edge_broken.intersection(f.id for f in group.cylinders)
        reason = c["conflict"] or (self._edge_broken_reason(group) if edge_broken else None)
        subtype = self._subtype(c["through"], counters)
        return HoleFeature(
            id=hole_id,
            subtype=subtype,
            diameter_mm=c["diameter"],
            radius_mm=c["diameter"] / 2.0,
            depth_mm=c["depth"],
            through=c["through"],
            position=Vector3.from_tuple(c["position"]),
            axis=Vector3.from_tuple(c["entry_axis"]),
            depth_diameter_ratio=c["ratio"],
            face_ids=c["face_ids"],
            detection=self._detection(group, c),
            status=(
                FeatureStatus.AMBIGUOUS
                if (c["conflict"] or edge_broken)
                else FeatureStatus.RESOLVED
            ),
            reason=reason,
            is_stepped=counters["is_stepped"],
            has_counterbore=counters["has_counterbore"],
            has_countersink=counters["has_countersink"],
            counterbore_diameter_mm=counters["counterbore_diameter_mm"],
            counterbore_depth_mm=counters["counterbore_depth_mm"],
            counterbores=[CounterboreStep(**cb) for cb in counters["counterbores"]],
            countersink_diameter_mm=counters["countersink_diameter_mm"],
            countersink_angle_deg=counters["countersink_angle_deg"],
            steps=counters["steps"],
            thread_candidate=self._thread_candidate(c["diameter"], subtype),
        )

    def _build_bore(
        self,
        model: ShapeModel,
        group: CylindricalGroup,
        bore_id: str,
        type_name: str,
        classifier: Optional[PointClassifier] = None,
    ) -> BoreFeature:
        c = self._common(model, group, classifier)
        unresolved_type = type_name == "internal_cylindrical_feature"
        edge_broken = self._edge_broken.intersection(f.id for f in group.cylinders)
        ambiguous = unresolved_type or bool(c["conflict"]) or bool(edge_broken)
        reason = (
            c["conflict"]
            or (
                "Internal cylindrical surface is above the hole diameter limit "
                f"({self.config.max_hole_diameter_mm} mm) but below the bore depth "
                f"threshold ({self.config.bore_min_depth_mm} mm); geometry alone "
                "cannot separate a bore from a shallow recess."
                if unresolved_type
                else None
            )
            or (self._edge_broken_reason(group) if edge_broken else None)
        )
        return BoreFeature(
            id=bore_id,
            type=type_name,
            diameter_mm=c["diameter"],
            depth_mm=c["depth"],
            blind=None if c["through"] is None else (not c["through"]),
            position=Vector3.from_tuple(c["position"]),
            axis=Vector3.from_tuple(c["entry_axis"]),
            depth_diameter_ratio=c["ratio"],
            is_stepped=c["counters"]["is_stepped"],
            face_ids=c["face_ids"],
            status=FeatureStatus.AMBIGUOUS if ambiguous else FeatureStatus.RESOLVED,
            reason=reason,
            detection=self._detection(group, c),
        )
