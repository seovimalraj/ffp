"""
Advanced bend detection for sheet metal parts.
Detects bends, flanges, and complex formed features.
"""
from typing import List, Dict, Optional, Tuple
import math
from dataclasses import dataclass


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
            has_thickness_discrepancy, bend_indicators, bend_count
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
        has_flanges = self._check_flanges(is_hollow, bend_indicators)
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
        indicators: List[Dict], bend_count: int
    ) -> int:
        """METHOD 1B: Dimension ratio detection when thickness detection fails."""
        if has_thickness_discrepancy or self.min_dim >= 6 or self.aspect_ratio <= 8:
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
        """METHOD 4: Dimension ratio analysis (U-bracket, L-bracket patterns)."""
        aspect_ratio = self.max_dim / max(self.min_dim, 0.1)
        mid_to_max_ratio = self.mid_dim / self.max_dim if self.max_dim > 0 else 0
        
        if aspect_ratio > 15 and 0.3 < mid_to_max_ratio < 0.7 and is_hollow:
            indicators.append({
                'method': 'u_bracket_pattern',
                'confidence': 0.75,
                'pattern': 'U-shape',
                'evidence': f"U-bracket geometry detected (AR: {aspect_ratio:.1f})"
            })
            bend_count = max(bend_count, 2)
            bend_angles.extend([90.0, 90.0])
            bend_regions.append({
                'type': 'U-bracket',
                'bend_line_1': 'along_length',
                'bend_line_2': 'along_length_opposite'
            })
        elif aspect_ratio > 10 and mid_to_max_ratio < 0.4 and self.min_dim < 6:
            indicators.append({
                'method': 'l_bracket_pattern',
                'confidence': 0.7,
                'pattern': 'L-shape',
                'evidence': "L-bracket geometry detected"
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

    def _check_flanges(self, is_hollow: bool, indicators: List[Dict]) -> bool:
        """METHOD 6: Flange detection."""
        if self.min_dim < 6 and is_hollow:
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
