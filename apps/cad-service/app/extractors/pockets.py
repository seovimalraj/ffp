from __future__ import annotations
from typing import List

from ..models import PocketFeature


def extract_pockets_from_shape(shape) -> List[PocketFeature]:
    """Detect simple planar pockets: planar floor with perpendicular side walls.
    Returns a conservative list to reduce false positives.
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core import TopExp

        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_Plane
        from OCC.Core.TopTools import TopTools_IndexedMapOfShape, TopTools_IndexedDataMapOfShapeListOfShape
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties
    except Exception:
        print("⚠️ OCC imports unavailable for pocket extraction - returning empty")
        return []

    face_map = TopTools_IndexedMapOfShape()
    TopExp.MapShapes(shape, TopAbs_FACE, face_map)

    edge_faces = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_faces)

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

        # Collect neighbor faces
        neighbor_faces = set()
        edge_exp = TopExp_Explorer(face, TopAbs_EDGE)
        while edge_exp.More():
            edge = edge_exp.Current()
            edge_exp.Next()
            if edge_faces.Contains(edge):
                lst = edge_faces.FindFromKey(edge)
                it = lst.cbegin()
                while it.More():
                    f2 = it.Value()
                    it.Next()
                    if f2.IsSame(face):
                        continue
                    neighbor_faces.add(f2)

        # Count vertical walls (neighbor faces with normals ~ perpendicular to floor)
        floor_n = plane.Pln().Axis().Direction()
        fn = (floor_n.X(), floor_n.Y(), floor_n.Z())

        def dot(a, b):
            return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

        vertical_neighbors = 0
        for nf in neighbor_faces:
            nsurf = BRep_Tool.Surface(nf)
            p2 = Geom_Plane.DownCast(nsurf)
            if p2 is None:
                continue
            n2 = p2.Pln().Axis().Direction()
            n2v = (n2.X(), n2.Y(), n2.Z())
            if abs(dot(fn, n2v)) <= 0.2:  # ~90 degrees
                vertical_neighbors += 1

        if vertical_neighbors < 2:
            continue

        # Compute area as mouth area
        props = GProp_GProps()
        try:
            brepgprop_SurfaceProperties(face, props)
            mouth_area = float(props.Mass()) * 1e6  # m^2 -> mm^2
        except Exception:
            mouth_area = 0.0

        # Depth is not trivial; placeholder 0.0 for now
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
