import * as THREE from "three";
import {
  parseProductNames,
  countSurfaceTypes,
  extractBendData,
  filterBendCandidates,
  type StepBendData,
  type SurfaceCounts,
} from "./step-text-parser";
import {
  weldMesh,
  buildTopology,
  segmentRegions,
  buildBendGraph,
  measureSheetThickness,
  type BendGraph,
} from "./sm-unfold-engine";

// Re-export for consumers that import StepBendData via the detector
export type { StepBendData, SurfaceCounts };

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DetectionResult = {
  isSheetMetal: boolean;
  confidence: number;
  detectionMethods: string[];
  boundingBox: {
    width: number;
    height: number;
    depth: number;
    flatnessRatio: number;
  } | null;
  thickness: number | null;
  hasBends: boolean;
  bendLineCount: number;
  /** STEP-derived bend axes — populated only when rawStepText is provided. */
  bendData?: StepBendData[];
};

// ---------------------------------------------------------------------------
// Calibration constants (kept for fallback mesh-based path)
// ---------------------------------------------------------------------------

export const FLAT_RATIO_THRESHOLD  = 0.25;
export const MODERATE_FLAT_RATIO   = 0.40;
export const MIN_SPAN_RATIO        = 0.3;
export const NORMAL_BIN_DOT_THRESHOLD = 0.85;
export const DOMINANT_NORMAL_FRACTION = 0.55;
export const VOL_SURFACE_THRESHOLD = 0.04;
export const BEND_MIN_ANGLE        = 15;
export const BEND_MAX_ANGLE        = 165;
export const MIN_FOLD_EDGES        = 3;
export const COLLINEAR_ANGLE_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// LAYER 1 — STEP-text-based detection (primary path)
// ---------------------------------------------------------------------------

// GROUP A — direct sheet metal terms → confidence 1.0
const GROUP_A = [
  "sheet_metal", "sheetmetal", "sheet-metal", "sheet metal",
  "flat_pattern", "flatpattern", "flat pattern",
  "sm_", "_sm", "blank", "developed", "unfold", "unfolded", "sheet",
];

// GROUP B — part types commonly made from sheet metal → confidence 0.85
const GROUP_B = [
  "bracket", "panel", "enclosure", "cover", "shroud",
  "chassis", "tray", "brace", "clip", "strap", "gusset", "flange",
  "tab", "lug", "guard", "shield", "hood", "door", "lid", "plate",
  "duct", "housing", "frame", "support", "mount", "hinge", "clamp",
  "retainer",
];

// GROUP C — manufacturing process terms → confidence 0.7
const GROUP_C = [
  "bend", "bent", "fold", "formed", "stamp", "stamped",
  "punch", "laser", "shear",
];

function runS1Step(stepText: string): { confidence: number; method: string | null } {
  const products = parseProductNames(stepText);
  const allNames = products
    .map((p) => (p.name + " " + p.description).toLowerCase())
    .join(" ");

  if (GROUP_A.some((k) => allNames.includes(k)))
    return { confidence: 1.0, method: "S1_step_direct" };
  if (GROUP_B.some((k) => allNames.includes(k)))
    return { confidence: 0.85, method: "S1_step_type" };
  if (GROUP_C.some((k) => allNames.includes(k)))
    return { confidence: 0.7, method: "S1_step_process" };
  return { confidence: 0.0, method: null };
}

function runS1Name(partName: string): { confidence: number; method: string | null } {
  const lower = partName.toLowerCase();
  if (GROUP_A.some((k) => lower.includes(k)))
    return { confidence: 1.0, method: "S1_name_direct" };
  if (GROUP_B.some((k) => lower.includes(k)))
    return { confidence: 0.85, method: "S1_name_type" };
  if (GROUP_C.some((k) => lower.includes(k)))
    return { confidence: 0.7, method: "S1_name_process" };
  return { confidence: 0.0, method: null };
}

function runS2Step(surfaces: SurfaceCounts): { confidence: number; method: string | null } {
  const total =
    surfaces.cylindrical + surfaces.planar + surfaces.conical +
    surfaces.spherical + surfaces.toroidal + surfaces.bspline;

  if (total === 0) return { confidence: 0, method: null };

  const complex = surfaces.toroidal + surfaces.spherical + surfaces.bspline + surfaces.conical;
  const sheetLike = surfaces.cylindrical + surfaces.planar;

  // Sheet metal: mostly planes + cylinders, almost no complex surfaces
  if (
    complex / total < 0.1 &&
    sheetLike / total > 0.8
  ) {
    return { confidence: 0.9, method: "S2_step_surfaces" };
  }
  // Moderate: low complex surfaces but mixed profile
  if (complex / total < 0.2 && surfaces.cylindrical > 0) {
    return { confidence: 0.5, method: "S2_step_surfaces_moderate" };
  }
  return { confidence: 0, method: null };
}

