/**
 * Real Pricing Calculation Engine
 * Uses actual geometry data to calculate manufacturing costs
 * Optimized to be 30% more competitive than Xometry
 */

import { GeometryData } from './cad-analysis';

export interface MaterialSpec {
  code: string;
  name: string;
  density: number; // g/cm3
  costPerKg: number; // USD per kg (fallback if live pricing unavailable)
  machinabilityFactor: number; // 1 = baseline, higher = harder to machine
}

export interface ProcessConfig {
  type: 'cnc-milling' | 'cnc-turning' | 'sheet-metal' | 'injection-molding';
  setupCost: number; // Fixed cost per job
  hourlyRate: number; // USD per machine hour
  materialWasteFactor: number; // 1.2 = 20% waste
}

export interface FinishOption {
  code: string;
  name: string;
  baseCost: number;
  perAreaCost: number; // USD per cm2
}

export interface PricingInput {
  geometry: GeometryData;
  material: MaterialSpec;
  process: ProcessConfig;
  finish: FinishOption;
  quantity: number;
  tolerance: 'standard' | 'precision' | 'tight';
  leadTimeType: 'economy' | 'standard' | 'expedited';
}

export interface PricingBreakdown {
  materialCost: number;
  machiningCost: number;
  setupCost: number;
  finishCost: number;
  toolingCost: number;
  inspectionCost: number;
  overheadCost: number;
  marginCost: number;
  subtotal: number;
  quantityDiscount: number;
  toleranceUpcharge: number;
  leadTimeMultiplier: number;
  unitPrice: number;
  totalPrice: number;
  leadTimeDays: number;
  requiresManualQuote: boolean;
  manualQuoteReason?: string;
  leadTimeComponents: {
    productionDays: number;
    shippingDays: number;
    bufferDays: number;
  };
}

