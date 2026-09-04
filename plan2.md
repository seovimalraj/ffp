Yes. I reviewed the architecture you shared and compared it against current open-source B-Rep machining-feature-recognition approaches and the capabilities publicly documented for CAD Exchanger/CAD Exchanger MTK.
Your current foundation is actually much better suited for extending toward CADEx-level feature recognition than starting over. The important point is that I would not replace your rule-based engine with ML. I would turn it into a multi-layer recognition system:
OCCT geometric facts → topology graph → deterministic rules → geometric reasoning → feature composition → ML/GNN recognition → verification/confidence → manufacturing semantics
Your uploaded specification already has the right core architecture: one OCCT traversal, ShapeModel, face/edge records, adjacency, geometric properties, ray casting, and detector provenance.
1. First: what CADExchanger is actually doing
The public CAD Exchanger MTK documentation says its CNC machining recognition can identify:
pockets
through holes
blind holes
flat-bottom holes
partial holes
countersinks
concave fillet-edge milling faces
convex profile-edge milling faces
curved milled faces
flat-face milled faces
flat-side milled faces
It operates on B-Rep solids and has a configurable Machining_FeatureRecognizer. (Cadexsoft)
That is important because it tells us something:
CADEx-level recognition is not simply "detect cylinders and planes."
It has a higher-level interpretation layer that turns combinations of B-Rep entities into manufacturing features.
Your current engine is already doing this for several classes.
2. Where your current engine stands
I would rate your present architecture approximately like this:
Layer	Current	Target
CAD import	✅	✅
B-Rep extraction	✅	✅
Face classification	✅	✅
Edge classification	✅	✅
Face adjacency	✅	✅
Surface parameters	✅	✅
Concavity	✅	✅
Ray casting	✅	✅
Hole recognition	🟢 Strong	🟢
Pocket recognition	🟢	🟢
Slot recognition	🟢	🟢
Boss recognition	🟡	🟢
Groove recognition	🟡	🟢
Fillet/chamfer	🟡	🟢
Thread recognition	🟡	🟢
Patterns	🟢	🟢
Accessibility	🟢	🟢
Setup direction	🟢	🟢
Complex composite features	🔴	🟢
Feature hierarchy	🔴	🟢
Face-level semantic segmentation	🔴	🟢
Instance segmentation	🔴	🟢
Freeform machining features	🔴	🟢
Feature interaction reasoning	🔴	🟢
Manufacturing feature ontology	🟡	🟢
ML-assisted recognition	🔴	🟢
The biggest missing capability is not another detector.
It is:
Understanding multiple faces/features together as one manufacturing operation.
That is where I would focus.
3. The biggest architectural upgrade
Your current architecture is essentially:
B-Rep
  ↓
Face / Edge facts
  ↓
Individual detectors
  ↓
Features
I recommend moving to:
                       ┌─────────────────────┐
                       │     CAD / STEP      │
                       └──────────┬──────────┘
                                  ↓
                         OCCT B-Rep extraction
                                  ↓
                    ┌─────────────────────────┐
                    │   Canonical ShapeModel  │
                    └────────────┬────────────┘
                                 ↓
                    ┌─────────────────────────┐
                    │ Geometric Feature Graph │
                    │ Face + Edge + Relations  │
                    └────────────┬────────────┘
                                 ↓
             ┌───────────────────┼───────────────────┐
             ↓                   ↓                   ↓
      Rule Engine          ML/GNN Engine       Geometric Engine
             ↓                   ↓                   ↓
             └───────────────────┼───────────────────┘
                                 ↓
                     Feature Candidate Pool
                                 ↓
                     Feature Composition Engine
                                 ↓
                    Conflict / Claim Resolution
                                 ↓
                     Feature Verification Engine
                                 ↓
                       Final Feature Graph
                                 ↓
              Manufacturing Semantic Representation
This is the architecture I would use.
4. Your ShapeModel is the most valuable asset
Do not throw this away.
Your current:
TopoDS_Shape
   ↓
