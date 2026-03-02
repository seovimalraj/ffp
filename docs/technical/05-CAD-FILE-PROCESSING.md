# CAD File Type Processing

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Technical Reference

---

## 1. Overview

The FFP (Frigate Fast Parts) CAD Analysis System supports multiple file formats, each with different capabilities and extraction methods. This document details how each format is processed and what data is extracted.

### 1.1 Supported Formats

| Format | Extensions | Type | Engine | Complexity |
|--------|------------|------|--------|------------|
| **STEP** | .step, .stp | B-Rep | OpenCASCADE | Full analysis |
| **IGES** | .iges, .igs | B-Rep | OpenCASCADE | Full analysis |
| **STL** | .stl | Mesh | Trimesh | Geometric analysis |
| **DXF** | .dxf | 2D Vector | ezdxf | Flat pattern only |

### 1.2 Feature Extraction Capabilities

| Feature | STEP/IGES | STL | DXF |
|---------|-----------|-----|-----|
| **Volume** | ✅ Exact | ✅ Estimated | ❌ N/A |
| **Surface Area** | ✅ Exact | ✅ Exact | ✅ From perimeter |
| **Bounding Box** | ✅ Exact | ✅ Exact | ✅ 2D only |
| **Holes** | ✅ Extracted | ✅ Detected | ✅ Detected |
| **Pockets** | ✅ Extracted | ⚠️ Limited | ❌ N/A |
| **Threads** | ✅ Detected | ⚠️ Heuristic | ❌ N/A |
| **Bends** | ✅ Exact angles | ⚠️ Estimated | ❌ N/A |
| **Undercuts** | ✅ Detected | ⚠️ Limited | ❌ N/A |
| **Face Types** | ✅ Classified | ❌ N/A | ❌ N/A |
| **Tolerances** | ⚠️ If PMI exists | ❌ N/A | ⚠️ Implied |
| **Material** | ⚠️ If metadata | ❌ N/A | ❌ N/A |

---

## 2. STEP File Processing

### 2.1 Overview

STEP (Standard for the Exchange of Product Data, ISO 10303) is the preferred format for analysis, providing exact B-Rep (Boundary Representation) geometry.

### 2.2 Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP PROCESSING PIPELINE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐                                                   │
│  │ STEP File   │                                                   │
│  │ (.step/.stp)│                                                   │
│  └──────┬──────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    OpenCASCADE Parser                        │   │
│  │  - STEPControl_Reader.ReadFile()                            │   │
│  │  - Build TopoDS_Shape                                       │   │
│  │  - Unit detection (mm, inch, m)                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Assembly Detection                        │   │
│  │  - Count solids (>1 = assembly)                             │   │
│  │  - Count shells (multi-shell = assembly)                    │   │
│  │  - Flag for manual quote if assembly                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────┬─────────────────┬────────────────────┐   │
│  │   Mass Properties   │  Face Analysis  │  Feature Extract   │   │
│  │  - Volume (mm³)     │  - Face types   │  - Holes           │   │
│  │  - Surface area     │  - Plane pairs  │  - Pockets         │   │
│  │  - Center of mass   │  - Cylinders    │  - Threads         │   │
│  │  - Bounding box     │  - Curvature    │  - Bends           │   │
│  └─────────────────────┴─────────────────┴────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Classification                            │   │
│  │  - 11-tier cascade                                          │   │
│  │  - Process determination                                    │   │
│  │  - Confidence scoring                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Mass Properties Extraction

```python
from OCC.Core.GProp import GProp_GProps
from OCC.Core.BRepGProp import brepgprop_VolumeProperties, brepgprop_SurfaceProperties

def shape_mass_props(shape):
    """Extract volume and surface area from OCC shape."""
    vol_props = GProp_GProps()
    brepgprop_VolumeProperties(shape, vol_props)
    volume = vol_props.Mass()  # mm³
    
    surf_props = GProp_GProps()
    brepgprop_SurfaceProperties(shape, surf_props)
    surface_area = surf_props.Mass()  # mm²
    
    return volume, surface_area
```

### 2.4 Face Type Classification

Each face in the B-Rep is classified using `BRepAdaptor_Surface.GetType()`:

| OCC Type Code | Face Type | Manufacturing Implication |
|---------------|-----------|---------------------------|
| `GeomAbs_Plane` | Planar | Milled faces, sheet metal |
| `GeomAbs_Cylinder` | Cylindrical | Holes, shafts, turned features |
| `GeomAbs_Cone` | Conical | Chamfers, tapers |
| `GeomAbs_Sphere` | Spherical | Ball features (rare) |
| `GeomAbs_Torus` | Toroidal | Grooves, O-ring seats |
| `GeomAbs_BezierSurface` | Bezier | Complex curves |
| `GeomAbs_BSplineSurface` | B-Spline | Free-form surfaces |
| `GeomAbs_SurfaceOfRevolution` | Revolution | Turned profiles |
| `GeomAbs_SurfaceOfExtrusion` | Extrusion | Swept features |
| `GeomAbs_OffsetSurface` | Offset | Shelled features |

