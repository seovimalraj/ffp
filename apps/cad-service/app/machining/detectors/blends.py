"""Fillet and chamfer detection.

The two are separated by tangency, which is what actually distinguishes them:

* a **fillet** flows smoothly into both neighbours (tangent-continuous), so a
  tool follows an arc through it;
* a **chamfer** meets both neighbours at a visible angle - a narrow flat band.

The minimum *internal* fillet radius is surfaced separately because it, not the
average radius, constrains the largest usable tool.
"""

from __future__ import annotations

import logging
import math
from typing import List, Optional, Tuple

from ..config import MachiningConfig
from ..records import CONE, CYLINDER, PLANE, TORUS, FaceRecord, ShapeModel
from ..schemas import (
    ChamferFeature,
    ChamferSummary,
    Detection,
    DetectionMethod,
    FeatureStatus,
    FilletFeature,
    FilletSummary,
    Vector3,
)
from ..vectors import angle_between_deg, unique_rounded
from .shared import feature_id, is_tangent_across, planar_dimensions

logger = logging.getLogger(__name__)


class FilletDetector:
    """Finds tangent-continuous blend surfaces."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def detect(self, model: ShapeModel) -> List[FilletFeature]:
        features: List[FilletFeature] = []
        for face in sorted(model.faces.values(), key=lambda f: f.id):
            result = self._evaluate(model, face)
            if result is None:
                continue
            radius, is_corner, tangent_count = result
            features.append(
                FilletFeature(
                    id=feature_id("FILLET", len(features) + 1),
                    radius_mm=radius,
                    edge_count=tangent_count,
                    length_mm=self._swept_length(model, face),
                    position=Vector3.from_tuple(face.centroid),
                    internal=face.is_internal,
                    is_corner_fillet=is_corner,
                    face_ids=[face.id],
                    detection=Detection(
                        method=DetectionMethod.TANGENCY,
                        confidence=0.9,
                        evidence=[
                            f"{'toroidal' if is_corner else 'cylindrical'} face "
                            f"{face.id} of radius {round(radius, 3)} mm",
                            f"tangent-continuous across {tangent_count} shared edge(s)",
                        ],
                    ),
                )
            )
        return features

    def _evaluate(
        self, model: ShapeModel, face: FaceRecord
    ) -> Optional[Tuple[float, bool, int]]:
        """Return ``(radius, is_corner_fillet, tangent_neighbour_count)``."""
        if face.claimed_by == "hole":
            return None

        if face.surface_type == CYLINDER:
            radius = face.radius_mm
            is_corner = False
            # A full or near-full wrap is a hole or a shaft, not an edge blend.
            if face.angular_span_deg is not None and face.angular_span_deg >= self.config.hole_min_angular_span_deg:
                return None
        elif face.surface_type == TORUS:
            radius = face.minor_radius_mm
            is_corner = True
        else:
            return None

        if not radius or radius <= 0 or radius > self.config.fillet_max_radius_mm:
            return None

        tangent = [
            neighbor
            for neighbor in model.neighbors(face.id)
            if is_tangent_across(model, face, neighbor, self.config)
        ]
        # A blend must flow into geometry on *both* sides; one tangent
        # neighbour is a smooth continuation, not a fillet.
        if len(tangent) < 2:
            return None

        return float(radius), is_corner, len(tangent)

    def _swept_length(self, model: ShapeModel, face: FaceRecord) -> Optional[float]:
        edges = [model.edges[e] for e in face.edge_ids if e in model.edges]
        if not edges:
            return None
        return max(e.length_mm for e in edges)

    def summarize(self, fillets: List[FilletFeature]) -> FilletSummary:
        if not fillets:
            return FilletSummary()
        radii = [f.radius_mm for f in fillets]
        internal = [f.radius_mm for f in fillets if f.internal is True]
        return FilletSummary(
            count=len(fillets),
            unique_radii_mm=unique_rounded(radii, self.config.length_decimals),
            minimum_radius_mm=round(min(radii), self.config.length_decimals),
            minimum_internal_radius_mm=(
                round(min(internal), self.config.length_decimals) if internal else None
            ),
        )


class ChamferDetector:
    """Finds narrow angled bands between two faces."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def detect(self, model: ShapeModel) -> List[ChamferFeature]:
        features: List[ChamferFeature] = []
        for face in sorted(model.faces.values(), key=lambda f: f.id):
            result = self._evaluate(model, face)
            if result is None:
                continue
            size, angle, neighbors, length = result
            features.append(
                ChamferFeature(
                    id=feature_id("CHAMFER", len(features) + 1),
                    size_mm=size,
                    angle_deg=angle,
                    edge_count=neighbors,
                    length_mm=length,
                    position=Vector3.from_tuple(face.centroid),
                    face_ids=[face.id],
                    status=(
                        FeatureStatus.RESOLVED if angle is not None else FeatureStatus.AMBIGUOUS
                    ),
                    reason=(
                        None
                        if angle is not None
                        else "Narrow band detected but its angle to the adjoining "
                        "faces could not be measured."
                    ),
                    detection=Detection(
                        method=DetectionMethod.ADJACENCY,
                        confidence=0.8 if angle is not None else 0.55,
                        evidence=[
                            f"planar band face {face.id}, width {round(size, 3)} mm",
                            f"meets {neighbors} face(s) at an angle "
                            f"({round(angle, 1) if angle else 'unmeasured'} deg)",
                        ],
                    ),
                )
            )
        return features

    def _evaluate(
        self, model: ShapeModel, face: FaceRecord
    ) -> Optional[Tuple[float, Optional[float], int, Optional[float]]]:
        if face.surface_type != PLANE or face.normal is None:
            return None
        if face.claimed_by == "hole":
            return None

        length, width, _, _ = planar_dimensions(face, face.normal)
        if width <= 0 or length <= 0:
            return None
        if width > self.config.chamfer_max_width_mm:
            return None
        if width / length > self.config.chamfer_max_aspect_for_band:
            return None  # not a narrow band

        angles = []
        angled_neighbors = 0
        for neighbor in model.neighbors(face.id):
            if neighbor.surface_type != PLANE or neighbor.normal is None:
                continue
            if is_tangent_across(model, face, neighbor, self.config):
                continue
            angle = angle_between_deg(face.normal, neighbor.normal)
            if self.config.chamfer_min_angle_deg <= angle <= self.config.chamfer_max_angle_deg:
                angles.append(angle)
                angled_neighbors += 1

        # A chamfer bridges two faces; a single angled neighbour is a step face.
        if angled_neighbors < 2:
            return None

        return width, (min(angles) if angles else None), angled_neighbors, length

    def summarize(self, chamfers: List[ChamferFeature]) -> ChamferSummary:
        if not chamfers:
            return ChamferSummary()
        return ChamferSummary(
            count=len(chamfers),
            sizes_mm=unique_rounded(
                [c.size_mm for c in chamfers], self.config.length_decimals
            ),
            unique_angles_deg=unique_rounded(
                [c.angle_deg for c in chamfers if c.angle_deg is not None], 1
            ),
        )
