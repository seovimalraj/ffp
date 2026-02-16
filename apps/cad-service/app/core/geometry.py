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


def _score_thickness(min_dim: float) -> float:
    """30-40 points for sheet metal thickness range."""
    if 0.5 <= min_dim <= 6.0:
        base = 30.0
        typical = [0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0]
        if any(abs(min_dim - t) < 0.3 for t in typical):
            return base + 10.0
        if min_dim <= 4.0:
            return base + 5.0
        return base
    if 0.3 <= min_dim < 0.5:
        return 20.0
    return 0.0


def _score_aspect(aspect_ratio: float) -> float:
    """Up to 25 points for high aspect ratio."""
    if aspect_ratio > 20:
        return 25.0
    if aspect_ratio > 15:
        return 20.0
    if aspect_ratio > 10:
        return 15.0
    if aspect_ratio > 5:
        return 8.0
    return 0.0


def _score_sv_ratio(sv_ratio: float) -> float:
    """Up to 20 points for surface-to-volume ratio."""
    if sv_ratio > 80:
        return 20.0
    if sv_ratio > 60:
        return 15.0
    if sv_ratio > 40:
        return 10.0
    if sv_ratio > 25:
        return 5.0
    return 0.0


def _score_flatness(metrics: "GeometricMetrics") -> float:
    """Up to 15 points for flatness."""
    if metrics.min_dim <= 0:
        return 0.0
    flatness = (metrics.mid_dim * metrics.max_dim) / max(metrics.volume_cm3 * 10 / metrics.min_dim, 1)
    if flatness > 0.7:
        return 15.0
    if flatness > 0.5:
        return 10.0
    if flatness > 0.3:
        return 5.0
    return 0.0


def _score_volume_efficiency(vol_eff: float) -> float:
    """Up to 20 bonus points, or penalty for high efficiency."""
    bonus = 0.0
    if vol_eff < 0.3:
        bonus = 20.0
    elif vol_eff < 0.5:
        bonus = 15.0
    elif vol_eff < 0.65:
        bonus = 5.0
    if vol_eff > 0.7:
        bonus -= 35.0
    elif vol_eff > 0.6:
        bonus -= 20.0
    return bonus


def calculate_sheet_metal_score(metrics: GeometricMetrics) -> float:
    """
    Calculate sheet metal likelihood score (0-100) based on geometric characteristics.
    """
    score = (
        _score_thickness(metrics.min_dim)
        + _score_aspect(metrics.aspect_ratio)
        + _score_sv_ratio(metrics.surface_to_volume_ratio)
        + _score_flatness(metrics)
        + _score_volume_efficiency(metrics.volume_efficiency)
    )
    return min(100.0, max(0.0, score))


def _calc_volume_distribution(vol_eff: float) -> float:
    if vol_eff > 0.7:
        return 0.9
    if vol_eff > 0.5:
        return 0.6
    if vol_eff > 0.3:
        return 0.3
    return 0.1


def _calc_wall_consistency(min_dim: float, vol_eff: float) -> float:
    if min_dim < 6 and vol_eff < 0.5:
        return 0.8 + (1.0 - vol_eff) * 0.2
    return 0.4


def _calc_planarity(aspect_ratio: float, vol_eff: float) -> float:
    if aspect_ratio > 10 and vol_eff < 0.5:
        return 0.7 + min(0.3, aspect_ratio / 100)
    if aspect_ratio > 5:
        return 0.5
    return 0.3


def _calc_cnc_likelihood(vol_eff: float, dim_balance: float, aspect_ratio: float, min_dim: float) -> float:
    score = 0.0
    if vol_eff > 0.7:
        score += 0.5
    elif vol_eff > 0.6:
        score += 0.3
    if dim_balance > 0.4:
        score += 0.2
    if aspect_ratio < 5:
        score += 0.2
    if 6 < min_dim < 50:
        score += 0.1
    return min(1.0, score)


def calculate_advanced_metrics(metrics: GeometricMetrics) -> Dict[str, float]:
    """
    Calculate advanced geometric metrics for enhanced classification.
    """
    volume_dist = _calc_volume_distribution(metrics.volume_efficiency)
    wall_consistency = _calc_wall_consistency(metrics.min_dim, metrics.volume_efficiency)
    planarity = _calc_planarity(metrics.aspect_ratio, metrics.volume_efficiency)

    if metrics.mid_dim > 0:
        mid_to_max = metrics.mid_dim / metrics.max_dim
        min_to_mid = metrics.min_dim / metrics.mid_dim
        dimension_balance = (mid_to_max + min_to_mid) / 2
    else:
        dimension_balance = 0.0

    cnc_score = _calc_cnc_likelihood(
        metrics.volume_efficiency, dimension_balance,
        metrics.aspect_ratio, metrics.min_dim,
    )

    return {
        'wall_thickness_consistency': wall_consistency,
        'planarity_score': planarity,
        'volume_distribution': volume_dist,
        'dimension_balance': dimension_balance,
        'surface_to_volume_ratio': metrics.surface_to_volume_ratio,
        'cnc_likelihood': cnc_score
    }
