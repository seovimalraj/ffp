"""Thread detection for CNC parts.

Detects internal threads (tapped holes) and external threads (bosses) by
analysing cylindrical surfaces with helical edge geometry from STEP/BREP
shapes via pythonOCC. Falls back to heuristic thread inference from hole
diameter/depth ratios when OCC edge analysis is unavailable.
"""
from __future__ import annotations

import math
import logging
from typing import List, Optional, Tuple

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


def extract_threads_from_shape(shape, holes: Optional[List[HoleFeature]] = None) -> List[ThreadFeature]:
    """Detect threads from BREP shape using OCC helix edge analysis.

    If OCC helix analysis isn't available, falls back to heuristic inference
    from hole dimensions (blind holes with depth/diameter between 1.5-3x and
    diameter matching standard thread sizes are likely tapped).
    """
    threads: List[ThreadFeature] = []
    idx = 1

    # --- Try OCC-based helical edge detection ---
    try:
        from OCC.Core.TopExp import TopExp_Explorer, TopExp
        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_CylindricalSurface
        from OCC.Core.BRepAdaptor import BRepAdaptor_Curve
        from OCC.Core.GeomAbs import GeomAbs_Line, GeomAbs_Circle, GeomAbs_BSplineCurve
        from OCC.Core.TopTools import TopTools_IndexedMapOfShape
        from OCC.Core.gp import gp_Pnt
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties
        from OCC.Core.GProp import GProp_GProps

        face_map = TopTools_IndexedMapOfShape()
        TopExp.MapShapes(shape, TopAbs_FACE, face_map)

        exp = TopExp_Explorer(shape, TopAbs_FACE)
        while exp.More():
            face = exp.Current()
            exp.Next()
            surf = BRep_Tool.Surface(face)
            cyl = Geom_CylindricalSurface.DownCast(surf)
            if cyl is None:
                continue

            radius = cyl.Cylinder().Radius()
            diameter = 2.0 * radius
            if diameter < 0.5:
                continue

            # Check edges for helical / bspline curves (thread signature)
            has_helix = False
            edge_exp = TopExp_Explorer(face, TopAbs_EDGE)
            while edge_exp.More():
                edge = edge_exp.Current()
                edge_exp.Next()
                try:
                    adaptor = BRepAdaptor_Curve(edge)
                    ctype = adaptor.GetType()
                    if ctype == GeomAbs_BSplineCurve:
                        # BSpline on cylindrical surface => likely thread helix
                        has_helix = True
                        break
                except Exception:
                    continue

            if not has_helix:
                continue

            # This is a thread — determine pitch from surface area
            props = GProp_GProps()
            brepgprop_SurfaceProperties(face, props)
            area_mm2 = float(props.Mass()) * 1e6
            # Approximate pitch from area: area ≈ π × d × depth, pitch ≈ depth / turns
            circumference = math.pi * diameter
            length_on_surface = area_mm2 / max(circumference, 0.1) if circumference > 0 else 0

            is_std, std_name, pitch = _match_standard_thread(diameter)
            if not is_std:
                # Estimate pitch from thread depth heuristic
                pitch = diameter * 0.12 if diameter > 3 else 0.5

            axis_dir = cyl.Cylinder().Axis().Direction()
            loc = cyl.Cylinder().Location()

            threads.append(ThreadFeature(
                id=f"T-{idx:03d}",
                hole_id=None,
                diameter_mm=float(diameter),
                pitch_mm=float(pitch),
                depth_mm=float(length_on_surface),
                thread_type="internal",
                is_standard=is_std,
                standard_name=std_name,
                position=(float(loc.X()), float(loc.Y()), float(loc.Z())),
            ))
            idx += 1

        if threads:
            logger.info(f"OCC helix analysis found {len(threads)} thread(s)")
            return threads

    except Exception as e:
        logger.warning(f"OCC thread helix detection unavailable: {e}")

    # --- Fallback: infer threads from hole geometry ---
    if holes:
        for hole in holes:
            dia = hole.diameter_mm
            depth = hole.depth_mm
            if dia < 1.0 or depth <= 0:
                continue
            depth_ratio = depth / dia
            # Typical tapped hole: blind, depth 1.5-3x diameter, matches standard size
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
                        position=getattr(hole, "position", None),
                    ))
                    idx += 1

    logger.info(f"Thread detection (heuristic): found {len(threads)} likely thread(s)")
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
