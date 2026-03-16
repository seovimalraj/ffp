import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import {
  createCadPartKey,
  createCadModelSession,
  createMeshModelSession,
  createMeshPartKey,
  resolveObjectByPath,
} from "../model-session";

function makeMesh(name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x999999 }),
  );
  mesh.name = name;
  return mesh;
}

describe("model-session helpers", () => {
  it("creates deterministic CAD and mesh part keys", () => {
    const cadA = createCadPartKey("xcf:0:1:2");
    const cadB = createCadPartKey("xcf:0:1:2");
    const cadC = createCadPartKey("xcf:0:1:3");

    assert.equal(cadA, cadB);
    assert.notEqual(cadA, cadC);

    const meshA = createMeshPartKey([4, 2]);
    const meshB = createMeshPartKey([4, 2]);
    const meshC = createMeshPartKey([4, 1]);

    assert.equal(meshA, meshB);
    assert.notEqual(meshA, meshC);
  });

  it("builds CAD session descriptors keyed by native cad part ids", () => {
    const m1 = makeMesh("Bracket");
    m1.userData.__cadPartId = "xcf:0:1";
    const m2 = makeMesh("Bracket");
    m2.userData.__cadPartId = "xcf:0:1";
    const m3 = makeMesh("Cover");
    m3.userData.__cadPartId = "xcf:0:2";

    const sourceGroup = new THREE.Group();
    sourceGroup.name = "Assembly";
    sourceGroup.add(m1);
    sourceGroup.add(m2);
    sourceGroup.add(m3);

    const session = createCadModelSession(
      {
        object: sourceGroup,
        root: {
          name: "Assembly",
          partId: "xcf:root",
          meshes: [],
          children: [
            { name: "Bracket", partId: "xcf:0:1", meshes: [0, 1], children: [] },
            { name: "Cover", partId: "xcf:0:2", meshes: [2], children: [] },
          ],
        },
        meshes: [m1, m2, m3],
        originalBytes: new ArrayBuffer(16),
        ext: "step",
      },
      {
        ext: "step",
        originalName: "assembly.step",
      },
    );

    assert.equal(session.kind, "cad");
    assert.equal(session.partMap.size, 2);
    assert.ok(session.partMap.has("cad:xcf:0:1"));
    assert.ok(session.partMap.has("cad:xcf:0:2"));

    const bracket = session.partMap.get("cad:xcf:0:1");
    assert.equal(bracket?.kind, "cad");
    if (bracket?.kind === "cad") {
      assert.equal(bracket.cadPartId, "xcf:0:1");
      assert.deepEqual(bracket.meshIndices, [0, 1]);
    }
  });

  it("resolves object paths by child-index path", () => {
    const root = new THREE.Group();
    const a = new THREE.Group();
    const b = new THREE.Group();
    const c = new THREE.Group();

    root.add(a);
    root.add(b);
    b.add(c);

    assert.equal(resolveObjectByPath(root, [1, 0]), c);
    assert.equal(resolveObjectByPath(root, [2]), null);
    assert.equal(resolveObjectByPath(root, [-1]), null);
  });

  it("builds mesh session descriptors for top-level mesh-bearing roots", () => {
    const root = new THREE.Group();
    root.name = "assembly";

    const partA = new THREE.Group();
    partA.name = "cover";
    partA.add(makeMesh("cover-mesh"));

    const partB = new THREE.Group();
    partB.name = "bracket";
    partB.add(makeMesh("bracket-mesh"));

    const helperOnly = new THREE.Group();
    helperOnly.name = "helper";

    root.add(partA);
    root.add(partB);
    root.add(helperOnly);

    const session = createMeshModelSession(root, {
      ext: "glb",
      originalName: "gearbox.glb",
    });

    assert.equal(session.partMap.size, 2);
    assert.equal(session.kind, "mesh");
    assert.equal(session.ext, "glb");

    const displayChildren = session.displayObject?.children ?? [];
    const partKeys = displayChildren
      .map((child) => child.userData?.__partKey)
      .filter((value): value is string => typeof value === "string");
    assert.equal(partKeys.length, 2);

    for (const key of partKeys) {
      assert.ok(session.partMap.has(key), `missing descriptor for ${key}`);
    }
  });
});
