from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import hashlib
import hmac
import json
import logging
import os

import httpx

from ..workers.celery import celery_app
from ..utils.download import download_to_temp
from ..utils.units import scale_to_mm
from ..loaders.step_loader import occ_available, load_step_shape, shape_mass_props, count_solids_and_compounds
from ..loaders.stl_loader import load_stl, mesh_mass_props
from ..extractors.holes import extract_holes_from_shape
from ..extractors.pockets import extract_pockets_from_shape
from ..extractors.min_wall import min_wall_mesh
from ..extractors.threads import extract_threads_from_shape, extract_threads_from_mesh
from ..extractors.slots import extract_slots_from_shape, extract_slots_from_pockets
from ..extractors.undercuts import extract_undercuts_from_shape, detect_undercuts_from_mesh
from ..extractors.fillets import extract_fillets_from_shape, detect_fillets_from_mesh
from ..extractors.draft_angles import analyze_draft_from_shape, analyze_draft_from_mesh
from ..extractors.grain_direction import analyze_grain_direction
from ..extractors.nesting import estimate_nesting
from ..extractors.bend_angles import extract_bend_angles_from_shape
from ..models import FeaturesJson, BBox, MassProps, HoleFeature, PocketFeature, MinWallData

# Import new core modules for clean architecture
from ..core.geometry import GeometricMetrics, calculate_sheet_metal_score, calculate_advanced_metrics
from ..core.bend_detection import AdvancedBendDetector
from ..core.classification import ProcessClassifier
from ..dfm_analyzer import analyze_dfm, build_geometry_for_dfm
from ..core.validation import validate_geometry
from ..core.advanced_thickness_detection import enhanced_ray_casting_analysis

