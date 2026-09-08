"""Base face + flange face identification.

A sheet-metal part's "base" is simply its largest planar skin face; every
other planar face that belongs to the same paired-wall system (the dominant
thickness cluster already computed by
:mod:`app.sheet_metal.detectors.sheet_candidate`) is a "flange" - a flat
segment joined to the base by one or more bends.

Deliberately reuses ``find_opposed_planar_pairs`` / ``cluster_pairs`` /
``dominant_cluster`` from ``sheet_candidate`` rather than re-deriving the
face-pairing logic (see design doc section 3.1's "explicit reuse, not
duplication" note and the task instructions for this phase) - the "wall
system" a base/flange split needs is exactly the dominant thickness cluster's
supporting planar faces.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from ...machining.records import ShapeModel
from ...machining.schemas import Vector3
from ..config import SheetMetalConfig
from ..schemas import FlangeFace, SheetMetalFaces
from .sheet_candidate import cluster_pairs, dominant_cluster, find_opposed_planar_pairs

#: Same clustering tolerance family used by sheet_candidate/thickness.
_CLUSTER_TOL_ABS_MM = 0.1


def detect_base_flange(model: ShapeModel, config: SheetMetalConfig) -> SheetMetalFaces:
    """Identify the base face and its flange faces.

    Never raises: when no opposed planar pairs exist (i.e. no wall system was
    found - e.g. a rejected sheet-metal candidate) this falls back to "the
    largest planar face, no flanges" rather than an empty/None base face, so
    the section stays structurally useful even on ambiguous geometry.
    """
    max_gap = config.max_sheet_thickness_mm * 1.5
    pairs = find_opposed_planar_pairs(model, min_gap=config.linear_tolerance_mm, max_gap=max_gap)

    wall_face_ids: Dict[int, float] = {}
    if pairs:
        clusters = cluster_pairs(pairs, tol_mm=max(_CLUSTER_TOL_ABS_MM, config.linear_tolerance_mm))
        dominant = dominant_cluster(clusters)
        if dominant is not None:
            for pair in dominant.pairs:
                wall_face_ids[pair.face_a.id] = pair.face_a.area_mm2
                wall_face_ids[pair.face_b.id] = pair.face_b.area_mm2

    if not wall_face_ids:
        # Fallback: no paired-wall evidence at all - still report the largest
        # planar face as a base so the section is never structurally empty.
        planar = [f for f in model.faces.values() if f.normal is not None]
        if not planar:
            return SheetMetalFaces(base_face_id=None, flange_faces=[])
        base = max(planar, key=lambda f: f.area_mm2)
        return SheetMetalFaces(base_face_id=base.id, flange_faces=[])

    base_id = max(wall_face_ids, key=lambda fid: wall_face_ids[fid])
    flange_faces: List[FlangeFace] = []
    for face_id in sorted(wall_face_ids):
        if face_id == base_id:
            continue
        face = model.faces.get(face_id)
        if face is None or face.normal is None:
            continue
        flange_faces.append(
            FlangeFace(
                face_id=face.id,
                area_mm2=round(face.area_mm2, config.area_decimals),
                plane_normal=Vector3(x=face.normal[0], y=face.normal[1], z=face.normal[2]),
                adjacent_bend_ids=[],
            )
        )

    return SheetMetalFaces(base_face_id=base_id, flange_faces=flange_faces)
