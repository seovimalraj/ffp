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
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import GeomAbs_Cylinder, GeomAbs_Plane, GeomAbs_Cone
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
        "BRepAdaptor_Surface": BRepAdaptor_Surface,
        "GeomAbs_Cylinder": GeomAbs_Cylinder,
        "GeomAbs_Plane": GeomAbs_Plane,
        "GeomAbs_Cone": GeomAbs_Cone,
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
        try:
            faces = list(lst)
        except Exception:
            faces = []
        for f2 in faces:
            if not f2.IsSame(face):
                neighbor_faces.add(f2)
    return neighbor_faces


def _classify_cap_faces(neighbor_faces, axis_vec, face_map, occ):
    """Identify entry and exit cap faces among neighbours.

    Uses BRepAdaptor_Surface for robust face-type detection instead of
    fragile Geom_Plane.DownCast().

    Returns ``(entry_id, exit_id, entry_origin, exit_origin)``.
    """
    entry_id = None
    exit_id = None
    entry_origin = None
    exit_origin = None

    BRepAdaptor = occ.get("BRepAdaptor_Surface")
    GeomAbs_Plane = occ.get("GeomAbs_Plane")

    for nf in neighbor_faces:
        # Prefer BRepAdaptor_Surface for robust type detection
        if BRepAdaptor is not None and GeomAbs_Plane is not None:
            try:
                adaptor = BRepAdaptor(nf)
                if adaptor.GetType() != GeomAbs_Plane:
                    continue
                pln = adaptor.Plane()
                n_dir = pln.Axis().Direction()
                loc = pln.Location()
            except Exception:
                continue
        else:
            # Fallback to DownCast path
            nsurf = occ["BRep_Tool"].Surface(nf)
            plane = occ["Geom_Plane"].DownCast(nsurf)
            if plane is None:
                continue
            n_dir = plane.Pln().Axis().Direction()
            loc = plane.Location()

        n_vec = (n_dir.X(), n_dir.Y(), n_dir.Z())
        if abs(_dot(axis_vec, n_vec)) < 0.9:
            continue

        fid = face_map.FindIndex(nf)
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

        # Use BRepAdaptor_Surface for robust surface-type detection
        BRepAdaptor = occ.get("BRepAdaptor_Surface")
        GeomAbs_Cylinder = occ.get("GeomAbs_Cylinder")
        GeomAbs_Cone = occ.get("GeomAbs_Cone")

        is_cylinder = False
        is_countersink = False
        radius = 0.0
        axis_vec = (0.0, 0.0, 1.0)

        if BRepAdaptor is not None and GeomAbs_Cylinder is not None:
            try:
                adaptor = BRepAdaptor(face)
                surf_type = adaptor.GetType()
                if surf_type == GeomAbs_Cylinder:
                    cyl = adaptor.Cylinder()
                    radius = cyl.Radius()
                    axis_dir = cyl.Axis().Direction()
                    axis_vec = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
                    is_cylinder = True
                elif surf_type == GeomAbs_Cone and GeomAbs_Cone is not None:
                    # Conical surfaces near cylindrical holes indicate
                    # countersinks or counterbores
                    cone = adaptor.Cone()
                    half_angle = cone.SemiAngle()
                    ref_radius = cone.RefRadius()
                    if 0.3 < abs(half_angle) < 1.2 and ref_radius > 0.5:
                        radius = ref_radius
                        axis_dir = cone.Axis().Direction()
                        axis_vec = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
                        is_cylinder = True
                        is_countersink = True
            except Exception:
                pass

        # Fallback to DownCast approach
        if not is_cylinder:
            surf = occ["BRep_Tool"].Surface(face)
            cyl = occ["Geom_CylindricalSurface"].DownCast(surf)
            if cyl is None:
                continue
            radius = cyl.Cylinder().Radius()
            axis_dir = cyl.Cylinder().Axis().Direction()
            axis_vec = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
            is_cylinder = True

        if not is_cylinder or radius <= 0:
            continue

        depth_est = _estimate_cylinder_depth(face, occ)
        neighbors = _collect_cylinder_neighbors(face, edge_faces, occ)
        entry_id, exit_id, entry_origin, exit_origin = _classify_cap_faces(
            neighbors, axis_vec, face_map, occ
        )
        depth = _compute_hole_depth(entry_origin, exit_origin, axis_vec, depth_est)

        hole_type = "through" if entry_id and exit_id else "blind"
        if is_countersink:
            hole_type = "countersink"

        holes.append(
            HoleFeature(
                id=f"H-{idx:03d}",
                type=hole_type,
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
