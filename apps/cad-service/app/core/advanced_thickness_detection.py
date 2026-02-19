"""
Advanced Sheet Metal Thickness Detection

Core principle: Sheet thickness T is the most common distance between two large,
approximately parallel "skin" surfaces that are opposite each other and remain 
nearly constant across a large portion of the part.

This module implements face-pairing analysis, distance clustering, and 
area-weighted dominance to accurately identify sheet metal thickness.
"""
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass
import math
import numpy as np
from collections import defaultdict


@dataclass
class FacePair:
    """Pair of opposing parallel faces with consistent separation"""
    face1_area: float  # mm²
    face2_area: float  # mm²
    distance: float  # mm
    std_dev: float  # consistency of separation
    support_area: float  # min(face1_area, face2_area)
    is_planar: bool
    

@dataclass
class ThicknessCluster:
    """Cluster of face pairs with similar thickness"""
    thickness: float  # mm (median/mean)
    support_area: float  # mm² (sum of support areas)
    pair_count: int
    std_dev: float  # spread within cluster
    

@dataclass
class ThicknessAnalysisResult:
    """Complete thickness analysis result"""
    detected_thickness: Optional[float]  # mm
    confidence: float  # 0-1
    uniform_ratio: float  # area_support / total_area
    thickness_to_size_ratio: float  # T/L (thinness)
    cluster_dominance: float  # dominant / second_best
    clusters: List[ThicknessCluster]
    is_sheet_thickness: bool
    reasoning: str
    

