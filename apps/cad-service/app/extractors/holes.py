from __future__ import annotations

import logging
from typing import List, Optional, Tuple, cast

from ..models import HoleFeature, HoleType

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
        # GAP 8 FIX: Extract cylinder axis position directly (not just from cap faces)
        cyl_axis_position = None

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
                    # GAP 8 FIX: Get axis location point
                    axis_loc = cyl.Axis().Location()
                    cyl_axis_position = (axis_loc.X(), axis_loc.Y(), axis_loc.Z())
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
                        # Get cone apex position
                        apex = cone.Apex()
                        cyl_axis_position = (apex.X(), apex.Y(), apex.Z())
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
            # GAP 8 FIX: Get axis location from DownCast path too
            try:
                axis_loc = cyl.Cylinder().Axis().Location()
                cyl_axis_position = (axis_loc.X(), axis_loc.Y(), axis_loc.Z())
            except Exception:
                pass

        if not is_cylinder or radius <= 0:
            continue

        depth_est = _estimate_cylinder_depth(face, occ)
        neighbors = _collect_cylinder_neighbors(face, edge_faces, occ)
        entry_id, exit_id, entry_origin, exit_origin = _classify_cap_faces(
            neighbors, axis_vec, face_map, occ
        )
        depth = _compute_hole_depth(entry_origin, exit_origin, axis_vec, depth_est)

        hole_type: HoleType = "through" if entry_id and exit_id else "blind"
        if is_countersink:
            hole_type = "countersink"

        # GAP 8 FIX: Prefer cylinder axis position, fallback to cap face origins
        # This ensures position is populated even for standalone cylindrical features
        cyl_center = cyl_axis_position  # From cylinder axis (most reliable)
        if cyl_center is None:
            if entry_origin:
                cyl_center = entry_origin
            elif exit_origin:
                cyl_center = exit_origin

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
                position=cyl_center,  # GAP 8 FIX: Now populated from cylinder axis
            )
        )
        idx += 1
    
    # Post-process: detect counterbores by finding concentric holes
    holes = _detect_counterbores(holes)
    
    return holes


def _detect_counterbores(holes: List[HoleFeature]) -> List[HoleFeature]:
    """Detect counterbores by finding concentric cylinders with different diameters.
    
    A counterbore is a larger diameter shallow cylinder on top of a smaller
    through-hole. Marked by concentric axes and overlapping positions.
    """
    if len(holes) < 2:
        return holes
    
    # Group holes by approximate axis direction
    # Counterbores will have parallel/same axis
    counterbore_indices = set()
    
    for i, h1 in enumerate(holes):
        if h1.position is None:
            continue
        
        for j, h2 in enumerate(holes):
            if i >= j or h2.position is None:
                continue
            
            # Check if axes are parallel
            if h1.axis is None or h2.axis is None:
                continue
            
            axis_dot = abs(_dot(h1.axis, h2.axis))
            if axis_dot < 0.95:  # Not parallel
                continue
            
            # Check if positions are concentric (same XY, different Z or depth)
            pos1 = h1.position
            pos2 = h2.position
            
            # Project position onto plane perpendicular to axis
            # For vertical holes, compare XY distance
            xy_dist = ((pos1[0] - pos2[0])**2 + (pos1[1] - pos2[1])**2)**0.5
            
            # If very close in XY and different diameters, likely counterbore
            if xy_dist < min(h1.diameter_mm, h2.diameter_mm) / 2:
                # The larger diameter with shallower depth is the counterbore
                if h1.diameter_mm > h2.diameter_mm and h1.depth_mm < h2.depth_mm * 2:
                    counterbore_indices.add(i)
                elif h2.diameter_mm > h1.diameter_mm and h2.depth_mm < h1.depth_mm * 2:
                    counterbore_indices.add(j)
    
    # Update hole types
    result = []
    for i, hole in enumerate(holes):
        if i in counterbore_indices:
            hole = HoleFeature(
                id=hole.id,
                type="counterbore",
                diameter_mm=hole.diameter_mm,
                depth_mm=hole.depth_mm,
                axis=hole.axis,
                entry_face_id=hole.entry_face_id,
                exit_face_id=hole.exit_face_id,
                tri_indices=hole.tri_indices,
                position=hole.position,
            )
        result.append(hole)
    
    return result


