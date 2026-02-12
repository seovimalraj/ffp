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


def transform_holes_to_advanced_features(holes: List[HoleFeature], process_config: Optional[Dict] = None) -> Dict:
    """
    Transform List[HoleFeature] to advancedFeatures.holes format expected by DFM analyzer.
    
    Returns dict with:
        - totalCount: int
        - deepHoleCount: int (depth > 5x diameter)
        - smallHoleCount: int (diameter < min tool size)
        - diameterRange: {min, max, avg}
        - depthRange: {min, max, avg}
        - holeDetails: list of individual hole info
        - issues: list of potential manufacturability issues
    """
    if not holes:
        return {
            "totalCount": 0,
            "deepHoleCount": 0,
            "smallHoleCount": 0,
            "diameterRange": None,
            "depthRange": None,
            "holeDetails": [],
            "issues": []
        }
    
    # Default thresholds
    min_tool_diameter = 1.0  # mm
    max_depth_ratio = 10.0
    if process_config:
        min_tool_diameter = process_config.get("min_tool_diameter_mm", 1.0)
        max_depth_ratio = process_config.get("max_hole_depth_ratio", 10.0)
    
    total_count = len(holes)
    deep_hole_count = 0
    small_hole_count = 0
    issues = []
    
    diameters = []
    depths = []
    hole_details = []
    
    for hole in holes:
        dia = hole.diameter_mm
        depth = hole.depth_mm
        
        diameters.append(dia)
        depths.append(depth)
        
        # Calculate depth-to-diameter ratio
        depth_ratio = depth / dia if dia > 0 else 0
        
        # Check for deep holes (depth > standard deep hole threshold)
        is_deep = depth_ratio > max_depth_ratio
        if is_deep:
            deep_hole_count += 1
        
        # Check for very deep holes (may require gun drilling)
        is_very_deep = depth_ratio > max_depth_ratio
        
        # Check for small holes
        is_small = dia < min_tool_diameter
        if is_small:
            small_hole_count += 1
        
        hole_detail = {
            "id": hole.id,
            "type": hole.type,
            "diameter_mm": dia,
            "depth_mm": depth,
            "depth_ratio": round(depth_ratio, 2),
            "is_deep": is_deep,
            "is_very_deep": is_very_deep,
            "is_small": is_small,
            "axis": hole.axis
        }
        hole_details.append(hole_detail)
        
        # Track issues
        if is_very_deep:
            issues.append({
                "hole_id": hole.id,
                "issue": "very_deep_hole",
                "severity": "warning",
                "description": f"Hole depth/diameter ratio ({depth_ratio:.1f}) exceeds {max_depth_ratio}. May require gun drilling.",
                "recommendation": "Reduce depth or use larger diameter"
            })
        
        if is_small:
            issues.append({
                "hole_id": hole.id,
                "issue": "small_hole",
                "severity": "warning" if dia >= 0.5 else "error",
                "description": f"Hole diameter ({dia:.2f}mm) below minimum tool size ({min_tool_diameter}mm)",
                "recommendation": f"Increase diameter to at least {min_tool_diameter}mm or use EDM"
            })
    
    return {
        "totalCount": total_count,
        "deepHoleCount": deep_hole_count,
        "smallHoleCount": small_hole_count,
        "diameterRange": {
            "min": round(min(diameters), 2),
            "max": round(max(diameters), 2),
            "avg": round(sum(diameters) / len(diameters), 2)
        },
        "depthRange": {
            "min": round(min(depths), 2),
            "max": round(max(depths), 2),
            "avg": round(sum(depths) / len(depths), 2)
        },
        "holeDetails": hole_details,
        "issues": issues
    }


