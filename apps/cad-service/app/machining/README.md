# Machining Analysis Endpoint

`POST /api/v1/cad/analyze-machining`

Deterministically extracts geometry, topology and machining-relevant features
from a CAD file using the OpenCASCADE kernel, and returns them as normalized
JSON for a downstream costing engine.

## Scope

This endpoint answers exactly one question:

> **What geometry exists?**

It deliberately does **not** answer:

- How much does machining cost?
- Which CNC machine should be used?
- What is the machining hourly rate?
- What is the final selling price?

Those belong to later stages. The response contains no cost, rate, machine,
process-selection or price field, and a test asserts that (`test_endpoint.py::
test_no_cost_or_pricing_field_appears_anywhere`).

**No LLM is involved.** The same CAD file always produces the same JSON;
`test_detectors_with_kernel.py::TestDeterminism` asserts byte-identical output
across runs.

```
STEP / IGES / BREP
      │
      ▼
┌──────────────────┐
│  CAD Analyzer    │  ← this endpoint (deterministic)
└────────┬─────────┘
         ▼
   Geometry JSON  ─────►  Manufacturing AI  ─►  Route ─► Cost ─► Price
```

## Installing the CAD kernel

The analysis requires an OpenCASCADE Python binding. Two are supported and the
code is written against both:

| Binding | Install | Notes |
|---|---|---|
| **OCP** (preferred) | `pip install cadquery-ocp` | Available on PyPI, newer OCCT |
| pythonocc-core | `conda install -c conda-forge pythonocc-core=7.7.0 occt=7.7.0` | **Not on PyPI** — conda only |

`pythonocc-core` cannot be installed with `pip` at all; that is why the service
`Dockerfile` is conda-based. For local development `cadquery-ocp` is the quicker
route.

Without a kernel the service still starts, and this endpoint returns **503
`CAD_KERNEL_UNAVAILABLE`** rather than crashing.

## Running it

```bash
cd apps/cad-service
python -m venv .venv && source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install fastapi uvicorn python-multipart pydantic cadquery-ocp
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Interactive API docs (Swagger)

| URL | What it is |
|---|---|
| <http://localhost:8001/docs> | **Swagger UI** — browse and call the endpoint from the browser via *Try it out* |
| <http://localhost:8001/redoc> | ReDoc — a reading-oriented rendering of the same schema |
| <http://localhost:8001/openapi.json> | Raw OpenAPI 3.1 document, for client generation |

The Swagger page carries a worked request, two response examples (a typical
milled bracket, and one showing how ambiguous features are reported), and an
example for every error code. Sections start collapsed — the machining response
schema is large — and the search box filters by tag.

Set `PUBLIC_BASE_URL` to add your deployed origin to the Swagger *Servers*
selector, so *Try it out* targets the right host rather than the docs origin.

Generate a typed client straight from the schema:

```bash
npx openapi-typescript http://localhost:8001/openapi.json -o cad-service.d.ts
```

Check the kernel and the effective thresholds without uploading anything:

```bash
curl http://localhost:8001/api/v1/cad/analyze-machining/capabilities
```

## Request

`multipart/form-data`

| Field | Type | Default | Meaning |
|---|---|---|---|
| `file` | file | required | `.step`, `.stp`, `.iges`, `.igs`, `.brep`, `.brp` |
| `unit_system` | `metric` \| `imperial` | `metric` | Output units |
| `include_face_details` | bool | `false` | One record per face |
| `include_feature_details` | bool | `true` | Individual features, not just counts |
| `include_debug_geometry` | bool | `false` | Face adjacency and per-stage timings |

```bash
curl -X POST http://localhost:8001/api/v1/cad/analyze-machining \
  -F "file=@bracket.step" \
  -F "unit_system=metric" \
  -F "include_face_details=false" \
  -F "include_feature_details=true" \
  -F "include_debug_geometry=false"
