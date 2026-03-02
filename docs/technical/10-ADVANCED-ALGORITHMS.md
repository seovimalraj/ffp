# Advanced Algorithms & Internal Implementation

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Deep Technical Reference

---

## 1. Overview

This document provides deep technical details on the algorithms, mathematical foundations, and implementation internals of the FFP (Frigate Fast Parts) CAD Analysis System. It is intended for senior engineers, algorithm developers, and technical due diligence.

---

## 2. Thickness Detection Algorithms

### 2.1 Multi-Method Thickness Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    THICKNESS DETECTION PIPELINE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Input: TopoDS_Shape (B-Rep solid)                                     │
│                                                                          │
│   ┌─────────────────┐                                                   │
│   │ Method 1:       │  Extract planar faces → Group by normal          │
│   │ Paired Planes   │  → Find parallel pairs → Compute distance        │
│   └────────┬────────┘                                                   │
│            │ thickness_1, confidence_1                                  │
│            ▼                                                            │
│   ┌─────────────────┐                                                   │
│   │ Method 2:       │  Sample surface points → Cast rays inward        │
│   │ Ray Casting     │  → Measure wall traversal → Statistical mode     │
│   └────────┬────────┘                                                   │
│            │ thickness_2, confidence_2                                  │
│            ▼                                                            │
│   ┌─────────────────┐                                                   │
│   │ Method 3:       │  min(bounding_box_dims) as thickness estimate    │
│   │ Min Dimension   │  → Apply aspect ratio correction                 │
│   └────────┬────────┘                                                   │
│            │ thickness_3 (low confidence)                               │
│            ▼                                                            │
│   ┌─────────────────┐                                                   │
│   │ Fusion Layer    │  Weighted average based on confidence            │
│   │                 │  Outlier rejection via median filter             │
│   └────────┬────────┘                                                   │
│            │                                                            │
│            ▼                                                            │
│   Output: final_thickness_mm, confidence (0-1)                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Paired Plane Algorithm

```python
def detect_paired_planes(shape: TopoDS_Shape) -> List[PlanarPairInfo]:
    """
    Detect parallel planar face pairs that indicate wall thickness.
    
    Mathematical basis:
    - Two planes are parallel if |n1 · n2| > 0.99 (dot product)
    - Distance = |point_on_plane2 - point_on_plane1| · n1
    """
    planar_faces = []
    for face in iterate_faces(shape):
        surface = BRepAdaptor_Surface(face)
        if surface.GetType() == GeomAbs_Plane:
            plane = surface.Plane()
            normal = plane.Axis().Direction()
            point = plane.Location()
            area = compute_face_area(face)
            planar_faces.append({
                'face': face,
                'normal': (normal.X(), normal.Y(), normal.Z()),
                'point': (point.X(), point.Y(), point.Z()),
                'area': area
            })
    
    # Find parallel pairs
    pairs = []
    for i, f1 in enumerate(planar_faces):
        for f2 in planar_faces[i+1:]:
            n1, n2 = np.array(f1['normal']), np.array(f2['normal'])
            
            # Check parallel (same or opposite direction)
            dot = abs(np.dot(n1, n2))
            if dot > 0.99:  # 8° tolerance
                # Compute distance
                p1, p2 = np.array(f1['point']), np.array(f2['point'])
                distance = abs(np.dot(p2 - p1, n1))
                
                # Valid thickness range: 0.4mm - 6mm for sheet metal
                if 0.4 <= distance <= 6.0:
                    # Score by area overlap
                    min_area = min(f1['area'], f2['area'])
                    max_area = max(f1['area'], f2['area'])
                    area_ratio = min_area / max_area
                    
                    pairs.append(PlanarPairInfo(
                        distance_mm=distance,
                        area_ratio=area_ratio,
                        confidence=area_ratio * dot
                    ))
    
    return pairs
```

### 2.3 Thickness Consensus Algorithm

