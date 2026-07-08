import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import type { ModelSession } from "../model-session";
import {
  exportSelectedPartFromSession,
  getWorkingPartExportPlan,
  inferDefaultPartExportFormat,
  resolveMeshPartObjectByPath,
  sanitizeExportFileBaseName,
  validatePartExportSelection,
} from "../exporters/part-export";
import type { WorkerCapabilities } from "../mesh-loader";

function makeSession(partKey = "mesh:0"): ModelSession {
  const root = new THREE.Group();
  const child = new THREE.Group();
  child.userData.__partKey = partKey;
  child.userData.__partKind = "mesh";
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x808080 }),
  );
  child.add(mesh);
  root.add(child);

  return {
    id: "session-1",
    kind: "mesh",
    ext: "glb",
    originalName: "assembly.glb",
    sourceObject: root,
    displayObject: root.clone(),
    partMap: new Map([
      [
        partKey,
        { key: partKey, kind: "mesh", name: "Cover Plate", objectPath: [0] },
      ],
    ]),
  };
}

function makeCadSession(partKey = "cad:xcf:0:1"): ModelSession {
  const sourceRoot = new THREE.Group();
  const part = new THREE.Group();
  part.userData.__partKey = partKey;
  part.userData.__partKind = "cad";
  part.userData.__cadPartId = "xcf:0:1";
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x999999 }),
  );
  mesh.userData.__cadPartId = "xcf:0:1";
  part.add(mesh);
  sourceRoot.add(part);

  return {
    id: "session-cad",
    kind: "cad",
    ext: "step",
    originalName: "assembly.step",
    originalBytes: new ArrayBuffer(8),
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

describe("part-export helpers", () => {
  const capsUnavailable: WorkerCapabilities = {
    exactCadPartExport: false,
    exactCadTopology: false,
    supportedExactCadFormats: [],
  };

  const capsExactAll: WorkerCapabilities = {
    exactCadPartExport: true,
    exactCadTopology: false,
    supportedExactCadFormats: ["step", "iges", "brep"],
  };

  it("sanitizes export file names", () => {
    assert.equal(
      sanitizeExportFileBaseName(" Gearbox Cover (Rev A)! "),
      "gearbox_cover_rev_a",
    );
    assert.equal(sanitizeExportFileBaseName("..."), "part");
  });

  it("resolves mesh objects by object path", () => {
    const root = new THREE.Group();
    const a = new THREE.Group();
    const b = new THREE.Group();
    root.add(a);
    a.add(b);

    assert.equal(resolveMeshPartObjectByPath(root, [0, 0]), b);
    assert.equal(resolveMeshPartObjectByPath(root, [1]), null);
  });

  it("validates selected-part export prerequisites", () => {
    const missingSession = validatePartExportSelection(null, "mesh:0");
    assert.equal(missingSession.ok, false);

    const session = makeSession();
    const missingSelection = validatePartExportSelection(session, null);
    assert.equal(missingSelection.ok, false);

    const invalidPart = validatePartExportSelection(session, "mesh:missing");
    assert.equal(invalidPart.ok, false);

    const valid = validatePartExportSelection(session, "mesh:0");
    assert.equal(valid.ok, true);
  });

  it("infers default export format by source kind", () => {
    const meshSession = makeSession();
    assert.equal(inferDefaultPartExportFormat(meshSession), "glb");

    const cadSession: ModelSession = {
      ...meshSession,
      kind: "cad",
      ext: "step",
    };
    assert.equal(inferDefaultPartExportFormat(cadSession), "step");
  });

  it("maps working export plan by source extension and worker capabilities", () => {
    const stepSession = makeCadSession();
    assert.equal(getWorkingPartExportPlan(stepSession, capsUnavailable), null);
    assert.deepEqual(getWorkingPartExportPlan(stepSession, capsExactAll), {
      mode: "exact",
      format: "step",
    });

    const igesSession: ModelSession = { ...stepSession, ext: "iges" };
    assert.equal(getWorkingPartExportPlan(igesSession, capsUnavailable), null);
    assert.deepEqual(getWorkingPartExportPlan(igesSession, capsExactAll), {
      mode: "exact",
      format: "iges",
    });

    const brepSession: ModelSession = { ...stepSession, ext: "brep" };
    assert.equal(getWorkingPartExportPlan(brepSession, capsUnavailable), null);
    assert.deepEqual(getWorkingPartExportPlan(brepSession, capsExactAll), {
      mode: "exact",
      format: "brep",
    });

    const objSession: ModelSession = { ...makeSession(), ext: "obj" };
    assert.deepEqual(getWorkingPartExportPlan(objSession, capsUnavailable), {
      mode: "mesh",
      format: "obj",
    });

    const gltfSession: ModelSession = { ...makeSession(), ext: "gltf" };
    assert.deepEqual(getWorkingPartExportPlan(gltfSession, capsUnavailable), {
      mode: "mesh",
      format: "glb",
    });

    const glbSession: ModelSession = { ...makeSession(), ext: "glb" };
    assert.deepEqual(getWorkingPartExportPlan(glbSession, capsUnavailable), {
      mode: "mesh",
      format: "glb",
    });

    const threemfSession: ModelSession = { ...makeSession(), ext: "3mf" };
    assert.deepEqual(getWorkingPartExportPlan(threemfSession, capsUnavailable), {
      mode: "mesh",
      format: "glb",
    });
  });

  it("routes exact CAD formats through worker export path", async () => {
    const session = makeCadSession();
    let capturedPayload: {
      ext: string;
      partId: string;
      format: string;
      byteLength: number;
    } | null = null;
    let downloadRecord: { filename: string; size: number; mime: string } | null =
      null;

    const result = await exportSelectedPartFromSession(
      session,
      "cad:xcf:0:1",
      { mode: "exact", format: "step" },
      {
        worker: {} as Worker,
        exportCadPartExactFn: async (_worker, payload) => {
          capturedPayload = {
            ext: payload.ext,
            partId: payload.partId,
            format: payload.format,
            byteLength: payload.buffer.byteLength,
          };
          return { format: "step", bytes: new Uint8Array([1, 2, 3]) };
        },
      triggerDownloadFn: (data, filename, mime) => {
        const blob = new Blob([data], { type: mime });
        downloadRecord = { filename, size: blob.size, mime };
      },
      },
    );

    assert.deepEqual(capturedPayload, {
      ext: "step",
      partId: "xcf:0:1",
      format: "step",
      byteLength: 8,
    });
    assert.deepEqual(result, { mode: "exact", format: "step" });
    assert.ok(downloadRecord);
    assert.equal(downloadRecord?.size, 3);
    assert.equal(downloadRecord?.mime, "model/step");
    assert.match(downloadRecord?.filename ?? "", /\.step$/i);
  });

});
