# Sheet-Metal Analysis Endpoint — Implementation Plan

- **Spec:** [2026-09-07-sheet-metal-analysis-design.md](2026-09-07-sheet-metal-analysis-design.md)
- **Status:** Ready to implement

Each phase should be committed separately. Detector phases follow TDD: write
the test against a fixture first, then the detector.

## Phase 0 — Fixtures & scaffolding

- Add sample STEP files under `apps/cad-service/tests/sheet_metal/fixtures/`:
  a single-bend bracket, a multi-bend enclosure, a flat plate with holes only,
  and a non-sheet-metal solid (candidate-rejection case).
- Create `apps/cad-service/app/sheet_metal/__init__.py` and
  `apps/cad-service/tests/sheet_metal/__init__.py` + `conftest.py` with
  fixture loaders.
- Confirm legacy reference tests still pass as-is (baseline, no changes yet):
  `tests/test_bend_detection.py`, `test_advanced_thickness_detection.py`.

## Phase 1 — Schemas, config, plumbing (no detectors)

- `app/sheet_metal/schemas.py`: full `SheetMetalAnalysisResponse` tree per
  spec §4 (envelope, file, model, topology, geometry reused shapes; empty/
  optional stubs for sheet_metal_candidate, thickness, faces, bends,
  bend_reliefs, holes, cutouts, slots, hems, outer_profile, distance_flags,
  feature_patterns, symmetry, complexity_indicators, pmi, debug_geometry).
- `app/sheet_metal/sheet_metal_config.json` + `config.py`: thresholds from
  spec §3.4, `SHEET_METAL_<FIELD>` env override loader (mirror
  `machining/config.py`).
- `app/sheet_metal/service.py`: `analyze_sheet_metal()` skeleton — runs only
  stages 1-3 (file validation/import, topology, geometry) via reused
  `machining.parser`/`machining.topology`/`machining.occ`, returns a response
  with everything past `geometry` empty/default.
- `app/api/v1/sheet_metal.py`: `POST /api/v1/cad/analyze-sheet-metal` and
  `GET .../capabilities`, mounted in `app/main.py` alongside machining.
- Tests: `tests/sheet_metal/test_endpoint.py` (happy path returns 200 with
  model/topology/geometry populated, unsupported format → 415, mocked missing
  kernel → 503), `test_openapi_docs.py` (schema registers correctly).
- **Checkpoint:** upload a real STEP file through the new endpoint end-to-end
  and confirm the envelope/model/topology/geometry sections match the
  machining endpoint's shapes on the same file.

## Phase 2 — Sheet-candidate + thickness detectors

- `detectors/sheet_candidate.py`: port `calculate_sheet_metal_score` logic
  from `app/core/classification.py`, adapted to the OCC shim and returning
  the `sheet_metal_candidate` schema shape (confidence, evidence, status,
  reason). Gate behavior: pipeline continues even when rejected, later
  sections just stay empty with a reason.
- `detectors/thickness.py`: port dominant-thickness / uniformity logic from
  `app/core/advanced_thickness_detection.py` (`enhanced_ray_casting_analysis`),
  adapted to OCC-shim primitives instead of trimesh where practical; keep
  trimesh only if paired-face OCC approach can't reliably get thickness
  (note the choice in code comments).
- Tests: `test_analysis_units.py::test_sheet_candidate_*`,
  `::test_thickness_*` — unit tests against synthetic shapes plus integration
  against the flat-plate and non-sheet-metal fixtures (confirm correct
  accept/reject).
- Wire into `service.py` (stages 4-6).
- **Checkpoint:** flat-plate fixture reports `is_candidate=true` with a
  plausible thickness; non-sheet-metal fixture reports `is_candidate=false`.

## Phase 3 — Base/flange + bend + bend-relief detectors

- `detectors/base_flange.py`: identify base face and flange faces (largest
  planar face as base, adjacent parallel/offset planar faces as flanges).
- `detectors/bends.py`: port curvature-clustering bend detection from
  `app/core/bend_detection.py` (`AdvancedBendDetector`), adapted to OCC shim,
  producing `BendFeature` records (angle, radius, bend line, axis, direction,
  bend_allowance/deduction using spec formulas, `k_factor_assumed` from
  config default — not yet part-specific).
- `detectors/bend_relief.py`: stub in v1 per spec §9 unless a
  straightforward geometric approach (rectangular/round notch adjacent to a
  bend-line endpoint) proves tractable within this phase; if stubbed, return
  `type="none-detected"` consistently and note it clearly, never omit the
  field.
