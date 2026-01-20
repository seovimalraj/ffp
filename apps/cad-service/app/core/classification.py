"""
Manufacturing process classification logic.
Determines whether part should be sheet metal, CNC milled, or CNC turned.
"""
from typing import Tuple, Optional
from .geometry import GeometricMetrics, calculate_sheet_metal_score, calculate_advanced_metrics
from .bend_detection import AdvancedBendDetector


class ProcessClassifier:
    """
    Enterprise-level manufacturing process classification.
    
    Uses multi-criteria analysis:
    - Geometric metrics (thickness, aspect ratio, volume efficiency)
    - Ray-casting thickness detection
    - Advanced bend detection
    - Rotational symmetry analysis
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
        Classify part into manufacturing process.
        
        Args:
            detected_thickness: Actual wall thickness from ray-casting (mm)
            thickness_confidence: Confidence in thickness measurement (0-1)
            triangle_count: Mesh complexity indicator
            
        Returns:
            Tuple of (process_type, confidence, metadata)
            - process_type: 'sheet_metal', 'cnc_milling', or 'cnc_turning'
            - confidence: 0.0-1.0
            - metadata: Dict with reasoning and details
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
        
        # === EFFECTIVE THICKNESS DETERMINATION ===
        # Use ray-cast thickness if reliable, otherwise fall back to bbox
        has_reliable_thickness = (detected_thickness and 
                                 detected_thickness > 0 and 
                                 thickness_confidence > 0.6)
        
        if has_reliable_thickness:
            effective_thickness = detected_thickness
            thickness_source = "ray_casting"
        else:
            effective_thickness = self.metrics.min_dim
            thickness_source = "bbox_approximation"
        
        metadata['effective_thickness'] = effective_thickness
        metadata['thickness_source'] = thickness_source
        
        # === ENHANCED SHEET METAL SCORE ===
        enhanced_score = self.sheet_metal_score
        
        # Boost score for advanced metrics
        enhanced_score += self.advanced_metrics['wall_thickness_consistency'] * 20
        enhanced_score += self.advanced_metrics['planarity_score'] * 18
        
        # Penalty for solid parts (high volume distribution)
        if self.advanced_metrics['volume_distribution'] > 0.75:
            enhanced_score -= 20
        
        # CRITICAL: Boost score if bent sheet metal detected
        if bend_analysis.is_likely_bent:
            boost = min(25, bend_analysis.confidence * 30)
            enhanced_score += boost
            metadata['bent_boost'] = boost
        
        enhanced_score = max(0.0, min(100.0, enhanced_score))
        metadata['enhanced_sheet_metal_score'] = enhanced_score
        
        # === CNC TURNING DETECTION ===
        xy_similarity = abs(self.metrics.min_dim - self.metrics.mid_dim) / max(self.metrics.min_dim, self.metrics.mid_dim)
        is_cylindrical = (xy_similarity < 0.15 and 
                         self.metrics.aspect_ratio > 1.5 and 
                         self.metrics.volume_efficiency > 0.6)
        
        if is_cylindrical:
            return ('cnc_turning', 0.85, {
                **metadata,
                'reasoning': 'Cylindrical geometry with rotational symmetry'
            })
        
        # === SHEET METAL VS CNC MILLING ===
        
        # Very high confidence: reliable thickness in sheet metal range
        if has_reliable_thickness and 0.5 <= effective_thickness <= 6.0:
            if bend_analysis.is_likely_bent:
                # Bent sheet metal with detected thin walls
                return ('sheet_metal', 0.95, {
                    **metadata,
                    'reasoning': f'Bent sheet metal: {effective_thickness:.2f}mm walls detected with ray-casting',
                    'bend_report': bend_detector.get_bend_detection_report(bend_analysis)
                })
            elif enhanced_score > 70:
                # Flat or simple sheet metal
                return ('sheet_metal', 0.90, {
                    **metadata,
                    'reasoning': f'Sheet metal: {effective_thickness:.2f}mm thickness detected'
                })
        
        # High confidence: geometric analysis
        if enhanced_score > 75:
            confidence = 0.90 if bend_analysis.is_likely_bent else 0.85
            reasoning = 'Bent sheet metal with multiple indicators' if bend_analysis.is_likely_bent else \
                       'Sheet metal characteristics detected'
            return ('sheet_metal', confidence, {
                **metadata,
                'reasoning': reasoning
            })
        
        # Medium-high confidence: thin walls with hollowness
        if enhanced_score > 60 and self.metrics.volume_efficiency < 0.5:
            return ('sheet_metal', 0.80, {
                **metadata,
                'reasoning': 'Thin-walled hollow structure typical of sheet metal'
            })
        
        # Medium confidence: modest score but likely bent
        if enhanced_score > 50 and bend_analysis.is_likely_bent:
            return ('sheet_metal', 0.75, {
                **metadata,
                'reasoning': 'Bend patterns detected in thin-walled part',
                'bend_report': bend_detector.get_bend_detection_report(bend_analysis)
            })
        
        # Low-medium confidence: borderline cases
        if enhanced_score > 40:
            return ('sheet_metal', 0.65, {
                **metadata,
                'reasoning': 'Some sheet metal characteristics but uncertain'
            })
        
        # Default to CNC milling
        cnc_confidence = 0.80 if enhanced_score < 30 else 0.70
        return ('cnc_milling', cnc_confidence, {
            **metadata,
            'reasoning': 'Solid part or varying thickness indicates machining from stock'
        })