### 2.5 Feature Extraction

**Holes:**
```python
# Detect holes by finding cylindrical faces with 360° sweep
for face in get_faces(shape):
    if face_type(face) == GeomAbs_Cylinder:
        # Check if full cylinder (hole) vs partial cylinder
        u_range = get_u_range(face)  # Angular range
        if u_range >= 2 * pi - tolerance:
            # This is a hole
            diameter = get_cylinder_radius(face) * 2
            depth = get_face_length(face)
            holes.append(HoleFeature(diameter, depth))
```

**Bends (Sheet Metal):**
```python
# Detect bends by finding cylindrical faces with adjacent planes
for face in cylindrical_faces:
    adjacent = get_adjacent_faces(face)
    plane_neighbors = [f for f in adjacent if is_plane(f)]
    if len(plane_neighbors) >= 2:
        angle = compute_dihedral_angle(plane_neighbors[0], plane_neighbors[1])
        radius = get_cylinder_radius(face)
        bends.append(BendFeature(angle=180 - angle, radius=radius))
```

### 2.6 Paired Plane Detection (Sheet Metal)

```python
def find_paired_planes(planar_faces, max_distance=6.0):
    """
    Find pairs of parallel planes at uniform distance.
    This indicates sheet metal wall thickness.
    """
    pairs = []
    for i, face1 in enumerate(planar_faces):
        for face2 in planar_faces[i+1:]:
            # Check if normals are anti-parallel (facing opposite)
            if dot(face1.normal, face2.normal) < -0.99:
                distance = abs(face1.d - face2.d)
                if 0.3 <= distance <= max_distance:
                    pairs.append(PlanarPairInfo(
                        face1_area=face1.area,
                        face2_area=face2.area,
                        distance=distance,
                        normal=face1.normal
                    ))
    return pairs
```

### 2.7 STEP-Specific Advantages

| Advantage | Description |
|-----------|-------------|
| **Exact Geometry** | Mathematical precision, no approximation errors |
| **Face Classification** | Direct B-Rep access for face type analysis |
| **PMI Support** | GD&T annotations if present |
| **Assembly Info** | Multi-body detection |
| **Units** | Embedded unit information |
| **Topology** | Edge-face relationships for bend detection |

---

## 3. STL File Processing

### 3.1 Overview

STL (Stereolithography) files contain only mesh data—triangular facets without topological information. Feature extraction requires geometric inference.

### 3.2 Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                     STL PROCESSING PIPELINE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐                                                   │
│  │  STL File   │                                                   │
│  │   (.stl)    │                                                   │
│  └──────┬──────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Trimesh Loader                            │   │
│  │  - Parse ASCII or Binary STL                                │   │
│  │  - Build mesh vertices + faces                              │   │
│  │  - Scale to mm units                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Mesh Validation                           │   │
│  │  - Check watertight                                         │   │
│  │  - Repair degenerate faces                                  │   │
│  │  - Compute face normals                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────┬─────────────────┬────────────────────┐   │
│  │   Mass Properties   │  Ray Casting    │  Normal Clustering │   │
│  │  - Volume           │  - Wall detect  │  - Bend angles     │   │
│  │  - Surface area     │  - Thickness    │  - Planar regions  │   │
│  │  - Bounding box     │  - Min wall     │  - Cylinder detect │   │
│  └─────────────────────┴─────────────────┴────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Feature Detection                         │   │
│  │  - Hole detection (cylinder fitting)                        │   │
│  │  - Pocket detection (concavity analysis)                    │   │
│  │  - Fillet detection (curvature radius)                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Mesh Loading

```python
import trimesh

def load_stl(path: str, scale: float = 1.0):
    """Load STL mesh with optional scaling."""
    mesh = trimesh.load(path, force='mesh')
    if scale != 1.0:
        mesh.apply_scale(scale)
    
    # Ensure normals exist
    if not mesh.face_normals.any():
        mesh.fix_normals()
    
    return mesh
```

### 3.4 Ray Casting for Thickness Detection

