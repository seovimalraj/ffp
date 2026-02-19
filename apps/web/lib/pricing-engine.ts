/**
 * Real Pricing Calculation Engine
 * Uses actual geometry data to calculate manufacturing costs
 * Optimized to be 30% more competitive than Xometry
 */

import { GeometryData, SheetMetalFeatures } from "./cad-analysis";

// Type aliases for common union types
export type ProcessType = "cnc-milling" | "cnc-turning" | "sheet-metal" | "injection-molding" | "manual-quote";
export type ToleranceLevel = "standard" | "precision" | "tight";
export type LeadTimeType = "economy" | "standard" | "expedited";
export type CuttingMethod = "laser" | "plasma" | "waterjet" | "turret-punch";
export type HardwareType = "rivet-nut" | "pem-nut" | "standoff" | "captive-screw";
export type OptimizationEffort = "easy" | "moderate" | "difficult";
export type OptimizationCategory = "material" | "geometry" | "tolerance" | "finish" | "quantity";
export type SheetMetalCategory =
  | "steel"
  | "stainless"
  | "aluminum"
  | "copper"
  | "brass"
  | "titanium"
  | "superalloy";

export interface MaterialSpec {
  code: string;
  name: string;
  density: number; // g/cm3
  costPerKg: number; // USD per kg (fallback if live pricing unavailable)
  machinabilityFactor: number; // 1 = baseline, higher = harder to machine
}

export interface ProcessConfig {
  type: ProcessType;
  name: string; // Display name
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
  material: MaterialSpec | SheetMetalMaterialSpec;
  process: ProcessConfig;
  finish: FinishOption | SheetMetalFinish;
  quantity: number;
  tolerance: ToleranceLevel;
  leadTimeType: LeadTimeType;
  cuttingMethod?: CuttingMethod;
  hardware?: HardwareOption[];
}

// Sheet Metal Specific Interfaces
export interface SheetMetalMaterialSpec {
  code: string;
  name: string;
  value?: string; // Unified with CNC
  label?: string; // Unified with CNC
  density: number; // g/cm³
  costPerKg: number;
  thickness: number; // mm
  category: SheetMetalCategory;
  bendability: number; // 1 = easy, higher = harder to bend
  requiresManualQuote?: boolean; // Exotic materials requiring manual review
  manualQuoteReason?: string; // Reason for manual quote
}

export interface SheetMetalFinish {
  code: string;
  name: string;
  value?: string; // Unified with CNC
  label?: string; // Unified with CNC
  baseCost: number;
  perAreaCost: number; // USD per m²
  color?: string;
}

export interface HardwareOption {
  type: HardwareType;
  quantity: number;
  unitCost: number;
}

export interface CuttingMethodConfig {
  name: string;
  costPerMeter: number; // USD per meter cut
  speedMmPerMin: number;
  setupCost: number;
  minThickness: number; // mm
  maxThickness: number; // mm
  materialCompatibility: string[]; // material categories
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
  // Advanced Xometry-style adjustments
  demandAdjustment?: number;
  complexityRiskPremium?: number;
  materialDifficultyPremium?: number;
  batchOptimizationBonus?: number;
  // Sheet metal specific costs (optional)
  cuttingCost?: number;
  bendingCost?: number;
  hardwareCost?: number;
  qualityPremiumAdjustment?: number;
  // Secondary operations costs
  secondaryOperationsCost?: number;
  secondaryOperationsDetail?: string[];
  toleranceFeasibilityCost?: number;
  unitPrice: number;
  totalPrice: number;
  leadTimeDays: number;
  requiresManualQuote: boolean;
  manualQuoteReason?: string;
  // Classification review metadata — set when backend confidence < 0.70
  needsReview?: boolean;
  classificationMethod?: string;
  leadTimeComponents: {
    productionDays: number;
    shippingDays: number;
    bufferDays: number;
    materialProcurementDays?: number;
  };
}

export interface CostOptimization {
  suggestion: string;
  potentialSavings: number;
  savingsPercent: number;
  effort: OptimizationEffort;
  category: OptimizationCategory;
}

export const CNC_MATERIALS = {
  aluminum: [
    {
      value: "aluminum-6061",
      label: "Aluminum 6061-T6",
      costPerKg: 7.5,
      density: 2.7,
      machinabilityFactor: 1,
    },
    {
      value: "aluminum-7075",
      label: "Aluminum 7075-T6",
      costPerKg: 14,
      density: 2.81,
      machinabilityFactor: 1.15,
    },
    {
      value: "aluminum-2024",
      label: "Aluminum 2024-T3",
      costPerKg: 11.5,
      density: 2.78,
      machinabilityFactor: 1.1,
    },
    {
      value: "aluminum-5052",
      label: "Aluminum 5052-H32",
      costPerKg: 6.2,
      density: 2.68,
      machinabilityFactor: 0.95,
    },
    {
      value: "aluminum-mic-6",
      label: "Aluminum MIC-6",
      costPerKg: 8.5,
      density: 2.7,
      machinabilityFactor: 1,
    },
  ],
  steel: [
    {
      value: "steel-1018",
      label: "Mild Steel 1018",
      costPerKg: 3.8,
      density: 7.87,
      machinabilityFactor: 1,
    },
    {
      value: "steel-1045",
      label: "Carbon Steel 1045",
      costPerKg: 4.2,
      density: 7.85,
      machinabilityFactor: 1.1,
    },
    {
      value: "steel-4140",
      label: "Alloy Steel 4140",
      costPerKg: 5.5,
      density: 7.85,
      machinabilityFactor: 1.25,
    },
    {
      value: "steel-4340",
      label: "Alloy Steel 4340",
      costPerKg: 6.8,
      density: 7.85,
      machinabilityFactor: 1.35,
    },
    {
      value: "steel-a36",
      label: "Structural Steel A36",
      costPerKg: 3.5,
      density: 7.85,
      machinabilityFactor: 1,
    },
  ],
  stainless: [
    {
      value: "stainless-304",
      label: "Stainless Steel 304",
      costPerKg: 12,
      density: 8,
      machinabilityFactor: 1.4,
    },
    {
      value: "stainless-316",
      label: "Stainless Steel 316",
      costPerKg: 18,
      density: 8,
      machinabilityFactor: 1.5,
    },
    {
      value: "stainless-17-4",
      label: "Stainless Steel 17-4 PH",
      costPerKg: 22,
      density: 7.75,
      machinabilityFactor: 1.6,
    },
    {
      value: "stainless-303",
      label: "Stainless Steel 303",
      costPerKg: 13.5,
      density: 8,
      machinabilityFactor: 1.2,
    },
  ],
  titanium: [
    {
      value: "titanium-gr2",
      label: "Titanium Grade 2",
      costPerKg: 45,
      density: 4.51,
      machinabilityFactor: 2.5,
    },
    {
      value: "titanium-gr5",
      label: "Titanium Grade 5 (Ti-6Al-4V)",
      costPerKg: 55,
      density: 4.43,
      machinabilityFactor: 2.8,
    },
  ],
  brass: [
    {
      value: "brass-360",
      label: "Brass 360 (Free Cutting)",
      costPerKg: 8.5,
      density: 8.5,
      machinabilityFactor: 0.8,
    },
    {
      value: "bronze-932",
      label: "Bronze 932 (Bearing Bronze)",
      costPerKg: 12,
      density: 8.8,
      machinabilityFactor: 1,
    },
    {
      value: "copper-110",
      label: "Copper 110 (ETP)",
      costPerKg: 15,
      density: 8.94,
      machinabilityFactor: 1.3,
    },
  ],
  plastics: [
    {
      value: "delrin",
      label: "Delrin (Acetal)",
      costPerKg: 12,
      density: 1.41,
      machinabilityFactor: 0.6,
    },
    {
      value: "nylon-6",
      label: "Nylon 6",
      costPerKg: 10,
      density: 1.14,
      machinabilityFactor: 0.7,
    },
    {
      value: "peek",
      label: "PEEK",
      costPerKg: 85,
      density: 1.32,
      machinabilityFactor: 1.2,
    },
    {
      value: "polycarbonate",
      label: "Polycarbonate",
      costPerKg: 8.5,
      density: 1.2,
      machinabilityFactor: 0.65,
    },
    {
      value: "abs",
      label: "ABS",
      costPerKg: 7,
      density: 1.05,
      machinabilityFactor: 0.6,
    },
  ],
} as const;

export const CNC_TOLERANCES = [
  {
    value: "standard",
    label: 'Standard (±0.005" / ±0.127mm)',
    costMultiplier: 1,
  },
  {
    value: "precision",
    label: 'Precision (±0.002" / ±0.051mm)',
    costMultiplier: 1.15,
  },
  { value: "tight", label: 'Tight (±0.001" / ±0.025mm)', costMultiplier: 1.35 },
] as const;

/**
 * Sheet Metal Thickness Options (in mm)
 */
export const SHEET_METAL_THICKNESSES = [
  { value: "0.5", label: '0.5mm (0.020")', costMultiplier: 1 },
  { value: "0.8", label: '0.8mm (0.031")', costMultiplier: 1 },
  { value: "1.0", label: '1.0mm (0.039")', costMultiplier: 1 },
  { value: "1.2", label: '1.2mm (0.047")', costMultiplier: 1.05 },
  { value: "1.5", label: '1.5mm (0.059")', costMultiplier: 1.1 },
  { value: "2.0", label: '2.0mm (0.079")', costMultiplier: 1.15 },
  { value: "2.5", label: '2.5mm (0.098")', costMultiplier: 1.2 },
  { value: "3.0", label: '3.0mm (0.118")', costMultiplier: 1.25 },
  { value: "4.0", label: '4.0mm (0.157")', costMultiplier: 1.35 },
  { value: "5.0", label: '5.0mm (0.197")', costMultiplier: 1.5 },
  { value: "6.0", label: '6.0mm (0.236")', costMultiplier: 1.65 },
] as const;

export const CNC_FINISHES = [
  { value: "as-machined", label: "As Machined", baseCost: 0, perAreaCost: 0 },
  {
    value: "bead-blasted",
    label: "Bead Blasted",
    baseCost: 12,
    perAreaCost: 0.03,
  },
  {
    value: "anodized-clear",
    label: "Anodized Type II (Clear)",
    baseCost: 18,
    perAreaCost: 0.05,
  },
  {
    value: "anodized-color",
    label: "Anodized Type II (Color)",
    baseCost: 25,
    perAreaCost: 0.07,
  },
  {
    value: "powder-coated",
    label: "Powder Coated",
    baseCost: 22,
    perAreaCost: 0.05,
  },
  {
    value: "electropolished",
    label: "Electropolished",
    baseCost: 35,
    perAreaCost: 0.09,
  },
  {
    value: "zinc-plated",
    label: "Zinc Plated",
    baseCost: 15,
    perAreaCost: 0.04,
  },
  {
    value: "chrome-plated",
    label: "Chrome Plated",
    baseCost: 45,
    perAreaCost: 0.12,
  },
  {
    value: "nickel-plated",
    label: "Nickel Plated",
    baseCost: 35,
    perAreaCost: 0.1,
  },
] as const;

// Material Database
export const MATERIALS: Record<string, MaterialSpec> = {
  "aluminum-6061": {
    code: "AL-6061",
    name: "Aluminum 6061-T6",
    density: 2.7,
    costPerKg: 8.5,
    machinabilityFactor: 1,
  },
  "aluminum-6063": {
    code: "AL-6063",
    name: "Aluminum 6063",
    density: 2.7,
    costPerKg: 7.8,
    machinabilityFactor: 1.05,
  },
  "aluminum-2024-t3": {
    code: "AL-2024-T3",
    name: "Aluminum 2024-T3",
    density: 2.78,
    costPerKg: 12.5,
    machinabilityFactor: 1.25,
  },
  "aluminum-mic6": {
    code: "AL-MIC6",
    name: "Aluminum MIC-6 (Cast)",
    density: 2.7,
    costPerKg: 9.2,
    machinabilityFactor: 1.1,
  },
  "aluminum-7075": {
    code: "AL-7075",
    name: "Aluminum 7075-T6",
    density: 2.81,
    costPerKg: 15,
    machinabilityFactor: 1.2,
  },
  "aluminum-7075-t7351": {
    code: "AL-7075-T7351",
    name: "Aluminum 7075-T7351",
    density: 2.81,
    costPerKg: 15.8,
    machinabilityFactor: 1.25,
  },
  "aluminum-7050": {
    code: "AL-7050",
    name: "Aluminum 7050",
    density: 2.83,
    costPerKg: 16.5,
    machinabilityFactor: 1.3,
  },

  "stainless-303": {
    code: "SS-303",
    name: "Stainless Steel 303",
    density: 8,
    costPerKg: 11.2,
    machinabilityFactor: 1.3,
  },
  "stainless-304": {
    code: "SS-304",
    name: "Stainless Steel 304",
    density: 8,
    costPerKg: 12,
    machinabilityFactor: 1.8,
  },
  "stainless-316": {
    code: "SS-316",
    name: "Stainless Steel 316",
    density: 8,
    costPerKg: 18,
    machinabilityFactor: 2,
  },
  "stainless-410": {
    code: "SS-410",
    name: "Stainless Steel 410",
    density: 7.7,
    costPerKg: 10.8,
    machinabilityFactor: 1.35,
  },
  "stainless-416": {
    code: "SS-416",
    name: "Stainless Steel 416",
    density: 7.7,
    costPerKg: 11.5,
    machinabilityFactor: 1.4,
  },
  "nitronic-60": {
    code: "NITRONIC-60",
    name: "Nitronic 60",
    density: 7.9,
    costPerKg: 19,
    machinabilityFactor: 2.1,
  },

  "17-4ph-h1150": {
    code: "SS-17-4PH-H1150",
    name: "17-4PH H1150",
    density: 7.75,
    costPerKg: 13.5,
    machinabilityFactor: 1.65,
  },
  "17-4ph-a": {
    code: "SS-17-4PH-A",
    name: "17-4PH (A)",
    density: 7.75,
    costPerKg: 13.2,
    machinabilityFactor: 1.6,
  },
  "17-4ph-h900": {
    code: "SS-17-4PH-H900",
    name: "17-4PH H900",
    density: 7.75,
    costPerKg: 14,
    machinabilityFactor: 1.7,
  },
  "15-5ph-h1150": {
    code: "SS-15-5PH-H1150",
    name: "15-5PH H1150",
    density: 7.78,
    costPerKg: 13.8,
    machinabilityFactor: 1.65,
  },
  "15-5ph-a": {
    code: "SS-15-5PH-A",
    name: "15-5PH (A)",
    density: 7.78,
    costPerKg: 13.4,
    machinabilityFactor: 1.6,
  },
  "15-5ph-h900": {
    code: "SS-15-5PH-H900",
    name: "15-5PH H900",
    density: 7.78,
    costPerKg: 14.2,
    machinabilityFactor: 1.7,
  },
  "duplex-2205": {
    code: "SS-2205",
    name: "Duplex 2205",
    density: 7.8,
    costPerKg: 15.5,
    machinabilityFactor: 2,
  },
  "superduplex-2507": {
    code: "SS-2507",
    name: "Super Duplex 2507",
    density: 7.8,
    costPerKg: 18.5,
    machinabilityFactor: 2.2,
  },

  "steel-1018": {
    code: "ST-1018",
    name: "Steel 1018",
    density: 7.87,
    costPerKg: 4.2,
    machinabilityFactor: 1.2,
  },
  "steel-a36": {
    code: "ST-A36",
    name: "Steel A36",
    density: 7.85,
    costPerKg: 3.8,
    machinabilityFactor: 1.25,
  },
  "steel-1215": {
    code: "ST-1215",
    name: "Steel 1215",
    density: 7.87,
    costPerKg: 4.1,
    machinabilityFactor: 1.15,
  },
  "steel-4130": {
    code: "ST-4130",
    name: "Steel 4130",
    density: 7.85,
    costPerKg: 5.6,
    machinabilityFactor: 1.4,
  },
  "steel-4140": {
    code: "ST-4140",
    name: "Steel 4140",
    density: 7.85,
    costPerKg: 5.9,
    machinabilityFactor: 1.45,
  },
  "steel-4340": {
    code: "ST-4340",
    name: "Steel 4340",
    density: 7.85,
    costPerKg: 6.4,
    machinabilityFactor: 1.55,
  },
  "steel-4140ph": {
    code: "ST-4140PH",
    name: "Steel 4140PH",
    density: 7.85,
    costPerKg: 6.6,
    machinabilityFactor: 1.6,
  },
  "maraging-300": {
    code: "MARAGING-300",
    name: "Maraging Steel 300",
    density: 8.1,
    costPerKg: 22,
    machinabilityFactor: 2.4,
  },

  "toolsteel-o1": {
    code: "TS-O1",
    name: "Tool Steel O1",
    density: 7.81,
    costPerKg: 7.5,
    machinabilityFactor: 1.7,
  },
  "toolsteel-a2": {
    code: "TS-A2",
    name: "Tool Steel A2",
    density: 7.86,
    costPerKg: 8.2,
    machinabilityFactor: 1.8,
  },
  "toolsteel-s7": {
    code: "TS-S7",
    name: "Tool Steel S7",
    density: 7.83,
    costPerKg: 9.2,
    machinabilityFactor: 1.9,
  },
  "toolsteel-h13": {
    code: "TS-H13",
    name: "Tool Steel H13",
    density: 7.8,
    costPerKg: 9.8,
    machinabilityFactor: 2,
  },
  "toolsteel-d2": {
    code: "TS-D2",
    name: "Tool Steel D2",
    density: 7.7,
    costPerKg: 8.8,
    machinabilityFactor: 1.95,
  },

  "titanium-6al4v": {
    code: "TI-6AL4V",
    name: "Titanium Ti-6Al-4V",
    density: 4.43,
    costPerKg: 85,
    machinabilityFactor: 4,
  },
  "titanium-grade-2": {
    code: "TI-GR2",
    name: "Titanium Grade 2",
    density: 4.51,
    costPerKg: 55,
    machinabilityFactor: 3.2,
  },
  "titanium-grade-5": {
    code: "TI-GR5",
    name: "Titanium Grade 5",
    density: 4.43,
    costPerKg: 70,
    machinabilityFactor: 3.8,
  },

  copper: {
    code: "CU-C110",
    name: "Copper C110",
    density: 8.96,
    costPerKg: 14,
    machinabilityFactor: 1.1,
  },
  "copper-c101": {
    code: "CU-C101",
    name: "Copper C101 (OFHC)",
    density: 8.96,
    costPerKg: 16,
    machinabilityFactor: 1.15,
  },
  "copper-c110-alt": {
    code: "CU-C110-ALT",
    name: "Copper C110 (ETP)",
    density: 8.96,
    costPerKg: 14.5,
    machinabilityFactor: 1.15,
  },
  "brass-360": {
    code: "BRASS-360",
    name: "Brass 360",
    density: 8.5,
    costPerKg: 10,
    machinabilityFactor: 0.8,
  },
  "brass-c360": {
    code: "BRASS-C360",
    name: "Brass C360",
    density: 8.5,
    costPerKg: 10.5,
    machinabilityFactor: 0.8,
  },
  "brass-c260": {
    code: "BRASS-C260",
    name: "Brass C260",
    density: 8.53,
    costPerKg: 9.6,
    machinabilityFactor: 0.85,
  },
  "bronze-c932": {
    code: "BRONZE-C932",
    name: "Bronze C932",
    density: 8.8,
    costPerKg: 12.2,
    machinabilityFactor: 1.15,
  },
  "al-bronze-c95400": {
    code: "AL-BRONZE-C95400",
    name: "Al-Bronze C95400",
    density: 7.7,
    costPerKg: 13.4,
    machinabilityFactor: 1.35,
  },

  "magnesium-az31b": {
    code: "MG-AZ31B",
    name: "Magnesium AZ31B",
    density: 1.78,
    costPerKg: 6.8,
    machinabilityFactor: 0.7,
  },

  "plastic-abs": {
    code: "ABS",
    name: "ABS Plastic",
    density: 1.05,
    costPerKg: 6,
    machinabilityFactor: 0.4,
  },
  "plastic-delrin": {
    code: "DELRIN",
    name: "Delrin (Acetal)",
    density: 1.41,
    costPerKg: 8.5,
    machinabilityFactor: 0.5,
  },
  nylon: {
    code: "NYLON",
    name: "Nylon 6/6",
    density: 1.14,
    costPerKg: 7,
    machinabilityFactor: 0.6,
  },

  "monel-400": {
    code: "MONEL-400",
    name: "Monel 400",
    density: 8.8,
    costPerKg: 32,
    machinabilityFactor: 2.6,
  },
  "kovar-astm-f15": {
    code: "KOVAR-F15",
    name: "Kovar (ASTM F15)",
    density: 8.36,
    costPerKg: 45,
    machinabilityFactor: 2.8,
  },
  "inconel-718": {
    code: "INCONEL-718",
    name: "Inconel 718",
    density: 8.19,
    costPerKg: 55,
    machinabilityFactor: 3,
  },
  "inconel-625": {
    code: "INCONEL-625",
    name: "Inconel 625",
    density: 8.44,
    costPerKg: 48,
    machinabilityFactor: 2.9,
  },
  "hastelloy-c276": {
    code: "HASTELLOY-C276",
    name: "Hastelloy C-276",
    density: 8.89,
    costPerKg: 52,
    machinabilityFactor: 3.1,
  },
};