```

See [`examples/example_request.sh`](examples/example_request.sh) and
[`examples/example_response.json`](examples/example_response.json) (a real
response from a 120 × 80 × 35 bracket with a hole pattern, a counterbored hole,
a pocket and a slot).

### Units

Analysis always runs in millimetres — the STEP reader is pinned to `MM`, so an
inch-authored file and a millimetre-authored file of the same part produce
identical output.

With `unit_system=imperial` every length is converted to inches and the
top-level `units` field becomes `"in"`. **Field names keep their `_mm` suffix**
so the JSON schema is stable across unit systems; `units` is authoritative, and
a `UNIT_ASSUMED` warning states this in the response. Direction vectors
(`axis`, `normal`, `orientation`, `machining_direction`) are unit vectors and
are never scaled.

## Response

```jsonc
{
  "success": true,
  "analysis_version": "1.0",
  "kernel": "OCP",
  "units": "mm",
  "file": {},                    // filename, format, size, sha256
  "model": {},                   // solid/shell/face/edge/vertex counts, validity
  "geometry": {},                // bbox, volume, area, centre of mass, inertia
  "topology": {},                // shells, free edges, Euler characteristic
  "surface_summary": {},         // face-type histogram
  "face_details": null,          // when include_face_details=true
  "features": {
    "holes": [], "bores": [], "internal_cylindrical_features": [],
    "pockets": [], "slots": [], "bosses": [],
    "threads": [], "fillets": [], "chamfers": [],
    "fillet_summary": {}, "chamfer_summary": {}
  },
  "feature_patterns": [],        // repeated features, grouped
  "feature_dimensions": [],      // depth/diameter and depth/width ratios
  "machining_flags": [],         // DEEP_HOLE, NARROW_SLOT, ...
  "machining_constraints": [],   // geometric max tool diameter per feature
  "accessibility": [],           // per feature, per principal direction
  "setup_analysis": {},          // features grouped by direction
  "stock_analysis": {},          // bounding-box estimate + stock form, clearly marked
  "complexity_indicators": {},   // deterministic counts, no score
  "pmi": {},                     // declared CAD metadata, source-tagged
  "warnings": [],
  "errors": [],
  "debug_geometry": null
}
```

### Provenance: `GEOMETRY` vs `CAD_METADATA`

Every block carries a `source`. Measured facts are `GEOMETRY`; anything the file
merely *declares* (part name, material, GD&T, feature names) is `CAD_METADATA`
and lives under `pmi`. The two are never mixed.

### Confidence and ambiguity

Every feature carries a `detection` block naming the method, a confidence, and
the evidence behind it:

```json
{
  "id": "HOLE-001",
  "detection": {
    "method": "coaxial_grouping",
    "confidence": 0.95,
    "evidence": ["1 coaxial concave cylindrical face(s)",
                 "closed by face 9 - blind"],
    "source": "GEOMETRY"
  }
}
```

Confidence is calibrated to the strength of the evidence, not to measurement
precision — it is discrete, not a false decimal: `1.0` an exact kernel fact,
`0.9` unambiguous topology, `0.7` a corroborated heuristic, `0.5` a single weak
signal. A blind hole scores higher than a through hole because the *presence* of
a closing face is stronger evidence than its absence.

When geometry genuinely cannot settle a classification, the feature says so
rather than guessing:

```json
{
  "status": "ambiguous",
  "reason": "Internal cylindrical surface is above the hole diameter limit but
             below the bore depth threshold; geometry alone cannot separate a
             bore from a shallow recess."
}
```

An internal cylinder that is neither clearly a hole nor clearly a bore is
reported as `internal_cylindrical_feature`, in its own list.

## What each detector will and will not claim

| Detector | Claims | Refuses to claim |
|---|---|---|
| **Holes** | Concave cylinders, grouped coaxially; through/blind from a closing face; counterbore, countersink, stepped | A cylinder is *not* a hole just for being cylindrical — convex cylinders and partial wraps are excluded |
| **Bores** | Diameter ≥ 25 mm **and** depth ≥ 10 mm | Otherwise falls back to `internal_cylindrical_feature` rather than guessing |
| **Pockets** | Planar floor, recessed, walled, and *visible along its own normal* | A pocket **wall** looks identical by adjacency alone; the ray probe is what separates them |
| **Slots** | Pockets with length/width ≥ 3:1 | T-slot only when a wall genuinely overhangs the mouth |
| **Bosses** | Convex cylinders standing proud of a face | Prismatic bosses — not separable from a step or rib by adjacency |
| **Fillets** | Tangent-continuous blends | A non-tangent narrow face is a chamfer, not a fillet |
| **Chamfers** | Narrow planar bands meeting two faces at an angle | A band with one angled neighbour is a step face |
| **Threads** | Designation from CAD metadata (`explicit`); helical geometry (`geometric`) | **Never infers a designation from diameter** — a 6.8 mm hole is not an M8 |

### Thread policy

```json
{
  "type": "thread",
  "designation": null,
  "confidence": "unknown",
  "reason": "Helical geometry detected but no thread designation is present in
             the CAD file. The designation is not inferred from diameter."
}
```

6.8 mm is the tap drill for M8, but that relationship is a *manufacturing
decision*, not a geometric fact. It is not this endpoint's to make.

## Accessibility and setups

Each feature is ray-cast against `+X −X +Y −Y +Z −Z`. A direction is accessible
when nothing obstructs the approach — measured, not inferred from orientation.

`setup_analysis` groups features by direction and reports a greedy set-cover
size. **This is geometric evidence, not a setup plan**: it does not decide
fixturing, ordering, or how many operations are economical.

The endpoint never concludes a part needs 4- or 5-axis machining. When six
principal directions cannot settle the question it sets
`requires_advanced_axis_analysis: true` and leaves the conclusion to a planner
that knows the machine.

## Tool-diameter constraints

A tool of diameter *d* cannot cut an internal corner of radius less than *d/2*,
so:

```
maximum_tool_diameter_mm = 2 × minimum_internal_radius_mm
```

That is the whole claim — a geometric ceiling. **No cutting parameters, tool
selection, feeds or speeds are implied.**

## Stock analysis

Bounding box plus a configurable per-side allowance (default 2.5 mm), always
flagged `"estimated": true`. This is **not** a purchased stock size: real stock
comes in discrete sizes and may be a casting or extrusion. No material, grade or
cost is implied.

### Stock form

`stock_analysis.stock_form` also names the mill form the envelope resembles:
`SHEET`, `PLATE`, `ROUND_BAR`, `SQUARE_BAR`, `RECTANGULAR_BAR` or `BLOCK`.

Flat stock is decided first, on two ratios: thickness/width separates flat from
solid, and thickness alone separates sheet from plate. A laser-cut washer comes
off sheet whatever its outline, so a round profile does not override flatness.

A part that has been **formed** is checked next, because folding is exactly
what destroys flat proportions: a bent bracket or a drawn enclosure has the
envelope of a block. What survives forming is the wall, so opposed planar faces
are paired, their separations clustered, and the dominant cluster taken as the
wall thickness. It only counts as sheet when those walls carry at least
`stock_form_sheet_wall_area_fraction` of the *total* surface area — measured
against the whole surface rather than just the planar part of it, which is what
keeps a solid block with one thin web, and a short turned pin whose end faces
sit close, out of this branch. `sheet_evidence.formed` then flags that
`sorted_dimensions_mm` is the folded envelope and **not** the flat blank; this
endpoint does not unfold the part, so the blank size is not reported.

Everything else is checked for being a **body of revolution** before the
remaining ratios get a say, because thickness cannot tell round bar from square
bar — their extents are identical. External cylindrical faces are grouped by
axis line, and a group qualifies when the two extents across its axis are equal,
its largest diameter fills that cross-section, and its faces together span most
of the extent along the axis. Two details matter:

* **The rotational axis is not always the long one.** A ring, washer or flange
  turns about its *shortest* extent; probing only the long axis makes every one
  of them read as a block.
* **The outside diameter is rarely one face.** A stepped shaft carries several
  diameters, and grooves and shoulders split even a plain bar, so the axial
  intervals of coaxial faces are unioned and the stock diameter is the group's
  largest radius.

What is left falls to width/length: slender is bar (square or rectangular by
cross-section), anything else is block.

Every cutoff is configuration (`stock_form_*`), and a part sitting within
`stock_form_ambiguity_margin` of the cutoff that decides it comes back
`"status": "ambiguous"` with both candidates rather than a coin flip.

`bounds_method` reports which envelope was used: `obb` when OCCT gave an
oriented bounding box, `aabb` when it did not. This matters — the axis-aligned
box of a plate modelled at 30° has three comparable dimensions and reads as a
block.

Like the estimate above, this is a statement about proportions, **not** a
purchasing recommendation: it does not claim the stock exists in the required
alloy, is available in that size, or is the cheapest route.

## Configuration

Every threshold lives in [`machining_config.json`](machining_config.json) and is
loaded by [`config.py`](config.py) — never hard-coded in a detector. Resolution
order, later wins:

1. defaults in `MachiningConfig`
2. `app/machining/machining_config.json`
3. the file named by `$MACHINING_CONFIG_PATH`
4. `MACHINING_<FIELD_NAME_UPPERCASE>` environment variables

```bash
export MACHINING_DEEP_HOLE_DEPTH_DIAMETER_RATIO=3.5
export MACHINING_STOCK_ALLOWANCE_MM=5.0
export MACHINING_MAX_UPLOAD_BYTES=52428800
```

An invalid override is logged and ignored rather than taking the service down.

## Errors

| Status | Code | Cause |
|---|---|---|
| 400 | `CORRUPT_CAD_FILE` | Read but produced no usable geometry |
| 400 | `EMPTY_FILE` | Zero bytes uploaded |
| 413 | `FILE_TOO_LARGE` | Above `max_upload_bytes` (enforced *while* streaming) |
| 415 | `UNSUPPORTED_FORMAT` | Extension not STEP/IGES/BREP — rejected before any bytes are read |
| 422 | `NO_SOLID_GEOMETRY` | Surfaces or shells but no closed solid |
| 422 | `MODEL_TOO_COMPLEX` | Above `max_faces` |
| 500 | `ANALYSIS_FAILED` | Unexpected failure |
| 503 | `CAD_KERNEL_UNAVAILABLE` | No OpenCASCADE binding installed |

Every error body follows `MachiningErrorResponse`:

```json
{ "success": false, "analysis_version": "1.0",
  "errors": [{"code": "...", "message": "...", "detail": {}}], "warnings": [] }
