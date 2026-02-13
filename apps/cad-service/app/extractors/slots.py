"""Slot detection for CNC parts.

Detects elongated pockets with parallel walls (slots) from BREP shapes
via pythonOCC. Falls back to mesh-based detection using bounding-box
analysis of narrow pocket regions.
"""
from __future__ import annotations

import logging
import math
from typing import List, Optional

from ..models import SlotFeature, PocketFeature

logger = logging.getLogger(__name__)


def extract_slots_from_shape(shape) -> List[SlotFeature]:
    """Detect slots from BREP shape using OCC face adjacency analysis.

    A slot is identified as a planar floor face with exactly two parallel
    planar side walls whose normals are anti-parallel, plus optional
    end-cap faces (for blind slots) or through openings.
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core import TopExp

        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_Plane
        from OCC.Core.BRepTools import breptools_UVBounds
        from OCC.Core.TopTools import (
            TopTools_IndexedMapOfShape,
            TopTools_IndexedDataMapOfShapeListOfShape,
        )
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.BRepGProp import brepgprop_SurfaceProperties, brepgprop_LinearProperties
    except Exception:
        logger.warning("OCC imports unavailable for slot extraction")
        return []

    face_map = TopTools_IndexedMapOfShape()
    TopExp.MapShapes(shape, TopAbs_FACE, face_map)

    edge_faces = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_faces)

    slots: List[SlotFeature] = []
    idx = 1

    def _dot(a, b):
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    def _normal_vec(face):
        surf = BRep_Tool.Surface(face)
        plane = Geom_Plane.DownCast(surf)
        if plane is None:
            return None
        d = plane.Pln().Axis().Direction()
        return (d.X(), d.Y(), d.Z())

    def _face_area(face) -> float:
        props = GProp_GProps()
        brepgprop_SurfaceProperties(face, props)
        return float(props.Mass()) * 1e6  # m^2 -> mm^2

    def _face_dims(face):
        """Return (u_span, v_span) of face parameter bounds."""
        try:
            umin, umax, vmin, vmax = breptools_UVBounds(face)
            return abs(umax - umin), abs(vmax - vmin)
        except Exception:
            return 0.0, 0.0

    # Iterate floor candidates (planar faces)
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        floor_face = exp.Current()
        exp.Next()
        floor_normal = _normal_vec(floor_face)
        if floor_normal is None:
            continue

        # Collect neighbors
        neighbors = set()
        edge_exp = TopExp_Explorer(floor_face, TopAbs_EDGE)
        while edge_exp.More():
            edge = edge_exp.Current()
            edge_exp.Next()
            if edge_faces.Contains(edge):
                lst = edge_faces.FindFromKey(edge)
                it = lst.cbegin()
                while it.More():
                    f2 = it.Value()
                    it.Next()
                    if not f2.IsSame(floor_face):
                        neighbors.add(f2)

        # Find walls perpendicular to floor
        walls = []
        for nf in neighbors:
            nv = _normal_vec(nf)
            if nv is None:
                continue
            if abs(_dot(floor_normal, nv)) <= 0.15:  # perpendicular
                walls.append((nf, nv))

        if len(walls) < 2:
            continue

        # Find anti-parallel wall pairs (slot signature)
        for i in range(len(walls)):
            for j in range(i + 1, len(walls)):
                f1, n1 = walls[i]
                f2, n2 = walls[j]
                if _dot(n1, n2) < -0.9:  # anti-parallel
                    # This looks like a slot — compute dimensions
                    floor_u, floor_v = _face_dims(floor_face)
                    wall_u1, wall_v1 = _face_dims(f1)
                    wall_u2, wall_v2 = _face_dims(f2)

                    # Slot length = longer floor param bound
                    # Slot depth = wall height, Slot width = shorter floor param bound
                    length = max(floor_u, floor_v)
                    width = min(floor_u, floor_v)
                    depth = max(wall_u1, wall_v1, wall_u2, wall_v2)

                    # Skip if not elongated (slot should be at least 2x longer than wide)
                    if width <= 0 or length / max(width, 0.01) < 1.8:
                        continue

                    # Determine slot type
                    # Count end-cap faces (non-floor, non-wall neighbors perpendicular to length axis)
                    end_caps = len(neighbors) - 2  # subtract the two walls
                    if end_caps >= 2:
                        slot_type = "blind"
                    else:
                        slot_type = "through"

                    fid1 = face_map.FindIndex(floor_face)
                    fid2 = face_map.FindIndex(f1)
                    fid3 = face_map.FindIndex(f2)

                    slots.append(SlotFeature(
                        id=f"SL-{idx:03d}",
                        length_mm=float(length),
                        width_mm=float(width),
                        depth_mm=float(depth),
                        slot_type=slot_type,
                        orientation=floor_normal,
                        face_ids=[int(fid1), int(fid2), int(fid3)],
                    ))
                    idx += 1

    logger.info(f"Slot detection: found {len(slots)} slot(s)")
    return slots


def extract_slots_from_pockets(pockets: List[PocketFeature]) -> List[SlotFeature]:
    """Infer slot features from pockets with high aspect ratios.

    Used as fallback for STL files or when OCC analysis is unavailable.
    A pocket with aspect ratio >= 3.0 and mouth_area indicating elongated
    shape is classified as a slot.
    """
    slots: List[SlotFeature] = []
    idx = 1
    for pocket in pockets:
        if pocket.aspect_ratio < 3.0 and pocket.mouth_area_mm2 > 0:
            continue
        # Estimate length/width from mouth area + aspect ratio
        if pocket.mouth_area_mm2 > 0 and pocket.aspect_ratio >= 3.0:
            width = math.sqrt(pocket.mouth_area_mm2 / max(pocket.aspect_ratio, 1.0))
            length = width * pocket.aspect_ratio
        else:
            continue

        slots.append(SlotFeature(
            id=f"SL-{idx:03d}",
            length_mm=float(length),
            width_mm=float(width),
            depth_mm=float(pocket.depth_mm),
            slot_type="blind" if pocket.depth_mm > 0 else "through",
            face_ids=pocket.planar_face_ids,
        ))
        idx += 1
    return slots
