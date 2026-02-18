"""Thread detection for CNC parts.

Detects internal threads (tapped holes) and external threads (bosses) by
analysing cylindrical surfaces with helical edge geometry from STEP/BREP
shapes via pythonOCC. Falls back to heuristic thread inference from hole
diameter/depth ratios when OCC edge analysis is unavailable.
"""
from __future__ import annotations

import math
import logging
from typing import List, Literal, Optional, Tuple

from ..models import HoleFeature, ThreadFeature

logger = logging.getLogger(__name__)

# ISO metric thread table: nominal diameter -> standard pitch (coarse)
ISO_METRIC_THREADS = {
    1.0: 0.25, 1.2: 0.25, 1.4: 0.3, 1.6: 0.35, 1.8: 0.35,
    2.0: 0.4, 2.5: 0.45, 3.0: 0.5, 3.5: 0.6, 4.0: 0.7,
    5.0: 0.8, 6.0: 1.0, 7.0: 1.0, 8.0: 1.25, 10.0: 1.5,
    12.0: 1.75, 14.0: 2.0, 16.0: 2.0, 18.0: 2.5, 20.0: 2.5,
    22.0: 2.5, 24.0: 3.0, 27.0: 3.0, 30.0: 3.5, 33.0: 3.5,
    36.0: 4.0, 39.0: 4.0, 42.0: 4.5, 45.0: 4.5, 48.0: 5.0,
}

# UNC thread table: nominal diameter (mm) -> pitch (mm)
UNC_THREADS = {
    6.35: 1.27,    # 1/4-20
    7.94: 1.41,    # 5/16-18
    9.53: 1.59,    # 3/8-16
    11.11: 1.81,   # 7/16-14
    12.70: 1.95,   # 1/2-13
    15.88: 2.31,   # 5/8-11
    19.05: 2.54,   # 3/4-10
    25.40: 3.18,   # 1-8
}


def _match_standard_thread(diameter_mm: float) -> Tuple[bool, Optional[str], float]:
    """Try to match a diameter to a standard thread size.

    Returns (is_standard, standard_name, pitch_mm).
    """
    tolerance = 0.15  # mm tolerance for matching
    # Check ISO metric
    for nom_dia, pitch in ISO_METRIC_THREADS.items():
        # Thread minor diameter is roughly nom - pitch
        minor = nom_dia - pitch
        if abs(diameter_mm - minor) < tolerance or abs(diameter_mm - nom_dia) < tolerance:
            return True, f"M{nom_dia}x{pitch}", pitch
    # Check UNC
    for nom_dia, pitch in UNC_THREADS.items():
        minor = nom_dia - pitch
        if abs(diameter_mm - minor) < tolerance or abs(diameter_mm - nom_dia) < tolerance:
            inch_frac = nom_dia / 25.4
            return True, f"UNC {inch_frac:.3f}\"", pitch
    return False, None, 0.0


def _detect_thread_from_face(
    face, brep_tool, geom_cyl_surface, gprop_cls,
    surface_props_fn, geom_bspline_curve, topabs_edge,
    idx: int,
) -> Optional[ThreadFeature]:
    """Analyse a single BREP face for thread signature. Returns ThreadFeature or None."""
    from OCC.Core.TopExp import TopExp_Explorer
    from OCC.Core.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface

    surf = brep_tool.Surface(face)
    cyl = geom_cyl_surface.DownCast(surf)
    if cyl is None:
        return None

    radius = cyl.Cylinder().Radius()
    diameter = 2.0 * radius
    if diameter < 0.5:
        return None

    # Check edges for helical / bspline curves (thread signature)
    has_helix = False
    edge_exp = TopExp_Explorer(face, topabs_edge)
    while edge_exp.More():
        edge = edge_exp.Current()
        edge_exp.Next()
        try:
            adaptor = BRepAdaptor_Curve(edge)
            if adaptor.GetType() == geom_bspline_curve:
                has_helix = True
                break
        except Exception:
            continue

    if not has_helix:
        return None
    
    # GAP 9 FIX: Detect internal vs external thread using surface normal
    # Internal threads (tapped holes): normal points toward axis (concave surface)
    # External threads (bolts): normal points away from axis (convex surface)
    thread_type: Literal["internal", "external"] = "internal"  # Default assumption
    try:
        from OCC.Core.GeomLProp import GeomLProp_SLProps
        
        adaptor_surf = BRepAdaptor_Surface(face)
        u_mid = (adaptor_surf.FirstUParameter() + adaptor_surf.LastUParameter()) / 2
        v_mid = (adaptor_surf.FirstVParameter() + adaptor_surf.LastVParameter()) / 2
        props_sl = GeomLProp_SLProps(surf, u_mid, v_mid, 1, 1e-6)
        if props_sl.IsNormalDefined():
            normal = props_sl.Normal()
            # Get point on surface and axis location
            pnt = adaptor_surf.Value(u_mid, v_mid)
            axis = cyl.Cylinder().Axis()
            axis_loc = axis.Location()
            axis_dir = axis.Direction()
            axis_vec = (axis_dir.X(), axis_dir.Y(), axis_dir.Z())
            
            # Vector from axis to point on surface
            to_point = (pnt.X() - axis_loc.X(), pnt.Y() - axis_loc.Y(), pnt.Z() - axis_loc.Z())
            # Project out axis component to get radial direction
            dot_axis = to_point[0]*axis_vec[0] + to_point[1]*axis_vec[1] + to_point[2]*axis_vec[2]
            radial = (to_point[0] - dot_axis*axis_vec[0], 
                      to_point[1] - dot_axis*axis_vec[1], 
                      to_point[2] - dot_axis*axis_vec[2])
            # Dot product of normal with radial direction
            # External: normal points outward (same as radial) - bolts, studs
            # Internal: normal points inward (opposite to radial) - tapped holes
            normal_dot_radial = (normal.X()*radial[0] + normal.Y()*radial[1] + normal.Z()*radial[2])
            thread_type = "external" if normal_dot_radial > 0 else "internal"
    except Exception:
        pass  # Keep default "internal" on error

    # Determine pitch from surface area
    props = gprop_cls()
    surface_props_fn(face, props)
    area_mm2 = float(props.Mass()) * 1e6
    circumference = math.pi * diameter
    length_on_surface = area_mm2 / max(circumference, 0.1) if circumference > 0 else 0

    is_std, std_name, pitch = _match_standard_thread(diameter)
    if not is_std:
        pitch = diameter * 0.12 if diameter > 3 else 0.5

    loc = cyl.Cylinder().Location()
    return ThreadFeature(
        id=f"T-{idx:03d}",
        hole_id=None,
        diameter_mm=float(diameter),
        pitch_mm=float(pitch),
        depth_mm=float(length_on_surface),
        thread_type=thread_type,  # GAP 9 FIX: Use detected internal/external
        is_standard=is_std,
        standard_name=std_name,
        position=(float(loc.X()), float(loc.Y()), float(loc.Z())),
    )


