/**
 * Types for the CAD service sheet-metal analysis endpoint.
 *
 * Mirrors `apps/cad-service/app/sheet_metal/schemas.py`. That service is the
 * source of truth; regenerate from its OpenAPI document if the two drift:
 *
 *   npx openapi-typescript http://localhost:8001/openapi.json -o cad-service.d.ts
 *
 * The file/model/topology/geometry/pmi/debug_geometry sections are reused
 * verbatim from the machining schema on the backend (same field names, same
 * semantics), so this file re-exports those types from machining-analysis.ts
 * rather than re-declaring them.
 *
 * The payload describes geometry only. There is deliberately no cost,
 * machine, process or price field anywhere in it - those belong to
 * downstream services.
 */

import type {
  AnalysisError,
  AnalysisWarning,
  Detection,
  FileInfo,
  GeometryInfo,
  ModelInfo,
  PMIInfo,
  TopologyInfo,
  UnitSystem,
  Vector3,
  WarningCode,
} from "./machining-analysis";

export type {
  AnalysisError,
  AnalysisWarning,
  Detection,
  FileInfo,
  GeometryInfo,
  ModelInfo,
  PMIInfo,
  TopologyInfo,
  UnitSystem,
  Vector3,
  WarningCode,
};

/* ------------------------------------------------------------------ */
/* Sheet-metal candidate scoring                                       */
/* ------------------------------------------------------------------ */

export interface SheetMetalCandidateEvidence {
  paired_area_fraction: number | null;
  flatness_ratio: number | null;
  dominant_thickness_mm: number | null;
  method: string | null;
}

export interface SheetMetalCandidate {
  is_candidate: boolean;
  confidence: number;
  evidence: SheetMetalCandidateEvidence;
  status: "resolved" | "ambiguous" | "rejected";
  reason: string | null;
}

/* ------------------------------------------------------------------ */
/* Thickness                                                           */
/* ------------------------------------------------------------------ */

export interface ThicknessInfo {
  dominant_thickness_mm: number | null;
  is_uniform: boolean | null;
  variance_mm: number | null;
  method: string | null;
  sample_count: number;
  note: string | null;
}

/* ------------------------------------------------------------------ */
/* Faces / base+flange                                                  */
/* ------------------------------------------------------------------ */

export interface FlangeFace {
  face_id: number;
  area_mm2: number;
  plane_normal: Vector3;
  adjacent_bend_ids: string[];
}

export interface SheetMetalFaces {
  base_face_id: number | null;
  flange_faces: FlangeFace[];
}

/* ------------------------------------------------------------------ */
/* Bends / bend reliefs                                                 */
/* ------------------------------------------------------------------ */

export interface BendLine {
  start: Vector3;
  end: Vector3;
}

export interface BendFeature {
  id: string;
  angle_deg: number;
  inner_radius_mm: number;
  bend_line: BendLine;
  axis: Vector3;
  length_mm: number;
  /** "up" | "down" */
  direction: string;
  /** Geometric adjacency order - not a manufacturing sequence guarantee. */
  sequence_hint: number;
  k_factor_assumed: number;
  bend_allowance_mm: number | null;
  bend_deduction_mm: number | null;
  adjacent_flange_ids: string[];
  detection: Detection;
}

export interface BendRelief {
  id: string;
  bend_id: string;
  /** "rectangular" | "round" | "none-detected" */
  type: string;
  width_mm: number | null;
  depth_mm: number | null;
  position: Vector3 | null;
  note: string | null;
}

/* ------------------------------------------------------------------ */
/* Holes / cutouts / slots / hems                                       */
/* ------------------------------------------------------------------ */

export interface SheetMetalHole {
  id: string;
  diameter_mm: number;
  position: Vector3;
  /** "round" | "slotted" */
  shape: string;
  quantity: number;
  distance_to_nearest_edge_mm: number | null;
  distance_to_nearest_bend_mm: number | null;
}

export interface Cutout {
  id: string;
  perimeter_mm: number;
  area_mm2: number;
  shape_type: string;
  min_feature_size_mm: number | null;
  position: Vector3;
  distance_to_nearest_edge_mm: number | null;
  distance_to_nearest_bend_mm: number | null;
}

export interface SheetMetalSlot {
  id: string;
  length_mm: number;
  width_mm: number;
  corner_radius_mm: number | null;
  orientation: Vector3;
  position: Vector3;
  distance_to_nearest_bend_mm: number | null;
}

export interface Hem {
  id: string;
  /** "open" | "closed" | "teardrop" */
  type: string;
  length_mm: number;
  position: Vector3;
  adjacent_flange_id: string | null;
}

/* ------------------------------------------------------------------ */
/* Outer profile / DFM distance flags                                   */
/* ------------------------------------------------------------------ */

export interface ProfileValidityIssue {
  code: string;
  message: string;
  location: Vector3 | null;
}

export interface OuterProfile {
  perimeter_mm: number | null;
  is_closed: boolean | null;
  validity_issues: ProfileValidityIssue[];
}

