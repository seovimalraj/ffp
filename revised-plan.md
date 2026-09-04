# V2 Manufacturing Feature Recognition — Concrete Implementation Spec

Status: Draft implementation spec, supersedes `plan.md` and the near-term portion of `plan2.md`.
Scope: `apps/cad-service` only.

This document replaces the abstract versions in `plan.md` and `plan2.md` with something
tied to the actual files in this repo. Read this before either of those; they're kept
for background reasoning but this is the one to hand to an implementer.

---

## 0. What V1 actually is (verified against the repo)

V1 = `apps/cad-service/app/machining/`, serving `POST /api/v1/cad/analyze-machining`
(`app/api/v1/machining.py` → `service.py:MachiningAnalysisService.analyze`). Pipeline,
per `service.py`'s own docstring:

```
file validation → import (parser.py) → shape validation → topology (topology.py)
→ geometry → face classification (faces.py) → holes → pockets → slots → bosses
→ fillets → chamfers → threads (detectors/*.py) → patterns (patterns.py)
→ ratios/flags → tool constraints (constraints.py) → accessibility (accessibility.py)
→ setups → stock (stock.py) → indicators (complexity.py) → PMI (pmi.py) → response
```

It is **not** the `app/core/` + `app/extractors/` + `dfm_analyzer.py` stack — that's an
unrelated sheet-metal DFM analyzer with its own ML classifier (`app/core/ml_classifier.py`,
a synthetic-data-trained `GradientBoostingClassifier`). Do not touch either the DFM stack or
V1 during this work.

**V1 is already substantially built to the standard both prior planning docs asked for:**

| Already exists in V1 | File | Notes |
|---|---|---|
| Single B-Rep traversal → kernel-independent model | `records.py`, `topology.py` | `ShapeModel` with `FaceRecord`/`EdgeRecord`/`VertexRecord` |
| Concavity resolved once, reused everywhere | `faces.py` | `FaceRecord.is_internal` |
| Face adjacency graph | `records.py` (`ShapeModel.face_neighbors`, `.shared_edges`) | not yet *attributed* — see §2 |
| Centralized tolerances, no magic numbers | `config.py` | `MachiningConfig`, ~80 fields, JSON/env override |
| Confidence + evidence per feature | `schemas.py` (`Detection`) | evidence is a string list, not a numeric breakdown |
| Within-feature composition | `detectors/holes.py` | a hole's `subtype` is already `through\|blind\|counterbore\|countersink\|stepped` — cone+cylinder+cylinder faces are already fused into one `HoleFeature` |
| Repeated-feature grouping | `patterns.py` | linear/circular/rectangular |
| Ray-cast accessibility | `raycast.py`, `accessibility.py` | 6 principal directions only, by design |
| Golden-style tests without binary fixtures | `tests/machining/fixtures.py` | builds STEP files procedurally at test time with `pythonocc`/`OCP` primitives — reuse this pattern, not committed `.step` blobs |

**What's genuinely missing** (this is where V2 earns its keep):

1. No *attributed* topology graph as an explicit structure — adjacency exists, but not as
   queryable typed relationships (COAXIAL, TANGENT, PARALLEL, dihedral angle) between
   feature-level entities.
2. No cross-feature-type composition or hierarchy — `HoleFeature` already composes
   *within* a hole, but nothing composes e.g. "this pocket has a boss island in it" or
   "this hole sits inside that pocket floor."
3. No feature-interaction relations (CONTAINS, INTERSECTS, MODIFIES, PATTERN_OF, …).
4. No coverage/diagnostics reporting ("68/73 faces classified, here's why the other 5 weren't").
5. No V1-vs-V2 comparison tooling.
6. No numeric score breakdown (only a string evidence list) — can't debug *why* confidence
   was 0.6 vs 0.9.
7. No curvature (Gaussian/mean/principal) or per-edge dihedral-angle/convexity fields —
   `FaceRecord`/`EdgeRecord` don't carry them today.
8. No turning/lathe axis concept anywhere — see §9 for why this is conditional, not assumed.

---

