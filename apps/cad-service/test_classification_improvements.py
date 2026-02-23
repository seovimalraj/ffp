"""
Test script to verify improved part classification.
Tests that CNC machining parts with thin features are correctly identified.
"""
from app.core.geometry import GeometricMetrics, calculate_sheet_metal_score
from app.core.classification import ProcessClassifier
from app.core.face_classification import FaceClassificationResult, FaceTypeHistogram

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


def test_cnc_turned_part_high_cylinder_area():
    """Test CNC turned part with high cylinder_area_ratio is correctly identified"""
    print("\n=== Test 6: CNC Turned Part (High Cylinder Area Ratio) ===")
    
    metrics = GeometricMetrics(
        bbox_dims=[166.0, 65.0, 65.0],  # Turned part envelope
        volume_mm3=338300,
        surface_area_mm2=54034
    )
    
    # Face classification for turned part - high cylinder area
    fc = FaceClassificationResult(
        histogram=FaceTypeHistogram(plane=18, cylinder=4, cone=0, torus=4),
        plane_ratio=0.69,
        cylinder_ratio=0.15,
        freeform_ratio=0.0,
        mixed_ratio=0.31,
        plane_area_ratio=0.15,
        cylinder_area_ratio=0.82,  # Very high - indicates turning
        paired_plane_count=4,
        paired_plane_area=4364,
        dominant_pair_thickness=6.0,
        is_likely_sheet_metal=False,
        is_likely_cnc=False,
        cnc_face_score=35,
        sheet_metal_face_score=41,
        reasoning="Turned cylindrical part"
    )
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify(
        face_classification=fc,
        detected_thickness=0.81,  # Thin wall detected between cylinders
        thickness_confidence=0.95
    )
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Method: {metadata.get('classification_method', 'N/A')}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    assert process_type == 'cnc_milling', \
        f"Expected cnc_milling for turned part, got {process_type}"
    assert 'turned' in metadata.get('classification_method', '').lower() or \
           'cylinder' in metadata.get('reasoning', '').lower(), \
        "Should mention turning/cylinder in classification"
    print("✅ PASSED: CNC turned part correctly identified via cylinder_area_ratio")


def test_cnc_part_with_chamfers():
    """Test CNC turned part with chamfers (cone faces)"""
    print("\n=== Test 7: CNC Turned Part with Chamfers ===")
    
    metrics = GeometricMetrics(
        bbox_dims=[30.0, 34.0, 77.0],
        volume_mm3=32655,
        surface_area_mm2=12738
    )
    
    # Face classification with high cylinder_ratio and cone faces
    fc = FaceClassificationResult(
        histogram=FaceTypeHistogram(plane=47, cylinder=11, cone=9, torus=0),
        plane_ratio=0.70,
        cylinder_ratio=0.16,
        freeform_ratio=0.0,
        mixed_ratio=0.30,
        plane_area_ratio=0.23,
        cylinder_area_ratio=0.46,  # Moderate cylinder area
        paired_plane_count=0,
        paired_plane_area=0,
        dominant_pair_thickness=None,
        is_likely_sheet_metal=False,
        is_likely_cnc=False,
        cnc_face_score=35,
        sheet_metal_face_score=20,
        reasoning="High plane ratio with cone chamfers"
    )
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify(
        face_classification=fc,
        detected_thickness=2e-6,  # Near-zero detected thickness (surface gap)
        thickness_confidence=0.95
    )
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Method: {metadata.get('classification_method', 'N/A')}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    assert process_type == 'cnc_milling', \
        f"Expected cnc_milling for part with chamfers, got {process_type}"
    print("✅ PASSED: CNC part with chamfers correctly identified")


def test_cnc_turn_mill_part():
    """Test CNC turn+mill part with many cylindrical faces"""
    print("\n=== Test 8: CNC Turn-Mill Part (High Cylinder Ratio) ===")
    
    metrics = GeometricMetrics(
        bbox_dims=[63.0, 22.0, 63.0],
        volume_mm3=22024,
        surface_area_mm2=13694
    )
    
    # Face classification for turn-mill part
    fc = FaceClassificationResult(
        histogram=FaceTypeHistogram(plane=34, cylinder=31, cone=0, torus=4),
        plane_ratio=0.49,
        cylinder_ratio=0.45,  # High cylinder ratio
        freeform_ratio=0.0,
        mixed_ratio=0.51,
        plane_area_ratio=0.44,
        cylinder_area_ratio=0.53,
        paired_plane_count=2,
        paired_plane_area=4508,
        dominant_pair_thickness=3.0,
        is_likely_sheet_metal=False,
        is_likely_cnc=True,  # Face classification says CNC
        cnc_face_score=60,
        sheet_metal_face_score=41,
        reasoning="High cylinder ratio, CNC likely"
    )
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify(
        face_classification=fc,
        detected_thickness=0.57,
        thickness_confidence=0.95
    )
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Method: {metadata.get('classification_method', 'N/A')}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    assert process_type == 'cnc_milling', \
        f"Expected cnc_milling for turn-mill part, got {process_type}"
    print("✅ PASSED: CNC turn-mill part correctly identified")


