from __future__ import annotations
from typing import Any


def occ_available() -> bool:
    try:
        import OCC
        return True
    except Exception:
        return False


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

