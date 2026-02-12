from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel

from ..workers.celery import celery_app
from ..utils.download import download_to_temp, sha256_of_file
from ..loaders.stl_loader import load_stl
from ..loaders.step_loader import occ_available, load_step_shape

router = APIRouter()

GLB_MIME_TYPE = "model/gltf-binary"
CACHE_CONTROL_HEADER = "public, max-age=3600"
CACHE_DIR = Path("/tmp/gltf-cache")
DEFAULT_LODS: tuple[str, ...] = ("low", "med", "high")
LOD_TARGETS: dict[str, int] = {"low": 50_000, "med": 150_000, "high": 400_000}
STEP_DEFLECTION_BY_LOD: dict[str, float] = {"low": 0.5, "med": 0.2, "high": 0.05}
MISSING_FILE_URL_ERROR = "file_url is required"


class GltfRequest(BaseModel):
    file_id: str
    file_path: str


class GltfResponse(BaseModel):
    file_id: str
    gltf_url: str
    task_id: str


def ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def resolve_lod(lod: str | None) -> Literal["low", "med", "high"]:
    if lod in LOD_TARGETS:
        return lod  # type: ignore[return-value]
    return "high"


def lod_target(lod: str) -> int:
    return LOD_TARGETS.get(lod, LOD_TARGETS["high"])


def build_mesh_key(prefix: str, file_sha: str, lod: str, target: int) -> str:
    return f"{prefix}-{file_sha}-{lod}-{target}"


def mesh_cache_path(cache_key: str) -> Path:
    return CACHE_DIR / f"{cache_key}.glb"


def metadata_cache_path(cache_key: str) -> Path:
    return CACHE_DIR / f"{cache_key}.json"


def build_mesh_metadata(
    mesh,
    *,
    prefix: str,
    file_sha: str,
    lod: str,
    target: int,
    mesh_version: str | None = None,
) -> dict:
    version = mesh_version or build_mesh_key(prefix, file_sha, lod, target)
    metadata: dict[str, object] = {
        "mesh_version": version,
        "file_sha": file_sha,
        "lod": lod,
        "triangle_count": int(len(getattr(mesh, "faces", []))),
        "vertex_count": int(len(getattr(mesh, "vertices", []))),
        "target_triangles": target,
        "available_lods": list(DEFAULT_LODS),
    }
    bounds = getattr(mesh, "bounds", None)
    if bounds is not None:
        try:
            metadata["bounds"] = {
                "min": [float(x) for x in bounds[0]],
                "max": [float(x) for x in bounds[1]],
            }
        except Exception:
            pass
    return metadata


def read_metadata(cache_key: str) -> dict | None:
    path = metadata_cache_path(cache_key)
    if path.exists():
        try:
            with path.open("r") as fh:
                return json.load(fh)
        except Exception:
            return None
    return None


def write_metadata(cache_key: str, metadata: dict) -> None:
    path = metadata_cache_path(cache_key)
    try:
        with path.open("w") as fh:
            json.dump(metadata, fh)
    except Exception:
        pass


def simplify_mesh(mesh, target: int):
    try:
        if len(mesh.faces) > target:
            return mesh.simplify_quadratic_decimation(target)
    except Exception:
        return mesh
    return mesh


def load_step_tri_mesh(path: str, deflection: float):
    from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
    from OCC.Core.StlAPI import StlAPI_Writer

    shape = load_step_shape(path)
    angular_deflection = 0.5
    BRepMesh_IncrementalMesh(shape, deflection, True, angular_deflection, True).Perform()
    fd, tmp_path = tempfile.mkstemp(suffix=".stl")
    os.close(fd)
    try:
        StlAPI_Writer().Write(shape, tmp_path)
        return load_stl(tmp_path)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


