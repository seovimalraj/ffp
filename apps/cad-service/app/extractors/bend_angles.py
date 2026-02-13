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

    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core import TopExp
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
    except ImportError:
        logger.warning("pythonOCC not available – skipping STEP bend extraction")
        return result

    # ------------------------------------------------------------------
    # Step 1 – build edge → adjacent-faces map
    # ------------------------------------------------------------------
    edge_face_map = TopTools_IndexedDataMapOfShapeListOfShape()
    topexp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_face_map)

    bends: List[BendFeature] = []
    bend_id = 0
    t = thickness_mm or 1.0  # fallback for K-factor calc

    # ------------------------------------------------------------------
    # Step 2 – iterate all edges
    # ------------------------------------------------------------------
    for edge_idx in range(1, edge_face_map.Size() + 1):
        edge = topods.Edge(edge_face_map.FindKey(edge_idx))
        face_list = edge_face_map.FindFromIndex(edge_idx)

        # We need exactly two adjacent faces
        if face_list.Size() != 2:
            continue

        face_iter = face_list.cbegin()
        face1 = topods.Face(face_iter.Value())
        face_iter.Next()
        face2 = topods.Face(face_iter.Value())

        surf1 = BRepAdaptor_Surface(face1)
        surf2 = BRepAdaptor_Surface(face2)

        s1_type = surf1.GetType()
        s2_type = surf2.GetType()

        # ------------------------------------------------------------------
        # Step 3 – Identify bend candidates
        # ------------------------------------------------------------------
        # Case A: Cylindrical face between two planar faces → classic bend zone
        #   The cylindrical face IS the bend radius.
        # Case B: Two planar faces sharing a sharp edge → pressed / hemmed bend
        # Case C: Cylinder + Plane → one side of a bend zone

        bend_radius = 0.0
        angle_deg = 0.0
        bend_axis = (0.0, 0.0, 1.0)
        bend_pos = (0.0, 0.0, 0.0)
        is_bend = False

        # ---- Case A: Plane-Plane sharp edge ----
        if s1_type == GeomAbs_Plane and s2_type == GeomAbs_Plane:
            try:
                # Get normals at midpoint of shared edge
                curve = BRepAdaptor_Curve(edge)
                u_mid = (curve.FirstParameter() + curve.LastParameter()) / 2.0
                mid_pt = curve.Value(u_mid)

                n1 = _face_normal_at_point(surf1, mid_pt)
                n2 = _face_normal_at_point(surf2, mid_pt)

                if n1 is None or n2 is None:
                    continue

                dihedral = _angle_between_normals(n1, n2)

                # Sheet metal bends: dihedral between 10° and 170°
                if 10.0 < dihedral < 170.0:
                    angle_deg = 180.0 - dihedral  # Bend angle = supplement of dihedral
                    bend_radius = t * 0.5  # Assume tight bend = half thickness
                    is_bend = True

                    # Edge length = bend line length
                    props = GProp_GProps()
                    brepgprop.LinearProperties(edge, props)
                    edge_length = props.Mass()

                    # Bend axis ≈ edge tangent at mid
                    tangent = gp_Vec()
                    curve.D1(u_mid, gp_Pnt(), tangent)
                    if tangent.Magnitude() > 1e-9:
                        tangent.Normalize()
                        bend_axis = (tangent.X(), tangent.Y(), tangent.Z())

                    bend_pos = (mid_pt.X(), mid_pt.Y(), mid_pt.Z())
            except Exception as exc:
                logger.debug("Plane-plane bend check failed: %s", exc)
                continue

        # ---- Case B: one Cylinder + one Plane ----
        elif (s1_type == GeomAbs_Cylinder and s2_type == GeomAbs_Plane) or \
             (s1_type == GeomAbs_Plane and s2_type == GeomAbs_Cylinder):
            try:
                cyl_surf = surf1 if s1_type == GeomAbs_Cylinder else surf2
                pln_surf = surf2 if s1_type == GeomAbs_Cylinder else surf1

                cylinder = cyl_surf.Cylinder()
                bend_radius = cylinder.Radius()

                cyl_axis = cylinder.Axis()
                axis_dir = cyl_axis.Direction()
                bend_axis = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())

                # Compute angular span of cylinder face
                u1 = cyl_surf.FirstUParameter()
                u2 = cyl_surf.LastUParameter()
                angular_span = abs(u2 - u1)

                angle_deg = math.degrees(angular_span)

                # Filter: sheet metal bends are typically 10-180°
                if 10.0 < angle_deg < 180.0 and bend_radius < 50.0:
                    is_bend = True

                    props = GProp_GProps()
                    brepgprop.LinearProperties(edge, props)
                    edge_length = props.Mass()  # noqa: F841 – used below

                    loc = cylinder.Location()
                    bend_pos = (loc.X(), loc.Y(), loc.Z())
                else:
                    continue
            except Exception as exc:
                logger.debug("Cylinder-plane bend check failed: %s", exc)
                continue

        # ---- Case C: two Cylinders meeting (U-bend / channel) ----
        elif s1_type == GeomAbs_Cylinder and s2_type == GeomAbs_Cylinder:
            try:
                cyl1 = surf1.Cylinder()
                cyl2 = surf2.Cylinder()
                r1 = cyl1.Radius()
                r2 = cyl2.Radius()

                if abs(r1 - r2) < 0.5 and r1 < 50.0:
                    # Similar radii → could be opposite sides of a U-bend
                    bend_radius = (r1 + r2) / 2.0
                    angular_span = abs(surf1.LastUParameter() - surf1.FirstUParameter())
                    angle_deg = math.degrees(angular_span)
                    if 10.0 < angle_deg < 180.0:
                        is_bend = True
                        axis_dir = cyl1.Axis().Direction()
                        bend_axis = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
                        loc = cyl1.Location()
                        bend_pos = (loc.X(), loc.Y(), loc.Z())

                        props = GProp_GProps()
                        brepgprop.LinearProperties(edge, props)
                        edge_length = props.Mass()
            except Exception as exc:
                logger.debug("Cylinder-cylinder bend check failed: %s", exc)
                continue
        else:
            continue

        if not is_bend:
            continue

        # Validate edge length (bend line) – ignore micro edges
        try:
            props = GProp_GProps()
            brepgprop.LinearProperties(edge, props)
            edge_length = props.Mass()
        except Exception:
            edge_length = 0.0

        if edge_length < 1.0:  # < 1mm is noise
            continue

        # ------------------------------------------------------------------
        # Step 4 – Classify bend type and calculate deduction
        # ------------------------------------------------------------------
        bend_type = _classify_bend_type(angle_deg, bend_radius, t)
        k_factor = _calculate_k_factor(bend_radius, t, angle_deg)
        bend_deduction = _bend_deduction(angle_deg, bend_radius, t, k_factor)

        bend_id += 1
        bf = BendFeature(
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
        )
        bends.append(bf)

    # ------------------------------------------------------------------
    # De-duplicate (some OCC edge iterations visit nearly the same bend)
    # ------------------------------------------------------------------
    bends = _deduplicate_bends(bends)

    # ------------------------------------------------------------------
    # Build summary
    # ------------------------------------------------------------------
    if bends:
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

    logger.info(
        "STEP bend extraction: %d bends (angles %.1f°–%.1f°, radii %.2f–%.2fmm)",
        result.total_bend_count,
        result.min_angle_deg,
        result.max_angle_deg,
        result.min_radius_mm,
        result.max_radius_mm,
    )
    return result


# ======================================================================
# Internal helpers
# ======================================================================

def _face_normal_at_point(adaptor, point):
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


def _calculate_k_factor(radius: float, thickness: float, angle: float) -> float:
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
