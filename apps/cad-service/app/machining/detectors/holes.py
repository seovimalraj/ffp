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

    # -- entry point -------------------------------------------------------

    def detect(
        self, model: ShapeModel
    ) -> Tuple[List[HoleFeature], List[BoreFeature], List[BoreFeature]]:
        """Return ``(holes, bores, unresolved_internal_cylindrical_features)``."""
        groups = self._build_groups(model)

        holes: List[HoleFeature] = []
        bores: List[BoreFeature] = []
        unresolved: List[BoreFeature] = []

        for group in groups:
            classification = self._classify(group)
            if classification == "hole":
                holes.append(self._build_hole(model, group, feature_id("HOLE", len(holes) + 1)))
            elif classification == "bore":
                bores.append(
                    self._build_bore(
                        model, group, feature_id("BORE", len(bores) + 1), "bore"
                    )
                )
            else:
                unresolved.append(
                    self._build_bore(
                        model,
                        group,
                        feature_id("ICF", len(unresolved) + 1),
                        "internal_cylindrical_feature",
                    )
                )

        for face_id in self._claimed_face_ids(groups):
            if face_id in model.faces:
                model.faces[face_id].claimed_by = "hole"

        return holes, bores, unresolved

    # -- grouping ----------------------------------------------------------

    def _candidate_cylinders(self, model: ShapeModel) -> List[FaceRecord]:
        """Concave cylinders that wrap far enough round to bound a hole."""
        candidates = []
        for face in model.faces_of_type(CYLINDER):
            if face.is_internal is not True:
                continue  # external cylinder -> shaft or boss, not a hole
            if not face.radius_mm or face.radius_mm <= 0:
                continue
            diameter = face.radius_mm * 2.0
            if diameter < self.config.min_hole_diameter_mm:
                continue
            span = face.angular_span_deg
            if span is not None and span < self.config.hole_min_angular_span_deg:
                continue  # a partial wrap is a corner blend or a wall fragment
            candidates.append(face)
        return candidates

    def _build_groups(self, model: ShapeModel) -> List[CylindricalGroup]:
        cylinders = self._candidate_cylinders(model)
        groups: List[CylindricalGroup] = []

        for members in group_coaxial(cylinders, self.config):
            axis = canonical_axis(members[0].axis)
            origin = members[0].axis_location
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
        self, model: ShapeModel, group: CylindricalGroup
    ) -> Tuple[Optional[FaceRecord], Optional[float]]:
        """Find a planar or conical face closing one end of the stack.

        Returns ``(cap_face, cap_parameter)``. ``None`` means neither end is
        closed, i.e. the hole passes through.
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
                    return neighbor, (low + high) / 2.0

        # A conical drill point also closes the hole.
        for cone in group.cones:
            if cone.cone_half_angle_deg is None:
                continue
            if cone.cone_half_angle_deg > self.config.countersink_max_half_angle_deg:
                continue
            low, high = axial_range(cone, group.axis, group.origin)
            mid = (low + high) / 2.0
            # Only a cone at an *end* of the stack is a bottom, not a countersink
            # (which sits at the entry and is handled separately).
            if abs(mid - group.t_min) < abs(mid - group.t_max):
                return cone, mid
        return None, None

    def _entry_direction(
        self, group: CylindricalGroup, cap_t: Optional[float]
    ) -> Tuple[Vec, float]:
        """Axis pointing out of the hole, plus the entry parameter.

        For a blind hole the tool retracts away from the closed end. For a
        through hole either end is valid, so the canonical axis is kept to make
        the output reproducible.
        """
        if cap_t is not None and abs(cap_t - group.t_max) < abs(cap_t - group.t_min):
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

    def _common(self, model: ShapeModel, group: CylindricalGroup) -> Dict[str, Any]:
        cap, cap_t = self._bottom_cap(model, group)
        through = cap is None
        entry_axis, entry_t = self._entry_direction(group, cap_t)
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
            "entry_axis": entry_axis,
            "position": position,
            "diameter": diameter,
            "depth": depth,
            "ratio": ratio,
            "counters": counters,
            "face_ids": face_ids,
        }

    def _detection(self, group: CylindricalGroup, through: bool, cap) -> Detection:
        evidence = [
            f"{len(group.cylinders)} coaxial concave cylindrical face(s)",
            f"angular span {round(group.cylinders[0].angular_span_deg or 0.0, 1)} deg",
        ]
        if cap is not None:
            evidence.append(f"closed by face {cap.id} - blind")
            confidence = 0.95
        else:
            evidence.append("no closing face found on either end - through")
            # Absence of a cap is weaker evidence than its presence: an open
            # shell or a missing face produces the same signature.
            confidence = 0.85
        return Detection(
            method=DetectionMethod.COAXIAL_GROUPING,
            confidence=confidence,
            evidence=evidence,
        )

    def _build_hole(
        self, model: ShapeModel, group: CylindricalGroup, hole_id: str
    ) -> HoleFeature:
        c = self._common(model, group)
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
            detection=self._detection(group, c["through"], c["cap"]),
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
        self, model: ShapeModel, group: CylindricalGroup, bore_id: str, type_name: str
    ) -> BoreFeature:
        c = self._common(model, group)
        ambiguous = type_name == "internal_cylindrical_feature"
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
            reason=(
                "Internal cylindrical surface is above the hole diameter limit "
                f"({self.config.max_hole_diameter_mm} mm) but below the bore depth "
                f"threshold ({self.config.bore_min_depth_mm} mm); geometry alone "
                "cannot separate a bore from a shallow recess."
                if ambiguous
                else None
            ),
            detection=self._detection(group, c["through"], c["cap"]),
        )