TopologyAnalyzer
   ↓
ShapeModel
is exactly the correct abstraction boundary.
OCCT itself is fundamentally organized around:
Vertex
Edge
Wire
Face
Shell
Solid
and the topology layer provides the relationships between those entities. (OpenCascade)
Your ShapeModel effectively converts that into a machine-learning/manufacturing-friendly representation.
I would expand it substantially.
5. Expand FaceRecord
Currently you have things like:
FaceRecord(
    surface_type,
    area,
    bbox,
    axis,
    normal,
    radius,
    is_internal
)
Add:
FaceRecord
│
├── topology
│   ├── face_id
│   ├── shell_id
│   ├── solid_id
│   ├── orientation
│   ├── edge_ids
│   └── neighbor_face_ids
│
├── geometry
│   ├── surface_type
│   ├── area
│   ├── centroid
│   ├── bbox
│   ├── normal
│   ├── curvature
│   ├── principal_curvature
│   ├── gaussian_curvature
│   ├── mean_curvature
│   ├── radius
│   ├── axis
│   ├── cone_angle
│   └── parameter_bounds
│
├── topology_semantics
│   ├── convexity_to_neighbor
│   ├── concavity_to_neighbor
│   ├── boundary_type
│   ├── closed_loop_count
│   └── hole_loop_count
│
├── accessibility
│   ├── +X
│   ├── -X
│   ├── +Y
│   ├── -Y
│   ├── +Z
│   └── -Z
│
└── ML features
    ├── feature_vector
    └── embedding
This becomes extremely powerful.
6. Expand the edge representation even more
Your current edge samples are already useful.
Add:
EdgeRecord
│
├── curve_type
├── length
├── radius
├── axis
├── start_point
├── end_point
├── tangent_start
├── tangent_end
├── curvature
├── convexity
├── adjacent_faces
├── dihedral_angle
├── seam
├── closed
├── periodic
└── sampled_geometry
Most importantly:
Edge-to-face relationship
For every edge:
edge
 ├── face A
 └── face B
calculate:
dihedral angle
convex
concave
tangent
sharp
This is extremely important for feature recognition.
7. Add a proper Attributed Adjacency Graph
This is one of the biggest improvements I recommend.
Your current graph:
Face A ─ Face B ─ Face C
should become:
             Edge
        ┌─────────────┐
        │             │
      Face A ─────── Face B
        │               │
        │               │
      Face C ─────── Face D
where every node and edge contains geometric attributes.
This is essentially the direction taken by modern research such as AAGNet, which uses a geometric attributed adjacency graph containing topology, geometry and extended attributes for machining-feature recognition. (GitHub)
This is a very good match for your architecture.
8. Layer 1 — deterministic geometric engine
Keep your current detectors.
But significantly expand them.
Feature families I would add
HOLES
├── through hole
├── blind hole
├── partial hole
├── interrupted hole
├── counterbore
├── countersink
├── spotface
├── stepped bore
├── tapered hole
├── reamed hole candidate
└── threaded hole
POCKETS
├── rectangular
├── circular
├── polygonal
├── irregular
├── open pocket
├── closed pocket
├── stepped pocket
├── tapered pocket
└── pocket with island
SLOTS
├── through slot
├── blind slot
├── rounded slot
├── T-slot
├── dovetail slot
├── keyway
└── open slot
BOSSES
├── cylindrical
├── rectangular
├── polygonal
├── stepped
└── island boss
STEPS
├── through step
├── blind step
├── side step
└── compound step
GROOVES
├── internal
├── external
├── face groove
├── O-ring groove
├── snap-ring groove
└── retaining groove
BLENDS
├── fillet
├── chamfer
├── variable fillet
└── blended transition
FREEFORM
├── ruled surface
├── swept surface
├── sculpted surface
├── curved milling region
└── complex surface
9. But don't create 100 individual detectors
This is an important architectural point.
Instead create:
Primitive recognizers
Plane
Cylinder
Cone
Sphere
Torus
BSpline
Revolution
Extrusion
↓
Geometric relations
parallel
perpendicular
coaxial
concentric
tangent
concave
convex
coplanar
offset
intersecting
↓
Topological structures
closed cavity
open cavity
shaft
step
wall
floor
island
boundary
transition
↓
Manufacturing features
hole
pocket
slot
boss
groove
step
chamfer
fillet
etc.
This is much easier to maintain.
10. The next major missing layer: feature composition
This is probably the single most important addition.
Suppose the model has:
Cylinder
Cylinder
Cone
Plane
Cylinder
Your detectors may say:
hole
counterbore
countersink
But you need to understand:
               HOLE FEATURE
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
   Entry cone   Bore Ø10    Counterbore Ø16
