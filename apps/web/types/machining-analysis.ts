/**
 * Types for the CAD service machining analysis endpoint.
 *
 * Mirrors `apps/cad-service/app/machining/schemas.py`. That service is the
 * source of truth; regenerate from its OpenAPI document if the two drift:
 *
 *   npx openapi-typescript http://localhost:8001/openapi.json -o cad-service.d.ts
 *
 * The payload describes geometry only. There is deliberately no cost, machine,
 * process or price field anywhere in it - those belong to downstream services.
 */

export type UnitSystem = "metric" | "imperial";

export type SurfaceType =
  | "PLANE"
  | "CYLINDER"
  | "CONE"
  | "SPHERE"
  | "TORUS"
  | "BSPLINE"
  | "BEZIER"
  | "REVOLUTION"
  | "EXTRUSION"
  | "OFFSET"
  | "OTHER";

export type FeatureStatus = "resolved" | "ambiguous";

export type InformationSource = "GEOMETRY" | "CAD_METADATA";

export type ThreadConfidence = "explicit" | "geometric" | "unknown";

export type PrincipalDirection = "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z";

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  diagonal_mm: number;
}

/** Provenance for a detected feature: how it was found and how strong the evidence is. */
export interface Detection {
  method: string;
  confidence: number;
  evidence: string[];
  source: InformationSource;
}

interface FeatureBase {
  id: string;
  type: string;
  detection: Detection;
  status: FeatureStatus;
  /** Populated when `status` is `"ambiguous"` - why geometry could not settle it. */
  reason: string | null;
  face_ids: number[];
}

export interface FileInfo {
  filename: string;
  format: string;
  file_size_bytes: number;
  sha256: string | null;
}

export interface ModelInfo {
  solid_count: number;
  shell_count: number;
  face_count: number;
  edge_count: number;
  vertex_count: number;
  wire_count: number;
  compound_count: number;
  is_valid: boolean;
  has_open_shells: boolean;
  is_multi_body: boolean;
}

export interface TopologyInfo {
  faces_per_solid: number[];
  closed_shell_count: number;
  open_shell_count: number;
  free_edge_count: number;
  seam_edge_count: number;
  max_faces_per_edge: number;
  euler_characteristic: number | null;
}

export interface GeometryInfo {
  bounding_box: BoundingBox;
  volume_mm3: number;
  surface_area_mm2: number;
  center_of_mass: Vector3;
  moments_of_inertia: Record<string, number | number[] | null> | null;
  is_closed_volume: boolean;
  source: InformationSource;
}

export interface SurfaceSummary {
  planar_faces: number;
  cylindrical_faces: number;
  conical_faces: number;
  spherical_faces: number;
  toroidal_faces: number;
  freeform_faces: number;
  other_faces: number;
  total_faces: number;
  internal_cylindrical_faces: number;
  external_cylindrical_faces: number;
}

export interface FaceDetail {
  face_id: number;
  surface_type: SurfaceType;
  area_mm2: number;
  bounding_box: BoundingBox;
  normal: Vector3 | null;
  axis: Vector3 | null;
  axis_location: Vector3 | null;
  radius_mm: number | null;
  minor_radius_mm: number | null;
  cone_half_angle_deg: number | null;
  angular_span_deg: number | null;
  is_internal: boolean | null;
  edge_count: number;
}

export interface HoleFeature extends FeatureBase {
  subtype: string;
  diameter_mm: number;
  radius_mm: number;
  depth_mm: number;
  through: boolean | null;
  position: Vector3;
  axis: Vector3;
  quantity: number;
  depth_diameter_ratio: number | null;
  is_stepped: boolean;
  has_counterbore: boolean;
  has_countersink: boolean;
  counterbore_diameter_mm: number | null;
  counterbore_depth_mm: number | null;
  countersink_diameter_mm: number | null;
  countersink_angle_deg: number | null;
  steps: Array<Record<string, number>>;
}

export interface BoreFeature extends FeatureBase {
  diameter_mm: number;
  depth_mm: number;
  blind: boolean | null;
  position: Vector3;
  axis: Vector3;
  depth_diameter_ratio: number | null;
  is_stepped: boolean;
}

export interface PocketFeature extends FeatureBase {
  length_mm: number;
  width_mm: number;
  depth_mm: number;
  area_mm2: number;
  bottom_type: string;
  closed: boolean | null;
  corner_radius_mm: number | null;
  minimum_internal_radius_mm: number | null;
  machining_direction: number[];
  position: Vector3;
  depth_width_ratio: number | null;
  wall_count: number;
}

