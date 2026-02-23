import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import {
  buildLineworkFromDxf,
  parseDxfFromArrayBuffer,
  type ParsedDxf,
} from "../dxf";
import { buildSolidFromDxf } from "../dxf_solid";

type Vec2 = { x: number; y: number };

type HatchLineEdge = {
  edgeType: "LINE";
  start: Vec2;
  end: Vec2;
};

function toArrayBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function makeLineEdges(points: Vec2[]): HatchLineEdge[] {
  const edges: HatchLineEdge[] = [];
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    edges.push({ edgeType: "LINE", start: points[i], end: points[next] });
  }
  return edges;
}

function reorderForStitch(edges: HatchLineEdge[]): HatchLineEdge[] {
  if (edges.length < 4) return edges;
  return [edges[2], edges[0], edges[3], edges[1], ...edges.slice(4)];
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

function hasLineSegment(
  object: { children?: unknown[] },
  a: Vec2,
  b: Vec2,
  tol = 1e-6,
): boolean {
  if (!Array.isArray(object.children)) return false;
  for (const child of object.children) {
    if (!child || typeof child !== "object") continue;
    const geometry = (child as { geometry?: any }).geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position || typeof position.count !== "number") continue;
    for (let i = 0; i < position.count; i += 2) {
      const p0: Vec2 = { x: position.getX(i), y: position.getZ(i) };
      const p1: Vec2 = { x: position.getX(i + 1), y: position.getZ(i + 1) };
      const forward =
        Math.hypot(p0.x - a.x, p0.y - a.y) <= tol &&
        Math.hypot(p1.x - b.x, p1.y - b.y) <= tol;
      const reverse =
        Math.hypot(p0.x - b.x, p0.y - b.y) <= tol &&
        Math.hypot(p1.x - a.x, p1.y - a.y) <= tol;
      if (forward || reverse) return true;
    }
  }
  return false;
}

function hasVertex(
  object: { children?: unknown[] },
  target: Vec2,
  tol = 1e-6,
): boolean {
  if (!Array.isArray(object.children)) return false;
  for (const child of object.children) {
    if (!child || typeof child !== "object") continue;
    const geometry = (child as { geometry?: any }).geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position || typeof position.count !== "number") continue;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getZ(i);
      if (Math.hypot(x - target.x, y - target.y) <= tol) {
        return true;
      }
    }
  }
  return false;
}

function boundsSize(bounds: THREE.Box3): THREE.Vector3 {
  const size = new THREE.Vector3();
  bounds.getSize(size);
  return size;
}

function castTopDownHits(mesh: THREE.Mesh, x: number, z: number): number {
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(x, 20, z),
    new THREE.Vector3(0, -1, 0),
    0,
    100,
  );
  return ray.intersectObject(mesh, true).length;
}

const solidOpts = {
  thicknessMm: 2,
  joinToleranceMm: 0.2,
  edgeThresholdDeg: 25,
  chordalToleranceMm: 0.1,
};

function hasNamedChild(root: THREE.Object3D, name: string): boolean {
  let found = false;
  root.traverse((obj) => {
    if (obj.name === name) found = true;
  });
  return found;
}

const DXF_EVEN_ODD_SAME_WINDING = `0
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
11
80
21
0
0
LINE
8
0
10
80
20
0
11
80
21
50
0
LINE
8
0
10
80
20
50
11
0
21
50
0
LINE
8
0
10
0
20
50
11
0
21
0
0
LINE
8
0
10
18
20
8
11
36
21
8
0
LINE
8
0
10
36
20
8
11
36
21
26
0
LINE
8
0
10
36
20
26
11
18
21
26
0
LINE
8
0
10
18
20
26
11
18
21
8
0
ENDSEC
0
EOF
`;

const DXF_SLOT_EPSILON_GAP = `0
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
11
100
21
0
0
LINE
8
0
10
100
20
0
11
100
21
70
0
LINE
8
0
10
100
20
70
11
0
21
70
0
LINE
8
0
10
0
20
70
11
0
21
0
0
LINE
8
0
10
45
20
18
11
65
21
18
0
LINE
8
0
10
65.03
20
18.02
11
65
21
28
0
LINE
8
0
10
65
20
28
11
45.02
21
28.01
0
LINE
8
0
10
44.99
20
27.98
11
45
21
18.03
0
ENDSEC
0
EOF
`;

