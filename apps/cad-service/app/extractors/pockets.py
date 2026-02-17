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
        it = lst.cbegin()
        while it.More():
            f2 = it.Value()
            it.Next()
            if not f2.IsSame(face):
                neighbors.add(f2)
    return neighbors


def _count_vertical_walls(floor_normal, neighbors, brep_tool, geom_plane):
    """Count neighbor faces whose normals are roughly perpendicular to *floor_normal*."""
    count = 0
    for nf in neighbors:
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
        surf = BRep_Tool.Surface(face)
        plane = Geom_Plane.DownCast(surf)
        if plane is None:
            continue

        neighbors = _collect_pocket_neighbors(face, edge_faces, TopExp_Explorer, TopAbs_EDGE)

        floor_n = plane.Pln().Axis().Direction()
        fn = (floor_n.X(), floor_n.Y(), floor_n.Z())
        vertical_count = _count_vertical_walls(fn, neighbors, BRep_Tool, Geom_Plane)
        if vertical_count < 2:
            continue

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
