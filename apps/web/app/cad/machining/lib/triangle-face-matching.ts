/**
 * A local `Vector3`/`BoundingBox`/face-geometry shape, structurally
 * compatible with (a subset of) `@/types/machining-analysis`'s `FaceDetail`
 * so callers can pass a `FaceDetail[]` directly, but not importing it: this
 * module (and `cad-viewer.tsx`, which surfaces the matching prop) has no
 * other reason to depend on the machining-analysis-specific schema, and
 * `CadViewer` is a generic component potentially used outside the machining
 * page.
 */
export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBoxLike {
  min: Vector3Like;
  max: Vector3Like;
  diagonal_mm: number;
}

/** The subset of `FaceDetail` needed to classify mesh triangles against a face. */
export interface FaceSurfaceGeometry {
  surface_type: string;
  bounding_box: BoundingBoxLike;
  centroid: Vector3Like | null;
  normal: Vector3Like | null;
  axis: Vector3Like | null;
  axis_location: Vector3Like | null;
  radius_mm: number | null;
  cone_half_angle_deg: number | null;
}

/**
 * Geometric matcher between this viewer's own rendered MESH TRIANGLES (the
 * already-tessellated `THREE.Mesh` production uses today - not the vendored
 * OCCT WASM build's `ExactFace` topology) and the CAD service's independently
 * computed `FaceDetail[]` (from `include_face_details=true`).
 *
 * This exists because the WASM exact-topology path (`face-matching.ts`,
 * `ExactFace`/`CadTopologyResult`) needs a patched OCCT runtime that emits
 * per-face triangulated geometry, and that patched runtime cannot currently
 * be rebuilt (no working Docker+Emscripten build available). This module
 * needs no WASM at all: it classifies the plain triangles already sitting in
 * the main render mesh's position/index buffers against each `FaceDetail`'s
 * analytic surface parameters, using nothing but arithmetic.
 *
 * Deliberately never compares ids - the mesh triangles have no id relationship
 * to backend face ids at all. Only geometry: surface type, radius/axis/normal
 * agreement, and spatial proximity (including each face's own bounding box,
 * to disambiguate multiple faces that share identical analytic parameters,
 * e.g. two same-diameter holes on the same axis).
 */

export interface TriangleMatchTolerances {
  /** Relative radius tolerance for cylinders/cones/spheres, e.g. 0.02 = 2%. */
  radiusRelativeTolerance: number;
  /** Minimum dot product between unit normals to call them aligned (either sense for planes). */
  normalDotTolerance: number;
  /** Absolute distance tolerance, scaled by model size (see `scaleDistanceTolerance`). */
  distanceTolerance: number;
  /**
   * Extra slack applied when testing a triangle centroid against a face's
   * `bounding_box`, as a fraction of that box's own diagonal - triangles
   * straddle a face's true boundary, and independently-tessellated meshes
   * never agree on it exactly.
   */
  boundingBoxSlackFraction: number;
}

export const DEFAULT_TRIANGLE_MATCH_TOLERANCES: TriangleMatchTolerances = {
  radiusRelativeTolerance: 0.02,
  normalDotTolerance: 0.95,
  distanceTolerance: 1, // mm, overridden by scaleDistanceTolerance() when a model size is known
  boundingBoxSlackFraction: 0.05,
};

/**
 * A distance tolerance sized for the model, rather than a fixed millimetre
 * value: 0.5% of the bounding-box diagonal, clamped to a sane floor so a tiny
 * part does not require sub-micron agreement between mesh and analytic
 * geometry. Mirrors `scaleDistanceTolerance` in `face-matching.ts` exactly -
 * kept as a separate copy rather than a cross-import since the two matchers
 * have unrelated input shapes (`ExactFace` vs. raw mesh triangles) and no
 * other reason to depend on each other.
 */
export function scaleDistanceTolerance(modelDiagonal: number): number {
  return Math.max(modelDiagonal * 0.005, 0.05);
}

