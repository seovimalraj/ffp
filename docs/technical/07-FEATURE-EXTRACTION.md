# Feature Extraction Technical Reference

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Technical Reference

---

## 1. Overview

Feature extraction identifies manufacturable characteristics from CAD geometry—holes, pockets, bends, threads, and more. These features drive both classification and pricing.

---

## 2. Feature Types

### 2.1 Feature Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FEATURE HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    GEOMETRIC FEATURES                       │    │
│  ├──────────────┬──────────────┬──────────────┬──────────────┤    │
│  │    HOLES     │   POCKETS    │    BENDS     │   SURFACES   │    │
│  │  - through   │  - blind     │  - 90°       │  - planar    │    │
│  │  - blind     │  - through   │  - acute     │  - cylindrical│   │
│  │  - counter-  │  - stepped   │  - obtuse    │  - conical   │    │
│  │    sink/bore │              │  - hem       │  - freeform  │    │
│  └──────────────┴──────────────┴──────────────┴──────────────┘    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                  SECONDARY FEATURES                         │    │
│  ├──────────────┬──────────────┬──────────────┬──────────────┤    │
│  │   THREADS    │   FILLETS    │    SLOTS     │  UNDERCUTS   │    │
│  │  - metric    │  - internal  │  - through   │  - internal  │    │
│  │  - imperial  │  - external  │  - blind     │  - dovetail  │    │
│  │  - internal  │  - bend rel. │  - T-slot    │  - blocking  │    │
│  │  - external  │  - tool rad. │              │              │    │
│  └──────────────┴──────────────┴──────────────┴──────────────┘    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                   FORMED FEATURES                           │    │
│  ├──────────────┬──────────────┬──────────────┬──────────────┤    │
│  │    BOSSES    │     RIBS     │   CHAMFERS   │   HARDWARE   │    │
│  │  - raised    │  - thin wall │  - edge      │  - PEM nuts  │    │
│  │  - mounting  │  - support   │  - corner    │  - inserts   │    │
│  │              │              │              │  - standoffs │    │
│  └──────────────┴──────────────┴──────────────┴──────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Hole Feature Extraction

### 3.1 Hole Data Model

```python
@dataclass
class HoleFeature:
    id: str
    type: str          # 'through', 'blind', 'countersink', 'counterbore'
    diameter_mm: float
    depth_mm: float
    axis: Tuple[float, float, float]  # Direction vector
    position: Tuple[float, float, float]  # Center point
    is_threaded: bool = False
    thread_pitch: Optional[float] = None
```

### 3.2 Hole Detection Methods

**From STEP (B-Rep):**
```python
def extract_holes_from_shape(shape):
    """
    Detect holes by finding cylindrical faces with 360° sweep.
    """
    holes = []
    for face in iterate_faces(shape):
        surface = BRepAdaptor_Surface(face)
        if surface.GetType() == GeomAbs_Cylinder:
            # Check if full revolution (not partial cylinder)
            u_min, u_max, _, _ = breptools_UVBounds(face)
            if abs(u_max - u_min - 2*pi) < 0.01:
                # This is a complete cylindrical surface = hole
                radius = surface.Cylinder().Radius()
                depth = compute_cylinder_height(face)
                axis = get_cylinder_axis(face)
                
                # Determine through vs blind
                is_through = check_through_hole(shape, face)
                
                holes.append(HoleFeature(
                    id=f"hole_{len(holes)+1}",
                    type='through' if is_through else 'blind',
                    diameter_mm=radius * 2,
                    depth_mm=depth,
                    axis=axis
                ))
    return holes
```

**From STL (Mesh):**
```python
def extract_holes_from_mesh(mesh):
    """
    Detect holes by finding circular edge loops in mesh.
    Uses curvature analysis and boundary edge detection.
    """
    # Find boundary edges (edges with only one adjacent face)
    boundary_edges = mesh.edges_unique[mesh.edges_unique_length == 1]
    
    # Group into loops
    loops = find_edge_loops(boundary_edges, mesh)
    
    holes = []
    for loop in loops:
        # Fit circle to loop vertices
        center, radius, axis, error = fit_circle_3d(mesh.vertices[loop])
        
        if error < tolerance:
            # Good circle fit - this is a hole
            holes.append(HoleFeature(
                diameter_mm=radius * 2,
                depth_mm=estimate_depth(mesh, center, axis),
                axis=axis.tolist()
            ))
    
    return holes
```

