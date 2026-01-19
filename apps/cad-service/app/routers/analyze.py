from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
# from OCC.Core.BRepBndLib import brepbndlib_Add
# from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
# from OCC.Core.BRepGProp import brepgprop_VolumeProperties, brepgprop_SurfaceProperties
# from OCC.Core.GProp import GProp_GProps
# from OCC.Core.STEPControl import STEPControl_Reader
# from OCC.Core.IFSelect import IFSelect_RetDone
# from OCC.Core.TopoDS import TopoDS_Shape
# from OCC.Core.Bnd import Bnd_Box
# import numpy as np

from ..workers.celery import celery_app
from ..utils.download import download_to_temp
from ..utils.units import scale_to_mm
from ..loaders.step_loader import occ_available, load_step_shape, shape_mass_props
from ..loaders.stl_loader import load_stl, mesh_mass_props
from ..extractors.holes import extract_holes_from_shape
from ..extractors.pockets import extract_pockets_from_shape
from ..extractors.min_wall import min_wall_mesh
from ..models import FeaturesJson, BBox, MassProps, HoleFeature, PocketFeature, MinWallData

router = APIRouter()

class AnalysisRequest(BaseModel):
    file_id: str
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    units_hint: Optional[str] = None
    org_id: Optional[str] = None
    webhook_url: Optional[str] = None

class AnalysisResponse(BaseModel):
    file_id: str
    metrics: dict
    task_id: Optional[str] = None

def calculate_sheet_metal_score(bbox_dims: list, vol_mm3: float, area_mm2: float) -> float:
    """Calculate sheet metal likelihood score (0-100) based on geometric characteristics."""
    if len(bbox_dims) != 3:
        return 0.0
    
    min_dim, mid_dim, max_dim = bbox_dims[0], bbox_dims[1], bbox_dims[2]
    
    score = 0.0
    
    # 1. Thickness check (30 points) - Critical for sheet metal
    if 0.5 <= min_dim <= 6.0:
        score += 30
        # Bonus for typical sheet metal thicknesses
        typical_thicknesses = [0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0]
        if any(abs(min_dim - t) < 0.3 for t in typical_thicknesses):
            score += 10
    
    # 2. Aspect ratio check (25 points) - Sheet metal is much longer/wider than thick
    aspect_ratio = max_dim / max(min_dim, 0.1)
    if aspect_ratio > 20:
        score += 25
    elif aspect_ratio > 15:
        score += 20
    elif aspect_ratio > 10:
        score += 15
    elif aspect_ratio > 5:
        score += 8
    
    # 3. Surface-to-volume ratio (20 points) - Sheet metal has high ratio
    volume_cm3 = vol_mm3 / 1000.0
    surface_area_cm2 = area_mm2 / 100.0
    if volume_cm3 > 0.1:
        surface_to_volume = surface_area_cm2 / volume_cm3
        if surface_to_volume > 80:
            score += 20
        elif surface_to_volume > 60:
            score += 15
        elif surface_to_volume > 40:
            score += 10
        elif surface_to_volume > 25:
            score += 5
    
    # 4. Flatness check (15 points)
    if min_dim > 0:
        flatness_ratio = (mid_dim * max_dim) / max(volume_cm3 * 10 / min_dim, 1)
        if flatness_ratio > 0.7:
            score += 15
        elif flatness_ratio > 0.5:
            score += 10
        elif flatness_ratio > 0.3:
            score += 5
    
    # 5. Volume efficiency (10 points)
    envelope_volume = min_dim * mid_dim * max_dim
    if envelope_volume > 0:
        volume_efficiency = vol_mm3 / envelope_volume
        if volume_efficiency < 0.4:
            score += 10
        elif volume_efficiency < 0.6:
            score += 5
    
    return min(100.0, max(0.0, score))