```

### Warnings vs errors

Warnings never fail the request. Notably, **multiple solids are never silently
ignored** — they are analysed together and reported:

```json
{ "code": "MULTIPLE_SOLIDS",
  "message": "The model contains 2 separate solid bodies. All bodies were
              analysed together; feature counts and stock estimates span the
              whole assembly.",
  "detail": {"solid_count": 2} }
```

Other codes: `OPEN_SHELL`, `INVALID_GEOMETRY`, `AMBIGUOUS_FEATURE`,
`DETECTOR_FAILED`, `LARGE_MODEL`, `PMI_UNAVAILABLE`,
`ACCESSIBILITY_UNRELIABLE`, `UNIT_ASSUMED`.

A single detector crashing on unusual geometry degrades to a `DETECTOR_FAILED`
warning; the other twelve sections are still returned.

## Security

- Upload size capped **while streaming**, so an oversized file is abandoned early
  rather than after a full read, and never sits whole in memory.
- Client filenames are reduced to a safe basename (`sanitize_filename`) and used
  only for reporting — never to build a path. Temp paths come from `tempfile`.
- Temporary files are removed in a `finally` block on every path, including
  rejection and client disconnect (`TestTemporaryFileHygiene`).
- Face count capped by `max_faces` to bound analysis time.
- The unsupported-extension check runs *before* the body is read.

> **The endpoint is currently unauthenticated**, in line with the rest of this
> service. Put it behind the API gateway; do not expose it directly.

## Architecture

```
app/api/v1/machining.py        thin controller: validate, delegate, clean up
app/machining/
  service.py                   pipeline orchestration
  occ.py                       OCP / pythonocc-core binding shim
  config.py                    thresholds (env + JSON override)
  schemas.py                   Pydantic request/response models
  parser.py                    CADParser - upload, import, shape validation
  topology.py                  TopologyAnalyzer, GeometryAnalyzer
  faces.py                     FaceClassifier, surface summary
  records.py                   kernel-free intermediate representation
  raycast.py                   RayProbe - shared obstruction testing
  vectors.py                   pure vector maths
  detectors/
    holes.py    HoleDetector           pockets.py  PocketDetector
    slots.py    SlotDetector           bosses.py   BossDetector
    blends.py   FilletDetector, ChamferDetector
    threads.py  ThreadDetector         shared.py   shared geometry helpers
  patterns.py                  PatternDetector
  accessibility.py             AccessibilityAnalyzer, SetupAnalyzer
  stock.py                     StockAnalyzer
  stock_form.py                StockFormClassifier
  constraints.py               MachiningComplexityAnalyzer (flags, tooling)
  complexity.py                ThinWallAnalyzer, ComplexityIndicatorBuilder
  pmi.py                       PMIExtractor
  units.py                     metric/imperial conversion
```

The B-Rep is traversed **once** into a `ShapeModel` of plain dataclasses. Every
detector then reasons over that, which is why most of the logic is testable with
no CAD kernel installed.

## Tests

```bash
pytest tests/machining/ -v
```

- `test_geometry_helpers.py`, `test_analysis_units.py` — **no kernel needed**,
  driven with synthetic faces and features.
- `test_detectors_with_kernel.py` — per-detector, against STEP fixtures built at
  test time by `fixtures.py`. Auto-skips without a kernel.
- `test_endpoint.py` — HTTP round trip, validation, options, temp-file hygiene.

Fixtures are *generated*, not committed, so each part's expected features follow
from its construction (a 100 × 60 × 20 block minus a 10 mm cylinder must yield
`120000 − π·25·20` mm³ and exactly one through hole) instead of from an opaque
binary blob.
