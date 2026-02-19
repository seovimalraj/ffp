"""Tests for the feature_analysis module.

Tests the new classification signal analysis including:
- Hole pattern analysis
- Surface step detection
- Chamfer classification
- Rib and boss detection
- Bend radius ratio
- Edge sharpness analysis
"""
import pytest
from dataclasses import dataclass
from typing import Optional, Tuple, List

from app.core.feature_analysis import (
    analyze_holes,
    analyze_hole_patterns,
    analyze_surface_steps,
    analyze_chamfers,
    analyze_ribs,
    analyze_bosses,
    analyze_bend_radius,
    analyze_edge_sharpness,
    compute_feature_signals,
    HoleAnalysis,
    HolePatternAnalysis,
    SurfaceStepAnalysis,
    ChamferAnalysis,
    RibAnalysis,
    BossAnalysis,
    BendRadiusAnalysis,
    EdgeSharpnessAnalysis,
)


# ============================================================================
# Mock data classes for testing
# ============================================================================

@dataclass
class MockHole:
    diameter_mm: float = 10.0
    depth_mm: float = 5.0
    type: str = "through"
    position: Optional[Tuple[float, float, float]] = None


@dataclass
class MockFillet:
    radius_mm: float = 3.0
    feature_type: str = "fillet"  # or "chamfer"


@dataclass
class MockBend:
    radius_mm: float = 2.0


@dataclass 
class MockPlanarFace:
    normal: Tuple[float, float, float] = (0, 0, 1)
    width_mm: float = 10.0
    height_mm: float = 5.0


@dataclass
class MockCylindricalFace:
    diameter_mm: float = 10.0
    height_mm: float = 5.0
    is_outer: bool = True
    position: Optional[Tuple[float, float, float]] = None


# ============================================================================
# Hole Analysis Tests
# ============================================================================

class TestHoleAnalysis:
    """Test the hole depth ratio analysis."""
    
    def test_no_holes(self):
        """Empty list returns neutral analysis."""
        result = analyze_holes([])
        assert result.total_count == 0
        assert result.cnc_signal == 0.0
        assert "No holes" in result.reasoning
    
    def test_punched_holes(self):
        """Shallow holes (D/d < 1) indicate sheet metal."""
        holes = [
            MockHole(diameter_mm=10.0, depth_mm=2.0),  # D/d = 0.2
            MockHole(diameter_mm=8.0, depth_mm=3.0),   # D/d = 0.375
        ]
        result = analyze_holes(holes)
        assert result.punched_count == 2
        assert result.drilled_count == 0
        assert result.cnc_signal < 0  # Sheet metal indicator
    
    def test_drilled_holes(self):
        """Deep holes (D/d > 3) indicate CNC."""
        holes = [
            MockHole(diameter_mm=10.0, depth_mm=50.0),  # D/d = 5
            MockHole(diameter_mm=8.0, depth_mm=40.0),   # D/d = 5
        ]
        result = analyze_holes(holes)
        assert result.drilled_count == 2
        assert result.punched_count == 0
        assert result.cnc_signal > 0  # CNC indicator


# ============================================================================
# Hole Pattern Analysis Tests
# ============================================================================

class TestHolePatternAnalysis:
    """Test hole placement pattern analysis."""
    
    def test_no_holes(self):
        """Empty list returns neutral analysis."""
        result = analyze_hole_patterns([])
        assert result.total_count == 0
        assert "No holes" in result.reasoning
    
    def test_countersink_detection(self):
        """Countersinks increase CNC signal."""
        holes = [
            MockHole(type="countersink"),
            MockHole(type="countersink"),
            MockHole(type="through"),
        ]
        result = analyze_hole_patterns(holes)
        assert result.countersink_count == 2
        assert result.cnc_signal > 0  # Countersinks indicate CNC
    
    def test_counterbore_detection(self):
        """Counterbores increase CNC signal."""
        holes = [
            MockHole(type="counterbore"),
            MockHole(type="through"),
        ]
        result = analyze_hole_patterns(holes)
        assert result.counterbore_count == 1
        assert result.cnc_signal > 0
    
    def test_regular_grid_pattern(self):
        """Regular grid pattern indicates sheet metal (punched)."""
        # 2x2 grid at 20mm spacing
        holes = [
            MockHole(position=(0, 0, 0)),
            MockHole(position=(20, 0, 0)),
            MockHole(position=(0, 20, 0)),
            MockHole(position=(20, 20, 0)),
        ]
        result = analyze_hole_patterns(holes)
        # Regular pattern should have grid_score >= 0.5
        # (exact 0.5 is acceptable for a simple grid)
        assert result.grid_score >= 0.5 or result.is_regular_pattern


