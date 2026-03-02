"""
Advanced bend detection for sheet metal parts.
Detects bends, flanges, and complex formed features.

Now includes mesh normal clustering for STL/mesh-based bend detection.
"""
from typing import List, Dict, Optional, Tuple, Any
import math
from dataclasses import dataclass

import numpy as np


@dataclass
class BendAnalysis:
    """Results from bend detection analysis."""
    bend_count: int
    bend_angles: List[float]
    has_flanges: bool
    has_relief_cuts: bool
    complexity_score: float  # 0-100
    bend_regions: List[Dict]  # List of detected bend regions
    is_likely_bent: bool
    confidence: float


def analyze_mesh_normals_for_bends(mesh: Any, min_cluster_angle: float = 15.0) -> Dict:
    """
    Analyze mesh face normals to detect bend regions.
    
    Bends create distinct normal clusters - flat faces have normals pointing
    in few directions, while bent parts have multiple normal directions.
    
    Args:
        mesh: Trimesh mesh object
        min_cluster_angle: Minimum angle (degrees) to consider normals different
        
    Returns:
        Dict with normal analysis results
    """
    try:
        if not hasattr(mesh, 'face_normals') or len(mesh.face_normals) < 10:
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        normals = mesh.face_normals
        areas = mesh.area_faces if hasattr(mesh, 'area_faces') else np.ones(len(normals))
        
        # Normalize areas for weighting
        total_area = np.sum(areas)
        if total_area <= 0:
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        # Cluster normals using angular proximity
        # Start with all normals as unclustered
        unclustered = list(range(len(normals)))
        clusters = []
        angle_threshold_rad = np.radians(min_cluster_angle)
        
        while unclustered:
            # Start new cluster with first unclustered face
            seed_idx = unclustered.pop(0)
            seed_normal = normals[seed_idx]
            cluster = [seed_idx]
            cluster_area = areas[seed_idx]
            
            # Find all faces with similar normals
            still_unclustered = []
            for idx in unclustered:
                # Compute dot product (cosine of angle)
                dot = np.clip(np.dot(normals[idx], seed_normal), -1.0, 1.0)
                angle = np.arccos(abs(dot))  # abs() to handle anti-parallel
                
                if angle < angle_threshold_rad:
                    cluster.append(idx)
                    cluster_area += areas[idx]
                else:
                    still_unclustered.append(idx)
            
            unclustered = still_unclustered
            
            # Only keep significant clusters (> 3% of total area)
            if cluster_area / total_area > 0.03:
                avg_normal = np.mean(normals[cluster], axis=0)
                avg_normal = avg_normal / np.linalg.norm(avg_normal)
                clusters.append({
                    'normal': avg_normal,
                    'face_count': len(cluster),
                    'area_fraction': cluster_area / total_area,
                    'face_indices': cluster[:100],  # Keep first 100 for reference
                })
        
        if len(clusters) < 2:
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        # Detect bend angles by finding dihedral angles between major normal clusters
        bend_angles = []
        bend_regions = []
        
        # Sort clusters by area (largest first)
        clusters = sorted(clusters, key=lambda c: c['area_fraction'], reverse=True)
        
        # Only consider top 6 clusters (more would be unusual for sheet metal)
        major_clusters = clusters[:6]
        
        for i, c1 in enumerate(major_clusters):
            for c2 in major_clusters[i+1:]:
                # Skip if either cluster is too small
                if c1['area_fraction'] < 0.05 or c2['area_fraction'] < 0.05:
                    continue
                    
                # Compute dihedral angle between cluster normals
                dot = np.clip(np.dot(c1['normal'], c2['normal']), -1.0, 1.0)
                angle_deg = np.degrees(np.arccos(abs(dot)))
                
                # Sheet metal bends typically 45-135 degrees
                # (90° is most common - perpendicular faces)
                if 30 < angle_deg < 150:
                    # This is likely a bend!
                    bend_angle = 180 - angle_deg  # Convert dihedral to bend angle
                    bend_angles.append(bend_angle)
                    bend_regions.append({
                        'type': 'normal_cluster_bend',
                        'dihedral_angle': angle_deg,
                        'bend_angle': bend_angle,
                        'cluster1_area': c1['area_fraction'],
                        'cluster2_area': c2['area_fraction'],
                    })
        
        # Deduplicate similar angles (within 10 degrees)
        unique_angles = []
        for angle in sorted(bend_angles, reverse=True):
            is_duplicate = False
            for ua in unique_angles:
                if abs(angle - ua) < 10:
                    is_duplicate = True
                    break
            if not is_duplicate:
                unique_angles.append(angle)
        
        bend_count = len(unique_angles)
        
        # Confidence based on cluster quality
        confidence = 0.0
        if bend_count > 0:
            # More clusters with clear separation = higher confidence
            avg_area = np.mean([c['area_fraction'] for c in major_clusters])
            confidence = min(0.85, 0.5 + 0.1 * bend_count + avg_area)
        
        return {
            'bend_count': bend_count,
            'bend_angles': unique_angles[:10],  # Cap at 10 bends
            'bend_regions': bend_regions[:10],
            'cluster_count': len(clusters),
            'major_cluster_count': len(major_clusters),
            'confidence': confidence,
            'method': 'mesh_normal_clustering',
        }
        
    except Exception as e:
        print(f"⚠️ Mesh normal analysis failed: {str(e)[:100]}")
        return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}


