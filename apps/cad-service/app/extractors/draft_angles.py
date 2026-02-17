"""Draft angle analysis for injection-molded and die-cast parts.

Analyses face normals relative to a mold pull direction and computes the
draft angle for each face.  Faces with insufficient draft are flagged.
"""
from __future__ import annotations

import logging
import math
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


def _draft_from_plane(face, pd, BRep_Tool, Geom_Plane) -> Optional[float]:
    """Compute draft angle for a planar face."""
    surf = BRep_Tool.Surface(face)
    pln = Geom_Plane.DownCast(surf)
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