### 3.3 Hole Classification Logic

| Hole Type | Characteristics |
|-----------|-----------------|
| **Through** | Opens on both sides of part |
| **Blind** | Closed bottom (conical or flat) |
| **Countersink** | Conical chamfer at top (45° or 82°/90°) |
| **Counterbore** | Stepped larger diameter at top |
| **Tapped** | Internal threads (detected separately) |

### 3.4 Depth/Diameter Analysis

```python
def classify_hole_machining(hole: HoleFeature) -> str:
    """
    Classify hole by machining method based on depth ratio.
    """
    ratio = hole.depth_mm / hole.diameter_mm
    
    if ratio <= 3:
        return 'standard_drill'  # Normal drilling
    elif ratio <= 5:
        return 'deep_drill'      # Peck drilling
    elif ratio <= 10:
        return 'gun_drill'       # Gun drilling
    else:
        return 'edm'             # Wire EDM or specialized
```

---

## 4. Pocket Feature Extraction

### 4.1 Pocket Data Model

```python
@dataclass
class PocketFeature:
    id: str
    depth_mm: float
    mouth_area_mm2: float    # Opening area
    bottom_area_mm2: float   # Floor area
    aspect_ratio: float      # depth / sqrt(area)
    corner_radii: List[float]
    is_through: bool
    has_islands: bool
```

### 4.2 Pocket Detection

**From STEP:**
```python
def extract_pockets_from_shape(shape):
    """
    Detect pockets by finding concave face groups.
    """
    pockets = []
    
    # Find planar faces that face "inward" (concave regions)
    planar_faces = [f for f in faces if is_planar(f)]
    
    for face in planar_faces:
        # Check if face has surrounding walls (pocket signature)
        adjacent = get_adjacent_faces(face)
        walls = [f for f in adjacent if is_perpendicular(f, face)]
        
        if len(walls) >= 3:  # Min 3 walls for a pocket
            depth = compute_pocket_depth(face, walls)
            mouth_area = compute_mouth_area(walls, shape)
            
            pockets.append(PocketFeature(
                id=f"pocket_{len(pockets)+1}",
                depth_mm=depth,
                mouth_area_mm2=mouth_area,
                bottom_area_mm2=face_area(face),
                aspect_ratio=depth / math.sqrt(mouth_area),
                corner_radii=extract_corner_radii(walls)
            ))
    
    return pockets
```

---

## 5. Bend Feature Extraction

### 5.1 Bend Data Model

```python
@dataclass
class BendFeature:
    id: str
    angle_deg: float       # Bend angle (90° = right angle)
    radius_mm: float       # Inside radius
    length_mm: float       # Bend line length
    direction: str         # 'up' or 'down'
    k_factor: float        # Neutral axis position
    position: Tuple[float, float, float]
```

### 5.2 Bend Detection from STEP

```python
def extract_bend_angles_from_shape(shape):
    """
    Extract bends by finding cylindrical faces with adjacent planar faces.
    """
    bends = []
    
    cylindrical_faces = [f for f in faces if is_cylinder(f)]
    
    for cyl_face in cylindrical_faces:
        radius = get_cylinder_radius(cyl_face)
        
        # Valid bend radius range: 2-30mm
        if not (2.0 <= radius <= 30.0):
            continue
        
        # Find adjacent planar faces
        adjacent = get_adjacent_faces(cyl_face)
        planes = [f for f in adjacent if is_planar(f)]
        
        if len(planes) >= 2:
            # Compute dihedral angle between the two planes
            angle = compute_dihedral_angle(planes[0], planes[1])
            bend_angle = 180 - angle  # Inside angle
            
            if 30 <= bend_angle <= 170:  # Valid bend range
                bends.append(BendFeature(
                    angle_deg=bend_angle,
                    radius_mm=radius,
                    length_mm=get_cylinder_length(cyl_face),
                    k_factor=estimate_k_factor(radius, thickness)
                ))
    
    return bends
```

### 5.3 Bend Detection from Mesh

