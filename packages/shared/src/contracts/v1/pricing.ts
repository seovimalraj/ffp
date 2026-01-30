// Pricing cost factors & breakdown contracts (v1)

export interface CostFactorsV1 {
  material_id: any;
  material_name: any;
  machine_rate_per_hour: number;
  setup_cost: number;
  material_price_per_kg?: number;
  finish_cost_adders?: Record<string, number>; // finish_id -> cost per part
  inspection_cost_per_part?: number;
  overhead_percent?: number; // applied to (machine + material + setup)
  base_margin_percent: number;
  rush_multiplier?: number; // factor applied to unit price
  quantity_breaks?: { min_qty: number; discount_percent: number }[];
}

export interface PricingComputationInputV1 {
  process_type: string;
  geometry_signature: string; // hash of metrics & config driving pricing
  quantity: number;
  lead_time_option: "standard" | "expedited";
  factors: CostFactorsV1;
}

export interface PricingBreakdownDetailedV1 {
  material: number;
  machining: number;
  setup: number;
  finish: number;
  inspection: number;
  overhead: number;
  margin: number; // dollar margin value, not percent
  unit_cost_before_margin: number;
  unit_price: number; // after margin (and rush if applied)
  total_price: number;
  cycle_time_min?: number;
  machine_time_min?: number;
}
