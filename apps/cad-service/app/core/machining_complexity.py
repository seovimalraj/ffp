"""
Machining Complexity Analysis.

Detects machining requirements including:
- Turn-mill hybrid parts (turned body + off-axis features)
- 3-axis vs 4-axis vs 5-axis milling requirements
- Setup complexity estimation
- Fixturing requirements
- Machine capability matching
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple, Set
import math


class MachineType(str, Enum):
    """Machine type classifications."""
    LATHE_2AXIS = "lathe_2axis"           # Standard turning
    LATHE_LIVE_TOOLING = "lathe_live"     # Y-axis, C-axis, live tools
    TURN_MILL = "turn_mill"               # Full turn-mill center
    MILL_3AXIS = "mill_3axis"             # Vertical/horizontal 3-axis
    MILL_4AXIS = "mill_4axis"             # 3-axis + rotary table
    MILL_5AXIS = "mill_5axis"             # Simultaneous 5-axis
    SWISS_LATHE = "swiss_lathe"           # Swiss-type for small turned parts
    MULTI_SPINDLE = "multi_spindle"       # High-volume turning
    EDM_WIRE = "edm_wire"                 # Wire EDM
    EDM_SINKER = "edm_sinker"             # Sinker EDM
    GRINDING = "grinding"                 # Surface/cylindrical grinding


class AxisRequirement(str, Enum):
    """Axis requirements for features."""
    STANDARD = "standard"           # No special axis needs
    ROTARY_INDEX = "rotary_index"   # 4th axis indexing only
    ROTARY_CONT = "rotary_cont"     # Continuous 4th axis
    TILT_INDEX = "tilt_index"       # 5th axis indexing
    SIMULTANEOUS_5 = "sim_5axis"    # Simultaneous 5-axis


class FeatureAccessDirection(str, Enum):
    """Direction from which feature is accessible."""
    TOP = "top"           # +Z
    BOTTOM = "bottom"     # -Z
    FRONT = "front"       # +Y
    BACK = "back"         # -Y
    LEFT = "left"         # -X
    RIGHT = "right"       # +X
    ANGLED = "angled"     # Non-orthogonal
    RADIAL = "radial"     # Radial (for turned parts)


@dataclass
class FeatureAccess:
    """Analysis of a feature's machining access."""
    feature_type: str
    location: Tuple[float, float, float]
    access_directions: List[FeatureAccessDirection]
    requires_axis: AxisRequirement
    tool_length_required: float = 0.0  # mm
    depth: float = 0.0  # mm
    approach_angle: float = 0.0  # degrees from vertical


@dataclass
class SetupRequirement:
    """A required machining setup/fixturing."""
    setup_number: int
    orientation: str  # "top", "side1", "side2", etc.
    features_machined: List[str]
    estimated_time_factor: float  # Multiplier for this setup
    requires_special_fixture: bool = False
    fixture_description: str = ""


@dataclass
class TurningAnalysis:
    """Analysis of turning-related features."""
    is_rotationally_symmetric: bool = False
    symmetry_axis: Optional[str] = None  # 'X', 'Y', 'Z'
    max_od: float = 0.0  # mm
    min_id: float = 0.0  # mm (if bore exists)
    length_to_diameter_ratio: float = 0.0
    has_cross_holes: bool = False
    cross_hole_count: int = 0
    has_flats: bool = False
    flat_count: int = 0
    has_threads: bool = False
    has_keyway: bool = False
    has_spline: bool = False
    requires_tailstock: bool = False
    requires_steady_rest: bool = False
    recommended_machine: MachineType = MachineType.LATHE_2AXIS


@dataclass
class MillingComplexity:
    """Analysis of milling complexity."""
    min_axes_required: int = 3
    recommended_axes: int = 3
    has_deep_pockets: bool = False
    has_undercuts: bool = False
    has_compound_angles: bool = False
    has_continuous_5axis_surfaces: bool = False
    max_tool_length_required: float = 0.0
    access_direction_count: int = 1
    requires_tombstone: bool = False
    recommended_machine: MachineType = MachineType.MILL_3AXIS


