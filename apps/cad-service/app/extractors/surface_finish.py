"""
Surface Finish Detection from CAD geometry.

Detects likely surface finish requirements based on:
- Face planarity and smoothness
- Small fillet radii (polished transitions)
- Mating/datum surface indicators
- Tight-tolerance cylindrical features
- Ground surface patterns
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple
import math


class SurfaceFinishGrade(str, Enum):
    """Surface finish grades based on Ra values (µm)."""
    ROUGH = "rough"           # Ra > 6.3µm - as-machined rough
    STANDARD = "standard"     # Ra 3.2-6.3µm - standard machined
    FINE = "fine"             # Ra 1.6-3.2µm - fine machined
    PRECISION = "precision"   # Ra 0.8-1.6µm - ground/honed
    POLISHED = "polished"     # Ra 0.4-0.8µm - polished
    MIRROR = "mirror"         # Ra < 0.4µm - mirror/lapped


@dataclass
class SurfaceFinishFeature:
    """Detected surface finish requirement."""
    grade: SurfaceFinishGrade
    estimated_ra: float  # Ra in µm
    face_area: float  # mm²
    face_type: str  # 'planar', 'cylindrical', 'freeform'
    center: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    is_mating_surface: bool = False
    is_datum: bool = False
    requires_grinding: bool = False
    requires_polishing: bool = False
    confidence: float = 0.5


@dataclass
class SurfaceFinishAnalysis:
    """Overall surface finish analysis results."""
    features: List[SurfaceFinishFeature] = field(default_factory=list)
    dominant_grade: SurfaceFinishGrade = SurfaceFinishGrade.STANDARD
    min_ra_required: float = 3.2  # µm
    precision_face_count: int = 0
    polished_face_count: int = 0
    ground_face_count: int = 0
    total_precision_area: float = 0.0  # mm²
    finish_complexity_score: float = 0.0  # 0-100


def _estimate_ra_from_geometry(
    face_area: float,
    face_type: str,
    curvature: float = 0.0,
    fillet_radius: Optional[float] = None,
    is_bore: bool = False,
    bore_diameter: Optional[float] = None,
    is_external_cylinder: bool = False
) -> Tuple[float, SurfaceFinishGrade]:
    """
    Estimate likely surface finish requirement from geometric context.
    
    Heuristics:
    - Small planar faces in precision contexts -> fine/precision
    - Bores with tight expected clearances -> precision
    - Large external flats -> standard
    - Small fillet transitions -> polished
    """
    # Default to standard
    estimated_ra = 3.2
    grade = SurfaceFinishGrade.STANDARD
    
    # Small bore ID surfaces often require better finish
    if is_bore and bore_diameter is not None:
        if bore_diameter < 10.0:
            estimated_ra = 1.6
            grade = SurfaceFinishGrade.FINE
        elif bore_diameter < 6.0:
            estimated_ra = 0.8
            grade = SurfaceFinishGrade.PRECISION
    
    # External precision cylinders (shafts, pins)
    if is_external_cylinder and bore_diameter is not None:
        if bore_diameter < 20.0:
            estimated_ra = 1.6
            grade = SurfaceFinishGrade.FINE
    
    # Small planar faces in precision area
    if face_type == 'planar' and face_area < 100.0:
        # Small datum-like faces
        estimated_ra = min(estimated_ra, 1.6)
        grade = SurfaceFinishGrade.FINE
    
    # Fillet radii indicate finish requirements
    if fillet_radius is not None and fillet_radius < 0.5:
        # Very small fillets need polished finish
        estimated_ra = min(estimated_ra, 0.8)
        grade = SurfaceFinishGrade.POLISHED
    elif fillet_radius is not None and fillet_radius < 1.0:
        estimated_ra = min(estimated_ra, 1.6)
        grade = SurfaceFinishGrade.FINE
    
    return estimated_ra, grade


def extract_surface_finish_from_shape(shape) -> SurfaceFinishAnalysis:
    """
    Extract surface finish requirements from STEP/BREP shape.
    
    Analyzes face geometry, fillet radii, bore diameters to infer
    likely surface finish requirements.
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_FACE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.BRepGProp import brepgprop
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import (
            GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Cone,
            GeomAbs_Sphere, GeomAbs_Torus, GeomAbs_BSplineSurface
        )
    except ImportError:
        return SurfaceFinishAnalysis()
    
    features: List[SurfaceFinishFeature] = []
    precision_count = 0
    polished_count = 0
    ground_count = 0
    total_precision_area = 0.0
    
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while explorer.More():
        face = explorer.Current()
        
        # Get face area
        props = GProp_GProps()
        brepgprop.SurfaceProperties(face, props)
        area = props.Mass()
        
        if area < 0.1:  # Skip tiny faces
            explorer.Next()
            continue
        
        # Get face center
        center_pnt = props.CentreOfMass()
        center = (center_pnt.X(), center_pnt.Y(), center_pnt.Z())
        
        # Analyze surface type
        adaptor = BRepAdaptor_Surface(face)
        surf_type = adaptor.GetType()
        
        face_type = "freeform"
        is_bore = False
        is_external = False
        diameter = None
        
        if surf_type == GeomAbs_Plane:
            face_type = "planar"
        elif surf_type == GeomAbs_Cylinder:
            face_type = "cylindrical"
            cyl = adaptor.Cylinder()
            diameter = cyl.Radius() * 2.0
            
            # Check if internal or external
            # Get a UV point and check normal direction
            u_mid = (adaptor.FirstUParameter() + adaptor.LastUParameter()) / 2.0
            v_mid = (adaptor.FirstVParameter() + adaptor.LastVParameter()) / 2.0
            pnt = adaptor.Value(u_mid, v_mid)
            
            # Compare to axis
            axis_loc = cyl.Location()
            axis_dir = cyl.Axis().Direction()
            
            # Vector from axis to point
            to_point = (
                pnt.X() - axis_loc.X(),
                pnt.Y() - axis_loc.Y(),
                pnt.Z() - axis_loc.Z()
            )
            
            # Normal direction (outward for cylinder surface)
            # For internal surfaces (bores), the face normal points inward
            from OCC.Core.BRepLProp import BRepLProp_SLProps
            slprops = BRepLProp_SLProps(adaptor, u_mid, v_mid, 1, 0.001)
            if slprops.IsNormalDefined():
                normal = slprops.Normal()
                # Radial direction
                radial_len = math.sqrt(to_point[0]**2 + to_point[1]**2 + to_point[2]**2)
                if radial_len > 0.001:
                    radial = (to_point[0]/radial_len, to_point[1]/radial_len, to_point[2]/radial_len)
                    # Dot product with normal
                    dot = normal.X()*radial[0] + normal.Y()*radial[1] + normal.Z()*radial[2]
                    is_bore = dot < 0  # Normal points inward = bore
                    is_external = not is_bore
        
        elif surf_type in (GeomAbs_Cone, GeomAbs_Sphere, GeomAbs_Torus):
            face_type = "curved"
        elif surf_type == GeomAbs_BSplineSurface:
            face_type = "freeform"
        
        # Estimate surface finish based on geometry
        est_ra, grade = _estimate_ra_from_geometry(
            face_area=area,
            face_type=face_type,
            is_bore=is_bore,
            bore_diameter=diameter,
            is_external_cylinder=is_external
        )
        
        # Create feature
        feature = SurfaceFinishFeature(
            grade=grade,
            estimated_ra=est_ra,
            face_area=area,
            face_type=face_type,
            center=center,
            is_mating_surface=False,  # Would need assembly context
            is_datum=False,  # Would need PMI
            requires_grinding=grade in (SurfaceFinishGrade.PRECISION, SurfaceFinishGrade.POLISHED),
            requires_polishing=grade == SurfaceFinishGrade.POLISHED,
            confidence=0.6 if is_bore or is_external else 0.4
        )
        
        features.append(feature)
        
        if grade == SurfaceFinishGrade.PRECISION:
            precision_count += 1
            total_precision_area += area
        elif grade in (SurfaceFinishGrade.POLISHED, SurfaceFinishGrade.MIRROR):
            polished_count += 1
            total_precision_area += area
        
        if feature.requires_grinding:
            ground_count += 1
        
        explorer.Next()
    
    # Determine dominant grade
    grade_counts = {}
    for f in features:
        grade_counts[f.grade] = grade_counts.get(f.grade, 0) + 1
    
    dominant = SurfaceFinishGrade.STANDARD
    if grade_counts:
        # Weight by requiring better finish
        best_grade_order = [
            SurfaceFinishGrade.MIRROR,
            SurfaceFinishGrade.POLISHED,
            SurfaceFinishGrade.PRECISION,
            SurfaceFinishGrade.FINE,
            SurfaceFinishGrade.STANDARD,
            SurfaceFinishGrade.ROUGH
        ]
        for g in best_grade_order:
            if grade_counts.get(g, 0) > 0:
                dominant = g
                break
    
    # Calculate complexity score
    complexity = (
        precision_count * 5 +
        polished_count * 10 +
        ground_count * 3 +
        min(total_precision_area / 100.0, 20)
    )
    
    # Find min Ra
    min_ra = 3.2
    if features:
        min_ra = min(f.estimated_ra for f in features)
    
    return SurfaceFinishAnalysis(
        features=features,
        dominant_grade=dominant,
        min_ra_required=min_ra,
        precision_face_count=precision_count,
        polished_face_count=polished_count,
        ground_face_count=ground_count,
        total_precision_area=total_precision_area,
        finish_complexity_score=min(complexity, 100)
    )


