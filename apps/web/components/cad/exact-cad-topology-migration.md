# Exact CAD Topology Migration (Phases A-B)

## Current Architecture Snapshot
- CAD import flow (current): `cad-viewer.tsx` -> `mesh-loader.ts` (`loadCadAssemblyFile` / `loadMeshFile`) -> `occ-worker.ts` (`tessellate`) -> tessellated meshes in viewer.
- Edge overlay flow (current): `viewer.ts` `rebuildFeatureEdges()` creates `THREE.EdgesGeometry` overlays used by edge pick/highlight logic.
- Measurement flow (current): `viewer.ts` `measureEdgeAtScreenPosition()` measures picked overlay segments first, then falls back to triangle edges.

## Exact Topology Insertion Points
- Worker contract + capabilities:
  - Add `tessellate_with_topology` worker request/response.
  - Add `exactCadTopology` in `get_worker_capabilities`.
- Mesh-loader CAD assembly path:
  - Add `loadCadAssemblyWithTopology(...)`.
  - Keep `loadCadAssemblyFile(...)` as compatibility wrapper.
- Viewer exact entity path (later phases C+):
  - Replace overlay-driven edge truth with exact entity index and exact pick/measure logic.

## Runtime Capability Status (as observed locally on March 15, 2026)
- Current OCCT runtime exports include `ReadStepFile`, `ReadIgesFile`, `ReadBrepFile`.
- Current runtime does not expose topology extraction entrypoints (for example `TessellateWithTopology`) yet.
- This migration therefore adds full capability-gated plumbing with explicit fallback status, without faking exact topology from triangles.

## Phase A Progress
- Implemented:
  - Shared exact topology types and capability-status model in `exact-cad-topology.ts`.
  - Worker request/response contract for `tessellate_with_topology`.
  - Worker capability flag `exactCadTopology`.
  - Runtime symbol probing and explicit fallback status.
- Remaining:
  - Populate `topology` from wasm once runtime exports topology entrypoint.
- Fallback/blockers:
  - `topology` remains `null` when runtime topology symbol is missing.

## Phase B Progress
- Implemented:
  - `mesh-loader.ts` now supports `loadCadAssemblyWithTopology(...)`.
  - `WorkerCapabilities` includes `exactCadTopology`.
  - `loadCadAssemblyFile(...)` remains stable via compatibility wrapper.
  - Tests updated for capabilities and topology loader behavior.
- Remaining:
  - Viewer exact entity storage/picking/measurement refactor (Phases C+).
- Fallback/blockers:
  - CAD topology remains capability-gated until wasm/runtime upgrade provides exact topology export.
