import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ParsedDxf } from "./dxf";

type Vec2 = { x: number; y: number };
type Segment = { a: Vec2; b: Vec2 };

type LoopInfo = {
  points: THREE.Vector2[];
  area: number;
  index: number;
};

export type DxfSolidOptions = {
  thicknessMm: number;
  joinToleranceMm: number;
  edgeThresholdDeg?: number;
};

const CIRCLE_SEGMENTS = 96;
const SPLINE_SEGMENTS = 64;
const ELLIPSE_SEGMENTS = 64;
const ARC_SEGMENT_TARGET_LEN_MM = 2;
const MIN_ARC_SEGMENTS = 16;
const MAX_ARC_SEGMENTS = 128;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function segmentsForArcLength(radius: number, angleRad: number): number {
  const length = Math.abs(radius * angleRad);
  const segs = Math.ceil(length / ARC_SEGMENT_TARGET_LEN_MM);
  return clamp(segs, MIN_ARC_SEGMENTS, MAX_ARC_SEGMENTS);
}

function createDefaultCadMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xb8c2ff,
    metalness: 0.85,
    roughness: 0.25,
    clearcoat: 0.2,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

function addSegment(segments: Segment[], a: Vec2, b: Vec2) {
  if (a.x === b.x && a.y === b.y) return;
  segments.push({ a, b });
}

function addArcSegments(
  segments: Segment[],
  center: Vec2,
  radius: number,
  startRad: number,
  endRad: number,
  segs?: number,
) {
  if (!Number.isFinite(radius) || radius <= 0) return;
  let start = startRad;
  let end = endRad;
  let delta = end - start;
  if (delta <= 0) {
    delta += Math.PI * 2;
    end = start + delta;
  }
  const count = segs ?? segmentsForArcLength(radius, delta);
  let prev = {
    x: center.x + Math.cos(start) * radius,
    y: center.y + Math.sin(start) * radius,
  };
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const angle = start + delta * t;
    const next = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
    addSegment(segments, prev, next);
    prev = next;
  }
}

function addBulgeSegments(
  segments: Segment[],
  p0: Vec2,
  p1: Vec2,
  bulge: number,
) {
  if (!bulge || !Number.isFinite(bulge)) {
    addSegment(segments, p0, p1);
    return;
  }
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return;

  const theta = 4 * Math.atan(bulge);
  if (Math.abs(theta) < 1e-6) {
    addSegment(segments, p0, p1);
    return;
  }

  const radius = chord / (2 * Math.sin(theta / 2));
  const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const perp = { x: -dy / chord, y: dx / chord };
  const h = Math.sqrt(Math.max(0, radius * radius - (chord * chord) / 4));
  const sign = bulge >= 0 ? 1 : -1;
  const center = {
    x: mid.x + perp.x * h * sign,
    y: mid.y + perp.y * h * sign,
  };

  const startAngle = Math.atan2(p0.y - center.y, p0.x - center.x);
  const count = segmentsForArcLength(Math.abs(radius), Math.abs(theta));

  let prev = p0;
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const angle = startAngle + theta * t;
    const next = {
      x: center.x + Math.cos(angle) * Math.abs(radius),
      y: center.y + Math.sin(angle) * Math.abs(radius),
    };
    addSegment(segments, prev, next);
    prev = next;
  }
}

function readPointLike(value: unknown): Vec2 | null {
  if (!value || typeof value !== "object") return null;
  const candidates = [
    value as { x?: number; y?: number },
    (value as { location?: { x?: number; y?: number } }).location ?? null,
    (value as { point?: { x?: number; y?: number } }).point ?? null,
    (value as { position?: { x?: number; y?: number } }).position ?? null,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const x = (candidate as { x?: number }).x;
    const y = (candidate as { y?: number }).y;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x: x as number, y: y as number };
    }
  }
  return null;
}

function readVertexLike(
  value: unknown,
): { x: number; y: number; bulge?: number } | null {
  const point = readPointLike(value);
  if (!point) return null;
  const bulge =
    value && typeof value === "object"
      ? (value as { bulge?: number }).bulge
      : undefined;
  return { x: point.x, y: point.y, bulge };
}

function isClosedFlag(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const closed = (value as { closed?: boolean }).closed;
  const isClosed = (value as { isClosed?: boolean }).isClosed;
  const shape = (value as { shape?: boolean }).shape;
  const flags = (value as { flags?: number }).flags;
  return (
    !!closed ||
    !!isClosed ||
    !!shape ||
    (Number.isFinite(flags) && ((flags ?? 0) & 1) === 1)
  );
}