def extract_holes_from_mesh(mesh) -> List[HoleFeature]:
    """Mesh-based hole detection for STL files.
    
    Uses curvature analysis and face normal clustering to detect cylindrical
    cavity regions that indicate holes. Less accurate than BREP detection
    but provides reasonable hole counts for classification.
    
    Detection approach:
    1. Find triangles with inward-facing normals (potential cavity)
    2. Cluster by normal direction to find cylindrical regions
    3. Estimate diameter from cluster bounding circle
    4. Estimate depth from cluster extent along axis
    
    Args:
        mesh: Trimesh mesh object
        
    Returns:
        List of HoleFeature objects detected from mesh geometry
    """
    try:
        import numpy as np
        from scipy.spatial import ConvexHull
    except ImportError:
        logger.warning("numpy/scipy unavailable for mesh hole detection")
        return []
    
    if mesh is None or not hasattr(mesh, 'face_normals'):
        return []
    
    holes: List[HoleFeature] = []
    normals = mesh.face_normals
    centroids = mesh.triangles_center
    areas = mesh.area_faces if hasattr(mesh, 'area_faces') else np.ones(len(normals))
    
    # Principal axes for axis-aligned hole detection
    principal_axes = np.array([
        [1, 0, 0], [0, 1, 0], [0, 0, 1],
        [-1, 0, 0], [0, -1, 0], [0, 0, -1],
    ], dtype=float)
    
    idx = 1
    
    # For each principal axis, find inward-pointing triangles that may form holes
    for axis_idx, axis in enumerate(principal_axes[:3]):
        # Find triangles roughly perpendicular to this axis (cylindrical surface)
        # Cylinder normals are perpendicular to cylinder axis
        axis_dot = np.abs(normals @ axis)
        perpendicular_mask = axis_dot < 0.3  # Normal perpendicular to axis
        
        if not np.any(perpendicular_mask):
            continue
        
        perp_indices = np.nonzero(perpendicular_mask)[0]
        perp_centroids = centroids[perp_indices]
        perp_normals = normals[perp_indices]
        
        if len(perp_indices) < 10:
            continue
        
        # Project centroids onto plane perpendicular to axis
        # For Z-axis holes, project to XY plane
        if axis_idx == 0:  # X-axis
            proj_coords = perp_centroids[:, [1, 2]]  # YZ plane
        elif axis_idx == 1:  # Y-axis
            proj_coords = perp_centroids[:, [0, 2]]  # XZ plane
        else:  # Z-axis
            proj_coords = perp_centroids[:, [0, 1]]  # XY plane
        
        # Simple clustering: Grid-based spatial binning
        # Find local density peaks that indicate hole centers
        grid_size = 5.0  # mm
        grid_x = (proj_coords[:, 0] / grid_size).astype(int)
        grid_y = (proj_coords[:, 1] / grid_size).astype(int)
        
        # Find unique grid cells with enough triangles (potential hole regions)
        from collections import Counter
        cell_counts = Counter(zip(grid_x, grid_y))
        
        for (gx, gy), count in cell_counts.items():
            if count < 8:  # Need minimum triangles to form a hole
                continue
            
            # Get triangles in this cell
            cell_mask = (grid_x == gx) & (grid_y == gy)
            cell_centroids = proj_coords[cell_mask]
            cell_indices = perp_indices[cell_mask]
            
            # Check if normals point inward (toward center) - indicates hole
            cell_center = np.mean(cell_centroids, axis=0)
            to_center = cell_center - cell_centroids
            to_center_norm = to_center / (np.linalg.norm(to_center, axis=1, keepdims=True) + 1e-9)
            
            # For a hole, normals should point toward the axis (inward)
            # This is a simplified check - real cylinders have radial normals
            inward_count = 0
            for i, ci in enumerate(cell_indices):
                n = perp_normals[cell_mask][i]
                # Project normal to 2D plane
                if axis_idx == 0:
                    n_2d = np.array([n[1], n[2]])
                elif axis_idx == 1:
                    n_2d = np.array([n[0], n[2]])
                else:
                    n_2d = np.array([n[0], n[1]])
                n_2d_norm = n_2d / (np.linalg.norm(n_2d) + 1e-9)
                # Check if pointing toward center
                if np.dot(n_2d_norm, to_center_norm[i]) > 0.5:
                    inward_count += 1
            
            if inward_count < count * 0.5:
                continue  # Not enough inward-pointing normals
            
            # Estimate diameter from bounding circle of projected points
            if len(cell_centroids) >= 3:
                try:
                    # Simple diameter estimate: max distance across cluster
                    dists = np.linalg.norm(cell_centroids - cell_center, axis=1)
                    diameter = float(2 * np.percentile(dists, 90))  # 90th percentile radius * 2
                    
                    if diameter < 0.5 or diameter > 500:
                        continue  # Filter unrealistic hole sizes
                    
                    # Estimate depth from extent along axis
                    axis_coords = centroids[cell_indices][:, axis_idx]
                    depth = float(np.max(axis_coords) - np.min(axis_coords))
                    
                    if depth < 0.1:
                        continue
                    
                    # Determine hole type (through vs blind) based on depth ratio
                    aspect_ratio = depth / diameter
                    hole_type: HoleType = "through" if aspect_ratio > 2.0 else "blind"
                    
                    # Position at centroid of cluster
                    position = tuple(np.mean(centroids[cell_indices], axis=0))
                    
                    holes.append(HoleFeature(
                        id=f"H-{idx:03d}",
                        type=hole_type,
                        diameter_mm=diameter,
                        depth_mm=depth,
                        axis=tuple(axis),
                        entry_face_id=None,
                        exit_face_id=None,
                        tri_indices=list(cell_indices),
                        position=position,
                    ))
                    idx += 1
                    
                except Exception as e:
                    logger.debug(f"Hole estimation failed for cluster: {e}")
                    continue
    
    logger.info(f"Mesh hole detection: found {len(holes)} hole(s)")
    return holes

