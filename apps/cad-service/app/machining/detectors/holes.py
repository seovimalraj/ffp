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
    Detection,
    DetectionMethod,
    FeatureStatus,
    HoleFeature,
    Vector3,
)
from ..vectors import (
    Vec,
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

    # -- entry point -------------------------------------------------------

    def detect(
        self, model: ShapeModel
    ) -> Tuple[List[HoleFeature], List[BoreFeature], List[BoreFeature]]:
        """Return ``(holes, bores, unresolved_internal_cylindrical_features)``."""
        # Face ids restart per model, so a reused detector would otherwise
        # attribute a previous part's interruptions to this one.
        self._interrupted.clear()
        groups = self._build_groups(model)
        # One classifier for the whole model: construction is the costly
        # part, each query after that is cheap.
        classifier = PointClassifier(model, self.config)

        holes: List[HoleFeature] = []
        bores: List[BoreFeature] = []
        unresolved: List[BoreFeature] = []

        for group in groups:
            classification = self._classify(group)
            if classification == "hole":
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
        self, members: List[FaceRecord], axis: Vec, origin: Vec
    ) -> Tuple[List[FaceRecord], float]:
        """Keep only fragments belonging to a sufficiently wrapped bore.

        Returns the surviving faces and the largest summed wrap found, which is
        reported as detection evidence.
        """
        kept: List[FaceRecord] = []
        best_span = 0.0
        for segment in self._bore_segments(members, axis, origin):
            span = sum(face.angular_span_deg or 360.0 for face in segment)
            best_span = max(best_span, span)
            if span >= self.config.hole_min_angular_span_deg:
                kept.extend(segment)
            elif self._is_interrupted_bore(segment, span, axis, origin):
                kept.extend(segment)
                self._interrupted.update(face.id for face in segment)
        return sorted(kept, key=lambda f: f.id), best_span

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

    def _build_groups(self, model: ShapeModel) -> List[CylindricalGroup]:
        cylinders = self._candidate_cylinders(model)
        groups: List[CylindricalGroup] = []

        for coaxial_members in group_coaxial(cylinders, self.config):
            axis = canonical_axis(coaxial_members[0].axis)
            origin = coaxial_members[0].axis_location

            members, best_span = self._qualifying_faces(coaxial_members, axis, origin)
            if not members:
                continue  # only partial wraps - a blend or a wall, not a bore
            ranges = [axial_range(face, axis, origin) for face in members]
            t_min = min(r[0] for r in ranges)
            t_max = max(r[1] for r in ranges)

            cones = self._coaxial_cones(model, axis, origin)
            if cones:
                cone_ranges = [axial_range(c, axis, origin) for c in cones]
                t_min = min(t_min, min(r[0] for r in cone_ranges))
                t_max = max(t_max, max(r[1] for r in cone_ranges))

            groups.append(
                CylindricalGroup(
                    axis=axis,
                    origin=origin,
                    cylinders=sorted(members, key=lambda f: f.id),
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
        self, model: ShapeModel, axis: Vec, origin: Vec
    ) -> List[FaceRecord]:
        """Internal cones sharing the group's axis - countersinks and drill points."""
        result = []
        for face in model.faces_of_type(CONE):
            if face.is_internal is not True or face.axis is None or face.axis_location is None:
                continue
            if not is_parallel(face.axis, axis, self.config.angular_tolerance_deg):
                continue
            offset = sub(face.axis_location, origin)
            axial = dot(offset, axis)
            radial = sub(offset, scale(axis, axial))
            if (radial[0] ** 2 + radial[1] ** 2 + radial[2] ** 2) ** 0.5 <= self.config.coaxial_tolerance_mm:
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

            largest = max(distinct_radii)
            if largest / primary_radius >= self.config.counterbore_min_diameter_ratio:
                cb_face = max(group.cylinders, key=lambda f: (f.radius_mm or 0.0, -f.id))
                low, high = axial_range(cb_face, group.axis, group.origin)
                # Only counts as a counterbore when it sits at the entry end.
                near_entry = min(abs(entry_t - low), abs(entry_t - high))
                if near_entry <= self.config.linear_tolerance_mm * 100:
                    info["has_counterbore"] = True
                    info["counterbore_diameter_mm"] = round(largest * 2.0, 4)
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
        if self._interrupted.intersection(f.id for f in group.cylinders):
            evidence.append(
                f"wall interrupted - {fragments} equal arcs evenly spaced about "
                "the axis, admitted below the wrap threshold"
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

    def _build_hole(
        self,
        model: ShapeModel,
        group: CylindricalGroup,
        hole_id: str,
        classifier: Optional[PointClassifier] = None,
    ) -> HoleFeature:
        c = self._common(model, group, classifier)
        counters = c["counters"]
        return HoleFeature(
            id=hole_id,
            subtype=self._subtype(c["through"], counters),
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
                FeatureStatus.AMBIGUOUS if c["conflict"] else FeatureStatus.RESOLVED
            ),
            reason=c["conflict"],
            is_stepped=counters["is_stepped"],
            has_counterbore=counters["has_counterbore"],
            has_countersink=counters["has_countersink"],
            counterbore_diameter_mm=counters["counterbore_diameter_mm"],
            counterbore_depth_mm=counters["counterbore_depth_mm"],
            countersink_diameter_mm=counters["countersink_diameter_mm"],
            countersink_angle_deg=counters["countersink_angle_deg"],
            steps=counters["steps"],
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
        ambiguous = unresolved_type or bool(c["conflict"])
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
            reason=c["conflict"]
            or (
                "Internal cylindrical surface is above the hole diameter limit "
                f"({self.config.max_hole_diameter_mm} mm) but below the bore depth "
                f"threshold ({self.config.bore_min_depth_mm} mm); geometry alone "
                "cannot separate a bore from a shallow recess."
                if unresolved_type
                else None
            ),
            detection=self._detection(group, c),
        )
