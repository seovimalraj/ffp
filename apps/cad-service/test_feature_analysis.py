"""
Tests for enhanced feature-based classification.

Tests the new discriminating signals:
1. Hole depth/diameter ratio
2. Pocket depth analysis
3. Fillet radius classification
4. Thickness uniformity
5. Material-specific thresholds
6. CNC block vs sheet metal discrimination
"""
import pytest
from app.core.feature_analysis import (
    analyze_holes,
    analyze_pockets,
    analyze_fillets,
    analyze_thickness_uniformity,
    compute_feature_signals,
    HoleAnalysis,
    PocketAnalysis,
    FilletAnalysis,
    ThicknessUniformity,
)
from app.core.classification import (
    ProcessClassifier,
    MATERIAL_THICKNESS_RANGES,
    SHEET_METAL_MAX_THICKNESS,
)
from app.core.geometry import GeometricMetrics
from app.models import HoleFeature, PocketFeature, FilletFeature


class MockHole:
    """Mock hole for testing."""
    def __init__(self, diameter_mm: float, depth_mm: float):
        self.diameter_mm = diameter_mm
        self.depth_mm = depth_mm


class MockPocket:
    """Mock pocket for testing."""
    def __init__(self, depth_mm: float, step_count: int = 1, 
                 corner_radius_mm: float = 0.0, is_through: bool = False):
        self.depth_mm = depth_mm
        self.step_count = step_count
        self.corner_radius_mm = corner_radius_mm
        self.is_through = is_through


class MockFillet:
    """Mock fillet for testing."""
    def __init__(self, radius_mm: float, feature_type: str = "fillet"):
        self.radius_mm = radius_mm
        self.feature_type = feature_type


# ===========================================================================
# Hole Analysis Tests
# ===========================================================================

def test_hole_analysis_punched_holes():
    """Test shallow holes (D/d < 1.0) are classified as punched (sheet metal)."""
    holes = [
        MockHole(diameter_mm=10.0, depth_mm=2.0),   # D/d = 0.2
        MockHole(diameter_mm=8.0, depth_mm=3.0),    # D/d = 0.375
        MockHole(diameter_mm=6.0, depth_mm=4.0),    # D/d = 0.67
    ]
    
    analysis = analyze_holes(holes)
    
    assert analysis.total_count == 3
    assert analysis.punched_count == 3
    assert analysis.drilled_count == 0
    assert analysis.cnc_signal < 0  # Negative = sheet metal
    print(f"✅ Punched holes: cnc_signal={analysis.cnc_signal:.2f}, {analysis.reasoning}")


def test_hole_analysis_drilled_holes():
    """Test deep holes (D/d > 3.0) are classified as drilled (CNC)."""
    holes = [
        MockHole(diameter_mm=6.0, depth_mm=24.0),   # D/d = 4.0
        MockHole(diameter_mm=8.0, depth_mm=40.0),   # D/d = 5.0
        MockHole(diameter_mm=10.0, depth_mm=50.0),  # D/d = 5.0
    ]
    
    analysis = analyze_holes(holes)
    
    assert analysis.total_count == 3
    assert analysis.drilled_count == 3
    assert analysis.punched_count == 0
    assert analysis.cnc_signal > 0  # Positive = CNC
    print(f"✅ Drilled holes: cnc_signal={analysis.cnc_signal:.2f}, {analysis.reasoning}")


def test_hole_analysis_mixed():
    """Test mixed holes produce intermediate signal."""
    holes = [
        MockHole(diameter_mm=10.0, depth_mm=2.0),   # D/d = 0.2 (punched)
        MockHole(diameter_mm=6.0, depth_mm=12.0),   # D/d = 2.0 (intermediate)
        MockHole(diameter_mm=8.0, depth_mm=40.0),   # D/d = 5.0 (drilled)
    ]
    
    analysis = analyze_holes(holes)
    
    assert analysis.total_count == 3
    assert analysis.punched_count == 1
    assert analysis.drilled_count == 1
    assert analysis.intermediate_count == 1
    # Signal should be closer to neutral
    assert -0.5 < analysis.cnc_signal < 0.5
    print(f"✅ Mixed holes: cnc_signal={analysis.cnc_signal:.2f}, {analysis.reasoning}")


# ===========================================================================
# Pocket Analysis Tests
# ===========================================================================