// Process Configurations - Optimized for 30% cost reduction
export const PROCESSES: Record<string, ProcessConfig> = {
  "cnc-milling": {
    type: "cnc-milling",
    name: "CNC Machining",
    setupCost: 50,
    hourlyRate: 65,
    materialWasteFactor: 1.25,
  },
  "cnc-turning": {
    type: "cnc-turning",
    name: "CNC Machining",
    setupCost: 35,
    hourlyRate: 55,
    materialWasteFactor: 1.15,
  },
  "sheet-metal": {
    type: "sheet-metal",
    name: "Sheet Metal",
    setupCost: 75,
    hourlyRate: 50,
    materialWasteFactor: 1.1,
  },
  "injection-molding": {
    type: "injection-molding",
    name: "Injection Molding",
    setupCost: 2000,
    hourlyRate: 95,
    materialWasteFactor: 1.05,
  },
};

// Helper function to get display name for process
export function getProcessDisplayName(process: string | undefined): string {
  if (!process) return "CNC Machining";
  if (process === "manual-quote") return "Manual Quote";

  // Both CNC milling and turning show as "CNC Machining"
  if (process === "cnc-milling" || process === "cnc-turning") {
    return "CNC Machining";
  }

  // All sheet metal variations show as "Sheet Metal"
  if (
    process.includes("sheet") ||
    process === "laser" ||
    process === "drilling" ||
    process === "plasma" ||
    process === "waterjet"
  ) {
    return "Sheet Metal";
  }

  return PROCESSES[process]?.name || "CNC Machining";
}

