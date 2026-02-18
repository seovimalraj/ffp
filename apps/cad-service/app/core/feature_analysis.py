"""
Feature-based classification signals.

Analyzes extracted features (holes, pockets, fillets) to produce
discriminating signals for sheet metal vs CNC classification.

Key discriminators:
1. Hole depth/diameter ratio: D/d < 1.0 = punched, D/d > 3.0 = drilled
2. Pocket depth: > 10mm or multi-step = CNC
3. Fillet radius: R3-R6mm = CNC tool radius, ≤R2mm = bend relief
4. Thickness uniformity: one consistent thickness = sheet metal
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)


@dataclass
class HoleAnalysis:
    """Analysis of hole features for process classification."""
    total_count: int = 0
    punched_count: int = 0  # D/d < 1.0 (shallow, likely punched)
    drilled_count: int = 0  # D/d > 3.0 (deep, definitely drilled)
    intermediate_count: int = 0  # 1.0 <= D/d <= 3.0 (ambiguous)
    
    avg_depth_ratio: float = 0.0
    max_depth_ratio: float = 0.0
    
    # Classification signal: -1.0 (sheet metal) to +1.0 (CNC)
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class PocketAnalysis:
    """Analysis of pocket features for process classification."""
    total_count: int = 0
    deep_pocket_count: int = 0  # depth > 10mm
    multi_step_count: int = 0  # step_count > 1
    tool_radius_count: int = 0  # corner_radius in R3-R6mm range
    through_count: int = 0  # through pockets (more sheet-metal-like)
    
    max_depth_mm: float = 0.0
    avg_depth_mm: float = 0.0
    
    # Classification signal: -1.0 (sheet metal) to +1.0 (CNC)
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class FilletAnalysis:
    """Analysis of fillet features for process classification."""
    total_count: int = 0
    tool_radius_count: int = 0  # R3-R6mm (CNC tool radius)
    bend_relief_count: int = 0  # ≤R2mm (sheet metal bend relief)
    large_radius_count: int = 0  # > R6mm
    
    avg_radius_mm: float = 0.0
    
    # Classification signal: -1.0 (sheet metal) to +1.0 (CNC)
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass 
class ThicknessUniformity:
    """Analysis of wall thickness uniformity."""
    is_uniform: bool = False  # True if single consistent thickness
    dominant_thickness_mm: float = 0.0
    thickness_std_dev: float = 0.0
    thickness_count: int = 0  # Number of distinct thicknesses
    coverage_ratio: float = 0.0  # Fraction of area at dominant thickness
    
    # Classification signal: -1.0 (sheet metal/uniform) to +1.0 (CNC/varying)
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class HolePatternAnalysis:
    """Analysis of hole placement patterns for sheet metal vs CNC detection."""
    total_count: int = 0
    is_regular_pattern: bool = False  # Grid or linear pattern (sheet metal)
    is_irregular_pattern: bool = False  # Random placement (CNC)
    grid_score: float = 0.0  # 0-1, how grid-like
    linear_score: float = 0.0  # 0-1, how linear
    circular_pattern: bool = False  # Bolt circle pattern
    countersink_count: int = 0
    counterbore_count: int = 0
    
    # Classification signal
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class SurfaceStepAnalysis:
    """Analysis of planar surface Z-levels for detecting CNC step machining."""
    distinct_levels: int = 0  # Number of distinct Z heights
    step_heights: List[float] = field(default_factory=list)
    max_step_height_mm: float = 0.0
    avg_step_height_mm: float = 0.0
    is_stepped_part: bool = False  # >3 levels = CNC stepped
    
    # Classification signal: >3 levels strongly indicates CNC
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class ChamferAnalysis:
    """Analysis of chamfers for CNC vs sheet metal detection."""
    total_count: int = 0
    standard_45deg_count: int = 0  # Standard 45° chamfers (CNC)
    edge_break_count: int = 0  # Small edge breaks (<0.5mm, sheet metal)
    large_chamfer_count: int = 0  # Large chamfers (>2mm)
    
    avg_leg_size_mm: float = 0.0
    
    # Classification signal
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class RibAnalysis:
    """Analysis of thin-wall ribs for CNC machining detection.
    
    Thin-wall ribs are common in CNC-machined parts for structural
    reinforcement without adding excessive material. They're created
    by removing material from both sides, leaving a thin standing wall.
    """
    total_count: int = 0
    avg_rib_height_mm: float = 0.0
    avg_rib_thickness_mm: float = 0.0
    max_height_to_thickness_ratio: float = 0.0
    
    # Classification signal: ribs strongly indicate CNC
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class BossAnalysis:
    """Analysis of bosses (raised cylindrical features) for CNC detection.
    
    Bosses are raised cylindrical features used for mounting, alignment,
    or bearing surfaces. They require material removal around them,
    indicating CNC milling.
    """
    total_count: int = 0
    avg_boss_height_mm: float = 0.0
    avg_boss_diameter_mm: float = 0.0
    threaded_count: int = 0  # Bosses with threaded holes
    
    # Classification signal
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class BendRadiusAnalysis:
    """Analysis of bend radius to thickness ratio for sheet metal validation.
    
    For proper sheet metal, bend radius should typically be 0.5x to 2x
    material thickness. Very small radii (<0.5t) suggest CNC machining
    or specialty forming. Very large radii (>3t) may indicate cast/machined.
    """
    total_count: int = 0
    avg_radius_mm: float = 0.0
    avg_radius_to_thickness: float = 0.0  # R/t ratio
    valid_ratio_count: int = 0  # Bends with R/t in 0.5-2.0 range
    tight_radius_count: int = 0  # R/t < 0.5 (very tight)
    large_radius_count: int = 0  # R/t > 3.0 (large)
    
    # Classification signal: -1.0 (sheet metal) to +1.0 (CNC)
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class EdgeSharpnessAnalysis:
    """Analysis of edge sharpness for process classification.
    
    Key discriminators:
    - Sharp edges (no fillet/chamfer) at intersections: May indicate casting or machined
    - Uniform small edge breaks: Sheet metal (deburring)
    - Varying radius fillets: CNC machined
    """
    total_edge_count: int = 0
    sharp_edge_count: int = 0  # No fillet/chamfer
    filleted_edge_count: int = 0  # Has fillet
    chamfered_edge_count: int = 0  # Has chamfer
    
    avg_edge_treatment_mm: float = 0.0  # Average fillet/chamfer size
    sharp_edge_ratio: float = 0.0  # Fraction of edges that are sharp
    
    # Classification signal
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class SlotAnalysis:
    """Analysis of slot features for process classification.
    
    Key discriminators:
    - Through slots (no base): Sheet metal cutouts
    - Blind slots (has base): CNC machining
    - T-slots: Definitely CNC machining
    - Slot depth/width ratio: High ratio = CNC
    """
    total_count: int = 0
    through_count: int = 0  # Through slots (sheet metal compatible)
    blind_count: int = 0  # Blind slots (require CNC)
    t_slot_count: int = 0  # T-slots (definitely CNC)
    keyway_count: int = 0  # Keyways (precision machining)
    
    avg_depth_mm: float = 0.0
    avg_length_mm: float = 0.0
    avg_width_mm: float = 0.0
    max_depth_to_width: float = 0.0  # High ratio = CNC
    
    # Classification signal: -1.0 (sheet metal) to +1.0 (CNC)
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class ThreadAnalysis:
    """Analysis of thread features for precision machining detection.
    
    Key discriminators:
    - Fine pitch threads (pitch < 1.0mm): High precision, definitely CNC
    - Coarse pitch: Standard machining
    - External threads: Likely turned on lathe
    - Internal threads: Drilled and tapped (CNC)
    """
    total_count: int = 0
    internal_count: int = 0
    external_count: int = 0
    fine_pitch_count: int = 0  # pitch < 1.0mm
    coarse_pitch_count: int = 0  # pitch >= 1.0mm
    
    avg_pitch_mm: float = 0.0
    min_pitch_mm: float = 0.0
    
    # Fine pitch threads strongly indicate precision CNC
    is_precision_threading: bool = False
    
    # Classification signal
    cnc_signal: float = 0.0
    reasoning: str = ""


@dataclass
class FeatureClassificationSignals:
    """Combined feature analysis signals for classification."""
    hole_analysis: HoleAnalysis = field(default_factory=HoleAnalysis)
    pocket_analysis: PocketAnalysis = field(default_factory=PocketAnalysis)
    fillet_analysis: FilletAnalysis = field(default_factory=FilletAnalysis)
    thickness_uniformity: ThicknessUniformity = field(default_factory=ThicknessUniformity)
    
    # New analysis types
    hole_pattern_analysis: HolePatternAnalysis = field(default_factory=HolePatternAnalysis)
    surface_step_analysis: SurfaceStepAnalysis = field(default_factory=SurfaceStepAnalysis)
    chamfer_analysis: ChamferAnalysis = field(default_factory=ChamferAnalysis)
    rib_analysis: RibAnalysis = field(default_factory=RibAnalysis)
    boss_analysis: BossAnalysis = field(default_factory=BossAnalysis)
    bend_radius_analysis: BendRadiusAnalysis = field(default_factory=BendRadiusAnalysis)
    edge_sharpness_analysis: EdgeSharpnessAnalysis = field(default_factory=EdgeSharpnessAnalysis)
    
    # GAP FIX: Add slot and thread analysis (previously missing)
    slot_analysis: SlotAnalysis = field(default_factory=SlotAnalysis)
    thread_analysis: ThreadAnalysis = field(default_factory=ThreadAnalysis)
    
    # Overall feature-based CNC score (0-100)
    # Higher = more likely CNC
    feature_cnc_score: float = 0.0
    
    # Detailed reasoning
    reasoning: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hole_analysis": {
                "total_count": self.hole_analysis.total_count,
                "punched_count": self.hole_analysis.punched_count,
                "drilled_count": self.hole_analysis.drilled_count,
                "avg_depth_ratio": round(self.hole_analysis.avg_depth_ratio, 2),
                "max_depth_ratio": round(self.hole_analysis.max_depth_ratio, 2),
                "cnc_signal": round(self.hole_analysis.cnc_signal, 2),
            },
            "pocket_analysis": {
                "total_count": self.pocket_analysis.total_count,
                "deep_pocket_count": self.pocket_analysis.deep_pocket_count,
                "multi_step_count": self.pocket_analysis.multi_step_count,
                "tool_radius_count": self.pocket_analysis.tool_radius_count,
                "max_depth_mm": round(self.pocket_analysis.max_depth_mm, 2),
                "cnc_signal": round(self.pocket_analysis.cnc_signal, 2),
            },
            "fillet_analysis": {
                "total_count": self.fillet_analysis.total_count,
                "tool_radius_count": self.fillet_analysis.tool_radius_count,
                "bend_relief_count": self.fillet_analysis.bend_relief_count,
                "avg_radius_mm": round(self.fillet_analysis.avg_radius_mm, 2),
                "cnc_signal": round(self.fillet_analysis.cnc_signal, 2),
            },
            "thickness_uniformity": {
                "is_uniform": self.thickness_uniformity.is_uniform,
                "dominant_thickness_mm": round(self.thickness_uniformity.dominant_thickness_mm, 2),
                "thickness_count": self.thickness_uniformity.thickness_count,
                "coverage_ratio": round(self.thickness_uniformity.coverage_ratio, 2),
                "cnc_signal": round(self.thickness_uniformity.cnc_signal, 2),
            },
            "hole_pattern_analysis": {
                "total_count": self.hole_pattern_analysis.total_count,
                "is_regular_pattern": self.hole_pattern_analysis.is_regular_pattern,
                "is_irregular_pattern": self.hole_pattern_analysis.is_irregular_pattern,
                "countersink_count": self.hole_pattern_analysis.countersink_count,
                "counterbore_count": self.hole_pattern_analysis.counterbore_count,
                "cnc_signal": round(self.hole_pattern_analysis.cnc_signal, 2),
            },
            "surface_step_analysis": {
                "distinct_levels": self.surface_step_analysis.distinct_levels,
                "is_stepped_part": self.surface_step_analysis.is_stepped_part,
                "max_step_height_mm": round(self.surface_step_analysis.max_step_height_mm, 2),
                "cnc_signal": round(self.surface_step_analysis.cnc_signal, 2),
            },
            "chamfer_analysis": {
                "total_count": self.chamfer_analysis.total_count,
                "standard_45deg_count": self.chamfer_analysis.standard_45deg_count,
                "edge_break_count": self.chamfer_analysis.edge_break_count,
                "cnc_signal": round(self.chamfer_analysis.cnc_signal, 2),
            },
            "rib_analysis": {
                "total_count": self.rib_analysis.total_count,
                "avg_rib_height_mm": round(self.rib_analysis.avg_rib_height_mm, 2),
                "avg_rib_thickness_mm": round(self.rib_analysis.avg_rib_thickness_mm, 2),
                "max_height_to_thickness_ratio": round(self.rib_analysis.max_height_to_thickness_ratio, 2),
                "cnc_signal": round(self.rib_analysis.cnc_signal, 2),
            },
            "boss_analysis": {
                "total_count": self.boss_analysis.total_count,
                "avg_boss_height_mm": round(self.boss_analysis.avg_boss_height_mm, 2),
                "avg_boss_diameter_mm": round(self.boss_analysis.avg_boss_diameter_mm, 2),
                "threaded_count": self.boss_analysis.threaded_count,
                "cnc_signal": round(self.boss_analysis.cnc_signal, 2),
            },
            "bend_radius_analysis": {
                "total_count": self.bend_radius_analysis.total_count,
                "avg_radius_mm": round(self.bend_radius_analysis.avg_radius_mm, 2),
                "avg_radius_to_thickness": round(self.bend_radius_analysis.avg_radius_to_thickness, 2),
                "valid_ratio_count": self.bend_radius_analysis.valid_ratio_count,
                "tight_radius_count": self.bend_radius_analysis.tight_radius_count,
                "large_radius_count": self.bend_radius_analysis.large_radius_count,
                "cnc_signal": round(self.bend_radius_analysis.cnc_signal, 2),
            },
            "edge_sharpness_analysis": {
                "total_edge_count": self.edge_sharpness_analysis.total_edge_count,
                "sharp_edge_count": self.edge_sharpness_analysis.sharp_edge_count,
                "filleted_edge_count": self.edge_sharpness_analysis.filleted_edge_count,
                "chamfered_edge_count": self.edge_sharpness_analysis.chamfered_edge_count,
                "sharp_edge_ratio": round(self.edge_sharpness_analysis.sharp_edge_ratio, 2),
                "cnc_signal": round(self.edge_sharpness_analysis.cnc_signal, 2),
            },
            "slot_analysis": {
                "total_count": self.slot_analysis.total_count,
                "through_count": self.slot_analysis.through_count,
                "blind_count": self.slot_analysis.blind_count,
                "t_slot_count": self.slot_analysis.t_slot_count,
                "max_depth_to_width": round(self.slot_analysis.max_depth_to_width, 2),
                "cnc_signal": round(self.slot_analysis.cnc_signal, 2),
            },
            "thread_analysis": {
                "total_count": self.thread_analysis.total_count,
                "internal_count": self.thread_analysis.internal_count,
                "external_count": self.thread_analysis.external_count,
                "fine_pitch_count": self.thread_analysis.fine_pitch_count,
                "avg_pitch_mm": round(self.thread_analysis.avg_pitch_mm, 2),
                "is_precision_threading": self.thread_analysis.is_precision_threading,
                "cnc_signal": round(self.thread_analysis.cnc_signal, 2),
            },
            "feature_cnc_score": round(self.feature_cnc_score, 1),
            "reasoning": self.reasoning,
        }


def analyze_holes(holes: List[Any]) -> HoleAnalysis:
    """Analyze hole features for process classification signals.
    
    Key discriminator: Hole depth/diameter ratio
    - D/d < 1.0: Likely punched (sheet metal)
    - D/d > 3.0: Definitely drilled (CNC)
    - 1.0 <= D/d <= 3.0: Ambiguous
    """
    if not holes:
        return HoleAnalysis(reasoning="No holes detected")
    
    analysis = HoleAnalysis(total_count=len(holes))
    depth_ratios = []
    
    for hole in holes:
        diameter = getattr(hole, 'diameter_mm', 0.0)
        depth = getattr(hole, 'depth_mm', 0.0)
        
        if diameter <= 0:
            continue
            
        ratio = depth / diameter
        depth_ratios.append(ratio)
        
        if ratio < 1.0:
            analysis.punched_count += 1
        elif ratio > 3.0:
            analysis.drilled_count += 1
        else:
            analysis.intermediate_count += 1
    
    if depth_ratios:
        analysis.avg_depth_ratio = sum(depth_ratios) / len(depth_ratios)
        analysis.max_depth_ratio = max(depth_ratios)
    
    # Compute CNC signal (-1 to +1)
    # More drilled holes = more CNC-like
    # More punched holes = more sheet-metal-like
    if analysis.total_count > 0:
        drilled_frac = analysis.drilled_count / analysis.total_count
        punched_frac = analysis.punched_count / analysis.total_count
        analysis.cnc_signal = drilled_frac - punched_frac
        
        # Strong signal from max depth ratio
        if analysis.max_depth_ratio > 5.0:
            analysis.cnc_signal = min(1.0, analysis.cnc_signal + 0.3)
        elif analysis.max_depth_ratio < 0.5:
            analysis.cnc_signal = max(-1.0, analysis.cnc_signal - 0.3)
    
    # Build reasoning
    parts = []
    if analysis.drilled_count > 0:
        parts.append(f"{analysis.drilled_count} deep holes (D/d>{3.0})")
    if analysis.punched_count > 0:
        parts.append(f"{analysis.punched_count} shallow holes (D/d<{1.0})")
    if analysis.max_depth_ratio > 5.0:
        parts.append(f"very deep hole (D/d={analysis.max_depth_ratio:.1f})")
    
    analysis.reasoning = "; ".join(parts) if parts else "Holes inconclusive"
    
    return analysis


def analyze_pockets(pockets: List[Any], min_dim: float = 0.0) -> PocketAnalysis:
    """Analyze pocket features for process classification signals.
    
    Key discriminators:
    - Pocket depth > 10mm: Likely CNC milling
    - Multi-step pockets: Definitely CNC
    - Tool radius corners (R3-R6mm): CNC indicator
    - Through pockets: More sheet-metal-like
    """
    if not pockets:
        return PocketAnalysis(reasoning="No pockets detected")
    
    analysis = PocketAnalysis(total_count=len(pockets))
    depths = []
    
    for pocket in pockets:
        depth = getattr(pocket, 'depth_mm', 0.0)
        step_count = getattr(pocket, 'step_count', 1)
        corner_radius = getattr(pocket, 'corner_radius_mm', 0.0)
        is_through = getattr(pocket, 'is_through', False)
        
        depths.append(depth)
        
        # Deep pockets indicate CNC
        if depth > 10.0:
            analysis.deep_pocket_count += 1
        
        # Multi-step = definitely CNC
        if step_count > 1:
            analysis.multi_step_count += 1
        
        # Tool radius corners (R3-R6mm) indicate CNC
        if 3.0 <= corner_radius <= 6.0:
            analysis.tool_radius_count += 1
        
        # Through pockets are more ambiguous
        if is_through:
            analysis.through_count += 1
    
    if depths:
        analysis.max_depth_mm = max(depths)
        analysis.avg_depth_mm = sum(depths) / len(depths)
    
    # Compute CNC signal
    signal = 0.0
    
    # Deep pockets are strong CNC indicator
    if analysis.deep_pocket_count > 0:
        signal += 0.4 * (analysis.deep_pocket_count / analysis.total_count)
    
    # Multi-step is definitive CNC indicator
    if analysis.multi_step_count > 0:
        signal += 0.5
    
    # Tool radius corners indicate CNC
    if analysis.tool_radius_count > 0:
        signal += 0.3 * (analysis.tool_radius_count / analysis.total_count)
    
    # Through pockets reduce CNC signal slightly
    if analysis.through_count > 0:
        signal -= 0.1 * (analysis.through_count / analysis.total_count)
    
    # Pocket depth relative to part thickness
    # If pocket depth >> min_dim, likely CNC
    if min_dim > 0 and analysis.max_depth_mm > 0:
        depth_thickness_ratio = analysis.max_depth_mm / min_dim
        if depth_thickness_ratio > 2.0:
            signal += 0.2
        elif depth_thickness_ratio > 1.0:
            signal += 0.1
    
    analysis.cnc_signal = max(-1.0, min(1.0, signal))
    
    # Build reasoning
    parts = []
    if analysis.deep_pocket_count > 0:
        parts.append(f"{analysis.deep_pocket_count} deep pockets (>10mm)")
    if analysis.multi_step_count > 0:
        parts.append(f"{analysis.multi_step_count} multi-step pockets")
    if analysis.tool_radius_count > 0:
        parts.append(f"{analysis.tool_radius_count} tool-radius corners")
    if analysis.max_depth_mm > 0:
        parts.append(f"max depth {analysis.max_depth_mm:.1f}mm")
    
    analysis.reasoning = "; ".join(parts) if parts else "Pockets inconclusive"
    
    return analysis


def analyze_fillets(fillets: List[Any]) -> FilletAnalysis:
    """Analyze fillet features for process classification signals.
    
    Key discriminators:
    - R3-R6mm: Typical CNC tool radius
    - ≤R2mm: Sheet metal bend relief or small edge break
    - >R6mm: Large blends (either process)
    """
    if not fillets:
        return FilletAnalysis(reasoning="No fillets detected")
    
    analysis = FilletAnalysis(total_count=len(fillets))
    radii = []
    
    for fillet in fillets:
        radius = getattr(fillet, 'radius_mm', 0.0)
        feature_type = getattr(fillet, 'feature_type', 'fillet')
        
        if feature_type != 'fillet':
            continue  # Only analyze fillets, not chamfers
            
        radii.append(radius)
        
        # Classify by radius range
        if 3.0 <= radius <= 6.0:
            analysis.tool_radius_count += 1
        elif radius <= 2.0:
            analysis.bend_relief_count += 1
        elif radius > 6.0:
            analysis.large_radius_count += 1
    
    if radii:
        analysis.avg_radius_mm = sum(radii) / len(radii)
    
    # Compute CNC signal
    # Tool-radius fillets are strong CNC indicator
    # Bend relief fillets are sheet metal indicator
    if analysis.total_count > 0:
        tool_frac = analysis.tool_radius_count / analysis.total_count
        relief_frac = analysis.bend_relief_count / analysis.total_count
        
        # Tool radius fillets strongly indicate CNC
        analysis.cnc_signal = tool_frac * 0.7 - relief_frac * 0.3
        
        # Many tool-radius fillets = very high CNC confidence
        if analysis.tool_radius_count >= 4:
            analysis.cnc_signal = min(1.0, analysis.cnc_signal + 0.2)
    
    # Build reasoning
    parts = []
    if analysis.tool_radius_count > 0:
        parts.append(f"{analysis.tool_radius_count} tool-radius fillets (R3-R6mm)")
    if analysis.bend_relief_count > 0:
        parts.append(f"{analysis.bend_relief_count} small fillets (≤R2mm)")
    if analysis.avg_radius_mm > 0:
        parts.append(f"avg radius {analysis.avg_radius_mm:.1f}mm")
    
    analysis.reasoning = "; ".join(parts) if parts else "Fillets inconclusive"
    
    return analysis


def analyze_thickness_uniformity(
    paired_plane_distances: List[float],
    total_surface_area: float = 0.0,
    pair_areas: Optional[List[float]] = None
) -> ThicknessUniformity:
    """Analyze thickness uniformity from paired plane distances.
    
    Sheet metal has ONE consistent thickness across the part.
    CNC machined parts have varying wall thicknesses from pockets/steps.
    
    Args:
        paired_plane_distances: List of distances between paired planes
        total_surface_area: Total surface area for coverage calculation
        pair_areas: Optional area for each pair (for weighted analysis)
    """
    if not paired_plane_distances:
        return ThicknessUniformity(reasoning="No paired planes detected")
    
    analysis = ThicknessUniformity()
    
    # Cluster distances to find distinct thicknesses
    # Use simple binning with 0.5mm tolerance
    thickness_bins: Dict[float, List[float]] = {}
    tolerance = 0.5  # mm
    
    for dist in paired_plane_distances:
        # Find matching bin
        matched = False
        for bin_center in thickness_bins:
            if abs(dist - bin_center) <= tolerance:
                thickness_bins[bin_center].append(dist)
                matched = True
                break
        
        if not matched:
            thickness_bins[dist] = [dist]
    
    # Find dominant thickness
    if thickness_bins:
        dominant_center = max(thickness_bins, key=lambda k: len(thickness_bins[k]))
        dominant_values = thickness_bins[dominant_center]
        
        analysis.dominant_thickness_mm = sum(dominant_values) / len(dominant_values)
        analysis.thickness_count = len(thickness_bins)
        
        # Calculate standard deviation
        if len(paired_plane_distances) > 1:
            mean = sum(paired_plane_distances) / len(paired_plane_distances)
            variance = sum((d - mean) ** 2 for d in paired_plane_distances) / len(paired_plane_distances)
            analysis.thickness_std_dev = variance ** 0.5
        
        # Calculate coverage ratio
        coverage = len(dominant_values) / len(paired_plane_distances)
        analysis.coverage_ratio = coverage
        
        # Determine uniformity
        # Uniform if: one dominant thickness covering >70% of pairs
        # and std_dev < 10% of dominant thickness
        relative_std = analysis.thickness_std_dev / max(analysis.dominant_thickness_mm, 0.1)
        analysis.is_uniform = (
            coverage >= 0.70 and
            relative_std < 0.15 and
            analysis.thickness_count <= 2
        )
    
    # Compute CNC signal
    # Uniform thickness = sheet metal (-1)
    # Varying thickness = CNC (+1)
    if analysis.is_uniform:
        analysis.cnc_signal = -0.5 - (analysis.coverage_ratio - 0.7) * 1.5  # -0.5 to -1.0
    else:
        # Multiple distinct thicknesses indicate CNC
        if analysis.thickness_count >= 3:
            analysis.cnc_signal = 0.7
        elif analysis.thickness_count == 2:
            analysis.cnc_signal = 0.3
        else:
            analysis.cnc_signal = 0.0
        
        # High std_dev also indicates CNC
        if analysis.thickness_std_dev > 2.0:
            analysis.cnc_signal = min(1.0, analysis.cnc_signal + 0.2)
    
    # Build reasoning
    if analysis.is_uniform:
        analysis.reasoning = (
            f"Uniform thickness {analysis.dominant_thickness_mm:.1f}mm "
            f"(coverage {analysis.coverage_ratio:.0%})"
        )
    else:
        analysis.reasoning = (
            f"{analysis.thickness_count} distinct thicknesses, "
            f"std_dev {analysis.thickness_std_dev:.1f}mm"
        )
    
    return analysis


def compute_feature_signals(
    holes: Optional[List[Any]] = None,
    pockets: Optional[List[Any]] = None,
    fillets: Optional[List[Any]] = None,
    paired_plane_distances: Optional[List[float]] = None,
    planar_face_z_levels: Optional[List[float]] = None,
    planar_faces: Optional[List[Any]] = None,
    cylindrical_faces: Optional[List[Any]] = None,
    bends: Optional[List[Any]] = None,
    slots: Optional[List[Any]] = None,  # GAP FIX: Add slot features
    threads: Optional[List[Any]] = None,  # GAP FIX: Add thread features
    min_dim: float = 0.0,
    total_surface_area: float = 0.0,
    part_thickness_mm: float = 0.0,
    total_edge_count: int = 0,
) -> FeatureClassificationSignals:
    """Compute all feature-based classification signals.
    
    Returns a combined signal analysis for use in process classification.
    """
    signals = FeatureClassificationSignals()
    
    # Analyze each feature type
    signals.hole_analysis = analyze_holes(holes or [])
    signals.pocket_analysis = analyze_pockets(pockets or [], min_dim)
    signals.fillet_analysis = analyze_fillets(fillets or [])
    signals.thickness_uniformity = analyze_thickness_uniformity(
        paired_plane_distances or [], total_surface_area
    )
    
    # New analysis types
    signals.hole_pattern_analysis = analyze_hole_patterns(holes or [])
    signals.surface_step_analysis = analyze_surface_steps(planar_face_z_levels or [])
    signals.chamfer_analysis = analyze_chamfers(fillets or [])
    signals.rib_analysis = analyze_ribs(planar_faces or [], part_thickness_mm)
    signals.boss_analysis = analyze_bosses(cylindrical_faces or [], holes or [])
    signals.bend_radius_analysis = analyze_bend_radius(bends or [], part_thickness_mm)
    
    # Edge sharpness analysis - separate chamfers from fillets
    chamfers_only = [f for f in (fillets or []) if getattr(f, 'feature_type', 'fillet') == 'chamfer']
    fillets_only = [f for f in (fillets or []) if getattr(f, 'feature_type', 'fillet') == 'fillet']
    signals.edge_sharpness_analysis = analyze_edge_sharpness(total_edge_count, fillets_only, chamfers_only)
    
    # GAP FIX: Add slot and thread analysis
    signals.slot_analysis = analyze_slots(slots or [])
    signals.thread_analysis = analyze_threads(threads or [])
    
    # Compute overall feature CNC score (0-100)
    # Weight different signals by reliability
    weighted_signals = []
    weights = []
    
    # Hole analysis (weight by count)
    if signals.hole_analysis.total_count > 0:
        weight = min(1.0, signals.hole_analysis.total_count / 10)
        weighted_signals.append(signals.hole_analysis.cnc_signal)
        weights.append(weight * 0.25)
    
    # Pocket analysis (strong indicator)
    if signals.pocket_analysis.total_count > 0:
        weight = min(1.0, signals.pocket_analysis.total_count / 5)
        weighted_signals.append(signals.pocket_analysis.cnc_signal)
        weights.append(weight * 0.35)
    
    # Fillet analysis
    if signals.fillet_analysis.total_count > 0:
        weight = min(1.0, signals.fillet_analysis.total_count / 8)
        weighted_signals.append(signals.fillet_analysis.cnc_signal)
        weights.append(weight * 0.20)
    
    # Thickness uniformity (very reliable)
    if signals.thickness_uniformity.thickness_count > 0:
        weighted_signals.append(signals.thickness_uniformity.cnc_signal)
        weights.append(0.40)
    
    # Hole pattern analysis (new)
    if signals.hole_pattern_analysis.total_count > 0:
        weighted_signals.append(signals.hole_pattern_analysis.cnc_signal)
        weights.append(0.15)
    
    # Surface step analysis (new)
    if signals.surface_step_analysis.distinct_levels > 0:
        weighted_signals.append(signals.surface_step_analysis.cnc_signal)
        weights.append(0.25)
    
    # Chamfer analysis (new)
    if signals.chamfer_analysis.total_count > 0:
        weighted_signals.append(signals.chamfer_analysis.cnc_signal)
        weights.append(0.15)
    
    # Rib analysis (new - CNC indicator)
    if signals.rib_analysis.total_count > 0:
        weighted_signals.append(signals.rib_analysis.cnc_signal)
        weights.append(0.30)  # Strong indicator
    
    # Boss analysis (new - CNC indicator)
    if signals.boss_analysis.total_count > 0:
        weighted_signals.append(signals.boss_analysis.cnc_signal)
        weights.append(0.25)
    
    # Bend radius analysis (sheet metal validation)
    if signals.bend_radius_analysis.total_count > 0:
        weighted_signals.append(signals.bend_radius_analysis.cnc_signal)
        weights.append(0.30)  # Strong indicator for sheet metal validation
    
    # Edge sharpness analysis
    if signals.edge_sharpness_analysis.total_edge_count > 0:
        weighted_signals.append(signals.edge_sharpness_analysis.cnc_signal)
        weights.append(0.15)
    
    # GAP FIX: Slot analysis (T-slots and blind slots are strong CNC indicators)
    if signals.slot_analysis.total_count > 0:
        weight = min(1.0, signals.slot_analysis.total_count / 5)
        weighted_signals.append(signals.slot_analysis.cnc_signal)
        weights.append(weight * 0.25)
    
    # GAP FIX: Thread analysis (threads indicate machining, fine pitch = precision)
    if signals.thread_analysis.total_count > 0:
        weight = min(1.0, signals.thread_analysis.total_count / 8)
        weighted_signals.append(signals.thread_analysis.cnc_signal)
        weights.append(weight * 0.30)  # Threads are strong CNC indicator
    
    # Compute weighted average
    if weights:
        total_weight = sum(weights)
        weighted_avg = sum(s * w for s, w in zip(weighted_signals, weights)) / total_weight
        # Convert from [-1, +1] to [0, 100]
        signals.feature_cnc_score = (weighted_avg + 1) * 50
    else:
        signals.feature_cnc_score = 50  # Neutral
    
    # Build reasoning
    if signals.hole_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Holes indicate CNC: {signals.hole_analysis.reasoning}")
    elif signals.hole_analysis.cnc_signal < -0.3:
        signals.reasoning.append(f"Holes indicate sheet metal: {signals.hole_analysis.reasoning}")
    
    if signals.pocket_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Pockets indicate CNC: {signals.pocket_analysis.reasoning}")
    
    if signals.fillet_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Fillets indicate CNC: {signals.fillet_analysis.reasoning}")
    elif signals.fillet_analysis.cnc_signal < -0.3:
        signals.reasoning.append(f"Fillets indicate sheet metal: {signals.fillet_analysis.reasoning}")
    
    if signals.thickness_uniformity.is_uniform:
        signals.reasoning.append(f"Uniform thickness: {signals.thickness_uniformity.reasoning}")
    elif signals.thickness_uniformity.thickness_count >= 3:
        signals.reasoning.append(f"Varying thickness: {signals.thickness_uniformity.reasoning}")
    
    # New analysis reasoning
    if signals.hole_pattern_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Hole pattern: {signals.hole_pattern_analysis.reasoning}")
    elif signals.hole_pattern_analysis.cnc_signal < -0.3:
        signals.reasoning.append(f"Hole pattern (sheet metal): {signals.hole_pattern_analysis.reasoning}")
    
    if signals.surface_step_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Surface steps: {signals.surface_step_analysis.reasoning}")
    
    if signals.chamfer_analysis.cnc_signal > 0.2:
        signals.reasoning.append(f"Chamfers: {signals.chamfer_analysis.reasoning}")
    elif signals.chamfer_analysis.cnc_signal < -0.2:
        signals.reasoning.append(f"Chamfers (sheet metal): {signals.chamfer_analysis.reasoning}")
    
    if signals.rib_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Ribs: {signals.rib_analysis.reasoning}")
    
    if signals.boss_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Bosses: {signals.boss_analysis.reasoning}")
    
    if signals.bend_radius_analysis.cnc_signal < -0.3:
        signals.reasoning.append(f"Bend radii (sheet metal): {signals.bend_radius_analysis.reasoning}")
    elif signals.bend_radius_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Bend radii (non-standard): {signals.bend_radius_analysis.reasoning}")
    
    if signals.edge_sharpness_analysis.cnc_signal < -0.2:
        signals.reasoning.append(f"Edge treatment (sheet metal): {signals.edge_sharpness_analysis.reasoning}")
    elif signals.edge_sharpness_analysis.cnc_signal > 0.2:
        signals.reasoning.append(f"Edge treatment: {signals.edge_sharpness_analysis.reasoning}")
    
    # GAP FIX: Slot and thread reasoning
    if signals.slot_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Slots indicate CNC: {signals.slot_analysis.reasoning}")
    elif signals.slot_analysis.cnc_signal < -0.3:
        signals.reasoning.append(f"Slots (sheet metal): {signals.slot_analysis.reasoning}")
    
    if signals.thread_analysis.cnc_signal > 0.3:
        signals.reasoning.append(f"Threads indicate CNC: {signals.thread_analysis.reasoning}")
    if signals.thread_analysis.is_precision_threading:
        signals.reasoning.append("Precision threading detected (fine pitch)")
    
    return signals


# ---------------------------------------------------------------------------
# NEW ANALYSIS FUNCTIONS
# ---------------------------------------------------------------------------

def analyze_hole_patterns(holes: List[Any]) -> HolePatternAnalysis:
    """Analyze hole placement patterns for sheet metal vs CNC detection.
    
    Key discriminators:
    - Regular grid/linear patterns: Sheet metal (punched)
    - Irregular/random placement: CNC (drilled on machining center)
    - Countersinks/counterbores: CNC indicator
    - Circular patterns (bolt circles): Either, but rare in pure sheet metal
    
    Args:
        holes: List of HoleFeature objects with position attribute
    """
    if not holes:
        return HolePatternAnalysis(reasoning="No holes detected")
    
    analysis = HolePatternAnalysis(total_count=len(holes))
    positions = []
    
    for hole in holes:
        hole_type = getattr(hole, 'type', 'through')
        position = getattr(hole, 'position', None)
        
        # Count countersinks and counterbores
        if hole_type == 'countersink':
            analysis.countersink_count += 1
        elif hole_type == 'counterbore':
            analysis.counterbore_count += 1
        
        # Collect positions for pattern analysis
        if position is not None:
            positions.append(position)
    
    # Analyze pattern regularity if we have enough holes with positions
    if len(positions) >= 4:
        grid_score, linear_score = _analyze_pattern_regularity(positions)
        analysis.grid_score = grid_score
        analysis.linear_score = linear_score
        analysis.is_regular_pattern = grid_score > 0.7 or linear_score > 0.8
        analysis.is_irregular_pattern = grid_score < 0.3 and linear_score < 0.3
    
    # Compute CNC signal
    signal = 0.0
    parts = []
    
    # Countersinks/counterbores are CNC indicators
    counters = analysis.countersink_count + analysis.counterbore_count
    if counters > 0:
        signal += min(0.4, counters * 0.1)
        parts.append(f"{counters} countersinks/counterbores")
    
    # Irregular patterns suggest CNC
    if analysis.is_irregular_pattern:
        signal += 0.3
        parts.append("irregular hole pattern")
    # Regular patterns suggest sheet metal punching
    elif analysis.is_regular_pattern:
        signal -= 0.4
        parts.append("regular punched pattern")
    
    analysis.cnc_signal = max(-1.0, min(1.0, signal))
    analysis.reasoning = "; ".join(parts) if parts else "No clear pattern"
    
    return analysis


def _analyze_pattern_regularity(positions: List[tuple]) -> tuple:
    """Analyze position regularity for grid/linear patterns.
    
    Returns (grid_score, linear_score) where each is 0-1.
    """
    import math
    
    if len(positions) < 4:
        return 0.0, 0.0
    
    # Extract X, Y coordinates (ignore Z for 2D pattern analysis)
    xs = sorted(set(p[0] for p in positions))
    ys = sorted(set(p[1] for p in positions))
    
    # Check X spacing regularity
    x_spacings = [xs[i+1] - xs[i] for i in range(len(xs)-1)] if len(xs) > 1 else []
    y_spacings = [ys[i+1] - ys[i] for i in range(len(ys)-1)] if len(ys) > 1 else []
    
    def spacing_regularity(spacings, tolerance_pct=0.1):
        if len(spacings) < 2:
            return 0.5
        avg = sum(spacings) / len(spacings)
        if avg < 0.1:
            return 0.5
        deviations = [abs(s - avg) / avg for s in spacings]
        avg_deviation = sum(deviations) / len(deviations)
        return max(0.0, min(1.0, 1.0 - avg_deviation / tolerance_pct))
    
    x_regularity = spacing_regularity(x_spacings)
    y_regularity = spacing_regularity(y_spacings)
    
    # Grid score: both axes should be regular
    grid_score = (x_regularity * y_regularity) ** 0.5
    
    # Linear score: one axis has all same value (line of holes)
    x_linear = 1.0 if len(xs) == 1 else 0.0
    y_linear = 1.0 if len(ys) == 1 else 0.0
    linear_score = max(x_linear, y_linear)
    
    # Also check if points lie along a single line (diagonal)
    if len(positions) >= 3 and linear_score < 0.5:
        # Simple collinearity check
        slopes = []
        for i in range(1, len(positions)):
            dx = positions[i][0] - positions[0][0]
            dy = positions[i][1] - positions[0][1]
            if abs(dx) > 0.1:
                slopes.append(dy / dx)
        if slopes:
            avg_slope = sum(slopes) / len(slopes)
            slope_var = sum((s - avg_slope) ** 2 for s in slopes) / len(slopes)
            if slope_var < 0.01:  # Very consistent slope
                linear_score = 0.9
    
    return grid_score, linear_score


def analyze_surface_steps(planar_face_z_levels: List[float]) -> SurfaceStepAnalysis:
    """Analyze planar surface Z levels to detect CNC step machining.
    
    CNC machined parts often have multiple distinct planar surfaces at
    different Z heights (machined pockets, steps, ledges). Sheet metal
    parts typically have only 2 levels (top and bottom).
    
    Args:
        planar_face_z_levels: List of Z heights of planar faces
    """
    if not planar_face_z_levels:
        return SurfaceStepAnalysis(reasoning="No planar faces")
    
    analysis = SurfaceStepAnalysis()
    
    # Cluster Z levels (tolerance 0.5mm)
    sorted_levels = sorted(set(planar_face_z_levels))
    clustered_levels: List[float] = []
    tolerance = 0.5
    
    for z in sorted_levels:
        merged = False
        for i, cluster in enumerate(clustered_levels):
            if abs(z - cluster) < tolerance:
                # Update cluster to average
                clustered_levels[i] = (cluster + z) / 2
                merged = True
                break
        if not merged:
            clustered_levels.append(z)
    
    analysis.distinct_levels = len(clustered_levels)
    
    # Compute step heights
    if len(clustered_levels) > 1:
        sorted_clusters = sorted(clustered_levels)
        analysis.step_heights = [
            sorted_clusters[i+1] - sorted_clusters[i] 
            for i in range(len(sorted_clusters) - 1)
        ]
        analysis.max_step_height_mm = max(analysis.step_heights)
        analysis.avg_step_height_mm = sum(analysis.step_heights) / len(analysis.step_heights)
    
    # Determine if stepped part (CNC indicator)
    # Sheet metal: 2 levels (top/bottom)
    # CNC: 3+ levels (machined steps)
    analysis.is_stepped_part = analysis.distinct_levels >= 3
    
    # Compute CNC signal
    if analysis.distinct_levels <= 2:
        analysis.cnc_signal = -0.3  # Sheet metal likely
        analysis.reasoning = f"{analysis.distinct_levels} levels (sheet metal profile)"
    elif analysis.distinct_levels <= 4:
        analysis.cnc_signal = 0.4
        analysis.reasoning = f"{analysis.distinct_levels} levels (some machining)"
    else:
        analysis.cnc_signal = 0.8
        analysis.reasoning = f"{analysis.distinct_levels} levels (heavy step machining)"
    
    return analysis


def analyze_chamfers(fillets: List[Any]) -> ChamferAnalysis:
    """Analyze chamfers for CNC vs sheet metal detection.
    
    Key discriminators:
    - Standard 45° chamfers with >1mm leg: CNC-machined
    - Small edge breaks (<0.5mm): Sheet metal deburring
    - Large chamfers (>2mm): CNC feature
    
    Args:
        fillets: List of FilletFeature objects (includes chamfers)
    """
    if not fillets:
        return ChamferAnalysis(reasoning="No chamfers detected")
    
    analysis = ChamferAnalysis()
    leg_sizes = []
    
    for f in fillets:
        feature_type = getattr(f, 'feature_type', 'fillet')
        if feature_type != 'chamfer':
            continue
        
        analysis.total_count += 1
        radius = getattr(f, 'radius_mm', 0.0)  # For chamfers, this is leg size
        leg_sizes.append(radius)
        
        if radius < 0.5:
            analysis.edge_break_count += 1
        elif radius >= 1.0:
            analysis.standard_45deg_count += 1
        if radius > 2.0:
            analysis.large_chamfer_count += 1
    
    if leg_sizes:
        analysis.avg_leg_size_mm = sum(leg_sizes) / len(leg_sizes)
    
    if analysis.total_count == 0:
        return ChamferAnalysis(reasoning="No chamfers in fillet list")
    
    # Compute CNC signal
    signal = 0.0
    parts = []
    
    # Large/standard chamfers indicate CNC
    if analysis.standard_45deg_count > 0:
        signal += min(0.5, analysis.standard_45deg_count * 0.15)
        parts.append(f"{analysis.standard_45deg_count} standard chamfers")
    
    if analysis.large_chamfer_count > 0:
        signal += min(0.3, analysis.large_chamfer_count * 0.1)
        parts.append(f"{analysis.large_chamfer_count} large chamfers")
    
    # Edge breaks indicate sheet metal
    if analysis.edge_break_count > 0:
        ratio = analysis.edge_break_count / analysis.total_count
        if ratio > 0.5:
            signal -= 0.3
            parts.append(f"{analysis.edge_break_count} edge breaks (sheet metal)")
    
    analysis.cnc_signal = max(-1.0, min(1.0, signal))
    analysis.reasoning = "; ".join(parts) if parts else "Chamfers inconclusive"
    
    return analysis


def analyze_ribs(planar_faces: List[Any], part_thickness_mm: float = 0.0) -> RibAnalysis:
    """Analyze thin-wall ribs for CNC machining detection.
    
    Ribs are identified as thin vertical planar faces with height >> thickness.
    They are structural reinforcement features created by CNC machining.
    
    Detection heuristic:
    - Planar faces oriented vertically (normal in XY plane)
    - Width < 5mm (thin)
    - Height > 3x width (tall and thin)
    
    Args:
        planar_faces: List of face objects with normal and dimensions
        part_thickness_mm: Overall part thickness for context
    """
    analysis = RibAnalysis()
    
    if not planar_faces:
        return RibAnalysis(reasoning="No faces to analyze for ribs")
    
    rib_heights = []
    rib_thicknesses = []
    height_ratios = []
    
    for face in planar_faces:
        # Get face normal (should be horizontal for vertical rib)
        normal = getattr(face, 'normal', None)
        if normal is None:
            continue
        
        # Check if vertical face (normal mostly in XY plane)
        z_component = abs(normal[2]) if len(normal) >= 3 else 1.0
        if z_component > 0.3:  # Not vertical enough
            continue
        
        # Get face dimensions
        width = getattr(face, 'width_mm', 0.0)
        height = getattr(face, 'height_mm', 0.0)
        
        # Check rib criteria
        if width > 0 and height > 0:
            # Ensure width is the smaller dimension
            if width > height:
                width, height = height, width
            
            # Rib: thin (<5mm) and tall (>3x width)
            if width < 5.0 and height > width * 3:
                analysis.total_count += 1
                rib_heights.append(height)
                rib_thicknesses.append(width)
                height_ratios.append(height / width)
    
    if analysis.total_count > 0:
        analysis.avg_rib_height_mm = sum(rib_heights) / len(rib_heights)
        analysis.avg_rib_thickness_mm = sum(rib_thicknesses) / len(rib_thicknesses)
        analysis.max_height_to_thickness_ratio = max(height_ratios)
        
        # Compute CNC signal
        # Ribs are strong CNC indicators
        signal = min(1.0, analysis.total_count * 0.3)
        
        # Very tall ribs are even stronger indicators
        if analysis.max_height_to_thickness_ratio > 10:
            signal = min(1.0, signal + 0.3)
        
        analysis.cnc_signal = signal
        analysis.reasoning = f"{analysis.total_count} ribs detected, max H/T ratio: {analysis.max_height_to_thickness_ratio:.1f}"
    else:
        analysis.reasoning = "No thin-wall ribs detected"
    
    return analysis


def analyze_bosses(cylindrical_faces: List[Any], holes: Optional[List[Any]] = None) -> BossAnalysis:
    """Analyze bosses (raised cylindrical features) for CNC detection.
    
    Bosses are identified as:
    - Short cylindrical raised features
    - Often with holes (for mounting)
    - Height < 2x diameter
    
    Detection heuristic:
    - Outward-facing cylindrical surfaces (OD, not ID)
    - Short relative to diameter
    - Surrounded by lower surfaces (raised, not recessed)
    
    Args:
        cylindrical_faces: List of cylindrical face data
        holes: Optional list of holes (to detect threaded bosses)
    """
    analysis = BossAnalysis()
    
    if not cylindrical_faces:
        return BossAnalysis(reasoning="No cylindrical features to analyze")
    
    boss_heights = []
    boss_diameters = []
    
    for cyl in cylindrical_faces:
        # Check if outer diameter (boss) vs inner diameter (hole)
        is_outer = getattr(cyl, 'is_outer', None)
        if is_outer is False:
            continue  # Skip holes
        
        diameter = getattr(cyl, 'diameter_mm', 0.0)
        height = getattr(cyl, 'height_mm', 0.0)
        
        if diameter <= 0 or height <= 0:
            continue
        
        # Boss criteria: H/D < 2 (short relative to diameter)
        if height / diameter < 2.0:
            analysis.total_count += 1
            boss_heights.append(height)
            boss_diameters.append(diameter)
    
    if analysis.total_count > 0:
        analysis.avg_boss_height_mm = sum(boss_heights) / len(boss_heights)
        analysis.avg_boss_diameter_mm = sum(boss_diameters) / len(boss_diameters)
        
        # Check for threaded bosses (boss with concentric hole)
        if holes:
            boss_positions = []
            for i, cyl in enumerate(cylindrical_faces):
                pos = getattr(cyl, 'position', None)
                if pos and i < analysis.total_count:
                    boss_positions.append(pos)
            
            for hole in holes:
                hole_pos = getattr(hole, 'position', None)
                if hole_pos:
                    for bp in boss_positions:
                        # Check if hole is concentric with boss (XY distance < 1mm)
                        dist = ((hole_pos[0] - bp[0])**2 + (hole_pos[1] - bp[1])**2)**0.5
                        if dist < 1.0:
                            analysis.threaded_count += 1
                            break
        
        # Compute CNC signal
        signal = min(0.8, analysis.total_count * 0.25)
        
        # Threaded bosses are strong CNC indicators
        if analysis.threaded_count > 0:
            signal = min(1.0, signal + 0.2)
        
        analysis.cnc_signal = signal
        parts = [f"{analysis.total_count} bosses"]
        if analysis.threaded_count > 0:
            parts.append(f"{analysis.threaded_count} threaded")
        analysis.reasoning = ", ".join(parts)
    else:
        analysis.reasoning = "No bosses detected"
    
    return analysis


def analyze_bend_radius(bends: List[Any], material_thickness_mm: float = 0.0) -> BendRadiusAnalysis:
    """Analyze bend radius to thickness ratio for sheet metal validation.
    
    For proper sheet metal:
    - R/t in 0.5 to 2.0 range is typical for brake forming
    - R/t < 0.5 is very tight (risk of cracking)
    - R/t > 3.0 may indicate rolled/machined feature
    
    Args:
        bends: List of BendFeature objects with radius_mm
        material_thickness_mm: Material thickness (0 = unknown)
    """
    if not bends or material_thickness_mm <= 0:
        return BendRadiusAnalysis(
            reasoning="No bends or unknown thickness" if not bends else f"Unknown thickness ({len(bends)} bends)"
        )
    
    analysis = BendRadiusAnalysis(total_count=len(bends))
    radii = []
    ratios = []
    
    for bend in bends:
        radius = getattr(bend, 'radius_mm', 0.0)
        if radius <= 0:
            continue
        
        radii.append(radius)
        ratio = radius / material_thickness_mm
        ratios.append(ratio)
        
        if 0.5 <= ratio <= 2.0:
            analysis.valid_ratio_count += 1
        elif ratio < 0.5:
            analysis.tight_radius_count += 1
        elif ratio > 3.0:
            analysis.large_radius_count += 1
    
    if radii:
        analysis.avg_radius_mm = sum(radii) / len(radii)
    if ratios:
        analysis.avg_radius_to_thickness = sum(ratios) / len(ratios)
    
    # Compute CNC signal
    # Standard sheet metal has most bends in valid range
    if analysis.total_count > 0:
        valid_pct = analysis.valid_ratio_count / analysis.total_count
        tight_pct = analysis.tight_radius_count / analysis.total_count
        large_pct = analysis.large_radius_count / analysis.total_count
        
        # Start neutral
        signal = 0.0
        parts = []
        
        # Valid bend ratios indicate sheet metal
        if valid_pct > 0.7:
            signal = -0.5  # Sheet metal indicator
            parts.append(f"{analysis.valid_ratio_count} standard bends (R/t={analysis.avg_radius_to_thickness:.1f})")
        
        # Tight radii might indicate specialty forming or CNC
        if tight_pct > 0.3:
            signal = min(1.0, signal + 0.3)
            parts.append(f"{analysis.tight_radius_count} tight radius bends")
        
        # Large radii might indicate rolled/machined
        if large_pct > 0.3:
            signal = min(1.0, signal + 0.2)
            parts.append(f"{analysis.large_radius_count} large radius bends")
        
        analysis.cnc_signal = signal
        analysis.reasoning = "; ".join(parts) if parts else f"Mixed bend radii (avg R/t={analysis.avg_radius_to_thickness:.1f})"
    else:
        analysis.reasoning = "No valid bend radii"
    
    return analysis


def analyze_edge_sharpness(
    total_edge_count: int = 0,
    fillets: Optional[List[Any]] = None,
    chamfers: Optional[List[Any]] = None,
) -> EdgeSharpnessAnalysis:
    """Analyze edge treatment for process classification.
    
    Edge characteristics can help distinguish processes:
    - Many sharp edges: Cast parts or raw machined
    - Uniform small breaks (<0.5mm): Sheet metal deburring
    - Varying fillets (R2-R6mm): CNC machined with tool radius
    
    Args:
        total_edge_count: Total number of edges in the model
        fillets: List of fillet features
        chamfers: List of chamfer features
    """
    analysis = EdgeSharpnessAnalysis(total_edge_count=total_edge_count)
    
    if total_edge_count <= 0:
        return EdgeSharpnessAnalysis(reasoning="No edges to analyze")
    
    edge_treatments = []
    
    # Count filleted edges
    if fillets:
        for f in fillets:
            radius = getattr(f, 'radius_mm', 0.0)
            if radius > 0:
                analysis.filleted_edge_count += 1
                edge_treatments.append(radius)
    
    # Count chamfered edges
    if chamfers:
        for c in chamfers:
            leg = getattr(c, 'radius_mm', 0.0)  # leg size
            if leg > 0:
                analysis.chamfered_edge_count += 1
                edge_treatments.append(leg)
    
    # Estimate sharp edges (edges without treatment)
    treated_edges = analysis.filleted_edge_count + analysis.chamfered_edge_count
    analysis.sharp_edge_count = max(0, total_edge_count - treated_edges)
    
    if edge_treatments:
        analysis.avg_edge_treatment_mm = sum(edge_treatments) / len(edge_treatments)
    
    if total_edge_count > 0:
        analysis.sharp_edge_ratio = analysis.sharp_edge_count / total_edge_count
    
    # Compute CNC signal
    signal = 0.0
    parts = []
    
    # Many sharp edges can indicate cast or raw machined
    if analysis.sharp_edge_ratio > 0.7:
        signal = 0.2  # Slight CNC indicator (raw machined)
        parts.append(f"{analysis.sharp_edge_ratio:.0%} sharp edges")
    
    # Uniform small edge treatments indicate sheet metal
    if edge_treatments and analysis.avg_edge_treatment_mm < 0.5:
        small_count = sum(1 for t in edge_treatments if t < 0.5)
        if small_count / len(edge_treatments) > 0.7:
            signal = -0.3  # Sheet metal indicator
            parts.append(f"{small_count} small edge breaks")
    
    # Larger and varying fillets indicate CNC
    if edge_treatments and analysis.avg_edge_treatment_mm >= 2.0:
        signal = min(1.0, signal + 0.4)
        parts.append(f"avg edge treatment {analysis.avg_edge_treatment_mm:.1f}mm")
    
    analysis.cnc_signal = signal
    analysis.reasoning = "; ".join(parts) if parts else "Mixed edge treatments"
    
    return analysis


def analyze_slots(slots: List[Any]) -> SlotAnalysis:
    """Analyze slot features for process classification signals.
    
    Key discriminators:
    - Through slots: Can be laser cut (sheet metal)
    - Blind slots: Require CNC milling
    - T-slots: Definitely CNC machining
    - Slot depth/width ratio: High ratio = CNC
    
    Args:
        slots: List of slot features
        
    Returns:
        SlotAnalysis with classification signal
    """
    analysis = SlotAnalysis()
    
    if not slots:
        return analysis
    
    analysis.total_count = len(slots)
    
    depths = []
    lengths = []
    widths = []
    
    for slot in slots:
        slot_type = getattr(slot, 'slot_type', 'through')
        depth = getattr(slot, 'depth_mm', 0.0)
        length = getattr(slot, 'length_mm', 0.0)
        width = getattr(slot, 'width_mm', 0.0)
        
        if slot_type == 'through':
            analysis.through_count += 1
        elif slot_type == 'blind':
            analysis.blind_count += 1
        elif slot_type == 't_slot' or slot_type == 't-slot':
            analysis.t_slot_count += 1
        elif slot_type == 'keyway':
            analysis.keyway_count += 1
        
        if depth > 0:
            depths.append(depth)
        if length > 0:
            lengths.append(length)
        if width > 0:
            widths.append(width)
            # Calculate depth/width ratio
            if depth > 0:
                ratio = depth / width
                if ratio > analysis.max_depth_to_width:
                    analysis.max_depth_to_width = ratio
    
    if depths:
        analysis.avg_depth_mm = sum(depths) / len(depths)
    if lengths:
        analysis.avg_length_mm = sum(lengths) / len(lengths)
    if widths:
        analysis.avg_width_mm = sum(widths) / len(widths)
    
    # Compute CNC signal
    signal = 0.0
    parts = []
    
    # T-slots and keyways are definitely CNC
    if analysis.t_slot_count > 0:
        signal = 1.0
        parts.append(f"{analysis.t_slot_count} T-slots")
    elif analysis.keyway_count > 0:
        signal = 0.9
        parts.append(f"{analysis.keyway_count} keyways")
    elif analysis.blind_count > 0:
        # Blind slots require CNC milling
        signal = 0.8
        parts.append(f"{analysis.blind_count} blind slots")
    elif analysis.through_count > 0:
        # Through slots can be sheet metal
        if analysis.through_count == analysis.total_count:
            signal = -0.3  # All through slots = sheet metal compatible
            parts.append(f"{analysis.through_count} through slots (sheet metal)")
        else:
            signal = 0.2  # Mixed = likely CNC
    
    # High depth/width ratio indicates CNC
    if analysis.max_depth_to_width > 3.0:
        signal = max(signal, 0.6)
        parts.append(f"deep slot D/W={analysis.max_depth_to_width:.1f}")
    
    analysis.cnc_signal = signal
    analysis.reasoning = "; ".join(parts) if parts else "No discriminating slot features"
    
    return analysis


def analyze_threads(threads: List[Any]) -> ThreadAnalysis:
    """Analyze thread features for precision machining detection.
    
    Key discriminators:
    - Fine pitch threads (pitch < 1.0mm): High precision CNC
    - External threads: Likely turned on lathe
    - Thread count: More threads = more CNC likelihood
    
    Args:
        threads: List of thread features
        
    Returns:
        ThreadAnalysis with classification signal
    """
    analysis = ThreadAnalysis()
    
    if not threads:
        return analysis
    
    analysis.total_count = len(threads)
    
    pitches = []
    
    for thread in threads:
        thread_type = getattr(thread, 'thread_type', 'internal')
        pitch = getattr(thread, 'pitch_mm', 1.0)
        
        if thread_type == 'internal':
            analysis.internal_count += 1
        else:
            analysis.external_count += 1
        
        if pitch > 0:
            pitches.append(pitch)
            if pitch < 1.0:
                analysis.fine_pitch_count += 1
            else:
                analysis.coarse_pitch_count += 1
    
    if pitches:
        analysis.avg_pitch_mm = sum(pitches) / len(pitches)
        analysis.min_pitch_mm = min(pitches)
    
    # Fine pitch threads indicate precision machining
    analysis.is_precision_threading = (
        analysis.fine_pitch_count >= 1 or 
        analysis.min_pitch_mm < 0.75
    )
    
    # Compute CNC signal
    signal = 0.0
    parts = []
    
    # Threads always indicate some level of machining
    if analysis.total_count > 0:
        signal = 0.5  # Base signal
        parts.append(f"{analysis.total_count} threads")
    
    # Fine pitch threads are very strong CNC indicator
    if analysis.fine_pitch_count > 0:
        signal = min(1.0, signal + 0.3)
        parts.append(f"{analysis.fine_pitch_count} fine pitch")
    
    # External threads suggest lathe turning
    if analysis.external_count > 0:
        signal = max(signal, 0.7)
        parts.append(f"{analysis.external_count} external threads")
    
    # Many threads = high complexity
    if analysis.total_count >= 5:
        signal = min(1.0, signal + 0.2)
        parts.append("high thread count")
    
    analysis.cnc_signal = signal
    analysis.reasoning = "; ".join(parts) if parts else "No threads"
    
    return analysis