```python
def detect_bends_from_mesh(mesh):
    """
    Detect bends by clustering face normals.
    """
    # Cluster normals (faces with similar direction)
    clusters = cluster_face_normals(mesh.face_normals, threshold=15.0)
    
    # Find transitions between clusters (bend regions)
    bends = []
    for i, c1 in enumerate(clusters):
        for c2 in clusters[i+1:]:
            if clusters_adjacent(c1, c2, mesh):
                angle = angle_between(c1.normal, c2.normal)
                if 30 < angle < 170:
                    bends.append(BendFeature(
                        angle_deg=angle,
                        radius_mm=estimate_bend_radius(mesh, c1, c2),
                        confidence=0.7  # Lower confidence for mesh-based
                    ))
    
    return bends
```

---

## 6. Thread Feature Extraction

### 6.1 Thread Data Model

```python
@dataclass
class ThreadFeature:
    id: str
    diameter_mm: float     # Major diameter
    pitch_mm: float        # Thread pitch
    depth_mm: float        # Thread depth
    thread_type: str       # 'internal', 'external'
    standard: str          # 'metric', 'imperial', 'custom'
    is_standard: bool      # Matches standard size
    standard_name: str     # e.g., "M6x1.0", "1/4-20 UNC"
```

### 6.2 Thread Detection

**From STEP:**
```python
def extract_threads_from_shape(shape):
    """
    Detect threads by finding helical or multi-turn surfaces.
    """
    threads = []
    
    for face in iterate_faces(shape):
        surface = BRepAdaptor_Surface(face)
        
        # Check for helix/revolution surfaces
        if surface.GetType() in [GeomAbs_SurfaceOfRevolution, GeomAbs_BSplineSurface]:
            # Analyze for helical pattern
            if is_helical_surface(face):
                diameter = get_helix_diameter(face)
                pitch = detect_thread_pitch(face)
                
                threads.append(ThreadFeature(
                    diameter_mm=diameter,
                    pitch_mm=pitch,
                    thread_type='internal' if is_internal(face) else 'external',
                    standard=match_thread_standard(diameter, pitch)
                ))
    
    return threads
```

### 6.3 Standard Thread Matching

```python
STANDARD_THREADS = {
    # Metric (diameter_mm, pitch_mm, name)
    (3.0, 0.5): "M3",
    (4.0, 0.7): "M4",
    (5.0, 0.8): "M5",
    (6.0, 1.0): "M6",
    (8.0, 1.25): "M8",
    (10.0, 1.5): "M10",
    (12.0, 1.75): "M12",
    # Imperial
    (3.175, 1.27): "4-40 UNC",
    (4.166, 1.058): "8-32 UNC",
    (6.35, 1.27): "1/4-20 UNC",
    (7.938, 1.058): "5/16-18 UNC",
    # ... more standards
}

def match_thread_standard(diameter: float, pitch: float) -> str:
    tolerance = 0.1  # mm
    for (d, p), name in STANDARD_THREADS.items():
        if abs(diameter - d) < tolerance and abs(pitch - p) < tolerance:
            return name
    return "Custom"
```

---

## 7. Additional Features

### 7.1 Fillet/Chamfer Detection

```python
@dataclass
class FilletFeature:
    id: str
    feature_type: str      # 'fillet', 'chamfer'
    radius_mm: float       # For fillets
    angle_deg: float       # For chamfers (typically 45°)
    length_mm: float       # Edge length
    location: str          # 'internal', 'external'
```

**Classification:**
| Radius | Classification | Implication |
|--------|----------------|-------------|
| < 1mm | Edge break | Deburring |
| 1-2mm | Bend relief (sheet metal) | Forming requirement |
| 3-6mm | Tool radius (CNC) | End mill limitation |
| > 6mm | Design feature | Intentional radius |

### 7.2 Slot Detection

```python
@dataclass
class SlotFeature:
    id: str
    length_mm: float
    width_mm: float
    depth_mm: float
    slot_type: str         # 'through', 'blind', 't_slot'
    end_type: str          # 'round', 'square'
```

### 7.3 Undercut Detection

