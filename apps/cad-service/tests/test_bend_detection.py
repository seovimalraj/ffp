"""
Unit tests for advanced bend detection system.
Tests all 7 detection methods with realistic scenarios.
"""
import pytest
from app.core.geometry import GeometricMetrics
from app.core.bend_detection import AdvancedBendDetector, BendAnalysis
from app.core.classification import ProcessClassifier


class TestBendDetection:
    """Test suite for bend detection algorithms."""
    
    def test_u_bracket_detection(self):
        """Test detection of U-bracket (2mm wall, bent into U shape)."""
        # U-bracket: 165mm x 40mm x 20mm envelope, 2mm wall thickness
        bbox_dims = [20.0, 40.0, 165.0]  # min, mid, max
        volume_mm3 = 12500.0  # Hollow structure
        surface_area_mm2 = 25000.0
        
        detector = AdvancedBendDetector(bbox_dims, volume_mm3, surface_area_mm2)
        analysis = detector.analyze_bends(
            detected_thickness=2.18,  # Ray-cast result
            thickness_confidence=0.95,
            triangle_count=5000
        )
        
        # Assertions
        assert analysis.is_likely_bent == True, "Should detect U-bracket as bent"
        assert analysis.bend_count >= 2, "U-bracket has at least 2 bends"
        assert analysis.confidence >= 0.85, "Should have high confidence"
        assert analysis.has_flanges == True, "U-brackets typically have flanges"
        assert len(analysis.bend_regions) > 0, "Should detect bend regions"
        
    def test_l_bracket_detection(self):
        """Test detection of L-bracket (3mm wall, 90° bend)."""
        # L-bracket: 100mm x 30mm x 3mm
        bbox_dims = [3.0, 30.0, 100.0]
        volume_mm3 = 8000.0
        surface_area_mm2 = 15000.0
        
        detector = AdvancedBendDetector(bbox_dims, volume_mm3, surface_area_mm2)
        analysis = detector.analyze_bends(
            detected_thickness=3.05,
            thickness_confidence=0.90,
            triangle_count=3000
        )
        
        assert analysis.is_likely_bent == True
        assert analysis.bend_count >= 1
        assert analysis.confidence >= 0.70
        
    def test_flat_sheet_no_bends(self):
        """Test that flat sheet metal is not detected as bent."""
        # Flat bracket: 200mm x 100mm x 3mm
        bbox_dims = [3.0, 100.0, 200.0]
        volume_mm3 = 58000.0  # Nearly solid (3mm thick plate)
        surface_area_mm2 = 40600.0
        
        detector = AdvancedBendDetector(bbox_dims, volume_mm3, surface_area_mm2)
        analysis = detector.analyze_bends(
            detected_thickness=3.15,
            thickness_confidence=0.95,
            triangle_count=2000
        )
        
        # Should NOT detect as bent (thickness ≈ bbox)
        assert analysis.is_likely_bent == False
        assert analysis.bend_count == 0
        
    def test_cnc_block_not_bent(self):
        """Test that CNC machined block is not detected as bent."""
        # CNC block: 50mm x 50mm x 50mm
        bbox_dims = [50.0, 50.0, 50.0]
        volume_mm3 = 110000.0  # Solid block with some pockets
        surface_area_mm2 = 16000.0
        
        detector = AdvancedBendDetector(bbox_dims, volume_mm3, surface_area_mm2)
        analysis = detector.analyze_bends(
            detected_thickness=None,  # No uniform thickness
            thickness_confidence=0.3,
            triangle_count=8000
        )
        
        assert analysis.is_likely_bent == False
        assert analysis.confidence < 0.6
        
    def test_enclosure_complex_bends(self):
        """Test detection of enclosure with multiple bends."""
        # Enclosure: 300mm x 200mm x 100mm, 2mm wall
        bbox_dims = [100.0, 200.0, 300.0]
        volume_mm3 = 45000.0  # Very hollow
        surface_area_mm2 = 180000.0
        
        detector = AdvancedBendDetector(bbox_dims, volume_mm3, surface_area_mm2)
        analysis = detector.analyze_bends(
            detected_thickness=2.5,
            thickness_confidence=0.92,
            triangle_count=12000
        )
        
        assert analysis.is_likely_bent == True
        assert analysis.bend_count >= 3, "Enclosure has multiple bends"
        assert analysis.complexity_score > 50
        assert analysis.has_flanges == True
        

