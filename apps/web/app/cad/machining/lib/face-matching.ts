import type { ExactFace, ExactFaceKind } from "@/components/cad/exact-cad-topology";
import type { FaceDetail, SurfaceType } from "@/types/machining-analysis";

/**
 * Geometric matcher between the CAD service's independently-tessellated
 * `FaceDetail[]` (from `include_face_details=true`) and this viewer's own
 * `ExactFace[]` (from the vendored OCCT WASM build's `TessellateWithTopology`).
 *
 * The two kernels tessellate the same STEP file independently, so face ids
 * never line up - this never compares ids, only geometry: surface kind,
 * radius, axis direction, and spatial proximity of the analytic anchor
 * point (axis_location/origin, falling back to centroid).
 */

/** Backend `SurfaceType` -> frontend `ExactFaceKind`. Freeform surfaces never match. */
const SURFACE_TYPE_TO_KIND: Partial<Record<SurfaceType, ExactFaceKind>> = {
  PLANE: "plane",
  CYLINDER: "cylinder",
  CONE: "cone",
  SPHERE: "sphere",
  TORUS: "torus",
};

export interface FaceMatchTolerances {
  /** Relative radius tolerance, e.g. 0.02 = 2%. */
  radiusRelativeTolerance: number;
  /** Minimum |dot product| between unit axis directions to call them parallel. */
  axisDotTolerance: number;
  /** Absolute distance tolerance for the anchor point, scaled by model size. */
  distanceTolerance: number;
}

const DEFAULT_TOLERANCES: FaceMatchTolerances = {
  radiusRelativeTolerance: 0.02,
  axisDotTolerance: 0.05, // |dot| >= 0.95 <=> within ~18 degrees
  distanceTolerance: 1, // mm, overridden by scaleDistanceTolerance() when a model size is known
};

export interface FaceMatchCandidate {
  face: ExactFace;
  /** Lower is better - a weighted geometric distance, not a physical unit. */
  score: number;
}

export interface FaceMatchResult {
  /** The backend face_id this result is for. */
  faceId: number;
  /** Best match, if any candidate cleared every tolerance gate. */
  match: ExactFace | null;
  /** Every candidate that cleared the gates, best (lowest score) first. */
  candidates: FaceMatchCandidate[];
}