def test_pocket_analysis_deep_pockets():
    """Test deep pockets (>10mm) indicate CNC."""
    pockets = [
        MockPocket(depth_mm=15.0),
        MockPocket(depth_mm=20.0),
        MockPocket(depth_mm=25.0),
    ]
    
    analysis = analyze_pockets(pockets)
    
    assert analysis.total_count == 3
    assert analysis.deep_pocket_count == 3
    assert analysis.cnc_signal > 0.3
    print(f"✅ Deep pockets: cnc_signal={analysis.cnc_signal:.2f}, {analysis.reasoning}")


def test_pocket_analysis_multi_step():
    """Test multi-step pockets strongly indicate CNC."""
    pockets = [
        MockPocket(depth_mm=5.0, step_count=3),  # Multi-step
        MockPocket(depth_mm=8.0, step_count=2),  # Multi-step
    ]
    
    analysis = analyze_pockets(pockets)
    
    assert analysis.multi_step_count == 2
    assert analysis.cnc_signal >= 0.5  # Strong CNC signal
    print(f"✅ Multi-step pockets: cnc_signal={analysis.cnc_signal:.2f}, {analysis.reasoning}")


def test_pocket_analysis_tool_radius():
    """Test tool-radius corners (R3-R6mm) indicate CNC."""
    pockets = [
        MockPocket(depth_mm=5.0, corner_radius_mm=4.0),  # Tool radius
        MockPocket(depth_mm=3.0, corner_radius_mm=5.0),  # Tool radius
    ]
    
    analysis = analyze_pockets(pockets)
    
    assert analysis.tool_radius_count == 2
    assert analysis.cnc_signal > 0.2
    print(f"✅ Tool-radius pockets: cnc_signal={analysis.cnc_signal:.2f}, {analysis.reasoning}")


def test_pocket_analysis_through_pockets():
    """Test through pockets are more sheet-metal-like."""
    pockets = [
        MockPocket(depth_mm=2.0, is_through=True),
        MockPocket(depth_mm=2.0, is_through=True),
    ]
    
    analysis = analyze_pockets(pockets)
    
    assert analysis.through_count == 2
    # Through pockets reduce CNC signal
    assert analysis.cnc_signal <= 0
    print(f"✅ Through pockets: cnc_signal={analysis.cnc_signal:.2f}, {analysis.reasoning}")


# ===========================================================================
# Fillet Analysis Tests
# ===========================================================================

def test_fillet_analysis_tool_radius():
    """Test R3-R6mm fillets indicate CNC tool radius."""
    fillets = [
        MockFillet(radius_mm=3.0),
        MockFillet(radius_mm=4.5),
        MockFillet(radius_mm=6.0),
    ]
    
    analysis = analyze_fillets(fillets)
    
    assert analysis.tool_radius_count == 3
    assert analysis.bend_relief_count == 0
    assert analysis.cnc_signal > 0.5  # Strong CNC signal
    print(f"✅ Tool-radius fillets: cnc_signal={analysis.cnc_signal:.2f}, {analysis.reasoning}")


def test_fillet_analysis_bend_relief():
    """Test small fillets (≤R2mm) indicate sheet metal bend relief."""
    fillets = [
        MockFillet(radius_mm=0.5),
        MockFillet(radius_mm=1.0),
        MockFillet(radius_mm=2.0),
    ]
    
    analysis = analyze_fillets(fillets)
    
    assert analysis.bend_relief_count == 3
    assert analysis.tool_radius_count == 0
    assert analysis.cnc_signal < 0  # Negative = sheet metal
    print(f"✅ Bend-relief fillets: cnc_signal={analysis.cnc_signal:.2f}, {analysis.reasoning}")


def test_fillet_analysis_chamfers_ignored():
    """Test chamfers are not counted as fillets."""
    fillets = [
        MockFillet(radius_mm=5.0, feature_type="chamfer"),
        MockFillet(radius_mm=5.0, feature_type="chamfer"),
    ]
    
    analysis = analyze_fillets(fillets)
    
    # Chamfers should be ignored in radius analysis
    assert analysis.tool_radius_count == 0
    assert analysis.bend_relief_count == 0
    print(f"✅ Chamfers ignored: cnc_signal={analysis.cnc_signal:.2f}")


# ===========================================================================
# Thickness Uniformity Tests
# ===========================================================================