function addPolylineLikeSegments(
  segments: Segment[],
  rawVertices: unknown,
  scale: number,
  closed: boolean,
) {
  if (!Array.isArray(rawVertices)) return;
  const vertices: Array<{ x: number; y: number; bulge?: number }> = [];
  for (const v of rawVertices) {
    const parsed = readVertexLike(v);
    if (!parsed) continue;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) continue;
    vertices.push(parsed);
  }
  if (vertices.length < 2) return;

  const scaled = vertices
    .map((v) => ({
      x: v.x * scale,
      y: v.y * scale,
      bulge: v.bulge,
    }))
    .filter((v) => Number.isFinite(v.x) && Number.isFinite(v.y));

  if (scaled.length < 2) return;

  for (let i = 0; i < scaled.length - 1; i++) {
    const v0 = scaled[i];
    const v1 = scaled[i + 1];
    addBulgeSegments(segments, v0, v1, v0.bulge ?? 0);
  }
  if (closed) {
    const last = scaled[scaled.length - 1];
    const first = scaled[0];
    addBulgeSegments(segments, last, first, last.bulge ?? 0);
  }
}

function normalizeArcAngles(
  startAngle: number,
  endAngle: number,
): { start: number; end: number } {
  let start = startAngle;
  let end = endAngle;
  const maxAbs = Math.max(Math.abs(start), Math.abs(end));
  if (maxAbs > Math.PI * 2 + 1e-3) {
    start = THREE.MathUtils.degToRad(start);
    end = THREE.MathUtils.degToRad(end);
  }
  return { start, end };
}

