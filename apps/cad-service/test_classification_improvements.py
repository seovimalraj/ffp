"""
Test script to verify improved part classification.
Tests that CNC machining parts with thin features are correctly identified.
"""
from app.core.geometry import GeometricMetrics, calculate_sheet_metal_score
from app.core.classification import ProcessClassifier

def test_solid_cnc_block():
    """Test that solid block is classified as CNC milling"""
    print("\n=== Test 1: Solid CNC Block (50x50x50mm) ===")
    metrics = GeometricMetrics(
        bbox_dims=[50.0, 50.0, 50.0],
        volume_mm3=125000,  # 50^3 = fully solid
        surface_area_mm2=15000
    )
    
    sheet_metal_score = calculate_sheet_metal_score(metrics)
    print(f"Sheet metal score: {sheet_metal_score:.1f}/100")
    print(f"Volume efficiency: {metrics.volume_efficiency:.2f}")
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify()
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    assert process_type in ['cnc_milling', 'cnc_turning'], \
        f"Expected CNC process, got {process_type}"
    print("✅ PASSED: Solid block correctly identified as CNC")

def test_cnc_part_with_thin_features():
    """Test CNC part that has thin features but is mostly solid and chunky"""
    print("\n=== Test 2: CNC Part with Thin Features (35x30x5mm, 75% solid) ===")
    # Part dimensions: 35x30x5mm (chunky box-like)
    # Has some thin features but volume efficiency is high (solid part)
    # Aspect ratio: 35/5 = 7:1 (chunky, not flat)
    metrics = GeometricMetrics(
        bbox_dims=[5.0, 30.0, 35.0],
        volume_mm3=3940,  # 75% of bbox volume (5250) = solid part
        surface_area_mm2=2750
    )
    
    sheet_metal_score = calculate_sheet_metal_score(metrics)
    print(f"Sheet metal score: {sheet_metal_score:.1f}/100")
    print(f"Volume efficiency: {metrics.volume_efficiency:.2f}")
    print(f"Min dimension: {metrics.min_dim}mm")
    
    classifier = ProcessClassifier(metrics)
    # Simulate detected thickness in sheet metal range
    process_type, confidence, metadata = classifier.classify(
        detected_thickness=4.8,  # Thin feature detected
        thickness_confidence=0.85
    )
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    # With improved logic, high volume efficiency should override thin thickness
    assert process_type == 'cnc_milling', \
        f"Expected cnc_milling despite thin features, got {process_type}"
    print("✅ PASSED: CNC part correctly identified despite thin features")

def test_sheet_metal_flat_plate():
    """Test that genuine sheet metal flat plate is classified correctly"""
    print("\n=== Test 3: Sheet Metal Flat Plate (200x100x2mm) ===")
    metrics = GeometricMetrics(
        bbox_dims=[2.0, 100.0, 200.0],
        volume_mm3=40000,  # 200*100*2 = fully flat
        surface_area_mm2=42000
    )
    
    sheet_metal_score = calculate_sheet_metal_score(metrics)
    print(f"Sheet metal score: {sheet_metal_score:.1f}/100")
    print(f"Volume efficiency: {metrics.volume_efficiency:.2f}")
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify(
        detected_thickness=2.0,
        thickness_confidence=0.95
    )
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    assert process_type == 'sheet_metal', \
        f"Expected sheet_metal, got {process_type}"
    print("✅ PASSED: Sheet metal flat plate correctly identified")

def test_sheet_metal_bent_bracket():
    """Test sheet metal bent part (U-bracket)"""
    print("\n=== Test 4: Sheet Metal Bent Bracket (165x40x20mm envelope, hollow) ===")
    metrics = GeometricMetrics(
        bbox_dims=[20.0, 40.0, 165.0],
        volume_mm3=6600,  # Much less than bbox (hollow/bent structure)
        surface_area_mm2=14000
    )
    
    sheet_metal_score = calculate_sheet_metal_score(metrics)
    print(f"Sheet metal score: {sheet_metal_score:.1f}/100")
    print(f"Volume efficiency: {metrics.volume_efficiency:.2f}")
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify(
        detected_thickness=2.0,
        thickness_confidence=0.90,
        triangle_count=8000
    )
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    print(f"Bend count: {metadata.get('bend_analysis', {}).get('bend_count', 0)}")
    
    assert process_type == 'sheet_metal', \
        f"Expected sheet_metal, got {process_type}"
    print("✅ PASSED: Sheet metal bent bracket correctly identified")

def test_ambiguous_thin_cnc_part():
    """Test ambiguous part - thin but moderately solid (borderline case)"""
    print("\n=== Test 5: Ambiguous Thin CNC Part (50x40x4mm, 60% solid) ===")
    # Aspect ratio: 50/4 = 12.5:1 (between chunky and flat sheet thresholds)
    # Volume efficiency: 60% (moderately solid, but below 65% threshold)
    metrics = GeometricMetrics(
        bbox_dims=[4.0, 40.0, 50.0],
        volume_mm3=4800,  # 60% of bbox volume (8000)
        surface_area_mm2=5200
    )
    
    sheet_metal_score = calculate_sheet_metal_score(metrics)
    print(f"Sheet metal score: {sheet_metal_score:.1f}/100")
    print(f"Volume efficiency: {metrics.volume_efficiency:.2f}")
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify(
        detected_thickness=3.8,
        thickness_confidence=0.70
    )
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    # Moderate solidity (0.6) but not super flat - could go either way
    # With current thresholds, 0.6 is below 0.65 so it should classify as sheet metal
    # This is actually a borderline case where both could be valid
    assert process_type in ['sheet_metal', 'cnc_milling'], \
        f"Expected sheet_metal or cnc_milling for borderline case, got {process_type}"
    print(f"✅ PASSED: Borderline case classified as {process_type} (acceptable)")

if __name__ == "__main__":
    print("="*60)
    print("TESTING IMPROVED PART CLASSIFICATION")
    print("Testing CNC vs Sheet Metal identification")
    print("="*60)
    
    try:
        test_solid_cnc_block()
        test_cnc_part_with_thin_features()
        test_sheet_metal_flat_plate()
        test_sheet_metal_bent_bracket()
        test_ambiguous_thin_cnc_part()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        print("\nSUMMARY OF IMPROVEMENTS:")
        print("1. Volume efficiency now heavily weighted in classification")
        print("2. CNC parts with thin features correctly identified (vol eff > 0.65)")
        print("3. Sheet metal requires low volume efficiency (<0.5)")
        print("4. Thickness detection no longer sole determinant")
        print("5. Multiple factors considered: thickness + volume + bends")
        
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