// ---------------------------------------------------------------------------
// LAYER 1 — Mesh-based fallback (used when rawStepText is absent)
// ---------------------------------------------------------------------------

type S2MeshResult = {
  confidence: number;
  method: string | null;
  dims: { width: number; height: number; depth: number; flatnessRatio: number } | null;
};

function runS2Mesh(geometry: THREE.BufferGeometry): S2MeshResult {
  try {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    if (!bb) return { confidence: 0, method: null, dims: null };

    const size = new THREE.Vector3();
    bb.getSize(size);
    let sx = size.x, sy = size.y, sz = size.z;

    if (sx < 0.1 && sy < 0.1 && sz < 0.1 && (sx + sy + sz) > 1e-10) {
      sx *= 1000; sy *= 1000; sz *= 1000;
    }
    const sorted = [sx, sy, sz].sort((a, b) => a - b);
    const small = sorted[0]!, mid = sorted[1]!, large = sorted[2]!;
    if (large < 1e-10) return { confidence: 0, method: null, dims: null };

    const flatnessRatio = small / large;
    const spanRatio = mid / large;
    const dims = { width: large, height: mid, depth: small, flatnessRatio };

    if (flatnessRatio < FLAT_RATIO_THRESHOLD && spanRatio > MIN_SPAN_RATIO)
      return { confidence: 0.7, method: "S2_bbox", dims };
    if (flatnessRatio < MODERATE_FLAT_RATIO && spanRatio > MIN_SPAN_RATIO)
      return { confidence: 0.4, method: "S2_bbox_moderate", dims };
    return { confidence: 0, method: null, dims };
  } catch {
    return { confidence: 0, method: null, dims: null };
  }
}

const AXES = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
] as const;

function runS3Mesh(geometry: THREE.BufferGeometry): { confidence: number; method: string | null } {
  try {
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    const indexAttr = geometry.getIndex();
    if (!posAttr) return { confidence: 0, method: null };

    const triCount = indexAttr
      ? Math.floor(indexAttr.count / 3)
      : Math.floor(posAttr.count / 3);
    if (triCount < 4) return { confidence: 0, method: null };

    const getIdx = (i: number) => (indexAttr ? indexAttr.getX(i) : i);
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
    const cross = new THREE.Vector3();
    const bins = [0, 0, 0, 0, 0, 0];
    let totalTris = 0;

    for (let t = 0; t < triCount; t++) {
      vA.fromBufferAttribute(posAttr, getIdx(t * 3));
      vB.fromBufferAttribute(posAttr, getIdx(t * 3 + 1));
      vC.fromBufferAttribute(posAttr, getIdx(t * 3 + 2));
      cross.crossVectors(
        new THREE.Vector3().subVectors(vB, vA),
        new THREE.Vector3().subVectors(vC, vA),
      );
      const len = cross.length();
      if (len < 1e-12) continue;
      cross.divideScalar(len);
      totalTris++;
      for (let a = 0; a < 6; a++) {
        if (cross.dot(AXES[a]!) >= NORMAL_BIN_DOT_THRESHOLD) { bins[a]!++; break; }
      }
    }
    if (totalTris < 4) return { confidence: 0, method: null };

    const sorted = bins.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c);
    const top1 = sorted[0]!, top2 = sorted[1]!;
    if ((top1.c + top2.c) / totalTris < DOMINANT_NORMAL_FRACTION)
      return { confidence: 0, method: null };
    if (AXES[top1.i]!.dot(AXES[top2.i]!) > -0.7) return { confidence: 0, method: null };
    return { confidence: 0.6, method: "S3_normal_cluster" };
  } catch {
    return { confidence: 0, method: null };
  }
}

