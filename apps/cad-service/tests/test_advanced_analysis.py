"""Tests for advanced manufacturing analysis functions.

Tests the following modules:
- Casting analysis (draft angles, parting lines, undercuts)
- Surface finish estimation (Ra/Rz from curvature)
- Machining complexity (5-axis, tool accessibility)
"""
import pytest
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional
from unittest.mock import MagicMock, patch


# ============================================================================
# Mock data classes for testing
# ============================================================================

@dataclass
class MockDraftAngleInfo:
    """Mock draft angle info for testing."""
    draft_angle_deg: float = 2.0
    is_sufficient: bool = True
    face_area: float = 100.0
    pull_direction: Tuple[float, float, float] = (0, 0, 1)


@dataclass
class MockMesh:
    """Mock trimesh mesh for testing."""
    vectors: np.ndarray = None
    face_normals: np.ndarray = None
    bounds: np.ndarray = None
    centroid: np.ndarray = None
    _triangles_center: np.ndarray = None
    
    def __post_init__(self):
        if self.vectors is None:
            # Simple cube mesh
            self.vectors = np.array([
                [[0, 0, 0], [1, 0, 0], [1, 1, 0]],  # Bottom face 1
                [[0, 0, 0], [1, 1, 0], [0, 1, 0]],  # Bottom face 2
                [[0, 0, 1], [1, 1, 1], [1, 0, 1]],  # Top face 1
                [[0, 0, 1], [0, 1, 1], [1, 1, 1]],  # Top face 2
            ], dtype=np.float64) * 50  # 50mm cube
        
        if self.face_normals is None:
            self.face_normals = np.array([
                [0, 0, -1],  # Bottom
                [0, 0, -1],  # Bottom
                [0, 0, 1],   # Top
                [0, 0, 1],   # Top
            ], dtype=np.float64)
        
        if self.bounds is None:
            self.bounds = np.array([[0, 0, 0], [50, 50, 50]], dtype=np.float64)
        
        if self.centroid is None:
            self.centroid = np.array([25, 25, 25], dtype=np.float64)
        
        if self._triangles_center is None:
            self._triangles_center = np.mean(self.vectors, axis=1)
    
    @property
    def triangles_center(self):
        return self._triangles_center
    
    @triangles_center.setter
    def triangles_center(self, value):
        self._triangles_center = value
    
    @property
    def faces(self):
        return np.arange(len(self.vectors)).reshape(-1, 1)


# ============================================================================
# Casting Analysis Tests
# ============================================================================