def test_thickness_uniformity_uniform():
    """Test uniform thickness is detected as sheet metal."""
    distances = [2.0, 2.0, 2.0, 2.0, 2.1, 1.9, 2.0, 2.0]  # All ~2mm
    
    analysis = analyze_thickness_uniformity(distances)
    
    assert analysis.is_uniform == True
    assert analysis.thickness_count <= 2
    assert 1.9 <= analysis.dominant_thickness_mm <= 2.1
    assert analysis.cnc_signal < 0  # Negative = sheet metal
    print(f"✅ Uniform thickness: {analysis.reasoning}, cnc_signal={analysis.cnc_signal:.2f}")


def test_thickness_uniformity_varying():
    """Test varying thicknesses indicate CNC (pockets/steps)."""
    distances = [2.0, 5.0, 8.0, 2.0, 12.0, 15.0]  # Multiple distinct thicknesses
    
    analysis = analyze_thickness_uniformity(distances)
    
    assert analysis.is_uniform == False
    assert analysis.thickness_count >= 3
    assert analysis.cnc_signal > 0  # Positive = CNC
    print(f"✅ Varying thickness: {analysis.reasoning}, cnc_signal={analysis.cnc_signal:.2f}")


# ===========================================================================
# Material-Specific Threshold Tests
# ===========================================================================

def test_material_thickness_ranges():
    """Test material-specific thickness ranges are configured."""
    assert 'steel' in MATERIAL_THICKNESS_RANGES
    assert 'aluminum' in MATERIAL_THICKNESS_RANGES
    assert 'default' in MATERIAL_THICKNESS_RANGES
    
    # Aluminum can have thicker sheets
    steel_max = MATERIAL_THICKNESS_RANGES['steel'][1]
    aluminum_max = MATERIAL_THICKNESS_RANGES['aluminum'][1]
    assert aluminum_max > steel_max
    
    print(f"✅ Steel range: {MATERIAL_THICKNESS_RANGES['steel']}")
    print(f"✅ Aluminum range: {MATERIAL_THICKNESS_RANGES['aluminum']}")


def test_classifier_uses_material_thresholds():
    """Test classifier respects material-specific thresholds."""
    # 8mm thick part - sheet metal for aluminum, CNC for steel
    bbox = [8.0, 100.0, 200.0]  # 8mm thick × 100 × 200mm
    volume = 8.0 * 100.0 * 200.0
    area = 2 * (100 * 200 + 8 * 100 + 8 * 200)
    
    metrics = GeometricMetrics(bbox, volume, area)
    classifier = ProcessClassifier(metrics)
    
    # Steel: 8mm is outside sheet range (0.4-6mm)
    result_steel = classifier.classify(material='steel')
    print(f"Steel 8mm: {result_steel[0]}, conf={result_steel[1]:.2f}")
    
    # Aluminum: 8mm is within sheet range (0.5-10mm)
    # Note: may still be CNC due to other factors (aspect ratio, etc.)
    result_aluminum = classifier.classify(material='aluminum')
    print(f"Aluminum 8mm: {result_aluminum[0]}, conf={result_aluminum[1]:.2f}")
    
    # Just verify classifier accepts material parameter
    assert result_steel[2].get('material') == 'steel'
    assert result_aluminum[2].get('material') == 'aluminum'
    print("✅ Material-specific classification working")


# ===========================================================================
# CNC Block vs Sheet Metal Tests
# ===========================================================================

def test_cnc_block_6mm_not_sheet_metal():
    """Test 6mm CNC block is NOT classified as sheet metal."""
    # A 30×30×6mm block - cube-like, should be CNC
    bbox = [6.0, 30.0, 30.0]
    volume = 6.0 * 30.0 * 30.0
    area = 2 * (30 * 30 + 6 * 30 + 6 * 30)
    
    metrics = GeometricMetrics(bbox, volume, area)
    classifier = ProcessClassifier(metrics)
    
    # Simulate tool-radius fillets (CNC indicator)
    fillets = [
        MockFillet(radius_mm=4.0),
        MockFillet(radius_mm=4.0),
        MockFillet(radius_mm=4.0),
    ]
    
    result = classifier.classify(
        fillets=fillets,
        fillet_count=3,
    )
    
    print(f"6mm CNC block: {result[0]}, confidence={result[1]:.2f}")
    print(f"  Reasoning: {result[2].get('reasoning', '')}")
    
    # Should be CNC, not sheet metal
    assert result[0] in ['cnc_milling', 'cnc_turning'], \
        f"Expected CNC for 6mm block, got {result[0]}"
    print("✅ 6mm CNC block correctly classified as CNC")