function extractSegmentsFromDxf(
  dxf: ParsedDxf,
  scaleToMm: number,
): Segment[] {
  const segments: Segment[] = [];
  const scale = Number.isFinite(scaleToMm) ? scaleToMm : 1;

  const entities = dxf.entities ?? [];
  for (const entity of entities) {
    if (!entity || !entity.type) continue;
    const type = entity.type.toUpperCase();

    if (type === "LINE") {
      if (entity.start && entity.end) {
        addSegment(
          segments,
          { x: entity.start.x * scale, y: entity.start.y * scale },
          { x: entity.end.x * scale, y: entity.end.y * scale },
        );
      }
      continue;
    }

    if (type === "LWPOLYLINE" || type === "POLYLINE") {
      const vertices = entity.vertices ?? entity.vertexes ?? entity.points ?? [];
      const closed = isClosedFlag(entity);
      addPolylineLikeSegments(segments, vertices, scale, closed);
      continue;
    }

    if (type === "HATCH") {
      const loops = entity.boundaryLoops ?? entity.boundaryPaths ?? [];
      if (!Array.isArray(loops) || loops.length === 0) continue;
      for (const loop of loops) {
        if (!loop || typeof loop !== "object") continue;
        const vertices =
          (loop as { vertices?: unknown }).vertices ??
          (loop as { vertexes?: unknown }).vertexes ??
          (loop as { points?: unknown }).points;
        if (Array.isArray(vertices) && vertices.length > 0) {
          addPolylineLikeSegments(segments, vertices, scale, isClosedFlag(loop));
          continue;
        }
        const edges =
          (loop as { edges?: unknown }).edges ??
          (loop as { edgeList?: unknown }).edgeList ??
          (loop as { edge?: unknown }).edge ??
          (loop as { boundaryEdges?: unknown }).boundaryEdges;
        if (!Array.isArray(edges)) continue;
        for (const edge of edges) {
          if (!edge || typeof edge !== "object") continue;
          const rawType =
            typeof (edge as { type?: unknown }).type === "string"
              ? ((edge as { type: string }).type as string)
              : typeof (edge as { edgeType?: unknown }).edgeType === "string"
                ? ((edge as { edgeType: string }).edgeType as string)
                : "";
          const edgeType = rawType.toUpperCase();

          if (
            edgeType === "LINE" ||
            (!edgeType &&
              (edge as { start?: unknown }).start &&
              (edge as { end?: unknown }).end)
          ) {
            const start = readPointLike((edge as { start?: unknown }).start);
            const end = readPointLike((edge as { end?: unknown }).end);
            if (!start || !end) continue;
            addSegment(
              segments,
              { x: start.x * scale, y: start.y * scale },
              { x: end.x * scale, y: end.y * scale },
            );
            continue;
          }

          if (
            edgeType === "ARC" ||
            (!edgeType &&
              (edge as { center?: unknown }).center &&
              Number.isFinite((edge as { radius?: number }).radius))
          ) {
            const center = readPointLike((edge as { center?: unknown }).center);
            const radius = (edge as { radius?: number }).radius;
            const startAngle = (edge as { startAngle?: number }).startAngle;
            const endAngle = (edge as { endAngle?: number }).endAngle;
            if (
              !center ||
              !Number.isFinite(radius) ||
              !Number.isFinite(startAngle) ||
              !Number.isFinite(endAngle)
            ) {
              continue;
            }
            const { start, end } = normalizeArcAngles(startAngle, endAngle);
            addArcSegments(
              segments,
              { x: center.x * scale, y: center.y * scale },
              radius * scale,
              start,
              end,
            );
          }
        }
      }
      continue;
    }

    if (type === "CIRCLE") {
      if (entity.center && Number.isFinite(entity.radius)) {
        const center = {
          x: entity.center.x * scale,
          y: entity.center.y * scale,
        };
        addArcSegments(
          segments,
          center,
          entity.radius * scale,
          0,
          Math.PI * 2,
          CIRCLE_SEGMENTS,
        );
      }
      continue;
    }

    if (type === "ARC") {
      if (
        entity.center &&
        Number.isFinite(entity.radius) &&
        Number.isFinite(entity.startAngle) &&
        Number.isFinite(entity.endAngle)
      ) {
        const start = THREE.MathUtils.degToRad(entity.startAngle);
        const end = THREE.MathUtils.degToRad(entity.endAngle);
        const center = {
          x: entity.center.x * scale,
          y: entity.center.y * scale,
        };
        addArcSegments(
          segments,
          center,
          entity.radius * scale,
          start,
          end,
        );
      }
      continue;
    }

    if (type === "ELLIPSE") {
      if (
        entity.center &&
        entity.majorAxisEndPoint &&
        Number.isFinite(entity.axisRatio)
      ) {
        let start = Number.isFinite(entity.startAngle) ? entity.startAngle : 0;
        let end = Number.isFinite(entity.endAngle)
          ? entity.endAngle
          : Math.PI * 2;
        const maxAbs = Math.max(Math.abs(start), Math.abs(end));
        if (maxAbs > Math.PI * 2 + 1e-3) {
          start = THREE.MathUtils.degToRad(start);
          end = THREE.MathUtils.degToRad(end);
        }

        let delta = end - start;
        if (delta <= 0) {
          delta += Math.PI * 2;
          end = start + delta;
        }

        const majorAxis = {
          x: entity.majorAxisEndPoint.x * scale,
          y: entity.majorAxisEndPoint.y * scale,
        };
        const center = {
          x: entity.center.x * scale,
          y: entity.center.y * scale,
        };
        const majorRadius = Math.hypot(majorAxis.x, majorAxis.y);
        if (!Number.isFinite(majorRadius) || majorRadius <= 0) continue;
        const minorRadius = majorRadius * entity.axisRatio;
        const rotation = Math.atan2(majorAxis.y, majorAxis.x);
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);

        let prev = {
          x:
            center.x +
            majorRadius * Math.cos(start) * cosR -
            minorRadius * Math.sin(start) * sinR,
          y:
            center.y +
            majorRadius * Math.cos(start) * sinR +
            minorRadius * Math.sin(start) * cosR,
        };

        for (let i = 1; i <= ELLIPSE_SEGMENTS; i++) {
          const t = i / ELLIPSE_SEGMENTS;
          const angle = start + delta * t;
          const next = {
            x:
              center.x +
              majorRadius * Math.cos(angle) * cosR -
              minorRadius * Math.sin(angle) * sinR,
            y:
              center.y +
              majorRadius * Math.cos(angle) * sinR +
              minorRadius * Math.sin(angle) * cosR,
          };
          addSegment(segments, prev, next);
          prev = next;
        }
      }
      continue;
    }

    if (type === "SPLINE") {
      const fitPoints = (entity.fitPoints || []) as Array<{
        x: number;
        y: number;
      }>;
      const controlPoints = (entity.controlPoints || []) as Array<{
        x: number;
        y: number;
      }>;
      const points = fitPoints.length >= 2 ? fitPoints : controlPoints;
      if (!points || points.length < 2) continue;

      if (points.length === 2) {
        addSegment(
          segments,
          { x: points[0].x * scale, y: points[0].y * scale },
          { x: points[1].x * scale, y: points[1].y * scale },
        );
        continue;
      }

      const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(p.x * scale, 0, p.y * scale)),
      );
      const sampled = curve.getPoints(SPLINE_SEGMENTS);
      for (let i = 0; i < sampled.length - 1; i++) {
        const a = sampled[i];
        const b = sampled[i + 1];
        addSegment(segments, { x: a.x, y: a.z }, { x: b.x, y: b.z });
      }
      continue;
    }
  }

  return segments;
}