@dataclass
class MachiningComplexityAnalysis:
    """Complete machining complexity analysis."""
    turning_analysis: Optional[TurningAnalysis] = None
    milling_complexity: Optional[MillingComplexity] = None
    feature_access: List[FeatureAccess] = field(default_factory=list)
    setups: List[SetupRequirement] = field(default_factory=list)
    
    # Summary
    primary_process: str = "milling"  # 'turning', 'milling', 'turn_mill'
    secondary_process: Optional[str] = None
    recommended_machine: MachineType = MachineType.MILL_3AXIS
    estimated_setup_count: int = 1
    complexity_score: float = 0.0  # 0-100
    
    # Specific flags
    is_turn_mill: bool = False
    requires_5axis: bool = False
    requires_4axis: bool = False
    requires_edm: bool = False


def _analyze_rotational_symmetry(
    shape,
    cylindrical_face_count: int,
    planar_face_count: int
) -> Tuple[bool, Optional[str], float]:
    """
    Analyze if part has rotational symmetry suitable for turning.
    
    Returns: (is_symmetric, axis, max_diameter)
    """
    try:
        from OCC.Core.BRepGProp import brepgprop
        from OCC.Core.GProp import GProp_GProps
    except ImportError:
        return False, None, 0.0
    
    props = GProp_GProps()
    brepgprop.VolumeProperties(shape, props)
    
    # Get principal axes of inertia
    # Parts with high rotational symmetry have two equal principal moments
    
    # Simplified: check if cylindrical faces dominate
    total_faces = cylindrical_face_count + planar_face_count
    if total_faces == 0:
        return False, None, 0.0
    
    cyl_ratio = cylindrical_face_count / total_faces
    
    # High cylindrical face ratio suggests turned part
    if cyl_ratio > 0.4:
        return True, 'Z', 0.0
    
    return False, None, 0.0


def _detect_cross_features(
    holes: List,
    part_axis: str
) -> Tuple[int, int]:
    """
    Detect holes/features perpendicular to main part axis (cross-drilled).
    
    Returns: (cross_hole_count, flat_count)
    """
    cross_hole_count = 0
    
    if not holes:
        return 0, 0
    
    axis_map = {'X': 0, 'Y': 1, 'Z': 2}
    part_axis_idx = axis_map.get(part_axis.upper(), 2)
    
    for hole in holes:
        # Get hole axis direction
        axis = getattr(hole, 'axis', None) or getattr(hole, 'direction', None)
        if axis is None:
            continue
        
        if hasattr(axis, '__iter__'):
            axis = list(axis)
            if len(axis) >= 3:
                # Check if hole axis is perpendicular to part axis
                axis_val = abs(axis[part_axis_idx])
                if axis_val < 0.3:  # Not aligned with part axis
                    cross_hole_count += 1
    
    return cross_hole_count, 0