export interface SlotFeature extends FeatureBase {
  subtype: string;
  length_mm: number;
  width_mm: number;
  depth_mm: number;
  through: boolean | null;
  corner_radius_mm: number | null;
  orientation: Vector3;
  machining_direction: number[];
  position: Vector3;
  depth_width_ratio: number | null;
}

export interface BossFeature extends FeatureBase {
  subtype: string;
  diameter_mm: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number;
  position: Vector3;
  axis: Vector3;
}

export interface FilletFeature extends FeatureBase {
  radius_mm: number;
  edge_count: number;
  length_mm: number | null;
  position: Vector3 | null;
  internal: boolean | null;
  is_corner_fillet: boolean;
}

export interface ChamferFeature extends FeatureBase {
  size_mm: number;
  angle_deg: number | null;
  edge_count: number;
  length_mm: number | null;
  position: Vector3 | null;
}

export interface ThreadFeature extends FeatureBase {
  thread_type: string;
  /** Only set when the CAD file states it. Never inferred from diameter. */
  designation: string | null;
  nominal_diameter_mm: number | null;
  pitch_mm: number | null;
  depth_mm: number | null;
  confidence: ThreadConfidence;
  related_feature_id: string | null;
}

export interface FilletSummary {
  count: number;
  unique_radii_mm: number[];
  minimum_radius_mm: number | null;
  minimum_internal_radius_mm: number | null;
}

export interface ChamferSummary {
  count: number;
  sizes_mm: number[];
  unique_angles_deg: number[];
}

export interface FeatureCollection {
  holes: HoleFeature[];
  bores: BoreFeature[];
  internal_cylindrical_features: BoreFeature[];
  pockets: PocketFeature[];
  slots: SlotFeature[];
  bosses: BossFeature[];
  threads: ThreadFeature[];
  fillets: FilletFeature[];
  chamfers: ChamferFeature[];
  fillet_summary: FilletSummary;
  chamfer_summary: ChamferSummary;
}

export interface FeaturePattern {
  type: string;
  feature_type: string;
  feature_count: number;
  feature_ids: string[];
  pattern_type: string;
  diameter_mm: number | null;
  length_mm: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  spacing_mm: number | null;
  axis: Vector3 | null;
  detection: Detection;
}

export interface FeatureDimensionRatio {
  feature_id: string;
  feature_type: string;
  diameter_mm: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  depth_diameter_ratio: number | null;
  depth_width_ratio: number | null;
}

export interface MachiningFlag {
  feature_id: string;
  flag: string;
  reason: string;
  threshold: number | null;
  value: number | null;
}

export interface MachiningConstraint {
  feature_id: string;
  feature_type: string;
  tooling_constraints: {
    minimum_internal_radius_mm: number;
    maximum_tool_diameter_mm: number;
    note: string;
  };
}

export interface FeatureAccessibility {
  feature_id: string;
  feature_type: string;
  accessibility: Record<PrincipalDirection, boolean>;
  accessible_direction_count: number;
  primary_direction: PrincipalDirection | null;
  requires_rotation: boolean;
  requires_advanced_axis_analysis: boolean;
  detection: Detection;
}

export interface SetupAnalysis {
  candidate_directions: Array<{
    direction: PrincipalDirection;
    accessible_feature_count: number;
    feature_ids: string[];
  }>;
  minimum_direction_count_covering_all: number | null;
  unreachable_feature_ids: string[];
  requires_rotation: boolean;
  note: string;
}

/** Which mill form the part envelope resembles. Geometry, not procurement. */
export type StockFormKind =
  | "SHEET"
  | "PLATE"
  | "ROUND_BAR"
  | "SQUARE_BAR"
  | "RECTANGULAR_BAR"
  | "BLOCK";

/** The external cylinder that separates round bar from square bar. */
export interface RoundStockEvidence {
  face_id: number;
  radius_mm: number;
  /** Unit direction - never unit-converted. */
  axis: number[];
  axial_coverage: number;
}

export interface StockForm {
  method: string;
  form: StockFormKind | null;
  status: "resolved" | "ambiguous";
  /** Why the classification is ambiguous. Null when resolved. */
  reason: string | null;
  candidate_forms: StockFormKind[];
  /**
   * `obb` when an oriented bounding box was available, `aabb` when the
   * classification fell back to the axis-aligned box - which misjudges parts
   * modelled off-axis.
   */
  bounds_method: "obb" | "aabb";
  sorted_dimensions_mm: { length: number; width: number; height: number };
  thickness_mm: number;
  flatness_ratio: number;
  slenderness_ratio: number;
  cross_section_ratio: number;
  round_evidence: RoundStockEvidence | null;
  note: string;
}

