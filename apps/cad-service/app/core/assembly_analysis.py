"""
Multi-Body and Assembly Analysis.

Handles:
- Per-body classification for assemblies
- Component extraction from multi-solid parts
- Bill of Materials (BOM) generation
- Assembly relationship detection
- Weldment vs assembly distinction
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple, Dict, Any
import math


class ComponentType(str, Enum):
    """Type of component in assembly."""
    MACHINED_PART = "machined_part"
    SHEET_METAL_PART = "sheet_metal_part"
    TURNED_PART = "turned_part"
    CAST_PART = "cast_part"
    MOLDED_PART = "molded_part"
    WELDMENT = "weldment"
    PURCHASED_PART = "purchased_part"  # Fasteners, standard components
    ASSEMBLY = "assembly"
    UNKNOWN = "unknown"


class AssemblyType(str, Enum):
    """Type of assembly."""
    SINGLE_BODY = "single_body"
    MULTI_BODY_PART = "multi_body_part"  # Multiple solids, single manufacture
    WELDMENT = "weldment"                # Welded assembly
    BOLTED_ASSEMBLY = "bolted_assembly"  # Mechanically fastened
    PRESS_FIT_ASSEMBLY = "press_fit"     # Interference fit assembly
    MIXED_ASSEMBLY = "mixed_assembly"    # Multiple assembly methods
    UNKNOWN = "unknown"


@dataclass
class ComponentInfo:
    """Information about a single component/body."""
    body_index: int
    component_type: ComponentType
    name: str = ""
    
    # Geometry
    volume_mm3: float = 0.0
    surface_area_mm2: float = 0.0
    bbox_dims: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    center_of_mass: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    
    # Classification
    recommended_process: str = "cnc_milling"
    classification_confidence: float = 0.5
    
    # Feature counts
    hole_count: int = 0
    pocket_count: int = 0
    thread_count: int = 0
    
    # Material/finish
    estimated_material: str = "aluminum"
    estimated_thickness: Optional[float] = None
    
    # Cost factors
    complexity_score: float = 0.0
    
    # Metadata
    is_standard_part: bool = False
    standard_part_id: Optional[str] = None


@dataclass
class AssemblyRelationship:
    """Relationship between two components."""
    component_a_index: int
    component_b_index: int
    relationship_type: str  # 'contact', 'interference', 'gap', 'concentric'
    contact_area: float = 0.0  # mm²
    gap_distance: float = 0.0  # mm (if gap)
    is_mating_surface: bool = False


@dataclass
class AssemblyAnalysis:
    """Complete assembly analysis results."""
    assembly_type: AssemblyType
    body_count: int
    components: List[ComponentInfo] = field(default_factory=list)
    relationships: List[AssemblyRelationship] = field(default_factory=list)
    
    # Summary
    total_volume_mm3: float = 0.0
    total_surface_area_mm2: float = 0.0
    unique_process_count: int = 1
    
    # Weldment detection
    is_weldment: bool = False
    weld_joint_count: int = 0
    structural_member_count: int = 0
    
    # Standard parts
    standard_part_count: int = 0
    fastener_count: int = 0
    
    # Complexity
    assembly_complexity_score: float = 0.0
    requires_manual_quote: bool = False
    manual_quote_reason: str = ""


def _classify_body_geometry(
    volume: float,
    area: float,
    bbox_dims: Tuple[float, float, float]
) -> Tuple[ComponentType, str, float]:
    """
    Classify a single body based on its geometry.
    
    Returns: (component_type, recommended_process, confidence)
    """
    if volume <= 0 or area <= 0:
        return ComponentType.UNKNOWN, "unknown", 0.0
    
    # Calculate aspect ratios
    dims = sorted(bbox_dims, reverse=True)
    if dims[2] <= 0:
        dims = (dims[0], dims[1], max(dims[2], 0.01))
    
    length = dims[0]
    width = dims[1]
    thickness = dims[2]
    
    aspect_ratio = length / thickness if thickness > 0 else 1.0
    flatness = (length * width) / (thickness * max(length, width)) if thickness > 0 else 1.0
    
    # Volume efficiency (actual vs bounding box)
    bbox_vol = dims[0] * dims[1] * dims[2]
    vol_efficiency = volume / bbox_vol if bbox_vol > 0 else 0.0
    
    # Sheet metal indicators
    if aspect_ratio > 15 and flatness > 10 and thickness < 6:
        return ComponentType.SHEET_METAL_PART, "sheet_metal", 0.8
    
    if aspect_ratio > 10 and flatness > 6 and thickness < 12:
        return ComponentType.SHEET_METAL_PART, "sheet_metal", 0.6
    
    # Turned part indicators (high L/D with cylindrical shape)
    # Check if roughly round cross-section
    if width / thickness < 1.5 and aspect_ratio > 3:
        # Could be turned
        return ComponentType.TURNED_PART, "cnc_turning", 0.5
    
    # Default to machined
    confidence = 0.5
    if vol_efficiency < 0.3:
        # Lots of material removed - definitely machined
        confidence = 0.8
    
    return ComponentType.MACHINED_PART, "cnc_milling", confidence


def _detect_standard_parts(
    volume: float,
    bbox_dims: Tuple[float, float, float]
) -> Tuple[bool, Optional[str]]:
    """
    Detect if body is likely a standard/purchased part.
    
    Checks for common fastener sizes, standard components.
    """
    # Common fastener volumes (simplified)
    # M3x8 screw ~= 28 mm³
    # M5x10 screw ~= 98 mm³
    # M8x20 screw ~= 500 mm³
    
    dims = sorted(bbox_dims, reverse=True)
    length = dims[0]
    diameter_approx = (dims[1] + dims[2]) / 2
    
    # Small cylindrical bodies might be fasteners
    if diameter_approx < 15 and length < 50:
        aspect = length / diameter_approx if diameter_approx > 0 else 1
        if 2 < aspect < 8:
            # Could be a screw/bolt
            return True, "fastener_m{:.0f}".format(diameter_approx)
    
    return False, None


def _detect_weldment_characteristics(
    body_count: int,
    components: List[ComponentInfo],
    relationships: List[AssemblyRelationship]
) -> Tuple[bool, int, int]:
    """
    Detect if assembly is a weldment.
    
    Indicators:
    - Multiple structural shapes (tubes, angles, plates)
    - High contact areas between components
    - Sheet metal parts with mating edges
    
    Returns: (is_weldment, weld_joint_count, structural_member_count)
    """
    if body_count < 2:
        return False, 0, 0
    
    # Count sheet metal / plate components
    structural_count = sum(
        1 for c in components 
        if c.component_type == ComponentType.SHEET_METAL_PART
    )
    
    # Count high-contact relationships (potential weld joints)
    weld_candidates = sum(
        1 for r in relationships
        if r.contact_area > 10 and r.relationship_type == 'contact'
    )
    
    # Heuristic: weldment if mostly sheet metal with many contacts
    if structural_count >= body_count * 0.5 and weld_candidates >= body_count - 1:
        return True, weld_candidates, structural_count
    
    return False, 0, structural_count


def analyze_multi_body_assembly(shape) -> AssemblyAnalysis:
    """
    Analyze a multi-body or assembly shape.
    
    Extracts individual bodies, classifies each, and detects
    assembly relationships.
    """
    try:
        from OCC.Core.TopExp import TopExp_Explorer
        from OCC.Core.TopAbs import TopAbs_SOLID, TopAbs_COMPOUND, TopAbs_COMPSOLID
        from OCC.Core.BRepGProp import brepgprop
        from OCC.Core.GProp import GProp_GProps
        from OCC.Core.Bnd import Bnd_Box
        from OCC.Core.BRepBndLib import brepbndlib
        from OCC.Core.TopoDS import topods
    except ImportError:
        return AssemblyAnalysis(
            assembly_type=AssemblyType.UNKNOWN,
            body_count=0,
            requires_manual_quote=True,
            manual_quote_reason="OCC not available for assembly analysis"
        )
    
    # Extract all solids
    solids = []
    explorer = TopExp_Explorer(shape, TopAbs_SOLID)
    while explorer.More():
        solids.append(topods.Solid(explorer.Current()))
        explorer.Next()
    
    body_count = len(solids)
    
    if body_count == 0:
        return AssemblyAnalysis(
            assembly_type=AssemblyType.UNKNOWN,
            body_count=0,
            requires_manual_quote=True,
            manual_quote_reason="No solid bodies found"
        )
    
    if body_count == 1:
        # Single body - analyze it
        solid = solids[0]
        
        props = GProp_GProps()
        brepgprop.VolumeProperties(solid, props)
        volume = props.Mass()
        
        brepgprop.SurfaceProperties(solid, props)
        area = props.Mass()
        
        bbox = Bnd_Box()
        brepbndlib.Add(solid, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
        bbox_dims = (xmax - xmin, ymax - ymin, zmax - zmin)
        
        center_pnt = props.CentreOfMass()
        center = (center_pnt.X(), center_pnt.Y(), center_pnt.Z())
        
        comp_type, process, confidence = _classify_body_geometry(volume, area, bbox_dims)
        
        return AssemblyAnalysis(
            assembly_type=AssemblyType.SINGLE_BODY,
            body_count=1,
            components=[ComponentInfo(
                body_index=0,
                component_type=comp_type,
                name="body_0",
                volume_mm3=volume,
                surface_area_mm2=area,
                bbox_dims=bbox_dims,
                center_of_mass=center,
                recommended_process=process,
                classification_confidence=confidence
            )],
            total_volume_mm3=volume,
            total_surface_area_mm2=area
        )
    
    # Multiple bodies - analyze each
    components: List[ComponentInfo] = []
    total_volume = 0.0
    total_area = 0.0
    
    for idx, solid in enumerate(solids):
        props = GProp_GProps()
        brepgprop.VolumeProperties(solid, props)
        volume = props.Mass()
        
        brepgprop.SurfaceProperties(solid, props)
        area = props.Mass()
        
        bbox = Bnd_Box()
        brepbndlib.Add(solid, bbox)
        xmin, ymin, zmin, xmax, ymax, zmax = bbox.Get()
        bbox_dims = (xmax - xmin, ymax - ymin, zmax - zmin)
        
        center_pnt = props.CentreOfMass()
        center = (center_pnt.X(), center_pnt.Y(), center_pnt.Z())
        
        # Classify body
        comp_type, process, confidence = _classify_body_geometry(volume, area, bbox_dims)
        
        # Check for standard parts
        is_standard, std_id = _detect_standard_parts(volume, bbox_dims)
        if is_standard:
            comp_type = ComponentType.PURCHASED_PART
        
        components.append(ComponentInfo(
            body_index=idx,
            component_type=comp_type,
            name=f"body_{idx}",
            volume_mm3=volume,
            surface_area_mm2=area,
            bbox_dims=bbox_dims,
            center_of_mass=center,
            recommended_process=process,
            classification_confidence=confidence,
            is_standard_part=is_standard,
            standard_part_id=std_id
        ))
        
        total_volume += volume
        total_area += area
    
    # Simple relationship detection based on proximity
    # For accurate contact detection, would need interference checks
    relationships: List[AssemblyRelationship] = []
    
    for i in range(len(components)):
        for j in range(i + 1, len(components)):
            c1 = components[i]
            c2 = components[j]
            
            # Distance between centers
            dist = math.sqrt(
                (c1.center_of_mass[0] - c2.center_of_mass[0])**2 +
                (c1.center_of_mass[1] - c2.center_of_mass[1])**2 +
                (c1.center_of_mass[2] - c2.center_of_mass[2])**2
            )
            
            # Estimate if touching based on bbox
            c1_diag = math.sqrt(sum(d**2 for d in c1.bbox_dims)) / 2
            c2_diag = math.sqrt(sum(d**2 for d in c2.bbox_dims)) / 2
            
            if dist < c1_diag + c2_diag:
                # Potentially touching
                relationships.append(AssemblyRelationship(
                    component_a_index=i,
                    component_b_index=j,
                    relationship_type='contact',
                    contact_area=100.0,  # Estimate
                    is_mating_surface=True
                ))
    
    # Detect weldment
    is_weldment, weld_count, structural_count = _detect_weldment_characteristics(
        body_count, components, relationships
    )
    
    # Count unique processes
    processes = set(c.recommended_process for c in components)
    unique_process_count = len(processes)
    
    # Count standard parts
    standard_count = sum(1 for c in components if c.is_standard_part)
    
    # Determine assembly type
    if is_weldment:
        assembly_type = AssemblyType.WELDMENT
    elif body_count <= 3 and unique_process_count == 1:
        assembly_type = AssemblyType.MULTI_BODY_PART
    elif standard_count > body_count * 0.3:
        assembly_type = AssemblyType.BOLTED_ASSEMBLY
    else:
        assembly_type = AssemblyType.MIXED_ASSEMBLY
    
    # Calculate complexity
    complexity = (
        body_count * 10 +
        unique_process_count * 15 +
        len(relationships) * 5 +
        weld_count * 10
    )
    
    # Determine if manual quote needed
    requires_manual = body_count > 10 or unique_process_count > 3
    manual_reason = ""
    if body_count > 10:
        manual_reason = f"Complex assembly with {body_count} bodies"
    elif unique_process_count > 3:
        manual_reason = f"Multiple manufacturing processes required ({unique_process_count})"
    
    return AssemblyAnalysis(
        assembly_type=assembly_type,
        body_count=body_count,
        components=components,
        relationships=relationships,
        total_volume_mm3=total_volume,
        total_surface_area_mm2=total_area,
        unique_process_count=unique_process_count,
        is_weldment=is_weldment,
        weld_joint_count=weld_count,
        structural_member_count=structural_count,
        standard_part_count=standard_count,
        fastener_count=sum(1 for c in components if c.standard_part_id and 'fastener' in (c.standard_part_id or '')),
        assembly_complexity_score=min(complexity, 100),
        requires_manual_quote=requires_manual,
        manual_quote_reason=manual_reason
    )


def get_per_body_classifications(
    assembly_analysis: AssemblyAnalysis
) -> List[Dict[str, Any]]:
    """
    Get simplified classification result for each body in the assembly.
    
    Returns list of dicts suitable for JSON export.
    """
    results = []
    
    for comp in assembly_analysis.components:
        results.append({
            "body_index": comp.body_index,
            "name": comp.name,
            "component_type": comp.component_type.value,
            "recommended_process": comp.recommended_process,
            "confidence": comp.classification_confidence,
            "volume_mm3": comp.volume_mm3,
            "is_standard_part": comp.is_standard_part,
            "standard_part_id": comp.standard_part_id,
            "bbox_dims": comp.bbox_dims
        })
    
    return results