type Vec3 = [number, number, number];

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function normalize(a: Vec3): Vec3 {
  const len = length(a);
  if (len < 1e-12) return [0, 0, 0];
  return [a[0] / len, a[1] / len, a[2] / len];
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function toVec3(v: Vector3Like | null | undefined): Vec3 | null {
  if (!v) return null;
  return [v.x, v.y, v.z];
}

interface Triangle {
  index: number; // triangle index (indices[i*3..i*3+2])
  centroid: Vec3;
  normal: Vec3; // computed from the triangle's own edges, not vertex normals
}

/** Read every triangle's own centroid + geometric (cross-product) normal out of a mesh. */
function readTriangles(
  positions: Float32Array,
  indices: Uint32Array | Uint16Array | number[],
): Triangle[] {
  const triangles: Triangle[] = [];
  const triCount = Math.floor(indices.length / 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3] * 3;
    const i1 = indices[t * 3 + 1] * 3;
    const i2 = indices[t * 3 + 2] * 3;
    if (
      i2 + 2 >= positions.length ||
      i1 + 2 >= positions.length ||
      i0 + 2 >= positions.length
    ) {
      continue;
    }
    const p0: Vec3 = [positions[i0], positions[i0 + 1], positions[i0 + 2]];
    const p1: Vec3 = [positions[i1], positions[i1 + 1], positions[i1 + 2]];
    const p2: Vec3 = [positions[i2], positions[i2 + 1], positions[i2 + 2]];
    const centroid: Vec3 = [
      (p0[0] + p1[0] + p2[0]) / 3,
      (p0[1] + p1[1] + p2[1]) / 3,
      (p0[2] + p1[2] + p2[2]) / 3,
    ];
    const normal = normalize(cross(sub(p1, p0), sub(p2, p0)));
    triangles.push({ index: t, centroid, normal });
  }
  return triangles;
}

/** Perpendicular distance from `point` to the infinite line through `origin` with unit `dir`. */
function distanceToLine(point: Vec3, origin: Vec3, dir: Vec3): number {
  const toPoint = sub(point, origin);
  const along = dot(toPoint, dir);
  const closest = add(origin, scale(dir, along));
  return length(sub(point, closest));
}

/** Whether `point` falls within `box`, expanded by `slackFraction` of its own diagonal. */
function withinBoundingBox(
  point: Vec3,
  box: BoundingBoxLike,
  slackFraction: number,
): boolean {
  const slack = Math.max(box.diagonal_mm * slackFraction, 1e-6);
  return (
    point[0] >= box.min.x - slack &&
    point[0] <= box.max.x + slack &&
    point[1] >= box.min.y - slack &&
    point[1] <= box.max.y + slack &&
    point[2] >= box.min.z - slack &&
    point[2] <= box.max.z + slack
  );
}

/**
 * Test one triangle against one `FaceDetail`, surface-type-specific.
 * Returns `true` only when every applicable gate passes - never a "close
 * enough" score, since triangles are simply included or excluded from the
 * highlight.
 */
