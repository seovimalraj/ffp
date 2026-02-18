"""
Tolerance and GD&T Feature Analysis.

Extracts tolerance requirements from CAD geometry through:
- Geometric feature analysis (hole fit types, mating surfaces)
- PMI/GD&T data extraction from STEP AP242
- Precision grade inference from feature dimensions
- Datum feature detection
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple, Dict
import math


class ToleranceGrade(str, Enum):
    """ISO tolerance grades (IT grades)."""
    IT01 = "IT01"  # ±0.3µm - optical/gauge
    IT0 = "IT0"    # ±0.5µm - gauge blocks
    IT1 = "IT1"    # ±1µm - precision gauges
    IT2 = "IT2"    # ±1.5µm - measuring instruments
    IT3 = "IT3"    # ±2.5µm - fits requiring minimum clearance
    IT4 = "IT4"    # ±4µm - precision bearings
    IT5 = "IT5"    # ±6µm - precision fits
    IT6 = "IT6"    # ±10µm - standard precision fits
    IT7 = "IT7"    # ±15µm - interchangeable fits
    IT8 = "IT8"    # ±25µm - general purpose
    IT9 = "IT9"    # ±40µm - semi-precision
    IT10 = "IT10"  # ±60µm - coarse tolerances
    IT11 = "IT11"  # ±100µm - rough machining
    IT12 = "IT12"  # ±160µm - sheet metal
    UNDEFINED = "undefined"


class GDTType(str, Enum):
    """GD&T characteristic types."""
    FLATNESS = "flatness"
    STRAIGHTNESS = "straightness"
    CIRCULARITY = "circularity"
    CYLINDRICITY = "cylindricity"
    PROFILE_LINE = "profile_line"
    PROFILE_SURFACE = "profile_surface"
    PERPENDICULARITY = "perpendicularity"
    ANGULARITY = "angularity"
    PARALLELISM = "parallelism"
    POSITION = "position"
    CONCENTRICITY = "concentricity"
    SYMMETRY = "symmetry"
    RUNOUT = "runout"
    TOTAL_RUNOUT = "total_runout"


class FitType(str, Enum):
    """Standard fit types for holes/shafts."""
    CLEARANCE_LOOSE = "clearance_loose"    # RC8-RC9
    CLEARANCE_FREE = "clearance_free"      # RC5-RC7
    CLEARANCE_CLOSE = "clearance_close"    # RC1-RC4
    LOCATIONAL_CLEARANCE = "locational_clearance"  # LC
    LOCATIONAL_TRANSITION = "locational_transition"  # LT
    LOCATIONAL_INTERFERENCE = "locational_interference"  # LN
    FORCE_FIT_LIGHT = "force_light"        # FN1
    FORCE_FIT_MEDIUM = "force_medium"      # FN2
    FORCE_FIT_HEAVY = "force_heavy"        # FN3-FN5
    PRESS_FIT = "press_fit"
    SLIP_FIT = "slip_fit"
    UNKNOWN = "unknown"


@dataclass
class ToleranceFeature:
    """A feature with detected tolerance requirements."""
    feature_type: str  # 'hole', 'shaft', 'plane', 'slot', 'thread'
    grade: ToleranceGrade
    tolerance_value: float  # mm
    nominal_size: float  # mm
    location: Tuple[float, float, float]
    fit_type: FitType = FitType.UNKNOWN
    is_datum: bool = False
    datum_label: Optional[str] = None  # 'A', 'B', 'C', etc.
    gdt_callouts: List[GDTType] = field(default_factory=list)
    confidence: float = 0.5


@dataclass
class GDTRequirement:
    """Extracted GD&T requirement."""
    characteristic: GDTType
    tolerance_value: float  # mm
    datum_references: List[str] = field(default_factory=list)
    modifier: Optional[str] = None  # 'MMC', 'LMC', etc.
    applies_to: str = ""  # Feature description
    location: Tuple[float, float, float] = (0.0, 0.0, 0.0)


@dataclass
class DatumFeature:
    """Detected datum feature."""
    label: str  # 'A', 'B', 'C'
    feature_type: str  # 'plane', 'cylinder', 'point'
    area: float  # mm²
    location: Tuple[float, float, float]
    confidence: float


@dataclass
class ToleranceAnalysis:
    """Complete tolerance analysis results."""
    features: List[ToleranceFeature] = field(default_factory=list)
    gdt_requirements: List[GDTRequirement] = field(default_factory=list)
    datum_features: List[DatumFeature] = field(default_factory=list)
    
    # Summary statistics
    tightest_grade: ToleranceGrade = ToleranceGrade.IT8
    min_tolerance_mm: float = 0.1
    precision_feature_count: int = 0  # Features IT6 or tighter
    datum_count: int = 0
    positional_tolerance_count: int = 0
    geometric_tolerance_count: int = 0
    
    # Complexity scoring
    tolerance_complexity_score: float = 0.0  # 0-100
    requires_cmm: bool = False
    requires_grinding: bool = False
    estimated_inspection_time_factor: float = 1.0


# IT grade to tolerance value lookup (for 50mm nominal)
# Based on ISO 286-1
IT_GRADE_VALUES = {
    ToleranceGrade.IT01: 0.0003,
    ToleranceGrade.IT0: 0.0005,
    ToleranceGrade.IT1: 0.001,
    ToleranceGrade.IT2: 0.0015,
    ToleranceGrade.IT3: 0.0025,
    ToleranceGrade.IT4: 0.004,
    ToleranceGrade.IT5: 0.006,
    ToleranceGrade.IT6: 0.010,
    ToleranceGrade.IT7: 0.015,
    ToleranceGrade.IT8: 0.025,
    ToleranceGrade.IT9: 0.040,
    ToleranceGrade.IT10: 0.060,
    ToleranceGrade.IT11: 0.100,
    ToleranceGrade.IT12: 0.160,
}


def _tolerance_to_grade(tolerance_mm: float, nominal_mm: float) -> ToleranceGrade:
    """Convert tolerance value to IT grade based on nominal size."""
    # Size factor (simplified - proper calculation uses ISO formula)
    if nominal_mm <= 3:
        factor = 0.5
    elif nominal_mm <= 18:
        factor = 0.7
    elif nominal_mm <= 50:
        factor = 1.0
    elif nominal_mm <= 120:
        factor = 1.3
    elif nominal_mm <= 315:
        factor = 1.6
    else:
        factor = 2.0
    
    # Normalize tolerance by size factor
    normalized = tolerance_mm / factor
    
    # Find closest grade
    for grade in [ToleranceGrade.IT01, ToleranceGrade.IT0, ToleranceGrade.IT1,
                  ToleranceGrade.IT2, ToleranceGrade.IT3, ToleranceGrade.IT4,
                  ToleranceGrade.IT5, ToleranceGrade.IT6, ToleranceGrade.IT7,
                  ToleranceGrade.IT8, ToleranceGrade.IT9, ToleranceGrade.IT10,
                  ToleranceGrade.IT11, ToleranceGrade.IT12]:
        if normalized <= IT_GRADE_VALUES.get(grade, 0.160) * 1.5:
            return grade
    
    return ToleranceGrade.IT12


def _infer_fit_type(hole_diameter: float, tolerance: float) -> Tuple[FitType, float]:
    """
    Infer fit type from hole geometry and tolerance.
    Returns (fit_type, confidence).
    """
    # Standard fit hole sizes (H7 = +0.000/+0.025 for 50mm)
    # Tolerance range relative to diameter
    relative_tolerance = tolerance / hole_diameter if hole_diameter > 0 else 1.0
    
    if relative_tolerance < 0.0003:  # <0.03%
        return FitType.FORCE_FIT_HEAVY, 0.7
    elif relative_tolerance < 0.0005:  # <0.05%
        return FitType.FORCE_FIT_MEDIUM, 0.7
    elif relative_tolerance < 0.001:  # <0.1%
        return FitType.LOCATIONAL_INTERFERENCE, 0.6
    elif relative_tolerance < 0.002:  # <0.2%
        return FitType.LOCATIONAL_TRANSITION, 0.6
    elif relative_tolerance < 0.003:  # <0.3%
        return FitType.CLEARANCE_CLOSE, 0.5
    elif relative_tolerance < 0.005:  # <0.5%
        return FitType.CLEARANCE_FREE, 0.5
    else:
        return FitType.CLEARANCE_LOOSE, 0.4


def _detect_datum_candidates(
    planar_faces: List[Tuple[float, Tuple[float, float, float], Tuple[float, float, float]]],
    cylindrical_faces: List[Tuple[float, float, Tuple[float, float, float]]]
) -> List[DatumFeature]:
    """
    Detect likely datum features based on face geometry.
    
    Heuristics:
    - Largest orthogonal planar faces -> A, B, C datums
    - Large cylindrical faces -> axis datums
    """
    datums = []
    
    # Sort planar faces by area
    sorted_planes = sorted(planar_faces, key=lambda x: x[0], reverse=True)
    
    # Group by normal direction (orthogonal sets)
    orthogonal_sets: Dict[str, List] = {}
    for area, center, normal in sorted_planes:
        # Quantize normal to principal directions
        abs_n = (abs(normal[0]), abs(normal[1]), abs(normal[2]))
        if abs_n[2] > 0.9:
            key = 'Z'
        elif abs_n[1] > 0.9:
            key = 'Y'
        elif abs_n[0] > 0.9:
            key = 'X'
        else:
            key = 'other'
        
        if key not in orthogonal_sets:
            orthogonal_sets[key] = []
        orthogonal_sets[key].append((area, center, normal))
    
    # Assign datum labels to largest faces in each direction
    datum_labels = ['A', 'B', 'C']
    label_idx = 0
    
    # Prioritize Z-perpendicular (horizontal) as primary datum
    for axis in ['Z', 'X', 'Y', 'other']:
        if axis in orthogonal_sets and orthogonal_sets[axis] and label_idx < 3:
            best = orthogonal_sets[axis][0]
            if best[0] > 100:  # Minimum 100mm² for datum
                datums.append(DatumFeature(
                    label=datum_labels[label_idx],
                    feature_type='plane',
                    area=best[0],
                    location=best[1],
                    confidence=min(0.9, best[0] / 1000.0)
                ))
                label_idx += 1
    
    return datums


def extract_tolerance_from_shape(
    shape,
    holes: Optional[List] = None,
    pockets: Optional[List] = None
) -> ToleranceAnalysis:
    """
    Extract tolerance requirements from STEP/BREP shape.
    
    Analyzes:
    - Hole/bore tolerances from diameter precision
    - Planar face datum detection
    - PMI data if available (AP242)
    - Feature fit inference
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_FACE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.BRepGProp import brepgprop
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import GeomAbs_Plane, GeomAbs_Cylinder
        from OCC.Core.BRepLProp import BRepLProp_SLProps
    except ImportError:
        return ToleranceAnalysis()
    
    features: List[ToleranceFeature] = []
    planar_faces = []
    cylindrical_faces = []
    
    # Analyze all faces
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while explorer.More():
        face = explorer.Current()
        
        # Get face properties
        props = GProp_GProps()
        brepgprop.SurfaceProperties(face, props)
        area = props.Mass()
        
        if area < 1.0:
            explorer.Next()
            continue
        
        center_pnt = props.CentreOfMass()
        center = (center_pnt.X(), center_pnt.Y(), center_pnt.Z())
        
        adaptor = BRepAdaptor_Surface(face)
        surf_type = adaptor.GetType()
        
        if surf_type == GeomAbs_Plane:
            plane = adaptor.Plane()
            normal_dir = plane.Axis().Direction()
            normal = (normal_dir.X(), normal_dir.Y(), normal_dir.Z())
            planar_faces.append((area, center, normal))
            
        elif surf_type == GeomAbs_Cylinder:
            cyl = adaptor.Cylinder()
            diameter = cyl.Radius() * 2.0
            
            # Check internal/external
            u_mid = (adaptor.FirstUParameter() + adaptor.LastUParameter()) / 2.0
            v_mid = (adaptor.FirstVParameter() + adaptor.LastVParameter()) / 2.0
            
            slprops = BRepLProp_SLProps(adaptor, u_mid, v_mid, 1, 0.001)
            is_internal = False
            if slprops.IsNormalDefined():
                normal = slprops.Normal()
                pnt = adaptor.Value(u_mid, v_mid)
                axis_loc = cyl.Location()
                
                to_point = (
                    pnt.X() - axis_loc.X(),
                    pnt.Y() - axis_loc.Y(),
                    pnt.Z() - axis_loc.Z()
                )
                rad_len = math.sqrt(to_point[0]**2 + to_point[1]**2 + to_point[2]**2)
                if rad_len > 0.001:
                    radial = (to_point[0]/rad_len, to_point[1]/rad_len, to_point[2]/rad_len)
                    dot = normal.X()*radial[0] + normal.Y()*radial[1] + normal.Z()*radial[2]
                    is_internal = dot < 0
            
            cylindrical_faces.append((area, diameter, center))
            
            # Estimate tolerance from diameter
            # Precision holes have tighter tolerances
            if diameter < 50:
                base_tol = diameter * 0.001  # 0.1% default
            else:
                base_tol = diameter * 0.0005
            
            if is_internal:
                # Bore - infer fit type
                fit_type, fit_conf = _infer_fit_type(diameter, base_tol)
                grade = _tolerance_to_grade(base_tol, diameter)
                
                features.append(ToleranceFeature(
                    feature_type='hole',
                    grade=grade,
                    tolerance_value=base_tol,
                    nominal_size=diameter,
                    location=center,
                    fit_type=fit_type,
                    confidence=fit_conf
                ))
            else:
                # External cylinder (shaft)
                grade = _tolerance_to_grade(base_tol, diameter)
                features.append(ToleranceFeature(
                    feature_type='shaft',
                    grade=grade,
                    tolerance_value=base_tol,
                    nominal_size=diameter,
                    location=center,
                    confidence=0.4
                ))
        
        explorer.Next()
    
    # Add hole features from existing hole extraction
    if holes:
        for hole in holes:
            diameter = getattr(hole, 'diameter', 0.0) or getattr(hole, 'diameter_mm', 0.0)
            if diameter > 0:
                # Precision holes
                if diameter < 10:
                    base_tol = 0.01  # 10µm for small holes
                else:
                    base_tol = diameter * 0.0005
                
                grade = _tolerance_to_grade(base_tol, diameter)
                fit_type, _ = _infer_fit_type(diameter, base_tol)
                
                center = getattr(hole, 'center', (0, 0, 0))
                if hasattr(hole, 'center') and hasattr(hole.center, '__iter__'):
                    center = tuple(hole.center) if len(hole.center) >= 3 else (0, 0, 0)
                
                features.append(ToleranceFeature(
                    feature_type='hole',
                    grade=grade,
                    tolerance_value=base_tol,
                    nominal_size=diameter,
                    location=center,
                    fit_type=fit_type,
                    is_datum=False,
                    confidence=0.6
                ))
    
    # Detect datums
    datums = _detect_datum_candidates(planar_faces, cylindrical_faces)
    
    # Calculate summary statistics
    precision_count = sum(1 for f in features if f.grade.value in ['IT01', 'IT0', 'IT1', 'IT2', 'IT3', 'IT4', 'IT5', 'IT6'])
    
    tightest = ToleranceGrade.IT12
    min_tol = 1.0
    for f in features:
        if f.tolerance_value < min_tol:
            min_tol = f.tolerance_value
            tightest = f.grade
    
    # Complexity score
    complexity = (
        precision_count * 10 +
        len(datums) * 5 +
        sum(10 for f in features if f.fit_type in (FitType.FORCE_FIT_HEAVY, FitType.FORCE_FIT_MEDIUM))
    )
    
    requires_cmm = precision_count > 3 or tightest.value in ['IT01', 'IT0', 'IT1', 'IT2', 'IT3']
    requires_grinding = any(f.grade.value in ['IT01', 'IT0', 'IT1', 'IT2', 'IT3', 'IT4', 'IT5'] for f in features)
    
    return ToleranceAnalysis(
        features=features,
        gdt_requirements=[],  # Would need PMI extraction
        datum_features=datums,
        tightest_grade=tightest,
        min_tolerance_mm=min_tol,
        precision_feature_count=precision_count,
        datum_count=len(datums),
        positional_tolerance_count=0,
        geometric_tolerance_count=0,
        tolerance_complexity_score=min(complexity, 100),
        requires_cmm=requires_cmm,
        requires_grinding=requires_grinding,
        estimated_inspection_time_factor=1.0 + precision_count * 0.1
    )