```python
def detect_wall_thickness(mesh, sample_count=1000):
    """
    Use ray casting to detect uniform wall thickness.
    Fires rays from interior points toward mesh surface.
    """
    # Sample points on mesh surface
    points, indices = trimesh.sample.sample_surface(mesh, sample_count)
    normals = mesh.face_normals[indices]
    
    # Cast rays inward
    origins = points + normals * 0.01  # Offset slightly outward
    ray_directions = -normals
    
    # Find intersection with opposite wall
    locations, ray_ids, face_ids = mesh.ray.intersects_location(
        origins, ray_directions
    )
    
    # Compute distances (wall thicknesses)
    thicknesses = []
    for loc, origin in zip(locations, origins[ray_ids]):
        distance = np.linalg.norm(loc - origin)
        if 0.3 < distance < 20:  # Filter outliers
            thicknesses.append(distance)
    
    # Cluster thicknesses to find dominant wall
    return analyze_thickness_distribution(thicknesses)
```

### 3.5 Normal Clustering for Bend Detection

```python
def detect_bends_from_normals(mesh, angle_threshold=15.0):
    """
    Cluster face normals to detect bend angles.
    Flat areas have same normal; bends create different clusters.
    """
    normals = mesh.face_normals
    areas = mesh.area_faces
    
    # Cluster normals using angular proximity
    clusters = cluster_normals(normals, areas, angle_threshold)
    
    # Find bends by computing dihedral angles between major clusters
    bends = []
    for i, cluster1 in enumerate(clusters):
        for cluster2 in clusters[i+1:]:
            # Check if clusters share an edge region
            if clusters_adjacent(cluster1, cluster2, mesh):
                angle = compute_dihedral(cluster1.normal, cluster2.normal)
                if 30 < angle < 170:  # Valid bend angle range
                    bends.append({'angle': angle, 'confidence': 0.7})
    
    return bends
```

### 3.6 STL Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No topology | Can't identify true edges | Normal clustering |
| No face types | Must infer from mesh | Curvature analysis |
| Tessellation errors | Small gaps/overlaps | Mesh repair |
| No PMI/tolerances | No tolerance info | Default assumptions |
| No threads | Helical threads are faceted | Heuristic detection |
| Unit ambiguity | May be wrong scale | User confirmation |

### 3.7 Mesh Quality Requirements

| Quality Metric | Minimum | Recommended |
|----------------|---------|-------------|
| Triangle count | 100 | 5,000+ |
| Watertight | Yes | Yes |
| Max face angle | <120° | <90° |
| No degenerate faces | Required | Required |

---

## 4. DXF File Processing

### 4.1 Overview

DXF (Drawing Exchange Format) provides 2D profile information for flat sheet metal parts. These are laser-cut or punched profiles without bending information.

### 4.2 Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DXF PROCESSING PIPELINE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐                                                   │
│  │  DXF File   │                                                   │
│  │   (.dxf)    │                                                   │
│  └──────┬──────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    ezdxf Parser                              │   │
│  │  - Parse entities (LINE, ARC, CIRCLE, POLYLINE)             │   │
│  │  - Extract layer information                                │   │
│  │  - Handle blocks and inserts                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Profile Construction                      │   │
│  │  - Build closed contours (outer boundary)                   │   │
│  │  - Identify holes (inner contours)                          │   │
│  │  - Compute bounding box                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────┬─────────────────────────────────────────┐│
│  │   Area Calculation  │  Feature Extraction                     ││
│  │  - Total area       │  - Hole count & sizes                   ││
│  │  - Cut perimeter    │  - Slot detection                       ││
│  │  - Nesting estimate │  - Corner analysis                      ││
│  └─────────────────────┴─────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Entity Types

| DXF Entity | Geometry | Usage |
|------------|----------|-------|
| `LINE` | Straight edge | Profile edges |
| `ARC` | Circular arc | Corners, cutouts |
| `CIRCLE` | Full circle | Holes |
| `ELLIPSE` | Elliptical arc | Rare features |
| `POLYLINE` | Multi-segment line | Complex profiles |
| `LWPOLYLINE` | Lightweight polyline | Common profiles |
| `SPLINE` | B-spline curve | Free-form edges |

### 4.4 Area and Perimeter Calculation

```python
def analyze_dxf(file_path):
    """Extract geometry from DXF file."""
    doc = ezdxf.readfile(file_path)
    msp = doc.modelspace()
    
    # Collect all entities
    lines = list(msp.query('LINE'))
    arcs = list(msp.query('ARC'))
    circles = list(msp.query('CIRCLE'))
    polylines = list(msp.query('LWPOLYLINE'))
    
    # Build profile
    contours = build_closed_contours(lines, arcs, polylines)
    
    # Compute bounding box
    bbox = compute_bounding_box(contours)
    
    # Compute areas
    outer_area = compute_polygon_area(contours.outer)
    hole_areas = [compute_polygon_area(h) for h in contours.holes]
    net_area = outer_area - sum(hole_areas)
    
    # Compute cut perimeter
    cut_length = sum(entity_length(e) for e in all_entities)
    
    return {
        'bounding_box': bbox,
        'area_mm2': net_area,
        'cut_perimeter_mm': cut_length,
        'hole_count': len(circles) + len(contours.holes),
        'holes': extract_holes(circles, contours.holes)
    }
```

