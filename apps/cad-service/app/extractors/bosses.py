"""Boss feature detection.

Detects boss (cylindrical protrusion) features from BREP shapes and STL meshes.
Bosses are positive cylindrical features that protrude from a surface, commonly
used for mounting holes, alignment pins, or structural reinforcement.

Key discriminators:
- External cylindrical surfaces (normals point outward)
- Adjacent flat cap face on top
- Height > diameter typically indicates mounting boss
- Multiple coaxial bosses indicate fastener patterns
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class BossFeature:
    """Represents a detected boss (cylindrical protrusion)."""
    id: str
    diameter_mm: float
    height_mm: float
    position: Optional[Tuple[float, float, float]] = None
    axis: Tuple[float, float, float] = (0.0, 0.0, 1.0)
    has_hole: bool = False  # Boss with central hole (mounting boss)
    hole_diameter_mm: float = 0.0
    face_ids: List[int] = field(default_factory=list)
    tri_indices: List[int] = field(default_factory=list)


def _try_import_occ():
    """Attempt to import OCC modules for boss detection."""
    try:
        from OCC.Core.TopExp import TopExp_Explorer, topexp
        from OCC.Core.TopAbs import TopAbs_FACE
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import GeomAbs_Cylinder, GeomAbs_Plane
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.TopTools import TopTools_IndexedMapOfShape
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties
        from OCC.Core.GeomLProp import GeomLProp_SLProps
    except Exception:
        logger.warning("OCC imports unavailable for boss extraction")
        return None
    return {
        "TopExp_Explorer": TopExp_Explorer,
        "TopExp": topexp,
        "TopAbs_FACE": TopAbs_FACE,
        "BRepAdaptor_Surface": BRepAdaptor_Surface,
        "GeomAbs_Cylinder": GeomAbs_Cylinder,
        "GeomAbs_Plane": GeomAbs_Plane,
        "BRep_Tool": BRep_Tool,
        "TopTools_IndexedMapOfShape": TopTools_IndexedMapOfShape,
        "GProp_GProps": GProp_GProps,
        "brepgprop_SurfaceProperties": brepgprop_SurfaceProperties,
        "GeomLProp_SLProps": GeomLProp_SLProps,
    }


def extract_bosses_from_shape(shape) -> List[BossFeature]:
    """Detect boss features from BREP shape using OCC.
    
    Analyzes cylindrical surfaces to find external (convex) cylinders
    that indicate boss/pin protrusions rather than holes.
    
    Args:
        shape: OCC TopoDS_Shape BREP shape
        
    Returns:
        List of BossFeature objects
    """
    occ = _try_import_occ()
    if occ is None:
        return []
    
    bosses: List[BossFeature] = []
    idx = 1
    
    face_map = occ["TopTools_IndexedMapOfShape"]()
    occ["TopExp"].MapShapes(shape, occ["TopAbs_FACE"], face_map)
    
    exp = occ["TopExp_Explorer"](shape, occ["TopAbs_FACE"])
    while exp.More():
        face = exp.Current()
        exp.Next()
        
        try:
            adaptor = occ["BRepAdaptor_Surface"](face)
            if adaptor.GetType() != occ["GeomAbs_Cylinder"]:
                continue
            
            cyl = adaptor.Cylinder()
            radius = cyl.Radius()
            diameter = 2.0 * radius
            
            if diameter < 1.0 or diameter > 200:
                continue  # Filter unrealistic sizes
            
            # Estimate height from surface area
            props = occ["GProp_GProps"]()
            occ["brepgprop_SurfaceProperties"](face, props)
            area = props.Mass() * 1e6  # Convert to mm²
            circumference = math.pi * diameter
            height = area / circumference if circumference > 0 else 0.0
            
            # Check if external (boss) vs internal (hole) using normal orientation
            is_external = False
            try:
                surface = occ["BRep_Tool"].Surface(face)
                u_mid = (adaptor.FirstUParameter() + adaptor.LastUParameter()) / 2
                v_mid = (adaptor.FirstVParameter() + adaptor.LastVParameter()) / 2
                props_sl = occ["GeomLProp_SLProps"](surface, u_mid, v_mid, 1, 1e-6)
                
                if props_sl.IsNormalDefined():
                    normal = props_sl.Normal()
                    pnt = adaptor.Value(u_mid, v_mid)
                    axis_loc = cyl.Axis().Location()
                    axis_dir = cyl.Axis().Direction()
                    axis_vec = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
                    
                    # Vector from axis to point
                    to_point = (pnt.X() - axis_loc.X(), 
                                pnt.Y() - axis_loc.Y(), 
                                pnt.Z() - axis_loc.Z())
                    # Project out axis component to get radial
                    dot_axis = sum(to_point[i] * axis_vec[i] for i in range(3))
                    radial = tuple(to_point[i] - dot_axis * axis_vec[i] for i in range(3))
                    
                    # Normal · radial > 0 means external (boss)
                    normal_dot_radial = normal.X() * radial[0] + normal.Y() * radial[1] + normal.Z() * radial[2]
                    is_external = normal_dot_radial > 0
                    
            except Exception:
                # Fallback: larger cylinders more likely to be bosses
                is_external = diameter > 8.0 and height < diameter * 3
            
            if not is_external:
                continue  # Skip internal cylinders (holes)
            
            # Get position from axis location
            axis_loc = cyl.Axis().Location()
            position = (axis_loc.X(), axis_loc.Y(), axis_loc.Z())
            axis_dir = cyl.Axis().Direction()
            axis = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
            
            fid = face_map.FindIndex(face)
            
            bosses.append(BossFeature(
                id=f"B-{idx:03d}",
                diameter_mm=float(diameter),
                height_mm=float(height),
                position=position,
                axis=axis,
                has_hole=False,  # Hole detection in post-process
                hole_diameter_mm=0.0,
                face_ids=[fid] if fid > 0 else [],
            ))
            idx += 1
            
        except Exception as e:
            logger.debug(f"Boss detection failed for face: {e}")
            continue
    
    # Post-process: detect bosses with central holes
    bosses = _detect_boss_holes(bosses)
    
    logger.info(f"Boss detection: found {len(bosses)} boss(es)")
    return bosses


def _detect_boss_holes(bosses: List[BossFeature]) -> List[BossFeature]:
    """Post-process to detect bosses with central holes (mounting bosses).
    
    Two coaxial bosses with different diameters at same position
    indicate a boss with a central hole.
    """
    if len(bosses) < 2:
        return bosses
    
    # This would require correlation with hole features
    # For now, return as-is
    return bosses


def extract_bosses_from_mesh(mesh) -> List[BossFeature]:
    """Mesh-based boss detection for STL files.
    
    Uses face normal analysis to detect outward-pointing cylindrical
    regions that indicate boss protrusions.
    
    Args:
        mesh: Trimesh mesh object
        
    Returns:
        List of BossFeature objects
    """
    try:
        import numpy as np
    except ImportError:
        logger.warning("numpy unavailable for mesh boss detection")
        return []
    
    if mesh is None or not hasattr(mesh, 'face_normals'):
        return []
    
    bosses: List[BossFeature] = []
    normals = mesh.face_normals
    centroids = mesh.triangles_center
    areas = mesh.area_faces if hasattr(mesh, 'area_faces') else np.ones(len(normals))
    
    # Boss detection: Find clusters of outward-pointing triangles
    # that form cylindrical patterns
    
    # For each principal axis, look for radially outward normals
    principal_axes = np.array([
        [1, 0, 0], [0, 1, 0], [0, 0, 1],
    ], dtype=float)
    
    idx = 1
    
    for axis_idx, axis in enumerate(principal_axes):
        # Find triangles with normals perpendicular to this axis (cylinder walls)
        axis_dot = np.abs(normals @ axis)
        perp_mask = axis_dot < 0.3
        
        if np.sum(perp_mask) < 10:
            continue
        
        perp_indices = np.nonzero(perp_mask)[0]
        perp_centroids = centroids[perp_indices]
        perp_normals = normals[perp_indices]
        
        # Project to plane perpendicular to axis
        if axis_idx == 0:
            proj_coords = perp_centroids[:, [1, 2]]
            proj_normals = perp_normals[:, [1, 2]]
        elif axis_idx == 1:
            proj_coords = perp_centroids[:, [0, 2]]
            proj_normals = perp_normals[:, [0, 2]]
        else:
            proj_coords = perp_centroids[:, [0, 1]]
            proj_normals = perp_normals[:, [0, 1]]
        
        # Normalize projected normals
        proj_normals_norm = proj_normals / (np.linalg.norm(proj_normals, axis=1, keepdims=True) + 1e-9)
        
        # Grid-based clustering
        grid_size = 10.0
        grid_x = (proj_coords[:, 0] / grid_size).astype(int)
        grid_y = (proj_coords[:, 1] / grid_size).astype(int)
        
        from collections import Counter
        cell_counts = Counter(zip(grid_x, grid_y))
        
        for (gx, gy), count in cell_counts.items():
            if count < 8:
                continue
            
            cell_mask = (grid_x == gx) & (grid_y == gy)
            cell_centroids = proj_coords[cell_mask]
            cell_normals = proj_normals_norm[cell_mask]
            cell_indices = perp_indices[cell_mask]
            
            # Check if normals point outward from center (boss)
            cell_center = np.mean(cell_centroids, axis=0)
            from_center = cell_centroids - cell_center
            from_center_norm = from_center / (np.linalg.norm(from_center, axis=1, keepdims=True) + 1e-9)
            
            # For boss: normal should point same direction as from_center (outward)
            outward_dots = np.sum(cell_normals * from_center_norm, axis=1)
            outward_count = np.sum(outward_dots > 0.5)
            
            if outward_count < count * 0.6:
                continue  # Not enough outward normals
            
            # Estimate diameter
            dists = np.linalg.norm(cell_centroids - cell_center, axis=1)
            diameter = float(2 * np.percentile(dists, 80))
            
            if diameter < 2.0 or diameter > 200:
                continue
            
            # Estimate height from extent along axis
            axis_coords = centroids[cell_indices][:, axis_idx]
            height = float(np.max(axis_coords) - np.min(axis_coords))
            
            if height < 1.0:
                continue
            
            position = tuple(np.mean(centroids[cell_indices], axis=0))
            
            bosses.append(BossFeature(
                id=f"B-{idx:03d}",
                diameter_mm=diameter,
                height_mm=height,
                position=position,
                axis=tuple(axis),
                tri_indices=list(cell_indices),
            ))
            idx += 1
    
    logger.info(f"Mesh boss detection: found {len(bosses)} boss(es)")
    return bosses