def analyze_triangle_dihedral_angles(mesh: Any, edge_angle_threshold: float = 25.0) -> Dict:
    """
    Detect bends by analyzing dihedral angles between adjacent triangles.
    
    When adjacent triangles have a dihedral angle significantly different from
    180° (flat), it indicates a bend or fold in the sheet.
    
    Args:
        mesh: Trimesh mesh object
        edge_angle_threshold: Min dihedral deviation from 180° to count as bend
        
    Returns:
        Dict with edge-based bend analysis
    """
    try:
        from scipy.spatial import cKDTree
    except ImportError:
        return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
    
    try:
        if not hasattr(mesh, 'face_adjacency') or len(mesh.face_adjacency) < 5:
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        adjacency = mesh.face_adjacency
        normals = mesh.face_normals
        
        # Calculate dihedral angles for all adjacent face pairs
        face1_normals = normals[adjacency[:, 0]]
        face2_normals = normals[adjacency[:, 1]]
        
        # Dot products give cosine of angle between normals
        dots = np.sum(face1_normals * face2_normals, axis=1)
        dots = np.clip(dots, -1.0, 1.0)
        
        # Dihedral angles (deviation from flat/180°)
        dihedral_deviations = np.degrees(np.arccos(dots))  # 0° = flat, 90° = perpendicular
        
        # Find edges with significant angle changes (potential bends)
        bend_threshold = edge_angle_threshold
        bend_edges = dihedral_deviations > bend_threshold
        
        if not np.any(bend_edges):
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        bend_edge_angles = dihedral_deviations[bend_edges]
        
        # Cluster bend edges by angle to count distinct bends
        # (multiple edges at same angle = same bend line)
        angle_clusters = []
        for angle in sorted(bend_edge_angles, reverse=True):
            is_clustered = False
            for cluster in angle_clusters:
                if abs(angle - cluster['angle']) < 15:  # 15° clustering threshold
                    cluster['count'] += 1
                    is_clustered = True
                    break
            if not is_clustered:
                angle_clusters.append({'angle': angle, 'count': 1})
        
        # Filter to significant clusters (many edges = actual bend line)
        significant_bends = [c for c in angle_clusters if c['count'] >= 5]
        
        bend_count = min(len(significant_bends), 20)  # Cap at 20
        bend_angles = [180 - c['angle'] for c in significant_bends[:10]]  # Convert to bend angles
        
        # Confidence based on edge consistency
        confidence = 0.0
        if bend_count > 0:
            avg_edges_per_bend = np.mean([c['count'] for c in significant_bends])
            confidence = min(0.85, 0.3 + 0.05 * avg_edges_per_bend)
        
        return {
            'bend_count': bend_count,
            'bend_angles': bend_angles,
            'total_bend_edges': int(np.sum(bend_edges)),
            'confidence': confidence,
            'method': 'triangle_dihedral',
        }
        
    except Exception as e:
        print(f"⚠️ Triangle dihedral analysis failed: {str(e)[:100]}")
        return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}


