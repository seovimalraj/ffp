from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import hashlib
import hmac
import json
import logging
import math
import os
import traceback

import httpx

from ..workers.celery import celery_app
from ..utils.download import download_to_temp
from ..utils.units import scale_to_mm
from ..loaders.step_loader import occ_available, load_step_shape, shape_mass_props, count_solids_and_compounds
from ..loaders.stl_loader import load_stl, mesh_mass_props
from ..extractors.holes import extract_holes_from_shape, extract_holes_from_mesh
from ..extractors.pockets import extract_pockets_from_shape, extract_pockets_from_mesh
from ..extractors.min_wall import min_wall_mesh
from ..extractors.threads import extract_threads_from_shape, extract_threads_from_mesh
from ..extractors.slots import extract_slots_from_shape, extract_slots_from_pockets
from ..extractors.undercuts import extract_undercuts_from_shape, detect_undercuts_from_mesh
from ..extractors.fillets import extract_fillets_from_shape, detect_fillets_from_mesh
from ..extractors.draft_angles import analyze_draft_from_shape, analyze_draft_from_mesh
from ..extractors.grain_direction import analyze_grain_direction
from ..extractors.nesting import estimate_nesting
from ..extractors.bend_angles import extract_bend_angles_from_shape
from ..extractors.bosses import extract_bosses_from_shape, extract_bosses_from_mesh
from ..extractors.ribs import extract_ribs_from_shape, extract_ribs_from_mesh
from ..extractors.surface_finish import extract_surface_finish_from_shape, extract_surface_finish_from_mesh
from ..extractors.tolerances import extract_tolerance_from_shape, extract_tolerance_from_mesh
from ..models import FeaturesJson, BBox, MassProps, HoleFeature, PocketFeature, MinWallData

# Import new core modules for clean architecture
from ..core.geometry import GeometricMetrics, calculate_sheet_metal_score, calculate_advanced_metrics
from ..core.bend_detection import AdvancedBendDetector
from ..core.classification import ProcessClassifier
from ..core.face_classification import classify_faces
from ..core.machining_complexity import analyze_machining_complexity, analyze_machining_complexity_from_mesh
from ..core.assembly_analysis import analyze_multi_body_assembly, get_per_body_classifications
from ..core.process_detection import analyze_weldment, analyze_casting_origin
from ..dfm_analyzer import analyze_dfm, build_geometry_for_dfm
from ..core.validation import validate_geometry
from ..core.advanced_thickness_detection import enhanced_ray_casting_analysis

router = APIRouter()


def _safe_float(v: float):
    """Return None for NaN/inf, otherwise the float."""
    if math.isnan(v) or math.isinf(v):
        return None
    return v


def _json_safe_numpy(obj):
    """Handle numpy types, returning a JSON-safe Python native or None."""
    try:
        import numpy as np
    except ImportError:
        return None
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return _safe_float(float(obj))
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return None


