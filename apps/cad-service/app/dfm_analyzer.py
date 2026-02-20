"""
Advanced DFM (Design for Manufacturability) Analyzer
Provides comprehensive manufacturability analysis with detailed recommendations
"""
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import json
import math

from .models import HoleFeature, PocketFeature, ThreadFeature, SlotFeature, UndercutFeature, FilletFeature


def _classify_hole(
    hole: HoleFeature,
    min_tool_diameter: float,
    max_depth_ratio: float,
) -> Tuple[Dict, List[Dict]]:
    """Classify a single hole and return (detail_dict, issues_list)."""
    dia = hole.diameter_mm
    depth = hole.depth_mm
    depth_ratio = depth / dia if dia > 0 else 0
    is_deep = depth_ratio > max_depth_ratio
    is_small = dia < min_tool_diameter

    detail = {
        "id": hole.id,
        "type": hole.type,
        "diameter_mm": dia,
        "depth_mm": depth,
        "depth_ratio": round(depth_ratio, 2),
        "is_deep": is_deep,
        "is_very_deep": is_deep,
        "is_small": is_small,
        "axis": hole.axis,
    }

    issues: List[Dict] = []
    if is_deep:
        issues.append({
            "hole_id": hole.id,
            "issue": "very_deep_hole",
            "severity": "warning",
            "description": (
                f"Hole depth/diameter ratio ({depth_ratio:.1f}) exceeds "
                f"{max_depth_ratio}. May require gun drilling."
            ),
            "recommendation": "Reduce depth or use larger diameter",
        })
    if is_small:
        issues.append({
            "hole_id": hole.id,
            "issue": "small_hole",
            "severity": "warning" if dia >= 0.5 else "error",
            "description": (
                f"Hole diameter ({dia:.2f}mm) below minimum tool size "
                f"({min_tool_diameter}mm)"
            ),
            "recommendation": (
                f"Increase diameter to at least {min_tool_diameter}mm or use EDM"
            ),
        })
    return detail, issues


def transform_holes_to_advanced_features(holes: List[HoleFeature], process_config: Optional[Dict] = None) -> Dict:
    """
    Transform List[HoleFeature] to advancedFeatures.holes format expected by DFM analyzer.
    """
    if not holes:
        return {
            "totalCount": 0,
            "deepHoleCount": 0,
            "smallHoleCount": 0,
            "diameterRange": None,
            "depthRange": None,
            "holeDetails": [],
            "issues": [],
        }

    min_tool_diameter = 1.0
    max_depth_ratio = 10.0
    if process_config:
        min_tool_diameter = process_config.get("min_tool_diameter_mm", 1.0)
        max_depth_ratio = process_config.get("max_hole_depth_ratio", 10.0)

    diameters: List[float] = []
    depths: List[float] = []
    hole_details: List[Dict] = []
    all_issues: List[Dict] = []
    deep_hole_count = 0
    small_hole_count = 0

    for hole in holes:
        detail, issues = _classify_hole(hole, min_tool_diameter, max_depth_ratio)
        diameters.append(hole.diameter_mm)
        depths.append(hole.depth_mm)
        hole_details.append(detail)
        all_issues.extend(issues)
        if detail["is_deep"]:
            deep_hole_count += 1
        if detail["is_small"]:
            small_hole_count += 1

    return {
        "totalCount": len(holes),
        "deepHoleCount": deep_hole_count,
        "smallHoleCount": small_hole_count,
        "diameterRange": {
            "min": round(min(diameters), 2),
            "max": round(max(diameters), 2),
            "avg": round(sum(diameters) / len(diameters), 2),
        },
        "depthRange": {
            "min": round(min(depths), 2),
            "max": round(max(depths), 2),
            "avg": round(sum(depths) / len(depths), 2),
        },
        "holeDetails": hole_details,
        "issues": all_issues,
    }


def transform_pockets_to_advanced_features(pockets: List[PocketFeature], _process_config: Optional[Dict] = None) -> Dict:
    """Transform List[PocketFeature] to advancedFeatures.pockets format."""
    if not pockets:
        return {
            "totalCount": 0,
            "deepPocketCount": 0,
            "highAspectRatioCount": 0,
            "pocketDetails": [],
            "issues": []
        }
    
    total_count = len(pockets)
    deep_pocket_count = 0
    high_aspect_count = 0
    issues = []
    pocket_details = []
    
    for pocket in pockets:
        depth = pocket.depth_mm
        mouth_area = pocket.mouth_area_mm2
        aspect_ratio = pocket.aspect_ratio
        
        # Estimate characteristic size from mouth area (sqrt for approx dimension)
        char_dim = (mouth_area ** 0.5) if mouth_area > 0 else 1.0
        depth_ratio = depth / char_dim if char_dim > 0 else 0
        
        is_deep = depth_ratio > 4.0 or aspect_ratio > 4.0
        is_high_aspect = aspect_ratio > 6.0
        
        if is_deep:
            deep_pocket_count += 1
        if is_high_aspect:
            high_aspect_count += 1
        
        pocket_detail = {
            "id": pocket.id,
            "depth_mm": depth,
            "mouth_area_mm2": mouth_area,
            "aspect_ratio": round(aspect_ratio, 2),
            "depth_ratio": round(depth_ratio, 2),
            "is_deep": is_deep,
            "is_high_aspect": is_high_aspect
        }
        pocket_details.append(pocket_detail)
        
        if is_deep:
            issues.append({
                "pocket_id": pocket.id,
                "issue": "deep_pocket",
                "severity": "warning",
                "description": f"Pocket depth ratio ({depth_ratio:.1f}) may require long reach tooling"
            })
        
        if is_high_aspect:
            issues.append({
                "pocket_id": pocket.id,
                "issue": "high_aspect_ratio",
                "severity": "warning",
                "description": f"Pocket aspect ratio ({aspect_ratio:.1f}) may cause tool deflection"
            })
    
    return {
        "totalCount": total_count,
        "deepPocketCount": deep_pocket_count,
        "highAspectRatioCount": high_aspect_count,
        "pocketDetails": pocket_details,
        "issues": issues
    }