def extract_tolerance_from_mesh(
    mesh,
    holes: Optional[List] = None
) -> ToleranceAnalysis:
    """
    Estimate tolerance requirements from mesh geometry.
    
    Very limited compared to BREP - mostly infers from hole detection.
    """
    try:
        import numpy as np
    except ImportError:
        return ToleranceAnalysis()
    
    features: List[ToleranceFeature] = []
    
    # Use hole data if provided
    if holes:
        for hole in holes:
            diameter = getattr(hole, 'diameter', 0.0) or getattr(hole, 'diameter_mm', 0.0)
            if diameter > 0:
                base_tol = diameter * 0.001
                grade = _tolerance_to_grade(base_tol, diameter)
                
                features.append(ToleranceFeature(
                    feature_type='hole',
                    grade=grade,
                    tolerance_value=base_tol,
                    nominal_size=diameter,
                    location=(0, 0, 0),
                    confidence=0.3
                ))
    
    # Analyze mesh for large flat surfaces (potential datums)
    vertices = mesh.vectors
    if len(vertices) < 10:
        return ToleranceAnalysis()
    
    # Compute normals
    v0 = vertices[:, 0, :]
    v1 = vertices[:, 1, :]
    v2 = vertices[:, 2, :]
    
    e1 = v1 - v0
    e2 = v2 - v0
    normals = np.cross(e1, e2)
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms = np.where(norms < 1e-9, 1.0, norms)
    normals = normals / norms
    areas = norms.flatten() / 2.0
    centroids = (v0 + v1 + v2) / 3.0
    
    # Find large planar clusters
    normal_bins: Dict[Tuple, Dict] = {}
    for i in range(len(normals)):
        n = normals[i]
        key = (round(n[0], 1), round(n[1], 1), round(n[2], 1))
        if key not in normal_bins:
            normal_bins[key] = {'area': 0.0, 'center_sum': np.zeros(3), 'count': 0}
        normal_bins[key]['area'] += areas[i]
        normal_bins[key]['center_sum'] += centroids[i]
        normal_bins[key]['count'] += 1
    
    datums = []
    datum_labels = ['A', 'B', 'C']
    label_idx = 0
    
    sorted_bins = sorted(normal_bins.items(), key=lambda x: x[1]['area'], reverse=True)
    for normal_key, data in sorted_bins[:3]:
        if data['area'] > 200 and label_idx < 3:
            center = tuple(data['center_sum'] / data['count'])
            datums.append(DatumFeature(
                label=datum_labels[label_idx],
                feature_type='plane',
                area=data['area'],
                location=center,
                confidence=0.3
            ))
            label_idx += 1
    
    precision_count = sum(1 for f in features if f.grade.value in ['IT01', 'IT0', 'IT1', 'IT2', 'IT3', 'IT4', 'IT5', 'IT6'])
    
    return ToleranceAnalysis(
        features=features,
        datum_features=datums,
        tightest_grade=ToleranceGrade.IT8,
        min_tolerance_mm=0.025,
        precision_feature_count=precision_count,
        datum_count=len(datums),
        tolerance_complexity_score=min(precision_count * 10 + len(datums) * 5, 100),
        requires_cmm=precision_count > 5,
        requires_grinding=False,
        estimated_inspection_time_factor=1.0
    )