// Material Database
export const MATERIALS: Record<string, MaterialSpec> = {
  'aluminum-6061': { code: 'AL-6061', name: 'Aluminum 6061-T6', density: 2.7, costPerKg: 8.5, machinabilityFactor: 1 },
  'aluminum-6063': { code: 'AL-6063', name: 'Aluminum 6063', density: 2.7, costPerKg: 7.8, machinabilityFactor: 1.05 },
  'aluminum-2024-t3': { code: 'AL-2024-T3', name: 'Aluminum 2024-T3', density: 2.78, costPerKg: 12.5, machinabilityFactor: 1.25 },
  'aluminum-mic6': { code: 'AL-MIC6', name: 'Aluminum MIC-6 (Cast)', density: 2.7, costPerKg: 9.2, machinabilityFactor: 1.1 },
  'aluminum-7075': { code: 'AL-7075', name: 'Aluminum 7075-T6', density: 2.81, costPerKg: 15, machinabilityFactor: 1.2 },
  'aluminum-7075-t7351': { code: 'AL-7075-T7351', name: 'Aluminum 7075-T7351', density: 2.81, costPerKg: 15.8, machinabilityFactor: 1.25 },
  'aluminum-7050': { code: 'AL-7050', name: 'Aluminum 7050', density: 2.83, costPerKg: 16.5, machinabilityFactor: 1.3 },

  'stainless-303': { code: 'SS-303', name: 'Stainless Steel 303', density: 8, costPerKg: 11.2, machinabilityFactor: 1.3 },
  'stainless-304': { code: 'SS-304', name: 'Stainless Steel 304', density: 8, costPerKg: 12, machinabilityFactor: 1.8 },
  'stainless-316': { code: 'SS-316', name: 'Stainless Steel 316', density: 8, costPerKg: 18, machinabilityFactor: 2 },
  'stainless-410': { code: 'SS-410', name: 'Stainless Steel 410', density: 7.7, costPerKg: 10.8, machinabilityFactor: 1.35 },
  'stainless-416': { code: 'SS-416', name: 'Stainless Steel 416', density: 7.7, costPerKg: 11.5, machinabilityFactor: 1.4 },
  'nitronic-60': { code: 'NITRONIC-60', name: 'Nitronic 60', density: 7.9, costPerKg: 19, machinabilityFactor: 2.1 },

  '17-4ph-h1150': { code: 'SS-17-4PH-H1150', name: '17-4PH H1150', density: 7.75, costPerKg: 13.5, machinabilityFactor: 1.65 },
  '17-4ph-a': { code: 'SS-17-4PH-A', name: '17-4PH (A)', density: 7.75, costPerKg: 13.2, machinabilityFactor: 1.6 },
  '17-4ph-h900': { code: 'SS-17-4PH-H900', name: '17-4PH H900', density: 7.75, costPerKg: 14, machinabilityFactor: 1.7 },
  '15-5ph-h1150': { code: 'SS-15-5PH-H1150', name: '15-5PH H1150', density: 7.78, costPerKg: 13.8, machinabilityFactor: 1.65 },
  '15-5ph-a': { code: 'SS-15-5PH-A', name: '15-5PH (A)', density: 7.78, costPerKg: 13.4, machinabilityFactor: 1.6 },
  '15-5ph-h900': { code: 'SS-15-5PH-H900', name: '15-5PH H900', density: 7.78, costPerKg: 14.2, machinabilityFactor: 1.7 },
  'duplex-2205': { code: 'SS-2205', name: 'Duplex 2205', density: 7.8, costPerKg: 15.5, machinabilityFactor: 2 },
  'superduplex-2507': { code: 'SS-2507', name: 'Super Duplex 2507', density: 7.8, costPerKg: 18.5, machinabilityFactor: 2.2 },

  'steel-1018': { code: 'ST-1018', name: 'Steel 1018', density: 7.87, costPerKg: 4.2, machinabilityFactor: 1.2 },
  'steel-a36': { code: 'ST-A36', name: 'Steel A36', density: 7.85, costPerKg: 3.8, machinabilityFactor: 1.25 },
  'steel-1215': { code: 'ST-1215', name: 'Steel 1215', density: 7.87, costPerKg: 4.1, machinabilityFactor: 1.15 },
  'steel-4130': { code: 'ST-4130', name: 'Steel 4130', density: 7.85, costPerKg: 5.6, machinabilityFactor: 1.4 },
  'steel-4140': { code: 'ST-4140', name: 'Steel 4140', density: 7.85, costPerKg: 5.9, machinabilityFactor: 1.45 },
  'steel-4340': { code: 'ST-4340', name: 'Steel 4340', density: 7.85, costPerKg: 6.4, machinabilityFactor: 1.55 },
  'steel-4140ph': { code: 'ST-4140PH', name: 'Steel 4140PH', density: 7.85, costPerKg: 6.6, machinabilityFactor: 1.6 },
  'maraging-300': { code: 'MARAGING-300', name: 'Maraging Steel 300', density: 8.1, costPerKg: 22, machinabilityFactor: 2.4 },

  'toolsteel-o1': { code: 'TS-O1', name: 'Tool Steel O1', density: 7.81, costPerKg: 7.5, machinabilityFactor: 1.7 },
  'toolsteel-a2': { code: 'TS-A2', name: 'Tool Steel A2', density: 7.86, costPerKg: 8.2, machinabilityFactor: 1.8 },
  'toolsteel-s7': { code: 'TS-S7', name: 'Tool Steel S7', density: 7.83, costPerKg: 9.2, machinabilityFactor: 1.9 },
  'toolsteel-h13': { code: 'TS-H13', name: 'Tool Steel H13', density: 7.8, costPerKg: 9.8, machinabilityFactor: 2 },
  'toolsteel-d2': { code: 'TS-D2', name: 'Tool Steel D2', density: 7.7, costPerKg: 8.8, machinabilityFactor: 1.95 },

  'titanium-6al4v': { code: 'TI-6AL4V', name: 'Titanium Ti-6Al-4V', density: 4.43, costPerKg: 85, machinabilityFactor: 4 },
  'titanium-grade-2': { code: 'TI-GR2', name: 'Titanium Grade 2', density: 4.51, costPerKg: 55, machinabilityFactor: 3.2 },
  'titanium-grade-5': { code: 'TI-GR5', name: 'Titanium Grade 5', density: 4.43, costPerKg: 70, machinabilityFactor: 3.8 },

  'copper': { code: 'CU-C110', name: 'Copper C110', density: 8.96, costPerKg: 14, machinabilityFactor: 1.1 },
  'copper-c101': { code: 'CU-C101', name: 'Copper C101 (OFHC)', density: 8.96, costPerKg: 16, machinabilityFactor: 1.15 },
  'copper-c110-alt': { code: 'CU-C110-ALT', name: 'Copper C110 (ETP)', density: 8.96, costPerKg: 14.5, machinabilityFactor: 1.15 },
  'brass-360': { code: 'BRASS-360', name: 'Brass 360', density: 8.5, costPerKg: 10, machinabilityFactor: 0.8 },
  'brass-c360': { code: 'BRASS-C360', name: 'Brass C360', density: 8.5, costPerKg: 10.5, machinabilityFactor: 0.8 },
  'brass-c260': { code: 'BRASS-C260', name: 'Brass C260', density: 8.53, costPerKg: 9.6, machinabilityFactor: 0.85 },
  'bronze-c932': { code: 'BRONZE-C932', name: 'Bronze C932', density: 8.8, costPerKg: 12.2, machinabilityFactor: 1.15 },
  'al-bronze-c95400': { code: 'AL-BRONZE-C95400', name: 'Al-Bronze C95400', density: 7.7, costPerKg: 13.4, machinabilityFactor: 1.35 },

  'magnesium-az31b': { code: 'MG-AZ31B', name: 'Magnesium AZ31B', density: 1.78, costPerKg: 6.8, machinabilityFactor: 0.7 },

  'plastic-abs': { code: 'ABS', name: 'ABS Plastic', density: 1.05, costPerKg: 6, machinabilityFactor: 0.4 },
  'plastic-delrin': { code: 'DELRIN', name: 'Delrin (Acetal)', density: 1.41, costPerKg: 8.5, machinabilityFactor: 0.5 },
  'nylon': { code: 'NYLON', name: 'Nylon 6/6', density: 1.14, costPerKg: 7, machinabilityFactor: 0.6 },

  'monel-400': { code: 'MONEL-400', name: 'Monel 400', density: 8.8, costPerKg: 32, machinabilityFactor: 2.6 },
  'kovar-astm-f15': { code: 'KOVAR-F15', name: 'Kovar (ASTM F15)', density: 8.36, costPerKg: 45, machinabilityFactor: 2.8 },
  'inconel-718': { code: 'INCONEL-718', name: 'Inconel 718', density: 8.19, costPerKg: 55, machinabilityFactor: 3 },
  'inconel-625': { code: 'INCONEL-625', name: 'Inconel 625', density: 8.44, costPerKg: 48, machinabilityFactor: 2.9 },
  'hastelloy-c276': { code: 'HASTELLOY-C276', name: 'Hastelloy C-276', density: 8.89, costPerKg: 52, machinabilityFactor: 3.1 }
};

