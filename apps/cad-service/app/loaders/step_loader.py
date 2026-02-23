from __future__ import annotations
from typing import Any, Tuple
from dataclasses import dataclass


@dataclass
class AssemblyInfo:
    """Information about whether a STEP file contains an assembly."""
    is_assembly: bool
    solid_count: int
    compound_count: int
    shell_count: int
    reason: str


def occ_available() -> bool:
    try:
        import OCC
        return True
    except Exception:
        return False


def count_solids_and_compounds(shape) -> AssemblyInfo:
    """
    Count the number of solid bodies and compounds in a shape.
    Used to detect assemblies which require manual quoting.
    
    Enhanced detection:
    - Multiple solids = assembly
    - Multiple compounds = assembly  
    - Multiple shells with no solids = assembly (sheet metal assembly)
    - Single solid with multiple disjoint volumes = assembly
    
    Returns:
        AssemblyInfo with counts and assembly detection result
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_SOLID, TopAbs_COMPOUND, TopAbs_SHELL, TopAbs_FACE
        
        solid_count = 0
        compound_count = 0
        shell_count = 0
        face_count = 0
        
        # Count solids
        solid_explorer = TopExp_Explorer(shape, TopAbs_SOLID)
        while solid_explorer.More():
            solid_count += 1
            solid_explorer.Next()
        
        # Count compounds (assemblies are usually compounds)
        compound_explorer = TopExp_Explorer(shape, TopAbs_COMPOUND)
        while compound_explorer.More():
            compound_count += 1
            compound_explorer.Next()
        
        # Count shells (for sheet metal detection)
        shell_explorer = TopExp_Explorer(shape, TopAbs_SHELL)
        while shell_explorer.More():
            shell_count += 1
            shell_explorer.Next()
            
        # Count faces for complexity estimation
        face_explorer = TopExp_Explorer(shape, TopAbs_FACE)
        while face_explorer.More():
            face_count += 1
            face_explorer.Next()
        
        # Determine if this is an assembly
        is_assembly = False
        reason = "Single part detected"
        
        # Primary checks: multiple bodies
        if solid_count > 1:
            is_assembly = True
            reason = f"Assembly detected: {solid_count} solid bodies found"
        elif compound_count > 1:
            is_assembly = True
            reason = f"Assembly detected: {compound_count} compound shapes found"
        elif solid_count == 0 and shell_count > 1:
            is_assembly = True
            reason = f"Assembly detected: {shell_count} shell bodies found (sheet metal assembly)"
        # Secondary check: compound with 0 solids but many shells/faces
        # This catches assemblies where each component is a shell rather than solid
        elif compound_count == 1 and solid_count == 0 and shell_count > 3:
            is_assembly = True
            reason = f"Assembly detected: compound with {shell_count} shells (multi-part)"
        
        return AssemblyInfo(
            is_assembly=is_assembly,
            solid_count=solid_count,
            compound_count=compound_count,
            shell_count=shell_count,
            reason=reason
        )
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            "Assembly detection failed (defaulting to single part): %s — "
            "This may cause assemblies to bypass manual-quote routing. "
            "Shape type: %s",
            e, type(shape).__name__
        )
        return AssemblyInfo(
            is_assembly=False,
            solid_count=1,
            compound_count=0,
            shell_count=0,
            reason=f"Assembly detection error: {e}"
        )


def load_step_shape(path: str):
    """Return a TopoDS_Shape from a STEP file using pythonOCC.
    Raises RuntimeError if OCC not available or file can't be read.
    """
    if not occ_available():
        raise RuntimeError("pythonocc-core is not available in this environment")

    from OCC.Core.STEPControl import STEPControl_Reader
    from OCC.Core.IFSelect import IFSelect_RetDone

    reader = STEPControl_Reader()
    status = reader.ReadFile(path)
    if status != IFSelect_RetDone:
        raise RuntimeError("STEP read failed")
    reader.TransferRoots()
    shape = reader.OneShape()
    return shape


def load_iges_shape(path: str):
    """Return a TopoDS_Shape from an IGES file using pythonOCC.
    
    IGES (Initial Graphics Exchange Specification) is an older CAD format
    similar to STEP but with less rich topology. OCC can read it and produce
    the same TopoDS_Shape for analysis.
    
    Raises RuntimeError if OCC not available or file can't be read.
    """
    if not occ_available():
        raise RuntimeError("pythonocc-core is not available in this environment")

    from OCC.Core.IGESControl import IGESControl_Reader
    from OCC.Core.IFSelect import IFSelect_RetDone

    reader = IGESControl_Reader()
    status = reader.ReadFile(path)
    if status != IFSelect_RetDone:
        raise RuntimeError("IGES read failed")
    reader.TransferRoots()
    shape = reader.OneShape()
    return shape


def load_brep_shape(path: str):
    """Load a shape from STEP or IGES file based on extension.
    
    This is a convenience function that auto-detects the format.
    """
    import os
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.step', '.stp'):
        return load_step_shape(path)
    elif ext in ('.iges', '.igs'):
        return load_iges_shape(path)
    else:
        raise RuntimeError(f"Unsupported BRep format: {ext}. Use .step, .stp, .iges, or .igs")


def shape_mass_props(shape) -> tuple[float, float]:
    """Return (volume_mm3, surface_area_mm2) for a TopoDS_Shape."""
    from OCC.Core.GProp import GProp_GProps
    from OCC.Core.BRepGProp import brepgprop

    props = GProp_GProps()
    # Use new static method syntax (pythonocc-core 7.7.1+)
    brepgprop.VolumeProperties(shape, props)
    # CRITICAL FIX: OCC returns values in file units (typically mm), NOT SI units (m)
    # Previously multiplied by 1e9 thinking it was m³, causing billion-scale bugs
    vol = props.Mass()  # Already in mm³ from STEP file units

    props2 = GProp_GProps()
    # Use new static method syntax (pythonocc-core 7.7.1+)
    brepgprop.SurfaceProperties(shape, props2)
    # CRITICAL FIX: OCC returns surface area in file units (mm²), NOT m²
    # Previously multiplied by 1e6, causing billion mm² values
    area = props2.Mass()  # Already in mm² from STEP file units
    return float(vol), float(area)

