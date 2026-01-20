from __future__ import annotations
from typing import List, Tuple
import numpy as np

from ..models import MinWallData, MinWallSample


def min_wall_mesh(mesh, *, samples: int = 5000, threshold_mm: float = 1.5) -> MinWallData:
    """Enterprise-level wall thickness detection using advanced ray casting with statistical analysis.
    
    Detects actual material thickness (not bounding box dimensions) for accurate sheet metal classification.
    Uses multi-sample analysis with outlier filtering for robust results.
    """
    try:
        # Sample points uniformly on surface
        pts, face_index = mesh.sample(samples, return_index=True)
        face_normals = mesh.face_normals[face_index]
    except Exception as e:
        # Trimesh sampling failed (missing dependency or mesh issue)
        print(f"⚠️ Mesh sampling failed: {str(e)[:100]}")
        return MinWallData(global_min_mm=0.0, samples=[])

    # Build ray intersector (triangle-based, no pyembree dependency)
    try:
        from trimesh.ray.ray_triangle import RayMeshIntersector
        intersector = RayMeshIntersector(mesh)
    except Exception:
        # Fallback: no ray intersector available; return empty result
        return MinWallData(global_min_mm=0.0, samples=[])

    # Cast rays forward and backward and measure first hit distances
    origins = pts
    directions_f = face_normals
    directions_b = -face_normals

    # Add small epsilon to origins to avoid self-hit
    eps = 1e-6
    origins_f = origins + directions_f * eps
    origins_b = origins + directions_b * eps

    dists_f = _first_hit_distance(intersector, origins_f, directions_f)
    dists_b = _first_hit_distance(intersector, origins_b, directions_b)

    total = dists_f + dists_b
    # Filter valid finite values
    valid = np.isfinite(total)
    total = total[valid]
    origins_valid = origins[valid]

    if total.size == 0:
        return MinWallData(global_min_mm=0.0, samples=[])

    # ENTERPRISE-LEVEL IMPROVEMENT: Statistical analysis with outlier removal
    # Remove extreme outliers (likely edge artifacts or self-intersections)
    percentile_5 = float(np.percentile(total, 5))
    percentile_95 = float(np.percentile(total, 95))
    iqr = percentile_95 - percentile_5
    
    # Filter outliers using IQR method
    outlier_mask = (total >= (percentile_5 - 1.5 * iqr)) & (total <= (percentile_95 + 1.5 * iqr))
    total_filtered = total[outlier_mask]
    origins_filtered = origins_valid[outlier_mask]
    
    if total_filtered.size == 0:
        total_filtered = total  # Fallback if filtering removes everything
        origins_filtered = origins_valid

    # Calculate robust statistics
    global_min = float(np.min(total_filtered))
    global_median = float(np.median(total_filtered))
    
    # For sheet metal, we want the MODE (most common thickness) as it represents material gauge
    # Use histogram to find most common thickness range
    hist, bin_edges = np.histogram(total_filtered, bins=50)
    mode_bin_idx = np.argmax(hist)
    thickness_mode = float((bin_edges[mode_bin_idx] + bin_edges[mode_bin_idx + 1]) / 2)
    
    # Determine the most representative thickness:
    # - If min, median, and mode are close (within 30%), use median (robust)
    # - If they differ significantly, part has varying thickness (likely CNC, not sheet metal)
    thickness_variance = (global_median - global_min) / max(global_min, 0.1)
    is_uniform_thickness = thickness_variance < 0.3
    
    # For sheet metal classification, use mode if uniform, otherwise use minimum
    representative_thickness = thickness_mode if is_uniform_thickness else global_min
    
    print(f"📊 Wall Thickness Analysis: min={global_min:.2f}mm, median={global_median:.2f}mm, "
          f"mode={thickness_mode:.2f}mm, variance={thickness_variance:.1%}, uniform={is_uniform_thickness}")
    
    # Collect sub-threshold samples
    mask = total_filtered <= max(threshold_mm, representative_thickness * 1.2)
    chosen_pts = origins_filtered[mask]
    chosen_d = total_filtered[mask]

    samples_out: List[MinWallSample] = []
    for i in range(min(50, chosen_pts.shape[0])):
        p = chosen_pts[i]
        t = float(chosen_d[i])
        samples_out.append(MinWallSample(at=(float(p[0]), float(p[1]), float(p[2])), thickness_mm=t, face_ids=[]))

    # Return the most representative thickness for classification
    return MinWallData(global_min_mm=representative_thickness, samples=samples_out)


def _first_hit_distance(intersector, origins: np.ndarray, directions: np.ndarray) -> np.ndarray:
    # Query intersections; returns list per ray
    locations, index_ray, _ = intersector.intersects_location(origins, directions, multiple_hits=False)
    # initialize with inf
    distances = np.full(len(origins), np.inf, dtype=float)
    if len(index_ray) == 0:
        return distances
    # Map hits to first-hit distances
    vec = locations - origins[index_ray]
    d = np.linalg.norm(vec, axis=1)
    distances[index_ray] = d
    return distances

