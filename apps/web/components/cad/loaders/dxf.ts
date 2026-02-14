import * as THREE from "three";
import { DxfParser } from "dxf-parser";

export type DxfHeader = {
  $INSUNITS?: number;
  INSUNITS?: number;
  [key: string]: unknown;
};

export type DxfEntity = {
  type: string;
  layer?: string;
  [key: string]: any;
};

export type ParsedDxf = {
  header?: DxfHeader;
  entities?: DxfEntity[];
};

const INSUNITS_TO_MM: Record<number, number> = {
  0: 1, // unitless -> assume 1mm
  1: 25.4, // inches
  2: 304.8, // feet
  4: 1, // mm
  5: 10, // cm
  6: 1000, // m
  7: 1_000_000, // km
};

const ARC_STEP_RAD = THREE.MathUtils.degToRad(5);
const MIN_ARC_SEGMENTS = 6;
const MAX_ARC_SEGMENTS = 2048;
const MAX_SPLINE_SEGMENTS = 4096;

function decodeText(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8");
  return utf8.decode(buf);
}

function decodeLatin1(buf: ArrayBuffer): string {
  const latin1 = new TextDecoder("latin1");
  return latin1.decode(buf);
}

function parseDxfText(text: string): ParsedDxf {
  const parser = new DxfParser();
  return parser.parseSync(text) as ParsedDxf;
}

function parseDxfWithFallback(buf: ArrayBuffer): ParsedDxf {
  try {
    return parseDxfText(decodeText(buf));
  } catch (_err) {
    return parseDxfText(decodeLatin1(buf));
  }
}

function getScaleToMm(header?: DxfHeader): {
  insUnits?: number;
  scaleToMm: number;
} {
  const raw =
    (header?.$INSUNITS as number | undefined) ??
    (header?.INSUNITS as number | undefined);
  const insUnits = Number.isFinite(raw) ? Number(raw) : undefined;
  const scaleToMm =
    insUnits !== undefined && INSUNITS_TO_MM[insUnits] !== undefined
      ? INSUNITS_TO_MM[insUnits]
      : 1;
  return { insUnits, scaleToMm };
}

export function parseDxfFromArrayBuffer(buf: ArrayBuffer): {
  dxf: ParsedDxf;
  meta: { insUnits?: number; scaleToMm: number };
} {
  const dxf = parseDxfWithFallback(buf);
  const { insUnits, scaleToMm } = getScaleToMm(dxf.header);
  return { dxf, meta: { insUnits, scaleToMm } };
}

function getLayerBucket(
  buckets: Map<string, number[]>,
  layer: string,
): number[] {
  let bucket = buckets.get(layer);
  if (!bucket) {
    bucket = [];
    buckets.set(layer, bucket);
  }
  return bucket;
}

function pushSegmentWorld(
  bucket: number[],
  bounds: THREE.Box3,
  tmp: THREE.Vector3,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
) {
  bucket.push(ax, ay, az, bx, by, bz);
  bounds.expandByPoint(tmp.set(ax, ay, az));
  bounds.expandByPoint(tmp.set(bx, by, bz));
}

function pushSegmentScaled(
  bucket: number[],
  bounds: THREE.Box3,
  tmp: THREE.Vector3,
  a: { x: number; y: number },
  b: { x: number; y: number },
  scale: number,
) {
  const ax = a.x * scale;
  const az = a.y * scale;
  const bx = b.x * scale;
  const bz = b.y * scale;
  pushSegmentWorld(bucket, bounds, tmp, ax, 0, az, bx, 0, bz);
}

function segmentsForAngle(angleRad: number): number {
  const segs = Math.ceil(Math.abs(angleRad) / ARC_STEP_RAD);
  return Math.min(MAX_ARC_SEGMENTS, Math.max(MIN_ARC_SEGMENTS, segs));
}