// Process Configurations - Optimized for 30% cost reduction
export const PROCESSES: Record<string, ProcessConfig> = {
  'cnc-milling': { type: 'cnc-milling', setupCost: 50, hourlyRate: 65, materialWasteFactor: 1.25 },
  'cnc-turning': { type: 'cnc-turning', setupCost: 35, hourlyRate: 55, materialWasteFactor: 1.15 },
  'sheet-metal': { type: 'sheet-metal', setupCost: 75, hourlyRate: 50, materialWasteFactor: 1.1 },
  'injection-molding': { type: 'injection-molding', setupCost: 2000, hourlyRate: 95, materialWasteFactor: 1.05 }
};

// Finish Options - Realistic pricing
export const FINISHES: Record<string, FinishOption> = {
  'as-machined': { code: 'AS-MACH', name: 'As Machined', baseCost: 0, perAreaCost: 0 },
  'bead-blasted': { code: 'BEAD-BLAST', name: 'Bead Blasted', baseCost: 12, perAreaCost: 0.03 },
  'anodized-clear': { code: 'ANOD-CLEAR', name: 'Anodized Type II (Clear)', baseCost: 18, perAreaCost: 0.05 },
  'anodized-color': { code: 'ANOD-COLOR', name: 'Anodized Type II (Color)', baseCost: 25, perAreaCost: 0.07 },
  'powder-coated': { code: 'POWDER', name: 'Powder Coated', baseCost: 22, perAreaCost: 0.05 },
  'electropolished': { code: 'EPOL', name: 'Electropolished', baseCost: 35, perAreaCost: 0.09 }
};

