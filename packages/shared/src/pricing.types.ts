import { z } from "zod";

// Enhanced Pricing Types with Zod schemas

// Price Request Base Schema
export const PriceRequestSchema = z.object({
  machine_id: z.string().uuid(),
  material_id: z.string().uuid(),
  quantity: z.number().positive(),
  finish_ids: z.array(z.string().uuid()).optional(),
  is_rush: z.boolean().default(false),
  tolerance_id: z.string().uuid().optional(),
  lead_time_id: z.string().uuid().optional(),
});

// CNC Price Request Schema
export const CncPriceRequestSchema = PriceRequestSchema.extend({
  process_type: z.enum(["milling", "turning"]),
  volume_cc: z.number().positive(),
  surface_area_cm2: z.number().positive(),
  removed_material_cc: z.number().positive(),
  features: z.object({
    holes: z.number().nonnegative(),
    pockets: z.number().nonnegative(),
    slots: z.number().nonnegative(),
    faces: z.number().nonnegative(),
  }),
  complexity_score: z.number().min(0).max(100),
});

// Sheet Metal Price Request Schema
export const SheetMetalPriceRequestSchema = PriceRequestSchema.extend({
  thickness_mm: z.number().positive(),
  sheet_area_cm2: z.number().positive(),
  cut_length_mm: z.number().positive(),
  pierces: z.number().nonnegative(),
  bends: z.number().nonnegative(),
  nest_utilization: z.number().min(0).max(1),
});

// Injection Molding Price Request Schema
export const InjectionMoldingPriceRequestSchema = PriceRequestSchema.extend({
  part_volume_cc: z.number().positive(),
  shot_weight_g: z.number().positive(),
  cycle_time_s: z.number().positive(),
  cavity_count: z.number().positive(),
  runner_weight_g: z.number().positive(),
  sprue_weight_g: z.number().positive(),
  mold_complexity_score: z.number().min(0).max(100),
});

// Price Response Schema
export const PriceResponseSchema = z.object({
  unit_price: z.number().positive(),
  total_price: z.number().positive(),
  min_order_qty: z.number().positive(),
  min_order_value: z.number().positive(),
  breakdown: z.object({
    setup_cost: z.number().nonnegative(),
    machine_cost: z.number().nonnegative(),
    material_cost: z.number().nonnegative(),
    finish_cost: z.number().nonnegative(),
    qa_cost: z.number().nonnegative(),
    margin: z.number().nonnegative(),
    overhead: z.number().nonnegative(),
  }),
  currency: z.string().default("USD"),
  lead_time_days: z.number().positive(),
  rush_surcharge: z.number().nonnegative().optional(),
  status: z.enum(["quoted", "tbd_pending"]).default("quoted"),
  explanations: z.array(z.string()).optional(),
  quantity_breaks: z
    .array(
      z.object({
        min_qty: z.number().positive(),
        max_qty: z.number().positive().optional(),
        unit_price: z.number().positive(),
        discount_percentage: z.number().nonnegative(),
      })
    )
    .optional(),
});

