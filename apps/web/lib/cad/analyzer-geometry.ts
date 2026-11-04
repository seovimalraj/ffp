/**
 * Turns the CAD service's process-specific analyzers into pricing inputs, and
 * reconciles them with the process the classifier picked.
 *
 * No flat pattern is computed anywhere, so sheet metal area and cut length come
 * from the geometry of a uniform-thickness part. Its faces are two skins plus cut
 * edges, so A = 2 x flat + cut x t and V = flat x t, which gives:
 *   flat = V / t    cut = (A - 2 x flat) / t
 * Bend faces roughly average out, since the inner radius is smaller and the outer
 * larger. This only holds for true sheet parts, so it is gated on the candidate
 * check and sanity-checked, with a fallback built from the detected features.
 */

import type { MachiningAnalysisResponse } from "@/types/machining-analysis";
import type { SheetMetalAnalysisResponse } from "@/types/sheet-metal-analysis";

export interface ProcessAnalyzers {
  sheetMetal: SheetMetalAnalysisResponse | null;
  machining: MachiningAnalysisResponse | null;
}

export type ComplexityLevel = "simple" | "moderate" | "complex";

// Above this share of surface area on cut edges, the part is not a uniform sheet
const MAX_CUT_EDGE_AREA_FRACTION = 0.2;
// A curved face this short relative to thickness is a corner blend, not a bend
const MIN_BEND_LENGTH_THICKNESS_RATIO = 2.5;
// Formed sheet has almost no freeform surfaces; molded and sculpted parts have many
const MAX_SHEET_FREEFORM_SURFACES = 10;
// Most this reconciliation will claim for a process the classifier did not pick
const MAX_OVERRIDE_CONFIDENCE = 0.85;
// Flat forms aren't listed: stock form checks flatness first, so a disc or flange
// reads as PLATE even though it can be turned
const NON_TURNABLE_STOCK_FORMS = new Set([
  "BLOCK",
  "SQUARE_BAR",
  "RECTANGULAR_BAR",
]);

function realBends(sheetMetal: SheetMetalAnalysisResponse) {
  const thickness = sheetMetal.thickness?.dominant_thickness_mm ?? 0;
  const minLength = thickness * MIN_BEND_LENGTH_THICKNESS_RATIO;
  return (sheetMetal.bends ?? []).filter(
    (bend) => (bend.length_mm ?? 0) >= minLength,
  );
}

function holeCircumferenceTotal(sheetMetal: SheetMetalAnalysisResponse): number {
  return (sheetMetal.holes ?? []).reduce(
    (sum, hole) => sum + Math.PI * (hole.diameter_mm ?? 0),
    0,
  );
}

/**
 * Flat area from volume, or null when volume and surface area disagree. A negative
 * or oversized cut-edge area means the part isn't a uniform sheet, or that the
 * reported volume is wrong, which does happen on otherwise clean models.
 */
function flatAreaFromVolume(sheetMetal: SheetMetalAnalysisResponse): number | null {
  const thickness = sheetMetal.thickness?.dominant_thickness_mm ?? 0;
  const volume = sheetMetal.geometry?.volume_mm3 ?? 0;
  const surfaceArea = sheetMetal.geometry?.surface_area_mm2 ?? 0;
  if (
    !sheetMetal.thickness?.is_uniform ||
    thickness <= 0 ||
    volume <= 0 ||
    surfaceArea <= 0
  ) {
    return null;
  }
  const flatArea = volume / thickness;
  const cutEdgeArea = surfaceArea - 2 * flatArea;
  if (
    cutEdgeArea <= 0 ||
    cutEdgeArea / surfaceArea > MAX_CUT_EDGE_AREA_FRACTION
  ) {
    return null;
  }
  return flatArea;
}

function cutLengthFromGeometry(sheetMetal: SheetMetalAnalysisResponse): number | null {
  const flatArea = flatAreaFromVolume(sheetMetal);
  if (
    flatArea === null ||
    sheetMetal.sheet_metal_candidate?.status !== "resolved"
  ) {
    return null;
  }
  const surfaceArea = sheetMetal.geometry?.surface_area_mm2 ?? 0;
  const thickness = sheetMetal.thickness?.dominant_thickness_mm ?? 0;
  return (surfaceArea - 2 * flatArea) / thickness;
}

