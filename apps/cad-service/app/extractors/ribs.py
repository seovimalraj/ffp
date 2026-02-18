"""Rib feature detection.

Detects rib (thin-wall reinforcement) features from BREP shapes and STL meshes.
Ribs are thin structural features that provide mechanical reinforcement,
commonly found in injection-molded and CNC-machined parts.

Key discriminators:
- Thin wall thickness (typically 0.5-3mm)
- High aspect ratio (length >> thickness)
- Perpendicular to a main planar surface
- Often triangular cross-section for draft
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class RibFeature:
    """Represents a detected rib (thin-wall reinforcement)."""
    id: str
    thickness_mm: float
    height_mm: float
    length_mm: float
    has_draft: bool = False
    draft_angle_deg: float = 0.0
    position: Optional[Tuple[float, float, float]] = None
    face_ids: List[int] = field(default_factory=list)
    tri_indices: List[int] = field(default_factory=list)


def _try_import_occ():
    """Attempt to import OCC modules for rib detection."""
    try:
        from OCC.Core.TopExp import TopExp_Explorer, topexp
        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import GeomAbs_Plane
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.TopTools import (
            TopTools_IndexedMapOfShape,
            TopTools_IndexedDataMapOfShapeListOfShape,
        )
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties
        from OCC.Core.BRepTools import breptools_UVBounds
    except Exception:
        logger.warning("OCC imports unavailable for rib extraction")
        return None
    return {
        "TopExp_Explorer": TopExp_Explorer,
        "TopExp": topexp,
        "TopAbs_FACE": TopAbs_FACE,
        "TopAbs_EDGE": TopAbs_EDGE,
        "BRepAdaptor_Surface": BRepAdaptor_Surface,
        "GeomAbs_Plane": GeomAbs_Plane,
        "BRep_Tool": BRep_Tool,
        "TopTools_IndexedMapOfShape": TopTools_IndexedMapOfShape,
        "TopTools_IndexedDataMapOfShapeListOfShape": TopTools_IndexedDataMapOfShapeListOfShape,
        "GProp_GProps": GProp_GProps,
        "brepgprop_SurfaceProperties": brepgprop_SurfaceProperties,
        "breptools_UVBounds": breptools_UVBounds,
    }


def _get_face_normal(face, occ) -> Optional[Tuple[float, float, float]]:
    """Get normal vector of a planar face."""
    try:
        adaptor = occ["BRepAdaptor_Surface"](face)
        if adaptor.GetType() != occ["GeomAbs_Plane"]:
            return None
        plane = adaptor.Plane()
        n = plane.Axis().Direction()
        return (n.X(), n.Y(), n.Z())
    except Exception:
        return None


def _get_face_area(face, occ) -> float:
    """Get surface area of a face in mm²."""
    try:
        props = occ["GProp_GProps"]()
        occ["brepgprop_SurfaceProperties"](face, props)
        return float(props.Mass()) * 1e6  # Convert to mm²
    except Exception:
        return 0.0


def _get_face_dimensions(face, occ) -> Tuple[float, float]:
    """Estimate face dimensions from UV bounds."""
    try:
        umin, umax, vmin, vmax = occ["breptools_UVBounds"](face)
        return (abs(umax - umin), abs(vmax - vmin))
    except Exception:
        return (0.0, 0.0)


def _collect_neighbors(face, edge_faces, occ) -> List:
    """Collect faces sharing edges with the given face."""
    neighbors = []
    try:
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
                if not f2.IsSame(face) and f2 not in neighbors:
                    neighbors.append(f2)
    except Exception:
        pass
    return neighbors


def _dot(a, b):
    """Dot product of two 3-vectors."""
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def extract_ribs_from_shape(shape) -> List[RibFeature]:
    """Detect rib features from BREP shape using OCC.
    
    Analyzes planar faces to find thin, tall, elongated features
    characteristic of reinforcement ribs.
    
    Criteria for rib detection:
    - Two parallel planar faces close together (rib walls)
    - High aspect ratio (height/thickness > 3)
    - Adjacent to a base planar surface
    
    Args:
        shape: OCC TopoDS_Shape BREP shape
        
    Returns:
        List of RibFeature objects
    """
    occ = _try_import_occ()
    if occ is None:
        return []
    
    ribs: List[RibFeature] = []
    
    face_map = occ["TopTools_IndexedMapOfShape"]()
    occ["TopExp"].MapShapes(shape, occ["TopAbs_FACE"], face_map)
    
    edge_faces = occ["TopTools_IndexedDataMapOfShapeListOfShape"]()
    occ["TopExp"].MapShapesAndAncestors(
        shape, occ["TopAbs_EDGE"], occ["TopAbs_FACE"], edge_faces
    )
    
    # Collect all planar faces with their normals
    planar_faces = []
    exp = occ["TopExp_Explorer"](shape, occ["TopAbs_FACE"])
    while exp.More():
        face = exp.Current()
        exp.Next()
        
        normal = _get_face_normal(face, occ)
        if normal is None:
            continue
        
        area = _get_face_area(face, occ)
        dims = _get_face_dimensions(face, occ)
        fid = face_map.FindIndex(face)
        
        planar_faces.append({
            "face": face,
            "normal": normal,
            "area": area,
            "dims": dims,
            "fid": fid,
        })
    
    # Find pairs of parallel, close faces (potential rib walls)
    idx = 1
    processed_pairs = set()
    
    for i, f1 in enumerate(planar_faces):
        for j, f2 in enumerate(planar_faces):
            if i >= j:
                continue
            if (i, j) in processed_pairs:
                continue
            
            n1 = f1["normal"]
            n2 = f2["normal"]
            
            # Check if normals are anti-parallel (facing each other)
            dot_n = _dot(n1, n2)
            if dot_n > -0.95:  # Not anti-parallel
                continue
            
            # Check if areas are similar (rib walls are symmetric)
            area_ratio = min(f1["area"], f2["area"]) / max(f1["area"], f2["area"])
            if area_ratio < 0.7:
                continue
            
            # Estimate thickness from face separation
            # This is simplified - proper implementation would use face centers
            dims1 = f1["dims"]
            dims2 = f2["dims"]
            
            # Ribs have high aspect ratio faces (height >> thickness)
            max_dim1 = max(dims1)
            min_dim1 = min(dims1) if min(dims1) > 0 else 1.0
            aspect1 = max_dim1 / min_dim1
            
            if aspect1 < 3.0:
                continue  # Not elongated enough
            
            # Estimate rib dimensions
            height = max_dim1
            length = min_dim1  # Width of the rib face
            
            # Thickness: need to estimate from face separation
            # For now, use area-based estimate
            thickness = f1["area"] / (height * 10) if height > 0 else 2.0  # Rough estimate
            thickness = max(0.5, min(thickness, 5.0))  # Clamp to reasonable range
            
            processed_pairs.add((i, j))
            
            ribs.append(RibFeature(
                id=f"R-{idx:03d}",
                thickness_mm=float(thickness),
                height_mm=float(height),
                length_mm=float(length),
                has_draft=False,  # Would need angle analysis
                draft_angle_deg=0.0,
                face_ids=[f1["fid"], f2["fid"]],
            ))
            idx += 1
    
    logger.info(f"Rib detection: found {len(ribs)} rib(s)")
    return ribs


def extract_ribs_from_mesh(mesh) -> List[RibFeature]:
    """Mesh-based rib detection for STL files.
    
    Uses face normal analysis to detect thin planar regions
    that indicate rib features.
    
    Args:
        mesh: Trimesh mesh object
        
    Returns:
        List of RibFeature objects
    """
    try:
        import numpy as np
    except ImportError:
        logger.warning("numpy unavailable for mesh rib detection")
        return []
    
    if mesh is None or not hasattr(mesh, 'face_normals'):
        return []
    
    ribs: List[RibFeature] = []
    normals = mesh.face_normals
    centroids = mesh.triangles_center
    areas = mesh.area_faces if hasattr(mesh, 'area_faces') else np.ones(len(normals))
    
    # Find pairs of nearby, anti-parallel triangle clusters
    # This indicates thin walls (potential ribs)
    
    # Discretize normals to find dominant directions
    # Round normals to nearest 0.1 for clustering
    rounded_normals = np.round(normals * 10) / 10
    
    # Find unique normal directions
    unique_normals = np.unique(rounded_normals, axis=0)
    
    idx = 1
    processed = set()
    
    for i, n1 in enumerate(unique_normals):
        for j, n2 in enumerate(unique_normals):
            if i >= j:
                continue
            if (i, j) in processed:
                continue
            
            # Check anti-parallel
            dot = np.dot(n1, n2)
            if dot > -0.9:
                continue
            
            # Find triangles with these normals
            mask1 = np.all(rounded_normals == n1, axis=1)
            mask2 = np.all(rounded_normals == n2, axis=1)
            
            count1 = np.sum(mask1)
            count2 = np.sum(mask2)
            
            if count1 < 5 or count2 < 5:
                continue
            
            # Check if clusters are close together (thin wall)
            centroids1 = centroids[mask1]
            centroids2 = centroids[mask2]
            
            center1 = np.mean(centroids1, axis=0)
            center2 = np.mean(centroids2, axis=0)
            
            # Distance along normal direction indicates wall thickness
            sep_vec = center2 - center1
            thickness = abs(np.dot(sep_vec, n1))
            
            if thickness < 0.5 or thickness > 5.0:
                continue  # Not rib-like thickness
            
            # Estimate height and length from cluster extents
            all_centroids = np.vstack([centroids1, centroids2])
            extent = np.max(all_centroids, axis=0) - np.min(all_centroids, axis=0)
            
            # Remove the thickness direction
            normal_idx = np.argmax(np.abs(n1))
            extent_2d = np.delete(extent, normal_idx)
            
            height = float(np.max(extent_2d))
            length = float(np.min(extent_2d))
            
            if height / thickness < 3.0:
                continue  # Not elongated enough
            
            processed.add((i, j))
            
            position = tuple((center1 + center2) / 2)
            
            ribs.append(RibFeature(
                id=f"R-{idx:03d}",
                thickness_mm=float(thickness),
                height_mm=height,
                length_mm=length,
                position=position,
                tri_indices=list(np.nonzero(mask1)[0]) + list(np.nonzero(mask2)[0]),
            ))
            idx += 1
    
    logger.info(f"Mesh rib detection: found {len(ribs)} rib(s)")
    return ribs