```python
def compute_thickness_consensus(pairs: List[PlanarPairInfo]) -> Tuple[float, float]:
    """
    Compute dominant thickness from multiple paired plane measurements.
    
    Uses histogram clustering to find the most common thickness value.
    """
    if not pairs:
        return None, 0.0
    
    # Bin thicknesses (0.1mm resolution)
    thickness_values = [p.distance_mm for p in pairs]
    weights = [p.confidence * p.area_ratio for p in pairs]
    
    # Weighted histogram
    bins = np.arange(0.0, 10.0, 0.1)
    hist, _ = np.histogram(thickness_values, bins=bins, weights=weights)
    
    # Find dominant peak
    peak_idx = np.argmax(hist)
    dominant_thickness = bins[peak_idx] + 0.05  # Bin center
    
    # Compute confidence based on peak dominance
    total_weight = sum(weights)
    peak_weight = hist[peak_idx]
    cluster_dominance = peak_weight / total_weight if total_weight > 0 else 0
    
    # Count pairs within tolerance of dominant
    supporting_pairs = sum(
        1 for t in thickness_values 
        if abs(t - dominant_thickness) < 0.3
    )
    uniformity = supporting_pairs / len(pairs)
    
    confidence = (cluster_dominance + uniformity) / 2
    
    return dominant_thickness, confidence
```

---

## 3. Face Classification Engine

### 3.1 BRepAdaptor Surface Analysis

```python
class FaceTypeHistogram:
    """Histogram of face types from B-Rep analysis."""
    
    def __init__(self):
        self.plane = 0
        self.cylinder = 0
        self.cone = 0
        self.sphere = 0
        self.torus = 0
        self.bezier = 0
        self.bspline = 0
        self.revolution = 0
        self.other = 0
        self.total_faces = 0
        self.total_area = 0.0
        
    def add_face(self, face: TopoDS_Face):
        """Classify and count a single face."""
        surface = BRepAdaptor_Surface(face)
        surface_type = surface.GetType()
        area = compute_face_area(face)
        
        # Map OpenCASCADE type to category
        type_map = {
            GeomAbs_Plane: 'plane',
            GeomAbs_Cylinder: 'cylinder',
            GeomAbs_Cone: 'cone',
            GeomAbs_Sphere: 'sphere',
            GeomAbs_Torus: 'torus',
            GeomAbs_BezierSurface: 'bezier',
            GeomAbs_BSplineSurface: 'bspline',
            GeomAbs_SurfaceOfRevolution: 'revolution',
        }
        
        category = type_map.get(surface_type, 'other')
        setattr(self, category, getattr(self, category) + 1)
        
        self.total_faces += 1
        self.total_area += area
```

### 3.2 Face Ratio Computation

```python
def compute_face_ratios(histogram: FaceTypeHistogram) -> Dict[str, float]:
    """Compute normalized face type ratios."""
    
    total = histogram.total_faces
    if total == 0:
        return {}
    
    return {
        'plane_ratio': histogram.plane / total,
        'cylinder_ratio': histogram.cylinder / total,
        'cone_ratio': histogram.cone / total,
        'sphere_ratio': histogram.sphere / total,
        'freeform_ratio': (histogram.bezier + histogram.bspline) / total,
        'revolution_ratio': histogram.revolution / total,
    }
```

### 3.3 Classification Signal Extraction

```python
def extract_classification_signals(
    histogram: FaceTypeHistogram,
    pairs: List[PlanarPairInfo]
) -> Dict[str, float]:
    """
    Extract signals for process classification.
    """
    ratios = compute_face_ratios(histogram)
    
    # Sheet metal signals
    # - High plane ratio (flat surfaces)
    # - Multiple paired planes (consistent wall thickness)
    # - Low freeform ratio (no sculptured surfaces)
    sheet_metal_score = (
        ratios['plane_ratio'] * 30 +           # Planar surfaces
        min(len(pairs), 10) * 5 +               # Paired planes (max 50)
        (1 - ratios['freeform_ratio']) * 20    # No freeform
    )
    
    # CNC signals
    # - Moderate to high cylinder ratio (holes, bosses)
    # - Presence of freeform surfaces
    # - Low paired plane count (variable thickness)
    cnc_score = (
        ratios['cylinder_ratio'] * 25 +        # Cylindrical features
        ratios['freeform_ratio'] * 30 +        # Sculptured surfaces
        ratios['cone_ratio'] * 15 +            # Countersinks, chamfers
        (1 - min(len(pairs), 5) / 5) * 30      # Variable thickness
    )
    
    # Turning signals
    # - Very high cylinder ratio
    # - Some revolution surfaces
    # - Low plane ratio
    turning_score = (
        ratios['cylinder_ratio'] * 40 +
        ratios['revolution_ratio'] * 30 +
        ratios['cone_ratio'] * 20 +
        (1 - ratios['plane_ratio']) * 10
    )
    
    return {
        'sheet_metal_score': min(sheet_metal_score, 100),
        'cnc_milling_score': min(cnc_score, 100),
        'turning_score': min(turning_score, 100),
    }
```