function cutLengthFromFeatures(sheetMetal: SheetMetalAnalysisResponse): number {
  const cutouts = (sheetMetal.cutouts ?? []).reduce(
    (sum, cutout) => sum + (cutout.perimeter_mm ?? 0),
    0,
  );
  const slots = (sheetMetal.slots ?? []).reduce(
    (sum, slot) => sum + 2 * ((slot.length_mm ?? 0) + (slot.width_mm ?? 0)),
    0,
  );
  return (
    (sheetMetal.outer_profile?.perimeter_mm ?? 0) +
    cutouts +
    slots +
    holeCircumferenceTotal(sheetMetal)
  );
}

/** The pricing engine's sheet metal fields that the analyzer can measure. */
export function sheetMetalFeaturesFromAnalyzer(
  sheetMetal: SheetMetalAnalysisResponse,
) {
  const thickness = sheetMetal.thickness?.dominant_thickness_mm ?? 0;
  const bends = realBends(sheetMetal);
  const totalCutLength =
    cutLengthFromGeometry(sheetMetal) ?? cutLengthFromFeatures(sheetMetal);
  const holeCircumference = holeCircumferenceTotal(sheetMetal);
  const profileCount =
    (sheetMetal.cutouts?.length ?? 0) + (sheetMetal.slots?.length ?? 0);
  const surfaceArea = sheetMetal.geometry?.surface_area_mm2 ?? 0;

  return {
    thickness,
    flatArea: flatAreaFromVolume(sheetMetal) ?? surfaceArea / 2,
    // The engine prices holes separately, so this excludes them
    perimeterLength: Math.max(0, totalCutLength - holeCircumference),
    bendCount: bends.length,
    bendAngles: bends.map((bend) => bend.angle_deg ?? 90),
    holeCount: sheetMetal.holes?.length ?? 0,
    totalHoleDiameter: holeCircumference,
    complexCuts: profileCount,
    cornerCount: 4 + bends.length * 2,
    hasHems: (sheetMetal.hems?.length ?? 0) > 0,
    hasCountersinks: false,
    flangeCount: Math.floor(bends.length / 2),
    requiresMultipleSetups: bends.length > 10,
  };
}

export function sheetMetalComplexityFromAnalyzer(
  sheetMetal: SheetMetalAnalysisResponse,
): ComplexityLevel {
  const score =
    realBends(sheetMetal).length * 2 +
    (sheetMetal.holes?.length ?? 0) * 0.5 +
    (sheetMetal.cutouts?.length ?? 0) +
    (sheetMetal.slots?.length ?? 0);
  if (score < 8) return "simple";
  if (score < 25) return "moderate";
  return "complex";
}

export function machiningComplexityFromAnalyzer(
  machining: MachiningAnalysisResponse,
): ComplexityLevel {
  const indicators = machining.complexity_indicators;
  const extraSetups = Math.max(
    0,
    (machining.setup_analysis?.minimum_direction_count_covering_all ?? 1) - 1,
  );
  const score =
    (indicators?.pocket_count ?? 0) * 3 +
    (indicators?.slot_count ?? 0) * 3 +
    (indicators?.hole_count ?? 0) +
    (indicators?.bore_count ?? 0) * 2 +
    (indicators?.thread_count ?? 0) * 2 +
    extraSetups * 5 +
    Math.min(indicators?.freeform_surface_count ?? 0, 20);
  if (score < 10) return "simple";
  if (score < 30) return "moderate";
  return "complex";
}

/**
 * Pockets cut into a solid argue against sheet metal, even with walls even enough
 * to pass the candidate check. The pocket detector also fires on plain bent
 * brackets, so a part with real bends isn't counted.
 */
function hasMachinedPockets(
  sheetMetal: SheetMetalAnalysisResponse,
  machining: MachiningAnalysisResponse | null,
): boolean {
  return (
    (machining?.complexity_indicators?.pocket_count ?? 0) > 0 &&
    realBends(sheetMetal).length === 0
  );
}