So instead of treating every geometry as independent:
{
  "feature": "hole"
}
create:
{
  "feature_type": "hole",
  "subtype": "counterbored_through",
  "faces": [12, 13, 14, 15],
  "axis": [0,0,1],
  "diameters": [
    16,
    10
  ],
  "depths": [
    5,
    30
  ],
  "termination": "through"
}
That is much closer to a manufacturing semantic object.
11. Feature hierarchy
I strongly recommend adding:
Part
│
├── Feature
│   ├── Face set
│   ├── Geometry
│   ├── Dimensions
│   └── Manufacturing meaning
│
├── Feature
│
└── Feature
But also:
Feature
│
├── parent_feature
├── child_features
├── supporting_features
├── intersecting_features
└── modifying_features
Example:
Pocket
│
├── bottom fillet
├── wall fillets
├── chamfer
├── hole
└── boss island
This is critical when you eventually move into process planning and costing.
12. Feature interaction engine
This is another major missing component.
For every detected feature ask:
Does feature A intersect feature B?
Does A modify B?
Does A contain B?
Does A sit on B?
Does A interrupt B?
Does A share an axis with B?
Does A share a floor with B?
Does A belong to same machining direction?
Create relations:
CONTAINS
CONTAINED_BY
INTERSECTS
INTERRUPTS
COAXIAL_WITH
COPLANAR_WITH
ON_FACE_OF
MODIFIES
PATTERN_OF
CHILD_OF
This will dramatically improve complex parts.
13. Your ray casting should become much more powerful
Currently you use it primarily for:
through/blind
accessibility
floor exposure
Keep that.
But extend it into a general:
Visibility / Accessibility Engine
For every feature:
approach direction
tool axis
entry point
exit point
collision
occlusion
visibility
depth
Instead of only:
+X
-X
+Y
-Y
+Z
-Z
eventually test:
arbitrary vector d
and sample a cone of possible tool orientations.
Then you can derive:
feature accessible from Z
feature accessible from tilted Z
feature blocked by wall
feature requires 5-axis orientation
That becomes much more useful for manufacturing.
14. Add cross-sections
This is a very high-value geometric technique that your current architecture doesn't appear to exploit enough.
For complicated geometry:
B-Rep
 ↓
section plane
 ↓
2D profile
 ↓
profile topology
 ↓