class AdvancedThicknessDetector:
    """
    Advanced thickness detection using face-pairing and clustering.
    
    Implements proper geometric analysis to distinguish sheet metal from
    CNC machined parts, castings, and other manufacturing processes.
    """
    
    # Configuration constants (tunable)
    PARALLELISM_ANGLE_TOL = 5.0  # degrees
    MIN_AREA_RATIO = 0.01  # 1% of total surface area
    MIN_AREA_ABSOLUTE = 200.0  # mm²
    THICKNESS_CONSISTENCY_TOL = 0.05  # 5% of thickness
    THICKNESS_CONSISTENCY_ABS = 0.1  # mm
    
    # Sheet metal criteria
    # UPDATED: More lenient thresholds to handle smaller/bent sheet metal parts
    MIN_UNIFORM_RATIO = 0.25  # 25% of surface must show thickness (was 35%)
    MAX_THICKNESS_TO_SIZE = 0.15  # 15% for clear sheet metal (was 10%)
    MAX_THICKNESS_TO_SIZE_STRICT = 0.06  # 6% for high confidence (was 4%)
    MIN_CLUSTER_DOMINANCE = 1.8  # 1.8x second cluster (was 2.0)
    
    def __init__(self, bbox_dims: List[float], surface_area_mm2: float):
        """
        Initialize detector with basic geometry info.
        
        Args:
            bbox_dims: Bounding box dimensions [x, y, z] in mm
            surface_area_mm2: Total surface area in mm²
        """
        self.bbox_dims = sorted(bbox_dims)
        self.surface_area = surface_area_mm2
        self.max_dimension = self.bbox_dims[2]
        self.mid_dimension = self.bbox_dims[1]  # Second largest dimension
        self.min_dimension = self.bbox_dims[0]  # Smallest (likely thickness)
        
    def analyze_from_mesh_distances(self, 
                                    sample_distances: List[float],
                                    sample_areas: Optional[List[float]] = None) -> ThicknessAnalysisResult:
        """
        Analyze thickness from mesh-based ray-casting samples.
        
        This is a simplified version for when we only have ray-casting data
        without full CAD face information.
        
        Args:
            sample_distances: List of sampled distances from ray-casting
            sample_areas: Optional area weights for each sample
            
        Returns:
            ThicknessAnalysisResult with detected thickness and confidence
        """
        if not sample_distances or len(sample_distances) < 10:
            return self._no_thickness_result("Insufficient samples")
        
        # CRITICAL FIX: Sheet metal thickness MUST be <= min_dimension
        # The thinnest direction of the bounding box defines the maximum possible thickness
        # Using min_dimension instead of max_dimension * 0.5 prevents detecting spurious
        # large distances from CNC parts/solid blocks
        max_valid_thickness = self.min_dimension * 1.1  # Allow 10% tolerance for measurement noise
        
        # Clean data: remove outliers and invalid values
        valid_distances = [d for d in sample_distances if 0.1 < d <= max_valid_thickness]
        
        if len(valid_distances) < 10:
            return self._no_thickness_result(f"Too many invalid samples (>{self.min_dimension:.1f}mm)")
        
        # If no areas provided, estimate based on total surface area and sample count
        # Assumption: samples are uniformly distributed over surface
        if sample_areas is None:
            area_per_sample = self.surface_area / len(valid_distances)
            sample_areas = [area_per_sample] * len(valid_distances)
        
        # Cluster distances using simple binning
        clusters = self._cluster_distances_simple(valid_distances, sample_areas)
        
        if not clusters:
            return self._no_thickness_result("No valid clusters found")
        
        # Sort by support area (or count if no areas provided)
        clusters.sort(key=lambda c: c.support_area, reverse=True)
        
        dominant = clusters[0]
        
        # CRITICAL: Final validation - detected thickness MUST be <= min_dimension
        # If the clustering found a thickness larger than min_dim, something is wrong
        if dominant.thickness > self.min_dimension * 1.1:
            return self._no_thickness_result(
                f"Detected thickness {dominant.thickness:.2f}mm > min_dim {self.min_dimension:.2f}mm"
            )
        
        # Calculate metrics
        uniform_ratio = dominant.support_area / self.surface_area
        
        # FIX: T/L ratio should compare thickness to max_dimension (longest extent)
        # This properly measures "thinness" - how thin is the part relative to its size
        # A 2mm x 100mm x 200mm sheet has T/L = 2/200 = 1% (very thin)
        reference_dimension = self.max_dimension if self.max_dimension > 0 else 1.0
        thickness_to_size = dominant.thickness / reference_dimension
        
        cluster_dominance = 1.0
        if len(clusters) > 1:
            cluster_dominance = dominant.support_area / max(clusters[1].support_area, 1.0)
        
        # Determine if this is genuine sheet thickness
        is_sheet, confidence, reasoning = self._evaluate_sheet_criteria(
            dominant.thickness,
            uniform_ratio,
            thickness_to_size,
            cluster_dominance,
            dominant.std_dev
        )
        
        return ThicknessAnalysisResult(
            detected_thickness=dominant.thickness if is_sheet else None,
            confidence=confidence,
            uniform_ratio=uniform_ratio,
            thickness_to_size_ratio=thickness_to_size,
            cluster_dominance=cluster_dominance,
            clusters=clusters[:3],  # Top 3 clusters
            is_sheet_thickness=is_sheet,
            reasoning=reasoning
        )
    
    def analyze_from_face_pairs(self, 
                                face_pairs: List[FacePair]) -> ThicknessAnalysisResult:
        """
        Analyze thickness from explicit face pair analysis.
        
        This is the full implementation when CAD face data is available.
        
        Args:
            face_pairs: List of detected opposing face pairs
            
        Returns:
            ThicknessAnalysisResult with detected thickness and confidence
        """
        if not face_pairs:
            return self._no_thickness_result("No face pairs detected")
        
        # Filter by area (must be significant)
        min_area = max(
            self.surface_area * self.MIN_AREA_RATIO,
            self.MIN_AREA_ABSOLUTE
        )
        
        valid_pairs = [
            pair for pair in face_pairs
            if pair.support_area >= min_area and
            pair.std_dev <= max(
                pair.distance * self.THICKNESS_CONSISTENCY_TOL,
                self.THICKNESS_CONSISTENCY_ABS
            ) and
            # CRITICAL: Face pair distance must be <= min_dimension (valid thickness)
            pair.distance <= self.min_dimension * 1.1
        ]
        
        if not valid_pairs:
            return self._no_thickness_result("No valid face pairs (area/consistency/distance)")
        
        # Cluster by distance
        clusters = self._cluster_face_pairs(valid_pairs)
        
        if not clusters:
            return self._no_thickness_result("No clusters formed")
        
        # Sort by support area
        clusters.sort(key=lambda c: c.support_area, reverse=True)
        
        dominant = clusters[0]
        
        # CRITICAL: Final validation - detected thickness MUST be <= min_dimension
        if dominant.thickness > self.min_dimension * 1.1:
            return self._no_thickness_result(
                f"Detected thickness {dominant.thickness:.2f}mm > min_dim {self.min_dimension:.2f}mm"
            )
        
        # Calculate metrics
        uniform_ratio = dominant.support_area / self.surface_area
        
        # FIX: T/L ratio should compare thickness to max_dimension (longest extent)
        reference_dimension = self.max_dimension if self.max_dimension > 0 else 1.0
        thickness_to_size = dominant.thickness / reference_dimension
        
        cluster_dominance = 1.0
        if len(clusters) > 1:
            cluster_dominance = dominant.support_area / max(clusters[1].support_area, 1.0)
        
        # Evaluate sheet criteria
        is_sheet, confidence, reasoning = self._evaluate_sheet_criteria(
            dominant.thickness,
            uniform_ratio,
            thickness_to_size,
            cluster_dominance,
            dominant.std_dev
        )
        
        return ThicknessAnalysisResult(
            detected_thickness=dominant.thickness if is_sheet else None,
            confidence=confidence,
            uniform_ratio=uniform_ratio,
            thickness_to_size_ratio=thickness_to_size,
            cluster_dominance=cluster_dominance,
            clusters=clusters[:3],
            is_sheet_thickness=is_sheet,
            reasoning=reasoning
        )
    
    def _cluster_distances_simple(self, 
                                  distances: List[float],
                                  areas: Optional[List[float]] = None) -> List[ThicknessCluster]:
        """
        Simple distance clustering using histogram binning.
        
        Args:
            distances: List of distance measurements
            areas: Optional area weights
            
        Returns:
            List of ThicknessCluster objects
        """
        if not distances:
            return []
        
        # Use uniform weights if no areas provided
        if areas is None:
            areas = [1.0] * len(distances)
        
        # Create bins (adaptive based on range)
        min_d = min(distances)
        max_d = max(distances)
        bin_width = max(0.1, (max_d - min_d) / 50)  # At most 50 bins
        
        # Build histogram
        bins: dict = defaultdict(lambda: {'distances': [], 'areas': []})
        for d, a in zip(distances, areas):
            bin_idx = int(d / bin_width)
            bins[bin_idx]['distances'].append(d)
            bins[bin_idx]['areas'].append(a)
        
        # Convert bins to clusters
        clusters = []
        for bin_data in bins.values():
            if len(bin_data['distances']) >= 3:  # Minimum cluster size
                distances_arr = np.array(bin_data['distances'])
                areas_arr = np.array(bin_data['areas'])
                
                cluster = ThicknessCluster(
                    thickness=float(np.median(distances_arr)),
                    support_area=float(np.sum(areas_arr)),
                    pair_count=len(distances_arr),
                    std_dev=float(np.std(distances_arr))
                )
                clusters.append(cluster)
        
        return clusters
    
    def _cluster_face_pairs(self, face_pairs: List[FacePair]) -> List[ThicknessCluster]:
        """
        Cluster face pairs by distance similarity.
        
        Args:
            face_pairs: List of valid face pairs
            
        Returns:
            List of ThicknessCluster objects
        """
        if not face_pairs:
            return []
        
        # Extract distances and areas
        distances = [pair.distance for pair in face_pairs]
        areas = [pair.support_area for pair in face_pairs]
        
        return self._cluster_distances_simple(distances, areas)
    
    def _evaluate_sheet_criteria(self,
                                 thickness: float,
                                 uniform_ratio: float,
                                 thickness_to_size: float,
                                 cluster_dominance: float,
                                 std_dev: float) -> Tuple[bool, float, str]:
        """
        Evaluate if detected thickness meets sheet metal criteria.
        
        Args:
            thickness: Detected thickness in mm
            uniform_ratio: Area support ratio (0-1)
            thickness_to_size: T/L ratio
            cluster_dominance: Dominant vs second cluster
            std_dev: Thickness consistency
            
        Returns:
            Tuple of (is_sheet_metal, confidence, reasoning)
        """
        reasons = []
        confidence = 0.5  # Base confidence
        
        # Criterion 1: Uniform ratio (most important)
        if uniform_ratio >= 0.50:
            confidence += 0.25
            reasons.append(f"high uniform ratio ({uniform_ratio:.1%})")
        elif uniform_ratio >= 0.35:
            confidence += 0.18
            reasons.append(f"good uniform ratio ({uniform_ratio:.1%})")
        elif uniform_ratio >= self.MIN_UNIFORM_RATIO:  # 25%
            confidence += 0.10
            reasons.append(f"moderate uniform ratio ({uniform_ratio:.1%})")
        else:
            confidence -= 0.20
            reasons.append(f"LOW uniform ratio ({uniform_ratio:.1%})")
        
        # Criterion 2: Thinness (T/L ratio)
        # Based on max_dimension as reference
        if thickness_to_size <= self.MAX_THICKNESS_TO_SIZE_STRICT:  # 6%
            confidence += 0.25
            reasons.append(f"very thin (T/L={thickness_to_size:.1%})")
        elif thickness_to_size <= 0.10:  # 10%
            confidence += 0.15
            reasons.append(f"thin (T/L={thickness_to_size:.1%})")
        elif thickness_to_size <= self.MAX_THICKNESS_TO_SIZE:  # 15%
            confidence += 0.08
            reasons.append(f"moderately thin (T/L={thickness_to_size:.1%})")
        else:
            confidence -= 0.15
            reasons.append(f"NOT thin (T/L={thickness_to_size:.1%})")
        
        # Criterion 3: Cluster dominance
        if cluster_dominance >= 3.0:
            confidence += 0.15
            reasons.append(f"strong dominance ({cluster_dominance:.1f}x)")
        elif cluster_dominance >= self.MIN_CLUSTER_DOMINANCE:
            confidence += 0.08
            reasons.append(f"good dominance ({cluster_dominance:.1f}x)")
        else:
            confidence -= 0.05
            reasons.append(f"weak dominance ({cluster_dominance:.1f}x)")
        
        # Criterion 4: Consistency (low std dev is good)
        consistency_ratio = std_dev / thickness if thickness > 0.001 else 1.0
        if consistency_ratio <= 0.03:
            confidence += 0.10
            reasons.append("very consistent")
        elif consistency_ratio <= 0.08:
            confidence += 0.05
            reasons.append("consistent")
        else:
            reasons.append(f"variable (σ/T={consistency_ratio:.1%})")
        
        # Clamp confidence
        confidence = max(0.0, min(1.0, confidence))
        
        # Determine if sheet metal
        is_sheet = (
            uniform_ratio >= self.MIN_UNIFORM_RATIO and
            thickness_to_size <= self.MAX_THICKNESS_TO_SIZE and
            cluster_dominance >= self.MIN_CLUSTER_DOMINANCE
        )
        
        # Build reasoning string
        reasoning = f"T={thickness:.2f}mm: " + ", ".join(reasons)
        
        return is_sheet, confidence, reasoning
    
    def _no_thickness_result(self, reason: str) -> ThicknessAnalysisResult:
        """Return a result indicating no sheet thickness detected."""
        return ThicknessAnalysisResult(
            detected_thickness=None,
            confidence=0.0,
            uniform_ratio=0.0,
            thickness_to_size_ratio=0.0,
            cluster_dominance=0.0,
            clusters=[],
            is_sheet_thickness=False,
            reasoning=f"No sheet thickness: {reason}"
        )