router = APIRouter()

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
        
        # Calculate legacy thickness confidence based on detection quality
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
        
        # === ADVANCED THICKNESS ANALYSIS (PREFERRED) ===
        # Use proper sheet metal detection with clustering and area-weighted analysis
        thickness_analysis = enhanced_ray_casting_analysis(mesh, bbox_dims, samples=8000)
        
        print(f"🔬 Advanced Thickness Analysis:")
        print(f"   Sheet thickness detected: {thickness_analysis.is_sheet_thickness}")
        if thickness_analysis.detected_thickness:
            print(f"   Thickness: {thickness_analysis.detected_thickness:.2f}mm")
            print(f"   Uniform ratio: {thickness_analysis.uniform_ratio:.1%}")
            print(f"   T/L ratio: {thickness_analysis.thickness_to_size_ratio:.1%}")
            print(f"   Dominance: {thickness_analysis.cluster_dominance:.1f}x")
            print(f"   Confidence: {thickness_analysis.confidence:.1%}")
        print(f"   Reasoning: {thickness_analysis.reasoning}")
        
        # === USE NEW CORE MODULES FOR CLEAN CLASSIFICATION ===
        geom_metrics = GeometricMetrics(bbox_dims, vol_mm3, area_mm2)
        classifier = ProcessClassifier(geom_metrics)
        
        # Classify with advanced thickness analysis
        process_type, confidence, classification_metadata = classifier.classify(
            detected_thickness=detected_thickness,
            thickness_confidence=thickness_confidence,
            triangle_count=int(mesh.faces.shape[0]),
            thickness_analysis=thickness_analysis  # Pass advanced analysis
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
        
        # === ENTERPRISE COMPLEXITY CALCULATION ===
        # Calculate complexity based on real geometric features
        face_count = int(mesh.faces.shape[0])
        bend_analysis = classification_metadata.get('bend_analysis', {})
        bend_count = bend_analysis.get('bend_count', 0)
        bend_complexity = bend_analysis.get('complexity', 0)
        
        # Complexity scoring for STL (no holes/pockets available from mesh)
        # Based on: triangle count, bend count, aspect ratio, bend complexity
        complexity_score = 0
        
        # Triangle complexity (mesh detail)
        if face_count > 10000:
            complexity_score += 30
        elif face_count > 5000:
            complexity_score += 20
        elif face_count > 2000:
            complexity_score += 10
        
        # Bend complexity for sheet metal
        if process_type_str == 'sheet_metal':
            if bend_count > 6:
                complexity_score += 40
            elif bend_count > 3:
                complexity_score += 25
            elif bend_count > 1:
                complexity_score += 15
            complexity_score += min(20, bend_complexity // 3)
        else:
            # CNC parts: aspect ratio and volume efficiency matter
            bbox_dims.sort()
            if len(bbox_dims) == 3:
                aspect_ratio = bbox_dims[2] / max(bbox_dims[0], 0.1)
                if aspect_ratio > 10:
                    complexity_score += 20
                elif aspect_ratio > 5:
                    complexity_score += 10
        
        # Determine complexity level
        if complexity_score >= 50:
            complexity = 'complex'
        elif complexity_score >= 25:
            complexity = 'moderate'
        else:
            complexity = 'simple'
        
        # === DFM ANALYSIS FOR STL ===
        # Build geometry structure (extract features from mesh)
        
        # --- STL Feature Extraction ---
        stl_threads = []
        stl_undercuts = []
        stl_fillets = []
        stl_draft = []
        try:
            stl_threads = extract_threads_from_mesh(mesh)
        except Exception as e:
            print(f"⚠️ STL thread extraction failed: {str(e)[:80]}")
        try:
            stl_undercuts = detect_undercuts_from_mesh(mesh)
        except Exception as e:
            print(f"⚠️ STL undercut detection failed: {str(e)[:80]}")
        try:
            stl_fillets = detect_fillets_from_mesh(mesh)
        except Exception as e:
            print(f"⚠️ STL fillet detection failed: {str(e)[:80]}")
        try:
            stl_draft = analyze_draft_from_mesh(mesh)
        except Exception as e:
            print(f"⚠️ STL draft analysis failed: {str(e)[:80]}")

        # Sheet metal extras
        grain_dir = None
        nesting_est = None
        if process_type_str == 'sheet_metal':
            bend_axes = []
            if 'bend_analysis' in classification_metadata:
                ba = classification_metadata['bend_analysis']
                for b in ba.get('bends', []):
                    ax = b.get('axis')
                    if ax:
                        bend_axes.append(tuple(ax) if isinstance(ax, (list, tuple)) else (0, 0, 1))
            grain_dir = analyze_grain_direction(
                bend_axes=bend_axes,
                flat_length=bbox_dims[2] if len(bbox_dims) == 3 else 0,
                flat_width=bbox_dims[1] if len(bbox_dims) >= 2 else 0,
            )
            nesting_est = estimate_nesting(
                flat_length=bbox_dims[2] if len(bbox_dims) == 3 else 0,
                flat_width=bbox_dims[1] if len(bbox_dims) >= 2 else 0,
                thickness=detected_thickness or bbox_dims[0] if bbox_dims else 1.0,
            )

        # --- Geometry Validation ---
        validation_result = None
        try:
            validation_result = validate_geometry({
                "boundingBox": {"x": bbox_dims[2] if len(bbox_dims) == 3 else 0,
                                "y": bbox_dims[1] if len(bbox_dims) >= 2 else 0,
                                "z": bbox_dims[0] if len(bbox_dims) >= 1 else 0},
                "volume": vol_mm3,
                "surfaceArea": area_mm2,
            })
        except Exception as e:
            print(f"⚠️ Geometry validation failed: {str(e)[:80]}")

        dfm_geometry = build_geometry_for_dfm(
            bbox_dims=bbox_dims,
            volume_mm3=vol_mm3,
            surface_area_mm2=area_mm2,
            holes=[],
            pockets=[],
            process_type=process_type_str,
            thickness=detected_thickness,
            bend_analysis=classification_metadata.get('bend_analysis'),
            complexity=complexity,
            threads=stl_threads,
            slots=[],
            undercuts=stl_undercuts,
            fillets=stl_fillets,
            draft_analysis=stl_draft,
            grain_direction=grain_dir,
            nesting=nesting_est,
        )
        
        # Run DFM analysis
        dfm_result = None
        try:
            dfm_result = analyze_dfm(
                geometry=dfm_geometry,
                process_type=process_type_str,
                material="aluminum",
                tolerance="standard"
            )
            print(f"✅ DFM Analysis (STL) Complete:")
            print(f"   Score: {dfm_result.get('overall_score', 0):.0f}/100")
            print(f"   Rating: {dfm_result.get('rating', 'unknown')}")
        except Exception as e:
            print(f"⚠️ DFM Analysis failed: {str(e)[:100]}")
            dfm_result = {
                "overall_score": 0,
                "rating": "unknown",
                "is_manufacturable": True,
                "issues": [],
                "error": str(e)[:200]
            }
        
        metrics = {
            "volume": vol_mm3 / 1000.0,  # convert to cm^3
            "surface_area": area_mm2 / 100.0,  # to cm^2
            "bbox": {"min": {"x": float(bbox_min[0]), "y": float(bbox_min[1]), "z": float(bbox_min[2])},
                     "max": {"x": float(bbox_max[0]), "y": float(bbox_max[1]), "z": float(bbox_max[2])}},
            "thickness": detected_thickness,
            "primitive_features": {
                "holes": 0,
                "pockets": 0,
                "slots": 0,
                "threads": len(stl_threads),
                "undercuts": len(stl_undercuts),
                "fillets": len(stl_fillets),
                "faces": face_count,
            },
            "feature_detail": _serialize_features(
                threads=stl_threads,
                undercuts=stl_undercuts,
                fillets=stl_fillets,
            ),
            "material_usage": None,
            "process_type": process_type_str,
            "sheet_metal_score": classification_metadata.get('sheet_metal_score', 0),
            "complexity": complexity,
            "complexity_score": complexity_score,
            "advanced_metrics": advanced_metrics_dict,
            "dfm_analysis": dfm_result,
            "validation": validation_result,
        }
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
        return metrics
    elif ext in (".step", ".stp"):
        if not occ_available():
            raise HTTPException(status_code=400, detail="STEP analysis requires pythonOCC; not available")
        shape = load_step_shape(file_path)
        
        # === ASSEMBLY DETECTION ===
        # Check if this is a multi-body assembly that requires manual quoting
        assembly_info = count_solids_and_compounds(shape)
        if assembly_info.is_assembly:
            print(f"⚠️ {assembly_info.reason}")
            # Return special metrics for assemblies
            return {
                "volume": 0,
                "surface_area": 0,
                "bbox": {"min": {"x": 0, "y": 0, "z": 0}, "max": {"x": 0, "y": 0, "z": 0}},
                "thickness": None,
                "primitive_features": {"holes": 0, "pockets": 0, "slots": 0, "faces": 0},
                "material_usage": None,
                "process_type": "assembly",
                "sheet_metal_score": 0,
                "is_assembly": True,
                "assembly_info": {
                    "solid_count": assembly_info.solid_count,
                    "compound_count": assembly_info.compound_count,
                    "shell_count": assembly_info.shell_count,
                    "reason": assembly_info.reason
                },
                "requires_manual_quote": True,
                "manual_quote_reason": assembly_info.reason,
                "advanced_metrics": {}
            }
        
        vol_mm3, area_mm2 = shape_mass_props(shape)
        
        # BBox using OCC
        from OCC.Core.Bnd import Bnd_Box
        from OCC.Core.BRepBndLib import brepbndlib
        box = Bnd_Box()
        # Use new static method syntax (pythonocc-core 7.7.1+)
        brepbndlib.Add(shape, box)
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
                
                # === ADVANCED THICKNESS ANALYSIS ===
                if triangle_count > 0:
                    thickness_analysis = enhanced_ray_casting_analysis(temp_mesh, bbox_dims, samples=8000)
                    print(f"🔬 Advanced Thickness Analysis (STEP):")
                    print(f"   Sheet thickness: {thickness_analysis.is_sheet_thickness}")
                    if thickness_analysis.detected_thickness:
                        print(f"   Thickness: {thickness_analysis.detected_thickness:.2f}mm")
                        print(f"   Uniform ratio: {thickness_analysis.uniform_ratio:.1%}")
                        print(f"   Reasoning: {thickness_analysis.reasoning}")
                else:
                    thickness_analysis = None
                    
            finally:
                if os.path.exists(tmp_stl_path):
                    os.unlink(tmp_stl_path)
                    
        except Exception as e:
            print(f"⚠️ Wall thickness detection failed: {str(e)[:100]}")
            print("   Using bbox approximation")
            thickness_analysis = None
        
        # === EXTRACT FEATURES BEFORE CLASSIFICATION ===
        # Feature counts improve ML-assisted classification accuracy
        holes = extract_holes_from_shape(shape)
        pockets = extract_pockets_from_shape(shape)

        threads = []
        slots = []
        undercuts = []
        fillets = []
        draft_results = []
        try:
            threads = extract_threads_from_shape(shape, holes)
        except Exception as e:
            print(f"⚠️ Thread extraction failed: {str(e)[:80]}")
        try:
            slots = extract_slots_from_shape(shape)
            if not slots:
                slots = extract_slots_from_pockets(pockets)
        except Exception as e:
            print(f"⚠️ Slot extraction failed: {str(e)[:80]}")
        try:
            undercuts = extract_undercuts_from_shape(shape)
        except Exception as e:
            print(f"⚠️ Undercut detection failed: {str(e)[:80]}")
        try:
            fillets = extract_fillets_from_shape(shape)
        except Exception as e:
            print(f"⚠️ Fillet detection failed: {str(e)[:80]}")
        try:
            draft_results = analyze_draft_from_shape(shape)
        except Exception as e:
            print(f"⚠️ Draft analysis failed: {str(e)[:80]}")

        print(f"🔧 Feature extraction: {len(holes)} holes, {len(pockets)} pockets, "
              f"{len(threads)} threads, {len(slots)} slots, {len(undercuts)} undercuts, "
              f"{len(fillets)} fillets, {len(draft_results)} draft faces")

        # === USE NEW CORE MODULES FOR CLEAN CLASSIFICATION ===
        geom_metrics = GeometricMetrics(bbox_dims, vol_mm3, area_mm2)
        classifier = ProcessClassifier(geom_metrics)
        
        # Classify with advanced thickness analysis + feature counts for ML
        process_type, confidence, classification_metadata = classifier.classify(
            detected_thickness=actual_thickness,
            thickness_confidence=thickness_confidence,
            triangle_count=triangle_count,
            thickness_analysis=thickness_analysis,
            hole_count=len(holes),
            pocket_count=len(pockets),
            thread_count=len(threads),
            undercut_count=len(undercuts),
            fillet_count=len(fillets),
            slot_count=len(slots),
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

        # === STEP BEND ANGLE EXTRACTION ===
        step_bend_result = None
        try:
            step_bend_result = extract_bend_angles_from_shape(
                shape, thickness_mm=actual_thickness
            )
            if step_bend_result.total_bend_count > 0:
                print(f"🔧 STEP Bend Extraction: {step_bend_result.total_bend_count} bends "
                      f"(angles {step_bend_result.min_angle_deg:.1f}°–{step_bend_result.max_angle_deg:.1f}°, "
                      f"radii {step_bend_result.min_radius_mm:.2f}–{step_bend_result.max_radius_mm:.2f}mm)")
        except Exception as e:
            print(f"⚠️ STEP bend angle extraction failed: {str(e)[:100]}")
        
        # === ENTERPRISE COMPLEXITY CALCULATION FOR STEP FILES ===
        # Based on actual extracted features: holes, pockets, triangles, bends
        hole_count = len(holes)
        pocket_count = len(pockets)
        bend_analysis = classification_metadata.get('bend_analysis', {})
        bend_count = bend_analysis.get('bend_count', 0)
        bend_complexity = bend_analysis.get('complexity', 0)
        
        complexity_score = 0
        
        # Feature-based complexity (STEP has actual feature extraction)
        if hole_count > 20:
            complexity_score += 35
        elif hole_count > 10:
            complexity_score += 25
        elif hole_count > 5:
            complexity_score += 15
        elif hole_count > 0:
            complexity_score += 8
        
        if pocket_count > 10:
            complexity_score += 30
        elif pocket_count > 5:
            complexity_score += 20
        elif pocket_count > 2:
            complexity_score += 12
        elif pocket_count > 0:
            complexity_score += 6
        
        # Triangle/face complexity
        if triangle_count > 15000:
            complexity_score += 20
        elif triangle_count > 8000:
            complexity_score += 12
        elif triangle_count > 3000:
            complexity_score += 6
        
        # Sheet metal specific: bends add complexity
        if process_type_str == 'sheet_metal':
            if bend_count > 6:
                complexity_score += 30
            elif bend_count > 3:
                complexity_score += 20
            elif bend_count > 1:
                complexity_score += 10
            complexity_score += min(15, bend_complexity // 4)
        else:
            # CNC: aspect ratio adds to complexity
            sorted_dims = sorted(bbox_dims)
            if len(sorted_dims) == 3:
                aspect_ratio = sorted_dims[2] / max(sorted_dims[0], 0.1)
                if aspect_ratio > 10:
                    complexity_score += 15
                elif aspect_ratio > 5:
                    complexity_score += 8
        
        # Determine complexity level
        if complexity_score >= 50:
            complexity = 'complex'
        elif complexity_score >= 25:
            complexity = 'moderate'
        else:
            complexity = 'simple'
        
        # === DFM ANALYSIS ===
        # Sheet metal extras
        step_grain_dir = None
        step_nesting_est = None
        if process_type_str == 'sheet_metal':
            bend_axes = []
            if bend_analysis:
                for b in bend_analysis.get('bends', []):
                    ax = b.get('axis')
                    if ax:
                        bend_axes.append(tuple(ax) if isinstance(ax, (list, tuple)) else (0, 0, 1))
            step_grain_dir = analyze_grain_direction(
                bend_axes=bend_axes,
                flat_length=bbox_dims[2] if len(bbox_dims) == 3 else 0,
                flat_width=bbox_dims[1] if len(bbox_dims) >= 2 else 0,
            )
            step_nesting_est = estimate_nesting(
                flat_length=bbox_dims[2] if len(bbox_dims) == 3 else 0,
                flat_width=bbox_dims[1] if len(bbox_dims) >= 2 else 0,
                thickness=actual_thickness or bbox_dims[0] if bbox_dims else 1.0,
            )

        # --- Geometry Validation ---
        step_validation = None
        try:
            step_validation = validate_geometry({
                "boundingBox": {"x": bbox_dims[2] if len(bbox_dims) == 3 else 0,
                                "y": bbox_dims[1] if len(bbox_dims) >= 2 else 0,
                                "z": bbox_dims[0] if len(bbox_dims) >= 1 else 0},
                "volume": vol_mm3,
                "surfaceArea": area_mm2,
            })
        except Exception as e:
            print(f"⚠️ Geometry validation failed: {str(e)[:80]}")

        # Build geometry structure for DFM analysis
        dfm_geometry = build_geometry_for_dfm(
            bbox_dims=bbox_dims,
            volume_mm3=vol_mm3,
            surface_area_mm2=area_mm2,
            holes=holes,
            pockets=pockets,
            process_type=process_type_str,
            thickness=actual_thickness,
            bend_analysis=bend_analysis,
            complexity=complexity,
            threads=threads,
            slots=slots,
            undercuts=undercuts,
            fillets=fillets,
            draft_analysis=draft_results,
            grain_direction=step_grain_dir,
            nesting=step_nesting_est,
        )
        
        # Run DFM analysis
        dfm_result = None
        try:
            dfm_result = analyze_dfm(
                geometry=dfm_geometry,
                process_type=process_type_str,
                material="aluminum",  # Default material
                tolerance="standard"
            )
            print(f"✅ DFM Analysis Complete:")
            print(f"   Score: {dfm_result.get('overall_score', 0):.0f}/100")
            print(f"   Rating: {dfm_result.get('rating', 'unknown')}")
            print(f"   Issues: {len(dfm_result.get('issues', []))}")
            print(f"   Manufacturable: {dfm_result.get('is_manufacturable', True)}")
        except Exception as e:
            print(f"⚠️ DFM Analysis failed: {str(e)[:100]}")
            dfm_result = {
                "overall_score": 0,
                "rating": "unknown",
                "is_manufacturable": True,
                "issues": [],
                "error": str(e)[:200]
            }
        
        metrics = {
            "volume": vol_mm3 / 1000.0,
            "surface_area": area_mm2 / 100.0,
            "bbox": {"min": {"x": xmin, "y": ymin, "z": zmin}, "max": {"x": xmax, "y": ymax, "z": zmax}},
            "thickness": actual_thickness,
            "primitive_features": {
                "holes": hole_count,
                "pockets": pocket_count,
                "threads": len(threads),
                "slots": len(slots),
                "undercuts": len(undercuts),
                "fillets": len(fillets),
                "faces": triangle_count,
            },
            "feature_detail": _serialize_features(
                threads=threads,
                slots=slots,
                undercuts=undercuts,
                fillets=fillets,
                holes=holes,
                pockets=pockets,
            ),
            "material_usage": None,
            "process_type": process_type_str,
            "sheet_metal_score": classification_metadata.get('sheet_metal_score', 0),
            "complexity": complexity,
            "complexity_score": complexity_score,
            "advanced_metrics": advanced_metrics_dict,
            "dfm_analysis": dfm_result,
            "validation": step_validation,
        }
        # Attach STEP bend angle data if available
        if step_bend_result and step_bend_result.total_bend_count > 0:
            metrics["step_bend_angles"] = step_bend_result.to_dict()
        if step_grain_dir:
            metrics["grain_direction"] = {
                "recommended": step_grain_dir.recommended_direction,
                "score": step_grain_dir.alignment_score,
                "notes": step_grain_dir.notes,
            }
        if step_nesting_est:
            metrics["nesting"] = {
                "parts_per_sheet": step_nesting_est.parts_per_sheet,
                "utilization_pct": step_nesting_est.utilization_pct,
                "sheet_size": f"{step_nesting_est.sheet_width_mm}×{step_nesting_est.sheet_height_mm}mm",
            }
        return metrics
    else:
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
