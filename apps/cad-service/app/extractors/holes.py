from __future__ import annotations

import logging
from typing import List, Optional, Tuple

from ..models import HoleFeature

logger = logging.getLogger(__name__)


def _try_import_hole_occ():
    """Attempt to import OCC modules for hole detection."""
    try:
        from OCC.Core.TopExp import TopExp_Explorer, topexp
        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_CylindricalSurface, Geom_Plane
        from OCC.Core.BRepTools import breptools_UVBounds
        from OCC.Core.TopTools import (
            TopTools_IndexedMapOfShape,
            TopTools_IndexedDataMapOfShapeListOfShape,
        )
    except Exception:
        logger.warning("OCC imports unavailable for hole extraction")
        return None
    return {
        "TopExp_Explorer": TopExp_Explorer,
        "TopExp": topexp,
        "TopAbs_FACE": TopAbs_FACE,
        "TopAbs_EDGE": TopAbs_EDGE,
        "BRep_Tool": BRep_Tool,
        "Geom_CylindricalSurface": Geom_CylindricalSurface,
        "Geom_Plane": Geom_Plane,
        "breptools_UVBounds": breptools_UVBounds,
        "TopTools_IndexedMapOfShape": TopTools_IndexedMapOfShape,
        "TopTools_IndexedDataMapOfShapeListOfShape": TopTools_IndexedDataMapOfShapeListOfShape,
    }


def _dot(a, b):
    """Dot product of two 3-element tuples."""
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _estimate_cylinder_depth(face, occ):
    """Estimate cylinder depth from UV parameter bounds."""
    try:
        _, _, vmin, vmax = occ["breptools_UVBounds"](face)
        return float(abs(vmax - vmin))
    except Exception:
        return 0.0


def _collect_cylinder_neighbors(face, edge_faces, occ):
    """Collect adjacent faces to a cylindrical face via shared edges."""
    neighbor_faces = set()
    edge_exp = occ["TopExp_Explorer"](face, occ["TopAbs_EDGE"])
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
                neighbor_faces.add(f2)
    return neighbor_faces


def _classify_cap_faces(neighbor_faces, axis_vec, face_map, occ):
    """Identify entry and exit cap faces among neighbours.

    Returns ``(entry_id, exit_id, entry_origin, exit_origin)``.
    """
    entry_id = None
    exit_id = None
    entry_origin = None
    exit_origin = None

    for nf in neighbor_faces:
        nsurf = occ["BRep_Tool"].Surface(nf)
        plane = occ["Geom_Plane"].DownCast(nsurf)
        if plane is None:
            continue
        n_dir = plane.Pln().Axis().Direction()
        n_vec = (n_dir.X(), n_dir.Y(), n_dir.Z())
        if abs(_dot(axis_vec, n_vec)) < 0.9:
            continue

        fid = face_map.FindIndex(nf)
        loc = plane.Location()
        origin = (loc.X(), loc.Y(), loc.Z())
        if _dot(axis_vec, n_vec) > 0:
            exit_id = fid
            exit_origin = origin
        else:
            entry_id = fid
            entry_origin = origin

    return entry_id, exit_id, entry_origin, exit_origin


def _compute_hole_depth(entry_origin, exit_origin, axis_vec, fallback_depth):
    """Compute hole depth from cap-plane origins, falling back to UV estimate."""
    if not entry_origin or not exit_origin:
        return fallback_depth
    return abs(
        (exit_origin[0] - entry_origin[0]) * axis_vec[0]
        + (exit_origin[1] - entry_origin[1]) * axis_vec[1]
        + (exit_origin[2] - entry_origin[2]) * axis_vec[2]
    )


def extract_holes_from_shape(shape) -> List[HoleFeature]:
    """Detect cylindrical holes and identify planar cap faces for entry/exit.

    If pythonOCC is not available, returns ``[]``.
    """
    occ = _try_import_hole_occ()
    if occ is None:
        return []

    top_exp = occ["TopExp"]
    face_map = occ["TopTools_IndexedMapOfShape"]()
    top_exp.MapShapes(shape, occ["TopAbs_FACE"], face_map)

    edge_faces = occ["TopTools_IndexedDataMapOfShapeListOfShape"]()
    top_exp.MapShapesAndAncestors(
        shape, occ["TopAbs_EDGE"], occ["TopAbs_FACE"], edge_faces
    )

    holes: List[HoleFeature] = []
    idx = 1
    exp = occ["TopExp_Explorer"](shape, occ["TopAbs_FACE"])
    while exp.More():
        face = exp.Current()
        exp.Next()

        surf = occ["BRep_Tool"].Surface(face)
        cyl = occ["Geom_CylindricalSurface"].DownCast(surf)
        if cyl is None:
            continue

        radius = cyl.Cylinder().Radius()
        if radius <= 0:
            continue

        axis_dir = cyl.Cylinder().Axis().Direction()
        axis_vec = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())

        depth_est = _estimate_cylinder_depth(face, occ)
        neighbors = _collect_cylinder_neighbors(face, edge_faces, occ)
        entry_id, exit_id, entry_origin, exit_origin = _classify_cap_faces(
            neighbors, axis_vec, face_map, occ
        )
        depth = _compute_hole_depth(entry_origin, exit_origin, axis_vec, depth_est)

        holes.append(
            HoleFeature(
                id=f"H-{idx:03d}",
                type="through" if entry_id and exit_id else "blind",
                diameter_mm=float(2.0 * radius),
                depth_mm=float(depth),
                axis=axis_vec,
                entry_face_id=int(entry_id) if entry_id else None,
                exit_face_id=int(exit_id) if exit_id else None,
                tri_indices=[],
            )
        )
        idx += 1
    return holes
