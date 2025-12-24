import { z } from "zod";
import { CostFactorsV1 } from "./contracts/v1/pricing";
import {
  GeometryMetricsV1,
  LeadTimeOption,
  ProcessType,
} from "./contracts/v1/part-config";

// Cost Model Domain (Phase 1 foundation)
// These schemas describe configurable commercial drivers that feed pricing computations.

// Machine cost driver
export const MachineCostDriverSchema = z.object({
  id: z.string(),
  label: z.string(),
  process_types: z.array(z.string() as unknown as z.ZodType<ProcessType>),
  /** Fully burdened target rate captured explicitly (USD/hour) */
  machine_rate_per_hour: z.number().positive(),
  /** Typical setup cost in USD for this machine/profile */
  setup_cost: z.number().nonnegative().default(0),
  /** Optional efficiency or utilization factor (0..1) for future dynamic adjustments */
  utilization_target: z.number().min(0).max(1).default(0.85),
  /** Overhead percent (0..1) applied to (machine + material + setup) */
  overhead_percent: z.number().min(0).max(1).default(0.15),
});

// Material cost driver (extends catalog material economic attributes)
export const MaterialCostDriverSchema = z.object({
  id: z.string(),
  catalog_material_id: z.string(),
  /** Raw purchase price (USD/kg) */
  raw_cost_per_kg: z.number().positive(),
  /** Scrap / waste rate (0..1) */
  scrap_rate: z.number().min(0).max(1).default(0.08),
  /** Buy form conversion factor (multiplier applied to net mass to get buy mass) */
  buy_conversion_factor: z.number().min(1).default(1.15),
});

// Finish / secondary operation driver
export const FinishCostDriverSchema = z.object({
  id: z.string(),
  catalog_finish_id: z.string(),
  label: z.string(),
  /** Flat adder per part (USD) */
  cost_per_part: z.number().nonnegative().default(0),
  /** Optional area based adder (USD / cm^2) */
  cost_per_cm2: z.number().nonnegative().optional(),
  /** Optional batch setup cost allocated later per part */
  batch_setup_cost: z.number().nonnegative().optional(),
});

// Inspection / QA driver
export const InspectionCostDriverSchema = z.object({
  id: z.string(),
  level: z.enum(["basic", "enhanced", "full"]),
  cost_per_part: z.number().nonnegative(),
});

// Lead time tier driver (maps UI option -> multiplier & promised days)
export const LeadTimeTierSchema = z.object({
  id: z.string(),
  code: z.enum([
    "standard",
    "expedited",
  ]) as unknown as z.ZodType<LeadTimeOption>,
  label: z.string(),
  days: z.number().positive(),
  /** Multiplier applied to unit price AFTER base margin (e.g. rush premium) */
  price_multiplier: z.number().min(1).default(1),
});

// Quantity discount break
export const QuantityDiscountSchema = z.object({
  min_qty: z.number().positive(),
  discount_percent: z.number().min(0).max(1), // fraction (0.10 = 10%)
});

// Complexity multipliers (machining for now; can extend per process)
export const MachiningComplexitySchema = z.object({
  low: z.number().positive().default(1),
  medium: z.number().positive().default(1.1),
  high: z.number().positive().default(1.25),
});

export const ComplexityDriverSchema = z.object({
  machining: MachiningComplexitySchema,
});

// Margin policy
export const MarginPolicySchema = z.object({
  base_margin_percent: z.number().min(0).max(1),
  /** Optional enforced minimum absolute margin per part (USD) */
  min_margin_per_part: z.number().nonnegative().optional(),
});

// Aggregated cost model snapshot
export const CostModelSchema = z.object({
  version: z.string(),
  machine: MachineCostDriverSchema,
  material: MaterialCostDriverSchema,
  finishes: z.array(FinishCostDriverSchema).default([]),
  inspection_levels: z.array(InspectionCostDriverSchema).default([]),
  lead_time_tiers: z.array(LeadTimeTierSchema),
  quantity_discounts: z.array(QuantityDiscountSchema).default([]),
  complexity: ComplexityDriverSchema,
  margin: MarginPolicySchema,
  currency: z.string().default("USD"),
  audit: z.object({
    generated_at: z.string().datetime(),
  }),
});