function slotPlateFixture(): ParsedDxf {
  const slotLoop = [
    { x: 45, y: 30 },
    { x: 75, y: 30 },
    { x: 75, y: 50 },
    { x: 45, y: 50 },
  ];

  const slotEdges = reorderForStitch(makeLineEdges(slotLoop));

  return {
    entities: [
      {
        type: "INSERT",
        name: "SLOT_PART",
        position: { x: 0, y: 0 },
      },
    ],
    blocks: {
      SLOT_PART: {
        name: "SLOT_PART",
        basePoint: { x: 0, y: 0 },
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 120, y: 0 },
              { x: 120, y: 80 },
              { x: 0, y: 80 },
            ],
          },
          {
            type: "HATCH",
            boundaryPaths: [
              {
                edges: slotEdges,
              },
            ],
          },
          { type: "CIRCLE", center: { x: 25, y: 40 }, radius: 8 },
          { type: "CIRCLE", center: { x: 95, y: 40 }, radius: 8 },
        ],
      },
    },
  } as ParsedDxf;
}

function cBracketFixture(): ParsedDxf {
  const outer = [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 120, y: 20 },
    { x: 40, y: 20 },
    { x: 40, y: 100 },
    { x: 120, y: 100 },
    { x: 120, y: 120 },
    { x: 0, y: 120 },
  ];

  const outerEdges = reorderForStitch(makeLineEdges(outer));

  return {
    entities: [
      {
        type: "HATCH",
        boundaryLoops: [
          {
            edgeList: outerEdges,
          },
          {
            boundaryEdges: [
              {
                edgeType: "CIRCLE",
                center: { x: 20, y: 60 },
                radius: 8,
                clockwise: true,
              },
            ],
          },
        ],
      },
    ],
  };
}

function insertArrayFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "INSERT",
        name: "ARRAY_CELL",
        position: { x: 0, y: 0 },
        columnCount: 3,
        rowCount: 2,
        columnSpacing: 20,
        rowSpacing: 15,
      },
    ],
    blocks: {
      ARRAY_CELL: {
        name: "ARRAY_CELL",
        entities: [
          {
            type: "LINE",
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
          },
        ],
      },
    },
  } as ParsedDxf;
}

function holeOnlyFixture(): ParsedDxf {
  return {
    entities: [
      { type: "CIRCLE", center: { x: 10, y: 10 }, radius: 4 },
      { type: "CIRCLE", center: { x: 30, y: 10 }, radius: 4 },
    ],
  };
}

function bulgeClosedFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0, bulge: 0.35 },
          { x: 80, y: 0 },
          { x: 40, y: 45 },
        ],
      },
    ],
  };
}

function mixedBulgePolylineFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        shape: true,
        vertices: [
          { x: 0, y: 0, bulge: 0 },
          { x: 120, y: 0, bulge: 0.6 },
          { x: 120, y: 60, bulge: 0 },
          { x: 0, y: 60, bulge: -0.6 },
        ],
      },
    ],
  };
}

function majorBulgeLwPolylineFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        vertices: [
          { x: -1, y: 0, bulge: 2.41421356 },
          { x: 1, y: 0 },
        ],
      },
    ],
  };
}

function majorBulgePolylineFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "POLYLINE",
        vertices: [
          { x: -1, y: 0, bulge: -2.41421356 },
          { x: 1, y: 0 },
        ],
      },
    ],
  };
}

function circleDensityFixture(): ParsedDxf {
  return {
    entities: [
      { type: "CIRCLE", center: { x: 0, y: 0 }, radius: 20 },
    ],
  };
}

function arcDensityFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "ARC",
        center: { x: 0, y: 0 },
        radius: 20,
        startAngle: 0,
        endAngle: 90,
      },
    ],
  };
}

function ellipseDensityFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "ELLIPSE",
        center: { x: 0, y: 0 },
        majorAxisEndPoint: { x: 30, y: 0 },
        axisRatio: 0.45,
        startAngle: 0,
        endAngle: Math.PI * 2,
      },
    ],
  };
}

function splineDensityFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "SPLINE",
        controlPoints: [
          { x: 0, y: 0 },
          { x: 20, y: 40 },
          { x: 40, y: -30 },
          { x: 60, y: 25 },
          { x: 80, y: 0 },
        ],
      },
    ],
  };
}

function lineVerticesRectangleFixture(): ParsedDxf {
  return {
    entities: [
      { type: "LINE", vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { type: "LINE", vertices: [{ x: 100, y: 0 }, { x: 100, y: 40 }] },
      { type: "LINE", vertices: [{ x: 100, y: 40 }, { x: 0, y: 40 }] },
      { type: "LINE", vertices: [{ x: 0, y: 40 }, { x: 0, y: 0 }] },
    ],
  };
}

function flagClosedTriangleFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 40, y: 50 },
        ],
      },
    ],
  };
}

function mixedModelPaperFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 60 },
          { x: 0, y: 60 },
        ],
      },
      {
        type: "CIRCLE",
        center: { x: 1000, y: 1000 },
        radius: 60,
        inPaperSpace: true,
      },
      {
        type: "ARC",
        center: { x: 900, y: 900 },
        radius: 40,
        startAngle: 0,
        endAngle: 180,
        paperSpace: true,
      },
    ],
  };
}

function viewportFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "VIEWPORT",
        center: { x: 500, y: 500 },
        width: 400,
        height: 300,
      },
      {
        type: "LINE",
        start: { x: 0, y: 0 },
        end: { x: 40, y: 0 },
      },
    ],
  };
}

function blocksModelIsolationFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 20 },
          { x: 0, y: 20 },
        ],
      },
      {
        type: "INSERT",
        name: "BIG_BLOCK",
        inPaperSpace: true,
        position: { x: 0, y: 0 },
      },
    ],
    blocks: {
      BIG_BLOCK: {
        name: "BIG_BLOCK",
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 500, y: 0 },
              { x: 500, y: 500 },
              { x: 0, y: 500 },
            ],
          },
        ],
      },
      ORPHAN_BLOCK: {
        name: "ORPHAN_BLOCK",
        entities: [{ type: "CIRCLE", center: { x: 1000, y: 1000 }, radius: 80 }],
      },
    },
  } as ParsedDxf;
}

function detachedClusterFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 120, y: 0 },
          { x: 120, y: 80 },
          { x: 0, y: 80 },
        ],
      },
      { type: "CIRCLE", center: { x: 320, y: 40 }, radius: 10 },
    ],
  };
}

function multiTopLevelFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 120, y: 0 },
          { x: 120, y: 80 },
          { x: 0, y: 80 },
        ],
      },
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 180, y: 0 },
          { x: 280, y: 0 },
          { x: 280, y: 70 },
          { x: 180, y: 70 },
        ],
      },
      { type: "CIRCLE", center: { x: 30, y: 40 }, radius: 10 },
    ],
  };
}

function orphanSmallLoopFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 120, y: 0 },
          { x: 120, y: 80 },
          { x: 0, y: 80 },
        ],
      },
      { type: "CIRCLE", center: { x: 122.3, y: 40 }, radius: 2 },
    ],
  };
}

function mixedHoleSourcesFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 220, y: 0 },
          { x: 220, y: 120 },
          { x: 0, y: 120 },
        ],
      },
      { type: "CIRCLE", center: { x: 30, y: 30 }, radius: 6 },
      { type: "CIRCLE", center: { x: 30, y: 30 }, radius: 6 }, // duplicate
      {
        type: "ARC",
        center: { x: 60, y: 30 },
        radius: 6,
        startAngle: 45,
        endAngle: 45,
      },
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 84, y: 24 },
          { x: 96, y: 24 },
          { x: 96, y: 36 },
          { x: 84, y: 36 },
        ],
      },
      {
        type: "HATCH",
        boundaryLoops: [
          {
            boundaryEdges: [
              { edgeType: "CIRCLE", center: { x: 120, y: 30 }, radius: 6 },
            ],
          },
          {
            boundaryEdges: [
              { edgeType: "CIRCLE", center: { x: 150, y: 30 }, radius: 6 },
            ],
          },
        ],
      },
    ],
  };
}

function fullCircleArcEdgeCasesFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 140, y: 0 },
          { x: 140, y: 80 },
          { x: 0, y: 80 },
        ],
      },
      {
        type: "ARC",
        center: { x: 40, y: 40 },
        radius: 8,
        startAngle: 0,
        endAngle: 360,
      },
      {
        type: "ARC",
        center: { x: 80, y: 40 },
        radius: 8,
        startAngle: 270,
        endAngle: 270,
      },
    ],
  };
}

function nestedInsertHoleFixture(): ParsedDxf {
  return {
    entities: [{ type: "INSERT", name: "PART_A", position: { x: 0, y: 0 } }],
    blocks: {
      PART_A: {
        name: "PART_A",
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 140, y: 0 },
              { x: 140, y: 80 },
              { x: 0, y: 80 },
            ],
          },
          { type: "INSERT", name: "HOLE_B", position: { x: 0, y: 0 } },
        ],
      },
      HOLE_B: {
        name: "HOLE_B",
        entities: [{ type: "INSERT", name: "HOLE_C", position: { x: 0, y: 0 } }],
      },
      HOLE_C: {
        name: "HOLE_C",
        entities: [{ type: "CIRCLE", center: { x: 60, y: 40 }, radius: 10 }],
      },
    },
  } as ParsedDxf;
}

function insertBasePointTransformFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "INSERT",
        name: "BASE_BLOCK",
        position: { x: 100, y: 50 },
        rotation: 90,
        xScale: 2,
        yScale: 1,
      },
    ],
    blocks: {
      BASE_BLOCK: {
        name: "BASE_BLOCK",
        basePoint: { x: 5, y: 5 },
        entities: [
          {
            type: "LINE",
            start: { x: 5, y: 5 },
            end: { x: 15, y: 5 },
          },
        ],
      },
    },
  } as ParsedDxf;
}

function nestedMirroredInsertFixture(): ParsedDxf {
  return {
    entities: [{ type: "INSERT", name: "PARENT_BLOCK", position: { x: 100, y: 0 } }],
    blocks: {
      PARENT_BLOCK: {
        name: "PARENT_BLOCK",
        entities: [
          {
            type: "INSERT",
            name: "CHILD_BLOCK",
            position: { x: 20, y: 0 },
            xScale: -1,
            yScale: 1,
          },
        ],
      },
      CHILD_BLOCK: {
        name: "CHILD_BLOCK",
        entities: [
          {
            type: "LINE",
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
          },
        ],
      },
    },
  } as ParsedDxf;
}

function layerVisibilityFixture(): ParsedDxf {
  return {
    entities: [
      { type: "LINE", layer: "CUT", start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
      { type: "LINE", layer: "OFF_LAYER", start: { x: 0, y: 20 }, end: { x: 40, y: 20 } },
      {
        type: "LINE",
        layer: "FROZEN_LAYER",
        start: { x: 0, y: 40 },
        end: { x: 40, y: 40 },
      },
    ],
    tables: {
      layer: {
        layers: {
          CUT: { visible: true, frozen: false },
          OFF_LAYER: { visible: false, frozen: false },
          FROZEN_LAYER: { visible: true, frozen: true },
        },
      },
    },
  } as ParsedDxf;
}

function ocsMirroredCircleFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "CIRCLE",
        center: { x: 20, y: 0, z: 0 },
        radius: 5,
        extrusionDirectionX: 0,
        extrusionDirectionY: 0,
        extrusionDirectionZ: -1,
      },
    ],
  } as ParsedDxf;
}

function hatchMultiIslandFixture(): ParsedDxf {
  const outer = [
    { x: 0, y: 0 },
    { x: 160, y: 0 },
    { x: 160, y: 100 },
    { x: 0, y: 100 },
  ];
  return {
    entities: [
      {
        type: "HATCH",
        boundaryPaths: [
          { edgeList: reorderForStitch(makeLineEdges(outer)) },
          {
            boundaryEdges: [
              { edgeType: "CIRCLE", center: { x: 50, y: 50 }, radius: 8 },
            ],
          },
          {
            boundaryEdges: [
              { edgeType: "CIRCLE", center: { x: 110, y: 50 }, radius: 8 },
            ],
          },
        ],
      },
    ],
  };
}

function nearBoundaryCircleFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 80 },
          { x: 0, y: 80 },
        ],
      },
      // tangent to left boundary (valid)
      { type: "CIRCLE", center: { x: 10, y: 40 }, radius: 10 },
      // intersects left boundary (invalid)
      { type: "CIRCLE", center: { x: 5, y: 40 }, radius: 10 },
    ],
  };
}

function annotationFixture(): ParsedDxf {
  return {
    entities: [
      { type: "LINE", layer: "CUT", start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
      {
        type: "LINE",
        layer: "DIMENSIONS",
        start: { x: 0, y: 10 },
        end: { x: 40, y: 10 },
      },
      {
        type: "LINE",
        layer: "CUT",
        lineType: "CENTER",
        start: { x: 0, y: 20 },
        end: { x: 40, y: 20 },
      },
      { type: "TEXT", layer: "TEXT", text: "NOTE", startPoint: { x: 10, y: 30 } },
    ],
  };
}

function consumedSuppressionFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 60 },
          { x: 0, y: 60 },
        ],
      },
      { type: "LINE", layer: "CUT", start: { x: 10, y: 30 }, end: { x: 90, y: 30 } },
    ],
  };
}