function snapSegmentsToNodes(segments: Segment[], tolerance: number) {
  const tol = Math.max(1e-6, tolerance);
  const tol2 = tol * tol;
  const cellSize = tol;
  const inv = 1 / cellSize;

  const nodePositions = new Map<string, THREE.Vector2>();
  const grid = new Map<string, string[]>();

  const cellKey = (ix: number, iy: number) => `${ix},${iy}`;

  const findOrCreateKey = (x: number, y: number) => {
    const ix = Math.floor(x * inv);
    const iy = Math.floor(y * inv);
    let bestKey: string | null = null;
    let bestDist2 = tol2;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = grid.get(cellKey(ix + dx, iy + dy));
        if (!list) continue;
        for (const key of list) {
          const pos = nodePositions.get(key);
          if (!pos) continue;
          const dxp = pos.x - x;
          const dyp = pos.y - y;
          const dist2 = dxp * dxp + dyp * dyp;
          if (dist2 <= bestDist2) {
            bestDist2 = dist2;
            bestKey = key;
          }
        }
      }
    }

    if (bestKey) {
      const pos = nodePositions.get(bestKey)!;
      pos.x = (pos.x + x) * 0.5;
      pos.y = (pos.y + y) * 0.5;
      return bestKey;
    }

    const key = `p${nodePositions.size}`;
    nodePositions.set(key, new THREE.Vector2(x, y));
    const cKey = cellKey(ix, iy);
    const bucket = grid.get(cKey) || [];
    bucket.push(key);
    grid.set(cKey, bucket);
    return key;
  };

  const snappedSegments: Array<{ a: string; b: string }> = [];
  const adjacency = new Map<string, number[]>();
  const undirectedSeen = new Set<string>();

  const addAdj = (key: string, idx: number) => {
    const list = adjacency.get(key) || [];
    list.push(idx);
    adjacency.set(key, list);
  };

  for (const seg of segments) {
    const ak = findOrCreateKey(seg.a.x, seg.a.y);
    const bk = findOrCreateKey(seg.b.x, seg.b.y);
    if (ak === bk) continue;
    const edgeKey = ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
    if (undirectedSeen.has(edgeKey)) continue;
    undirectedSeen.add(edgeKey);
    const idx = snappedSegments.length;
    snappedSegments.push({ a: ak, b: bk });
    addAdj(ak, idx);
    addAdj(bk, idx);
  }

  return { snappedSegments, nodePositions, adjacency };
}

function polygonArea(points: THREE.Vector2[]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return area * 0.5;
}

