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
    """Check if two planar faces form a bend at their shared edge."""
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
    if not (10.0 < dihedral < 170.0):
        return None

    angle_deg = 180.0 - dihedral
    bend_radius = t * 0.5

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
    """Check if a cylinder-plane face pair forms a bend."""
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

    if not (10.0 < angle_deg < 180.0 and bend_radius < 50.0):
        return None

    props = gprops_cls()
    gprop_linear.LinearProperties(edge, props)
    edge_length = props.Mass()

    loc = cylinder.Location()
    bend_pos = (loc.X(), loc.Y(), loc.Z())
    return angle_deg, bend_radius, bend_axis, bend_pos, edge_length


def _check_cylinder_cylinder_bend(surf1, surf2, edge, occ):
    """Check if two cylindrical faces form a U-bend / channel."""
    gprops_cls = occ['GProp_GProps']
    gprop_linear = occ['brepgprop']

    cyl1 = surf1.Cylinder()
    cyl2 = surf2.Cylinder()
    r1, r2 = cyl1.Radius(), cyl2.Radius()

    if abs(r1 - r2) >= 0.5 or r1 >= 50.0:
        return None

    bend_radius = (r1 + r2) / 2.0
    angular_span = abs(surf1.LastUParameter() - surf1.FirstUParameter())
    angle_deg = math.degrees(angular_span)

    if not (10.0 < angle_deg < 180.0):
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

    for edge_idx in range(1, edge_face_map.Size() + 1):
        edge = occ['topods'].Edge(edge_face_map.FindKey(edge_idx))
        face_list = edge_face_map.FindFromIndex(edge_idx)
        if face_list.Size() != 2:
            continue

        face_iter = face_list.cbegin()
        face1 = occ['topods'].Face(face_iter.Value())
        face_iter.Next()
        face2 = occ['topods'].Face(face_iter.Value())

        surf1 = occ['BRepAdaptor_Surface'](face1)
        surf2 = occ['BRepAdaptor_Surface'](face2)
        s1_type = surf1.GetType()
        s2_type = surf2.GetType()

        bend_data = _process_edge_pair(surf1, surf2, s1_type, s2_type, edge, t, occ)
        if bend_data is None:
            continue

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
    from OCC.Core.GeomAbs import GeomAbs_Plane, GeomAbs_Cylinder

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

    return None


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


def _calculate_k_factor(radius: float, thickness: float, _angle: float = 0.0) -> float:
    """
    K-factor determines where the neutral axis sits within the bend.
    Typical range: 0.3–0.5.  Tight radii shift the neutral axis inward.
    """
    if thickness <= 0:
        return 0.44
    ratio = radius / thickness
    if ratio < 1.0:
        return 0.33
    if ratio < 2.0:
        return 0.40
    if ratio < 3.0:
        return 0.44
    return 0.50


def _bend_deduction(angle_deg: float, radius: float, thickness: float, k_factor: float) -> float:
    """
    Bend Deduction (BD) = 2 × (R + T) × tan(A/2)  −  Bend Allowance
    Bend Allowance (BA) = A_rad × (R + K × T)
    """
    a_rad = math.radians(angle_deg)
    ba = a_rad * (radius + k_factor * thickness)
    outside_setback = 2.0 * (radius + thickness) * math.tan(a_rad / 2.0) if abs(math.cos(a_rad / 2.0)) > 1e-9 else 0.0
    bd = outside_setback - ba
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