---

## 4. Bend Detection Algorithms

### 4.1 STEP-Based Bend Detection

```python
def detect_bends_from_brep(shape: TopoDS_Shape) -> List[BendFeature]:
    """
    Detect bends by finding cylindrical faces with adjacent planar faces.
    
    A bend is characterized by:
    - A cylindrical surface (the bend radius)
    - Two planar surfaces meeting the cylinder (the flanges)
    - The dihedral angle between the planes (the bend angle)
    """
    bends = []
    
    for face in iterate_faces(shape):
        surface = BRepAdaptor_Surface(face)
        
        if surface.GetType() != GeomAbs_Cylinder:
            continue
        
        cylinder = surface.Cylinder()
        radius = cylinder.Radius()
        
        # Valid bend radius range
        if not (0.5 <= radius <= 30.0):
            continue
        
        # Find adjacent planar faces
        adjacent_faces = get_adjacent_faces(shape, face)
        planar_adjacent = [
            f for f in adjacent_faces 
            if is_planar_face(f)
        ]
        
        if len(planar_adjacent) < 2:
            continue
        
        # Compute bend angle from planar face normals
        n1 = get_face_normal(planar_adjacent[0])
        n2 = get_face_normal(planar_adjacent[1])
        
        # Dihedral angle
        dihedral = math.degrees(math.acos(np.clip(np.dot(n1, n2), -1, 1)))
        bend_angle = 180 - dihedral
        
        if 15 <= bend_angle <= 175:
            bends.append(BendFeature(
                angle_deg=bend_angle,
                radius_mm=radius,
                length_mm=get_cylinder_arc_length(face),
                confidence=0.95
            ))
    
    return bends
```

### 4.2 Mesh-Based Bend Detection (STL)

For mesh files without B-Rep data, we use normal clustering:

```python
def detect_bends_from_mesh(mesh) -> List[BendFeature]:
    """
    Detect bends from mesh by clustering face normals.
    
    Algorithm:
    1. Cluster triangle normals using spherical k-means
    2. Find cluster transitions (adjacent faces in different clusters)
    3. Estimate bend angle from cluster normal differences
    4. Estimate radius from transition region geometry
    """
    # Step 1: Cluster face normals
    normals = mesh.face_normals
    n_clusters = estimate_cluster_count(normals)
    
    # Spherical clustering (normals are unit vectors)
    from sklearn.cluster import KMeans
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    labels = kmeans.fit_predict(normals)
    
    # Step 2: Find cluster transitions
    face_adjacency = mesh.face_adjacency
    transitions = []
    
    for i, j in face_adjacency:
        if labels[i] != labels[j]:
            transitions.append((i, j, labels[i], labels[j]))
    
    # Step 3: Group transitions by cluster pair
    from collections import defaultdict
    pair_transitions = defaultdict(list)
    for i, j, c1, c2 in transitions:
        key = tuple(sorted([c1, c2]))
        pair_transitions[key].append((i, j))
    
    # Step 4: For each cluster pair, estimate bend
    bends = []
    for (c1, c2), edges in pair_transitions.items():
        if len(edges) < 10:  # Need enough edges for reliable estimate
            continue
        
        # Cluster centroids (average normals)
        n1 = kmeans.cluster_centers_[c1]
        n2 = kmeans.cluster_centers_[c2]
        
        # Bend angle
        angle = math.degrees(math.acos(np.clip(np.dot(n1, n2), -1, 1)))
        
        if 15 <= angle <= 175:
            # Estimate radius from edge vertex positions
            edge_vertices = [mesh.vertices[mesh.faces[i]] for i, j in edges[:20]]
            radius = estimate_bend_radius(edge_vertices, n1, n2)
            
            bends.append(BendFeature(
                angle_deg=angle,
                radius_mm=radius,
                confidence=0.70  # Lower confidence for mesh-based
            ))
    
    return bends
```