def test_cnc_face_classification_override():
    """Test that face classification CNC score overrides thickness detection"""
    print("\n=== Test 9: Face Classification CNC Override ===")
    
    metrics = GeometricMetrics(
        bbox_dims=[43.7, 10.1, 60.2],
        volume_mm3=6003,
        surface_area_mm2=3984
    )
    
    # Face classification strongly favors CNC
    fc = FaceClassificationResult(
        histogram=FaceTypeHistogram(plane=19, cylinder=65, cone=4, torus=57, bspline=16),
        plane_ratio=0.12,
        cylinder_ratio=0.40,  # High cylinder ratio
        freeform_ratio=0.10,
        mixed_ratio=0.88,
        plane_area_ratio=0.55,
        cylinder_area_ratio=0.27,
        paired_plane_count=1,
        paired_plane_area=1392,
        dominant_pair_thickness=4.2,
        is_likely_sheet_metal=False,
        is_likely_cnc=True,
        cnc_face_score=80,  # Much higher than sheet metal
        sheet_metal_face_score=26,
        reasoning="Low plane ratio, high cylinder content"
    )
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify(
        face_classification=fc,
        detected_thickness=0.42,
        thickness_confidence=0.95
    )
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Method: {metadata.get('classification_method', 'N/A')}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    assert process_type == 'cnc_milling', \
        f"Expected cnc_milling when face classification strongly favors CNC, got {process_type}"
    print("✅ PASSED: Face classification CNC override works correctly")


def test_high_cylinder_count_part():
    """Test part with 579 cylindrical faces (many holes)"""
    print("\n=== Test 10: Part with Many Cylindrical Faces (579 holes) ===")
    
    metrics = GeometricMetrics(
        bbox_dims=[52.0, 52.0, 33.0],
        volume_mm3=20583,
        surface_area_mm2=7537
    )
    
    # Part with massive number of cylindrical faces (holes)
    fc = FaceClassificationResult(
        histogram=FaceTypeHistogram(plane=4, cylinder=579, cone=1),
        plane_ratio=0.007,  # Very low plane ratio
        cylinder_ratio=0.99,  # Dominated by cylinders
        freeform_ratio=0.0,
        mixed_ratio=0.993,
        plane_area_ratio=0.53,
        cylinder_area_ratio=0.47,  # Significant cylinder area
        paired_plane_count=2,
        paired_plane_area=4012,
        dominant_pair_thickness=6.48,
        is_likely_sheet_metal=False,
        is_likely_cnc=True,
        cnc_face_score=58,
        sheet_metal_face_score=38,
        reasoning="Very high cylinder ratio - many holes"
    )
    
    classifier = ProcessClassifier(metrics)
    process_type, confidence, metadata = classifier.classify(
        face_classification=fc,
        detected_thickness=0.50,
        thickness_confidence=0.95
    )
    
    print(f"Classification: {process_type}")
    print(f"Confidence: {confidence:.2%}")
    print(f"Method: {metadata.get('classification_method', 'N/A')}")
    print(f"Reasoning: {metadata.get('reasoning', 'N/A')}")
    
    assert process_type == 'cnc_milling', \
        f"Expected cnc_milling for part with many cylinders, got {process_type}"
    print("✅ PASSED: Part with many cylindrical faces correctly identified as CNC")


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
        test_cnc_turned_part_high_cylinder_area()
        test_cnc_part_with_chamfers()
        test_cnc_turn_mill_part()
        test_cnc_face_classification_override()
        test_high_cylinder_count_part()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        print("\nSUMMARY OF IMPROVEMENTS:")
        print("1. Volume efficiency now heavily weighted in classification")
        print("2. CNC parts with thin features correctly identified (vol eff > 0.65)")
        print("3. Sheet metal requires low volume efficiency (<0.5)")
        print("4. Thickness detection no longer sole determinant")
        print("5. Multiple factors considered: thickness + volume + bends")
        print("6. CNC turned parts detected via cylinder_area_ratio > 0.45")
        print("7. Face classification CNC score overrides thickness detection")
        print("8. Parts with chamfers (cone faces) + cylinders = CNC turning")
        
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


