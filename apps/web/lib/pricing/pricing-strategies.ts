/**
 * Advanced Pricing Strategies using Strategy Pattern
 * Each manufacturing process has its own pricing strategy
 */

import { GeometryData } from "../cad-analysis";
import { MaterialSpec, SheetMetalMaterialSpec } from "../pricing-engine";

/**
 * Base interface for all pricing strategies
 */
export interface PricingStrategy {
  calculateMaterialCost(geometry: GeometryData, material: any): number;
  calculateLaborCost(geometry: GeometryData, hourlyRate: number): number;
  calculateSetupCost(quantity: number, baseSetupCost: number): number;
  calculateToolingCost(geometry: GeometryData, laborCost: number): number;
  getProcessSpecificAdjustments(geometry: GeometryData): ProcessAdjustments;
}

export interface ProcessAdjustments {
  complexityMultiplier: number;
  qualityMultiplier: number;
  riskPremium: number;
  efficiencyBonus: number;
}

// ---------------------------------------------------------------------------
// CNC Milling helpers
// ---------------------------------------------------------------------------

function millingWasteFactor(geometry: GeometryData): number {
  // Calculate how much material is wasted
  const volumeEfficiency = geometry.volume /
    (geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z);

  // More material removed = more waste
  if (volumeEfficiency > 0.7) return 1.1; // Solid part, 10% waste
  if (volumeEfficiency > 0.5) return 1.2; // Moderate hollowing, 20% waste
  if (volumeEfficiency > 0.3) return 1.3; // Significant material removal, 30% waste
  return 1.4; // Highly complex, 40% waste
}

function millingSetupTime(geometry: GeometryData): number {
  // Estimate hours for setup operations
  let setupHours = 0.25; // Base 15 minutes

  // Add time for complex setups
  if (geometry.complexity === 'complex') setupHours += 0.25;
  if (geometry.advancedFeatures?.undercuts?.requires5Axis) setupHours += 0.5;

  return setupHours;
}

function millingAnalyzeGeometry(geometry: GeometryData): {
  aspectRatio: number;
  hasThinWalls: boolean;
  volumeEfficiency: number;
} {
  const dims = [
    geometry.boundingBox.x,
    geometry.boundingBox.y,
    geometry.boundingBox.z
  ].sort((a, b) => a - b);

  const aspectRatio = dims[2] / dims[0];
  const volumeEfficiency = geometry.volume /
    (geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z);
  const hasThinWalls = dims[0] < 3 || (geometry.partCharacteristics?.isThinWalled ?? false);

  return { aspectRatio, hasThinWalls, volumeEfficiency };
}

/**
 * CNC Milling Strategy - Subtractive manufacturing
 */
