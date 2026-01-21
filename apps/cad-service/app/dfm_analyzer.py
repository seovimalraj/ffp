"""
Advanced DFM (Design for Manufacturability) Analyzer
Provides comprehensive manufacturability analysis with detailed recommendations
"""
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json
import math


class Severity(Enum):
    """Issue severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ManufacturabilityScore(Enum):
    """Overall manufacturability rating"""
    EXCELLENT = "excellent"  # 90-100
    GOOD = "good"  # 75-89
    FAIR = "fair"  # 60-74
    POOR = "poor"  # 40-59
    CRITICAL = "critical"  # 0-39


@dataclass
class DFMIssue:
    """Single manufacturability issue"""
    category: str
    severity: Severity
    title: str
    description: str
    location: Optional[str] = None
    measurement: Optional[float] = None
    recommendation: Optional[str] = None
    cost_impact: Optional[str] = None  # "low", "medium", "high"
    lead_time_impact: Optional[str] = None


@dataclass
class ManufacturabilityReport:
    """Complete DFM analysis report"""
    overall_score: float  # 0-100
    rating: ManufacturabilityScore
    is_manufacturable: bool
    issues: List[DFMIssue] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    cost_optimization_opportunities: List[str] = field(default_factory=list)
    estimated_cost_impact: Dict[str, float] = field(default_factory=dict)
    
    def add_issue(self, issue: DFMIssue):
        """Add an issue to the report"""
        self.issues.append(issue)
        
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "overall_score": self.overall_score,
            "rating": self.rating.value,
            "is_manufacturable": self.is_manufacturable,
            "issues": [
                {
                    "category": issue.category,
                    "severity": issue.severity.value,
                    "title": issue.title,
                    "description": issue.description,
                    "location": issue.location,
                    "measurement": issue.measurement,
                    "recommendation": issue.recommendation,
                    "cost_impact": issue.cost_impact,
                    "lead_time_impact": issue.lead_time_impact
                }
                for issue in self.issues
            ],
            "recommendations": self.recommendations,
            "cost_optimization_opportunities": self.cost_optimization_opportunities,
            "estimated_cost_impact": self.estimated_cost_impact
        }


class AdvancedDFMAnalyzer:
    """
    Advanced Design for Manufacturability Analyzer
    
    Performs comprehensive analysis of:
    - Dimensional feasibility
    - Tolerance achievability
    - Feature manufacturability
    - Material selection appropriateness
    - Cost optimization opportunities
    - Process suitability
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize analyzer with configuration"""
        self.config = self._load_config(config_path) if config_path else self._default_config()
        
    def _default_config(self) -> Dict:
        """Default manufacturing constraints"""
        return {
            "materials": {
                "aluminum": {
                    "min_wall_thickness_mm": 1.0,
                    "min_hole_diameter_mm": 1.0,
                    "max_aspect_ratio": 15.0,
                    "min_corner_radius_mm": 0.5
                },
                "steel": {
                    "min_wall_thickness_mm": 0.8,
                    "min_hole_diameter_mm": 1.0,
                    "max_aspect_ratio": 12.0,
                    "min_corner_radius_mm": 0.5
                },
                "plastic": {
                    "min_wall_thickness_mm": 1.5,
                    "min_hole_diameter_mm": 2.0,
                    "max_aspect_ratio": 8.0,
                    "min_corner_radius_mm": 1.0
                }
            },
            "processes": {
                "cnc_milling": {
                    "max_dimensions": {"x": 1000, "y": 500, "z": 300},
                    "min_tool_diameter_mm": 1.0,
                    "max_hole_depth_ratio": 10.0,
                    "min_slot_width_mm": 2.0
                },
                "sheet_metal": {
                    "min_thickness_mm": 0.5,
                    "max_thickness_mm": 6.0,
                    "min_bend_radius_ratio": 1.0,  # radius / thickness
                    "max_bend_angle": 180,
                    "min_flange_length_mm": 4.0
                }
            }
        }
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from JSON file"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except Exception:
            return self._default_config()
    
    def analyze(
        self,
        geometry: Dict,
        process_type: str,
        material: str = "aluminum",
        tolerance: str = "standard"
    ) -> ManufacturabilityReport:
        """
        Perform comprehensive DFM analysis
        
        Args:
            geometry: Geometric data dictionary
            process_type: Manufacturing process (cnc_milling, sheet_metal, etc.)
            material: Material type
            tolerance: Tolerance level (standard, precision, tight)
            
        Returns:
            ManufacturabilityReport with detailed analysis
        """
        report = ManufacturabilityReport(
            overall_score=100.0,
            rating=ManufacturabilityScore.EXCELLENT,
            is_manufacturable=True
        )
        
        # Run analysis modules
        self._analyze_dimensions(geometry, process_type, report)
        self._analyze_features(geometry, process_type, material, report)
        self._analyze_tolerances(geometry, tolerance, report)
        self._analyze_material_suitability(geometry, material, process_type, report)
        
        if process_type == "sheet_metal":
            self._analyze_sheet_metal_specific(geometry, material, report)
        elif process_type == "cnc_milling":
            self._analyze_cnc_specific(geometry, material, report)
        
        # Calculate final score and rating
        self._calculate_final_score(report)
        self._generate_recommendations(report, geometry, process_type)
        self._identify_cost_optimizations(report, geometry, process_type)
        
        return report
    
    def _analyze_dimensions(self, geometry: Dict, process_type: str, report: ManufacturabilityReport):
        """Check if part dimensions are within machine capabilities"""
        bbox = geometry.get("boundingBox", {})
        dims = [bbox.get("x", 0), bbox.get("y", 0), bbox.get("z", 0)]
        
        process_config = self.config["processes"].get(process_type, {})
        max_dims = process_config.get("max_dimensions", {})
        
        # Check each dimension
        for axis, dim in zip(["x", "y", "z"], dims):
            max_allowed = max_dims.get(axis, 1000)
            if dim > max_allowed:
                report.add_issue(DFMIssue(
                    category="dimensions",
                    severity=Severity.CRITICAL,
                    title=f"Part exceeds {axis.upper()}-axis capacity",
                    description=f"Part dimension ({dim:.1f}mm) exceeds machine capacity ({max_allowed}mm)",
                    measurement=dim,
                    recommendation=f"Reduce {axis.upper()}-axis dimension to under {max_allowed}mm or split into multiple parts",
                    cost_impact="high",
                    lead_time_impact="high"
                ))
                report.overall_score -= 15
        
        # Check aspect ratio
        sorted_dims = sorted(dims)
        if sorted_dims[0] > 0:
            aspect_ratio = sorted_dims[2] / sorted_dims[0]
            max_aspect = self.config["materials"]["aluminum"]["max_aspect_ratio"]
            
            if aspect_ratio > max_aspect:
                report.add_issue(DFMIssue(
                    category="geometry",
                    severity=Severity.WARNING,
                    title="High aspect ratio detected",
                    description=f"Aspect ratio ({aspect_ratio:.1f}) may cause deflection or chatter",
                    measurement=aspect_ratio,
                    recommendation="Consider adding support ribs or reducing length-to-thickness ratio",
                    cost_impact="medium"
                ))
                report.overall_score -= 5
    
    def _analyze_features(self, geometry: Dict, process_type: str, material: str, report: ManufacturabilityReport):
        """Analyze manufacturability of geometric features"""
        material_config = self.config["materials"].get(material, self.config["materials"]["aluminum"])
        
        # Check thin walls
        dims = sorted([
            geometry.get("boundingBox", {}).get("x", 0),
            geometry.get("boundingBox", {}).get("y", 0),
            geometry.get("boundingBox", {}).get("z", 0)
        ])
        
        min_dim = dims[0]
        min_wall = material_config["min_wall_thickness_mm"]
        
        if min_dim < min_wall:
            report.add_issue(DFMIssue(
                category="features",
                severity=Severity.ERROR,
                title="Wall thickness below minimum",
                description=f"Minimum dimension ({min_dim:.2f}mm) is below recommended minimum ({min_wall}mm) for {material}",
                measurement=min_dim,
                recommendation=f"Increase wall thickness to at least {min_wall}mm to prevent warping and breakage",
                cost_impact="high",
                lead_time_impact="medium"
            ))
            report.overall_score -= 10
        
        # Check sharp corners
        min_radius = material_config["min_corner_radius_mm"]
        report.recommendations.append(
            f"Add minimum {min_radius}mm radius to all internal corners to reduce stress concentrations"
        )
        
        # Check holes
        advanced_features = geometry.get("advancedFeatures", {})
        holes = advanced_features.get("holes", {})
        hole_count = holes.get("totalCount", 0)
        
        if hole_count > 0:
            min_hole_dia = material_config["min_hole_diameter_mm"]
            deep_holes = holes.get("deepHoleCount", 0)
            
            if deep_holes > 0:
                report.add_issue(DFMIssue(
                    category="features",
                    severity=Severity.WARNING,
                    title="Deep holes detected",
                    description=f"{deep_holes} deep hole(s) detected (depth > 5× diameter)",
                    recommendation="Consider using gun drilling or reducing hole depth for cost savings",
                    cost_impact="medium"
                ))
                report.overall_score -= 3
    
    def _analyze_tolerances(self, geometry: Dict, tolerance: str, report: ManufacturabilityReport):
        """Analyze tolerance achievability and cost impact"""
        tolerance_impacts = {
            "standard": {"achievable": True, "cost_multiplier": 1.0, "score_penalty": 0},
            "precision": {"achievable": True, "cost_multiplier": 1.5, "score_penalty": 2},
            "tight": {"achievable": True, "cost_multiplier": 2.0, "score_penalty": 5}
        }
        
        impact = tolerance_impacts.get(tolerance, tolerance_impacts["standard"])
        
        if tolerance in ["precision", "tight"]:
            report.add_issue(DFMIssue(
                category="tolerances",
                severity=Severity.INFO,
                title=f"{tolerance.capitalize()} tolerance requirements",
                description=f"Part requires {tolerance} tolerances which increase cost by {(impact['cost_multiplier'] - 1) * 100:.0f}%",
                recommendation="Review if standard tolerances (+/- 0.1mm) are sufficient for most features",
                cost_impact="medium" if tolerance == "precision" else "high"
            ))
            report.overall_score -= impact["score_penalty"]
            report.estimated_cost_impact["tolerance_premium"] = impact["cost_multiplier"]
    
    def _analyze_material_suitability(self, geometry: Dict, material: str, process_type: str, report: ManufacturabilityReport):
        """Check if material is suitable for process and geometry"""
        complexity = geometry.get("complexity", "moderate")
        
        # Material recommendations based on complexity
        if material == "steel" and complexity == "complex":
            report.add_issue(DFMIssue(
                category="material",
                severity=Severity.INFO,
                title="Material machinability consideration",
                description="Steel is harder to machine than aluminum for complex geometries",
                recommendation="Consider aluminum 6061-T6 for cost savings (up to 30% reduction) if material properties allow",
                cost_impact="medium"
            ))
    
    def _analyze_sheet_metal_specific(self, geometry: Dict, material: str, report: ManufacturabilityReport):
        """Sheet metal specific DFM checks"""
        sm_features = geometry.get("sheetMetalFeatures", {})
        thickness = sm_features.get("thickness", 2.0)
        bends = sm_features.get("bends", [])
        
        sheet_config = self.config["processes"]["sheet_metal"]
        
        # Check thickness range
        if thickness < sheet_config["min_thickness_mm"]:
            report.add_issue(DFMIssue(
                category="sheet_metal",
                severity=Severity.ERROR,
                title="Material too thin",
                description=f"Thickness ({thickness}mm) below minimum ({sheet_config['min_thickness_mm']}mm)",
                recommendation=f"Increase thickness to at least {sheet_config['min_thickness_mm']}mm",
                cost_impact="low"
            ))
            report.overall_score -= 10
        
        if thickness > sheet_config["max_thickness_mm"]:
            report.add_issue(DFMIssue(
                category="sheet_metal",
                severity=Severity.WARNING,
                title="Material very thick for sheet metal",
                description=f"Thickness ({thickness}mm) is better suited for CNC machining",
                recommendation="Consider CNC milling instead of bending for thick materials",
                cost_impact="medium"
            ))
            report.overall_score -= 5
        
        # Analyze bends
        if len(bends) > 10:
            report.add_issue(DFMIssue(
                category="sheet_metal",
                severity=Severity.WARNING,
                title="High bend count",
                description=f"{len(bends)} bends detected - may increase cost and lead time",
                recommendation="Consider simplifying design or splitting into multiple parts with welding/fasteners",
                cost_impact="medium",
                lead_time_impact="medium"
            ))
            report.overall_score -= 5
        
        # Check bend radii
        min_bend_radius = thickness * sheet_config["min_bend_radius_ratio"]
        for i, bend in enumerate(bends):
            radius = bend.get("radius", thickness)
            if radius < min_bend_radius:
                report.add_issue(DFMIssue(
                    category="sheet_metal",
                    severity=Severity.WARNING,
                    title=f"Bend #{i+1} radius too small",
                    description=f"Radius ({radius:.2f}mm) below minimum ({min_bend_radius:.2f}mm)",
                    recommendation=f"Increase bend radius to {min_bend_radius:.2f}mm to prevent cracking",
                    cost_impact="low"
                ))
                report.overall_score -= 2
    
    def _analyze_cnc_specific(self, geometry: Dict, material: str, report: ManufacturabilityReport):
        """CNC machining specific DFM checks"""
        advanced_features = geometry.get("advancedFeatures", {})
        
        # Check for undercuts
        if advanced_features.get("undercuts"):
            undercut_severity = advanced_features["undercuts"].get("severity", "minor")
            if undercut_severity in ["moderate", "severe"]:
                report.add_issue(DFMIssue(
                    category="cnc_milling",
                    severity=Severity.WARNING,
                    title=f"{undercut_severity.capitalize()} undercuts detected",
                    description="Undercuts require special tools or additional setups",
                    recommendation="Remove undercuts or accept 20-40% cost increase for special tooling",
                    cost_impact="high" if undercut_severity == "severe" else "medium"
                ))
                report.overall_score -= 8 if undercut_severity == "severe" else 5
        
        # Check for complex surfaces
        if advanced_features.get("complexSurfaces", {}).get("has3DContours", False):
            report.add_issue(DFMIssue(
                category="cnc_milling",
                severity=Severity.INFO,
                title="3D contoured surfaces detected",
                description="Complex 3D surfaces require 3-axis or 5-axis machining",
                recommendation="Simplify to 2.5D features (pockets, holes, slots) for cost savings",
                cost_impact="medium"
            ))
            report.overall_score -= 3
    
    def _calculate_final_score(self, report: ManufacturabilityReport):
        """Calculate final manufacturability score and rating"""
        score = max(0, min(100, report.overall_score))
        report.overall_score = score
        
        # Determine rating
        if score >= 90:
            report.rating = ManufacturabilityScore.EXCELLENT
        elif score >= 75:
            report.rating = ManufacturabilityScore.GOOD
        elif score >= 60:
            report.rating = ManufacturabilityScore.FAIR
        elif score >= 40:
            report.rating = ManufacturabilityScore.POOR
        else:
            report.rating = ManufacturabilityScore.CRITICAL
        
        # Determine if manufacturable
        critical_issues = [i for i in report.issues if i.severity == Severity.CRITICAL]
        report.is_manufacturable = len(critical_issues) == 0 and score >= 40
    
    def _generate_recommendations(self, report: ManufacturabilityReport, geometry: Dict, process_type: str):
        """Generate prioritized recommendations for improvement"""
        # Group issues by category
        issues_by_category = {}
        for issue in report.issues:
            if issue.category not in issues_by_category:
                issues_by_category[issue.category] = []
            issues_by_category[issue.category].append(issue)
        
        # Generate summary recommendations
        if report.overall_score < 75:
            report.recommendations.append(
                f"Overall manufacturability score is {report.overall_score:.0f}/100 ({report.rating.value}). "
                f"Address {len(report.issues)} identified issues to improve manufacturability and reduce costs."
            )
        
        # Specific recommendations by category
        if "dimensions" in issues_by_category:
            report.recommendations.append(
                "Consider splitting large parts into multiple components for manufacturability"
            )
        
        if "features" in issues_by_category:
            report.recommendations.append(
                "Simplify geometric features to reduce machining complexity and time"
            )
        
        if "tolerances" in issues_by_category:
            report.recommendations.append(
                "Apply tight tolerances only to critical dimensions - use standard tolerances elsewhere"
            )
    
    def _identify_cost_optimizations(self, report: ManufacturabilityReport, geometry: Dict, process_type: str):
        """Identify specific opportunities to reduce manufacturing costs"""
        complexity = geometry.get("complexity", "moderate")
        
        # Material optimization
        volume_cm3 = geometry.get("volume", 0) / 1000
        if volume_cm3 < 50:
            report.cost_optimization_opportunities.append(
                "Small part - consider batch production for 20-40% cost reduction per unit"
            )
        
        # Process optimization
        if process_type == "cnc_milling" and complexity == "simple":
            report.cost_optimization_opportunities.append(
                "Simple geometry - consider using lower-cost 3-axis machining instead of 5-axis"
            )
        
        # Feature optimization
        advanced_features = geometry.get("advancedFeatures", {})
        if advanced_features.get("threads"):
            report.cost_optimization_opportunities.append(
                "Replace tapped holes with thread-forming screws for faster production"
            )
        
        # Surface finish optimization
        report.cost_optimization_opportunities.append(
            "Use as-machined finish where possible - anodizing/plating adds 15-30% to cost"
        )
        
        # Tolerance optimization
        report.cost_optimization_opportunities.append(
            "Review tolerance requirements - relaxing from +/-0.05mm to +/-0.1mm can save 20%"
        )


def analyze_dfm(
    geometry: Dict,
    process_type: str,
    material: str = "aluminum",
    tolerance: str = "standard",
    config_path: Optional[str] = None
) -> Dict:
    """
    Convenience function for DFM analysis
    
    Args:
        geometry: Geometry data dictionary
        process_type: Manufacturing process
        material: Material type
        tolerance: Tolerance level
        config_path: Optional path to config file
        
    Returns:
        Dictionary containing DFM analysis results
    """
    analyzer = AdvancedDFMAnalyzer(config_path)
    report = analyzer.analyze(geometry, process_type, material, tolerance)
    return report.to_dict()
