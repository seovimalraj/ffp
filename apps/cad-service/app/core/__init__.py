"""Core geometry analysis and classification modules."""

from .geometry import GeometricMetrics, calculate_sheet_metal_score, calculate_advanced_metrics
from .classification import ProcessClassifier
from .validation import GeometryValidator, validate_geometry
from .bend_detection import AdvancedBendDetector
from .advanced_thickness_detection import AdvancedThicknessDetector, enhanced_ray_casting_analysis

__all__ = [
    "GeometricMetrics",
    "calculate_sheet_metal_score",
    "calculate_advanced_metrics",
    "ProcessClassifier",
    "GeometryValidator",
    "validate_geometry",
    "AdvancedBendDetector",
    "AdvancedThicknessDetector",
    "enhanced_ray_casting_analysis",
]