---

## 5. Manufacturing Process Scoring

### 5.1 11-Tier Classification Cascade

```python
class ProcessClassifier:
    """
    11-tier rule-based classification with weighted scoring.
    
    Each tier handles a specific classification scenario,
    from high-confidence matches to ambiguous edge cases.
    """
    
    def classify(self, metrics: GeometryMetrics, ...) -> ClassificationResult:
        
        # TIER 1: Explicit DXF (2D)
        if metrics.file_format == 'dxf':
            return ClassificationResult('sheet_metal', 0.99, 
                tier=1, reason="DXF is 2D sheet pattern")
        
        # TIER 2: Strong turning signal (high XY similarity)
        if metrics.xy_similarity < 0.05 and metrics.length_greater_than_diameter:
            return ClassificationResult('cnc_turning', 0.95,
                tier=2, reason="Cylindrical with L > D")
        
        # TIER 3: Strong sheet metal (bends + thin)
        if metrics.bend_count >= 2 and metrics.thickness_mm <= 6.0:
            if metrics.thickness_confidence > 0.7:
                return ClassificationResult('sheet_metal', 0.92,
                    tier=3, reason="Multiple bends, thin wall")
        
        # TIER 4: High paired plane count (sheet metal)
        if metrics.paired_plane_count >= 4 and metrics.uniform_thickness:
            return ClassificationResult('sheet_metal', 0.88,
                tier=4, reason="Many parallel planes, uniform wall")
        
        # TIER 5: Strong CNC signals (threads, deep pockets)
        if metrics.thread_count >= 2 or metrics.deep_pocket_count >= 2:
            return ClassificationResult('cnc_milling', 0.85,
                tier=5, reason="Threading or deep pockets")
        
        # TIER 6: 5-axis indicators (multiple undercuts)
        if metrics.undercut_count >= 2 and metrics.access_directions >= 4:
            return ClassificationResult('cnc_5axis', 0.82,
                tier=6, reason="Complex access requirements")
        
        # TIER 7: Turn-mill hybrid
        if metrics.xy_similarity < 0.15 and metrics.pocket_count >= 2:
            return ClassificationResult('turn_mill', 0.80,
                tier=7, reason="Cylindrical with milled features")
        
        # TIER 8: Casting indicators
        if metrics.draft_angles_present and metrics.uniform_wall_thickness:
            if metrics.complex_shape:
                return ClassificationResult('casting', 0.78,
                    tier=8, reason="Draft angles, complex geometry")
        
        # TIER 9: Weldment indicators
        if metrics.body_count >= 2 and metrics.has_weld_joints:
            return ClassificationResult('weldment', 0.76,
                tier=9, reason="Multiple bodies with joints")
        
        # TIER 10: Score-based classification
        scores = self._compute_process_scores(metrics)
        best_process = max(scores, key=scores.get)
        best_score = scores[best_process]
        
        if best_score >= 50:
            return ClassificationResult(best_process, best_score / 100,
                tier=10, reason="Score-based classification")
        
        # TIER 11: ML fallback for borderline cases
        if self._ml_classifier and self.use_ml:
            ml_result = self._ml_classifier.predict(features)
            if ml_result and ml_result.confidence >= 0.65:
                return ClassificationResult(
                    ml_result.predicted_process,
                    ml_result.confidence,
                    tier=11,
                    reason="ML classification"
                )
        
        # Default: CNC milling (safest assumption)
        return ClassificationResult('cnc_milling', 0.50,
            tier=11, reason="Default fallback")
```

### 5.2 Process Score Computation

