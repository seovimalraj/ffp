"""
STEP-only bend angle extraction via pythonOCC.
Extracts actual bend angles from face pairs by analyzing
concave edges shared between adjacent planar/cylindrical faces.

This is the high-fidelity alternative to the heuristic-based bend
detection in core/bend_detection.py, which works on STL meshes and
can only estimate angles (defaulting to 90°).
"""
from __future__ import annotations

import math
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict

logger = logging.getLogger(__name__)


@dataclass
class BendFeature:
    """A single detected bend in a sheet metal part."""
    id: str
    angle_deg: float          # Actual bend angle in degrees
    radius_mm: float          # Inner bend radius
    length_mm: float          # Bend line length (flange edge)
    orientation: Tuple[float, float, float]  # Bend axis direction
    position: Tuple[float, float, float]     # Approximate center of bend
    bend_type: str            # 'v-bend' | 'u-bend' | 'z-bend' | 'hem' | 'channel'
    k_factor: float           # Material-dependent bend allowance factor
    bend_deduction_mm: float  # Flat pattern shortening per bend
    is_acute: bool            # angle < 90°
    is_obtuse: bool           # angle > 90°

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "angle_deg": round(self.angle_deg, 2),
            "radius_mm": round(self.radius_mm, 3),
            "length_mm": round(self.length_mm, 2),
            "orientation": tuple(round(v, 4) for v in self.orientation),
            "position": tuple(round(v, 2) for v in self.position),
            "bend_type": self.bend_type,
            "k_factor": round(self.k_factor, 4),
            "bend_deduction_mm": round(self.bend_deduction_mm, 3),
            "is_acute": self.is_acute,
            "is_obtuse": self.is_obtuse,
        }


@dataclass
class BendExtractionResult:
    """Full result of STEP bend extraction."""
    bends: List[BendFeature] = field(default_factory=list)
    total_bend_count: int = 0
    min_angle_deg: float = 0.0
    max_angle_deg: float = 0.0
    avg_angle_deg: float = 0.0
    min_radius_mm: float = 0.0
    max_radius_mm: float = 0.0
    total_bend_length_mm: float = 0.0
    has_acute_bends: bool = False
    has_obtuse_bends: bool = False
    has_hems: bool = False
    bend_sequence_complexity: float = 0.0  # 0-100
    flat_pattern_area_mm2: float = 0.0
    confidence: float = 0.0

    def to_dict(self) -> dict:
        return {
            "bends": [b.to_dict() for b in self.bends],
            "total_bend_count": self.total_bend_count,
            "min_angle_deg": round(self.min_angle_deg, 2),
            "max_angle_deg": round(self.max_angle_deg, 2),
            "avg_angle_deg": round(self.avg_angle_deg, 2),
            "min_radius_mm": round(self.min_radius_mm, 3),
            "max_radius_mm": round(self.max_radius_mm, 3),
            "total_bend_length_mm": round(self.total_bend_length_mm, 2),
            "has_acute_bends": self.has_acute_bends,
            "has_obtuse_bends": self.has_obtuse_bends,
            "has_hems": self.has_hems,
            "bend_sequence_complexity": round(self.bend_sequence_complexity, 1),
            "flat_pattern_area_mm2": round(self.flat_pattern_area_mm2, 2),
            "confidence": round(self.confidence, 3),
        }


def _try_import_occ():
    """Import OCC modules, returning None if not available."""
    try:
        from OCC.Core.TopExp import TopExp_Explorer, topexp
        from OCC.Core.TopAbs import TopAbs_EDGE, TopAbs_FACE
        from OCC.Core.TopoDS import topods
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
        from OCC.Core.GeomAbs import (
            GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Cone,
            GeomAbs_Torus,
        )
        from OCC.Core.TopTools import TopTools_IndexedDataMapOfShapeListOfShape
        from OCC.Core.gp import gp_Vec, gp_Pnt
        from OCC.Core.BRepGProp import brepgprop
        from OCC.Core.GProp import GProp_GProps
        return {
            'topexp': topexp, 'TopAbs_EDGE': TopAbs_EDGE, 'TopAbs_FACE': TopAbs_FACE,
            'topods': topods, 'BRepAdaptor_Surface': BRepAdaptor_Surface,
            'BRepAdaptor_Curve': BRepAdaptor_Curve,
            'GeomAbs_Plane': GeomAbs_Plane, 'GeomAbs_Cylinder': GeomAbs_Cylinder,
            'TopTools_IndexedDataMapOfShapeListOfShape': TopTools_IndexedDataMapOfShapeListOfShape,
            'gp_Vec': gp_Vec, 'gp_Pnt': gp_Pnt,
            'brepgprop': brepgprop, 'GProp_GProps': GProp_GProps,
        }
    except ImportError:
        return None