describe("DXF robustness", () => {
  it("renders slot plate with full boundary + slot + holes", () => {
    const dxf = slotPlateFixture();

    const { object, bounds } = buildLineworkFromDxf(dxf, 1);
    const size = new THREE.Vector3();
    bounds.getSize(size);

    assert.ok(size.x >= 119.9);
    assert.ok(size.z >= 79.9);
    assert.ok(countLineSegments(object) > 30);

    const solid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.ok(solid, "expected slot-plate solid extrusion");
  });

  it("builds clean C-bracket extrusion from unordered hatch edges", () => {
    const dxf = cBracketFixture();
    const solid = buildSolidFromDxf(dxf, 1, solidOpts);

    assert.ok(solid, "expected C-bracket solid extrusion");

    const position = solid!.mesh.geometry.getAttribute("position");
    assert.ok(position.count > 0);

    let maxAbs = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      assert.ok(Number.isFinite(x));
      assert.ok(Number.isFinite(y));
      assert.ok(Number.isFinite(z));
      maxAbs = Math.max(maxAbs, Math.abs(x), Math.abs(y), Math.abs(z));
    }
    assert.ok(maxAbs < 1e5);
  });

  it("creates a true inner void from same-winding loops via even-odd fill", () => {
    const parsed = parseDxfFromArrayBuffer(toArrayBuffer(DXF_EVEN_ODD_SAME_WINDING));
    const solid = buildSolidFromDxf(parsed.dxf, 1, solidOpts);
    assert.ok(solid, "expected same-winding rectangle-with-hole solid");

    const mesh = solid!.mesh;
    assert.ok(
      castTopDownHits(mesh, 8, 8) > 0,
      "expected solid plate hit away from the hole",
    );
    assert.equal(
      castTopDownHits(mesh, 24, 33),
      0,
      "expected through-hole at the mirrored-Z slot center",
    );
    assert.ok(
      castTopDownHits(mesh, 24, 17) > 0,
      "expected mirrored counterpart to remain solid (orientation regression guard)",
    );
  });

  it("stitches epsilon-gap slot segments into a through-hole", () => {
    const parsed = parseDxfFromArrayBuffer(toArrayBuffer(DXF_SLOT_EPSILON_GAP));
    const solid = buildSolidFromDxf(parsed.dxf, 1, solidOpts);
    assert.ok(solid, "expected epsilon-gap slot fixture to extrude");

    const mesh = solid!.mesh;
    assert.ok(
      castTopDownHits(mesh, 10, 10) > 0,
      "expected outer plate region to remain solid",
    );
    assert.equal(
      castTopDownHits(mesh, 55, 47),
      0,
      "expected stitched slot center to be a through-hole",
    );
    assert.ok(
      castTopDownHits(mesh, 55, 23) > 0,
      "expected mirrored counterpart to remain solid (orientation regression guard)",
    );
  });

  it("expands INSERT arrays for linework extents", () => {
    const dxf = insertArrayFixture();
    const { bounds } = buildLineworkFromDxf(dxf, 1);

    const size = new THREE.Vector3();
    bounds.getSize(size);

    assert.ok(size.x >= 49.9, `expected X extent around 50mm, got ${size.x}`);
    assert.ok(size.z >= 14.9, `expected Z extent around 15mm, got ${size.z}`);
  });

  it("does not extrude hole-only circles", () => {
    const dxf = holeOnlyFixture();
    const solid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.equal(solid, null);
  });

  it("supports bulge closure using closed flags", () => {
    const dxf = bulgeClosedFixture();
    const solid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.ok(solid, "expected bulge-closed polyline to extrude");
  });

  it("keeps straight edges for mixed bulge polylines", () => {
    const dxf = mixedBulgePolylineFixture();

    const { object } = buildLineworkFromDxf(dxf, 1);
    assert.ok(
      hasLineSegment(object, { x: 0, y: 0 }, { x: 120, y: 0 }),
      "expected bottom straight segment from bulge=0 pair",
    );
    assert.ok(
      hasLineSegment(object, { x: 120, y: 60 }, { x: 0, y: 60 }),
      "expected top straight segment from bulge=0 pair",
    );

    const solid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.ok(solid, "expected mixed-bulge polyline to extrude");
  });

  it("keeps open major LWPOLYLINE bulge arcs anchored to endpoints without chord", () => {
    const dxf = majorBulgeLwPolylineFixture();
    const { object } = buildLineworkFromDxf(dxf, 1);

    assert.ok(hasVertex(object, { x: -1, y: 0 }));
    assert.ok(hasVertex(object, { x: 1, y: 0 }));
    assert.equal(
      hasLineSegment(object, { x: -1, y: 0 }, { x: 1, y: 0 }),
      false,
      "major bulge segment should not emit the straight chord",
    );
  });

  it("keeps open major POLYLINE bulge arcs anchored to endpoints without chord", () => {
    const dxf = majorBulgePolylineFixture();
    const { object } = buildLineworkFromDxf(dxf, 1);

    assert.ok(hasVertex(object, { x: -1, y: 0 }));
    assert.ok(hasVertex(object, { x: 1, y: 0 }));
    assert.equal(
      hasLineSegment(object, { x: -1, y: 0 }, { x: 1, y: 0 }),
      false,
      "major bulge segment should not emit the straight chord",
    );
  });

  it("uses high-resolution tessellation for circles, arcs, ellipses, and splines", () => {
    const circle = buildLineworkFromDxf(circleDensityFixture(), 1);
    assert.ok(
      countLineSegments(circle.object) >= 144,
      `expected full circle tessellation >= 144 segments, got ${countLineSegments(circle.object)}`,
    );

    const arc = buildLineworkFromDxf(arcDensityFixture(), 1);
    assert.ok(
      countLineSegments(arc.object) >= 36,
      `expected 90deg arc tessellation >= 36 segments, got ${countLineSegments(arc.object)}`,
    );

    const ellipse = buildLineworkFromDxf(ellipseDensityFixture(), 1);
    assert.ok(
      countLineSegments(ellipse.object) >= 144,
      `expected full ellipse tessellation >= 144 segments, got ${countLineSegments(ellipse.object)}`,
    );

    const spline = buildLineworkFromDxf(splineDensityFixture(), 1);
    assert.ok(
      countLineSegments(spline.object) >= 200,
      `expected spline tessellation >= 200 segments, got ${countLineSegments(spline.object)}`,
    );
  });

  it("supports parser-shaped LINE entities with vertices[] endpoints", () => {
    const dxf = lineVerticesRectangleFixture();

    const { object, bounds } = buildLineworkFromDxf(dxf, 1);
    const size = new THREE.Vector3();
    bounds.getSize(size);

    assert.ok(size.x >= 99.9);
    assert.ok(size.z >= 39.9);
    assert.ok(countLineSegments(object) >= 4);
    assert.ok(
      hasLineSegment(object, { x: 0, y: 0 }, { x: 100, y: 0 }),
      "expected first rectangle edge from LINE.vertices fallback",
    );

    const solid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.ok(solid, "expected LINE.vertices rectangle to extrude");
  });

  it("closes polylines via closed flags even without repeated endpoint", () => {
    const dxf = flagClosedTriangleFixture();

    const { object } = buildLineworkFromDxf(dxf, 1);
    assert.equal(countLineSegments(object), 3);
    assert.ok(
      hasLineSegment(object, { x: 40, y: 50 }, { x: 0, y: 0 }),
      "expected last->first closing segment from closed flag",
    );

    const solid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.ok(solid, "expected closed-flag triangle to extrude");
  });

  it("ignores paper-space entities for both linework and solid", () => {
    const dxf = mixedModelPaperFixture();

    const linework = buildLineworkFromDxf(dxf, 1);
    const lineworkSize = boundsSize(linework.bounds);
    assert.ok(lineworkSize.x >= 99.9);
    assert.ok(lineworkSize.z >= 59.9);
    assert.ok(
      lineworkSize.x <= 120,
      `paper-space entities should not inflate X extent, got ${lineworkSize.x}`,
    );
    assert.ok(
      lineworkSize.z <= 90,
      `paper-space entities should not inflate Z extent, got ${lineworkSize.z}`,
    );

    const solid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.ok(solid, "expected model-space rectangle to extrude");
    const solidSize = boundsSize(solid!.bounds);
    assert.ok(solidSize.x >= 99.9);
    assert.ok(solidSize.z >= 59.9);
    assert.ok(
      solidSize.x <= 120,
      `paper-space entities should not affect solid X extent, got ${solidSize.x}`,
    );
    assert.ok(
      solidSize.z <= 90,
      `paper-space entities should not affect solid Z extent, got ${solidSize.z}`,
    );
  });

  it("ignores VIEWPORT entities", () => {
    const dxf = viewportFixture();
    const { object, bounds } = buildLineworkFromDxf(dxf, 1);
    const size = boundsSize(bounds);

    assert.ok(size.x >= 39.9);
    assert.ok(size.z <= 1e-6);
    assert.equal(countLineSegments(object), 1);
  });

  it("renders only model entities, not top-level blocks or paper-space inserts", () => {
    const dxf = blocksModelIsolationFixture();

    const { bounds: lineworkBounds } = buildLineworkFromDxf(dxf, 1);
    const lineworkSize = boundsSize(lineworkBounds);
    assert.ok(lineworkSize.x >= 39.9);
    assert.ok(lineworkSize.z >= 19.9);
    assert.ok(
      lineworkSize.x <= 60,
      `block definitions/paper-space inserts should not inflate X extent, got ${lineworkSize.x}`,
    );
    assert.ok(
      lineworkSize.z <= 40,
      `block definitions/paper-space inserts should not inflate Z extent, got ${lineworkSize.z}`,
    );

    const solid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.ok(solid, "expected model-space rectangle to extrude");
    const solidSize = boundsSize(solid!.bounds);
    assert.ok(solidSize.x >= 39.9);
    assert.ok(solidSize.z >= 19.9);
    assert.ok(
      solidSize.x <= 60,
      `block definitions/paper-space inserts should not affect solid X extent, got ${solidSize.x}`,
    );
    assert.ok(
      solidSize.z <= 40,
      `block definitions/paper-space inserts should not affect solid Z extent, got ${solidSize.z}`,
    );
  });

  it("extrudes only the main cluster when detached loops exist", () => {
    const dxf = detachedClusterFixture();
    const solid = buildSolidFromDxf(dxf, 1, solidOpts);

    assert.ok(solid, "expected main-part solid extrusion");
    const size = boundsSize(solid!.bounds);
    assert.ok(size.x >= 119.9);
    assert.ok(size.z >= 79.9);
    assert.ok(
      size.x <= 140,
      `detached loops should not be extruded into solid bounds, got X=${size.x}`,
    );
  });

  it("keeps building the dominant part when multiple top-level loops are significant", () => {
    const dxf = multiTopLevelFixture();
    const solid = buildSolidFromDxf(dxf, 1, solidOpts);

    assert.ok(solid, "expected dominant-part solid extrusion");
    const size = boundsSize(solid!.bounds);
    assert.ok(size.x >= 119.9);
    assert.ok(size.z >= 79.9);
    assert.ok(
      size.x <= 140,
      `secondary top-level loop should not be merged into bounds, got X=${size.x}`,
    );
  });

  it("discards tiny orphan outer loops inside the chosen cluster", () => {
    const dxf = orphanSmallLoopFixture();
    const solid = buildSolidFromDxf(dxf, 1, solidOpts);

    assert.ok(solid, "expected main-part solid extrusion");
    const size = boundsSize(solid!.bounds);
    assert.ok(size.x >= 119.9);
    assert.ok(size.z >= 79.9);
    assert.ok(
      size.x <= 121,
      `tiny orphan loops should be rejected from solid extrusion, got X=${size.x}`,
    );
  });

  it("extracts mixed hole sources and deduplicates repeated circles", () => {
    const dxf = mixedHoleSourcesFixture();
    const solid = buildSolidFromDxf(dxf, 1, {
      ...solidOpts,
      debugMetrics: true,
    });
    assert.ok(solid, "expected mixed-hole source solid");
    assert.ok(solid!.debugMetrics, "expected debug metrics payload");
    assert.equal(solid!.debugMetrics!.holesSubtracted, 5);
    assert.ok(solid!.debugMetrics!.circlesFound >= 2);
    assert.ok(solid!.debugMetrics!.fullCircleArcsFound >= 1);
  });

  it("recognizes full-circle ARC edge cases", () => {
    const dxf = fullCircleArcEdgeCasesFixture();
    const solid = buildSolidFromDxf(dxf, 1, {
      ...solidOpts,
      debugMetrics: true,
    });
    assert.ok(solid, "expected full-circle arc fixture to extrude");
    assert.ok(solid!.debugMetrics);
    assert.ok(solid!.debugMetrics!.fullCircleArcsFound >= 2);
  });

  it("expands nested INSERT blocks recursively for hole extraction", () => {
    const dxf = nestedInsertHoleFixture();
    const solid = buildSolidFromDxf(dxf, 1, {
      ...solidOpts,
      debugMetrics: true,
    });
    assert.ok(solid, "expected nested insert solid");
    assert.ok(solid!.debugMetrics);
    assert.ok(solid!.debugMetrics!.circlesFound >= 1);
    assert.ok(solid!.debugMetrics!.holesSubtracted >= 1);
  });

  it("applies INSERT matrix with block basePoint offset", () => {
    const dxf = insertBasePointTransformFixture();
    const { object } = buildLineworkFromDxf(dxf, 1);
    assert.ok(
      hasLineSegment(object, { x: 100, y: 50 }, { x: 100, y: 70 }),
      "expected transformed segment using T*R*S*T(-basePoint)",
    );
  });

  it("preserves nested INSERT mirroring from negative scales", () => {
    const dxf = nestedMirroredInsertFixture();
    const { object, bounds } = buildLineworkFromDxf(dxf, 1);
    const size = boundsSize(bounds);
    assert.ok(size.x >= 9.9, `expected mirrored line length around 10mm, got ${size.x}`);
    assert.ok(
      hasLineSegment(object, { x: 110, y: 0 }, { x: 120, y: 0 }),
      "expected mirrored nested insert segment in world coordinates",
    );
  });

  it("skips OFF/FROZEN layers from layer table flags", () => {
    const dxf = layerVisibilityFixture();
    const { object, bounds } = buildLineworkFromDxf(dxf, 1);
    const size = boundsSize(bounds);
    assert.ok(size.x >= 39.9);
    assert.ok(size.z <= 1e-6, `expected hidden layers removed from Z extent, got ${size.z}`);
    assert.equal(countLineSegments(object), 1);
  });

  it("converts ARC/CIRCLE OCS coordinates using extrusion direction", () => {
    const dxf = ocsMirroredCircleFixture();
    const { bounds } = buildLineworkFromDxf(dxf, 1);
    assert.ok(bounds.max.x < 0, `expected OCS mirrored circle to land at negative X, got ${bounds.max.x}`);
    assert.ok(bounds.min.x <= -24.9, `expected min X around -25 after OCS transform, got ${bounds.min.x}`);
  });

  it("extracts all hatch loops including islands", () => {
    const dxf = hatchMultiIslandFixture();
    const solid = buildSolidFromDxf(dxf, 1, {
      ...solidOpts,
      debugMetrics: true,
    });
    assert.ok(solid, "expected hatch multi-island solid");
    assert.ok(solid!.debugMetrics);
    assert.ok(solid!.debugMetrics!.hatchPathCount >= 3);
    assert.ok(solid!.debugMetrics!.hatchLoopCount >= 3);
    assert.ok(solid!.debugMetrics!.holesSubtracted >= 2);
  });

  it("keeps near-boundary tangent circles but rejects intersecting circles", () => {
    const dxf = nearBoundaryCircleFixture();
    const solid = buildSolidFromDxf(dxf, 1, {
      ...solidOpts,
      debugMetrics: true,
    });
    assert.ok(solid, "expected near-boundary circle fixture to extrude");
    assert.ok(solid!.debugMetrics);
    assert.equal(solid!.debugMetrics!.holesSubtracted, 1);
  });

  it("disables solid edge overlays by default and enables them when requested", () => {
    const dxf = slotPlateFixture();
    const defaultSolid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.ok(defaultSolid);
    assert.equal(defaultSolid!.edges, undefined);
    assert.equal(hasNamedChild(defaultSolid!.mesh, "dxfSolidEdges"), false);

    const withEdges = buildSolidFromDxf(dxf, 1, {
      ...solidOpts,
      showEdgeOverlay: true,
    });
    assert.ok(withEdges);
    assert.ok(withEdges!.edges);
    assert.equal(hasNamedChild(withEdges!.mesh, "dxfSolidEdges"), true);
  });

  it("filters annotations from linework by default and restores them when enabled", () => {
    const dxf = annotationFixture();
    const defaultLinework = buildLineworkFromDxf(dxf, 1);
    const withAnnotations = buildLineworkFromDxf(dxf, 1, {
      includeAnnotations: true,
    });

    assert.equal(countLineSegments(defaultLinework.object), 1);
    assert.ok(countLineSegments(withAnnotations.object) >= 3);
  });

  it("emits debug curve markers only when window.__DXF_DEBUG_CURVES is enabled", () => {
    const fixture = majorBulgeLwPolylineFixture();
    const defaultLinework = buildLineworkFromDxf(fixture, 1);
    assert.equal(hasNamedChild(defaultLinework.object, "dxfDebug:polylineVertices"), false);
    assert.equal(hasNamedChild(defaultLinework.object, "dxfDebug:bulgeCenters"), false);

    const globalAny = globalThis as { window?: { __DXF_DEBUG_CURVES?: boolean } };
    const hadWindow = Object.prototype.hasOwnProperty.call(globalAny, "window");
    const previousWindow = globalAny.window;
    globalAny.window = { ...(previousWindow ?? {}), __DXF_DEBUG_CURVES: true };
    try {
      const withDebug = buildLineworkFromDxf(fixture, 1);
      assert.equal(hasNamedChild(withDebug.object, "dxfDebug:polylineVertices"), true);
      assert.equal(hasNamedChild(withDebug.object, "dxfDebug:bulgeCenters"), true);
    } finally {
      if (hadWindow) {
        globalAny.window = previousWindow;
      } else {
        delete globalAny.window;
      }
    }
  });

  it("suppresses consumed entities from annotation overlay linework", () => {
    const dxf = consumedSuppressionFixture();
    const solid = buildSolidFromDxf(dxf, 1, solidOpts);
    assert.ok(solid, "expected consumed suppression solid");
    assert.ok(solid!.consumedEntityUids.length > 0);

    const allLinework = buildLineworkFromDxf(dxf, 1, {
      includeAnnotations: true,
    });
    const filteredLinework = buildLineworkFromDxf(dxf, 1, {
      includeAnnotations: true,
      excludeEntityUids: solid!.consumedEntityUids,
    });

    assert.ok(
      countLineSegments(filteredLinework.object) <
        countLineSegments(allLinework.object),
    );
    assert.ok(countLineSegments(filteredLinework.object) >= 1);
  });
});