```python
def _compute_process_scores(self, m: GeometryMetrics) -> Dict[str, float]:
    """
    Compute weighted scores for each manufacturing process.
    """
    scores = {}
    
    # Sheet Metal Score
    sm_score = 0
    sm_score += self._thickness_score(m.detected_thickness, m.thickness_confidence)
    sm_score += m.bend_count * 8                    # +8 per bend
    sm_score += m.paired_plane_count * 5            # +5 per pair
    sm_score += (1 - m.freeform_ratio) * 15         # Low freeform
    sm_score += m.plane_ratio * 20                  # High planarity
    sm_score -= m.thread_count * 10                 # Threads are CNC
    sm_score -= m.deep_pocket_count * 12            # Deep pockets are CNC
    scores['sheet_metal'] = max(0, min(100, sm_score))
    
    # CNC Milling Score
    cnc_score = 0
    cnc_score += m.pocket_count * 6                 # +6 per pocket
    cnc_score += m.thread_count * 8                 # +8 per thread
    cnc_score += m.hole_count * 2                   # +2 per hole
    cnc_score += m.freeform_ratio * 30              # Sculptured surfaces
    cnc_score += m.cylinder_ratio * 15              # Cylindrical features
    cnc_score -= m.bend_count * 10                  # Bends are sheet metal
    cnc_score += (1 - m.thickness_uniformity) * 20  # Variable thickness
    scores['cnc_milling'] = max(0, min(100, cnc_score))
    
    # CNC Turning Score
    turn_score = 0
    turn_score += (1 - m.xy_similarity) * 40        # High cylindricality
    turn_score += m.revolution_ratio * 30           # Revolution surfaces
    turn_score += m.cylinder_ratio * 25             # Cylindrical faces
    turn_score -= m.plane_ratio * 15                # Low planarity
    turn_score -= m.pocket_count * 8                # Pockets need milling
    scores['cnc_turning'] = max(0, min(100, turn_score))
    
    # ... similar for other processes
    
    return scores
```

---

## 6. Pricing Algorithm Internals

### 6.1 Material Volume Computation

```python
def compute_stock_volume(
    bbox: BoundingBox,
    process: str,
    material: str
) -> float:
    """
    Compute raw material stock volume required.
    """
    x, y, z = bbox.x, bbox.y, bbox.z
    
    if process == 'sheet_metal':
        # Flat blank + bend allowance
        thickness = min(x, y, z)
        flat_area = compute_flat_pattern_area(bbox, bends)
        return flat_area * thickness
    
    elif process == 'cnc_turning':
        # Cylindrical bar stock
        diameter = max(x, y) + 2 * STOCK_ALLOWANCE
        length = z + 2 * STOCK_ALLOWANCE
        return math.pi * (diameter / 2) ** 2 * length
    
    else:  # cnc_milling
        # Rectangular block
        return (
            (x + 2 * STOCK_ALLOWANCE) *
            (y + 2 * STOCK_ALLOWANCE) *
            (z + 2 * STOCK_ALLOWANCE)
        )
```

### 6.2 Machining Time Estimation

```python
def estimate_machining_time(
    part_volume_mm3: float,
    stock_volume_mm3: float,
    features: FeatureCounts,
    material: MaterialProperties
) -> float:
    """
    Estimate total machining time based on material removal and features.
    
    Model:
    - Base roughing time = material_removed / MRR
    - Feature time = sum(feature_count * feature_time)
    - Setup time = fixed per operation
    - Finishing time = surface_area * finish_rate
    """
    # Material removal volume
    removal_volume = stock_volume_mm3 - part_volume_mm3
    
    # Material removal rate (mm³/min) - material dependent
    mrr = material.machinability_factor * BASE_MRR
    
    # Roughing time
    roughing_time = removal_volume / mrr
    
    # Feature times (minutes per feature)
    FEATURE_TIMES = {
        'hole': 0.35,
        'threaded_hole': 0.75,
        'pocket': 1.2,
        'slot': 0.6,
        'fillet': 0.15,
        'chamfer': 0.10,
        'counterbore': 0.25,
        'countersink': 0.20,
    }
    
    feature_time = sum(
        count * FEATURE_TIMES.get(feat_type, 0.5)
        for feat_type, count in features.items()
    )
    
    # Setup time (per operation)
    setup_time = estimate_setups(features) * SETUP_TIME_MINUTES
    
    # Total
    total_time = roughing_time + feature_time + setup_time
    
    # Apply material difficulty factor
    total_time *= material.difficulty_factor
    
    return total_time
```