def _analyze_feature_access_directions(
    holes: List,
    pockets: List,
    undercuts: List
) -> Tuple[List[FeatureAccess], int, bool, bool]:
    """
    Analyze which directions features need to be accessed from.
    
    Returns: (feature_access_list, direction_count, needs_4axis, needs_5axis)
    """
    feature_access: List[FeatureAccess] = []
    directions_needed: Set[FeatureAccessDirection] = set()
    needs_5axis = False
    
    # Analyze hole access
    for hole in holes:
        axis = getattr(hole, 'axis', None) or getattr(hole, 'direction', (0, 0, 1))
        depth = getattr(hole, 'depth', 10.0) or getattr(hole, 'depth_mm', 10.0) or 10.0
        
        if hasattr(axis, '__iter__'):
            axis = list(axis)
            if len(axis) >= 3:
                # Determine access direction from axis
                abs_axis = [abs(a) for a in axis]
                max_idx = abs_axis.index(max(abs_axis))
                
                if max_idx == 2:  # Z-aligned
                    direction = FeatureAccessDirection.TOP if axis[2] > 0 else FeatureAccessDirection.BOTTOM
                    requires = AxisRequirement.STANDARD
                elif max_idx == 0:  # X-aligned
                    direction = FeatureAccessDirection.RIGHT if axis[0] > 0 else FeatureAccessDirection.LEFT
                    requires = AxisRequirement.ROTARY_INDEX
                elif max_idx == 1:  # Y-aligned
                    direction = FeatureAccessDirection.FRONT if axis[1] > 0 else FeatureAccessDirection.BACK
                    requires = AxisRequirement.ROTARY_INDEX
                else:
                    direction = FeatureAccessDirection.ANGLED
                    requires = AxisRequirement.TILT_INDEX
                    needs_5axis = True
                
                # Check if truly angled (not axis-aligned)
                if max(abs_axis) < 0.95:
                    direction = FeatureAccessDirection.ANGLED
                    requires = AxisRequirement.SIMULTANEOUS_5
                    needs_5axis = True
                
                directions_needed.add(direction)
                
                center = getattr(hole, 'center', (0, 0, 0))
                feature_access.append(FeatureAccess(
                    feature_type='hole',
                    location=tuple(center) if hasattr(center, '__iter__') else (0, 0, 0),
                    access_directions=[direction],
                    requires_axis=requires,
                    tool_length_required=depth * 1.5,
                    depth=depth
                ))
    
    # Analyze pocket access
    for pocket in pockets:
        depth = getattr(pocket, 'depth', 10.0) or getattr(pocket, 'depth_mm', 10.0) or 10.0
        
        # Assume pockets are top-access by default
        direction = FeatureAccessDirection.TOP
        requires = AxisRequirement.STANDARD
        
        directions_needed.add(direction)
        
        center = getattr(pocket, 'center', (0, 0, 0))
        feature_access.append(FeatureAccess(
            feature_type='pocket',
            location=tuple(center) if hasattr(center, '__iter__') else (0, 0, 0),
            access_directions=[direction],
            requires_axis=requires,
            tool_length_required=depth * 1.5,
            depth=depth
        ))
    
    # Undercuts may require 5-axis or EDM
    for undercut in undercuts:
        direction = FeatureAccessDirection.ANGLED
        requires = AxisRequirement.SIMULTANEOUS_5
        needs_5axis = True
        
        directions_needed.add(direction)
        
        location = getattr(undercut, 'location', (0, 0, 0))
        feature_access.append(FeatureAccess(
            feature_type='undercut',
            location=tuple(location) if hasattr(location, '__iter__') else (0, 0, 0),
            access_directions=[direction],
            requires_axis=requires
        ))
    
    direction_count = len(directions_needed)
    needs_4axis = direction_count > 2 and not needs_5axis
    
    return feature_access, direction_count, needs_4axis, needs_5axis


def _estimate_setups(
    direction_count: int,
    has_cross_holes: bool,
    is_turned: bool
) -> List[SetupRequirement]:
    """Estimate required machining setups."""
    setups = []
    
    if is_turned:
        # Turning setup
        setups.append(SetupRequirement(
            setup_number=1,
            orientation="chuck",
            features_machined=["OD turning", "facing", "boring"],
            estimated_time_factor=1.0
        ))
        
        if has_cross_holes:
            setups.append(SetupRequirement(
                setup_number=2,
                orientation="cross_drill",
                features_machined=["cross holes"],
                estimated_time_factor=0.5,
                requires_special_fixture=True,
                fixture_description="V-block or live tooling"
            ))
        
        return setups
    
    # Milling setups based on access directions
    if direction_count <= 1:
        setups.append(SetupRequirement(
            setup_number=1,
            orientation="top",
            features_machined=["top features"],
            estimated_time_factor=1.0
        ))
    elif direction_count == 2:
        setups.append(SetupRequirement(
            setup_number=1,
            orientation="top",
            features_machined=["top features"],
            estimated_time_factor=1.0
        ))
        setups.append(SetupRequirement(
            setup_number=2,
            orientation="flip",
            features_machined=["bottom features"],
            estimated_time_factor=0.8
        ))
    else:
        # Multi-side machining
        for i in range(min(direction_count, 6)):
            setups.append(SetupRequirement(
                setup_number=i + 1,
                orientation=f"side_{i+1}",
                features_machined=[f"side {i+1} features"],
                estimated_time_factor=0.6 if i > 0 else 1.0,
                requires_special_fixture=i > 1
            ))
    
    return setups