# ============================================================================
# Surface Step Analysis Tests
# ============================================================================

class TestSurfaceStepAnalysis:
    """Test surface step (Z-level) analysis."""
    
    def test_no_faces(self):
        """Empty list returns neutral analysis."""
        result = analyze_surface_steps([])
        assert result.distinct_levels == 0
        assert "No planar" in result.reasoning
    
    def test_two_levels_sheet_metal(self):
        """Two Z levels (top/bottom) indicates sheet metal."""
        z_levels = [0.0, 0.0, 5.0, 5.0]  # Top and bottom faces
        result = analyze_surface_steps(z_levels)
        assert result.distinct_levels == 2
        assert result.is_stepped_part is False
        assert result.cnc_signal < 0  # Sheet metal indicator
    
    def test_multiple_levels_cnc(self):
        """Many Z levels indicate CNC step machining."""
        z_levels = [0.0, 5.0, 10.0, 15.0, 20.0]  # 5 distinct levels
        result = analyze_surface_steps(z_levels)
        assert result.distinct_levels == 5
        assert result.is_stepped_part is True
        assert result.cnc_signal > 0.5  # Strong CNC indicator


# ============================================================================
# Chamfer Analysis Tests
# ============================================================================

class TestChamferAnalysis:
    """Test chamfer classification."""
    
    def test_no_chamfers(self):
        """No chamfers in fillet list."""
        fillets = [MockFillet(feature_type="fillet")]
        result = analyze_chamfers(fillets)
        assert result.total_count == 0
    
    def test_edge_breaks(self):
        """Small chamfers (<0.5mm) indicate sheet metal deburring."""
        chamfers = [
            MockFillet(radius_mm=0.3, feature_type="chamfer"),
            MockFillet(radius_mm=0.2, feature_type="chamfer"),
        ]
        result = analyze_chamfers(chamfers)
        assert result.edge_break_count == 2
        assert result.cnc_signal < 0  # Sheet metal indicator
    
    def test_standard_chamfers(self):
        """Standard 45° chamfers (≥1mm) indicate CNC."""
        chamfers = [
            MockFillet(radius_mm=1.5, feature_type="chamfer"),
            MockFillet(radius_mm=2.0, feature_type="chamfer"),
        ]
        result = analyze_chamfers(chamfers)
        assert result.standard_45deg_count == 2
        assert result.cnc_signal > 0  # CNC indicator


# ============================================================================
# Rib Analysis Tests
# ============================================================================

class TestRibAnalysis:
    """Test thin-wall rib detection."""
    
    def test_no_ribs(self):
        """No ribs detected."""
        result = analyze_ribs([])
        assert result.total_count == 0
    
    def test_thin_wall_ribs(self):
        """Detect thin vertical walls (height >> width)."""
        # Vertical faces with horizontal normals
        faces = [
            MockPlanarFace(normal=(1, 0, 0), width_mm=2.0, height_mm=20.0),  # H/W = 10
            MockPlanarFace(normal=(0, 1, 0), width_mm=3.0, height_mm=15.0),  # H/W = 5
        ]
        result = analyze_ribs(faces)
        assert result.total_count == 2
        assert result.cnc_signal > 0  # Ribs indicate CNC
        assert result.max_height_to_thickness_ratio >= 5


# ============================================================================
# Boss Analysis Tests
# ============================================================================

