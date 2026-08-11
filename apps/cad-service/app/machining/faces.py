"""Face classification: OCCT surface type plus resolved surface parameters.

Concavity ("is this cylinder a hole or a shaft?") is resolved here once, from
the surface normal versus the radial direction, and every downstream detector
relies on that single answer rather than re-deriving it.
"""

from __future__ import annotations

import logging
import math
from typing import Any, List, Optional, Tuple

from . import occ
from .config import MachiningConfig
from .records import (
    BEZIER,
    BSPLINE,
    CONE,
    CYLINDER,
    EXTRUSION,
    OFFSET,
    OTHER,
    PLANE,
    REVOLUTION,
    SPHERE,
    TORUS,
    FaceRecord,
    ShapeModel,
)
from .schemas import SurfaceSummary, SurfaceType
from .vectors import Vec, dot, normalize, sub

logger = logging.getLogger(__name__)


def _surface_type_map():
    """OCCT ``GeomAbs_SurfaceType`` enum -> our string identifiers."""
    return {
        occ.GeomAbs_Plane: PLANE,
        occ.GeomAbs_Cylinder: CYLINDER,
        occ.GeomAbs_Cone: CONE,
        occ.GeomAbs_Sphere: SPHERE,
        occ.GeomAbs_Torus: TORUS,
        occ.GeomAbs_BezierSurface: BEZIER,
        occ.GeomAbs_BSplineSurface: BSPLINE,
        occ.GeomAbs_SurfaceOfRevolution: REVOLUTION,
        occ.GeomAbs_SurfaceOfExtrusion: EXTRUSION,
        occ.GeomAbs_OffsetSurface: OFFSET,
    }


def _pnt(p: Any) -> Vec:
    return (float(p.X()), float(p.Y()), float(p.Z()))


def _dir(d: Any) -> Vec:
    return (float(d.X()), float(d.Y()), float(d.Z()))