def _check_plane_plane_bend(surf1, surf2, edge, t, occ):
    """Check if two planar faces form a bend at their shared edge.
    
    This detects sharp bends (no radius) where two planes meet at an angle.
    Common in laser-cut and welded assemblies, or CAD models with no bend radius.
    """
    adaptor_curve_cls = occ['BRepAdaptor_Curve']
    gprops_cls = occ['GProp_GProps']
    gprop_linear = occ['brepgprop']
    vec_cls, pnt_cls = occ['gp_Vec'], occ['gp_Pnt']

    curve = adaptor_curve_cls(edge)
    u_mid = (curve.FirstParameter() + curve.LastParameter()) / 2.0
    mid_pt = curve.Value(u_mid)

    n1 = _face_normal_at_point(surf1, mid_pt)
    n2 = _face_normal_at_point(surf2, mid_pt)
    if n1 is None or n2 is None:
        return None

    dihedral = _angle_between_normals(n1, n2)
    
    # FIX: Detect bends from 5° to 175° (handles near-parallel cases better)
    # A 90° bend has dihedral = 90° → angle_deg = 90°
    # A 45° bend has dihedral = 45° → angle_deg = 135° (obtuse)
    # A 135° bend has dihedral = 135° → angle_deg = 45° (acute)
    if not (5.0 < dihedral < 175.0):
        return None

    angle_deg = 180.0 - dihedral
    bend_radius = t * 0.5  # Assume small radius for sharp bends

    props = gprops_cls()
    gprop_linear.LinearProperties(edge, props)
    edge_length = props.Mass()

    bend_axis = (0.0, 0.0, 1.0)
    tangent = vec_cls()
    curve.D1(u_mid, pnt_cls(), tangent)
    if tangent.Magnitude() > 1e-9:
        tangent.Normalize()
        bend_axis = (tangent.X(), tangent.Y(), tangent.Z())

    bend_pos = (mid_pt.X(), mid_pt.Y(), mid_pt.Z())
    return angle_deg, bend_radius, bend_axis, bend_pos, edge_length


def _check_cylinder_plane_bend(surf1, surf2, s1_type, edge, occ):
    """Check if a cylinder-plane face pair forms a bend.
    
    In sheet metal, the cylinder represents the bend zone (curved region).
    The U parameter range of the cylinder gives the angular span of the bend.
    """
    geom_cylinder = occ['GeomAbs_Cylinder']
    gprops_cls = occ['GProp_GProps']
    gprop_linear = occ['brepgprop']

    cyl_surf = surf1 if s1_type == geom_cylinder else surf2
    cylinder = cyl_surf.Cylinder()
    bend_radius = cylinder.Radius()

    cyl_axis = cylinder.Axis()
    axis_dir = cyl_axis.Direction()
    bend_axis = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())

    u1 = cyl_surf.FirstUParameter()
    u2 = cyl_surf.LastUParameter()
    angle_deg = math.degrees(abs(u2 - u1))
    
    # ACCURACY FIX: Tighten constraints for sheet metal bend detection
    # - Sheet metal bend radii are typically 0.5mm-20mm (max 30mm for thick plate)
    # - Larger radii indicate cylindrical turned bodies, not bends
    # - Angle must be 5-180° (reasonable bend range)
    # - Radii > 30mm are almost certainly NOT sheet metal bends
    max_bend_radius = 30.0  # mm - max realistic sheet metal bend radius
    if not (5.0 < angle_deg < 180.0 and bend_radius < max_bend_radius):
        logger.debug("BEND: Cylinder-plane rejected: angle=%.1f°, radius=%.2fmm (max=%.0fmm)", 
                     angle_deg, bend_radius, max_bend_radius)
        return None

    props = gprops_cls()
    gprop_linear.LinearProperties(edge, props)
    edge_length = props.Mass()

    loc = cylinder.Location()
    bend_pos = (loc.X(), loc.Y(), loc.Z())
    return angle_deg, bend_radius, bend_axis, bend_pos, edge_length


