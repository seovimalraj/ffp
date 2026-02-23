import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseDxfFromArrayBuffer, type ParsedDxf } from "../dxf";
import { flattenDxfEntities } from "../dxf_flatten";

type Vec2 = { x: number; y: number };

function toArrayBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function polygonArea(points: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return area * 0.5;
}

function segmentEquals(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2, tol = 1e-6): boolean {
  const forward =
    Math.hypot(a0.x - b0.x, a0.y - b0.y) <= tol &&
    Math.hypot(a1.x - b1.x, a1.y - b1.y) <= tol;
  const reverse =
    Math.hypot(a0.x - b1.x, a0.y - b1.y) <= tol &&
    Math.hypot(a1.x - b0.x, a1.y - b0.y) <= tol;
  return forward || reverse;
}

function hasSegment(points: Vec2[], start: Vec2, end: Vec2, tol = 1e-6): boolean {
  if (points.length < 2) return false;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    if (segmentEquals(points[i], points[next], start, end, tol)) return true;
  }
  return false;
}

function orientation(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a: Vec2, b: Vec2, c: Vec2, eps: number): boolean {
  return (
    Math.min(a.x, c.x) - eps <= b.x &&
    b.x <= Math.max(a.x, c.x) + eps &&
    Math.min(a.y, c.y) - eps <= b.y &&
    b.y <= Math.max(a.y, c.y) + eps
  );
}

function segmentsIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2, eps: number): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if ((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) {
    if ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps)) {
      return true;
    }
  }

  if (Math.abs(o1) <= eps && onSegment(a1, b1, a2, eps)) return true;
  if (Math.abs(o2) <= eps && onSegment(a1, b2, a2, eps)) return true;
  if (Math.abs(o3) <= eps && onSegment(b1, a1, b2, eps)) return true;
  if (Math.abs(o4) <= eps && onSegment(b1, a2, b2, eps)) return true;
  return false;
}

function assertNoDuplicateConsecutive(points: Vec2[], eps = 1e-7): void {
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    const distance = Math.hypot(
      points[i].x - points[next].x,
      points[i].y - points[next].y,
    );
    assert.ok(distance > eps, `duplicate consecutive points at index ${i}`);
  }
}

function assertNoSelfIntersections(points: Vec2[], eps = 1e-7): void {
  if (points.length < 4) return;
  const edgeCount = points.length;
  for (let i = 0; i < edgeCount; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % edgeCount];
    for (let j = i + 1; j < edgeCount; j++) {
      const b1 = points[j];
      const b2 = points[(j + 1) % edgeCount];

      const adjacent =
        i === j ||
        (i + 1) % edgeCount === j ||
        i === (j + 1) % edgeCount;
      if (adjacent) continue;
      if (i === 0 && j === edgeCount - 1) continue;

      const intersects = segmentsIntersect(a1, a2, b1, b2, eps);
      assert.equal(intersects, false, `self-intersection between edges ${i} and ${j}`);
    }
  }
}

function flatten(dxf: ParsedDxf) {
  return flattenDxfEntities(dxf, {
    scaleToMm: 1,
    chordalToleranceMm: 0.05,
    lineworkJoinToleranceMm: 0.2,
  });
}

function lineEdges(points: Vec2[]): Array<{ edgeType: "LINE"; start: Vec2; end: Vec2 }> {
  const edges: Array<{ edgeType: "LINE"; start: Vec2; end: Vec2 }> = [];
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    edges.push({ edgeType: "LINE", start: points[i], end: points[next] });
  }
  return edges;
}

