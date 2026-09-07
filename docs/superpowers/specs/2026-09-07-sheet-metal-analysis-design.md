# Sheet-Metal Analysis Endpoint — Design Spec

- **Status:** Approved for planning
- **Date:** 2026-09-07
- **Author:** Aakash-Frigate (via Claude Code)
- **Related:** `apps/cad-service/app/machining/` (CNC machining feature-recognition, the reference implementation this mirrors)

## 1. Summary

Add a new, standalone geometric feature-recognition endpoint for sheet-metal
parts, structurally parallel to the existing CNC `analyze-machining` endpoint
but detecting sheet-metal-specific features (thickness, bends, flanges,
holes/cutouts, hems, DFM distance checks) instead of milling/turning features
(pockets, bosses, threads). Flat-pattern unfolding is explicitly out of scope
for this iteration and will be specified separately once detection is
validated against real parts.

This is new subsystem work (new package, new route, new frontend page) run
alongside the existing machining pipeline — it does not modify
`app/machining/` or the legacy `/analyze` router used by instant-quote.

## 2. Goals / Non-Goals

**Goals**
- Given an uploaded STEP/IGES/BREP file, deterministically detect and report
  sheet-metal geometric features on the as-modeled solid.
- Match the machining endpoint's contract shape, error envelope, and
  degrade-per-stage behavior so the frontend and API consumers already
  familiar with `analyze-machining` can onboard quickly.
- Port and adapt proven detection logic already in the repo (legacy
  `app/core/bend_detection.py`, `app/core/advanced_thickness_detection.py`,
  `app/core/classification.py`) into the new package's style, rather than
  reinventing algorithms or coupling to the legacy pipeline.
- Provide DFM-oriented outputs (min feature size, hole-to-bend distance,
  hole-to-edge distance, min bend radius/thickness ratio) as flags, not
  scores — geometry and evidence only, consistent with the machining
  endpoint's "no cost/process/score" philosophy.

**Non-Goals (this iteration)**
- Flat-pattern unfolding, K-factor-based flattening, and DXF export of the
  unfolded blank — deferred to a follow-up spec.
- Cost, pricing, or machine/process selection — never in scope for this
  pipeline (matches machining's stance).
- Multi-body assembly analysis — single-solid sheet-metal parts only, same
  constraint the machining endpoint currently has.
- Replacing or modifying the legacy `/analyze` sheet-metal classification
  used by instant-quote/quote-config — that pipeline is untouched.

## 3. Architecture

### 3.1 Backend package: `apps/cad-service/app/sheet_metal/`

Mirrors `app/machining/`'s module layout and conventions (Pydantic schemas,
`_stage()`-wrapped orchestration in `service.py`, OCC-shim-only geometry
access, JSON+env-var config).

```
app/sheet_metal/
  __init__.py
  schemas.py                 # SheetMetalAnalysisResponse and all nested models
  config.py                  # loader: sheet_metal_config.json + SHEET_METAL_<FIELD> env overrides
  sheet_metal_config.json    # thresholds (see 3.4)
  service.py                 # analyze_sheet_metal() orchestrator
  faces.py                   # planar/cylindrical face classification, adapted from machining/faces.py
  topology.py                # thin re-export/adapter over machining/topology.py (no duplication of shared logic)
  distance_checks.py         # feature-to-edge / feature-to-bend / min-feature-size flags
  patterns.py                # repeated-feature grouping + symmetry detection, adapted from machining/patterns.py
  complexity.py              # deterministic counts only
  records.py, units.py, vectors.py, openapi.py   # re-exported from app/machining (no duplication; see 3.2)
  detectors/
    __init__.py
    sheet_candidate.py       # is-this-sheet-metal scoring, ported from core/classification.py
    thickness.py             # dominant thickness + uniformity, ported from core/advanced_thickness_detection.py
    base_flange.py           # base face + flange (flat segment) identification
    bends.py                 # bend zone detection: angle, radius, axis, bend line — ported from core/bend_detection.py
    bend_relief.py           # relief notch detection near bend intersections
    holes.py                 # circular through-hole detection, adapted from machining/detectors/holes.py
    cutouts.py               # non-circular pierced profile detection
    slots.py                 # adapted from machining/detectors/slots.py
    hems.py                  # folded-edge classification (open/closed/teardrop) — new
    profile.py                # outer profile perimeter + closed-loop validity
  examples/
    example_request.sh
    example_response.json
```

**Explicit reuse, not duplication:** `occ.py` (the OCC/OCP binding shim) and
`parser.py` (upload → temp file → sha256 → shape load) are used directly from
`app.machining.occ` and `app.machining.parser` via import — no forked copies.
Every other module listed with "adapted from" is a new file in
`app/sheet_metal/` written against the same OCC shim, using the legacy
`app/core/*` modules purely as an algorithmic reference (formulas, thresholds,
clustering approach), not as an import dependency. This keeps `app/sheet_metal/`
self-contained and decoupled from the legacy `/analyze` pipeline, while
avoiding a second maintained copy of the kernel shim and file-loading code.

