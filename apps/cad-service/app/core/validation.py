"""
Advanced Geometry Validation and Analysis
Provides comprehensive validation of geometric data with error checking
"""
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class ValidationSeverity(Enum):
    """Validation issue severity"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ValidationIssue:
    """Single validation issue"""
    severity: ValidationSeverity
    field: str
    message: str
    value: Optional[any] = None
    expected: Optional[any] = None


@dataclass
class ValidationResult:
    """Result of geometry validation"""
    is_valid: bool
    issues: List[ValidationIssue]
    
    def add_issue(self, issue: ValidationIssue):
        """Add validation issue"""
        self.issues.append(issue)
        if issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]:
            self.is_valid = False
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            "is_valid": self.is_valid,
            "issues": [
                {
                    "severity": issue.severity.value,
                    "field": issue.field,
                    "message": issue.message,
                    "value": issue.value,
                    "expected": issue.expected
                }
                for issue in self.issues
            ]
        }


class GeometryValidator:
    """
    Advanced geometry validator with comprehensive checks
    """
    
    def __init__(self):
        """Initialize validator with constraints"""
        self.min_volume_mm3 = 1.0  # Minimum part volume
        self.max_volume_mm3 = 1_000_000_000  # 1 cubic meter
        self.min_dimension_mm = 0.1
        self.max_dimension_mm = 10_000  # 10 meters
        self.min_surface_area_mm2 = 1.0
        self.max_aspect_ratio = 1000  # Extreme but possible
    
    def validate(self, geometry: Dict) -> ValidationResult:
        """
        Perform comprehensive validation of geometry data
        
        Args:
            geometry: Geometry data dictionary
            
        Returns:
            ValidationResult with any issues found
        """
        result = ValidationResult(is_valid=True, issues=[])
        
        # Validate required fields
        self._validate_required_fields(geometry, result)
        
        # Validate dimensions
        self._validate_dimensions(geometry, result)
        
        # Validate volume
        self._validate_volume(geometry, result)
        
        # Validate surface area
        self._validate_surface_area(geometry, result)
        
        # Validate geometric consistency
        self._validate_geometric_consistency(geometry, result)
        
        # Validate process-specific requirements
        self._validate_process_requirements(geometry, result)
        
        return result
    
    def _validate_required_fields(self, geometry: Dict, result: ValidationResult):
        """Check that all required fields are present"""
        required_fields = [
            "boundingBox",
            "volume",
            "surfaceArea",
            "recommendedProcess"
        ]
        
        for field in required_fields:
            if field not in geometry or geometry[field] is None:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.CRITICAL,
                    field=field,
                    message=f"Required field '{field}' is missing or null"
                ))
        
        # Validate bounding box structure
        if "boundingBox" in geometry:
            bbox = geometry["boundingBox"]
            for axis in ["x", "y", "z"]:
                if axis not in bbox or bbox[axis] is None:
                    result.add_issue(ValidationIssue(
                        severity=ValidationSeverity.CRITICAL,
                        field=f"boundingBox.{axis}",
                        message=f"Bounding box {axis} dimension is missing"
                    ))
    
    def _validate_dimensions(self, geometry: Dict, result: ValidationResult):
        """Validate bounding box dimensions"""
        bbox = geometry.get("boundingBox", {})
        
        for axis in ["x", "y", "z"]:
            dim = bbox.get(axis, 0)
            
            # Check if dimension is a number
            if not isinstance(dim, (int, float)):
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    field=f"boundingBox.{axis}",
                    message=f"Dimension must be a number, got {type(dim).__name__}",
                    value=dim
                ))
                continue
            
            # Check minimum
            if dim < self.min_dimension_mm:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    field=f"boundingBox.{axis}",
                    message=f"Dimension too small: {dim:.4f}mm (minimum: {self.min_dimension_mm}mm)",
                    value=dim,
                    expected=f">= {self.min_dimension_mm}"
                ))
            
            # Check maximum
            if dim > self.max_dimension_mm:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    field=f"boundingBox.{axis}",
                    message=f"Dimension too large: {dim:.2f}mm (maximum: {self.max_dimension_mm}mm)",
                    value=dim,
                    expected=f"<= {self.max_dimension_mm}"
                ))
            
            # Check for unrealistic values
            if dim <= 0:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.CRITICAL,
                    field=f"boundingBox.{axis}",
                    message="Dimension must be positive",
                    value=dim
                ))
    
    def _validate_volume(self, geometry: Dict, result: ValidationResult):
        """Validate part volume"""
        volume = geometry.get("volume", 0)
        
        # Check if volume is a number
        if not isinstance(volume, (int, float)):
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                field="volume",
                message=f"Volume must be a number, got {type(volume).__name__}",
                value=volume
            ))
            return
        
        # Check minimum
        if volume < self.min_volume_mm3:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                field="volume",
                message=f"Volume too small: {volume:.4f}mm³ (minimum: {self.min_volume_mm3}mm³)",
                value=volume
            ))
        
        # Check maximum
        if volume > self.max_volume_mm3:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                field="volume",
                message=f"Volume too large: {volume:.2f}mm³ (maximum: {self.max_volume_mm3}mm³)",
                value=volume
            ))
        
        # Check for unrealistic values
        if volume <= 0:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.CRITICAL,
                field="volume",
                message="Volume must be positive",
                value=volume
            ))
    
    def _validate_surface_area(self, geometry: Dict, result: ValidationResult):
        """Validate surface area"""
        surface_area = geometry.get("surfaceArea", 0)
        
        # Check if surface area is a number
        if not isinstance(surface_area, (int, float)):
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                field="surfaceArea",
                message=f"Surface area must be a number, got {type(surface_area).__name__}",
                value=surface_area
            ))
            return
        
        # Check minimum
        if surface_area < self.min_surface_area_mm2:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                field="surfaceArea",
                message=f"Surface area too small: {surface_area:.4f}mm²",
                value=surface_area
            ))
        
        # Check for unrealistic values
        if surface_area <= 0:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.CRITICAL,
                field="surfaceArea",
                message="Surface area must be positive",
                value=surface_area
            ))
    
    def _validate_geometric_consistency(self, geometry: Dict, result: ValidationResult):
        """Validate that geometry measurements are physically consistent"""
        bbox = geometry.get("boundingBox", {})
        volume = geometry.get("volume", 0)
        surface_area = geometry.get("surfaceArea", 0)
        
        # Skip if any critical values are missing
        if not all([bbox.get("x"), bbox.get("y"), bbox.get("z"), volume, surface_area]):
            return
        
        # Calculate envelope volume
        envelope_volume = bbox["x"] * bbox["y"] * bbox["z"]
        
        # Volume should not exceed envelope volume
        if volume > envelope_volume * 1.01:  # Allow 1% tolerance for calculation differences
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.ERROR,
                field="volume",
                message=f"Part volume ({volume:.2f}mm³) exceeds bounding box volume ({envelope_volume:.2f}mm³)",
                value=volume,
                expected=f"<= {envelope_volume:.2f}"
            ))
        
        # Check volume efficiency is reasonable
        volume_efficiency = volume / envelope_volume if envelope_volume > 0 else 0
        if volume_efficiency < 0.001:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.WARNING,
                field="volume",
                message=f"Very low volume efficiency ({volume_efficiency * 100:.2f}%) - check measurements",
                value=volume_efficiency
            ))
        
        # Check aspect ratio
        dims = sorted([bbox["x"], bbox["y"], bbox["z"]])
        if dims[0] > 0:
            aspect_ratio = dims[2] / dims[0]
            if aspect_ratio > self.max_aspect_ratio:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    field="boundingBox",
                    message=f"Extreme aspect ratio ({aspect_ratio:.1f}:1) detected",
                    value=aspect_ratio
                ))
        
        # Validate surface area vs volume relationship
        # For a cube, surface area / volume^(2/3) ≈ 6
        # For most parts, this ratio should be between 3 and 30
        if volume > 0:
            sa_to_vol_ratio = surface_area / (volume ** (2/3))
            if sa_to_vol_ratio > 100:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.WARNING,
                    field="surfaceArea",
                    message="Surface area seems unusually high relative to volume - check measurements",
                    value=sa_to_vol_ratio
                ))
    
    def _validate_process_requirements(self, geometry: Dict, result: ValidationResult):
        """Validate process-specific requirements"""
        process = geometry.get("recommendedProcess")
        
        if process == "sheet-metal":
            self._validate_sheet_metal(geometry, result)
        elif process in ["cnc-milling", "cnc-turning"]:
            self._validate_cnc(geometry, result)
    
    def _validate_sheet_metal(self, geometry: Dict, result: ValidationResult):
        """Validate sheet metal specific requirements"""
        sm_features = geometry.get("sheetMetalFeatures", {})
        thickness = sm_features.get("thickness")
        
        if thickness is None:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.WARNING,
                field="sheetMetalFeatures.thickness",
                message="Sheet metal thickness not specified"
            ))
        elif thickness < 0.5 or thickness > 10:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.WARNING,
                field="sheetMetalFeatures.thickness",
                message=f"Unusual sheet metal thickness: {thickness}mm (typical range: 0.5-10mm)",
                value=thickness
            ))
    
    def _validate_cnc(self, geometry: Dict, result: ValidationResult):
        """Validate CNC specific requirements"""
        bbox = geometry.get("boundingBox", {})
        
        # Check if part fits in typical CNC machine
        max_cnc_dims = {"x": 1000, "y": 600, "z": 500}  # mm
        
        for axis, max_dim in max_cnc_dims.items():
            dim = bbox.get(axis, 0)
            if dim > max_dim:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.INFO,
                    field=f"boundingBox.{axis}",
                    message=f"Part may require large-format CNC machine ({dim:.1f}mm > standard {max_dim}mm)",
                    value=dim
                ))


def validate_geometry(geometry: Dict) -> Dict:
    """
    Convenience function for geometry validation
    
    Args:
        geometry: Geometry data dictionary
        
    Returns:
        Validation result as dictionary
    """
    validator = GeometryValidator()
    result = validator.validate(geometry)
    return result.to_dict()
