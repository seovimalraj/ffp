"""Undercut detection for CNC parts.

Identifies internal/external undercuts — regions that are inaccessible to
standard 3-axis end mills. Detection uses face-normal analysis from OCC
shapes with a mesh-based fallback that checks face-normal distribution for
inward-facing concavities.
"""
from __future__ import annotations

import logging
import math
from typing import List, Dict, Any, Optional

from ..models import UndercutFeature

logger = logging.getLogger(__name__)


def _dot3(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _compute_face_normal(surf, umin, umax, vmin, vmax):
    """Compute outward normal at the face center. Returns 3-tuple or None."""
    u_mid = (umin + umax) / 2
    v_mid = (vmin + vmax) / 2
    d1u = surf.DN(u_mid, v_mid, 1, 0)
    d1v = surf.DN(u_mid, v_mid, 0, 1)
    nx = d1u.Y() * d1v.Z() - d1u.Z() * d1v.Y()
    ny = d1u.Z() * d1v.X() - d1u.X() * d1v.Z()
    nz = d1u.X() * d1v.Y() - d1u.Y() * d1v.X()
    mag = math.sqrt(nx * nx + ny * ny + nz * nz)
    if mag < 1e-10:
        return None
    return (nx / mag, ny / mag, nz / mag)


def _severity_from_access(max_access: float) -> str:
    if max_access < 0.1:
        return "severe"
    if max_access < 0.2:
        return "moderate"
    return "minor"


def _check_face_accessibility(
    face, access_dirs, brep_tool, geom_plane,
    geom_cyl_surface, uv_bounds_fn,
    surface_props_fn, gprop_cls, face_map, idx,
    adaptor_cls=None, plane_type=None, cylinder_type=None,
) -> Optional[UndercutFeature]:
    """Return an UndercutFeature if *face* is inaccessible, else None.

    Uses BRepAdaptor_Surface.GetType() for robust surface-type detection
    when available, falling back to Geom_*.DownCast().
    """
    # Skip planar and cylindrical faces (always accessible)
    if adaptor_cls is not None and plane_type is not None:
        try:
            adaptor = adaptor_cls(face)
            surf_type = adaptor.GetType()
            if surf_type == plane_type or surf_type == cylinder_type:
                return None
        except Exception:
            pass
    else:
        surf_geom = brep_tool.Surface(face)
        if geom_plane.DownCast(surf_geom) is not None:
            return None
        if geom_cyl_surface.DownCast(surf_geom) is not None:
            return None

    # Always get the Geom_Surface for normal computation
    surf = brep_tool.Surface(face)

    try:
        umin, umax, vmin, vmax = uv_bounds_fn(face)
        normal = _compute_face_normal(surf, umin, umax, vmin, vmax)
    except Exception:
        return None
    if normal is None:
        return None

    max_access = max(abs(_dot3(normal, d)) for d in access_dirs)
    if max_access >= 0.3:
        return None

    props = gprop_cls()
    surface_props_fn(face, props)
    area_mm2 = float(props.Mass()) * 1e6

    u_span = abs(umax - umin)
    v_span = abs(vmax - vmin)
    severity = _severity_from_access(max_access)
    fid = face_map.FindIndex(face)

    return UndercutFeature(
        id=f"UC-{idx:03d}",
        undercut_type="internal" if area_mm2 < 500 else "external",
        severity=severity,
        depth_mm=float(min(u_span, v_span)),
        width_mm=float(max(u_span, v_span)),
        requires_special_tooling=severity in ("moderate", "severe"),
        face_ids=[int(fid)],
        description=f"Face at angle {math.degrees(math.acos(max_access)):.0f}° from nearest tool axis",
    )


def extract_undercuts_from_shape(shape) -> List[UndercutFeature]:
    """Detect undercuts from BREP shape using OCC face-normal accessibility.

    For each non-planar face, projects the face normal against the three
    principal axes (±X, ±Y, ±Z). If no axis can "see" the face (i.e., the
    maximum |dot(normal, axis)| < threshold), the face is inaccessible
    without 5-axis or special tooling → undercut.

    Uses BRepAdaptor_Surface for robust surface-type detection when available.
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer, topexp
        from OCC.Core.TopAbs import TopAbs_FACE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_Plane, Geom_CylindricalSurface
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.TopTools import TopTools_IndexedMapOfShape
        from OCC.Core.BRepTools import breptools_UVBounds
    except Exception:
        logger.warning("OCC imports unavailable for undercut detection")
        return []

    # Try importing BRepAdaptor for robust face-type detection
    adaptor_cls = None
    plane_type = None
    cylinder_type = None
    try:
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import GeomAbs_Plane, GeomAbs_Cylinder
        adaptor_cls = BRepAdaptor_Surface
        plane_type = GeomAbs_Plane
        cylinder_type = GeomAbs_Cylinder
    except Exception:
        pass

    face_map = TopTools_IndexedMapOfShape()
    topexp.MapShapes(shape, TopAbs_FACE, face_map)

    # Principal tool access directions
    access_dirs = [
        (1, 0, 0), (-1, 0, 0),
        (0, 1, 0), (0, -1, 0),
        (0, 0, 1), (0, 0, -1),
    ]

    undercuts: List[UndercutFeature] = []
    idx = 1

    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = exp.Current()
        exp.Next()
        result = _check_face_accessibility(
            face, access_dirs, BRep_Tool, Geom_Plane,
            Geom_CylindricalSurface, breptools_UVBounds,
            brepgprop_SurfaceProperties, GProp_GProps, face_map, idx,
            adaptor_cls=adaptor_cls, plane_type=plane_type,
            cylinder_type=cylinder_type,
        )
        if result is not None:
            undercuts.append(result)
            idx += 1

    logger.info("Undercut detection: found %d undercut(s)", len(undercuts))
    return undercuts


def detect_undercuts_from_mesh(mesh) -> List[UndercutFeature]:
    """Mesh-based undercut detection for STL files.

    Analyses face normal distribution to find clusters of normals that
    point away from all principal axes — indicating undercut regions.
    """
    try:
        import numpy as np
    except Exception:
        return []

    if mesh is None or not hasattr(mesh, 'face_normals'):
        return []

    normals = mesh.face_normals
    areas = mesh.area_faces if hasattr(mesh, 'area_faces') else None

    access_dirs = np.array([
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1],
    ], dtype=float)

    # Compute max accessibility for each face
    dots = np.abs(normals @ access_dirs.T)  # (n_faces, 6)
    max_access = dots.max(axis=1)  # (n_faces,)

    # Undercut threshold
    threshold = 0.3
    undercut_mask = max_access < threshold

    if not np.any(undercut_mask):
        return []

    undercuts: List[UndercutFeature] = []
    undercut_indices = np.nonzero(undercut_mask)[0]

    # Group nearby undercut faces into clusters (simplified: by max-access band)
    severe_mask = max_access[undercut_mask] < 0.1
    moderate_mask = (max_access[undercut_mask] >= 0.1) & (max_access[undercut_mask] < 0.2)
    minor_mask = max_access[undercut_mask] >= 0.2

    for severity, mask in [("severe", severe_mask), ("moderate", moderate_mask), ("minor", minor_mask)]:
        count = int(np.sum(mask))
        if count == 0:
            continue
        total_area = 0.0
        if areas is not None:
            total_area = float(np.sum(areas[undercut_indices[mask]]))

        undercuts.append(UndercutFeature(
            id=f"UC-{len(undercuts) + 1:03d}",
            undercut_type="internal",
            severity=severity,
            depth_mm=0.0,  # Can't determine from mesh
            width_mm=0.0,
            requires_special_tooling=severity in ("moderate", "severe"),
            face_ids=[],
            description=f"{count} triangle(s) inaccessible from standard tool axes (area ≈ {total_area:.1f} mm²)",
        ))

    logger.info("Mesh undercut detection: found %d region(s)", len(undercuts))
    return undercuts


def _severity_from_list(severities: List[str]) -> str:
    """Pick the worst severity from a list."""
    if "severe" in severities:
        return "severe"
    if "moderate" in severities:
        return "moderate"
    return "minor"


def undercuts_to_dfm_dict(undercuts: List[UndercutFeature]) -> Optional[Dict[str, Any]]:
    """Convert undercut list to the advancedFeatures.undercuts dict used by DFM."""
    if not undercuts:
        return None

    severities = [uc.severity for uc in undercuts]
    worst = _severity_from_list(severities)

    return {
        "count": len(undercuts),
        "severity": worst,
        "requires_special_tooling": any(uc.requires_special_tooling for uc in undercuts),
        "details": [
            {
                "id": uc.id,
                "type": uc.undercut_type,
                "severity": uc.severity,
                "depth_mm": uc.depth_mm,
                "width_mm": uc.width_mm,
                "description": uc.description,
            }
            for uc in undercuts
        ],
    }