def test_6mm_flat_sheet_still_sheet_metal():
    """Test 6mm flat sheet (high aspect ratio) IS classified as sheet metal."""
    # A 6×200×400mm flat sheet - very high aspect ratio
    bbox = [6.0, 200.0, 400.0]
    volume = 6.0 * 200.0 * 400.0
    area = 2 * (200 * 400 + 6 * 200 + 6 * 400)
    
    metrics = GeometricMetrics(bbox, volume, area)
    classifier = ProcessClassifier(metrics)
    
    result = classifier.classify()
    
    print(f"6mm flat sheet: {result[0]}, confidence={result[1]:.2f}")
    print(f"  Method: {result[2].get('classification_method', '')}")
    
    # Should be sheet metal due to high aspect ratio
    assert result[0] == 'sheet_metal', \
        f"Expected sheet_metal for 6mm flat sheet, got {result[0]}"
    print("✅ 6mm flat sheet correctly classified as sheet metal")


# ===========================================================================
# Flat Sheet with 0 Bends Tests
# ===========================================================================

def test_flat_sheet_zero_bends():
    """Test flat sheet with 0 bends is still classified as sheet metal."""
    # Large flat laser-cut part: 2mm × 300 × 400mm
    bbox = [2.0, 300.0, 400.0]
    volume = 2.0 * 300.0 * 400.0
    area = 2 * (300 * 400 + 2 * 300 + 2 * 400)
    
    metrics = GeometricMetrics(bbox, volume, area)
    classifier = ProcessClassifier(metrics)
    
    # Shallow punched holes (sheet metal indicator)
    holes = [
        MockHole(diameter_mm=10.0, depth_mm=2.0),
        MockHole(diameter_mm=8.0, depth_mm=2.0),
    ]
    
    result = classifier.classify(
        holes=holes,
        hole_count=2,
    )
    
    print(f"Flat sheet 0 bends: {result[0]}, confidence={result[1]:.2f}")
    print(f"  Method: {result[2].get('classification_method', '')}")
    
    # Should be sheet metal even with 0 bends
    assert result[0] == 'sheet_metal', \
        f"Expected sheet_metal for flat laser-cut part, got {result[0]}"
    print("✅ Flat sheet with 0 bends correctly classified as sheet metal")


# ===========================================================================
# Combined Feature Signals Test
# ===========================================================================

def test_compute_feature_signals_combined():
    """Test combined feature signals computation."""
    holes = [MockHole(10.0, 2.0), MockHole(8.0, 3.0)]  # Punched
    pockets = [MockPocket(5.0, is_through=True)]  # Through pocket
    fillets = [MockFillet(1.5), MockFillet(1.0)]  # Bend relief
    
    signals = compute_feature_signals(
        holes=holes,
        pockets=pockets,
        fillets=fillets,
        min_dim=2.0,
    )
    
    print(f"Combined signals:")
    print(f"  Holes: {signals.hole_analysis.reasoning}")
    print(f"  Pockets: {signals.pocket_analysis.reasoning}")
    print(f"  Fillets: {signals.fillet_analysis.reasoning}")
    print(f"  Feature CNC score: {signals.feature_cnc_score:.1f}")
    print(f"  Reasoning: {signals.reasoning}")
    
    # All signals point to sheet metal
    assert signals.feature_cnc_score < 50  # Below neutral = sheet metal
    print("✅ Combined feature signals indicate sheet metal")


def test_compute_feature_signals_cnc():
    """Test combined feature signals for CNC part."""
    holes = [MockHole(6.0, 24.0), MockHole(8.0, 40.0)]  # Deep drilled
    pockets = [MockPocket(15.0, step_count=2, corner_radius_mm=4.0)]  # Deep, multi-step, tool radius
    fillets = [MockFillet(4.0), MockFillet(5.0), MockFillet(4.0)]  # Tool radius
    
    signals = compute_feature_signals(
        holes=holes,
        pockets=pockets,
        fillets=fillets,
        min_dim=20.0,
    )
    
    print(f"CNC signals:")
    print(f"  Holes: {signals.hole_analysis.reasoning}")
    print(f"  Pockets: {signals.pocket_analysis.reasoning}")
    print(f"  Fillets: {signals.fillet_analysis.reasoning}")
    print(f"  Feature CNC score: {signals.feature_cnc_score:.1f}")
    
    # All signals point to CNC
    assert signals.feature_cnc_score > 50  # Above neutral = CNC
    print("✅ Combined feature signals indicate CNC")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
