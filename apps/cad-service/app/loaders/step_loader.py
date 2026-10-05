from __future__ import annotations
from typing import Any, List, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class AssemblyInfo:
    """Information about whether a STEP file contains an assembly."""
    is_assembly: bool
    solid_count: int
    compound_count: int
    shell_count: int
    reason: str
    # True when the file is a SINGLE part that happens to contain several
    # solid bodies (a multibody .SLDPRT and friends). Such files must still be
    # analyzed normally — they are not assemblies and do not need manual quoting.
    is_multi_body_part: bool = False
    # How the verdict was reached: "product_structure" (authoritative, read from
    # the STEP AP214 product tree) or "topology" (body-count heuristics).
    detection_source: str = "topology"


@dataclass
class ProductStructureInfo:
    """The STEP product structure (AP214 product tree), read via XCAF.

    This is the authoritative answer to "is this an assembly?". Counting solid
    bodies cannot distinguish a real assembly from a multibody single part,
    because both arrive as one compound of N solids; the product tree can.

    ``available`` is False when the structure could not be read (non-STEP input,
    read error, or an OCC build without STEPCAFControl) — callers then fall back
    to the topology heuristics.
    """
    available: bool
    root_count: int = 0
    assembly_root_count: int = 0
    component_count: int = 0
    root_names: List[str] = field(default_factory=list)
    note: str = ""

    @property
    def is_assembly(self) -> bool:
        """True when the product tree itself describes an assembly."""
        return self.available and (
            self.assembly_root_count > 0 or self.root_count > 1
        )

    @property
    def is_single_product(self) -> bool:
        """True when the tree definitively describes one standalone part."""
        return (
            self.available
            and self.root_count == 1
            and self.assembly_root_count == 0
            and self.component_count == 0
        )


def occ_available() -> bool:
    try:
        import OCC
        return True
    except Exception:
        return False


def read_step_product_structure(path: str) -> ProductStructureInfo:
    """Read the STEP product structure (AP214 product tree) via XCAF.

    A real assembly carries NEXT_ASSEMBLY_USAGE_OCCURRENCE links, which XCAF
    exposes as component labels under an assembly root. A multibody single part
    carries one PRODUCT with no occurrences, no matter how many solid bodies it
    holds. That distinction is invisible to body counting, which is why this
    exists.

    Never raises — on any failure it returns ``available=False`` so the caller
    falls back to the topology heuristics.
    """
    import logging
    logger = logging.getLogger(__name__)

    if not occ_available():
        return ProductStructureInfo(available=False, note="pythonocc-core unavailable")

    try:
        from OCC.Core.IFSelect import IFSelect_RetDone
        from OCC.Core.STEPCAFControl import STEPCAFControl_Reader
        from OCC.Core.TCollection import TCollection_ExtendedString
        from OCC.Core.TDataStd import TDataStd_Name
        from OCC.Core.TDF import TDF_Label, TDF_LabelSequence
        from OCC.Core.TDocStd import TDocStd_Document

        try:
            from OCC.Core.XCAFDoc import XCAFDoc_DocumentTool
            document_shape_tool = getattr(
                XCAFDoc_DocumentTool, "ShapeTool", None
            ) or getattr(XCAFDoc_DocumentTool, "ShapeTool_s")
        except (ImportError, AttributeError):
            # pythonocc < 7.7 exposes the document tool as a free function
            from OCC.Core.XCAFDoc import (
                XCAFDoc_DocumentTool_ShapeTool as document_shape_tool,
            )

        doc = TDocStd_Document(TCollection_ExtendedString("XCAF"))
        reader = STEPCAFControl_Reader()
        reader.SetNameMode(True)
        if reader.ReadFile(path) != IFSelect_RetDone:
            return ProductStructureInfo(available=False, note="STEPCAF read failed")
        if not reader.Transfer(doc):
            return ProductStructureInfo(available=False, note="STEPCAF transfer failed")

        shape_tool = document_shape_tool(doc.Main())

        def shape_tool_method(name: str):
            """Resolve a ShapeTool method across OCC bindings.

            Several of these are static in OCCT, and the bindings disagree on
            how to surface them: some bind an instance method, others only the
            class-level ``<Name>_s``. Calling the wrong one raises
            AttributeError, which would silently disable product-structure
            detection — so resolve both spellings up front.
            """
            instance_method = getattr(shape_tool, name, None)
            if callable(instance_method):
                return instance_method
            static_method = getattr(type(shape_tool), f"{name}_s", None)
            if callable(static_method):
                return static_method
            raise AttributeError(f"XCAFDoc_ShapeTool exposes no {name}")

        get_free_shapes = shape_tool_method("GetFreeShapes")
        is_assembly_label = shape_tool_method("IsAssembly")
        get_components = shape_tool_method("GetComponents")
        get_referred_shape = shape_tool_method("GetReferredShape")

        roots = TDF_LabelSequence()
        get_free_shapes(roots)

        def label_name(label) -> str:
            holder = TDataStd_Name()
            name_id = getattr(TDataStd_Name, "GetID", None) or getattr(
                TDataStd_Name, "GetID_s"
            )
            if label.FindAttribute(name_id(), holder):
                return str(holder.Get().ToExtString())
            return ""

        def count_components(label, depth: int = 0) -> int:
            """Total component occurrences under ``label``, recursively."""
            if depth > 32:  # guard against a cyclic or pathological tree
                return 0
            components = TDF_LabelSequence()
            if not get_components(label, components):
                return 0
            total = components.Length()
            for i in range(1, components.Length() + 1):
                # A component label references the part or subassembly it
                # instances; recurse through the reference so nested
                # assemblies are counted too.
                target = TDF_Label()
                if get_referred_shape(components.Value(i), target):
                    total += count_components(target, depth + 1)
            return total

        root_count = roots.Length()
        assembly_root_count = 0
        component_count = 0
        root_names: List[str] = []

        for i in range(1, root_count + 1):
            root = roots.Value(i)
            root_names.append(label_name(root))
            if is_assembly_label(root):
                assembly_root_count += 1
            component_count += count_components(root)

        return ProductStructureInfo(
            available=True,
            root_count=root_count,
            assembly_root_count=assembly_root_count,
            component_count=component_count,
            root_names=root_names,
            note="read via STEPCAFControl",
        )

    except Exception as exc:
        logger.info(
            "Product structure unavailable for %s (%s) — falling back to "
            "topology-based assembly detection",
            path, exc,
        )
        return ProductStructureInfo(available=False, note=f"error: {exc}")