class FaceClassifier:
    """Turns a ``TopoDS_Face`` into a fully-populated :class:`FaceRecord`."""

    def __init__(self, config: MachiningConfig):
        self.config = config
        self._type_map = _surface_type_map() if occ.kernel_available() else {}

    def classify(self, face: Any, face_id: int, solid_index: int = 0) -> FaceRecord:
        record = FaceRecord(id=face_id, solid_index=solid_index)
        record.reversed_orientation = bool(face.Orientation() == occ.TopAbs_REVERSED)

        adaptor = occ.BRepAdaptor_Surface(face, True)
        record.surface_type = self._type_map.get(adaptor.GetType(), OTHER)

        self._fill_mass_props(face, record)
        self._fill_bbox(face, record)
        self._fill_surface_params(face, adaptor, record)
        return record

    # -- basic properties --------------------------------------------------

    def _fill_mass_props(self, face: Any, record: FaceRecord) -> None:
        try:
            props = occ.GProp_GProps()
            occ._surface_properties(face, props)
            record.area_mm2 = float(props.Mass())
            record.centroid = _pnt(props.CentreOfMass())
        except Exception as exc:
            logger.debug("Face %s mass properties failed: %s", record.id, exc)

    def _fill_bbox(self, face: Any, record: FaceRecord) -> None:
        try:
            box = occ.Bnd_Box()
            occ.add_to_bbox(face, box, False)
            xmin, ymin, zmin, xmax, ymax, zmax = box.Get()
            record.bbox_min = (float(xmin), float(ymin), float(zmin))
            record.bbox_max = (float(xmax), float(ymax), float(zmax))
        except Exception as exc:
            logger.debug("Face %s bounding box failed: %s", record.id, exc)

    # -- surface-specific parameters --------------------------------------

    def _fill_surface_params(self, face: Any, adaptor: Any, record: FaceRecord) -> None:
        try:
            umin, umax, vmin, vmax = occ.face_uv_bounds(face)
        except Exception:
            umin = umax = vmin = vmax = 0.0

        try:
            if record.surface_type == PLANE:
                self._fill_plane(adaptor, record)
            elif record.surface_type == CYLINDER:
                self._fill_cylinder(face, adaptor, record, umin, umax, vmin, vmax)
            elif record.surface_type == CONE:
                self._fill_cone(face, adaptor, record, umin, umax, vmin, vmax)
            elif record.surface_type == TORUS:
                self._fill_torus(face, adaptor, record, umin, umax)
            elif record.surface_type == SPHERE:
                self._fill_sphere(face, adaptor, record)
        except Exception as exc:
            logger.debug(
                "Face %s (%s) parameter extraction failed: %s",
                record.id,
                record.surface_type,
                exc,
            )

    def _fill_plane(self, adaptor: Any, record: FaceRecord) -> None:
        plane = adaptor.Plane()
        normal = _dir(plane.Axis().Direction())
        # A REVERSED face uses the opposite of the surface normal as its outward
        # direction; without this flip every pocket floor would point into
        # material.
        if record.reversed_orientation:
            normal = (-normal[0], -normal[1], -normal[2])
        record.normal = normalize(normal)
        record.axis_location = _pnt(plane.Location())

    def _fill_cylinder(
        self,
        face: Any,
        adaptor: Any,
        record: FaceRecord,
        umin: float,
        umax: float,
        vmin: float,
        vmax: float,
    ) -> None:
        cylinder = adaptor.Cylinder()
        record.radius_mm = float(cylinder.Radius())
        record.axis = normalize(_dir(cylinder.Axis().Direction()))
        record.axis_location = _pnt(cylinder.Axis().Location())
        record.angular_span_deg = math.degrees(abs(umax - umin))
        # For a canonical cylinder the V parameter is arc length along the axis.
        record.axial_extent_mm = abs(vmax - vmin)
        record.is_internal = self._is_concave(face, record, umin, umax, vmin, vmax)

    def _fill_cone(
        self,
        face: Any,
        adaptor: Any,
        record: FaceRecord,
        umin: float,
        umax: float,
        vmin: float,
        vmax: float,
    ) -> None:
        cone = adaptor.Cone()
        record.axis = normalize(_dir(cone.Axis().Direction()))
        record.axis_location = _pnt(cone.Axis().Location())
        half_angle = float(cone.SemiAngle())
        record.cone_half_angle_deg = abs(math.degrees(half_angle))
        record.radius_mm = float(cone.RefRadius())
        record.angular_span_deg = math.degrees(abs(umax - umin))
        # V is measured along the slant; project onto the axis.
        record.axial_extent_mm = abs(vmax - vmin) * abs(math.cos(half_angle))
        record.is_internal = self._is_concave(face, record, umin, umax, vmin, vmax)

    def _fill_torus(
        self, face: Any, adaptor: Any, record: FaceRecord, umin: float, umax: float
    ) -> None:
        torus = adaptor.Torus()
        record.radius_mm = float(torus.MajorRadius())
        record.minor_radius_mm = float(torus.MinorRadius())
        record.axis = normalize(_dir(torus.Axis().Direction()))
        record.axis_location = _pnt(torus.Axis().Location())
        record.angular_span_deg = math.degrees(abs(umax - umin))

    def _fill_sphere(self, adaptor: Any, record: FaceRecord) -> None:
        sphere = adaptor.Sphere()
        record.radius_mm = float(sphere.Radius())
        record.axis_location = _pnt(sphere.Position().Location())

    # -- concavity ---------------------------------------------------------

    def _is_concave(
        self,
        face: Any,
        record: FaceRecord,
        umin: float,
        umax: float,
        vmin: float,
        vmax: float,
    ) -> Optional[bool]:
        """True when the surface wraps material - i.e. it bounds a hole.

        The test compares the outward face normal against the radial direction
        from the axis. A shaft's normal points away from its axis; a bore's
        points back towards it. This is the single most important geometric
        distinction in the whole package, so it is measured rather than guessed.
        """
        if record.axis is None or record.axis_location is None:
            return None
        if occ.BRepLProp_SLProps is None:
            return None
        try:
            u = (umin + umax) / 2.0
            v = (vmin + vmax) / 2.0
            surface = occ.BRepAdaptor_Surface(face, True)
            props = occ.BRepLProp_SLProps(surface, u, v, 1, 1e-6)
            if not props.IsNormalDefined():
                return None
            normal = _dir(props.Normal())
            point = _pnt(props.Value())
        except Exception as exc:
            logger.debug("Concavity probe failed on face %s: %s", record.id, exc)
            return None

        if record.reversed_orientation:
            normal = (-normal[0], -normal[1], -normal[2])

        # Radial component of (point - axis_location), with the axial part removed.
        to_point = sub(point, record.axis_location)
        axial = dot(to_point, record.axis)
        radial = (
            to_point[0] - record.axis[0] * axial,
            to_point[1] - record.axis[1] * axial,
            to_point[2] - record.axis[2] * axial,
        )
        radial = normalize(radial)
        if radial == (0.0, 0.0, 0.0):
            return None
        return dot(normalize(normal), radial) < 0.0


def summarize_surfaces(model: ShapeModel) -> SurfaceSummary:
    """Aggregate face-type counts across the whole model."""
    summary = SurfaceSummary()
    for face in model.faces.values():
        summary.total_faces += 1
        if face.surface_type == PLANE:
            summary.planar_faces += 1
        elif face.surface_type == CYLINDER:
            summary.cylindrical_faces += 1
            if face.is_internal is True:
                summary.internal_cylindrical_faces += 1
            elif face.is_internal is False:
                summary.external_cylindrical_faces += 1
        elif face.surface_type == CONE:
            summary.conical_faces += 1
        elif face.surface_type == SPHERE:
            summary.spherical_faces += 1
        elif face.surface_type == TORUS:
            summary.toroidal_faces += 1
        elif face.is_freeform:
            summary.freeform_faces += 1
        else:
            summary.other_faces += 1
    return summary


def to_surface_type_enum(value: str) -> SurfaceType:
    try:
        return SurfaceType(value)
    except ValueError:
        return SurfaceType.OTHER
