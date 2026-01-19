#!/usr/bin/env python3
"""
FastAPI endpoint for CAD feature extraction using OpenCascade
Extracts geometric features from STEP/IGES files and returns structured data

Usage:
  uvicorn cad_features:app --host 0.0.0.0 --port 8001 --reload

Dependencies:
  pip install fastapi uvicorn python-multipart OCP numpy
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
import tempfile
import os
import json

try:
    from OCP.STEPControl import STEPControl_Reader
    from OCP.IGESControl import IGESControl_Reader
    from OCP.TopExp import TopExp_Explorer
    from OCP.TopAbs import TopAbs_SOLID, TopAbs_FACE, TopAbs_EDGE
    from OCP.GProp import GProp_GProps
    from OCP.BRepGProp import brepgprop
    from OCP.BRepBndLib import brepbndlib
    from OCP.Bnd import Bnd_Box
    HAS_OCP = True
except ImportError:
    HAS_OCP = False
    print("Warning: OpenCascade (OCP) not installed. Install with: pip install OCP")

import numpy as np

app = FastAPI(title="CAD Feature Extractor", version="1.0.0")


def extract_step_features(file_path: str) -> Dict[str, Any]:
    """Extract geometric features from STEP file using OpenCascade"""
    if not HAS_OCP:
        raise HTTPException(status_code=500, detail="OpenCascade not installed")
    
    reader = STEPControl_Reader()
    status = reader.ReadFile(file_path)
    
    if status != 1:  # IFSelect_RetDone
        raise HTTPException(status_code=400, detail="Failed to read STEP file")
    
    reader.TransferRoots()
    shape = reader.OneShape()
    
    # Extract basic properties
    props = GProp_GProps()
    brepgprop.VolumeProperties_s(shape, props)
    
    volume = props.Mass()
    centroid = props.CentreOfMass()
    
    # Bounding box
    bbox = Bnd_Box()
    brepbndlib.Add_s(shape, bbox)
    xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
    
    dimensions = {
        'x': xmax - xmin,
        'y': ymax - ymin,
        'z': zmax - zmin,
    }
    
    # Count topology elements
    explorer = TopExp_Explorer()
    
    solid_count = 0
    explorer.Init(shape, TopAbs_SOLID)
    while explorer.More():
        solid_count += 1
        explorer.Next()
    
    face_count = 0
    explorer.Init(shape, TopAbs_FACE)
    while explorer.More():
        face_count += 1
        explorer.Next()
    
    edge_count = 0
    explorer.Init(shape, TopAbs_EDGE)
    while explorer.More():
        edge_count += 1
        explorer.Next()
    
    # Calculate complexity metrics
    surface_area = 0.0
    props_surf = GProp_GProps()
    brepgprop.SurfaceProperties_s(shape, props_surf)
    surface_area = props_surf.Mass()
    
    # Feature vector for ML (normalized)
    features = {
        # Dimensions
        'dim_x': dimensions['x'],
        'dim_y': dimensions['y'],
        'dim_z': dimensions['z'],
        'max_dim': max(dimensions.values()),
        'min_dim': min(dimensions.values()),
        'dim_ratio': max(dimensions.values()) / (min(dimensions.values()) + 0.001),
        
        # Volume and area
        'volume': volume,
        'surface_area': surface_area,
        'surface_to_volume_ratio': surface_area / (volume + 0.001),
        
        # Topology counts (complexity indicators)
        'solid_count': solid_count,
        'face_count': face_count,
        'edge_count': edge_count,
        
        # Complexity score (normalized)
        'complexity_score': (face_count * 0.5 + edge_count * 0.3 + solid_count * 0.2) / 100.0,
        
        # Bounding box
        'bbox_volume': dimensions['x'] * dimensions['y'] * dimensions['z'],
        'bbox_utilization': volume / (dimensions['x'] * dimensions['y'] * dimensions['z'] + 0.001),
        
        # Centroid
        'centroid_x': centroid.X(),
        'centroid_y': centroid.Y(),
        'centroid_z': centroid.Z(),
    }
    
    return features


@app.get("/")
def root():
    return {"service": "CAD Feature Extractor", "version": "1.0.0", "opencascade": HAS_OCP}


@app.get("/health")
def health():
    return {"status": "healthy", "opencascade_available": HAS_OCP}


@app.post("/extract-step-features")
async def extract_step_geometry(
    file: UploadFile = File(...),
):
    """
    Extract basic geometry from STEP file (volume, surface area, dimensions)
    Simplified endpoint for quick geometry extraction
    """
    if not HAS_OCP:
        raise HTTPException(status_code=500, detail="OpenCascade not installed")
    
    # Determine format
    format = file.filename.split('.')[-1].lower() if file.filename else 'step'
    
    if format not in ['step', 'stp', 'iges', 'igs']:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{format}') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Extract basic geometry
        features = extract_step_features(tmp_path)
        
        return JSONResponse(content={
            "volume": features['volume'],
            "surface_area": features['surface_area'],
            "dimensions": {
                'x': features['dim_x'],
                'y': features['dim_y'],
                'z': features['dim_z']
            },
            "complexity": 'simple' if features['complexity_score'] < 0.3 else ('moderate' if features['complexity_score'] < 0.7 else 'complex'),
            "features": features
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geometry extraction failed: {str(e)}")
    
    finally:
        # Cleanup
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/extract-features")
async def extract_features(
    file: UploadFile = File(...),
    format: Optional[str] = None
):
    """
    Extract geometric features from CAD file
    
    Returns a feature vector suitable for ML pricing models
    """
    
    # Determine format
    if format is None:
        format = file.filename.split('.')[-1].lower() if file.filename else 'step'
    
    if format not in ['step', 'stp', 'iges', 'igs']:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{format}') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Extract features
        if format in ['step', 'stp']:
            features = extract_step_features(tmp_path)
        elif format in ['iges', 'igs']:
            # Similar implementation for IGES
            features = extract_step_features(tmp_path)  # Placeholder
        else:
            raise HTTPException(status_code=400, detail="Unsupported format")
        
        # Add metadata
        features['file_name'] = file.filename
        features['file_size_bytes'] = len(content)
        features['format'] = format
        
        return JSONResponse(content={
            "success": True,
            "features": features,
            "feature_vector": list(features.values()),  # For direct ML input
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {str(e)}")
    
    finally:
        # Cleanup
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/batch-extract")
async def batch_extract(files: List[UploadFile] = File(...)):
    """Extract features from multiple CAD files"""
    results = []
    
    for file in files:
        try:
            result = await extract_features(file)
            results.append({
                "file": file.filename,
                "features": result['features']
            })
        except Exception as e:
            results.append({
                "file": file.filename,
                "error": str(e)
            })
    
    return {"batch_results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
