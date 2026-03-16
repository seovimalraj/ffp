import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import { triggerSelectedPartExport } from "../cad-viewer-export-controller";
import type { ModelSession } from "../model-session";
import type { PartExportPlan } from "../exporters/part-export";

function makeSession(partKey = "mesh:0"): ModelSession {
  const sourceRoot = new THREE.Group();
  const partRoot = new THREE.Group();
  partRoot.userData.__partKey = partKey;
  partRoot.userData.__partKind = "mesh";
  sourceRoot.add(partRoot);

  return {
    id: "session-123",
    kind: "mesh",
    ext: "glb",
    originalName: "assembly.glb",
    sourceObject: sourceRoot,
    displayObject: sourceRoot.clone(),
    partMap: new Map([
      [
        partKey,
        { key: partKey, kind: "mesh", name: "Cover", objectPath: [0] },
      ],
    ]),
  };
}

function makeCadSession(partKey = "cad:xcf:0:1"): ModelSession {
  const sourceRoot = new THREE.Group();
  const partRoot = new THREE.Group();
  partRoot.userData.__partKey = partKey;
  partRoot.userData.__partKind = "cad";
  partRoot.userData.__cadPartId = "xcf:0:1";
  sourceRoot.add(partRoot);

  return {
    id: "session-cad-1",
    kind: "cad",
    ext: "step",
    originalName: "assembly.step",
    sourceObject: sourceRoot,
    displayObject: sourceRoot.clone(),
    partMap: new Map([
      [
        partKey,
        {
          key: partKey,
          kind: "cad",
          name: "Bracket",
          cadPartId: "xcf:0:1",
          meshIndices: [0],
        },
      ],
    ]),
  };
}

describe("cad-viewer export controller", () => {
  it("triggers exporter with selected part key and requested format", async () => {
    const session = makeSession("mesh:12");
    const calls: Array<{
      key: string;
      plan: PartExportPlan;
      hasWorker: boolean;
    }> = [];
    const worker = {} as Worker;

    const result = await triggerSelectedPartExport({
      session,
      selectedPartKey: "mesh:12",
      plan: { mode: "mesh", format: "glb" },
      worker,
      exportPartFn: async (_session, key, plan, options) => {
        calls.push({ key, plan, hasWorker: options?.worker === worker });
        return { mode: "mesh", format: "glb" };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.exportedFormat, "glb");
    assert.equal(result.usedFallback, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].key, "mesh:12");
    assert.deepEqual(calls[0].plan, { mode: "mesh", format: "glb" });
    assert.equal(calls[0].hasWorker, true);
  });

  it("returns a clear validation message when selection is missing", async () => {
    const session = makeSession();
    const result = await triggerSelectedPartExport({
      session,
      selectedPartKey: null,
      plan: { mode: "mesh", format: "obj" },
      exportPartFn: async () => {
        throw new Error("should not run");
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.exportedFormat, null);
    assert.equal(result.usedFallback, false);
    assert.match(result.message, /select an assembly part/i);
  });

  it("returns export error message for exact CAD export failures", async () => {
    const session = makeCadSession();
    const result = await triggerSelectedPartExport({
      session,
      selectedPartKey: "cad:xcf:0:1",
      plan: { mode: "exact", format: "step" },
      worker: {} as Worker,
      exportPartFn: async () => {
        throw new Error("Exact export unavailable in runtime");
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.exportedFormat, null);
    assert.equal(result.usedFallback, false);
    assert.match(result.message, /exact export unavailable/i);
  });

  it("returns fallback metadata when exporter falls back to mesh output", async () => {
    const session = makeCadSession();
    const result = await triggerSelectedPartExport({
      session,
      selectedPartKey: "cad:xcf:0:1",
      plan: { mode: "exact", format: "step" },
      worker: {} as Worker,
      exportPartFn: async () => ({
        mode: "mesh",
        format: "stl",
        fallbackFrom: "step",
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.exportedFormat, "stl");
    assert.equal(result.usedFallback, true);
    assert.match(result.message, /stl/i);
  });
});