@celery_app.task
def convert_to_gltf(file_id: str, file_path: str):
    """Convert STEP/STL to GLB format for 3D preview."""
    import tempfile
    try:
        ext = os.path.splitext(file_path)[1].lower()

        if ext in (".stl",):
            mesh = load_stl(file_path)
            glb_bytes = mesh.export(file_type="glb")
            out_path = file_path.rsplit(".", 1)[0] + ".glb"
            with open(out_path, "wb") as f:
                f.write(glb_bytes)
            return {"file_id": file_id, "gltf_url": out_path}

        if ext in (".step", ".stp"):
            try:
                from ..loaders.step_loader import occ_available, load_step_shape
                if not occ_available():
                    raise RuntimeError("OCC not available")
                shape = load_step_shape(file_path)
                from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
                BRepMesh_IncrementalMesh(shape, 0.1, True, 0.5, True)
                from OCC.Extend.DataExchange import write_stl_file
                fd, tmp_stl = tempfile.mkstemp(suffix=".stl")
                os.close(fd)
                try:
                    write_stl_file(shape, tmp_stl, mode="binary",
                                   linear_deflection=0.1, angular_deflection=0.5)
                    mesh = load_stl(tmp_stl)
                    glb_bytes = mesh.export(file_type="glb")
                    out_path = file_path.rsplit(".", 1)[0] + ".glb"
                    with open(out_path, "wb") as f:
                        f.write(glb_bytes)
                    return {"file_id": file_id, "gltf_url": out_path}
                finally:
                    if os.path.exists(tmp_stl):
                        os.unlink(tmp_stl)
            except ImportError:
                # Fallback: try trimesh import of STEP (limited)
                import trimesh
                mesh = trimesh.load(file_path)
                if hasattr(mesh, "export"):
                    glb_bytes = mesh.export(file_type="glb")
                    out_path = file_path.rsplit(".", 1)[0] + ".glb"
                    with open(out_path, "wb") as f:
                        f.write(glb_bytes)
                    return {"file_id": file_id, "gltf_url": out_path}
                return {"error": "STEP conversion requires pythonOCC"}

        return {"error": f"Unsupported format: {ext}"}
    except Exception as e:
        return {"error": f"GLTF conversion failed: {str(e)[:200]}"}


@router.post("/{file_id}", response_model=GltfResponse)
async def create_gltf(file_id: str, request: GltfRequest):
    task = convert_to_gltf.delay(file_id, request.file_path)
    return {
        "file_id": file_id,
        "gltf_url": "",
        "task_id": task.id,
    }


@router.get("/{task_id}", response_model=GltfResponse)
async def get_gltf_status(task_id: str):
    task = convert_to_gltf.AsyncResult(task_id)
    if task.ready():
        result = task.get()
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    raise HTTPException(status_code=202, detail="Conversion in progress")


@router.get("/stream")
async def stream_gltf(file_url: str = Query(...), lod: str = Query("low")):
    """On-demand GLB streaming for mesh inputs (STL)."""
    if not file_url:
        raise HTTPException(status_code=400, detail=MISSING_FILE_URL_ERROR)
    try:
        ensure_cache_dir()
        path = download_to_temp(file_url)
        lod_value = resolve_lod(lod)
        target = lod_target(lod_value)
        file_sha = sha256_of_file(path)
        cache_key = build_mesh_key("stl", file_sha, lod_value, target)
        cache_path = mesh_cache_path(cache_key)
        if cache_path.exists():
            headers = {"X-Mesh-Version": cache_key, "Cache-Control": CACHE_CONTROL_HEADER}
            return Response(content=cache_path.read_bytes(), media_type=GLB_MIME_TYPE, headers=headers)
        mesh = load_stl(path)
        mesh = simplify_mesh(mesh, target)
        glb_bytes = mesh.export(file_type="glb")
        try:
            cache_path.write_bytes(glb_bytes)
        except Exception:
            pass
        metadata = build_mesh_metadata(mesh, prefix="stl", file_sha=file_sha, lod=lod_value, target=target)
        write_metadata(cache_key, metadata)
        headers = {"X-Mesh-Version": metadata["mesh_version"], "Cache-Control": CACHE_CONTROL_HEADER}
        return Response(content=glb_bytes, media_type=GLB_MIME_TYPE, headers=headers)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/metadata")