class TestGeometricMetrics:
    """Test geometric metrics calculations."""
    
    def test_sheet_metal_metrics(self):
        """Test metrics for typical sheet metal part."""
        metrics = GeometricMetrics(
            bbox_dims=[2.0, 100.0, 200.0],
            volume_mm3=35000.0,
            surface_area_mm2=42000.0
        )
        
        assert metrics.min_dim == 2.0
        assert metrics.aspect_ratio > 50  # Very thin and long
        assert metrics.volume_efficiency < 0.9
        assert metrics.surface_to_volume_ratio > 50
        
    def test_cnc_block_metrics(self):
        """Test metrics for CNC machined block."""
        metrics = GeometricMetrics(
            bbox_dims=[50.0, 50.0, 50.0],
            volume_mm3=100000.0,
            surface_area_mm2=18000.0
        )
        
        assert metrics.aspect_ratio < 2  # Cube-like
        assert metrics.volume_efficiency > 0.7  # Mostly solid
        assert metrics.surface_to_volume_ratio < 30


class TestProcessClassification:
    """Test manufacturing process classification."""
    
    def test_bent_sheet_metal_classification(self):
        """Test classification of bent sheet metal."""
        metrics = GeometricMetrics(
            bbox_dims=[20.0, 40.0, 165.0],
            volume_mm3=12500.0,
            surface_area_mm2=25000.0
        )
        
        classifier = ProcessClassifier(metrics)
        process, confidence, metadata = classifier.classify(
            detected_thickness=2.18,
            thickness_confidence=0.95,
            triangle_count=5000
        )
        
        assert process == 'sheet_metal'
        assert confidence >= 0.85
        assert metadata['bend_analysis']['is_likely_bent'] == True
        
    def test_flat_sheet_metal_classification(self):
        """Test classification of flat sheet metal."""
        metrics = GeometricMetrics(
            bbox_dims=[3.0, 100.0, 200.0],
            volume_mm3=55000.0,
            surface_area_mm2=40600.0
        )
        
        classifier = ProcessClassifier(metrics)
        process, confidence, metadata = classifier.classify(
            detected_thickness=3.15,
            thickness_confidence=0.95,
            triangle_count=2000
        )
        
        assert process == 'sheet_metal'
        assert confidence >= 0.80
        assert metadata['bend_analysis']['is_likely_bent'] == False
        
    def test_cnc_milling_classification(self):
        """Test classification of CNC milled part."""
        metrics = GeometricMetrics(
            bbox_dims=[50.0, 50.0, 50.0],
            volume_mm3=100000.0,
            surface_area_mm2=18000.0
        )
        
        classifier = ProcessClassifier(metrics)
        process, confidence, metadata = classifier.classify(
            detected_thickness=None,
            thickness_confidence=0.3,
            triangle_count=8000
        )
        
        assert process == 'cnc_milling'
        assert confidence >= 0.70
        
    def test_cnc_turning_classification(self):
        """Test classification of CNC turned part."""
        # Cylindrical part: 25mm diameter x 100mm length
        metrics = GeometricMetrics(
            bbox_dims=[25.0, 25.0, 100.0],
            volume_mm3=45000.0,
            surface_area_mm2=9000.0
        )
        
        classifier = ProcessClassifier(metrics)
        process, confidence, metadata = classifier.classify(
            detected_thickness=None,
            thickness_confidence=0.0,
            triangle_count=4000
        )
        
        assert process == 'cnc_turning'
        assert confidence >= 0.80


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_very_thin_sheet(self):
        """Test 0.5mm sheet metal (lower bound)."""
        metrics = GeometricMetrics(
            bbox_dims=[0.5, 100.0, 150.0],
            volume_mm3=6800.0,
            surface_area_mm2=30200.0
        )
        
        classifier = ProcessClassifier(metrics)
        process, confidence, _ = classifier.classify(
            detected_thickness=0.55,
            thickness_confidence=0.90
        )
        
        assert process == 'sheet_metal'
        
    def test_thick_sheet(self):
        """Test 6mm sheet metal (upper bound)."""
        metrics = GeometricMetrics(
            bbox_dims=[6.0, 80.0, 120.0],
            volume_mm3=52000.0,
            surface_area_mm2=22000.0
        )
        
        classifier = ProcessClassifier(metrics)
        process, confidence, _ = classifier.classify(
            detected_thickness=6.2,
            thickness_confidence=0.85
        )
        
        assert process == 'sheet_metal'
        
    def test_zero_volume(self):
        """Test handling of invalid zero volume."""
        metrics = GeometricMetrics(
            bbox_dims=[10.0, 20.0, 30.0],
            volume_mm3=0.001,  # Near-zero
            surface_area_mm2=1000.0
        )
        
        # Should not crash
        classifier = ProcessClassifier(metrics)
        process, confidence, _ = classifier.classify()
        
        assert process in ['sheet_metal', 'cnc_milling', 'cnc_turning']
        assert confidence > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