def calculate_advanced_metrics(bbox_dims: list, vol_mm3: float, area_mm2: float) -> dict:
    """Calculate advanced geometric metrics for process classification."""
    if len(bbox_dims) != 3:
        return {}
    
    min_dim, mid_dim, max_dim = bbox_dims[0], bbox_dims[1], bbox_dims[2]
    envelope_volume = min_dim * mid_dim * max_dim
    
    # Volume distribution
    volume_efficiency = vol_mm3 / envelope_volume if envelope_volume > 0 else 0
    volume_distribution = 0.9 if volume_efficiency > 0.7 else \
                         0.6 if volume_efficiency > 0.5 else \
                         0.3 if volume_efficiency > 0.3 else 0.1
    
    # Material removal ratio (for CNC)
    material_removal_ratio = 1 - volume_efficiency
    
    # Wall thickness consistency
    volume_cm3 = vol_mm3 / 1000.0
    surface_area_cm2 = area_mm2 / 100.0
    surface_to_volume_ratio = surface_area_cm2 / volume_cm3 if volume_cm3 > 0.1 else 0
    wall_thickness_consistency = 0.95 if surface_to_volume_ratio > 80 else \
                                0.85 if surface_to_volume_ratio > 60 else \
                                0.65 if surface_to_volume_ratio > 40 else \
                                0.40 if surface_to_volume_ratio > 25 else 0.20
    
    # Planarity score
    aspect_ratio = max_dim / max(min_dim, 0.1)
    planarity_score = 0.95 if aspect_ratio > 20 else \
                     0.85 if aspect_ratio > 15 else \
                     0.70 if aspect_ratio > 10 else \
                     0.50 if aspect_ratio > 5 else 0.25
    
    # Dimension balance (for turning detection)
    xy_ratio = abs(min_dim - mid_dim) / max(min_dim, mid_dim) if min_dim > 0 else 1
    xz_ratio = abs(min_dim - max_dim) / max(min_dim, max_dim) if min_dim > 0 else 1
    yz_ratio = abs(mid_dim - max_dim) / max(mid_dim, max_dim) if mid_dim > 0 else 1
    dimension_balance = 1 - max(xy_ratio, xz_ratio, yz_ratio)
    
    return {
        'volume_distribution': volume_distribution,
        'material_removal_ratio': material_removal_ratio,
        'wall_thickness_consistency': wall_thickness_consistency,
        'planarity_score': planarity_score,
        'dimension_balance': dimension_balance,
        'surface_to_volume_ratio': surface_to_volume_ratio
    }

def determine_process_type(bbox_dims: list, vol_mm3: float, area_mm2: float, thickness: Optional[float] = None) -> str:
    """Determine manufacturing process type based on advanced geometric analysis."""
    sheet_metal_score = calculate_sheet_metal_score(bbox_dims, vol_mm3, area_mm2)
    advanced_metrics = calculate_advanced_metrics(bbox_dims, vol_mm3, area_mm2)
    
    min_dim = bbox_dims[0]
    mid_dim = bbox_dims[1]
    max_dim = bbox_dims[2]
    
    # Enhanced sheet metal score with advanced metrics
    enhanced_sm_score = sheet_metal_score
    enhanced_sm_score += advanced_metrics.get('wall_thickness_consistency', 0) * 20
    enhanced_sm_score += advanced_metrics.get('planarity_score', 0) * 15
    
    # Penalty for high volume distribution (solid parts)
    if advanced_metrics.get('volume_distribution', 0) > 0.7:
        enhanced_sm_score -= 25
    
    enhanced_sm_score = max(0.0, min(100.0, enhanced_sm_score))
    
    # CNC Turning detection (rotational symmetry)
    xy_similarity = abs(min_dim - mid_dim) / max(min_dim, mid_dim) if min_dim > 0 else 1
    aspect_ratio = max_dim / max(min_dim, 0.1)
    is_rotational = xy_similarity < 0.15 and 1.5 < aspect_ratio < 12
    
    if is_rotational and advanced_metrics.get('dimension_balance', 0) < 0.5:
        return "cnc_turning"
    
    # Very high confidence sheet metal
    if enhanced_sm_score >= 85:
        return "sheet_metal"
    
    # High confidence sheet metal
    if enhanced_sm_score >= 70:
        return "sheet_metal"
    
    # Medium-high confidence sheet metal (with consistent wall thickness)
    if enhanced_sm_score >= 55 and advanced_metrics.get('wall_thickness_consistency', 0) > 0.6:
        return "sheet_metal"
    
    # Medium confidence (check material removal ratio)
    if enhanced_sm_score >= 45 and 0.5 <= min_dim <= 6.0:
        if advanced_metrics.get('material_removal_ratio', 1) < 0.5:
            return "sheet_metal"
    
    # Low-medium confidence (check thickness)
    if enhanced_sm_score >= 35 and thickness and 0.5 <= thickness <= 6.0:
        return "sheet_metal"
    
    # CNC milling score
    cnc_score = (advanced_metrics.get('volume_distribution', 0) * 30) + \
                ((1 - advanced_metrics.get('material_removal_ratio', 0)) * 20)
    
    # Default to CNC milling
    return "cnc_milling"