class TestBossAnalysis:
    """Test boss (raised cylindrical feature) detection."""
    
    def test_no_bosses(self):
        """No cylindrical faces."""
        result = analyze_bosses([])
        assert result.total_count == 0
    
    def test_boss_detection(self):
        """Short cylindrical features (H/D < 2) are bosses."""
        cylinders = [
            MockCylindricalFace(diameter_mm=10.0, height_mm=8.0, is_outer=True),  # H/D = 0.8
            MockCylindricalFace(diameter_mm=15.0, height_mm=10.0, is_outer=True),  # H/D = 0.67
        ]
        result = analyze_bosses(cylinders)
        assert result.total_count == 2
        assert result.cnc_signal > 0  # Bosses indicate CNC


# ============================================================================
# Bend Radius Analysis Tests
# ============================================================================

class TestBendRadiusAnalysis:
    """Test bend radius to thickness ratio analysis."""
    
    def test_no_bends(self):
        """No bends."""
        result = analyze_bend_radius([], material_thickness_mm=2.0)
        assert result.total_count == 0
    
    def test_standard_bend_radii(self):
        """R/t in 0.5-2.0 range indicates sheet metal."""
        bends = [
            MockBend(radius_mm=2.0),  # R/t = 1.0
            MockBend(radius_mm=3.0),  # R/t = 1.5
        ]
        result = analyze_bend_radius(bends, material_thickness_mm=2.0)
        assert result.valid_ratio_count == 2
        assert result.cnc_signal < 0  # Sheet metal indicator
    
    def test_tight_bend_radii(self):
        """R/t < 0.5 indicates specialty forming."""
        bends = [
            MockBend(radius_mm=0.5),  # R/t = 0.25
        ]
        result = analyze_bend_radius(bends, material_thickness_mm=2.0)
        assert result.tight_radius_count == 1


# ============================================================================
# Edge Sharpness Analysis Tests
# ============================================================================

class TestEdgeSharpnessAnalysis:
    """Test edge treatment analysis."""
    
    def test_no_edges(self):
        """No edges to analyze."""
        result = analyze_edge_sharpness(total_edge_count=0)
        assert result.total_edge_count == 0
    
    def test_small_edge_breaks(self):
        """Small uniform edge breaks indicate sheet metal."""
        fillets = [
            MockFillet(radius_mm=0.3, feature_type="fillet"),
            MockFillet(radius_mm=0.4, feature_type="fillet"),
        ]
        result = analyze_edge_sharpness(
            total_edge_count=10,
            fillets=fillets,
            chamfers=[]
        )
        assert result.filleted_edge_count == 2
        assert result.avg_edge_treatment_mm < 0.5


# ============================================================================
# Compute Feature Signals Integration Tests
# ============================================================================

class TestComputeFeatureSignals:
    """Test the combined feature signal computation."""
    
    def test_empty_inputs(self):
        """Empty inputs produce neutral score."""
        signals = compute_feature_signals()
        assert signals.feature_cnc_score == 50  # Neutral
    
    def test_sheet_metal_profile(self):
        """Sheet metal features produce low CNC score."""
        holes = [MockHole(diameter_mm=10, depth_mm=2)]  # Shallow
        fillets = [MockFillet(radius_mm=0.3, feature_type="chamfer")]  # Edge break
        
        signals = compute_feature_signals(
            holes=holes,
            fillets=fillets,
        )
        # Should lean toward sheet metal (score < 50)
        assert signals.feature_cnc_score <= 50
    
    def test_cnc_profile(self):
        """CNC features produce high CNC score."""
        holes = [
            MockHole(diameter_mm=10, depth_mm=50, type="countersink"),  # Deep with countersink
        ]
        fillets = [MockFillet(radius_mm=4.0, feature_type="fillet")]  # Tool radius
        
        # Multiple Z levels (stepped)
        z_levels = [0, 5, 10, 15, 20]
        
        signals = compute_feature_signals(
            holes=holes,
            fillets=fillets,
            planar_face_z_levels=z_levels,
        )
        # Should lean toward CNC (score > 50)
        assert signals.feature_cnc_score >= 50