### 6.3 Cost Model

```python
def compute_part_cost(
    machining_time_min: float,
    material_cost: float,
    process: str,
    quantity: int,
    tolerances: ToleranceSpec,
    finishes: List[FinishSpec]
) -> CostBreakdown:
    """
    Compute total part cost with all factors.
    """
    # Base machining cost
    machine_rate = MACHINE_RATES[process]  # $/hr
    machining_cost = (machining_time_min / 60) * machine_rate
    
    # Tolerance premium
    tolerance_mult = compute_tolerance_multiplier(tolerances)
    machining_cost *= tolerance_mult
    
    # Quantity discount
    qty_discount = compute_quantity_discount(quantity)
    unit_machining_cost = machining_cost * (1 - qty_discount)
    
    # Finish costs
    finish_cost = sum(
        compute_finish_cost(finish, surface_area)
        for finish in finishes
    )
    
    # Assembly/secondary ops
    secondary_cost = compute_secondary_ops(features)
    
    return CostBreakdown(
        material=material_cost,
        machining=unit_machining_cost,
        finishing=finish_cost,
        secondary=secondary_cost,
        total=material_cost + unit_machining_cost + finish_cost + secondary_cost
    )
```

---

## 7. Geometry Analysis Optimizations

### 7.1 Parallel Face Iteration

```python
def iterate_faces_parallel(shape: TopoDS_Shape) -> Iterator[TopoDS_Face]:
    """
    Iterate faces with parallelization for large models.
    """
    from concurrent.futures import ThreadPoolExecutor
    
    # Collect all faces first
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    faces = []
    while explorer.More():
        faces.append(topods.Face(explorer.Current()))
        explorer.Next()
    
    # If small model, process sequentially
    if len(faces) < 100:
        yield from faces
        return
    
    # For large models, process in parallel batches
    def analyze_batch(batch):
        return [analyze_face(f) for f in batch]
    
    batch_size = 50
    batches = [faces[i:i+batch_size] for i in range(0, len(faces), batch_size)]
    
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = executor.map(analyze_batch, batches)
        for batch_result in results:
            yield from batch_result
```

### 7.2 Spatial Indexing for Adjacency

```python
def build_face_adjacency_index(shape: TopoDS_Shape) -> Dict[TopoDS_Face, Set[TopoDS_Face]]:
    """
    Build spatial index for fast face adjacency queries.
    
    Uses edge-based adjacency: two faces are adjacent if they share an edge.
    """
    from collections import defaultdict
    
    # Map edges to faces
    edge_to_faces = defaultdict(set)
    
    for face in iterate_faces(shape):
        edge_explorer = TopExp_Explorer(face, TopAbs_EDGE)
        while edge_explorer.More():
            edge = topods.Edge(edge_explorer.Current())
            edge_hash = edge.HashCode(2**31 - 1)
            edge_to_faces[edge_hash].add(face)
            edge_explorer.Next()
    
    # Build adjacency map
    adjacency = defaultdict(set)
    for faces in edge_to_faces.values():
        faces = list(faces)
        for i, f1 in enumerate(faces):
            for f2 in faces[i+1:]:
                adjacency[f1].add(f2)
                adjacency[f2].add(f1)
    
    return adjacency
```

### 7.3 Mesh Decimation for Large STL

```python
def decimate_mesh_if_needed(mesh, target_faces: int = 100000) -> 'Trimesh':
    """
    Reduce mesh complexity for faster analysis while preserving features.
    """
    if len(mesh.faces) <= target_faces:
        return mesh
    
    # Compute decimation ratio
    ratio = target_faces / len(mesh.faces)
    
    # Use quadric decimation (preserves edges)
    decimated = mesh.simplify_quadric_decimation(
        target_faces,
        preserve_boundaries=True  # Keep hole edges
    )
    
    logger.info(f"Decimated mesh from {len(mesh.faces)} to {len(decimated.faces)} faces")
    
    return decimated
```