def analyze_vertex_curvature_for_bends(mesh: Any, curvature_threshold: float = 0.1) -> Dict:
    """
    Detect bends by analyzing vertex curvature distribution.
    
    Sheet metal bends create regions of high curvature (the bend zone) while
    flat faces have near-zero curvature. This method identifies bend lines by
    finding ridges of high curvature vertices.
    
    Args:
        mesh: Trimesh mesh object
        curvature_threshold: Minimum curvature to consider as bend zone
        
    Returns:
        Dict with curvature-based bend analysis
    """
    try:
        if not hasattr(mesh, 'vertex_normals') or len(mesh.vertices) < 20:
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        # Compute mean curvature at each vertex using discrete curvature
        # Mean curvature is high at bends and low on flat faces
        vertices = mesh.vertices
        faces = mesh.faces
        vertex_count = len(vertices)
        
        # Use trimesh's built-in curvature if available
        if hasattr(mesh, 'vertex_defects'):
            # Angular defect relates to Gaussian curvature
            curvatures = np.abs(mesh.vertex_defects)
        else:
            # Estimate curvature from vertex normal variation
            # High variation in normals among neighbors = high curvature
            normals = mesh.vertex_normals
            
            # Build vertex adjacency (which vertices share an edge)
            if not hasattr(mesh, 'vertex_adjacency_graph'):
                return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
            
            adj_graph = mesh.vertex_adjacency_graph
            curvatures = np.zeros(vertex_count)
            
            for v_idx in range(vertex_count):
                v_normal = normals[v_idx]
                neighbors = list(adj_graph.neighbors(v_idx)) if hasattr(adj_graph, 'neighbors') else []
                
                if len(neighbors) < 2:
                    continue
                
                # Measure normal deviation with neighbors
                neighbor_normals = normals[neighbors]
                dots = np.abs(np.dot(neighbor_normals, v_normal))
                dots = np.clip(dots, 0, 1)
                angles = np.arccos(dots)
                curvatures[v_idx] = np.mean(angles)
        
        # Threshold curvature to find bend zones
        high_curvature_mask = curvatures > curvature_threshold
        high_curv_count = np.sum(high_curvature_mask)
        high_curv_ratio = high_curv_count / max(vertex_count, 1)
        
        # Sheet metal typically has 5-30% vertices in bend zones
        is_sheet_metal_pattern = 0.03 < high_curv_ratio < 0.40
        
        if not is_sheet_metal_pattern:
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        # Estimate bend count from curvature distribution
        # Each bend line creates a strip of high-curvature vertices
        # Use 5% of vertices per bend as a rough estimate
        estimated_bends = int(high_curv_ratio / 0.05)
        estimated_bends = max(1, min(estimated_bends, 10))
        
        # Confidence based on how "peaked" the curvature distribution is
        curvature_std = np.std(curvatures)
        confidence = min(0.75, 0.3 + curvature_std * 5 + high_curv_ratio)
        
        return {
            'bend_count': estimated_bends,
            'bend_angles': [90.0] * estimated_bends,  # Default to 90° bends
            'high_curvature_ratio': high_curv_ratio,
            'curvature_std': curvature_std,
            'confidence': confidence,
            'method': 'vertex_curvature',
        }
        
    except Exception as e:
        print(f"⚠️ Vertex curvature analysis failed: {str(e)[:100]}")
        return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}


