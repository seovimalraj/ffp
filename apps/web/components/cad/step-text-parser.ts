// Pure STEP text parser — no CAD library dependency.
// All functions operate on the raw ISO-10303-21 text string.

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ProductInfo = {
  name: string;
  description: string;
};

export type SurfaceCounts = {
  cylindrical: number;
  planar: number;
  conical: number;
  spherical: number;
  toroidal: number;
  bspline: number;
};

export type StepBendData = {
  surfaceId: string;
  radius: number;
  axisPoint: { x: number; y: number; z: number };
  axisDirection: { x: number; y: number; z: number };
};

export type PartBounds = {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
};

// ---------------------------------------------------------------------------
// 4.1 — Extract product/part names
// ---------------------------------------------------------------------------

export function parseProductNames(stepText: string): ProductInfo[] {
  const results: ProductInfo[] = [];
  for (const m of stepText.matchAll(/PRODUCT\s*\(\s*'([^']*)'\s*,\s*'([^']*)'/gi)) {
    results.push({ name: m[1] ?? "", description: m[2] ?? "" });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 4.2 — Count surface types
// ---------------------------------------------------------------------------

export function countSurfaceTypes(stepText: string): SurfaceCounts {
  return {
    cylindrical: (stepText.match(/CYLINDRICAL_SURFACE\s*\(/gi) ?? []).length,
    planar:      (stepText.match(/\bPLANE\s*\(/gi) ?? []).length,
    conical:     (stepText.match(/CONICAL_SURFACE\s*\(/gi) ?? []).length,
    spherical:   (stepText.match(/SPHERICAL_SURFACE\s*\(/gi) ?? []).length,
    toroidal:    (stepText.match(/TOROIDAL_SURFACE\s*\(/gi) ?? []).length,
    bspline:     (stepText.match(/B_SPLINE_SURFACE\s*\(/gi) ?? []).length,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers — entity resolution
// ---------------------------------------------------------------------------

function resolveCartesianPoint(
  stepText: string,
  id: string,
): { x: number; y: number; z: number } | null {
  const r = new RegExp(
    `#${id}\\s*=\\s*CARTESIAN_POINT\\s*\\(\\s*'[^']*'\\s*,\\s*\\(([^)]+)\\)`,
    "i",
  );
  const m = stepText.match(r);
  if (!m?.[1]) return null;
  const vals = m[1].split(",").map((v) => parseFloat(v.trim()));
  if (vals.length < 3 || vals.some(isNaN)) return null;
  return { x: vals[0]!, y: vals[1]!, z: vals[2]! };
}

function resolveDirection(
  stepText: string,
  id: string,
): { x: number; y: number; z: number } | null {
  const r = new RegExp(
    `#${id}\\s*=\\s*DIRECTION\\s*\\(\\s*'[^']*'\\s*,\\s*\\(([^)]+)\\)`,
    "i",
  );
  const m = stepText.match(r);
  if (!m?.[1]) return null;
  const vals = m[1].split(",").map((v) => parseFloat(v.trim()));
  if (vals.length < 3 || vals.some(isNaN)) return null;
  return { x: vals[0]!, y: vals[1]!, z: vals[2]! };
}

function resolveAxis2Placement(
  stepText: string,
  placementId: string,
): { location: { x: number; y: number; z: number }; axisDir: { x: number; y: number; z: number } } | null {
  // Match: #id = AXIS2_PLACEMENT_3D('', #locId, #axisId, #refDirId)
  const axisRegex = new RegExp(
    `#${placementId}\\s*=\\s*AXIS2_PLACEMENT_3D\\s*\\(\\s*'[^']*'\\s*,\\s*#(\\d+)\\s*,\\s*#(\\d+)`,
    "i",
  );
  const axisMatch = stepText.match(axisRegex);
  if (!axisMatch) return null;
  const [, locationId, axisId] = axisMatch;
  if (!locationId || !axisId) return null;
  const location = resolveCartesianPoint(stepText, locationId);
  const axisDir = resolveDirection(stepText, axisId);
  if (!location || !axisDir) return null;
  return { location, axisDir };
}

// ---------------------------------------------------------------------------
// 4.3 — Extract cylindrical surface entity IDs
// ---------------------------------------------------------------------------

function extractCylindricalSurfaceIds(
  stepText: string,
): Array<{ surfaceId: string; axisPlacementId: string; radius: number }> {
  const results: Array<{ surfaceId: string; axisPlacementId: string; radius: number }> = [];
  const regex =
    /#(\d+)\s*=\s*CYLINDRICAL_SURFACE\s*\(\s*'[^']*'\s*,\s*#(\d+)\s*,\s*([\d.E+\-]+)\s*\)/gi;
  for (const m of stepText.matchAll(regex)) {
    const radius = parseFloat(m[3]!);
    if (!isFinite(radius) || radius <= 0) continue;
    results.push({ surfaceId: m[1]!, axisPlacementId: m[2]!, radius });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 4.5 — Full bend data extraction
// ---------------------------------------------------------------------------

export function extractBendData(stepText: string): StepBendData[] {
  const cylSurfaces = extractCylindricalSurfaceIds(stepText);
  const bends: StepBendData[] = [];
  for (const cyl of cylSurfaces) {
    const placement = resolveAxis2Placement(stepText, cyl.axisPlacementId);
    if (!placement) continue;
    // Normalise axis direction length
    const d = placement.axisDir;
    const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
    if (len < 1e-10) continue;
    bends.push({
      surfaceId:    cyl.surfaceId,
      radius:       cyl.radius,
      axisPoint:    placement.location,
      axisDirection: { x: d.x / len, y: d.y / len, z: d.z / len },
    });
  }
  return bends;
}

// ---------------------------------------------------------------------------
// 4.6 — Filter raw cylindrical candidates down to likely bend (fold) lines
// ---------------------------------------------------------------------------
//
// STEP B-rep export has no feature-tree concept of "this is a fold" — every
// cylindrical surface (a real bend fillet, a bolt hole, a corner round on a
// cutout, a boss) shows up as the same CYLINDRICAL_SURFACE entity. Two cheap,
// physically-grounded signals separate real bend lines from the rest without
// walking face/edge-loop topology:
//
//   1. Radius reuse — a bend radius is a material/design spec reused across
//      every fold in the part (min. 2 surfaces per fold: inner + outer face).
//      A radius that appears only once is almost always a local feature
//      (a chamfer, a one-off fillet), not a fold.
//   2. Perimeter proximity — a fold runs along the edge where two panels
//      meet, so its axis sits at the part's outer envelope in the two
//      dimensions perpendicular to the axis itself. A hole or cutout fillet
//      is embedded inside a panel's interior in both of those dimensions.

const BEND_RADIUS_MIN_REUSE = 2;
const BEND_PERIMETER_TOL_FRACTION = 0.1;
const BEND_PERIMETER_TOL_MIN_MM = 5;

function dominantAxisComponent(dir: { x: number; y: number; z: number }): "x" | "y" | "z" {
  const ax = Math.abs(dir.x), ay = Math.abs(dir.y), az = Math.abs(dir.z);
  if (ax >= ay && ax >= az) return "x";
  if (ay >= ax && ay >= az) return "y";
  return "z";
}

export function filterBendCandidates(
  bends: StepBendData[],
  bounds: PartBounds,
): StepBendData[] {
  if (bends.length === 0) return bends;

  const radiusCounts = new Map<string, number>();
  for (const b of bends) {
    const key = b.radius.toFixed(2);
    radiusCounts.set(key, (radiusCounts.get(key) ?? 0) + 1);
  }

  return bends.filter((b) => {
    const reuseCount = radiusCounts.get(b.radius.toFixed(2)) ?? 0;
    if (reuseCount < BEND_RADIUS_MIN_REUSE) return false;

    const axis = dominantAxisComponent(b.axisDirection);
    const perpDims = (["x", "y", "z"] as const).filter((d) => d !== axis);

    return perpDims.some((d) => {
      const val = d === "x" ? b.axisPoint.x : d === "y" ? b.axisPoint.y : b.axisPoint.z;
      const min = d === "x" ? bounds.minX : d === "y" ? bounds.minY : bounds.minZ;
      const max = d === "x" ? bounds.maxX : d === "y" ? bounds.maxY : bounds.maxZ;
      const span = max - min;
      const tol = Math.max(BEND_PERIMETER_TOL_MIN_MM, span * BEND_PERIMETER_TOL_FRACTION);
      return Math.abs(val - min) < tol || Math.abs(val - max) < tol;
    });
  });
}