function runS4Mesh(geometry: THREE.BufferGeometry): { confidence: number; method: string | null } {
  try {
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    const indexAttr = geometry.getIndex();
    if (!posAttr) return { confidence: 0, method: null };

    const triCount = indexAttr
      ? Math.floor(indexAttr.count / 3)
      : Math.floor(posAttr.count / 3);
    if (triCount < 4) return { confidence: 0, method: null };

    const getIdx = (i: number) => (indexAttr ? indexAttr.getX(i) : i);
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
    let totalArea = 0, signedVolume = 0;

    for (let t = 0; t < triCount; t++) {
      vA.fromBufferAttribute(posAttr, getIdx(t * 3));
      vB.fromBufferAttribute(posAttr, getIdx(t * 3 + 1));
      vC.fromBufferAttribute(posAttr, getIdx(t * 3 + 2));
      const cross = new THREE.Vector3().crossVectors(
        new THREE.Vector3().subVectors(vB, vA),
        new THREE.Vector3().subVectors(vC, vA),
      );
      totalArea += cross.length() * 0.5;
      signedVolume += vA.dot(new THREE.Vector3().crossVectors(vB, vC)) / 6;
    }
    if (totalArea < 1e-10) return { confidence: 0, method: null };
    const ratio = Math.abs(signedVolume) / Math.pow(totalArea, 1.5);
    return ratio < VOL_SURFACE_THRESHOLD
      ? { confidence: 0.5, method: "S4_vol_surface" }
      : { confidence: 0, method: null };
  } catch {
    return { confidence: 0, method: null };
  }
}

// ---------------------------------------------------------------------------
// Engine-structure analysis — the SINGLE source of truth for hasBends
// (round-2 CORRECTION 3), plus the thickness-consistency disqualifier.
// It runs the unfold engine's own weld/segment/bend-graph pipeline, so the
// Unfold button state always matches what the engine can actually do; the
// old cylinder-count check and mesh dihedral scan are gone.
// ---------------------------------------------------------------------------

// Plausible sheet stock range. 10mm is deliberately EXCLUSIVE: cross-sections
// at or beyond it are machined/cast territory, not folded sheet.
const PLAUSIBLE_MIN_THICKNESS_MM = 0.1;
const PLAUSIBLE_MAX_THICKNESS_MM = 10;
// A single stock feeds the whole part — per-plate thickness samples may vary
// by tessellation noise, not by design features.
const THICKNESS_VARIATION_TOLERANCE = 0.15;

export type ThicknessConsistency = {
  consistent: boolean;
  avgThickness: number | null;
  samples: number[];
};

type StructureAnalysis = {
  regionHasBends: boolean;
  regionBendCount: number;
  regionCount: number;
  thickness: ThicknessConsistency;
};

// One thickness sample per plate group: the spread of the group's skin
// vertices along its dominant skin normal. A solid sheet plate (two welded
// skins) reads the stock thickness; a lone face of a thick body reads ~0
// (unmeasurable) because its opposite face is too far away to be grouped.
function sampleGroupThicknesses(
  weldedPos: number[],
  faces: Array<[number, number, number]>,
  region: Int32Array,
  regionCount: number,
  sizes: number[],
  graph: BendGraph,
): number[] {
  const { groupOf, groupCount, regNormal, isLarge } = graph;
  const groupVerts: Array<Set<number>> = Array.from(
    { length: groupCount },
    () => new Set<number>(),
  );
  faces.forEach((f, fi) => {
    const r = region[fi];
    if (!isLarge[r]) return;
    const g = groupOf[r];
    if (g === -1) return;
    for (const vi of f) groupVerts[g].add(vi);
  });
  const domRegion = new Array<number>(groupCount).fill(-1);
  for (let r = 0; r < regionCount; r++) {
    if (!isLarge[r]) continue;
    const g = groupOf[r];
    if (g === -1) continue;
    if (domRegion[g] === -1 || sizes[r] > sizes[domRegion[g]]) domRegion[g] = r;
  }
  const samples: number[] = [];
  for (let g = 0; g < groupCount; g++) {
    if (domRegion[g] === -1 || groupVerts[g].size === 0) continue;
    samples.push(
      measureSheetThickness(weldedPos, groupVerts[g], regNormal[domRegion[g]]),
    );
  }
  return samples;
}

function checkThicknessConsistency(samples: number[]): ThicknessConsistency {
  const valid = samples.filter(
    (t) => t > PLAUSIBLE_MIN_THICKNESS_MM && t < PLAUSIBLE_MAX_THICKNESS_MM,
  );
  const avg = valid.length
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : null;
  // Sheet metal: (nearly) every plate reads the same plausible stock
  // thickness. A machined/cast body reads thick or unmeasurable sections
  // instead. Majority rule rather than an absolute sample count so that a
  // plain flat blank (one plate, one sample) still qualifies.
  if (valid.length === 0 || valid.length < Math.ceil(samples.length / 2)) {
    return { consistent: false, avgThickness: avg, samples };
  }
  const variance =
    valid.reduce((a, b) => a + (b - avg!) ** 2, 0) / valid.length;
  const stdDev = Math.sqrt(variance);
  const consistent =
    stdDev / avg! < THICKNESS_VARIATION_TOLERANCE &&
    avg! < PLAUSIBLE_MAX_THICKNESS_MM;
  return { consistent, avgThickness: avg, samples };
}