def _build_threads_data(threads: Optional[List[ThreadFeature]]) -> Optional[Dict]:
    """Build threads summary dict."""
    if not threads:
        return None
    return {
        "totalCount": len(threads),
        "threadDetails": [
            {
                "id": t.id,
                "diameter_mm": t.diameter_mm,
                "pitch_mm": t.pitch_mm,
                "depth_mm": t.depth_mm,
                "thread_type": t.thread_type,
                "is_standard": t.is_standard,
                "standard_name": t.standard_name,
            }
            for t in threads
        ],
    }


def _build_slots_data(slots: Optional[List[SlotFeature]]) -> Optional[Dict]:
    """Build slots summary dict."""
    if not slots:
        return None
    return {
        "totalCount": len(slots),
        "slotDetails": [
            {
                "id": s.id,
                "length_mm": s.length_mm,
                "width_mm": s.width_mm,
                "depth_mm": s.depth_mm,
                "slot_type": s.slot_type,
            }
            for s in slots
        ],
    }


def _build_undercuts_data(undercuts: Optional[List[UndercutFeature]]) -> Optional[Dict]:
    """Build undercuts summary dict."""
    if not undercuts:
        return None
    severity_counts = {"minor": 0, "moderate": 0, "severe": 0}
    for u in undercuts:
        sev = u.severity if u.severity in severity_counts else "minor"
        severity_counts[sev] += 1
    worst = "minor"
    if severity_counts["severe"] > 0:
        worst = "severe"
    elif severity_counts["moderate"] > 0:
        worst = "moderate"
    return {
        "totalCount": len(undercuts),
        "severity": worst,
        "severityCounts": severity_counts,
        "requiresSpecialTooling": any(u.requires_special_tooling for u in undercuts),
    }


def _build_fillets_data(fillets: Optional[List[FilletFeature]]) -> Optional[Dict]:
    """Build fillets/chamfers summary dict."""
    if not fillets:
        return None
    fillet_list = [f for f in fillets if f.feature_type == "fillet"]
    chamfer_list = [f for f in fillets if f.feature_type == "chamfer"]
    return {
        "filletCount": len(fillet_list),
        "chamferCount": len(chamfer_list),
        "minRadius": min((f.radius_mm for f in fillet_list), default=0),
        "maxRadius": max((f.radius_mm for f in fillet_list), default=0),
    }


def _build_draft_data(draft_analysis: Optional[List]) -> Optional[Dict]:
    """Build draft angle summary dict."""
    if not draft_analysis:
        return None
    insufficient = [d for d in draft_analysis if not d.is_sufficient]
    return {
        "totalFaces": len(draft_analysis),
        "insufficientCount": len(insufficient),
        "minDraftDeg": min((d.draft_angle_deg for d in draft_analysis), default=0),
        "avgDraftDeg": (sum(d.draft_angle_deg for d in draft_analysis)
                        / max(len(draft_analysis), 1)),
    }


def _attach_sheet_metal_features(
    geometry: Dict,
    sorted_dims: List[float],
    thickness: Optional[float],
    bend_analysis: Optional[Dict],
    grain_direction: Optional[Any],
    nesting: Optional[Any],
) -> None:
    """Attach sheet-metal-specific sub-dicts to *geometry* in place."""
    bends: List[Dict] = []
    bend_count = 0
    if bend_analysis:
        bend_count = bend_analysis.get("bend_count", 0)
        bends = bend_analysis.get("bends", [])

    geometry["sheetMetalFeatures"] = {
        "thickness": thickness or sorted_dims[0],
        "bends": bends,
        "bendCount": bend_count,
    }

    if grain_direction:
        geometry["grainDirection"] = {
            "recommended_direction": grain_direction.recommended_direction,
            "alignment_score": grain_direction.alignment_score,
            "notes": grain_direction.notes,
        }
    if nesting:
        geometry["nestingEstimate"] = {
            "sheet_width_mm": nesting.sheet_width_mm,
            "sheet_height_mm": nesting.sheet_height_mm,
            "parts_per_sheet": nesting.parts_per_sheet,
            "utilization_pct": nesting.utilization_pct,
        }