### 4.5 DXF Response Format

```json
{
  "process_type": "sheet_metal",
  "confidence": 0.95,
  "classification_metadata": {
    "method": "dxf_flat_profile",
    "reasoning": "DXF implies flat sheet metal"
  },
  "geometry": {
    "bounding_box": {
      "x_mm": 200.0,
      "y_mm": 150.0,
      "z_mm": 1.5
    },
    "volume_mm3": 45000.0,
    "surface_area_mm2": 60000.0
  },
  "features": {
    "holes": [
      {"diameter_mm": 5.0, "type": "through"},
      {"diameter_mm": 8.0, "type": "through"}
    ],
    "cut_perimeter_mm": 1250.0,
    "net_area_mm2": 29500.0
  }
}
```

### 4.6 DXF-Specific Assumptions

| Assumption | Value | Rationale |
|------------|-------|-----------|
| Default thickness | 1.5mm | Common sheet gauge |
| Process type | sheet_metal | DXF implies flat cutting |
| Material | User-specified | Cannot be inferred |
| Bends | 0 | DXF is flat profile only |

---

## 5. IGES File Processing

### 5.1 Overview

IGES (Initial Graphics Exchange Specification) is an older B-Rep format, processed similarly to STEP but with fewer modern features.

### 5.2 Processing

```python
from OCC.Core.IGESControl import IGESControl_Reader

def load_iges_shape(path: str):
    """Load IGES file using OpenCASCADE."""
    reader = IGESControl_Reader()
    status = reader.ReadFile(path)
    
    if status == IFSelect_RetDone:
        reader.TransferRoots()
        shape = reader.OneShape()
        return shape
    else:
        raise ValueError(f"Failed to read IGES: {status}")
```

### 5.3 IGES vs STEP Comparison

| Feature | IGES | STEP |
|---------|------|------|
| Face types | ✅ Yes | ✅ Yes |
| Assemblies | ⚠️ Limited | ✅ Full support |
| PMI/GD&T | ⚠️ Basic | ✅ Full |
| Colors/Layers | ⚠️ Limited | ✅ Yes |
| Modern CAD | ❌ Deprecated | ✅ Current standard |

---

## 6. Unit Handling

### 6.1 Unit Detection

| Format | Unit Source | Fallback |
|--------|-------------|----------|
| STEP | File header | mm |
| IGES | File header | mm |
| STL | User input | mm (assume) |
| DXF | $INSUNITS header | mm |

### 6.2 Unit Conversion

```python
SCALE_FACTORS = {
    'mm': 1.0,
    'cm': 10.0,
    'm': 1000.0,
    'inch': 25.4,
    'ft': 304.8,
}

def scale_to_mm(value: float, unit: str) -> float:
    """Convert any unit to millimeters."""
    return value * SCALE_FACTORS.get(unit.lower(), 1.0)
```

---

## 7. File Validation

### 7.1 Pre-Processing Checks

| Check | STEP/IGES | STL | DXF |
|-------|-----------|-----|-----|
| File size < 100MB | ✅ | ✅ | ✅ |
| Valid file header | ✅ | ✅ | ✅ |
| Parseable | ✅ | ✅ | ✅ |
| Contains geometry | ✅ | ✅ | ✅ |
| Single body* | ✅ | ✅ | ✅ |

*Multi-body assemblies flagged for manual quote

### 7.2 Post-Processing Validation

| Validation | Criterion | Action if Fail |
|------------|-----------|----------------|
| Volume > 0 | Must be positive | Error |
| Surface area > 0 | Must be positive | Error |
| Valid bbox | All dims > 0 | Warn |
| Reasonable size | < 2m each dim | Warn |
| Reasonable complexity | < 10,000 features | Warn |

---

## 8. Performance Guidelines

### 8.1 Processing Times by Format

| Format | Size | Typical Time | Max Time |
|--------|------|--------------|----------|
| STEP | < 5MB | 1-3s | 10s |
| STEP | 5-50MB | 3-15s | 60s |
| STL | < 5MB | 0.5-2s | 10s |
| STL | 5-50MB | 2-10s | 30s |
| DXF | Any | 0.3-1s | 5s |
| IGES | < 5MB | 1-5s | 15s |

### 8.2 Optimization Tips

- STEP preferred over IGES for speed
- Simplify CAD before export (remove PMI, colors if not needed)
- Export only relevant bodies
- Use binary STL (10× smaller than ASCII)
- Reduce DXF complexity (fewer layers, no blocks)

---

*Document maintained by FFP Tech Team*