def decide_assembly(
    solid_count: int,
    compound_count: int,
    shell_count: int,
    product_structure: Optional[ProductStructureInfo] = None,
) -> AssemblyInfo:
    """Decide whether these body counts describe an assembly.

    Pure: takes counts rather than a shape, so the routing rules can be
    exercised without a CAD kernel. See :func:`count_solids_and_compounds`
    for how the counts are produced and why the product structure wins.
    """
    # Authoritative path: the STEP product tree. It distinguishes a real
    # assembly (components instanced into a root) from a multibody single part
    # (one product, many bodies) — body counting cannot.
    if product_structure is not None and product_structure.available:
        if product_structure.is_assembly:
            part_count = max(
                product_structure.component_count, product_structure.root_count
            )
            return AssemblyInfo(
                is_assembly=True,
                solid_count=solid_count,
                compound_count=compound_count,
                shell_count=shell_count,
                reason=(
                    f"Assembly detected: product structure contains "
                    f"{part_count} component{'s' if part_count != 1 else ''}"
                    f" ({solid_count} solid bodies)"
                ),
                detection_source="product_structure",
            )
        if product_structure.is_single_product:
            multi_body = solid_count > 1
            name = (product_structure.root_names or [""])[0]
            named = f" '{name}'" if name else ""
            return AssemblyInfo(
                is_assembly=False,
                solid_count=solid_count,
                compound_count=compound_count,
                shell_count=shell_count,
                reason=(
                    f"Multi-body part{named}: {solid_count} solid bodies in a "
                    f"single product with no assembly structure"
                    if multi_body
                    else f"Single part{named} detected"
                ),
                is_multi_body_part=multi_body,
                detection_source="product_structure",
            )
        # Readable but inconclusive (e.g. zero free shapes) — fall through to
        # the topology heuristics below.

    is_assembly = False
    reason = "Single part detected"

    # Topology fallback: multiple bodies
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
        reason=reason,
    )


def count_solids_and_compounds(
    shape,
    product_structure: Optional[ProductStructureInfo] = None,
) -> AssemblyInfo:
    """
    Count the number of solid bodies and compounds in a shape and decide
    whether the file is an assembly (which requires manual quoting).

    When ``product_structure`` is supplied and readable it is authoritative:
    the STEP product tree states outright whether components were instanced.
    Pass it whenever the source path is a STEP file — without it, a multibody
    single part (one PRODUCT, many solid bodies, e.g. a SolidWorks part built
    from thicken/mirror/body-copy features) is indistinguishable from a real
    assembly and gets wrongly routed to manual quoting.

    Topology fallback, used for IGES and for unreadable product trees:
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
        
        return decide_assembly(
            solid_count=solid_count,
            compound_count=compound_count,
            shell_count=shell_count,
            product_structure=product_structure,
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