def analyze_file_path(file_path: str, units_hint: Optional[str] = None) -> dict:
    """Analyze a CAD file (STEP/STL) and return normalized metrics.
    Returns a dict matching previous mock structure to limit integration changes.
    """
    import os
    ext = os.path.splitext(file_path)[1].lower()
    scale = scale_to_mm(units_hint)
    if ext in (".stl",):
        mesh = load_stl(file_path, scale=scale)
        vol_mm3, area_mm2 = mesh_mass_props(mesh)
        bbox_min = mesh.bounds[0]
        bbox_max = mesh.bounds[1]
        # Approximate min wall via ray casting
        mw = min_wall_mesh(mesh)
        
        # Calculate bounding box dimensions
        bbox_dims = [
            float(bbox_max[0] - bbox_min[0]),
            float(bbox_max[1] - bbox_min[1]),
            float(bbox_max[2] - bbox_min[2])
        ]
        bbox_dims.sort()
        
        # Determine process type based on geometry
        process_type = determine_process_type(bbox_dims, vol_mm3, area_mm2, mw.global_min_mm)
        advanced_metrics = calculate_advanced_metrics(bbox_dims, vol_mm3, area_mm2)
        
        metrics = {
            "volume": vol_mm3 / 1000.0,  # convert to cm^3 to keep parity with previous mock fields
            "surface_area": area_mm2 / 100.0,  # to cm^2
            "bbox": {"min": {"x": float(bbox_min[0]), "y": float(bbox_min[1]), "z": float(bbox_min[2])},
                     "max": {"x": float(bbox_max[0]), "y": float(bbox_max[1]), "z": float(bbox_max[2])}},
            "thickness": mw.global_min_mm if mw.global_min_mm > 0 else None,
            "primitive_features": {"holes": 0, "pockets": 0, "slots": 0, "faces": int(mesh.faces.shape[0])},
            "material_usage": None,
            "process_type": process_type,  # Add process classification
            "sheet_metal_score": calculate_sheet_metal_score(bbox_dims, vol_mm3, area_mm2),
            "advanced_metrics": advanced_metrics  # Add advanced analysis
        }
        return metrics
    elif ext in (".step", ".stp"):
        if not occ_available():
            raise HTTPException(status_code=400, detail="STEP analysis requires pythonOCC; not available")
        shape = load_step_shape(file_path)
        vol_mm3, area_mm2 = shape_mass_props(shape)
        # BBox using OCC
        from OCC.Core.Bnd import Bnd_Box
        from OCC.Core.BRepBndLib import brepbndlib_Add
        from OCC.Core.gp import gp_Pnt
        box = Bnd_Box()
        brepbndlib_Add(shape, box)
        xmin, ymin, zmin, xmax, ymax, zmax = box.Get()
        
        # Calculate bounding box dimensions
        bbox_dims = [xmax - xmin, ymax - ymin, zmax - zmin]
        bbox_dims.sort()
        
        # Determine process type
        process_type = determine_process_type(bbox_dims, vol_mm3, area_mm2, None)
        advanced_metrics = calculate_advanced_metrics(bbox_dims, vol_mm3, area_mm2)
        
        holes = extract_holes_from_shape(shape)
        pockets = extract_pockets_from_shape(shape)
        metrics = {
            "volume": vol_mm3 / 1000.0,
            "surface_area": area_mm2 / 100.0,
            "bbox": {"min": {"x": xmin, "y": ymin, "z": zmin}, "max": {"x": xmax, "y": ymax, "z": zmax}},
            "thickness": None,
            "primitive_features": {"holes": len(holes), "pockets": len(pockets)},
            "material_usage": None,
            "process_type": process_type,
            "sheet_metal_score": calculate_sheet_metal_score(bbox_dims, vol_mm3, area_mm2),
            "advanced_metrics": advanced_metrics
        }
        return metrics
    else:
        raise HTTPException(status_code=400, detail="Unsupported CAD format. Use STEP or STL.")

