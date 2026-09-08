# OCCT Topology Runtime Audit (Path A)

Date: 2026-03-19

## 2026-03-31 Runtime Versioning Update

The active worker runtime now resolves versioned artifacts:

- `apps/web/public/occ/occt-import-js.v2.js`
- `apps/web/public/occ/occt-import-js.v2.wasm`
- JS glue import URL: `/occ/occt-import-js.v2.js`
- WASM locate path: `/occ/occt-import-js.v2.wasm`

Legacy artifacts are intentionally dual-served for one-release compatibility:

- `apps/web/public/occ/occt-import-js.js`
- `apps/web/public/occ/occt-import-js.wasm`

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

## 2026-09-08 Per-Face Patch Geometry (exact face highlighting)

`tools/occt-wasm-build/patches/0003-add-tessellate-with-topology.patch` was extended (not a new patch file - it modifies the same `topology_export.cpp` this patch already adds) with `AppendFaceTessellationData`, called once per face inside `AppendTopologyForPart` right after `SetFaceAnalyticData`. For every `TopoDS_Face` it now also emits, directly on that face's topology record:

- `positions`: flattened `[x0,y0,z0,x1,y1,z1,...]` in the same part/global coordinate frame as everything else in the topology payload, taken from `BRep_Tool::Triangulation`/`Poly_Triangulation` (the mesh OCCT already attached during import at the caller's deflection settings - not re-tessellated, so it never changes the visual density of the merged part mesh). Falls back to an on-demand `BRepMesh_IncrementalMesh` pass only if a face genuinely has no stored triangulation.
- `indices`: flattened triangle index triples, 0-based and **local to this face's own `positions` array** (never indices into the merged per-part render mesh) - winding is flipped for `TopAbs_REVERSED` faces so the outward normal matches the rest of the model.

This makes each `ExactFace` a self-contained, independently-renderable patch, consumed by:

- `apps/web/workers/occ-worker.ts` (`normalizeExactFaces`, transferable buffers)
- `apps/web/components/cad/exact-cad-topology.ts` (`ExactFace.positions`/`ExactFace.indices`, optional)
- `apps/web/components/cad/viewer.ts` (`setFaceHighlight`, a new sibling to `setHighlight`/`setMarker`)
- `apps/web/components/cad/cad-viewer.tsx` (`highlightedFaceIds` prop, `onTopologyLoaded` callback)
- `apps/web/app/cad/machining/lib/face-matching.ts` (geometric matcher from backend `FaceDetail[]` to frontend `ExactFace[]`, since the two kernels tessellate independently and face ids never line up)
- `apps/web/app/cad/machining/page.tsx` (wires the above end to end; `markerLocation` remains the fallback when no geometric match is found)

**This C++ change could not be compiled or runtime-tested in this environment** (no `docker`, no `emcc` - see the blocker note above). It was written by careful pattern-matching against the surrounding code in the same file (same include set already used for `SetFaceAnalyticData`, same `emscripten::val::array()`/`.set()` conventions as `WriteMeshes` in `0002-add-exact-part-export.patch`). Least-confident points, flagged for review once a build is possible:

- Whether a face processed at `AppendTopologyForPart` time reliably still has its `Poly_Triangulation` attached (i.e. whether the importer's earlier meshing pass, done for `WriteMeshes`, is guaranteed to still be live on the shape by the time topology export runs on the same in-memory shape) - the on-demand `BRepMesh_IncrementalMesh` fallback exists specifically to cover the case where it does not, but its hardcoded deflection constants (`0.1` linear / `0.5` angular) are a guess, not threaded through from the caller's actual `linearDeflection`/`angularDeflection` options the way `ReadStepFile` et al. are.
- The reversed-face winding flip (`n1, n3, n2` instead of `n1, n2, n3`) is the standard OCCT convention, but is unverified against this importer's actual normal convention at runtime.
