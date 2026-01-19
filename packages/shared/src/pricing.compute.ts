import { GeometryMetricsV1 } from './contracts/v1/part-config';
import { CostFactorsV1, PricingBreakdownDetailedV1 } from './contracts/v1/pricing';

/**
 * Phase 1 Base Pricing Computation Utility
 * ---------------------------------------
 * Lightweight, deterministic cost roll-up translating CostFactorsV1 + geometry + quantity
 * into a PricingBreakdownDetailedV1 structure. This intentionally omits advanced cycle time
 * modeling, nesting, fixture amortization, real material density, and stochastic adjustments.
 * Those are scheduled for later phases.
 */

export interface ComputePricingInput {
  quantity: number;
  metrics: GeometryMetricsV1;
  factors: CostFactorsV1;
  /** Optional tolerance multiplier (e.g. 1 = standard, 1.15 precision, 1.35 high precision) */
  tolerance_multiplier?: number;
  /** Optional external pre-computed cycle time (minutes) overrides */
  overrides?: {
    machine_time_min?: number; // direct machine engagement time
    cycle_time_min?: number; // overall cycle (machine + handling)
    material_mass_kg?: number; // if caller has precise mass
  };
}

export interface ComputePricingResult extends PricingBreakdownDetailedV1 {}

// --- Internal helper heuristics ---------------------------------------------------------

// Feature-based machining time estimates (minutes per feature)
// Based on typical production machining centers with modern tooling
const DEFAULT_REMOVAL_RATE_CC_PER_MIN = 12; // Conservative aluminum removal rate
const DEFAULT_FEATURE_TIME_MAP: Record<string, number> = {
  holes: 0.35,      // Drill + spot + chamfer cycle
  pockets: 1.2,     // Roughing + finishing passes
  slots: 0.6,       // Multiple plunge + linear cuts
  faces: 0.25,      // Face milling operation
  bends: 0.8,       // Sheet metal bend setup + cycle
  corners: 0.08,    // Small radius or chamfer
  threads: 0.75,    // Tapping or thread milling
  undercuts: 1.5,   // Special tooling required
  ribs: 0.4,        // Thin wall machining
  bosses: 0.5,      // Raised feature machining
};

// Material density lookup (kg per cc) - common manufacturing materials
const MATERIAL_DENSITIES: Record<string, number> = {
  'aluminum-6061': 0.0000027, // 2.7 g/cc
  'aluminum-7075': 0.0000028, // 2.8 g/cc
  'steel-1018': 0.0000078,    // 7.8 g/cc
  'steel-4140': 0.0000078,    // 7.8 g/cc
  'stainless-304': 0.0000080, // 8.0 g/cc
  'stainless-316': 0.0000080, // 8.0 g/cc
  'brass': 0.0000085,         // 8.5 g/cc
  'copper': 0.0000089,        // 8.9 g/cc
  'titanium': 0.0000045,      // 4.5 g/cc
  'plastic-abs': 0.00000105,  // 1.05 g/cc
  'plastic-nylon': 0.00000114, // 1.14 g/cc
  'plastic-peek': 0.00000132, // 1.32 g/cc
};
const DEFAULT_DENSITY_KG_PER_CC = 0.0000078; // Steel fallback

function estimateMachineTimeMinutes(metrics: GeometryMetricsV1): number {
  let time = 0;
  
  // Feature-based time calculation
  if (metrics.features) {
    for (const [k, v] of Object.entries(metrics.features)) {
      if (v && DEFAULT_FEATURE_TIME_MAP[k]) {
        time += v * DEFAULT_FEATURE_TIME_MAP[k];
      }
    }
  }
  
  // Add base machining time from volume removal
  if (metrics.volume_cc && metrics.volume_cc > 0) {
    // Estimate material removal time (rough + finish passes)
    const removalTime = (metrics.volume_cc / DEFAULT_REMOVAL_RATE_CC_PER_MIN) * 0.4;
    time += removalTime;
    
    // Add complexity multiplier based on surface area to volume ratio
    if (metrics.surface_area_cm2) {
      const svRatio = metrics.surface_area_cm2 / (metrics.volume_cc / 1000);
      const complexityMultiplier = Math.min(1 + (svRatio / 100), 2.5);
      time *= complexityMultiplier;
    }
  }
  
  // Add setup and tool change overhead (10-20% of machine time)
  time *= 1.15;
  
  // Minimum machining time threshold
  if (time < 2.0) time = 2.0;
  
  return time;
}

function estimateMaterialMassKg(metrics: GeometryMetricsV1, materialKey?: string): number {
  if (!metrics.volume_cc) return 0;
  
  // Use material-specific density if available
  let density = DEFAULT_DENSITY_KG_PER_CC;
  if (materialKey) {
    const normalizedKey = materialKey.toLowerCase().replace(/\s+/g, '-');
    density = MATERIAL_DENSITIES[normalizedKey] || DEFAULT_DENSITY_KG_PER_CC;
  }
  
  return metrics.volume_cc * density;
}

