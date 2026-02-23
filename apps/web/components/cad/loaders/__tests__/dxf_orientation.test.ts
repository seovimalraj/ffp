import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import { loadDxfFromArrayBuffer as loadFromFacade } from "../../dxf";
import { loadDxfFromArrayBuffer as loadFromLoader } from "../dxf";

const DXF_RECT = `0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
0
10
0
20
0
30
0
11
10
21
0
31
0
0
LINE
8
0
10
10
20
0
30
0
11
10
21
20
31
0
0
LINE
8
0
10
10
20
20
30
0
11
0
21
20
31
0
0
LINE
8
0
10
0
20
20
30
0
11
0
21
0
31
0
0
ENDSEC
0
EOF
`;

function toArrayBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

function expectBoxNear(a: THREE.Box3, b: THREE.Box3, tol = 1e-6) {
  assert.ok(a.min.distanceTo(b.min) <= tol, `min mismatch: ${a.min.toArray()}`);
  assert.ok(a.max.distanceTo(b.max) <= tol, `max mismatch: ${a.max.toArray()}`);
}

function countLineSegments(object: { children?: unknown[] }): number {
  if (!Array.isArray(object.children)) return 0;
  let total = 0;
  for (const child of object.children) {
    if (!child || typeof child !== "object") continue;
    const geometry = (child as { geometry?: any }).geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position || typeof position.count !== "number") continue;
    total += position.count / 2;
  }
  return total;
}

const DXF_HATCH_ONLY = `0
SECTION
2
ENTITIES
0
HATCH
8
0
10
0
20
0
30
0
91
1
92
2
72
0
73
1
93
4
10
0
20
0
10
40
20
0
10
40
20
20
10
0
20
20
97
0
75
0
76
1
98
0
0
ENDSEC
0
EOF
`;

describe("DXF orientation wrapper", () => {
  it("returns mirrored linework root without loader-side recentering", () => {
    const loaded = loadFromLoader(toArrayBuffer(DXF_RECT), { units: "mm" });

    assert.equal(loaded.object.scale.z, -1);
    assert.equal(loaded.object.name, "dxfLineworkMirroredRoot");
    assert.equal(loaded.object.children.length, 1);
    assert.equal(loaded.object.children[0]?.name, "dxfLinework");

    const computedBounds = new THREE.Box3().setFromObject(loaded.object);
    expectBoxNear(loaded.bounds, computedBounds);

    const size = new THREE.Vector3();
    loaded.bounds.getSize(size);
    assert.ok(size.x >= 9.9, `expected X size ~10, got ${size.x}`);
    assert.ok(size.z >= 19.9, `expected Z size ~20, got ${size.z}`);

    const center = loaded.bounds.getCenter(new THREE.Vector3());
    assert.ok(
      Math.abs(center.x - 5) <= 1e-6,
      `expected raw mirrored center X around 5, got ${center.x}`,
    );
    assert.ok(
      Math.abs(center.z + 10) <= 1e-6,
      `expected raw mirrored center Z around -10, got ${center.z}`,
    );
    assert.ok(
      Math.abs(loaded.bounds.min.y) <= 1e-6,
      `expected min Y near 0 for linework, got ${loaded.bounds.min.y}`,
    );
    assert.ok(
      Math.abs(loaded.bounds.min.x) <= 1e-6,
      `expected raw min X near 0, got ${loaded.bounds.min.x}`,
    );
    assert.ok(
      Math.abs(loaded.bounds.max.x - 10) <= 1e-6,
      `expected raw max X near 10, got ${loaded.bounds.max.x}`,
    );
    assert.ok(
      Math.abs(loaded.bounds.min.z + 20) <= 1e-6,
      `expected raw mirrored min Z near -20, got ${loaded.bounds.min.z}`,
    );
    assert.ok(
      Math.abs(loaded.bounds.max.z) <= 1e-6,
      `expected raw mirrored max Z near 0, got ${loaded.bounds.max.z}`,
    );
  });

  it("keeps facade wrapper output in parity with loader wrapper", () => {
    const buf = toArrayBuffer(DXF_RECT);
    const facade = loadFromFacade(buf, { units: "mm" });
    const loader = loadFromLoader(buf, { units: "mm" });

    assert.equal(facade.object.scale.z, -1);
    assert.equal(loader.object.scale.z, -1);
    assert.equal(facade.object.children.length, loader.object.children.length);
    assert.equal(
      facade.object.children[0]?.name,
      loader.object.children[0]?.name,
    );
    expectBoxNear(facade.bounds, loader.bounds);
    assert.equal(facade.meta.scaleToMm, loader.meta.scaleToMm);
    assert.equal(facade.meta.insUnits, loader.meta.insUnits);
  });

  it("ingests raw HATCH boundaries from array buffer supplements", () => {
    const loaded = loadFromLoader(toArrayBuffer(DXF_HATCH_ONLY), { units: "mm" });
    const size = new THREE.Vector3();
    loaded.bounds.getSize(size);

    assert.ok(size.x >= 39.9, `expected hatch width around 40mm, got ${size.x}`);
    assert.ok(size.z >= 19.9, `expected hatch height around 20mm, got ${size.z}`);
    assert.ok(
      countLineSegments(loaded.object.children[0] as { children?: unknown[] }) >= 4,
      "expected at least 4 line segments from hatch boundary",
    );
  });
});