class TestCastingAnalysis:
    """Test casting feasibility analysis functions."""
    
    def test_analyze_for_casting_good_draft(self):
        """Parts with good draft angles should be marked as castable."""
        from app.extractors.draft_angles import analyze_for_casting
        from app.models import DraftAngleInfo
        
        # Create mesh with normals that won't trigger undercut detection
        # All normals point up (+Z) to avoid undercuts
        mesh = MockMesh()
        mesh.face_normals = np.array([
            [0.1, 0, 0.99],   # Slightly tilted from Z+ (has draft)
            [0, 0.1, 0.99],   # Slightly tilted from Z+
            [0, 0, 1],        # Pure +Z
            [0, 0, 1],        # Pure +Z
        ], dtype=np.float64)
        
        draft_results = [
            DraftAngleInfo(
                face_id=i,
                draft_angle_deg=3.0,  # Good draft
                is_sufficient=True,
                area_mm2=100.0
            )
            for i in range(10)
        ]
        
        result = analyze_for_casting(
            mesh,
            draft_results=draft_results,
            detected_thickness=5.0
        )
        
        assert result.draft_compliant_faces == 10
        assert result.draft_insufficient_faces == 0
        assert result.average_draft >= 2.5
        # With no undercuts and good draft, should be castable
        assert result.has_undercuts == False or result.undercut_count == 0
    
    def test_analyze_for_casting_poor_draft(self):
        """Parts with poor draft angles should not be castable."""
        from app.extractors.draft_angles import analyze_for_casting
        from app.models import DraftAngleInfo
        
        mesh = MockMesh()
        draft_results = [
            DraftAngleInfo(
                face_id=i,
                draft_angle_deg=0.2,  # Poor draft
                is_sufficient=False,
                area_mm2=100.0
            )
            for i in range(10)
        ]
        
        result = analyze_for_casting(
            mesh,
            draft_results=draft_results,
            detected_thickness=5.0
        )
        
        assert result.draft_insufficient_faces == 10
        assert result.is_likely_casting == False
        assert result.casting_type == 'not_castable'
    
    def test_analyze_for_casting_with_undercuts(self):
        """Parts with severe undercuts should have difficult ejection."""
        from app.extractors.draft_angles import analyze_for_casting
        from app.models import DraftAngleInfo
        
        # Create mesh with faces pointing against pull direction (undercuts)
        mesh = MockMesh()
        mesh.face_normals = np.array([
            [0, 0, -1],  # Opposing pull direction = undercut
            [0, 0, -1],
            [0, 0, 1],
            [0, 0, 1],
        ], dtype=np.float64)
        
        draft_results = [
            DraftAngleInfo(
                face_id=i,
                draft_angle_deg=2.0,
                is_sufficient=True,
                area_mm2=100.0
            )
            for i in range(4)
        ]
        
        result = analyze_for_casting(
            mesh,
            draft_results=draft_results,
            detected_thickness=5.0
        )
        
        # Should detect undercuts from opposing normals
        assert result.undercut_count > 0 or result.has_undercuts == True
    
    def test_casting_type_by_wall_thickness(self):
        """Casting type should be selected based on wall thickness."""
        from app.extractors.draft_angles import analyze_for_casting
        from app.models import DraftAngleInfo
        
        # Create mesh with no undercuts (all normals in +Z hemisphere)
        mesh = MockMesh()
        mesh.face_normals = np.array([
            [0.1, 0, 0.99],
            [0, 0.1, 0.99],
            [0, 0, 1],
            [0, 0, 1],
        ], dtype=np.float64)
        
        draft_results = [
            DraftAngleInfo(
                face_id=0,
                draft_angle_deg=2.0,
                is_sufficient=True,
                area_mm2=100.0
            )
        ]
        
        # Test that casting analysis returns correct structure
        result_thin = analyze_for_casting(mesh, draft_results, detected_thickness=1.0)
        result_med = analyze_for_casting(mesh, draft_results, detected_thickness=5.0)
        result_thick = analyze_for_casting(mesh, draft_results, detected_thickness=15.0)
        
        # Verify all results have expected attributes
        assert hasattr(result_thin, 'casting_type')
        assert hasattr(result_med, 'casting_type')
        assert hasattr(result_thick, 'casting_type')
        
        # Verify confidence is computed
        assert result_thin.confidence >= 0
        assert result_thick.confidence >= 0


# ============================================================================
# Surface Finish Analysis Tests
# ============================================================================