export interface DistanceFlag {
  feature_id: string;
  feature_type: string;
  /**
   * "HOLE_TOO_CLOSE_TO_EDGE" | "HOLE_TOO_CLOSE_TO_BEND" |
   * "BEND_RADIUS_TOO_TIGHT" | "FEATURE_BELOW_MIN_SIZE" | ...
   */
  flag: string;
  reason: string;
  threshold: number | null;
  value: number | null;
}

/* ------------------------------------------------------------------ */
/* Patterns / symmetry / complexity                                     */
/* ------------------------------------------------------------------ */

export interface SheetMetalFeaturePattern {
  /** e.g. "repeated_hole" */
  type: string;
  feature_type: string;
  feature_count: number;
  feature_ids: string[];
  /** "linear" | "circular" | "rectangular" | "grouped" */
  pattern_type: string;
  spacing_mm: number | null;
  axis: Vector3 | null;
  detection: Detection;
}

export interface Symmetry {
  has_symmetry: boolean;
  axis_or_plane: string | null;
  /** "mirror" | "rotational" | "none" */
  symmetry_type: string;
  confidence: number;
  note: string | null;
}

/**
 * Deterministic counts only - no difficulty or price score. Matches
 * machining's documented stance: cost/difficulty judgement is left to a
 * downstream costing engine.
 */
export interface SheetMetalComplexityIndicators {
  bend_count: number;
  unique_bend_angle_count: number;
  unique_bend_radius_count: number;
  hole_count: number;
  cutout_count: number;
  slot_count: number;
  hem_count: number;
  distinct_hole_diameter_count: number;
  minimum_bend_radius_mm: number | null;
  minimum_feature_to_edge_distance_mm: number | null;
  minimum_feature_to_bend_distance_mm: number | null;
  feature_count_total: number;
}

/* ------------------------------------------------------------------ */
/* Response envelope                                                    */
/* ------------------------------------------------------------------ */

export interface SheetMetalAnalysisOptions {
  unit_system: UnitSystem;
  include_face_details: boolean;
  include_feature_details: boolean;
  include_debug_geometry: boolean;
  include_topology_entities: boolean;
}

export interface SheetMetalAnalysisResponse {
  success: true;
  analysis_version: string;
  kernel: string | null;
  /** "mm" or "in" - authoritative, since field names keep their `_mm` suffix. */
  units: string;
  options: SheetMetalAnalysisOptions;
  analysis_duration_ms: number | null;

  // Reused verbatim from machining.
  file: FileInfo;
  model: ModelInfo;
  topology: TopologyInfo;
  geometry: GeometryInfo | null;

  // Sheet-metal specific. Structurally present but inert until the relevant
  // detector stage has run.
  sheet_metal_candidate: SheetMetalCandidate;
  thickness: ThicknessInfo;
  faces: SheetMetalFaces;
  bends: BendFeature[];
  bend_reliefs: BendRelief[];
  holes: SheetMetalHole[];
  cutouts: Cutout[];
  slots: SheetMetalSlot[];
  hems: Hem[];
  outer_profile: OuterProfile;
  distance_flags: DistanceFlag[];
  feature_patterns: SheetMetalFeaturePattern[];
  symmetry: Symmetry;
  complexity_indicators: SheetMetalComplexityIndicators;
  pmi: PMIInfo;

  warnings: AnalysisWarning[];
  errors: AnalysisError[];
  debug_geometry: Record<string, unknown> | null;
}

export interface SheetMetalErrorResponse {
  success: false;
  analysis_version: string;
  errors: AnalysisError[];
  warnings: AnalysisWarning[];
}

export type SheetMetalAnalysisResult =
  | SheetMetalAnalysisResponse
  | SheetMetalErrorResponse;

export function isSheetMetalError(
  result: SheetMetalAnalysisResult,
): result is SheetMetalErrorResponse {
  return result.success === false;
}

/** Capabilities reported by `GET /api/cad/analyze-sheet-metal`. */
export interface SheetMetalCapabilities {
  analysis_version: string;
  /** True only when the kernel is present *and* complete enough to analyse. */
  kernel_available: boolean;
  kernel: string | null;
  /**
   * Diagnostics for a kernel that imports but cannot work - a partial OCCT
   * install loads TopoDS yet not STEPControl. Optional: a service older than
   * this field omits them, so absence means "not reported", not "healthy".
   */
  kernel_binding_importable?: boolean;
  kernel_missing_symbols?: string[];
  kernel_import_failures?: Record<string, string>;
  supported_input_formats: string[];
  supported_extensions: string[];
  max_upload_bytes: number;
  max_faces: number;
  unit_systems: UnitSystem[];
  thresholds: Record<string, unknown>;
  note: string;
}

/** Every sheet-metal feature type that carries a `detection`, flattened for list rendering. */
export type AnySheetMetalFeature = BendFeature | SheetMetalFeaturePattern;