## 1. Isolation rule (non-negotiable)

- Do not edit, rename, or restructure anything under `app/machining/`.
- Do not edit `app/core/`, `app/extractors/`, `dfm_analyzer.py`.
- V2 lives entirely under a new `app/v2/` package plus one new router file.
- V2 reads `ShapeModel` and `FeatureCollection` — the already-computed outputs of V1 —
  read-only. **It must not open the CAD file or touch OCCT a second time.** V1's
  `MachiningAnalysisService.analyze()` already did the one expensive traversal; V2's job
  starts after that, in memory, in the same process.
- If a V2 module finds it needs geometry V1 didn't already compute (e.g. dihedral angle),
  it computes that from the *already-open* OCCT face handles cached on
  `ShapeModel._occ_faces` (present when a real kernel produced the model) — it does not
  re-import or re-parse the file.

This directly fixes the contradiction in the original `plan.md` draft (which proposed a
`v2/extraction/*` that re-walked OCC) and in `plan2.md` §35 (which proposed restructuring
`app/machining/` itself into `kernel/`, `representation/`, `recognition/`, …). Neither
happens here.

---

## 2. What V2 does *not* do

This matters as much as what it does:

- **It does not re-implement hole/pocket/slot/groove/boss/fillet/chamfer/thread
  primitive detection.** V1's detectors are rated 🟢/🟡 in `plan2.md`'s own review and
  the code backs that up (§0 table above). Re-deriving `OD_GROOVE`/`BORE`/`HOLE`
  candidates from scratch, as `plan.md`'s original §11 proposed, would duplicate working
  code and risk disagreeing with it. Instead V2 **wraps V1's `FeatureCollection` as its
  candidate input** (§5.3) and adds genuinely new candidate types V1 doesn't produce
  (composite/interaction candidates).
