"""
CAD File Conversion API
Supports STEP, IGES to STL/OBJ conversion using OpenCASCADE
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import tempfile
import os
from pathlib import Path
import logging
from typing import Literal
import io

try:
    from OCC.Core.STEPControl import STEPControl_Reader
    from OCC.Core.IGESControl import IGESControl_Reader
    from OCC.Core.StlAPI import StlAPI_Writer
    from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
    from OCC.Core.BRepBuilderAPI import BRepBuilderAPI_Transform
    from OCC.Extend.DataExchange import write_stl_file
    try:
        from OCC.Extend.DataExchange import write_obj_file
    except ImportError:
        write_obj_file = None  # not available in all pythonocc builds
    from OCC.Core.gp import gp_Trsf, gp_Pnt
    from OCC.Core.Bnd import Bnd_Box
    from OCC.Core.BRepBndLib import brepbndlib_Add
    HAS_OCC = True
except ImportError:
    HAS_OCC = False
    logging.warning("OpenCASCADE (pythonocc) not installed. CAD conversion disabled.")

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/convert")
async def convert_cad_file(
    file: UploadFile = File(...),
    output_format: Literal["stl", "obj"] = Form("stl"),
    quality: Literal["low", "medium", "high"] = Form("medium"),
    linear_deflection: float = Form(0.1),
    angular_deflection: float = Form(0.1),
):
    """
    Convert STEP/IGES files to STL/OBJ format
    
    Args:
        file: CAD file (STEP, STP, IGES, IGS)
        output_format: Target format (stl or obj)
        quality: Quality preset (low, medium, high)
        linear_deflection: Linear deflection for tessellation (smaller = higher quality)
        angular_deflection: Angular deflection for tessellation (smaller = higher quality)
    
    Returns:
        Converted file in requested format
    """
    if not HAS_OCC:
        raise HTTPException(
            status_code=503,
            detail="CAD conversion service unavailable. OpenCASCADE not installed."
        )
    
    # Validate file extension
    filename = file.filename.lower()
    if not filename.endswith(('.step', '.stp', '.iges', '.igs')):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Only STEP and IGES files are supported."
        )
    
    try:
        # Save uploaded file to temp directory
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix) as temp_input:
            content = await file.read()
            temp_input.write(content)
            temp_input_path = temp_input.name
        
        logger.info(f"Converting {filename} to {output_format} (quality: {quality})")
        
        # Read CAD file
        shape = read_cad_file(temp_input_path)
        
        if shape is None:
            raise HTTPException(
                status_code=400,
                detail="Failed to read CAD file. File may be corrupted or invalid."
            )
        
        # Tessellate (convert to mesh)
        mesh_shape(shape, linear_deflection, angular_deflection)
        
        # Convert to target format
        output_buffer = io.BytesIO()
        
        if output_format == "stl":
            write_stl_to_buffer(shape, output_buffer)
            media_type = "application/sla"
            filename_out = f"{Path(filename).stem}.stl"
        else:  # obj
            write_obj_to_buffer(shape, output_buffer)
            media_type = "text/plain"
            filename_out = f"{Path(filename).stem}.obj"
        
        # Cleanup
        os.unlink(temp_input_path)
        
        # Return as streaming response
        output_buffer.seek(0)
        
        logger.info(f"Conversion complete: {filename} -> {filename_out}")
        
        return StreamingResponse(
            output_buffer,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename_out}"',
                "X-Conversion-Time": "calculated-by-backend",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Conversion failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {str(e)}"
        )


def read_cad_file(file_path: str):
    """Read STEP or IGES file and return shape"""
    ext = Path(file_path).suffix.lower()
    
    try:
        if ext in ['.step', '.stp']:
            reader = STEPControl_Reader()
            status = reader.ReadFile(file_path)
            
            if status != 1:  # IFSelect_RetDone
                logger.error(f"Failed to read STEP file: status {status}")
                return None
            
            reader.TransferRoots()
            shape = reader.OneShape()
            
        elif ext in ['.iges', '.igs']:
            reader = IGESControl_Reader()
            status = reader.ReadFile(file_path)
            
            if status != 1:  # IFSelect_RetDone
                logger.error(f"Failed to read IGES file: status {status}")
                return None
            
            reader.TransferRoots()
            shape = reader.OneShape()
            
        else:
            logger.error(f"Unsupported file extension: {ext}")
            return None
        
        return shape
        
    except Exception as e:
        logger.error(f"Error reading CAD file: {str(e)}", exc_info=True)
        return None


def mesh_shape(shape, linear_deflection: float, angular_deflection: float):
    """
    Tessellate shape (convert to triangular mesh)
    
    Args:
        shape: OpenCASCADE shape
        linear_deflection: Maximum distance between mesh and actual surface (mm)
        angular_deflection: Maximum angular deviation (radians)
    """
    try:
        # Create incremental mesh
        mesh = BRepMesh_IncrementalMesh(
            shape,
            linear_deflection,
            False,  # relative
            angular_deflection,
            True    # in parallel
        )
        mesh.Perform()
        
        if not mesh.IsDone():
            logger.warning("Mesh generation incomplete")
        
    except Exception as e:
        logger.error(f"Meshing failed: {str(e)}", exc_info=True)
        raise


def write_stl_to_buffer(shape, buffer: io.BytesIO):
    """Write shape to STL format in buffer"""
    try:
        # Create temporary file (StlAPI_Writer requires file path)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.stl') as temp_file:
            temp_path = temp_file.name
        
        # Write STL file
        stl_writer = StlAPI_Writer()
        stl_writer.SetASCIIMode(False)  # Binary STL is smaller
        stl_writer.Write(shape, temp_path)
        
        # Read file into buffer
        with open(temp_path, 'rb') as f:
            buffer.write(f.read())
        
        # Cleanup
        os.unlink(temp_path)
        
    except Exception as e:
        logger.error(f"STL write failed: {str(e)}", exc_info=True)
        raise


def write_obj_to_buffer(shape, buffer: io.BytesIO):
    """Write shape to OBJ format in buffer"""
    if write_obj_file is None:
        raise RuntimeError("OBJ export is not available in this pythonocc build")
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.obj') as temp_file:
            temp_path = temp_file.name
        
        # Write OBJ file using OCC utility
        write_obj_file(shape, temp_path)
        
        # Read file into buffer
        with open(temp_path, 'rb') as f:
            buffer.write(f.read())
        
        # Cleanup
        os.unlink(temp_path)
        
    except Exception as e:
        logger.error(f"OBJ write failed: {str(e)}", exc_info=True)
        raise


def get_bounding_box(shape):
    """Get bounding box dimensions"""
    bbox = Bnd_Box()
    brepbndlib_Add(shape, bbox)
    
    xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
    
    return {
        "min": {"x": xmin, "y": ymin, "z": zmin},
        "max": {"x": xmax, "y": ymax, "z": zmax},
        "size": {
            "x": xmax - xmin,
            "y": ymax - ymin,
            "z": zmax - zmin
        }
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "occ_available": HAS_OCC,
        "supported_formats": {
            "input": ["step", "stp", "iges", "igs"],
            "output": ["stl", "obj"]
        }
    }