/**
 * Why a process the user chose can't be priced automatically for this part, or
 * null if it can. Only a clear mismatch counts: a part with no analyzer data, or
 * an ambiguous result, is priced and flagged for review instead.
 */
export function requestedProcessProblem(
  requestedProcess: string,
  analyzers: ProcessAnalyzers,
): string | null {
  const { sheetMetal, machining } = analyzers;
  if (
    requestedProcess === "sheet-metal" &&
    sheetMetal?.sheet_metal_candidate?.status === "rejected"
  ) {
    return "This part doesn't have the thin, even walls sheet metal needs, so our team will review it.";
  }
  if (
    requestedProcess === "sheet-metal" &&
    sheetMetal &&
    hasMachinedPockets(sheetMetal, machining)
  ) {
    return "This part has pockets that would need to be machined, so our team will review it.";
  }
  const stockForm = machining?.suggestions?.stock_form;
  if (
    requestedProcess === "cnc-turning" &&
    stockForm?.status === "resolved" &&
    stockForm.form &&
    NON_TURNABLE_STOCK_FORMS.has(stockForm.form)
  ) {
    return "This part isn't round enough to be turned on a lathe, so our team will review it.";
  }
  return null;
}

export interface ProcessDecision {
  process: string;
  confidence: number;
  needsReview: boolean;
  /** True when the analyzers replaced the classifier's process. */
  overridden: boolean;
  reason?: string;
}

/**
 * Checks the classifier against the analyzers. The process only changes on strong
 * evidence, and a change is always flagged. Anything inconclusive keeps the
 * classifier's answer and asks for review, because a wrong process costs far more
 * than a review: it can multiply a quote several times over.
 */
export function reconcileProcess(
  classifiedProcess: string,
  confidence: number,
  analyzers: ProcessAnalyzers,
): ProcessDecision {
  const keep = (needsReview: boolean, reason?: string): ProcessDecision => ({
    process: classifiedProcess,
    confidence,
    needsReview,
    overridden: false,
    reason,
  });

  const { sheetMetal, machining } = analyzers;
  if (!sheetMetal || classifiedProcess === "manual-quote") return keep(false);

  const candidate = sheetMetal.sheet_metal_candidate;
  const isSheetClassified = classifiedProcess === "sheet-metal";

  if (sheetMetal.warnings?.some((warning) => warning.code === "OPEN_SHELL")) {
    return keep(true, "The model has an open shell, so its volume is unreliable");
  }

  const freeformSurfaces =
    machining?.complexity_indicators?.freeform_surface_count ?? 0;
  const isStrongSheet =
    candidate?.status === "resolved" &&
    sheetMetal.thickness?.is_uniform === true &&
    freeformSurfaces <= MAX_SHEET_FREEFORM_SURFACES;

  if (isStrongSheet && isSheetClassified) {
    if (hasMachinedPockets(sheetMetal, machining)) {
      return keep(true, "Even walls suggest sheet metal, but the part has machined pockets");
    }
    return {
      ...keep(false),
      confidence: Math.max(confidence, candidate.confidence),
    };
  }

  if (isStrongSheet && !isSheetClassified) {
    // The freeform check above needs machining data, and slow parts can time out
    if (!machining) {
      return keep(true, "Uniform walls suggest sheet metal, but machining analysis did not finish");
    }
    if (hasMachinedPockets(sheetMetal, machining)) {
      return keep(true, "Even walls suggest sheet metal, but the part has machined pockets");
    }
    return {
      process: "sheet-metal",
      confidence: Math.min(candidate.confidence, MAX_OVERRIDE_CONFIDENCE),
      needsReview: true,
      overridden: true,
      reason: `Uniform ${candidate.evidence?.dominant_thickness_mm ?? ""}mm walls cover most of the part, which indicates sheet metal`,
    };
  }

  if (candidate?.status === "rejected") {
    if (!isSheetClassified) return keep(false);
    return {
      process: "cnc-milling",
      confidence: 0.6,
      needsReview: true,
      overridden: true,
      reason: "Too little of the part is thin paired walls for sheet metal",
    };
  }

  return keep(true, "The geometry is not clearly sheet metal or machined");
}