def _check_cylinder_cylinder_bend(surf1, surf2, edge, occ):
    """Check if two cylindrical faces form a U-bend / channel.
    
    Two adjacent cylindrical faces with similar radii indicate a continuous
    bend zone (common in formed U-channels and rolled sections).
    """
    gprops_cls = occ['GProp_GProps']
    gprop_linear = occ['brepgprop']

    cyl1 = surf1.Cylinder()
    cyl2 = surf2.Cylinder()
    r1, r2 = cyl1.Radius(), cyl2.Radius()
    
    # ACCURACY FIX: Tighten constraints for sheet metal bends
    # - Radii must be similar (difference < 2mm for inner/outer of same bend)
    # - Max radius 30mm for realistic sheet metal bends
    # - Larger radii indicate turned bodies, not sheet metal bends
    max_bend_radius = 30.0  # mm
    if abs(r1 - r2) >= 2.0 or r1 >= max_bend_radius or r2 >= max_bend_radius:
        return None

    bend_radius = (r1 + r2) / 2.0
    angular_span = abs(surf1.LastUParameter() - surf1.FirstUParameter())
    angle_deg = math.degrees(angular_span)

    if not (5.0 < angle_deg < 180.0):
        return None

    axis_dir = cyl1.Axis().Direction()
    bend_axis = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
    loc = cyl1.Location()
    bend_pos = (loc.X(), loc.Y(), loc.Z())

    props = gprops_cls()
    gprop_linear.LinearProperties(edge, props)
    edge_length = props.Mass()
    return angle_deg, bend_radius, bend_axis, bend_pos, edge_length


def _build_bend_summary(bends: List[BendFeature], result: BendExtractionResult) -> BendExtractionResult:
    """Populate result summary fields from a list of bends."""
    if not bends:
        return result
    angles = [b.angle_deg for b in bends]
    radii = [b.radius_mm for b in bends]
    result.bends = bends
    result.total_bend_count = len(bends)
    result.min_angle_deg = min(angles)
    result.max_angle_deg = max(angles)
    result.avg_angle_deg = sum(angles) / len(angles)
    result.min_radius_mm = min(radii)
    result.max_radius_mm = max(radii)
    result.total_bend_length_mm = sum(b.length_mm for b in bends)
    result.has_acute_bends = any(b.is_acute for b in bends)
    result.has_obtuse_bends = any(b.is_obtuse for b in bends)
    result.has_hems = any(b.bend_type == "hem" for b in bends)
    result.bend_sequence_complexity = _bend_sequence_complexity(bends)
    result.confidence = min(0.98, 0.80 + len(bends) * 0.02)
    return result