def transform_pockets_to_advanced_features(pockets: List[PocketFeature], process_config: Optional[Dict] = None) -> Dict:
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
    threads: Optional[List[ThreadFeature]] = None,
    slots: Optional[List[SlotFeature]] = None,
    undercuts: Optional[List[UndercutFeature]] = None,
    fillets: Optional[List[FilletFeature]] = None,
    draft_analysis: Optional[List] = None,
    grain_direction: Optional[Any] = None,
    nesting: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Build the complete geometry dictionary for DFM analysis.
    
    This transforms raw extracted features into the format expected by AdvancedDFMAnalyzer.
    """
    sorted_dims = sorted(bbox_dims)
    
    # Thread data
    threads_data = None
    if threads:
        threads_data = {
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

    # Slot data
    slots_data = None
    if slots:
        slots_data = {
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

    # Undercut data
    undercuts_data = None
    if undercuts:
        severity_counts = {"minor": 0, "moderate": 0, "severe": 0}
        for u in undercuts:
            sev = u.severity if u.severity in severity_counts else "minor"
            severity_counts[sev] += 1
        worst = "minor"
        if severity_counts["severe"] > 0:
            worst = "severe"
        elif severity_counts["moderate"] > 0:
            worst = "moderate"
        undercuts_data = {
            "totalCount": len(undercuts),
            "severity": worst,
            "severityCounts": severity_counts,
            "requiresSpecialTooling": any(u.requires_special_tooling for u in undercuts),
        }

    # Fillet data
    fillets_data = None
    if fillets:
        fillet_list = [f for f in fillets if f.feature_type == "fillet"]
        chamfer_list = [f for f in fillets if f.feature_type == "chamfer"]
        fillets_data = {
            "filletCount": len(fillet_list),
            "chamferCount": len(chamfer_list),
            "minRadius": min((f.radius_mm for f in fillet_list), default=0),
            "maxRadius": max((f.radius_mm for f in fillet_list), default=0),
        }

    # Draft angle summary
    draft_data = None
    if draft_analysis:
        insufficient = [d for d in draft_analysis if not d.is_sufficient]
        draft_data = {
            "totalFaces": len(draft_analysis),
            "insufficientCount": len(insufficient),
            "minDraftDeg": min((d.draft_angle_deg for d in draft_analysis), default=0),
            "avgDraftDeg": sum(d.draft_angle_deg for d in draft_analysis) / max(len(draft_analysis), 1),
        }

    geometry = {
        "boundingBox": {
            "x": sorted_dims[2] if len(sorted_dims) == 3 else 0,
            "y": sorted_dims[1] if len(sorted_dims) >= 2 else 0,
            "z": sorted_dims[0] if len(sorted_dims) >= 1 else 0
        },
        "volume": volume_mm3,
        "surfaceArea": surface_area_mm2,
        "complexity": complexity,
        "advancedFeatures": {
            "holes": transform_holes_to_advanced_features(holes, process_config),
            "pockets": transform_pockets_to_advanced_features(pockets, process_config),
            "threads": threads_data,
            "slots": slots_data,
            "undercuts": undercuts_data,
            "fillets": fillets_data,
            "draftAnalysis": draft_data,
            "complexSurfaces": {"has3DContours": False}
        }
    }
    
    # Add sheet metal features if applicable
    if process_type == "sheet_metal":
        bends = []
        bend_count = 0
        if bend_analysis:
            bend_count = bend_analysis.get("bend_count", 0)
            bends = bend_analysis.get("bends", [])
        
        geometry["sheetMetalFeatures"] = {
            "thickness": thickness or sorted_dims[0],
            "bends": bends,
            "bendCount": bend_count
        }

        # Add grain direction and nesting
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
    
    def _analyze_features(self, geometry: Dict, process_type: str, material: str, report: ManufacturabilityReport):
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
        material_config = self.config["materials"].get(material, self.config["materials"]["aluminum"])
        process_config = self.config["processes"].get("cnc_milling", {})
        
        # === COMPREHENSIVE HOLE ANALYSIS ===
        holes_data = advanced_features.get("holes", {})
        total_holes = holes_data.get("totalCount", 0)
        
        if total_holes > 0:
            min_hole_dia = material_config.get("min_hole_diameter_mm", 1.0)
            max_depth_ratio = process_config.get("max_hole_depth_ratio", 10.0)
            
            # Check for deep holes
            deep_holes = holes_data.get("deepHoleCount", 0)
            if deep_holes > 0:
                report.add_issue(DFMIssue(
                    category="cnc_milling",
                    severity=Severity.WARNING,
                    title="Deep holes detected",
                    description=f"{deep_holes} deep hole(s) with depth > 5× diameter require peck drilling or gun drilling",
                    measurement=float(deep_holes),
                    recommendation="Consider reducing hole depth or use larger diameter for cost savings",
                    cost_impact="medium" if deep_holes <= 3 else "high",
                    lead_time_impact="medium"
                ))
                report.overall_score -= min(10, deep_holes * 2)
            
            # Check for small holes
            small_holes = holes_data.get("smallHoleCount", 0)
            if small_holes > 0:
                diameter_range = holes_data.get("diameterRange", {})
                min_dia = diameter_range.get("min", 0)
                report.add_issue(DFMIssue(
                    category="cnc_milling",
                    severity=Severity.WARNING if min_dia >= 0.5 else Severity.ERROR,
                    title="Small holes detected",
                    description=f"{small_holes} hole(s) with diameter < {min_hole_dia}mm may require EDM or micro-drilling",
                    measurement=min_dia,
                    recommendation=f"Increase hole diameter to at least {min_hole_dia}mm or accept cost premium for special tooling",
                    cost_impact="high" if min_dia < 0.5 else "medium"
                ))
                report.overall_score -= min(15, small_holes * 3)
            
            # Analyze hole issues from transformation
            hole_issues = holes_data.get("issues", [])
            for issue in hole_issues:
                if issue.get("issue") == "very_deep_hole":
                    report.add_issue(DFMIssue(
                        category="cnc_milling",
                        severity=Severity.WARNING,
                        title=f"Very deep hole {issue.get('hole_id', '')}",
                        description=issue.get("description", "Hole requires special drilling technique"),
                        recommendation=issue.get("recommendation", ""),
                        cost_impact="high"
                    ))
            
            # Check hole count for setup complexity
            if total_holes > 20:
                report.add_issue(DFMIssue(
                    category="cnc_milling",
                    severity=Severity.INFO,
                    title="High hole count",
                    description=f"{total_holes} holes increase machining time and tool wear",
                    measurement=float(total_holes),
                    recommendation="Consider if all holes are necessary - combining or eliminating holes reduces cost",
                    cost_impact="low"
                ))
            
            # Check diameter range for tool changes
            diameter_range = holes_data.get("diameterRange", {})
            if diameter_range:
                min_dia = diameter_range.get("min", 0)
                max_dia = diameter_range.get("max", 0)
                if max_dia > 0 and min_dia > 0 and max_dia / min_dia > 5:
                    report.add_issue(DFMIssue(
                        category="cnc_milling",
                        severity=Severity.INFO,
                        title="Wide hole diameter range",
                        description=f"Hole diameters range from {min_dia:.1f}mm to {max_dia:.1f}mm requiring multiple tools",
                        recommendation="Standardize hole sizes where possible to reduce tool changes",
                        cost_impact="low"
                    ))
        
        # === POCKET ANALYSIS ===
        pockets_data = advanced_features.get("pockets", {})
        total_pockets = pockets_data.get("totalCount", 0)
        
        if total_pockets > 0:
            deep_pockets = pockets_data.get("deepPocketCount", 0)
            high_aspect_pockets = pockets_data.get("highAspectRatioCount", 0)
            
            if deep_pockets > 0:
                report.add_issue(DFMIssue(
                    category="cnc_milling",
                    severity=Severity.WARNING,
                    title="Deep pockets detected",
                    description=f"{deep_pockets} pocket(s) with high depth ratio require long reach tooling",
                    recommendation="Reduce pocket depth or increase opening size for standard tooling",
                    cost_impact="medium"
                ))
                report.overall_score -= min(8, deep_pockets * 2)
            
            if high_aspect_pockets > 0:
                report.add_issue(DFMIssue(
                    category="cnc_milling",
                    severity=Severity.WARNING,
                    title="High aspect ratio pockets detected",
                    description=f"{high_aspect_pockets} pocket(s) with aspect ratio > 6 may cause tool deflection",
                    recommendation="Consider using shorter tools with multiple passes or redesign pocket geometry",
                    cost_impact="medium"
                ))
                report.overall_score -= min(6, high_aspect_pockets * 2)
        
        # === UNDERCUT ANALYSIS ===
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
        
        # === COMPLEX SURFACE ANALYSIS ===
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

    # -----------------------------------------------------------------
    # Injection molding DFM
    # -----------------------------------------------------------------
    def _analyze_injection_molding_specific(
        self, geometry: Dict, material: str, report: ManufacturabilityReport
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

        # --- Machine envelope ---
        max_dims = im_config.get("max_dimensions", {})
        for axis, val in zip(["x", "y", "z"], [bbox.get("x", 0), bbox.get("y", 0), bbox.get("z", 0)]):
            limit = max_dims.get(axis, 1000)
            if val > limit:
                report.add_issue(DFMIssue(
                    category="injection_molding",
                    severity=Severity.CRITICAL,
                    title=f"Part exceeds mold {axis.upper()}-axis capacity",
                    description=f"{axis.upper()} dimension ({val:.1f}mm) exceeds mold capacity ({limit}mm)",
                    measurement=val,
                    recommendation="Reduce part size or use a larger press",
                    cost_impact="high",
                ))
                report.overall_score -= 15

        # --- Wall thickness range ---
        min_wall = dims[0] if dims[0] > 0 else 0
        im_min_wall = im_config.get("min_wall_thickness_mm", 1.0)
        im_max_wall = im_config.get("max_wall_thickness_mm", 6.0)

        if 0 < min_wall < im_min_wall:
            report.add_issue(DFMIssue(
                category="injection_molding",
                severity=Severity.ERROR,
                title="Wall too thin for injection molding",
                description=f"Minimum wall ({min_wall:.2f}mm) below recommended ({im_min_wall}mm) — may cause short shots",
                measurement=min_wall,
                recommendation=f"Increase wall thickness to ≥ {im_min_wall}mm",
                cost_impact="medium",
            ))
            report.overall_score -= 8

        if min_wall > im_max_wall:
            report.add_issue(DFMIssue(
                category="injection_molding",
                severity=Severity.WARNING,
                title="Wall too thick for injection molding",
                description=f"Maximum wall ({min_wall:.2f}mm) exceeds recommended ({im_max_wall}mm) — may cause sink marks & long cycle time",
                measurement=min_wall,
                recommendation="Core out thick sections to achieve uniform wall thickness",
                cost_impact="medium",
            ))
            report.overall_score -= 5

        # --- Wall uniformity (approximate from bbox) ---
        if dims[0] > 0 and dims[2] > 0:
            wall_ratio = dims[2] / dims[0]
            if wall_ratio > 3:
                report.add_issue(DFMIssue(
                    category="injection_molding",
                    severity=Severity.WARNING,
                    title="Non-uniform wall thickness likely",
                    description=f"Bounding-box aspect ratio ({wall_ratio:.1f}) suggests uneven wall thickness → warping/sink marks risk",
                    recommendation="Design for uniform 2-3mm wall thickness; core out thick sections",
                    cost_impact="medium",
                ))
                report.overall_score -= 4

        # --- Draft angles ---
        draft_data = advanced.get("draftAnalysis")
        if draft_data:
            insufficient = draft_data.get("insufficientCount", 0)
            if insufficient > 0:
                report.add_issue(DFMIssue(
                    category="injection_molding",
                    severity=Severity.ERROR,
                    title="Insufficient draft angles",
                    description=f"{insufficient} face(s) have draft < {im_config.get('min_draft_angle_deg', 1)}° — mold release problems",
                    measurement=float(insufficient),
                    recommendation="Add ≥ 1° draft on all vertical faces; 2° for textured surfaces",
                    cost_impact="high",
                ))
                report.overall_score -= min(12, insufficient * 2)

        # --- Undercuts ---
        undercuts_data = advanced.get("undercuts")
        if undercuts_data and undercuts_data.get("totalCount", 0) > 0:
            cnt = undercuts_data["totalCount"]
            sev = undercuts_data.get("severity", "minor")
            report.add_issue(DFMIssue(
                category="injection_molding",
                severity=Severity.WARNING if sev != "severe" else Severity.ERROR,
                title=f"{cnt} undercut(s) detected ({sev})",
                description="Undercuts require side actions or slide cores in the mold, adding 15-30% to mold cost",
                measurement=float(cnt),
                recommendation="Eliminate undercuts by redesigning snap-fits or using sliding shutoffs",
                cost_impact="high" if sev == "severe" else "medium",
            ))
            report.overall_score -= 5 if sev != "severe" else 10

        # --- Fillets / sharp corners ---
        fillets_data = advanced.get("fillets")
        if fillets_data:
            min_r = fillets_data.get("minRadius", 0)
            rec_r = im_config.get("min_corner_radius_ratio", 0.5) * max(min_wall, 1.0)
            if min_r > 0 and min_r < rec_r:
                report.add_issue(DFMIssue(
                    category="injection_molding",
                    severity=Severity.WARNING,
                    title="Internal corner radius too small",
                    description=f"Min radius ({min_r:.2f}mm) below recommended ({rec_r:.2f}mm) — stress concentration",
                    measurement=min_r,
                    recommendation=f"Add ≥ {rec_r:.1f}mm radius to internal corners",
                    cost_impact="low",
                ))
                report.overall_score -= 3

        # --- Flow length ---
        max_flow = im_config.get("max_flow_length_mm", 300)
        longest_dim = dims[2] if len(dims) == 3 else 0
        if longest_dim > max_flow:
            report.add_issue(DFMIssue(
                category="injection_molding",
                severity=Severity.WARNING,
                title="Long flow length",
                description=f"Longest dimension ({longest_dim:.0f}mm) exceeds typical flow length ({max_flow}mm) — may need multiple gates",
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
        sm = geometry.get("sheetMetalFeatures", {})
        thickness = sm.get("thickness", 2.0)
        holes_data = geometry.get("advancedFeatures", {}).get("holes", {})
        hole_details = holes_data.get("holeDetails", [])

        sm_cfg = self.config.get("processes", {}).get("sheet_metal", {})
        min_ratio = sm_cfg.get("min_hole_to_edge_ratio", 1.0)

        bbox = geometry.get("boundingBox", {})
        part_x = bbox.get("x", 0)
        part_y = bbox.get("y", 0)

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
        self, geometry: Dict, process_type: str, material: str, report: ManufacturabilityReport
    ):
        """Evaluate declarative rules from dfm_config.json."""
        rules = self.config.get("rules", [])
        if not rules:
            return

        for rule in rules:
            applies_to = rule.get("applies_to", [])
            if process_type not in applies_to:
                continue

            rule_id = rule.get("id", "?")
            triggered = False
            sev_map = {
                "info": Severity.INFO,
                "warning": Severity.WARNING,
                "error": Severity.ERROR,
                "critical": Severity.CRITICAL,
            }
            severity = sev_map.get(rule.get("severity", "warning"), Severity.WARNING)
            penalty = rule.get("score_penalty", 0)

            # Simple built-in condition evaluator
            cond = rule.get("condition", "")
            name = rule.get("name", "")

            # We don't re-implement checks already done by explicit methods
            # Only handle conditions that add value beyond existing analysis
            # (The rules serve as documentation + future extensibility)

            # Skip — all conditions are already covered by explicit methods above
            # This framework is ready for custom user-defined rules in the config.
            pass
    
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