export type MachineCostDriver = z.infer<typeof MachineCostDriverSchema>;
export type MaterialCostDriver = z.infer<typeof MaterialCostDriverSchema>;
export type FinishCostDriver = z.infer<typeof FinishCostDriverSchema>;
export type InspectionCostDriver = z.infer<typeof InspectionCostDriverSchema>;
export type LeadTimeTier = z.infer<typeof LeadTimeTierSchema>;
export type QuantityDiscount = z.infer<typeof QuantityDiscountSchema>;
export type ComplexityDriver = z.infer<typeof ComplexityDriverSchema>;
export type MarginPolicy = z.infer<typeof MarginPolicySchema>;
export type CostModel = z.infer<typeof CostModelSchema>;

// Selection context (per part) — minimal needed attributes for derivation
export interface CostSelectionContext {
  quantity: number;
  lead_time_option: LeadTimeOption;
  machining_complexity?: "low" | "medium" | "high";
  finish_ids?: string[]; // catalog_finish_id list
  inspection_level?: "basic" | "enhanced" | "full";
}

// Helper: derive CostFactorsV1 (contracts) from cost model + selection & geometry metrics.
// NOTE: Implementation is intentionally lightweight for Phase 1; refined algorithms land in later phases.
export function deriveCostFactorsV1(
  model: CostModel,
  selection: CostSelectionContext,
  _metrics: GeometryMetricsV1
): CostFactorsV1 {
  // Machine & setup
  const machine_rate_per_hour = model.machine.machine_rate_per_hour;
  const setup_cost = model.machine.setup_cost;

  // Material estimation (placeholder simplistic mass calc if volume_cc present & density ~ 1 *for demo*)
  // const density_kg_per_cc = 0.000001; // TODO: pull real density from catalog material (kg/cc)
  // const net_mass_kg = (metrics.volume_cc ?? 0) * density_kg_per_cc;
  // const buy_mass_kg =
  //   net_mass_kg *
  //   model.material.buy_conversion_factor *
  //   (1 + model.material.scrap_rate);
  const material_price_per_kg = model.material.raw_cost_per_kg;
  // const material_cost_estimate = buy_mass_kg * material_price_per_kg; // used later externally

  // Finish adders map
  const finish_cost_adders: Record<string, number> = {};
  (selection.finish_ids || []).forEach((fid) => {
    const fin = model.finishes.find((f) => f.catalog_finish_id === fid);
    if (fin) {
      finish_cost_adders[fid] =
        fin.cost_per_part + (fin.batch_setup_cost ?? 0) / selection.quantity;
    }
  });

  // Inspection
  const inspection = model.inspection_levels.find(
    (l) => l.level === (selection.inspection_level || "basic")
  );
  const inspection_cost_per_part = inspection ? inspection.cost_per_part : 0;

  // Overhead & margin
  const overhead_percent = model.machine.overhead_percent;
  const base_margin_percent = model.margin.base_margin_percent;

  // Rush / lead time multiplier
  const leadTier = model.lead_time_tiers.find(
    (t) => t.code === selection.lead_time_option
  );
  const rush_multiplier =
    leadTier?.price_multiplier && leadTier.price_multiplier > 1
      ? leadTier.price_multiplier
      : undefined;

  // Quantity breaks (convert discount fractions -> contract shape)
  const quantity_breaks = model.quantity_discounts
    .slice()
    .sort((a, b) => a.min_qty - b.min_qty)
    .map((q) => ({
      min_qty: q.min_qty,
      discount_percent: q.discount_percent * 100,
    })) // keep as percent for v1? existing contract uses discount_percent (assumed percent not fraction)
    .map((q) => ({ ...q, discount_percent: q.discount_percent }));

  return {
    machine_rate_per_hour,
    setup_cost,
    material_price_per_kg: material_price_per_kg,
    finish_cost_adders: Object.keys(finish_cost_adders).length
      ? finish_cost_adders
      : undefined,
    inspection_cost_per_part: inspection_cost_per_part || undefined,
    overhead_percent,
    base_margin_percent,
    rush_multiplier,
    quantity_breaks: quantity_breaks.length
      ? quantity_breaks.map((q) => ({
          min_qty: q.min_qty,
          discount_percent: q.discount_percent,
        }))
      : undefined,
  };
}

export const __doc = `Cost Model Types (Phase 1)
These types define the structured commercial inputs required for pricing. The deriveCostFactorsV1 helper
bridges the richer model to the lightweight v1 CostFactors contract powering current preview pricing.
In later phases we will:
 - Integrate real material density & finish area calculations
 - Introduce dynamic cycle time estimation per process
 - Support additional processes (injection molding, additive)
 - Add probabilistic & market adjustment layers
`;
