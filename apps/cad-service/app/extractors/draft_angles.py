"""Draft angle analysis for injection-molded and die-cast parts.

Analyses face normals relative to a mold pull direction and computes the
draft angle for each face.  Faces with insufficient draft are flagged.

Enhanced with parting line detection and casting feasibility analysis.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

from ..models import DraftAngleInfo

logger = logging.getLogger(__name__)

# Default pull direction is +Z (mold opens along Z axis)
DEFAULT_PULL_DIRECTION = (0.0, 0.0, 1.0)

# Minimum recommended draft angles (degrees) per material family
DRAFT_RECOMMENDATIONS = {
    "default": 1.0,
    "aluminum": 1.5,
    "steel": 1.5,
    "abs": 0.5,
    "polycarbonate": 1.0,
    "nylon": 0.5,
    "polypropylene": 0.5,
    "hdpe": 1.0,
    "plastic": 1.0,
}


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _normalize(v):
    mag = math.sqrt(sum(c * c for c in v))
    if mag < 1e-12:
        return (0.0, 0.0, 1.0)
    return (v[0] / mag, v[1] / mag, v[2] / mag)


def _draft_from_plane(face, pd, brep_tool, geom_plane) -> Optional[float]:
    """Compute draft angle for a planar face."""
    surf = brep_tool.Surface(face)
    pln = geom_plane.DownCast(surf)
    if pln is None:
        return None
    norm_dir = pln.Pln().Axis().Direction()
    n = (norm_dir.X(), norm_dir.Y(), norm_dir.Z())
    cos_a = abs(_dot(n, pd))
    if cos_a > 0.99:
        return 90.0  # top/bottom face — effectively infinite draft
    angle_to_pull = math.degrees(math.acos(min(cos_a, 1.0)))
    return 90.0 - angle_to_pull if angle_to_pull < 90 else angle_to_pull - 90.0


def _draft_from_cylinder(adaptor, pd) -> float:
    """Compute draft angle for a cylindrical face."""
    cyl = adaptor.Cylinder()
    ax = cyl.Axis().Direction()
    axv = (ax.X(), ax.Y(), ax.Z())
    cos_a = abs(_dot(axv, pd))
    if cos_a > 0.99:
        return 0.0  # cylinder axis along pull — no draft on wall
    return math.degrees(math.acos(min(cos_a, 1.0)))


def _draft_from_cone(adaptor) -> float:
    """Compute draft angle for a conical face."""
    cone = adaptor.Cone()
    return abs(math.degrees(cone.SemiAngle()))


def _draft_from_general(adaptor, pd) -> Optional[float]:
    """Sample midpoint normal for BSpline / other surfaces."""
    try:
        u_mid = (adaptor.FirstUParameter() + adaptor.LastUParameter()) / 2
        v_mid = (adaptor.FirstVParameter() + adaptor.LastVParameter()) / 2
        from OCC.Core.BRepLProp import BRepLProp_SLProps
        sl_props = BRepLProp_SLProps(adaptor, u_mid, v_mid, 1, 1e-6)
        if not sl_props.IsNormalDefined():
            return None
        norm = sl_props.Normal()
        n = (norm.X(), norm.Y(), norm.Z())
        cos_a = abs(_dot(n, pd))
        angle_to_pull = math.degrees(math.acos(min(cos_a, 1.0)))
        return 90.0 - angle_to_pull if angle_to_pull < 90 else angle_to_pull - 90.0
    except Exception:
        return None


def analyze_draft_from_shape(
    shape,
    pull_direction: Tuple[float, float, float] = DEFAULT_PULL_DIRECTION,
    min_draft_deg: float = 1.0,
) -> List[DraftAngleInfo]:
    """Analyse draft angles from BREP shape using OCC."""
    try:
        from OCC.Core.TopExp import TopExp_Explorer, topexp
        from OCC.Core.TopAbs import TopAbs_FACE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_Plane
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties
        from OCC.Core.TopTools import TopTools_IndexedMapOfShape
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Cone
    except Exception:
        logger.warning("OCC imports unavailable for draft angle analysis")
        return []

    pd = _normalize(pull_direction)
    results: List[DraftAngleInfo] = []

    face_map = TopTools_IndexedMapOfShape()
    topexp.MapShapes(shape, TopAbs_FACE, face_map)

    type_handlers = {
        GeomAbs_Plane: lambda face, adaptor: _draft_from_plane(face, pd, BRep_Tool, Geom_Plane),
        GeomAbs_Cylinder: lambda face, adaptor: _draft_from_cylinder(adaptor, pd),
        GeomAbs_Cone: lambda face, adaptor: _draft_from_cone(adaptor),
    }

    for i in range(1, face_map.Size() + 1):
        face = face_map.FindKey(i)
        adaptor = BRepAdaptor_Surface(face)
        props = GProp_GProps()
        brepgprop_SurfaceProperties(face, props)
        area_mm2 = float(props.Mass()) * 1e6

        if area_mm2 < 0.5:
            continue

        handler = type_handlers.get(adaptor.GetType())
        draft_deg = handler(face, adaptor) if handler else _draft_from_general(adaptor, pd)

        if draft_deg is not None:
            results.append(DraftAngleInfo(
                face_id=i,
                draft_angle_deg=round(draft_deg, 2),
                is_sufficient=draft_deg >= min_draft_deg,
                area_mm2=round(area_mm2, 2),
            ))

    insufficient = sum(1 for r in results if not r.is_sufficient)
    logger.info(
        f"Draft analysis: {len(results)} faces analysed, {insufficient} with insufficient draft"
    )
    return results


def analyze_draft_from_mesh(
    mesh,
    pull_direction: Tuple[float, float, float] = DEFAULT_PULL_DIRECTION,
    min_draft_deg: float = 1.0,
) -> List[DraftAngleInfo]:
    """Mesh-based draft angle analysis from face normals."""
    try:
        import numpy as np
    except Exception:
        return []

    if mesh is None or not hasattr(mesh, 'face_normals'):
        return []

    pd = np.array(_normalize(pull_direction))
    normals = np.array(mesh.face_normals)
    areas = np.array(mesh.area_faces) if hasattr(mesh, 'area_faces') else np.ones(len(normals))

    # Compute draft angle per triangle
    cos_angles = np.abs(normals @ pd)
    cos_angles = np.clip(cos_angles, 0, 1)
    angle_to_pull = np.degrees(np.arccos(cos_angles))
    draft_angles = np.where(angle_to_pull < 90, 90.0 - angle_to_pull, angle_to_pull - 90.0)

    # Faces perpendicular to pull (top/bottom) need no draft
    is_top_bottom = cos_angles > 0.99
    draft_angles[is_top_bottom] = 90.0

    # Group by draft angle bins
    results: List[DraftAngleInfo] = []
    bins = [(0, 0.5), (0.5, 1), (1, 2), (2, 5), (5, 15), (15, 45), (45, 90)]
    for i, (lo, hi) in enumerate(bins):
        mask = (draft_angles >= lo) & (draft_angles < hi)
        if not np.any(mask):
            continue
        total_area = float(np.sum(areas[mask]))
        avg_draft = float(np.mean(draft_angles[mask]))
        results.append(DraftAngleInfo(
            face_id=i + 1,
            draft_angle_deg=round(avg_draft, 2),
            is_sufficient=avg_draft >= min_draft_deg,
            area_mm2=round(total_area, 2),
        ))

    return results


def get_min_draft_for_material(material: str) -> float:
    """Get recommended minimum draft angle for a material."""
    material_lower = material.lower().strip()
    for key, val in DRAFT_RECOMMENDATIONS.items():
        if key in material_lower:
            return val
    return DRAFT_RECOMMENDATIONS["default"]


# =============================================================================
# Parting Line and Casting Detection
# =============================================================================

@dataclass
class PartingLineInfo:
    """Information about a potential parting line for casting/mold."""
    z_level: float  # Height of parting plane
    perimeter_length: float  # Length of parting line (mm)
    cross_section_area: float  # Cross-section area at parting plane (mm²)
    complexity: float  # 0-100, how complex the parting line is
    is_planar: bool  # True if parting line lies in a plane
    confidence: float


@dataclass
class CastingAnalysis:
    """Complete casting analysis results."""
    is_likely_casting: bool
    casting_type: str  # 'die_casting', 'sand_casting', 'investment', 'injection_mold'
    parting_lines: List[PartingLineInfo]
    optimal_parting_z: Optional[float]
    draft_compliant_faces: int
    draft_insufficient_faces: int
    average_draft: float
    min_draft: float
    max_wall_thickness: Optional[float]
    min_wall_thickness: Optional[float]
    has_undercuts: bool
    undercut_count: int
    ejector_difficulty: str  # 'easy', 'moderate', 'difficult'
    confidence: float


def _find_parting_plane_candidates(
    mesh,
    num_slices: int = 20
) -> List[Dict]:
    """
    Find potential parting plane locations by analyzing cross-sections.
    
    A good parting line:
    - Maximizes projected area in both directions
    - Minimizes undercut regions
    - Has a simple, ideally planar boundary
    """
    try:
        import numpy as np
    except ImportError:
        return []
    
    if not hasattr(mesh, 'bounds'):
        return []
    
    bounds = mesh.bounds
    z_min = bounds[0][2]
    z_max = bounds[1][2]
    
    # Analyze silhouette at multiple Z levels
    candidates = []
    z_levels = np.linspace(z_min + 0.05 * (z_max - z_min),
                          z_max - 0.05 * (z_max - z_min),
                          num_slices)
    
    for z in z_levels:
        try:
            # Count faces above and below
            if hasattr(mesh, 'face_normals') and hasattr(mesh, 'triangles_center'):
                centers = mesh.triangles_center
                above_count = np.sum(centers[:, 2] > z)
                below_count = np.sum(centers[:, 2] < z)
                
                # Balance score - want roughly equal above/below
                total = above_count + below_count
                if total > 0:
                    balance = 1.0 - abs(above_count - below_count) / total
                else:
                    balance = 0.0
                
                candidates.append({
                    'z_level': float(z),
                    'balance_score': balance,
                    'above_faces': above_count,
                    'below_faces': below_count,
                })
        except Exception:
            continue
    
    # Sort by balance score
    candidates.sort(key=lambda c: c['balance_score'], reverse=True)
    
    return candidates[:5]


def _detect_undercuts_for_casting(
    mesh,
    pull_direction: Tuple[float, float, float] = DEFAULT_PULL_DIRECTION
) -> Tuple[int, bool]:
    """
    Detect undercut regions that would prevent mold release.
    
    Undercuts are faces where the normal points against the pull direction
    and below the parting line.
    """
    try:
        import numpy as np
    except ImportError:
        return 0, False
    
    if not hasattr(mesh, 'face_normals'):
        return 0, False
    
    pd = np.array(_normalize(pull_direction))
    normals = mesh.face_normals
    
    # Undercuts: faces where normal has negative component along pull
    # (would trap the part in the mold)
    dots = normals @ pd
    
    # Loose threshold - faces pointing somewhat against pull
    undercut_mask = dots < -0.1
    undercut_count = int(np.sum(undercut_mask))
    
    # Severe undercuts - directly opposing pull
    severe_mask = dots < -0.5
    has_severe = bool(np.any(severe_mask))
    
    return undercut_count, has_severe


def analyze_for_casting(
    mesh,
    draft_results: List[DraftAngleInfo],
    pull_direction: Tuple[float, float, float] = DEFAULT_PULL_DIRECTION,
    detected_thickness: Optional[float] = None,
    min_wall: Optional[float] = None,
    max_wall: Optional[float] = None
) -> CastingAnalysis:
    """
    Comprehensive casting analysis for mold/die feasibility.
    
    Determines:
    - If part is suitable for casting processes
    - Optimal parting line location
    - Draft angle compliance
    - Undercut issues
    - Recommended casting process
    """
    try:
        import numpy as np
    except ImportError:
        return CastingAnalysis(
            is_likely_casting=False,
            casting_type="unknown",
            parting_lines=[],
            optimal_parting_z=None,
            draft_compliant_faces=0,
            draft_insufficient_faces=0,
            average_draft=0.0,
            min_draft=0.0,
            max_wall_thickness=max_wall,
            min_wall_thickness=min_wall,
            has_undercuts=False,
            undercut_count=0,
            ejector_difficulty="unknown",
            confidence=0.0
        )
    
    # Analyze draft compliance
    compliant = sum(1 for d in draft_results if d.is_sufficient)
    insufficient = sum(1 for d in draft_results if not d.is_sufficient)
    
    if draft_results:
        avg_draft = np.mean([d.draft_angle_deg for d in draft_results])
        min_draft = min(d.draft_angle_deg for d in draft_results)
    else:
        avg_draft = 0.0
        min_draft = 0.0
    
    # Find parting plane candidates
    parting_candidates = _find_parting_plane_candidates(mesh)
    
    parting_lines = []
    optimal_z = None
    if parting_candidates:
        optimal_z = parting_candidates[0]['z_level']
        for pc in parting_candidates[:3]:
            parting_lines.append(PartingLineInfo(
                z_level=pc['z_level'],
                perimeter_length=0.0,  # Would need cross-section analysis
                cross_section_area=0.0,
                complexity=50.0 * (1 - pc['balance_score']),
                is_planar=True,
                confidence=pc['balance_score']
            ))
    
    # Detect undercuts
    undercut_count, has_severe_undercuts = _detect_undercuts_for_casting(mesh, pull_direction)
    
    # Determine casting suitability
    # Good draft + minimal undercuts = castable
    draft_ratio = compliant / max(compliant + insufficient, 1)
    
    is_likely_casting = (
        avg_draft >= 0.5 and  # Some draft present
        draft_ratio >= 0.7 and  # Most faces have adequate draft
        not has_severe_undercuts  # No severe undercuts
    )
    
    # Determine casting type based on geometry
    if detected_thickness is not None:
        wall = detected_thickness
    elif min_wall is not None:
        wall = min_wall
    else:
        wall = 5.0  # Default
    
    if wall < 1.5:
        # Very thin - die casting or injection
        casting_type = "die_casting" if avg_draft >= 1.0 else "injection_molding"
    elif wall < 4.0:
        # Medium - can be die cast
        casting_type = "die_casting"
    elif wall < 10.0:
        # Thicker - could be sand or investment
        if undercut_count > 5:
            casting_type = "investment_casting"  # Handles undercuts better
        else:
            casting_type = "sand_casting"
    else:
        # Very thick - sand casting
        casting_type = "sand_casting"
    
    # Ejector difficulty
    if has_severe_undercuts:
        ejector_difficulty = "difficult"
    elif undercut_count > 10:
        ejector_difficulty = "moderate"
    elif insufficient > compliant:
        ejector_difficulty = "moderate"
    else:
        ejector_difficulty = "easy"
    
    # Confidence
    confidence = draft_ratio * 0.5 + (0.3 if parting_lines else 0) + (0.2 if not has_severe_undercuts else 0)
    
    return CastingAnalysis(
        is_likely_casting=is_likely_casting,
        casting_type=casting_type if is_likely_casting else "not_castable",
        parting_lines=parting_lines,
        optimal_parting_z=optimal_z,
        draft_compliant_faces=compliant,
        draft_insufficient_faces=insufficient,
        average_draft=float(avg_draft),
        min_draft=float(min_draft),
        max_wall_thickness=max_wall,
        min_wall_thickness=min_wall,
        has_undercuts=undercut_count > 0,
        undercut_count=undercut_count,
        ejector_difficulty=ejector_difficulty,
        confidence=float(confidence)
    )
