"""
Comprehensive test for advanced sheet metal thickness detection.
Tests the new clustering-based approach with proper criteria.
"""
from app.core.advanced_thickness_detection import (
    AdvancedThicknessDetector,
    ThicknessCluster
)
from app.core.geometry import GeometricMetrics
from app.core.classification import ProcessClassifier
import numpy as np


def test_advanced_detector_sheet_metal():
    """Test sheet metal with uniform thickness"""
    print("\n=== Test 1: Sheet Metal Flat Plate (uniform 2mm) ===")
    
    # Simulate 2mm uniform thickness measurements
    # Sheet metal should have consistent thickness across large area
    distances = [2.0] * 800 + [1.9, 2.1] * 100  # Very uniform
    
    detector = AdvancedThicknessDetector(
        bbox_dims=[2.0, 100.0, 200.0],
        surface_area_mm2=42000
    )
    
    result = detector.analyze_from_mesh_distances(distances)
    
    print(f"Detected thickness: {result.detected_thickness}mm")
    print(f"Is sheet thickness: {result.is_sheet_thickness}")
    print(f"Confidence: {result.confidence:.1%}")
    print(f"Uniform ratio: {result.uniform_ratio:.1%}")
    print(f"T/L ratio: {result.thickness_to_size_ratio:.1%}")
    print(f"Cluster dominance: {result.cluster_dominance:.1f}x")
    print(f"Reasoning: {result.reasoning}")
    
    assert result.is_sheet_thickness, "Should detect as sheet metal"
    assert result.confidence > 0.7, f"Low confidence: {result.confidence}"
    assert result.uniform_ratio > 0.35, f"Low uniform ratio: {result.uniform_ratio}"
    print("✅ PASSED: Sheet metal correctly detected")


def test_advanced_detector_cnc_block():
    """Test CNC machined solid block"""
    print("\n=== Test 2: CNC Solid Block (varying distances) ===")
    
    # Simulate solid block - many different "thicknesses" (really just distances)
    # No dominant uniform thickness
    distances = list(range(5, 50, 1)) * 10  # Many different distances
    
    detector = AdvancedThicknessDetector(
        bbox_dims=[50.0, 50.0, 50.0],
        surface_area_mm2=15000
    )
    
    result = detector.analyze_from_mesh_distances(distances)
    
    print(f"Detected thickness: {result.detected_thickness}mm")
    print(f"Is sheet thickness: {result.is_sheet_thickness}")
    print(f"Confidence: {result.confidence:.1%}")
    print(f"Uniform ratio: {result.uniform_ratio:.1%}")
    print(f"T/L ratio: {result.thickness_to_size_ratio:.1%}")
    print(f"Reasoning: {result.reasoning}")
    
    assert not result.is_sheet_thickness, "Should NOT detect as sheet metal"
    print("✅ PASSED: CNC block correctly rejected")


def test_advanced_detector_sheet_with_bends():
    """Test sheet metal with bends (slight thickness variations)"""
    print("\n=== Test 3: Sheet Metal Bent Bracket (2.5mm) ===")
    
    # Simulate bent sheet metal - mostly uniform with some variation at bends
    distances = [2.5] * 600 + [2.3, 2.7] * 150 + [2.4, 2.6] * 50
    
    detector = AdvancedThicknessDetector(
        bbox_dims=[20.0, 40.0, 165.0],
        surface_area_mm2=14000
    )
    
    result = detector.analyze_from_mesh_distances(distances)
    
    print(f"Detected thickness: {result.detected_thickness}mm")
    print(f"Is sheet thickness: {result.is_sheet_thickness}")
    print(f"Confidence: {result.confidence:.1%}")
    print(f"Uniform ratio: {result.uniform_ratio:.1%}")
    print(f"T/L ratio: {result.thickness_to_size_ratio:.1%}")
    print(f"Reasoning: {result.reasoning}")
    
    assert result.is_sheet_thickness, "Should detect as sheet metal"
    assert result.confidence > 0.6, f"Low confidence: {result.confidence}"
    print("✅ PASSED: Bent sheet metal correctly detected")


