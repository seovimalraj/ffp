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
from .face_classification import FaceClassificationResult

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
                face_classification: Optional[FaceClassificationResult] = None,
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

        # Compute machining feature score (used throughout cascade)
        self._feature_counts = {
            'hole_count': hole_count,
            'pocket_count': pocket_count,
            'thread_count': thread_count,
            'undercut_count': undercut_count,
            'fillet_count': fillet_count,
            'slot_count': slot_count,
        }
        self._machining_feature_score = self._compute_machining_feature_score()
        metadata['machining_feature_score'] = self._machining_feature_score

        # Store face classification for use throughout cascade
        self._face_classification = face_classification
        if face_classification is not None:
            metadata['face_classification_summary'] = {
                'plane_ratio': face_classification.plane_ratio,
                'cylinder_ratio': face_classification.cylinder_ratio,
                'cnc_face_score': face_classification.cnc_face_score,
                'sheet_metal_face_score': face_classification.sheet_metal_face_score,
                'is_likely_sheet_metal': face_classification.is_likely_sheet_metal,
                'is_likely_cnc': face_classification.is_likely_cnc,
                'paired_plane_count': face_classification.paired_plane_count,
                'dominant_pair_thickness': face_classification.dominant_pair_thickness,
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

        # 0) Face-type classification (highest reliability, direct B-Rep signal)
        result = self._try_face_classification(
            face_classification, bend_analysis, aspect_ratio, metadata,
        )
        if result is not None:
            return result

        # 1) Advanced thickness analysis (preferred)
        result = self._try_advanced_thickness(
            thickness_analysis, bend_detector, bend_analysis,
            aspect_ratio, metadata,
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
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

    def _compute_machining_feature_score(self) -> float:
        """Compute a CNC-likelihood score from extracted machining features.

        Returns 0-100 score. Higher = more CNC-like.
        Used throughout the cascade to override sheet-metal classifications
        when the part has strong CNC evidence (threads, pockets, undercuts).
        """
        fc = self._feature_counts
        score = 0.0
        if fc['thread_count'] > 0:
            score += min(25, 15 + fc['thread_count'] * 5)
        if fc['pocket_count'] >= 3:
            score += min(20, 10 + fc['pocket_count'] * 3)
        elif fc['pocket_count'] >= 1:
            score += 5
        if fc['undercut_count'] > 0:
            score += min(25, 15 + fc['undercut_count'] * 5)
        if fc['slot_count'] >= 4:
            score += 10
        elif fc['slot_count'] >= 1:
            score += 3
        # Many holes without bends → drilled CNC plate
        if fc['hole_count'] > 20:
            score += 10
        elif fc['hole_count'] > 10:
            score += 5
        return min(100.0, score)

    def _try_face_classification(self, face_result, bend_analysis,
                                  aspect_ratio, metadata):
        """Tier 0: Classify using BRepAdaptor face-type distribution.

        This is the most reliable signal because it directly inspects the B-Rep
        topology rather than relying on mesh approximations.  Only fires when
        the face classifier is highly confident (score >= 70).

        Returns classification result or None to continue cascade.
        """
        if face_result is None:
            return None

        sm_score = face_result.sheet_metal_face_score
        cnc_score = face_result.cnc_face_score
        mf_score = self._machining_feature_score

        # Strong CNC signal from faces AND machining features
        if face_result.is_likely_cnc and cnc_score >= 70:
            # Don't override if there are genuine bends + thin paired walls
            if (bend_analysis.is_likely_bent
                    and face_result.dominant_pair_thickness is not None
                    and 0.4 <= face_result.dominant_pair_thickness <= 8.0):
                logger.info(
                    "Face classification says CNC (%.0f) but bends + "
                    "paired thickness %.1fmm — deferring to thickness tiers.",
                    cnc_score, face_result.dominant_pair_thickness,
                )
                return None

            confidence = min(0.95, 0.80 + cnc_score / 1000)
            metadata['classification_method'] = 'face_type_cnc'
            metadata['reasoning'] = (
                f"FACE-TYPE ANALYSIS: {face_result.reasoning} "
                f"(CNC={cnc_score:.0f}, SM={sm_score:.0f}, "
                f"machining_features={mf_score:.0f})"
            )
            return ('cnc_milling', confidence, metadata)

        # Strong sheet metal signal from faces
        if face_result.is_likely_sheet_metal and sm_score >= 70:
            # Override to CNC if machining features are very strong
            if mf_score >= 50:
                logger.info(
                    "Face classification says sheet metal (%.0f) but "
                    "machining feature score %.0f — deferring.",
                    sm_score, mf_score,
                )
                return None

            # Override to CNC if volume efficiency is very high (solid block)
            if self.metrics.volume_efficiency > 0.80 and aspect_ratio < 4:
                logger.info(
                    "Face classification says sheet metal (%.0f) but "
                    "solid block (vol_eff=%.2f, AR=%.1f) — CNC override.",
                    sm_score, self.metrics.volume_efficiency, aspect_ratio,
                )
                metadata['classification_method'] = 'face_type_cnc_solid_override'
                metadata['reasoning'] = (
                    f"FACE-TYPE says sheet metal but solid block "
                    f"(vol_eff={self.metrics.volume_efficiency:.2f})"
                )
                return ('cnc_milling', 0.82, metadata)

            confidence = min(0.93, 0.78 + sm_score / 1000)
            if bend_analysis.is_likely_bent:
                confidence = min(0.96, confidence + 0.05)
            metadata['classification_method'] = 'face_type_sheet_metal'
            metadata['reasoning'] = (
                f"FACE-TYPE ANALYSIS: {face_result.reasoning} "
                f"(SM={sm_score:.0f}, CNC={cnc_score:.0f}, "
                f"pairs={face_result.paired_plane_count})"
            )
            return ('sheet_metal', confidence, metadata)

        # Face classification not confident enough — let cascade continue
        return None

    def _try_advanced_thickness(self, thickness_analysis, bend_detector,
                                bend_analysis, aspect_ratio, metadata,
                                detected_thickness=None,
                                thickness_confidence=0.0):
        """Classify using advanced thickness analysis. Returns result or None.

        When the advanced ray-casting analysis disagrees with the simpler
        legacy wall-thickness detection (min_wall_mesh), we let the cascade
        continue to _try_legacy_thickness so the legacy value gets a chance.
        """
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

        if not thickness_analysis.is_sheet_thickness:
            # Check if legacy ray-cast detected a valid sheet-metal wall
            # thickness.  If so, the advanced and legacy analyses disagree;
            # don't override to CNC here — fall through so
            # _try_legacy_thickness can apply the legacy detection.
            legacy_in_sheet_range = (
                detected_thickness is not None
                and detected_thickness > 0
                and SHEET_METAL_MIN_THICKNESS <= detected_thickness <= SHEET_METAL_MAX_THICKNESS
                and thickness_confidence > 0.3
            )
            if legacy_in_sheet_range:
                logger.info(
                    "Advanced says NOT sheet (T=%.1fmm) but legacy detected "
                    "%.2fmm — deferring to legacy tier.",
                    thickness_analysis.detected_thickness or 0,
                    detected_thickness,
                )
                return None  # let _try_legacy_thickness decide

            adv_t = thickness_analysis.detected_thickness or 0
            clearly_not_sheet = (
                thickness_analysis.confidence > 0.6
                or adv_t > SHEET_METAL_MAX_THICKNESS
                or thickness_analysis.thickness_to_size_ratio > 0.10
            )
            if clearly_not_sheet:
                metadata['classification_method'] = 'advanced_analysis_cnc_override'
                metadata['reasoning'] = f"ADVANCED ANALYSIS: {thickness_analysis.reasoning}"
                return ('cnc_milling', 0.85, metadata)

        return None

    def _advanced_sheet_or_cnc_guard(self, thickness_analysis, bend_detector,
                                     bend_analysis, aspect_ratio, metadata):
        """Handle confirmed sheet-thickness with CNC guard."""
        mf_score = self._machining_feature_score

        # Strong machining features override sheet classification
        if mf_score >= 50:
            metadata['classification_method'] = 'advanced_analysis_cnc_feature_override'
            metadata['reasoning'] = (
                f"ADVANCED ANALYSIS detected sheet thickness but machining "
                f"features score {mf_score:.0f} (threads={self._feature_counts['thread_count']}, "
                f"pockets={self._feature_counts['pocket_count']}, "
                f"undercuts={self._feature_counts['undercut_count']}) — CNC override"
            )
            return ('cnc_milling', 0.85, metadata)

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
        mf_score = self._machining_feature_score

        # Strong machining features → CNC regardless of thickness
        if mf_score >= 50:
            metadata['classification_method'] = 'cnc_feature_override'
            metadata['reasoning'] = (
                f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but "
                f"machining features score {mf_score:.0f} — CNC override"
            )
            return ('cnc_milling', 0.85, metadata)

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

        Bends are evidence of sheet metal, but ONLY when supported by other
        signals.  Small CNC parts with chamfers/fillets can produce false-
        positive "bends" from the triangle normal analyzer.

        Guards against false positives:
        - Volume efficiency > 0.65 requires very strong bend evidence
        - Machining features (threads, pockets, undercuts) suppress bend signal
        - Face classification override when available
        - No detected thin wall thickness requires stricter thresholds
        """
        if not bend_analysis.is_likely_bent:
            return None

        mf_score = self._machining_feature_score

        # Guard 1: Strong machining features → almost certainly CNC
        if mf_score >= 40:
            logger.info(
                "Bend detection suppressed: machining feature score %.0f "
                "(threads=%d, pockets=%d, undercuts=%d)",
                mf_score,
                self._feature_counts['thread_count'],
                self._feature_counts['pocket_count'],
                self._feature_counts['undercut_count'],
            )
            return None

        # Guard 2: Face classification says CNC
        fc = self._face_classification
        if fc is not None and fc.is_likely_cnc and fc.cnc_face_score >= 60:
            logger.info(
                "Bend detection suppressed: face classification says CNC "
                "(CNC=%.0f, SM=%.0f)",
                fc.cnc_face_score, fc.sheet_metal_face_score,
            )
            return None

        # Guard 3: Solid block with high volume efficiency
        if self.metrics.volume_efficiency > 0.65:
            # Only allow if bends are very strong evidence
            if bend_analysis.bend_count < 4 or bend_analysis.confidence < 0.7:
                logger.info(
                    "Bend detection suppressed: high volume efficiency %.2f "
                    "with only %d bends (conf=%.2f)",
                    self.metrics.volume_efficiency,
                    bend_analysis.bend_count,
                    bend_analysis.confidence,
                )
                return None

        # Guard 4: No thin wall detected — require stricter evidence
        has_thin_wall = (
            metadata.get('detected_thickness') is not None
            and 0.3 <= metadata['detected_thickness'] <= 10.0
        )
        if not has_thin_wall:
            # Without wall thickness evidence, require ≥3 bends with high confidence
            if bend_analysis.bend_count < 3 or bend_analysis.confidence < 0.65:
                logger.info(
                    "Bend detection suppressed: no thin wall detected and "
                    "only %d bends (conf=%.2f)",
                    bend_analysis.bend_count,
                    bend_analysis.confidence,
                )
                return None

        # Passed all guards — classify as sheet metal
        if bend_analysis.bend_count >= 2 and bend_analysis.confidence >= 0.5:
            confidence = min(0.92, 0.75 + bend_analysis.confidence * 0.15)
        elif min_dim < SHEET_METAL_MAX_THICKNESS:
            confidence = min(0.85, 0.70 + bend_analysis.confidence * 0.15)
        else:
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

        # Machining features override dimension-based sheet metal
        if self._machining_feature_score >= 40:
            return ('cnc_milling', 0.78, {
                **metadata,
                'classification_method': 'dimension_cnc_feature_override',
                'reasoning': (
                    f"DIMENSION-BASED: Thin profile ({min_dim:.2f}mm) but "
                    f"machining feature score {self._machining_feature_score:.0f} — CNC"
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
        """Compute the enhanced sheet-metal score incorporating face classification."""
        score = self.sheet_metal_score
        score += self.advanced_metrics['wall_thickness_consistency'] * 15
        score += self.advanced_metrics['planarity_score'] * 15
        if self.advanced_metrics['volume_distribution'] > 0.75:
            score -= 25
        if bend_analysis.bend_count > 0:
            score += min(20, bend_analysis.bend_count * 8)

        # Incorporate face classification signal
        fc = self._face_classification
        if fc is not None:
            if fc.is_likely_sheet_metal:
                score += min(20, fc.sheet_metal_face_score * 0.25)
            elif fc.is_likely_cnc:
                score -= min(25, fc.cnc_face_score * 0.3)

        # Machining features dampen sheet metal score
        score -= self._machining_feature_score * 0.4

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
            # Build face classification dict for ML feature vector
            fc_dict = None
            if self._face_classification is not None:
                try:
                    fc_dict = self._face_classification.to_dict()
                except Exception:
                    pass

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
                face_classification=fc_dict,
            )
            return ProcessClassifier._ml_classifier.predict(fv)
        except Exception as exc:
            logger.warning("ML consultation failed: %s", exc)
            return None