- Tests: unit + integration against single-bend and multi-bend fixtures —
  assert correct bend count, angle, and radius within tolerance.
- Wire into `service.py` (stages 7-9).
- **Checkpoint:** multi-bend enclosure fixture reports the expected bend
  count and per-bend angle/radius within a reasonable tolerance band (define
  tolerance once fixtures are in hand, e.g. ±2° / ±0.1mm).

## Phase 4 — Hole/cutout/slot/hem detectors

- `detectors/holes.py`: adapt circular-hole detection from
  `machining/detectors/holes.py`, dropping through/blind/depth semantics
  (sheet holes are pierced), keeping diameter/position/quantity.
- `detectors/cutouts.py`: new — non-circular pierced profile detection via
  face-loop analysis (perimeter, area, shape_type, min_feature_size_mm as
  smallest local width along the profile).
- `detectors/slots.py`: adapt from `machining/detectors/slots.py`.
- `detectors/hems.py`: new — folded-edge classification (open/closed/
  teardrop) via edge-curvature-at-profile-boundary analysis.
- Tests: unit tests per detector against the holes-only flat-plate fixture
  and any fixture with cutouts/hems (add a hemmed-edge fixture if none of
  the Phase 0 fixtures cover it).
- Wire into `service.py` (stages 10-13).
- **Checkpoint:** flat-plate fixture's hole count/diameters match expected
  values from the fixture's known design.

## Phase 5 — Distance checks, patterns/symmetry, complexity

- `distance_checks.py`: hole/cutout-to-edge, hole/cutout-to-bend, min
  feature size, min bend-radius/thickness ratio — each produces
  `distance_flags[]` entries per spec §4, thresholds from config.
- `patterns.py`: adapt `machining/patterns.py` for repeated-feature grouping;
  add symmetry detection scoped to bounding-box/mirror-plane check per spec
  §9's fallback if full topological symmetry proves too costly for this
  phase.
- `complexity.py`: deterministic counts per spec §4 — no derived score.
- Tests: unit tests asserting flags fire/don't fire at known threshold
  boundaries; symmetry test against a deliberately symmetric fixture.
- Wire into `service.py` (stages 15-17), complete the full pipeline (stage
  18 PMI reuse, stage 19 assembly already effectively done via schema).
- **Checkpoint:** full `analyze_sheet_metal()` pipeline runs end-to-end on
  all four fixtures with no unhandled exceptions; per-stage `_stage()`
  degrade-to-warning behavior verified by deliberately breaking one detector
  input.

## Phase 6 — Binding portability & full backend test pass

- `tests/sheet_metal/test_binding_portability.py`: confirm detectors work
  under both OCP and OCC.Core where both are available in CI/dev.
- Port forward relevant assertions from legacy `tests/test_bend_detection.py`
  and `test_advanced_thickness_detection.py` into the new suite as a
  parity/regression baseline against the same fixtures.
- Full `pytest apps/cad-service/tests/sheet_metal/` green.

## Phase 7 — Frontend

- `apps/web/types/sheet-metal-analysis.ts`: TS mirror of the final Pydantic
  schema (generate/hand-port after Phase 5 schema is stable).
- `apps/web/app/api/cad/analyze-sheet-metal/route.ts`: proxy route, copy
  `analyze-machining/route.ts`'s streaming pattern, repoint to
  `analyze-sheet-metal[/capabilities]`.
- `apps/web/app/cad/sheet-metal/page.tsx` +
  `components/analysis-panel.tsx` + `lib/format.ts`: copy machining page
  structure, adapt sections to the new schema (thickness, bends, flange
  list, holes/cutouts/slots/hems, distance flags, patterns/symmetry, PMI,
  raw-JSON download).
- Locate and update the CAD-tools navigation entry point to add "Sheet
  Metal" alongside "Machining" (spec §9 open question — resolve here).
- Manual verification: upload each of the four fixtures through the UI,
  confirm the analysis panel renders every section without errors.

## Phase 8 — Docs & cleanup

- `app/sheet_metal/examples/example_request.sh` + `example_response.json`
  (mirror machining's examples, using one of the fixtures).
- Update `app/sheet_metal/README.md` if the machining package has one worth
  mirroring (confirm during implementation).
- Final full-repo test run (backend + frontend typecheck) before merge.

---

**Sequencing note:** phases are ordered by dependency (schema before
detectors, detectors before route wiring beyond skeleton, backend before
frontend) and each ends with a concrete, checkable outcome rather than a time
estimate — proceed phase by phase, verifying the checkpoint before moving on.