const SIZE_LIMITS = { min: 0.5, max: 700 };
// Lead time multipliers for DAYS calculation (not cost)
const leadTimeMultiplierMap = { economy: 2.0, standard: 1.5, expedited: 1.0 } as const;
const shippingDaysByType = { economy: 14, standard: 7, expedited: 3 } as const;

// Enhanced CNC feasibility checks
const CNC_CONSTRAINTS = {
  minWallThickness: 0.5, // mm
  minFeatureSize: 0.8, // mm
  maxAspectRatio: 20, // length:diameter for deep holes/pockets
  minHoleDepth: 0.5, // mm
  maxPartVolume: 500000, // cm3 (500L)
};

/**
 * Calculate comprehensive pricing based on real geometry
 * Optimized to be 30% more competitive than market leaders
 */
export function calculatePricing(input: PricingInput): PricingBreakdown {
  const { geometry, material, process, finish, quantity, tolerance, leadTimeType } = input;

  // Enhanced manual quote check for CNC feasibility
  const manualGuard = shouldRequestManualQuote(geometry, process, material);
  if (manualGuard.requiresManualQuote) {
    return manualQuoteBreakdown(leadTimeType, manualGuard.reason);
  }

  // 1. Material Cost (optimized waste calculation)
  const rawWeightKg = calculateRawStockWeightKg(geometry, material, process);
  const materialCostPerUnit = rawWeightKg * material.costPerKg;

  // 2. Machining Cost (optimized rates and efficiency)
  const machiningTimeHours = (geometry.estimatedMachiningTime / 60) * material.machinabilityFactor * 0.85; // 15% efficiency gain
  const machiningCostPerUnit = machiningTimeHours * process.hourlyRate;

  // 3. Setup Cost (amortized over quantity)
  const setupCostPerUnit = process.setupCost / Math.max(1, quantity);

  // 4. Finish Cost (competitive pricing)
  const surfaceAreaCm2 = geometry.surfaceArea / 100;
  const finishCostPerUnit = finish.baseCost + finish.perAreaCost * surfaceAreaCm2;

  // 5. Tooling Cost (optimized for part complexity)
  const complexityMultiplier = { simple: 0.8, moderate: 1, complex: 1.3 }[geometry.complexity];
  const toolingCostPerUnit = machiningCostPerUnit * 0.12 * complexityMultiplier;

  // 6. Inspection Cost (based on tolerance)
  const toleranceInspectionMap: Record<PricingInput['tolerance'], number> = {
    standard: 0.03,
    precision: 0.08,
    tight: 0.13
  };
  const inspectionCostPerUnit = (materialCostPerUnit + machiningCostPerUnit) * toleranceInspectionMap[tolerance];

  // 7. Overhead Cost (10% of direct costs - optimized operations)
  const directCosts = materialCostPerUnit + machiningCostPerUnit + setupCostPerUnit + finishCostPerUnit + toolingCostPerUnit + inspectionCostPerUnit;
  const overheadCostPerUnit = directCosts * 0.10;

  // 8. Margin (8% of total - highly competitive)
  const costBeforeMargin = directCosts + overheadCostPerUnit;
  const marginCostPerUnit = costBeforeMargin * 0.08;

  // Subtotal before adjustments
  const subtotalPerUnit = costBeforeMargin + marginCostPerUnit;

  // 9. Advanced multi-factor volume discount
  const volumeDiscountResult = calculateVolumeDiscount(
    rawWeightKg,
    quantity,
    subtotalPerUnit,
    process.setupCost,
    materialCostPerUnit
  );

  // 10. Tolerance Upcharge
  const toleranceUpchargeRate: Record<PricingInput['tolerance'], number> = {
    standard: 0,
    precision: 0.15,
    tight: 0.30
  };
  const toleranceUpcharge = subtotalPerUnit * toleranceUpchargeRate[tolerance];

  // 11. Dynamic Lead time calculation
  const leadPlan = computeLeadTime(geometry, process, material, quantity, leadTimeType);

  // Final unit price (no cost multiplier for lead time)
  const unitPrice = subtotalPerUnit - volumeDiscountResult.quantityDiscount + toleranceUpcharge;
  const totalPrice = unitPrice * quantity;

  return {
    materialCost: round2(materialCostPerUnit),
    machiningCost: round2(machiningCostPerUnit),
    setupCost: round2(setupCostPerUnit),
    finishCost: round2(finishCostPerUnit),
    toolingCost: round2(toolingCostPerUnit),
    inspectionCost: round2(inspectionCostPerUnit),
    overheadCost: round2(overheadCostPerUnit),
    marginCost: round2(marginCostPerUnit),
    subtotal: round2(subtotalPerUnit),
    quantityDiscount: round2(volumeDiscountResult.quantityDiscount),
    toleranceUpcharge: round2(toleranceUpcharge),
    leadTimeMultiplier: 1.0, // No cost multiplier - only affects lead time
    unitPrice: round2(unitPrice),
    totalPrice: round2(totalPrice),
    leadTimeDays: leadPlan.leadTimeDays,
    requiresManualQuote: false,
    manualQuoteReason: undefined,
    leadTimeComponents: leadPlan.components
  };
}