function pointInPolygon(point: THREE.Vector2, polygon: THREE.Vector2[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildLoopsFromSegments(
  snappedSegments: Array<{ a: string; b: string }>,
  nodePositions: Map<string, THREE.Vector2>,
  tolerance: number,
): THREE.Vector2[][] {
  const loopsBySignature = new Map<string, { points: THREE.Vector2[]; area: number }>();
  const eps = Math.max(1e-6, tolerance * 0.1);
  const minArea = Math.max(1e-4, tolerance * tolerance);

  type DirectedEdge = {
    id: number;
    from: string;
    to: string;
    twinId: number;
    dx: number;
    dy: number;
    undirectedKey: string;
  };

  const directedEdges: DirectedEdge[] = [];
  const outgoing = new Map<string, number[]>();

  const addOutgoing = (from: string, edgeId: number) => {
    const list = outgoing.get(from) || [];
    list.push(edgeId);
    outgoing.set(from, list);
  };

  for (let segIndex = 0; segIndex < snappedSegments.length; segIndex++) {
    const seg = snappedSegments[segIndex];
    const aPos = nodePositions.get(seg.a);
    const bPos = nodePositions.get(seg.b);
    if (!aPos || !bPos) continue;

    const abDx = bPos.x - aPos.x;
    const abDy = bPos.y - aPos.y;
    const baDx = -abDx;
    const baDy = -abDy;
    const len2 = abDx * abDx + abDy * abDy;
    if (len2 <= 1e-18) continue;

    const undirectedKey =
      seg.a < seg.b ? `${seg.a}|${seg.b}` : `${seg.b}|${seg.a}`;
    const idAB = directedEdges.length;
    const idBA = idAB + 1;
    directedEdges.push({
      id: idAB,
      from: seg.a,
      to: seg.b,
      twinId: idBA,
      dx: abDx,
      dy: abDy,
      undirectedKey,
    });
    directedEdges.push({
      id: idBA,
      from: seg.b,
      to: seg.a,
      twinId: idAB,
      dx: baDx,
      dy: baDy,
      undirectedKey,
    });
    addOutgoing(seg.a, idAB);
    addOutgoing(seg.b, idBA);
  }

  if (directedEdges.length === 0) return [];

  const chooseNextEdge = (edgeId: number): number => {
    const edge = directedEdges[edgeId];
    const options = outgoing.get(edge.to) || [];
    if (options.length === 0) return -1;
    if (options.length === 1) {
      return options[0] === edge.twinId ? -1 : options[0];
    }

    const inDx = -edge.dx;
    const inDy = -edge.dy;
    let bestId = -1;
    let bestTurn = Infinity;

    for (const candidateId of options) {
      if (candidateId === edge.twinId) continue;
      const candidate = directedEdges[candidateId];
      const cross = inDx * candidate.dy - inDy * candidate.dx;
      const dot = inDx * candidate.dx + inDy * candidate.dy;
      let turn = Math.atan2(cross, dot);
      if (turn < 0) turn += Math.PI * 2;
      if (turn < bestTurn - 1e-12) {
        bestTurn = turn;
        bestId = candidateId;
      }
    }

    return bestId;
  };

  const nextDirected = new Array(directedEdges.length).fill(-1);
  for (let i = 0; i < directedEdges.length; i++) {
    nextDirected[i] = chooseNextEdge(i);
  }

  const processed = new Array(directedEdges.length).fill(false);

  const registerCycle = (cycleEdgeIds: number[]) => {
    if (cycleEdgeIds.length < 3) return;

    const keySequence: string[] = [];
    const firstEdge = directedEdges[cycleEdgeIds[0]];
    keySequence.push(firstEdge.from);
    for (const edgeId of cycleEdgeIds) {
      keySequence.push(directedEdges[edgeId].to);
    }

    const loopPoints: THREE.Vector2[] = [];
    for (const key of keySequence) {
      const pos = nodePositions.get(key);
      if (!pos) continue;
      const last = loopPoints[loopPoints.length - 1];
      if (last && Math.hypot(pos.x - last.x, pos.y - last.y) <= eps) continue;
      loopPoints.push(pos.clone());
    }

    if (loopPoints.length < 3) return;
    const firstPoint = loopPoints[0];
    const lastPoint = loopPoints[loopPoints.length - 1];
    if (
      Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y) <= eps
    ) {
      loopPoints.pop();
    }
    if (loopPoints.length < 3) return;

    const area = polygonArea(loopPoints);
    if (!Number.isFinite(area) || Math.abs(area) < minArea) return;

    const signature = cycleEdgeIds
      .map((edgeId) => directedEdges[edgeId].undirectedKey)
      .sort()
      .join(",");
    const existing = loopsBySignature.get(signature);
    if (!existing) {
      loopsBySignature.set(signature, { points: loopPoints, area });
      return;
    }

    const wantCurrent = area > 0 && existing.area <= 0;
    if (wantCurrent) {
      loopsBySignature.set(signature, { points: loopPoints, area });
    }
  };

  for (let i = 0; i < directedEdges.length; i++) {
    if (processed[i]) continue;
    const seenAt = new Map<number, number>();
    const walked: number[] = [];
    let current = i;

    while (current >= 0 && !processed[current] && !seenAt.has(current)) {
      seenAt.set(current, walked.length);
      walked.push(current);
      current = nextDirected[current];
    }

    if (current >= 0 && seenAt.has(current)) {
      const start = seenAt.get(current)!;
      registerCycle(walked.slice(start));
    }

    for (const edgeId of walked) {
      processed[edgeId] = true;
    }
  }

  return Array.from(loopsBySignature.values()).map((entry) => entry.points);
}

function buildShapesFromLoops(loops: THREE.Vector2[][]): THREE.Shape[] {
  if (loops.length === 0) return [];
  const loopInfos: LoopInfo[] = loops.map((points, index) => ({
    points,
    area: polygonArea(points),
    index,
  }));
  loopInfos.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));

  const usedAsHole = new Set<number>();
  const shapes: THREE.Shape[] = [];

  const ensureOrientation = (points: THREE.Vector2[], wantCCW: boolean) => {
    const area = polygonArea(points);
    if (wantCCW && area < 0) return [...points].reverse();
    if (!wantCCW && area > 0) return [...points].reverse();
    return [...points];
  };

  for (const outer of loopInfos) {
    if (usedAsHole.has(outer.index)) continue;
    const outerPoints = ensureOrientation(outer.points, true);
    const shape = new THREE.Shape(outerPoints);

    for (const candidate of loopInfos) {
      if (candidate.index === outer.index) continue;
      if (usedAsHole.has(candidate.index)) continue;
      const testPoint = candidate.points[0];
      if (!testPoint) continue;
      if (pointInPolygon(testPoint, outer.points)) {
        const holePoints = ensureOrientation(candidate.points, false);
        shape.holes.push(new THREE.Path(holePoints));
        usedAsHole.add(candidate.index);
      }
    }

    shapes.push(shape);
  }

  return shapes;
}