def analyze_edge_creases_for_bends(mesh: Any, crease_angle_threshold: float = 30.0) -> Dict:
    """
    Detect bends by finding crease edges (sharp edges between faces).
    
    Unlike the triangle dihedral method, this approach groups connected
    crease edges into bend lines and measures the overall bend angle
    along each line.
    
    Args:
        mesh: Trimesh mesh object
        crease_angle_threshold: Minimum angle to consider as crease (degrees)
        
    Returns:
        Dict with edge crease analysis
    """
    try:
        if not hasattr(mesh, 'face_adjacency_angles'):
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        # Get face adjacency angles (dihedral angles at shared edges)
        dihedral_angles_rad = mesh.face_adjacency_angles
        dihedral_angles_deg = np.degrees(dihedral_angles_rad)
        
        # Find crease edges (significant dihedral angle)
        crease_mask = dihedral_angles_deg > crease_angle_threshold
        crease_angles = dihedral_angles_deg[crease_mask]
        
        if len(crease_angles) == 0:
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        # Histogram of crease angles to find distinct bend angles
        # Sheet metal typically has consistent bend angles
        angle_bins = np.arange(30, 165, 10)  # 30° to 160° in 10° bins
        hist, edges = np.histogram(crease_angles, bins=angle_bins)
        
        # Find peaks in histogram (dominant bend angles)
        peak_threshold = max(3, len(crease_angles) * 0.05)
        peak_bins = np.where(hist >= peak_threshold)[0]
        
        if len(peak_bins) == 0:
            return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}
        
        # Convert histogram peaks to bend angles
        # dihedral_angle = 180 - bend_angle
        bend_angles = []
        for bin_idx in peak_bins:
            dihedral_angle = (edges[bin_idx] + edges[bin_idx + 1]) / 2
            bend_angle = 180 - dihedral_angle
            if 10 < bend_angle < 170:
                bend_angles.append(bend_angle)
        
        bend_count = len(bend_angles)
        
        # Confidence based on consistency of crease angles
        angle_consistency = 1.0 - (np.std(crease_angles) / 45.0)
        crease_ratio = len(crease_angles) / max(len(dihedral_angles_deg), 1)
        confidence = min(0.85, 0.3 + angle_consistency * 0.3 + crease_ratio * 0.5)
        
        return {
            'bend_count': bend_count,
            'bend_angles': sorted(bend_angles, reverse=True)[:10],
            'total_crease_edges': int(np.sum(crease_mask)),
            'angle_consistency': angle_consistency,
            'confidence': confidence,
            'method': 'edge_creases',
        }
        
    except Exception as e:
        print(f"⚠️ Edge crease analysis failed: {str(e)[:100]}")
        return {'bend_count': 0, 'bend_angles': [], 'confidence': 0.0}