def analyze_machining_complexity(
    shape,
    holes: Optional[List] = None,
    pockets: Optional[List] = None,
    undercuts: Optional[List] = None,
    threads: Optional[List] = None,
    slots: Optional[List] = None,
    bends: Optional[List] = None,
    face_classification: Optional[object] = None
) -> MachiningComplexityAnalysis:
    """
    Analyze machining complexity to determine process requirements.
    
    Detects:
    - Turn-mill hybrid requirements
    - 5-axis vs 4-axis vs 3-axis needs
    - Setup count estimation
    - Recommended machine type
    """
    holes = holes or []
    pockets = pockets or []
    undercuts = undercuts or []
    threads = threads or []
    
    # Get face counts from classification if available
    cylindrical_count = 0
    planar_count = 0
    
    if face_classification:
        cylindrical_count = getattr(face_classification, 'cylindrical_face_count', 0)
        planar_count = getattr(face_classification, 'planar_face_count', 0)
    
    # Analyze rotational symmetry
    is_symmetric, sym_axis, max_diam = _analyze_rotational_symmetry(
        shape, cylindrical_count, planar_count
    )
    
    # Detect cross-features
    cross_hole_count, flat_count = _detect_cross_features(
        holes, sym_axis or 'Z'
    )
    
    # Analyze feature access directions
    feature_access, direction_count, needs_4axis, needs_5axis = _analyze_feature_access_directions(
        holes, pockets, undercuts
    )
    
    # Create turning analysis if rotationally symmetric
    turning_analysis = None
    if is_symmetric and cylindrical_count > 3:
        # Looks like a turned part
        has_cross = cross_hole_count > 0
        has_flats = flat_count > 0
        
        # Determine turning machine type
        if has_cross or has_flats:
            turn_machine = MachineType.LATHE_LIVE_TOOLING
            if cross_hole_count > 2 or has_flats:
                turn_machine = MachineType.TURN_MILL
        else:
            turn_machine = MachineType.LATHE_2AXIS
        
        turning_analysis = TurningAnalysis(
            is_rotationally_symmetric=True,
            symmetry_axis=sym_axis,
            has_cross_holes=has_cross,
            cross_hole_count=cross_hole_count,
            has_flats=has_flats,
            flat_count=flat_count,
            has_threads=len(threads) > 0,
            recommended_machine=turn_machine
        )
    
    # Create milling complexity analysis
    max_tool_length = 0.0
    for fa in feature_access:
        max_tool_length = max(max_tool_length, fa.tool_length_required)
    
    # Determine milling machine requirements
    if needs_5axis:
        mill_machine = MachineType.MILL_5AXIS
        min_axes = 5
    elif needs_4axis or direction_count > 2:
        mill_machine = MachineType.MILL_4AXIS
        min_axes = 4
    else:
        mill_machine = MachineType.MILL_3AXIS
        min_axes = 3
    
    milling_complexity = MillingComplexity(
        min_axes_required=min_axes,
        recommended_axes=min_axes,
        has_deep_pockets=any(p.depth > 50 for p in feature_access if p.feature_type == 'pocket'),
        has_undercuts=len(undercuts) > 0,
        has_compound_angles=needs_5axis,
        max_tool_length_required=max_tool_length,
        access_direction_count=direction_count,
        recommended_machine=mill_machine
    )
    
    # Estimate setups
    is_turn_mill = turning_analysis is not None and (cross_hole_count > 0 or flat_count > 0)
    setups = _estimate_setups(
        direction_count,
        cross_hole_count > 0,
        turning_analysis is not None
    )
    
    # Determine primary process
    if turning_analysis and not is_turn_mill:
        primary_process = "turning"
        recommended = turning_analysis.recommended_machine
        secondary = None
    elif is_turn_mill:
        primary_process = "turn_mill"
        recommended = MachineType.TURN_MILL
        secondary = None
    else:
        primary_process = "milling"
        recommended = milling_complexity.recommended_machine
        secondary = None
    
    # Calculate complexity score
    complexity = (
        direction_count * 10 +
        cross_hole_count * 15 +
        len(undercuts) * 20 +
        (30 if needs_5axis else 0) +
        (15 if needs_4axis else 0) +
        (20 if is_turn_mill else 0) +
        len(setups) * 5
    )
    
    return MachiningComplexityAnalysis(
        turning_analysis=turning_analysis,
        milling_complexity=milling_complexity,
        feature_access=feature_access,
        setups=setups,
        primary_process=primary_process,
        secondary_process=secondary,
        recommended_machine=recommended,
        estimated_setup_count=len(setups),
        complexity_score=min(complexity, 100),
        is_turn_mill=is_turn_mill,
        requires_5axis=needs_5axis,
        requires_4axis=needs_4axis,
        requires_edm=False
    )