feature interpretation
Generate sections:
XY
XZ
YZ
and adaptive sections around candidate features.
This can identify things like:
steps
pockets
grooves
undercuts
tapered regions
internal cavities
complex rotational features
Cross-sectional reasoning is particularly useful when face adjacency alone is ambiguous.
15. Add medial-axis / thickness analysis
You already have thin-wall analysis.
Extend this into:
local thickness field
Then identify:
thin wall
web
rib
sheet
membrane
deep cavity
narrow passage
undercut
This becomes important for DFM.
16. Add curvature analysis
Your current surface classification is mostly primitive-type based.
For B-spline/freeform surfaces, calculate:
Gaussian curvature
Mean curvature
Principal curvature K1
Principal curvature K2
Curvature directions
Then classify surfaces:
flat
cylindrical
spherical
toroidal
ruled
developable
freeform
high-curvature
low-curvature
This helps identify machining regions that are impossible to describe purely using primitive types.
17. Add surface UV-grid representation
This is where ML becomes very interesting.
Instead of only storing:
surface_type = CYLINDER
radius = 20
axis = ...
also generate:
UV samples:
u1 v1 → XYZ + normal + curvature
u2 v2 → XYZ + normal + curvature
...
This is the approach used by UV-Net.
UV-Net directly operates on B-Rep geometry, representing faces with 2D UV grids and edges with 1D grids, while using a face-adjacency graph for topology. (GitHub)
That makes UV-Net conceptually very compatible with your ShapeModel.
18. Open-source ML models I would seriously evaluate
Here is the important shortlist.
Tier 1 — highest priority
AAGNet
This is probably the first model I would investigate for your project.
It is explicitly designed for:
automatic machining feature recognition from B-Rep CAD
and supports:
semantic segmentation
instance segmentation
bottom-face segmentation
using geometric attributed adjacency graphs. (GitHub)
This is particularly interesting because your current engine already produces much of the required graph.
19. AAGNet architecture
Conceptually:
Your ShapeModel
       ↓
Geometric Attributed Adjacency Graph
       ↓
Input Encoder
       ↓
Graph Encoder
       ↓
Multi-task heads
       ├── semantic segmentation
       ├── instance segmentation
       └── bottom-face segmentation
This is much closer to what you need than using a generic computer-vision model.
20. BRepMFR
The newer BrepMFR is also highly relevant.
It converts the B-Rep into a graph where:
nodes = faces
edges = B-Rep edges / adjacency
and uses a Transformer/graph-attention architecture to learn machining-feature categories. It also uses transfer learning to improve performance on real CAD models. (GitHub)
This could be particularly useful for:
ambiguous candidate recognition
rather than replacing deterministic recognition.
21. Hierarchical CADNet
This is another excellent candidate.
It builds a hierarchy:
STL mesh
   ↓
mesh graph
   ↓
B-Rep adjacency graph
   ↓
hierarchical graph
   ↓
feature recognition
The published implementation includes variants using adjacency and edge convexity. (GitHub)
Useful when features are difficult to infer from a flat face graph.
22. CADNet
The original CADNet approach is simpler:
B-Rep
 ↓
face graph
 ↓
GNN
 ↓