class AdvancedBendDetector:
    """
    Enterprise-level bend detection using multiple geometric indicators.
    
    Detection methods:
    1. Thickness Discrepancy: actual_thickness << bbox_minimum
    2. Volume Hollowness: volume < 40% of envelope
    3. Surface Complexity: Ratio of surface area to envelope
    4. Dimension Ratios: Multiple perpendicular faces
    5. Edge Patterns: Sharp transitions indicating bends
    """
    
    def __init__(self, bbox_dims: List[float], volume_mm3: float, surface_area_mm2: float):
        """
        Initialize detector with basic geometry.
        
        Args:
            bbox_dims: [min, mid, max] bounding box dimensions in mm
            volume_mm3: Part volume in mm³
            surface_area_mm2: Surface area in mm²
        """
        self.bbox_dims = sorted(bbox_dims)
        self.volume_mm3 = volume_mm3
        self.surface_area_mm2 = surface_area_mm2
        
        self.min_dim = self.bbox_dims[0]
        self.mid_dim = self.bbox_dims[1]
        self.max_dim = self.bbox_dims[2]
        
        # Calculate aspect ratio
        self.aspect_ratio = self.max_dim / self.min_dim if self.min_dim > 0.01 else 1.0
        
        self.envelope_volume = self.min_dim * self.mid_dim * self.max_dim
        self.volume_efficiency = volume_mm3 / self.envelope_volume if self.envelope_volume > 0 else 0
    
    def analyze_bends(self, detected_thickness: Optional[float] = None, 
                     thickness_confidence: float = 0.0,
                     triangle_count: int = 0) -> BendAnalysis:
        """
        Comprehensive bend analysis using multiple detection methods.
        
        Args:
            detected_thickness: Actual wall thickness from ray-casting (mm)
            thickness_confidence: Confidence in thickness measurement (0-1)
            triangle_count: Number of triangles in mesh (complexity indicator)
            
        Returns:
            BendAnalysis with detected features and confidence
        """
        bend_indicators: List[Dict] = []
        bend_count = 0
        bend_angles: List[float] = []
        bend_regions: List[Dict] = []
        
        is_hollow = self.volume_efficiency < 0.4

        # Run detection methods
        bend_count, has_thickness_discrepancy = self._check_thickness_discrepancy(
            detected_thickness, thickness_confidence, bend_indicators, bend_count
        )
        bend_count = self._check_dimension_ratio(
            has_thickness_discrepancy, bend_indicators, bend_count, detected_thickness
        )
        bend_count = self._check_volume_hollowness(
            is_hollow, bend_indicators, bend_count
        )
        self._check_surface_excess(bend_indicators, bend_count)
        bend_count, bend_angles, bend_regions = self._check_dimension_patterns(
            is_hollow, bend_indicators, bend_count, bend_angles, bend_regions
        )
        bend_count = self._check_mesh_complexity(
            triangle_count, bend_indicators, bend_count
        )
        has_flanges = self._check_flanges(is_hollow, bend_indicators, detected_thickness)
        has_relief_cuts = self._check_relief_cuts(bend_count, bend_indicators)

        # Calculate overall confidence
        overall_confidence, is_likely_bent = self._compute_confidence(
            bend_indicators, has_thickness_discrepancy, is_hollow, bend_count
        )

        # Complexity score
        complexity_score = min(100, 
                              bend_count * 15 + 
                              (10 if has_flanges else 0) +
                              (5 if has_relief_cuts else 0) +
                              (1 - self.volume_efficiency) * 30)
        
        if bend_count > 0 and not bend_angles:
            bend_angles = [90.0] * min(bend_count, 5)
        
        return BendAnalysis(
            bend_count=bend_count,
            bend_angles=bend_angles,
            has_flanges=has_flanges,
            has_relief_cuts=has_relief_cuts,
            complexity_score=complexity_score,
            bend_regions=bend_regions,
            is_likely_bent=is_likely_bent,
            confidence=overall_confidence
        )
    
    def _check_thickness_discrepancy(
        self, detected_thickness: Optional[float],
        thickness_confidence: float,
        indicators: List[Dict], bend_count: int
    ) -> tuple:
        """METHOD 1: Thickness discrepancy - most reliable indicator."""
        has_discrepancy = False
        if not (detected_thickness and detected_thickness > 0):
            return bend_count, has_discrepancy

        thickness_ratio = detected_thickness / self.min_dim if self.min_dim > 0 else 1.0
        if thickness_ratio >= 0.5 or thickness_confidence <= 0.4:
            return bend_count, has_discrepancy

        has_discrepancy = True
        confidence = min(0.95, thickness_confidence + 0.2)
        indicators.append({
            'method': 'thickness_discrepancy',
            'confidence': confidence,
            'ratio': thickness_ratio,
            'evidence': f"Wall {detected_thickness:.1f}mm << bbox {self.min_dim:.1f}mm"
        })
        
        if thickness_ratio < 0.2:
            bend_count = max(3, int(10 * (1 - thickness_ratio)))
        elif thickness_ratio < 0.35:
            bend_count = max(bend_count, 2)
        else:
            bend_count = max(bend_count, 1)

        return bend_count, has_discrepancy

    def _check_dimension_ratio(
        self, has_thickness_discrepancy: bool,
        indicators: List[Dict], bend_count: int,
        detected_thickness: Optional[float] = None
    ) -> int:
        """METHOD 1B: Dimension ratio detection when thickness detection fails."""
        # Skip if thickness already detected as a discrepancy
        if has_thickness_discrepancy:
            return bend_count
        
        # Skip if part is not thin (min_dim >= 6mm)
        if self.min_dim >= 6:
            return bend_count
        
        # Skip if aspect ratio is low (not sheet-like)
        if self.aspect_ratio <= 8:
            return bend_count
        
        # IMPORTANT: Skip if detected_thickness matches bbox minimum (flat sheet, not bent)
        # A flat sheet has thickness ≈ min_dim, whereas a bent sheet has thickness << min_dim
        if detected_thickness is not None and detected_thickness > 0:
            thickness_ratio = detected_thickness / self.min_dim if self.min_dim > 0 else 1.0
            # If thickness is within 30% of bbox min, it's likely a flat sheet, not bent
            if thickness_ratio >= 0.7:
                return bend_count
        
        indicators.append({
            'method': 'dimension_ratio',
            'confidence': 0.70,
            'evidence': f"Thin profile ({self.min_dim:.1f}mm) with high aspect ratio ({self.aspect_ratio:.1f})"
        })
        return max(bend_count, 1)

    def _check_volume_hollowness(
        self, is_hollow: bool,
        indicators: List[Dict], bend_count: int
    ) -> int:
        """METHOD 2: Volume hollowness."""
        if not is_hollow:
            return bend_count
        indicators.append({
            'method': 'volume_hollowness',
            'confidence': 0.7,
            'hollowness': 1.0 - self.volume_efficiency,
            'evidence': f"Volume efficiency {self.volume_efficiency:.1%} (hollow structure)"
        })
        if self.volume_efficiency < 0.25:
            return max(bend_count, 3)
        if self.volume_efficiency < 0.35:
            return max(bend_count, 2)
        return bend_count

    def _check_surface_excess(
        self, indicators: List[Dict], bend_count: int
    ) -> int:
        """METHOD 3: Surface area excess."""
        flat_surface_estimate = 2 * (self.mid_dim * self.max_dim + 
                                     self.min_dim * self.max_dim + 
                                     self.min_dim * self.mid_dim)
        if flat_surface_estimate <= 0:
            return bend_count
        surface_excess = (self.surface_area_mm2 - flat_surface_estimate) / flat_surface_estimate
        if surface_excess > 0.3:
            indicators.append({
                'method': 'surface_excess',
                'confidence': 0.6,
                'excess': surface_excess,
                'evidence': f"Surface area {surface_excess:.0%} higher than flat equivalent"
            })
            return max(bend_count, 1)
        return bend_count

    def _check_dimension_patterns(
        self, is_hollow: bool,
        indicators: List[Dict], bend_count: int,
        bend_angles: List[float], bend_regions: List[Dict]
    ) -> tuple:
        """METHOD 4: Dimension ratio analysis (U-bracket, L-bracket patterns).
        
        FIX: Relaxed thresholds to detect 2-bend parts (channels, simple brackets)
        that have moderate aspect ratios and volume efficiencies.
        """
        aspect_ratio = self.max_dim / max(self.min_dim, 0.1)
        mid_to_max_ratio = self.mid_dim / self.max_dim if self.max_dim > 0 else 0
        min_to_mid_ratio = self.min_dim / self.mid_dim if self.mid_dim > 0 else 0
        
        # U-bracket detection (2 bends) - relaxed thresholds
        # A U-channel can have moderate aspect ratio (8+) and doesn't need to be fully hollow
        # Key: thin profile (min_dim small), moderate hollowness
        if (aspect_ratio >= 8 and 
            0.15 < mid_to_max_ratio < 0.8 and 
            (is_hollow or self.volume_efficiency < 0.55) and
            self.min_dim <= 8):
            indicators.append({
                'method': 'u_bracket_pattern',
                'confidence': 0.80 if is_hollow else 0.70,
                'pattern': 'U-shape',
                'evidence': f"U-bracket/channel geometry (AR: {aspect_ratio:.1f}, vol_eff: {self.volume_efficiency:.2f})"
            })
            bend_count = max(bend_count, 2)
            bend_angles.extend([90.0, 90.0])
            bend_regions.append({
                'type': 'U-bracket',
                'bend_line_1': 'along_length',
                'bend_line_2': 'along_length_opposite'
            })
        
        # L-bracket detection (1 bend) - relaxed thresholds
        # An L-bracket has thin profile and moderate aspect ratio
        elif (aspect_ratio >= 5 and 
              self.min_dim <= 8 and 
              (is_hollow or self.volume_efficiency < 0.7)):
            # Additional check: mid dimension should be significant 
            # (not just a flat sheet turned 90 degrees)
            if mid_to_max_ratio >= 0.15:
                indicators.append({
                    'method': 'l_bracket_pattern',
                    'confidence': 0.70,
                    'pattern': 'L-shape',
                    'evidence': f"L-bracket geometry (AR: {aspect_ratio:.1f})"
                })
                bend_count = max(bend_count, 1)
                bend_angles.append(90.0)
                bend_regions.append({
                    'type': 'L-bracket',
                    'bend_line': 'along_length'
                })

        return bend_count, bend_angles, bend_regions

    def _check_mesh_complexity(
        self, triangle_count: int,
        indicators: List[Dict], bend_count: int
    ) -> int:
        """METHOD 5: Triangle count complexity."""
        if triangle_count <= 0 or self.min_dim >= 6:
            return bend_count
        triangles_per_area = triangle_count / max(self.surface_area_mm2, 1)
        if triangles_per_area > 1.0:
            indicators.append({
                'method': 'mesh_complexity',
                'confidence': 0.5,
                'density': triangles_per_area,
                'evidence': f"High mesh complexity: {triangles_per_area:.2f} triangles/mm²"
            })
            return max(bend_count, min(5, int(triangle_count / 3000)))
        return bend_count

    def _check_flanges(self, is_hollow: bool, indicators: List[Dict], detected_thickness: Optional[float] = None) -> bool:
        """METHOD 6: Flange detection."""
        # Use detected_thickness if available, otherwise fall back to min_dim
        effective_thickness = detected_thickness if detected_thickness is not None else self.min_dim
        
        if effective_thickness < 6 and is_hollow:
            indicators.append({
                'method': 'flange_detection',
                'confidence': 0.6,
                'evidence': "Thin walls with hollow structure suggest flanges"
            })
            return True
        return False

    def _check_relief_cuts(self, bend_count: int, indicators: List[Dict]) -> bool:
        """METHOD 7: Relief cut detection."""
        if bend_count >= 2 and self.volume_efficiency < 0.35:
            indicators.append({
                'method': 'relief_cut_inference',
                'confidence': 0.5,
                'evidence': "Multiple bends suggest relief cuts at corners"
            })
            return True
        return False

    def _compute_confidence(
        self, bend_indicators: List[Dict],
        has_thickness_discrepancy: bool, is_hollow: bool,
        bend_count: int
    ) -> tuple:
        """Calculate overall confidence from all indicators."""
        if not bend_indicators:
            return 0.0, False
        
        weight_map = {
            'thickness_discrepancy': 3.0,
            'dimension_ratio': 1.5,
            'volume_hollowness': 1.5,
            'surface_excess': 1.0,
            'u_bracket_pattern': 2.0,
            'l_bracket_pattern': 1.5,
            'mesh_complexity': 0.5,
            'flange_detection': 0.8,
            'relief_cut_inference': 0.5,
        }
        weighted_sum = sum(
            float(ind['confidence']) * weight_map.get(str(ind['method']), 1.0)
            for ind in bend_indicators
        )
        total_weight = sum(
            weight_map.get(str(ind['method']), 1.0)
            for ind in bend_indicators
        )
        overall_confidence = weighted_sum / total_weight if total_weight > 0 else 0.0
        
        if has_thickness_discrepancy and is_hollow:
            overall_confidence = min(0.95, overall_confidence + 0.2)
        
        is_likely_bent = (
            (overall_confidence > 0.55 and bend_count > 0)
            or (bend_count >= 2 and overall_confidence > 0.45)
            or (has_thickness_discrepancy and self.aspect_ratio > 8)
        )
        return overall_confidence, is_likely_bent
    
    def get_bend_detection_report(self, analysis: BendAnalysis) -> str:
        """
        Generate human-readable report of bend detection.
        
        Args:
            analysis: BendAnalysis result
            
        Returns:
            Formatted report string
        """
        if not analysis.is_likely_bent:
            return "No bends detected - likely flat sheet or solid machined part"
        
        report = []
        report.append(f"🎯 BENT SHEET METAL DETECTED (Confidence: {analysis.confidence:.0%})")
        report.append(f"   Bend count: {analysis.bend_count}")
        
        if analysis.bend_angles:
            angles_str = ", ".join(f"{a:.0f}°" for a in analysis.bend_angles[:5])
            report.append(f"   Bend angles: {angles_str}")
        
        if analysis.bend_regions:
            for i, region in enumerate(analysis.bend_regions[:3], 1):
                report.append(f"   Region {i}: {region.get('type', 'unknown')} - {region.get('bend_line', 'N/A')}")
        
        report.append(f"   Complexity: {analysis.complexity_score:.0f}/100")
        
        features = []
        if analysis.has_flanges:
            features.append("flanges")
        if analysis.has_relief_cuts:
            features.append("relief cuts")
        
        if features:
            report.append(f"   Features: {', '.join(features)}")
        
        return "\n".join(report)

    def analyze_with_mesh(self, mesh: Any, 
                          detected_thickness: Optional[float] = None,
                          thickness_confidence: float = 0.0,
                          triangle_count: int = 0) -> BendAnalysis:
        """
        Enhanced bend analysis that combines heuristic methods with mesh normal analysis.
        
        This method first runs the standard heuristic analysis, then enhances it
        with mesh-based normal clustering and triangle dihedral angle analysis
        for more accurate bend detection on STL files.
        
        Args:
            mesh: Trimesh mesh object
            detected_thickness: Actual wall thickness from ray-casting (mm)
            thickness_confidence: Confidence in thickness measurement (0-1)
            triangle_count: Number of triangles in mesh
            
        Returns:
            BendAnalysis with combined detection results
        """
        # First run standard heuristic analysis
        heuristic_result = self.analyze_bends(
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
            triangle_count=triangle_count
        )
        
        if mesh is None:
            return heuristic_result
        
        # Run all mesh-based analyses
        normal_result = analyze_mesh_normals_for_bends(mesh)
        dihedral_result = analyze_triangle_dihedral_angles(mesh)
        curvature_result = analyze_vertex_curvature_for_bends(mesh)
        crease_result = analyze_edge_creases_for_bends(mesh)
        
        # Combine results - take the maximum bend count with highest confidence source
        combined_bend_count = heuristic_result.bend_count
        combined_angles = list(heuristic_result.bend_angles)
        combined_regions = list(heuristic_result.bend_regions)
        combined_confidence = heuristic_result.confidence
        
        # Helper to merge angles without duplicates
        def merge_angles(new_angles: list):
            for angle in new_angles:
                if not any(abs(angle - a) < 10 for a in combined_angles):
                    combined_angles.append(angle)
        
        # Integrate normal clustering results
        if normal_result['confidence'] > 0.4:
            if normal_result['bend_count'] > combined_bend_count:
                combined_bend_count = normal_result['bend_count']
                merge_angles(normal_result.get('bend_angles', []))
                
            combined_confidence = max(combined_confidence, normal_result['confidence'])
            if normal_result.get('bend_regions'):
                combined_regions.extend(normal_result['bend_regions'][:3])
        
        # Integrate dihedral edge results (often most accurate for STL)
        if dihedral_result['confidence'] > 0.5:
            if dihedral_result['bend_count'] > combined_bend_count:
                combined_bend_count = dihedral_result['bend_count']
                merge_angles(dihedral_result.get('bend_angles', []))
            
            combined_confidence = max(combined_confidence, dihedral_result['confidence'])
        
        # Integrate vertex curvature results (good for rolled/continuous bends)
        if curvature_result['confidence'] > 0.4:
            if curvature_result['bend_count'] > combined_bend_count:
                combined_bend_count = curvature_result['bend_count']
                merge_angles(curvature_result.get('bend_angles', []))
            
            combined_confidence = max(combined_confidence, curvature_result['confidence'])
            combined_regions.append({
                'type': 'curvature_zone',
                'high_curvature_ratio': curvature_result.get('high_curvature_ratio', 0)
            })
        
        # Integrate edge crease results (best for sharp bends with clean meshes)
        if crease_result['confidence'] > 0.5:
            if crease_result['bend_count'] > combined_bend_count:
                combined_bend_count = crease_result['bend_count']
                merge_angles(crease_result.get('bend_angles', []))
            
            combined_confidence = max(combined_confidence, crease_result['confidence'])
        
        # Boost confidence if multiple methods agree
        methods_with_bends = sum([
            heuristic_result.bend_count > 0,
            normal_result['bend_count'] > 0,
            dihedral_result['bend_count'] > 0,
            curvature_result['bend_count'] > 0,
            crease_result['bend_count'] > 0,
        ])
        if methods_with_bends >= 3:
            combined_confidence = min(0.98, combined_confidence + 0.20)
        elif methods_with_bends >= 2:
            combined_confidence = min(0.95, combined_confidence + 0.15)
        
        # Update is_likely_bent based on combined analysis
        is_likely_bent = (
            combined_confidence > 0.5 and combined_bend_count > 0
        ) or (
            combined_bend_count >= 2 and combined_confidence > 0.4
        ) or heuristic_result.is_likely_bent
        
        # Recalculate complexity
        complexity_score = min(100, 
                              combined_bend_count * 15 + 
                              (10 if heuristic_result.has_flanges else 0) +
                              (5 if heuristic_result.has_relief_cuts else 0) +
                              (1 - self.volume_efficiency) * 30)
        
        # Log debug info
        if combined_bend_count > 0:
            print(f"📐 Mesh bend analysis: heuristic={heuristic_result.bend_count}, "
                  f"normals={normal_result['bend_count']}, dihedral={dihedral_result['bend_count']}, "
                  f"curvature={curvature_result['bend_count']}, crease={crease_result['bend_count']} "
                  f"→ combined={combined_bend_count} (conf={combined_confidence:.2f})")
        
        return BendAnalysis(
            bend_count=combined_bend_count,
            bend_angles=combined_angles[:10],  # Cap at 10 angles
            has_flanges=heuristic_result.has_flanges,
            has_relief_cuts=heuristic_result.has_relief_cuts,
            complexity_score=complexity_score,
            bend_regions=combined_regions[:5],  # Cap at 5 regions
            is_likely_bent=is_likely_bent,
            confidence=combined_confidence
        )
