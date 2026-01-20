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
        bend_indicators = []
        bend_count = 0
        bend_angles = []
        bend_regions = []
        
        # === METHOD 1: THICKNESS DISCREPANCY ===
        # Most reliable indicator for bent parts
        has_thickness_discrepancy = False
        
        if detected_thickness and detected_thickness > 0:
            thickness_ratio = detected_thickness / self.min_dim if self.min_dim > 0 else 1.0
            
            # Actual thickness significantly smaller than bbox = bent part
            if thickness_ratio < 0.5 and thickness_confidence > 0.6:
                has_thickness_discrepancy = True
                bend_indicators.append({
                    'method': 'thickness_discrepancy',
                    'confidence': thickness_confidence,
                    'ratio': thickness_ratio,
                    'evidence': f"Wall {detected_thickness:.1f}mm << bbox {self.min_dim:.1f}mm"
                })
                
                # Estimate bend count from discrepancy severity
                # Smaller ratio = more bending
                if thickness_ratio < 0.2:
                    bend_count = max(3, int(10 * (1 - thickness_ratio)))  # Complex bends
                elif thickness_ratio < 0.35:
                    bend_count = 2  # Multiple bends (U-bracket)
                else:
                    bend_count = 1  # Single bend (L-bracket)
        
        # === METHOD 2: VOLUME HOLLOWNESS ===
        # Low volume efficiency indicates bent/hollow structure
        is_hollow = self.volume_efficiency < 0.4
        
        if is_hollow:
            hollowness = 1.0 - self.volume_efficiency
            bend_indicators.append({
                'method': 'volume_hollowness',
                'confidence': 0.7,
                'hollowness': hollowness,
                'evidence': f"Volume efficiency {self.volume_efficiency:.1%} (hollow structure)"
            })
            
            # Extremely hollow = complex bends
            if self.volume_efficiency < 0.25:
                bend_count = max(bend_count, 3)
            elif self.volume_efficiency < 0.35:
                bend_count = max(bend_count, 2)
        
        # === METHOD 3: SURFACE AREA EXCESS ===
        # Bent parts have higher surface area than flat equivalents
        flat_surface_estimate = 2 * (self.mid_dim * self.max_dim + 
                                     self.min_dim * self.max_dim + 
                                     self.min_dim * self.mid_dim)
        
        if flat_surface_estimate > 0:
            surface_excess = (self.surface_area_mm2 - flat_surface_estimate) / flat_surface_estimate
            
            if surface_excess > 0.3:  # 30% more surface than flat box
                bend_indicators.append({
                    'method': 'surface_excess',
                    'confidence': 0.6,
                    'excess': surface_excess,
                    'evidence': f"Surface area {surface_excess:.0%} higher than flat equivalent"
                })
                bend_count = max(bend_count, 1)
        
        # === METHOD 4: DIMENSION RATIO ANALYSIS ===
        # Bent parts have characteristic dimension relationships
        aspect_ratio = self.max_dim / max(self.min_dim, 0.1)
        mid_to_max_ratio = self.mid_dim / self.max_dim if self.max_dim > 0 else 0
        
        # U-bracket pattern: high aspect ratio + medium mid dimension
        if aspect_ratio > 15 and 0.3 < mid_to_max_ratio < 0.7 and is_hollow:
            bend_indicators.append({
                'method': 'u_bracket_pattern',
                'confidence': 0.75,
                'pattern': 'U-shape',
                'evidence': f"U-bracket geometry detected (AR: {aspect_ratio:.1f})"
            })
            bend_count = max(bend_count, 2)
            bend_angles.extend([90, 90])  # Two 90° bends
            bend_regions.append({
                'type': 'U-bracket',
                'bend_line_1': 'along_length',
                'bend_line_2': 'along_length_opposite'
            })
        
        # L-bracket pattern: high aspect ratio + thin + one dominant face
        elif aspect_ratio > 10 and mid_to_max_ratio < 0.4 and self.min_dim < 6:
            bend_indicators.append({
                'method': 'l_bracket_pattern',
                'confidence': 0.7,
                'pattern': 'L-shape',
                'evidence': "L-bracket geometry detected"
            })
            bend_count = max(bend_count, 1)
            bend_angles.append(90)
            bend_regions.append({
                'type': 'L-bracket',
                'bend_line': 'along_length'
            })
        
        # === METHOD 5: TRIANGLE COUNT COMPLEXITY ===
        # More triangles in thin part = more bends/curves
        if triangle_count > 0 and self.min_dim < 6:
            triangles_per_area = triangle_count / max(self.surface_area_mm2, 1)
            
            if triangles_per_area > 0.5:  # High triangle density
                bend_indicators.append({
                    'method': 'mesh_complexity',
                    'confidence': 0.5,
                    'density': triangles_per_area,
                    'evidence': f"High mesh complexity: {triangles_per_area:.2f} triangles/mm²"
                })
                
                # Estimate bends from triangle count
                estimated_bends = min(5, int(triangle_count / 3000))
                bend_count = max(bend_count, estimated_bends)
        
        # === METHOD 6: FLANGE DETECTION ===
        # Flanges are small perpendicular faces at edges
        has_flanges = False
        if self.min_dim < 6 and is_hollow:
            # Thin + hollow often has flanges
            has_flanges = True
            bend_indicators.append({
                'method': 'flange_detection',
                'confidence': 0.6,
                'evidence': "Thin walls with hollow structure suggest flanges"
            })
        
        # === METHOD 7: RELIEF CUT DETECTION ===
        # Relief cuts appear as notches at bend corners
        has_relief_cuts = False
        if bend_count >= 2 and self.volume_efficiency < 0.35:
            has_relief_cuts = True
            bend_indicators.append({
                'method': 'relief_cut_inference',
                'confidence': 0.5,
                'evidence': "Multiple bends suggest relief cuts at corners"
            })
        
        # === CALCULATE OVERALL CONFIDENCE ===
        if len(bend_indicators) == 0:
            overall_confidence = 0.0
            is_likely_bent = False
        else:
            # Weighted average of indicator confidences
            total_confidence = sum(ind['confidence'] for ind in bend_indicators)
            overall_confidence = total_confidence / len(bend_indicators)
            
            # High confidence if multiple strong indicators
            if has_thickness_discrepancy and is_hollow:
                overall_confidence = min(0.95, overall_confidence + 0.2)
            
            is_likely_bent = overall_confidence > 0.6 and bend_count > 0
        
        # === COMPLEXITY SCORE ===
        complexity_score = min(100, 
                              bend_count * 15 + 
                              (10 if has_flanges else 0) +
                              (5 if has_relief_cuts else 0) +
                              (1 - self.volume_efficiency) * 30)
        
        # Default bend angles if not detected
        if bend_count > 0 and not bend_angles:
            bend_angles = [90] * min(bend_count, 5)  # Default to 90° bends
        
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