def extract_bend_angles_from_shape(shape, thickness_mm: Optional[float] = None) -> BendExtractionResult:
    """
    Extract precise bend angles from a STEP B-Rep shape using pythonOCC.

    Algorithm:
      1. Enumerate all edges; for each edge find the two adjacent faces.
      2. For each shared edge between two planar faces (or a planar + cylindrical
         face pair), compute the dihedral angle using face normals.
      3. A "bend" is an edge where the dihedral angle deviates from 0° or 180°
         and one face is cylindrical (the bend zone) OR two planar faces meet
         at an angle consistent with sheet metal bending.
      4. For cylindrical faces in the bend zone, extract the actual bend radius
         from the cylinder radius and compute exact angles.

    Args:
        shape: OCC TopoDS_Shape (from STEP loader)
        thickness_mm: Detected thickness for K-factor & deduction calc.

    Returns:
        BendExtractionResult with all detected bends.
    """
    result = BendExtractionResult()
    occ = _try_import_occ()
    if occ is None:
        logger.warning("pythonOCC not available – skipping STEP bend extraction")
        return result

    edge_face_map = occ['TopTools_IndexedDataMapOfShapeListOfShape']()
    occ['topexp'].MapShapesAndAncestors(shape, occ['TopAbs_EDGE'], occ['TopAbs_FACE'], edge_face_map)

    bends: List[BendFeature] = []
    bend_id = 0
    t = thickness_mm or 1.0
    
    # Statistics for debugging
    total_edges = edge_face_map.Size()
    edges_with_2_faces = 0
    plane_plane_pairs = 0
    cyl_plane_pairs = 0
    cyl_cyl_pairs = 0
    other_pairs = 0
    
    logger.debug("BEND: Processing %d edges for bend detection", total_edges)

    for edge_idx in range(1, edge_face_map.Size() + 1):
        edge = occ['topods'].Edge(edge_face_map.FindKey(edge_idx))
        face_list = edge_face_map.FindFromIndex(edge_idx)

        # FIX: TopTools_ListOfShape requires proper OCC iteration, not list()
        # Use iterator to extract faces from the list
        try:
            from OCC.Core.TopTools import TopTools_ListIteratorOfListOfShape
            face_items = []
            it = TopTools_ListIteratorOfListOfShape(face_list)
            while it.More():
                face_items.append(it.Value())
                it.Next()
        except Exception as exc:
            logger.debug("BEND: Failed to iterate face list for edge %d: %s", edge_idx, exc)
            continue
            
        if len(face_items) != 2:
            continue
        
        edges_with_2_faces += 1
            
        face1 = occ['topods'].Face(face_items[0])
        face2 = occ['topods'].Face(face_items[1])

        surf1 = occ['BRepAdaptor_Surface'](face1)
        surf2 = occ['BRepAdaptor_Surface'](face2)
        s1_type = surf1.GetType()
        s2_type = surf2.GetType()
        
        # Count face type combinations (extended for advanced detection)
        from OCC.Core.GeomAbs import GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Cone, GeomAbs_Torus
        type_names = {
            GeomAbs_Plane: 'Plane', 
            GeomAbs_Cylinder: 'Cylinder',
            GeomAbs_Cone: 'Cone',
            GeomAbs_Torus: 'Torus',
        }
        s1_name = type_names.get(s1_type, f'Other({s1_type})')
        s2_name = type_names.get(s2_type, f'Other({s2_type})')
        
        if s1_type == GeomAbs_Plane and s2_type == GeomAbs_Plane:
            plane_plane_pairs += 1
        elif (s1_type == GeomAbs_Cylinder and s2_type == GeomAbs_Plane) or \
             (s1_type == GeomAbs_Plane and s2_type == GeomAbs_Cylinder):
            cyl_plane_pairs += 1
        elif s1_type == GeomAbs_Cylinder and s2_type == GeomAbs_Cylinder:
            cyl_cyl_pairs += 1
        else:
            # Count cone and torus pairs in 'other' but they're now processed
            other_pairs += 1

        bend_data = _process_edge_pair(surf1, surf2, s1_type, s2_type, edge, t, occ)
        if bend_data is None:
            continue
        
        logger.debug("BEND: Found %s-%s pair with bend angle %.1f°", s1_name, s2_name, bend_data[0])

        angle_deg, bend_radius, bend_axis, bend_pos, edge_length = bend_data

        # Validate edge length – ignore micro edges
        if edge_length < 1.0:
            continue

        bend_type = _classify_bend_type(angle_deg, bend_radius, t)
        k_factor = _calculate_k_factor(bend_radius, t)
        bend_deduction = _bend_deduction(angle_deg, bend_radius, t, k_factor)

        bend_id += 1
        bends.append(BendFeature(
            id=f"BEND-{bend_id:03d}",
            angle_deg=round(angle_deg, 2),
            radius_mm=round(bend_radius, 3),
            length_mm=round(edge_length, 2),
            orientation=bend_axis,
            position=bend_pos,
            bend_type=bend_type,
            k_factor=k_factor,
            bend_deduction_mm=bend_deduction,
            is_acute=angle_deg < 88.0,
            is_obtuse=angle_deg > 92.0,
        ))

    bends = _deduplicate_bends(bends)
    result = _build_bend_summary(bends, result)
    
    # Log edge pair statistics for debugging
    logger.debug(
        "BEND: Edge stats - total=%d, with_2_faces=%d, plane-plane=%d, cyl-plane=%d, cyl-cyl=%d, other=%d",
        total_edges, edges_with_2_faces, plane_plane_pairs, cyl_plane_pairs, cyl_cyl_pairs, other_pairs
    )

    logger.info(
        "STEP bend extraction: %d bends (angles %.1f°–%.1f°, radii %.2f–%.2fmm)",
        result.total_bend_count,
        result.min_angle_deg,
        result.max_angle_deg,
        result.min_radius_mm,
        result.max_radius_mm,
    )
    return result