def test_advanced_detector_cnc_with_thin_features():
    """Test CNC part with thin features (should NOT be sheet metal)"""
    print("\n=== Test 4: CNC Part with Thin Features (NOT sheet metal) ===")
    
    # Simulate CNC part with some thin walls but also thick sections
    # Two dominant clusters: 5mm (thin walls) and 20mm (thick sections)
    # More realistic distribution - not equal
    distances = [5.0, 4.8, 5.2, 4.9, 5.1] * 150 + [20.0, 19.5, 20.5, 19.8, 20.2] * 100 + list(range(8, 18)) * 15
    
    detector = AdvancedThicknessDetector(
        bbox_dims=[5.0, 30.0, 35.0],
        surface_area_mm2=2750
    )
    
    result = detector.analyze_from_mesh_distances(distances)
    
    print(f"Detected thickness: {result.detected_thickness}mm")
    print(f"Is sheet thickness: {result.is_sheet_thickness}")
    print(f"Confidence: {result.confidence:.1%}")
    print(f"Uniform ratio: {result.uniform_ratio:.1%}")
    print(f"Cluster dominance: {result.cluster_dominance:.1f}x")
    print(f"Reasoning: {result.reasoning}")
    
    # With 5mm thin feature, should fail either on:
    # - thinness (T/L = 5/35 = 14% > 3%) OR
    # - low dominance (two clusters with significant support)
    # Either way, should NOT be sheet metal
    if result.is_sheet_thickness:
        print(f"⚠️  Detected as sheet metal despite: T/L={result.thickness_to_size_ratio:.1%}, dominance={result.cluster_dominance:.1f}x")
        assert False, "Should NOT detect as sheet metal (too thick or low dominance)"
    
    print("✅ PASSED: CNC with thin features correctly rejected")


def test_full_classification_with_advanced_analysis():
    """Test full classification pipeline with advanced analysis"""
    print("\n=== Test 5: Full Classification Pipeline ===")
    
    # Sheet metal case
    print("\n--- Sheet Metal Plate ---")
    metrics = GeometricMetrics(
        bbox_dims=[2.0, 100.0, 200.0],
        volume_mm3=40000,
        surface_area_mm2=42000
    )
    
    # Create mock advanced analysis result
    from app.core.advanced_thickness_detection import ThicknessAnalysisResult
    thickness_analysis = ThicknessAnalysisResult(
        detected_thickness=2.0,
        confidence=0.92,
        uniform_ratio=0.85,
        thickness_to_size_ratio=0.01,  # 2mm / 200mm
        cluster_dominance=8.5,
        clusters=[],
        is_sheet_thickness=True,
        reasoning="T=2.00mm: high uniform ratio (85.0%), very thin (T/L=1.0%), strong dominance (8.5x), very consistent"
    )
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify(
        thickness_analysis=thickness_analysis
    )
    
    print(f"Process type: {process_type}")
    print(f"Confidence: {confidence:.1%}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    assert process_type == 'sheet_metal', f"Expected sheet_metal, got {process_type}"
    assert confidence > 0.85, f"Low confidence: {confidence}"
    print("✅ Sheet metal correctly classified")
    
    # CNC case
    print("\n--- CNC Solid Block ---")
    metrics2 = GeometricMetrics(
        bbox_dims=[35.0, 30.0, 5.0],
        volume_mm3=3940,
        surface_area_mm2=2750
    )
    
    thickness_analysis2 = ThicknessAnalysisResult(
        detected_thickness=None,
        confidence=0.70,
        uniform_ratio=0.15,  # Low uniform ratio
        thickness_to_size_ratio=0.14,  # Not thin
        cluster_dominance=1.2,  # Low dominance
        clusters=[],
        is_sheet_thickness=False,
        reasoning="T=5.00mm: LOW uniform ratio (15.0%), NOT thin (T/L=14.0%), weak dominance (1.2x)"
    )
    
    classifier2 = ProcessClassifier(metrics2)
    process_type2, confidence2, metadata2 = classifier2.classify(
        thickness_analysis=thickness_analysis2
    )
    
    print(f"Process type: {process_type2}")
    print(f"Confidence: {confidence2:.1%}")
    print(f"Reasoning: {metadata2.get('reasoning', 'N/A')}")
    
    assert process_type2 == 'cnc_milling', f"Expected cnc_milling, got {process_type2}"
    print("✅ CNC block correctly classified")


if __name__ == "__main__":
    print("="*70)
    print("TESTING ADVANCED SHEET METAL THICKNESS DETECTION")
    print("Using proper face-pairing, clustering, and area-weighted analysis")
    print("="*70)
    
    try:
        test_advanced_detector_sheet_metal()
        test_advanced_detector_cnc_block()
        test_advanced_detector_sheet_with_bends()
        test_advanced_detector_cnc_with_thin_features()
        test_full_classification_with_advanced_analysis()
        
        print("\n" + "="*70)
        print("✅ ALL ADVANCED DETECTION TESTS PASSED!")
        print("="*70)
        print("\n📊 SUMMARY OF ADVANCED DETECTION:")
        print("1. Clustering-based thickness analysis (not just min)")
        print("2. Area-weighted dominance (not just count)")
        print("3. Uniform ratio requirement (≥35% coverage)")
        print("4. Thinness criterion (T/L ≤ 3%)")
        print("5. Cluster dominance (≥2x second cluster)")
        print("6. Multi-factor confidence scoring")
        print("\n🎯 RESULT: Accurate sheet metal vs CNC distinction!")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        import sys
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        import sys
        sys.exit(1)
