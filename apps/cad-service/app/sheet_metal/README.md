# Sheet-Metal Analysis Endpoint

`POST /api/v1/cad/analyze-sheet-metal`

Deterministically extracts geometry, topology and sheet-metal-relevant
features from a CAD file using the OpenCASCADE kernel, and returns them as
normalized JSON for a downstream costing/quoting engine.

This package is structurally parallel to [`app/machining`](../machining/README.md)
(same envelope, error, and detection conventions - see below) but targets
formed sheet-metal parts instead of milled/turned parts.

## Scope

This endpoint answers exactly one question:

> **What sheet-metal geometry exists?**

It deliberately does **not** answer:

- How much does this part cost to fabricate?
- What is the flat-pattern / blank size?
- Which press brake, tooling, or nesting layout should be used?
- What is the final selling price?

Those belong to later stages. The response contains no cost, rate, machine,
process-selection or price field.

**No LLM is involved.** The same CAD file always produces the same JSON.

```
STEP / IGES / BREP
      │
      ▼
┌────────────────────┐
│  Sheet-Metal        │  ← this endpoint (deterministic)
│  Analyzer            │
└─────────┬───────────┘
          ▼
   Geometry JSON  ─────►  Manufacturing AI  ─►  Route ─► Cost ─► Price
```

## Explicitly out of scope

- **No flat-pattern unfolding.** `k_factor_assumed`, `bend_allowance_mm` and
  `bend_deduction_mm` are recorded per bend as metadata for a *future*
  unfolding phase - they are not used to compute a blank/flat size anywhere
  in this response. A formed part's `stock_form`/bounding-box style envelope
  is never reported as the flat blank.
- **No cost, quoting, or pricing.** No field anywhere states or implies a
  price, rate, or margin.
- **No process or machine selection.** The endpoint never recommends a press
  brake, tool, or bend sequence beyond a geometric `sequence_hint` (adjacency
  order, not a manufacturing plan).
- **No material or grade inference.** Material, if present at all, is a
  `CAD_METADATA` fact under `pmi`, never inferred from geometry.

## Installing the CAD kernel