def _json_safe(obj):
    """Recursively sanitize a dict/list so it's JSON-serializable.
    Converts numpy scalars to Python natives, replaces NaN/inf with None."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, float):
        return _safe_float(obj)
    if isinstance(obj, (int, str, bool)):
        return obj
    result = _json_safe_numpy(obj)
    if result is not None:
        return result
    # Fallback: try to convert to string
    try:
        return str(obj)
    except Exception:
        return None


def _serialize_features(threads=None, slots=None, undercuts=None, fillets=None, holes=None, pockets=None):
    """Serialize detailed feature objects for frontend consumption."""
    detail = {}
    if threads:
        detail["threads_detail"] = [
            {
                "diameter_mm": getattr(t, "diameter_mm", 6),
                "pitch_mm": getattr(t, "pitch_mm", 1),
                "depth_mm": getattr(t, "depth_mm", 10),
                "thread_type": getattr(t, "thread_type", "internal"),
                "is_standard": getattr(t, "is_standard", True),
                "standard_name": getattr(t, "standard_name", ""),
            }
            for t in threads
        ]
    if slots:
        detail["slots_detail"] = [
            {
                "length_mm": getattr(s, "length_mm", 10),
                "width_mm": getattr(s, "width_mm", 5),
                "depth_mm": getattr(s, "depth_mm", 3),
                "slot_type": getattr(s, "slot_type", "through"),
            }
            for s in slots
        ]
    if undercuts:
        detail["undercuts_detail"] = [
            {
                "undercut_type": getattr(u, "undercut_type", "internal"),
                "severity": getattr(u, "severity", "minor"),
                "depth_mm": getattr(u, "depth_mm", 2),
                "width_mm": getattr(u, "width_mm", 3),
                "requires_special_tooling": getattr(u, "requires_special_tooling", False),
            }
            for u in undercuts
        ]
    if fillets:
        detail["fillets_detail"] = [
            {
                "feature_type": getattr(f, "feature_type", "fillet"),
                "radius_mm": getattr(f, "radius_mm", 2),
                "length_mm": getattr(f, "length_mm", 10),
            }
            for f in fillets
        ]
    if holes:
        detail["holes_detail"] = [
            {
                "type": getattr(h, "type", "through"),
                "diameter_mm": getattr(h, "diameter_mm", 5),
                "depth_mm": getattr(h, "depth_mm", 10),
            }
            for h in holes
        ]
    if pockets:
        detail["pockets_detail"] = [
            {
                "depth_mm": getattr(p, "depth_mm", 5),
                "mouth_area_mm2": getattr(p, "mouth_area_mm2", 100),
                "aspect_ratio": getattr(p, "aspect_ratio", 2),
            }
            for p in pockets
        ]
    return detail

class AnalysisRequest(BaseModel):
    file_id: str
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    units_hint: Optional[str] = None
    org_id: Optional[str] = None
    webhook_url: Optional[str] = None
    material: Optional[str] = None  # e.g. "steel", "aluminum", "stainless", "copper", "brass", "titanium"

class AnalysisResponse(BaseModel):
    file_id: str
    metrics: dict
    task_id: Optional[str] = None

# ---------------------------------------------------------------------------
# Helpers for analyze_file_path (extracted to reduce cognitive complexity)
# ---------------------------------------------------------------------------

def _calculate_thickness_confidence(detected_thickness, bbox_dims):
    """Calculate thickness confidence from thickness-to-bbox ratio."""
    if not detected_thickness or detected_thickness <= 0:
        return 0.0
    min_bbox_dim = min(bbox_dims) if bbox_dims else 0.1
    ratio = detected_thickness / max(min_bbox_dim, 0.1)
    if ratio < 0.3:
        return 0.95
    if ratio < 0.5:
        return 0.80
    if ratio < 0.7:
        return 0.60
    return 0.40


def _log_thickness_analysis(analysis, label=""):
    """Print thickness analysis diagnostics."""
    tag = f" ({label})" if label else ""
    print(f"🔬 Advanced Thickness Analysis{tag}:")
    print(f"   Sheet thickness detected: {analysis.is_sheet_thickness}")
    if analysis.detected_thickness:
        print(f"   Thickness: {analysis.detected_thickness:.2f}mm")
        print(f"   Uniform ratio: {analysis.uniform_ratio:.1%}")
        if hasattr(analysis, 'thickness_to_size_ratio'):
            print(f"   T/L ratio: {analysis.thickness_to_size_ratio:.1%}")
        if hasattr(analysis, 'cluster_dominance'):
            print(f"   Dominance: {analysis.cluster_dominance:.1f}x")
        print(f"   Confidence: {analysis.confidence:.1%}")
    print(f"   Reasoning: {analysis.reasoning}")


def _extract_mesh_features(mesh):
    """Extract features from STL mesh with per-feature error handling."""
    results = {
        "threads": [], "undercuts": [], "fillets": [], "draft": [],
        "holes": [], "pockets": [], "bosses": [], "ribs": []
    }
    extractors = [
        ("threads", lambda: extract_threads_from_mesh(mesh)),
        ("undercuts", lambda: detect_undercuts_from_mesh(mesh)),
        ("fillets", lambda: detect_fillets_from_mesh(mesh)),
        ("draft", lambda: analyze_draft_from_mesh(mesh)),
        ("holes", lambda: extract_holes_from_mesh(mesh)),
        ("pockets", lambda: extract_pockets_from_mesh(mesh)),
        ("bosses", lambda: extract_bosses_from_mesh(mesh)),
        ("ribs", lambda: extract_ribs_from_mesh(mesh)),
    ]
    for name, fn in extractors:
        try:
            results[name] = fn()
        except Exception as e:
            print(f"⚠️ STL {name} extraction failed: {str(e)[:80]}")
    
    # Log mesh feature extraction summary
    print(f"🔧 STL feature extraction: {len(results['holes'])} holes, "
          f"{len(results['pockets'])} pockets, {len(results['bosses'])} bosses, "
          f"{len(results['ribs'])} ribs, {len(results['threads'])} threads")
    return results


def _try_extract_slots(shape, pockets):
    """Extract slots from shape, falling back to pocket-based detection."""
    slots = extract_slots_from_shape(shape)
    return slots if slots else extract_slots_from_pockets(pockets)


def _extract_step_additional_features(shape, holes, pockets):
    """Extract threads, slots, undercuts, fillets, draft, bosses, ribs from STEP shape."""
    results = {
        "threads": [], "slots": [], "undercuts": [], 
        "fillets": [], "draft": [], "bosses": [], "ribs": [],
        "surface_finish": None, "tolerances": None,
    }
    extractors = [
        ("threads", lambda: extract_threads_from_shape(shape, holes)),
        ("slots", lambda: _try_extract_slots(shape, pockets)),
        ("undercuts", lambda: extract_undercuts_from_shape(shape)),
        ("fillets", lambda: extract_fillets_from_shape(shape)),
        ("draft", lambda: analyze_draft_from_shape(shape)),
        ("bosses", lambda: extract_bosses_from_shape(shape)),
        ("ribs", lambda: extract_ribs_from_shape(shape)),
        ("surface_finish", lambda: extract_surface_finish_from_shape(shape)),
        ("tolerances", lambda: extract_tolerance_from_shape(shape, holes, pockets)),
    ]
    for name, fn in extractors:
        try:
            results[name] = fn()
        except Exception as e:
            print(f"⚠️ {name} extraction failed: {str(e)[:80]}")
    print(f"🔧 Feature extraction: {len(holes)} holes, {len(pockets)} pockets, "
          f"{len(results['threads'])} threads, {len(results['slots'])} slots, "
          f"{len(results['undercuts'])} undercuts, {len(results['fillets'])} fillets, "
          f"{len(results['draft'])} draft faces, {len(results['bosses'])} bosses, "
          f"{len(results['ribs'])} ribs")
    return results


def _extract_advanced_process_analysis(shape, holes, pockets, undercuts, face_result, body_count):
    """Extract machining complexity, weldment, and casting analysis."""
    results = {
        "machining_complexity": None,
        "weldment_analysis": None,
        "casting_analysis": None,
        "assembly_analysis": None,
    }
    
    try:
        results["machining_complexity"] = analyze_machining_complexity(
            shape, holes=holes, pockets=pockets, undercuts=undercuts,
            face_classification=face_result
        )
    except Exception as e:
        print(f"⚠️ Machining complexity analysis failed: {str(e)[:80]}")
    
    try:
        results["weldment_analysis"] = analyze_weldment(
            shape, body_count=body_count, face_classification=face_result
        )
    except Exception as e:
        print(f"⚠️ Weldment analysis failed: {str(e)[:80]}")
    
    try:
        from ..loaders.step_loader import shape_mass_props
        vol, area = shape_mass_props(shape)
        results["casting_analysis"] = analyze_casting_origin(
            shape, holes=holes, pockets=pockets, 
            face_classification=face_result,
            volume_mm3=vol, surface_area_mm2=area
        )
    except Exception as e:
        print(f"⚠️ Casting analysis failed: {str(e)[:80]}")
    
    if body_count > 1:
        try:
            results["assembly_analysis"] = analyze_multi_body_assembly(shape)
        except Exception as e:
            print(f"⚠️ Assembly analysis failed: {str(e)[:80]}")
    
    return results


def _classify_process(bbox_dims, vol_mm3, area_mm2, detected_thickness,
                      thickness_confidence, triangle_count, thickness_analysis,
                      face_classification=None, 
                      holes=None, pockets=None, fillets=None,
                      bends=None, undercuts=None, draft_analysis=None,
                      slots=None, threads=None,  # GAP FIX: Add slots and threads
                      material='default',
                      **feature_counts):
    """Run process classification and return formatted results.
    
    ENHANCED: Now passes full feature objects for advanced analysis
    (hole depth ratio, pocket depth, fillet radius, thickness uniformity,
    bend radius analysis, undercut severity, draft angle detection,
    slot geometry, thread pitch analysis).
    """
    geom_metrics = GeometricMetrics(bbox_dims, vol_mm3, area_mm2)
    classifier = ProcessClassifier(geom_metrics)
    
    # Extract paired plane distances from face classification if available
    # GAP FIX: Pass ALL pair distances, not just dominant
    paired_plane_distances = []
    if face_classification is not None:
        # Use all paired plane distances for better thickness uniformity analysis
        if hasattr(face_classification, 'paired_plane_distances'):
            paired_plane_distances = getattr(face_classification, 'paired_plane_distances', [])
        elif hasattr(face_classification, 'dominant_pair_thickness'):
            # Fallback to dominant thickness if full list not available
            if face_classification.dominant_pair_thickness is not None:
                paired_plane_distances = [face_classification.dominant_pair_thickness]
    
    process_type, confidence, metadata = classifier.classify(
        detected_thickness=detected_thickness,
        thickness_confidence=thickness_confidence,
        triangle_count=triangle_count,
        thickness_analysis=thickness_analysis,
        face_classification=face_classification,
        # Pass full feature objects for advanced analysis
        holes=holes,
        pockets=pockets,
        fillets=fillets,
        paired_plane_distances=paired_plane_distances,
        # NEW: Pass bends, undercuts, and draft analysis (GAP 4, 9, 13)
        bends=bends,
        undercuts=undercuts,
        draft_analysis=draft_analysis,
        # GAP FIX: Pass slots and threads for geometry/pitch analysis
        slots=slots,
        threads=threads,
        material=material,
        **feature_counts,
    )
    process_type_str = process_type if process_type in ('sheet_metal', 'cnc_turning') else 'cnc_milling'

    # Confidence calibration: flag low-confidence classifications for review
    needs_review = confidence < 0.70
    if needs_review:
        logging.warning(
            "LOW CONFIDENCE classification: %s at %.2f — flagged for review",
            process_type_str, confidence,
        )

    advanced_metrics = {
        'detected_thickness_mm': detected_thickness,
        'thickness_confidence': thickness_confidence,
        'thickness_detection_method': 'ray_casting_statistical',
        'classification_confidence': confidence,
        'needs_review': needs_review,
        **metadata,
    }
    # Include face classification in advanced metrics for frontend
    if face_classification is not None:
        advanced_metrics['face_classification'] = face_classification.to_dict()
    if 'bend_report' in metadata:
        print(metadata['bend_report'])
    return process_type_str, confidence, metadata, advanced_metrics


def _score_triangle_complexity(count, is_step):
    """Score complexity contribution from triangle/face count."""
    thresholds = [(15000, 20), (8000, 12), (3000, 6)] if is_step else [(10000, 30), (5000, 20), (2000, 10)]
    for limit, score in thresholds:
        if count > limit:
            return score
    return 0


def _score_feature_counts(hole_count, pocket_count):
    """Score complexity from hole and pocket counts (STEP only)."""
    score = 0
    for count, thresholds in [
        (hole_count, [(20, 35), (10, 25), (5, 15), (0, 8)]),
        (pocket_count, [(10, 30), (5, 20), (2, 12), (0, 6)]),
    ]:
        for limit, pts in thresholds:
            if count > limit:
                score += pts
                break
    return score


def _score_sheet_metal_bends(bend_count, bend_complexity_val, is_step):
    """Score complexity from bend count and bend complexity for sheet metal."""
    score = 0
    bend_thresholds = [(6, 30 if is_step else 40),
                       (3, 20 if is_step else 25),
                       (1, 10 if is_step else 15)]
    for limit, pts in bend_thresholds:
        if bend_count > limit:
            score += pts
            break
    cap = 15 if is_step else 20
    divisor = 4 if is_step else 3
    score += min(cap, int(bend_complexity_val) // divisor)
    return score


def _score_cnc_aspect_ratio(bbox_dims, is_step):
    """Score complexity from aspect ratio for CNC parts."""
    sorted_dims = sorted(bbox_dims)
    if len(sorted_dims) != 3:
        return 0
    aspect = sorted_dims[2] / max(sorted_dims[0], 0.1)
    high_score = 15 if is_step else 20
    med_score = 8 if is_step else 10
    if aspect > 10:
        return high_score
    if aspect > 5:
        return med_score
    return 0


def _score_bend_and_shape(process_type_str, bend_count, bend_complexity_val,
                          bbox_dims, is_step):
    """Score complexity from bends (sheet metal) or aspect ratio (CNC)."""
    if process_type_str == 'sheet_metal':
        return _score_sheet_metal_bends(bend_count, bend_complexity_val, is_step)
    return _score_cnc_aspect_ratio(bbox_dims, is_step)


def _calculate_complexity(process_type_str, bend_analysis, bbox_dims,
                          triangle_count, hole_count=0, pocket_count=0,
                          is_step=False):
    """Calculate enterprise complexity score and level."""
    bend_count = bend_analysis.get('bend_count', 0)
    bend_complexity_val = bend_analysis.get('complexity', 0)
    score = 0
    if is_step:
        score += _score_feature_counts(hole_count, pocket_count)
    score += _score_triangle_complexity(triangle_count, is_step)
    score += _score_bend_and_shape(process_type_str, bend_count,
                                   bend_complexity_val, bbox_dims, is_step)
    if score >= 50:
        return 'complex', score
    if score >= 25:
        return 'moderate', score
    return 'simple', score


def _compute_sheet_metal_extras(process_type_str, bbox_dims,
                                classification_metadata, detected_thickness):
    """Compute grain direction and nesting estimate for sheet metal parts."""
    if process_type_str != 'sheet_metal':
        return None, None

    bend_axes = []
    bend_analysis = classification_metadata.get('bend_analysis', {})
    for b in bend_analysis.get('bends', []):
        ax = b.get('axis')
        if ax:
            bend_axes.append(tuple(ax) if isinstance(ax, (list, tuple)) else (0, 0, 1))

    flat_l = bbox_dims[2] if len(bbox_dims) == 3 else 0
    flat_w = bbox_dims[1] if len(bbox_dims) >= 2 else 0
    thickness = detected_thickness or (bbox_dims[0] if bbox_dims else 1.0)

    grain_dir = analyze_grain_direction(
        bend_axes=bend_axes, flat_length=flat_l, flat_width=flat_w,
    )
    nesting_est = estimate_nesting(
        flat_length=flat_l, flat_width=flat_w, thickness=thickness,
    )
    return grain_dir, nesting_est


def _validate_geometry_safe(bbox_dims, vol_mm3, area_mm2):
    """Run geometry validation, returning None on failure."""
    try:
        return validate_geometry({
            "boundingBox": {
                "x": bbox_dims[2] if len(bbox_dims) == 3 else 0,
                "y": bbox_dims[1] if len(bbox_dims) >= 2 else 0,
                "z": bbox_dims[0] if len(bbox_dims) >= 1 else 0,
            },
            "volume": vol_mm3,
            "surfaceArea": area_mm2,
        })
    except Exception as e:
        print(f"⚠️ Geometry validation failed: {str(e)[:80]}")
        return None


def _run_dfm_safe(dfm_geometry, process_type_str, label=""):
    """Run DFM analysis with error handling."""
    try:
        result = analyze_dfm(
            geometry=dfm_geometry,
            process_type=process_type_str,
            material="aluminum",
            tolerance="standard",
        )
        tag = f" ({label})" if label else ""
        print(f"✅ DFM Analysis{tag} Complete:")
        print(f"   Score: {result.get('overall_score', 0):.0f}/100")
        print(f"   Rating: {result.get('rating', 'unknown')}")
        if 'issues' in result:
            print(f"   Issues: {len(result.get('issues', []))}")
        if 'is_manufacturable' in result:
            print(f"   Manufacturable: {result.get('is_manufacturable', True)}")
        return result
    except Exception as e:
        print(f"⚠️ DFM Analysis failed: {str(e)[:100]}")
        return {
            "overall_score": 0,
            "rating": "unknown",
            "is_manufacturable": True,
            "issues": [],
            "error": str(e)[:200],
        }


def _attach_optional_metrics(metrics, grain_dir, nesting_est,
                             step_bend_result=None):
    """Attach optional grain direction, nesting, and bend data to metrics."""
    if step_bend_result and step_bend_result.total_bend_count > 0:
        metrics["step_bend_angles"] = step_bend_result.to_dict()
    if grain_dir:
        metrics["grain_direction"] = {
            "recommended": grain_dir.recommended_direction,
            "score": grain_dir.alignment_score,
            "notes": grain_dir.notes,
        }
    if nesting_est:
        metrics["nesting"] = {
            "parts_per_sheet": nesting_est.parts_per_sheet,
            "utilization_pct": nesting_est.utilization_pct,
            "sheet_size": f"{nesting_est.sheet_width_mm}×{nesting_est.sheet_height_mm}mm",
        }


def _build_assembly_metrics(assembly_info):
    """Build response dict for assembly files requiring manual quote."""
    return {
        "volume": 0,
        "surface_area": 0,
        "bbox": {"min": {"x": 0, "y": 0, "z": 0},
                 "max": {"x": 0, "y": 0, "z": 0}},
        "thickness": None,
        "primitive_features": {
            "holes": 0, "pockets": 0, "slots": 0, "faces": 0,
            "threads": 0, "undercuts": 0, "fillets": 0,
        },
        "material_usage": None,
        "process_type": "assembly",
        "sheet_metal_score": 0,
        "is_assembly": True,
        "assembly_info": {
            "solid_count": assembly_info.solid_count,
            "compound_count": assembly_info.compound_count,
            "shell_count": assembly_info.shell_count,
            "reason": assembly_info.reason,
        },
        "requires_manual_quote": True,
        "manual_quote_reason": assembly_info.reason,
        "advanced_metrics": {},
    }


def _extract_occ_bbox(shape):
    """Extract bounding box from STEP shape using OCC."""
    from OCC.Core.Bnd import Bnd_Box
    from OCC.Core.BRepBndLib import brepbndlib

    box = Bnd_Box()
    brepbndlib.Add(shape, box)

    try:
        coords = box.Get()
        if coords and len(coords) == 6:
            xmin, ymin, zmin, xmax, ymax, zmax = coords
        else:
            p_min, p_max = box.CornerMin(), box.CornerMax()
            xmin, ymin, zmin = p_min.X(), p_min.Y(), p_min.Z()
            xmax, ymax, zmax = p_max.X(), p_max.Y(), p_max.Z()
    except Exception:
        p_min, p_max = box.CornerMin(), box.CornerMax()
        xmin, ymin, zmin = p_min.X(), p_min.Y(), p_min.Z()
        xmax, ymax, zmax = p_max.X(), p_max.Y(), p_max.Z()

    bbox_dims = sorted([xmax - xmin, ymax - ymin, zmax - zmin])
    bbox_dict = {
        "min": {"x": xmin, "y": ymin, "z": zmin},
        "max": {"x": xmax, "y": ymax, "z": zmax},
    }
    return bbox_dict, bbox_dims


def _detect_step_wall_thickness(shape, bbox_dims):
    """Detect wall thickness from STEP shape by meshing to STL for ray-casting."""
    actual_thickness = None
    thickness_confidence = 0.0
    triangle_count = 0
    thickness_analysis = None

    try:
        from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
        from OCC.Extend.DataExchange import write_stl_file
        import tempfile

        BRepMesh_IncrementalMesh(shape, 0.05, True, 0.1, True)
        tmp_fd, tmp_path = tempfile.mkstemp(suffix='.stl')
        os.close(tmp_fd)

        try:
            write_stl_file(shape, tmp_path, mode="binary",
                           linear_deflection=0.05, angular_deflection=0.1)
            temp_mesh = load_stl(tmp_path, scale=1.0)
            triangle_count = int(temp_mesh.faces.shape[0])

            mw = min_wall_mesh(temp_mesh, samples=8000, threshold_mm=10.0)
            if mw.global_min_mm > 0:
                actual_thickness = mw.global_min_mm
                thickness_confidence = _calculate_thickness_confidence(
                    actual_thickness, bbox_dims,
                )
                min_dim = min(bbox_dims) if bbox_dims else 0.1
                ratio = actual_thickness / max(min_dim, 0.1)
                print(f"✅ Detected wall thickness: {actual_thickness:.2f}mm "
                      f"(bbox min: {min_dim:.2f}mm, ratio: {ratio:.1%}, "
                      f"confidence: {thickness_confidence:.0%})")
            else:
                print("⚠️ Wall thickness detection returned 0")

            if triangle_count > 0:
                thickness_analysis = enhanced_ray_casting_analysis(
                    temp_mesh, bbox_dims, samples=8000,
                )
                _log_thickness_analysis(thickness_analysis, "STEP")
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        print(f"⚠️ Wall thickness detection failed: {str(e)[:100]}")
        print("   Using bbox approximation")
        traceback.print_exc()

    return actual_thickness, thickness_confidence, triangle_count, thickness_analysis


# ---------------------------------------------------------------------------
# Branch implementations
# ---------------------------------------------------------------------------

def _analyze_stl(file_path, scale, material: str = 'default'):
    """Analyze an STL file and return normalized metrics.
    
    Args:
        file_path: Path to STL file
        scale: Scale factor for units conversion
        material: Material type for classification thresholds
    """
    mesh = load_stl(file_path, scale=scale)
    vol_mm3, area_mm2 = mesh_mass_props(mesh)
    bbox_min, bbox_max = mesh.bounds[0], mesh.bounds[1]
    bbox_dims = sorted([
        float(bbox_max[0] - bbox_min[0]),
        float(bbox_max[1] - bbox_min[1]),
        float(bbox_max[2] - bbox_min[2]),
    ])

    # Wall thickness detection
    mw = min_wall_mesh(mesh, samples=8000, threshold_mm=10.0)
    detected_thickness = mw.global_min_mm if mw.global_min_mm > 0 else None
    thickness_confidence = _calculate_thickness_confidence(detected_thickness, bbox_dims)

    # Advanced thickness analysis
    thickness_analysis = enhanced_ray_casting_analysis(mesh, bbox_dims, samples=8000)
    _log_thickness_analysis(thickness_analysis)

    # Feature extraction
    features = _extract_mesh_features(mesh)
    face_count = int(mesh.faces.shape[0])

    # Classification
    process_type_str, _conf, metadata, advanced_metrics = _classify_process(
        bbox_dims, vol_mm3, area_mm2,
        detected_thickness=detected_thickness,
        thickness_confidence=thickness_confidence,
        triangle_count=face_count,
        thickness_analysis=thickness_analysis,
        material=material,
        thread_count=len(features['threads']),
        undercut_count=len(features['undercuts']),
        fillet_count=len(features['fillets']),
        # GAP FIX: Pass threads and slots for geometry analysis
        threads=features['threads'],
        slots=[],  # STL mesh doesn't have slot extraction yet
    )

    # Complexity
    bend_analysis = metadata.get('bend_analysis', {})
    complexity, complexity_score = _calculate_complexity(
        process_type_str, bend_analysis, bbox_dims, face_count, is_step=False,
    )

    # Sheet metal extras
    grain_dir, nesting_est = _compute_sheet_metal_extras(
        process_type_str, bbox_dims, metadata, detected_thickness,
    )

    # Validation & DFM
    validation = _validate_geometry_safe(bbox_dims, vol_mm3, area_mm2)
    dfm_geometry = build_geometry_for_dfm(
        bbox_dims=bbox_dims, volume_mm3=vol_mm3, surface_area_mm2=area_mm2,
        holes=[], pockets=[], process_type=process_type_str,
        thickness=detected_thickness,
        bend_analysis=metadata.get('bend_analysis'),
        complexity=complexity,
        threads=features['threads'], slots=[],
        undercuts=features['undercuts'], fillets=features['fillets'],
        draft_analysis=features['draft'],
        grain_direction=grain_dir, nesting=nesting_est,
    )
    dfm_result = _run_dfm_safe(dfm_geometry, process_type_str, "STL")

    metrics = {
        "volume": vol_mm3 / 1000.0,
        "surface_area": area_mm2 / 100.0,
        "bbox": {
            "min": {"x": float(bbox_min[0]), "y": float(bbox_min[1]), "z": float(bbox_min[2])},
            "max": {"x": float(bbox_max[0]), "y": float(bbox_max[1]), "z": float(bbox_max[2])},
        },
        "thickness": detected_thickness,
        "primitive_features": {
            "holes": 0, "pockets": 0, "slots": 0,
            "threads": len(features['threads']),
            "undercuts": len(features['undercuts']),
            "fillets": len(features['fillets']),
            "faces": face_count,
        },
        "feature_detail": _serialize_features(
            threads=features['threads'],
            undercuts=features['undercuts'],
            fillets=features['fillets'],
        ),
        "material_usage": None,
        "process_type": process_type_str,
        "sheet_metal_score": metadata.get('sheet_metal_score', 0),
        "complexity": complexity,
        "complexity_score": complexity_score,
        "advanced_metrics": advanced_metrics,
        "dfm_analysis": dfm_result,
        "validation": validation,
    }
    _attach_optional_metrics(metrics, grain_dir, nesting_est)
    return metrics


def _detect_assembly_early(shape) -> dict | None:
    """Run assembly detection as the absolute first step.

    Returns assembly metrics dict if assembly detected, else None.
    This must be resilient — if it crashes we still continue analysis.
    """
    try:
        assembly_info = count_solids_and_compounds(shape)
        if assembly_info.is_assembly:
            logging.warning(
                "Assembly detected early: solids=%d compounds=%d shells=%d — %s",
                assembly_info.solid_count,
                assembly_info.compound_count,
                assembly_info.shell_count,
                assembly_info.reason,
            )
            return _build_assembly_metrics(assembly_info)
    except Exception as exc:
        logging.warning("Early assembly detection failed (continuing): %s", exc)
    return None


def _analyze_step(file_path, material: str = 'default'):
    """Analyze a STEP file and return normalized metrics.
    
    Args:
        file_path: Path to STEP file
        material: Material type for classification thresholds
    """
    if not occ_available():
        raise HTTPException(
            status_code=400,
            detail="STEP analysis requires pythonOCC; not available",
        )
    shape = load_step_shape(file_path)

    # Assembly detection — FIRST, before anything else
    assembly_result = _detect_assembly_early(shape)
    if assembly_result is not None:
        return assembly_result

    vol_mm3, area_mm2 = shape_mass_props(shape)
    bbox_dict, bbox_dims = _extract_occ_bbox(shape)

    # Face type classification (BRepAdaptor — most reliable signal)
    try:
        face_result = classify_faces(shape, area_mm2)
        logging.warning(
            "Face classification: planes=%.0f%% cyl=%.0f%% freeform=%.0f%% "
            "pairs=%d SM=%.0f CNC=%.0f → %s",
            face_result.plane_ratio * 100,
            face_result.cylinder_ratio * 100,
            face_result.freeform_ratio * 100,
            face_result.paired_plane_count,
            face_result.sheet_metal_face_score,
            face_result.cnc_face_score,
            "sheet_metal" if face_result.is_likely_sheet_metal
            else ("cnc" if face_result.is_likely_cnc else "uncertain"),
        )
    except Exception as exc:
        logging.warning("Face classification failed (continuing): %s", exc)
        face_result = None

    # Wall thickness via meshing
    actual_thickness, thickness_confidence, triangle_count, thickness_analysis = \
        _detect_step_wall_thickness(shape, bbox_dims)

    # Feature extraction (wrapped so one failure doesn't crash the whole analysis)
    try:
        holes = extract_holes_from_shape(shape)
    except Exception as e:
        logging.warning("Hole extraction failed: %s", str(e)[:120])
        holes = []
    try:
        pockets = extract_pockets_from_shape(shape)
    except Exception as e:
        logging.warning("Pocket extraction failed: %s", str(e)[:120])
        pockets = []
    features = _extract_step_additional_features(shape, holes, pockets)
    
    # NEW: Extract bends BEFORE classification (GAP 4)
    # This allows bend radius analysis to inform classification
    step_bend_result = _extract_step_bends(shape, actual_thickness)
    bends_list = []
    if step_bend_result is not None and hasattr(step_bend_result, 'bends'):
        bends_list = step_bend_result.bends

    # NEW: Extract advanced process analysis (machining complexity, weldment, casting)
    body_count_info = count_solids_and_compounds(shape)
    body_count = getattr(body_count_info, 'solid_count', 1) if body_count_info else 1
    advanced_process = _extract_advanced_process_analysis(
        shape, holes, pockets, features['undercuts'], face_result, body_count
    )

    # Classification - pass full feature objects for enhanced analysis
    process_type_str, _conf, metadata, advanced_metrics = _classify_process(
        bbox_dims, vol_mm3, area_mm2,
        detected_thickness=actual_thickness,
        thickness_confidence=thickness_confidence,
        triangle_count=triangle_count,
        thickness_analysis=thickness_analysis,
        face_classification=face_result,
        # Pass full feature objects
        holes=holes,
        pockets=pockets,
        fillets=features['fillets'],
        # Pass bends, undercuts, and draft analysis
        bends=bends_list,
        undercuts=features['undercuts'],
        draft_analysis=features['draft'],
        # Pass slots and threads for geometry/pitch analysis
        slots=features['slots'],
        threads=features['threads'],
        material=material,
        # Pass counts for backward compatibility
        hole_count=len(holes),
        pocket_count=len(pockets),
        thread_count=len(features['threads']),
        undercut_count=len(features['undercuts']),
        fillet_count=len(features['fillets']),
        slot_count=len(features['slots']),
        boss_count=len(features['bosses']),
        rib_count=len(features['ribs']),
        # NEW: Pass extended analysis results
        surface_finish_analysis=features.get('surface_finish'),
        tolerance_analysis=features.get('tolerances'),
        machining_complexity=advanced_process.get('machining_complexity'),
        casting_analysis=advanced_process.get('casting_analysis'),
        weldment_analysis=advanced_process.get('weldment_analysis'),
        body_count=body_count,
    )

    # Complexity (step_bend_result already extracted above)

    # Complexity
    bend_analysis = metadata.get('bend_analysis', {})
    complexity, complexity_score = _calculate_complexity(
        process_type_str, bend_analysis, bbox_dims, triangle_count,
        hole_count=len(holes), pocket_count=len(pockets), is_step=True,
    )

    # Sheet metal extras
    grain_dir, nesting_est = _compute_sheet_metal_extras(
        process_type_str, bbox_dims, metadata, actual_thickness,
    )

    # Validation & DFM
    validation = _validate_geometry_safe(bbox_dims, vol_mm3, area_mm2)
    dfm_geometry = build_geometry_for_dfm(
        bbox_dims=bbox_dims, volume_mm3=vol_mm3, surface_area_mm2=area_mm2,
        holes=holes, pockets=pockets, process_type=process_type_str,
        thickness=actual_thickness,
        bend_analysis=bend_analysis,
        complexity=complexity,
        threads=features['threads'], slots=features['slots'],
        undercuts=features['undercuts'], fillets=features['fillets'],
        draft_analysis=features['draft'],
        grain_direction=grain_dir, nesting=nesting_est,
    )
    dfm_result = _run_dfm_safe(dfm_geometry, process_type_str)

    metrics = {
        "volume": vol_mm3 / 1000.0,
        "surface_area": area_mm2 / 100.0,
        "bbox": bbox_dict,
        "thickness": actual_thickness,
        "primitive_features": {
            "holes": len(holes),
            "pockets": len(pockets),
            "threads": len(features['threads']),
            "slots": len(features['slots']),
            "undercuts": len(features['undercuts']),
            "fillets": len(features['fillets']),
            "faces": triangle_count,
        },
        "feature_detail": _serialize_features(
            threads=features['threads'],
            slots=features['slots'],
            undercuts=features['undercuts'],
            fillets=features['fillets'],
            holes=holes,
            pockets=pockets,
        ),
        "material_usage": None,
        "process_type": process_type_str,
        "sheet_metal_score": metadata.get('sheet_metal_score', 0),
        "complexity": complexity,
        "complexity_score": complexity_score,
        "advanced_metrics": advanced_metrics,
        "dfm_analysis": dfm_result,
        "validation": validation,
    }
    _attach_optional_metrics(metrics, grain_dir, nesting_est, step_bend_result)
    return metrics


def _extract_step_bends(shape, thickness_mm):
    """Extract bend angles from STEP shape with error handling."""
    try:
        result = extract_bend_angles_from_shape(shape, thickness_mm=thickness_mm)
        if result.total_bend_count > 0:
            print(f"🔧 STEP Bend Extraction: {result.total_bend_count} bends "
                  f"(angles {result.min_angle_deg:.1f}°–{result.max_angle_deg:.1f}°, "
                  f"radii {result.min_radius_mm:.2f}–{result.max_radius_mm:.2f}mm)")
        return result
    except Exception as e:
        print(f"⚠️ STEP bend angle extraction failed: {str(e)[:100]}")
        return None


def analyze_file_path(file_path: str, units_hint: Optional[str] = None, 
                      material: Optional[str] = None) -> dict:
    """Analyze a CAD file (STEP/STL) and return normalized metrics.
    Returns a dict matching previous mock structure to limit integration changes.
    
    Args:
        file_path: Path to the CAD file
        units_hint: Unit hint for STL files (e.g. "mm", "inch")
        material: Material type for thickness classification
                  (e.g. "steel", "aluminum", "stainless", "copper", "brass", "titanium")
    """
    ext = os.path.splitext(file_path)[1].lower()
    scale = scale_to_mm(units_hint)
    material_type = material or 'default'
    if ext in (".stl",):
        return _analyze_stl(file_path, scale, material=material_type)
    if ext in (".step", ".stp"):
        return _analyze_step(file_path, material=material_type)
    raise HTTPException(status_code=400, detail="Unsupported CAD format. Use STEP or STL.")

def calculate_stock_size(bbox: dict, thickness: Optional[float] = None) -> dict:
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
def analyze_file(file_id: str, file_path: str, units_hint: Optional[str] = None, 
                 file_url: Optional[str] = None, org_id: Optional[str] = None, 
                 webhook_url: Optional[str] = None, material: Optional[str] = None):
    try:
        local_path = file_path
        if not local_path and file_url:
            local_path = download_to_temp(file_url)
        if not local_path:
            raise ValueError("file_path or file_url is required")

        metrics = analyze_file_path(local_path, units_hint, material=material)
        # Fire-and-forget webhook if provided
        if webhook_url:
            try:
                headers = {}
                secret = os.getenv('GEOMETRY_WEBHOOK_SECRET')
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
                    body = json.dumps(payload)
                    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
                    headers['X-CAD-Webhook-Signature'] = f'sha256={sig}'
                httpx.post(webhook_url, json=payload, headers=headers, timeout=10.0)
            except Exception as webhook_err:
                logging.error(f"Webhook delivery failed for file_id={file_id}: {webhook_err}")
        return {"file_id": file_id, "metrics": metrics}
    except Exception as e:
        return {"error": str(e)}

@router.post("/", response_model=AnalysisResponse)
def analyze_cad_file(request: AnalysisRequest):
    # Queue the analysis task
    task = analyze_file.delay(
        request.file_id, request.file_path or "", request.units_hint, 
        request.file_url, request.org_id, request.webhook_url, request.material
    )
    
    return {
        "file_id": request.file_id,
        "metrics": {},
        "task_id": task.id
    }

@router.get("/{task_id}", response_model=AnalysisResponse)
def get_analysis_result(task_id: str):
    task = analyze_file.AsyncResult(task_id)
    
    if task.ready():
        result = task.get()
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    else:
        raise HTTPException(status_code=202, detail="Analysis in progress")

@router.post("/sync")
def analyze_cad_file_sync(request: AnalysisRequest):
    """Synchronous analysis for immediate results (smaller files)."""
    logging.warning("Sync analysis request: file_id=%s, file_path=%s, file_url=%s",
                    request.file_id, request.file_path, request.file_url)
    local_path = request.file_path
    if not local_path and request.file_url:
        try:
            local_path = download_to_temp(request.file_url)
        except Exception as dl_err:
            logging.error("Download failed for %s: %s", request.file_url, dl_err)
            traceback.print_exc()
            raise HTTPException(status_code=400, detail=f"File download failed: {str(dl_err)[:300]}")
    if not local_path:
        raise HTTPException(status_code=400, detail="file_path or file_url is required")
    try:
        metrics = analyze_file_path(local_path, request.units_hint)
        # Sanitize metrics to ensure JSON serializability (handles numpy types, NaN, inf)
        safe_metrics = _json_safe(metrics)
        return JSONResponse(content={"file_id": request.file_id, "metrics": safe_metrics})
    except HTTPException:
        raise
    except Exception as e:
        # Log the full traceback so real errors are visible in Docker logs
        logging.error("Analysis failed for file_id=%s: %s", request.file_id, str(e))
        traceback.print_exc()

        # Last-resort assembly detection: if analysis crashed but we can
        # still load and check the shape, return assembly info instead of 500
        try:
            ext = os.path.splitext(local_path)[1].lower()
            if ext in ('.step', '.stp') and occ_available():
                shape = load_step_shape(local_path)
                assembly_result = _detect_assembly_early(shape)
                if assembly_result is not None:
                    logging.warning(
                        "Analysis crashed but assembly detected — returning assembly metrics"
                    )
                    safe_metrics = _json_safe(assembly_result)
                    return JSONResponse(
                        content={"file_id": request.file_id, "metrics": safe_metrics}
                    )
        except Exception:
            pass  # Last resort failed — fall through to original error

        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)[:500]}")


# ---------------------------------------------------------------------------
# Feedback & retraining endpoints (Phase 6: Confidence calibration)
# ---------------------------------------------------------------------------

class FeedbackRequest(BaseModel):
    """Request body for classification feedback."""
    file_id: str
    confirmed_process: str  # 'sheet_metal' | 'cnc_milling' | 'cnc_turning'
    original_process: Optional[str] = None
    original_confidence: Optional[float] = None
    features: Optional[dict] = None  # feature vector from original analysis


@router.post("/feedback")
def submit_classification_feedback(request: FeedbackRequest):
    """Record a user-confirmed classification for ML retraining.

    Called when a user manually overrides the auto-detected process type.
    This data is stored and used to improve the ML classifier over time.
    """
    if request.confirmed_process not in ('sheet_metal', 'cnc_milling', 'cnc_turning'):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid process type: {request.confirmed_process}. "
                   f"Must be 'sheet_metal', 'cnc_milling', or 'cnc_turning'.",
        )

    try:
        from ..core.ml_classifier import MLProcessClassifier
        classifier = MLProcessClassifier()
        features = request.features or {}
        classifier.record_feedback(features, request.confirmed_process)
        logging.warning(
            "Classification feedback recorded: file_id=%s, "
            "original=%s (%.2f) → confirmed=%s",
            request.file_id,
            request.original_process or "unknown",
            request.original_confidence or 0.0,
            request.confirmed_process,
        )
        return {"status": "ok", "message": "Feedback recorded for ML retraining"}
    except Exception as e:
        logging.error("Failed to record feedback: %s", e)
        raise HTTPException(status_code=500, detail=f"Feedback recording failed: {str(e)[:200]}")


@router.post("/retrain")
def trigger_ml_retrain():
    """Trigger ML model retraining with accumulated feedback data.

    Should be called periodically (e.g., weekly cron) or by an admin.
    Requires at least 50 feedback samples to retrain.
    """
    try:
        from ..core.ml_classifier import MLProcessClassifier, _FEEDBACK_PATH
        if not _FEEDBACK_PATH.exists():
            return {"status": "skipped", "message": "No feedback data available yet"}

        # Count feedback samples
        with open(_FEEDBACK_PATH) as f:
            sample_count = sum(1 for _ in f)

        classifier = MLProcessClassifier()
        classifier.retrain_with_feedback(min_samples=50)
        logging.warning("ML retrain triggered with %d feedback samples", sample_count)
        return {
            "status": "ok",
            "message": f"Retrained with {sample_count} feedback samples",
            "sample_count": sample_count,
        }
    except Exception as e:
        logging.error("ML retrain failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Retrain failed: {str(e)[:200]}")
