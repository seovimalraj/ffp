from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..workers.celery import celery_app
from ..utils.download import download_to_temp
from ..utils.units import scale_to_mm
from ..loaders.step_loader import occ_available, load_step_shape, shape_mass_props
from ..loaders.stl_loader import load_stl, mesh_mass_props
from ..extractors.holes import extract_holes_from_shape
from ..extractors.pockets import extract_pockets_from_shape
from ..extractors.min_wall import min_wall_mesh
from ..models import FeaturesJson, BBox, MassProps, HoleFeature, PocketFeature, MinWallData

# Import new core modules for clean architecture
from ..core.geometry import GeometricMetrics, calculate_sheet_metal_score, calculate_advanced_metrics
from ..core.bend_detection import AdvancedBendDetector
from ..core.classification import ProcessClassifier

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
        
        # Calculate bounding box dimensions
        bbox_dims = [
            float(bbox_max[0] - bbox_min[0]),
            float(bbox_max[1] - bbox_min[1]),
            float(bbox_max[2] - bbox_min[2])
        ]
        bbox_dims.sort()
        
        # Advanced ray-casting for actual wall thickness detection
        mw = min_wall_mesh(mesh, samples=8000, threshold_mm=10.0)
        
        # Calculate thickness confidence based on detection quality
        thickness_confidence = 0.0
        detected_thickness = mw.global_min_mm if mw.global_min_mm > 0 else None
        
        if detected_thickness:
            min_bbox_dim = min(bbox_dims)
            thickness_to_bbox_ratio = detected_thickness / max(min_bbox_dim, 0.1)
            
            if thickness_to_bbox_ratio < 0.3:
                thickness_confidence = 0.95
            elif thickness_to_bbox_ratio < 0.5:
                thickness_confidence = 0.80
            elif thickness_to_bbox_ratio < 0.7:
                thickness_confidence = 0.60
            else:
                thickness_confidence = 0.40
        
        # === USE NEW CORE MODULES FOR CLEAN CLASSIFICATION ===
        geom_metrics = GeometricMetrics(bbox_dims, vol_mm3, area_mm2)
        classifier = ProcessClassifier(geom_metrics)
        
        # Classify with advanced bend detection
        process_type, confidence, classification_metadata = classifier.classify(
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
            triangle_count=int(mesh.faces.shape[0])
        )
        
        # Legacy format conversion
        if process_type == 'sheet_metal':
            process_type_str = 'sheet_metal'
        elif process_type == 'cnc_turning':
            process_type_str = 'cnc_turning'
        else:
            process_type_str = 'cnc_milling'
        
        # Build advanced metrics from classification
        advanced_metrics_dict = {
            'detected_thickness_mm': detected_thickness,
            'thickness_confidence': thickness_confidence,
            'thickness_detection_method': 'ray_casting_statistical',
            'classification_confidence': confidence,
            **classification_metadata
        }
        
        # Log bend detection if found
        if 'bend_report' in classification_metadata:
            print(classification_metadata['bend_report'])
        
        metrics = {
            "volume": vol_mm3 / 1000.0,  # convert to cm^3
            "surface_area": area_mm2 / 100.0,  # to cm^2
            "bbox": {"min": {"x": float(bbox_min[0]), "y": float(bbox_min[1]), "z": float(bbox_min[2])},
                     "max": {"x": float(bbox_max[0]), "y": float(bbox_max[1]), "z": float(bbox_max[2])}},
            "thickness": detected_thickness,
            "primitive_features": {"holes": 0, "pockets": 0, "slots": 0, "faces": int(mesh.faces.shape[0])},
            "material_usage": None,
            "process_type": process_type_str,
            "sheet_metal_score": classification_metadata.get('sheet_metal_score', 0),
            "advanced_metrics": advanced_metrics_dict
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
        box = Bnd_Box()
        brepbndlib_Add(shape, box)
        xmin, ymin, zmin, xmax, ymax, zmax = box.Get()
        
        # Calculate bounding box dimensions
        bbox_dims = [xmax - xmin, ymax - ymin, zmax - zmin]
        bbox_dims.sort()
        
        # ENTERPRISE-LEVEL: Extract actual material thickness using advanced ray-casting
        actual_thickness = None
        thickness_confidence = 0.0
        triangle_count = 0
        
        try:
            from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
            import tempfile
            import os
            
            # Fine meshing for accurate wall thickness detection
            BRepMesh_IncrementalMesh(shape, 0.05, True, 0.1, True)
            
            # Export to STL temporarily for trimesh analysis
            from OCC.Extend.DataExchange import write_stl_file
            tmp_stl_fd, tmp_stl_path = tempfile.mkstemp(suffix='.stl')
            os.close(tmp_stl_fd)
            
            try:
                write_stl_file(shape, tmp_stl_path, mode="binary", linear_deflection=0.05, angular_deflection=0.1)
                temp_mesh = load_stl(tmp_stl_path, scale=1.0)
                triangle_count = int(temp_mesh.faces.shape[0])
                
                # Advanced ray-casting with 8000 samples
                mw = min_wall_mesh(temp_mesh, samples=8000, threshold_mm=10.0)
                
                if mw.global_min_mm > 0:
                    actual_thickness = mw.global_min_mm
                    
                    # Calculate confidence based on thickness/bbox ratio
                    min_bbox_dim = min(bbox_dims)
                    thickness_to_bbox_ratio = actual_thickness / max(min_bbox_dim, 0.1)
                    
                    # High confidence for bent sheet metal signature
                    if thickness_to_bbox_ratio < 0.3:
                        thickness_confidence = 0.95
                    elif thickness_to_bbox_ratio < 0.5:
                        thickness_confidence = 0.80
                    elif thickness_to_bbox_ratio < 0.7:
                        thickness_confidence = 0.60
                    else:
                        thickness_confidence = 0.40
                    
                    print(f"✅ Detected wall thickness: {actual_thickness:.2f}mm "
                          f"(bbox min: {min_bbox_dim:.2f}mm, ratio: {thickness_to_bbox_ratio:.1%}, "
                          f"confidence: {thickness_confidence:.0%})")
                else:
                    print("⚠️ Wall thickness detection returned 0")
                    
            finally:
                if os.path.exists(tmp_stl_path):
                    os.unlink(tmp_stl_path)
                    
        except Exception as e:
            print(f"⚠️ Wall thickness detection failed: {str(e)[:100]}")
            print("   Using bbox approximation")
        
        # === USE NEW CORE MODULES FOR CLEAN CLASSIFICATION ===
        geom_metrics = GeometricMetrics(bbox_dims, vol_mm3, area_mm2)
        classifier = ProcessClassifier(geom_metrics)
        
        # Classify with advanced bend detection
        process_type, confidence, classification_metadata = classifier.classify(
            detected_thickness=actual_thickness,
            thickness_confidence=thickness_confidence,
            triangle_count=triangle_count
        )
        
        # Legacy format conversion
        if process_type == 'sheet_metal':
            process_type_str = 'sheet_metal'
        elif process_type == 'cnc_turning':
            process_type_str = 'cnc_turning'
        else:
            process_type_str = 'cnc_milling'
        
        # Build advanced metrics
        advanced_metrics_dict = {
            'detected_thickness_mm': actual_thickness,
            'thickness_confidence': thickness_confidence,
            'thickness_detection_method': 'ray_casting_statistical',
            'classification_confidence': confidence,
            **classification_metadata
        }
        
        # Log bend detection if found
        if 'bend_report' in classification_metadata:
            print(classification_metadata['bend_report'])
        
        holes = extract_holes_from_shape(shape)
        pockets = extract_pockets_from_shape(shape)
        
        metrics = {
            "volume": vol_mm3 / 1000.0,
            "surface_area": area_mm2 / 100.0,
            "bbox": {"min": {"x": xmin, "y": ymin, "z": zmin}, "max": {"x": xmax, "y": ymax, "z": zmax}},
            "thickness": actual_thickness,
            "primitive_features": {"holes": len(holes), "pockets": len(pockets), "faces": triangle_count},
            "material_usage": None,
            "process_type": process_type_str,
            "sheet_metal_score": classification_metadata.get('sheet_metal_score', 0),
            "advanced_metrics": advanced_metrics_dict
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