def _infer_threads_from_holes(holes: List[HoleFeature], start_idx: int) -> List[ThreadFeature]:
    """Heuristic thread inference from blind holes with standard diameters."""
    threads: List[ThreadFeature] = []
    idx = start_idx
    for hole in holes:
        dia = hole.diameter_mm
        depth = hole.depth_mm
        if dia < 1.0 or depth <= 0:
            continue
        depth_ratio = depth / dia
        if hole.type != "blind" or not (1.0 <= depth_ratio <= 4.0):
            continue
        is_std, std_name, pitch = _match_standard_thread(dia)
        if is_std:
            threads.append(ThreadFeature(
                id=f"T-{idx:03d}",
                hole_id=hole.id,
                diameter_mm=dia,
                pitch_mm=pitch,
                depth_mm=depth,
                thread_type="internal",
                is_standard=True,
                standard_name=std_name,
                position=getattr(hole, "position", None),
            ))
            idx += 1
    return threads


def extract_threads_from_shape(shape, holes: Optional[List[HoleFeature]] = None) -> List[ThreadFeature]:
    """Detect threads from BREP shape using OCC helix edge analysis.

    Falls back to heuristic inference from hole dimensions.
    """
    threads: List[ThreadFeature] = []
    idx = 1

    try:
        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_CylindricalSurface
        from OCC.Core.GeomAbs import GeomAbs_BSplineCurve
        from OCC.Core.TopTools import TopTools_IndexedMapOfShape
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.TopExp import TopExp_Explorer

        exp = TopExp_Explorer(shape, TopAbs_FACE)
        while exp.More():
            face = exp.Current()
            exp.Next()
            tf = _detect_thread_from_face(
                face, BRep_Tool, Geom_CylindricalSurface,
                GProp_GProps, brepgprop_SurfaceProperties,
                GeomAbs_BSplineCurve, TopAbs_EDGE, idx,
            )
            if tf is not None:
                threads.append(tf)
                idx += 1

        if threads:
            logger.info("OCC helix analysis found %d thread(s)", len(threads))
            return threads

    except Exception:
        logger.exception("OCC thread helix detection failed")

    if holes:
        threads = _infer_threads_from_holes(holes, idx)

    logger.info("Thread detection (heuristic): found %d likely thread(s)", len(threads))
    return threads


def extract_threads_from_mesh(mesh, holes: Optional[List[HoleFeature]] = None) -> List[ThreadFeature]:
    """Mesh-based thread detection for STL files.

    STL mesh has no edge-level data so thread detection relies purely on hole
    heuristics (standard diameter + blind type + appropriate depth ratio).
    """
    if not holes:
        return []
    threads: List[ThreadFeature] = []
    idx = 1
    for hole in holes:
        dia = hole.diameter_mm
        depth = hole.depth_mm
        if dia < 1.0 or depth <= 0:
            continue
        depth_ratio = depth / dia
        if hole.type == "blind" and 1.0 <= depth_ratio <= 4.0:
            is_std, std_name, pitch = _match_standard_thread(dia)
            if is_std:
                threads.append(ThreadFeature(
                    id=f"T-{idx:03d}",
                    hole_id=hole.id,
                    diameter_mm=dia,
                    pitch_mm=pitch,
                    depth_mm=depth,
                    thread_type="internal",
                    is_standard=True,
                    standard_name=std_name,
                ))
                idx += 1
    return threads