---

## 8. Caching Architecture

### 8.1 Multi-Level Cache

```
┌─────────────────────────────────────────────────────────────────┐
│                    CACHING ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Request                                                        │
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────┐                                           │
│  │ L1: In-Memory    │  TTL: request lifetime                    │
│  │ (LRU, 100 items) │  Hit rate: ~40%                          │
│  └────────┬─────────┘                                           │
│           │ miss                                                 │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ L2: Redis        │  TTL: 1 hour                              │
│  │ (hash-keyed)     │  Hit rate: ~30%                          │
│  └────────┬─────────┘                                           │
│           │ miss                                                 │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ L3: Database     │  TTL: 24 hours                            │
│  │ (analysis_cache) │  Hit rate: ~20%                          │
│  └────────┬─────────┘                                           │
│           │ miss                                                 │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │ Full Analysis    │  Compute and cache at all levels          │
│  │ (expensive)      │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Cache Key Generation

```python
def generate_cache_key(
    file_hash: str,
    analysis_params: Dict
) -> str:
    """
    Generate deterministic cache key from file content and parameters.
    """
    param_str = json.dumps(analysis_params, sort_keys=True)
    combined = f"{file_hash}:{param_str}"
    return hashlib.sha256(combined.encode()).hexdigest()[:32]
```

---

## 9. Error Handling & Recovery

### 9.1 Graceful Degradation

```python
def analyze_with_fallbacks(file_path: str) -> AnalysisResult:
    """
    Analyze file with graceful fallback chain.
    """
    # Attempt 1: Full B-Rep analysis
    try:
        shape = load_step_shape(file_path)
        return full_brep_analysis(shape)
    except BRepLoadError as e:
        logger.warning(f"B-Rep load failed: {e}, trying mesh fallback")
    
    # Attempt 2: Convert to mesh and analyze
    try:
        mesh = convert_to_mesh(file_path)
        return mesh_based_analysis(mesh)
    except MeshConversionError as e:
        logger.warning(f"Mesh conversion failed: {e}, trying basic analysis")
    
    # Attempt 3: Basic bounding box only
    try:
        bbox = extract_bounding_box_only(file_path)
        return basic_bbox_analysis(bbox)
    except Exception as e:
        logger.error(f"All analysis methods failed: {e}")
        raise AnalysisError("Unable to analyze file")
```

### 9.2 Partial Result Handling

```python
def safe_feature_extraction(shape) -> Dict:
    """
    Extract features with individual error handling.
    """
    result = {}
    
    # Each extraction can fail independently
    extractors = [
        ('holes', extract_holes),
        ('pockets', extract_pockets),
        ('bends', extract_bends),
        ('threads', extract_threads),
        ('fillets', extract_fillets),
    ]
    
    for name, extractor in extractors:
        try:
            result[name] = extractor(shape)
        except Exception as e:
            logger.warning(f"Failed to extract {name}: {e}")
            result[name] = []  # Empty list, analysis continues
    
    return result
```

---

## 10. Performance Metrics

### 10.1 Benchmark Results

| File Size | Faces | Analysis Time | Memory Peak |
|-----------|-------|---------------|-------------|
| 1 MB STEP | 500 | 0.8s | 150 MB |
| 5 MB STEP | 2,500 | 2.1s | 350 MB |
| 20 MB STEP | 10,000 | 5.3s | 800 MB |
| 50 MB STEP | 25,000 | 12.1s | 1.5 GB |

### 10.2 Optimization Targets

| Metric | Target | Current |
|--------|--------|---------|
| P50 latency | < 2s | 1.4s |
| P95 latency | < 10s | 7.2s |
| P99 latency | < 30s | 18.5s |
| Memory per request | < 1 GB | 450 MB avg |
| Throughput | > 10 req/s | 12 req/s |

---

*Document maintained by FFP Tech Team*