def _process_edge_pair(surf1, surf2, s1_type, s2_type, edge, t, occ):
    """Dispatch edge to the appropriate bend-check handler. Returns bend data tuple or None."""
    from OCC.Core.GeomAbs import GeomAbs_Plane, GeomAbs_Cylinder, GeomAbs_Cone, GeomAbs_Torus

    if s1_type == GeomAbs_Plane and s2_type == GeomAbs_Plane:
        try:
            return _check_plane_plane_bend(surf1, surf2, edge, t, occ)
        except Exception as exc:
            logger.debug("Plane-plane bend check failed: %s", exc)
            return None

    is_cyl_plane = (
        (s1_type == GeomAbs_Cylinder and s2_type == GeomAbs_Plane)
        or (s1_type == GeomAbs_Plane and s2_type == GeomAbs_Cylinder)
    )
    if is_cyl_plane:
        try:
            return _check_cylinder_plane_bend(surf1, surf2, s1_type, edge, occ)
        except Exception as exc:
            logger.debug("Cylinder-plane bend check failed: %s", exc)
            return None

    if s1_type == GeomAbs_Cylinder and s2_type == GeomAbs_Cylinder:
        try:
            return _check_cylinder_cylinder_bend(surf1, surf2, edge, occ)
        except Exception as exc:
            logger.debug("Cylinder-cylinder bend check failed: %s", exc)
            return None

    # ADVANCED: Conical face handling (tapered/flared sheet metal bends)
    # Cones appear in funnel-shaped parts, tapered transitions, and flared edges
    is_cone_plane = (
        (s1_type == GeomAbs_Cone and s2_type == GeomAbs_Plane)
        or (s1_type == GeomAbs_Plane and s2_type == GeomAbs_Cone)
    )
    if is_cone_plane:
        try:
            return _check_cone_plane_bend(surf1, surf2, s1_type, edge, t, occ)
        except Exception as exc:
            logger.debug("Cone-plane bend check failed: %s", exc)
            return None
    
    is_cone_cyl = (
        (s1_type == GeomAbs_Cone and s2_type == GeomAbs_Cylinder)
        or (s1_type == GeomAbs_Cylinder and s2_type == GeomAbs_Cone)
    )
    if is_cone_cyl:
        try:
            return _check_cone_cylinder_bend(surf1, surf2, s1_type, edge, t, occ)
        except Exception as exc:
            logger.debug("Cone-cylinder bend check failed: %s", exc)
            return None
    
    # ADVANCED: Toroidal face handling (complex curved bends like corners)
    # Tori appear in rolled edges, ball corners, and compound curves
    is_torus_plane = (
        (s1_type == GeomAbs_Torus and s2_type == GeomAbs_Plane)
        or (s1_type == GeomAbs_Plane and s2_type == GeomAbs_Torus)
    )
    if is_torus_plane:
        try:
            return _check_torus_plane_bend(surf1, surf2, s1_type, edge, t, occ)
        except Exception as exc:
            logger.debug("Torus-plane bend check failed: %s", exc)
            return None
    
    is_torus_cyl = (
        (s1_type == GeomAbs_Torus and s2_type == GeomAbs_Cylinder)
        or (s1_type == GeomAbs_Cylinder and s2_type == GeomAbs_Torus)
    )
    if is_torus_cyl:
        try:
            return _check_torus_cylinder_bend(surf1, surf2, s1_type, edge, t, occ)
        except Exception as exc:
            logger.debug("Torus-cylinder bend check failed: %s", exc)
            return None

    return None


def _check_cone_plane_bend(surf1, surf2, s1_type, edge, t, occ):
    """Check if a cone-plane face pair forms a tapered bend.
    
    Conical faces in sheet metal represent tapered transitions like
    funnels, reducers, or flared edges. The semi-angle of the cone
    determines the taper angle.
    """
    from OCC.Core.GeomAbs import GeomAbs_Cone
    gprops_cls = occ['GProp_GProps']
    gprop_linear = occ['brepgprop']
    
    cone_surf = surf1 if s1_type == GeomAbs_Cone else surf2
    cone = cone_surf.Cone()
    
    # Cone semi-angle (half-angle of the cone)
    semi_angle_rad = cone.SemiAngle()
    semi_angle_deg = math.degrees(abs(semi_angle_rad))
    
    # For sheet metal, taper angles are typically small (5-45 degrees)
    if not (2.0 < semi_angle_deg < 60.0):
        return None
    
    # The bend angle is related to how the cone meets the plane
    # For a cone transitioning to a flat, the bend angle is close to 90° ± semi_angle
    bend_angle = 90.0 - semi_angle_deg
    if bend_angle < 5 or bend_angle > 175:
        return None
    
    # Use cone parameters for bend properties
    apex = cone.Apex()
    bend_radius = t * 0.5  # Approximate - cones have variable radius
    
    axis_dir = cone.Axis().Direction()
    bend_axis = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
    bend_pos = (apex.X(), apex.Y(), apex.Z())
    
    props = gprops_cls()
    gprop_linear.LinearProperties(edge, props)
    edge_length = props.Mass()
    
    return bend_angle, bend_radius, bend_axis, bend_pos, edge_length


def _check_cone_cylinder_bend(surf1, surf2, s1_type, edge, t, occ):
    """Check if a cone-cylinder pair forms a transitional bend.
    
    This occurs when a tapered section connects to a cylindrical section,
    common in reducers and tapered tubes.
    """
    from OCC.Core.GeomAbs import GeomAbs_Cone, GeomAbs_Cylinder
    gprops_cls = occ['GProp_GProps']
    gprop_linear = occ['brepgprop']
    
    cone_surf = surf1 if s1_type == GeomAbs_Cone else surf2
    cyl_surf = surf2 if s1_type == GeomAbs_Cone else surf1
    
    cone = cone_surf.Cone()
    cylinder = cyl_surf.Cylinder()
    
    semi_angle_rad = cone.SemiAngle()
    semi_angle_deg = math.degrees(abs(semi_angle_rad))
    
    # The bend angle is approximately the cone's semi-angle
    bend_angle = semi_angle_deg
    if not (5.0 < bend_angle < 85.0):
        return None
    
    bend_radius = cylinder.Radius()
    
    axis_dir = cylinder.Axis().Direction()
    bend_axis = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
    loc = cylinder.Location()
    bend_pos = (loc.X(), loc.Y(), loc.Z())
    
    props = gprops_cls()
    gprop_linear.LinearProperties(edge, props)
    edge_length = props.Mass()
    
    return bend_angle, bend_radius, bend_axis, bend_pos, edge_length


