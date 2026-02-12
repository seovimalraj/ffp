"""
Manufacturing process classification logic.
Determines whether part should be sheet metal, CNC milled, or CNC turned.

ADVANCED THICKNESS-BASED APPROACH:
Uses proper sheet metal thickness detection with:
- Face pairing and distance clustering
- Area-weighted dominance analysis
- Uniform ratio and thinness criteria
- Multiple validation factors

ML-ASSISTED CLASSIFICATION:
When rule-based confidence is below a threshold (< 0.80), the ML classifier
is consulted to provide a second opinion. If the ML model disagrees with the
rule engine and the ML confidence is higher, the ML result can override.
"""
import logging
from typing import Tuple, Optional
from .geometry import GeometricMetrics, calculate_sheet_metal_score, calculate_advanced_metrics
from .bend_detection import AdvancedBendDetector
from .advanced_thickness_detection import ThicknessAnalysisResult
from .ml_classifier import MLProcessClassifier, build_feature_vector, MLClassificationResult

logger = logging.getLogger(__name__)


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
    
    ML-ASSISTED BOOST:
    When rule-based confidence is marginal (< 0.80), the ML classifier provides
    a second opinion. For borderline parts, the ensemble of both systems produces
    more accurate results than either alone.
    """
    
    _ml_classifier: Optional[MLProcessClassifier] = None
    
    def __init__(self, metrics: GeometricMetrics):
        self.metrics = metrics
        self.sheet_metal_score = calculate_sheet_metal_score(metrics)
        self.advanced_metrics = calculate_advanced_metrics(metrics)
        
        # Lazily initialize the ML classifier (singleton)
        if ProcessClassifier._ml_classifier is None:
            try:
                ProcessClassifier._ml_classifier = MLProcessClassifier()
            except Exception as exc:
                logger.warning("Could not initialize ML classifier: %s", exc)
    
    def classify(self, 
                detected_thickness: Optional[float] = None,
                thickness_confidence: float = 0.0,
                triangle_count: int = 0,
                thickness_analysis: Optional[ThicknessAnalysisResult] = None) -> Tuple[str, float, dict]:
        """
        Advanced classification using proper sheet metal thickness detection.
        
        Priority order:
        1. Advanced thickness analysis (uniform ratio, dominance, thinness) → Sheet Metal
        2. Bend detection with thin profile → Sheet Metal  
        3. Dimension-based thin profile → Sheet Metal
        4. Cylindrical geometry → CNC Turning
        5. Default → CNC Milling
        
        Args:
            detected_thickness: Simple thickness from ray-casting (mm) - legacy
            thickness_confidence: Confidence in simple measurement (0-1) - legacy
            triangle_count: Mesh complexity indicator
            thickness_analysis: Advanced thickness analysis result (preferred)
            
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
        
        # Get aspect ratio early for use in checks
        min_dim = self.metrics.min_dim or 10.0
        aspect_ratio = self.metrics.aspect_ratio or 1.0
        
        # === ADVANCED THICKNESS ANALYSIS (PREFERRED) ===
        # Use proper sheet metal detection with clustering and validation
        if thickness_analysis is not None:
            metadata['thickness_analysis'] = {
                'uniform_ratio': thickness_analysis.uniform_ratio,
                'thickness_to_size': thickness_analysis.thickness_to_size_ratio,
                'cluster_dominance': thickness_analysis.cluster_dominance,
                'is_sheet_thickness': thickness_analysis.is_sheet_thickness,
                'reasoning': thickness_analysis.reasoning
            }
            
            # If advanced analysis confirms sheet thickness with strong criteria
            if thickness_analysis.is_sheet_thickness and thickness_analysis.confidence > 0.7:
                # GUARD: Reject sheet metal if part is clearly a solid CNC part
                # A solid part (high vol efficiency) with low aspect ratio is CNC, not sheet metal
                if self.metrics.volume_efficiency > 0.60 and aspect_ratio < 10:
                    metadata['classification_method'] = 'advanced_analysis_cnc_guard'
                    metadata['reasoning'] = (
                        f"ADVANCED ANALYSIS detected sheet thickness but part is solid "
                        f"(vol eff: {self.metrics.volume_efficiency:.2f}, aspect: {aspect_ratio:.1f}:1) - CNC override"
                    )
                    return ('cnc_milling', 0.85, metadata)
                
                # HIGH CONFIDENCE sheet metal detection using proper criteria
                confidence = thickness_analysis.confidence
                
                # Boost confidence if bends detected
                if bend_analysis.is_likely_bent:
                    confidence = min(0.98, confidence + 0.05)
                    reasoning = f"ADVANCED ANALYSIS: {thickness_analysis.reasoning} + {bend_analysis.bend_count} bends"
                else:
                    reasoning = f"ADVANCED ANALYSIS: {thickness_analysis.reasoning}"
                
                metadata['classification_method'] = 'advanced_thickness_analysis'
                metadata['reasoning'] = reasoning
                
                return ('sheet_metal', confidence, {
                    **metadata,
                    'bend_report': bend_detector.get_bend_detection_report(bend_analysis) if bend_analysis.bend_count > 0 else None
                })
            
            # If advanced analysis explicitly rejects sheet metal (low uniform ratio, thick, etc.)
            elif not thickness_analysis.is_sheet_thickness and thickness_analysis.confidence > 0.6:
                # Override to CNC - proper analysis says it's not sheet metal
                metadata['classification_method'] = 'advanced_analysis_cnc_override'
                metadata['reasoning'] = f"ADVANCED ANALYSIS: {thickness_analysis.reasoning}"
                return ('cnc_milling', 0.85, metadata)
        
        # === LEGACY THICKNESS DETECTION (FALLBACK) ===
        # Use simple ray-casting thickness when advanced analysis not available
        
        has_valid_thickness = (detected_thickness is not None and 
                              detected_thickness > 0 and
                              thickness_confidence > 0.3)  # Lower threshold - trust detection
        
        is_sheet_metal_thickness = (has_valid_thickness and
                                   SHEET_METAL_MIN_THICKNESS <= detected_thickness <= SHEET_METAL_MAX_THICKNESS)
        
        # CRITICAL: Check volume efficiency AND aspect ratio to distinguish CNC from sheet metal
        # CNC parts: Solid AND chunky (high vol eff + low aspect ratio)
        # Sheet metal: Can be flat (high vol eff + high aspect ratio) OR bent (low vol eff)
        is_solid_part = self.metrics.volume_efficiency > 0.60
        is_moderately_solid = self.metrics.volume_efficiency > 0.50
        is_chunky = aspect_ratio < 10  # Low aspect ratio = box-like, not sheet-like
        
        if is_sheet_metal_thickness:
            # Thin thickness detected, but need to verify it's actually sheet metal
            
            # SPECIAL CASE: High aspect ratio + thin = flat sheet (even with high vol eff)
            if aspect_ratio >= 15:
                # Very flat and thin - definitely sheet metal
                confidence = 0.90 + (thickness_confidence * 0.08)
                reasoning = f"THICKNESS-DETECTED: {detected_thickness:.2f}mm with high aspect ratio {aspect_ratio:.1f}:1 - flat sheet metal"
                metadata['classification_method'] = 'thickness_flat_sheet'
                metadata['reasoning'] = reasoning
                return ('sheet_metal', confidence, metadata)
            
            # REJECT if part is solid AND chunky - likely a CNC machined part with thin features
            if is_solid_part and is_chunky:
                # High volume efficiency + low aspect ratio = chunky solid part = CNC machining
                metadata['classification_method'] = 'cnc_override'
                metadata['reasoning'] = f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but chunky solid part (vol eff: {self.metrics.volume_efficiency:.2f}, aspect: {aspect_ratio:.1f}:1) indicates CNC"
                return ('cnc_milling', 0.85, metadata)
            
            # CAUTION if moderately solid and not very flat - reduce confidence
            if is_moderately_solid and aspect_ratio < 15:
                if bend_analysis.is_likely_bent and self.metrics.volume_efficiency < 0.55:
                    # Has bends, genuinely hollow - likely sheet metal with some solid features
                    confidence = 0.75
                    reasoning = f"THICKNESS-DETECTED: {detected_thickness:.2f}mm with {bend_analysis.bend_count} bends, moderate solidity"
                else:
                    # No bends or moderately solid - ambiguous, default to CNC
                    metadata['classification_method'] = 'cnc_fallback'
                    metadata['reasoning'] = f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but no bends and moderate volume efficiency {self.metrics.volume_efficiency:.2f} suggests CNC"
                    return ('cnc_milling', 0.70, metadata)
            else:
                # LOW volume efficiency OR high aspect ratio - genuine sheet metal part
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
        # BUT must also check volume efficiency
        if min_dim < 6 and aspect_ratio > 8:
            # Additional check: volume efficiency
            if self.metrics.volume_efficiency > 0.60:
                # Solid part despite thin dimension - likely CNC with thin features
                confidence = 0.75
                reasoning = f"DIMENSION-BASED: Thin profile but solid part (vol eff: {self.metrics.volume_efficiency:.2f}) - likely CNC"
                return ('cnc_milling', confidence, {
                    **metadata,
                    'classification_method': 'dimension_override_cnc',
                    'reasoning': reasoning
                })
            
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
        
        # CRITICAL: Check volume efficiency before classifying as sheet metal
        # Even with good score, high volume efficiency indicates CNC machining
        if enhanced_score > 65:
            if self.metrics.volume_efficiency > 0.60:
                # Solid part - override to CNC despite high sheet metal score
                return ('cnc_milling', 0.80, {
                    **metadata,
                    'classification_method': 'cnc_volume_override',
                    'reasoning': f'High sheet metal score ({enhanced_score:.0f}) but volume efficiency ({self.metrics.volume_efficiency:.2f}) indicates solid CNC part'
                })
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
        # Use CNC likelihood from advanced metrics
        cnc_likelihood = self.advanced_metrics.get('cnc_likelihood', 0.5)
        
        # High CNC likelihood or low sheet metal score = CNC milling
        if cnc_likelihood > 0.6 or enhanced_score < 30:
            cnc_confidence = 0.90 if cnc_likelihood > 0.7 else 0.85
            reasoning = f'Solid geometry (vol eff: {self.metrics.volume_efficiency:.2f}) indicates CNC machining'
        else:
            cnc_confidence = 0.70
            reasoning = 'Solid geometry or varying wall thickness indicates CNC machining'
        
        rule_process = 'cnc_milling'
        rule_confidence = cnc_confidence
        rule_metadata = {
            **metadata,
            'classification_method': 'default_cnc',
            'reasoning': reasoning,
            'cnc_likelihood': cnc_likelihood
        }
        
        # === ML-ASSISTED CLASSIFICATION (ensemble layer) ===
        ml_result = self._consult_ml(
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
            bend_analysis=bend_analysis,
            triangle_count=triangle_count,
        )
        if ml_result is not None:
            rule_metadata['ml_classification'] = ml_result.to_dict()
            
            # ML override: if rule-based confidence is weak and ML disagrees with higher confidence
            if rule_confidence < 0.80 and ml_result.confidence > rule_confidence + 0.05:
                if ml_result.predicted_process != rule_process and not ml_result.is_borderline:
                    logger.info(
                        "ML override: %s (%.2f) → %s (%.2f)",
                        rule_process, rule_confidence,
                        ml_result.predicted_process, ml_result.confidence,
                    )
                    return (ml_result.predicted_process, ml_result.confidence, {
                        **rule_metadata,
                        'classification_method': 'ml_override',
                        'reasoning': (
                            f'ML classifier overrides rule engine: '
                            f'{ml_result.predicted_process} ({ml_result.confidence:.0%}) '
                            f'vs rule {rule_process} ({rule_confidence:.0%})'
                        ),
                    })
            
            # Confidence boost: if both agree, boost confidence
            if ml_result.predicted_process == rule_process:
                boosted = min(0.98, rule_confidence + ml_result.confidence * 0.10)
                if boosted > rule_confidence:
                    rule_confidence = boosted
                    rule_metadata['reasoning'] += f' (ML-confirmed: {ml_result.confidence:.0%})'
                    rule_metadata['classification_method'] = 'rule_ml_ensemble'
        
        return (rule_process, rule_confidence, rule_metadata)

    # ------------------------------------------------------------------
    # ML consultation helper
    # ------------------------------------------------------------------
    def _consult_ml(
        self,
        detected_thickness: Optional[float],
        thickness_confidence: float,
        bend_analysis,
        triangle_count: int,
        hole_count: int = 0,
        pocket_count: int = 0,
        thread_count: int = 0,
        undercut_count: int = 0,
        fillet_count: int = 0,
        slot_count: int = 0,
    ) -> Optional[MLClassificationResult]:
        """Build feature vector and ask the ML classifier."""
        if ProcessClassifier._ml_classifier is None:
            return None
        if not ProcessClassifier._ml_classifier.is_ready:
            return None
        try:
            fv = build_feature_vector(
                bbox_dims=[self.metrics.min_dim, self.metrics.mid_dim, self.metrics.max_dim],
                volume_mm3=self.metrics.volume_mm3,
                surface_area_mm2=self.metrics.surface_area_mm2,
                detected_thickness=detected_thickness,
                thickness_confidence=thickness_confidence,
                bend_count=bend_analysis.bend_count,
                bend_confidence=bend_analysis.confidence,
                bend_complexity=bend_analysis.complexity_score,
                sheet_metal_score=self.sheet_metal_score,
                hole_count=hole_count,
                pocket_count=pocket_count,
                thread_count=thread_count,
                undercut_count=undercut_count,
                fillet_count=fillet_count,
                slot_count=slot_count,
                triangle_count=triangle_count,
                advanced_metrics=self.advanced_metrics,
            )
            return ProcessClassifier._ml_classifier.predict(fv)
        except Exception as exc:
            logger.warning("ML consultation failed: %s", exc)
            return None
