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
from typing import Any, Dict, Tuple, Optional
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
                thickness_analysis: Optional[ThicknessAnalysisResult] = None,
                hole_count: int = 0,
                pocket_count: int = 0,
                thread_count: int = 0,
                undercut_count: int = 0,
                fillet_count: int = 0,
                slot_count: int = 0) -> Tuple[str, float, Dict[str, Any]]:
        """
        Advanced classification using proper sheet metal thickness detection.

        Returns:
            Tuple of (process_type, confidence, metadata)
        """
        metadata: Dict[str, Any] = {
            'sheet_metal_score': self.sheet_metal_score,
            'detected_thickness': detected_thickness,
            'thickness_confidence': thickness_confidence,
            'bbox_minimum': self.metrics.min_dim,
            'volume_efficiency': self.metrics.volume_efficiency,
        }

        bend_detector, bend_analysis = self._run_bend_detection(
            detected_thickness, thickness_confidence, triangle_count,
        )
        metadata['bend_analysis'] = {
            'is_likely_bent': bend_analysis.is_likely_bent,
            'bend_count': bend_analysis.bend_count,
            'confidence': bend_analysis.confidence,
            'complexity': bend_analysis.complexity_score,
        }

        aspect_ratio = self.metrics.aspect_ratio or 1.0
        min_dim = self.metrics.min_dim or 10.0

        # 1) Advanced thickness analysis (preferred)
        result = self._try_advanced_thickness(
            thickness_analysis, bend_detector, bend_analysis,
            aspect_ratio, metadata,
        )
        if result is not None:
            return result

        # 2) Legacy thickness detection (fallback)
        result = self._try_legacy_thickness(
            detected_thickness, thickness_confidence,
            bend_detector, bend_analysis, aspect_ratio, metadata,
        )
        if result is not None:
            return result

        # 3) Bend-based detection
        result = self._try_bend_classification(
            bend_detector, bend_analysis, min_dim, metadata,
        )
        if result is not None:
            return result

        # 4) Dimension-based detection
        result = self._try_dimension_classification(
            min_dim, aspect_ratio, metadata,
        )
        if result is not None:
            return result

        # 5) CNC turning detection
        result = self._try_turning_classification(aspect_ratio, metadata)
        if result is not None:
            return result

        # 6) Enhanced score / default CNC + ML ensemble
        return self._classify_by_score_and_ml(
            bend_analysis, metadata,
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
            triangle_count=triangle_count,
            hole_count=hole_count,
            pocket_count=pocket_count,
            thread_count=thread_count,
            undercut_count=undercut_count,
            fillet_count=fillet_count,
            slot_count=slot_count,
        )

    # ------------------------------------------------------------------
    # Classification helpers (each handles one tier)
    # ------------------------------------------------------------------

    def _run_bend_detection(self, detected_thickness, thickness_confidence, triangle_count):
        """Run advanced bend detection and return (detector, analysis)."""
        bend_detector = AdvancedBendDetector(
            [self.metrics.min_dim, self.metrics.mid_dim, self.metrics.max_dim],
            self.metrics.volume_mm3,
            self.metrics.surface_area_mm2,
        )
        bend_analysis = bend_detector.analyze_bends(
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
            triangle_count=triangle_count,
        )
        return bend_detector, bend_analysis

    def _try_advanced_thickness(self, thickness_analysis, bend_detector,
                                bend_analysis, aspect_ratio, metadata):
        """Classify using advanced thickness analysis. Returns result or None."""
        if thickness_analysis is None:
            return None

        metadata['thickness_analysis'] = {
            'uniform_ratio': thickness_analysis.uniform_ratio,
            'thickness_to_size': thickness_analysis.thickness_to_size_ratio,
            'cluster_dominance': thickness_analysis.cluster_dominance,
            'is_sheet_thickness': thickness_analysis.is_sheet_thickness,
            'reasoning': thickness_analysis.reasoning,
        }

        if thickness_analysis.is_sheet_thickness and thickness_analysis.confidence > 0.7:
            return self._advanced_sheet_or_cnc_guard(
                thickness_analysis, bend_detector, bend_analysis,
                aspect_ratio, metadata,
            )

        if not thickness_analysis.is_sheet_thickness and thickness_analysis.confidence > 0.6:
            metadata['classification_method'] = 'advanced_analysis_cnc_override'
            metadata['reasoning'] = f"ADVANCED ANALYSIS: {thickness_analysis.reasoning}"
            return ('cnc_milling', 0.85, metadata)

        return None

    def _advanced_sheet_or_cnc_guard(self, thickness_analysis, bend_detector,
                                     bend_analysis, aspect_ratio, metadata):
        """Handle confirmed sheet-thickness with CNC guard."""
        # Only override to CNC if truly solid AND no bends detected
        # Bent sheet metal enclosures have high volume efficiency in bbox
        is_truly_solid = (self.metrics.volume_efficiency > 0.75
                          and aspect_ratio < 5
                          and not bend_analysis.is_likely_bent)
        if is_truly_solid:
            metadata['classification_method'] = 'advanced_analysis_cnc_guard'
            metadata['reasoning'] = (
                f"ADVANCED ANALYSIS detected sheet thickness but part is solid "
                f"(vol eff: {self.metrics.volume_efficiency:.2f}, "
                f"aspect: {aspect_ratio:.1f}:1) - CNC override"
            )
            return ('cnc_milling', 0.85, metadata)

        confidence = thickness_analysis.confidence
        if bend_analysis.is_likely_bent:
            confidence = min(0.98, confidence + 0.05)
            reasoning = (f"ADVANCED ANALYSIS: {thickness_analysis.reasoning} "
                         f"+ {bend_analysis.bend_count} bends")
        else:
            reasoning = f"ADVANCED ANALYSIS: {thickness_analysis.reasoning}"

        metadata['classification_method'] = 'advanced_thickness_analysis'
        metadata['reasoning'] = reasoning
        bend_report = (bend_detector.get_bend_detection_report(bend_analysis)
                       if bend_analysis.bend_count > 0 else None)
        return ('sheet_metal', confidence, {**metadata, 'bend_report': bend_report})

    def _try_legacy_thickness(self, detected_thickness, thickness_confidence,
                              bend_detector, bend_analysis, aspect_ratio,
                              metadata):
        """Classify using legacy ray-cast thickness. Returns result or None."""
        has_valid = (detected_thickness is not None
                     and detected_thickness > 0
                     and thickness_confidence > 0.3)
        if not has_valid:
            return None

        in_range = (SHEET_METAL_MIN_THICKNESS <= detected_thickness
                    <= SHEET_METAL_MAX_THICKNESS)
        if not in_range:
            return None

        return self._resolve_legacy_thickness(
            detected_thickness, thickness_confidence,
            bend_detector, bend_analysis, aspect_ratio, metadata,
        )

    def _resolve_legacy_thickness(self, detected_thickness, thickness_confidence,
                                  bend_detector, bend_analysis, aspect_ratio,
                                  metadata):
        """Decide sheet-metal vs CNC for valid sheet-range thickness."""
        is_solid = self.metrics.volume_efficiency > 0.75
        is_chunky = aspect_ratio < 5

        # Flat sheet
        if aspect_ratio >= 15:
            confidence = 0.90 + (thickness_confidence * 0.08)
            metadata['classification_method'] = 'thickness_flat_sheet'
            metadata['reasoning'] = (
                f"THICKNESS-DETECTED: {detected_thickness:.2f}mm "
                f"with high aspect ratio {aspect_ratio:.1f}:1 - flat sheet metal"
            )
            return ('sheet_metal', confidence, metadata)

        # Solid + chunky → CNC (only if NO bends detected)
        if is_solid and is_chunky and not bend_analysis.is_likely_bent:
            metadata['classification_method'] = 'cnc_override'
            metadata['reasoning'] = (
                f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but chunky solid "
                f"(vol eff: {self.metrics.volume_efficiency:.2f}, "
                f"aspect: {aspect_ratio:.1f}:1) indicates CNC"
            )
            return ('cnc_milling', 0.85, metadata)

        # Moderately solid, not flat — bent parts override CNC fallback
        if self.metrics.volume_efficiency > 0.50 and aspect_ratio < 15:
            if bend_analysis.is_likely_bent:
                confidence = 0.80
                reasoning = (f"THICKNESS-DETECTED: {detected_thickness:.2f}mm "
                             f"with {bend_analysis.bend_count} bends, bent sheet metal")
            elif self.metrics.volume_efficiency > 0.70:
                metadata['classification_method'] = 'cnc_fallback'
                metadata['reasoning'] = (
                    f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but no bends and "
                    f"high volume efficiency {self.metrics.volume_efficiency:.2f} suggests CNC"
                )
                return ('cnc_milling', 0.70, metadata)
            else:
                # Moderate volume efficiency without bends — still likely sheet metal
                confidence = 0.70
                reasoning = (f"THICKNESS-DETECTED: {detected_thickness:.2f}mm "
                             f"moderate solidity, likely sheet metal")
        else:
            base_conf = 0.85 + (thickness_confidence * 0.10)
            if bend_analysis.is_likely_bent:
                confidence = min(0.98, base_conf + 0.05)
                reasoning = (f"THICKNESS-DETECTED: {detected_thickness:.2f}mm wall "
                             f"thickness with {bend_analysis.bend_count} bends")
            else:
                confidence = base_conf
                reasoning = (f"THICKNESS-DETECTED: {detected_thickness:.2f}mm "
                             f"uniform wall thickness (sheet metal gauge)")

        metadata['classification_method'] = 'thickness_detection'
        metadata['reasoning'] = reasoning
        bend_report = (bend_detector.get_bend_detection_report(bend_analysis)
                       if bend_analysis.bend_count > 0 else None)
        return ('sheet_metal', confidence, {**metadata, 'bend_report': bend_report})

    def _try_bend_classification(self, bend_detector, bend_analysis, min_dim,
                                 metadata):
        """Classify based on bend detection alone. Returns result or None.
        
        Bends are very strong evidence of sheet metal manufacturing.
        For bent parts, min_dim is bbox minimum (not wall thickness), so we
        should NOT require min_dim < 8mm — a bent enclosure could be 100×80×60mm.
        """
        if not bend_analysis.is_likely_bent:
            return None

        # High bend count with good confidence → sheet metal regardless of bbox dims
        if bend_analysis.bend_count >= 2 and bend_analysis.confidence >= 0.5:
            confidence = min(0.92, 0.75 + bend_analysis.confidence * 0.15)
        elif min_dim < SHEET_METAL_MAX_THICKNESS:
            # Single bend with thin profile
            confidence = min(0.85, 0.70 + bend_analysis.confidence * 0.15)
        else:
            # Single bend with large bbox min — less certain
            confidence = min(0.75, 0.60 + bend_analysis.confidence * 0.10)

        reasoning = (f"BEND-DETECTED: {bend_analysis.bend_count} bends "
                     f"(confidence: {bend_analysis.confidence:.2f})")
        return ('sheet_metal', confidence, {
            **metadata,
            'classification_method': 'bend_detection',
            'reasoning': reasoning,
            'bend_report': bend_detector.get_bend_detection_report(bend_analysis),
        })

    def _try_dimension_classification(self, min_dim, aspect_ratio, metadata):
        """Classify thin + high-aspect parts. Returns result or None."""
        if min_dim >= 8 or aspect_ratio <= 5:
            return None

        if self.metrics.volume_efficiency > 0.75:
            return ('cnc_milling', 0.75, {
                **metadata,
                'classification_method': 'dimension_override_cnc',
                'reasoning': (
                    f"DIMENSION-BASED: Thin profile but solid part "
                    f"(vol eff: {self.metrics.volume_efficiency:.2f}) - likely CNC"
                ),
            })

        confidence = 0.80 if aspect_ratio > 15 else 0.70
        return ('sheet_metal', confidence, {
            **metadata,
            'classification_method': 'dimension_analysis',
            'reasoning': (
                f"DIMENSION-BASED: {min_dim:.2f}mm thin profile "
                f"with {aspect_ratio:.1f}:1 aspect ratio"
            ),
        })

    def _try_turning_classification(self, aspect_ratio, metadata):
        """Classify cylindrical parts as CNC turning. Returns result or None."""
        min_val = self.metrics.min_dim or 1.0
        mid_val = self.metrics.mid_dim or 1.0
        xy_sim = abs(min_val - mid_val) / max(min_val, mid_val)
        is_cyl = (xy_sim < 0.15 and aspect_ratio > 1.5
                  and self.metrics.volume_efficiency > 0.6)
        if not is_cyl:
            return None
        return ('cnc_turning', 0.85, {
            **metadata,
            'classification_method': 'geometry_cylindrical',
            'reasoning': 'Cylindrical geometry with rotational symmetry',
        })

    def _classify_by_score_and_ml(self, bend_analysis, metadata, **kwargs):
        """Enhanced score check + default CNC + ML ensemble."""
        enhanced_score = self._compute_enhanced_score(bend_analysis)
        metadata['enhanced_sheet_metal_score'] = enhanced_score

        score_result = self._try_score_classification(enhanced_score, metadata)
        if score_result is not None:
            return score_result

        rule_process, rule_confidence, rule_metadata = self._default_cnc(
            enhanced_score, metadata,
        )
        return self._apply_ml_ensemble(
            rule_process, rule_confidence, rule_metadata,
            bend_analysis, **kwargs,
        )

    def _compute_enhanced_score(self, bend_analysis) -> float:
        """Compute the enhanced sheet-metal score."""
        score = self.sheet_metal_score
        score += self.advanced_metrics['wall_thickness_consistency'] * 15
        score += self.advanced_metrics['planarity_score'] * 15
        if self.advanced_metrics['volume_distribution'] > 0.75:
            score -= 25
        if bend_analysis.bend_count > 0:
            score += min(20, bend_analysis.bend_count * 8)
        return max(0.0, min(100.0, score))

    def _try_score_classification(self, enhanced_score, metadata):
        """Return sheet-metal or CNC override based on enhanced score, or None."""
        if enhanced_score > 65:
            if self.metrics.volume_efficiency > 0.75:
                return ('cnc_milling', 0.80, {
                    **metadata,
                    'classification_method': 'cnc_volume_override',
                    'reasoning': (
                        f'High sheet metal score ({enhanced_score:.0f}) but '
                        f'volume efficiency ({self.metrics.volume_efficiency:.2f}) '
                        f'indicates solid CNC part'
                    ),
                })
            return ('sheet_metal', 0.70, {
                **metadata,
                'classification_method': 'geometric_scoring',
                'reasoning': (f'Geometric analysis suggests sheet metal '
                              f'(score: {enhanced_score:.0f}/100)'),
            })
        if enhanced_score > 45 and self.metrics.volume_efficiency < 0.4:
            return ('sheet_metal', 0.60, {
                **metadata,
                'classification_method': 'geometric_scoring',
                'reasoning': 'Hollow thin-walled structure suggests sheet metal',
            })
        return None

    def _default_cnc(self, enhanced_score, metadata):
        """Return default CNC milling result."""
        cnc_likelihood = self.advanced_metrics.get('cnc_likelihood', 0.5)
        if cnc_likelihood > 0.6 or enhanced_score < 30:
            conf = 0.90 if cnc_likelihood > 0.7 else 0.85
            reasoning = (f'Solid geometry (vol eff: '
                         f'{self.metrics.volume_efficiency:.2f}) indicates CNC machining')
        else:
            conf = 0.70
            reasoning = 'Solid geometry or varying wall thickness indicates CNC machining'
        rule_meta = {
            **metadata,
            'classification_method': 'default_cnc',
            'reasoning': reasoning,
            'cnc_likelihood': cnc_likelihood,
        }
        return 'cnc_milling', conf, rule_meta

    def _apply_ml_ensemble(self, rule_process, rule_confidence, rule_metadata,
                           bend_analysis, **kwargs):
        """Consult ML classifier and apply override / boost logic."""
        ml_result = self._consult_ml(bend_analysis=bend_analysis, **kwargs)
        if ml_result is None:
            return (rule_process, rule_confidence, rule_metadata)

        rule_metadata['ml_classification'] = ml_result.to_dict()

        # ML override when rule confidence is weak
        if (rule_confidence < 0.80
                and ml_result.confidence > rule_confidence + 0.05
                and ml_result.predicted_process != rule_process
                and not ml_result.is_borderline):
            logger.info(
                "ML override: %s (%.2f) → %s (%.2f)",
                rule_process, rule_confidence,
                ml_result.predicted_process, ml_result.confidence,
            )
            rule_metadata['classification_method'] = 'ml_override'
            rule_metadata['reasoning'] = (
                f'ML classifier overrides rule engine: '
                f'{ml_result.predicted_process} ({ml_result.confidence:.0%}) '
                f'vs rule {rule_process} ({rule_confidence:.0%})'
            )
            return (ml_result.predicted_process, ml_result.confidence, rule_metadata)

        # Confidence boost when both agree
        if ml_result.predicted_process == rule_process:
            boosted = min(0.98, rule_confidence + ml_result.confidence * 0.10)
            if boosted > rule_confidence:
                rule_confidence = boosted
                rule_metadata['reasoning'] = (
                    str(rule_metadata.get('reasoning', ''))
                    + f' (ML-confirmed: {ml_result.confidence:.0%})'
                )
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
