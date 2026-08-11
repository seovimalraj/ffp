import type { BoundingBox, Vector3 } from "@/types/machining-analysis";

/**
 * Mapping from CAD/analysis coordinates into the viewer's world space.
 *
 * The viewer re-centres geometry when it loads a model (`recenterGeometryAtOrigin`
 * then `normalizeModelRootToOriginMin`), so a hole reported at CAD (60, 40, 35)
 * is not at (60, 40, 35) on screen. Reading that code says the net effect is a
 * pure translation by the bounding-box minimum, but *deriving* the transform by
 * comparing the two bounding boxes is safer than trusting that reading: it also
 * absorbs any unit scaling, and it can tell when the assumption no longer holds.
 *
 * When the boxes disagree in shape - an axis swap, a non-uniform scale - the
 * transform reports itself invalid and the caller draws nothing rather than
 * placing markers confidently in the wrong place.
 */

export interface ModelTransform {
  valid: boolean;
  scale: [number, number, number];
  offset: [number, number, number];
  /** Populated when `valid` is false, for logging or a UI notice. */
  reason?: string;
}

export interface WorldBox {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/** Transform used when the model happens to sit in CAD coordinates already. */
export const IDENTITY_TRANSFORM: ModelTransform = {
  valid: true,
  scale: [1, 1, 1],
  offset: [0, 0, 0],
};

const SIZE_EPSILON = 1e-6;
/** Per-axis scales must agree within this to count as uniform. */
const SCALE_TOLERANCE = 0.02;

export function deriveModelTransform(
  analysisBox: BoundingBox,
  worldBox: WorldBox | null,
): ModelTransform {
  if (!worldBox) {
    return {
      ...IDENTITY_TRANSFORM,
      valid: false,
      reason: "The viewer has not reported model bounds yet.",
    };
  }

  const analysisSize = [
    analysisBox.max.x - analysisBox.min.x,
    analysisBox.max.y - analysisBox.min.y,
    analysisBox.max.z - analysisBox.min.z,
  ];
  const worldSize = [
    worldBox.max.x - worldBox.min.x,
    worldBox.max.y - worldBox.min.y,
    worldBox.max.z - worldBox.min.z,
  ];

  if (analysisSize.some((s) => s <= SIZE_EPSILON)) {
    return {
      ...IDENTITY_TRANSFORM,
      valid: false,
      reason: "The analysed model has a degenerate bounding box.",
    };
  }

  const scale = worldSize.map((w, i) => w / analysisSize[i]) as [
    number,
    number,
    number,
  ];

  // A permuted or rotated model shows up as per-axis scales that disagree.
  const mean = (scale[0] + scale[1] + scale[2]) / 3;
  const skewed = scale.some((s) => Math.abs(s - mean) / Math.max(mean, 1e-9) > SCALE_TOLERANCE);
  if (skewed || mean <= 0) {
    return {
      ...IDENTITY_TRANSFORM,
      valid: false,
      reason:
        "The viewer's model bounds do not match the analysed geometry " +
        "(the axes appear rotated or scaled unevenly), so feature positions " +
        "cannot be mapped reliably.",
    };
  }

  const analysisMin = [analysisBox.min.x, analysisBox.min.y, analysisBox.min.z];
  const worldMin = [worldBox.min.x, worldBox.min.y, worldBox.min.z];
  const offset = worldMin.map((w, i) => w - analysisMin[i] * scale[i]) as [
    number,
    number,
    number,
  ];

  return { valid: true, scale, offset };
}

/** Map a CAD-space point into viewer world space. */
export function toWorld(
  point: Vector3 | [number, number, number],
  transform: ModelTransform,
): [number, number, number] {
  const p = Array.isArray(point) ? point : [point.x, point.y, point.z];
  return [
    p[0] * transform.scale[0] + transform.offset[0],
    p[1] * transform.scale[1] + transform.offset[1],
    p[2] * transform.scale[2] + transform.offset[2],
  ];
}

/**
 * Map a viewer world-space point back into CAD space.
 *
 * Used for picking: the viewer reports where a click landed in world space, and
 * that has to become a CAD coordinate before it can be matched to a feature.
 */
export function toCad(
  point: { x: number; y: number; z: number },
  transform: ModelTransform,
): [number, number, number] {
  return [
    (point.x - transform.offset[0]) / transform.scale[0],
    (point.y - transform.offset[1]) / transform.scale[1],
    (point.z - transform.offset[2]) / transform.scale[2],
  ];
}

/** Scale a CAD length (a radius, a depth) into world units. */
export function lengthToWorld(
  length: number,
  transform: ModelTransform,
): number {
  const mean =
    (transform.scale[0] + transform.scale[1] + transform.scale[2]) / 3;
  return length * mean;
}

// --- small vector helpers, kept local so the overlay has no dependencies ----

export type Vec3 = [number, number, number];

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scaleVec(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function normalize(a: Vec3): Vec3 {
  const n = Math.hypot(a[0], a[1], a[2]);
  return n < 1e-12 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Two unit vectors spanning the plane normal to `direction`. Deterministic. */
export function perpendicularBasis(direction: Vec3): [Vec3, Vec3] {
  const d = normalize(direction);
  const helper: Vec3 = Math.abs(dot(d, [0, 0, 1])) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = normalize(cross(d, helper));
  const v = normalize(cross(d, u));
  return [u, v];
}

/** Points around a circle in 3D, for drawing a hole rim as a polygon. */
export function circlePoints(
  center: Vec3,
  axis: Vec3,
  radius: number,
  segments = 48,
): Vec3[] {
  const [u, v] = perpendicularBasis(axis);
  const points: Vec3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(
      add(
        center,
        add(scaleVec(u, Math.cos(angle) * radius), scaleVec(v, Math.sin(angle) * radius)),
      ),
    );
  }
  return points;
}

/** Corners of an axis-aligned box, for drawing a face's bounds as a wireframe. */
export function boxCorners(box: BoundingBox): Vec3[] {
  return [
    [box.min.x, box.min.y, box.min.z],
    [box.max.x, box.min.y, box.min.z],
    [box.max.x, box.max.y, box.min.z],
    [box.min.x, box.max.y, box.min.z],
    [box.min.x, box.min.y, box.max.z],
    [box.max.x, box.min.y, box.max.z],
    [box.max.x, box.max.y, box.max.z],
    [box.min.x, box.max.y, box.max.z],
  ];
}

/** Index pairs joining `boxCorners` into the twelve edges of a box. */
export const BOX_EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];
