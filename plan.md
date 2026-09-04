Yes. I would make this a V2 Feature Recognition Specification, explicitly isolated from your current implementation.
The important instruction for Claude Code is: do not modify, refactor, rename, or replace the existing V1 pipeline. V2 must be additive and independently executable.

NOTE ON "V1": In this repo, V1 is specifically `apps/cad-service/app/machining/` (parser.py, topology.py, faces.py, records.py, detectors/*, patterns.py, constraints.py, complexity.py, service.py, schemas.py) — the machining feature-detection pipeline behind `POST /api/v1/cad/analyze-machining`. It is not the separate `app/core/` + `app/extractors/` + `dfm_analyzer.py` stack, which is an unrelated sheet-metal DFM analyzer. Claude Code must be pointed at `app/machining/` explicitly; do not let it guess which package "V1" means.

Also note: V1 already implements several things this spec calls out as new for V2 — a single B-Rep traversal into a kernel-independent `ShapeModel` (`records.py`), concavity resolved once in `faces.py` and reused by every detector, per-`Detection` `confidence` + `evidence` (`schemas.py`), fully centralized tolerances with no hard-coded magic numbers (`config.py`), and repeated-feature grouping (`patterns.py`). V2 should build on top of that foundation rather than re-deriving it — see the correction in §3 and §35 below.
PythonOCC Manufacturing Feature Recognition — V2 Specification
Version: 2.0.0
Status: Development Specification
Scope: CAD geometry extraction → manufacturing feature recognition
Explicitly out of scope for V2: machining operation planning, machine selection, tool selection, machining time, costing.
1. V2 Objective
Build a new manufacturing-feature-recognition layer above the existing PythonOCC analyzer.
V2 target pipeline
STEP / STP / IGES
        │
        ▼
Existing PythonOCC Import
        │
        ▼
V2 B-Rep Extraction
        │
        ▼
V2 Geometric Facts
        │
        ▼
V2 Topology Graph
        │
        ▼
V2 Manufacturing Coordinate System
        │
        ▼
V2 Neighborhood / Context
        │
        ▼
V2 Candidate Generation
        │
        ▼
V2 Feature Recognition
        │
        ▼
V2 Feature Scoring
        │
        ▼
V2 Feature Fusion / Decomposition
        │
        ▼
V2 Feature Validation
        │
        ▼
V2 Canonical Manufacturing Features
The output should eventually be capable of representing CADEx-style concepts such as:
Turn Diameter Faces
Turn Face Faces
Turn Form Faces
Outer Diameter Grooves
End Face Grooves
Bores
Through Holes
Non-Perpendicular Holes
Fillets
Chamfers
Milled Faces
Curved Milled Faces
without depending on CADEx internally.
2. CRITICAL V2 ISOLATION RULE
Claude Code must treat the current implementation as V1 / production baseline.
DO NOT
❌ modify existing V1 recognizers
❌ change existing JSON schema
❌ rename existing modules
❌ replace existing functions
❌ change existing CLI behaviour
❌ change existing output
❌ remove existing feature detection
❌ refactor V1 merely to accommodate V2
DO
✓ create new V2 modules
✓ create new V2 classes
✓ create new V2 schemas
✓ reuse V1 read-only utilities where safe
✓ create V2 CLI/entry point
✓ create V2 JSON output
✓ create V1 vs V2 comparison tools
✓ add V2 tests
V1 and V2 must be executable independently.

CORRECTION: "reuse V1 read-only utilities where safe" is not optional polish — it is required for §35 (performance) to hold. Specifically, V2 must reuse `app/machining/records.py`'s `ShapeModel`/`FaceRecord`/`EdgeRecord`/`VertexRecord` and the traversal already done in `topology.py`/`faces.py` as the input to V2's geometric-facts layer, instead of re-walking the B-Rep from OCC independently. See §3 and §35.
3. Recommended V2 directory structure
Claude Code should create something similar to:
project/
│
├── existing_v1/
│   └── ... DO NOT MODIFY ...
│
├── v2/
│   │
│   ├── __init__.py
│   │
│   ├── extraction/
│   │   │   NOTE: these do NOT call OCC / re-traverse the B-Rep. They
│   │   │   consume V1's already-built ShapeModel (app/machining/records.py)
│   │   │   and adapt it into V2's normalized fact structures. A second
│   │   │   independent OCC traversal would violate §35.
│   │   ├── shape_model_adapter_v2.py   (reads app.machining.records.ShapeModel)
│   │   ├── face_extractor_v2.py        (V2 face facts, derived from FaceRecord)
│   │   ├── edge_extractor_v2.py        (V2 edge facts, derived from EdgeRecord)
│   │   └── vertex_extractor_v2.py      (V2 vertex facts, derived from VertexRecord)
│   │
│   ├── geometry/
│   │   ├── geometric_facts.py
│   │   ├── surface_analysis.py
│   │   ├── curvature_analysis.py
│   │   └── dimensional_analysis.py
│   │
│   ├── topology/
│   │   ├── topology_graph.py
│   │   ├── adjacency.py
│   │   ├── continuity.py
│   │   └── relationships.py
│   │
│   ├── coordinate/
│   │   ├── manufacturing_cs.py
│   │   ├── axis_detector.py
│   │   └── datum_detector.py
│   │
│   ├── context/
│   │   ├── neighborhood.py
│   │   └── face_context.py
│   │
│   ├── candidates/
│   │   ├── candidate_generator.py
│   │   └── candidate_registry.py
│   │
│   ├── recognition/
│   │   ├── feature_recognizer.py
│   │   ├── turning.py
│   │   ├── holes.py
│   │   ├── bores.py
│   │   ├── milling.py
│   │   └── finishing.py
│   │
│   ├── scoring/
│   │   ├── feature_scoring.py
│   │   ├── confidence.py
│   │   └── evidence.py
│   │
│   ├── fusion/
│   │   ├── feature_fusion.py
│   │   ├── feature_splitter.py
│   │   ├── parent_child.py
│   │   └── pattern_recognition.py
│   │
│   ├── validation/
│   │   ├── feature_validator.py
│   │   ├── coverage.py
│   │   └── diagnostics.py
│   │
│   ├── schema/
│   │   ├── v2_schema.py
│   │   └── canonical_features.py
│   │
│   ├── comparison/
│   │   ├── v1_v2_compare.py
│   │   └── reference_compare.py
│   │
│   └── pipeline/
│       └── analyzer_v2.py
│
├── tests/
│   └── v2/
│
└── docs/
    └── v2/
If your existing project structure differs, Claude Code should adapt this structure rather than reorganizing V1.
4. V2 data architecture
The V2 JSON should have separate layers.
{
  "schema_version": "2.0",
  "source": {},
  "geometry": {
    "solids": [],
    "faces": [],
    "edges": [],
    "vertices": []
  },
  "geometric_facts": {},
  "topology": {},
  "manufacturing_coordinate_system": {},
  "neighborhoods": [],
  "feature_candidates": [],
  "manufacturing_features": [],
  "patterns": [],
  "diagnostics": {}
}
Do not put V2 fields into the existing V1 JSON.
5. V2 extraction specification
For every face extract:
Identity
face_id
solid_id
shell_id
Surface
surface_type
radius
major_radius
minor_radius
cone_angle
axis
axis_origin
Extent
u_min
u_max
v_min
v_max
axial_min
axial_max
radial_min
radial_max
angular_min
angular_max
angular_span
Position
centroid
bounding_box
surface_center
Classification
internal
external
convex
concave
tangent
unknown
Topology references
edge_ids
adjacent_face_ids
6. Edge extraction specification
For every edge:
edge_id
curve_type
length
start_point
end_point
mid_point
closed
seam
curve_radius
curve_axis
face_ids
convexity
continuity
Recognize:
LINE
CIRCLE
ARC
ELLIPSE
BSPLINE
NURBS
OTHER
The edge data must remain linked to its parent faces.
7. Geometric Facts layer
Convert raw OCC output into normalized facts.
Example:
{
  "fact_id": "GF-018",
  "entity": "FACE-18",
  "fact_type": "EXTERNAL_CYLINDRICAL_REGION",
  "parameters": {
    "radius_mm": 31.4,
    "diameter_mm": 62.8,
    "axis": [1, 0, 0],
    "axial_width_mm": 2.2,
    "angular_span_deg": 360
  }
}
The geometric-facts layer should be manufacturing-neutral.
It should not call the object a groove yet.
8. Topology graph
Create:
Face → Edge → Face
and:
Face → Face
relationships.
Each relationship should support:
SHARED_EDGE
COAXIAL
CONCENTRIC
COPLANAR
PARALLEL
PERPENDICULAR
ANGULAR
TANGENT
CONTINUOUS
CONVEX
CONCAVE
Example:
{
  "from_face": 18,
  "to_face": 19,
  "relationship": "COAXIAL",
  "confidence": 1.0
}
9. Manufacturing coordinate system
V2 must identify candidate manufacturing axes.
For every candidate axis:
{
  "axis_id": "MCS-AXIS-001",
  "vector": [1, 0, 0],
  "origin": [0, 0, 0],
  "role_candidates": [
    {
      "role": "TURNING_AXIS",
      "confidence": 0.98
    }
  ],
  "evidence": [
    "multiple_coaxial_cylinders",
    "concentric_internal_surfaces",
    "dominant_rotational_geometry"
  ]
}
Do not assume global X is always the turning axis.
10. Neighborhood descriptor
Every face should receive a local context object.
Example:
{
  "face_id": 18,
  "neighbors": [
    {
      "face_id": 17,
      "surface_type": "CYLINDER",
      "radius_mm": 32.5
    },
    {
      "face_id": 19,
      "surface_type": "CYLINDER",
      "radius_mm": 32.5
    }
  ],
  "relationships": [
    "COAXIAL",
    "RADIAL_REDUCTION"
  ]
}
This is critical for feature recognition.
11. Candidate generation
This layer should have high recall.
For a cylindrical face, generate possible candidates such as:
TURN_OD
TURN_ID
BORE
HOLE
GROOVE
BOSS
STEP
UNDERCUT
TURN_FORM
For a planar face:
TURN_FACE
MILL_FACE
POCKET_BOTTOM
SHOULDER
STEP
For a conical face:
TAPER
CHAMFER
COUNTERSINK
TURN_FORM
For toroidal geometry:
FILLET
BLEND
ROUND
GROOVE
Don't eliminate candidates too early.
12. Feature registry
Create a central registry.
Example:
FEATURE_REGISTRY = {
    "TURN_OD": {...},
    "TURN_ID": {...},
    "TURN_FACE": {...},
    "TURN_FORM": {...},
    "OD_GROOVE": {...},
    "END_FACE_GROOVE": {...},
    "BORE": {...},
    "STEPPED_BORE": {...},
    "THROUGH_HOLE": {...},
    "BLIND_HOLE": {...},
    "ANGULAR_HOLE": {...},
    "DEEP_HOLE": {...},
    "MILL_FACE": {...},
    "POCKET": {...},
    "SLOT": {...},
    "FILLET": {...},
    "CHAMFER": {...}
}
The recognition rules should reference this registry rather than scattering thresholds throughout the code.
13. Feature definition structure
Each feature definition should contain:
feature_type
required_surface_types
required_geometry
required_relationships
optional_relationships
dimension_parameters
orientation_parameters
neighborhood_conditions
negative_conditions
scoring_weights
required_evidence
For example:
{
  "feature_type": "OD_GROOVE",
  "required_surface_types": [
    "CYLINDER"
  ],
  "conditions": {
    "external": true,
    "axis_alignment": "TURNING_AXIS",
    "lower_radius_than_neighbors": true,
    "short_axial_extent": true
  },
  "parameters": [
    "diameter_mm",
    "depth_mm",
    "width_mm",
    "axis",
    "position"
  ]
}
14. Turning recognition — V2.0 priority #1

CAVEAT: confirm this priority against the actual part population before Sprint 1. V1's existing detectors (`app/machining/detectors/`: holes, pockets, slots, bosses, blends, threads) are milling/prismatic-feature oriented — there is no existing turning-axis or lathe concept anywhere in `app/machining/`. V1's groove detector already finds external/internal grooves generically, by comparing a cylindrical face's radius against its axial neighbors, with no notion of a turning axis at all. If most parts in scope are prismatic/milled rather than turned, consider promoting §17 (holes) or §19 (milling) to priority #1 instead, since those extend detectors V1 already has, versus turning which introduces an entirely new axis-detection concept (§9) with no existing counterpart to build on.

Implement:
TURN_OD
TURN_ID
TURN_FACE
TURN_FORM
TURN_TAPER
TURN_SHOULDER
OD_GROOVE
ID_GROOVE
END_FACE_GROOVE
UNDERCUT
The turning engine should first build the rotational profile.
Conceptually:
X position
     ↓
R39.75 ─────────
R39.50 ───
R32.50 ───────
R31.40 ──
R32.50 ───────
Then recognize features from the profile.
This is considerably more reliable than independent face classification.
15. OD Groove rule
Candidate conditions:
surface = CYLINDER
external = TRUE
axis ≈ turning_axis
current_radius < neighboring_radius
left_neighbor.radius ≈ right_neighbor.radius
axial_width < configurable threshold
circumferential region is continuous
Derived parameters:
groove_diameter
groove_radius
groove_depth
groove_width
axial_position
angular_span
For your reference part, this should be capable of deriving the R31.4 / 1.1 / 2.2 groove from the detailed face and surrounding geometry.
16. Bore recognition
Separate:
BORE
STEPPED_BORE
TAPER_BORE
INTERNAL_GROOVE
A stepped bore should become:
STEPPED_BORE
    ├── BORE_SEGMENT
    ├── BORE_SEGMENT
    ├── BORE_SEGMENT
Each segment contains:
diameter
radius
depth
axial_start
axial_end
axis
source_faces
17. Hole recognition
V2 should preserve your existing successful hole detection but make it more structured.
Recognize:
THROUGH_HOLE
BLIND_HOLE
STEPPED_HOLE
COUNTERBORE
COUNTERSINK
SPOTFACE
ANGULAR_HOLE
DEEP_HOLE
Parameters:
diameter
radius
axis
entry_point
exit_point
physical_depth
entry_depth
angular_orientation
entry_face
exit_face
Do not assume physical depth equals machining depth.
18. Angular-hole recognition
For every hole:
angle_to_X
angle_to_Y
angle_to_Z
angle_to_turning_axis
angle_to_entry_face_normal
Then classify:
PERPENDICULAR
NON_PERPENDICULAR
RADIAL
ANGULAR
This should preserve the information already present in your current analyzer for holes such as the [0, 0.7071, 0.7071] direction.
19. Milling recognition
V2 should initially recognize:
MILL_FACE
CIRCULAR_MILL_FACE
CURVED_MILL_FACE
POCKET
SLOT
STEP
BOSS
CONTOUR
Recognition should use:
face normal
boundary shape
edge loops
depth
neighboring walls
planarity
surface curvature
orientation
20. Feature scoring
Every candidate receives a score.
Example:
OD_GROOVE
axis aligned                  +0.20
external cylinder             +0.15
radius reduction              +0.20
larger radius both sides      +0.20
short axial width             +0.10
circumferential continuity    +0.10
topological evidence          +0.05
                               -----
                               1.00
Store the individual scores.
Do not only store:
confidence = 0.96
Store:
{
  "confidence": 0.96,
  "score_breakdown": {
    "axis_alignment": 0.20,
    "radius_relationship": 0.20,
    "neighbor_relationship": 0.20
  }
}
This will be invaluable for debugging.
21. Negative evidence
This should be part of V2.
For example:
If radius is not smaller than neighbors
→ reduce OD_GROOVE score
or:
If cylindrical surface is internal
→ reject TURN_OD
or:
If surface is not coaxial with turning axis
→ reject normal TURN_OD
The registry should support:
positive evidence
negative evidence
required evidence
22. Feature fusion
After individual recognition:
Face 17 → TURN_OD
Face 18 → OD_GROOVE
Face 19 → TURN_OD
recognize:
TURN_OD
    ↓
OD_GROOVE
    ↓
TURN_OD
as one manufacturing structure.
Similarly:
BORE_SEGMENT
BORE_SEGMENT
BORE_SEGMENT
→
STEPPED_BORE
This is where V2 starts becoming much more CADEx-like.
23. Feature decomposition
The opposite is equally important.
If V1 says:
STEPPED_BORE
V2 should be able to decompose it into:
BORE ØA
BORE ØB
BORE ØC
So V2 supports both:
FUSION
and:
DECOMPOSITION
This is essential for later machining analysis.
24. Feature parent/child relationships
Use:
STEPPED_BORE
 ├── BORE_SEGMENT
 ├── BORE_SEGMENT
 └── BORE_SEGMENT
and:
HOLE_PATTERN
 ├── HOLE
 ├── HOLE
 └── HOLE
and:
OD_GROOVE
 └── CYLINDRICAL_REGION
The raw geometric feature should always remain traceable.
25. Feature coverage diagnostics
This should be mandatory.
V2 output:
{
  "coverage": {
    "total_faces": 73,
    "manufacturing_classified": 68,
    "supporting_geometry": 3,
    "unknown": 2,
    "coverage_percent": 93.15
  }
}
And:
{
  "unknown_faces": [
    {
      "face_id": 52,
      "surface_type": "BSPLINE",
      "reason": "NO_FEATURE_SIGNATURE"
    }
  ]
}
This creates a direct roadmap for improving the recognizer.
26. Do not force every face into a manufacturing feature
Use these classifications:
MANUFACTURING_FEATURE
TRANSITION_GEOMETRY
SUPPORTING_GEOMETRY
REFERENCE_GEOMETRY
UNKNOWN
This avoids false positives.
27. Canonical feature object
Every final V2 feature should follow one common structure:
{
  "feature_id": "MF-001",
  "feature_type": "OD_GROOVE",
  "status": "CONFIRMED",
  "source": {
    "faces": [18],
    "edges": [82, 83]
  },
  "geometry": {
    "axis": [1, 0, 0],
    "position": {},
    "diameter_mm": 62.8
  },
  "parameters": {
    "depth_mm": 1.1,
    "width_mm": 2.2
  },
  "relationships": {
    "parent": null,
    "children": [],
    "neighbors": ["MF-017", "MF-019"]
  },
  "confidence": 0.96,
  "evidence": [],
  "alternatives": []
}
This becomes the canonical representation.
28. V2 must retain traceability
Every final feature must answer:
Which CAD geometry caused this feature to be recognized?
Therefore:
Manufacturing Feature
       ↓
Source Faces
       ↓
Source Edges
       ↓
Geometric Facts
       ↓
Topology relationships
       ↓
Recognition rules
       ↓
Confidence
Without this, debugging becomes extremely difficult.
29. V2 comparison engine
Create:
V1 JSON
     │
     ├─────────────┐
     ↓             ↓
 V1 features    V2 features
     │             │
     └──────┬──────┘
            ↓
       Comparison
Output:
MATCH
MISSED
NEWLY_FOUND
FALSE_POSITIVE
RECLASSIFIED
DECOMPOSED
MERGED
For example:
{
  "feature_type": "OD_GROOVE",
  "v1": null,
  "v2": "MF-014",
  "status": "NEWLY_FOUND"
}
30. CADEx comparison should be canonical, not raw JSON comparison
Eventually:
CADEx JSON
     ↓
CADEx canonicalizer
     ↓
Canonical features
and:
V2 JSON
     ↓
V2 canonicalizer
     ↓
Canonical features
Then:
Canonical V2
     VS
Canonical CADEx
This avoids comparing completely different JSON structures.
31. V2 development phases
V2.0 — Foundation
B-Rep extraction
Face facts
Edge facts
Topology
Tolerance system
V2.1 — Coordinate intelligence
Principal axes
Turning-axis detection
Manufacturing coordinate system
V2.2 — Context
Neighborhood
Adjacency
Continuity
Convexity
Concavity
V2.3 — Turning
OD
ID
Face
Form
Taper
Shoulder
Groove
Undercut
V2.4 — Holes & bores
Hole
Through
Blind
Stepped
Angular
Deep
Bore
Stepped bore
V2.5 — Milling
Face
Pocket
Slot
Step
Boss
Contour
Curved surface
V2.6 — Intelligence
Candidate scoring
Evidence
Feature fusion
Feature decomposition
Parent/child
Pattern recognition
V2.7 — Validation
Coverage
Diagnostics
V1/V2 comparison
CADEx canonical comparison
Regression tests
32. Golden test strategy
Do not develop V2 against random models.
Create a test library:
tests/v2/golden_models/
01_simple_shaft
02_stepped_shaft
03_external_groove
04_internal_groove
05_simple_bore
06_stepped_bore
07_through_holes
08_blind_holes
09_counterbore
10_countersink
11_angular_holes
12_deep_holes
13_pocket
14_slot
15_boss
16_complex_turn_mill
17_P0010092
P0010092 should be one of the primary golden models, because you already have the detailed PythonOCC and CADEx references for it.
33. Each golden model should have expected recognition
For example:
{
  "expected_features": [
    {
      "type": "OD_GROOVE",
      "diameter_mm": 62.8,
      "depth_mm": 1.1,
      "width_mm": 2.2
    },
    {
      "type": "THROUGH_HOLE",
      "diameter_mm": 8
    }
  ]
}
Tests should validate:
feature existence
feature type
dimensions
axis
source faces
confidence threshold
34. Tolerance configuration
Centralize tolerances.
{
  "length_mm": 0.001,
  "radius_mm": 0.001,
  "angle_deg": 0.1,
  "axis_parallel_deg": 1.0,
  "axis_coaxial_mm": 0.01,
  "position_mm": 0.01
}
No recognizer should contain random hard-coded values such as:
if abs(radius - 32.5) < 0.01:
Instead:
if within_tolerance(radius, reference_radius, tolerance.length):
35. Performance requirement
V2 should not repeatedly query OCC for the same information.
Use:
OCC
 ↓
Extraction cache
 ↓
Normalized facts
 ↓
Recognition
rather than:
Recognizer 1 → OCC
Recognizer 2 → OCC
Recognizer 3 → OCC
Recognizer 4 → OCC
This will become very important with large assemblies/complex parts.

Concretely in this repo: the "extraction cache" already exists — it is V1's `ShapeModel` (`app/machining/records.py`), built by exactly one B-Rep traversal in `topology.py`/`faces.py`. V2 must treat that `ShapeModel` as its OCC layer and build `geometric_facts`/`topology` on top of it (read-only). V2 extraction modules must not open the shape and re-traverse OCC a second time — that reintroduces the exact "Recognizer → OCC" duplication this section forbids, just moved one level up the pipeline.
36. Logging/debugging requirement
Every recognition decision should be explainable.
For example:
[MF-014]
Candidate: OD_GROOVE
✓ cylindrical surface
✓ external
✓ axis aligned to MCS-AXIS-001
✓ radius 31.4 < neighboring radius 32.5
✓ width 2.2 mm
✓ circumferential continuity
✓ concave transitions
Score: 0.96
RESULT: CONFIRMED
This should be available in debug mode.
37. V2 CLI
Create a completely independent entry point.
Something conceptually like:
python -m v2.pipeline.analyzer_v2 input.step
and:
python -m v2.pipeline.analyzer_v2 input.step --debug
and:
python -m v2.pipeline.analyzer_v2 input.step --export-json output.json
Do not change the V1 command.
38. V2 output files
For debugging, generate:
output/
    part_v2.json
    geometric_facts.json
    topology_graph.json
    feature_candidates.json
    recognized_features.json
    diagnostics.json
This is much better than having one giant JSON while developing.
39. Claude Code implementation instructions
I would give Claude Code these explicit rules:
1. Inspect the existing repository before making changes.
2. Identify the existing analyzer entry point and V1 modules: V1 is `apps/cad-service/app/machining/` (entry point `POST /api/v1/cad/analyze-machining`, orchestrated by `service.py`). Do not confuse this with the separate, unrelated `app/core/` + `app/extractors/` + `dfm_analyzer.py` sheet-metal DFM stack — that is not V1 for this spec.
3. Treat all existing implementation in `app/machining/` as V1.
4. Do not modify V1 behavior.
5. Create an isolated V2 package.
6. Reuse existing V1 read-only extraction utilities, specifically `app/machining/records.py`'s `ShapeModel`/`FaceRecord`/`EdgeRecord`/`VertexRecord` (already the product of one full B-Rep traversal) — do not re-traverse OCC to rebuild equivalent data.
7. Do not duplicate expensive OCC operations unnecessarily — in particular, no second independent B-Rep traversal (see §35).
8. Build V2 around normalized geometric facts.
9. Implement topology as an explicit graph.
10. Implement manufacturing coordinate detection separately.
11. Implement candidate generation separately from recognition.
12. Implement recognition using feature signatures.
13. Implement scoring and evidence.
14. Implement feature fusion/decomposition.
15. Maintain source-face/source-edge traceability.
16. Add automated V2 tests.
17. Add V1/V2 comparison.
18. Run all existing V1 tests after every major change.
19. V1 output must remain unchanged.
20. V2 must be enabled only through the new V2 entry point.
40. Claude Code acceptance criteria
V2 should not be considered complete merely because it produces JSON.
Foundation
✓ all relevant faces extracted
✓ all relevant edges extracted
✓ topology graph generated
✓ normalized facts generated
✓ tolerances centralized
Coordinate
✓ dominant axes identified
✓ candidate turning axes identified
✓ axis confidence calculated
Recognition
✓ candidate generation works
✓ feature signatures implemented
✓ scoring works
✓ evidence recorded
✓ competing candidates retained
Feature intelligence
✓ features can be fused
✓ features can be decomposed
✓ parent/child supported
✓ patterns supported
Validation
✓ source-face traceability
✓ feature coverage
✓ unknown geometry report
✓ V1/V2 comparison
✓ golden-model regression
41. The most important success metric
Don't define success as:
"V2 generates more features."
Define it as:
                    V2 QUALITY
                        │
        ┌───────────────┼────────────────┐
        ↓               ↓                ↓
    Precision         Recall        Geometry accuracy
        │               │                │
        └───────────────┼────────────────┘
                        ↓
                 Manufacturing
                  interpretation
For every reference feature:
FOUND?
CORRECT TYPE?
CORRECT DIMENSIONS?
CORRECT AXIS?
CORRECT POSITION?
CORRECT SOURCE FACES?
42. Recommended first implementation sprint
I would not ask Claude Code to implement the entire specification in one shot.
Start with:
Sprint 1
V2 package
+
Face extractor
+
Edge extractor
+
Geometric facts
+
Topology graph
+
Tolerance framework
Sprint 2
Manufacturing coordinate system
+
Turning axis detector
+
Neighborhood descriptor
Sprint 3
Candidate registry
+
Candidate generation
+
Feature scoring
Sprint 4
TURN_OD
TURN_ID
TURN_FACE
TURN_FORM
OD_GROOVE
END_FACE_GROOVE
Sprint 5
BORE
STEPPED_BORE
THROUGH_HOLE
BLIND_HOLE
ANGULAR_HOLE
DEEP_HOLE
Then use P0010092 as the first serious end-to-end benchmark.
43. The V2 philosophy
The most important thing to communicate to Claude Code is this:
                     V1
                      │
              "Extract CAD"
                      │
                      ▼
              PythonOCC / B-Rep
V2 becomes:
                  V2
                   │
                   ▼
              "Understand CAD"
                   │
       ┌───────────┼───────────┐
       ↓           ↓           ↓
   Geometry     Topology     Context
       │           │           │
       └───────────┼───────────┘
                   ↓
             Candidates
                   ↓
             Recognition
                   ↓
               Scoring
                   ↓
                Fusion
                   ↓
             Final Feature
PythonOCC remains the geometric truth source. V2 becomes the interpretation engine.
That separation is the most important architectural decision.
One additional recommendation
For your project, I would actually name the two outputs explicitly:
P0010092_v1_geometry_analysis.json
P0010092_v2_manufacturing_feature_analysis.json
and eventually:
P0010092_v2_canonical_features.json
That makes it impossible for V2 development to accidentally overwrite or contaminate the current implementation.
The first coding target should therefore be V2's Geometric Facts + Topology Graph + Manufacturing Coordinate System; only after those three are stable should Claude Code start writing the new feature-recognition rules. This will give you a solid base for systematically closing the CADEx gap instead of accumulating more fragile feature-specific if/else logic.
 