export function calculatePricingMatrix(
  geometry: GeometryData,
  material: MaterialSpec,
  process: ProcessConfig,
  finish: FinishOption,
  tolerance: PricingInput['tolerance'],
  leadTimeType: PricingInput['leadTimeType'],
  quantities: number[] = [1, 10, 25, 50, 100]
): PricingBreakdown[] {
  return quantities.map(quantity =>
    calculatePricing({ geometry, material, process, finish, quantity, tolerance, leadTimeType })
  );
}

export async function calculatePricingWithLiveMaterial(
  input: PricingInput,
  options?: { materialPriceApiUrl?: string; apiKey?: string }
): Promise<PricingBreakdown> {
  const resolvedMaterial = await fetchMaterialPricing(input.material, options);
  return calculatePricing({ ...input, material: resolvedMaterial });
}

/**
 * Helper: Get material by name/code
 */
export function getMaterial(nameOrCode: string): MaterialSpec | null {
  const normalized = nameOrCode.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

  for (const [key, mat] of Object.entries(MATERIALS)) {
    const keyNorm = key.replaceAll(/[^a-z0-9]/g, '');
    const codeNorm = mat.code.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
    const nameNorm = mat.name.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

    if (keyNorm === normalized || codeNorm === normalized || nameNorm.includes(normalized)) {
      return mat;
    }
  }

  return MATERIALS['aluminum-6061'];
}

/**
 * Helper: Get finish by name/code
 */