face feature classification
It focuses on planar B-Rep machining feature recognition. (GitHub)
I would use it mainly as a baseline rather than your final architecture.
23. UV-Net
UV-Net is valuable for another reason.
It captures:
surface geometry
+
edge geometry
+
topology
rather than just primitive metadata. (GitHub)
This makes it particularly attractive for:
freeform surfaces
complex fillets
curved milling regions
non-analytic geometry
24. BRepNet
Autodesk's BRepNet is also worth studying.
Its representation combines:
face grids
edge grids
coedge grids
primitive features
and learns embeddings directly from B-Rep structure. (GitHub)
This is useful if your eventual goal is:
recognize features that cannot be cleanly captured with hand-written geometric rules.
25. Open-source datasets
This is critical.
You should not start training your own model from zero.
Use existing datasets for initial experiments.
MFCAD
Contains labelled CAD models with machining feature categories. (GitHub)
The dataset contains 16 feature categories including:
through slots
passages
steps
blind slots
pockets
chamfer
stock
according to the published repository. (GitHub)
26. MFCAD++
Even more interesting.
MFCAD++ contains B-Rep CAD models stored as STEP files with machining-feature labels on B-Rep faces. The models were automatically generated using PythonOCC. (Queen's University Belfast)
This is almost ideal for your environment.
27. MFInstSeg
This is particularly interesting for your target.
AAGNet reports using:
MFCAD
MFCAD++
MFInstSeg
and describes MFInstSeg as containing over 60,000 STEP files with machining-feature instance labels. (GitHub)
Instance segmentation is exactly what you need to move beyond:
"these faces look like a pocket"
toward:
Pocket #3 =
    faces 15,16,17,18
28. Python libraries I would build around
Your stack should become something like this.
Core CAD
1. pythonocc-core
Primary OCCT Python binding.
It exposes a very large portion of OCCT's C++ API and supports STEP/IGES and other CAD formats. Current public release is 7.9.3. (GitHub)
Keep this.
2. OCP
Alternative Python binding around OCCT.
Useful if your project is already using:
from OCP...
I would standardize on one binding internally rather than mixing OCP and pythonocc everywhere.
3. FreeCAD
Not necessary as your kernel.
But extremely useful as a:
reference implementation
debugging environment
visualization environment
geometry generation environment
FreeCAD's Part/PartDesign objects are built around topological shapes and can interface with OCCT/PythonOCC.
29. OCC utilities
Look at:
pythonocc-utils
occwl
occwl is particularly relevant because AAGNet itself uses it in its environment. (GitHub)
It provides convenient B-Rep processing/representation functionality for ML pipelines.
30. Graph libraries
For your ML layer:
PyTorch
Base deep-learning framework.
PyTorch Geometric
Very useful for:
Face graph
Edge graph
Feature graph
GNN
Graph attention
Graph transformer
DGL
Also relevant because several CAD research implementations use it.
UV-Net, for example, uses graph-based representations and its implementation uses DGL. (GitHub)
AAGNet also uses DGL. (GitHub)
I would choose PyTorch + PyTorch Geometric for a new implementation unless a model you adopt is tightly coupled to DGL.
31. Scientific geometry stack
Use:
numpy
scipy
scikit-learn
for:
clustering
PCA
nearest-neighbor searches
geometric fitting
dimensionality reduction
statistical feature validation
32. Mesh layer
Add:
trimesh
pyvista
vtk
for:
B-Rep → mesh
cross sections
visualization
mesh-based ML
distance fields
ray analysis
But keep the B-Rep as the authoritative representation.
Do not convert everything permanently to STL.
33. Geometry processing layer
Potentially add:
Open3D
CGAL bindings
libigl bindings
but only where they provide something OCCT doesn't.
I would not introduce them immediately.
Your core should remain:
OCCT
because dimensional accuracy matters for manufacturing.
34. The most important thing: don't let ML replace geometry
I would explicitly avoid:
STEP
 ↓
STL
 ↓
PointNet
 ↓
"probably pocket"
for your application.
Instead:
STEP
 ↓
OCCT
 ↓
exact B-Rep
 ↓
deterministic geometric facts
 ↓
ML
 ↓
candidate interpretation
 ↓
exact OCCT verification
This is far safer.
35. The architecture I recommend
I would create these modules.
app/machining/
│
├── kernel/
│   ├── parser.py
│   ├── topology.py
│   ├── geometry.py
│   ├── tessellation.py
│   └── healing.py
│
├── representation/
│   ├── shape_model.py
│   ├── face_features.py
│   ├── edge_features.py
│   ├── adjacency_graph.py
│   ├── geometric_graph.py
│   └── uv_representation.py
│
├── geometric/
│   ├── primitives.py
│   ├── curvature.py
│   ├── convexity.py
│   ├── intersections.py
│   ├── sections.py
│   ├── thickness.py
│   └── visibility.py
│
├── recognition/
│   ├── holes.py
│   ├── pockets.py
│   ├── slots.py
│   ├── bosses.py
│   ├── grooves.py
│   ├── steps.py
│   ├── blends.py
│   ├── threads.py
│   ├── patterns.py
│   └── freeform.py
│
├── composition/
│   ├── feature_builder.py
│   ├── feature_hierarchy.py
│   ├── feature_relations.py
│   ├── feature_interactions.py
│   └── conflict_resolution.py
│
├── ml/
│   ├── dataset.py
│   ├── graph_builder.py
│   ├── embeddings.py
│   ├── inference.py
│   ├── models/
│   │   ├── cadnet/
│   │   ├── uvnet/
│   │   ├── brepnet/
│   │   ├── hierarchical_cadnet/
│   │   └── aagnet/
│   └── training/
│
├── verification/
│   ├── geometry_verifier.py
│   ├── topology_verifier.py
│   ├── feature_verifier.py
│   └── confidence.py
│
└── output/
    ├── feature_graph.py
    └── manufacturing_features.py
36. The recognition process should become candidate-based
This is the biggest change I would make to your current detector architecture.
Instead of:
detect_hole()
returning immediately:
HOLE
make it return:
HoleCandidate
For example:
{
  "candidate_id": "HC_024",
  "type": "hole",
  "faces": [14,15,16],
  "axis": [0,0,1],
  "diameter": 10,
  "depth": 25,
  "signals": {
    "cylindrical_wall": 1.0,
    "coaxial": 1.0,
    "concave": 1.0,
    "ray_cast": 0.95,
    "termination": 0.9
  }
}
Then another candidate:
COUNTERBORE
Then:
Feature Composer
decides:
COUNTERBORED_THROUGH_HOLE
37. ML should operate at the candidate layer
This is where I think your project can become significantly better than a simple research implementation.
Example:
Rule engine
     ↓
Candidate pool
C1 = pocket
C2 = slot
C3 = step
C4 = pocket + island
C5 = irregular pocket
ML:
C1 confidence = 0.82
C2 confidence = 0.12
C3 confidence = 0.09
C4 confidence = 0.91
Then geometric verification:
C4 → verified
Final:
POCKET_WITH_ISLAND
This is a hybrid symbolic + learned system.
That is what I would pursue.
38. Introduce "face ownership"
This is extremely important.
Every face should eventually have:
{
  "face_id": 42,
  "feature_instances": [
    "POCKET_03"
  ],
  "role": "BOTTOM_FACE"
}
Possible roles:
BOTTOM
WALL
SIDE_WALL
ENTRY
EXIT
CAP
TRANSITION
FILLET
CHAMFER
ISLAND
PROFILE
SUPPORT
Then your model can represent:
POCKET_03
├── bottom face
├── wall 1
├── wall 2
├── wall 3
├── wall 4
└── corner fillets
This is a major step toward manufacturing intelligence.
39. Add a manufacturing feature ontology
Don't use only:
hole
pocket
slot
boss
Use:
Feature
│
├── type
├── subtype
├── geometry
├── dimensions
├── orientation
├── accessibility
├── tolerance
├── surface_finish
├── parent
├── children
├── machining_faces
├── entry_faces
├── bottom_faces
├── wall_faces
└── modification_faces
Eventually:
Hole
├── diameter
├── depth
├── through/blind
├── bottom_type
├── counterbore
├── countersink
├── thread
├── pattern
├── access_direction
└── likely_process
That is what downstream CNC planning will need.
40. Your current PMI layer becomes much more important
You already extract PMI.
Extend it into:
Geometry
+
PMI
+
Feature recognition
For example:
Geometry:
Ø10 cylindrical cavity
PMI:
M12 × 1.5
Final:
Threaded hole
M12 × 1.5
This avoids the dangerous approach of guessing thread designation from diameter.
Your current design principle:
"6.8 mm hole is not automatically M8"
is exactly right.
Keep that principle.
41. What ML should NOT determine
I would never allow the ML model to directly decide:
diameter = 10.000
depth = 25.000
The model can say:
"This collection of faces probably represents a blind hole."
OCCT should calculate:
diameter = 10.000
depth = 25.000
axis = ...
So:
ML = semantic interpretation
OCCT = geometric truth
This separation is extremely important.
42. Open-source stack I would select
If I were building your V2 today, my preferred stack would be:
CAD kernel
──────────
OpenCASCADE
    │
    └── pythonocc-core / OCP
Geometry
────────
numpy
scipy
scikit-learn
B-Rep processing
────────────────
occwl
Graph ML
────────
PyTorch
PyTorch Geometric
Alternative
───────────
DGL
Visualization
─────────────
PyVista
VTK
trimesh
ML models to evaluate
─────────────────────
AAGNet          ← first
BrepMFR         ← second
UV-Net          ← freeform geometry
BRepNet         ← B-Rep representation
Hierarchical CADNet
CADNet          ← baseline
Datasets
────────
MFCAD
MFCAD++
MFInstSeg
43. Priority order I recommend
Do not implement all of these simultaneously.
I would do this:
Phase 1 — strengthen geometry
ShapeModel
   ↓
edge convexity
dihedral angles
curvature
cross sections
visibility
thickness
Phase 2 — feature composition
candidate generation
        ↓
feature composition
        ↓
feature hierarchy
        ↓
feature interaction
Phase 3 — semantic segmentation
Implement:
AAGNet
against:
MFCAD
MFCAD++
MFInstSeg
Phase 4 — hybrid inference
Rules
 +
AAGNet
 +
BRepMFR
        ↓
candidate ranking
        ↓
OCCT verification
Phase 5 — advanced geometry
UV-Net / BRepNet
        ↓
freeform / complex features
Phase 6 — manufacturing semantics
recognized feature
        ↓
machining direction
        ↓
tool accessibility
        ↓
operation candidate
        ↓
tool candidate
        ↓
process
        ↓
cost
44. One very important distinction
You said:
"feature extraction equal to CADExSoft"
I would separate this into two targets.
Target A — geometric recognition
You can realistically build a very strong open-source implementation.
holes
pockets
slots
bosses
grooves
steps
fillets
chamfers
threads
patterns
freeform machining regions
Target B — exact CADEx behavior
You cannot guarantee that without access to CAD Exchanger's proprietary implementation and test corpus.
CAD Exchanger also has broader functionality around analytical NURBS recognition, healing, measurements, PMI and manufacturing automation. (CAD Exchanger)
So the correct engineering objective should be:
CADEx-level manufacturing feature coverage, not "clone CADEx's algorithm."
That is achievable as a long-term target.
45. The architecture I would ultimately aim for
                         STEP / IGES
                             │
                             ▼
                    ┌─────────────────┐
                    │   OCCT Kernel   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   ShapeModel    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Geometry         Topology        PMI
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                  Geometric Feature Graph
                             │
             ┌───────────────┼────────────────┐
             ▼               ▼                ▼
       Rule Engine       ML Recognition    Cross-section
             │               │                │
             └───────────────┼────────────────┘
                             ▼
                    Candidate Feature Pool
                             │
                             ▼
                   Feature Composition
                             │
                             ▼
                  Feature Interaction Graph
                             │
                             ▼
                    Conflict Resolution
                             │
                             ▼
                     OCCT Verification
                             │
                             ▼
                    Final Feature Graph
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        Accessibility      Setup       Manufacturing
                                           semantics
That is the architecture I recommend rather than replacing your current implementation.
And importantly, your existing single OCCT traversal → ShapeModel → detectors architecture should remain the foundation. The open-source research implementations reinforce that B-Rep face/edge graphs are the right representation for the ML layer: CADNet uses face graphs, UV-Net uses face/edge geometry plus adjacency, Hierarchical CADNet adds hierarchy, and AAGNet adds geometric/topological attributes and instance segmentation. (GitHub)
My strongest recommendation
If we are going to develop this seriously, I would make AAGNet + your existing ShapeModel the first V2 ML experiment, not start with a generic neural network.
Your current output already contains many of the ingredients AAGNet wants:
faces
edges
face adjacency
surface type
geometry
convexity/concavity
topology
So we can build an adapter:
Current ShapeModel
       ↓
AAG/gAAG representation
       ↓
pretrained/retrained AAGNet
       ↓
face semantic labels
       ↓
instance grouping
       ↓
your deterministic geometric verification
       ↓
final manufacturing feature JSON
That gives us a practical path to move from your current rule engine toward much broader feature recognition without destabilizing the existing implementation.
CNC Machining Feature Recognition - MTK
 