async def stream_gltf_metadata(file_url: str = Query(...), lod: str = Query("low")):
    if not file_url:
        raise HTTPException(status_code=400, detail=MISSING_FILE_URL_ERROR)
    try:
        ensure_cache_dir()
        path = download_to_temp(file_url)
        lod_value = resolve_lod(lod)
        target = lod_target(lod_value)
        file_sha = sha256_of_file(path)
        cache_key = build_mesh_key("stl", file_sha, lod_value, target)
        cached = read_metadata(cache_key)
        if cached:
            return cached
        mesh = load_stl(path)
        mesh = simplify_mesh(mesh, target)
        metadata = build_mesh_metadata(mesh, prefix="stl", file_sha=file_sha, lod=lod_value, target=target)
        write_metadata(cache_key, metadata)
        return metadata
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def build_step_cache_key(file_sha: str, lod: str, deflection: float) -> str:
    payload = f"{file_sha}|{lod}|{deflection:.5f}".encode()
    return hashlib.sha256(payload).hexdigest()


@router.get("/stream-step")
async def stream_step_to_glb(
    file_url: str = Query(...),
    lod: str = Query("low"),
    deflection: float | None = Query(None),
):
    """Stream GLB generated from STEP via OCC triangulation."""
    if not occ_available():
        raise HTTPException(status_code=400, detail="pythonOCC is required for STEP->GLB")
    if not file_url:
        raise HTTPException(status_code=400, detail=MISSING_FILE_URL_ERROR)
    try:
        ensure_cache_dir()
        path = download_to_temp(file_url)
        lod_value = resolve_lod(lod)
        target = lod_target(lod_value)
        deflection_value = float(deflection) if deflection is not None else STEP_DEFLECTION_BY_LOD[lod_value]
        file_sha = sha256_of_file(path)
        cache_key = build_step_cache_key(file_sha, lod_value, deflection_value)
        cache_path = mesh_cache_path(cache_key)
        if cache_path.exists():
            headers = {"X-Mesh-Version": cache_key, "Cache-Control": CACHE_CONTROL_HEADER}
            return Response(content=cache_path.read_bytes(), media_type=GLB_MIME_TYPE, headers=headers)
        mesh = load_step_tri_mesh(path, deflection_value)
        mesh = simplify_mesh(mesh, target)
        glb_bytes = mesh.export(file_type="glb")
        try:
            cache_path.write_bytes(glb_bytes)
        except Exception:
            pass
        metadata = build_mesh_metadata(
            mesh,
            prefix="step",
            file_sha=file_sha,
            lod=lod_value,
            target=target,
            mesh_version=cache_key,
        )
        metadata["deflection"] = deflection_value
        write_metadata(cache_key, metadata)
        headers = {"X-Mesh-Version": cache_key, "Cache-Control": CACHE_CONTROL_HEADER}
        return Response(content=glb_bytes, media_type=GLB_MIME_TYPE, headers=headers)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/metadata-step")
async def stream_step_metadata(
    file_url: str = Query(...),
    lod: str = Query("low"),
    deflection: float | None = Query(None),
):
    if not occ_available():
        raise HTTPException(status_code=400, detail="pythonOCC is required for STEP->GLB")
    if not file_url:
        raise HTTPException(status_code=400, detail=MISSING_FILE_URL_ERROR)
    try:
        ensure_cache_dir()
        path = download_to_temp(file_url)
        lod_value = resolve_lod(lod)
        target = lod_target(lod_value)
        deflection_value = float(deflection) if deflection is not None else STEP_DEFLECTION_BY_LOD[lod_value]
        file_sha = sha256_of_file(path)
        cache_key = build_step_cache_key(file_sha, lod_value, deflection_value)
        cached = read_metadata(cache_key)
        if cached:
            return cached
        mesh = load_step_tri_mesh(path, deflection_value)
        mesh = simplify_mesh(mesh, target)
        metadata = build_mesh_metadata(
            mesh,
            prefix="step",
            file_sha=file_sha,
            lod=lod_value,
            target=target,
            mesh_version=cache_key,
        )
        metadata["deflection"] = deflection_value
        write_metadata(cache_key, metadata)
        return metadata
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
