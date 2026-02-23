"""
Test cases for the DFM (Design for Manufacturability) Analyzer

This tests the end-to-end DFM analysis pipeline including:
1. Hole data transformation
2. Pocket data transformation  
3. CNC-specific checks
4. Sheet metal-specific checks
5. Score calculations
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.dfm_analyzer import (
    analyze_dfm,
    build_geometry_for_dfm,
    transform_holes_to_advanced_features,
    transform_pockets_to_advanced_features,
    AdvancedDFMAnalyzer,
    Severity
)
from app.models import HoleFeature, PocketFeature


def test_hole_transformation_basic():
    """Test that hole list transforms correctly to DFM format"""
    holes = [
        HoleFeature(
            id="H-001",
            type="through",
            diameter_mm=6.0,
            depth_mm=10.0,
            axis=(0, 0, 1),
            entry_face_id=1,
            exit_face_id=2,
            tri_indices=[]
        ),
        HoleFeature(
            id="H-002",
            type="blind",
            diameter_mm=3.0,
            depth_mm=35.0,  # Deep hole: 35/3 = 11.7x (> default 10x threshold)
            axis=(0, 0, 1),
            entry_face_id=3,
            exit_face_id=None,
            tri_indices=[]
        )
    ]
    
    result = transform_holes_to_advanced_features(holes)
    
    assert result["totalCount"] == 2
    assert result["deepHoleCount"] == 1, "H-002 should be deep (depth > 10x dia)"
    assert result["smallHoleCount"] == 0, "No holes below 1mm"
    assert abs(result["diameterRange"]["min"] - 3.0) < 0.01
    assert abs(result["diameterRange"]["max"] - 6.0) < 0.01
    print("✅ test_hole_transformation_basic passed")


def test_hole_transformation_small_holes():
    """Test detection of small holes below minimum tool size"""
    holes = [
        HoleFeature(
            id="H-001",
            type="through",
            diameter_mm=0.8,  # Below 1mm minimum
            depth_mm=2.0,
            axis=(0, 0, 1),
            entry_face_id=1,
            exit_face_id=2,
            tri_indices=[]
        ),
        HoleFeature(
            id="H-002",
            type="through",
            diameter_mm=0.4,  # Very small
            depth_mm=1.0,
            axis=(0, 0, 1),
            entry_face_id=3,
            exit_face_id=4,
            tri_indices=[]
        )
    ]
    
    result = transform_holes_to_advanced_features(holes)
    
    assert result["smallHoleCount"] == 2, "Both holes should be flagged as small"
    assert len(result["issues"]) >= 2, "Should have issues for small holes"
    print("✅ test_hole_transformation_small_holes passed")


def test_pocket_transformation():
    """Test pocket list transforms correctly to DFM format"""
    pockets = [
        PocketFeature(
            id="P-001",
            planar_face_ids=[1, 2],
            depth_mm=5.0,
            mouth_area_mm2=100.0,  # 10x10mm opening, depth/dim = 5/10 = 0.5
            aspect_ratio=2.0
        ),
        PocketFeature(
            id="P-002",
            planar_face_ids=[3, 4, 5],
            depth_mm=50.0,
            mouth_area_mm2=25.0,  # 5x5mm opening, depth/dim = 50/5 = 10
            aspect_ratio=8.0  # High aspect ratio
        )
    ]
    
    result = transform_pockets_to_advanced_features(pockets)
    
    assert result["totalCount"] == 2
    assert result["deepPocketCount"] == 1, "P-002 should be deep"
    assert result["highAspectRatioCount"] == 1, "P-002 has high aspect ratio"
    print("✅ test_pocket_transformation passed")


def test_build_geometry_for_dfm():
    """Test building complete geometry dict for DFM analysis"""
    holes = [
        HoleFeature(
            id="H-001",
            type="through",
            diameter_mm=6.0,
            depth_mm=10.0,
            axis=(0, 0, 1),
            entry_face_id=1,
            exit_face_id=2,
            tri_indices=[]
        )
    ]
    pockets = []
    
    geometry = build_geometry_for_dfm(
        bbox_dims=[100, 50, 25],
        volume_mm3=125000,
        surface_area_mm2=16500,
        holes=holes,
        pockets=pockets,
        process_type="cnc_milling",
        thickness=None,
        complexity="moderate"
    )
    
    assert "boundingBox" in geometry
    assert "advancedFeatures" in geometry
    assert geometry["advancedFeatures"]["holes"]["totalCount"] == 1
    assert geometry["complexity"] == "moderate"
    print("✅ test_build_geometry_for_dfm passed")


def test_dfm_cnc_milling_deep_holes():
    """Test DFM analysis detects deep holes for CNC milling"""
    holes = [
        HoleFeature(
            id="H-001",
            type="blind",
            diameter_mm=5.0,
            depth_mm=60.0,  # 12x depth/diameter ratio
            axis=(0, 0, 1),
            entry_face_id=1,
            exit_face_id=None,
            tri_indices=[]
        ),
        HoleFeature(
            id="H-002",
            type="blind",
            diameter_mm=4.0,
            depth_mm=50.0,  # 12.5x depth/diameter ratio
            axis=(0, 0, 1),
            entry_face_id=2,
            exit_face_id=None,
            tri_indices=[]
        )
    ]
    
    geometry = build_geometry_for_dfm(
        bbox_dims=[100, 80, 60],
        volume_mm3=480000,
        surface_area_mm2=33600,
        holes=holes,
        pockets=[],
        process_type="cnc_milling",
        complexity="moderate"
    )
    
    result = analyze_dfm(
        geometry=geometry,
        process_type="cnc_milling",
        material="aluminum"
    )
    
    assert result["overall_score"] < 100, "Score should be reduced for deep holes"
    
    # Find deep hole issues
    deep_hole_issues = [i for i in result["issues"] if "deep hole" in i["title"].lower()]
    assert len(deep_hole_issues) > 0, "Should flag deep holes"
    
    print(f"✅ test_dfm_cnc_milling_deep_holes passed (score: {result['overall_score']:.0f})")


def test_dfm_cnc_milling_small_holes():
    """Test DFM analysis detects small holes for CNC milling"""
    holes = [
        HoleFeature(
            id="H-001",
            type="through",
            diameter_mm=0.5,  # Very small
            depth_mm=3.0,
            axis=(0, 0, 1),
            entry_face_id=1,
            exit_face_id=2,
            tri_indices=[]
        )
    ]
    
    geometry = build_geometry_for_dfm(
        bbox_dims=[50, 40, 30],
        volume_mm3=60000,
        surface_area_mm2=9400,
        holes=holes,
        pockets=[],
        process_type="cnc_milling",
        complexity="simple"
    )
    
    result = analyze_dfm(
        geometry=geometry,
        process_type="cnc_milling",
        material="aluminum"
    )
    
    # Find small hole issues
    small_hole_issues = [i for i in result["issues"] if "small" in i["title"].lower() or "diameter" in i["description"].lower()]
    assert len(small_hole_issues) > 0, "Should flag small holes"
    
    print(f"✅ test_dfm_cnc_milling_small_holes passed (score: {result['overall_score']:.0f})")


def test_dfm_sheet_metal_bends():
    """Test DFM analysis for sheet metal with bends"""
    geometry = build_geometry_for_dfm(
        bbox_dims=[200, 150, 2],
        volume_mm3=60000,
        surface_area_mm2=60400,
        holes=[],
        pockets=[],
        process_type="sheet_metal",
        thickness=2.0,
        bend_analysis={
            "bend_count": 12,
            "bends": [{"radius": 0.5} for _ in range(12)]  # Tight radii
        },
        complexity="complex"
    )
    
    result = analyze_dfm(
        geometry=geometry,
        process_type="sheet_metal",
        material="aluminum"
    )
    
    # Should flag high bend count
    bend_issues = [i for i in result["issues"] if "bend" in i["title"].lower()]
    assert len(bend_issues) > 0, "Should flag high bend count or tight radii"
    
    print(f"✅ test_dfm_sheet_metal_bends passed (score: {result['overall_score']:.0f})")


def test_dfm_excellent_part():
    """Test DFM analysis for a well-designed manufacturable part"""
    holes = [
        HoleFeature(
            id="H-001",
            type="through",
            diameter_mm=8.0,
            depth_mm=10.0,  # 1.25x ratio - not deep
            axis=(0, 0, 1),
            entry_face_id=1,
            exit_face_id=2,
            tri_indices=[]
        ),
        HoleFeature(
            id="H-002",
            type="through",
            diameter_mm=6.0,
            depth_mm=10.0,  # 1.67x ratio - not deep
            axis=(0, 0, 1),
            entry_face_id=3,
            exit_face_id=4,
            tri_indices=[]
        )
    ]
    
    geometry = build_geometry_for_dfm(
        bbox_dims=[80, 60, 15],
        volume_mm3=72000,
        surface_area_mm2=12600,
        holes=holes,
        pockets=[],
        process_type="cnc_milling",
        complexity="simple"
    )
    
    result = analyze_dfm(
        geometry=geometry,
        process_type="cnc_milling",
        material="aluminum"
    )
    
    assert result["overall_score"] >= 80, f"Well-designed part should score 80+, got {result['overall_score']}"
    assert result["is_manufacturable"] == True
    
    print(f"✅ test_dfm_excellent_part passed (score: {result['overall_score']:.0f}, rating: {result['rating']})")


def test_dfm_no_features():
    """Test DFM analysis for simple block with no features"""
    geometry = build_geometry_for_dfm(
        bbox_dims=[100, 50, 25],
        volume_mm3=125000,
        surface_area_mm2=16500,
        holes=[],
        pockets=[],
        process_type="cnc_milling",
        complexity="simple"
    )
    
    result = analyze_dfm(
        geometry=geometry,
        process_type="cnc_milling",
        material="aluminum"
    )
    
    assert result["overall_score"] >= 90, "Simple block should have excellent score"
    assert result["rating"] in ["excellent", "good"]
    
    print(f"✅ test_dfm_no_features passed (score: {result['overall_score']:.0f})")


def test_hole_transformation_empty():
    """Test hole transformation with empty list"""
    result = transform_holes_to_advanced_features([])
    
    assert result["totalCount"] == 0
    assert result["deepHoleCount"] == 0
    assert result["smallHoleCount"] == 0
    assert result["diameterRange"] is None
    assert result["holeDetails"] == []
    assert result["issues"] == []
    print("✅ test_hole_transformation_empty passed")


def test_hole_transformation_zero_diameter():
    """Test hole transformation handles zero diameter without division error"""
    holes = [
        HoleFeature(
            id="H-001",
            type="through",
            diameter_mm=0.0,
            depth_mm=5.0,
            axis=(0, 0, 1),
            entry_face_id=1,
            exit_face_id=2,
            tri_indices=[]
        )
    ]
    
    result = transform_holes_to_advanced_features(holes)
    assert result["totalCount"] == 1
    # Should not crash on division by zero
    assert result["holeDetails"][0]["depth_ratio"] == 0
    print("✅ test_hole_transformation_zero_diameter passed")


def test_hole_transformation_with_process_config():
    """Test hole transformation respects process_config thresholds"""
    holes = [
        HoleFeature(
            id="H-001",
            type="blind",
            diameter_mm=3.0,
            depth_mm=18.0,  # ratio=6, deep if max_depth_ratio<6
            axis=(0, 0, 1),
            entry_face_id=1,
            exit_face_id=None,
            tri_indices=[]
        )
    ]
    
    # With default config (ratio 10) — not deep
    result_default = transform_holes_to_advanced_features(holes)
    assert result_default["deepHoleCount"] == 0
    
    # With strict config (ratio 5) — should be deep
    strict_config = {"max_hole_depth_ratio": 5.0, "min_tool_diameter_mm": 1.0}
    result_strict = transform_holes_to_advanced_features(holes, process_config=strict_config)
    assert result_strict["deepHoleCount"] == 1
    print("✅ test_hole_transformation_with_process_config passed")


def test_dfm_cnc_turning():
    """Test DFM analysis for CNC turning process"""
    geometry = build_geometry_for_dfm(
        bbox_dims=[30, 30, 120],
        volume_mm3=84823,  # ~cylindrical
        surface_area_mm2=12723,
        holes=[
            HoleFeature(
                id="H-001",
                type="through",
                diameter_mm=10.0,
                depth_mm=120.0,  # Center bore, ratio=12
                axis=(0, 0, 1),
                entry_face_id=1,
                exit_face_id=2,
                tri_indices=[]
            )
        ],
        pockets=[],
        process_type="cnc_turning",
        complexity="moderate"
    )
    
    result = analyze_dfm(
        geometry=geometry,
        process_type="cnc_turning",
        material="steel"
    )
    
    assert "overall_score" in result
    assert "issues" in result
    assert result["is_manufacturable"] is not None
    print(f"✅ test_dfm_cnc_turning passed (score: {result['overall_score']:.0f})")


def test_dfm_steel_vs_aluminum_thresholds():
    """Test that material-specific thresholds are applied"""
    holes = [
        HoleFeature(
            id="H-001",
            type="blind",
            diameter_mm=5.0,
            depth_mm=55.0,  # 11x ratio, deep for most configs
            axis=(0, 0, 1),
            entry_face_id=1,
            exit_face_id=None,
            tri_indices=[]
        )
    ]
    geometry = build_geometry_for_dfm(
        bbox_dims=[100, 80, 60],
        volume_mm3=480000,
        surface_area_mm2=33600,
        holes=holes,
        pockets=[],
        process_type="cnc_milling",
        complexity="moderate"
    )
    
    result_aluminum = analyze_dfm(geometry=geometry, process_type="cnc_milling", material="aluminum")
    result_steel = analyze_dfm(geometry=geometry, process_type="cnc_milling", material="steel")
    
    assert "overall_score" in result_aluminum
    assert "overall_score" in result_steel
    # Both should detect the deep hole
    deep_al = [i for i in result_aluminum["issues"] if "deep" in i.get("title", "").lower() or "deep" in i.get("description", "").lower()]
    deep_st = [i for i in result_steel["issues"] if "deep" in i.get("title", "").lower() or "deep" in i.get("description", "").lower()]
    assert len(deep_al) > 0, "Aluminum should flag deep hole"
    assert len(deep_st) > 0, "Steel should flag deep hole"
    print(f"✅ test_dfm_steel_vs_aluminum_thresholds passed (Al: {result_aluminum['overall_score']:.0f}, St: {result_steel['overall_score']:.0f})")


def test_dfm_very_thin_wall():
    """Test DFM analysis flags extremely thin walls"""
    geometry = build_geometry_for_dfm(
        bbox_dims=[200, 150, 0.3],  # Very thin
        volume_mm3=9000,
        surface_area_mm2=60210,
        holes=[],
        pockets=[],
        process_type="sheet_metal",
        thickness=0.3,
        complexity="simple"
    )
    
    result = analyze_dfm(
        geometry=geometry,
        process_type="sheet_metal",
        material="aluminum"
    )
    
    _thin_issues = [i for i in result["issues"] if "thin" in i.get("title", "").lower() or "wall" in i.get("description", "").lower()]
    # Should flag thin wall
    print(f"✅ test_dfm_very_thin_wall passed (score: {result['overall_score']:.0f}, issues: {len(result['issues'])})")


def test_pocket_transformation_empty():
    """Test pocket transformation with empty list"""
    result = transform_pockets_to_advanced_features([])
    
    assert result["totalCount"] == 0
    assert result["deepPocketCount"] == 0
    assert result["highAspectRatioCount"] == 0
    assert result["pocketDetails"] == []
    print("✅ test_pocket_transformation_empty passed")


def main():
    """Run all tests"""
    print("=" * 60)
    print("DFM ANALYZER TEST SUITE")
    print("=" * 60)
    
    tests = [
        test_hole_transformation_basic,
        test_hole_transformation_small_holes,
        test_hole_transformation_empty,
        test_hole_transformation_zero_diameter,
        test_hole_transformation_with_process_config,
        test_pocket_transformation,
        test_pocket_transformation_empty,
        test_build_geometry_for_dfm,
        test_dfm_cnc_milling_deep_holes,
        test_dfm_cnc_milling_small_holes,
        test_dfm_cnc_turning,
        test_dfm_sheet_metal_bends,
        test_dfm_excellent_part,
        test_dfm_no_features,
        test_dfm_steel_vs_aluminum_thresholds,
        test_dfm_very_thin_wall,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"❌ {test.__name__} FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ {test.__name__} ERROR: {e}")
            failed += 1
    
    print("=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