def analyze_machining_complexity_from_mesh(
    mesh,
    holes: Optional[List] = None,
    pockets: Optional[List] = None,
    undercuts: Optional[List] = None
) -> MachiningComplexityAnalysis:
    """
    Analyze machining complexity from mesh geometry.
    
    Limited compared to BREP analysis.
    """
    try:
        import numpy as np
    except ImportError:
        return MachiningComplexityAnalysis()
    
    holes = holes or []
    pockets = pockets or []
    undercuts = undercuts or []
    
    # Analyze feature access
    feature_access, direction_count, needs_4axis, needs_5axis = _analyze_feature_access_directions(
        holes, pockets, undercuts
    )
    
    # Simplified axis analysis from mesh
    vertices = mesh.vectors
    v0 = vertices[:, 0, :]
    v1 = vertices[:, 1, :]
    v2 = vertices[:, 2, :]
    
    e1 = v1 - v0
    e2 = v2 - v0
    normals = np.cross(e1, e2)
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms = np.where(norms < 1e-9, 1.0, norms)
    normals = normals / norms
    
    # Count perpendicular to Z (horizontal normals)
    horiz_count = np.sum(np.abs(normals[:, 2]) < 0.3)
    total = len(normals)
    horiz_ratio = horiz_count / total if total > 0 else 0
    
    # High horizontal normal ratio suggests turned part
    is_turned = horiz_ratio > 0.5
    
    # Determine machine type
    if needs_5axis:
        recommended = MachineType.MILL_5AXIS
        min_axes = 5
    elif needs_4axis:
        recommended = MachineType.MILL_4AXIS
        min_axes = 4
    elif is_turned:
        recommended = MachineType.LATHE_2AXIS
        min_axes = 2
    else:
        recommended = MachineType.MILL_3AXIS
        min_axes = 3
    
    milling_complexity = MillingComplexity(
        min_axes_required=min_axes,
        recommended_axes=min_axes,
        has_undercuts=len(undercuts) > 0,
        access_direction_count=direction_count,
        recommended_machine=recommended
    )
    
    setups = _estimate_setups(direction_count, False, is_turned)
    
    complexity = (
        direction_count * 10 +
        len(undercuts) * 20 +
        (30 if needs_5axis else 0)
    )
    
    return MachiningComplexityAnalysis(
        milling_complexity=milling_complexity,
        feature_access=feature_access,
        setups=setups,
        primary_process="turning" if is_turned else "milling",
        recommended_machine=recommended,
        estimated_setup_count=len(setups),
        complexity_score=min(complexity, 100),
        requires_5axis=needs_5axis,
        requires_4axis=needs_4axis
    )
