// Versioned contract: PartConfig (v1)
// This file defines the canonical shape for a configurable quote part used in instant quoting.
import type { QuoteComplianceSnapshotV1 } from "./pricing-compliance";

export type ProcessType =
  | "cnc_milling"
  | "cnc_turning"
  | "sheet_metal" // consolidated generic sheet metal process used by UI & pricing engine
  | "sheet_metal_laser"
  | "sheet_metal_brake";

export type LeadTimeOption = "standard" | "expedited";
export type ToleranceClass = "standard" | "precision" | "high" | "custom";
export type InspectionLevel = "basic" | "enhanced" | "full";

export interface GeometryMetricsV1 {
  volume_cc?: number;
  surface_area_cm2?: number;
  bbox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  features?: {
    holes?: number;
    pockets?: number;
    slots?: number;
    faces?: number;
    bends?: number;
    corners?: number;
    threads?: number;
  };
  sheet?: {
    thickness_mm?: number;
    flat_pattern_area_cm2?: number;
    bend_count?: number;
    cut_length_mm?: number;
    nest_utilization?: number; // 0..1
  };
  feature_summary?: GeometryFeatureSummaryV1;
}

export interface GeometryFeatureSummaryV1 {
  total?: number;
  counts: Record<string, number>;
  dominant_feature?: string;
  risk_flags?: string[];
}

export interface PricingBreakdownV1 {
  material: number;
  machining: number;
  setup: number;
  finish: number;
  inspection: number;
  overhead: number;
  margin: number;
  total_cycle_time_min?: number;
  machine_time_min?: number;
  tolerance?: {
    band: string;
    category: string;
    source: "id" | "class" | "default";
    multipliers: {
      machining: number;
      setup: number;
      inspection: number;
    };
  };
}

export interface QuantityPricePointV1 {
  quantity: number;
  unit_price: number;
  total_price: number;
  lead_time_days: number;
  breakdown: PricingBreakdownV1;
  status?: "ready" | "pending" | "review_required";
  compliance?: QuoteComplianceSnapshotV1;
}

export interface DfmIssueV1 {
  id: string;
  severity: "info" | "warn" | "critical";
  category:
    | "undercut"
    | "thin_wall"
    | "deep_hole"
    | "bend_radius"
    | "tolerance_risk"
    | "material_flag"
    | "feature_density"
    | "surface_finish_risk"
    | "geometry_complexity";
  message: string;
  recommendation?: string;
  refs?: {
    feature_ids?: string[];
    face_ids?: string[];
  };
  auto_fixable?: boolean;
}

/** @deprecated Use QuoteLineVNext */
export interface PartConfigV1 {
  id: string;
  quote_id: string;
  file_id: string;
  process_type: ProcessType;
  material_id: string;
  material_spec?: string;
  finish_ids: string[];
  tolerance_class: ToleranceClass;
  /** Optional richer tolerance descriptors (referenced by pricing v2) */
  tolerances?: string[];
  quantities: number[]; // requested quantity tiers
  selected_quantity: number; // active quantity for pricing display / checkout
  lead_time_option: LeadTimeOption;
  secondary_operations: string[]; // e.g. ['anodizing','powder_coat','tapping']
  inspection_level: InspectionLevel;
  /** CNC specific: requested surface finish quality */
  surface_finish?: "standard" | "improved" | "fine";
  /** CNC specific: machining complexity factor */
  machining_complexity?: "low" | "medium" | "high";
  /** Sheet metal: material thickness in mm */
  sheet_thickness_mm?: number;
  /** Sheet metal: number of bends (can override geometry derived) */
  bend_count?: number;
  /** Sheet metal: material gauge (e.g. '10', '12', '14') */
  material_gauge?: string;
  geometry: {
    metrics: GeometryMetricsV1;
  };
  dfm: {
    status: "pending" | "complete" | "failed";
    issues: DfmIssueV1[];
  };
  pricing: {
    status: "pending" | "ready" | "review_required";
    matrix: QuantityPricePointV1[]; // Each quantity point result
    currency: string;
  };
  overrides?: {
    unit_price?: number; // manual override for selected quantity
    lead_time_days?: number;
    margin_percent?: number; // explicit override margin
  };
  audit: {
    created_at: string;
    updated_at: string;
  };
}

export interface QuoteSummaryV1 {
  id: string;
  status:
    | "draft"
    | "processing"
    | "ready"
    | "sent"
    | "accepted"
    | "rejected"
    | "expired"
    | "cancelled"
    | "converted";
  currency: string;
  parts: PartConfigV1[];
  subtotal: number; // sum of selected quantity totals
  total: number; // includes shipping, tax (future)
  expires_at?: string;
  created_at: string;
  updated_at: string;
}