// Pricing Profile Schema
export const PricingProfileSchema = z.object({
  id: z.string().uuid(),
  machine_id: z.string().uuid(),
  setup_cost: z.number().nonnegative(),
  machine_rate_per_hour: z.number().positive(),
  min_order_qty: z.number().positive(),
  min_order_value: z.number().positive(),
  min_price_per_part: z.number().positive(),
  margin: z.number().min(0).max(1),
  overhead: z.number().min(0).max(1),
  rush_surcharge: z.number().min(0).max(1),
  standard_lead_time: z.number().positive(),
  rush_lead_time: z.number().positive(),
  material_removal_rate_cc_min: z.number().positive(),
  surface_finish_rate_cm2_min: z.number().positive(),
  qa_cost_per_part: z.number().positive(),
  cutting_speed_mm_min: z.number().positive(),
  pierce_time_s: z.number().positive(),
  bend_time_s: z.number().positive(),
  mold_complexity_multiplier: z.number().positive(),
  shot_cost: z.number().positive(),
  feature_times: z.object({
    hole: z.number().nonnegative(),
    pocket: z.number().nonnegative(),
    slot: z.number().nonnegative(),
    face: z.number().nonnegative(),
  }),
  quantity_breaks: z.array(
    z.object({
      min_qty: z.number().positive(),
      discount: z.number().min(0).max(1),
    })
  ),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Cost Breakdown Schema
export const PriceBreakdownSchema = z.object({
  setup_cost: z.number().nonnegative(),
  machine_cost: z.number().nonnegative(),
  material_cost: z.number().nonnegative(),
  finish_cost: z.number().nonnegative(),
  qa_cost: z.number().nonnegative(),
  margin: z.number().nonnegative(),
  overhead: z.number().nonnegative(),
});

// Material Schema
// export const MaterialSchema = z.object({
// export const MaterialSchema = z.object({
//   id: z.string().uuid(),
//   organization_id: z.string().uuid(),
//   name: z.string(),
//   type: z.enum(["metal", "plastic", "composite"]),
//   subtype: z.string(),
//   density: z.number().positive(), // kg/m³
//   cost_per_kg: z.number().positive(),
//   waste_factor: z.number().min(0).max(1),
//   min_thickness: z.number().positive().optional(),
//   max_thickness: z.number().positive().optional(),
//   available_forms: z.array(z.string()),
//   created_at: z.string().datetime(),
//   updated_at: z.string().datetime(),
// });

// Finish Schema
// export const FinishSchema = z.object({
// export const FinishSchema = z.object({
//   id: z.string().uuid(),
//   organization_id: z.string().uuid(),
//   name: z.string(),
//   type: z.enum(["surface", "coating", "treatment"]),
//   cost_per_area: z.number().positive().optional(), // cost per cm²
//   cost_per_part: z.number().positive().optional(), // flat cost per part
//   setup_time: z.number().positive().optional(), // minutes
//   processing_time: z.number().positive().optional(), // minutes per cm²
//   created_at: z.string().datetime(),
//   updated_at: z.string().datetime(),
// });

// Tolerance Schema
export const ToleranceSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  grade: z.enum(["coarse", "standard", "fine", "precision"]),
  linear_tolerance: z.number().positive(), // mm
  angular_tolerance: z.number().positive(), // degrees
  cost_multiplier: z.number().positive(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Lead Time Schema
export const LeadTimeSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  standard_days: z.number().positive(),
  rush_days: z.number().positive(),
  rush_multiplier: z.number().positive(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Type exports
export type PriceRequest = z.infer<typeof PriceRequestSchema>;
export type CncPriceRequest = z.infer<typeof CncPriceRequestSchema>;
export type SheetMetalPriceRequest = z.infer<
  typeof SheetMetalPriceRequestSchema
>;
export type InjectionMoldingPriceRequest = z.infer<
  typeof InjectionMoldingPriceRequestSchema
>;
export type PriceResponse = z.infer<typeof PriceResponseSchema>;
export type PricingProfile = z.infer<typeof PricingProfileSchema>;
export type PriceBreakdown = z.infer<typeof PriceBreakdownSchema>;
// export type Material = z.infer<typeof MaterialSchema>;
// export type Finish = z.infer<typeof FinishSchema>;
export type Tolerance = z.infer<typeof ToleranceSchema>;
export type LeadTime = z.infer<typeof LeadTimeSchema>;

// Legacy interfaces for backward compatibility
/** Pricing profile for a machine */
export interface PricingProfileLegacy {
  /** Unique profile ID */
  id: string;
  /** Associated machine ID */
  machine_id: string;
  /** Cost for setup per order */
  setup_cost: number;
  /** Machine hourly rate */
  machine_rate_per_hour: number;
  /** Minimum order quantity */
  min_order_qty: number;
  /** Minimum order value in currency */
  min_order_value: number;
  /** Minimum price per part */
  min_price_per_part: number;
  /** Profit margin percentage */
  margin: number;
  /** Overhead percentage */
  overhead: number;
  /** Rush order surcharge percentage */
  rush_surcharge: number;
  /** Standard lead time in days */
  standard_lead_time: number;
  /** Rush lead time in days */
  rush_lead_time: number;
  /** Material removal rate in cc/min */
  material_removal_rate_cc_min: number;
  /** Surface finish rate in cm2/min */
  surface_finish_rate_cm2_min: number;
  /** QA cost per part */
  qa_cost_per_part: number;
  /** Cutting speed in mm/min */
  cutting_speed_mm_min: number;
  /** Pierce time in seconds */
  pierce_time_s: number;
  /** Bend time in seconds */
  bend_time_s: number;
  /** Complexity multiplier */
  mold_complexity_multiplier: number;
  /** Cost per shot */
  shot_cost: number;
  /** Times for different features */
  feature_times: {
    hole: number;
    pocket: number;
    slot: number;
    face: number;
  };
  /** Quantity break discounts */
  quantity_breaks: {
    min_qty: number;
    discount: number;
  }[];
}

/** Cost breakdown components */
export interface PriceBreakdownLegacy {
  setup_cost: number;
  machine_cost: number;
  material_cost: number;
  finish_cost: number;
  qa_cost: number;
  margin: number;
  overhead: number;
}

/** Price response for quotes */
export interface PriceResponseLegacy {
  unit_price: number;
  total_price: number;
  min_order_qty: number;
  min_order_value: number;
  breakdown: PriceBreakdownLegacy;
  currency: string;
  lead_time_days: number;
  rush_surcharge?: number;
  status?: "quoted" | "tbd_pending";
}

/** Base price request interface */
export interface PriceRequestLegacy {
  machine_id: string;
  material_id: string;
  quantity: number;
  finish_ids?: string[];
  is_rush?: boolean;
}

/** CNC machining price request */
export interface CncPriceRequestLegacy extends PriceRequestLegacy {
  process_type: "milling" | "turning";
  volume_cc: number;
  surface_area_cm2: number;
  removed_material_cc: number;
  features: {
    holes: number;
    pockets: number;
    slots: number;
    faces: number;
  };
  complexity_multiplier: number;
}

/** Sheet metal price request (legacy) */
export interface SheetMetalPriceRequestLegacy extends PriceRequest {
  process_type: "laser_cutting" | "press_brake";
  thickness_mm: number;
  sheet_area_cm2: number;
  cut_length_mm: number;
  pierces: number;
  features: {
    bends: number;
    holes: number;
    slots: number;
    corners: number;
  };
  nest_utilization: number;
  complexity_multiplier: number;
}

/** Injection molding price request (legacy) */
export interface InjectionMoldingPriceRequestLegacy extends PriceRequest {
  process_type: "injection";
  volume_cc: number;
  part_volume_cc: number;
  shot_weight_g: number;
  cycle_time_s: number;
  cavity_count: number;
  mold_complexity: number;
  tonnage_required: number;
  cooling_time_s: number;
  features: {
    undercuts: number;
    side_actions: number;
    textures: number;
  };
  complexity_multiplier: number;
}

// Legacy type aliases for backward compatibility
export type CncPricingRequest = CncPriceRequest;
export type SheetMetalPricingRequest = SheetMetalPriceRequest;
export type InjectionMoldingPricingRequest = InjectionMoldingPriceRequest;

/** Pricing response interface */
export interface PricingResponse extends PriceResponse {}

/** Base pricing request */
export interface PricingRequest extends PriceRequest {}

/** Quote response interface */
export interface QuoteResponse {
  id: string;
  customer_id: string;
  quote_number: string;
  status: "pending" | "processing" | "quoted" | "approved" | "rejected";
  total_price: number;
  unit_price: number;
  quantity: number;
  material_id: string;
  finish_ids: string[];
  lead_time_days: number;
  valid_until: string;
  created_at: string;
  updated_at: string;
  breakdown: PriceBreakdown;
}

/** Order details interface */
export interface OrderDetails {
  id: string;
  quote_id: string;
  customer_id: string;
  status: "pending" | "processing" | "shipped" | "delivered";
  total_amount: number;
  currency: string;
  payment_status: "pending" | "paid" | "failed";
  shipping_address: {
    name: string;
    company?: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  created_at: string;
  updated_at: string;
}

/** Order response interface */
export interface OrderResponse extends OrderDetails {}