- **No ML/GNN component in this phase.** `plan2.md`'s AAGNet/BRepMFR/UV-Net track is a
  legitimate later direction but is a separate, much larger commitment (training pipeline,
  PyTorch/DGL dependency, external datasets MFCAD/MFCAD++/MFInstSeg that contain none of
  this company's actual parts). It is explicitly out of scope here — see §11.
- **No turning/lathe-axis detection unless confirmed in scope.** See §9.
- No cost, machine, tool, or process-planning output — same boundary V1 already holds
  (`schemas.py` docstring: "deliberately free of anything cost-, machine-, or
  price-related").

---

## 3. Architecture

```
                V1 (unchanged)
                     │
    MachiningAnalysisResponse (ShapeModel in memory + FeatureCollection)
                     │
                     ▼
        ┌── app/v2/facts ──────────────┐   read-only over ShapeModel;
        │  FaceFact / EdgeFact         │   adds curvature, dihedral angle,
        │  (extends, not replaces,     │   convexity per-edge
        │   FaceRecord / EdgeRecord)   │
        └───────────────┬─────────────┘
                         ▼
        ┌── app/v2/topology ───────────┐   attributed adjacency graph:
        │  AttributedAdjacencyGraph    │   typed relations + confidence
        └───────────────┬─────────────┘
                         ▼
        ┌── app/v2/candidates ─────────┐   V1's FeatureCollection entries
        │  wrap_v1_features()          │   become FeatureCandidates (1:1,
        │  + new interaction candidates│   high confidence) + new
        │                              │   composite/interaction candidates
        └───────────────┬─────────────┘   V2 actually has to derive
                         ▼
        ┌── app/v2/composition ────────┐   hierarchy + interaction relations
        │  FeatureComposer             │   (CONTAINS, MODIFIES, ON_FACE_OF, …)
        └───────────────┬─────────────┘
                         ▼
        ┌── app/v2/validation ─────────┐   coverage %, unknown-face report,
        │  coverage.py, v1_v2_compare  │   V1 vs V2 diff (MATCH/NEWLY_FOUND/…)
        └───────────────┬─────────────┘
                         ▼
              app/v2/schema/v2_schema.py
              (canonical output, see §7)
```

---

## 4. Directory structure

```
apps/cad-service/app/v2/
│
├── __init__.py
├── config.py                    # V2Tolerances (Pydantic, separate from MachiningConfig)
│
├── facts/
│   ├── __init__.py
│   ├── shape_adapter.py         # ShapeModel -> V2FactModel, no re-traversal
│   ├── face_facts.py            # FaceFact: curvature, accessibility roles
│   └── edge_facts.py            # EdgeFact: dihedral angle, convexity, tangency
│
├── topology/
│   ├── __init__.py
│   ├── graph.py                 # AttributedAdjacencyGraph
│   └── relationships.py         # RelationType enum + classifiers
│
├── candidates/
│   ├── __init__.py
│   ├── candidate.py             # FeatureCandidate dataclass
│   ├── from_v1.py                # wrap_v1_features(FeatureCollection) -> List[FeatureCandidate]
│   └── interaction_candidates.py # net-new: island-in-pocket, hole-in-pocket-floor, etc.
│
├── composition/
│   ├── __init__.py
│   ├── hierarchy.py             # parent/child assembly
│   ├── interactions.py          # CONTAINS / INTERSECTS / MODIFIES / ON_FACE_OF / PATTERN_OF
│   └── feature_composer.py      # orchestrates hierarchy + interactions
│
├── validation/
│   ├── __init__.py
│   ├── coverage.py              # per-face classification coverage
│   ├── diagnostics.py           # unknown-face reasons
│   └── v1_v2_compare.py         # MATCH / NEWLY_FOUND / RECLASSIFIED / MERGED / DECOMPOSED
│
├── schema/
│   ├── __init__.py
│   └── v2_schema.py             # Pydantic canonical output (§7)
│
└── pipeline/
    ├── __init__.py
    └── analyzer_v2.py           # orchestration entry point (§8)

apps/cad-service/app/api/v2/
├── __init__.py
└── machining.py                 # POST /api/v2/cad/analyze-machining-features

apps/cad-service/tests/v2/
├── conftest.py                  # mirrors tests/machining/conftest.py
├── fixtures.py                  # mirrors tests/machining/fixtures.py — procedural STEP, not blobs
├── golden/
│   └── expected/*.json          # expected V2 features per fixture (§10)
├── test_facts.py
├── test_topology_graph.py
├── test_candidates.py
├── test_composition.py
├── test_validation.py
└── test_v1_v2_compare.py
```

---

## 5. Layer specs

### 5.1 Facts layer — extend, don't duplicate

`app/v2/facts/shape_adapter.py` takes the `ShapeModel` V1 already built and produces a
parallel, read-only `V2FactModel` that adds exactly the fields V1 doesn't have. It does
not copy fields V1 already has — it references them.

```python
# app/v2/facts/face_facts.py
@dataclass(frozen=True)
class FaceFact:
    face_id: int                          # == FaceRecord.id, join key, nothing else
    gaussian_curvature: Optional[float]    # sampled at centroid; None for PLANE
    mean_curvature: Optional[float]
    principal_k1: Optional[float]
    principal_k2: Optional[float]
    curvature_class: str                   # FLAT | CYLINDRICAL | SPHERICAL | DOUBLY_CURVED | RULED | FREEFORM
    accessible_from: FrozenSet[str]        # subset of {"+X","-X","+Y","-Y","+Z","-Z"} — reuses
                                            # AccessibilityAnalyzer's existing ray probe, run once
                                            # per face centroid+normal, not reinvented
```

```python
# app/v2/facts/edge_facts.py
@dataclass(frozen=True)
class EdgeFact:
    edge_id: int                           # == EdgeRecord.id
    dihedral_angle_deg: Optional[float]    # angle between the two adjacent face normals
    convexity: str                         # CONVEX | CONCAVE | TANGENT | SMOOTH | UNKNOWN
    face_pair: Tuple[int, int]
```

Computation source: for a real kernel run, `ShapeModel._occ_faces[face_id]` already holds
the live OCCT face handle — curvature and dihedral angle are computed from that handle
directly (`BRepAdaptor_Surface` / `BRepLProp_SLProps`, or the `OCP` equivalents, matching
whichever binding `occ.py` resolved to — see `app/machining/occ.py` for the existing
binding-selection pattern to mirror). No file is reopened, no second `STEPControl_Reader`
runs. When the model came from a synthetic/no-kernel `ShapeModel` (as some V1 unit tests
build directly), `FaceFact`/`EdgeFact` degrade to `None`/`UNKNOWN` rather than raising.

`accessible_from` explicitly reuses `AccessibilityAnalyzer`'s ray-cast machinery
(`app/machining/raycast.py:RayProbe`) rather than rebuilding ray casting — construct one
`RayProbe` per analysis run and query it per face centroid.

### 5.2 Attributed adjacency graph

```python
# app/v2/topology/relationships.py
class RelationType(str, Enum):
    SHARED_EDGE = "SHARED_EDGE"
    COAXIAL = "COAXIAL"
    CONCENTRIC = "CONCENTRIC"
    COPLANAR = "COPLANAR"
    PARALLEL = "PARALLEL"
    PERPENDICULAR = "PERPENDICULAR"
    TANGENT = "TANGENT"
    CONVEX = "CONVEX"       # from EdgeFact.convexity at the shared edge
    CONCAVE = "CONCAVE"

@dataclass(frozen=True)
class FaceRelation:
    face_a: int
    face_b: int
    relation: RelationType
    confidence: float
    via_edge_ids: Tuple[int, ...] = ()
```

`AttributedAdjacencyGraph.build(shape_model, face_facts, edge_facts, config)` iterates
`ShapeModel.face_neighbors` (already computed — not rebuilt) and classifies each pair
using the same geometric primitives V1's `detectors/shared.py` already has
(`is_parallel`, `is_perpendicular`, `is_tangent_across` in `detectors/shared.py` — call
these directly rather than re-implementing parallelism/perpendicularity checks).

### 5.3 Candidates — wrap V1, don't re-derive it

```python
# app/v2/candidates/candidate.py
@dataclass
class FeatureCandidate:
    candidate_id: str
    feature_type: str              # e.g. "hole", "pocket", "boss", or a new composite type
    source_faces: Tuple[int, ...]
    source: str                    # "v1_detection" | "v2_interaction"
    v1_feature_id: Optional[str]   # set when source == "v1_detection"
    geometry: Dict[str, Any]
    signals: Dict[str, float]      # named partial scores, see §5.4 scoring
    confidence: float
```

```python
# app/v2/candidates/from_v1.py
def wrap_v1_features(collection: FeatureCollection) -> List[FeatureCandidate]:
    """Every V1 Detection becomes one FeatureCandidate at its V1 confidence.
    This is not re-recognition — it's carrying V1's already-good answer forward
    so the composition layer (§5.4) can reason about it alongside candidates
    V1 doesn't produce."""
```

`interaction_candidates.py` is where V2 does genuinely new derivation — but only for
things V1's `FeatureCollection` cannot express because it's a flat list of independent
feature types with no relation to each other:

- a `BossFeature` whose faces sit entirely inside a `PocketFeature`'s floor bounding
  region → `POCKET_WITH_ISLAND` candidate
- a `HoleFeature` whose entry face equals a `PocketFeature`'s floor face → `HOLE_IN_POCKET_FLOOR`
- a `GrooveFeature` adjacent to a diameter step with no groove between → flag for review
  (this is the kind of thing plan.md §21 called "negative evidence")

### 5.4 Composition, hierarchy, interaction

```python
# app/v2/composition/interactions.py
class InteractionType(str, Enum):
    CONTAINS = "CONTAINS"
    CONTAINED_BY = "CONTAINED_BY"
    INTERSECTS = "INTERSECTS"
    ON_FACE_OF = "ON_FACE_OF"
    MODIFIES = "MODIFIES"
    PATTERN_OF = "PATTERN_OF"      # links to patterns.py's FeaturePattern, not a new pattern detector
    CHILD_OF = "CHILD_OF"
```

`PATTERN_OF` deliberately delegates to V1's existing `patterns.py:PatternDetector` output
(`FeaturePattern`) rather than re-implementing pattern detection — V2 only needs to attach
the relation, not re-derive linear/circular/rectangular grouping logic that already works.

Numeric score breakdown (fixing plan.md §20's request, which V1's string-only `evidence`
list doesn't support):

```python
# app/v2/schema/v2_schema.py (excerpt)
class ScoreBreakdown(BaseModel):
    signal: str
    weight: float
    contribution: float

class CanonicalFeature(BaseModel):
    feature_id: str
    feature_type: str
    status: str                        # CONFIRMED | AMBIGUOUS | REJECTED
    source_faces: List[int]
    source_edges: List[int]
    v1_feature_id: Optional[str]       # traceability back to V1, when applicable
    geometry: Dict[str, Any]
    parameters: Dict[str, Any]
    parent_id: Optional[str] = None
    child_ids: List[str] = Field(default_factory=list)
    interactions: List[Dict[str, Any]] = Field(default_factory=list)  # {type, target_id}
    confidence: float
    score_breakdown: List[ScoreBreakdown]
    evidence: List[str]                # kept for continuity with V1's Detection.evidence
```

### 5.5 Validation

```python
# app/v2/validation/coverage.py
class CoverageReport(BaseModel):
    total_faces: int
    manufacturing_classified: int
    supporting_geometry: int
    unknown: int
    coverage_percent: float
    unknown_faces: List[UnknownFaceEntry]   # {face_id, surface_type, reason}
```

```python
# app/v2/validation/v1_v2_compare.py
class ComparisonEntry(BaseModel):
    feature_type: str
    v1_feature_id: Optional[str]
    v2_feature_id: Optional[str]
    status: str   # MATCH | MISSED | NEWLY_FOUND | RECLASSIFIED | DECOMPOSED | MERGED
```

This directly answers plan.md §29 but grounded in the real V1 output shape
(`FeatureCollection`), not an abstract "V1 JSON."

---

## 6. Config: `V2Tolerances`, not a `MachiningConfig` edit

```python
# app/v2/config.py
class V2Tolerances(BaseModel):
    dihedral_tangent_deg: float = 2.0
    dihedral_sharp_deg: float = 150.0
    curvature_flat_threshold: float = 1e-4     # 1/mm, below which a surface reads FLAT
    interaction_containment_margin_mm: float = 0.5
    model_config = {"frozen": True, "extra": "forbid"}
```

New tolerances live here, never as edits to `app/machining/config.py:MachiningConfig`.
Where V2 needs an existing V1 threshold (e.g. `coaxial_tolerance_mm` for the COAXIAL
relation), it takes a `MachiningConfig` instance as a constructor argument and reads it —
it does not duplicate the value.

---

## 7. Entry points

This repo's actual convention (see `app/api/v1/machining.py`, `app/routers/analyze.py`)
is a FastAPI router per version, not a CLI. Match that instead of inventing a
`python -m v2.pipeline.analyzer_v2 input.step` CLI as the primary interface:

- **Primary:** `app/api/v2/machining.py` → `POST /api/v2/cad/analyze-machining-features`,
  thin controller exactly like `app/api/v1/machining.py`, calling
  `app/v2/pipeline/analyzer_v2.py:analyze_v2(loaded_model_or_v1_response, options)`.
  It runs *after* `analyze_machining()` from V1 in the same request — reusing the
  `ShapeModel` V1 already built, not re-uploading/re-parsing the file — or accepts an
  already-computed V1 response for a two-step flow (analyze once with V1, then upgrade
  in-process to V2 without touching the file again).
- **Secondary, for local dev/debugging and golden tests:** a thin script,
  `app/v2/pipeline/analyzer_v2.py` also exposes a `if __name__ == "__main__":` block so
  `python -m app.v2.pipeline.analyzer_v2 input.step [--debug] [--export-json out.json]`
  works for the golden-model test harness and manual inspection, per-file outputs matching
  plan.md §38 (`geometric_facts.json`, `topology_graph.json`, `feature_candidates.json`,
  `recognized_features.json`, `diagnostics.json`) written under `output/` when `--debug` is
  passed.

Do not change `app/api/v1/machining.py` or its route.

---

## 8. Golden test strategy — match `tests/machining/fixtures.py`, don't invent a new one

`plan.md` §32 proposed a `tests/v2/golden_models/` tree of named STEP files. This repo
already solved that problem differently and better: `tests/machining/fixtures.py` builds
STEP files procedurally with `BRepPrimAPI`/`BRepAlgoAPI`/`BRepFilletAPI` at test time
(`_box`, and similar builders), so fixture intent is readable in the test itself and
nothing binary is committed. **Reuse this exact pattern for V2**, don't commit `.step`
blobs:

```
tests/v2/fixtures.py     # imports/extends tests/machining/fixtures.py builders
tests/v2/golden/          # expected_features as inline Python dicts or small JSON,
                          # not paired binary CAD files
```

Minimum fixture set for Sprint 1–4 (mirroring plan.md §32 but only the subset V2 actually
needs to prove, since primitive detection is already covered by V1's own test suite in
`tests/machining/`):

1. stepped shaft with one external groove (proves facts + graph + candidate-wrap + coverage)
2. block with a pocket containing a boss island (proves interaction candidates + composition)
3. plate with a counterbored through-hole pattern (proves `PATTERN_OF` delegation to V1)
4. a face with no recognizable feature (proves `UNKNOWN` + coverage/diagnostics reporting)
5. `P0010092` (the real reference part), once 1–4 pass — first genuine end-to-end benchmark,
   as both prior docs already agreed.

Each fixture's test asserts, per plan.md §33: feature existence, type, dimensions, axis,
source faces, confidence ≥ threshold — plus, new to V2: coverage_percent, at least one
`InteractionType` relation where the fixture has one, and a clean `v1_v2_compare` diff
(`MATCH` for everything V1 already found, `NEWLY_FOUND` only for genuinely new composite
types).

---

## 9. Turning/lathe recognition — explicitly conditional, not Sprint 1

`plan.md`'s original §14 made this priority #1. Flagging again because it's a real
scope decision, not a nitpick: **nothing in `app/machining/` has a turning-axis or
lathe concept today.** `detectors/grooves.py` already finds external/internal grooves
generically (radius vs. axial neighbors), with no notion of a turning axis. Building
`app/v2/coordinate/manufacturing_cs.py` + a rotational-profile turning engine is real,
unstarted work with no V1 foundation to build on — unlike holes/pockets/composition,
which extend something that already works.

**Decision needed from you before Sprint 4 (see §10): are turned/lathe parts actually in
scope for the near-term part population?** If yes, turning becomes its own sprint using
plan.md §14–16's rotational-profile design, additive to this spec. If unknown or no,
Sprint 4 should instead deepen milling composition (steps, shoulders, contour) — which
extends detectors that already exist (`detectors/pockets.py`, `detectors/slots.py`,
`detectors/bosses.py`) rather than starting a new subsystem from zero.

---

## 10. Concrete sprint plan

**Sprint 1 — Facts + graph + candidate wrap (foundation)**
- `app/v2/facts/` (`shape_adapter.py`, `face_facts.py`, `edge_facts.py`)
- `app/v2/topology/` (`AttributedAdjacencyGraph`, reusing `detectors/shared.py` geometry helpers)
- `app/v2/candidates/from_v1.py` (`wrap_v1_features`)
- `app/v2/config.py` (`V2Tolerances`)
- `tests/v2/fixtures.py`, `test_facts.py`, `test_topology_graph.py`, `test_candidates.py`
- Exit criterion: for fixture 1 (stepped shaft + groove), every V1 `Detection` round-trips
  into exactly one `FeatureCandidate` at V1's original confidence, and the graph reports
  COAXIAL between the groove floor and its neighbors.

**Sprint 2 — Interaction candidates + composition**
- `app/v2/candidates/interaction_candidates.py`
- `app/v2/composition/` (`hierarchy.py`, `interactions.py`, `feature_composer.py`)
- `tests/v2/test_composition.py` using fixture 2 (pocket + boss island)
- Exit criterion: fixture 2 produces a `POCKET_WITH_ISLAND` composite with correct
  `parent_id`/`child_ids` and a `CONTAINS` interaction relation.

**Sprint 3 — Validation + comparison + canonical schema**
- `app/v2/validation/` (`coverage.py`, `diagnostics.py`, `v1_v2_compare.py`)
- `app/v2/schema/v2_schema.py` (`CanonicalFeature`, `ScoreBreakdown`, `CoverageReport`)
- `tests/v2/test_validation.py`, `test_v1_v2_compare.py` using fixture 4 (unknown face)
- Exit criterion: fixture 4 reports `coverage_percent < 100` with a correct
  `UnknownFaceEntry` reason, and comparing V1-vs-V2 on fixtures 1–3 yields all `MATCH`
  plus the expected `NEWLY_FOUND` composites.

**Sprint 4 — Entry points + pattern delegation + decision point**
- `app/api/v2/machining.py`, `app/v2/pipeline/analyzer_v2.py` (both service-call and
  `__main__` CLI forms, §7)
- `PATTERN_OF` delegation to `patterns.py`, fixture 3 (counterbored hole pattern)
- **Turning/lathe scope decision made here** (§9) — branches the rest of the roadmap
- Exit criterion: `POST /api/v2/cad/analyze-machining-features` returns a full
  `CanonicalFeature` list for fixture 3 with `PATTERN_OF` relations correctly linking the
  repeated holes, without re-uploading/re-parsing the file.

**Sprint 5 — `P0010092` end-to-end benchmark + debug output**
- Debug JSON dump (`geometric_facts.json`, `topology_graph.json`,
  `feature_candidates.json`, `recognized_features.json`, `diagnostics.json`) per §7
- Run against `P0010092`, compare to whatever CADEx/V1 references already exist for it
- Exit criterion: V2 output for `P0010092` is manually reviewed against the known
  reference and coverage/comparison numbers are reported (not just "it produced JSON" —
  precision/recall against the reference, per plan.md §41)

Sprint 5+ (turning, if scoped in at Sprint 4) and the ML/GNN track (§11) are separate
follow-on documents, not part of this spec.

---

## 11. Explicitly deferred

- **Turning/lathe feature recognition** — conditional on §9's decision.
- **ML/GNN recognition** (`plan2.md` §17–33, §37, §42) — AAGNet-as-adapter-over-ShapeModel
  is the most promising specific idea in that document and worth a dedicated follow-up
  spec once Sprints 1–5 here are done and there's a real V2 candidate/composition layer
  for it to sit on top of (per `plan2.md`'s own phase 3+ framing). Do not start any
  PyTorch/DGL/dataset work inside this spec's sprints.
- **Cross-section-based reasoning, UV-grid sampling, medial-axis/thickness fields**
  (`plan2.md` §14–17) — legitimate future geometric-facts enrichments, but not required
  for Sprints 1–5's exit criteria above. Revisit if fixture 4/5 coverage gaps turn out to
  need them.

---

## 12. Acceptance criteria (rolled up from both prior docs, made concrete)

- [ ] Zero diffs in `app/machining/`, `app/core/`, `app/extractors/`, `dfm_analyzer.py`
- [ ] `pytest tests/machining/` still passes unchanged after every sprint
- [ ] V2 never opens the CAD file a second time — verified by a test that asserts
      `analyze_v2()` accepts a pre-built `ShapeModel`/`FeatureCollection` with no `file_path`
      argument
- [ ] Every `CanonicalFeature` has non-empty `source_faces` and, when derived from V1,
      a non-null `v1_feature_id`
- [ ] `score_breakdown` entries sum to `confidence` (±tolerance) for every candidate that
      went through scoring, not just a bare float
- [ ] Coverage report + unknown-face diagnostics present on every V2 response
- [ ] V1-vs-V2 comparison report present on every fixture in `tests/v2/golden/`
- [ ] `P0010092` end-to-end run completed and reviewed (Sprint 5)