def _check_torus_plane_bend(surf1, surf2, s1_type, edge, t, occ):
    """Check if a torus-plane pair forms a rolled edge or corner bend.
    
    Toroidal surfaces in sheet metal represent rolled edges, ball corners,
    or compound curved bends. The torus minor radius relates to bend radius.
    """
    from OCC.Core.GeomAbs import GeomAbs_Torus
    gprops_cls = occ['GProp_GProps']
    gprop_linear = occ['brepgprop']
    
    torus_surf = surf1 if s1_type == GeomAbs_Torus else surf2
    torus = torus_surf.Torus()
    
    # Minor radius is the tube radius (bend radius)
    minor_radius = torus.MinorRadius()
    major_radius = torus.MajorRadius()
    
    # For sheet metal, minor radius should be reasonable
    if minor_radius < 0.1 or minor_radius > 50.0:
        return None
    
    # Estimate bend angle from torus arc span
    u1 = torus_surf.FirstUParameter()
    u2 = torus_surf.LastUParameter()
    arc_angle_deg = math.degrees(abs(u2 - u1))
    
    # Bend angle is the arc span
    bend_angle = arc_angle_deg
    if not (5.0 < bend_angle < 180.0):
        return None
    
    bend_radius = minor_radius
    
    axis = torus.Axis()
    axis_dir = axis.Direction()
    bend_axis = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
    loc = torus.Location()
    bend_pos = (loc.X(), loc.Y(), loc.Z())
    
    props = gprops_cls()
    gprop_linear.LinearProperties(edge, props)
    edge_length = props.Mass()
    
    return bend_angle, bend_radius, bend_axis, bend_pos, edge_length


def _check_torus_cylinder_bend(surf1, surf2, s1_type, edge, t, occ):
    """Check if a torus-cylinder pair forms a transition bend.
    
    This occurs at the junction between a plain bend and a rolled corner,
    or when a cylinder meets a curved transition zone.
    """
    from OCC.Core.GeomAbs import GeomAbs_Torus, GeomAbs_Cylinder
    gprops_cls = occ['GProp_GProps']
    gprop_linear = occ['brepgprop']
    
    torus_surf = surf1 if s1_type == GeomAbs_Torus else surf2
    cyl_surf = surf2 if s1_type == GeomAbs_Torus else surf1
    
    torus = torus_surf.Torus()
    cylinder = cyl_surf.Cylinder()
    
    minor_radius = torus.MinorRadius()
    
    # Minor radius should match cylinder radius approximately
    cyl_radius = cylinder.Radius()
    radius_diff = abs(minor_radius - cyl_radius)
    
    if radius_diff > max(minor_radius, cyl_radius) * 0.5:
        # Radii too different - not a smooth transition
        return None
    
    # Estimate bend angle from torus arc
    u1 = torus_surf.FirstUParameter()
    u2 = torus_surf.LastUParameter()
    arc_angle_deg = math.degrees(abs(u2 - u1))
    
    bend_angle = arc_angle_deg
    if not (5.0 < bend_angle < 180.0):
        return None
    
    bend_radius = (minor_radius + cyl_radius) / 2
    
    axis_dir = cylinder.Axis().Direction()
    bend_axis = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
    loc = cylinder.Location()
    bend_pos = (loc.X(), loc.Y(), loc.Z())
    
    props = gprops_cls()
    gprop_linear.LinearProperties(edge, props)
    edge_length = props.Mass()
    
    return bend_angle, bend_radius, bend_axis, bend_pos, edge_length


# ======================================================================
# Internal helpers
# ======================================================================

def _face_normal_at_point(adaptor, _point):
    """Return outward normal of a planar face evaluated near *point*."""
    from OCC.Core.gp import gp_Pnt2d, gp_Vec, gp_Dir
    from OCC.Core.GeomAbs import GeomAbs_Plane
    try:
        if adaptor.GetType() != GeomAbs_Plane:
            return None
        pln = adaptor.Plane()
        normal = pln.Axis().Direction()
        return (normal.X(), normal.Y(), normal.Z())
    except Exception:
        return None


def _angle_between_normals(n1, n2) -> float:
    """Angle between two 3-D unit vectors in degrees."""
    dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]
    dot = max(-1.0, min(1.0, dot))
    return math.degrees(math.acos(dot))


def _classify_bend_type(angle: float, radius: float, thickness: float) -> str:
    if angle < 10:
        return "hem"
    if angle < 60:
        return "z-bend"
    if 80 <= angle <= 100:
        return "v-bend"
    if 170 < angle:
        return "hem"
    if radius < thickness * 0.5:
        return "channel"
    return "v-bend"


