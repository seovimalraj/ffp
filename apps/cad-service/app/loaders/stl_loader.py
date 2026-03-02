from __future__ import annotations
from typing import Any

import numpy as np


def load_stl(path: str, *, scale: float = 1.0):
    import trimesh
    # process=False skips expensive watertight checks and vertex merging that
    # are unnecessary for ray-cast analysis; saves CPU time + temp memory.
    mesh = trimesh.load(path, force='mesh', process=False)
    if scale and scale != 1.0:
        mesh.apply_scale(scale)

    # Downcast vertices & face-normals from float64 → float32.
    # float32 gives ~7 decimal digits — sub-micron precision at mm scale,
    # more than sufficient for manufacturing analysis while halving mesh RAM.
    if hasattr(mesh, 'vertices') and mesh.vertices.dtype != np.float32:
        mesh.vertices = mesh.vertices.astype(np.float32)
    if hasattr(mesh, 'face_normals') and mesh.face_normals.dtype != np.float32:
        mesh.face_normals = mesh.face_normals.astype(np.float32)

    # Ensure normals exist for ray casting heuristics
    if not mesh.face_normals.any():
        mesh.recompute_face_normals()
        if mesh.face_normals.dtype != np.float32:
            mesh.face_normals = mesh.face_normals.astype(np.float32)
    return mesh


def mesh_mass_props(mesh) -> tuple[float, float]:
    # trimesh uses units of whatever the mesh is in; assume mm here
    vol = float(getattr(mesh, 'volume', 0.0))  # mm^3 if units were mm
    area = float(getattr(mesh, 'area', 0.0)) * 1.0  # mm^2
    return vol, area