def calculate_stock_size(bbox: dict, thickness: float = None) -> dict:
    """Calculate required stock material size."""
    x_size = bbox["max"]["x"] - bbox["min"]["x"]
    y_size = bbox["max"]["y"] - bbox["min"]["y"]
    z_size = bbox["max"]["z"] - bbox["min"]["z"]
    
    if thickness:  # Sheet metal
        return {
            "length": round(x_size + 10, 1),  # Add margin
            "width": round(y_size + 10, 1),
            "thickness": round(thickness, 1)
        }
    else:  # CNC block
        return {
            "length": round(x_size + 20, 1),
            "width": round(y_size + 20, 1),
            "height": round(z_size + 15, 1)
        }

@celery_app.task
def analyze_file(file_id: str, file_path: str, units_hint: Optional[str] = None, file_url: Optional[str] = None, org_id: Optional[str] = None, webhook_url: Optional[str] = None):
    try:
        local_path = file_path
        if not local_path and file_url:
            local_path = download_to_temp(file_url)
        if not local_path:
            raise ValueError("file_path or file_url is required")

        metrics = analyze_file_path(local_path, units_hint)
        # Fire-and-forget webhook if provided
        if webhook_url:
            try:
                import httpx
                headers = {}
                secret = None
                try:
                    import os
                    secret = os.getenv('GEOMETRY_WEBHOOK_SECRET')
                except Exception:
                    secret = None
                if secret:
                    headers['X-CAD-Webhook-Secret'] = secret
                payload = {
                    "part_id": file_id,
                    "org_id": org_id,
                    "metrics": metrics,
                    "file_url": file_url,
                    "units_hint": units_hint,
                    "loader": 'occ' if local_path.lower().endswith(('.step', '.stp')) else 'trimesh'
                }
                if secret:
                    import hmac, hashlib, json
                    body = json.dumps(payload)
                    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
                    headers['X-CAD-Webhook-Signature'] = f'sha256={sig}'
                httpx.post(webhook_url, json=payload, headers=headers, timeout=10.0)
            except Exception:
                pass
        return {"file_id": file_id, "metrics": metrics}
    except Exception as e:
        return {"error": str(e)}

@router.post("/", response_model=AnalysisResponse)
async def analyze_cad_file(request: AnalysisRequest):
    # Queue the analysis task
    task = analyze_file.delay(request.file_id, request.file_path or "", request.units_hint, request.file_url, request.org_id, request.webhook_url)
    
    return {
        "file_id": request.file_id,
        "metrics": {},
        "task_id": task.id
    }

@router.get("/{task_id}", response_model=AnalysisResponse)
async def get_analysis_result(task_id: str):
    task = analyze_file.AsyncResult(task_id)
    
    if task.ready():
        result = task.get()
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    else:
        raise HTTPException(status_code=202, detail="Analysis in progress")

@router.post("/sync", response_model=AnalysisResponse)
async def analyze_cad_file_sync(request: AnalysisRequest):
    """Synchronous analysis for immediate results (smaller files)."""
    try:
        local_path = request.file_path
        if not local_path and request.file_url:
            local_path = download_to_temp(request.file_url)
        if not local_path:
            raise HTTPException(status_code=400, detail="file_path or file_url is required")
        metrics = analyze_file_path(local_path, request.units_hint)
        return {"file_id": request.file_id, "metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