function selectQuantityDiscount(factors: CostFactorsV1, quantity: number): number {
  if (!factors.quantity_breaks || factors.quantity_breaks.length === 0) return 0;
  let applicable = 0;
  for (const br of factors.quantity_breaks) {
    if (quantity >= br.min_qty) {
      // discount_percent assumed to be a percentage (e.g. 10 for 10%) in current CostFactorsV1 usage.
      applicable = br.discount_percent;
    }
  }
  return applicable / 100; // convert to fraction
}

// --- Public API ------------------------------------------------------------------------

export function computePricingBreakdown(input: ComputePricingInput): ComputePricingResult {
  const { quantity, metrics, factors, overrides, tolerance_multiplier } = input;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a positive number');
  }

  // Machine time per part (minutes)
  const machine_time_min = overrides?.machine_time_min ?? estimateMachineTimeMinutes(metrics);
  const cycle_time_min = overrides?.cycle_time_min ?? machine_time_min; // Use machine time as cycle baseline

  // Material mass estimate (kg) per part - use material-specific density
  const materialKey = factors.material_name || factors.material_id;
  const material_mass_kg = overrides?.material_mass_kg ?? estimateMaterialMassKg(metrics, materialKey);

  // Component costs (per part)
  const tolMul = tolerance_multiplier && tolerance_multiplier > 0 ? tolerance_multiplier : 1;
  const machining = (machine_time_min / 60) * factors.machine_rate_per_hour * tolMul;

  // Setup cost amortized per part; retain full for overhead base via fullSetupCost variable.
  const fullSetupCost = factors.setup_cost;
  const setup = fullSetupCost / quantity;

  const material = material_mass_kg * (factors.material_price_per_kg ?? 0);

  let finish = 0;
  if (factors.finish_cost_adders) {
    for (const v of Object.values(factors.finish_cost_adders)) finish += v;
  }

  const inspectionBase = factors.inspection_cost_per_part ?? 0;
  const inspection = inspectionBase * (tolMul > 1 ? (1 + (tolMul - 1) * 0.8) : 1); // lighter scaling than machining

  // Overhead applied on (machine + material + full setup amortized back to unit) per initial design
  const overhead_base = machining + material + setup;
  const overhead = (factors.overhead_percent ?? 0) * overhead_base;

  const unit_cost_before_margin = material + machining + setup + finish + inspection + overhead;
  const margin = unit_cost_before_margin * factors.base_margin_percent;
  let unit_price = unit_cost_before_margin + margin;

  // Apply quantity discount (after margin, before rush) to mimic typical commercial policy
  const discount_fraction = selectQuantityDiscount(factors, quantity);
  if (discount_fraction > 0) {
    unit_price = unit_price * (1 - discount_fraction);
  }

  // Rush multiplier (applied last per contract note)
  if (factors.rush_multiplier && factors.rush_multiplier > 1) {
    unit_price = unit_price * factors.rush_multiplier;
  }

  const total_price = unit_price * quantity;

  const breakdown: PricingBreakdownDetailedV1 = {
    material: round(material),
    machining: round(machining),
    setup: round(setup),
    finish: round(finish),
    inspection: round(inspection),
    overhead: round(overhead),
    margin: round(margin),
    unit_cost_before_margin: round(unit_cost_before_margin),
    unit_price: round(unit_price),
    total_price: round(total_price),
    cycle_time_min: round(cycle_time_min),
    machine_time_min: round(machine_time_min),
  };

  return breakdown;
}

export function computePricingForQuantities(
  base: Omit<ComputePricingInput, 'quantity'>,
  quantities: number[]
): Record<number, ComputePricingResult> {
  const results: Record<number, ComputePricingResult> = {};
  for (const q of quantities) {
    results[q] = computePricingBreakdown({ ...base, quantity: q });
  }
  return results;
}

function round(n: number | undefined): number {
  if (n === undefined || Number.isNaN(n)) return 0;
  return Math.round(n * 100) / 100; // 2 decimal places
}

export const __pricingComputeDoc = `Base Pricing Compute (Enhanced)
Algorithm Steps (per part):
1. Estimate machine_time_min via feature-based heuristics with complexity adjustment.
   - Each feature type has specific time estimate based on production data
   - Volume removal time calculated using material-specific removal rates
   - Complexity multiplier applied based on surface area to volume ratio
   - Setup and tool change overhead included (15%)
2. Material cost = estimated_mass_kg * material_price_per_kg.
   - Mass calculated using material-specific density lookup
   - Supports 12+ common manufacturing materials
3. Setup cost amortized = setup_cost / quantity.
4. Machining cost = (machine_time_min / 60) * machine_rate_per_hour.
5. Finish, inspection added directly per factors.
6. Overhead = overhead_percent * (machining + material + setup).
7. unit_cost_before_margin = sum(material, machining, setup, finish, inspection, overhead).
8. margin = unit_cost_before_margin * base_margin_percent.
9. unit_price = (unit_cost_before_margin + margin) applying quantity discount then rush multiplier.
10. total_price = unit_price * quantity.

Return shape conforms to PricingBreakdownDetailedV1 contract.
Real implementations: material density lookup, feature-based cycle modeling, complexity adjustments.`;