export interface StockAnalysis {
  method: string;
  /** Always true - a bounding-box estimate, never a purchased stock size. */
  estimated: boolean;
  allowance_per_side_mm: number;
  stock_dimensions_mm: { length: number; width: number; height: number };
  stock_volume_mm3: number;
  finished_volume_mm3: number;
  removed_volume_mm3: number;
  material_removal_ratio: number;
  /** Null when the extents are degenerate. */
  stock_form: StockForm | null;
  note: string;
}

export interface ComplexityIndicators {
  hole_count: number;
  deep_hole_count: number;
  pocket_count: number;
  slot_count: number;
  bore_count: number;
  thread_count: number;
  fillet_count: number;
  chamfer_count: number;
  boss_count: number;
  freeform_surface_count: number;
  thin_wall_count: number;
  unique_tool_diameter_constraints: number;
  accessible_directions: number;
  distinct_hole_diameter_count: number;
  minimum_internal_radius_mm: number | null;
  maximum_depth_diameter_ratio: number | null;
  feature_count_total: number;
}

export interface PMIInfo {
  available: boolean;
  part_name: string | null;
  part_number: string | null;
  revision: string | null;
  material: string | null;
  surface_finish: string | null;
  gdt: Array<Record<string, unknown>>;
  datums: string[];
  annotations: string[];
  feature_names: string[];
  raw: Array<{ key: string; value: unknown; source: InformationSource }>;
  source: InformationSource;
  note: string;
}

export type WarningCode =
  | "MULTIPLE_SOLIDS"
  | "NO_SOLID"
  | "OPEN_SHELL"
  | "INVALID_GEOMETRY"
  | "UNIT_ASSUMED"
  | "DETECTOR_FAILED"
  | "LARGE_MODEL"
  | "AMBIGUOUS_FEATURE"
  | "PMI_UNAVAILABLE"
  | "ACCESSIBILITY_UNRELIABLE";

export interface AnalysisWarning {
  code: WarningCode;
  message: string;
  detail: Record<string, unknown> | null;
}

export interface AnalysisError {
  code: string;
  message: string;
  detail: Record<string, unknown> | null;
}

export interface MachiningAnalysisResponse {
  success: true;
  analysis_version: string;
  kernel: string | null;
  /** `"mm"` or `"in"` - authoritative, since field names keep their `_mm` suffix. */
  units: string;
  options: {
    unit_system: UnitSystem;
    include_face_details: boolean;
    include_feature_details: boolean;
    include_debug_geometry: boolean;
  };
  analysis_duration_ms: number | null;
  file: FileInfo;
  model: ModelInfo;
  geometry: GeometryInfo | null;
  topology: TopologyInfo;
  surface_summary: SurfaceSummary;
  face_details: FaceDetail[] | null;
  features: FeatureCollection;
  feature_patterns: FeaturePattern[];
  feature_dimensions: FeatureDimensionRatio[];
  machining_flags: MachiningFlag[];
  machining_constraints: MachiningConstraint[];
  accessibility: FeatureAccessibility[];
  setup_analysis: SetupAnalysis;
  stock_analysis: StockAnalysis | null;
  complexity_indicators: ComplexityIndicators;
  pmi: PMIInfo;
  warnings: AnalysisWarning[];
  errors: AnalysisError[];
  debug_geometry: Record<string, unknown> | null;
}

export interface MachiningErrorResponse {
  success: false;
  analysis_version: string;
  errors: AnalysisError[];
  warnings: AnalysisWarning[];
}

export type MachiningAnalysisResult =
  | MachiningAnalysisResponse
  | MachiningErrorResponse;

export function isMachiningError(
  result: MachiningAnalysisResult,
): result is MachiningErrorResponse {
  return result.success === false;
}

/** Capabilities reported by `GET /api/cad/analyze-machining`. */
export interface MachiningCapabilities {
  analysis_version: string;
  kernel_available: boolean;
  kernel: string | null;
  supported_input_formats: string[];
  supported_extensions: string[];
  max_upload_bytes: number;
  max_faces: number;
  unit_systems: UnitSystem[];
  thresholds: Record<string, unknown>;
  note: string;
}

/** Every feature the analysis can return, flattened for list rendering. */
export type AnyMachiningFeature =
  | HoleFeature
  | BoreFeature
  | PocketFeature
  | SlotFeature
  | BossFeature
  | ThreadFeature
  | FilletFeature
  | ChamferFeature;
