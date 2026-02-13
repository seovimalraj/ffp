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


def extract_fillets_from_shape(shape) -> List[FilletFeature]:
    """Detect fillets and chamfers from BREP shape.

    Fillets are identified as edges adjacent to toroidal surfaces (constant-
    radius blends). Chamfers are identified as narrow planar faces connecting
    two faces at ~45 degrees.
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core import TopExp

        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_ToroidalSurface, Geom_Plane, Geom_CylindricalSurface
        from OCC.Core.TopTools import (
            TopTools_IndexedMapOfShape,
            TopTools_IndexedDataMapOfShapeListOfShape,
        )
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties, brepgprop_LinearProperties
        from OCC.Core.BRepAdaptor import BRepAdaptor_Curve
    except Exception:
        logger.warning("OCC imports unavailable for fillet/chamfer detection")
        return []

    face_map = TopTools_IndexedMapOfShape()
    TopExp.MapShapes(shape, TopAbs_FACE, face_map)

    edge_faces = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_faces)

    def _dot(a, b):
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    features: List[FilletFeature] = []
    idx = 1
    seen_faces = set()

    # --- Detect fillets (toroidal blend surfaces) ---
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = exp.Current()
        exp.Next()
        fid = face_map.FindIndex(face)
        if fid in seen_faces:
            continue

        surf = BRep_Tool.Surface(face)
        torus = Geom_ToroidalSurface.DownCast(surf)
        if torus is not None:
            seen_faces.add(fid)
            minor_r = torus.MinorRadius()
            # Compute edge length to estimate fillet extent
            props = GProp_GProps()
            brepgprop_SurfaceProperties(face, props)
            area = float(props.Mass()) * 1e6
            # length ≈ area / (π × minor_r) for a quarter-round fillet
            length = area / max(math.pi * minor_r * 1e3 * 0.5, 0.01)

            features.append(FilletFeature(
                id=f"FL-{idx:03d}",
                feature_type="fillet",
                radius_mm=float(minor_r * 1e3),  # m -> mm
                length_mm=float(length),
                edge_id=fid,
            ))
            idx += 1
            continue

        # --- Detect chamfers (narrow planar face between two larger faces) ---
        plane = Geom_Plane.DownCast(surf)
        if plane is None:
            continue

        props = GProp_GProps()
        brepgprop_SurfaceProperties(face, props)
        area = float(props.Mass()) * 1e6  # mm^2

        # Chamfer faces are typically small/narrow
        if area > 200:  # skip large faces
            continue

        # Collect neighbors
        neighbors = []
        edge_exp = TopExp_Explorer(face, TopAbs_EDGE)
        while edge_exp.More():
            edge = edge_exp.Current()
            edge_exp.Next()
            if edge_faces.Contains(edge):
                lst = edge_faces.FindFromKey(edge)
                it = lst.cbegin()
                while it.More():
                    f2 = it.Value()
                    it.Next()
                    if not f2.IsSame(face):
                        neighbors.append(f2)

        if len(neighbors) < 2:
            continue

        # Check if face bridges two neighbors at ~45 deg
        face_n = plane.Pln().Axis().Direction()
        fn = (face_n.X(), face_n.Y(), face_n.Z())

        angle_sum = 0.0
        valid_neighbors = 0
        for nf in neighbors[:2]:
            nsurf = BRep_Tool.Surface(nf)
            np_ = Geom_Plane.DownCast(nsurf)
            if np_ is None:
                continue
            nn = np_.Pln().Axis().Direction()
            nnv = (nn.X(), nn.Y(), nn.Z())
            dot = abs(_dot(fn, nnv))
            angle_deg = math.degrees(math.acos(min(dot, 1.0)))
            angle_sum += angle_deg
            valid_neighbors += 1

        if valid_neighbors >= 2:
            avg_angle = angle_sum / valid_neighbors
            if 30 <= avg_angle <= 60:
                # Chamfer leg size ≈ sqrt(area / length)
                # Approximate length from first edge
                leg = math.sqrt(area) * 0.7  # rough estimate
                seen_faces.add(fid)
                features.append(FilletFeature(
                    id=f"CH-{idx:03d}",
                    feature_type="chamfer",
                    radius_mm=float(leg),
                    length_mm=float(math.sqrt(area)),
                    edge_id=fid,
                ))
                idx += 1

    logger.info(f"Fillet/chamfer detection: found {len(features)} feature(s)")
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
