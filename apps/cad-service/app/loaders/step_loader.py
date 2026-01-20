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
    
    Returns:
        AssemblyInfo with counts and assembly detection result
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_SOLID, TopAbs_COMPOUND, TopAbs_SHELL
        
        solid_count = 0
        compound_count = 0
        shell_count = 0
        
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
        
        # Determine if this is an assembly
        is_assembly = False
        reason = "Single part detected"
        
        if solid_count > 1:
            is_assembly = True
            reason = f"Assembly detected: {solid_count} solid bodies found"
        elif compound_count > 1:
            is_assembly = True
            reason = f"Assembly detected: {compound_count} compound shapes found"
        elif solid_count == 0 and shell_count > 1:
            is_assembly = True
            reason = f"Assembly detected: {shell_count} shell bodies found"
        
        return AssemblyInfo(
            is_assembly=is_assembly,
            solid_count=solid_count,
            compound_count=compound_count,
            shell_count=shell_count,
            reason=reason
        )
        
    except Exception as e:
        print(f"⚠️ Assembly detection failed: {e}")
        return AssemblyInfo(
            is_assembly=False,
            solid_count=1,
            compound_count=0,
            shell_count=0,
            reason="Could not determine assembly status"
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