describe("DXF width/bulge regressions", () => {
  it("expands open LWPOLYLINE width to closed outlines without centerline artifacts", () => {
    const dxf: ParsedDxf = {
      entities: [
        {
          type: "LWPOLYLINE",
          shape: false,
          width: 4,
          vertices: [
            { x: 0, y: 0, startWidth: 4, endWidth: 4 },
            { x: 30, y: 0, startWidth: 4, endWidth: 4 },
          ],
        },
      ],
    };

    const flattened = flatten(dxf);
    assert.ok(flattened.polylines.length > 0);
    assert.equal(flattened.polylines.every((polyline) => polyline.closed), true);

    for (const polyline of flattened.polylines) {
      assertNoDuplicateConsecutive(polyline.points);
      assertNoSelfIntersections(polyline.points);
      assert.equal(
        hasSegment(polyline.points, { x: 0, y: 0 }, { x: 30, y: 0 }, 1e-4),
        false,
        "widened output must not contain raw centerline segment",
      );
    }
  });

  it("keeps bulge side stable under mirrored INSERT transforms", () => {
    const makeFixture = (xScale: number): ParsedDxf => ({
      entities: [{ type: "INSERT", name: "BULGE_BLOCK", xScale, yScale: 1 }],
      blocks: {
        BULGE_BLOCK: {
          name: "BULGE_BLOCK",
          entities: [
            {
              type: "LWPOLYLINE",
              shape: false,
              vertices: [
                { x: 0, y: 0, bulge: 1 },
                { x: 20, y: 0 },
              ],
            },
          ],
        },
      },
    });

    const normal = flatten(makeFixture(1)).polylines[0]?.points ?? [];
    const mirrored = flatten(makeFixture(-1)).polylines[0]?.points ?? [];
    assert.ok(normal.length > 10);
    assert.ok(mirrored.length > 10);

    const normalExtremum = normal.reduce((best, point) =>
      Math.abs(point.y) > Math.abs(best) ? point.y : best,
    0);
    const mirroredExtremum = mirrored.reduce((best, point) =>
      Math.abs(point.y) > Math.abs(best) ? point.y : best,
    0);
    assert.ok(
      Math.abs(normalExtremum + mirroredExtremum) <= 1e-6,
      `expected mirrored bulge sweep side to invert once, got ${normalExtremum} vs ${mirroredExtremum}`,
    );

    const normalMinX = Math.min(...normal.map((point) => point.x));
    const normalMaxX = Math.max(...normal.map((point) => point.x));
    const mirroredMinX = Math.min(...mirrored.map((point) => point.x));
    const mirroredMaxX = Math.max(...mirrored.map((point) => point.x));
    assert.ok(Math.abs(mirroredMinX + normalMaxX) <= 1e-6);
    assert.ok(Math.abs(mirroredMaxX + normalMinX) <= 1e-6);
  });

  it("patches classic POLYLINE width from raw DXF groups and expands it", () => {
    const raw = `0
SECTION
2
ENTITIES
0
POLYLINE
5
10
8
0
66
1
70
0
40
2
41
2
0
VERTEX
8
0
10
0
20
0
40
2
41
2
0
VERTEX
8
0
10
25
20
0
40
2
41
2
0
SEQEND
0
ENDSEC
0
EOF
`;

    const parsed = parseDxfFromArrayBuffer(toArrayBuffer(raw)).dxf;
    const polyline = (parsed.entities ?? []).find(
      (entity) => entity.type === "POLYLINE",
    ) as { vertices?: Array<{ startWidth?: number; endWidth?: number }> } | undefined;
    assert.ok(polyline, "expected POLYLINE entity");
    assert.ok(Array.isArray(polyline!.vertices));
    assert.equal(polyline!.vertices![0].startWidth, 2);
    assert.equal(polyline!.vertices![0].endWidth, 2);

    const flattened = flatten(parsed);
    assert.ok(flattened.polylines.length > 0);
    assert.equal(flattened.polylines.every((entry) => entry.closed), true);
  });

  it("normalizes loop winding for hatch outer/hole pairs", () => {
    const outer = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 60 },
      { x: 0, y: 60 },
    ];
    const inner = [
      { x: 25, y: 20 },
      { x: 55, y: 20 },
      { x: 55, y: 40 },
      { x: 25, y: 40 },
    ];
    const dxf: ParsedDxf = {
      entities: [
        {
          type: "HATCH",
          boundaryPaths: [
            { edges: lineEdges(outer) },
            { edges: lineEdges(inner) },
          ],
        },
      ],
    };

    const loops = flatten(dxf).polylines.filter((polyline) => polyline.closed);
    assert.equal(loops.length, 2);
    const areas = loops.map((loop) => polygonArea(loop.points));
    const outerArea = areas.reduce((acc, area) => (Math.abs(area) > Math.abs(acc) ? area : acc), 0);
    const holeArea = areas.find((area) => area !== outerArea) ?? 0;
    assert.ok(outerArea > 0, `expected outer loop CCW area > 0, got ${outerArea}`);
    assert.ok(holeArea < 0, `expected hole loop CW area < 0, got ${holeArea}`);
  });
});