export const cncMillingStrategy: PricingStrategy = {
  calculateMaterialCost(geometry: GeometryData, material: MaterialSpec): number {
    // Use bounding box for stock material + waste factor
    const bboxVolumeMm3 = geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z;
    const bboxVolumeCm3 = bboxVolumeMm3 / 1000; // CRITICAL: mm³ to cm³ (1 cm = 10mm, so 1 cm³ = 1000 mm³)

    // Account for material waste (typically 20-40% for CNC)
    const wasteFactor = millingWasteFactor(geometry);
    const rawWeightKg = (bboxVolumeCm3 * material.density) / 1000 * wasteFactor;

    return rawWeightKg * material.costPerKg;
  },

  calculateLaborCost(geometry: GeometryData, hourlyRate: number): number {
    // Base time from geometry + complexity adjustments
    const baseTimeHours = geometry.estimatedMachiningTime / 60;

    // Adjust for complexity
    const complexityFactors = {
      simple: 0.8,
      moderate: 1,
      complex: 1.4
    };

    const adjustedTime = baseTimeHours * complexityFactors[geometry.complexity];

    // Add setup time for tool changes, part repositioning
    const setupTime = millingSetupTime(geometry);

    return (adjustedTime + setupTime) * hourlyRate;
  },

  calculateSetupCost(quantity: number, baseSetupCost: number): number {
    // Amortize setup over quantity with economies of scale
    if (quantity === 1) return baseSetupCost;
    if (quantity <= 10) return baseSetupCost / quantity;
    if (quantity <= 50) return baseSetupCost / (quantity * 0.9); // 10% efficiency bonus
    return baseSetupCost / (quantity * 0.8); // 20% efficiency bonus for large batches
  },

  calculateToolingCost(geometry: GeometryData, laborCost: number): number {
    // Tool wear is proportional to machining time and complexity
    const complexityMultipliers = {
      simple: 0.08,
      moderate: 0.12,
      complex: 0.18
    };

    const baseToolingCost = laborCost * complexityMultipliers[geometry.complexity];

    // Adjust for hard-to-machine features
    let adjustment = 1;
    const deepHoleCount = geometry.advancedFeatures?.holes?.deepHoleCount ?? 0;
    if (deepHoleCount > 0) {
      adjustment += deepHoleCount * 0.02;
    }
    const undercutCount = geometry.advancedFeatures?.undercuts?.count ?? 0;
    if (undercutCount > 0) {
      adjustment += 0.15; // Undercuts require special tools
    }

    return baseToolingCost * adjustment;
  },

  getProcessSpecificAdjustments(geometry: GeometryData): ProcessAdjustments {
    let complexityMultiplier = 1;
    let riskPremium = 0;
    let efficiencyBonus = 0;

    // Analyze geometric features
    const metrics = millingAnalyzeGeometry(geometry);

    // High aspect ratio parts are harder to machine (vibration, deflection)
    if (metrics.aspectRatio > 10) {
      complexityMultiplier += 0.2;
      riskPremium += 0.05;
    }

    // Thin walls require careful machining
    if (metrics.hasThinWalls) {
      complexityMultiplier += 0.15;
      riskPremium += 0.03;
    }

    // Simple rectangular parts can be machined faster
    // Simple parts with no complex features can be machined faster
    const hasComplexFeatures = (geometry.advancedFeatures?.undercuts?.count ?? 0) > 0 ||
      (geometry.advancedFeatures?.threads?.count ?? 0) > 0 ||
      (geometry.advancedFeatures?.holes?.deepHoleCount ?? 0) > 0;
    if (geometry.complexity === 'simple' && !hasComplexFeatures) {
      efficiencyBonus = 0.1; // 10% discount
    }

    return {
      complexityMultiplier,
      qualityMultiplier: 1,
      riskPremium,
      efficiencyBonus
    };
  }
};

// ---------------------------------------------------------------------------
// Sheet Metal helpers
// ---------------------------------------------------------------------------

function sheetMetalDevelopedArea(geometry: GeometryData): number {
  // Estimate developed (unfolded) surface area
  // For accurate calculation, need bend deduction, but use surface area + 10% for bends
  const bendFactor = (geometry.sheetMetalFeatures?.bendCount ?? geometry.sheetMetalFeatures?.bends?.length ?? 0) * 0.02 + 1;
  return geometry.surfaceArea * bendFactor;
}

function sheetMetalScrapFactor(geometry: GeometryData): number {
  // === USE ACTUAL NESTING DATA WHEN AVAILABLE ===
  // The backend now sends a utilization_pct from the nesting estimator.
  // This is far more accurate than a bbox-based guess.
  const nestingUtilization = (geometry as any).nesting?.utilizationPct;
  if (typeof nestingUtilization === 'number' && nestingUtilization > 0) {
    // utilization_pct is 0-100 representing how much of the sheet the part uses
    // Scrap factor = 1 / (utilization / 100), clamped to [1.05, 1.50]
    const util = Math.max(10, Math.min(95, nestingUtilization)) / 100;
    const scrapFactor = Math.min(1.5, Math.max(1.05, 1 / util));
    console.log(`🔲 Nesting-based scrap factor: ${scrapFactor.toFixed(3)} (utilization: ${nestingUtilization.toFixed(1)}%)`);
    return scrapFactor;
  }

  // Fallback: bbox-based estimate when nesting data is unavailable
  const bbox = geometry.boundingBox;
  const area = bbox.x * bbox.y;

  // Irregular shapes have more scrap
  const utilization = geometry.volume / (area * (geometry.sheetMetalFeatures?.thickness ?? 2));

  if (utilization > 0.8) return 1.15; // Efficient nesting, 15% scrap
  if (utilization > 0.6) return 1.2; // Average, 20% scrap
  return 1.25; // Complex shape, 25% scrap
}