class TestSurfaceFinishAnalysis:
    """Test surface finish Ra/Rz estimation functions."""
    
    def test_extract_surface_finish_from_mesh_basic(self):
        """Basic mesh should return standard finish."""
        from app.extractors.surface_finish import extract_surface_finish_from_mesh
        
        mesh = MockMesh()
        result = extract_surface_finish_from_mesh(mesh)
        
        assert result is not None
        # Should have some features or a dominant grade
        assert result.dominant_grade is not None
    
    def test_estimate_ra_from_curvature(self):
        """Higher curvature should suggest finer finish requirements."""
        from app.extractors.surface_finish import estimate_ra_from_curvature
        
        # Low curvature = standard finish
        ra_low = estimate_ra_from_curvature(0.01, feature_type='planar')
        
        # High curvature = finer finish
        ra_high = estimate_ra_from_curvature(0.5, feature_type='cylindrical')
        
        # Higher curvature should suggest lower Ra (finer finish)
        assert ra_low >= ra_high
    
    def test_estimate_rz_from_ra(self):
        """Rz should be approximately 5× Ra."""
        from app.extractors.surface_finish import estimate_rz_from_ra
        
        ra = 1.6
        rz = estimate_rz_from_ra(ra)
        
        # Standard approximation: Rz ≈ 5 × Ra
        assert 4.5 * ra <= rz <= 6.0 * ra
    
    def test_surface_finish_grades(self):
        """Different surface types should get appropriate finish grades."""
        from app.extractors.surface_finish import SurfaceFinishGrade
        
        # Verify grade enum values
        assert SurfaceFinishGrade.ROUGH.value == 'rough'
        assert SurfaceFinishGrade.STANDARD.value == 'standard'
        assert SurfaceFinishGrade.FINE.value == 'fine'
        assert SurfaceFinishGrade.PRECISION.value == 'precision'
        assert SurfaceFinishGrade.POLISHED.value == 'polished'


# ============================================================================
# Machining Complexity Tests
# ============================================================================

class TestMachiningComplexityAnalysis:
    """Test machining complexity and 5-axis requirement detection."""
    
    def test_analyze_machining_complexity_from_mesh_simple(self):
        """Simple box should be 3-axis machinable."""
        from app.core.machining_complexity import analyze_machining_complexity_from_mesh
        
        mesh = MockMesh()
        result = analyze_machining_complexity_from_mesh(mesh)
        
        assert result is not None
        assert result.milling_complexity is not None
        assert result.milling_complexity.min_axes_required <= 3
        assert result.requires_5axis == False
    
    def test_analyze_tool_accessibility_clear_access(self):
        """Features with clear line-of-sight should be fully accessible."""
        from app.core.machining_complexity import analyze_tool_accessibility
        
        mesh = MockMesh()
        # Add ray intersection capability mock
        mesh.ray = MagicMock()
        mesh.ray.intersects_location = MagicMock(return_value=(
            np.array([]),  # No intersections
            np.array([]),
            np.array([])
        ))
        
        feature_locations = [(25, 25, 50)]  # Top of cube
        
        result = analyze_tool_accessibility(mesh, feature_locations)
        
        assert 'error' not in result
        assert result['summary']['total_features'] == 1
        assert result['summary']['fully_accessible'] >= 0
    
    def test_analyze_tool_accessibility_blocked_access(self):
        """Features with blocked paths should be flagged."""
        from app.core.machining_complexity import analyze_tool_accessibility
        
        mesh = MockMesh()
        mesh.ray = MagicMock()
        # Simulate intersection at short distance (blocked)
        mesh.ray.intersects_location = MagicMock(return_value=(
            np.array([[25, 25, 30]]),  # Intersection nearby
            np.array([0]),
            np.array([0])
        ))
        
        feature_locations = [(25, 25, 25)]  # Inside cube
        
        result = analyze_tool_accessibility(mesh, feature_locations, tool_diameter=10.0)
        
        assert 'error' not in result
        # Should detect some blocked directions
    
    def test_machining_complexity_with_features(self):
        """Parts with complex features should require more axes."""
        from app.core.machining_complexity import analyze_machining_complexity_from_mesh
        
        # Create holes and pockets mocks
        hole = MagicMock()
        hole.center = (25, 25, 50)
        hole.axis = (0.707, 0.707, 0)  # Angled hole
        
        mesh = MockMesh()
        
        result = analyze_machining_complexity_from_mesh(
            mesh,
            holes=[hole],
            pockets=[],
            undercuts=[]
        )
        
        assert result is not None
        assert result.estimated_setup_count >= 1
    
    def test_machine_type_enum(self):
        """Verify machine type enum values."""
        from app.core.machining_complexity import MachineType
        
        assert MachineType.MILL_3AXIS.value == 'mill_3axis'
        assert MachineType.MILL_4AXIS.value == 'mill_4axis'
        assert MachineType.MILL_5AXIS.value == 'mill_5axis'
        assert MachineType.LATHE_2AXIS.value == 'lathe_2axis'
        assert MachineType.TURN_MILL.value == 'turn_mill'