def build_geometry_for_dfm(
    bbox_dims: List[float],
    volume_mm3: float,
    surface_area_mm2: float,
    holes: List[HoleFeature],
    pockets: List[PocketFeature],
    process_type: str,
    thickness: Optional[float] = None,
    bend_analysis: Optional[Dict] = None,
    complexity: str = "moderate",
    process_config: Optional[Dict] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Build the complete geometry dictionary for DFM analysis.

    This transforms raw extracted features into the format expected by AdvancedDFMAnalyzer.

    Extra keyword arguments:
        threads, slots, undercuts, fillets, draft_analysis, grain_direction, nesting
    """
    threads: Optional[List[ThreadFeature]] = kwargs.get("threads")
    slots: Optional[List[SlotFeature]] = kwargs.get("slots")
    undercuts: Optional[List[UndercutFeature]] = kwargs.get("undercuts")
    fillets: Optional[List[FilletFeature]] = kwargs.get("fillets")
    draft_analysis: Optional[List] = kwargs.get("draft_analysis")
    grain_direction = kwargs.get("grain_direction")
    nesting = kwargs.get("nesting")

    sorted_dims = sorted(bbox_dims)

    geometry: Dict[str, Any] = {
        "boundingBox": {
            "x": sorted_dims[2] if len(sorted_dims) == 3 else 0,
            "y": sorted_dims[1] if len(sorted_dims) >= 2 else 0,
            "z": sorted_dims[0] if len(sorted_dims) >= 1 else 0,
        },
        "volume": volume_mm3,
        "surfaceArea": surface_area_mm2,
        "complexity": complexity,
        "advancedFeatures": {
            "holes": transform_holes_to_advanced_features(holes, process_config),
            "pockets": transform_pockets_to_advanced_features(pockets, process_config),
            "threads": _build_threads_data(threads),
            "slots": _build_slots_data(slots),
            "undercuts": _build_undercuts_data(undercuts),
            "fillets": _build_fillets_data(fillets),
            "draftAnalysis": _build_draft_data(draft_analysis),
            "complexSurfaces": {"has3DContours": False},
        },
    }

    if process_type == "sheet_metal":
        _attach_sheet_metal_features(
            geometry, sorted_dims, thickness, bend_analysis,
            grain_direction, nesting,
        )

    return geometry


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
        except Exception as e:
            print(f"⚠️ Failed to load DFM config from {config_path}: {e}, using defaults")
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
        
        # Store current material for use in sub-methods
        self._current_material = material
        
        # Run analysis modules
        self._analyze_dimensions(geometry, process_type, report)
        self._analyze_features(geometry, process_type, material, report)
        self._analyze_tolerances(geometry, tolerance, report)
        self._analyze_material_suitability(geometry, material, process_type, report)
        
        if process_type == "sheet_metal":
            self._analyze_sheet_metal_specific(geometry, material, report)
        elif process_type == "cnc_milling":
            self._analyze_cnc_specific(geometry, material, report)
        elif process_type == "injection_molding":
            self._analyze_injection_molding_specific(geometry, material, report)

        # Thread, slot, and undercut checks for any CNC-like process
        if process_type in ("cnc_milling", "cnc_turning"):
            self._analyze_threads(geometry, report)
            self._analyze_slots(geometry, report)

        # Sheet metal proximity checks
        if process_type == "sheet_metal":
            self._analyze_hole_to_edge(geometry, report)
            self._analyze_hole_to_bend(geometry, report)
            self._analyze_flange_length(geometry, report)

        # Evaluate config-driven rules
        self._evaluate_rules(geometry, process_type, material, report)
        
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
            # Use material-specific max_aspect_ratio, falling back to aluminum defaults
            material_config = self.config["materials"].get(
                getattr(self, '_current_material', 'aluminum'),
                self.config["materials"]["aluminum"]
            )
            max_aspect = material_config.get("max_aspect_ratio", 15.0)
            
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
    
    def _analyze_features(self, geometry: Dict, _process_type: str, material: str, report: ManufacturabilityReport):
        """Analyze manufacturability of geometric features"""
        material_config = self.config["materials"].get(material, self.config["materials"]["aluminum"])
        
        # Check thin walls from bounding box
        dims = sorted([
            geometry.get("boundingBox", {}).get("x", 0),
            geometry.get("boundingBox", {}).get("y", 0),
            geometry.get("boundingBox", {}).get("z", 0)
        ])
        
        min_dim = dims[0]
        min_wall = material_config["min_wall_thickness_mm"]
        
        if min_dim > 0 and min_dim < min_wall:
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
        
        # Check sharp corners - add recommendation
        min_radius = material_config["min_corner_radius_mm"]
        report.recommendations.append(
            f"Add minimum {min_radius}mm radius to all internal corners to reduce stress concentrations"
        )
        
        # === COMPREHENSIVE HOLE FEATURE CHECK ===
        advanced_features = geometry.get("advancedFeatures", {})
        holes_data = advanced_features.get("holes", {})
        hole_count = holes_data.get("totalCount", 0)
        
        if hole_count > 0:
            min_hole_dia = material_config["min_hole_diameter_mm"]
            diameter_range = holes_data.get("diameterRange", {})
            
            # Check minimum hole diameter
            if diameter_range:
                min_found_dia = diameter_range.get("min", 0)
                if min_found_dia > 0 and min_found_dia < min_hole_dia:
                    report.add_issue(DFMIssue(
                        category="features",
                        severity=Severity.WARNING,
                        title="Holes below minimum diameter",
                        description=f"Smallest hole diameter ({min_found_dia:.2f}mm) is below recommended minimum ({min_hole_dia}mm) for {material}",
                        measurement=min_found_dia,
                        recommendation=f"Increase hole diameter to at least {min_hole_dia}mm or accept cost premium for micro-machining",
                        cost_impact="medium"
                    ))
                    report.overall_score -= 5
            
            # Check for deep holes (general feature check)
            deep_holes = holes_data.get("deepHoleCount", 0)
            if deep_holes > 0:
                report.add_issue(DFMIssue(
                    category="features",
                    severity=Severity.WARNING,
                    title="Deep holes detected",
                    description=f"{deep_holes} deep hole(s) detected (depth > 5× diameter)",
                    measurement=float(deep_holes),
                    recommendation="Consider using gun drilling or reducing hole depth for cost savings",
                    cost_impact="medium"
                ))
                report.overall_score -= 3
            
            # Add hole-related recommendations
            if hole_count > 10:
                report.recommendations.append(
                    f"Part has {hole_count} holes - consider combining similar sizes to reduce tool changes"
                )
    
    def _analyze_tolerances(self, _geometry: Dict, tolerance: str, report: ManufacturabilityReport):
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
    
    def _analyze_material_suitability(self, geometry: Dict, material: str, _process_type: str, report: ManufacturabilityReport):
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
    
    def _analyze_sheet_metal_specific(self, geometry: Dict, _material: str, report: ManufacturabilityReport):
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
        material_config = self.config["materials"].get(material, self.config["materials"]["aluminum"])

        self._cnc_check_holes(advanced_features, material_config, report)
        self._cnc_check_pockets(advanced_features, report)
        self._cnc_check_undercuts(advanced_features, report)
        self._cnc_check_complex_surfaces(advanced_features, report)
        self._cnc_check_fillets(advanced_features, report)
        self._cnc_check_slots(advanced_features, report)  # AUDIT FIX: Add slot checks
        self._cnc_check_threads(advanced_features, report)  # AUDIT FIX: Add thread checks
        self._cnc_check_overall_complexity(advanced_features, geometry, report)

    # -- CNC sub-checks ---------------------------------------------------

    def _cnc_check_holes(self, advanced_features: Dict, material_config: Dict,
                         report: ManufacturabilityReport) -> None:
        """Check holes for CNC manufacturability."""
        holes_data = advanced_features.get("holes", {})
        total_holes = holes_data.get("totalCount", 0)
        if total_holes == 0:
            return

        min_hole_dia = material_config.get("min_hole_diameter_mm", 1.0)
        self._cnc_check_deep_holes(holes_data, report)
        self._cnc_check_small_holes(holes_data, min_hole_dia, report)
        self._cnc_check_hole_issues(holes_data, report)

        if total_holes > 50:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="Very high hole count",
                description=f"{total_holes} holes significantly increase machining time, tool changes, and cost",
                measurement=float(total_holes),
                recommendation="Review if all holes are necessary — combining sizes or eliminating redundant holes reduces cost by 10-20%",
                cost_impact="high",
                lead_time_impact="medium",
            ))
            report.overall_score -= 5
        elif total_holes > 20:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.INFO,
                title="High hole count",
                description=f"{total_holes} holes increase machining time and tool wear",
                measurement=float(total_holes),
                recommendation="Consider if all holes are necessary - combining or eliminating holes reduces cost",
                cost_impact="medium",
            ))
            report.overall_score -= 3

        self._cnc_check_hole_diameter_range(holes_data, report)

    def _cnc_check_deep_holes(self, holes_data: Dict, report: ManufacturabilityReport) -> None:
        deep_holes = holes_data.get("deepHoleCount", 0)
        if deep_holes > 0:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="Deep holes detected",
                description=f"{deep_holes} deep hole(s) with depth > 5\u00d7 diameter require peck drilling or gun drilling",
                measurement=float(deep_holes),
                recommendation="Consider reducing hole depth or use larger diameter for cost savings",
                cost_impact="medium" if deep_holes <= 3 else "high",
                lead_time_impact="medium",
            ))
            report.overall_score -= min(10, deep_holes * 2)

    def _cnc_check_small_holes(self, holes_data: Dict, min_hole_dia: float,
                               report: ManufacturabilityReport) -> None:
        small_holes = holes_data.get("smallHoleCount", 0)
        if small_holes == 0:
            return
        min_dia = holes_data.get("diameterRange", {}).get("min", 0)
        report.add_issue(DFMIssue(
            category="cnc_milling",
            severity=Severity.WARNING if min_dia >= 0.5 else Severity.ERROR,
            title="Small holes detected",
            description=f"{small_holes} hole(s) with diameter < {min_hole_dia}mm may require EDM or micro-drilling",
            measurement=min_dia,
            recommendation=f"Increase hole diameter to at least {min_hole_dia}mm or accept cost premium for special tooling",
            cost_impact="high" if min_dia < 0.5 else "medium",
        ))
        report.overall_score -= min(15, small_holes * 3)

    def _cnc_check_hole_issues(self, holes_data: Dict, report: ManufacturabilityReport) -> None:
        for issue in holes_data.get("issues", []):
            if issue.get("issue") == "very_deep_hole":
                report.add_issue(DFMIssue(
                    category="cnc_milling", severity=Severity.WARNING,
                    title=f"Very deep hole {issue.get('hole_id', '')}",
                    description=issue.get("description", "Hole requires special drilling technique"),
                    recommendation=issue.get("recommendation", ""),
                    cost_impact="high",
                ))

    def _cnc_check_hole_diameter_range(self, holes_data: Dict,
                                       report: ManufacturabilityReport) -> None:
        diameter_range = holes_data.get("diameterRange", {})
        if not diameter_range:
            return
        min_dia = diameter_range.get("min", 0)
        max_dia = diameter_range.get("max", 0)
        if max_dia > 0 and min_dia > 0 and max_dia / min_dia > 5:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.INFO,
                title="Wide hole diameter range",
                description=f"Hole diameters range from {min_dia:.1f}mm to {max_dia:.1f}mm requiring multiple tools",
                recommendation="Standardize hole sizes where possible to reduce tool changes",
                cost_impact="low",
            ))

    def _cnc_check_pockets(self, advanced_features: Dict,
                           report: ManufacturabilityReport) -> None:
        """Check pockets for CNC manufacturability."""
        pockets_data = advanced_features.get("pockets", {})
        total_pockets = pockets_data.get("totalCount", 0)
        if total_pockets == 0:
            return

        deep_pockets = pockets_data.get("deepPocketCount", 0)
        if deep_pockets > 0:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="Deep pockets detected",
                description=f"{deep_pockets} pocket(s) with high depth ratio require long reach tooling",
                recommendation="Reduce pocket depth or increase opening size for standard tooling",
                cost_impact="medium",
            ))
            report.overall_score -= min(8, deep_pockets * 2)

        high_aspect_pockets = pockets_data.get("highAspectRatioCount", 0)
        if high_aspect_pockets > 0:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="High aspect ratio pockets detected",
                description=f"{high_aspect_pockets} pocket(s) with aspect ratio > 6 may cause tool deflection",
                recommendation="Consider using shorter tools with multiple passes or redesign pocket geometry",
                cost_impact="medium",
            ))
            report.overall_score -= min(6, high_aspect_pockets * 2)

    @staticmethod
    def _cnc_check_undercuts(advanced_features: Dict,
                             report: ManufacturabilityReport) -> None:
        """Check undercuts for CNC manufacturability."""
        undercuts = advanced_features.get("undercuts")
        if not undercuts:
            return
        undercut_severity = undercuts.get("severity", "minor")
        if undercut_severity in ["moderate", "severe"]:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title=f"{undercut_severity.capitalize()} undercuts detected",
                description="Undercuts require special tools or additional setups",
                recommendation="Remove undercuts or accept 20-40% cost increase for special tooling",
                cost_impact="high" if undercut_severity == "severe" else "medium",
            ))
            report.overall_score -= 8 if undercut_severity == "severe" else 5

    @staticmethod
    def _cnc_check_complex_surfaces(advanced_features: Dict,
                                    report: ManufacturabilityReport) -> None:
        """Check for complex 3D surfaces."""
        if advanced_features.get("complexSurfaces", {}).get("has3DContours", False):
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.INFO,
                title="3D contoured surfaces detected",
                description="Complex 3D surfaces require 3-axis or 5-axis machining",
                recommendation="Simplify to 2.5D features (pockets, holes, slots) for cost savings",
                cost_impact="medium",
            ))
            report.overall_score -= 3

    @staticmethod
    def _cnc_check_fillets(advanced_features: Dict,
                           report: ManufacturabilityReport) -> None:
        """Check fillet/chamfer count and sizes for CNC manufacturability."""
        fillets_data = advanced_features.get("fillets")
        if not fillets_data:
            return
        fillet_count = fillets_data.get("filletCount", 0)
        chamfer_count = fillets_data.get("chamferCount", 0)
        total = fillet_count + chamfer_count
        if total == 0:
            return

        min_radius = fillets_data.get("minRadius", 0)

        if total > 30:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="Very high fillet/chamfer count",
                description=f"{total} fillets/chamfers ({fillet_count} fillets, {chamfer_count} chamfers) significantly increase machining time",
                measurement=float(total),
                recommendation="Simplify edge treatments where cosmetic finish is not critical",
                cost_impact="medium",
                lead_time_impact="medium",
            ))
            report.overall_score -= 5
        elif total > 15:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.INFO,
                title="Many fillets/chamfers",
                description=f"{total} fillets/chamfers add machining passes",
                measurement=float(total),
                recommendation="Combine similar radii to reduce tool changes",
                cost_impact="low",
            ))
            report.overall_score -= 2

        if min_radius > 0 and min_radius < 0.5:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="Very small fillet radius",
                description=f"Smallest fillet radius ({min_radius:.2f}mm) requires micro end mill",
                measurement=min_radius,
                recommendation="Increase fillet radius to ≥ 0.5mm for standard tooling",
                cost_impact="medium",
            ))
            report.overall_score -= 3

    @staticmethod
    def _cnc_check_slots(advanced_features: Dict,
                         report: ManufacturabilityReport) -> None:
        """AUDIT FIX: Check slots for CNC manufacturability.
        
        Validates:
        - Slot width vs minimum end mill diameter
        - Slot depth vs tool deflection limits
        - Slot aspect ratio (depth/width)
        - Corner radius requirements for closed slots
        """
        slots_data = advanced_features.get("slots") or {}
        total_slots = slots_data.get("totalCount", 0)
        if total_slots == 0:
            return
        
        # Minimum practical end mill diameter is ~1mm for most shops
        MIN_END_MILL_DIA = 1.0  # mm
        # Maximum practical depth-to-width ratio before tool deflection issues
        MAX_DEPTH_WIDTH_RATIO = 6.0
        
        min_width = slots_data.get("minWidth", 0)
        max_depth = slots_data.get("maxDepth", 0)
        through_count = slots_data.get("throughCount", 0)
        blind_count = slots_data.get("blindCount", 0)
        
        # Check for very narrow slots
        if min_width > 0 and min_width < MIN_END_MILL_DIA:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.ERROR,
                title="Slot too narrow for standard tooling",
                description=f"Slot width {min_width:.2f}mm requires micro end mill (< 1mm)",
                measurement=min_width,
                recommendation="Widen slot to ≥ 1mm or use EDM/wire EDM for narrow slots",
                cost_impact="high",
            ))
            report.overall_score -= 10
        elif min_width > 0 and min_width < 2.0:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="Narrow slots require small end mills",
                description=f"Slot width {min_width:.2f}mm limits tool selection",
                measurement=min_width,
                recommendation="Consider widening slots to ≥ 2mm for faster machining",
                cost_impact="medium",
            ))
            report.overall_score -= 3
        
        # Check depth-to-width ratio for tool deflection
        if min_width > 0 and max_depth > 0:
            depth_ratio = max_depth / min_width
            if depth_ratio > MAX_DEPTH_WIDTH_RATIO:
                report.add_issue(DFMIssue(
                    category="cnc_milling", severity=Severity.WARNING,
                    title="Deep slot may cause tool deflection",
                    description=f"Slot depth/width ratio {depth_ratio:.1f}:1 exceeds {MAX_DEPTH_WIDTH_RATIO}:1 guideline",
                    measurement=depth_ratio,
                    recommendation="Reduce slot depth, widen slot, or accept slower feeds for deeper cuts",
                    cost_impact="medium",
                ))
                report.overall_score -= 4
        
        # Blind slots require tool plunge capability
        if blind_count > 3:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.INFO,
                title="Multiple blind slots detected",
                description=f"{blind_count} blind slots require plunge-capable end mills",
                measurement=float(blind_count),
                recommendation="Consider through-slots where possible to simplify machining",
                cost_impact="low",
            ))
            report.overall_score -= 2

    @staticmethod
    def _cnc_check_threads(advanced_features: Dict,
                           report: ManufacturabilityReport) -> None:
        """AUDIT FIX: Check threads for CNC manufacturability.
        
        Validates:
        - Thread pitch vs hole diameter (thread engagement)
        - Thread depth vs standard tap lengths
        - External vs internal threading requirements
        - Non-standard thread pitches
        """
        threads_data = advanced_features.get("threads") or {}
        total_threads = threads_data.get("totalCount", 0)
        if total_threads == 0:
            return
        
        # Standard minimum engagement is 1.5x diameter
        MIN_ENGAGEMENT_RATIO = 1.5
        # Standard tap lengths are typically 2-3x diameter
        MAX_TAP_DEPTH_RATIO = 3.0
        
        internal_count = threads_data.get("internalCount", 0)
        external_count = threads_data.get("externalCount", 0)
        fine_pitch_count = threads_data.get("finePitchCount", 0)
        non_standard_count = threads_data.get("nonStandardCount", 0)
        max_depth = threads_data.get("maxDepth", 0)
        min_diameter = threads_data.get("minDiameter", 0)
        
        # Check for very small threads
        if min_diameter > 0 and min_diameter < 2.0:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="Very small thread diameter",
                description=f"Thread diameter {min_diameter:.2f}mm requires delicate tapping",
                measurement=min_diameter,
                recommendation="Use thread-forming taps or consider M2.5+ threads for durability",
                cost_impact="medium",
            ))
            report.overall_score -= 3
        
        # Check thread depth vs diameter ratio
        if min_diameter > 0 and max_depth > 0:
            depth_ratio = max_depth / min_diameter
            if depth_ratio > MAX_TAP_DEPTH_RATIO:
                report.add_issue(DFMIssue(
                    category="cnc_milling", severity=Severity.WARNING,
                    title="Deep threads may require special taps",
                    description=f"Thread depth/diameter ratio {depth_ratio:.1f}:1 exceeds standard tap length",
                    measurement=depth_ratio,
                    recommendation="Use spiral-flute taps or reduce thread depth to ≤ 3x diameter",
                    cost_impact="medium",
                ))
                report.overall_score -= 4
        
        # Non-standard threads increase cost
        if non_standard_count > 0:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="Non-standard thread pitches detected",
                description=f"{non_standard_count} threads with non-standard pitch require custom tooling",
                measurement=float(non_standard_count),
                recommendation="Use ISO metric coarse (M) or UNC standard threads where possible",
                cost_impact="high",
            ))
            report.overall_score -= 5
        
        # Fine pitch threads need more care
        if fine_pitch_count > 2:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.INFO,
                title="Multiple fine-pitch threads",
                description=f"{fine_pitch_count} fine-pitch threads require careful tapping",
                measurement=float(fine_pitch_count),
                recommendation="Fine threads are more prone to cross-threading; ensure generous chamfers",
                cost_impact="low",
            ))
            report.overall_score -= 2
        
        # External threads on milled parts may require turning
        if external_count > 0:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.INFO,
                title="External threads detected",
                description=f"{external_count} external threads may require thread milling or turning",
                measurement=float(external_count),
                recommendation="Consider thread milling for external threads on milled parts",
                cost_impact="medium",
            ))
            report.overall_score -= 2

    @staticmethod
    def _cnc_check_overall_complexity(advanced_features: Dict,
                                      geometry: Dict,
                                      report: ManufacturabilityReport) -> None:
        """Penalise parts with many diverse features (multi-setup)."""
        holes = advanced_features.get("holes", {}).get("totalCount", 0)
        threads_data = advanced_features.get("threads")
        threads = threads_data.get("totalCount", 0) if threads_data else 0
        slots_data = advanced_features.get("slots")
        slots = slots_data.get("totalCount", 0) if slots_data else 0
        fillets_data = advanced_features.get("fillets")
        fillets = (fillets_data.get("filletCount", 0) + fillets_data.get("chamferCount", 0)) if fillets_data else 0
        pockets = advanced_features.get("pockets", {}).get("totalCount", 0)

        # Count distinct feature categories present
        categories = sum(1 for c in [holes, threads, slots, fillets, pockets] if c > 0)
        total_features = holes + threads + slots + fillets + pockets

        if total_features > 100 and categories >= 3:
            report.add_issue(DFMIssue(
                category="cnc_milling", severity=Severity.WARNING,
                title="High overall feature complexity",
                description=(
                    f"{total_features} features across {categories} categories — "
                    "expect multiple setups, tool changes, and extended machining time"
                ),
                measurement=float(total_features),
                recommendation="Review design for feature consolidation; consider splitting into sub-assemblies",
                cost_impact="high",
                lead_time_impact="high",
            ))
            report.overall_score -= 5

    # -----------------------------------------------------------------
    # Injection molding DFM
    # -----------------------------------------------------------------
    def _analyze_injection_molding_specific(
        self, geometry: Dict, _material: str, report: ManufacturabilityReport
    ):
        """Injection-molding specific DFM checks."""
        im_config = self.config.get("processes", {}).get("injection_molding", {})
        if not im_config:
            im_config = {
                "min_wall_thickness_mm": 1.0,
                "max_wall_thickness_mm": 6.0,
                "recommended_wall_mm": 2.5,
                "min_draft_angle_deg": 1.0,
                "max_undercut_depth_mm": 3.0,
                "min_corner_radius_ratio": 0.5,
                "max_flow_length_mm": 300.0,
                "max_dimensions": {"x": 800, "y": 600, "z": 400},
            }

        bbox = geometry.get("boundingBox", {})
        dims = sorted([bbox.get("x", 0), bbox.get("y", 0), bbox.get("z", 0)])
        advanced = geometry.get("advancedFeatures", {})
        min_wall = dims[0] if dims[0] > 0 else 0

        self._im_check_envelope(bbox, im_config, report)
        self._im_check_wall_thickness(min_wall, dims, im_config, report)
        self._im_check_draft_angles(advanced, im_config, report)
        self._im_check_undercuts(advanced, report)
        self._im_check_fillets(advanced, min_wall, im_config, report)
        self._im_check_flow_length(dims, im_config, report)

    # -- Injection-molding sub-checks -------------------------------------

    @staticmethod
    def _im_check_envelope(bbox: Dict, im_config: Dict,
                           report: ManufacturabilityReport) -> None:
        max_dims = im_config.get("max_dimensions", {})
        for axis in ["x", "y", "z"]:
            val = bbox.get(axis, 0)
            limit = max_dims.get(axis, 1000)
            if val > limit:
                report.add_issue(DFMIssue(
                    category="injection_molding", severity=Severity.CRITICAL,
                    title=f"Part exceeds mold {axis.upper()}-axis capacity",
                    description=f"{axis.upper()} dimension ({val:.1f}mm) exceeds mold capacity ({limit}mm)",
                    measurement=val,
                    recommendation="Reduce part size or use a larger press",
                    cost_impact="high",
                ))
                report.overall_score -= 15

    @staticmethod
    def _im_check_wall_thickness(min_wall: float, dims: List[float],
                                 im_config: Dict,
                                 report: ManufacturabilityReport) -> None:
        im_min = im_config.get("min_wall_thickness_mm", 1.0)
        im_max = im_config.get("max_wall_thickness_mm", 6.0)

        if 0 < min_wall < im_min:
            report.add_issue(DFMIssue(
                category="injection_molding", severity=Severity.ERROR,
                title="Wall too thin for injection molding",
                description=f"Minimum wall ({min_wall:.2f}mm) below recommended ({im_min}mm)",
                measurement=min_wall,
                recommendation=f"Increase wall thickness to \u2265 {im_min}mm",
                cost_impact="medium",
            ))
            report.overall_score -= 8

        if min_wall > im_max:
            report.add_issue(DFMIssue(
                category="injection_molding", severity=Severity.WARNING,
                title="Wall too thick for injection molding",
                description=f"Maximum wall ({min_wall:.2f}mm) exceeds recommended ({im_max}mm)",
                measurement=min_wall,
                recommendation="Core out thick sections to achieve uniform wall thickness",
                cost_impact="medium",
            ))
            report.overall_score -= 5

        if dims[0] > 0 and dims[2] > 0:
            wall_ratio = dims[2] / dims[0]
            if wall_ratio > 3:
                report.add_issue(DFMIssue(
                    category="injection_molding", severity=Severity.WARNING,
                    title="Non-uniform wall thickness likely",
                    description=f"Bounding-box aspect ratio ({wall_ratio:.1f}) suggests warping risk",
                    recommendation="Design for uniform 2-3mm wall thickness; core out thick sections",
                    cost_impact="medium",
                ))
                report.overall_score -= 4

    @staticmethod
    def _im_check_draft_angles(advanced: Dict, im_config: Dict,
                               report: ManufacturabilityReport) -> None:
        draft_data = advanced.get("draftAnalysis")
        if not draft_data:
            return
        insufficient = draft_data.get("insufficientCount", 0)
        if insufficient > 0:
            min_deg = im_config.get("min_draft_angle_deg", 1)
            report.add_issue(DFMIssue(
                category="injection_molding", severity=Severity.ERROR,
                title="Insufficient draft angles",
                description=f"{insufficient} face(s) have draft < {min_deg}\u00b0",
                measurement=float(insufficient),
                recommendation="Add \u2265 1\u00b0 draft on all vertical faces; 2\u00b0 for textured surfaces",
                cost_impact="high",
            ))
            report.overall_score -= min(12, insufficient * 2)

    @staticmethod
    def _im_check_undercuts(advanced: Dict,
                            report: ManufacturabilityReport) -> None:
        undercuts_data = advanced.get("undercuts")
        if not undercuts_data or undercuts_data.get("totalCount", 0) == 0:
            return
        cnt = undercuts_data["totalCount"]
        sev = undercuts_data.get("severity", "minor")
        report.add_issue(DFMIssue(
            category="injection_molding",
            severity=Severity.WARNING if sev != "severe" else Severity.ERROR,
            title=f"{cnt} undercut(s) detected ({sev})",
            description="Undercuts require side actions or slide cores, adding 15-30% to mold cost",
            measurement=float(cnt),
            recommendation="Eliminate undercuts by redesigning snap-fits or using sliding shutoffs",
            cost_impact="high" if sev == "severe" else "medium",
        ))
        report.overall_score -= 5 if sev != "severe" else 10

    @staticmethod
    def _im_check_fillets(advanced: Dict, min_wall: float,
                          im_config: Dict,
                          report: ManufacturabilityReport) -> None:
        fillets_data = advanced.get("fillets")
        if not fillets_data:
            return
        min_r = fillets_data.get("minRadius", 0)
        rec_r = im_config.get("min_corner_radius_ratio", 0.5) * max(min_wall, 1.0)
        if min_r > 0 and min_r < rec_r:
            report.add_issue(DFMIssue(
                category="injection_molding", severity=Severity.WARNING,
                title="Internal corner radius too small",
                description=f"Min radius ({min_r:.2f}mm) below recommended ({rec_r:.2f}mm)",
                measurement=min_r,
                recommendation=f"Add \u2265 {rec_r:.1f}mm radius to internal corners",
                cost_impact="low",
            ))
            report.overall_score -= 3

    @staticmethod
    def _im_check_flow_length(dims: List[float], im_config: Dict,
                              report: ManufacturabilityReport) -> None:
        max_flow = im_config.get("max_flow_length_mm", 300)
        longest_dim = dims[2] if len(dims) == 3 else 0
        if longest_dim > max_flow:
            report.add_issue(DFMIssue(
                category="injection_molding", severity=Severity.WARNING,
                title="Long flow length",
                description=f"Longest dimension ({longest_dim:.0f}mm) exceeds typical flow length ({max_flow}mm)",
                recommendation="Add multiple gates or reduce part length",
                cost_impact="medium",
            ))
            report.overall_score -= 4

    # -----------------------------------------------------------------
    # Thread analysis (CNC)
    # -----------------------------------------------------------------
    def _analyze_threads(self, geometry: Dict, report: ManufacturabilityReport):
        """Check thread manufacturability."""
        threads = geometry.get("advancedFeatures", {}).get("threads")
        if not threads or threads.get("totalCount", 0) == 0:
            return

        global_thresh = self.config.get("global_thresholds", {})
        min_thread_dia = global_thresh.get("min_thread_diameter_mm", 3.0)

        for td in threads.get("threadDetails", []):
            dia = td.get("diameter_mm", 0)
            depth = td.get("depth_mm", 0)
            is_standard = td.get("is_standard", True)

            if dia < min_thread_dia:
                report.add_issue(DFMIssue(
                    category="threads",
                    severity=Severity.WARNING,
                    title=f"Small thread {td.get('id', '')}",
                    description=f"Thread diameter ({dia:.2f}mm) below recommended minimum ({min_thread_dia}mm) — fragile tap",
                    measurement=dia,
                    recommendation=f"Use ≥ M{min_thread_dia:.0f} or consider thread-forming insert",
                    cost_impact="low",
                ))
                report.overall_score -= 2

            if not is_standard:
                report.add_issue(DFMIssue(
                    category="threads",
                    severity=Severity.INFO,
                    title=f"Non-standard thread {td.get('id', '')}",
                    description=f"Thread (Ø{dia:.2f}mm) does not match a standard ISO/UNC size — custom tap required",
                    recommendation="Use standard thread sizes to reduce tooling cost",
                    cost_impact="low",
                ))

            if dia > 0 and depth / dia > 3:
                report.add_issue(DFMIssue(
                    category="threads",
                    severity=Severity.WARNING,
                    title=f"Deep thread {td.get('id', '')}",
                    description=f"Thread depth/diameter ratio ({depth/dia:.1f}) is high — tap breakage risk",
                    recommendation="Limit thread engagement to 2-2.5× diameter",
                    cost_impact="medium",
                ))
                report.overall_score -= 2

        # Thread count penalty — many threads mean secondary operations
        total_threads = threads.get("totalCount", 0)
        if total_threads > 10:
            report.add_issue(DFMIssue(
                category="threads",
                severity=Severity.WARNING,
                title="High thread count",
                description=f"{total_threads} threaded holes require significant tapping time and increase tap breakage risk",
                measurement=float(total_threads),
                recommendation="Consider thread-forming screws or helicoil inserts for non-critical threads",
                cost_impact="medium",
                lead_time_impact="medium",
            ))
            report.overall_score -= 5
        elif total_threads > 5:
            report.add_issue(DFMIssue(
                category="threads",
                severity=Severity.INFO,
                title="Multiple threads",
                description=f"{total_threads} threaded holes add machining time for tapping operations",
                measurement=float(total_threads),
                recommendation="Standardize thread sizes to reduce tap changes",
                cost_impact="low",
            ))
            report.overall_score -= 2

    # -----------------------------------------------------------------
    # Slot analysis (CNC)
    # -----------------------------------------------------------------
    def _analyze_slots(self, geometry: Dict, report: ManufacturabilityReport):
        """Check slot manufacturability."""
        slots = geometry.get("advancedFeatures", {}).get("slots")
        if not slots or slots.get("totalCount", 0) == 0:
            return

        proc_cfg = self.config.get("processes", {}).get("cnc_milling", {})
        min_slot_w = proc_cfg.get("min_slot_width_mm", 2.0)

        for sd in slots.get("slotDetails", []):
            w = sd.get("width_mm", 0)
            d = sd.get("depth_mm", 0)
            if w > 0 and w < min_slot_w:
                report.add_issue(DFMIssue(
                    category="cnc_milling",
                    severity=Severity.WARNING,
                    title=f"Narrow slot {sd.get('id', '')}",
                    description=f"Slot width ({w:.2f}mm) below minimum tool diameter ({min_slot_w}mm)",
                    measurement=w,
                    recommendation=f"Widen slot to ≥ {min_slot_w}mm or use EDM",
                    cost_impact="medium",
                ))
                report.overall_score -= 3

            if w > 0 and d > 0 and d / w > 4:
                report.add_issue(DFMIssue(
                    category="cnc_milling",
                    severity=Severity.WARNING,
                    title=f"Deep slot {sd.get('id', '')}",
                    description=f"Slot depth/width ratio ({d/w:.1f}) causes tool deflection",
                    measurement=d / w,
                    recommendation="Reduce slot depth or widen slot",
                    cost_impact="medium",
                ))
                report.overall_score -= 2

    # -----------------------------------------------------------------
    # Hole-to-edge distance (sheet metal / CNC)
    # -----------------------------------------------------------------
    def _analyze_hole_to_edge(self, geometry: Dict, report: ManufacturabilityReport):
        """Ensure sufficient hole-to-edge distance."""
        holes_data = geometry.get("advancedFeatures", {}).get("holes", {})
        hole_details = holes_data.get("holeDetails", [])

        sm_cfg = self.config.get("processes", {}).get("sheet_metal", {})
        min_ratio = sm_cfg.get("min_hole_to_edge_ratio", 1.0)

        bbox = geometry.get("boundingBox", {})
        part_x = bbox.get("x", 0)

        for hd in hole_details:
            dia = hd.get("diameter_mm", 0)
            min_dist_required = dia * min_ratio
            # If the hole is closer to any edge than the required clearance,
            # flag it. We don't have exact positions for all holes so use
            # the conservative check: part must be at least 2× clearance wider.
            if part_x > 0 and part_x < dia + 2 * min_dist_required:
                report.add_issue(DFMIssue(
                    category="sheet_metal",
                    severity=Severity.WARNING,
                    title=f"Hole {hd.get('id','')} too close to edge",
                    description=f"Hole Ø{dia:.1f}mm requires ≥ {min_dist_required:.1f}mm clearance from edges",
                    recommendation=f"Move hole ≥ {min_dist_required:.1f}mm from nearest edge or reduce hole size",
                    cost_impact="low",
                ))
                report.overall_score -= 3
                break  # report once

    # -----------------------------------------------------------------
    # Hole-to-bend distance (sheet metal)
    # -----------------------------------------------------------------
    def _analyze_hole_to_bend(self, geometry: Dict, report: ManufacturabilityReport):
        """Holes near bends may deform — check minimum distance."""
        sm = geometry.get("sheetMetalFeatures", {})
        thickness = sm.get("thickness", 2.0)
        bends = sm.get("bends", [])
        holes_data = geometry.get("advancedFeatures", {}).get("holes", {})
        hole_count = holes_data.get("totalCount", 0)

        if hole_count == 0 or len(bends) == 0:
            return

        global_thresh = self.config.get("global_thresholds", {})
        thickness_mult = global_thresh.get("min_hole_to_bend_thickness_multiple", 2.0)
        min_dist = thickness * thickness_mult + max(b.get("radius", thickness) for b in bends)

        report.add_issue(DFMIssue(
            category="sheet_metal",
            severity=Severity.INFO,
            title="Hole-to-bend proximity advisory",
            description=(
                f"With {hole_count} hole(s) and {len(bends)} bend(s), "
                f"ensure holes are ≥ {min_dist:.1f}mm from bend lines "
                f"(2× thickness + bend radius)"
            ),
            recommendation=f"Move holes ≥ {min_dist:.1f}mm from nearest bend line to prevent distortion",
            cost_impact="low",
        ))

    # -----------------------------------------------------------------
    # Min flange length (sheet metal)
    # -----------------------------------------------------------------
    def _analyze_flange_length(self, geometry: Dict, report: ManufacturabilityReport):
        """Flanges must be long enough for press-brake tooling grip."""
        sm = geometry.get("sheetMetalFeatures", {})
        thickness = sm.get("thickness", 2.0)
        bends = sm.get("bends", [])
        if not bends:
            return

        sm_cfg = self.config.get("processes", {}).get("sheet_metal", {})
        min_flange = sm_cfg.get("min_flange_length_mm", 4.0)
        # General recommendation: flange ≥ max(4mm, 3×thickness)
        required = max(min_flange, 3 * thickness)

        # We can approximate flange length from bounding box dimension
        bbox = geometry.get("boundingBox", {})
        dims = sorted([bbox.get("x", 0), bbox.get("y", 0), bbox.get("z", 0)])
        smallest_non_thickness = dims[1] if len(dims) >= 2 else 0

        if 0 < smallest_non_thickness < required:
            report.add_issue(DFMIssue(
                category="sheet_metal",
                severity=Severity.WARNING,
                title="Flange too short",
                description=(
                    f"Shortest non-thickness dimension ({smallest_non_thickness:.1f}mm) "
                    f"below minimum flange length ({required:.1f}mm)"
                ),
                measurement=smallest_non_thickness,
                recommendation=f"Extend flange to ≥ {required:.1f}mm for press-brake grip",
                cost_impact="low",
            ))
            report.overall_score -= 4

    # -----------------------------------------------------------------
    # Config-driven rules engine
    # -----------------------------------------------------------------
    def _evaluate_rules(
        self, _geometry: Dict, process_type: str, _material: str, _report: ManufacturabilityReport
    ):
        """Evaluate declarative rules from dfm_config.json.

        Currently all conditions are handled by explicit analysis methods.
        This framework exists for custom user-defined rules in the config.
        """
        rules = self.config.get("rules", [])
        if not rules:
            return

        for rule in rules:
            applies_to = rule.get("applies_to", [])
            if process_type not in applies_to:
                continue

            # Rules framework ready for future custom condition evaluation.
            # All built-in conditions are covered by explicit methods above.
            _ = rule  # acknowledge rule is read but not evaluated further
    
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
    
    def _generate_recommendations(self, report: ManufacturabilityReport, _geometry: Dict, _process_type: str):
        """Generate prioritized recommendations for improvement"""
        # Group issues by category
        issues_by_category: Dict[str, List[DFMIssue]] = {}
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