```python
@dataclass
class UndercutFeature:
    id: str
    undercut_type: str     # 'internal', 'external', 'dovetail'
    severity: str          # 'minor', 'major', 'blocking'
    depth_mm: float
    width_mm: float
    requires_special_tooling: bool
    access_directions: List[Tuple[float, float, float]]
```

### 7.4 Boss/Rib Detection

```python
@dataclass
class BossFeature:
    id: str
    diameter_mm: float
    height_mm: float
    has_hole: bool
    hole_diameter: Optional[float]

@dataclass
class RibFeature:
    id: str
    thickness_mm: float
    height_mm: float
    length_mm: float
    draft_angle_deg: float
```

---

## 8. Feature Analysis Signals

### 8.1 Signal Computation

```python
def compute_feature_signals(
    holes, pockets, fillets, bends, slots, threads, ...
) -> FeatureClassificationSignals:
    """
    Compute aggregate signals from features for classification.
    """
    signals = FeatureClassificationSignals()
    
    # Hole analysis
    if holes:
        signals.hole_depth_ratio = np.mean([h.depth/h.diameter for h in holes])
        signals.punched_hole_score = sum(1 for h in holes if is_punched(h))
        signals.drilled_hole_score = sum(1 for h in holes if is_drilled(h))
    
    # Fillet analysis
    if fillets:
        signals.tool_radius_count = sum(1 for f in fillets if 3 <= f.radius <= 6)
        signals.bend_relief_count = sum(1 for f in fillets if f.radius < 2)
    
    # Thickness uniformity
    signals.thickness_uniformity = analyze_thickness_uniformity(paired_planes)
    
    # Overall CNC score
    signals.feature_cnc_score = compute_cnc_likelihood(signals)
    
    return signals
```

### 8.2 CNC vs Sheet Metal Signals

| Signal | Sheet Metal Indicator | CNC Indicator |
|--------|----------------------|---------------|
| Hole depth ratio | < 2 (punched) | > 3 (drilled) |
| Fillet radius | < 2mm (bend relief) | 3-6mm (tool radius) |
| Pocket depth | Shallow (formed) | Deep (machined) |
| Thickness uniformity | High (uniform wall) | Low (variable) |
| Thread count | Low (hardware inserts) | High (machined) |

---

## 9. Performance Optimization

### 9.1 Extraction Pipeline

```python
def extract_all_features(shape):
    """
    Parallel feature extraction for performance.
    """
    with ThreadPoolExecutor() as executor:
        futures = {
            'holes': executor.submit(extract_holes, shape),
            'pockets': executor.submit(extract_pockets, shape),
            'threads': executor.submit(extract_threads, shape),
            'fillets': executor.submit(extract_fillets, shape),
            'bends': executor.submit(extract_bends, shape),
        }
        
        results = {k: f.result() for k, f in futures.items()}
    
    return results
```

### 9.2 Caching Strategy

- **Hash CAD file** → Cache extracted features
- **TTL**: 24 hours for frequently accessed parts
- **Invalidation**: On file modification

---

## 10. API Contract

### 10.1 Feature Extraction Response

```json
{
  "features": {
    "holes": [
      {
        "id": "hole_1",
        "type": "through",
        "diameter_mm": 6.0,
        "depth_mm": 10.0,
        "axis": [0, 0, 1]
      }
    ],
    "pockets": [
      {
        "id": "pocket_1",
        "depth_mm": 15.0,
        "mouth_area_mm2": 400.0,
        "aspect_ratio": 0.75
      }
    ],
    "bends": [
      {
        "id": "bend_1",
        "angle_deg": 90.0,
        "radius_mm": 2.0,
        "length_mm": 50.0
      }
    ],
    "threads": [
      {
        "id": "thread_1",
        "diameter_mm": 6.0,
        "pitch_mm": 1.0,
        "standard_name": "M6"
      }
    ]
  },
  "feature_counts": {
    "hole_count": 8,
    "pocket_count": 2,
    "thread_count": 4,
    "bend_count": 3,
    "fillet_count": 12,
    "slot_count": 1,
    "undercut_count": 0
  },
  "feature_signals": {
    "feature_cnc_score": 35,
    "feature_sheet_metal_score": 72,
    "reasoning": "Bends + thin uniform wall indicates sheet metal"
  }
}
```

---

*Document maintained by FFP Tech Team*