def enhanced_ray_casting_analysis(mesh, bbox_dims: List[float], 
                                  samples: int = 8000) -> ThicknessAnalysisResult:
    """
    Enhanced ray-casting based thickness analysis with proper validation.
    
    This is a bridge function that uses ray-casting data but applies
    the proper sheet metal detection criteria.
    
    Args:
        mesh: Trimesh object
        bbox_dims: Bounding box dimensions
        samples: Number of ray-casting samples
        
    Returns:
        ThicknessAnalysisResult
    """
    from ..extractors.min_wall import min_wall_mesh
    
    try:
        # Perform ray-casting with many samples
        mw = min_wall_mesh(mesh, samples=samples, threshold_mm=max(bbox_dims))
        
        if mw.global_min_mm <= 0:
            detector = AdvancedThicknessDetector(bbox_dims, mesh.area)
            return detector._no_thickness_result("Ray-casting returned no valid distances")
        
        # Get all sampled distances (now available from enhanced min_wall_mesh)
        distances = mw.all_distances if mw.all_distances else [mw.global_min_mm]
        
        # Create detector
        detector = AdvancedThicknessDetector(bbox_dims, mesh.area)
        
        # Analyze distances
        result = detector.analyze_from_mesh_distances(distances)
        
        return result
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        detector = AdvancedThicknessDetector(bbox_dims, mesh.area)
        return detector._no_thickness_result(f"Ray-casting error: {type(e).__name__}: {str(e)[:80]}")
