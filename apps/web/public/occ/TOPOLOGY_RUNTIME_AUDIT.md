# OCCT Topology Runtime Audit (Path A)

Date: 2026-03-19

## Runtime Artifact Source Of Truth

The running web worker loads OCCT runtime artifacts from:

- `apps/web/public/occ/occt-import-js.js`
- `apps/web/public/occ/occt-import-js.wasm`

Worker loader path:

- `apps/web/workers/occ-worker.ts`
- JS glue import URL: `/occ/occt-import-js.js`
- WASM locate path: `/occ/occt-import-js.wasm`

## Verified Missing Export In Current Shipped Artifacts

Before this Path A implementation, runtime introspection reported:

- `ReadStepFile`: `function`
- `ReadIgesFile`: `function`
- `ReadBrepFile`: `function`
- `ExportPart`: `undefined`
- `AnalyzeSheetMetal`: `undefined`
- `TessellateWithTopology`: `undefined`

Therefore exact topology mode could not activate and worker returned `missing_runtime_support`.

## Topology Export Added In Source/Patch Pipeline

A new tracked patch was added:

- `tools/occt-wasm-build/patches/0003-add-tessellate-with-topology.patch`

This patch:

- adds runtime export `TessellateWithTopology(buffer, opts)`
- adds topology extractor module files:
  - `occt-import-js/src/topology_export.hpp`
  - `occt-import-js/src/topology_export.cpp`
- returns combined tessellation + exact topology payload (`vertices`, `edges`, `faces`)
- includes edge-to-face adjacency and circle analytic metadata where available

## Worker Runtime Self-Test / Failure Behavior

`apps/web/workers/occ-worker.ts` now performs a one-time startup capability self-test and logs:

- required export name (`TessellateWithTopology`)
- detected runtime symbol type
- runtime topology-related exports
- exact artifact URLs used by the worker

If the export is missing, topology requests fail loudly with an explicit missing-export message that names the artifact paths.

## Build/Artifact Blocker In This Environment

Current environment still cannot rebuild/install runtime artifacts because required toolchain is unavailable locally:

- `docker`: not installed
- `emcc` (emscripten): not installed

Until rebuilt artifacts are produced and copied into `apps/web/public/occ`, runtime self-test will continue to report missing topology export on this machine.