function sheetMetalCuttingTime(geometry: GeometryData): number {
  // Cutting time = perimeter / cutting speed
  // Estimate perimeter from bounding box (rough approximation)
  const perimeter = 2 * (geometry.boundingBox.x + geometry.boundingBox.y);
  const cuttingSpeed = 2000; // mm/min for laser cutting (typical)

  const cuttingTime = perimeter / cuttingSpeed; // minutes

  // Add time for holes and internal cutouts
  const holeCount = geometry.sheetMetalFeatures?.holeCount ?? geometry.advancedFeatures?.holes?.count ?? 0;
  const pierceTime = holeCount * 0.5; // 30 seconds per hole for pierce

  return cuttingTime + pierceTime;
}

function sheetMetalBendingTime(geometry: GeometryData): number {
  // Bending time = number of bends × time per bend
  const bendCount = geometry.sheetMetalFeatures?.bendCount ?? geometry.sheetMetalFeatures?.bends?.length ?? 0;
  const timePerBend = 1.5; // minutes per bend (includes positioning)

  return bendCount * timePerBend;
}

function sheetMetalAssemblyTime(geometry: GeometryData): number {
  // Assembly time for hardware insertion, welding, etc.
  // Simple parts have minimal assembly
  return geometry.complexity === 'simple' ? 2 : 5; // minutes
}

/**
 * Sheet Metal Strategy - Forming and cutting
 */
export const sheetMetalStrategy: PricingStrategy = {
  calculateMaterialCost(geometry: GeometryData, material: SheetMetalMaterialSpec): number {
    // For sheet metal, use developed area (unfolded surface area)
    const developedArea = sheetMetalDevelopedArea(geometry);
    const areaM2 = developedArea / 1_000_000; // mm² to m²

    // Material cost per area
    const costPerM2 = (material.thickness * material.density * material.costPerKg) / 1000;

    // Add scrap factor (uses nesting data when available, otherwise 15-25%)
    const scrapFactor = sheetMetalScrapFactor(geometry);

    // Nesting quantity discount: if we can fit multiple parts per sheet,
    // the per-part material cost decreases
    let nestingDiscount = 1;
    const partsPerSheet = (geometry as any).nesting?.partsPerSheet;
    if (typeof partsPerSheet === 'number' && partsPerSheet > 1) {
      // Each additional part on the same sheet saves shared border scrap
      nestingDiscount = Math.max(0.85, 1 - (partsPerSheet - 1) * 0.02);
    }

    return areaM2 * costPerM2 * scrapFactor * nestingDiscount;
  },

  calculateLaborCost(geometry: GeometryData, hourlyRate: number): number {
    // Sheet metal labor = cutting time + bending time + assembly time
    const cuttingTime = sheetMetalCuttingTime(geometry);
    const bendingTime = sheetMetalBendingTime(geometry);
    const assemblyTime = sheetMetalAssemblyTime(geometry);

    const totalHours = (cuttingTime + bendingTime + assemblyTime) / 60;

    return totalHours * hourlyRate;
  },

  calculateSetupCost(quantity: number, baseSetupCost: number): number {
    // Sheet metal setup includes programming, tool setup, first article
    // Amortize more aggressively for higher volumes
    if (quantity === 1) return baseSetupCost * 1.2; // Single parts have higher relative setup
    if (quantity <= 25) return baseSetupCost / quantity;
    if (quantity <= 100) return baseSetupCost / (quantity * 0.85);
    return baseSetupCost / (quantity * 0.75); // Significant economies of scale
  },

  calculateToolingCost(geometry: GeometryData, laborCost: number): number {
    // Tooling for sheet metal is primarily punch/die wear
    const baseCost = laborCost * 0.06; // Lower than CNC

    // Adjust for bend complexity
    const bendCount = geometry.sheetMetalFeatures?.bendCount ?? geometry.sheetMetalFeatures?.bends?.length ?? 0;
    const bendComplexity = bendCount > 5 ? 1.2 : 1;

    return baseCost * bendComplexity;
  },

  getProcessSpecificAdjustments(geometry: GeometryData): ProcessAdjustments {
    let complexityMultiplier = 1;
    let riskPremium = 0;
    let efficiencyBonus = 0;

    const bendCount = geometry.sheetMetalFeatures?.bendCount ?? geometry.sheetMetalFeatures?.bends?.length ?? 0;
    const hasComplexBends = bendCount > 4;

    // Multiple bends increase complexity
    if (hasComplexBends) {
      complexityMultiplier += 0.15;
    }

    // Sharp bends or tight tolerances increase risk
    const hasSharpBends = geometry.sheetMetalFeatures?.bends?.some((b: any) => b.angle < 90 || b.angle > 135) ?? false;
    if (hasSharpBends) {
      riskPremium += 0.05;
    }

    // Simple flat parts with minimal bends are efficient
    if (bendCount <= 2 && (geometry.sheetMetalFeatures?.complexity === 'simple' || geometry.complexity === 'simple')) {
      efficiencyBonus = 0.12;
    }

    return {
      complexityMultiplier,
      qualityMultiplier: 1,
      riskPremium,
      efficiencyBonus
    };
  }
};

