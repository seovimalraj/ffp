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

FEATURE-BASED ANALYSIS:
Analyzes extracted features (holes, pockets, fillets) for:
- Hole depth/diameter ratio: punched vs drilled
- Pocket depth and multi-step patterns
- Fillet radius: tool radius vs bend relief
- Thickness uniformity
"""
import logging
from typing import Any, Dict, Tuple, Optional, List
from .geometry import GeometricMetrics, calculate_sheet_metal_score, calculate_advanced_metrics
from .bend_detection import AdvancedBendDetector
from .advanced_thickness_detection import ThicknessAnalysisResult
from .ml_classifier import MLProcessClassifier, build_feature_vector, MLClassificationResult, get_ml_classifier
from .face_classification import FaceClassificationResult
from .feature_analysis import (
    compute_feature_signals, 
    FeatureClassificationSignals,
    analyze_thickness_uniformity,
)

logger = logging.getLogger(__name__)


# Sheet metal thickness range (standard gauges) - default for steel
SHEET_METAL_MIN_THICKNESS = 0.4  # mm (approx 26 gauge)
SHEET_METAL_MAX_THICKNESS = 6.0  # mm (practical limit for press brake forming)

# Material-specific thickness ranges
# MAX THICKNESS LIMITS: Industry standard for practical sheet metal forming
# - Above these limits, parts require plate bending equipment (not standard press brakes)
# - Most sheet metal shops consider 6mm the practical limit
MATERIAL_THICKNESS_RANGES = {
    'steel': (0.4, 6.0),       # Cold-rolled steel: 26 gauge to ~6mm
    'stainless': (0.4, 6.0),   # Stainless steel: similar to steel
    'aluminum': (0.5, 6.0),    # Aluminum: 6mm max (was 10mm) - practical forming limit
    'copper': (0.3, 4.0),      # Copper: typically thinner gauge
    'brass': (0.3, 4.0),       # Brass: similar to copper
    'titanium': (0.5, 6.0),    # Titanium: similar to steel
    'default': (0.4, 6.0),     # Default range (was 8mm, reduced to 6mm)
}


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
        
        # Lazily initialize the ML classifier (singleton, no training)
        if ProcessClassifier._ml_classifier is None:
            try:
                ProcessClassifier._ml_classifier = get_ml_classifier()
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
                slot_count: int = 0,
                # Enhanced feature analysis inputs
                holes: Optional[List[Any]] = None,
                pockets: Optional[List[Any]] = None,
                fillets: Optional[List[Any]] = None,
                paired_plane_distances: Optional[List[float]] = None,
                # Additional inputs for complete feature analysis
                bends: Optional[List[Any]] = None,
                undercuts: Optional[List[Any]] = None,
                draft_analysis: Optional[Any] = None,
                # Slots and threads list for geometry analysis
                slots: Optional[List[Any]] = None,
                threads: Optional[List[Any]] = None,
                # NEW: Extended process detection inputs
                surface_finish_analysis: Optional[Any] = None,
                tolerance_analysis: Optional[Any] = None,
                machining_complexity: Optional[Any] = None,
                casting_analysis: Optional[Any] = None,
                weldment_analysis: Optional[Any] = None,
                body_count: int = 1,
                boss_count: int = 0,
                rib_count: int = 0,
                material: str = 'default',
                mesh: Optional[Any] = None) -> Tuple[str, float, Dict[str, Any]]:
        """
        Advanced classification using proper sheet metal thickness detection.

        Args:
            detected_thickness: Wall thickness from ray-casting (mm)
            thickness_confidence: Confidence in thickness measurement (0-1)
            triangle_count: Number of mesh triangles
            thickness_analysis: Advanced thickness analysis result
            face_classification: BRepAdaptor face classification result
            hole_count/pocket_count/etc: Feature counts for machining score
            holes: List of HoleFeature objects for depth analysis
            pockets: List of PocketFeature objects for depth analysis
            fillets: List of FilletFeature objects for radius analysis
            paired_plane_distances: List of paired plane distances for uniformity
            bends: List of BendFeature objects for bend radius analysis
            undercuts: List of UnderCutFeature objects for severity weighting
            draft_analysis: Draft analysis result for injection molding hints
            material: Material type for thickness thresholds

        Returns:
            Tuple of (process_type, confidence, metadata)
        """
        # Get material-specific thickness range
        thickness_range = MATERIAL_THICKNESS_RANGES.get(
            material.lower(), MATERIAL_THICKNESS_RANGES['default']
        )
        self._material = material
        self._sheet_min_thickness = thickness_range[0]
        self._sheet_max_thickness = thickness_range[1]
        
        # Store detected thickness for use in classification cascade
        self._detected_thickness = detected_thickness
        
        metadata: Dict[str, Any] = {
            'sheet_metal_score': self.sheet_metal_score,
            'detected_thickness': detected_thickness,
            'thickness_confidence': thickness_confidence,
            'bbox_minimum': self.metrics.min_dim,
            'volume_efficiency': self.metrics.volume_efficiency,
            'material': material,
            'sheet_thickness_range': thickness_range,
        }

        # Store undercuts and draft_analysis for use throughout cascade (GAP FIX: previously unused)
        self._undercuts = undercuts or []
        self._draft_analysis = draft_analysis
        
        # Store hole features for turn-mill cross-hole detection (GAP FIX: was missing)
        self._hole_features = holes or []
        self._pocket_features = pockets or []
        self._fillet_features = fillets or []
        self._slot_features = slots or []
        self._thread_features = threads or []
        
        # FIX: Store STEP-extracted bends for accurate bend detection
        # STEP bends are extracted from BRep face pairs and are more reliable
        # than heuristic-based detection (which relies on volume efficiency)
        self._step_bends = bends or []
        
        # NEW: Store extended analysis results for ML and advanced classification
        self._surface_finish_analysis = surface_finish_analysis
        self._tolerance_analysis = tolerance_analysis
        self._machining_complexity_analysis = machining_complexity
        self._casting_analysis = casting_analysis
        self._weldment_analysis = weldment_analysis
        self._body_count = body_count
        
        # Compute machining feature score (used throughout cascade)
        self._feature_counts = {
            'hole_count': hole_count,
            'pocket_count': pocket_count,
            'thread_count': thread_count,
            'undercut_count': undercut_count,
            'fillet_count': fillet_count,
            'slot_count': slot_count,
            'boss_count': boss_count,
            'rib_count': rib_count,
        }
        self._machining_feature_score = self._compute_machining_feature_score()
        metadata['machining_feature_score'] = self._machining_feature_score
        
        # Extract face data from face_classification for downstream analysis (GAP 1, 5, 6)
        planar_faces_for_analysis = []
        cylindrical_faces_for_analysis = []
        planar_face_z_levels = []
        total_edge_count = 0
        if face_classification is not None:
            planar_faces_for_analysis = getattr(face_classification, 'planar_faces_info', [])
            cylindrical_faces_for_analysis = getattr(face_classification, 'cylindrical_faces_info', [])
            planar_face_z_levels = getattr(face_classification, 'planar_face_z_levels', [])
            total_edge_count = getattr(face_classification, 'total_edge_count', 0)
        
        # Store total edge count for edge sharpness analysis
        self._total_edge_count = total_edge_count
        
        # NEW: Compute feature-based classification signals with ALL parameters (GAP 1)
        self._feature_signals = compute_feature_signals(
            holes=holes,
            pockets=pockets,
            fillets=fillets,
            paired_plane_distances=paired_plane_distances or [],
            planar_face_z_levels=planar_face_z_levels,
            planar_faces=planar_faces_for_analysis,
            cylindrical_faces=cylindrical_faces_for_analysis,
            bends=bends,
            slots=slots,  # GAP FIX: pass slots for geometry analysis
            threads=threads,  # GAP FIX: pass threads for pitch analysis
            min_dim=self.metrics.min_dim,
            total_surface_area=self.metrics.surface_area_mm2,
            part_thickness_mm=detected_thickness or 0.0,
            total_edge_count=total_edge_count,
        )
        metadata['feature_signals'] = self._feature_signals.to_dict()
        
        # Combine machining feature score with feature analysis
        # Feature analysis provides more nuanced signals
        feature_cnc_boost = max(0, (self._feature_signals.feature_cnc_score - 50) * 0.5)
        self._machining_feature_score += feature_cnc_boost
        metadata['feature_cnc_boost'] = feature_cnc_boost

        # Analyze draft angles for injection molding hints (GAP FIX: was unused)
        self._draft_compatibility = self._analyze_draft_compatibility()
        metadata['draft_compatibility'] = self._draft_compatibility
        # If strong injection molding candidate with draft angles, reduce CNC probability
        if self._draft_compatibility.get('injection_molding_candidate', False):
            # Parts with good draft are less likely to be CNC machined
            self._machining_feature_score -= 15
            metadata['draft_reduction'] = 15

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
            detected_thickness, thickness_confidence, triangle_count, mesh=mesh,
        )
        metadata['bend_analysis'] = {
            'is_likely_bent': bend_analysis.is_likely_bent,
            'bend_count': bend_analysis.bend_count,
            'confidence': bend_analysis.confidence,
            'complexity': bend_analysis.complexity_score,
        }

        aspect_ratio = self.metrics.aspect_ratio or 1.0
        min_dim = self.metrics.min_dim or 10.0

        # 0) Explicit flat sheet metal detection (NEW - highest priority for clear cases)
        # A flat sheet has: thin profile + high aspect ratio + high volume efficiency
        # This catches laser-cut/punched flat parts that other tiers miss
        result = self._try_flat_sheet_classification(
            face_classification, min_dim, aspect_ratio, metadata,
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
        )
        if result is not None:
            return result

        # 1) Face-type classification (highest reliability, direct B-Rep signal)
        result = self._try_face_classification(
            face_classification, bend_analysis, aspect_ratio, metadata,
        )
        if result is not None:
            return result

        # 2) Advanced thickness analysis (preferred)
        result = self._try_advanced_thickness(
            thickness_analysis, bend_detector, bend_analysis,
            aspect_ratio, metadata,
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
        )
        if result is not None:
            return result

        # 3) Legacy thickness detection (fallback)
        result = self._try_legacy_thickness(
            detected_thickness, thickness_confidence,
            bend_detector, bend_analysis, aspect_ratio, metadata,
        )
        if result is not None:
            return result

        # 4) Bend-based detection
        result = self._try_bend_classification(
            bend_detector, bend_analysis, min_dim, metadata,
        )
        if result is not None:
            return result

        # 5) Dimension-based detection
        result = self._try_dimension_classification(
            min_dim, aspect_ratio, metadata,
        )
        if result is not None:
            return result

        # 6) CNC turning detection
        result = self._try_turning_classification(aspect_ratio, metadata)
        if result is not None:
            return result

        # 7) WELDMENT detection (multi-body with weld joints)
        result = self._try_weldment_classification(metadata)
        if result is not None:
            return result

        # 8) CASTING detection (draft angles, uniform walls, casting indicators)
        result = self._try_casting_classification(metadata)
        if result is not None:
            return result

        # 9) 5-AXIS detection (undercuts, multi-direction access)
        result = self._try_5axis_classification(metadata)
        if result is not None:
            return result

        # 10) TURN-MILL detection (turned part with cross-drilled holes)
        result = self._try_turn_mill_classification(metadata, holes=None)
        if result is not None:
            return result

        # 11) Enhanced score / default CNC + ML ensemble
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

    def _run_bend_detection(self, detected_thickness, thickness_confidence, triangle_count, 
                              mesh=None):
        """Run advanced bend detection and return (detector, analysis).
        
        FIX: When STEP-extracted bends are available, use them to OVERRIDE
        the heuristic bend count. STEP bends are extracted from BRep topology
        and accurately detect 2-side bends, L-brackets, U-channels etc.
        
        For STL files, when a mesh object is provided, use enhanced mesh-based
        analysis with normal clustering and triangle dihedral angles.
        """
        bend_detector = AdvancedBendDetector(
            [self.metrics.min_dim, self.metrics.mid_dim, self.metrics.max_dim],
            self.metrics.volume_mm3,
            self.metrics.surface_area_mm2,
        )
        
        # For STL/mesh files, use enhanced mesh-based analysis
        if mesh is not None:
            bend_analysis = bend_detector.analyze_with_mesh(
                mesh=mesh,
                detected_thickness=detected_thickness,
                thickness_confidence=thickness_confidence,
                triangle_count=triangle_count,
            )
        else:
            bend_analysis = bend_detector.analyze_bends(
                detected_thickness=detected_thickness,
                thickness_confidence=thickness_confidence,
                triangle_count=triangle_count,
            )
        
        # FIX: Override heuristic bend count with STEP-extracted bends
        # STEP bends are far more reliable for detecting 2-side bends, channels, etc.
        step_bends = getattr(self, '_step_bends', [])
        if step_bends and len(step_bends) > 0:
            step_bend_count = len(step_bends)
            
            # STEP bends override heuristic if they found bends the heuristic missed
            # OR if heuristic found more (possible false positives)
            if step_bend_count >= 1:
                # Always trust STEP bend count when available
                bend_analysis.is_likely_bent = True
                bend_analysis.bend_count = max(bend_analysis.bend_count, step_bend_count)
                bend_analysis.confidence = max(bend_analysis.confidence, 0.85)
                
                # Extract bend angles from STEP data
                step_angles = [getattr(b, 'angle_deg', 90.0) for b in step_bends]
                if step_angles:
                    bend_analysis.bend_angles = step_angles
                
                logger.info(
                    "STEP bends override: %d bends detected from BRep (heuristic: %d)",
                    step_bend_count, bend_analysis.bend_count
                )
        
        return bend_detector, bend_analysis

    def _analyze_draft_compatibility(self) -> Dict[str, Any]:
        """Analyze draft angles for injection molding compatibility.
        
        Returns dict with:
        - has_draft: bool - whether part has meaningful draft angles
        - draft_coverage: float - fraction of faces with sufficient draft (0-1)
        - avg_draft_angle: float - average draft angle in degrees
        - injection_molding_candidate: bool - strong indicator for IM
        """
        if not hasattr(self, '_draft_analysis') or not self._draft_analysis:
            return {
                'has_draft': False,
                'draft_coverage': 0.0,
                'avg_draft_angle': 0.0,
                'injection_molding_candidate': False,
            }
        
        draft_infos = self._draft_analysis
        total_faces = len(draft_infos)
        if total_faces == 0:
            return {
                'has_draft': False,
                'draft_coverage': 0.0,
                'avg_draft_angle': 0.0,
                'injection_molding_candidate': False,
            }
        
        sufficient_count = sum(1 for d in draft_infos if getattr(d, 'is_sufficient', False))
        draft_coverage = sufficient_count / total_faces
        avg_draft = sum(getattr(d, 'draft_angle_deg', 0) for d in draft_infos) / total_faces
        
        # Injection molding candidate: >70% faces have sufficient draft, avg > 1 deg
        is_im_candidate = draft_coverage >= 0.7 and avg_draft >= 1.0
        
        return {
            'has_draft': avg_draft > 0.5,
            'draft_coverage': draft_coverage,
            'avg_draft_angle': avg_draft,
            'injection_molding_candidate': is_im_candidate,
        }

    def _compute_machining_feature_score(self) -> float:
        """Compute a CNC-likelihood score from extracted machining features.

        Returns 0-100 score. Higher = more CNC-like.
        Used throughout the cascade to override sheet-metal classifications
        when the part has strong CNC evidence (threads, pockets, undercuts).
        
        ENHANCED: Now also considers feature analysis signals (fillet radius,
        hole depth ratio, pocket depth, thickness uniformity).
        """
        fc = self._feature_counts
        score = 0.0
        
        # Thread features are strong CNC indicator
        if fc['thread_count'] > 0:
            score += min(25, 15 + fc['thread_count'] * 5)
        
        # Pocket features indicate CNC (but check depth via feature_signals)
        if fc['pocket_count'] >= 3:
            score += min(20, 10 + fc['pocket_count'] * 3)
        elif fc['pocket_count'] >= 1:
            score += 5
            
        # Undercut features definitely indicate CNC
        # NEW: Weight by severity - major undercuts may require 5-axis
        if fc['undercut_count'] > 0:
            base_undercut_score = min(25, 15 + fc['undercut_count'] * 5)
            # Weight by severity if full undercut data available
            if hasattr(self, '_undercuts') and self._undercuts:
                major_count = sum(1 for u in self._undercuts 
                                  if getattr(u, 'severity', 'minor') == 'major')
                minor_count = len(self._undercuts) - major_count
                # Major undercuts add more score (indicates complex 5-axis)
                severity_weighted = (major_count * 8) + (minor_count * 3)
                score += min(35, 15 + severity_weighted)
            else:
                score += base_undercut_score
            
        # Slot features (more than few = likely CNC)
        if fc['slot_count'] >= 4:
            score += 10
        elif fc['slot_count'] >= 1:
            score += 3
            
        # Hole analysis: many holes without bends could be either
        # Deep holes (D/d > 3) strongly indicate drilled CNC
        if fc['hole_count'] > 20:
            score += 10
        elif fc['hole_count'] > 10:
            score += 5
        
        # NEW: Fillet radius analysis
        # Tool-radius fillets (R3-R6mm) strongly indicate CNC
        if fc['fillet_count'] > 0:
            # Check if we have feature signals available
            if hasattr(self, '_feature_signals') and self._feature_signals:
                fillet_analysis = self._feature_signals.fillet_analysis
                if fillet_analysis.tool_radius_count >= 3:
                    # Many tool-radius fillets = very high CNC confidence
                    score += 20
                elif fillet_analysis.tool_radius_count >= 1:
                    score += 10
                # Bend relief fillets reduce CNC score
                if fillet_analysis.bend_relief_count > fillet_analysis.tool_radius_count:
                    score -= 10
        
        return min(100.0, max(0.0, score))

    def _try_flat_sheet_classification(self, face_result, min_dim, aspect_ratio,
                                        metadata, detected_thickness=None,
                                        thickness_confidence=0.0):
        """Tier 0: Explicit flat sheet metal detection.

        This tier catches flat laser-cut/punched sheet metal parts that have:
        - Thin profile (min_dim ≤ material-specific max)
        - High aspect ratio (thin and wide/long)
        - High volume efficiency (fills bounding box - characteristic of flat sheets!)

        CRITICAL INSIGHT: A perfectly flat sheet has VERY HIGH volume efficiency
        (~1.0) because it fills its bounding box completely. Previous logic
        incorrectly penalized this as "solid CNC block".

        The key discriminator is: thin profile + high aspect ratio + predominantly
        planar faces = flat sheet metal, regardless of volume efficiency.
        
        GUARD AGAINST CNC BLOCKS:
        - Cube-like shapes (low aspect ratio) are NOT flat sheets
        - Multiple distinct thicknesses indicate CNC machining
        - Tool-radius fillets indicate CNC machining

        Returns classification result or None to continue cascade.
        """
        mf_score = self._machining_feature_score

        # Guard: Strong machining features override flat sheet classification
        if mf_score >= 40:
            return None
        
        # Guard: Feature analysis indicates CNC
        if hasattr(self, '_feature_signals') and self._feature_signals:
            fcs = self._feature_signals
            # Strong CNC signal from features
            if fcs.feature_cnc_score >= 70:
                logger.info(
                    "Flat sheet rejected: feature_cnc_score=%.0f, %s",
                    fcs.feature_cnc_score, fcs.reasoning
                )
                return None
            # Multiple distinct thicknesses = CNC (pocketed/stepped)
            if fcs.thickness_uniformity.thickness_count >= 3:
                logger.info(
                    "Flat sheet rejected: %d distinct thicknesses detected",
                    fcs.thickness_uniformity.thickness_count
                )
                return None
            # Many tool-radius fillets = CNC
            if fcs.fillet_analysis.tool_radius_count >= 3:
                logger.info(
                    "Flat sheet rejected: %d tool-radius fillets detected",
                    fcs.fillet_analysis.tool_radius_count
                )
                return None

        # Use material-specific thickness range
        max_thickness = getattr(self, '_sheet_max_thickness', SHEET_METAL_MAX_THICKNESS)

        # Check for flat sheet signature:
        # 1. Thin minimum dimension (within material-specific range)
        is_thin = min_dim <= max_thickness

        # 2. High aspect ratio (thin relative to length/width)
        # STRICT: For thicker materials (>4mm), require higher aspect ratio
        # A 6mm thick part needs AR >= 12 to be considered flat sheet
        thickness_penalty = max(0, (min_dim - 4.0) / 2.0)  # 0 for <=4mm, increases for thicker
        required_ar = 8.0 + thickness_penalty * 2.0
        is_flat_profile = aspect_ratio >= required_ar

        # 3. Very high aspect ratio is almost certainly sheet metal
        is_very_flat = aspect_ratio >= 15.0

        if not is_thin:
            return None

        if not is_flat_profile:
            return None
        
        # GUARD: Cube-like shapes are NOT flat sheets
        # Check if mid_dim is similar to min_dim (plate vs sheet)
        mid_dim = self.metrics.mid_dim
        dimension_ratio = mid_dim / max(min_dim, 0.1)
        if dimension_ratio < 3.0 and min_dim > 4.0:
            # Thick and not very elongated - likely CNC plate
            logger.info(
                "Flat sheet rejected: cube-like (min=%.1f, mid=%.1f, ratio=%.1f)",
                min_dim, mid_dim, dimension_ratio
            )
            return None

        # Additional validation from face classification if available
        has_planar_faces = True
        if face_result is not None:
            # Flat sheet should have high plane ratio (top, bottom, edges)
            has_planar_faces = face_result.plane_ratio >= 0.60
            # If face classification strongly says CNC, defer to it
            if face_result.is_likely_cnc and face_result.cnc_face_score >= 75:
                return None

        if not has_planar_faces:
            return None

        # For very flat profiles, high volume efficiency is EXPECTED (not a CNC signal)
        # A 2mm × 200mm × 300mm flat sheet has vol_eff ≈ 1.0
        vol_eff = self.metrics.volume_efficiency

        # Flat sheet metal: thin + high AR + (high vol_eff is OK for flat sheets!)
        if is_very_flat and is_thin:
            confidence = 0.92
            if detected_thickness and 0.4 <= detected_thickness <= 6.0:
                # Use thickness_confidence to boost confidence when detection is reliable
                boost = 0.04 * (thickness_confidence if thickness_confidence > 0 else 0.5)
                confidence = min(0.96, confidence + boost)
            metadata['classification_method'] = 'flat_sheet_explicit'
            metadata['reasoning'] = (
                f"FLAT SHEET DETECTED: {min_dim:.2f}mm thickness, "
                f"{aspect_ratio:.1f}:1 aspect ratio — flat sheet metal "
                f"(vol_eff={vol_eff:.2f} is expected for flat profiles)"
            )
            return ('sheet_metal', confidence, metadata)

        # Moderately flat profile with thin dimension
        if is_flat_profile and is_thin:
            # High volume efficiency is OK for flat sheets
            # Only reject if machining features present
            if mf_score >= 25:
                return None  # Defer to other tiers

            confidence = 0.85
            if detected_thickness and 0.4 <= detected_thickness <= 6.0:
                boost = 0.05 * (thickness_confidence if thickness_confidence > 0 else 0.5)
                confidence = min(0.92, confidence + boost)

            metadata['classification_method'] = 'flat_sheet_profile'
            metadata['reasoning'] = (
                f"FLAT SHEET PROFILE: {min_dim:.2f}mm thickness, "
                f"{aspect_ratio:.1f}:1 aspect ratio — likely flat sheet metal"
            )
            return ('sheet_metal', confidence, metadata)

        return None

    def _try_face_classification(self, face_result, bend_analysis,
                                  aspect_ratio, metadata):
        """Tier 1: Classify using BRepAdaptor face-type distribution.

        This is the most reliable signal because it directly inspects the B-Rep
        topology rather than relying on mesh approximations.  Only fires when
        the face classifier is highly confident (score >= 70).
        
        ENHANCED: Now uses feature analysis signals to guard against false positives.
        Also includes early CNC override for turned parts (high cylinder area).

        Returns classification result or None to continue cascade.
        """
        if face_result is None:
            return None

        sm_score = face_result.sheet_metal_face_score
        cnc_score = face_result.cnc_face_score
        mf_score = self._machining_feature_score
        
        # EARLY GUARD: CNC Turned Parts Detection
        # Turned parts have high cylinder_area_ratio (cylindrical surfaces dominate)
        # This must fire BEFORE confidence checks because turned parts may have
        # low cnc_face_score due to planar end faces but still be clearly CNC.
        # HOWEVER: Bent sheet metal also has high cylinder area due to bend radii!
        # We must check for STEP-extracted bends before triggering this override.
        cyl_area_ratio = getattr(face_result, 'cylinder_area_ratio', 0.0) or 0.0
        cyl_ratio = getattr(face_result, 'cylinder_ratio', 0.0) or 0.0
        cone_count = face_result.histogram.cone if face_result.histogram else 0
        
        # Get STEP-extracted bends - these are reliable indicators of sheet metal
        step_bends = getattr(self, '_step_bends', [])
        has_significant_bends = len(step_bends) >= 2  # 2+ bends = likely sheet metal
        
        # Get detected wall thickness (more reliable than bbox min_dim for bent parts)
        # For bent enclosures, bbox min_dim might be 60mm+ but actual wall is 1-2mm
        detected_wall = getattr(self, '_detected_thickness', None)
        is_thin_wall = detected_wall is not None and detected_wall < 8.0
        
        # Check 1: High cylindrical surface area (>45%) indicates turning
        # BUT NOT if the part has bends (bent sheet metal has cylinder surfaces from bend radii)
        if cyl_area_ratio > 0.45:
            # Skip CNC override if STEP bends are detected - bends mean sheet metal
            # The presence of bends is strong evidence regardless of dimensions
            if has_significant_bends:
                logger.info(
                    "Skipping cylinder_area_ratio override: %d STEP bends detected - likely bent sheet metal (wall=%.1fmm)",
                    len(step_bends), detected_wall or 0,
                )
                # Don't return - continue to other checks
            else:
                metadata['classification_method'] = 'face_type_cnc_turned_override'
                metadata['reasoning'] = (
                    f"FACE-TYPE ANALYSIS: cylinder_area_ratio {cyl_area_ratio:.1%} "
                    f"indicates CNC turned part (SM={sm_score:.0f}, CNC={cnc_score:.0f})"
                )
                logger.info(
                    "Face classification early override: cylinder_area_ratio %.1f%% - turned part",
                    cyl_area_ratio * 100,
                )
                return ('cnc_turning', 0.85, metadata)
        
        # Check 2: Moderate cylinder ratio with chamfers (cone faces) = turning
        # BUT NOT if significant bends are detected
        if cyl_ratio > 0.40 and cone_count >= 2 and not has_significant_bends:
            metadata['classification_method'] = 'face_type_cnc_turned_chamfered_override'
            metadata['reasoning'] = (
                f"FACE-TYPE ANALYSIS: cylinder_ratio {cyl_ratio:.1%} with "
                f"{cone_count} cone faces (chamfers) indicates CNC turning "
                f"(SM={sm_score:.0f}, CNC={cnc_score:.0f})"
            )
            logger.info(
                "Face classification early override: cylinder_ratio %.1f%% with %d chamfers",
                cyl_ratio * 100, cone_count,
            )
            return ('cnc_turning', 0.85, metadata)
        
        # Check 3: Face classification strongly favors CNC (score gap > 15)
        is_likely_cnc = getattr(face_result, 'is_likely_cnc', False)
        is_likely_sm = getattr(face_result, 'is_likely_sheet_metal', False)
        
        # ACCURACY FIX: Don't override to CNC if paired planes are detected with valid thickness
        has_sheet_metal_evidence = (
            face_result.paired_plane_count >= 1 and
            face_result.dominant_pair_thickness is not None and
            0.4 <= face_result.dominant_pair_thickness <= 6.0
        )
        
        if is_likely_cnc and not is_likely_sm and cnc_score > sm_score + 15 and not has_sheet_metal_evidence:
            metadata['classification_method'] = 'face_type_cnc_score_override'
            metadata['reasoning'] = (
                f"FACE-TYPE ANALYSIS: CNC score {cnc_score:.0f} >> SM score {sm_score:.0f}, "
                f"is_likely_cnc=True, face classification strongly indicates CNC"
            )
            logger.info(
                "Face classification early override: CNC score %d > SM %d + 15",
                cnc_score, sm_score,
            )
            return ('cnc_milling', 0.85, metadata)
        
        # NEW: Get feature signals for additional validation
        feature_cnc_score = 50  # neutral default
        has_varying_thickness = False
        has_tool_radius_fillets = False
        if hasattr(self, '_feature_signals') and self._feature_signals:
            fcs = self._feature_signals
            feature_cnc_score = fcs.feature_cnc_score
            has_varying_thickness = fcs.thickness_uniformity.thickness_count >= 3
            has_tool_radius_fillets = fcs.fillet_analysis.tool_radius_count >= 2

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
            # NEW: Aspect ratio guard for blocky shapes
            # Cube-like shapes (AR < 3) with min_dim > 4mm are not sheet metal
            # EXCEPTION: If dominant_pair_thickness is within sheet metal range
            # (e.g., folded bracket), the bbox min_dim is NOT the sheet thickness
            min_dim = self.metrics.min_dim or 10.0
            has_valid_sheet_thickness = (
                face_result.dominant_pair_thickness is not None
                and 0.3 <= face_result.dominant_pair_thickness <= 8.0
            )
            if aspect_ratio < 3.0 and min_dim > 4.0 and not has_valid_sheet_thickness:
                logger.info(
                    "Face classification says sheet metal (%.0f) but "
                    "blocky shape (AR=%.1f, min_dim=%.1fmm) — deferring to other tiers.",
                    sm_score, aspect_ratio, min_dim,
                )
                return None
            
            # GAP 10 FIX: Use adaptive threshold for machining feature override
            # Override to CNC (defer) if machining features are very strong
            has_strong_cnc_features = (
                self._feature_counts['undercut_count'] > 0 or
                self._feature_counts['pocket_count'] >= 3
            )
            cnc_defer_threshold = 45 if has_strong_cnc_features else 60
            
            if mf_score >= cnc_defer_threshold:
                logger.info(
                    "Face classification says sheet metal (%.0f) but "
                    "machining feature score %.0f — deferring.",
                    sm_score, mf_score,
                )
                return None
            
            # FIX: Check if part has bends - if so, DO NOT override to CNC
            # Bent parts are sheet metal even if they have some CNC-like features
            # Check BOTH heuristic bend detection AND STEP-extracted bends
            step_bends = getattr(self, '_step_bends', [])
            has_actual_bends = (
                (bend_analysis.is_likely_bent and bend_analysis.bend_count >= 1) or
                len(step_bends) >= 1  # STEP/IGES extracted bends are very reliable
            )
            
            # Log bend status for debugging
            if has_actual_bends:
                logger.info(
                    "Part has bends - skipping CNC overrides (heuristic: %s/%d, STEP: %d)",
                    bend_analysis.is_likely_bent, bend_analysis.bend_count, len(step_bends),
                )
            
            # Only apply CNC overrides if there are NO actual bends
            if not has_actual_bends:
                # Override to CNC if feature analysis strongly indicates CNC
                if feature_cnc_score >= 70:
                    logger.info(
                        "Face classification says sheet metal (%.0f) but "
                        "feature analysis score %.0f — CNC override.",
                        sm_score, feature_cnc_score,
                    )
                    metadata['classification_method'] = 'face_type_cnc_feature_override'
                    metadata['reasoning'] = (
                        f"FACE-TYPE says sheet metal but feature analysis "
                        f"indicates CNC (score={feature_cnc_score:.0f})"
                    )
                    return ('cnc_milling', 0.82, metadata)
                
                # Override to CNC if multiple distinct thicknesses
                if has_varying_thickness:
                    logger.info(
                        "Face classification says sheet metal (%.0f) but "
                        "multiple thickness variations — CNC override.",
                        sm_score,
                    )
                    metadata['classification_method'] = 'face_type_cnc_thickness_override'
                    metadata['reasoning'] = (
                        f"FACE-TYPE says sheet metal but varying thicknesses "
                        f"indicate CNC machining (pockets/steps)"
                    )
                    return ('cnc_milling', 0.80, metadata)
                
                # Override to CNC if tool-radius fillets present
                if has_tool_radius_fillets:
                    logger.info(
                        "Face classification says sheet metal (%.0f) but "
                        "tool-radius fillets present — CNC override.",
                        sm_score,
                    )
                    metadata['classification_method'] = 'face_type_cnc_fillet_override'
                    metadata['reasoning'] = (
                        f"FACE-TYPE says sheet metal but R3-R6mm fillets "
                        f"indicate CNC machining"
                    )
                    return ('cnc_milling', 0.78, metadata)

                # Override to CNC if volume efficiency is very high (solid block)
                # BUT: flat sheets with high aspect ratio should NOT be overridden
                # A flat sheet has high vol_eff by design - it fills its bbox
                min_dim = self.metrics.min_dim or 10.0
                is_flat_sheet_profile = (
                    aspect_ratio >= 8.0 and
                    min_dim <= SHEET_METAL_MAX_THICKNESS
                )
                
                if self.metrics.volume_efficiency > 0.80 and aspect_ratio < 4 and not is_flat_sheet_profile:
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

        # GUARD: CNC Turned Parts Detection
        # Turned parts have high cylinder_area_ratio (cylindrical surfaces dominate)
        # They often have thin wall gaps between stepped cylinders that ray-casting
        # incorrectly interprets as sheet metal thickness.
        # HOWEVER: Bent sheet metal also has high cylinder area due to bend radii!
        fc = self._face_classification
        step_bends = getattr(self, '_step_bends', [])
        has_significant_bends = len(step_bends) >= 2
        
        if fc is not None:
            # Check 1: High cylindrical surface area (>45%) indicates turning
            # BUT NOT if significant bends are detected (bent sheet metal)
            cyl_area_ratio = getattr(fc, 'cylinder_area_ratio', 0.0) or 0.0
            if cyl_area_ratio > 0.45 and not has_significant_bends:
                metadata['classification_method'] = 'cnc_turned_part_override'
                metadata['reasoning'] = (
                    f"THICKNESS ANALYSIS detected sheet but cylinder_area_ratio "
                    f"{cyl_area_ratio:.1%} indicates CNC turned part"
                )
                logger.info(
                    "Advanced thickness rejected: high cylinder_area_ratio %.1f%% - turned part",
                    cyl_area_ratio * 100,
                )
                return ('cnc_turning', 0.85, metadata)
            
            # Check 2: Face classification says CNC with good confidence
            cnc_score = getattr(fc, 'cnc_face_score', 0) or 0
            sm_score = getattr(fc, 'sheet_metal_face_score', 0) or 0
            is_likely_cnc = getattr(fc, 'is_likely_cnc', False)
            is_likely_sm = getattr(fc, 'is_likely_sheet_metal', False)
            
            # CNC when face classification strongly favors CNC
            if is_likely_cnc and not is_likely_sm and cnc_score > sm_score + 15:
                metadata['classification_method'] = 'cnc_face_classification_override'
                metadata['reasoning'] = (
                    f"THICKNESS ANALYSIS detected sheet but face classification "
                    f"CNC={cnc_score} vs SM={sm_score}, is_likely_cnc=True"
                )
                logger.info(
                    "Advanced thickness rejected: face classification CNC %d > SM %d",
                    cnc_score, sm_score,
                )
                return ('cnc_milling', 0.85, metadata)
            
            # Check 3: High cylinder_ratio (many cylindrical faces) with cones (chamfers)
            # BUT NOT if significant bends are detected (bent sheet metal)
            cyl_ratio = getattr(fc, 'cylinder_ratio', 0.0) or 0.0
            cone_count = fc.histogram.cone if fc.histogram else 0
            if cyl_ratio > 0.40 and cone_count >= 2 and not has_significant_bends:
                # Many cylinders + cones = turned part with chamfers
                metadata['classification_method'] = 'cnc_turned_chamfered_override'
                metadata['reasoning'] = (
                    f"THICKNESS ANALYSIS detected sheet but cylinder_ratio "
                    f"{cyl_ratio:.1%} with {cone_count} cone faces (chamfers) indicates turning"
                )
                logger.info(
                    "Advanced thickness rejected: cylinder_ratio %.1f%% with %d chamfers",
                    cyl_ratio * 100, cone_count,
                )
                return ('cnc_milling', 0.85, metadata)

        # Check for actual bends (STEP-extracted or heuristic)
        # If bends exist, this is sheet metal even with high machining feature scores
        has_actual_bends = has_significant_bends or (bend_analysis.is_likely_bent and bend_analysis.bend_count >= 1)
        
        # GAP 10 FIX: Require higher threshold and specific feature types
        # Old threshold (50) was too aggressive - tapped holes in sheet metal  
        # could trigger CNC override incorrectly
        # New: Require mf_score >= 65 OR (mf_score >= 50 with undercuts/deep pockets)
        # EXCEPTION: If bends are detected, don't override - it's sheet metal
        has_strong_cnc_features = (
            self._feature_counts['undercut_count'] > 0 or
            self._feature_counts['pocket_count'] >= 3
        )
        cnc_override_threshold = 50 if has_strong_cnc_features else 65
        
        if mf_score >= cnc_override_threshold and not has_actual_bends:
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
        # Check both STEP-extracted bends and heuristic bends
        is_truly_solid = (self.metrics.volume_efficiency > 0.75
                          and aspect_ratio < 5
                          and not has_actual_bends)
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
        """Decide sheet-metal vs CNC for valid sheet-range thickness.
        
        IMPROVED: Better handling of flat sheet profiles with high volume efficiency.
        """
        is_solid = self.metrics.volume_efficiency > 0.75
        is_chunky = aspect_ratio < 5
        mf_score = self._machining_feature_score
        min_dim = self.metrics.min_dim or 10.0
        
        # Check for STEP-extracted bends - bent sheet metal has cylinder surfaces
        step_bends = getattr(self, '_step_bends', [])
        has_significant_bends = len(step_bends) >= 2
        
        # NEW: Guard against misclassifying CNC parts with thin internal walls
        # When face classification shows thick dominant_pair_thickness (>= 8mm),
        # the ray-cast thin wall detection is likely finding walls between machined
        # features, NOT the actual plate thickness. Override to CNC.
        fc = self._face_classification
        if fc is not None:
            # Guard 1: Thick plate override
            if fc.dominant_pair_thickness is not None and fc.dominant_pair_thickness >= 8.0:
                logger.info(
                    "Legacy thickness rejected: dominant_pair_thickness=%.1fmm "
                    "(thick plate), detected %.1fmm is internal wall",
                    fc.dominant_pair_thickness, detected_thickness,
                )
                metadata['classification_method'] = 'cnc_thick_plate_override'
                metadata['reasoning'] = (
                    f"THICKNESS-DETECTED: {detected_thickness:.2f}mm internal wall "
                    f"but dominant_pair_thickness {fc.dominant_pair_thickness:.1f}mm "
                    f"indicates CNC machined plate"
                )
                return ('cnc_milling', 0.85, metadata)
            
            # Guard 2: High cylindrical surface area indicates turning
            # BUT NOT if significant bends are detected (bent sheet metal)
            cyl_area_ratio = getattr(fc, 'cylinder_area_ratio', 0.0) or 0.0
            if cyl_area_ratio > 0.45 and not has_significant_bends:
                logger.info(
                    "Legacy thickness rejected: cylinder_area_ratio %.1f%% - turned part",
                    cyl_area_ratio * 100,
                )
                metadata['classification_method'] = 'cnc_turned_part_override'
                metadata['reasoning'] = (
                    f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but "
                    f"cylinder_area_ratio {cyl_area_ratio:.1%} indicates CNC turned part"
                )
                return ('cnc_turning', 0.85, metadata)
            
            # Guard 3: Face classification strongly favors CNC
            cnc_score = getattr(fc, 'cnc_face_score', 0) or 0
            sm_score = getattr(fc, 'sheet_metal_face_score', 0) or 0
            is_likely_cnc = getattr(fc, 'is_likely_cnc', False)
            is_likely_sm = getattr(fc, 'is_likely_sheet_metal', False)
            
            if is_likely_cnc and not is_likely_sm and cnc_score > sm_score + 15:
                logger.info(
                    "Legacy thickness rejected: face classification CNC %d > SM %d",
                    cnc_score, sm_score,
                )
                metadata['classification_method'] = 'cnc_face_classification_override'
                metadata['reasoning'] = (
                    f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but face "
                    f"classification CNC={cnc_score} vs SM={sm_score} indicates CNC"
                )
                return ('cnc_milling', 0.85, metadata)
            
            # Guard 4: High cylinder_ratio with cone faces (chamfers) = turning
            # BUT NOT if significant bends are detected (bent sheet metal)
            cyl_ratio = getattr(fc, 'cylinder_ratio', 0.0) or 0.0
            cone_count = fc.histogram.cone if fc.histogram else 0
            if cyl_ratio > 0.40 and cone_count >= 2 and not has_significant_bends:
                logger.info(
                    "Legacy thickness rejected: cylinder_ratio %.1f%% with %d chamfers",
                    cyl_ratio * 100, cone_count,
                )
                metadata['classification_method'] = 'cnc_turned_chamfered_override'
                metadata['reasoning'] = (
                    f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but "
                    f"cylinder_ratio {cyl_ratio:.1%} with {cone_count} chamfers indicates turning"
                )
                return ('cnc_milling', 0.85, metadata)
        
        # NEW: Early rejection of cube-like shapes
        # Parts with AR < 3 and min_dim > 4mm should not be sheet metal
        # unless they have clear bend evidence (heuristic OR STEP-extracted)
        has_bend_evidence = bend_analysis.is_likely_bent or has_significant_bends
        if aspect_ratio < 3.0 and min_dim > 4.0 and not has_bend_evidence:
            logger.info(
                "Legacy thickness rejected: cube-like shape (AR=%.1f, min_dim=%.1fmm)",
                aspect_ratio, min_dim,
            )
            return None  # Defer to other tiers
        
        # Check for flat sheet profile (high AR + thin = flat sheet)
        # Check for flat sheet profile (high AR + thin = flat sheet)
        is_flat_sheet_profile = aspect_ratio >= 8.0 and min_dim <= SHEET_METAL_MAX_THICKNESS

        # GAP 10 FIX: Same logic as _advanced_sheet_or_cnc_guard
        # Strong machining features → CNC regardless of thickness
        # But require higher threshold (65) unless strong CNC indicators present
        # EXCEPTION: If bends are detected, don't override - it's sheet metal
        has_strong_cnc_features = (
            self._feature_counts['undercut_count'] > 0 or
            self._feature_counts['pocket_count'] >= 3
        )
        cnc_override_threshold = 50 if has_strong_cnc_features else 65
        
        if mf_score >= cnc_override_threshold and not has_bend_evidence:
            metadata['classification_method'] = 'cnc_feature_override'
            metadata['reasoning'] = (
                f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but "
                f"machining features score {mf_score:.0f} — CNC override"
            )
            return ('cnc_milling', 0.85, metadata)

        # Flat sheet (high aspect ratio) - handles both very flat and moderately flat
        if aspect_ratio >= 10:
            confidence = 0.90 + (thickness_confidence * 0.08)
            metadata['classification_method'] = 'thickness_flat_sheet'
            metadata['reasoning'] = (
                f"THICKNESS-DETECTED: {detected_thickness:.2f}mm "
                f"with high aspect ratio {aspect_ratio:.1f}:1 - flat sheet metal"
            )
            return ('sheet_metal', confidence, metadata)

        # Solid + chunky → CNC (only if NO bends detected and NOT a flat profile)
        # Check both heuristic bends and STEP-extracted bends
        if is_solid and is_chunky and not has_bend_evidence and not is_flat_sheet_profile:
            metadata['classification_method'] = 'cnc_override'
            metadata['reasoning'] = (
                f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but chunky solid "
                f"(vol eff: {self.metrics.volume_efficiency:.2f}, "
                f"aspect: {aspect_ratio:.1f}:1) indicates CNC"
            )
            return ('cnc_milling', 0.85, metadata)

        # Moderately solid, not quite flat — bent parts override CNC fallback
        if self.metrics.volume_efficiency > 0.50 and aspect_ratio < 10:
            if has_bend_evidence:
                bend_count = bend_analysis.bend_count if bend_analysis.is_likely_bent else len(step_bends)
                confidence = 0.80
                reasoning = (f"THICKNESS-DETECTED: {detected_thickness:.2f}mm "
                             f"with {bend_count} bends, bent sheet metal")
            elif self.metrics.volume_efficiency > 0.70 and not is_flat_sheet_profile:
                # Only classify as CNC if NOT a flat sheet profile
                metadata['classification_method'] = 'cnc_fallback'
                metadata['reasoning'] = (
                    f"THICKNESS-DETECTED: {detected_thickness:.2f}mm but no bends and "
                    f"high volume efficiency {self.metrics.volume_efficiency:.2f} suggests CNC"
                )
                return ('cnc_milling', 0.70, metadata)
            else:
                # Moderate volume efficiency without bends — still likely sheet metal
                confidence = 0.75 if is_flat_sheet_profile else 0.70
                reasoning = (f"THICKNESS-DETECTED: {detected_thickness:.2f}mm "
                             f"moderate solidity, likely sheet metal")
        else:
            base_conf = 0.85 + (thickness_confidence * 0.10)
            if has_bend_evidence:
                bend_count = bend_analysis.bend_count if bend_analysis.is_likely_bent else len(step_bends)
                confidence = min(0.98, base_conf + 0.05)
                reasoning = (f"THICKNESS-DETECTED: {detected_thickness:.2f}mm wall "
                             f"thickness with {bend_count} bends")
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

        # Guard 2b: Face classification says NOT sheet metal AND no paired planes
        # This catches machining parts that have edge-detected "bends" (from holes, chamfers)
        # but no actual sheet metal characteristics
        if fc is not None and not fc.is_likely_sheet_metal and fc.dominant_pair_thickness is None:
            # Additional check: if cylinder ratio is high (>25%), likely has drilled holes
            if fc.cylinder_ratio > 0.25:
                logger.info(
                    "Bend detection suppressed: face classification says NOT sheet metal "
                    "and no paired planes (cyl_ratio=%.1f%%, SM=%.0f, CNC=%.0f)",
                    fc.cylinder_ratio * 100, fc.sheet_metal_face_score, fc.cnc_face_score,
                )
                return None

        # Guard 3: Solid block with high volume efficiency
        # FIX: STEP-extracted bends are reliable even with high volume efficiency
        # A U-channel (2 bends) can have vol_eff > 0.65 but is still sheet metal
        has_step_bends = len(getattr(self, '_step_bends', [])) > 0
        if self.metrics.volume_efficiency > 0.65:
            # For STEP bends, allow 2+ bends with high confidence
            # For heuristic bends, require 4+ bends (more false positives)
            if has_step_bends:
                min_bends_required = 1  # STEP bends are reliable
                min_confidence = 0.60
            else:
                min_bends_required = 4  # Heuristic bends need more evidence
                min_confidence = 0.70
            
            if bend_analysis.bend_count < min_bends_required or bend_analysis.confidence < min_confidence:
                logger.info(
                    "Bend detection suppressed: high volume efficiency %.2f "
                    "with only %d bends (conf=%.2f, step_bends=%s)",
                    self.metrics.volume_efficiency,
                    bend_analysis.bend_count,
                    bend_analysis.confidence,
                    has_step_bends,
                )
                return None

        # Guard 4: No thin wall detected — require stricter evidence
        # FIX: STEP-extracted bends are reliable even without thickness detection
        has_thin_wall = (
            metadata.get('detected_thickness') is not None
            and 0.3 <= metadata['detected_thickness'] <= 10.0
        )
        if not has_thin_wall:
            # STEP bends: allow ≥2 bends (reliable)
            # Heuristic bends: require ≥3 bends with higher confidence
            if has_step_bends:
                min_bends_required = 2
                min_confidence = 0.55
            else:
                min_bends_required = 3
                min_confidence = 0.65
            
            if bend_analysis.bend_count < min_bends_required or bend_analysis.confidence < min_confidence:
                logger.info(
                    "Bend detection suppressed: no thin wall detected and "
                    "only %d bends (conf=%.2f, step_bends=%s)",
                    bend_analysis.bend_count,
                    bend_analysis.confidence,
                    has_step_bends,
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
        """Classify thin + high-aspect parts. Returns result or None.

        IMPROVED: No longer penalizes high volume efficiency for flat sheets.
        A flat sheet (thin + high AR) naturally fills its bounding box,
        giving vol_eff ≈ 1.0, which should NOT trigger CNC classification.
        """
        if min_dim >= 8 or aspect_ratio <= 5:
            return None

        # FIXED: Don't classify as CNC based on volume efficiency alone
        # for parts with flat sheet profile (high AR + thin min_dim).
        # Flat sheets have HIGH vol_eff by design - they fill their bbox.
        is_flat_sheet_profile = aspect_ratio >= 8.0 and min_dim <= SHEET_METAL_MAX_THICKNESS
        
        if self.metrics.volume_efficiency > 0.75 and not is_flat_sheet_profile:
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

        # Flat sheet profile with high aspect ratio gets higher confidence
        if is_flat_sheet_profile:
            confidence = 0.88 if aspect_ratio > 15 else 0.82
        else:
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
        """Classify cylindrical parts as CNC turning. Returns result or None.
        
        ENHANCED: Now uses face classification to analyze:
        - Cylinder area ratio (high = cylindrical body = turning)
        - Revolution surface count (lathe features)
        - Torus surfaces (grooves, undercuts on turned parts)
        
        Original heuristic (xy_sim) is kept as fallback.
        """
        min_val = self.metrics.min_dim or 1.0
        mid_val = self.metrics.mid_dim or 1.0
        max_val = self.metrics.max_dim or 1.0
        
        # Method 1: XY similarity (original heuristic)
        # GAP 7 FIX: Relaxed from 0.15 to better handle D-cut shafts
        # D-cut shaft: shaft with flat machined into it has min < mid due to the flat
        # This gives xy_sim ~0.15-0.30 which was failing the old threshold
        xy_sim = abs(min_val - mid_val) / max(min_val, mid_val)
        is_geometric_cylinder = (
            xy_sim < 0.10 and  # Strict match for perfect cylinders
            aspect_ratio > 1.5 and 
            self.metrics.volume_efficiency > 0.6
        )
        # D-cut/keyed shafts: slightly higher xy_sim but still elongated
        is_dcut_shaft = (
            0.10 <= xy_sim < 0.35 and  # D-cut has slightly asymmetric cross-section
            aspect_ratio > 2.0 and  # Must be elongated
            self.metrics.volume_efficiency > 0.55  # Slightly lower due to flat
        )
        
        # Method 2: Face classification signals (more reliable)
        fc = self._face_classification
        is_face_based_turning = False
        turning_confidence = 0.0
        reasoning_parts = []
        
        if fc is not None:
            histogram = fc.histogram if hasattr(fc, 'histogram') else None
            
            # Cylinder area ratio: turned parts have high cylindrical surface area
            # Sheet metal holes have high count but low area
            cylinder_area = fc.cylinder_area_ratio if hasattr(fc, 'cylinder_area_ratio') else 0.0
            
            # Revolution surfaces indicate lathe operations
            revolution_count = histogram.revolution if histogram else 0
            
            # Torus surfaces indicate grooves/undercuts on turned parts
            torus_count = histogram.torus if histogram else 0
            
            # High cylinder area (>40%) + low plane area = likely turning
            plane_area = fc.plane_area_ratio if hasattr(fc, 'plane_area_ratio') else 0.0
            
            # Scoring for turning
            turning_score = 0.0
            
            # Large cylindrical surface area is strong indicator
            if cylinder_area > 0.5:
                turning_score += 35
                reasoning_parts.append(f"high cylinder area ({cylinder_area:.0%})")
            elif cylinder_area > 0.35:
                turning_score += 25
                reasoning_parts.append(f"moderate cylinder area ({cylinder_area:.0%})")
            elif cylinder_area > 0.25:
                turning_score += 10
            
            # Revolution surfaces are definitive lathe features
            if revolution_count > 0:
                turning_score += min(25, 10 + revolution_count * 5)
                reasoning_parts.append(f"{revolution_count} revolution surfaces")
            
            # Torus surfaces (grooves)
            if torus_count > 0:
                turning_score += min(15, 5 + torus_count * 3)
                reasoning_parts.append(f"{torus_count} torus grooves")
            
            # Low plane area ratio supports turning
            if plane_area < 0.2 and cylinder_area > 0.3:
                turning_score += 10
            
            # AUDIT FIX: Detect milling features on turning-like bodies
            # Cross-holes, flats, pockets indicate turn-mill or milling operations
            milling_penalty = 0.0
            milling_indicators = []
            
            # Check for cross-holes (holes perpendicular to turning axis)
            if hasattr(self, '_hole_features') and self._hole_features:
                # Most turning parts have Z-axis as rotation axis
                cross_hole_count = 0
                for hole in self._hole_features:
                    hole_axis = getattr(hole, 'axis', None)
                    if hole_axis:
                        # If hole axis is roughly perpendicular to Z (cross-drilled)
                        z_component = abs(hole_axis[2]) if len(hole_axis) >= 3 else 1.0
                        if z_component < 0.5:  # Not aligned with Z axis
                            cross_hole_count += 1
                if cross_hole_count > 0:
                    milling_penalty += min(20, 8 + cross_hole_count * 4)
                    milling_indicators.append(f"{cross_hole_count} cross-holes")
            
            # Check for pockets (definitely milling)
            if self._feature_counts.get('pocket_count', 0) >= 2:
                milling_penalty += min(25, 10 + self._feature_counts['pocket_count'] * 5)
                milling_indicators.append(f"{self._feature_counts['pocket_count']} pockets")
            
            # Check for slots (milling feature)
            if self._feature_counts.get('slot_count', 0) >= 1:
                milling_penalty += min(15, 5 + self._feature_counts['slot_count'] * 3)
                milling_indicators.append(f"{self._feature_counts['slot_count']} slots")
            
            # Apply milling penalty to turning score
            turning_score -= milling_penalty
            if milling_indicators:
                reasoning_parts.append(f"milling features penalty: {', '.join(milling_indicators)}")
                
            # XY similarity + face signals = high confidence
            # GAP 7 FIX: Relaxed threshold and add D-cut detection
            if xy_sim < 0.10 and aspect_ratio > 1.5:
                turning_score += 15
                reasoning_parts.append("perfect cylindrical symmetry")
            elif 0.10 <= xy_sim < 0.35 and aspect_ratio > 2.0 and cylinder_area > 0.3:
                # D-cut shaft: asymmetric but still predominantly cylindrical
                turning_score += 10
                reasoning_parts.append(f"D-cut/keyed shaft geometry (xy_sim={xy_sim:.2f})")
                
            # Threshold: 50+ for turning
            if turning_score >= 50:
                is_face_based_turning = True
                turning_confidence = min(0.95, 0.75 + turning_score / 500)
        
        # Decision
        if is_face_based_turning:
            reasoning = "TURNING DETECTED: " + ", ".join(reasoning_parts) if reasoning_parts else "Revolution body geometry"
            return ('cnc_turning', turning_confidence, {
                **metadata,
                'classification_method': 'face_based_turning',
                'reasoning': reasoning,
            })
        
        # Fallback to geometric heuristic
        if is_geometric_cylinder:
            return ('cnc_turning', 0.85, {
                **metadata,
                'classification_method': 'geometry_cylindrical',
                'reasoning': 'Cylindrical geometry with rotational symmetry (XY similarity)',
            })
        
        # D-cut shaft fallback (when face classification unavailable)
        if is_dcut_shaft:
            return ('cnc_turning', 0.75, {
                **metadata,
                'classification_method': 'geometry_dcut_shaft',
                'reasoning': 'D-cut/keyed shaft geometry (elongated with slight XY asymmetry)',
            })
        
        return None

    def _try_weldment_classification(self, metadata):
        """Tier 7: Weldment detection using weldment_analysis results.
        
        Identifies welded assemblies vs assemblies requiring manual quote.
        """
        if not hasattr(self, '_weldment_analysis') or self._weldment_analysis is None:
            return None
            
        weldment = self._weldment_analysis
        
        # Check if weldment analysis indicates a welded structure
        is_weldment = getattr(weldment, 'is_weldment', False)
        weld_joint_count = getattr(weldment, 'joint_count', 0)  # Correct attr name
        weld_confidence = getattr(weldment, 'confidence', 0.0)
        
        if is_weldment and weld_joint_count > 0 and weld_confidence >= 0.6:
            logger.info(
                "WELDMENT detected: %d joints, confidence=%.2f",
                weld_joint_count, weld_confidence
            )
            return ('weldment', weld_confidence, {
                **metadata,
                'classification_method': 'weldment_analysis',
                'reasoning': f"Welded structure with {weld_joint_count} weld joints detected",
                'weld_joint_count': weld_joint_count,
            })
        
        return None

    def _try_casting_classification(self, metadata):
        """Tier 8: Casting detection using casting_analysis results.
        
        Identifies die-cast, sand-cast, or investment-cast parts.
        """
        if not hasattr(self, '_casting_analysis') or self._casting_analysis is None:
            return None
            
        casting = self._casting_analysis
        
        # Check casting indicators
        is_likely_cast = getattr(casting, 'is_likely_cast', False)
        casting_confidence = getattr(casting, 'confidence', 0.0)
        casting_process = getattr(casting, 'recommended_casting_process', None)  # Correct attr name
        
        # Also check draft analysis for injection molding indicators
        draft_compat = getattr(self, '_draft_compatibility', {})
        injection_candidate = draft_compat.get('injection_molding_candidate', False)
        
        if is_likely_cast and casting_confidence >= 0.65:
            # Determine specific casting type - compare with enum value
            if casting_process is not None:
                cp_value = casting_process.value if hasattr(casting_process, 'value') else str(casting_process)
            else:
                cp_value = ''
                
            if cp_value == 'die_casting':
                process_type = 'die_casting'
            elif cp_value == 'investment_casting':
                process_type = 'investment_casting'
            elif cp_value == 'sand_casting':
                process_type = 'sand_casting'
            else:
                process_type = 'die_casting'  # Default to die casting
                
            logger.info(
                "CASTING detected: process=%s, confidence=%.2f",
                process_type, casting_confidence
            )
            return (process_type, casting_confidence, {
                **metadata,
                'classification_method': 'casting_analysis',
                'reasoning': f"Casting indicators detected: {process_type}",
            })
        
        # Check for injection molding (plastic parts)
        if injection_candidate and draft_compat.get('avg_draft_angle', 0) >= 1.0:
            logger.info("INJECTION MOLDING candidate detected")
            return ('injection_molding', 0.75, {
                **metadata,
                'classification_method': 'draft_analysis_injection',
                'reasoning': "Part has proper draft angles suitable for injection molding",
            })
        
        return None

    def _try_5axis_classification(self, metadata):
        """Tier 9: 5-axis machining detection.
        
        Identifies parts requiring 5-axis machining due to undercuts or multi-direction access.
        """
        # Check machining complexity analysis
        if hasattr(self, '_machining_complexity_analysis') and self._machining_complexity_analysis is not None:
            mc = self._machining_complexity_analysis
            requires_5axis = getattr(mc, 'requires_5axis', False)
            # access_direction_count is on milling_complexity, not top-level
            mc_milling = getattr(mc, 'milling_complexity', None)
            access_direction_count = getattr(mc_milling, 'access_direction_count', 1) if mc_milling else 1
            
            if requires_5axis or access_direction_count > 3:
                logger.info(
                    "5-AXIS required: access_directions=%d, requires_5axis=%s",
                    access_direction_count, requires_5axis
                )
                return ('cnc_5axis', 0.85, {
                    **metadata,
                    'classification_method': '5axis_complexity',
                    'reasoning': f"Multi-axis machining required ({access_direction_count} access directions)",
                })
        
        # Fallback: check undercuts
        undercut_count = self._feature_counts.get('undercut_count', 0)
        if undercut_count >= 2:
            logger.info("5-AXIS suggested due to %d undercuts", undercut_count)
            return ('cnc_5axis', 0.75, {
                **metadata,
                'classification_method': '5axis_undercuts',
                'reasoning': f"Multiple undercuts ({undercut_count}) suggest 5-axis machining",
            })
        
        return None

    def _try_turn_mill_classification(self, metadata, holes=None):
        """Tier 10: Turn-mill detection.
        
        Identifies turned parts with cross-drilled holes or milling features.
        """
        # Check machining complexity analysis
        if hasattr(self, '_machining_complexity_analysis') and self._machining_complexity_analysis is not None:
            mc = self._machining_complexity_analysis
            is_turn_mill = getattr(mc, 'is_turn_mill', False)
            
            if is_turn_mill:
                logger.info("TURN-MILL detected from machining complexity analysis")
                return ('cnc_turn_mill', 0.85, {
                    **metadata,
                    'classification_method': 'turn_mill_analysis',
                    'reasoning': "Turn-mill hybrid: turning with live tooling required",
                })
        
        # Check face classification for turning characteristics + cross holes
        fc = self._face_classification
        if fc is not None:
            revolution_ratio = getattr(fc, 'revolution_ratio', 0.0)
            cylinder_ratio = fc.cylinder_ratio
            
            # High revolution/cylinder ratio indicates turning base
            is_turning_base = (revolution_ratio > 0.3 or cylinder_ratio > 0.4)
            
            if is_turning_base:
                # Check for cross-drilled holes (holes not aligned with rotation axis)
                cross_holes = 0
                slot_count = self._feature_counts.get('slot_count', 0)
                pocket_count = self._feature_counts.get('pocket_count', 0)
                
                # Use stored hole features if available
                if hasattr(self, '_hole_features') and self._hole_features:
                    for hole in self._hole_features:
                        hole_axis = getattr(hole, 'axis', None)
                        if hole_axis and len(hole_axis) >= 3:
                            z_component = abs(hole_axis[2])
                            if z_component < 0.5:  # Perpendicular to Z
                                cross_holes += 1
                
                # Turn-mill if turned part has milling features
                if cross_holes > 0 or slot_count > 0 or pocket_count > 0:
                    milling_features = []
                    if cross_holes > 0:
                        milling_features.append(f"{cross_holes} cross-holes")
                    if slot_count > 0:
                        milling_features.append(f"{slot_count} slots")
                    if pocket_count > 0:
                        milling_features.append(f"{pocket_count} pockets")
                    
                    logger.info("TURN-MILL detected: turning base with %s", milling_features)
                    return ('cnc_turn_mill', 0.80, {
                        **metadata,
                        'classification_method': 'turn_mill_features',
                        'reasoning': f"Turned part with milling features: {', '.join(milling_features)}",
                    })
        
        return None

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
                # GAP FIX: Pass feature_signals, undercuts, draft_analysis to ML
                feature_signals=self._feature_signals.to_dict() if hasattr(self, '_feature_signals') and self._feature_signals else None,
                undercuts=getattr(self, '_undercuts', None),
                draft_analysis=getattr(self, '_draft_compatibility', None),
                # Extended analysis results for new process detection
                surface_finish_analysis=getattr(self, '_surface_finish_analysis', None),
                tolerance_analysis=getattr(self, '_tolerance_analysis', None),
                machining_complexity=getattr(self, '_machining_complexity_analysis', None),
                casting_analysis=getattr(self, '_casting_analysis', None),
                weldment_analysis=getattr(self, '_weldment_analysis', None),
                body_count=getattr(self, '_body_count', 1),
            )
            return ProcessClassifier._ml_classifier.predict(fv)
        except Exception as exc:
            logger.warning("ML consultation failed: %s", exc)
            return None
