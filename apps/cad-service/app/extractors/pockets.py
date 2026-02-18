from __future__ import annotations

import logging
import math
from typing import List, Tuple, Optional, Set

from ..models import PocketFeature

logger = logging.getLogger(__name__)


def _dot3(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _vec_length(v):
    return math.sqrt(v[0]**2 + v[1]**2 + v[2]**2)


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


def _get_wall_info(floor_normal, neighbors, brep_tool, geom_plane,
                   adaptor_cls=None, plane_type=None, cylinder_type=None):
    """Analyze wall faces: count vertical walls, cylindrical walls, and extract wall heights.
    
    Returns:
        Tuple of (vertical_wall_count, cylinder_wall_count, wall_heights_mm, corner_radii_mm)
    """
    vertical_count = 0
    cylinder_count = 0
    wall_heights: List[float] = []
    corner_radii: List[float] = []
    
    for nf in neighbors:
        n2v = None
        wall_height = 0.0
        
        # Check if it's a cylinder (fillet corner or boss)
        if adaptor_cls is not None and cylinder_type is not None:
            try:
                adaptor = adaptor_cls(nf)
                if adaptor.GetType() == cylinder_type:
                    cyl = adaptor.Cylinder()
                    corner_radii.append(cyl.Radius())
                    cylinder_count += 1
                    continue
            except Exception:
                pass
        
        # Check for planar faces
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
        
        # Perpendicular = vertical wall
        if abs(_dot3(floor_normal, n2v)) <= 0.2:
            vertical_count += 1
            # Compute wall height from face bounding box
            try:
                from OCC.Core.Bnd import Bnd_Box
                from OCC.Core.BRepBndLib import brepbndlib
                wall_box = Bnd_Box()
                brepbndlib.Add(nf, wall_box)
                xmin, ymin, zmin, xmax, ymax, zmax = wall_box.Get()
                # Use the dimension most aligned with floor normal as height
                dims = [xmax - xmin, ymax - ymin, zmax - zmin]
                # Floor normal tells us which dimension is height
                abs_normal = [abs(floor_normal[i]) for i in range(3)]
                height_idx = abs_normal.index(max(abs_normal))
                wall_height = dims[height_idx]
                if wall_height > 0.1:  # Ignore very thin walls
                    wall_heights.append(wall_height)
            except Exception:
                pass
    
    return vertical_count, cylinder_count, wall_heights, corner_radii


def _compute_pocket_depth_from_walls(wall_heights: List[float]) -> float:
    """Estimate pocket depth from wall heights.
    
    Uses the most common (mode) wall height as the pocket depth.
    """
    if not wall_heights:
        return 0.0
    
    # Sort and find the most common height (within 0.5mm tolerance)
    sorted_heights = sorted(wall_heights)
    
    # Simple clustering: find most common height
    clusters = []
    for h in sorted_heights:
        added = False
        for cluster in clusters:
            if abs(h - cluster[0]) < 0.5:  # 0.5mm tolerance
                cluster.append(h)
                added = True
                break
        if not added:
            clusters.append([h])
    
    # Return average of largest cluster
    largest_cluster = max(clusters, key=len)
    return sum(largest_cluster) / len(largest_cluster)


def _count_depth_steps(wall_heights: List[float], tolerance_mm: float = 0.5) -> int:
    """Count distinct depth levels (step pockets).
    
    Multiple distinct wall heights indicate stepped/multi-level pocket.
    """
    if not wall_heights:
        return 1
    
    # Cluster heights
    sorted_heights = sorted(wall_heights)
    distinct_heights = []
    
    for h in sorted_heights:
        is_new = True
        for existing in distinct_heights:
            if abs(h - existing) < tolerance_mm:
                is_new = False
                break
        if is_new:
            distinct_heights.append(h)
    
    return max(1, len(distinct_heights))


def _face_mouth_area(face, brepgprop_fn, gprop_cls) -> float:
    """Compute face surface area in mm²."""
    props = gprop_cls()
    try:
        brepgprop_fn(face, props)
        return float(props.Mass()) * 1e6  # m² → mm²
    except Exception:
        return 0.0


def _compute_aspect_ratio(mouth_area_mm2: float, depth_mm: float) -> float:
    """Compute pocket aspect ratio (depth / characteristic width).
    
    Characteristic width = sqrt(mouth_area).
    High aspect ratio indicates deep/narrow pocket (CNC indicator).
    """
    if depth_mm <= 0 or mouth_area_mm2 <= 0:
        return 0.0
    char_width = math.sqrt(mouth_area_mm2)
    if char_width < 0.1:
        return 0.0
    return depth_mm / char_width


def _is_through_pocket(floor_face, neighbors, floor_normal, adaptor_cls, plane_type) -> bool:
    """Check if pocket goes all the way through (no bottom face in direction of normal)."""
    # A through pocket would have no parallel faces on the opposite side
    # This is a heuristic - if there's a face parallel to floor on the other side,
    # it's likely not a through pocket
    for nf in neighbors:
        if adaptor_cls is not None and plane_type is not None:
            try:
                adaptor = adaptor_cls(nf)
                if adaptor.GetType() == plane_type:
                    pln = adaptor.Plane()
                    n2 = pln.Axis().Direction()
                    n2v = (n2.X(), n2.Y(), n2.Z())
                    # Check if anti-parallel (opposite face)
                    dot = _dot3(floor_normal, n2v)
                    if dot < -0.95:  # Anti-parallel = opposite facing
                        return False  # Has opposite face, not through
            except Exception:
                pass
    return True  # No opposite face found, might be through


def extract_pockets_from_shape(shape) -> List[PocketFeature]:
    """Detect simple planar pockets: planar floor with perpendicular side walls.
    Returns a conservative list to reduce false positives.

    ENHANCED: Now computes actual pocket depth, step count, corner radius,
    aspect ratio, and through-pocket detection for better classification.

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

        # Enhanced wall analysis: get depth, corner radii, step count
        vertical_count, cylinder_count, wall_heights, corner_radii = _get_wall_info(
            fn, neighbors, BRep_Tool, Geom_Plane,
            adaptor_cls=adaptor_cls,
            plane_type=plane_type,
            cylinder_type=cylinder_type,
        )
        
        # Require at least 2 wall faces (vertical or cylindrical) to be a pocket
        total_walls = vertical_count + cylinder_count
        if total_walls < 2:
            continue

        mouth_area = _face_mouth_area(face, brepgprop_SurfaceProperties, GProp_GProps)
        floor_id = face_map.FindIndex(face)
        
        # Compute depth from wall heights
        depth_mm = _compute_pocket_depth_from_walls(wall_heights)
        
        # Compute step count (multi-level pockets indicate CNC)
        step_count = _count_depth_steps(wall_heights)
        
        # Compute corner radius (average of detected radii)
        corner_radius_mm = 0.0
        if corner_radii:
            corner_radius_mm = sum(corner_radii) / len(corner_radii)
        
        # Compute aspect ratio
        aspect_ratio = _compute_aspect_ratio(mouth_area, depth_mm)
        
        # Check if through pocket
        is_through = _is_through_pocket(
            face, neighbors, fn, 
            adaptor_cls, plane_type
        )
        
        pockets.append(
            PocketFeature(
                id=f"P-{idx:03d}",
                planar_face_ids=[int(floor_id)],
                depth_mm=depth_mm,
                mouth_area_mm2=mouth_area,
                aspect_ratio=aspect_ratio,
                step_count=step_count,
                corner_radius_mm=corner_radius_mm,
                is_through=is_through,
            )
        )
        idx += 1

    return pockets


def extract_pockets_from_mesh(mesh) -> List[PocketFeature]:
    """Mesh-based pocket detection for STL files.
    
    Uses face normal clustering and concavity analysis to detect recessed
    pocket regions. Less accurate than BREP but provides feature counts
    for classification.
    
    Detection approach:
    1. Find horizontal/flat-facing triangle clusters (potential pocket floors)
    2. Check for surrounding vertical triangles (pocket walls)
    3. Estimate depth from wall height
    4. Estimate mouth area from floor triangle extent
    
    Args:
        mesh: Trimesh mesh object
        
    Returns:
        List of PocketFeature objects detected from mesh geometry
    """
    try:
        import numpy as np
    except ImportError:
        logger.warning("numpy unavailable for mesh pocket detection")
        return []
    
    if mesh is None or not hasattr(mesh, 'face_normals'):
        return []
    
    pockets: List[PocketFeature] = []
    normals = mesh.face_normals
    centroids = mesh.triangles_center
    areas = mesh.area_faces if hasattr(mesh, 'area_faces') else np.ones(len(normals))
    
    # Find triangles facing upward (potential pocket floors)
    # and downward (potential ceiling of through-pockets)
    up_axis = np.array([0, 0, 1])
    down_axis = np.array([0, 0, -1])
    
    # Floor triangles: facing up (+Z)
    floor_dot = normals @ up_axis
    floor_mask = floor_dot > 0.9  # Nearly horizontal, facing up
    
    if not np.any(floor_mask):
        return []
    
    floor_indices = np.nonzero(floor_mask)[0]
    floor_centroids = centroids[floor_indices]
    floor_z = floor_centroids[:, 2]
    
    # Group floors by Z-level (pockets at different depths)
    z_tolerance = 0.5  # mm
    z_levels = []
    
    # Simple Z-level clustering
    sorted_z = np.sort(np.unique(np.round(floor_z / z_tolerance) * z_tolerance))
    
    idx = 1
    for z_level in sorted_z:
        # Get floors at this Z level
        level_mask = np.abs(floor_z - z_level) < z_tolerance
        level_indices = floor_indices[level_mask]
        
        if len(level_indices) < 5:
            continue
        
        level_centroids = floor_centroids[level_mask]
        level_areas = areas[level_indices]
        
        # Estimate mouth area from floor triangles
        mouth_area = float(np.sum(level_areas))
        
        if mouth_area < 10:  # Too small to be a meaningful pocket
            continue
        
        # Check for surrounding walls (vertical triangles nearby)
        # Find vertical triangles (normals perpendicular to Z)
        wall_mask = np.abs(normals @ up_axis) < 0.1
        wall_indices = np.nonzero(wall_mask)[0]
        
        if len(wall_indices) == 0:
            continue
        
        wall_centroids = centroids[wall_indices]
        
        # Find walls adjacent to this floor (within XY distance)
        floor_center_xy = np.mean(level_centroids[:, :2], axis=0)
        floor_extent = np.max(np.linalg.norm(level_centroids[:, :2] - floor_center_xy, axis=1))
        
        # Walls within 2x floor extent
        wall_dist_xy = np.linalg.norm(wall_centroids[:, :2] - floor_center_xy, axis=1)
        nearby_wall_mask = wall_dist_xy < floor_extent * 2
        
        if not np.any(nearby_wall_mask):
            continue  # No walls = not a pocket
        
        nearby_wall_indices = wall_indices[nearby_wall_mask]
        nearby_wall_centroids = wall_centroids[nearby_wall_mask]
        
        # Estimate depth from wall height above floor
        wall_z_above = nearby_wall_centroids[:, 2] - z_level
        wall_z_above = wall_z_above[wall_z_above > 0]
        
        if len(wall_z_above) == 0:
            continue
        
        depth_mm = float(np.percentile(wall_z_above, 90))  # 90th percentile
        
        if depth_mm < 0.5:
            continue  # Too shallow
        
        # Compute aspect ratio
        equivalent_diameter = 2 * math.sqrt(mouth_area / math.pi)
        aspect_ratio = depth_mm / equivalent_diameter if equivalent_diameter > 0 else 0
        
        # Check if through pocket (has bottom opening)
        # A through pocket would have no floor below it
        below_floor_mask = floor_z < (z_level - depth_mm * 0.5)
        below_xy_dist = np.linalg.norm(floor_centroids[below_floor_mask][:, :2] - floor_center_xy, axis=1) if np.any(below_floor_mask) else np.array([])
        is_through = len(below_xy_dist) > 0 and np.min(below_xy_dist) < floor_extent * 0.5
        
        pockets.append(PocketFeature(
            id=f"P-{idx:03d}",
            planar_face_ids=[],  # Not applicable for mesh
            depth_mm=depth_mm,
            mouth_area_mm2=mouth_area,
            aspect_ratio=aspect_ratio,
            step_count=0,  # Can't detect steps from mesh
            corner_radius_mm=0.0,  # Can't detect reliably from mesh
            is_through=is_through,
        ))
        idx += 1
    
    logger.info(f"Mesh pocket detection: found {len(pockets)} pocket(s)")
    return pockets

