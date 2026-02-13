"""Undercut detection for CNC parts.

Identifies internal/external undercuts — regions that are inaccessible to
standard 3-axis end mills. Detection uses face-normal analysis from OCC
shapes with a mesh-based fallback that checks face-normal distribution for
inward-facing concavities.
"""
from __future__ import annotations

import logging
import math
from typing import List, Dict, Any

from ..models import UndercutFeature

logger = logging.getLogger(__name__)


def extract_undercuts_from_shape(shape) -> List[UndercutFeature]:
    """Detect undercuts from BREP shape using OCC face-normal accessibility.

    For each non-planar face, projects the face normal against the three
    principal axes (±X, ±Y, ±Z). If no axis can "see" the face (i.e., the
    maximum |dot(normal, axis)| < threshold), the face is inaccessible
    without 5-axis or special tooling → undercut.
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core import TopExp
        
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

    face_map = TopTools_IndexedMapOfShape()
    TopExp.MapShapes(shape, TopAbs_FACE, face_map)

    # Principal tool access directions
    access_dirs = [
        (1, 0, 0), (-1, 0, 0),
        (0, 1, 0), (0, -1, 0),
        (0, 0, 1), (0, 0, -1),
    ]

    def _dot(a, b):
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    undercuts: List[UndercutFeature] = []
    idx = 1

    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = exp.Current()
        exp.Next()
        surf = BRep_Tool.Surface(face)

        # Skip planar faces (these are accessible from normal direction)
        if Geom_Plane.DownCast(surf) is not None:
            continue

        # Skip simple cylinders (accessible for milling/turning)
        cyl = Geom_CylindricalSurface.DownCast(surf)
        if cyl is not None:
            continue

        # For non-planar, non-cylindrical faces: sample normal at face center
        try:
            umin, umax, vmin, vmax = breptools_UVBounds(face)
            u_mid = (umin + umax) / 2
            v_mid = (vmin + vmax) / 2
            pnt = surf.Value(u_mid, v_mid)
            # Compute normal at center via D1
            d1u = surf.DN(u_mid, v_mid, 1, 0)
            d1v = surf.DN(u_mid, v_mid, 0, 1)
            # Cross product for normal
            nx = d1u.Y() * d1v.Z() - d1u.Z() * d1v.Y()
            ny = d1u.Z() * d1v.X() - d1u.X() * d1v.Z()
            nz = d1u.X() * d1v.Y() - d1u.Y() * d1v.X()
            mag = math.sqrt(nx * nx + ny * ny + nz * nz)
            if mag < 1e-10:
                continue
            normal = (nx / mag, ny / mag, nz / mag)
        except Exception:
            continue

        # Check accessibility from principal directions
        max_access = max(abs(_dot(normal, d)) for d in access_dirs)

        if max_access < 0.3:
            # This face can't be reached by standard 3-axis tooling
            props = GProp_GProps()
            brepgprop_SurfaceProperties(face, props)
            area_mm2 = float(props.Mass()) * 1e6

            # Estimate depth/width from param bounds
            u_span = abs(umax - umin)
            v_span = abs(vmax - vmin)
            depth = min(u_span, v_span)
            width = max(u_span, v_span)

            # Determine severity based on accessibility
            if max_access < 0.1:
                severity = "severe"
            elif max_access < 0.2:
                severity = "moderate"
            else:
                severity = "minor"

            fid = face_map.FindIndex(face)
            undercuts.append(UndercutFeature(
                id=f"UC-{idx:03d}",
                undercut_type="internal" if area_mm2 < 500 else "external",
                severity=severity,
                depth_mm=float(depth),
                width_mm=float(width),
                requires_special_tooling=severity in ("moderate", "severe"),
                face_ids=[int(fid)],
                description=f"Face at angle {math.degrees(math.acos(max_access)):.0f}° from nearest tool axis",
            ))
            idx += 1

    logger.info(f"Undercut detection: found {len(undercuts)} undercut(s)")
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
    undercut_indices = np.where(undercut_mask)[0]

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

    logger.info(f"Mesh undercut detection: found {len(undercuts)} region(s)")
    return undercuts


def undercuts_to_dfm_dict(undercuts: List[UndercutFeature]) -> Dict[str, Any]:
    """Convert undercut list to the advancedFeatures.undercuts dict used by DFM."""
    if not undercuts:
        return None

    severities = [uc.severity for uc in undercuts]
    worst = "severe" if "severe" in severities else ("moderate" if "moderate" in severities else "minor")

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
