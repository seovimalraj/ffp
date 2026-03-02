from __future__ import annotations
from typing import Any


def load_stl(path: str, *, scale: float = 1.0):
    import trimesh
    mesh = trimesh.load(path, force='mesh')
    if scale and scale != 1.0:
        mesh.apply_scale(scale)
    # Ensure normals exist for ray casting heuristics
    if not mesh.face_normals.any():
        mesh.recompute_face_normals()
    return mesh


def mesh_mass_props(mesh) -> tuple[float, float]:
    # trimesh uses units of whatever the mesh is in; assume mm here
    vol = float(getattr(mesh, 'volume', 0.0))  # mm^3 if units were mm
    area = float(getattr(mesh, 'area', 0.0)) * 1.0  # mm^2
    return vol, area