function triangleMatchesFace(
  tri: Triangle,
  face: FaceSurfaceGeometry,
  tolerances: TriangleMatchTolerances,
): boolean {
  if (!withinBoundingBox(tri.centroid, face.bounding_box, tolerances.boundingBoxSlackFraction)) {
    return false;
  }

  switch (face.surface_type) {
    case "PLANE": {
      const anchor = toVec3(face.axis_location) ?? toVec3(face.centroid);
      const faceNormal = toVec3(face.normal);
      if (!anchor || !faceNormal) return false;
      const n = normalize(faceNormal);
      const planeDist = Math.abs(dot(sub(tri.centroid, anchor), n));
      if (planeDist > tolerances.distanceTolerance) return false;
      const alignment = Math.abs(dot(tri.normal, n));
      return alignment >= tolerances.normalDotTolerance;
    }

    case "CYLINDER": {
      const axisLocation = toVec3(face.axis_location);
      const axisDir = toVec3(face.axis);
      const radius = face.radius_mm;
      if (!axisLocation || !axisDir || typeof radius !== "number" || radius <= 0) {
        return false;
      }
      const dir = normalize(axisDir);
      const perpDist = distanceToLine(tri.centroid, axisLocation, dir);
      const relError = Math.abs(perpDist - radius) / radius;
      if (relError > tolerances.radiusRelativeTolerance) return false;

      // The triangle's normal should point radially: perpendicular to the
      // cylinder axis. `radialAlignment` is the magnitude of the normal's
      // component perpendicular to the axis (1 = fully radial, 0 = fully
      // axial), so this is the same "how aligned" test as the plane case,
      // just against the perpendicular-to-axis direction instead of a fixed
      // normal.
      const axialComponent = dot(tri.normal, dir);
      const radialAlignment = Math.sqrt(Math.max(0, 1 - axialComponent * axialComponent));
      return radialAlignment >= tolerances.normalDotTolerance;
    }

    case "SPHERE": {
      const center = toVec3(face.axis_location) ?? toVec3(face.centroid);
      const radius = face.radius_mm;
      if (!center || typeof radius !== "number" || radius <= 0) return false;
      const dist = length(sub(tri.centroid, center));
      const relError = Math.abs(dist - radius) / radius;
      return relError <= tolerances.radiusRelativeTolerance;
    }

    case "CONE": {
      // A cone needs an apex to test distance-consistency along its axis.
      // `FaceDetail` carries `axis`, `axis_location` and `radius_mm` (the
      // radius AT axis_location) plus `cone_half_angle_deg`, which is
      // sufficient to locate the apex and test any point on the surface -
      // unlike a fabricated half-angle, this is real data the schema
      // provides, so CONE is supported (unlike TORUS/BSPLINE/etc. below).
      const axisLocation = toVec3(face.axis_location);
      const axisDir = toVec3(face.axis);
      const radius = face.radius_mm;
      const halfAngleDeg = face.cone_half_angle_deg;
      if (
        !axisLocation ||
        !axisDir ||
        typeof radius !== "number" ||
        radius < 0 ||
        typeof halfAngleDeg !== "number"
      ) {
        return false;
      }
      const dir = normalize(axisDir);
      const tanHalfAngle = Math.tan((halfAngleDeg * Math.PI) / 180);
      const t = dot(sub(tri.centroid, axisLocation), dir);
      const perpDist = distanceToLine(tri.centroid, axisLocation, dir);
      // The sign convention for which way the cone widens along `axis` isn't
      // guaranteed by the schema, so accept whichever of the two directions
      // gives a consistent radius at this point along the axis.
      const expectedWidening = radius + t * tanHalfAngle;
      const expectedNarrowing = radius - t * tanHalfAngle;
      const errWidening = Math.abs(perpDist - expectedWidening);
      const errNarrowing = Math.abs(perpDist - expectedNarrowing);
      const err = Math.min(errWidening, errNarrowing);
      const refRadius = Math.max(radius, perpDist, 1e-6);
      return err / refRadius <= tolerances.radiusRelativeTolerance;
    }

    // TORUS, BSPLINE, BEZIER, REVOLUTION, EXTRUSION, OFFSET, OTHER: no
    // reliable analytic test available from `FaceDetail` alone (e.g. TORUS
    // would need a minor+major radius pair tested against a doubly-curved
    // surface, and freeform surfaces carry no closed-form equation at all).
    // Left unsupported rather than guessed at - falls through to "no match"
    // for that face, same honest-degradation stance as the rest of this
    // module: no highlight rather than a silently wrong one.
    default:
      return false;
  }
}

/**
 * Classify every triangle in a mesh against a set of `FaceDetail`s, returning
 * the union of triangle indices whose own geometry (centroid + geometric
 * normal, computed from its own 3 vertices - never stored per-vertex mesh
 * normals) is consistent with at least one face's analytic surface.
 *
 * Pure function: no Three.js, no DOM, plain arrays/objects in and out - safe
 * to unit test directly.
 */
export function classifyTriangles(
  positions: Float32Array,
  indices: Uint32Array | Uint16Array | number[],
  faces: readonly FaceSurfaceGeometry[],
  options: Partial<TriangleMatchTolerances> = {},
): number[] {
  if (!positions.length || !indices.length || faces.length === 0) return [];
  const tolerances: TriangleMatchTolerances = {
    ...DEFAULT_TRIANGLE_MATCH_TOLERANCES,
    ...options,
  };

  const triangles = readTriangles(positions, indices);
  const matched = new Set<number>();
  for (const tri of triangles) {
    for (const face of faces) {
      if (triangleMatchesFace(tri, face, tolerances)) {
        matched.add(tri.index);
        break;
      }
    }
  }
  return [...matched].sort((a, b) => a - b);
}
