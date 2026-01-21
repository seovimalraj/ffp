"""
Manufacturing process classification logic.
Determines whether part should be sheet metal, CNC milled, or CNC turned.

THICKNESS-FIRST APPROACH:
If we can detect actual wall thickness from CAD geometry, that is the MOST ACCURATE
indicator for sheet metal classification. Sheet metal has consistent thin walls (0.5-8mm).
"""
from typing import Tuple, Optional
from .geometry import GeometricMetrics, calculate_sheet_metal_score, calculate_advanced_metrics
from .bend_detection import AdvancedBendDetector


# Sheet metal thickness range (standard gauges)
SHEET_METAL_MIN_THICKNESS = 0.4  # mm (approx 26 gauge)
SHEET_METAL_MAX_THICKNESS = 8.0  # mm (approx 3/16" or thicker plate)


class ProcessClassifier:
    """
    Enterprise-level manufacturing process classification.
    
    THICKNESS-FIRST CLASSIFICATION:
    1. If ray-casting detects uniform thin walls → Sheet Metal (highest confidence)
    2. If bend analysis detects bends with thin profile → Sheet Metal
    3. If dimensions show thin profile with high aspect ratio → Sheet Metal
    4. Otherwise → CNC Milling/Turning based on geometry
    """
    
    def __init__(self, metrics: GeometricMetrics):
        """
        Initialize classifier with geometric metrics.
        
        Args:
            metrics: GeometricMetrics container with all basic measurements
        """
        self.metrics = metrics
        self.sheet_metal_score = calculate_sheet_metal_score(metrics)
        self.advanced_metrics = calculate_advanced_metrics(metrics)
    
    def classify(self, 
                detected_thickness: Optional[float] = None,
                thickness_confidence: float = 0.0,
                triangle_count: int = 0) -> Tuple[str, float, dict]:
        """
        THICKNESS-FIRST classification of manufacturing process.
        
        Priority order:
        1. Detected wall thickness in sheet metal range → Sheet Metal
        2. Bend detection with thin profile → Sheet Metal  
        3. Dimension-based thin profile → Sheet Metal
        4. Cylindrical geometry → CNC Turning
        5. Default → CNC Milling
        
        Args:
            detected_thickness: Actual wall thickness from ray-casting (mm)
            thickness_confidence: Confidence in thickness measurement (0-1)
            triangle_count: Mesh complexity indicator
            
        Returns:
            Tuple of (process_type, confidence, metadata)
        """
        metadata = {
            'sheet_metal_score': self.sheet_metal_score,
            'detected_thickness': detected_thickness,
            'thickness_confidence': thickness_confidence,
            'bbox_minimum': self.metrics.min_dim,
            'volume_efficiency': self.metrics.volume_efficiency
        }
        
        # === ADVANCED BEND DETECTION ===
        bend_detector = AdvancedBendDetector(
            [self.metrics.min_dim, self.metrics.mid_dim, self.metrics.max_dim],
            self.metrics.volume_mm3,
            self.metrics.surface_area_mm2
        )
        
        bend_analysis = bend_detector.analyze_bends(
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
            triangle_count=triangle_count
        )
        
        metadata['bend_analysis'] = {
            'is_likely_bent': bend_analysis.is_likely_bent,
            'bend_count': bend_analysis.bend_count,
            'confidence': bend_analysis.confidence,
            'complexity': bend_analysis.complexity_score
        }
        
        # === THICKNESS-FIRST CLASSIFICATION ===
        # This is the MOST ACCURATE indicator when we have it
        
        has_valid_thickness = (detected_thickness is not None and 
                              detected_thickness > 0 and
                              thickness_confidence > 0.3)  # Lower threshold - trust detection
        
        is_sheet_metal_thickness = (has_valid_thickness and
                                   SHEET_METAL_MIN_THICKNESS <= detected_thickness <= SHEET_METAL_MAX_THICKNESS)
        
        if is_sheet_metal_thickness:
            # HIGH CONFIDENCE: Thickness is in sheet metal range
            # Scale confidence based on how confident we are in the measurement
            base_confidence = 0.85 + (thickness_confidence * 0.10)  # 0.85 to 0.95
            
            if bend_analysis.is_likely_bent:
                # Even higher confidence with bends
                confidence = min(0.98, base_confidence + 0.05)
                reasoning = f"THICKNESS-DETECTED: {detected_thickness:.2f}mm wall thickness with {bend_analysis.bend_count} bends"
            else:
                confidence = base_confidence
                reasoning = f"THICKNESS-DETECTED: {detected_thickness:.2f}mm uniform wall thickness (sheet metal gauge)"
            
            metadata['classification_method'] = 'thickness_detection'
            metadata['reasoning'] = reasoning
            
            return ('sheet_metal', confidence, {
                **metadata,
                'reasoning': reasoning,
                'bend_report': bend_detector.get_bend_detection_report(bend_analysis) if bend_analysis.bend_count > 0 else None
            })
        
        # === SECONDARY: BEND-BASED DETECTION ===
        # If thickness detection failed but bends are detected with thin dimensions
        min_dim = self.metrics.min_dim or 10.0
        aspect_ratio = self.metrics.aspect_ratio or 1.0
        
        if bend_analysis.is_likely_bent and min_dim < SHEET_METAL_MAX_THICKNESS:
            confidence = min(0.90, 0.70 + bend_analysis.confidence * 0.20)
            reasoning = f"BEND-DETECTED: {bend_analysis.bend_count} bends with {min_dim:.2f}mm profile"
            
            return ('sheet_metal', confidence, {
                **metadata,
                'classification_method': 'bend_detection',
                'reasoning': reasoning,
                'bend_report': bend_detector.get_bend_detection_report(bend_analysis)
            })
        
        # === TERTIARY: DIMENSION-BASED DETECTION ===
        # Thin min dimension with high aspect ratio = likely sheet metal
        if min_dim < 6 and aspect_ratio > 8:
            confidence = 0.80 if aspect_ratio > 15 else 0.70
            reasoning = f"DIMENSION-BASED: {min_dim:.2f}mm thin profile with {aspect_ratio:.1f}:1 aspect ratio"
            
            return ('sheet_metal', confidence, {
                **metadata,
                'classification_method': 'dimension_analysis',
                'reasoning': reasoning
            })
        
        # === CNC TURNING DETECTION ===
        # Check for cylindrical geometry before falling back to milling
        min_dim_val = self.metrics.min_dim or 1.0
        mid_dim_val = self.metrics.mid_dim or 1.0
        xy_similarity = abs(min_dim_val - mid_dim_val) / max(min_dim_val, mid_dim_val)
        is_cylindrical = (xy_similarity < 0.15 and 
                         aspect_ratio > 1.5 and 
                         self.metrics.volume_efficiency > 0.6)
        
        if is_cylindrical:
            return ('cnc_turning', 0.85, {
                **metadata,
                'classification_method': 'geometry_cylindrical',
                'reasoning': 'Cylindrical geometry with rotational symmetry'
            })
        
        # === ENHANCED SCORE CHECK ===
        # Use geometric scoring as final fallback
        enhanced_score = self.sheet_metal_score
        enhanced_score += self.advanced_metrics['wall_thickness_consistency'] * 15
        enhanced_score += self.advanced_metrics['planarity_score'] * 15
        
        # Penalty for solid parts
        if self.advanced_metrics['volume_distribution'] > 0.75:
            enhanced_score -= 25
        
        # Boost for any detected bends
        if bend_analysis.bend_count > 0:
            enhanced_score += min(20, bend_analysis.bend_count * 8)
        
        enhanced_score = max(0.0, min(100.0, enhanced_score))
        metadata['enhanced_sheet_metal_score'] = enhanced_score
        
        if enhanced_score > 65:
            return ('sheet_metal', 0.70, {
                **metadata,
                'classification_method': 'geometric_scoring',
                'reasoning': f'Geometric analysis suggests sheet metal (score: {enhanced_score:.0f}/100)'
            })
        
        if enhanced_score > 45 and self.metrics.volume_efficiency < 0.4:
            return ('sheet_metal', 0.60, {
                **metadata,
                'classification_method': 'geometric_scoring',
                'reasoning': 'Hollow thin-walled structure suggests sheet metal'
            })
        
        # === DEFAULT: CNC MILLING ===
        cnc_confidence = 0.85 if enhanced_score < 30 else 0.70
        return ('cnc_milling', cnc_confidence, {
            **metadata,
            'classification_method': 'default_cnc',
            'reasoning': 'Solid geometry or varying wall thickness indicates CNC machining'
        })