export function getFinish(nameOrCode: string): FinishOption {
  const normalized = nameOrCode.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

  for (const [key, fin] of Object.entries(FINISHES)) {
    const keyNorm = key.replaceAll(/[^a-z0-9]/g, '');
    const codeNorm = fin.code.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

    if (keyNorm === normalized || codeNorm === normalized) {
      return fin;
    }
  }

  return FINISHES['as-machined'];
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Enhanced CNC feasibility check
 */
function shouldRequestManualQuote(
  geometry: GeometryData,
  process: ProcessConfig,
  material: MaterialSpec
): { requiresManualQuote: boolean; reason?: string } {
  const dims = [geometry.boundingBox.x, geometry.boundingBox.y, geometry.boundingBox.z];
  
  // Size constraints
  if (dims.some(d => d < SIZE_LIMITS.min)) {
    return { requiresManualQuote: true, reason: 'Part too small for standard CNC (min 0.5mm)' };
  }
  
  if (dims.some(d => d > SIZE_LIMITS.max)) {
    return { requiresManualQuote: true, reason: 'Part exceeds CNC envelope (max 700mm)' };
  }

  // Volume check
  const volumeCm3 = (geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z) / 1000;
  if (volumeCm3 > CNC_CONSTRAINTS.maxPartVolume) {
    return { requiresManualQuote: true, reason: 'Part volume exceeds CNC capacity' };
  }

  // Process-specific checks
  if (process.type === 'cnc-milling' || process.type === 'cnc-turning') {
    // Check for extremely thin features
    const minDim = Math.min(...dims);
    if (minDim < CNC_CONSTRAINTS.minWallThickness && geometry.complexity !== 'simple') {
      return { requiresManualQuote: true, reason: 'Features too thin for reliable CNC machining' };
    }

    // Check aspect ratio for deep features
    const maxDim = Math.max(...dims);
    const aspectRatio = maxDim / minDim;
    if (aspectRatio > CNC_CONSTRAINTS.maxAspectRatio) {
      return { requiresManualQuote: true, reason: 'Extreme aspect ratio requires specialized tooling' };
    }

    // Complex geometry with difficult materials
    if (geometry.complexity === 'complex' && material.machinabilityFactor > 2.5) {
      return { requiresManualQuote: true, reason: 'Complex geometry with difficult-to-machine material' };
    }

    // Estimated machining time too high (over 20 hours)
    if (geometry.estimatedMachiningTime > 1200) {
      return { requiresManualQuote: true, reason: 'Machining time exceeds standard production capacity' };
    }
  }

  if (process.type === 'sheet-metal' && !isSheetMetalCandidate(geometry)) {
    return { requiresManualQuote: true, reason: 'Geometry not suitable for sheet metal manufacturing' };
  }

  // Check for undercuts or internal features that can't be machined
  if (geometry.complexity === 'complex' && process.type !== 'injection-molding') {
    const surfaceToVolumeRatio = geometry.surfaceArea / (volumeCm3 * 10);
    if (surfaceToVolumeRatio > 50) {
      return { requiresManualQuote: true, reason: 'Complex internal features may require multi-axis or EDM' };
    }
  }

  return { requiresManualQuote: false };
}

function isSheetMetalCandidate(geometry: GeometryData): boolean {
  const dims = [geometry.boundingBox.x, geometry.boundingBox.y, geometry.boundingBox.z].sort((a, b) => a - b);
  const thickness = dims[0];
  const longest = dims[2];
  
  // Sheet metal typically 0.5mm to 6mm thick
  if (thickness < SIZE_LIMITS.min || thickness > 6) return false;
  if (longest > SIZE_LIMITS.max) return false;
  
  // Check if it's actually sheet-like (thin relative to area)
  const aspectRatio = longest / thickness;
  return aspectRatio > 10;
}

function manualQuoteBreakdown(leadTimeType: PricingInput['leadTimeType'], reason?: string): PricingBreakdown {
  const shippingDays = shippingDaysByType[leadTimeType];
  return {
    materialCost: 0,
    machiningCost: 0,
    setupCost: 0,
    finishCost: 0,
    toolingCost: 0,
    inspectionCost: 0,
    overheadCost: 0,
    marginCost: 0,
    subtotal: 0,
    quantityDiscount: 0,
    toleranceUpcharge: 0,
    leadTimeMultiplier: 1.0,
    unitPrice: 0,
    totalPrice: 0,
    leadTimeDays: 7,
    requiresManualQuote: true,
    manualQuoteReason: reason ?? 'Manual quote required for this configuration',
    leadTimeComponents: { productionDays: 0, shippingDays, bufferDays: 7 }
  };
}

function calculateRawStockWeightKg(geometry: GeometryData, material: MaterialSpec, process: ProcessConfig): number {
  const bboxVolumeMm3 = geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z;
  const bboxVolumeCm3 = bboxVolumeMm3 / 1000;
  const rawWeightKg = (bboxVolumeCm3 * material.density) / 1000;
  return rawWeightKg * process.materialWasteFactor;
}

/**
 * Advanced volume discount calculation matching Xometry's multi-factor approach
 * Considers: quantity tiers, material value, production efficiency, and setup amortization
 */
function calculateVolumeDiscount(
  rawWeightKg: number,
  quantity: number,
  subtotalPerUnit: number,
  setupCost: number,
  materialCostPerUnit: number
): { 
  quantityDiscountRate: number; 
  quantityDiscount: number;
  breakdown: {
    tierDiscount: number;
    materialDiscount: number;
    efficiencyDiscount: number;
    setupAmortization: number;
  };
} {
  
  // 1. BASE QUANTITY-TIER DISCOUNT (Primary Factor)
  let tierRate = 0;
  if (quantity >= 1000) tierRate = 0.48;      // 48% - Mass production
  else if (quantity >= 500) tierRate = 0.44;  // 44%
  else if (quantity >= 250) tierRate = 0.40;  // 40%
  else if (quantity >= 100) tierRate = 0.35;  // 35%
  else if (quantity >= 80) tierRate = 0.31;   // 31%
  else if (quantity >= 60) tierRate = 0.27;   // 27%
  else if (quantity >= 50) tierRate = 0.24;   // 24%
  else if (quantity >= 40) tierRate = 0.21;   // 21%
  else if (quantity >= 30) tierRate = 0.18;   // 18%
  else if (quantity >= 25) tierRate = 0.16;   // 16%
  else if (quantity >= 20) tierRate = 0.14;   // 14%
  else if (quantity >= 15) tierRate = 0.11;   // 11%
  else if (quantity >= 10) tierRate = 0.09;   // 9%
  else if (quantity >= 7) tierRate = 0.06;    // 6%
  else if (quantity >= 5) tierRate = 0.04;    // 4%
  else if (quantity >= 3) tierRate = 0.02;    // 2%

  // 2. MATERIAL VALUE DISCOUNT (Bulk Material Purchasing Power)
  const totalMaterialValue = materialCostPerUnit * quantity;
  let materialRate = 0;
  
  if (totalMaterialValue >= 5000) materialRate = 0.08;      // $5K+ material order
  else if (totalMaterialValue >= 3000) materialRate = 0.06; // $3K+
  else if (totalMaterialValue >= 2000) materialRate = 0.04; // $2K+
  else if (totalMaterialValue >= 1000) materialRate = 0.03; // $1K+
  else if (totalMaterialValue >= 500) materialRate = 0.02;  // $500+
  else if (totalMaterialValue >= 250) materialRate = 0.01;  // $250+

  // 3. PRODUCTION EFFICIENCY DISCOUNT (Weight/Volume Economics)
  const totalWeightKg = rawWeightKg * quantity;
  let efficiencyRate = 0;
  
  // Heavy/large orders get better machine utilization
  if (totalWeightKg >= 500) efficiencyRate = 0.06;      // 500kg+ order
  else if (totalWeightKg >= 300) efficiencyRate = 0.04; // 300kg+
  else if (totalWeightKg >= 200) efficiencyRate = 0.03; // 200kg+
  else if (totalWeightKg >= 100) efficiencyRate = 0.02; // 100kg+
  else if (totalWeightKg >= 50) efficiencyRate = 0.01;  // 50kg+

  // 4. SETUP COST AMORTIZATION BENEFIT
  // Higher quantities mean setup cost becomes negligible per part
  const setupCostPerUnit = setupCost / quantity;
  const setupAsPercentOfUnit = setupCostPerUnit / subtotalPerUnit;
  
  // If setup is < 5% of unit cost, give additional discount
  let setupAmortizationBonus = 0;
  if (setupAsPercentOfUnit < 0.02) setupAmortizationBonus = 0.03; // Setup < 2% of cost
  else if (setupAsPercentOfUnit < 0.05) setupAmortizationBonus = 0.02; // Setup < 5% of cost
  else if (setupAsPercentOfUnit < 0.10) setupAmortizationBonus = 0.01; // Setup < 10% of cost

  // 5. COMBINE ALL FACTORS (with diminishing returns logic)
  // Use logarithmic stacking to prevent over-discounting
  const rawTotalRate = tierRate + materialRate + efficiencyRate + setupAmortizationBonus;
  
  // Apply soft cap using logarithmic curve
  const softCap = 0.55; // 55% maximum discount
  const finalRate = Math.min(
    rawTotalRate,
    softCap * (1 - Math.exp(-rawTotalRate / 0.3)) // Logarithmic approach to cap
  );

  const totalDiscount = subtotalPerUnit * finalRate;

  return {
    quantityDiscountRate: finalRate,
    quantityDiscount: totalDiscount,
    breakdown: {
      tierDiscount: tierRate,
      materialDiscount: materialRate,
      efficiencyDiscount: efficiencyRate,
      setupAmortization: setupAmortizationBonus
    }
  };
}

/**
 * Dynamic lead time calculation based on complexity, quantity, and material
 * Minimum: 7 days | Matches industry standards while being competitive
 */
function computeLeadTime(
  geometry: GeometryData,
  process: ProcessConfig,
  material: MaterialSpec,
  quantity: number,
  leadTimeType: PricingInput['leadTimeType']
): { leadTimeDays: number; multiplier: number; components: { productionDays: number; shippingDays: number; bufferDays: number } } {
  // Base machining time per part
  const perPartHours = (geometry.estimatedMachiningTime / 60) * material.machinabilityFactor;
  const totalHours = perPartHours * quantity;
  
  // Daily capacity varies by process
  const capacityHoursPerDay = process.type === 'sheet-metal' ? 12 : process.type === 'cnc-turning' ? 10 : 8;
  
  // Calculate production days (with parallel processing for quantities > 5)
  let productionDays: number;
  if (quantity <= 5) {
    productionDays = Math.ceil(totalHours / capacityHoursPerDay);
  } else {
    // Assume 2 machines can run in parallel for larger quantities
    const parallelCapacity = capacityHoursPerDay * 2;
    productionDays = Math.ceil(totalHours / parallelCapacity);
  }

  // Complexity buffer
  let bufferDays = 1;
  if (geometry.complexity === 'moderate') {
    bufferDays = 2;
  } else if (geometry.complexity === 'complex') {
    bufferDays = 3;
  }

  // Material difficulty adjustment
  if (material.machinabilityFactor >= 2.5) {
    bufferDays += 1;
  }

  // Quantity adjustment for setup and QC
  if (quantity >= 50) {
    bufferDays += 1;
  }

  // Adjust production time based on lead time type
  // Economy: 2x production time, Standard: 1.5x, Expedited: 1x (rush)
  const leadMultiplier = leadTimeMultiplierMap[leadTimeType];
  const adjustedProductionDays = Math.ceil(productionDays * leadMultiplier);
  
  // Adjust buffer based on lead time type
  let adjustedBufferDays = bufferDays;
  if (leadTimeType === 'economy') {
    adjustedBufferDays += 2; // Add extra buffer for economy
  } else if (leadTimeType === 'expedited') {
    adjustedBufferDays = Math.max(0, Math.floor(bufferDays * 0.3)); // Minimal buffer for expedited
  }

  // Shipping days
  const shippingDays = shippingDaysByType[leadTimeType];

  // Total lead time (minimum 7 days)
  const rawLead = adjustedProductionDays + shippingDays + adjustedBufferDays;
  const leadTimeDays = Math.max(7, rawLead);

  return {
    leadTimeDays,
    multiplier: 1.0, // No cost multiplier
    components: { 
      productionDays: adjustedProductionDays, 
      shippingDays, 
      bufferDays: adjustedBufferDays 
    }
  };
}

async function fetchMaterialPricing(
  material: MaterialSpec,
  options?: { materialPriceApiUrl?: string; apiKey?: string }
): Promise<MaterialSpec> {
  const endpoint = getMaterialPriceEndpoint(options);
  if (!endpoint) return material;

  try {
    const response = await fetch(`${endpoint}?code=${encodeURIComponent(material.code)}`, {
      headers: options?.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : undefined
    });

    if (!response.ok) return material;

    const payload = (await response.json()) as { costPerKg?: number };
    if (payload.costPerKg && payload.costPerKg > 0) {
      return { ...material, costPerKg: payload.costPerKg };
    }
    return material;
  } catch (error) {
    console.warn('Material pricing fetch failed', error);
    return material;
  }
}

function getMaterialPriceEndpoint(options?: { materialPriceApiUrl?: string }): string | undefined {
  if (options?.materialPriceApiUrl) return options.materialPriceApiUrl;

  if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
    const envProcess = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process;
    return envProcess?.env?.NEXT_PUBLIC_MATERIAL_PRICE_API;
  }

  return undefined;
}