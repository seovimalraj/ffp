from __future__ import annotations
from typing import List, Optional, Tuple

from ..models import HoleFeature


def extract_holes_from_shape(shape) -> List[HoleFeature]:
    """Detect cylindrical holes and identify planar cap faces for entry/exit.
    If pythonOCC is not available, returns [].
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core import TopExp        
        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_CylindricalSurface, Geom_Plane
        from OCC.Core.BRepTools import breptools_UVBounds
        from OCC.Core.TopTools import TopTools_IndexedMapOfShape, TopTools_IndexedDataMapOfShapeListOfShape
        from OCC.Core.gp import gp_Dir, gp_Pnt
    except Exception:
        print("⚠️ OCC imports unavailable for hole extraction - returning empty")
        return []

    face_map = TopTools_IndexedMapOfShape()
    TopExp.MapShapes(shape, TopAbs_FACE, face_map)

    # Edge -> Faces adjacency map
    edge_faces = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_faces)

    holes: List[HoleFeature] = []
    idx = 1
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = exp.Current()
        exp.Next()
        surf = BRep_Tool.Surface(face)
        cyl = Geom_CylindricalSurface.DownCast(surf)
        if cyl is None:
            continue

        radius = cyl.Cylinder().Radius()
        if radius <= 0:
            continue
        diameter = float(2.0 * radius)

        # Cylinder axis direction
        axis_dir = cyl.Cylinder().Axis().Direction()
        axis_vec = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())

        # Estimate depth from param bounds as fallback
        depth_est = 0.0
        try:
            umin, umax, vmin, vmax = breptools_UVBounds(face)
            depth_est = float(abs(vmax - vmin))
        except Exception:
            pass

        # Find adjacent planar caps whose normal aligns with axis
        entry_id: Optional[int] = None
        exit_id: Optional[int] = None
        entry_plane_origin: Optional[Tuple[float, float, float]] = None
        exit_plane_origin: Optional[Tuple[float, float, float]] = None

        # Iterate edges of the cylindrical face and collect neighbor faces
        edge_exp = TopExp_Explorer(face, TopAbs_EDGE)
        neighbor_faces = set()
        while edge_exp.More():
            edge = edge_exp.Current()
            edge_exp.Next()
            if edge_faces.Contains(edge):
                lst = edge_faces.FindFromKey(edge)
                # Iterate faces sharing this edge
                it = lst.cbegin()
                while it.More():
                    f2 = it.Value()
                    it.Next()
                    if f2.IsSame(face):
                        continue
                    neighbor_faces.add(f2)

        def dot(a, b):
            return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

        for nf in neighbor_faces:
            nsurf = BRep_Tool.Surface(nf)
            plane = Geom_Plane.DownCast(nsurf)
            if plane is None:
                continue
            n_dir = plane.Pln().Axis().Direction()
            n_vec = (n_dir.X(), n_dir.Y(), n_dir.Z())
            d = abs(dot(axis_vec, n_vec))
            if d >= 0.9:
                # Cap candidate
                fid = face_map.FindIndex(nf)
                loc = plane.Location()
                origin = (loc.X(), loc.Y(), loc.Z())
                s = dot(axis_vec, n_vec)
                if s > 0:
                    # Normal points along axis -> exit
                    exit_id = fid
                    exit_plane_origin = origin
                else:
                    entry_id = fid
                    entry_plane_origin = origin

        # Compute depth from cap plane origins if both present
        depth = depth_est
        if entry_plane_origin and exit_plane_origin:
            depth = abs(
                (exit_plane_origin[0] - entry_plane_origin[0]) * axis_vec[0]
                + (exit_plane_origin[1] - entry_plane_origin[1]) * axis_vec[1]
                + (exit_plane_origin[2] - entry_plane_origin[2]) * axis_vec[2]
            )

        hole_type = "through" if entry_id and exit_id else "blind"

        holes.append(
            HoleFeature(
                id=f"H-{idx:03d}",
                type=hole_type,
                diameter_mm=diameter,
                depth_mm=float(depth),
                axis=axis_vec,
                entry_face_id=int(entry_id) if entry_id else None,
                exit_face_id=int(exit_id) if exit_id else None,
                tri_indices=[],
            )
        )
        idx += 1
    return holes