export function buildSolidFromDxf(
  dxf: ParsedDxf,
  scaleToMm: number,
  opts: DxfSolidOptions,
):
  | { mesh: THREE.Mesh; edges: THREE.LineSegments; bounds: THREE.Box3 }
  | null {
  const thicknessMm = Number.isFinite(opts.thicknessMm)
    ? Math.max(0.01, opts.thicknessMm)
    : 2;
  const joinToleranceMm = Number.isFinite(opts.joinToleranceMm)
    ? Math.max(1e-6, opts.joinToleranceMm)
    : 0.15;
  const edgeThresholdDeg = Number.isFinite(opts.edgeThresholdDeg)
    ? opts.edgeThresholdDeg!
    : 30;

  const segments = extractSegmentsFromDxf(dxf, scaleToMm);
  if (segments.length === 0) return null;

  let loops: THREE.Vector2[][] = [];
  const tolerances: number[] = [joinToleranceMm];
  const fallback2x = Math.min(joinToleranceMm * 2, 2);
  const fallback4x = Math.min(joinToleranceMm * 4, 2);
  for (const candidate of [fallback2x, fallback4x]) {
    if (!tolerances.some((t) => Math.abs(t - candidate) <= 1e-9)) {
      tolerances.push(candidate);
    }
  }

  for (const tol of tolerances) {
    const { snappedSegments, nodePositions } = snapSegmentsToNodes(
      segments,
      tol,
    );
    if (snappedSegments.length === 0) continue;
    loops = buildLoopsFromSegments(
      snappedSegments,
      nodePositions,
      tol,
    );
    if (loops.length > 0) break;
  }
  if (loops.length === 0) return null;

  const shapes = buildShapesFromLoops(loops);
  if (shapes.length === 0) return null;

  const geoms: THREE.BufferGeometry[] = [];
  for (const shape of shapes) {
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: thicknessMm,
      bevelEnabled: false,
    });
    geom.rotateX(-Math.PI / 2);
    geom.scale(1, 1, -1);
    geoms.push(geom);
  }

  const merged = mergeGeometries(geoms, true);
  for (const g of geoms) {
    g.dispose();
  }
  if (!merged) return null;

  merged.computeVertexNormals();
  merged.computeBoundingBox();
  if (merged.boundingBox) {
    const offset = merged.boundingBox.min.clone().multiplyScalar(-1);
    merged.translate(offset.x, offset.y, offset.z);
    merged.computeBoundingBox();
  }

  const material = createDefaultCadMaterial();
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = "dxfSolid";

  const edgesGeom = new THREE.EdgesGeometry(merged, edgeThresholdDeg);
  const edgesMat = new THREE.LineBasicMaterial({
    color: 0x111111,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
    depthWrite: false,
  });
  const edges = new THREE.LineSegments(edgesGeom, edgesMat);
  edges.name = "dxfSolidEdges";
  edges.userData.__edgeOverlay = true;
  edges.userData.__isFeatureEdge = true;
  edges.renderOrder = (mesh.renderOrder ?? 0) + 1;
  edges.frustumCulled = false;
  mesh.add(edges);

  const bounds = merged.boundingBox
    ? merged.boundingBox.clone()
    : new THREE.Box3();

  return { mesh, edges, bounds };
}