function addArcSegments(
  bucket: number[],
  bounds: THREE.Box3,
  tmp: THREE.Vector3,
  center: { x: number; y: number },
  radius: number,
  startRad: number,
  endRad: number,
  scale: number,
) {
  let start = startRad;
  let end = endRad;
  let delta = end - start;
  if (delta <= 0) {
    delta += Math.PI * 2;
    end = start + delta;
  }
  const segs = segmentsForAngle(delta);
  let prev = {
    x: center.x + Math.cos(start) * radius,
    y: center.y + Math.sin(start) * radius,
  };
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const angle = start + delta * t;
    const next = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
    pushSegmentScaled(bucket, bounds, tmp, prev, next, scale);
    prev = next;
  }
}

function addEllipseSegments(
  bucket: number[],
  bounds: THREE.Box3,
  tmp: THREE.Vector3,
  center: { x: number; y: number },
  majorAxis: { x: number; y: number },
  axisRatio: number,
  startParam: number,
  endParam: number,
  scale: number,
) {
  const majorRadius = Math.hypot(majorAxis.x, majorAxis.y);
  if (!Number.isFinite(majorRadius) || majorRadius <= 0) return;
  const minorRadius = majorRadius * axisRatio;
  const rotation = Math.atan2(majorAxis.y, majorAxis.x);

  let start = startParam;
  let end = endParam;
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

  const segs = segmentsForAngle(delta);
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
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
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
    pushSegmentScaled(bucket, bounds, tmp, prev, next, scale);
    prev = next;
  }
}

function addBulgeSegment(
  bucket: number[],
  bounds: THREE.Box3,
  tmp: THREE.Vector3,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  bulge: number,
  scale: number,
) {
  if (!bulge || !Number.isFinite(bulge)) {
    pushSegmentScaled(bucket, bounds, tmp, p0, p1, scale);
    return;
  }
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return;

  const theta = 4 * Math.atan(bulge);
  if (Math.abs(theta) < 1e-6) {
    pushSegmentScaled(bucket, bounds, tmp, p0, p1, scale);
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
  const segs = segmentsForAngle(theta);

  let prev = p0;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const angle = startAngle + theta * t;
    const next = {
      x: center.x + Math.cos(angle) * Math.abs(radius),
      y: center.y + Math.sin(angle) * Math.abs(radius),
    };
    pushSegmentScaled(bucket, bounds, tmp, prev, next, scale);
    prev = next;
  }
}

function addPolyline(
  bucket: number[],
  bounds: THREE.Box3,
  tmp: THREE.Vector3,
  vertices: Array<{ x: number; y: number; bulge?: number }>,
  closed: boolean,
  scale: number,
) {
  if (!vertices || vertices.length < 2) return;

  for (let i = 0; i < vertices.length - 1; i++) {
    const v0 = vertices[i];
    const v1 = vertices[i + 1];
    const bulge = v0.bulge ?? 0;
    if (bulge) {
      addBulgeSegment(bucket, bounds, tmp, v0, v1, bulge, scale);
    } else {
      pushSegmentScaled(bucket, bounds, tmp, v0, v1, scale);
    }
  }

  if (closed) {
    const last = vertices[vertices.length - 1];
    const first = vertices[0];
    const bulge = last.bulge ?? 0;
    if (bulge) {
      addBulgeSegment(bucket, bounds, tmp, last, first, bulge, scale);
    } else {
      pushSegmentScaled(bucket, bounds, tmp, last, first, scale);
    }
  }
}

function addSpline(
  bucket: number[],
  bounds: THREE.Box3,
  tmp: THREE.Vector3,
  points: Array<{ x: number; y: number }>,
  scale: number,
) {
  if (!points || points.length < 2) return;

  if (points.length === 2) {
    pushSegmentScaled(bucket, bounds, tmp, points[0], points[1], scale);
    return;
  }

  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p.x, 0, p.y)),
  );
  const segments = Math.min(
    MAX_SPLINE_SEGMENTS,
    Math.max(points.length * 8, 32),
  );
  const sampled = curve.getPoints(segments);
  for (let i = 0; i < sampled.length - 1; i++) {
    const a = sampled[i];
    const b = sampled[i + 1];
    pushSegmentWorld(
      bucket,
      bounds,
      tmp,
      a.x * scale,
      0,
      a.z * scale,
      b.x * scale,
      0,
      b.z * scale,
    );
  }
}