# Material-specific K-factor lookup tables
# K-factor depends on material type, temper, and bend radius/thickness ratio
# Source: Machinery's Handbook, SME forming guidelines
MATERIAL_K_FACTORS = {
    "aluminum": {
        # Aluminum alloys - softer materials have lower K-factor
        "soft": {  # 1100, 3003, 5052-O
            "tight": 0.33,    # R/T < 1
            "normal": 0.38,   # 1 <= R/T < 2
            "loose": 0.42,    # 2 <= R/T < 3
            "open": 0.45,     # R/T >= 3
        },
        "half_hard": {  # 5052-H32, 6061-T4
            "tight": 0.35,
            "normal": 0.40,
            "loose": 0.44,
            "open": 0.48,
        },
        "hard": {  # 6061-T6, 7075
            "tight": 0.38,
            "normal": 0.42,
            "loose": 0.46,
            "open": 0.50,
        },
    },
    "steel": {
        # Mild steel and HSLA
        "soft": {  # A36, CR1008
            "tight": 0.35,
            "normal": 0.40,
            "loose": 0.44,
            "open": 0.48,
        },
        "half_hard": {  # A569, HSLA
            "tight": 0.38,
            "normal": 0.42,
            "loose": 0.46,
            "open": 0.50,
        },
        "hard": {  # A606, Spring steel
            "tight": 0.40,
            "normal": 0.44,
            "loose": 0.48,
            "open": 0.50,
        },
    },
    "stainless": {
        # Stainless steels work-harden significantly
        "soft": {  # 304 annealed, 316 annealed
            "tight": 0.38,
            "normal": 0.42,
            "loose": 0.46,
            "open": 0.50,
        },
        "half_hard": {  # 301, 304 1/4H
            "tight": 0.40,
            "normal": 0.44,
            "loose": 0.48,
            "open": 0.50,
        },
        "hard": {  # 301 FH, 17-7PH
            "tight": 0.42,
            "normal": 0.46,
            "loose": 0.50,
            "open": 0.50,
        },
    },
    "copper": {
        "soft": {
            "tight": 0.30,
            "normal": 0.35,
            "loose": 0.40,
            "open": 0.44,
        },
        "hard": {
            "tight": 0.35,
            "normal": 0.40,
            "loose": 0.44,
            "open": 0.48,
        },
    },
    "brass": {
        "soft": {
            "tight": 0.32,
            "normal": 0.38,
            "loose": 0.42,
            "open": 0.46,
        },
        "hard": {
            "tight": 0.38,
            "normal": 0.42,
            "loose": 0.46,
            "open": 0.50,
        },
    },
    "default": {
        # Generic fallback
        "soft": {"tight": 0.33, "normal": 0.40, "loose": 0.44, "open": 0.48},
        "half_hard": {"tight": 0.38, "normal": 0.42, "loose": 0.46, "open": 0.50},
        "hard": {"tight": 0.40, "normal": 0.44, "loose": 0.48, "open": 0.50},
    },
}


def _get_rt_category(ratio: float) -> str:
    """Categorize R/T ratio for K-factor lookup."""
    if ratio < 1.0:
        return "tight"
    elif ratio < 2.0:
        return "normal"
    elif ratio < 3.0:
        return "loose"
    else:
        return "open"


def _calculate_k_factor(
    radius: float, 
    thickness: float, 
    _angle: float = 0.0,
    material: str = "default",
    temper: str = "half_hard"
) -> float:
    """
    Calculate K-factor based on material, temper, and bend geometry.
    
    K-factor determines where the neutral axis sits within the bend.
    Typical range: 0.3–0.5. Tight radii shift the neutral axis inward.
    Harder materials and tighter bends have lower K-factors.
    
    Args:
        radius: Inner bend radius in mm
        thickness: Material thickness in mm
        _angle: Bend angle (not currently used, reserved for future)
        material: Material type ('aluminum', 'steel', 'stainless', 'copper', 'brass')
        temper: Material temper ('soft', 'half_hard', 'hard')
        
    Returns:
        K-factor value (typically 0.30-0.50)
    """
    if thickness <= 0:
        return 0.44  # Default fallback
    
    ratio = radius / thickness
    rt_category = _get_rt_category(ratio)
    
    # Get material-specific K-factor table
    material_lower = material.lower() if material else "default"
    if material_lower not in MATERIAL_K_FACTORS:
        material_lower = "default"
    
    material_table = MATERIAL_K_FACTORS[material_lower]
    
    # Get temper-specific values
    temper_lower = temper.lower() if temper else "half_hard"
    if temper_lower not in material_table:
        # Find closest match
        if "half_hard" in material_table:
            temper_lower = "half_hard"
        elif "soft" in material_table:
            temper_lower = "soft"
        else:
            temper_lower = list(material_table.keys())[0]
    
    temper_table = material_table[temper_lower]
    
    return temper_table.get(rt_category, 0.44)