function analyzeSheetStructure(
  geometry: THREE.BufferGeometry,
): StructureAnalysis | null {
  try {
    const { weldedPos, faces } = weldMesh(geometry);
    if (faces.length === 0) return null;
    const { normals, edgeMap, v } = buildTopology(weldedPos, faces);
    const { region, regionCount, sizes } = segmentRegions(faces, normals, edgeMap);

    let regionHasBends = false;
    let regionBendCount = 0;
    let thickness: ThicknessConsistency = {
      consistent: false,
      avgThickness: null,
      samples: [],
    };
    // Default strip scale first; 5mm+ stock needs the coarser scale before
    // its two skins group into one plate (mirrors unfoldGeometry's ladder).
    for (const stripWidth of [5, 15]) {
      const graph = buildBendGraph(
        faces, normals, edgeMap, region, regionCount, sizes, v, stripWidth,
      );
      if (graph.folds.length > 0) {
        regionHasBends = true;
        regionBendCount = Math.max(regionBendCount, graph.folds.length);
      }
      thickness = checkThicknessConsistency(
        sampleGroupThicknesses(weldedPos, faces, region, regionCount, sizes, graph),
      );
      if (thickness.consistent) break;
    }
    console.log(
      "[SM-BENDS-V2]",
      "regions:", regionCount,
      "folds:", regionBendCount,
      "hasBends:", regionHasBends,
    );
    return { regionHasBends, regionBendCount, regionCount, thickness };
  } catch (err) {
    console.warn("[SM-DETECT-V2] structure analysis failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bounding box helper (used as S3 fallback when STEP text present)
// ---------------------------------------------------------------------------

function getBoundingBoxDims(
  geometry: THREE.BufferGeometry,
): { width: number; height: number; depth: number; flatnessRatio: number } | null {
  try {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    if (!bb) return null;
    const size = new THREE.Vector3();
    bb.getSize(size);
    let sx = size.x, sy = size.y, sz = size.z;
    if (sx < 0.1 && sy < 0.1 && sz < 0.1 && (sx + sy + sz) > 1e-10) {
      sx *= 1000; sy *= 1000; sz *= 1000;
    }
    const sorted = [sx, sy, sz].sort((a, b) => a - b);
    const small = sorted[0]!, mid = sorted[1]!, large = sorted[2]!;
    if (large < 1e-10) return null;
    return { width: large, height: mid, depth: small, flatnessRatio: small / large };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main export — STEP-based when rawStepText provided, mesh fallback otherwise
// ---------------------------------------------------------------------------

export function detectSheetMetal(
  geometry: THREE.BufferGeometry,
  partName = "",
  rawStepText?: string | null,
): DetectionResult {
  const methods: string[] = [];

  // ── STEP-TEXT PATH ────────────────────────────────────────────────────────
  if (rawStepText && rawStepText.length > 0) {
    const s1Step = runS1Step(rawStepText);
    const s1Name = runS1Name(partName);
    const s1 = s1Step.confidence >= s1Name.confidence ? s1Step : s1Name;
    if (s1.method) methods.push(s1.method);

    const surfaces = countSurfaceTypes(rawStepText);
    const s2Step = runS2Step(surfaces);
    if (s2Step.method) methods.push(s2Step.method);

    // Bounding box as S3 (geometry only for flatness, not for surface classification)
    const bbDims = getBoundingBoxDims(geometry);
    let s3Conf = 0.0;
    if (bbDims) {
      s3Conf = bbDims.flatnessRatio < FLAT_RATIO_THRESHOLD ? 0.6
        : bbDims.flatnessRatio < MODERATE_FLAT_RATIO ? 0.3 : 0.0;
      if (s3Conf > 0) methods.push("S3_bbox_flatness");
    }

    const maxConf = Math.max(s1.confidence, s2Step.confidence, s3Conf);
    const totalConfidence = Math.min(1.0, maxConf);
    let isSheetMetal = totalConfidence >= 0.7;

    // Extract candidate bend axes, then filter out cylindrical surfaces that are
    // holes/cutout fillets/bosses rather than real fold lines (see
    // filterBendCandidates in step-text-parser.ts for the two signals used).
    const bendDataRaw = surfaces.cylindrical > 0 ? extractBendData(rawStepText) : [];
    geometry.computeBoundingBox();
    const rawBB = geometry.boundingBox;
    const bendData = rawBB
      ? filterBendCandidates(bendDataRaw, {
          minX: rawBB.min.x, maxX: rawBB.max.x,
          minY: rawBB.min.y, maxY: rawBB.max.y,
          minZ: rawBB.min.z, maxZ: rawBB.max.z,
        })
      : bendDataRaw;

    // CORRECTION 4 — disqualifying override: whatever S1–S4 scored, a part
    // without one consistent, plausible sheet thickness across its plates is
    // not sheet metal. Run the (heavier) structure analysis only for
    // preliminary positives.
    const structure = isSheetMetal ? analyzeSheetStructure(geometry) : null;
    if (isSheetMetal && structure) {
      const { consistent, avgThickness } = structure.thickness;
      const finalSheet =
        consistent && (avgThickness ?? Infinity) <= PLAUSIBLE_MAX_THICKNESS_MM;
      console.log(
        "[SM-DETECT-V2]",
        "baseScore:", totalConfidence,
        "thicknessConsistent:", consistent,
        "avgThickness:", avgThickness,
        "FINAL isSheetMetal:", finalSheet,
      );
      if (!finalSheet) {
        isSheetMetal = false;
        methods.push("S5_thickness_override");
      }
    }

    // CORRECTION 3 (round 2) — hasBends comes from the unfold engine's own
    // segmentation, nothing else: the button state must always match what
    // the engine can actually unfold. bendData (cylinder axes) is kept only
    // as auxiliary geometry for consumers, never as a bend detector.
    const hasBends = isSheetMetal && (structure?.regionHasBends ?? false);
    const bendLineCount = hasBends ? structure!.regionBendCount : 0;

    console.log(
      `[SM-DETECT] ${partName || "(unnamed)"} →`,
      JSON.stringify({
        isSheetMetal, hasBends, bendCount: bendLineCount, confidence: totalConfidence,
        detectionMethods: methods, surfaceCounts: surfaces,
        bendDataCount: bendData.length,
      }),
    );

    return {
      isSheetMetal,
      confidence: totalConfidence,
      detectionMethods: methods,
      boundingBox: bbDims,
      thickness: bbDims?.depth ?? null,
      hasBends,
      bendLineCount,
      bendData: bendData.length > 0 ? bendData : undefined,
    };
  }

  // ── MESH FALLBACK PATH (non-STEP formats or STEP text unavailable) ────────
  let totalConfidence = 0;

  const s1Name = runS1Name(partName);
  if (s1Name.method) { totalConfidence += s1Name.confidence; methods.push(s1Name.method); }

  const s2Mesh = runS2Mesh(geometry);
  if (s2Mesh.method) { totalConfidence += s2Mesh.confidence; methods.push(s2Mesh.method); }

  const s3Mesh = runS3Mesh(geometry);
  if (s3Mesh.method) { totalConfidence += s3Mesh.confidence; methods.push(s3Mesh.method); }

  const s4Mesh = runS4Mesh(geometry);
  if (s4Mesh.method) { totalConfidence += s4Mesh.confidence; methods.push(s4Mesh.method); }

  totalConfidence = Math.min(1.0, totalConfidence);

  let isSheetMetal =
    s1Name.confidence >= 0.7 ||
    s2Mesh.confidence >= 0.7 ||
    totalConfidence >= 0.6;

  // CORRECTION 4 — same disqualifying thickness override as the STEP path
  const structure = isSheetMetal ? analyzeSheetStructure(geometry) : null;
  if (isSheetMetal && structure) {
    const { consistent, avgThickness } = structure.thickness;
    const finalSheet =
      consistent && (avgThickness ?? Infinity) <= PLAUSIBLE_MAX_THICKNESS_MM;
    console.log(
      "[SM-DETECT-V2]",
      "baseScore:", totalConfidence,
      "thicknessConsistent:", consistent,
      "avgThickness:", avgThickness,
      "FINAL isSheetMetal:", finalSheet,
    );
    if (!finalSheet) {
      isSheetMetal = false;
      methods.push("S5_thickness_override");
    }
  }

  // CORRECTION 3 (round 2) — engine segmentation is the only bend detector
  // here too; the old per-edge dihedral scan is gone.
  const hasBends = isSheetMetal && (structure?.regionHasBends ?? false);
  const bendLineCount = hasBends ? structure!.regionBendCount : 0;

  console.log(
    `[SM-DETECT] ${partName || "(unnamed)"} (mesh fallback) →`,
    JSON.stringify({ isSheetMetal, hasBends, bendLineCount, confidence: totalConfidence, detectionMethods: methods }),
  );

  return {
    isSheetMetal,
    confidence: totalConfidence,
    detectionMethods: methods,
    boundingBox: s2Mesh.dims,
    thickness: s2Mesh.dims?.depth ?? null,
    hasBends,
    bendLineCount,
  };
}
