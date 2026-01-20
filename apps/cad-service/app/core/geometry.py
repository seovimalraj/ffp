"""
Pure geometry calculations and metrics.
Single source of truth for all geometric analysis.
"""
from typing import Tuple, Dict, List, Optional
import math


class GeometricMetrics:
    """Container for geometric analysis results."""
    
    def __init__(self, bbox_dims: List[float], volume_mm3: float, surface_area_mm2: float):
        self.bbox_dims = sorted(bbox_dims)  # [min, mid, max]
        self.volume_mm3 = volume_mm3
        self.surface_area_mm2 = surface_area_mm2
        
        # Derived metrics
        self.min_dim = self.bbox_dims[0]
        self.mid_dim = self.bbox_dims[1]
        self.max_dim = self.bbox_dims[2]
        self.envelope_volume = self.min_dim * self.mid_dim * self.max_dim
        
        # Ratios
        self.aspect_ratio = self.max_dim / max(self.min_dim, 0.1)
        self.volume_efficiency = self.volume_mm3 / self.envelope_volume if self.envelope_volume > 0 else 0
        
        # Convert units
        self.volume_cm3 = self.volume_mm3 / 1000.0
        self.surface_area_cm2 = self.surface_area_mm2 / 100.0
        self.surface_to_volume_ratio = self.surface_area_cm2 / max(self.volume_cm3, 0.1)


def calculate_sheet_metal_score(metrics: GeometricMetrics) -> float:
    """
    Calculate sheet metal likelihood score (0-100) based on geometric characteristics.
    
    Scoring criteria:
    - Thickness (35-50 points): Most critical - sheet metal is 0.5-6mm thick
    - Aspect ratio (25 points): Sheet is much longer/wider than thick
    - Surface-to-volume (20 points): High ratio indicates thin-walled structure
    - Flatness (15 points): Sheet parts are relatively flat
    - Volume efficiency (10 points): Low efficiency = hollow/bent structure
    
    Args:
        metrics: Geometric metrics container
        
    Returns:
        Score from 0-100, higher = more likely sheet metal
    """
    score = 0.0
    
    # 1. Thickness check (35-50 points) - MOST CRITICAL
    if 0.5 <= metrics.min_dim <= 6.0:
        score += 35
        # Bonus for typical sheet metal gauges
        typical_thicknesses = [0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0]
        if any(abs(metrics.min_dim - t) < 0.3 for t in typical_thicknesses):
            score += 15  # Total 50 points
        elif metrics.min_dim <= 4.0:
            score += 8   # Bonus for very thin
    elif 0.3 <= metrics.min_dim < 0.5:
        score += 25  # Very thin, non-standard
    
    # 2. Aspect ratio (25 points) - Sheet is much longer/wider than thick
    if metrics.aspect_ratio > 20:
        score += 25
    elif metrics.aspect_ratio > 15:
        score += 20
    elif metrics.aspect_ratio > 10:
        score += 15
    elif metrics.aspect_ratio > 5:
        score += 8
    
    # 3. Surface-to-volume ratio (20 points) - Thin-walled = high ratio
    if metrics.surface_to_volume_ratio > 80:
        score += 20
    elif metrics.surface_to_volume_ratio > 60:
        score += 15
    elif metrics.surface_to_volume_ratio > 40:
        score += 10
    elif metrics.surface_to_volume_ratio > 25:
        score += 5
    
    # 4. Flatness check (15 points)
    if metrics.min_dim > 0:
        flatness_ratio = (metrics.mid_dim * metrics.max_dim) / max(metrics.volume_cm3 * 10 / metrics.min_dim, 1)
        if flatness_ratio > 0.7:
            score += 15
        elif flatness_ratio > 0.5:
            score += 10
        elif flatness_ratio > 0.3:
            score += 5
    
    # 5. Volume efficiency (10 points) - Low efficiency = hollow/bent
    if metrics.volume_efficiency < 0.4:
        score += 10
    elif metrics.volume_efficiency < 0.6:
        score += 5
    
    return min(100.0, max(0.0, score))


def calculate_advanced_metrics(metrics: GeometricMetrics) -> Dict[str, float]:
    """
    Calculate advanced geometric metrics for enhanced classification.
    
    Returns:
        Dict with:
        - wall_thickness_consistency: 0-1, high = uniform walls (sheet metal)
        - planarity_score: 0-1, high = mostly flat surfaces
        - volume_distribution: 0-1, high = solid part, low = hollow
        - dimension_balance: 0-1, high = box-like, low = elongated
        - surface_to_volume_ratio: numeric ratio
    """
    # Volume distribution (solid vs hollow)
    if metrics.volume_efficiency > 0.7:
        volume_dist = 0.9
    elif metrics.volume_efficiency > 0.5:
        volume_dist = 0.6
    elif metrics.volume_efficiency > 0.3:
        volume_dist = 0.3
    else:
        volume_dist = 0.1
    
    # Wall thickness consistency (estimated from volume efficiency)
    # Low efficiency with thin min dim = consistent thin walls (sheet metal)
    # High efficiency = varying thickness (machined solid)
    if metrics.min_dim < 6 and metrics.volume_efficiency < 0.5:
        wall_consistency = 0.8 + (1.0 - metrics.volume_efficiency) * 0.2
    else:
        wall_consistency = 0.4
    
    # Planarity score (flat vs complex)
    # High aspect ratio + low volume efficiency = flat bent sheet
    if metrics.aspect_ratio > 10 and metrics.volume_efficiency < 0.5:
        planarity = 0.7 + min(0.3, metrics.aspect_ratio / 100)
    elif metrics.aspect_ratio > 5:
        planarity = 0.5
    else:
        planarity = 0.3
    
    # Dimension balance (how box-like vs elongated)
    if metrics.mid_dim > 0:
        mid_to_max_ratio = metrics.mid_dim / metrics.max_dim
        min_to_mid_ratio = metrics.min_dim / metrics.mid_dim
        dimension_balance = (mid_to_max_ratio + min_to_mid_ratio) / 2
    else:
        dimension_balance = 0
    
    return {
        'wall_thickness_consistency': wall_consistency,
        'planarity_score': planarity,
        'volume_distribution': volume_dist,
        'dimension_balance': dimension_balance,
        'surface_to_volume_ratio': metrics.surface_to_volume_ratio
    }