Same requirement as `app/machining` - see
[`app/machining/README.md`](../machining/README.md#installing-the-cad-kernel).
`app.sheet_metal` reuses `app.machining.occ` for the OCP / pythonocc-core
binding shim, so both endpoints share one kernel install.

Without a kernel the service still starts, and this endpoint returns **503
`CAD_KERNEL_UNAVAILABLE`** rather than crashing.

## Running it

```bash
cd apps/cad-service
python -m venv .venv && source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install fastapi uvicorn python-multipart pydantic cadquery-ocp
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Interactive docs at `http://localhost:8001/docs` cover this endpoint the same
way as `analyze-machining`.

Check the kernel and effective thresholds without uploading anything:

```bash
curl http://localhost:8001/api/v1/cad/analyze-sheet-metal/capabilities
```

## Request

`multipart/form-data`

| Field | Type | Default | Meaning |
|---|---|---|---|
| `file` | file | required | `.step`, `.stp`, `.iges`, `.igs`, `.brep`, `.brp` |
| `unit_system` | `metric` \| `imperial` | `metric` | Output units |
| `include_face_details` | bool | `false` | Reserved - not yet emitted |
| `include_feature_details` | bool | `true` | Reserved - not yet emitted |
| `include_debug_geometry` | bool | `false` | Reserved - not yet emitted |
| `include_topology_entities` | bool | `false` | Reserved - not yet emitted |

```bash
curl -X POST http://localhost:8001/api/v1/cad/analyze-sheet-metal \
  -F "file=@bracket.step" \
  -F "unit_system=metric" \
  -F "include_feature_details=true" \
  -F "include_face_details=false" \
  -F "include_debug_geometry=false" \
  -F "include_topology_entities=false"
```

See [`examples/example_request.sh`](examples/example_request.sh) and
[`examples/example_response.json`](examples/example_response.json) - a real
response produced by running the pipeline against the `swept_l_bracket_bend`
STEP fixture from `tests/sheet_metal/fixtures.py` (a two-flange, single-bend
L-bracket, 2 mm wall, 90 degree bend, 3 mm inner radius).

### Units

Analysis always runs in millimetres. With `unit_system=imperial` every length
is converted to inches and the top-level `units` field becomes `"in"`. Field
names keep their `_mm` suffix so the JSON schema is stable across unit
systems; `units` is authoritative. Direction vectors (`axis`, `plane_normal`,
`orientation`) are unit vectors and are never scaled.

## Response

```jsonc
{
  "success": true,
  "analysis_version": "0.1",
  "kernel": "OCP",
  "units": "mm",
  "options": {},
  "file": {},                    // filename, format, size, sha256 - reused from machining
  "model": {},                   // solid/shell/face/edge/vertex counts, validity
  "topology": {},                // shells, free edges, Euler characteristic
  "geometry": {},                // bbox, volume, area, centre of mass, inertia
  "sheet_metal_candidate": {},   // gate: is this even a sheet-metal part?
  "thickness": {},                // dominant wall thickness, uniformity
  "faces": {},                    // base face + flange faces, bend adjacency
  "bends": [],
  "bend_reliefs": [],
  "holes": [],
  "cutouts": [],
  "slots": [],
  "hems": [],
  "outer_profile": {},
  "distance_flags": [],           // HOLE_TOO_CLOSE_TO_EDGE, BEND_RADIUS_TOO_TIGHT, ...
  "feature_patterns": [],
  "symmetry": {},
  "complexity_indicators": {},    // deterministic counts, no score
  "pmi": {},                      // declared CAD metadata, source-tagged
  "warnings": [],
  "errors": [],
  "debug_geometry": null
}
```

`file`, `model`, `topology`, `geometry`, `pmi` and `debug_geometry` are
**reused verbatim** from `app.machining.schemas` - same field names, same
semantics, same `GEOMETRY` vs `CAD_METADATA` provenance convention (see
`app/machining/README.md`'s "Provenance" section). Everything else is new to
this package.

### The candidate gate

Before any sheet-metal-specific section is populated, `sheet_metal_candidate`
answers "is this geometry plausibly a formed sheet-metal part?" using
thickness (`min_sheet_thickness_mm`/`max_sheet_thickness_mm`, default
0.4-6.0 mm) and paired-opposed-face area coverage
(`paired_face_area_fraction_threshold`, default 0.5) as evidence.

A **rejected or ambiguous** candidate is not a hard failure: the full response
is still returned with `success: true`, HTTP 200, and every sheet-metal
section (bends, holes, ...) at its empty/default value - `reason` explains
why. This mirrors machining's "ambiguous feature" convention rather than
`analysis-machining`'s error path: a wrong-shaped upload is evidence, not an
exception.

### Detection blocks

Bends and feature patterns carry the same `Detection` block used throughout
`app.machining` (`method`, `confidence`, `evidence`, `source`) - see that
package's README for the confidence-calibration convention (discrete
`1.0`/`0.9`/`0.7`/`0.5`, not a false decimal).

## What each part of the pipeline will and will not claim

| Section | Claims | Refuses to claim / known limitation |
|---|---|---|
| **Candidate gate** | Thickness in range + sufficient paired-face area coverage | Ambiguous near the thickness/area cutoffs rather than a coin flip |
| **Thickness** | Dominant thickness from paired opposed planar faces, with variance | A single-sample or wildly non-uniform wall reports low confidence via `is_uniform`/`variance_mm`, not a false single number |
| **Bends** | Cylindrical face bridging exactly two planar flanges, within the configured bend-angle window | `sequence_hint` is geometric adjacency order only - **not** a bend-sequence recommendation; `k_factor_assumed`/`bend_allowance_mm`/`bend_deduction_mm` are recorded metadata for a future unfolding phase, **not used to compute a flat pattern here** |
| **Bend reliefs** | Nothing yet - see below | Every bend gets one `"none-detected"` stub record; **absence of a detected relief does not mean the part has none** - it means this was not checked (no relief-notch detector has shipped) |
| **Holes** | Round through/blind cylindrical cuts, distance to nearest edge/bend | Shape limited to `round`/`slotted` |
| **Cutouts** | Non-circular pierced profiles (rectangular/polygonal/irregular), perimeter, area, `min_feature_size_mm` | `min_feature_size_mm` is the smaller of the profile's in-plane bounding-box extents, **not a true narrowest-neck (medial-axis/erosion) measurement** - it is a reasonable proxy for compact convex shapes (rectangles, D-shapes) but **understates the true minimum width for an L-shaped or dogbone profile**, whose bounding box can be much wider than its narrowest neck. Treat it as an upper bound / sanity check, not a precise DFM measurement |
| **Slots** | Elongated (>=3:1) inner profiles with at least one rounded (arc) end | A long, sharp-cornered rectangular cutout is *not* classified as a slot even at high aspect ratio - it needs a rounded end |
| **Hems** | A folded-back edge: cylindrical face at <=1.5x sheet thickness, exactly one planar neighbour, >=150 degree wrap - bucketed `open`/`teardrop`/`closed` by wrap angle | **Narrow, heuristic classifier, not a verified one.** A hem modelled as two coincident flat skins with no dedicated cylindrical transition face is invisible to it. A tight-radius bend that happens to have only one flange neighbour for unrelated modelling reasons (a trimmed solid, a free-edge fillet) can be misclassified as a hem. No confidence field is exposed on `Hem` - this documented limitation is the substitute. Does not distinguish a manufacturing hem from a decorative rolled/curled edge |
| **Outer profile / distance flags** | Point-to-boundary and point-to-bend-line distance via straight-segment (chord) approximation | A curved outer edge or arc-shaped bend line is measured to its endpoint-to-endpoint chord, not tessellated - adequate for corner-proximity checks, not a precise curve-distance calculation |
| **Feature patterns** | Repeated holes/cutouts/slots grouped by matching dimensions, arrangement classified as linear/rectangular/circular/grouped | Adapted from `app.machining.patterns`'s arrangement classifier - reimplemented locally, not imported, to keep this package decoupled from `app.machining`'s schema surface |
| **Symmetry** | Mirror-plane check about the outer profile's centroid, tested only against the local X/Y in-plane axes | **Bounding-profile-only**, not full topological (bend/hole/cutout-aware) symmetry matching. A part whose true mirror axis is diagonal, or whose symmetry depends on internal feature layout rather than the outer silhouette, reports `has_symmetry: false` even if a human would call it symmetric |
| **Complexity indicators** | Deterministic counts (bend/hole/cutout/slot/hem counts, distinct diameters, minimum radius/distances) | No difficulty or price score - matches machining's documented stance that cost judgement belongs to a downstream engine |

## Configuration

Every threshold lives in
[`sheet_metal_config.json`](sheet_metal_config.json) and is loaded by
[`config.py`](config.py) - never hard-coded in a detector. Resolution order,
later wins:

1. defaults in `SheetMetalConfig`
2. `app/sheet_metal/sheet_metal_config.json`
3. the file named by `$SHEET_METAL_CONFIG_PATH`
4. `SHEET_METAL_<FIELD_NAME_UPPERCASE>` environment variables

```bash
export SHEET_METAL_MIN_SHEET_THICKNESS_MM=0.5
export SHEET_METAL_PAIRED_FACE_AREA_FRACTION_THRESHOLD=0.6
export SHEET_METAL_MIN_HOLE_TO_EDGE_DISTANCE_MM=3.0
```

An invalid override is logged and ignored rather than taking the service down.

Key defaults (see [`config.py`](config.py) for the complete, documented list):

| Field | Default | Meaning |
|---|---|---|
| `min_sheet_thickness_mm` / `max_sheet_thickness_mm` | 0.4 / 6.0 mm | Candidate-gate thickness window |
| `paired_face_area_fraction_threshold` | 0.5 | Minimum paired-wall area coverage for candidacy |
| `min_bend_angle_deg` / `max_bend_angle_deg` | 45 / 135 deg | Bend-zone clustering window |
| `default_k_factor` | 0.44 | Recorded per bend; not used for unfolding yet |
| `min_bend_radius_to_thickness_ratio` | 1.0 | Below this, `BEND_RADIUS_TOO_TIGHT` fires |
| `min_feature_size_mm` | 1.0 mm | Below this, `FEATURE_BELOW_MIN_SIZE` fires |
| `min_hole_to_edge_distance_mm` | 2.0 mm | Below this, `HOLE_TOO_CLOSE_TO_EDGE` fires |
| `min_hole_to_bend_distance_mm` | 3.0 mm | Below this, `HOLE_TOO_CLOSE_TO_BEND` fires |

## Errors

Same status codes and error envelope (`SheetMetalErrorResponse`) as
`app.machining` - see
[`app/machining/README.md`](../machining/README.md#errors) for the full table
(`CORRUPT_CAD_FILE`, `EMPTY_FILE`, `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`,
`NO_SOLID_GEOMETRY`, `MODEL_TOO_COMPLEX`, `ANALYSIS_FAILED`,
`CAD_KERNEL_UNAVAILABLE`). A rejected/ambiguous sheet-metal candidate is
**not** one of these - it is a normal 200 response (see "The candidate gate"
above).

## Security

Same posture as `app.machining` (streamed upload size cap, sanitized
filenames, `finally`-block temp-file cleanup, face-count cap) - both
endpoints share `app.machining.parser.CADParser`. See
[`app/machining/README.md`](../machining/README.md#security).

> **The endpoint is currently unauthenticated**, in line with the rest of
> this service. Put it behind the API gateway; do not expose it directly.

## Architecture

```
app/api/v1/sheet_metal.py      thin controller: validate, delegate, clean up
app/sheet_metal/
  service.py                   pipeline orchestration
  config.py                    thresholds (env + JSON override)
  schemas.py                   Pydantic request/response models
                                (file/model/topology/geometry/pmi/debug_geometry
                                 imported verbatim from app.machining.schemas)
  distance_checks.py           DFM distance flags (edge/bend/min-size/radius)
  patterns.py                  repeated-feature grouping + bounding-profile symmetry
  complexity.py                SheetMetalComplexityIndicators builder
  detectors/
    sheet_candidate.py         is-this-sheet-metal gate
    thickness.py                dominant wall thickness from paired planar faces
    base_flange.py              base face + flange faces, bend adjacency
    bends.py                    BendDetector - cylindrical face bridging two flanges
    bend_relief.py               conservative "none-detected" stub (no detector yet)
    holes.py                    round through/blind cylindrical cuts
    cutouts.py                  non-circular pierced profiles (loop reconstruction)
    slots.py                    elongated rounded-end inner profiles
    hems.py                     folded-edge heuristic classifier
    profile.py                  outer-loop selection shared by patterns/distance_checks
```

`app.sheet_metal` reuses `app.machining`'s CAD-kernel shim
(`app.machining.occ`), B-Rep parser (`app.machining.parser.CADParser`), and
kernel-free `ShapeModel`/`FaceRecord`/`EdgeRecord` intermediate
representation (`app.machining.records`) rather than re-implementing them -
the B-Rep is still traversed once into that model, and every sheet-metal
detector reasons over it exactly like a machining detector does.

## Tests

```bash
cd apps/cad-service
PYTHONIOENCODING=utf-8 pytest tests/sheet_metal -v
```

- Fixtures are *generated at test time* by `tests/sheet_metal/fixtures.py`
  (mirrors `tests/machining/fixtures.py`'s convention) - not committed binary
  STEP files - so each fixture's expected features follow from its
  construction (e.g. `swept_l_bracket_bend` is built from an explicit swept
  cross-section guaranteed to produce exactly one bend with a 3 mm inner
  radius, rather than relying on a fillet operation that can silently
  no-op on some kernels).
- Detector-level unit tests run without a kernel where possible; STEP-backed
  tests auto-skip without one (`requires_kernel` in `conftest.py`).
- `test_endpoint.py` - HTTP round trip, options, temp-file hygiene.
- `test_legacy_parity_baseline.py` - checks the new pipeline's results are
  consistent with the geometric intent of the legacy (pre-rewrite)
  classification constants it was seeded from.