export function buildLineworkFromDxf(
  dxf: ParsedDxf,
  scaleToMm: number,
): { object: THREE.Group; bounds: THREE.Box3 } {
  const buckets = new Map<string, number[]>();
  const bounds = new THREE.Box3();
  const tmp = new THREE.Vector3();

  const entities = dxf.entities ?? [];
  for (const entity of entities) {
    if (!entity || !entity.type) continue;
    const layer = entity.layer || "0";
    const bucket = getLayerBucket(buckets, layer);
    const type = entity.type.toUpperCase();

    if (type === "LINE") {
      if (entity.start && entity.end) {
        pushSegmentScaled(
          bucket,
          bounds,
          tmp,
          entity.start,
          entity.end,
          scaleToMm,
        );
      }
      continue;
    }

    if (type === "LWPOLYLINE" || type === "POLYLINE") {
      const vertices = (entity.vertices || entity.vertexes || []) as Array<{
        x: number;
        y: number;
        bulge?: number;
      }>;
      const closed =
        !!entity.closed ||
        !!entity.shape ||
        (Number.isFinite(entity.flags) && (entity.flags & 1) === 1);
      addPolyline(bucket, bounds, tmp, vertices, closed, scaleToMm);
      continue;
    }

    if (type === "CIRCLE") {
      if (entity.center && Number.isFinite(entity.radius)) {
        addArcSegments(
          bucket,
          bounds,
          tmp,
          entity.center,
          entity.radius,
          0,
          Math.PI * 2,
          scaleToMm,
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
        addArcSegments(
          bucket,
          bounds,
          tmp,
          entity.center,
          entity.radius,
          start,
          end,
          scaleToMm,
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
        const start = Number.isFinite(entity.startAngle)
          ? entity.startAngle
          : 0;
        const end = Number.isFinite(entity.endAngle)
          ? entity.endAngle
          : Math.PI * 2;
        addEllipseSegments(
          bucket,
          bounds,
          tmp,
          entity.center,
          entity.majorAxisEndPoint,
          entity.axisRatio,
          start,
          end,
          scaleToMm,
        );
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
      const splinePoints = fitPoints.length >= 2 ? fitPoints : controlPoints;
      addSpline(bucket, bounds, tmp, splinePoints, scaleToMm);
      continue;
    }
  }

  const hasBounds = !bounds.isEmpty();
  if (!hasBounds) {
    bounds.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
  }

  const group = new THREE.Group();
  group.name = "dxfLinework";

  const material = new THREE.LineBasicMaterial({
    color: 0x111111,
    depthTest: true,
  });

  buckets.forEach((positions, layerName) => {
    if (positions.length < 6) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.computeBoundingSphere();

    const line = new THREE.LineSegments(geometry, material);
    line.name = `dxf:${layerName}`;
    line.renderOrder = 2;
    line.frustumCulled = false;
    line.userData.__isLinework = true;
    group.add(line);
  });

  if (hasBounds) {
    const shift = bounds.min.clone().multiplyScalar(-1);
    group.position.add(shift);
    return { object: group, bounds: bounds.clone().translate(shift) };
  }

  return { object: group, bounds };
}

export function loadDxfFromArrayBuffer(buf: ArrayBuffer): {
  object: THREE.Group;
  bounds: THREE.Box3;
  meta: { insUnits?: number; scaleToMm: number };
} {
  const { dxf, meta } = parseDxfFromArrayBuffer(buf);
  const { object, bounds } = buildLineworkFromDxf(dxf, meta.scaleToMm);
  return { object, bounds, meta };
}
