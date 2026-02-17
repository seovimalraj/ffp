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


def _dot3(a, b):
    """Dot product of two 3-tuples."""
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _plane_normal(face, brep_tool, geom_plane, adaptor_cls=None, plane_type=None):
    """Return the planar normal of *face* as a 3-tuple, or ``None``.

    Uses BRepAdaptor_Surface when available for robust type detection.
    """
    # Prefer BRepAdaptor_Surface
    if adaptor_cls is not None and plane_type is not None:
        try:
            adaptor = adaptor_cls(face)
            if adaptor.GetType() == plane_type:
                pln = adaptor.Plane()
                d = pln.Axis().Direction()
                return (d.X(), d.Y(), d.Z())
        except Exception:
            pass
    # Fallback to DownCast
    surf = brep_tool.Surface(face)
    plane = geom_plane.DownCast(surf)
    if plane is None:
        return None
    d = plane.Pln().Axis().Direction()
    return (d.X(), d.Y(), d.Z())


def _face_uv_spans(face, uv_bounds_fn):
    """Return ``(u_span, v_span)`` of the face parameter bounds."""
    try:
        umin, umax, vmin, vmax = uv_bounds_fn(face)
        return abs(umax - umin), abs(vmax - vmin)
    except Exception:
        return 0.0, 0.0


def _collect_edge_neighbors(floor_face, edge_faces, explorer_cls, edge_type):
    """Return the set of faces sharing an edge with *floor_face*."""
    neighbors: set = set()
    edge_exp = explorer_cls(floor_face, edge_type)
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
            if not f2.IsSame(floor_face):
                neighbors.add(f2)
    return neighbors


def _find_perp_walls(floor_normal, neighbors, brep_tool, geom_plane,
                     adaptor_cls=None, plane_type=None):
    """Return list of ``(face, normal)`` for neighbor faces perpendicular to *floor_normal*.

    Uses BRepAdaptor_Surface when available for robust face-type detection.
    """
    walls = []
    for nf in neighbors:
        nv = _plane_normal(nf, brep_tool, geom_plane,
                          adaptor_cls=adaptor_cls, plane_type=plane_type)
        if nv is not None and abs(_dot3(floor_normal, nv)) <= 0.15:
            walls.append((nf, nv))
    return walls


def _build_slot(
    f1, n1, f2, n2,
    floor_face, floor_normal, neighbors,
    face_map, uv_bounds_fn, idx,
) -> Optional[SlotFeature]:
    """Try to build a ``SlotFeature`` from an anti-parallel wall pair."""
    if _dot3(n1, n2) >= -0.9:
        return None

    floor_u, floor_v = _face_uv_spans(floor_face, uv_bounds_fn)
    wall_u1, wall_v1 = _face_uv_spans(f1, uv_bounds_fn)
    wall_u2, wall_v2 = _face_uv_spans(f2, uv_bounds_fn)

    length = max(floor_u, floor_v)
    width = min(floor_u, floor_v)
    depth = max(wall_u1, wall_v1, wall_u2, wall_v2)

    if width <= 0 or length / max(width, 0.01) < 1.8:
        return None

    end_caps = len(neighbors) - 2
    slot_type = "blind" if end_caps >= 2 else "through"

    fid1 = face_map.FindIndex(floor_face)
    fid2 = face_map.FindIndex(f1)
    fid3 = face_map.FindIndex(f2)

    return SlotFeature(
        id=f"SL-{idx:03d}",
        length_mm=float(length),
        width_mm=float(width),
        depth_mm=float(depth),
        slot_type=slot_type,
        orientation=floor_normal,
        face_ids=[int(fid1), int(fid2), int(fid3)],
    )


def extract_slots_from_shape(shape) -> List[SlotFeature]:
    """Detect slots from BREP shape using OCC face adjacency analysis.

    A slot is identified as a planar floor face with exactly two parallel
    planar side walls whose normals are anti-parallel, plus optional
    end-cap faces (for blind slots) or through openings.

    Uses BRepAdaptor_Surface for robust surface-type detection when available.
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer, topexp
        from OCC.Core.TopAbs import TopAbs_FACE, TopAbs_EDGE
        from OCC.Core.BRep import BRep_Tool
        from OCC.Core.Geom import Geom_Plane
        from OCC.Core.BRepTools import breptools_UVBounds
        from OCC.Core.TopTools import (
            TopTools_IndexedMapOfShape,
            TopTools_IndexedDataMapOfShapeListOfShape,
        )
    except Exception:
        logger.warning("OCC imports unavailable for slot extraction")
        return []

    # Try importing BRepAdaptor for robust face-type detection
    adaptor_cls = None
    plane_type = None
    try:
        from OCC.Core.BRepAdaptor import BRepAdaptor_Surface
        from OCC.Core.GeomAbs import GeomAbs_Plane
        adaptor_cls = BRepAdaptor_Surface
        plane_type = GeomAbs_Plane
    except Exception:
        pass

    face_map = TopTools_IndexedMapOfShape()
    topexp.MapShapes(shape, TopAbs_FACE, face_map)

    edge_faces = TopTools_IndexedDataMapOfShapeListOfShape()
    topexp.MapShapesAndAncestors(shape, TopAbs_EDGE, TopAbs_FACE, edge_faces)

    slots: List[SlotFeature] = []
    idx = 1

    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        floor_face = exp.Current()
        exp.Next()
        floor_normal = _plane_normal(floor_face, BRep_Tool, Geom_Plane,
                                     adaptor_cls=adaptor_cls, plane_type=plane_type)
        if floor_normal is None:
            continue

        neighbors = _collect_edge_neighbors(floor_face, edge_faces, TopExp_Explorer, TopAbs_EDGE)
        walls = _find_perp_walls(floor_normal, neighbors, BRep_Tool, Geom_Plane,
                                 adaptor_cls=adaptor_cls, plane_type=plane_type)
        if len(walls) < 2:
            continue

        for i in range(len(walls)):
            for j in range(i + 1, len(walls)):
                slot = _build_slot(
                    walls[i][0], walls[i][1], walls[j][0], walls[j][1],
                    floor_face, floor_normal, neighbors,
                    face_map, breptools_UVBounds, idx,
                )
                if slot is not None:
                    slots.append(slot)
                    idx += 1

    logger.info("Slot detection: found %d slot(s)", len(slots))
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
