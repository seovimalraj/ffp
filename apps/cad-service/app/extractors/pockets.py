from __future__ import annotations

import logging
from typing import List

from ..models import PocketFeature

logger = logging.getLogger(__name__)


def _dot3(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _collect_pocket_neighbors(face, edge_faces, explorer_cls, edge_type):
    """Return the set of faces sharing an edge with *face*."""
    neighbors: set = set()
    edge_exp = explorer_cls(face, edge_type)
    while edge_exp.More():
        edge = edge_exp.Current()
        edge_exp.Next()
        if not edge_faces.Contains(edge):
            continue
        lst = edge_faces.FindFromKey(edge)
        try:
            faces = list(lst)
        except Exception:
            faces = []
        for f2 in faces:
            if not f2.IsSame(face):
                neighbors.add(f2)
    return neighbors


def _count_vertical_walls(floor_normal, neighbors, brep_tool, geom_plane,
                          adaptor_cls=None, plane_type=None):
    """Count neighbor faces whose normals are roughly perpendicular to *floor_normal*.

    Uses BRepAdaptor_Surface when available for more robust face-type
    detection, falling back to Geom_Plane.DownCast().
    """
    count = 0
    for nf in neighbors:
        n2v = None
        # Prefer BRepAdaptor_Surface
        if adaptor_cls is not None and plane_type is not None:
            try:
                adaptor = adaptor_cls(nf)
                if adaptor.GetType() == plane_type:
                    pln = adaptor.Plane()
                    n2 = pln.Axis().Direction()
                    n2v = (n2.X(), n2.Y(), n2.Z())
            except Exception:
                pass
        # Fallback to DownCast
        if n2v is None:
            nsurf = brep_tool.Surface(nf)
            p2 = geom_plane.DownCast(nsurf)
            if p2 is None:
                continue
            n2 = p2.Pln().Axis().Direction()
            n2v = (n2.X(), n2.Y(), n2.Z())
        if abs(_dot3(floor_normal, n2v)) <= 0.2:
            count += 1
    return count


def _face_mouth_area(face, brepgprop_fn, gprop_cls) -> float:
    """Compute face surface area in mm²."""
    props = gprop_cls()
    try:
        brepgprop_fn(face, props)
        return float(props.Mass()) * 1e6  # m² → mm²
    except Exception:
        return 0.0


def extract_pockets_from_shape(shape) -> List[PocketFeature]:
    """Detect simple planar pockets: planar floor with perpendicular side walls.
    Returns a conservative list to reduce false positives.

    Uses BRepAdaptor_Surface for robust surface-type detection when available,
    falling back to Geom_Plane.DownCast().
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer, topexp
        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_Plane
        from OCC.Core.TopTools import TopTools_IndexedMapOfShape, TopTools_IndexedDataMapOfShapeListOfShape
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties
    except Exception:
        logger.warning("OCC imports unavailable for pocket extraction")
        return []

    # Try importing BRepAdaptor for robust face-type detection
    adaptor_cls = None
    plane_type = None
    cylinder_type = None
    try:
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import GeomAbs_Plane, GeomAbs_Cylinder
        adaptor_cls = BRepAdaptor_Surface
        plane_type = GeomAbs_Plane
        cylinder_type = GeomAbs_Cylinder
    except Exception:
        pass

    face_map = TopTools_IndexedMapOfShape()
    topexp.MapShapes(shape, TopAbs_FACE, face_map)

    edge_faces = TopTools_IndexedDataMapOfShapeListOfShape()
    topexp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_faces)

    pockets: List[PocketFeature] = []
    idx = 1

    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = exp.Current()
        exp.Next()

        # Detect planar floor via BRepAdaptor_Surface (preferred) or DownCast
        fn = None
        if adaptor_cls is not None and plane_type is not None:
            try:
                adaptor = adaptor_cls(face)
                if adaptor.GetType() == plane_type:
                    pln = adaptor.Plane()
                    floor_n = pln.Axis().Direction()
                    fn = (floor_n.X(), floor_n.Y(), floor_n.Z())
            except Exception:
                pass

        if fn is None:
            surf = BRep_Tool.Surface(face)
            plane = Geom_Plane.DownCast(surf)
            if plane is None:
                continue
            floor_n = plane.Pln().Axis().Direction()
            fn = (floor_n.X(), floor_n.Y(), floor_n.Z())

        neighbors = _collect_pocket_neighbors(face, edge_faces, TopExp_Explorer, TopAbs_EDGE)

        vertical_count = _count_vertical_walls(fn, neighbors, BRep_Tool, Geom_Plane,
                                               adaptor_cls=adaptor_cls,
                                               plane_type=plane_type)
        if vertical_count < 2:
            continue

        # Check for cylindrical walls as additional pocket wall evidence
        curved_wall_count = 0
        if adaptor_cls is not None and cylinder_type is not None:
            for nf in neighbors:
                try:
                    nadaptor = adaptor_cls(nf)
                    if nadaptor.GetType() == cylinder_type:
                        curved_wall_count += 1
                except Exception:
                    pass

        mouth_area = _face_mouth_area(face, brepgprop_SurfaceProperties, GProp_GProps)
        floor_id = face_map.FindIndex(face)
        pockets.append(
            PocketFeature(
                id=f"P-{idx:03d}",
                planar_face_ids=[int(floor_id)],
                depth_mm=0.0,
                mouth_area_mm2=mouth_area,
                aspect_ratio=0.0,
            )
        )
        idx += 1

    return pockets