/**
 * CNC Turning Strategy - Rotational parts
 */
export const cncTurningStrategy: PricingStrategy = {
  calculateMaterialCost(geometry: GeometryData, material: MaterialSpec): number {
    // For turning, use cylindrical stock
    const maxDiameter = Math.max(geometry.boundingBox.x, geometry.boundingBox.y);
    const length = geometry.boundingBox.z;

    // Cylindrical stock volume
    const stockVolumeMm3 = Math.PI * Math.pow(maxDiameter / 2, 2) * length;
    const stockVolumeCm3 = stockVolumeMm3 / 1000; // mm³ to cm³ (1 cm³ = 1000 mm³)

    // Turning typically has less waste than milling
    const wasteFactor = 1.15; // 15% waste
    const rawWeightKg = (stockVolumeCm3 * material.density) / 1000 * wasteFactor;

    return rawWeightKg * material.costPerKg;
  },

  calculateLaborCost(geometry: GeometryData, hourlyRate: number): number {
    // Turning is generally faster than milling for rotational parts
    const baseTimeHours = (geometry.estimatedMachiningTime / 60) * 0.7; // 30% faster

    // Adjust for complexity (threads, grooves, etc.)
    let complexityFactor = 1;
    if ((geometry.advancedFeatures?.threads?.count ?? 0) > 0) complexityFactor += 0.3;
    if ((geometry.advancedFeatures?.undercuts?.count ?? 0) > 0) complexityFactor += 0.4;

    return baseTimeHours * complexityFactor * hourlyRate;
  },

  calculateSetupCost(quantity: number, baseSetupCost: number): number {
    // Similar to milling but slightly lower setup time
    return baseSetupCost * 0.9 / Math.max(1, quantity);
  },

  calculateToolingCost(geometry: GeometryData, laborCost: number): number {
    // Turning tools wear differently than milling tools
    return laborCost * 0.1; // 10% tooling cost
  },

  getProcessSpecificAdjustments(_geometry: GeometryData): ProcessAdjustments {
    return {
      complexityMultiplier: 1,
      qualityMultiplier: 1,
      riskPremium: 0,
      efficiencyBonus: 0.05 // Turning is efficient for rotational parts
    };
  }
};

/**
 * Strategy Factory - Returns appropriate strategy for process type
 */
export class PricingStrategyFactory {
  static getStrategy(processType: string): PricingStrategy {
    switch (processType) {
      case 'cnc-milling':
        return cncMillingStrategy;
      case 'sheet-metal':
        return sheetMetalStrategy;
      case 'cnc-turning':
        return cncTurningStrategy;
      default:
        return cncMillingStrategy; // Default fallback
    }
  }
}