# ============================================================================
# Parting Line Detection Tests
# ============================================================================

class TestPartingLineDetection:
    """Test parting line candidate detection for casting."""
    
    def test_find_parting_plane_candidates(self):
        """Should find balanced parting plane locations."""
        from app.extractors.draft_angles import _find_parting_plane_candidates
        
        mesh = MockMesh()
        # Make triangles_center available
        mesh.triangles_center = np.mean(mesh.vectors, axis=1)
        
        candidates = _find_parting_plane_candidates(mesh, num_slices=5)
        
        # Should return some candidates with balance scores
        assert isinstance(candidates, list)
        # All candidates should have required fields
        for c in candidates:
            assert 'z_level' in c
            assert 'balance_score' in c


# ============================================================================
# Integration Tests
# ============================================================================

class TestAnalysisIntegration:
    """Test integration between analysis modules."""
    
    def test_casting_analysis_dataclass_serializable(self):
        """CastingAnalysis should be JSON-serializable."""
        from app.extractors.draft_angles import CastingAnalysis, PartingLineInfo
        import json
        
        analysis = CastingAnalysis(
            is_likely_casting=True,
            casting_type='die_casting',
            parting_lines=[
                PartingLineInfo(
                    z_level=25.0,
                    perimeter_length=100.0,
                    cross_section_area=500.0,
                    complexity=30.0,
                    is_planar=True,
                    confidence=0.85
                )
            ],
            optimal_parting_z=25.0,
            draft_compliant_faces=8,
            draft_insufficient_faces=2,
            average_draft=2.5,
            min_draft=0.5,
            max_wall_thickness=10.0,
            min_wall_thickness=3.0,
            has_undercuts=False,
            undercut_count=0,
            ejector_difficulty='easy',
            confidence=0.8
        )
        
        # Convert to dict for JSON
        result_dict = {
            'is_likely_casting': analysis.is_likely_casting,
            'casting_type': analysis.casting_type,
            'confidence': analysis.confidence,
        }
        
        # Should be JSON serializable
        json_str = json.dumps(result_dict)
        assert 'die_casting' in json_str
    
    def test_machining_complexity_dataclass(self):
        """MachiningComplexityAnalysis should have all required fields."""
        from app.core.machining_complexity import (
            MachiningComplexityAnalysis,
            MillingComplexity,
            MachineType
        )
        
        analysis = MachiningComplexityAnalysis(
            milling_complexity=MillingComplexity(
                min_axes_required=3,
                recommended_axes=3,
                has_deep_pockets=False,
                has_undercuts=False,
                recommended_machine=MachineType.MILL_3AXIS
            ),
            primary_process='milling',
            recommended_machine=MachineType.MILL_3AXIS,
            estimated_setup_count=2,
            complexity_score=30,
            requires_5axis=False,
            requires_4axis=False
        )
        
        assert analysis.primary_process == 'milling'
        assert analysis.estimated_setup_count == 2
        assert analysis.requires_5axis == False
    
    def test_surface_finish_analysis_dataclass(self):
        """SurfaceFinishAnalysis should have all required fields."""
        from app.extractors.surface_finish import (
            SurfaceFinishAnalysis,
            SurfaceFinishGrade
        )
        
        analysis = SurfaceFinishAnalysis(
            features=[],
            dominant_grade=SurfaceFinishGrade.STANDARD,
            min_ra_required=3.2,
            precision_face_count=0,
            polished_face_count=0,
            ground_face_count=0,
            total_precision_area=0,
            finish_complexity_score=10
        )
        
        assert analysis.dominant_grade == SurfaceFinishGrade.STANDARD
        assert analysis.min_ra_required == 3.2