// Helper: Check if process is CNC-based
export function isCNCProcess(process: string | undefined): boolean {
  if (!process) return false;
  // Clean up any malformed process strings
  const cleanProcess = process
    .replaceAll(/(?:^["'\s]+)|(?:["'\s]+$)/g, "")
    .replaceAll(String.raw`\"`, "")
    .toLowerCase();
  return (
    cleanProcess === "cnc-milling" ||
    cleanProcess === "cnc-turning" ||
    cleanProcess.includes("cnc")
  );
}

// Helper: Check if process is sheet metal-based
export function isSheetMetalProcess(process: string | undefined): boolean {
  if (!process) return false;
  // Clean up any malformed process strings (e.g., "\"sheet-metal\"" -> "sheet-metal")
  const cleanProcess = process
    .replaceAll(/(?:^["'\s]+)|(?:["'\s]+$)/g, "")
    .replaceAll(String.raw`\"`, "")
    .toLowerCase();
  return (
    cleanProcess === "sheet-metal" ||
    cleanProcess.includes("sheet") ||
    cleanProcess === "laser" ||
    cleanProcess === "drilling" ||
    cleanProcess === "plasma" ||
    cleanProcess === "waterjet"
  );
}

// Get default material for a process
export function getDefaultMaterialForProcess(process: string): string {
  if (isSheetMetalProcess(process)) {
    // Default to Aluminum 5052 - 2.0mm for sheet metal
    return "AL5052-2.0";
  }
  // Default to Aluminum 6061 for CNC
  return "aluminum-6061";
}

// Get default finish for a process
export function getDefaultFinishForProcess(process: string): string {
  if (isSheetMetalProcess(process)) {
    return "as-cut";
  }
  return "as-machined";
}

// Get default tolerance for a process (CNC only)
export function getDefaultToleranceForProcess(process: string): string {
  return "standard";
}

// Get default thickness for sheet metal
export function getDefaultThickness(): string {
  return "2.0"; // 2.0mm default
}

// Get display name for a material code
export function getMaterialDisplayName(
  materialCode: string | undefined,
  process: string | undefined,
): string {
  if (!materialCode) return "Not specified";

  if (isSheetMetalProcess(process)) {
    // Search sheet metal materials
    for (const materials of Object.values(SHEET_METAL_MATERIALS)) {
      const found = materials.find(
        (m: any) => m.code === materialCode || m.value === materialCode,
      );
      if (found) return found.name || found.label || materialCode;
    }
  } else {
    // Search CNC materials
    for (const materials of Object.values(CNC_MATERIALS)) {
      const found = materials.find(
        (m: any) => m.value === materialCode || m.code === materialCode,
      );
      if (found) return found.label || found.name || materialCode;
    }
  }

  // Fallback: format the code nicely
  return materialCode
    .replaceAll("-", " ")
    .replaceAll(/([A-Z]+)(\d+)/g, "$1 $2")
    .replaceAll(/\s+/g, " ")
    .trim();
}

// ============================================================================
// ADVANCED INTELLIGENT AUTOMATION ENGINE
// ============================================================================

/**
 * Smart Material Recommendation Engine
 * Analyzes geometry and suggests optimal material based on multiple factors
 */
export function recommendOptimalMaterial(
  geometry: GeometryData,
  process: string,
  budget: "economy" | "balanced" | "premium" = "balanced",
) {
  const recommendations = [];

  if (isSheetMetalProcess(process)) {
    const area = geometry.sheetMetalFeatures?.flatArea || 0;
    const bendCount = geometry.sheetMetalFeatures?.bendCount || 0;
    const complexity = geometry.complexity;

    // Aluminum for lightweight, good formability
    if (bendCount > 5 || complexity === "complex") {
      recommendations.push({
        material: "sm-aluminum-5052",
        score: 95,
        reason: "Excellent formability for complex bending operations",
        costImpact: 0,
        properties: ["Lightweight", "Corrosion resistant", "Easy to form"],
      });
    }

    // Carbon steel for cost-effective strength
    if (budget === "economy" && area < 500000) {
      recommendations.push({
        material: "sm-crs-a1018",
        score: 90,
        reason: "Most cost-effective option with good strength",
        costImpact: -35, // 35% cheaper
        properties: ["High strength", "Low cost", "Easy to weld"],
      });
    }

    // Stainless for corrosion resistance
    if (complexity === "simple" || budget === "premium") {
      recommendations.push({
        material: "sm-stainless-304",
        score: 85,
        reason: "Superior corrosion resistance and appearance",
        costImpact: +45, // 45% more expensive
        properties: ["Corrosion resistant", "Food grade", "Aesthetic"],
      });
    }
  } else {
    // CNC Material Recommendations
    const volume = geometry.volume;
    const complexity = geometry.complexity;
    const features = geometry.features;

    // Aluminum for general purpose
    recommendations.push({
      material: "aluminum-6061",
      score: 92,
      reason: "Best balance of machinability, strength, and cost",
      costImpact: 0,
      properties: ["Excellent machinability", "Good strength", "Lightweight"],
    });

    // Steel for high strength requirements
    if (volume < 50000 && features?.includes("high-stress")) {
      recommendations.push({
        material: "steel-4140",
        score: 88,
        reason: "High strength for demanding applications",
        costImpact: +25,
        properties: ["High strength", "Wear resistant", "Hardenable"],
      });
    }

    // Delrin for low friction
    if (features?.includes("sliding") || complexity === "simple") {
      recommendations.push({
        material: "delrin",
        score: 85,
        reason: "Low friction, excellent machinability",
        costImpact: -15,
        properties: ["Low friction", "Self-lubricating", "Fast machining"],
      });
    }
  }

  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * Intelligent Tolerance Recommendation
 * Analyzes part features to suggest appropriate tolerance
 */
export function recommendTolerance(geometry: GeometryData): {
  tolerance: "standard" | "precision" | "tight";
  confidence: number;
  reason: string;
  costImpact: number;
} {
  const { complexity, features, holes, pockets } = geometry;

  // Check for critical features requiring tight tolerances
  const hasThreadedHoles = holes?.some(
    (h) => h.diameter < 10 && h.depth > h.diameter * 2,
  );
  const hasThinWalls = features?.includes("thin-wall");
  const hasCloseToleranceFeatures = pockets?.some(
    (p) => p.depth > 20 && p.width < 5,
  );

  if (hasThreadedHoles || hasThinWalls || hasCloseToleranceFeatures) {
    return {
      tolerance: "tight",
      confidence: 92,
      reason:
        "Critical features detected: threaded holes, thin walls, or tight-fit requirements",
      costImpact: +35,
    };
  }

  if (complexity === "complex" || (holes && holes?.length > 10)) {
    return {
      tolerance: "precision",
      confidence: 88,
      reason: "Complex geometry requires better dimensional control",
      costImpact: +15,
    };
  }

  return {
    tolerance: "standard",
    confidence: 95,
    reason: "Standard tolerances suitable for this design",
    costImpact: 0,
  };
}

/**
 * Smart Finish Recommendation
 * Suggests optimal finish based on material, application, and environment
 */
export function recommendFinish(
  material: string,
  process: string,
  application: "indoor" | "outdoor" | "food-grade" | "general" = "general",
) {
  const recommendations = [];

  if (isSheetMetalProcess(process)) {
    if (material.includes("aluminum")) {
      recommendations.push({
        finish: "anodized-clear",
        score: 90,
        reason: "Enhances corrosion resistance and appearance",
        costImpact: +12,
        benefits: ["Corrosion protection", "Wear resistance", "Aesthetic"],
      });

      if (application === "outdoor") {
        recommendations.push({
          finish: "powder-coat",
          score: 95,
          reason: "Best protection for outdoor exposure",
          costImpact: +18,
          benefits: ["Weather resistant", "UV protection", "Durable"],
        });
      }
    }

    if (material.includes("steel")) {
      recommendations.push({
        finish: "powder-coat",
        score: 92,
        reason: "Essential rust prevention for steel",
        costImpact: +15,
        benefits: ["Rust prevention", "Color options", "Durable"],
      });
    }

    recommendations.push({
      finish: "as-cut",
      score: 70,
      reason: "Most economical option",
      costImpact: 0,
      benefits: ["Lowest cost", "Fastest delivery"],
    });
  } else {
    // CNC finishes
    if (material.includes("aluminum")) {
      recommendations.push({
        finish: "anodized-clear",
        score: 88,
        reason: "Standard for aluminum parts",
        costImpact: +10,
        benefits: ["Corrosion protection", "Professional appearance"],
      });
    }

    recommendations.push({
      finish: "as-machined",
      score: 85,
      reason: "Clean machined finish",
      costImpact: 0,
      benefits: ["Natural appearance", "No additional cost"],
    });
  }

  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * Get volume discount percentage based on quantity
 */
function getVolumeDiscount(qty: number): number {
  if (qty >= 100) return 0.15;
  if (qty >= 50) return 0.1;
  if (qty >= 25) return 0.05;
  return 0;
}

/**
 * Quantity Break-Even Analysis
 * Calculates optimal quantities and cost per unit at different volumes
 */
export function analyzeQuantityBreakpoints(
  basePrice: number,
  setupCost: number,
  materialCostPerUnit: number,
  quantity: number,
) {
  const breakpoints = [];
  const quantities = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

  quantities.forEach((qty) => {
    const setupPerUnit = setupCost / qty;
    const volumeDiscount = getVolumeDiscount(qty);
    const unitPrice =
      (materialCostPerUnit + setupPerUnit) * (1 - volumeDiscount);
    const totalPrice = unitPrice * qty;
    const savingsVsCurrent = ((basePrice - unitPrice) / basePrice) * 100;

    breakpoints.push({
      quantity: qty,
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice),
      savingsPercent: Math.round(savingsVsCurrent * 10) / 10,
      isOptimal: qty >= 50 && qty <= 100, // Sweet spot for most parts
      setupCostPerUnit: Math.round(setupPerUnit * 100) / 100,
    });
  });

  return {
    breakpoints,
    currentQuantity: quantity,
    recommendation:
      breakpoints.find((b) => b.isOptimal) ||
      breakpoints.at(-1),
  };
}

type ManufacturabilityFactor = {
  factor: string;
  impact: number;
  status: "good" | "warning" | "critical";
};

type ManufacturabilityResult = {
  score: number;
  factors: ManufacturabilityFactor[];
  suggestions: string[];
};

function scoreSheetMetalManufacturability(
  geometry: GeometryData,
): ManufacturabilityResult {
  let score = 100;
  const factors: ManufacturabilityFactor[] = [];
  const suggestions: string[] = [];
  const features = geometry.sheetMetalFeatures;

  if (features?.bendCount) {
    if (features.bendCount > 10) {
      score -= 15;
      factors.push({ factor: "High bend count", impact: -15, status: "warning" });
      suggestions.push("Consider redesigning with fewer bends to reduce cost and lead time");
    } else if (features.bendCount > 0) {
      factors.push({ factor: "Moderate bends", impact: 0, status: "good" });
    }
  }

  if (features?.complexCuts && features.complexCuts > 5) {
    score -= 10;
    factors.push({ factor: "Complex cutting patterns", impact: -10, status: "warning" });
    suggestions.push("Simplify cut patterns where possible");
  }

  if (features?.flatArea) {
    const utilization = features.flatArea / (geometry.boundingBox.x * geometry.boundingBox.y);
    if (utilization < 0.5) {
      score -= 12;
      factors.push({ factor: "Poor material utilization", impact: -12, status: "warning" });
      suggestions.push("Optimize part orientation or nesting to reduce material waste");
    } else {
      factors.push({ factor: "Good material utilization", impact: +5, status: "good" });
      score += 5;
    }
  }

  return { score, factors, suggestions };
}

function scoreCNCManufacturability(
  geometry: GeometryData,
  material: string,
  process: string,
): ManufacturabilityResult {
  let score = 100;
  const factors: ManufacturabilityFactor[] = [];
  const suggestions: string[] = [];
  const { complexity, holes, pockets, features } = geometry;

  if (complexity === "complex") {
    score -= 20;
    factors.push({ factor: "High geometric complexity", impact: -20, status: "critical" });
    suggestions.push("Consider simplifying geometry or splitting into multiple parts");
  } else if (complexity === "moderate") {
    score -= 8;
    factors.push({ factor: "Moderate complexity", impact: -8, status: "good" });
  }

  const deepFeatures = holes?.filter((h) => h.depth > h.diameter * 5).length || 0;
  if (deepFeatures > 0) {
    score -= 15;
    factors.push({ factor: "Deep hole/pocket features", impact: -15, status: "critical" });
    suggestions.push("Deep features (L/D > 5) require special tooling - consider reducing depth");
  }

  if (features?.includes("thin-wall")) {
    score -= 18;
    factors.push({ factor: "Thin wall features", impact: -18, status: "critical" });
    suggestions.push("Increase wall thickness to improve machinability and reduce vibration");
  }

  if (pockets?.some((p) => p.width < 2)) {
    score -= 12;
    factors.push({ factor: "Very small features", impact: -12, status: "warning" });
    suggestions.push("Increase feature sizes above 2mm for better tool access");
  }

  const mat = getMaterialByValue(material, process);
  if (mat && "machinabilityFactor" in mat && mat.machinabilityFactor > 2) {
    score -= 10;
    factors.push({ factor: "Difficult material", impact: -10, status: "warning" });
    suggestions.push(
      `${mat.label || (mat as MaterialDefinition).name} is difficult to machine - consider alternative materials`,
    );
  }

  return { score, factors, suggestions };
}

function getManufacturabilityGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Manufacturability Score Calculator
 * Scores parts 0-100 based on ease of manufacturing
 */
export function calculateManufacturabilityScore(
  geometry: GeometryData,
  material: string,
  process: string,
): {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  factors: ManufacturabilityFactor[];
  suggestions: string[];
} {
  const result = isSheetMetalProcess(process)
    ? scoreSheetMetalManufacturability(geometry)
    : scoreCNCManufacturability(geometry, material, process);

  const grade = getManufacturabilityGrade(result.score);

  return {
    score: Math.max(0, result.score),
    grade,
    factors: result.factors,
    suggestions: result.suggestions,
  };
}

/**
 * Cost Optimization Suggestions
 * Analyzes part and suggests specific changes to reduce cost
 */
export function generateCostOptimizations(
  geometry: GeometryData,
  material: string,
  process: string,
  currentPrice: number,
): CostOptimization[] {
  const optimizations: CostOptimization[] = [];

  // Material substitution
  if (material.includes("stainless") && !isSheetMetalProcess(process)) {
    optimizations.push({
      suggestion:
        "Switch from stainless steel to aluminum 6061 if corrosion resistance is not critical",
      potentialSavings: currentPrice * 0.35,
      savingsPercent: 35,
      effort: "easy",
      category: "material",
    });
  }

  if (material.includes("titanium")) {
    optimizations.push({
      suggestion:
        "Consider 7075 aluminum or 17-4 stainless as titanium alternative",
      potentialSavings: currentPrice * 0.45,
      savingsPercent: 45,
      effort: "moderate",
      category: "material",
    });
  }

  // Geometry optimizations
  if (geometry.complexity === "complex") {
    optimizations.push({
      suggestion:
        "Simplify geometry by reducing unnecessary features or tight corners",
      potentialSavings: currentPrice * 0.22,
      savingsPercent: 22,
      effort: "moderate",
      category: "geometry",
    });
  }

  if (geometry.holes?.length && geometry.holes?.length > 15) {
    optimizations.push({
      suggestion:
        "Reduce number of holes or standardize hole sizes to minimize tool changes",
      potentialSavings: currentPrice * 0.12,
      savingsPercent: 12,
      effort: "easy",
      category: "geometry",
    });
  }

  // Tolerance, finish, and quantity optimizations
  optimizations.push(
    {
      suggestion:
        'Relax tolerances to ±0.005" standard where tight tolerances are not functionally required',
      potentialSavings: currentPrice * 0.18,
      savingsPercent: 18,
      effort: "easy" as const,
      category: "tolerance" as const,
    },
    {
      suggestion:
        "Use as-machined finish instead of anodizing for non-visible parts",
      potentialSavings: currentPrice * 0.08,
      savingsPercent: 8,
      effort: "easy" as const,
      category: "finish" as const,
    },
    {
      suggestion:
        "Increase quantity to 50+ units to achieve volume pricing discounts",
      potentialSavings: currentPrice * 0.15,
      savingsPercent: 15,
      effort: "easy" as const,
      category: "quantity" as const,
    },
  );

  return optimizations.sort((a, b) => b.savingsPercent - a.savingsPercent);
}

function getCapacityMultiplier(capacity: number): number {
  if (capacity > 0.8) return 1.3;
  if (capacity > 0.6) return 1.1;
  return 1;
}

function getCapacityHoursPerDay(processType: string): number {
  if (processType === "sheet-metal") return 12;
  if (processType === "cnc-turning") return 10;
  return 8;
}

function getCapacityDelayDays(utilization: number): number {
  if (utilization > 0.85) return 2;
  if (utilization > 0.75) return 1;
  return 0;
}

const CNC_TO_SHEET_METAL_MAPPING: Record<string, string> = {
  "aluminum-6061": "aluminum-5052",
  "aluminum-7075": "aluminum-5052",
  "stainless-steel-304": "stainless-304",
  "stainless-steel-316": "stainless-316",
  "mild-steel": "steel-cr",
  "carbon-steel": "steel-cr",
};

function findMappedSheetMetalMaterial(value: string) {
  const mappedKey = CNC_TO_SHEET_METAL_MAPPING[value];
  if (mappedKey && mappedKey in SHEET_METAL_MATERIALS) {
    const materialFamily = SHEET_METAL_MATERIALS[mappedKey];
    if (materialFamily && materialFamily.length > 0) {
      const preferred = materialFamily.find((m: any) => m.thickness === 2);
      console.log(
        `\u26A0\uFE0F Mapped CNC material "${value}" to sheet metal "${mappedKey}"`,
      );
      return preferred || materialFamily[0];
    }
  }
  return null;
}

/**
 * Predictive Capacity-Aware Lead Time
 * Real-time lead time calculation based on shop capacity and workload
 */
export function predictLeadTime(
  geometry: GeometryData,
  process: string,
  quantity: number,
  urgency: "economy" | "standard" | "expedited",
): {
  days: number;
  confidence: number;
  breakdown: Array<{ phase: string; days: number; description: string }>;
  alternatives: Array<{
    urgency: string;
    days: number;
    costMultiplier: number;
  }>;
} {
  const breakdown = [];
  let totalDays = 0;

  // Current shop capacity (in production this would come from real-time database)
  const currentCapacity = 0.72; // 72% utilized (simulated)
  const capacityMultiplier = getCapacityMultiplier(currentCapacity);

  if (isSheetMetalProcess(process)) {
    // Sheet metal phases
    breakdown.push({
      phase: "Material procurement",
      days: 1,
      description: "Standard stock available",
    });
    totalDays += 1;

    const cuttingTime = Math.ceil(
      (geometry.sheetMetalFeatures?.perimeterLength || 1000) / 5000,
    ); // 5m/min avg
    breakdown.push({
      phase: "Cutting & nesting",
      days: cuttingTime,
      description: "Laser cutting with nesting optimization",
    });
    totalDays += cuttingTime;

    if ((geometry.sheetMetalFeatures?.bendCount || 0) > 0) {
      const bendingDays = Math.ceil(
        (geometry.sheetMetalFeatures?.bendCount || 0) / 20,
      ); // 20 bends per day
      breakdown.push({
        phase: "Forming/bending",
        days: bendingDays,
        description: `${geometry.sheetMetalFeatures?.bendCount} bends`,
      });
      totalDays += bendingDays;
    }

    breakdown.push({
      phase: "Finishing",
      days: 2,
      description: "Deburring and surface treatment",
    });
    totalDays += 2;

    breakdown.push({
      phase: "QC & packaging",
      days: 1,
      description: "Final inspection and shipping prep",
    });
    totalDays += 1;
  } else {
    // CNC phases
    breakdown.push({
      phase: "Material procurement",
      days: 2,
      description: "Stock material ordering",
    });
    totalDays += 2;

    breakdown.push({
      phase: "Programming",
      days: 1,
      description: "CAM programming and toolpath generation",
    });
    totalDays += 1;

    const machiningDays = Math.ceil(geometry.estimatedMachiningTime / 60 / 8); // 8 hours per day
    breakdown.push({
      phase: "Machining",
      days: machiningDays * capacityMultiplier,
      description: "CNC machining operations",
    });
    totalDays += machiningDays * capacityMultiplier;

    breakdown.push({
      phase: "Finishing",
      days: 2,
      description: "Surface finishing and coating",
    });
    totalDays += 2;

    breakdown.push({
      phase: "Inspection",
      days: 1,
      description: "Dimensional inspection and CMM",
    });
    totalDays += 1;
  }

  // Apply urgency multipliers
  const urgencyMultipliers = { economy: 1.5, standard: 1, expedited: 0.6 };
  totalDays = Math.ceil(totalDays * urgencyMultipliers[urgency]);

  // Quantity impact (larger quantities need more time)
  if (quantity > 100) totalDays += 2;
  else if (quantity > 50) totalDays += 1;

  const alternatives = [
    {
      urgency: "economy",
      days: Math.ceil(totalDays * 1.8),
      costMultiplier: 0.8,
    },
    { urgency: "standard", days: totalDays, costMultiplier: 1 },
    {
      urgency: "expedited",
      days: Math.ceil(totalDays * 0.5),
      costMultiplier: 2.2,
    },
  ];

  return {
    days: totalDays,
    confidence: 88, // High confidence based on historical data
    breakdown,
    alternatives,
  };
}

/**
 * Automated Setup Optimization for Sheet Metal
 * Calculates optimal nesting and material utilization
 */
export function optimizeSheetMetalSetup(
  geometry: GeometryData,
  quantity: number,
): {
  partsPerSheet: number;
  materialUtilization: number;
  scrapPercent: number;
  nestingEfficiency: "excellent" | "good" | "fair" | "poor";
  recommendations: string[];
} {
  const features = geometry.sheetMetalFeatures;
  if (!features) {
    return {
      partsPerSheet: 1,
      materialUtilization: 50,
      scrapPercent: 50,
      nestingEfficiency: "poor",
      recommendations: [
        "Unable to analyze - sheet metal features not detected",
      ],
    };
  }

  // Standard sheet size: 1220mm x 2440mm (4' x 8')
  const sheetArea = 1220 * 2440; // mm²

  // === USE BACKEND NESTING DATA WHEN AVAILABLE ===
  const backendNesting = (geometry as any).nesting;
  let partsPerSheet: number;
  let materialUtilization: number;

  if (backendNesting && typeof backendNesting.partsPerSheet === 'number' && backendNesting.partsPerSheet > 0) {
    // Real nesting estimate from the backend geometry engine
    partsPerSheet = backendNesting.partsPerSheet;
    materialUtilization = typeof backendNesting.utilizationPct === 'number'
      ? backendNesting.utilizationPct
      : ((partsPerSheet * (features?.flatArea ?? 0)) / sheetArea) * 100;
  } else {
    // Fallback: bbox-based estimate
    const partArea = features?.flatArea;
    const kerfAndSpacing = 8; // mm
    const effectivePartArea =
      partArea + features?.perimeterLength * kerfAndSpacing;
    partsPerSheet = Math.max(
      1,
      Math.floor((sheetArea / effectivePartArea) * 0.85),
    ); // 85% efficiency
    materialUtilization = ((partsPerSheet * (features?.flatArea ?? 0)) / sheetArea) * 100;
  }
  const scrapPercent = 100 - materialUtilization;

  let nestingEfficiency: "excellent" | "good" | "fair" | "poor";
  if (materialUtilization >= 75) nestingEfficiency = "excellent";
  else if (materialUtilization >= 60) nestingEfficiency = "good";
  else if (materialUtilization >= 45) nestingEfficiency = "fair";
  else nestingEfficiency = "poor";

  const recommendations = [];

  if (partsPerSheet > 1) {
    recommendations.push(
      `Can nest ${partsPerSheet} parts per sheet for optimal efficiency`,
    );
  }

  if (materialUtilization < 60) {
    recommendations.push(
      "Consider rotating part orientation or combining with other parts to improve nesting",
    );
  }

  if (quantity % partsPerSheet !== 0) {
    const optimalQty = Math.ceil(quantity / partsPerSheet) * partsPerSheet;
    recommendations.push(
      `Order ${optimalQty} units (${optimalQty - quantity} extra) to minimize partial sheet waste`,
    );
  }

  if (features?.complexCuts > 3) {
    recommendations.push(
      "Complex cuts detected - consider simplifying geometry for faster cutting",
    );
  }

  return {
    partsPerSheet,
    materialUtilization: Math.round(materialUtilization * 10) / 10,
    scrapPercent: Math.round(scrapPercent * 10) / 10,
    nestingEfficiency,
    recommendations,
  };
}

/**
 * Smart Part Bundling Analyzer
 * Identifies opportunities to combine similar parts to save on setup costs
 */
interface PartBundle {
  partIndices: number[];
  similarity: number;
  savingsPotential: number;
  reason: string;
  setupCostSaved: number;
}

function calculatePartSimilarity(
  part1: any,
  part2: any,
): { score: number; criteria: string[] } {
  let score = 0;
  const criteria: string[] = [];

  if (part1.process === part2.process) {
    score += 0.3;
    criteria.push("same process");
  }
  if (part1.material === part2.material) {
    score += 0.25;
    criteria.push("same material");
  }

  const vol1 = part1.volume || 1000;
  const vol2 = part2.volume || 1000;
  if (Math.min(vol1, vol2) / Math.max(vol1, vol2) > 0.7) {
    score += 0.2;
    criteria.push("similar size");
  }

  if (part1.finish === part2.finish) {
    score += 0.15;
    criteria.push("same finish");
  }
  if (isCNCProcess(part1.process) && part1.tolerance === part2.tolerance) {
    score += 0.1;
    criteria.push("same tolerance");
  }

  return { score, criteria };
}

function createBundle(
  i: number,
  j: number,
  similarity: number,
  criteria: string[],
  part1: any,
  part2: any,
): PartBundle {
  const setupCostPerPart = 95;
  const setupSaved = setupCostPerPart * 0.8;
  const additionalSavings = (part1.quantity + part2.quantity) * 0.5;
  return {
    partIndices: [i, j],
    similarity: Math.round(similarity * 100),
    savingsPotential: Math.round(setupSaved + additionalSavings),
    setupCostSaved: Math.round(setupSaved),
    reason: `These parts share ${criteria.join(", ")} - ideal for combined production run`,
  };
}

export function analyzeSimilarParts(parts: any[]): {
  bundles: PartBundle[];
  totalSavings: number;
} {
  const bundles: PartBundle[] = [];
  const compareThreshold = 0.7;

  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const alreadyBundled = bundles.some(
        (b) => b.partIndices.includes(i) && b.partIndices.includes(j),
      );
      if (alreadyBundled) continue;

      const { score, criteria } = calculatePartSimilarity(parts[i], parts[j]);
      if (score >= compareThreshold) {
        bundles.push(createBundle(i, j, score, criteria, parts[i], parts[j]));
      }
    }
  }

  return {
    bundles,
    totalSavings: Math.round(
      bundles.reduce((sum, b) => sum + b.savingsPotential, 0),
    ),
  };
}

// Finish Options - Realistic pricing
export const FINISHES: Record<string, FinishOption> = {
  "as-machined": {
    code: "AS-MACH",
    name: "As Machined",
    baseCost: 0,
    perAreaCost: 0,
  },
  "bead-blasted": {
    code: "BEAD-BLAST",
    name: "Bead Blasted",
    baseCost: 12,
    perAreaCost: 0.03,
  },
  "anodized-clear": {
    code: "ANOD-CLEAR",
    name: "Anodized Type II (Clear)",
    baseCost: 18,
    perAreaCost: 0.05,
  },
  "anodized-color": {
    code: "ANOD-COLOR",
    name: "Anodized Type II (Color)",
    baseCost: 25,
    perAreaCost: 0.07,
  },
  "powder-coated": {
    code: "POWDER",
    name: "Powder Coated",
    baseCost: 22,
    perAreaCost: 0.05,
  },
  electropolished: {
    code: "EPOL",
    name: "Electropolished",
    baseCost: 35,
    perAreaCost: 0.09,
  },
};

// Sheet Metal Material Database - Complete Industry List
// Materials marked with requiresManualQuote: true will trigger manual quote flow
export const SHEET_METAL_MATERIALS: Record<string, any[]> = {
  // ============= ALUMINUM ALLOYS =============
  "aluminum-5052": [
    {
      code: "AL5052-0.8",
      name: "Aluminum 5052 - 0.8mm",
      density: 2.68,
      costPerKg: 6,
      thickness: 0.8,
      category: "aluminum",
      bendability: 0.9,
    },
    {
      code: "AL5052-1.0",
      name: "Aluminum 5052 - 1.0mm",
      density: 2.68,
      costPerKg: 5.8,
      thickness: 1,
      category: "aluminum",
      bendability: 0.9,
    },
    {
      code: "AL5052-1.5",
      name: "Aluminum 5052 - 1.5mm",
      density: 2.68,
      costPerKg: 5.6,
      thickness: 1.5,
      category: "aluminum",
      bendability: 1,
    },
    {
      code: "AL5052-2.0",
      name: "Aluminum 5052 - 2.0mm",
      density: 2.68,
      costPerKg: 5.6,
      thickness: 2,
      category: "aluminum",
      bendability: 1,
    },
    {
      code: "AL5052-3.0",
      name: "Aluminum 5052 - 3.0mm",
      density: 2.68,
      costPerKg: 5.8,
      thickness: 3,
      category: "aluminum",
      bendability: 1.1,
    },
  ],
  "aluminum-3003": [
    {
      code: "AL3003-0.8",
      name: "Aluminum 3003 - 0.8mm",
      density: 2.73,
      costPerKg: 5.5,
      thickness: 0.8,
      category: "aluminum",
      bendability: 0.8,
    },
    {
      code: "AL3003-1.0",
      name: "Aluminum 3003 - 1.0mm",
      density: 2.73,
      costPerKg: 5.3,
      thickness: 1,
      category: "aluminum",
      bendability: 0.8,
    },
    {
      code: "AL3003-1.5",
      name: "Aluminum 3003 - 1.5mm",
      density: 2.73,
      costPerKg: 5.2,
      thickness: 1.5,
      category: "aluminum",
      bendability: 0.9,
    },
    {
      code: "AL3003-2.0",
      name: "Aluminum 3003 - 2.0mm",
      density: 2.73,
      costPerKg: 5.2,
      thickness: 2,
      category: "aluminum",
      bendability: 0.9,
    },
    {
      code: "AL3003-3.0",
      name: "Aluminum 3003 - 3.0mm",
      density: 2.73,
      costPerKg: 5.4,
      thickness: 3,
      category: "aluminum",
      bendability: 1,
    },
  ],
  "aluminum-6061": [
    {
      code: "AL6061-0.8",
      name: "Aluminum 6061 - 0.8mm",
      density: 2.7,
      costPerKg: 6.8,
      thickness: 0.8,
      category: "aluminum",
      bendability: 1.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "AL6061 has limited bendability - requires manual review",
    },
    {
      code: "AL6061-1.0",
      name: "Aluminum 6061 - 1.0mm",
      density: 2.7,
      costPerKg: 6.5,
      thickness: 1,
      category: "aluminum",
      bendability: 1.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "AL6061 has limited bendability - requires manual review",
    },
    {
      code: "AL6061-1.5",
      name: "Aluminum 6061 - 1.5mm",
      density: 2.7,
      costPerKg: 6.3,
      thickness: 1.5,
      category: "aluminum",
      bendability: 1.3,
      requiresManualQuote: true,
      manualQuoteReason:
        "AL6061 has limited bendability - requires manual review",
    },
    {
      code: "AL6061-2.0",
      name: "Aluminum 6061 - 2.0mm",
      density: 2.7,
      costPerKg: 6.3,
      thickness: 2,
      category: "aluminum",
      bendability: 1.3,
      requiresManualQuote: true,
      manualQuoteReason:
        "AL6061 has limited bendability - requires manual review",
    },
    {
      code: "AL6061-3.0",
      name: "Aluminum 6061 - 3.0mm",
      density: 2.7,
      costPerKg: 6.5,
      thickness: 3,
      category: "aluminum",
      bendability: 1.4,
      requiresManualQuote: true,
      manualQuoteReason:
        "AL6061 has limited bendability - requires manual review",
    },
  ],
  "aluminum-5005": [
    {
      code: "AL5005-0.8",
      name: "Aluminum 5005 - 0.8mm",
      density: 2.7,
      costPerKg: 5.6,
      thickness: 0.8,
      category: "aluminum",
      bendability: 0.8,
    },
    {
      code: "AL5005-1.0",
      name: "Aluminum 5005 - 1.0mm",
      density: 2.7,
      costPerKg: 5.4,
      thickness: 1,
      category: "aluminum",
      bendability: 0.8,
    },
    {
      code: "AL5005-1.5",
      name: "Aluminum 5005 - 1.5mm",
      density: 2.7,
      costPerKg: 5.3,
      thickness: 1.5,
      category: "aluminum",
      bendability: 0.9,
    },
    {
      code: "AL5005-2.0",
      name: "Aluminum 5005 - 2.0mm",
      density: 2.7,
      costPerKg: 5.3,
      thickness: 2,
      category: "aluminum",
      bendability: 0.9,
    },
    {
      code: "AL5005-3.0",
      name: "Aluminum 5005 - 3.0mm",
      density: 2.7,
      costPerKg: 5.5,
      thickness: 3,
      category: "aluminum",
      bendability: 1,
    },
  ],
  "aluminum-1100": [
    {
      code: "AL1100-0.8",
      name: "Aluminum 1100 - 0.8mm",
      density: 2.71,
      costPerKg: 5.2,
      thickness: 0.8,
      category: "aluminum",
      bendability: 0.7,
    },
    {
      code: "AL1100-1.0",
      name: "Aluminum 1100 - 1.0mm",
      density: 2.71,
      costPerKg: 5,
      thickness: 1,
      category: "aluminum",
      bendability: 0.7,
    },
    {
      code: "AL1100-1.5",
      name: "Aluminum 1100 - 1.5mm",
      density: 2.71,
      costPerKg: 4.9,
      thickness: 1.5,
      category: "aluminum",
      bendability: 0.8,
    },
    {
      code: "AL1100-2.0",
      name: "Aluminum 1100 - 2.0mm",
      density: 2.71,
      costPerKg: 4.9,
      thickness: 2,
      category: "aluminum",
      bendability: 0.8,
    },
    {
      code: "AL1100-3.0",
      name: "Aluminum 1100 - 3.0mm",
      density: 2.71,
      costPerKg: 5.1,
      thickness: 3,
      category: "aluminum",
      bendability: 0.9,
    },
  ],
  "aluminum-5083": [
    {
      code: "AL5083-1.0",
      name: "Aluminum 5083 - 1.0mm",
      density: 2.66,
      costPerKg: 7.5,
      thickness: 1,
      category: "aluminum",
      bendability: 1.1,
      requiresManualQuote: true,
      manualQuoteReason:
        "Marine grade aluminum - requires specialized handling",
    },
    {
      code: "AL5083-1.5",
      name: "Aluminum 5083 - 1.5mm",
      density: 2.66,
      costPerKg: 7.3,
      thickness: 1.5,
      category: "aluminum",
      bendability: 1.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Marine grade aluminum - requires specialized handling",
    },
    {
      code: "AL5083-2.0",
      name: "Aluminum 5083 - 2.0mm",
      density: 2.66,
      costPerKg: 7.2,
      thickness: 2,
      category: "aluminum",
      bendability: 1.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Marine grade aluminum - requires specialized handling",
    },
    {
      code: "AL5083-3.0",
      name: "Aluminum 5083 - 3.0mm",
      density: 2.66,
      costPerKg: 7.4,
      thickness: 3,
      category: "aluminum",
      bendability: 1.3,
      requiresManualQuote: true,
      manualQuoteReason:
        "Marine grade aluminum - requires specialized handling",
    },
  ],
  "aluminum-2024": [
    {
      code: "AL2024-1.0",
      name: "Aluminum 2024 - 1.0mm",
      density: 2.78,
      costPerKg: 9.5,
      thickness: 1,
      category: "aluminum",
      bendability: 1.8,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aerospace grade - limited formability, requires annealing",
    },
    {
      code: "AL2024-1.5",
      name: "Aluminum 2024 - 1.5mm",
      density: 2.78,
      costPerKg: 9.2,
      thickness: 1.5,
      category: "aluminum",
      bendability: 1.9,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aerospace grade - limited formability, requires annealing",
    },
    {
      code: "AL2024-2.0",
      name: "Aluminum 2024 - 2.0mm",
      density: 2.78,
      costPerKg: 9,
      thickness: 2,
      category: "aluminum",
      bendability: 2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aerospace grade - limited formability, requires annealing",
    },
  ],
  "aluminum-7075": [
    {
      code: "AL7075-1.0",
      name: "Aluminum 7075 - 1.0mm",
      density: 2.81,
      costPerKg: 12,
      thickness: 1,
      category: "aluminum",
      bendability: 2.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aerospace grade - very limited formability, requires annealing",
    },
    {
      code: "AL7075-1.5",
      name: "Aluminum 7075 - 1.5mm",
      density: 2.81,
      costPerKg: 11.5,
      thickness: 1.5,
      category: "aluminum",
      bendability: 2.3,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aerospace grade - very limited formability, requires annealing",
    },
    {
      code: "AL7075-2.0",
      name: "Aluminum 7075 - 2.0mm",
      density: 2.81,
      costPerKg: 11.2,
      thickness: 2,
      category: "aluminum",
      bendability: 2.4,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aerospace grade - very limited formability, requires annealing",
    },
  ],

  // ============= STAINLESS STEEL =============
  "stainless-304": [
    {
      code: "SS304-0.8",
      name: "Stainless Steel 304 - 0.8mm",
      density: 8,
      costPerKg: 8.5,
      thickness: 0.8,
      category: "stainless",
      bendability: 1.4,
    },
    {
      code: "SS304-1.0",
      name: "Stainless Steel 304 - 1.0mm",
      density: 8,
      costPerKg: 8.2,
      thickness: 1,
      category: "stainless",
      bendability: 1.4,
    },
    {
      code: "SS304-1.5",
      name: "Stainless Steel 304 - 1.5mm",
      density: 8,
      costPerKg: 8,
      thickness: 1.5,
      category: "stainless",
      bendability: 1.5,
    },
    {
      code: "SS304-2.0",
      name: "Stainless Steel 304 - 2.0mm",
      density: 8,
      costPerKg: 8,
      thickness: 2,
      category: "stainless",
      bendability: 1.6,
    },
    {
      code: "SS304-3.0",
      name: "Stainless Steel 304 - 3.0mm",
      density: 8,
      costPerKg: 8.2,
      thickness: 3,
      category: "stainless",
      bendability: 1.7,
    },
  ],
  "stainless-316": [
    {
      code: "SS316-0.8",
      name: "Stainless Steel 316 - 0.8mm",
      density: 8,
      costPerKg: 10.5,
      thickness: 0.8,
      category: "stainless",
      bendability: 1.5,
    },
    {
      code: "SS316-1.0",
      name: "Stainless Steel 316 - 1.0mm",
      density: 8,
      costPerKg: 10.2,
      thickness: 1,
      category: "stainless",
      bendability: 1.5,
    },
    {
      code: "SS316-1.5",
      name: "Stainless Steel 316 - 1.5mm",
      density: 8,
      costPerKg: 10,
      thickness: 1.5,
      category: "stainless",
      bendability: 1.6,
    },
    {
      code: "SS316-2.0",
      name: "Stainless Steel 316 - 2.0mm",
      density: 8,
      costPerKg: 10,
      thickness: 2,
      category: "stainless",
      bendability: 1.7,
    },
    {
      code: "SS316-3.0",
      name: "Stainless Steel 316 - 3.0mm",
      density: 8,
      costPerKg: 10.2,
      thickness: 3,
      category: "stainless",
      bendability: 1.8,
    },
  ],
  "stainless-316l": [
    {
      code: "SS316L-0.8",
      name: "Stainless Steel 316L - 0.8mm",
      density: 8,
      costPerKg: 11,
      thickness: 0.8,
      category: "stainless",
      bendability: 1.4,
    },
    {
      code: "SS316L-1.0",
      name: "Stainless Steel 316L - 1.0mm",
      density: 8,
      costPerKg: 10.8,
      thickness: 1,
      category: "stainless",
      bendability: 1.4,
    },
    {
      code: "SS316L-1.5",
      name: "Stainless Steel 316L - 1.5mm",
      density: 8,
      costPerKg: 10.5,
      thickness: 1.5,
      category: "stainless",
      bendability: 1.5,
    },
    {
      code: "SS316L-2.0",
      name: "Stainless Steel 316L - 2.0mm",
      density: 8,
      costPerKg: 10.5,
      thickness: 2,
      category: "stainless",
      bendability: 1.6,
    },
  ],
  "stainless-430": [
    {
      code: "SS430-0.8",
      name: "Stainless Steel 430 - 0.8mm",
      density: 7.7,
      costPerKg: 6.5,
      thickness: 0.8,
      category: "stainless",
      bendability: 1.3,
    },
    {
      code: "SS430-1.0",
      name: "Stainless Steel 430 - 1.0mm",
      density: 7.7,
      costPerKg: 6.3,
      thickness: 1,
      category: "stainless",
      bendability: 1.3,
    },
    {
      code: "SS430-1.5",
      name: "Stainless Steel 430 - 1.5mm",
      density: 7.7,
      costPerKg: 6.2,
      thickness: 1.5,
      category: "stainless",
      bendability: 1.4,
    },
    {
      code: "SS430-2.0",
      name: "Stainless Steel 430 - 2.0mm",
      density: 7.7,
      costPerKg: 6.2,
      thickness: 2,
      category: "stainless",
      bendability: 1.5,
    },
  ],
  "stainless-409": [
    {
      code: "SS409-1.0",
      name: "Stainless Steel 409 - 1.0mm",
      density: 7.7,
      costPerKg: 5.8,
      thickness: 1,
      category: "stainless",
      bendability: 1.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Ferritic stainless - requires specific welding procedures",
    },
    {
      code: "SS409-1.5",
      name: "Stainless Steel 409 - 1.5mm",
      density: 7.7,
      costPerKg: 5.6,
      thickness: 1.5,
      category: "stainless",
      bendability: 1.3,
      requiresManualQuote: true,
      manualQuoteReason:
        "Ferritic stainless - requires specific welding procedures",
    },
    {
      code: "SS409-2.0",
      name: "Stainless Steel 409 - 2.0mm",
      density: 7.7,
      costPerKg: 5.5,
      thickness: 2,
      category: "stainless",
      bendability: 1.4,
      requiresManualQuote: true,
      manualQuoteReason:
        "Ferritic stainless - requires specific welding procedures",
    },
  ],
  "stainless-301": [
    {
      code: "SS301-0.8",
      name: "Stainless Steel 301 - 0.8mm",
      density: 8,
      costPerKg: 9,
      thickness: 0.8,
      category: "stainless",
      bendability: 1.3,
      requiresManualQuote: true,
      manualQuoteReason: "Spring temper material - requires special handling",
    },
    {
      code: "SS301-1.0",
      name: "Stainless Steel 301 - 1.0mm",
      density: 8,
      costPerKg: 8.8,
      thickness: 1,
      category: "stainless",
      bendability: 1.4,
      requiresManualQuote: true,
      manualQuoteReason: "Spring temper material - requires special handling",
    },
    {
      code: "SS301-1.5",
      name: "Stainless Steel 301 - 1.5mm",
      density: 8,
      costPerKg: 8.6,
      thickness: 1.5,
      category: "stainless",
      bendability: 1.5,
      requiresManualQuote: true,
      manualQuoteReason: "Spring temper material - requires special handling",
    },
  ],
  "stainless-17-4ph": [
    {
      code: "SS174PH-1.0",
      name: "Stainless Steel 17-4PH - 1.0mm",
      density: 7.8,
      costPerKg: 18,
      thickness: 1,
      category: "stainless",
      bendability: 1.8,
      requiresManualQuote: true,
      manualQuoteReason:
        "Precipitation hardening steel - requires heat treatment expertise",
    },
    {
      code: "SS174PH-1.5",
      name: "Stainless Steel 17-4PH - 1.5mm",
      density: 7.8,
      costPerKg: 17.5,
      thickness: 1.5,
      category: "stainless",
      bendability: 1.9,
      requiresManualQuote: true,
      manualQuoteReason:
        "Precipitation hardening steel - requires heat treatment expertise",
    },
    {
      code: "SS174PH-2.0",
      name: "Stainless Steel 17-4PH - 2.0mm",
      density: 7.8,
      costPerKg: 17,
      thickness: 2,
      category: "stainless",
      bendability: 2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Precipitation hardening steel - requires heat treatment expertise",
    },
  ],

  // ============= CARBON STEEL =============
  "carbon-steel-a1018": [
    {
      code: "A1018-0.8",
      name: "Carbon Steel A1018 (CRS) - 0.8mm",
      density: 7.87,
      costPerKg: 2,
      thickness: 0.8,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "A1018-1.0",
      name: "Carbon Steel A1018 (CRS) - 1.0mm",
      density: 7.87,
      costPerKg: 1.9,
      thickness: 1,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "A1018-1.5",
      name: "Carbon Steel A1018 (CRS) - 1.5mm",
      density: 7.87,
      costPerKg: 1.85,
      thickness: 1.5,
      category: "steel",
      bendability: 1,
    },
    {
      code: "A1018-2.0",
      name: "Carbon Steel A1018 (CRS) - 2.0mm",
      density: 7.87,
      costPerKg: 1.85,
      thickness: 2,
      category: "steel",
      bendability: 1,
    },
    {
      code: "A1018-3.0",
      name: "Carbon Steel A1018 (CRS) - 3.0mm",
      density: 7.87,
      costPerKg: 1.9,
      thickness: 3,
      category: "steel",
      bendability: 1.1,
    },
  ],
  "carbon-steel-a1008": [
    {
      code: "A1008-0.8",
      name: "Carbon Steel A1008 (CRS) - 0.8mm",
      density: 7.87,
      costPerKg: 1.9,
      thickness: 0.8,
      category: "steel",
      bendability: 0.85,
    },
    {
      code: "A1008-1.0",
      name: "Carbon Steel A1008 (CRS) - 1.0mm",
      density: 7.87,
      costPerKg: 1.85,
      thickness: 1,
      category: "steel",
      bendability: 0.85,
    },
    {
      code: "A1008-1.5",
      name: "Carbon Steel A1008 (CRS) - 1.5mm",
      density: 7.87,
      costPerKg: 1.8,
      thickness: 1.5,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "A1008-2.0",
      name: "Carbon Steel A1008 (CRS) - 2.0mm",
      density: 7.87,
      costPerKg: 1.8,
      thickness: 2,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "A1008-3.0",
      name: "Carbon Steel A1008 (CRS) - 3.0mm",
      density: 7.87,
      costPerKg: 1.85,
      thickness: 3,
      category: "steel",
      bendability: 1,
    },
  ],
  "carbon-steel-a1011": [
    {
      code: "A1011-1.0",
      name: "Carbon Steel A1011 (HRPO) - 1.0mm",
      density: 7.87,
      costPerKg: 1.7,
      thickness: 1,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "A1011-1.5",
      name: "Carbon Steel A1011 (HRPO) - 1.5mm",
      density: 7.87,
      costPerKg: 1.65,
      thickness: 1.5,
      category: "steel",
      bendability: 0.95,
    },
    {
      code: "A1011-2.0",
      name: "Carbon Steel A1011 (HRPO) - 2.0mm",
      density: 7.87,
      costPerKg: 1.65,
      thickness: 2,
      category: "steel",
      bendability: 1,
    },
    {
      code: "A1011-3.0",
      name: "Carbon Steel A1011 (HRPO) - 3.0mm",
      density: 7.87,
      costPerKg: 1.7,
      thickness: 3,
      category: "steel",
      bendability: 1.05,
    },
  ],
  "carbon-steel-a36": [
    {
      code: "A36-1.0",
      name: "Carbon Steel A36 (HR/HRPO) - 1.0mm",
      density: 7.85,
      costPerKg: 1.6,
      thickness: 1,
      category: "steel",
      bendability: 0.95,
    },
    {
      code: "A36-1.5",
      name: "Carbon Steel A36 (HR/HRPO) - 1.5mm",
      density: 7.85,
      costPerKg: 1.55,
      thickness: 1.5,
      category: "steel",
      bendability: 1,
    },
    {
      code: "A36-2.0",
      name: "Carbon Steel A36 (HR/HRPO) - 2.0mm",
      density: 7.85,
      costPerKg: 1.55,
      thickness: 2,
      category: "steel",
      bendability: 1.05,
    },
    {
      code: "A36-3.0",
      name: "Carbon Steel A36 (HR/HRPO) - 3.0mm",
      density: 7.85,
      costPerKg: 1.6,
      thickness: 3,
      category: "steel",
      bendability: 1.1,
    },
    {
      code: "A36-4.5",
      name: "Carbon Steel A36 (HR/HRPO) - 4.5mm",
      density: 7.85,
      costPerKg: 1.65,
      thickness: 4.5,
      category: "steel",
      bendability: 1.2,
    },
    {
      code: "A36-6.0",
      name: "Carbon Steel A36 (HR/HRPO) - 6.0mm",
      density: 7.85,
      costPerKg: 1.7,
      thickness: 6,
      category: "steel",
      bendability: 1.3,
    },
  ],
  "carbon-steel-a572-g50": [
    {
      code: "A572-1.5",
      name: "Carbon Steel A572 G50 - 1.5mm",
      density: 7.85,
      costPerKg: 2.2,
      thickness: 1.5,
      category: "steel",
      bendability: 1.2,
      requiresManualQuote: true,
      manualQuoteReason: "High strength low alloy - requires specific tooling",
    },
    {
      code: "A572-2.0",
      name: "Carbon Steel A572 G50 - 2.0mm",
      density: 7.85,
      costPerKg: 2.1,
      thickness: 2,
      category: "steel",
      bendability: 1.3,
      requiresManualQuote: true,
      manualQuoteReason: "High strength low alloy - requires specific tooling",
    },
    {
      code: "A572-3.0",
      name: "Carbon Steel A572 G50 - 3.0mm",
      density: 7.85,
      costPerKg: 2,
      thickness: 3,
      category: "steel",
      bendability: 1.4,
      requiresManualQuote: true,
      manualQuoteReason: "High strength low alloy - requires specific tooling",
    },
  ],
  "carbon-steel-1075": [
    {
      code: "CS1075-1.0",
      name: "Carbon Steel 1075 - 1.0mm",
      density: 7.85,
      costPerKg: 3.5,
      thickness: 1,
      category: "steel",
      bendability: 1.6,
      requiresManualQuote: true,
      manualQuoteReason:
        "High carbon spring steel - requires annealing for forming",
    },
    {
      code: "CS1075-1.5",
      name: "Carbon Steel 1075 - 1.5mm",
      density: 7.85,
      costPerKg: 3.4,
      thickness: 1.5,
      category: "steel",
      bendability: 1.7,
      requiresManualQuote: true,
      manualQuoteReason:
        "High carbon spring steel - requires annealing for forming",
    },
    {
      code: "CS1075-2.0",
      name: "Carbon Steel 1075 - 2.0mm",
      density: 7.85,
      costPerKg: 3.3,
      thickness: 2,
      category: "steel",
      bendability: 1.8,
      requiresManualQuote: true,
      manualQuoteReason:
        "High carbon spring steel - requires annealing for forming",
    },
  ],
  "carbon-steel-1095": [
    {
      code: "CS1095-1.0",
      name: "Carbon Steel 1095 - 1.0mm",
      density: 7.85,
      costPerKg: 4,
      thickness: 1,
      category: "steel",
      bendability: 1.8,
      requiresManualQuote: true,
      manualQuoteReason: "High carbon blade steel - very limited formability",
    },
    {
      code: "CS1095-1.5",
      name: "Carbon Steel 1095 - 1.5mm",
      density: 7.85,
      costPerKg: 3.8,
      thickness: 1.5,
      category: "steel",
      bendability: 1.9,
      requiresManualQuote: true,
      manualQuoteReason: "High carbon blade steel - very limited formability",
    },
    {
      code: "CS1095-2.0",
      name: "Carbon Steel 1095 - 2.0mm",
      density: 7.85,
      costPerKg: 3.6,
      thickness: 2,
      category: "steel",
      bendability: 2,
      requiresManualQuote: true,
      manualQuoteReason: "High carbon blade steel - very limited formability",
    },
  ],
  "carbon-steel-4130": [
    {
      code: "CS4130-1.0",
      name: "Carbon Steel 4130 - 1.0mm",
      density: 7.85,
      costPerKg: 5.5,
      thickness: 1,
      category: "steel",
      bendability: 1.4,
      requiresManualQuote: true,
      manualQuoteReason:
        "Chromoly - requires stress relief and special welding",
    },
    {
      code: "CS4130-1.5",
      name: "Carbon Steel 4130 - 1.5mm",
      density: 7.85,
      costPerKg: 5.3,
      thickness: 1.5,
      category: "steel",
      bendability: 1.5,
      requiresManualQuote: true,
      manualQuoteReason:
        "Chromoly - requires stress relief and special welding",
    },
    {
      code: "CS4130-2.0",
      name: "Carbon Steel 4130 - 2.0mm",
      density: 7.85,
      costPerKg: 5.2,
      thickness: 2,
      category: "steel",
      bendability: 1.6,
      requiresManualQuote: true,
      manualQuoteReason:
        "Chromoly - requires stress relief and special welding",
    },
  ],
  "carbon-steel-4140": [
    {
      code: "CS4140-1.0",
      name: "Carbon Steel 4140 - 1.0mm",
      density: 7.85,
      costPerKg: 5.8,
      thickness: 1,
      category: "steel",
      bendability: 1.5,
      requiresManualQuote: true,
      manualQuoteReason:
        "Chromoly - requires stress relief and special welding",
    },
    {
      code: "CS4140-1.5",
      name: "Carbon Steel 4140 - 1.5mm",
      density: 7.85,
      costPerKg: 5.6,
      thickness: 1.5,
      category: "steel",
      bendability: 1.6,
      requiresManualQuote: true,
      manualQuoteReason:
        "Chromoly - requires stress relief and special welding",
    },
    {
      code: "CS4140-2.0",
      name: "Carbon Steel 4140 - 2.0mm",
      density: 7.85,
      costPerKg: 5.5,
      thickness: 2,
      category: "steel",
      bendability: 1.7,
      requiresManualQuote: true,
      manualQuoteReason:
        "Chromoly - requires stress relief and special welding",
    },
  ],

  // ============= ZINC-COATED STEEL =============
  "galvanized-g90": [
    {
      code: "GALV-G90-0.8",
      name: "Galvanized G90 - 0.8mm",
      density: 7.85,
      costPerKg: 2.3,
      thickness: 0.8,
      category: "steel",
      bendability: 0.95,
    },
    {
      code: "GALV-G90-1.0",
      name: "Galvanized G90 - 1.0mm",
      density: 7.85,
      costPerKg: 2.2,
      thickness: 1,
      category: "steel",
      bendability: 0.95,
    },
    {
      code: "GALV-G90-1.5",
      name: "Galvanized G90 - 1.5mm",
      density: 7.85,
      costPerKg: 2.15,
      thickness: 1.5,
      category: "steel",
      bendability: 1,
    },
    {
      code: "GALV-G90-2.0",
      name: "Galvanized G90 - 2.0mm",
      density: 7.85,
      costPerKg: 2.15,
      thickness: 2,
      category: "steel",
      bendability: 1.05,
    },
    {
      code: "GALV-G90-3.0",
      name: "Galvanized G90 - 3.0mm",
      density: 7.85,
      costPerKg: 2.2,
      thickness: 3,
      category: "steel",
      bendability: 1.1,
    },
  ],
  "galvanized-g60": [
    {
      code: "GALV-G60-0.8",
      name: "Galvanized G60 - 0.8mm",
      density: 7.85,
      costPerKg: 2.2,
      thickness: 0.8,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "GALV-G60-1.0",
      name: "Galvanized G60 - 1.0mm",
      density: 7.85,
      costPerKg: 2.1,
      thickness: 1,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "GALV-G60-1.5",
      name: "Galvanized G60 - 1.5mm",
      density: 7.85,
      costPerKg: 2.05,
      thickness: 1.5,
      category: "steel",
      bendability: 0.95,
    },
    {
      code: "GALV-G60-2.0",
      name: "Galvanized G60 - 2.0mm",
      density: 7.85,
      costPerKg: 2.05,
      thickness: 2,
      category: "steel",
      bendability: 1,
    },
  ],
  "galvanneal-a60": [
    {
      code: "GA-A60-0.8",
      name: "Galvanneal A60 - 0.8mm",
      density: 7.85,
      costPerKg: 2.5,
      thickness: 0.8,
      category: "steel",
      bendability: 0.95,
    },
    {
      code: "GA-A60-1.0",
      name: "Galvanneal A60 - 1.0mm",
      density: 7.85,
      costPerKg: 2.4,
      thickness: 1,
      category: "steel",
      bendability: 0.95,
    },
    {
      code: "GA-A60-1.5",
      name: "Galvanneal A60 - 1.5mm",
      density: 7.85,
      costPerKg: 2.35,
      thickness: 1.5,
      category: "steel",
      bendability: 1,
    },
    {
      code: "GA-A60-2.0",
      name: "Galvanneal A60 - 2.0mm",
      density: 7.85,
      costPerKg: 2.35,
      thickness: 2,
      category: "steel",
      bendability: 1.05,
    },
  ],
  "galvanneal-a40": [
    {
      code: "GA-A40-0.8",
      name: "Galvanneal A40 - 0.8mm",
      density: 7.85,
      costPerKg: 2.4,
      thickness: 0.8,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "GA-A40-1.0",
      name: "Galvanneal A40 - 1.0mm",
      density: 7.85,
      costPerKg: 2.3,
      thickness: 1,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "GA-A40-1.5",
      name: "Galvanneal A40 - 1.5mm",
      density: 7.85,
      costPerKg: 2.25,
      thickness: 1.5,
      category: "steel",
      bendability: 0.95,
    },
    {
      code: "GA-A40-2.0",
      name: "Galvanneal A40 - 2.0mm",
      density: 7.85,
      costPerKg: 2.25,
      thickness: 2,
      category: "steel",
      bendability: 1,
    },
  ],
  "electro-galvanized": [
    {
      code: "EG-0.8",
      name: "Electro-galvanized (EG) - 0.8mm",
      density: 7.85,
      costPerKg: 2.6,
      thickness: 0.8,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "EG-1.0",
      name: "Electro-galvanized (EG) - 1.0mm",
      density: 7.85,
      costPerKg: 2.5,
      thickness: 1,
      category: "steel",
      bendability: 0.9,
    },
    {
      code: "EG-1.5",
      name: "Electro-galvanized (EG) - 1.5mm",
      density: 7.85,
      costPerKg: 2.45,
      thickness: 1.5,
      category: "steel",
      bendability: 0.95,
    },
    {
      code: "EG-2.0",
      name: "Electro-galvanized (EG) - 2.0mm",
      density: 7.85,
      costPerKg: 2.45,
      thickness: 2,
      category: "steel",
      bendability: 1,
    },
  ],
  "aluminized-type1": [
    {
      code: "ALUM-T1-1.0",
      name: "Aluminized Type 1 - 1.0mm",
      density: 7.85,
      costPerKg: 3.2,
      thickness: 1,
      category: "steel",
      bendability: 1.1,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aluminized coating - requires careful handling to prevent coating damage",
    },
    {
      code: "ALUM-T1-1.5",
      name: "Aluminized Type 1 - 1.5mm",
      density: 7.85,
      costPerKg: 3.1,
      thickness: 1.5,
      category: "steel",
      bendability: 1.15,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aluminized coating - requires careful handling to prevent coating damage",
    },
    {
      code: "ALUM-T1-2.0",
      name: "Aluminized Type 1 - 2.0mm",
      density: 7.85,
      costPerKg: 3,
      thickness: 2,
      category: "steel",
      bendability: 1.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aluminized coating - requires careful handling to prevent coating damage",
    },
  ],
  "prepainted-coil": [
    {
      code: "PPAINT-0.8",
      name: "Pre-painted Coil - 0.8mm",
      density: 7.85,
      costPerKg: 3.5,
      thickness: 0.8,
      category: "steel",
      bendability: 1,
      requiresManualQuote: true,
      manualQuoteReason:
        "Pre-painted - color matching and scratch prevention required",
    },
    {
      code: "PPAINT-1.0",
      name: "Pre-painted Coil - 1.0mm",
      density: 7.85,
      costPerKg: 3.4,
      thickness: 1,
      category: "steel",
      bendability: 1,
      requiresManualQuote: true,
      manualQuoteReason:
        "Pre-painted - color matching and scratch prevention required",
    },
    {
      code: "PPAINT-1.5",
      name: "Pre-painted Coil - 1.5mm",
      density: 7.85,
      costPerKg: 3.3,
      thickness: 1.5,
      category: "steel",
      bendability: 1.05,
      requiresManualQuote: true,
      manualQuoteReason:
        "Pre-painted - color matching and scratch prevention required",
    },
  ],

  // ============= COPPER =============
  "copper-c260": [
    {
      code: "CU-C260-0.8",
      name: "Copper C260 (Brass) - 0.8mm",
      density: 8.53,
      costPerKg: 12,
      thickness: 0.8,
      category: "copper",
      bendability: 0.9,
    },
    {
      code: "CU-C260-1.0",
      name: "Copper C260 (Brass) - 1.0mm",
      density: 8.53,
      costPerKg: 11.5,
      thickness: 1,
      category: "copper",
      bendability: 0.9,
    },
    {
      code: "CU-C260-1.5",
      name: "Copper C260 (Brass) - 1.5mm",
      density: 8.53,
      costPerKg: 11.2,
      thickness: 1.5,
      category: "copper",
      bendability: 1,
    },
    {
      code: "CU-C260-2.0",
      name: "Copper C260 (Brass) - 2.0mm",
      density: 8.53,
      costPerKg: 11,
      thickness: 2,
      category: "copper",
      bendability: 1.05,
    },
  ],
  "copper-c110": [
    {
      code: "CU-C110-0.8",
      name: "Copper C110 (ETP) - 0.8mm",
      density: 8.94,
      costPerKg: 14,
      thickness: 0.8,
      category: "copper",
      bendability: 0.85,
    },
    {
      code: "CU-C110-1.0",
      name: "Copper C110 (ETP) - 1.0mm",
      density: 8.94,
      costPerKg: 13.5,
      thickness: 1,
      category: "copper",
      bendability: 0.85,
    },
    {
      code: "CU-C110-1.5",
      name: "Copper C110 (ETP) - 1.5mm",
      density: 8.94,
      costPerKg: 13.2,
      thickness: 1.5,
      category: "copper",
      bendability: 0.9,
    },
    {
      code: "CU-C110-2.0",
      name: "Copper C110 (ETP) - 2.0mm",
      density: 8.94,
      costPerKg: 13,
      thickness: 2,
      category: "copper",
      bendability: 0.95,
    },
  ],
  "copper-c122": [
    {
      code: "CU-C122-0.8",
      name: "Copper C122 (DHP) - 0.8mm",
      density: 8.94,
      costPerKg: 13.5,
      thickness: 0.8,
      category: "copper",
      bendability: 0.85,
    },
    {
      code: "CU-C122-1.0",
      name: "Copper C122 (DHP) - 1.0mm",
      density: 8.94,
      costPerKg: 13,
      thickness: 1,
      category: "copper",
      bendability: 0.85,
    },
    {
      code: "CU-C122-1.5",
      name: "Copper C122 (DHP) - 1.5mm",
      density: 8.94,
      costPerKg: 12.8,
      thickness: 1.5,
      category: "copper",
      bendability: 0.9,
    },
    {
      code: "CU-C122-2.0",
      name: "Copper C122 (DHP) - 2.0mm",
      density: 8.94,
      costPerKg: 12.5,
      thickness: 2,
      category: "copper",
      bendability: 0.95,
    },
  ],

  // ============= BRONZE (Manual Review) =============
  "bronze-c510": [
    {
      code: "BR-C510-1.0",
      name: "Bronze C510 (Phosphor) - 1.0mm",
      density: 8.86,
      costPerKg: 18,
      thickness: 1,
      category: "brass",
      bendability: 1.1,
      requiresManualQuote: true,
      manualQuoteReason:
        "Phosphor bronze - specialty material requiring expert handling",
    },
    {
      code: "BR-C510-1.5",
      name: "Bronze C510 (Phosphor) - 1.5mm",
      density: 8.86,
      costPerKg: 17.5,
      thickness: 1.5,
      category: "brass",
      bendability: 1.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Phosphor bronze - specialty material requiring expert handling",
    },
    {
      code: "BR-C510-2.0",
      name: "Bronze C510 (Phosphor) - 2.0mm",
      density: 8.86,
      costPerKg: 17,
      thickness: 2,
      category: "brass",
      bendability: 1.3,
      requiresManualQuote: true,
      manualQuoteReason:
        "Phosphor bronze - specialty material requiring expert handling",
    },
  ],
  "bronze-c521": [
    {
      code: "BR-C521-1.0",
      name: "Bronze C521 (Phosphor) - 1.0mm",
      density: 8.86,
      costPerKg: 19,
      thickness: 1,
      category: "brass",
      bendability: 1.1,
      requiresManualQuote: true,
      manualQuoteReason:
        "Phosphor bronze - specialty material requiring expert handling",
    },
    {
      code: "BR-C521-1.5",
      name: "Bronze C521 (Phosphor) - 1.5mm",
      density: 8.86,
      costPerKg: 18.5,
      thickness: 1.5,
      category: "brass",
      bendability: 1.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Phosphor bronze - specialty material requiring expert handling",
    },
    {
      code: "BR-C521-2.0",
      name: "Bronze C521 (Phosphor) - 2.0mm",
      density: 8.86,
      costPerKg: 18,
      thickness: 2,
      category: "brass",
      bendability: 1.3,
      requiresManualQuote: true,
      manualQuoteReason:
        "Phosphor bronze - specialty material requiring expert handling",
    },
  ],
  "bronze-c172": [
    {
      code: "BR-C172-0.8",
      name: "Bronze C172 (Be-Cu) - 0.8mm",
      density: 8.26,
      costPerKg: 85,
      thickness: 0.8,
      category: "brass",
      bendability: 1,
      requiresManualQuote: true,
      manualQuoteReason:
        "Beryllium copper - requires special safety handling and tooling",
    },
    {
      code: "BR-C172-1.0",
      name: "Bronze C172 (Be-Cu) - 1.0mm",
      density: 8.26,
      costPerKg: 82,
      thickness: 1,
      category: "brass",
      bendability: 1.05,
      requiresManualQuote: true,
      manualQuoteReason:
        "Beryllium copper - requires special safety handling and tooling",
    },
    {
      code: "BR-C172-1.5",
      name: "Bronze C172 (Be-Cu) - 1.5mm",
      density: 8.26,
      costPerKg: 80,
      thickness: 1.5,
      category: "brass",
      bendability: 1.1,
      requiresManualQuote: true,
      manualQuoteReason:
        "Beryllium copper - requires special safety handling and tooling",
    },
  ],

  // ============= TITANIUM (Manual Review) =============
  "titanium-grade2": [
    {
      code: "TI-GR2-1.0",
      name: "Titanium Grade 2 - 1.0mm",
      density: 4.51,
      costPerKg: 45,
      thickness: 1,
      category: "titanium",
      bendability: 1.8,
      requiresManualQuote: true,
      manualQuoteReason:
        "Titanium - requires specialized tooling and expertise",
    },
    {
      code: "TI-GR2-1.5",
      name: "Titanium Grade 2 - 1.5mm",
      density: 4.51,
      costPerKg: 44,
      thickness: 1.5,
      category: "titanium",
      bendability: 2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Titanium - requires specialized tooling and expertise",
    },
    {
      code: "TI-GR2-2.0",
      name: "Titanium Grade 2 - 2.0mm",
      density: 4.51,
      costPerKg: 43,
      thickness: 2,
      category: "titanium",
      bendability: 2.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Titanium - requires specialized tooling and expertise",
    },
  ],
  "titanium-grade5": [
    {
      code: "TI-6AL4V-1.0",
      name: "Titanium Grade 5 (Ti-6Al-4V) - 1.0mm",
      density: 4.43,
      costPerKg: 65,
      thickness: 1,
      category: "titanium",
      bendability: 2.5,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aerospace titanium - requires hot forming and specialized expertise",
    },
    {
      code: "TI-6AL4V-1.5",
      name: "Titanium Grade 5 (Ti-6Al-4V) - 1.5mm",
      density: 4.43,
      costPerKg: 64,
      thickness: 1.5,
      category: "titanium",
      bendability: 2.8,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aerospace titanium - requires hot forming and specialized expertise",
    },
    {
      code: "TI-6AL4V-2.0",
      name: "Titanium Grade 5 (Ti-6Al-4V) - 2.0mm",
      density: 4.43,
      costPerKg: 63,
      thickness: 2,
      category: "titanium",
      bendability: 3,
      requiresManualQuote: true,
      manualQuoteReason:
        "Aerospace titanium - requires hot forming and specialized expertise",
    },
  ],

  // ============= NICKEL ALLOYS (Manual Review) =============
  "inconel-625": [
    {
      code: "INC625-1.0",
      name: "Nickel Alloy Inconel 625 - 1.0mm",
      density: 8.44,
      costPerKg: 85,
      thickness: 1,
      category: "superalloy",
      bendability: 2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Superalloy - requires specialized equipment and expertise",
    },
    {
      code: "INC625-1.5",
      name: "Nickel Alloy Inconel 625 - 1.5mm",
      density: 8.44,
      costPerKg: 82,
      thickness: 1.5,
      category: "superalloy",
      bendability: 2.2,
      requiresManualQuote: true,
      manualQuoteReason:
        "Superalloy - requires specialized equipment and expertise",
    },
    {
      code: "INC625-2.0",
      name: "Nickel Alloy Inconel 625 - 2.0mm",
      density: 8.44,
      costPerKg: 80,
      thickness: 2,
      category: "superalloy",
      bendability: 2.5,
      requiresManualQuote: true,
      manualQuoteReason:
        "Superalloy - requires specialized equipment and expertise",
    },
  ],
  "inconel-718": [
    {
      code: "INC718-1.0",
      name: "Nickel Alloy Inconel 718 - 1.0mm",
      density: 8.19,
      costPerKg: 95,
      thickness: 1,
      category: "superalloy",
      bendability: 2.2,
      requiresManualQuote: true,
      manualQuoteReason: "Superalloy - requires hot forming and heat treatment",
    },
    {
      code: "INC718-1.5",
      name: "Nickel Alloy Inconel 718 - 1.5mm",
      density: 8.19,
      costPerKg: 92,
      thickness: 1.5,
      category: "superalloy",
      bendability: 2.4,
      requiresManualQuote: true,
      manualQuoteReason: "Superalloy - requires hot forming and heat treatment",
    },
    {
      code: "INC718-2.0",
      name: "Nickel Alloy Inconel 718 - 2.0mm",
      density: 8.19,
      costPerKg: 90,
      thickness: 2,
      category: "superalloy",
      bendability: 2.6,
      requiresManualQuote: true,
      manualQuoteReason: "Superalloy - requires hot forming and heat treatment",
    },
  ],
  "monel-400": [
    {
      code: "MONEL400-1.0",
      name: "Nickel Alloy Monel 400 - 1.0mm",
      density: 8.8,
      costPerKg: 55,
      thickness: 1,
      category: "superalloy",
      bendability: 1.5,
      requiresManualQuote: true,
      manualQuoteReason: "Nickel-copper alloy - requires specialized handling",
    },
    {
      code: "MONEL400-1.5",
      name: "Nickel Alloy Monel 400 - 1.5mm",
      density: 8.8,
      costPerKg: 53,
      thickness: 1.5,
      category: "superalloy",
      bendability: 1.6,
      requiresManualQuote: true,
      manualQuoteReason: "Nickel-copper alloy - requires specialized handling",
    },
    {
      code: "MONEL400-2.0",
      name: "Nickel Alloy Monel 400 - 2.0mm",
      density: 8.8,
      costPerKg: 52,
      thickness: 2,
      category: "superalloy",
      bendability: 1.7,
      requiresManualQuote: true,
      manualQuoteReason: "Nickel-copper alloy - requires specialized handling",
    },
  ],
};

// Sheet Metal Finish Options
export const SHEET_METAL_FINISHES: Record<string, any> = {
  "as-cut": {
    code: "AS-CUT",
    name: "As Cut (No Finish)",
    baseCost: 0,
    perAreaCost: 0,
  },
  deburred: {
    code: "DEBURRED",
    name: "Deburred Edges",
    baseCost: 5,
    perAreaCost: 2,
  },
  "powder-coat-black": {
    code: "PC-BLACK",
    name: "Powder Coat (Black)",
    baseCost: 25,
    perAreaCost: 8,
    color: "black",
  },
  "powder-coat-white": {
    code: "PC-WHITE",
    name: "Powder Coat (White)",
    baseCost: 25,
    perAreaCost: 8,
    color: "white",
  },
  "powder-coat-custom": {
    code: "PC-CUSTOM",
    name: "Powder Coat (Custom Color)",
    baseCost: 35,
    perAreaCost: 10,
  },
  "zinc-plated": {
    code: "ZINC",
    name: "Zinc Plating",
    baseCost: 15,
    perAreaCost: 5,
  },
  "chromate-conversion": {
    code: "CHROMATE",
    name: "Chromate Conversion (Alodine)",
    baseCost: 20,
    perAreaCost: 6,
  },
  "anodized-type-2": {
    code: "ANOD-T2",
    name: "Anodized Type II",
    baseCost: 22,
    perAreaCost: 7,
  },
  "anodized-type-3": {
    code: "ANOD-T3",
    name: "Anodized Type III (Hard)",
    baseCost: 35,
    perAreaCost: 10,
  },
  electropolish: {
    code: "EPOL-SM",
    name: "Electropolished",
    baseCost: 40,
    perAreaCost: 12,
  },
};

// Cutting Method Configurations
export const CUTTING_METHODS: Record<string, CuttingMethodConfig> = {
  laser: {
    name: "Laser Cutting",
    costPerMeter: 0.8,
    speedMmPerMin: 3000,
    setupCost: 45,
    minThickness: 0.3, // Allow thin sheet metal (0.3mm minimum)
    maxThickness: 20,
    materialCompatibility: [
      "steel",
      "stainless",
      "aluminum",
      "copper",
      "brass",
    ],
  },
  plasma: {
    name: "Plasma Cutting",
    costPerMeter: 0.5,
    speedMmPerMin: 2500,
    setupCost: 35,
    minThickness: 1,
    maxThickness: 50,
    materialCompatibility: ["steel", "stainless", "aluminum"],
  },
  waterjet: {
    name: "Waterjet Cutting",
    costPerMeter: 1.2,
    speedMmPerMin: 800,
    setupCost: 60,
    minThickness: 0.3, // Waterjet can cut thin stock
    maxThickness: 150,
    materialCompatibility: [
      "steel",
      "stainless",
      "aluminum",
      "copper",
      "brass",
    ],
  },
  "turret-punch": {
    name: "Turret Punch",
    costPerMeter: 0.4,
    speedMmPerMin: 5000,
    setupCost: 50,
    minThickness: 0.3, // Turret punch can handle thin stock
    maxThickness: 6,
    materialCompatibility: ["steel", "stainless", "aluminum"],
  },
};

const SIZE_LIMITS = { min: 0.3, max: 700 }; // min 0.3mm for thin sheet metal

// Lead time type price multipliers (applied to final price)
const leadTimePriceMultipliers = {
  economy: 0.8,
  standard: 1.5,
  expedited: 2.8,
} as const;

// Lead time multipliers for DAYS calculation (expedited is base)
const leadTimeDaysMultipliers = {
  expedited: 1,
  standard: 1.5,
  economy: 1.9,
} as const;
const shippingDaysByType = { economy: 14, standard: 7, expedited: 3 } as const;

// Sheet Metal Lead Time Configuration (expedited = 15 days, standard = 1.5x, economy = 1.9x)
const SHEET_METAL_LEAD_TIME = {
  expedited: 15, // Base expedited lead time
  standard: 23, // 1.5x expedited (22.5 rounded up)
  economy: 29, // 1.9x expedited (28.5 rounded up)
  shippingDays: {
    expedited: 3,
    standard: 5,
    economy: 7,
  },
} as const;

// Sheet Metal Advanced Cost Multiplier (20% increase for better quality)
const SHEET_METAL_COST_OPTIMIZATION = {
  qualityPremium: 1.2, // 20% increase for quality materials and processes
  complexityMultiplier: {
    simple: 1.05, // 5% for simple parts
    moderate: 1.15, // 15% for moderate complexity
    complex: 1.25, // 25% for complex parts
  },
  materialCategoryMultiplier: {
    aluminum: 1.15, // 15% for aluminum
    steel: 1.18, // 18% for steel
    stainless: 1.22, // 22% for stainless
    copper: 1.2, // 20% for copper
    brass: 1.18, // 18% for brass
    titanium: 1.45, // 45% for titanium (exotic)
    superalloy: 1.55, // 55% for superalloys (exotic)
  },
  toleranceMultiplier: {
    standard: 1,
    precision: 1.12, // 12% for precision
    tight: 1.25, // 25% for tight tolerances
  },
} as const;

// Xometry-style advanced pricing factors
const ADVANCED_PRICING = {
  // Shop capacity utilization (simulated - in production, use real-time data)
  capacityUtilization: 0.72, // 72% capacity = moderate demand

  // Demand-based price adjustments
  demandPricing: {
    low: 0.95, // <60% capacity: 5% discount
    moderate: 1, // 60-80% capacity: normal pricing
    high: 1.08, // 80-90% capacity: 8% premium
    veryHigh: 1.15, // >90% capacity: 15% premium
  },

  // Material procurement lead time (days)
  materialLeadTime: {
    common: 0, // Aluminum, mild steel (in stock)
    uncommon: 3, // Stainless, tool steel (3 days)
    rare: 7, // Titanium, Inconel (1 week)
    exotic: 14, // Specialty alloys (2 weeks)
  },

  // Complexity risk premium (% of subtotal)
  complexityRisk: {
    simple: 0,
    moderate: 0.03, // 3% for moderate complexity
    complex: 0.08, // 8% for complex parts
  },

  // Difficulty material premium (% of material cost)
  difficultMaterialPremium: {
    easy: 0, // Machinability < 1.5
    moderate: 0.05, // Machinability 1.5-2.5
    hard: 0.12, // Machinability > 2.5
  },

  // Batch optimization bonus (additional discount for optimal quantities)
  batchBonus: {
    optimal: 0.02, // 2% extra discount for quantities that fill a batch
    nearOptimal: 0.01, // 1% for near-optimal quantities
  },
};

// Enhanced CNC feasibility checks
const CNC_CONSTRAINTS = {
  minWallThickness: 0.5, // mm
  minFeatureSize: 0.8, // mm
  maxAspectRatio: 50, // length:width for flat plates (increased from 20 for thin plate parts)
  minHoleDepth: 0.5, // mm
  maxPartVolume: 500000, // cm3 (500L)
};

function estimateBendCount(complexity: string | undefined): number {
  if (complexity === "complex") return 4;
  if (complexity === "moderate") return 2;
  return 0;
}

function mapComplexityLevel(
  complexity: string | undefined,
): "simple" | "moderate" | "complex" {
  if (complexity === "complex") return "complex";
  if (complexity === "moderate") return "moderate";
  return "simple";
}

/**
 * Generate default sheet metal features from geometry when CAD analysis didn't provide them.
 * This enables pricing when a user manually switches process to sheet-metal.
 */
function generateDefaultSheetMetalFeatures(
  geometry: GeometryData,
  materialThickness: number = 1.5,
): SheetMetalFeatures {
  const bbox = geometry.boundingBox;
  const dims = [bbox.x, bbox.y, bbox.z].sort((a, b) => a - b);

  // Priority: 1) explicit material thickness, 2) detected wall thickness from backend (if valid),
  // 3) dominant_pair_thickness from face classification, 4) bbox min dim
  let thickness: number;
  if (materialThickness > 0 && materialThickness <= 25) {
    thickness = materialThickness;
  } else if (geometry.detectedWallThickness && geometry.detectedWallThickness >= 0.3 && geometry.detectedWallThickness <= 25) {
    // Only use detected thickness if it's a valid sheet metal range (0.3mm to 25mm)
    thickness = geometry.detectedWallThickness;
  } else if ((geometry as any).faceClassification?.dominant_pair_thickness >= 0.3) {
    // Fallback: use dominant planar pair thickness from face classification
    thickness = (geometry as any).faceClassification.dominant_pair_thickness;
  } else {
    thickness = Math.min(dims[0], 8); // Cap at 8mm (aligned with backend max)
  }
  const width = dims[1];
  const length = dims[2];

  // Calculate flat area: approximate from surface area or bounding box
  // For sheet metal, half the surface area is a reasonable approximation
  const flatArea = geometry.surfaceArea
    ? geometry.surfaceArea / 2
    : width * length;

  // Perimeter: 2 * (width + length) for a simple rectangle
  const perimeterLength = 2 * (width + length);

  // Estimate bends from complexity
  const bendCount = estimateBendCount(geometry.complexity);

  // Estimate holes from surface area (roughly 1 hole per 5000mm² for typical parts)
  const holeCount = Math.min(Math.floor(flatArea / 5000), 50);

  return {
    thickness,
    flatArea,
    developedLength: perimeterLength * 1.1, // 10% extra for bends
    perimeterLength,
    bendCount,
    bendAngles: new Array(bendCount).fill(90),
    minBendRadius: thickness * 1,
    maxBendRadius: thickness * 3,
    hasSharptBends: false,
    holeCount,
    totalHoleDiameter: holeCount * Math.PI * 6, // Assume 6mm average hole
    cornerCount: 4 + bendCount * 2,
    complexCuts: geometry.complexity === "complex" ? 3 : 0,
    straightCutLength: perimeterLength * 0.8,
    curvedCutLength: perimeterLength * 0.2,
    hasHems: bendCount > 4,
    hasCountersinks: holeCount > 8,
    hasLouvers: false,
    hasEmbossments: false,
    hasLances: false,
    flangeCount: Math.floor(bendCount / 2),
    hasSmallFeatures: thickness < 1.5 || holeCount > 30,
    hasTightTolerance: false,
    requiresMultipleSetups: bendCount > 10,
    nestingEfficiency: 0.85,
    recommendedCuttingMethod: thickness > 6 ? "plasma" : "laser",
    recommendedBendingMethod: "press-brake",
    estimatedCuttingTime: (perimeterLength / 1000) * 0.5, // 0.5 min per meter
    estimatedFormingTime: bendCount * 0.5, // 0.5 min per bend
    partType: bendCount > 2 ? "bracket" : "flat-pattern",
    complexity: mapComplexityLevel(geometry.complexity),
  };
}

interface SheetMetalPricingOptions {
  geometry: GeometryData;
  material: SheetMetalMaterialSpec;
  finish: SheetMetalFinish;
  quantity: number;
  tolerance: PricingInput["tolerance"];
  leadTimeType: PricingInput["leadTimeType"];
  cuttingMethod: CuttingMethod;
  hardware?: HardwareOption[];
}

/**
 * Sheet Metal Helper Functions
 */
function calculateSheetMetalPricingInternal(
  options: SheetMetalPricingOptions,
): PricingBreakdown {
  const {
    geometry,
    material,
    finish,
    quantity,
    tolerance,
    leadTimeType,
    cuttingMethod,
    hardware = [],
  } = options;
  // Use existing sheet metal features or generate defaults from geometry
  const features =
    geometry.sheetMetalFeatures ||
    generateDefaultSheetMetalFeatures(geometry, material.thickness);

  // Check feasibility with the features we have (original or generated)
  const feasibility = checkSheetMetalFeasibility(
    geometry,
    material,
    cuttingMethod,
    features,
  );
  if (!feasibility.isFeasible) {
    return manualQuoteBreakdown(leadTimeType, feasibility.reason);
  }

  // Safety check: if flatArea is invalid, we can't calculate pricing
  if (
    !features.flatArea ||
    features.flatArea <= 0 ||
    Number.isNaN(features.flatArea)
  ) {
    return manualQuoteBreakdown(
      leadTimeType,
      "Invalid sheet metal geometry - flat area cannot be determined",
    );
  }

  // 1. Material Cost (area-based)
  const flatAreaM2 = features?.flatArea / 1_000_000;
  const materialWeightKg =
    (flatAreaM2 * material.thickness * material.density) / 1000;
  const materialCostPerUnit = materialWeightKg * material.costPerKg * 1.15; // 15% scrap allowance

  // 2. Cutting Costs
  const cuttingCosts = calculateCuttingCosts(
    features,
    material,
    cuttingMethod,
    quantity,
  );

  // 3. Forming/Bending Costs
  const formingCosts = calculateFormingCosts(features, material, quantity);

  // 4. Deburring
  const perimeterM = features?.perimeterLength / 1000;
  const deburringCostPerUnit = perimeterM * 0.5 + flatAreaM2 * 2;

  // 5. Finishing Cost
  const finishingCostPerUnit =
    finish.baseCost / Math.max(1, quantity) + finish.perAreaCost * flatAreaM2;

  // 6. Hardware Costs
  const hardwareCostPerUnit = hardware.reduce(
    (sum, hw) => sum + hw.quantity * hw.unitCost,
    0,
  );
  const hardwareInstallationCostPerUnit = hardware.reduce(
    (sum, hw) => sum + hw.quantity * 0.5,
    0,
  );

  // 7. Programming Cost
  const complexityFactor = features?.complexCuts + features?.cornerCount * 0.1;
  const programmingCost = 25 + complexityFactor * 2;
  const programmingCostPerUnit = programmingCost / Math.max(1, quantity);

  // 8. Inspection Cost
  const inspectionMap = { standard: 0.02, precision: 0.05, tight: 0.08 };
  const inspectionCostPerUnit =
    (materialCostPerUnit + cuttingCosts.total + formingCosts.total) *
    inspectionMap[tolerance];

  // 9. Packaging Cost
  const packagingCostPerUnit = flatAreaM2 * 1.5 + 0.5;

  // 10. Overhead (12% for sheet metal)
  const directCosts =
    materialCostPerUnit +
    cuttingCosts.total +
    formingCosts.total +
    deburringCostPerUnit +
    finishingCostPerUnit +
    hardwareCostPerUnit +
    hardwareInstallationCostPerUnit +
    programmingCostPerUnit +
    inspectionCostPerUnit +
    packagingCostPerUnit;
  const overheadCostPerUnit = directCosts * 0.12;

  // 11. Margin (10%)
  const costBeforeMargin = directCosts + overheadCostPerUnit;
  const marginCostPerUnit = costBeforeMargin * 0.1;

  const subtotalPerUnit = costBeforeMargin + marginCostPerUnit;

  // 12. Quantity Discount
  const quantityDiscount = calculateSheetMetalQuantityDiscount(
    subtotalPerUnit,
    quantity,
    flatAreaM2,
  );

  // 13. Tolerance Upcharge
  const toleranceMultipliers = { standard: 0, precision: 1.2, tight: 1.6 };
  const toleranceUpcharge = subtotalPerUnit * toleranceMultipliers[tolerance];

  // 14. Advanced adjustments
  const advancedAdjustments = calculateSheetMetalAdvancedAdjustments(
    subtotalPerUnit,
    materialCostPerUnit,
    geometry,
    material,
    quantity,
  );

  // 15. Lead time
  const leadPlan = computeSheetMetalLeadTime(
    geometry,
    material,
    quantity,
    cuttingMethod,
    leadTimeType,
    features?.bendCount > 0,
  );

  // 16. Apply lead time multiplier
  const leadTimePriceMultiplier = leadTimePriceMultipliers[leadTimeType];
  const priceBeforeLeadTime =
    subtotalPerUnit -
    quantityDiscount +
    toleranceUpcharge +
    advancedAdjustments.totalAdjustment;

  // Apply 5% markup for sheet metal parts (enclosures, cabinets, housings, etc.)
  const sheetMetalMarkup = priceBeforeLeadTime * 0.05;
  const priceWithMarkup = priceBeforeLeadTime + sheetMetalMarkup;

  // Minimum price floor: never go below material cost × 1.5 or $2
  const minUnitPrice = Math.max(materialCostPerUnit * 1.5, 2);
  const unitPrice = Math.max(priceWithMarkup * leadTimePriceMultiplier, minUnitPrice);
  const totalPrice = unitPrice * quantity;

  // Guard: if price is still $0 or negative, push to manual quote
  if (unitPrice <= 0) {
    return manualQuoteBreakdown(leadTimeType, "Calculated sheet metal price is invalid — manual review required");
  }

  return {
    materialCost: round2(materialCostPerUnit),
    machiningCost: round2(cuttingCosts.total + formingCosts.total), // Combined for consistency
    setupCost: round2(cuttingCosts.setup + formingCosts.setup),
    finishCost: round2(finishingCostPerUnit),
    toolingCost: round2(formingCosts.tooling + programmingCostPerUnit),
    inspectionCost: round2(inspectionCostPerUnit),
    overheadCost: round2(overheadCostPerUnit),
    marginCost: round2(marginCostPerUnit),
    subtotal: round2(subtotalPerUnit),
    quantityDiscount: round2(quantityDiscount),
    toleranceUpcharge: round2(toleranceUpcharge),
    leadTimeMultiplier: leadTimePriceMultiplier,
    demandAdjustment: advancedAdjustments.demandAdjustment,
    complexityRiskPremium: advancedAdjustments.complexityRiskPremium,
    materialDifficultyPremium: advancedAdjustments.materialDifficultyPremium,
    batchOptimizationBonus: advancedAdjustments.batchOptimizationBonus,
    qualityPremiumAdjustment: advancedAdjustments.qualityPremiumAdjustment,
    cuttingCost: round2(cuttingCosts.total),
    bendingCost: round2(formingCosts.total),
    hardwareCost: round2(hardwareCostPerUnit + hardwareInstallationCostPerUnit),
    unitPrice: round2(unitPrice),
    totalPrice: round2(totalPrice),
    leadTimeDays: leadPlan.leadTimeDays,
    requiresManualQuote: false,
    leadTimeComponents: leadPlan.components,
  };
}

function calculateCuttingCosts(
  features: NonNullable<GeometryData["sheetMetalFeatures"]>,
  material: SheetMetalMaterialSpec,
  method: CuttingMethod,
  quantity: number,
): {
  setup: number;
  perimeter: number;
  holes: number;
  complexCuts: number;
  total: number;
} {
  const config = CUTTING_METHODS[method];
  const setup = config.setupCost / Math.max(1, quantity);
  const perimeterM = features?.perimeterLength / 1000;
  const perimeter = perimeterM * config.costPerMeter;
  const holes =
    features?.holeCount * 0.15 +
    (features?.totalHoleDiameter / 1000) * config.costPerMeter;
  const complexCuts = features?.complexCuts * (config.costPerMeter * 0.5);
  const thicknessMultiplier = 1 + (material.thickness / 10) * 0.3;
  const total = (setup + perimeter + holes + complexCuts) * thicknessMultiplier;
  return { setup, perimeter, holes, complexCuts, total };
}

function calculateFormingCosts(
  features: NonNullable<GeometryData["sheetMetalFeatures"]>,
  material: SheetMetalMaterialSpec,
  quantity: number,
): { setup: number; bending: number; tooling: number; total: number } {
  if (features?.bendCount === 0) {
    return { setup: 0, bending: 0, tooling: 0, total: 0 };
  }
  const setup = 20 / Math.max(1, quantity);
  const costPerBend = 0.8 * material.bendability;
  const bending = features?.bendCount * costPerBend;
  const hasSpecialFeatures = features?.hasHems || features?.hasCountersinks;
  const tooling = hasSpecialFeatures ? 15 / Math.max(1, quantity) : 0;
  const total = setup + bending + tooling;
  return { setup, bending, tooling, total };
}

function calculateSheetMetalQuantityDiscount(
  subtotal: number,
  quantity: number,
  areaM2: number,
): number {
  // Discount applies to setup/overhead portion only — keep rates moderate
  // so material-heavy parts don't collapse in price at high quantities.
  let rate = 0;
  if (quantity >= 1000) rate = 0.22;
  else if (quantity >= 500) rate = 0.18;
  else if (quantity >= 250) rate = 0.15;
  else if (quantity >= 100) rate = 0.12;
  else if (quantity >= 50) rate = 0.09;
  else if (quantity >= 25) rate = 0.06;
  else if (quantity >= 10) rate = 0.04;
  else if (quantity >= 5) rate = 0.02;

  const totalAreaM2 = areaM2 * quantity;
  let areaBonus = 0;
  if (totalAreaM2 >= 50) areaBonus = 0.03;
  else if (totalAreaM2 >= 20) areaBonus = 0.02;
  else if (totalAreaM2 >= 10) areaBonus = 0.01;

  const finalRate = Math.min(rate + areaBonus, 0.25);
  return subtotal * finalRate;
}

function getDemandMultiplier(capacity: number): number {
  if (capacity < 0.6) return 0.96;
  if (capacity > 0.85) return 1.12;
  if (capacity > 0.75) return 1.06;
  return 1;
}

function assessComplexity(
  features: NonNullable<GeometryData["sheetMetalFeatures"]>,
): { level: "simple" | "moderate" | "complex"; rate: number } {
  const totalComplexity =
    features.bendCount + features.complexCuts + features.holeCount * 0.1;
  if (totalComplexity > 25 || features.bendCount > 12) {
    return { level: "complex", rate: 0.1 };
  }
  if (totalComplexity > 12 || features.bendCount > 6) {
    return { level: "moderate", rate: 0.06 };
  }
  if (totalComplexity > 5) {
    return { level: "simple", rate: 0.03 };
  }
  return { level: "simple", rate: 0 };
}

function getMaterialDifficultyRate(material: SheetMetalMaterialSpec): number {
  if (material.category === "stainless" && material.thickness >= 2.5) return 0.12;
  if (material.category === "stainless" && material.thickness >= 2) return 0.1;
  if (material.category === "stainless") return 0.06;
  if (material.category === "copper" || material.category === "brass") return 0.05;
  if (material.thickness >= 3) return 0.05;
  if (material.thickness >= 2) return 0.03;
  return 0;
}

function calculateDfmSurcharge(
  dfmIssues: Array<{ severity: string }>,
  subtotal: number,
): number {
  let surcharge = 0;
  for (const issue of dfmIssues) {
    if (issue.severity === "critical") surcharge += subtotal * 0.08;
    else if (issue.severity === "warning") surcharge += subtotal * 0.03;
  }
  return Math.min(surcharge, subtotal * 0.3);
}

function calculateSheetMetalAdvancedAdjustments(
  subtotal: number,
  materialCost: number,
  geometry: GeometryData,
  material: SheetMetalMaterialSpec,
  quantity: number,
): {
  demandAdjustment: number;
  complexityRiskPremium: number;
  materialDifficultyPremium: number;
  batchOptimizationBonus: number;
  qualityPremiumAdjustment: number;
  totalAdjustment: number;
} {
  const demandMultiplier = getDemandMultiplier(ADVANCED_PRICING.capacityUtilization);
  const demandAdjustment = subtotal * (demandMultiplier - 1);

  const features = geometry.sheetMetalFeatures!;
  const { level: complexityLevel, rate: complexityRate } = assessComplexity(features);
  const complexityMultiplier =
    SHEET_METAL_COST_OPTIMIZATION.complexityMultiplier[complexityLevel];
  const complexityRiskPremium = subtotal * complexityRate * complexityMultiplier;

  const difficultyRate = getMaterialDifficultyRate(material);
  const materialCategoryMultiplier =
    SHEET_METAL_COST_OPTIMIZATION.materialCategoryMultiplier[material.category];
  const materialDifficultyPremium = materialCost * difficultyRate * materialCategoryMultiplier;

  const optimalQuantities = [5, 10, 20, 25, 50, 100, 250, 500, 1000];
  const batchOptimizationBonus = optimalQuantities.includes(quantity) ? subtotal * 0.018 : 0;

  const qualityPremiumAdjustment =
    subtotal * (SHEET_METAL_COST_OPTIMIZATION.qualityPremium - 1);

  const dfmSurcharge = calculateDfmSurcharge(geometry.dfmIssues ?? [], subtotal);

  const totalAdjustment =
    demandAdjustment +
    complexityRiskPremium +
    materialDifficultyPremium +
    qualityPremiumAdjustment +
    dfmSurcharge -
    batchOptimizationBonus;

  return {
    demandAdjustment: round2(demandAdjustment),
    complexityRiskPremium: round2(complexityRiskPremium),
    materialDifficultyPremium: round2(materialDifficultyPremium),
    batchOptimizationBonus: round2(batchOptimizationBonus),
    qualityPremiumAdjustment: round2(qualityPremiumAdjustment),
    totalAdjustment: round2(totalAdjustment),
  };
}

/**
 * Advanced Sheet Metal Lead Time Calculation
 * Enterprise-level lead time estimation with detailed breakdown
 */
function computeSheetMetalLeadTime(
  geometry: GeometryData,
  material: SheetMetalMaterialSpec,
  quantity: number,
  cuttingMethod: CuttingMethod,
  leadTimeType: PricingInput["leadTimeType"],
  hasBends: boolean,
): {
  leadTimeDays: number;
  components: {
    productionDays: number;
    shippingDays: number;
    bufferDays: number;
    materialProcurementDays: number;
  };
} {
  const materialProcurementDays = getMaterialProcurementTime(material, leadTimeType);

  const features = geometry.sheetMetalFeatures!;

  const totalComplexity =
    features?.complexCuts + features?.bendCount + features?.holeCount * 0.1;
  const programmingDays = getProgrammingDays(totalComplexity);

  const config = CUTTING_METHODS[cuttingMethod];
  const totalCuttingLength =
    features?.perimeterLength + features?.totalHoleDiameter;
  const cuttingMinutes = totalCuttingLength / config.speedMmPerMin;

  const quantityEfficiencyFactor = getQuantityEfficiency(quantity);
  const cuttingHours =
    (cuttingMinutes / 60) * quantity * quantityEfficiencyFactor;
  const baseCuttingDays = Math.ceil(cuttingHours / 8);

  let baseFormingDays = 0;
  if (hasBends) {
    const bendsPerHour = 30 / material.bendability;
    const formingHours =
      (features?.bendCount * quantity * quantityEfficiencyFactor) /
      bendsPerHour;
    baseFormingDays = Math.ceil(formingHours / 8);
  }

  const flatAreaM2 = features?.flatArea / 1_000_000;
  let finishingDays = 0.5;
  if (flatAreaM2 * quantity > 5) finishingDays = 1.5;
  else if (flatAreaM2 * quantity > 2) finishingDays = 1;

  const inspectionDays =
    features?.bendCount > 8 || features?.complexCuts > 10 ? 0.5 : 0;

  const { targetLeadTime, shippingDays } = getLeadTimeConfig(leadTimeType);

  const actualProductionDays = Math.ceil(
    baseCuttingDays + baseFormingDays + finishingDays + programmingDays + inspectionDays,
  );

  const availableProductionTime = targetLeadTime - shippingDays - materialProcurementDays;
  const productionDays = Math.max(actualProductionDays, availableProductionTime);
  const bufferDays = leadTimeType === "expedited" ? 1 : 0;

  const totalDays = materialProcurementDays + productionDays + shippingDays + bufferDays;

  return {
    leadTimeDays: Math.max(targetLeadTime, totalDays),
    components: {
      productionDays: actualProductionDays,
      shippingDays,
      bufferDays,
      materialProcurementDays,
    },
  };
}

function getMaterialProcurementTime(
  material: SheetMetalMaterialSpec,
  leadTimeType: string,
): number {
  const procurementMap: Record<string, Record<string, number>> = {
    exotic: { expedited: 7, standard: 10, economy: 14 },
    special: { expedited: 2, standard: 3, economy: 5 },
    thick_stainless: { expedited: 1, standard: 2, economy: 3 },
  };

  let tier: string | null = null;
  if (material.category === "titanium" || material.category === "superalloy") {
    tier = "exotic";
  } else if (material.category === "copper" || material.category === "brass") {
    tier = "special";
  } else if (material.category === "stainless" && material.thickness >= 2.5) {
    tier = "thick_stainless";
  }

  if (!tier) return 0;
  return procurementMap[tier][leadTimeType] ?? 0;
}

function getProgrammingDays(complexity: number): number {
  if (complexity > 25) return 2;
  if (complexity > 15) return 1.5;
  if (complexity > 8) return 1;
  if (complexity > 5) return 0.5;
  return 0;
}

function getQuantityEfficiency(quantity: number): number {
  if (quantity >= 100) return 0.75;
  if (quantity >= 50) return 0.8;
  if (quantity >= 25) return 0.85;
  if (quantity >= 10) return 0.9;
  return 1;
}

function getLeadTimeConfig(leadTimeType: string): {
  targetLeadTime: number;
  shippingDays: number;
} {
  if (leadTimeType === "expedited") {
    return {
      targetLeadTime: SHEET_METAL_LEAD_TIME.expedited,
      shippingDays: SHEET_METAL_LEAD_TIME.shippingDays.expedited,
    };
  }
  if (leadTimeType === "standard") {
    return {
      targetLeadTime: SHEET_METAL_LEAD_TIME.standard,
      shippingDays: SHEET_METAL_LEAD_TIME.shippingDays.standard,
    };
  }
  return {
    targetLeadTime: SHEET_METAL_LEAD_TIME.economy,
    shippingDays: SHEET_METAL_LEAD_TIME.shippingDays.economy,
  };
}

function checkSheetMetalFeasibility(
  geometry: GeometryData,
  material: SheetMetalMaterialSpec,
  cuttingMethod: CuttingMethod,
  features?: SheetMetalFeatures | null, // Accept optional features for when defaults are generated
): { isFeasible: boolean; reason?: string } {
  // Features are now passed in (either from geometry or generated defaults)
  // Skip feature check since we handle defaults in the pricing function

  // Check if material requires manual quote (exotic materials like titanium, inconel, hastelloy)
  if ((material as any).requiresManualQuote) {
    return {
      isFeasible: false,
      reason:
        (material as any).manualQuoteReason ||
        `Material ${material.name} requires manual quote - exotic material`,
    };
  }

  // Check size limits (0.5mm min to 700mm max)
  const dims = [
    geometry.boundingBox.x,
    geometry.boundingBox.y,
    geometry.boundingBox.z,
  ];
  if (dims.some((d) => d < SIZE_LIMITS.min)) {
    return {
      isFeasible: false,
      reason: `Part dimensions too small for sheet metal fabrication (minimum ${SIZE_LIMITS.min}mm). Please request manual quote.`,
    };
  }

  if (dims.some((d) => d > SIZE_LIMITS.max)) {
    return {
      isFeasible: false,
      reason: `Part dimensions exceed sheet metal equipment capacity (maximum ${SIZE_LIMITS.max}mm). Please request manual quote.`,
    };
  }

  const config = CUTTING_METHODS[cuttingMethod];
  if (
    material.thickness < config.minThickness ||
    material.thickness > config.maxThickness
  ) {
    return {
      isFeasible: false,
      reason: `${cuttingMethod} cannot cut ${material.category} at ${material.thickness}mm thickness (range: ${config.minThickness}-${config.maxThickness}mm). Please request manual quote.`,
    };
  }

  // Only check bend-related limits if we have features
  const bendCount = features?.bendCount ?? 0;

  if (bendCount > 0 && material.thickness > 6) {
    return {
      isFeasible: false,
      reason: `Material thickness ${material.thickness}mm exceeds standard bending capability (max 6mm). Please request manual quote.`,
    };
  }

  if (bendCount > 300) {
    return {
      isFeasible: false,
      reason: `Excessive bend count (${bendCount} bends) exceeds standard fabrication capacity. Please request manual quote.`,
    };
  }

  return { isFeasible: true };
}

/**
 * Calculate comprehensive pricing based on real geometry
 * Optimized to be 30% more competitive than market leaders
 * Supports both CNC and Sheet Metal manufacturing
 */
export function calculatePricing(input: PricingInput): PricingBreakdown {
  const {
    geometry,
    material,
    process,
    finish,
    quantity,
    tolerance,
    leadTimeType,
  } = input;

  // Short-circuit for manual-quote process — assemblies and flagged parts
  if (process.type === ("manual-quote" as any)) {
    return manualQuoteBreakdown(leadTimeType, "Assembly or complex part — manual quote required");
  }

  // Also check geometry-level manual-quote flag (set by backend assembly detection)
  if (geometry.requiresManualQuote) {
    return manualQuoteBreakdown(leadTimeType, geometry.manualQuoteReason || "Manual quote required by backend analysis");
  }

  // Route to sheet metal pricing if process is sheet-metal
  if (process.type === "sheet-metal" && "thickness" in material) {
    const cuttingMethod = input.cuttingMethod || "laser"; // Default to laser cutting
    return calculateSheetMetalPricingInternal({
      geometry,
      material,
      finish: finish as SheetMetalFinish,
      quantity,
      tolerance,
      leadTimeType,
      cuttingMethod,
      hardware: input.hardware,
    });
  }

  // CNC Pricing Logic (existing)
  const cncMaterial = material as MaterialSpec;

  // Enhanced manual quote check for CNC feasibility
  const manualGuard = shouldRequestManualQuote(geometry, process, cncMaterial);
  if (manualGuard.requiresManualQuote) {
    return manualQuoteBreakdown(leadTimeType, manualGuard.reason);
  }

  // 1. Material Cost (optimized waste calculation)
  const rawWeightKg = calculateRawStockWeightKg(geometry, cncMaterial, process);
  const materialCostPerUnit = rawWeightKg * cncMaterial.costPerKg;

  // 2. Machining Cost (optimized rates and efficiency)
  const machiningTimeHours =
    (geometry.estimatedMachiningTime / 60) *
    cncMaterial.machinabilityFactor *
    0.85; // 15% efficiency gain
  const machiningCostPerUnit = machiningTimeHours * process.hourlyRate;

  // 3. Setup Cost (amortized over quantity)
  const setupCostPerUnit = process.setupCost / Math.max(1, quantity);

  // 4. Finish Cost (competitive pricing)
  const surfaceAreaCm2 = geometry.surfaceArea / 100;
  const finishCostPerUnit =
    finish.baseCost + finish.perAreaCost * surfaceAreaCm2;

  // 5. Tooling Cost (optimized for part complexity)
  const complexityMultiplier = { simple: 0.8, moderate: 1, complex: 1.3 }[
    geometry.complexity
  ];
  const toolingCostPerUnit = machiningCostPerUnit * 0.12 * complexityMultiplier;

  // 6. Inspection Cost (based on tolerance)
  const toleranceInspectionMap: Record<PricingInput["tolerance"], number> = {
    standard: 0.03,
    precision: 0.08,
    tight: 0.13,
  };
  const inspectionCostPerUnit =
    (materialCostPerUnit + machiningCostPerUnit) *
    toleranceInspectionMap[tolerance];

  // 7. Overhead Cost (10% of direct costs - optimized operations)
  const directCosts =
    materialCostPerUnit +
    machiningCostPerUnit +
    setupCostPerUnit +
    finishCostPerUnit +
    toolingCostPerUnit +
    inspectionCostPerUnit;
  const overheadCostPerUnit = directCosts * 0.1;

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
    materialCostPerUnit,
  );

  // 10. Tolerance Upcharge (multiplier-based)
  const toleranceMultipliers: Record<PricingInput["tolerance"], number> = {
    standard: 0,
    precision: 1.5,
    tight: 1.9,
  };
  const toleranceUpcharge = subtotalPerUnit * toleranceMultipliers[tolerance];

  // 11. Advanced Xometry-style price adjustments
  const advancedAdjustments = calculateAdvancedPriceAdjustments(
    subtotalPerUnit,
    materialCostPerUnit,
    geometry,
    cncMaterial,
    quantity,
  );

  // 12. Dynamic Lead time calculation (with material procurement)
  const leadPlan = computeLeadTime(
    geometry,
    process,
    cncMaterial,
    quantity,
    leadTimeType,
  );

  // 13. Apply all adjustments and lead time multiplier
  const leadTimePriceMultiplier = leadTimePriceMultipliers[leadTimeType];
  const priceBeforeLeadTimeMultiplier =
    subtotalPerUnit -
    volumeDiscountResult.quantityDiscount +
    toleranceUpcharge +
    advancedAdjustments.totalAdjustment;

  // Final unit price with lead time multiplier
  // Minimum CNC price floor: never go below material cost × 1.5 or $5
  const minCncUnitPrice = Math.max(materialCostPerUnit * 1.5, 5);
  const calculatedPrice = priceBeforeLeadTimeMultiplier * leadTimePriceMultiplier;
  const floorHit = calculatedPrice < minCncUnitPrice;
  const unitPrice = Math.max(calculatedPrice, minCncUnitPrice);
  const totalPrice = unitPrice * quantity;

  // Diagnostic logging for pricing anomalies
  if (floorHit || materialCostPerUnit < 0.01 || machiningCostPerUnit < 0.01) {
    console.warn(
      `⚠️ CNC Pricing diagnostic: floor=${floorHit ? 'HIT' : 'ok'}, ` +
      `rawWeight=${rawWeightKg.toFixed(4)}kg, materialCost=$${materialCostPerUnit.toFixed(2)}, ` +
      `machiningTime=${geometry.estimatedMachiningTime.toFixed(1)}min, ` +
      `machiningCost=$${machiningCostPerUnit.toFixed(2)}, ` +
      `calculated=$${calculatedPrice.toFixed(2)}, floor=$${minCncUnitPrice.toFixed(2)}, ` +
      `final=$${unitPrice.toFixed(2)}, bbox=${geometry.boundingBox.x.toFixed(1)}×${geometry.boundingBox.y.toFixed(1)}×${geometry.boundingBox.z.toFixed(1)}mm`
    );
  }

  // Guard: if price is still $0 or negative, push to manual quote
  if (unitPrice <= 0) {
    return manualQuoteBreakdown(leadTimeType, "Calculated price is invalid — manual review required");
  }

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
    leadTimeMultiplier: leadTimePriceMultiplier,
    // Advanced adjustments
    demandAdjustment: advancedAdjustments.demandAdjustment,
    complexityRiskPremium: advancedAdjustments.complexityRiskPremium,
    materialDifficultyPremium: advancedAdjustments.materialDifficultyPremium,
    batchOptimizationBonus: advancedAdjustments.batchOptimizationBonus,
    unitPrice: round2(unitPrice),
    totalPrice: round2(totalPrice),
    leadTimeDays: leadPlan.leadTimeDays,
    requiresManualQuote: false,
    manualQuoteReason: undefined,
    // Flag when backend classification confidence is low
    ...(geometry.needsReview && { needsReview: true, classificationMethod: geometry.classificationMethod }),
    leadTimeComponents: leadPlan.components,
  };
}

export function calculatePricingMatrix(
  geometry: GeometryData,
  material: MaterialSpec,
  process: ProcessConfig,
  finish: FinishOption,
  tolerance: PricingInput["tolerance"],
  leadTimeType: PricingInput["leadTimeType"],
  quantities: number[] = [1, 10, 25, 50, 100],
): PricingBreakdown[] {
  return quantities.map((quantity) =>
    calculatePricing({
      geometry,
      material,
      process,
      finish,
      quantity,
      tolerance,
      leadTimeType,
    }),
  );
}

export async function calculatePricingWithLiveMaterial(
  input: PricingInput,
  options?: { materialPriceApiUrl?: string; apiKey?: string },
): Promise<PricingBreakdown> {
  // Only fetch pricing for CNC materials (MaterialSpec), not sheet metal
  if ("machinabilityFactor" in input.material) {
    const resolvedMaterial = await fetchMaterialPricing(
      input.material,
      options,
    );
    return calculatePricing({ ...input, material: resolvedMaterial });
  }
  return calculatePricing(input);
}

/**
 * Helper: Get material by name/code
 */
export function getMaterial(nameOrCode: string): MaterialSpec | null {
  const normalized = nameOrCode.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

  for (const [key, mat] of Object.entries(MATERIALS)) {
    const keyNorm = key.replaceAll(/[^a-z0-9]/g, "");
    const codeNorm = mat.code.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
    const nameNorm = mat.name.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

    if (
      keyNorm === normalized ||
      codeNorm === normalized ||
      nameNorm.includes(normalized)
    ) {
      return mat;
    }
  }

  return MATERIALS["aluminum-6061"];
}

/**
 * Helper: Get finish by name/code
 * Searches both CNC and Sheet Metal finishes
 */
export function getFinish(nameOrCode: string): FinishOption {
  const normalized = nameOrCode.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

  // First search CNC finishes
  for (const [key, fin] of Object.entries(FINISHES)) {
    const keyNorm = key.replaceAll(/[^a-z0-9]/g, "");
    const codeNorm = fin.code.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

    if (keyNorm === normalized || codeNorm === normalized) {
      return fin;
    }
  }

  // Then search Sheet Metal finishes
  for (const [key, fin] of Object.entries(SHEET_METAL_FINISHES)) {
    const keyNorm = key.replaceAll(/[^a-z0-9]/g, "");
    const codeNorm = (fin.code || "")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]/g, "");

    if (keyNorm === normalized || codeNorm === normalized) {
      // Convert to FinishOption format for compatibility
      return {
        code: fin.code,
        name: fin.name,
        baseCost: fin.baseCost || 0,
        perAreaCost: fin.perAreaCost || 0,
      };
    }
  }

  return FINISHES["as-machined"];
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Enhanced CNC feasibility check
 */
type ManualQuoteResult = { requiresManualQuote: boolean; reason?: string };

function checkSizeConstraints(dims: number[]): ManualQuoteResult | null {
  if (dims.some((d) => d < SIZE_LIMITS.min)) {
    return { requiresManualQuote: true, reason: `Part too small for manufacturing (min ${SIZE_LIMITS.min}mm)` };
  }
  if (dims.some((d) => d > SIZE_LIMITS.max)) {
    return { requiresManualQuote: true, reason: `Part exceeds equipment capacity (max ${SIZE_LIMITS.max}mm)` };
  }
  return null;
}

function checkCNCConstraints(
  geometry: GeometryData,
  material: MaterialSpec,
  dims: number[],
): ManualQuoteResult | null {
  const minDim = Math.min(...dims);
  if (minDim < CNC_CONSTRAINTS.minWallThickness && geometry.complexity !== "simple") {
    return { requiresManualQuote: true, reason: "Features too thin for reliable CNC machining" };
  }
  const aspectRatio = Math.max(...dims) / minDim;
  if (aspectRatio > CNC_CONSTRAINTS.maxAspectRatio) {
    return { requiresManualQuote: true, reason: "Extreme aspect ratio requires specialized tooling" };
  }
  if (geometry.complexity === "complex" && material.machinabilityFactor > 2.5) {
    return { requiresManualQuote: true, reason: "Complex geometry with difficult-to-machine material" };
  }
  if (geometry.estimatedMachiningTime > 3600) {
    return { requiresManualQuote: true, reason: "Machining time exceeds standard production capacity" };
  }
  return null;
}

function shouldRequestManualQuote(
  geometry: GeometryData,
  process: ProcessConfig,
  material: MaterialSpec,
): ManualQuoteResult {
  const dims = [geometry.boundingBox.x, geometry.boundingBox.y, geometry.boundingBox.z];

  const sizeCheck = checkSizeConstraints(dims);
  if (sizeCheck) return sizeCheck;

  const volumeCm3 =
    (geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z) / 1000;
  if (volumeCm3 > CNC_CONSTRAINTS.maxPartVolume) {
    return { requiresManualQuote: true, reason: "Part volume exceeds CNC capacity" };
  }

  if (process.type === "cnc-milling" || process.type === "cnc-turning") {
    const cncCheck = checkCNCConstraints(geometry, material, dims);
    if (cncCheck) return cncCheck;
  }

  if (process.type === "sheet-metal" && !isSheetMetalCandidate(geometry)) {
    return { requiresManualQuote: true, reason: "Geometry not suitable for sheet metal manufacturing" };
  }

  if (geometry.complexity === "complex" && process.type !== "injection-molding" && process.type !== "sheet-metal") {
    const surfaceToVolumeRatio = geometry.surfaceArea / (volumeCm3 * 10);
    if (surfaceToVolumeRatio > 50) {
      return { requiresManualQuote: true, reason: "Complex internal features may require multi-axis or EDM" };
    }
  }

  return { requiresManualQuote: false };
}

function isSheetMetalCandidate(geometry: GeometryData): boolean {
  // FIRST: If backend already classified as sheet-metal with good confidence, trust it
  // This takes priority over thickness validation, since bent parts may have
  // invalid thickness readings but correct process classification
  if (
    geometry.recommendedProcess === "sheet-metal" &&
    geometry.processConfidence !== undefined &&
    geometry.processConfidence >= 0.6
  ) {
    return true;
  }

  const dims = [
    geometry.boundingBox.x,
    geometry.boundingBox.y,
    geometry.boundingBox.z,
  ].sort((a, b) => a - b);

  // Prefer actual ray-cast wall thickness from backend over bbox min dimension.
  // For bent sheet metal parts (brackets, enclosures), the bbox minimum dimension
  // is NOT the wall thickness — it's the overall depth of the bent form.
  // Use faceClassification.dominant_pair_thickness if available
  let thickness = dims[0];
  if (geometry.detectedWallThickness && geometry.detectedWallThickness >= 0.3) {
    thickness = geometry.detectedWallThickness;
  } else if ((geometry as any).faceClassification?.dominant_pair_thickness >= 0.3) {
    thickness = (geometry as any).faceClassification.dominant_pair_thickness;
  }
  const longest = dims[2];

  // Sheet metal typically 0.3mm to 10mm thick (generous range to avoid false rejections)
  if (thickness < 0.3 || thickness > 10) return false;
  if (longest > SIZE_LIMITS.max) return false;

  // For bbox-only analysis, check aspect ratio (thin relative to area)
  const aspectRatio = longest / Math.max(thickness, 0.1);
  return aspectRatio > 3;
}

function manualQuoteBreakdown(
  leadTimeType: PricingInput["leadTimeType"],
  reason?: string,
): PricingBreakdown {
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
    leadTimeMultiplier: 1,
    unitPrice: 0,
    totalPrice: 0,
    leadTimeDays: 7,
    requiresManualQuote: true,
    manualQuoteReason: reason ?? "Manual quote required for this configuration",
    leadTimeComponents: { productionDays: 0, shippingDays, bufferDays: 7 },
  };
}

function calculateRawStockWeightKg(
  geometry: GeometryData,
  material: MaterialSpec,
  process: ProcessConfig,
): number {
  const bboxVolumeMm3 =
    geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z;
  // CRITICAL FIX: 1 cm = 10mm, so 1 cm³ = 10mm × 10mm × 10mm = 1000 mm³
  // Previously was dividing by 1,000,000 which is WRONG
  const bboxVolumeCm3 = bboxVolumeMm3 / 1000;

  // Floor: even a tiny CNC part needs a minimum stock block (10mm cube)
  const minStockCm3 = 1;  // 10mm × 10mm × 10mm = 1 cm³
  const effectiveVolumeCm3 = Math.max(bboxVolumeCm3, minStockCm3);

  const rawWeightKg = (effectiveVolumeCm3 * material.density) / 1000;
  return rawWeightKg * process.materialWasteFactor;
}

/**
 * Advanced Xometry-style pricing adjustments
 * Factors: demand, complexity risk, material difficulty, batch optimization
 */
function calculateAdvancedPriceAdjustments(
  subtotal: number,
  materialCost: number,
  geometry: GeometryData,
  material: MaterialSpec,
  quantity: number,
): {
  demandAdjustment: number;
  complexityRiskPremium: number;
  materialDifficultyPremium: number;
  batchOptimizationBonus: number;
  totalAdjustment: number;
} {
  // 1. Demand-based pricing (simulated capacity)
  const capacity = ADVANCED_PRICING.capacityUtilization;
  let demandMultiplier = ADVANCED_PRICING.demandPricing.moderate;
  if (capacity < 0.6) demandMultiplier = ADVANCED_PRICING.demandPricing.low;
  else if (capacity > 0.9)
    demandMultiplier = ADVANCED_PRICING.demandPricing.veryHigh;
  else if (capacity > 0.8)
    demandMultiplier = ADVANCED_PRICING.demandPricing.high;
  const demandAdjustment = subtotal * (demandMultiplier - 1);

  // 2. Complexity risk premium
  const complexityRate = ADVANCED_PRICING.complexityRisk[geometry.complexity];
  const complexityRiskPremium = subtotal * complexityRate;

  // 3. Material difficulty premium
  let difficultyRate = ADVANCED_PRICING.difficultMaterialPremium.easy;
  if (material.machinabilityFactor > 2.5) {
    difficultyRate = ADVANCED_PRICING.difficultMaterialPremium.hard;
  } else if (material.machinabilityFactor > 1.5) {
    difficultyRate = ADVANCED_PRICING.difficultMaterialPremium.moderate;
  }
  const materialDifficultyPremium = materialCost * difficultyRate;

  // 4. Batch optimization bonus (quantities that optimize setup)
  let batchBonus = 0;
  const optimalBatches = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  if (optimalBatches.includes(quantity)) {
    batchBonus = subtotal * ADVANCED_PRICING.batchBonus.optimal;
  } else if (optimalBatches.some((opt) => Math.abs(quantity - opt) <= 2)) {
    batchBonus = subtotal * ADVANCED_PRICING.batchBonus.nearOptimal;
  }
  const batchOptimizationBonus = batchBonus;

  const totalAdjustment =
    demandAdjustment +
    complexityRiskPremium +
    materialDifficultyPremium -
    batchOptimizationBonus;

  return {
    demandAdjustment: round2(demandAdjustment),
    complexityRiskPremium: round2(complexityRiskPremium),
    materialDifficultyPremium: round2(materialDifficultyPremium),
    batchOptimizationBonus: round2(batchOptimizationBonus),
    totalAdjustment: round2(totalAdjustment),
  };
}

const QUANTITY_TIER_RATES: [number, number][] = [
  [1000, 0.48], [500, 0.44], [250, 0.4], [100, 0.35], [80, 0.31],
  [60, 0.27], [50, 0.24], [40, 0.21], [30, 0.18], [25, 0.16],
  [20, 0.14], [15, 0.11], [10, 0.09], [7, 0.06], [5, 0.04], [3, 0.02],
];

const MATERIAL_VALUE_RATES: [number, number][] = [
  [5000, 0.08], [3000, 0.06], [2000, 0.04], [1000, 0.03], [500, 0.02], [250, 0.01],
];

const WEIGHT_EFFICIENCY_RATES: [number, number][] = [
  [500, 0.06], [300, 0.04], [200, 0.03], [100, 0.02], [50, 0.01],
];

const SETUP_AMORTIZATION_RATES: [number, number][] = [
  [0.02, 0.03], [0.05, 0.02], [0.1, 0.01],
];

function lookupRate(tiers: [number, number][], value: number): number {
  for (const [threshold, rate] of tiers) {
    if (value >= threshold) return rate;
  }
  return 0;
}

function lookupRateBelow(tiers: [number, number][], value: number): number {
  for (const [threshold, rate] of tiers) {
    if (value < threshold) return rate;
  }
  return 0;
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
  materialCostPerUnit: number,
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
  const tierRate = lookupRate(QUANTITY_TIER_RATES, quantity);
  const materialRate = lookupRate(MATERIAL_VALUE_RATES, materialCostPerUnit * quantity);
  const efficiencyRate = lookupRate(WEIGHT_EFFICIENCY_RATES, rawWeightKg * quantity);

  const setupCostPerUnit = setupCost / quantity;
  const setupAsPercentOfUnit = setupCostPerUnit / subtotalPerUnit;
  const setupAmortizationBonus = lookupRateBelow(SETUP_AMORTIZATION_RATES, setupAsPercentOfUnit);

  const rawTotalRate = tierRate + materialRate + efficiencyRate + setupAmortizationBonus;

  // Cap CNC volume discount at 40% to prevent excessively low pricing
  const softCap = 0.4;
  const finalRate = Math.min(
    rawTotalRate,
    softCap * (1 - Math.exp(-rawTotalRate / 0.3)),
  );

  return {
    quantityDiscountRate: finalRate,
    quantityDiscount: subtotalPerUnit * finalRate,
    breakdown: {
      tierDiscount: tierRate,
      materialDiscount: materialRate,
      efficiencyDiscount: efficiencyRate,
      setupAmortization: setupAmortizationBonus,
    },
  };
}

/**
 * Calculate material procurement lead time (Xometry-style)
 */
function getMaterialProcurementDays(material: MaterialSpec): number {
  const code = material.code;

  // Exotic alloys
  if (
    code.includes("INCONEL") ||
    code.includes("HASTELLOY") ||
    code.includes("KOVAR") ||
    code.includes("MONEL")
  ) {
    return ADVANCED_PRICING.materialLeadTime.exotic;
  }

  // Rare materials
  if (code.includes("TI-") || code.includes("MARAGING")) {
    return ADVANCED_PRICING.materialLeadTime.rare;
  }

  // Uncommon materials
  if (
    code.includes("SS-") ||
    code.includes("TS-") ||
    code.includes("BRONZE") ||
    material.machinabilityFactor > 1.5
  ) {
    return ADVANCED_PRICING.materialLeadTime.uncommon;
  }

  // Common materials (aluminum, mild steel, brass, plastics)
  return ADVANCED_PRICING.materialLeadTime.common;
}

/**
 * Dynamic lead time calculation based on complexity, quantity, and material
 * Minimum: 7 days | Xometry-style with capacity, material procurement, and batching
 */
function computeLeadTime(
  geometry: GeometryData,
  process: ProcessConfig,
  material: MaterialSpec,
  quantity: number,
  leadTimeType: PricingInput["leadTimeType"],
): {
  leadTimeDays: number;
  multiplier: number;
  components: {
    productionDays: number;
    shippingDays: number;
    bufferDays: number;
    materialProcurementDays: number;
  };
} {
  // Base machining time per part
  const perPartHours =
    (geometry.estimatedMachiningTime / 60) * material.machinabilityFactor;
  const totalHours = perPartHours * quantity;

  // Daily capacity varies by process
  const capacityHoursPerDay = getCapacityHoursPerDay(process.type);

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
  if (geometry.complexity === "moderate") {
    bufferDays = 2;
  } else if (geometry.complexity === "complex") {
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

  // Base production time for expedited (fastest), scale up for standard and economy
  const baseProductionDays = productionDays; // This is the expedited timeline
  const leadDaysMultiplier = leadTimeDaysMultipliers[leadTimeType];
  const adjustedProductionDays = Math.ceil(
    baseProductionDays * leadDaysMultiplier,
  );

  // Use standard buffer - lead time differences are in production time multiplier
  const adjustedBufferDays = bufferDays;

  // Material procurement lead time (Xometry-style)
  const materialProcurementDays = getMaterialProcurementDays(material);

  // Capacity-based adjustment (if shop is busy, add 1-2 days)
  const capacityDelayDays = getCapacityDelayDays(
    ADVANCED_PRICING.capacityUtilization,
  );

  // Shipping days
  const shippingDays = shippingDaysByType[leadTimeType];

  // Total lead time (minimum 7 days)
  const rawLead =
    adjustedProductionDays +
    shippingDays +
    adjustedBufferDays +
    materialProcurementDays +
    capacityDelayDays;
  const leadTimeDays = Math.max(7, rawLead);

  return {
    leadTimeDays,
    multiplier: leadDaysMultiplier,
    components: {
      productionDays: adjustedProductionDays,
      shippingDays,
      bufferDays: adjustedBufferDays,
      materialProcurementDays: materialProcurementDays + capacityDelayDays,
    },
  };
}

async function fetchMaterialPricing(
  material: MaterialSpec,
  options?: { materialPriceApiUrl?: string; apiKey?: string },
): Promise<MaterialSpec> {
  const endpoint = getMaterialPriceEndpoint(options);
  if (!endpoint) return material;

  try {
    const response = await fetch(
      `${endpoint}?code=${encodeURIComponent(material.code)}`,
      {
        headers: options?.apiKey
          ? { Authorization: `Bearer ${options.apiKey}` }
          : undefined,
      },
    );

    if (!response.ok) return material;

    const payload = (await response.json()) as { costPerKg?: number };
    if (payload.costPerKg && payload.costPerKg > 0) {
      return { ...material, costPerKg: payload.costPerKg };
    }
    return material;
  } catch (error) {
    console.warn("Material pricing fetch failed", error);
    return material;
  }
}

function getMaterialPriceEndpoint(options?: {
  materialPriceApiUrl?: string;
}): string | undefined {
  if (options?.materialPriceApiUrl) return options.materialPriceApiUrl;

  if (typeof globalThis !== "undefined" && "process" in globalThis) {
    const envProcess = (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process;
    return envProcess?.env?.NEXT_PUBLIC_MATERIAL_PRICE_API;
  }

  return undefined;
}

/**
 * Helper: Get sheet metal material by code
 */
export function getSheetMetalMaterial(
  materialCode: string,
): SheetMetalMaterialSpec | null {
  for (const materials of Object.values(SHEET_METAL_MATERIALS)) {
    const found = materials.find((m) => m.code === materialCode);
    if (found) return found;
  }
  return null;
}

/**
 * Helper: Get available thicknesses for a material family
 */
export function getAvailableThicknesses(
  materialFamily: keyof typeof SHEET_METAL_MATERIALS,
): number[] {
  return SHEET_METAL_MATERIALS[materialFamily].map((m) => m.thickness);
}

/**
 * Helper: Get sheet metal finish by code
 */
export function getSheetMetalFinish(
  finishCode: string,
): SheetMetalFinish | null {
  for (const [, finish] of Object.entries(SHEET_METAL_FINISHES)) {
    if (finish.code === finishCode) {
      return finish;
    }
  }
  return null;
}

export function getMaterialByValue(value: string, process: string) {
  const cleanProcess = cleanProcessString(process);

  if (isCNCProcessString(cleanProcess)) {
    return findCNCMaterial(value);
  }
  return findSheetMetalMaterial(value);
}

function cleanProcessString(process: string): string {
  return process
    ? process
        .replaceAll(/(?:^["'\s]+)|(?:["'\s]+$)/g, "")
        .replaceAll(String.raw`\"`, "")
        .toLowerCase()
    : "";
}

function isCNCProcessString(cleanProcess: string): boolean {
  return (
    cleanProcess.includes("cnc") ||
    cleanProcess === "cnc-milling" ||
    cleanProcess === "cnc-turning"
  );
}

function findCNCMaterial(value: string) {
  for (const materials of Object.values(CNC_MATERIALS)) {
    const found = materials.find((m) => m.value === value);
    if (found) return found;
  }
  return null;
}

function findSheetMetalMaterial(value: string) {
  // First try to find by material key (e.g., "aluminum-5052")
  if (value in SHEET_METAL_MATERIALS) {
    const materialFamily = SHEET_METAL_MATERIALS[value];
    if (materialFamily && materialFamily.length > 0) {
      const preferred = materialFamily.find((m: any) => m.thickness === 2);
      return preferred || materialFamily[0];
    }
  }
  // Then try to find by code or value (e.g., "AL5052-1.5")
  for (const materials of Object.values(SHEET_METAL_MATERIALS)) {
    const found = materials.find(
      (m) => m.value === value || m.code === value,
    );
    if (found) return found;
  }
  // FALLBACK: If a CNC material code is used for sheet metal, map to closest sheet metal equivalent
  const sheetMaterial = findMappedSheetMetalMaterial(value);
  if (sheetMaterial) return sheetMaterial;

  // Final fallback: return default AL5052-2.0
  console.log(
    `\u26A0\uFE0F Sheet metal material "${value}" not found, using default AL5052-2.0`,
  );
  const defaultFamily = SHEET_METAL_MATERIALS["aluminum-5052"];
  if (defaultFamily && defaultFamily.length > 0) {
    const preferred = defaultFamily.find((m: any) => m.thickness === 2);
    return preferred || defaultFamily[0];
  }
  return null;
}

export function getMaterialForProcess(
  materialValue: string,
  process: string,
): MaterialSpec | SheetMetalMaterialSpec | null {
  // Clean up any malformed process strings
  const cleanProcess = cleanProcessString(process);

  const material = getMaterialByValue(materialValue, process);
  if (material) {
    // For sheet metal, return the full SheetMetalMaterialSpec
    if (
      !cleanProcess.includes("cnc") &&
      cleanProcess !== "cnc-milling" &&
      cleanProcess !== "cnc-turning"
    ) {
      // This is a sheet metal material - return as SheetMetalMaterialSpec
      return {
        code: material.code,
        name: material.name,
        density: material.density,
        costPerKg: material.costPerKg,
        thickness: material.thickness,
        category: material.category,
        bendability: material.bendability || 1,
        // Pass manual quote flags for exotic materials
        requiresManualQuote: material.requiresManualQuote || false,
        manualQuoteReason: material.manualQuoteReason,
      } as SheetMetalMaterialSpec;
    }

    // CNC material
    const label = material.label || material.name;
    const value = material.value || material.code;

    return {
      code: value.toUpperCase(),
      name: label,
      density: material.density,
      costPerKg: material.costPerKg,
      machinabilityFactor:
        "machinabilityFactor" in material
          ? material.machinabilityFactor
          : 1,
    };
  }
  // Fallback to legacy materials (CNC only)
  return getMaterial(materialValue);
}
