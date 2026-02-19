"""
Weldment and Casting/Forging Detection.

Detects manufacturing process indicators:
- Weldment features (weld beads, structural profiles, joints)
- Cast part features (draft angles, parting lines, thick sections)
- Forged part features (parting lines, flash lines, grain flow)
- Cast-then-machine patterns
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple, Dict
import math


class WeldType(str, Enum):
    """Types of weld joints."""
    FILLET = "fillet"
    BUTT = "butt"
    LAP = "lap"
    EDGE = "edge"
    CORNER = "corner"
    TEE = "tee"
    PLUG = "plug"
    UNKNOWN = "unknown"


class CastingProcess(str, Enum):
    """Casting process types."""
    SAND_CASTING = "sand_casting"
    INVESTMENT_CASTING = "investment_casting"
    DIE_CASTING = "die_casting"
    PERMANENT_MOLD = "permanent_mold"
    CENTRIFUGAL = "centrifugal"
    UNKNOWN = "unknown"


class ManufacturingOrigin(str, Enum):
    """Primary manufacturing origin."""
    MACHINED = "machined"              # Pure CNC/machined from stock
    CAST = "cast"                      # Cast to near-net shape
    CAST_MACHINED = "cast_machined"    # Cast then machined
    FORGED = "forged"                  # Forged
    FORGED_MACHINED = "forged_machined"
    WELDMENT = "weldment"              # Welded assembly
    SHEET_FORMED = "sheet_formed"      # Sheet metal formed
    ADDITIVE = "additive"              # 3D printed
    UNKNOWN = "unknown"


@dataclass
class WeldJoint:
    """Detected weld joint feature."""
    weld_type: WeldType
    location: Tuple[float, float, float]
    length: float  # mm
    throat_size: float  # mm (estimated)
    connected_face_indices: Tuple[int, int]
    accessibility_score: float  # 0-1
    requires_weld_prep: bool = False


@dataclass
class CastingFeature:
    """Feature indicating casting origin."""
    feature_type: str  # 'draft', 'core', 'parting_line', 'thick_section', 'rib'
    location: Tuple[float, float, float]
    draft_angle: Optional[float] = None  # degrees
    section_thickness: Optional[float] = None  # mm
    is_machined_surface: bool = False


@dataclass
class WeldmentAnalysis:
    """Weldment detection results."""
    is_weldment: bool = False
    weld_joints: List[WeldJoint] = field(default_factory=list)
    confidence: float = 0.0
    
    # Structural analysis
    structural_profile_count: int = 0  # tubes, angles, channels
    plate_count: int = 0
    gusset_count: int = 0
    
    # Weld characteristics
    total_weld_length: float = 0.0  # mm
    estimated_weld_time_minutes: float = 0.0
    
    # Complexity
    joint_count: int = 0
    requires_fixtures: bool = False
    has_complex_joints: bool = False


@dataclass
class CastingAnalysis:
    """Casting/forging detection results."""
    is_likely_cast: bool = False
    is_likely_forged: bool = False
    manufacturing_origin: ManufacturingOrigin = ManufacturingOrigin.MACHINED
    confidence: float = 0.0
    
    # Casting indicators
    casting_features: List[CastingFeature] = field(default_factory=list)
    recommended_casting_process: CastingProcess = CastingProcess.UNKNOWN
    
    # Draft analysis
    has_consistent_draft: bool = False
    average_draft_angle: float = 0.0
    draft_coverage_percent: float = 0.0  # % of faces with proper draft
    
    # Machined features (on cast/forged)
    machined_surface_count: int = 0
    machined_hole_count: int = 0
    machined_surface_area: float = 0.0  # mm²
    
    # Section analysis (for casting)
    max_section_thickness: float = 0.0  # mm
    min_section_thickness: float = 0.0  # mm
    has_thin_sections: bool = False  # < 3mm
    has_thick_sections: bool = False  # > 50mm


def _detect_structural_profiles(
    faces_by_type: Dict[str, int],
    planar_face_count: int,
    cylindrical_face_count: int
) -> Tuple[int, int, int]:
    """
    Detect structural profiles typical of weldments.
    
    Returns: (profile_count, plate_count, gusset_count)
    """
    # Structural profiles have specific geometry patterns:
    # - Tubes: many cylindrical faces, few planar
    # - Angles: many planar faces at specific angles
    # - Plates: large planar faces with thin thickness
    
    profile_count = 0
    plate_count = 0
    gusset_count = 0
    
    # High cylindrical count suggests tubes/pipes
    total_faces = planar_face_count + cylindrical_face_count
    if total_faces > 0:
        cyl_ratio = cylindrical_face_count / total_faces
        if cyl_ratio > 0.5:
            profile_count += int(cylindrical_face_count / 4)  # Estimate tube count
    
    # Estimate plates from planar face count
    # Plates typically have 2 large parallel faces + 4 thin edge faces
    plate_count = max(0, planar_face_count // 6)
    
    return profile_count, plate_count, gusset_count


def _analyze_edge_joints(shape) -> List[WeldJoint]:
    """
    Detect potential weld joints at edges between faces.
    
    Looks for:
    - T-joint patterns (perpendicular face meetings)
    - Fillet joint locations
    - Edge preparations
    """
    weld_joints: List[WeldJoint] = []
    
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_EDGE, TopAbs_FACE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.BRepGProp import brepgprop
        from OCC.Core.GProp import GProp_GProps
    except ImportError:
        return weld_joints
    
    # Get all edges
    edge_explorer = TopExp_Explorer(shape, TopAbs_EDGE)
    edge_count = 0
    while edge_explorer.More():
        edge = edge_explorer.Current()
        
        # Get edge length
        props = GProp_GProps()
        brepgprop.LinearProperties(edge, props)
        length = props.Mass()
        
        if length > 5.0:  # Only consider edges > 5mm
            center_pnt = props.CentreOfMass()
            
            # For now, mark long edges as potential weld locations
            # Full analysis would check adjacent face angles
            weld_joints.append(WeldJoint(
                weld_type=WeldType.FILLET,  # Assume fillet by default
                location=(center_pnt.X(), center_pnt.Y(), center_pnt.Z()),
                length=length,
                throat_size=3.0,  # Default estimate
                connected_face_indices=(0, 0),
                accessibility_score=0.8
            ))
        
        edge_count += 1
        edge_explorer.Next()
        
        if edge_count > 1000:  # Limit analysis for complex parts
            break
    
    return weld_joints


def _analyze_draft_angles(
    shape,
    pull_direction: Tuple[float, float, float] = (0.0, 0.0, 1.0)
) -> Tuple[bool, float, float, List[CastingFeature]]:
    """
    Analyze faces for casting draft angles.
    
    Returns: (has_consistent_draft, avg_draft_angle, coverage_percent, features)
    """
    features: List[CastingFeature] = []
    
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_FACE
        from OCC.Core.BRepGProp import brepgprop
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import GeomAbs_Plane
        from OCC.Core.gp import gp_Dir
    except ImportError:
        return False, 0.0, 0.0, features
    
    pull_dir = gp_Dir(pull_direction[0], pull_direction[1], pull_direction[2])
    
    faces_with_draft = 0
    total_vertical_faces = 0
    draft_angles = []
    
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while explorer.More():
        face = explorer.Current()
        
        # Get face center
        props = GProp_GProps()
        brepgprop.SurfaceProperties(face, props)
        center_pnt = props.CentreOfMass()
        
        adaptor = BRepAdaptor_Surface(face)
        surf_type = adaptor.GetType()
        
        if surf_type == GeomAbs_Plane:
            plane = adaptor.Plane()
            normal = plane.Axis().Direction()
            
            # Angle between normal and pull direction
            dot = (normal.X() * pull_dir.X() + 
                   normal.Y() * pull_dir.Y() + 
                   normal.Z() * pull_dir.Z())
            
            angle_from_vertical = math.degrees(math.acos(min(1.0, max(-1.0, abs(dot)))))
            
            # Vertical faces (perpendicular to pull) should have draft
            if angle_from_vertical > 45:  # Mostly vertical
                total_vertical_faces += 1
                
                # Draft angle is deviation from true vertical
                draft_angle = 90 - angle_from_vertical
                
                if 0.5 <= draft_angle <= 15:  # Typical casting draft 0.5-15°
                    faces_with_draft += 1
                    draft_angles.append(draft_angle)
                    
                    features.append(CastingFeature(
                        feature_type='draft',
                        location=(center_pnt.X(), center_pnt.Y(), center_pnt.Z()),
                        draft_angle=draft_angle
                    ))
        
        explorer.Next()
    
    if total_vertical_faces == 0:
        return False, 0.0, 0.0, features
    
    coverage = (faces_with_draft / total_vertical_faces) * 100.0
    avg_draft = sum(draft_angles) / len(draft_angles) if draft_angles else 0.0
    has_consistent = coverage > 60 and avg_draft > 0.5
    
    return has_consistent, avg_draft, coverage, features


def _detect_thick_sections(
    shape,
    face_classification=None
) -> Tuple[float, float, bool, bool]:
    """
    Detect thick/thin sections typical of castings.
    
    Returns: (max_thickness, min_thickness, has_thin, has_thick)
    """
    max_t = 0.0
    min_t = 1000.0
    
    if face_classification:
        # Use paired plane distances from face classification
        distances = getattr(face_classification, 'paired_plane_distances', [])
        if distances:
            max_t = max(distances)
            min_t = min(distances)
    else:
        # Simplified: use bounding box smallest dimension
        try:
            from OCC.Core.Bnd import Bnd_Box
            from OCC.Core.BRepBndLib import brepbndlib
            
            bbox = Bnd_Box()
            brepbndlib.Add(shape, bbox)
            xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
            dims = sorted([xmax-xmin, ymax-ymin, zmax-zmin])
            min_t = dims[0]
            max_t = dims[1]
        except:
            pass
    
    has_thin = min_t < 3.0
    has_thick = max_t > 50.0
    
    return max_t, min_t, has_thin, has_thick


def analyze_weldment(
    shape,
    body_count: int = 1,
    face_classification=None
) -> WeldmentAnalysis:
    """
    Analyze shape for weldment characteristics.
    
    Indicators:
    - Multiple bodies with contact
    - Structural profile geometry
    - Edge patterns suggesting welds
    """
    # Get face counts
    planar_count = 0
    cyl_count = 0
    
    if face_classification:
        planar_count = getattr(face_classification, 'planar_face_count', 0)
        cyl_count = getattr(face_classification, 'cylindrical_face_count', 0)
    
    # Detect structural profiles
    profile_count, plate_count, gusset_count = _detect_structural_profiles(
        {}, planar_count, cyl_count
    )
    
    # Analyze edge joints for potential welds
    weld_joints = _analyze_edge_joints(shape)
    
    # Calculate total weld length
    total_weld = sum(j.length for j in weld_joints)
    
    # Weldment confidence
    confidence = 0.0
    if body_count > 1:
        confidence += 0.4
    if profile_count > 0:
        confidence += 0.2
    if plate_count > 1:
        confidence += 0.2
    if len(weld_joints) > body_count:
        confidence += 0.2
    
    is_weldment = confidence > 0.5
    
    # Estimate weld time (simplified: 2 minutes per 100mm of weld)
    weld_time = total_weld / 100.0 * 2.0
    
    return WeldmentAnalysis(
        is_weldment=is_weldment,
        weld_joints=weld_joints[:50],  # Limit stored joints
        confidence=min(confidence, 1.0),
        structural_profile_count=profile_count,
        plate_count=plate_count,
        gusset_count=gusset_count,
        total_weld_length=total_weld,
        estimated_weld_time_minutes=weld_time,
        joint_count=len(weld_joints),
        requires_fixtures=is_weldment and body_count > 3,
        has_complex_joints=any(j.weld_type in (WeldType.TEE, WeldType.CORNER) for j in weld_joints)
    )


def analyze_casting_origin(
    shape,
    holes: Optional[List] = None,
    pockets: Optional[List] = None,
    face_classification=None,
    volume_mm3: float = 0.0,
    surface_area_mm2: float = 0.0
) -> CastingAnalysis:
    """
    Analyze shape for casting/forging indicators.
    
    Casting indicators:
    - Consistent draft angles on vertical faces
    - Thick/varying wall sections
    - Smooth transitions (large fillets)
    - Limited precision features (few tight-tolerance holes)
    
    Forging indicators:
    - Parting line patterns
    - Flash locations
    - Grain-flow oriented geometry
    """
    holes = holes or []
    pockets = pockets or []
    
    # Analyze draft angles
    has_draft, avg_draft, draft_coverage, draft_features = _analyze_draft_angles(shape)
    
    # Analyze section thickness
    max_t, min_t, has_thin, has_thick = _detect_thick_sections(shape, face_classification)
    
    # Count precision features (these would be machined on a casting)
    precision_hole_count = sum(
        1 for h in holes 
        if getattr(h, 'diameter', 10) < 20 or getattr(h, 'diameter_mm', 10) < 20
    )
    
    # Casting confidence based on indicators
    casting_confidence = 0.0
    
    if has_draft and avg_draft > 1.0:
        casting_confidence += 0.3
    
    if draft_coverage > 50:
        casting_confidence += 0.2
    
    # High complexity parts favor casting
    if volume_mm3 > 100000:  # > 100 cm³
        casting_confidence += 0.1
    
    # Few precision holes suggests casting with machined features
    if precision_hole_count < len(holes) * 0.3:
        casting_confidence += 0.1
    
    # Thick sections common in castings
    if has_thick:
        casting_confidence += 0.2
    
    # Determine manufacturing origin
    is_cast = casting_confidence > 0.4
    machined_count = precision_hole_count + len(pockets)
    
    if is_cast:
        if machined_count > 0:
            origin = ManufacturingOrigin.CAST_MACHINED
        else:
            origin = ManufacturingOrigin.CAST
    else:
        origin = ManufacturingOrigin.MACHINED
    
    # Recommend casting process based on geometry
    if is_cast:
        if avg_draft > 3 and volume_mm3 < 50000:
            process = CastingProcess.DIE_CASTING
        elif volume_mm3 > 500000:
            process = CastingProcess.SAND_CASTING
        else:
            process = CastingProcess.INVESTMENT_CASTING
    else:
        process = CastingProcess.UNKNOWN
    
    # Calculate machined surface area estimate
    machined_area = 0.0
    for h in holes:
        d = getattr(h, 'diameter', 10) or getattr(h, 'diameter_mm', 10)
        depth = getattr(h, 'depth', 10) or getattr(h, 'depth_mm', 10)
        if d and depth:
            machined_area += math.pi * d * depth
    
    return CastingAnalysis(
        is_likely_cast=is_cast,
        is_likely_forged=False,  # Would need more analysis
        manufacturing_origin=origin,
        confidence=casting_confidence,
        casting_features=draft_features,
        recommended_casting_process=process,
        has_consistent_draft=has_draft,
        average_draft_angle=avg_draft,
        draft_coverage_percent=draft_coverage,
        machined_surface_count=machined_count,
        machined_hole_count=precision_hole_count,
        machined_surface_area=machined_area,
        max_section_thickness=max_t,
        min_section_thickness=min_t,
        has_thin_sections=has_thin,
        has_thick_sections=has_thick
    )