def calculate_bend_allowance(
    angle_deg: float, 
    radius: float, 
    thickness: float,
    k_factor: Optional[float] = None,
    material: str = "default",
    temper: str = "half_hard"
) -> float:
    """
    Calculate bend allowance (BA) - the arc length of the neutral axis.
    
    BA = (π × angle_deg / 180) × (radius + K × thickness)
    
    This is the material added to flat pattern to account for stretching
    during the bend process.
    
    Args:
        angle_deg: Bend angle in degrees
        radius: Inner bend radius in mm
        thickness: Material thickness in mm
        k_factor: Override K-factor (if None, calculated from material/temper)
        material: Material type for K-factor lookup
        temper: Material temper for K-factor lookup
        
    Returns:
        Bend allowance in mm
    """
    if k_factor is None:
        k_factor = _calculate_k_factor(radius, thickness, angle_deg, material, temper)
    
    a_rad = math.radians(angle_deg)
    ba = a_rad * (radius + k_factor * thickness)
    return ba


def calculate_outside_setback(
    angle_deg: float, 
    radius: float, 
    thickness: float
) -> float:
    """
    Calculate outside setback (OSSB) for a bend.
    
    OSSB = (R + T) × tan(angle/2)
    
    This is the distance from the bend tangent point to the apex
    of the bend on the outside surface.
    
    Args:
        angle_deg: Bend angle in degrees
        radius: Inner bend radius in mm
        thickness: Material thickness in mm
        
    Returns:
        Outside setback in mm
    """
    a_rad = math.radians(angle_deg)
    if abs(math.cos(a_rad / 2.0)) < 1e-9:
        return 0.0
    return (radius + thickness) * math.tan(a_rad / 2.0)


def _bend_deduction(angle_deg: float, radius: float, thickness: float, k_factor: float) -> float:
    """
    Bend Deduction (BD) = 2 × (R + T) × tan(A/2)  −  Bend Allowance
    
    This is the amount to subtract from the flat pattern leg lengths
    to account for the bend.
    
    For a 90° bend: BD = 2 × OSSB - BA
    
    Args:
        angle_deg: Bend angle in degrees
        radius: Inner bend radius in mm
        thickness: Material thickness in mm
        k_factor: K-factor for neutral axis position
        
    Returns:
        Bend deduction in mm (always >= 0)
    """
    ba = calculate_bend_allowance(angle_deg, radius, thickness, k_factor)
    ossb = calculate_outside_setback(angle_deg, radius, thickness)
    bd = 2.0 * ossb - ba
    return max(0.0, bd)


def _bend_sequence_complexity(bends: List[BendFeature]) -> float:
    """
    Score 0-100 representing how complex the bend sequence is.
    Factors: count, angle variety, acute/obtuse mix, orientation changes.
    """
    if not bends:
        return 0.0
    score = 0.0
    n = len(bends)

    # Count-based
    score += min(30, n * 5)

    # Angle variety
    angles = [b.angle_deg for b in bends]
    angle_range = max(angles) - min(angles)
    score += min(20, angle_range / 3.0)

    # Acute / obtuse mix
    has_acute = any(b.is_acute for b in bends)
    has_obtuse = any(b.is_obtuse for b in bends)
    if has_acute and has_obtuse:
        score += 15

    # Orientation changes
    axes = [b.orientation for b in bends]
    direction_changes = 0
    for i in range(1, len(axes)):
        dot = sum(a * b for a, b in zip(axes[i - 1], axes[i]))
        if abs(dot) < 0.7:
            direction_changes += 1
    score += min(20, direction_changes * 7)

    # Hems
    if any(b.bend_type == "hem" for b in bends):
        score += 10

    return min(100.0, score)


def _deduplicate_bends(bends: List[BendFeature], tolerance_mm: float = 2.0) -> List[BendFeature]:
    """Remove near-duplicate bends (same position within a spatial tolerance)."""
    if len(bends) <= 1:
        return bends

    unique: List[BendFeature] = []
    for b in bends:
        is_dup = False
        for u in unique:
            dist = math.sqrt(
                (b.position[0] - u.position[0]) ** 2
                + (b.position[1] - u.position[1]) ** 2
                + (b.position[2] - u.position[2]) ** 2
            )
            if dist < tolerance_mm and abs(b.angle_deg - u.angle_deg) < 5.0:
                is_dup = True
                break
        if not is_dup:
            unique.append(b)
    return unique