### 3.2 Route

New file `apps/cad-service/app/api/v1/sheet_metal.py`, mounted at the same
`/api/v1/cad` prefix as machining (`app/main.py`), alongside the existing
router registration:

- `POST /api/v1/cad/analyze-sheet-metal` — multipart upload, identical form
  contract to machining: `file` (required), `unit_system` (metric|imperial,
  default metric), `include_face_details`, `include_feature_details`
  (default true), `include_debug_geometry`, `include_topology_entities`.
  Validates extension against `.step/.stp/.iges/.igs/.brep/.brp`, streams to
  disk, runs `analyze_sheet_metal()` in a threadpool, returns
  `SheetMetalAnalysisResponse` (200) or the shared error envelope
  (400/415/500/503), cleans up the temp file in `finally`.
- `GET /api/v1/cad/analyze-sheet-metal/capabilities` — same shape as
  machining's capabilities response: `{analysis_version, kernel_available,
  kernel, kernel_binding_importable, kernel_missing_symbols,
  kernel_import_failures, supported_input_formats, supported_extensions,
  max_upload_bytes, max_faces, unit_systems, thresholds, note}`.

### 3.3 Frontend

- `apps/web/types/sheet-metal-analysis.ts` — TypeScript mirror of the Pydantic
  schema (parallel to `machining-analysis.ts`).
- `apps/web/app/api/cad/analyze-sheet-metal/route.ts` — Next.js proxy route,
  same streaming-passthrough pattern as
  `apps/web/app/api/cad/analyze-machining/route.ts` (no buffering,
  `duplex: "half"`, 115s timeout, `maxDuration=120`, forwards to
  `${CAD_SERVICE_URL}/api/v1/cad/analyze-sheet-metal[/capabilities]`, normalizes
  failures into the same error envelope shape).
- `apps/web/app/cad/sheet-metal/page.tsx` — new page, same structure as
  `apps/web/app/cad/machining/page.tsx`: capability preflight on mount, file
  upload, `CadViewer` for the solid, status bar (face count,
  `complexity_indicators.feature_count_total`, duration,
  `sheet_metal_candidate.is_candidate`).
- `apps/web/app/cad/sheet-metal/components/analysis-panel.tsx` — mirrors
  `machining/components/analysis-panel.tsx`: model/topology counts,
  thickness section, bend list with per-bend detail on selection, hole/cutout/
  slot/hem lists, distance-check flags, feature patterns/symmetry, PMI,
  raw-JSON download link.
- `apps/web/app/cad/sheet-metal/lib/format.ts` — reused/copied small
  formatting helpers from the machining page's `lib/format.ts`.
- Navigation: add a "Sheet Metal" entry alongside the existing "Machining"
  entry wherever that's currently linked (to be located during
  implementation — likely a CAD tools nav/sidebar).

### 3.4 Config

New `apps/cad-service/app/sheet_metal/sheet_metal_config.json`, loaded by
`app/sheet_metal/config.py` using the same JSON-file + `SHEET_METAL_<FIELD>`
env-override pattern as `app/machining/config.py`. Initial thresholds:

- `min_sheet_thickness_mm` / `max_sheet_thickness_mm` (candidate gating;
  seed from legacy `SHEET_METAL_MIN_THICKNESS=0.4`, `SHEET_METAL_MAX_THICKNESS=6.0`)
- `min_bend_angle_deg` / `max_bend_angle_deg` (bend-zone clustering window;
  seed from legacy bend detector's 45–135° range, widened if needed during
  validation)
- `default_k_factor` (not used for unfolding yet, but recorded per bend as
  metadata for the future unfolding phase)
- `min_bend_radius_to_thickness_ratio` (DFM flag threshold)
- `min_feature_size_mm` (smallest allowed cut width, DFM flag threshold)
- `min_hole_to_edge_distance_mm`, `min_hole_to_bend_distance_mm` (DFM flag
  thresholds)
- `paired_face_area_fraction_threshold` (sheet-candidate evidence, reused
  concept from `stock_form.py`'s `sheet_evidence.paired_area_fraction`)

## 4. Response Schema

New `SheetMetalAnalysisResponse` in `app/sheet_metal/schemas.py`, following
the same envelope conventions as `MachiningAnalysisResponse`.

**Envelope (reused shape):** `success, analysis_version, kernel, units,
options{...}, analysis_duration_ms, warnings[{code,message,detail}],
errors[{code,message,detail}]`

**file** (reused verbatim): `filename, format, file_size_bytes, sha256`

**model** (reused verbatim): `solid_count, shell_count, face_count,
edge_count, vertex_count, wire_count, compound_count, is_valid,
has_open_shells, is_multi_body`

**topology** (reused verbatim): `faces_per_solid[], closed_shell_count,
open_shell_count, free_edge_count, seam_edge_count, max_faces_per_edge,
euler_characteristic`

**geometry** (reused verbatim): `bounding_box{...}, volume_mm3,
surface_area_mm2, center_of_mass, moments_of_inertia{...}, is_closed_volume,
source`

**sheet_metal_candidate:** `is_candidate (bool), confidence (0-1),
evidence{paired_area_fraction, flatness_ratio, dominant_thickness_mm,
method}, status(resolved/ambiguous/rejected), reason`

**thickness:** `dominant_thickness_mm, is_uniform (bool), variance_mm,
method, sample_count, note`

**faces:** `base_face_id, flange_faces[]{face_id, area_mm2, plane_normal,
adjacent_bend_ids[]}`

**bends[]** (BendFeature): `id, angle_deg, inner_radius_mm, bend_line{start,
end}, axis, length_mm, direction(up/down), sequence_hint(int, geometric
adjacency order — not a manufacturing sequence guarantee), k_factor_assumed,
bend_allowance_mm, bend_deduction_mm, adjacent_flange_ids[2], detection{method,
confidence, evidence, source}`

**bend_reliefs[]:** `id, bend_id, type(rectangular/round/none-detected),
width_mm, depth_mm, position, note`

**holes[]:** same shape family as machining's `HoleFeature` minus
depth/through-blind semantics (sheet holes are pierced, not bored):
`id, diameter_mm, position, shape(round/slotted), quantity,
distance_to_nearest_edge_mm, distance_to_nearest_bend_mm`

**cutouts[]:** `id, perimeter_mm, area_mm2, shape_type, min_feature_size_mm,
position, distance_to_nearest_edge_mm, distance_to_nearest_bend_mm`

**slots[]:** `id, length_mm, width_mm, corner_radius_mm, orientation,
position, distance_to_nearest_bend_mm`

**hems[]:** `id, type(open/closed/teardrop), length_mm, position,
adjacent_flange_id`

**outer_profile:** `perimeter_mm, is_closed (bool), validity_issues[]
{code, message, location}`

**distance_flags[]** (DFM checks, same style as machining's
`machining_flags`): `feature_id, feature_type,
flag(HOLE_TOO_CLOSE_TO_EDGE/HOLE_TOO_CLOSE_TO_BEND/BEND_RADIUS_TOO_TIGHT/
FEATURE_BELOW_MIN_SIZE/...), reason, threshold, value`

**feature_patterns[]** (reused shape from machining): `type, feature_type,
feature_count, feature_ids[], pattern_type(linear/circular/rectangular/
grouped), spacing_mm, axis, detection`

**symmetry:** `has_symmetry (bool), axis_or_plane, symmetry_type(mirror/
rotational/none), confidence, note`

**complexity_indicators:** `bend_count, unique_bend_angle_count,
unique_bend_radius_count, hole_count, cutout_count, slot_count, hem_count,
distinct_hole_diameter_count, minimum_bend_radius_mm,
minimum_feature_to_edge_distance_mm, minimum_feature_to_bend_distance_mm,
feature_count_total` — deterministic counts only, no derived
difficulty/cost score, matching machining's documented stance.

**pmi** (reused verbatim): `available, part_name, part_number, revision,
material, surface_finish, gdt[], datums[], annotations[], feature_names[],
raw[], source, note`

**debug_geometry** (opt-in, reused shape): `face_adjacency,
unclassified_face_ids, detector_timings_ms, kernel, detector_rejections
{face_id: reason}`

Not present (CNC-only, not applicable here): `surface_summary` (freeform/
conical/spherical face histogram is a milling concept), `stock_analysis`,
`accessibility`, `setup_analysis`, `machining_constraints`, `threads`,
`fillets`/`chamfers` (sheet-metal parts don't get milled fillets — bend
radius plays that role and is captured on the bend itself).

## 5. Pipeline / Data Flow

`app/sheet_metal/service.py`, function `analyze_sheet_metal()`, runs a fixed
deterministic stage order inside `_stage()` wrappers (one detector failing
degrades to a warning, not a failed request — same resilience model as
machining):

1. File validation + import (reuse `machining.parser.CADParser`)
2. Shape validation, topology (reuse `machining.topology` primitives)
3. Geometry (mass/inertia — reuse `machining` geometry helpers)
4. Face classification: planar vs cylindrical, paired-parallel-face detection
5. Sheet-metal-candidate scoring (`detectors/sheet_candidate.py`) — gate: if
   `is_candidate` is false/rejected, still return the response but with all
   sheet-metal-specific sections empty and a clear `reason` (mirrors how
   machining degrades on missing kernel — never a hard failure just because
   the part doesn't look like sheet metal)
6. Thickness detection (`detectors/thickness.py`)
7. Base/flange face detection (`detectors/base_flange.py`)
8. Bend detection (`detectors/bends.py`) — curvature clustering over
   cylindrical faces within the configured angle window
9. Bend relief detection (`detectors/bend_relief.py`)
10. Hole detection (`detectors/holes.py`)
11. Cutout detection (`detectors/cutouts.py`)
12. Slot detection (`detectors/slots.py`)
13. Hem detection (`detectors/hems.py`)
14. Outer profile extraction (`detectors/profile.py`)
15. Distance checks (`distance_checks.py`) — hole/cutout to edge, hole/cutout
    to bend, min feature size, min bend radius/thickness ratio
16. Pattern grouping + symmetry (`patterns.py`)
17. Complexity indicators (`complexity.py`)
18. PMI extraction (reuse `machining.pmi`)
19. Response assembly

Route/controller (`app/api/v1/sheet_metal.py`) stays a thin FastAPI layer:
validate upload → call `analyze_sheet_metal()` in `run_in_threadpool` (CPU-
bound OCCT work off the event loop) → guarantee temp-file cleanup.

## 6. Error Handling

Identical envelope and codes philosophy to machining:
- `CAD_KERNEL_UNAVAILABLE` (503) when neither OCP nor OCC.Core import.
- `UNSUPPORTED_FORMAT` (415) for extensions outside the supported set.
- Per-stage failures recorded as `warnings[]` with the response still
  returned at 200 where enough of the pipeline succeeded to be useful;
  full pipeline failure (e.g. unreadable/corrupt file) returns 400/500 with
  `errors[]`.
- Proxy route (`analyze-sheet-metal/route.ts`) normalizes all upstream/
  transport failures into the same `{success:false, analysis_version,
  errors[], warnings[]}` shape as the machining proxy.

## 7. Testing

New `apps/cad-service/tests/sheet_metal/`, mirroring
`tests/machining/`'s layout:

- `conftest.py` — shared fixtures (sample STEP files: a simple single-bend
  bracket, a multi-bend enclosure part, a flat plate with holes only, a
  non-sheet-metal solid for candidate-rejection testing)
- `test_analysis_units.py` — unit tests per detector module (thickness,
  bends, holes, cutouts, hems, distance checks), using synthetic/mocked
  shapes where practical
- `test_detectors_with_kernel.py` — integration tests running full detectors
  against real sample STEP files, requires OCC kernel installed
- `test_endpoint.py` — FastAPI route tests: happy path, unsupported format,
  missing kernel (mocked), malformed upload
- `test_binding_portability.py` — reused pattern to confirm detectors work
  under both OCP and OCC.Core bindings
- `test_openapi_docs.py` — schema/OpenAPI doc consistency check
- Port assertions from the existing root-level
  `tests/test_bend_detection.py` and `test_advanced_thickness_detection.py`
  (legacy tests) into the new suite as a validation baseline — confirms the
  ported algorithms still produce equivalent results on the same fixtures.

Frontend: no new automated test infra proposed beyond what already covers
the machining page, unless the repo has an existing pattern for that page
worth mirroring (to confirm during implementation).

## 8. Rollout / Sequencing

Implementation should proceed in this order (informs the implementation
plan, not a set of separate releases):
1. Backend package skeleton + schemas + config (no detectors yet, route
   returns model/topology/geometry only) — validates plumbing end-to-end.
2. Sheet-candidate + thickness detectors (foundational gate for everything
   else).
3. Base/flange + bend + bend-relief detectors.
4. Hole/cutout/slot/hem detectors.
5. Distance checks, patterns/symmetry, complexity indicators.
6. Frontend page + proxy route + analysis panel.
7. Test suite fill-in alongside each backend stage (TDD per detector, not
   deferred to the end).

## 9. Open Questions (non-blocking, resolve during implementation)

- Exact location of the CAD-tools navigation entry point to add the new
  "Sheet Metal" link — to be located when touching the frontend.
- Whether `bend_relief.py` should ship a real detector in v1 or a
  documented "not yet supported" stub — legacy code doesn't have relief
  detection to port from, so this may need to be designed fresh; default to
  shipping a conservative stub if the from-scratch detector proves risky
  under the implementation timeline, flagged clearly in `note` rather than
  silently omitted.
- Symmetry detection accuracy bar — geometric bounding-box/mirror-plane
  check is straightforward; true topological symmetry matching is harder
  and may be scoped down to bounding-box/profile-based mirror detection
  only if time-constrained.