def extract_surface_finish_from_mesh(mesh) -> SurfaceFinishAnalysis:
    """
    Estimate surface finish requirements from mesh geometry.
    
    Uses face normal variance and curvature estimation.
    Limited compared to BREP analysis.
    """
    try:
        import numpy as np
    except ImportError:
        return SurfaceFinishAnalysis()
    
    vertices = mesh.vectors
    if len(vertices) < 10:
        return SurfaceFinishAnalysis()
    
    # Compute face normals
    v0 = vertices[:, 0, :]
    v1 = vertices[:, 1, :]
    v2 = vertices[:, 2, :]
    
    e1 = v1 - v0
    e2 = v2 - v0
    normals = np.cross(e1, e2)
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms = np.where(norms < 1e-9, 1.0, norms)
    normals = normals / norms
    
    # Compute face areas
    areas = norms.flatten() / 2.0
    total_area = np.sum(areas)
    
    # Analyze normal variance in local neighborhoods
    # High normal variance = curved/complex surfaces
    # Low variance = flat surfaces
    
    # Compute centroids
    centroids = (v0 + v1 + v2) / 3.0
    
    # Simple heuristic: count sharp edges
    # Sharp edges between faces indicate machined features
    
    # For mesh, we can't reliably detect precise surface finish
    # But we can identify:
    # - Very smooth curved regions (low noise = potentially polished)
    # - Large flat regions (planar datum candidates)
    
    features = []
    
    # Identify large planar regions
    # Group faces by similar normals
    normal_bins = {}
    for i in range(len(normals)):
        # Quantize normal
        n = normals[i]
        key = (round(n[0], 1), round(n[1], 1), round(n[2], 1))
        if key not in normal_bins:
            normal_bins[key] = {'area': 0.0, 'indices': [], 'centroids': []}
        normal_bins[key]['area'] += areas[i]
        normal_bins[key]['indices'].append(i)
        normal_bins[key]['centroids'].append(centroids[i])
    
    # Large planar clusters likely need good finish
    for normal_key, data in normal_bins.items():
        cluster_area = data['area']
        if cluster_area < 50.0:  # Skip small clusters
            continue
        
        # Estimate center
        cluster_centroids = np.array(data['centroids'])
        center = tuple(np.mean(cluster_centroids, axis=0))
        
        # Large planar faces -> standard finish
        # Very large faces -> likely datum/mating
        if cluster_area > 500.0:
            grade = SurfaceFinishGrade.FINE
            est_ra = 1.6
            is_mating = True
        else:
            grade = SurfaceFinishGrade.STANDARD
            est_ra = 3.2
            is_mating = False
        
        features.append(SurfaceFinishFeature(
            grade=grade,
            estimated_ra=est_ra,
            face_area=cluster_area,
            face_type='planar',
            center=center,
            is_mating_surface=is_mating,
            is_datum=is_mating,
            requires_grinding=False,
            requires_polishing=False,
            confidence=0.3  # Lower confidence for mesh
        ))
    
    # Determine dominant grade
    precision_count = sum(1 for f in features if f.grade == SurfaceFinishGrade.PRECISION)
    polished_count = sum(1 for f in features if f.grade in (SurfaceFinishGrade.POLISHED, SurfaceFinishGrade.MIRROR))
    
    dominant = SurfaceFinishGrade.STANDARD
    if polished_count > 0:
        dominant = SurfaceFinishGrade.POLISHED
    elif precision_count > 0:
        dominant = SurfaceFinishGrade.PRECISION
    elif any(f.grade == SurfaceFinishGrade.FINE for f in features):
        dominant = SurfaceFinishGrade.FINE
    
    min_ra = 3.2
    if features:
        min_ra = min(f.estimated_ra for f in features)
    
    return SurfaceFinishAnalysis(
        features=features,
        dominant_grade=dominant,
        min_ra_required=min_ra,
        precision_face_count=precision_count,
        polished_face_count=polished_count,
        ground_face_count=0,
        total_precision_area=sum(f.face_area for f in features if f.grade != SurfaceFinishGrade.STANDARD),
        finish_complexity_score=min(precision_count * 5 + polished_count * 10, 100)
    )
