"""Fillet and chamfer detection.

Detects fillet (rounded) and chamfer (angled) edges from BREP shapes using
OCC edge-type analysis. Provides a mesh-based fallback using dihedral angle
analysis for STL files.
"""
from __future__ import annotations

import logging
import math
from typing import List

from ..models import FilletFeature

logger = logging.getLogger(__name__)


def _try_import_occ():
    """Attempt to import OCC modules for fillet detection.

    Returns a dict of OCC classes/functions on success, or ``None``.
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer, topexp
        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_ToroidalSurface, Geom_Plane
        from OCC.Core.TopTools import (
            TopTools_IndexedMapOfShape,
            TopTools_IndexedDataMapOfShapeListOfShape,
        )
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties
    except Exception:
        logger.warning("OCC imports unavailable for fillet/chamfer detection")
        return None

    result = {
        "TopExp_Explorer": TopExp_Explorer,
        "TopExp": topexp,
        "TopAbs_FACE": TopAbs_FACE,
        "TopAbs_EDGE": TopAbs_EDGE,
        "BRep_Tool": BRep_Tool,
        "Geom_ToroidalSurface": Geom_ToroidalSurface,
        "Geom_Plane": Geom_Plane,
        "TopTools_IndexedMapOfShape": TopTools_IndexedMapOfShape,
        "TopTools_IndexedDataMapOfShapeListOfShape": TopTools_IndexedDataMapOfShapeListOfShape,
        "GProp_GProps": GProp_GProps,
        "brepgprop_SurfaceProperties": brepgprop_SurfaceProperties,
    }

    # Add BRepAdaptor for robust surface-type detection
    try:
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import (
            GeomAbs_Torus, GeomAbs_Plane, GeomAbs_Cylinder,
            GeomAbs_Sphere, GeomAbs_Cone,
        )
        result["BRepAdaptor_Surface"] = BRepAdaptor_Surface
        result["GeomAbs_Torus"] = GeomAbs_Torus
        result["GeomAbs_Plane"] = GeomAbs_Plane
        result["GeomAbs_Cylinder"] = GeomAbs_Cylinder
        result["GeomAbs_Sphere"] = GeomAbs_Sphere
        result["GeomAbs_Cone"] = GeomAbs_Cone
    except Exception:
        pass

    return result


def _dot(a, b):
    """Dot product of two 3-element tuples."""
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _try_detect_fillet(face, surf, idx, fid, occ):
    """Check if *face* has a toroidal surface (indicating a fillet blend).

    Uses BRepAdaptor_Surface.GetType() for robust detection when available,
    falling back to Geom_ToroidalSurface.DownCast().
    
    Also classifies fillet by radius:
    - R3-R6mm: Typical CNC tool radius (is_tool_radius=True)
    - ≤R2mm: Sheet metal bend relief (is_bend_relief=True)
    """
    minor_r = None

    # Prefer BRepAdaptor_Surface for type detection
    BRepAdaptor = occ.get("BRepAdaptor_Surface")
    GeomAbs_Torus = occ.get("GeomAbs_Torus")
    if BRepAdaptor is not None and GeomAbs_Torus is not None:
        try:
            adaptor = BRepAdaptor(face)
            if adaptor.GetType() == GeomAbs_Torus:
                torus_obj = adaptor.Torus()
                minor_r = torus_obj.MinorRadius()
        except Exception:
            pass

    # Fallback to DownCast
    if minor_r is None:
        torus = occ["Geom_ToroidalSurface"].DownCast(surf)
        if torus is None:
            return None
        minor_r = torus.MinorRadius()

    props = occ["GProp_GProps"]()
    occ["brepgprop_SurfaceProperties"](face, props)
    area = float(props.Mass()) * 1e6
    # length ≈ area / (π × minor_r) for a quarter-round fillet
    length = area / max(math.pi * minor_r * 1e3 * 0.5, 0.01)

    radius_mm = float(minor_r * 1e3)  # m -> mm
    
    # Classify fillet by radius
    # R3-R6mm: Typical CNC tool radius (ball end mills, corner radius)
    # ≤R2mm: Sheet metal bend relief or edge break
    is_tool_radius = 3.0 <= radius_mm <= 6.0
    is_bend_relief = radius_mm <= 2.0

    return FilletFeature(
        id=f"FL-{idx:03d}",
        feature_type="fillet",
        radius_mm=radius_mm,
        length_mm=float(length),
        edge_id=fid,
        is_tool_radius=is_tool_radius,
        is_bend_relief=is_bend_relief,
    )


def _collect_neighbor_faces(face, edge_faces, occ):
    """Collect all faces adjacent to *face* via shared edges."""
    neighbors = []
    edge_exp = occ["TopExp_Explorer"](face, occ["TopAbs_EDGE"])
    while edge_exp.More():
        edge = edge_exp.Current()
        edge_exp.Next()
        if not edge_faces.Contains(edge):
            continue
        lst = edge_faces.FindFromKey(edge)
        try:
            faces = list(lst)
        except Exception:
            faces = []
        for f2 in faces:
            if not f2.IsSame(face):
                neighbors.append(f2)
    return neighbors


def _compute_avg_neighbor_angle(fn, neighbors, occ):
    """Return average angle between *fn* and the first two neighbor normals.

    Uses BRepAdaptor_Surface when available for robust plane detection.
    Returns ``None`` when fewer than two valid planar neighbours exist.
    """
    BRepAdaptor = occ.get("BRepAdaptor_Surface")
    GeomAbs_Plane = occ.get("GeomAbs_Plane")

    angle_sum = 0.0
    valid_count = 0
    for nf in neighbors[:2]:
        nnv = None
        # Prefer BRepAdaptor_Surface
        if BRepAdaptor is not None and GeomAbs_Plane is not None:
            try:
                adaptor = BRepAdaptor(nf)
                if adaptor.GetType() == GeomAbs_Plane:
                    pln = adaptor.Plane()
                    nn = pln.Axis().Direction()
                    nnv = (nn.X(), nn.Y(), nn.Z())
            except Exception:
                pass
        # Fallback to DownCast
        if nnv is None:
            nsurf = occ["BRep_Tool"].Surface(nf)
            np_ = occ["Geom_Plane"].DownCast(nsurf)
            if np_ is None:
                continue
            nn = np_.Pln().Axis().Direction()
            nnv = (nn.X(), nn.Y(), nn.Z())
        dot = abs(_dot(fn, nnv))
        angle_deg = math.degrees(math.acos(min(dot, 1.0)))
        angle_sum += angle_deg
        valid_count += 1

    if valid_count < 2:
        return None
    return angle_sum / valid_count


def _try_detect_chamfer(face, surf, area, idx, fid, edge_faces, occ):
    """Detect a chamfer: a small planar face bridging two faces at ~45°.

    Uses BRepAdaptor_Surface when available for robust plane detection.
    """
    fn = None
    BRepAdaptor = occ.get("BRepAdaptor_Surface")
    GeomAbs_Plane = occ.get("GeomAbs_Plane")

    if BRepAdaptor is not None and GeomAbs_Plane is not None:
        try:
            adaptor = BRepAdaptor(face)
            if adaptor.GetType() == GeomAbs_Plane:
                pln = adaptor.Plane()
                face_n = pln.Axis().Direction()
                fn = (face_n.X(), face_n.Y(), face_n.Z())
        except Exception:
            pass

    if fn is None:
        plane = occ["Geom_Plane"].DownCast(surf)
        if plane is None:
            return None
        face_n = plane.Pln().Axis().Direction()
        fn = (face_n.X(), face_n.Y(), face_n.Z())

    if area > 200:
        return None

    neighbors = _collect_neighbor_faces(face, edge_faces, occ)
    if len(neighbors) < 2:
        return None

    avg_angle = _compute_avg_neighbor_angle(fn, neighbors, occ)
    if avg_angle is None or not (30 <= avg_angle <= 60):
        return None

    leg = math.sqrt(area) * 0.7
    return FilletFeature(
        id=f"CH-{idx:03d}",
        feature_type="chamfer",
        radius_mm=float(leg),
        length_mm=float(math.sqrt(area)),
        edge_id=fid,
    )


def extract_fillets_from_shape(shape) -> List[FilletFeature]:
    """Detect fillets and chamfers from BREP shape.

    Fillets are identified as edges adjacent to toroidal surfaces (constant-
    radius blends). Chamfers are identified as narrow planar faces connecting
    two faces at ~45 degrees.
    """
    occ = _try_import_occ()
    if occ is None:
        return []

    top_exp = occ["TopExp"]
    face_map = occ["TopTools_IndexedMapOfShape"]()
    top_exp.MapShapes(shape, occ["TopAbs_FACE"], face_map)

    edge_faces = occ["TopTools_IndexedDataMapOfShapeListOfShape"]()
    top_exp.MapShapesAndAncestors(
        shape, occ["TopAbs_EDGE"], occ["TopAbs_FACE"], edge_faces
    )

    features: List[FilletFeature] = []
    idx = 1
    seen_faces = set()

    exp = occ["TopExp_Explorer"](shape, occ["TopAbs_FACE"])
    while exp.More():
        face = exp.Current()
        exp.Next()
        fid = face_map.FindIndex(face)
        if fid in seen_faces:
            continue

        surf = occ["BRep_Tool"].Surface(face)

        fillet = _try_detect_fillet(face, surf, idx, fid, occ)
        if fillet is not None:
            seen_faces.add(fid)
            features.append(fillet)
            idx += 1
            continue

        # Compute face area for chamfer candidate screening
        props = occ["GProp_GProps"]()
        occ["brepgprop_SurfaceProperties"](face, props)
        area = float(props.Mass()) * 1e6  # mm^2

        chamfer = _try_detect_chamfer(face, surf, area, idx, fid, edge_faces, occ)
        if chamfer is not None:
            seen_faces.add(fid)
            features.append(chamfer)
            idx += 1

    logger.info("Fillet/chamfer detection: found %d feature(s)", len(features))
    return features


def detect_fillets_from_mesh(mesh) -> List[FilletFeature]:
    """Mesh-based fillet/chamfer detection for STL files.

    Uses dihedral angle analysis between adjacent triangles. A cluster of
    edges with dihedral angles in the 120-170° range (fillet) or exactly
    ~135° (chamfer) indicates a blend feature.
    """
    try:
        import numpy as np
    except Exception:
        return []

    if mesh is None or not hasattr(mesh, 'face_adjacency'):
        return []

    try:
        face_adj = mesh.face_adjacency
        adj_angles = mesh.face_adjacency_angles
    except Exception:
        return []

    features: List[FilletFeature] = []
    idx = 1

    # Convert to degrees
    angles_deg = np.degrees(adj_angles)

    # Fillet signatures: dihedral angles between 100-170 degrees (smooth blend)
    fillet_mask = (angles_deg >= 100) & (angles_deg <= 170)
    fillet_edges = face_adj[fillet_mask]

    if len(fillet_edges) == 0:
        return features

    # Estimate: if < 5% of edges have fillet-range angles, those are actual fillets
    fillet_ratio = np.sum(fillet_mask) / max(len(angles_deg), 1)
    if fillet_ratio > 0.3:
        return features  # Too many — probably just a curved part, not discrete fillets

    # Chamfer: exactly ~135 degrees
    chamfer_mask = (angles_deg >= 130) & (angles_deg <= 140)
    chamfer_count = int(np.sum(chamfer_mask))
    fillet_only_mask = fillet_mask & ~chamfer_mask
    fillet_count = int(np.sum(fillet_only_mask))

    if fillet_count > 0:
        fillet_angles = angles_deg[fillet_only_mask]
        avg_angle = float(np.mean(fillet_angles))
        # Estimate radius from typical fillet arc: R ≈ edge_length / (2 * sin(half_angle))
        avg_edge_len = float(np.mean(mesh.edges_unique_length)) if hasattr(mesh, 'edges_unique_length') else 1.0
        half_angle = math.radians((180 - avg_angle) / 2)
        radius_est = avg_edge_len / max(2 * math.sin(half_angle), 0.01)

        features.append(FilletFeature(
            id=f"FL-{idx:03d}",
            feature_type="fillet",
            radius_mm=float(min(radius_est, 50)),  # cap at 50mm
            length_mm=float(fillet_count * avg_edge_len),
        ))
        idx += 1

    if chamfer_count > 0:
        avg_edge_len = float(np.mean(mesh.edges_unique_length)) if hasattr(mesh, 'edges_unique_length') else 1.0
        features.append(FilletFeature(
            id=f"CH-{idx:03d}",
            feature_type="chamfer",
            radius_mm=float(avg_edge_len * 0.7),
            length_mm=float(chamfer_count * avg_edge_len),
        ))

    logger.info(f"Mesh fillet/chamfer detection: found {len(features)} feature(s)")
    return features