function vecLength(v: [number, number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = vecLength(v);
  if (len < 1e-12) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function distance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return vecLength([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
}

function toTuple(
  v: { x: number; y: number; z: number } | null | undefined,
): [number, number, number] | null {
  if (!v) return null;
  return [v.x, v.y, v.z];
}

/**
 * A distance tolerance sized for the model, rather than a fixed millimetre
 * value: 0.5% of the bounding-box diagonal, clamped to a sane floor so a
 * tiny part does not require sub-micron agreement between two independently
 * tessellated kernels.
 */
export function scaleDistanceTolerance(modelDiagonal: number): number {
  return Math.max(modelDiagonal * 0.005, 0.05);
}

/** The anchor point a `FaceDetail` carries: axis_location for curved surfaces, else centroid. */
function backendAnchor(detail: FaceDetail): [number, number, number] | null {
  return toTuple(detail.axis_location) ?? toTuple(detail.centroid);
}

/** The anchor point an `ExactFace` carries: analytic.origin, since that is the surface location. */
function frontendAnchor(face: ExactFace): [number, number, number] | null {
  return face.analytic?.origin ?? null;
}

/**
 * Score one backend `FaceDetail` against one candidate `ExactFace`. Returns
 * `null` when any tolerance gate fails (kind mismatch, radius out of
 * tolerance, axis not parallel, or anchor too far apart) - such faces are
 * never candidates, not merely low-scoring ones.
 */
function scoreCandidate(
  detail: FaceDetail,
  face: ExactFace,
  tolerances: FaceMatchTolerances,
): number | null {
  const expectedKind = SURFACE_TYPE_TO_KIND[detail.surface_type];
  if (!expectedKind || face.kind !== expectedKind) return null;

  let score = 0;

  // Radius: required to match within tolerance for the curved kinds that
  // carry one. Planes have no radius on either side and skip this gate.
  if (typeof detail.radius_mm === "number" && detail.radius_mm > 0) {
    const faceRadius = face.analytic?.radius;
    if (typeof faceRadius !== "number") return null;
    const relError =
      Math.abs(faceRadius - detail.radius_mm) / detail.radius_mm;
    if (relError > tolerances.radiusRelativeTolerance) return null;
    score += relError * 10;
  }

  // Axis direction: required to be parallel (either sense) within tolerance
  // for kinds that carry an axis/normal. Planes carry their direction as
  // `normal` on both sides; curved surfaces carry it as `axis`.
  const backendAxis =
    detail.surface_type === "PLANE" ? toTuple(detail.normal) : toTuple(detail.axis);
  const frontendAxis =
    face.kind === "plane" ? face.analytic?.normal : face.analytic?.axis;
  if (backendAxis && frontendAxis) {
    const a = normalize(backendAxis);
    const b = normalize(frontendAxis);
    const d = Math.abs(dot(a, b));
    if (d < 1 - tolerances.axisDotTolerance) return null;
    score += (1 - d) * 5;
  } else if (backendAxis || frontendAxis) {
    // One side has an axis and the other doesn't - not a confident match.
    return null;
  }

  // Spatial proximity of the anchor point.
  const backendPoint = backendAnchor(detail);
  const frontendPoint = frontendAnchor(face);
  if (backendPoint && frontendPoint) {
    const dist = distance(backendPoint, frontendPoint);
    if (dist > tolerances.distanceTolerance) return null;
    score += dist;
  } else {
    // No anchor on either side to compare - fall back to kind+radius+axis
    // agreement alone, which is weaker evidence, so penalize it.
    score += tolerances.distanceTolerance;
  }

  return score;
}

/**
 * Find the best-matching `ExactFace` (and every other candidate that also
 * cleared tolerance) for one backend `FaceDetail`.
 */
export function matchFaceDetail(
  detail: FaceDetail,
  exactFaces: readonly ExactFace[],
  tolerances: FaceMatchTolerances = DEFAULT_TOLERANCES,
): FaceMatchResult {
  const candidates: FaceMatchCandidate[] = [];
  for (const face of exactFaces) {
    const score = scoreCandidate(detail, face, tolerances);
    if (score !== null) {
      candidates.push({ face, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return {
    faceId: detail.face_id,
    match: candidates.length > 0 ? candidates[0].face : null,
    candidates,
  };
}

/**
 * Resolve a backend feature's `face_ids` (indices into `face_details[]`)
 * into matched frontend `ExactFace.id`s, for `CadViewer`'s
 * `highlightedFaceIds` prop. A `face_ids` entry with no `FaceDetail` (out of
 * range, or `face_details` unavailable) or no geometric match is simply
 * skipped - callers should fall back to `markerLocation` when the returned
 * array is empty, never show nothing with no indication.
 */
export function matchFeatureFaces(
  featureFaceIds: readonly number[],
  faceDetails: readonly FaceDetail[] | null | undefined,
  exactFaces: readonly ExactFace[],
  tolerances: FaceMatchTolerances = DEFAULT_TOLERANCES,
): string[] {
  if (!faceDetails || faceDetails.length === 0 || exactFaces.length === 0) {
    return [];
  }
  const detailsById = new Map(faceDetails.map((d) => [d.face_id, d]));
  const matchedIds = new Set<string>();
  for (const faceId of featureFaceIds) {
    const detail = detailsById.get(faceId);
    if (!detail) continue;
    const result = matchFaceDetail(detail, exactFaces, tolerances);
    if (result.match) {
      matchedIds.add(result.match.id);
    }
  }
  return [...matchedIds];
}

export { DEFAULT_TOLERANCES as DEFAULT_FACE_MATCH_TOLERANCES };
