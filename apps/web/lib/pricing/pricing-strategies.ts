/**
 * Advanced Pricing Strategies using Strategy Pattern
 * Each manufacturing process has its own pricing strategy
 */

import { GeometryData } from "../cad-analysis";
import { MaterialSpec, SheetMetalMaterialSpec, PricingInput } from "../pricing-engine";

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

/**
 * CNC Milling Strategy - Subtractive manufacturing
 */
export class CNCMillingStrategy implements PricingStrategy {
  calculateMaterialCost(geometry: GeometryData, material: MaterialSpec): number {
    // Use bounding box for stock material + waste factor
    const bboxVolumeMm3 = geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z;
    const bboxVolumeCm3 = bboxVolumeMm3 / 1000; // CRITICAL: mm³ to cm³ (1 cm = 10mm, so 1 cm³ = 1000 mm³)
    
    // Account for material waste (typically 20-40% for CNC)
    const wasteFactor = this.calculateWasteFactor(geometry);
    const rawWeightKg = (bboxVolumeCm3 * material.density) / 1000 * wasteFactor;
    
    return rawWeightKg * material.costPerKg;
  }

  calculateLaborCost(geometry: GeometryData, hourlyRate: number): number {
    // Base time from geometry + complexity adjustments
    const baseTimeHours = geometry.estimatedMachiningTime / 60;
    
    // Adjust for complexity
    const complexityFactors = {
      simple: 0.8,
      moderate: 1.0,
      complex: 1.4
    };
    
    const adjustedTime = baseTimeHours * complexityFactors[geometry.complexity];
    
    // Add setup time for tool changes, part repositioning
    const setupTime = this.estimateSetupTime(geometry);
    
    return (adjustedTime + setupTime) * hourlyRate;
  }

  calculateSetupCost(quantity: number, baseSetupCost: number): number {
    // Amortize setup over quantity with economies of scale
    if (quantity === 1) return baseSetupCost;
    if (quantity <= 10) return baseSetupCost / quantity;
    if (quantity <= 50) return baseSetupCost / (quantity * 0.9); // 10% efficiency bonus
    return baseSetupCost / (quantity * 0.8); // 20% efficiency bonus for large batches
  }

  calculateToolingCost(geometry: GeometryData, laborCost: number): number {
    // Tool wear is proportional to machining time and complexity
    const complexityMultipliers = {
      simple: 0.08,
      moderate: 0.12,
      complex: 0.18
    };
    
    const baseToolingCost = laborCost * complexityMultipliers[geometry.complexity];
    
    // Adjust for hard-to-machine features
    let adjustment = 1.0;
    if (geometry.advancedFeatures?.deepHoles) {
      adjustment += geometry.advancedFeatures.deepHoles.count * 0.02;
    }
    if (geometry.advancedFeatures?.undercuts) {
      adjustment += 0.15; // Undercuts require special tools
    }
    
    return baseToolingCost * adjustment;
  }

  getProcessSpecificAdjustments(geometry: GeometryData): ProcessAdjustments {
    let complexityMultiplier = 1.0;
    let riskPremium = 0;
    let efficiencyBonus = 0;
    
    // Analyze geometric features
    const metrics = this.analyzeGeometry(geometry);
    
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
    if (geometry.complexity === 'simple' && !geometry.advancedFeatures) {
      efficiencyBonus = 0.10; // 10% discount
    }
    
    return {
      complexityMultiplier,
      qualityMultiplier: 1.0,
      riskPremium,
      efficiencyBonus
    };
  }

  private calculateWasteFactor(geometry: GeometryData): number {
    // Calculate how much material is wasted
    const volumeEfficiency = geometry.volume / 
      (geometry.boundingBox.x * geometry.boundingBox.y * geometry.boundingBox.z);
    
    // More material removed = more waste
    if (volumeEfficiency > 0.7) return 1.1; // Solid part, 10% waste
    if (volumeEfficiency > 0.5) return 1.2; // Moderate hollowing, 20% waste
    if (volumeEfficiency > 0.3) return 1.3; // Significant material removal, 30% waste
    return 1.4; // Highly complex, 40% waste
  }

  private estimateSetupTime(geometry: GeometryData): number {
    // Estimate hours for setup operations
    let setupHours = 0.25; // Base 15 minutes
    
    // Add time for complex setups
    if (geometry.complexity === 'complex') setupHours += 0.25;
    if (geometry.advancedFeatures?.requires5Axis) setupHours += 0.5;
    
    return setupHours;
  }

  private analyzeGeometry(geometry: GeometryData): {
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
}

/**
 * Sheet Metal Strategy - Forming and cutting
 */
export class SheetMetalStrategy implements PricingStrategy {
  calculateMaterialCost(geometry: GeometryData, material: SheetMetalMaterialSpec): number {
    // For sheet metal, use developed area (unfolded surface area)
    const developedArea = this.calculateDevelopedArea(geometry);
    const areaM2 = developedArea / 1_000_000; // mm² to m²
    
    // Material cost per area
    const costPerM2 = (material.thickness * material.density * material.costPerKg) / 1000;
    
    // Add scrap factor (typically 15-25% for sheet metal)
    const scrapFactor = this.calculateScrapFactor(geometry);
    
    return areaM2 * costPerM2 * scrapFactor;
  }

  calculateLaborCost(geometry: GeometryData, hourlyRate: number): number {
    // Sheet metal labor = cutting time + bending time + assembly time
    const cuttingTime = this.estimateCuttingTime(geometry);
    const bendingTime = this.estimateBendingTime(geometry);
    const assemblyTime = this.estimateAssemblyTime(geometry);
    
    const totalHours = (cuttingTime + bendingTime + assemblyTime) / 60;
    
    return totalHours * hourlyRate;
  }

  calculateSetupCost(quantity: number, baseSetupCost: number): number {
    // Sheet metal setup includes programming, tool setup, first article
    // Amortize more aggressively for higher volumes
    if (quantity === 1) return baseSetupCost * 1.2; // Single parts have higher relative setup
    if (quantity <= 25) return baseSetupCost / quantity;
    if (quantity <= 100) return baseSetupCost / (quantity * 0.85);
    return baseSetupCost / (quantity * 0.75); // Significant economies of scale
  }

  calculateToolingCost(geometry: GeometryData, laborCost: number): number {
    // Tooling for sheet metal is primarily punch/die wear
    const baseCost = laborCost * 0.06; // Lower than CNC
    
    // Adjust for bend complexity
    const bendCount = geometry.sheetMetalFeatures?.bends?.length ?? 0;
    const bendComplexity = bendCount > 5 ? 1.2 : 1.0;
    
    return baseCost * bendComplexity;
  }

  getProcessSpecificAdjustments(geometry: GeometryData): ProcessAdjustments {
    let complexityMultiplier = 1.0;
    let riskPremium = 0;
    let efficiencyBonus = 0;
    
    const bendCount = geometry.sheetMetalFeatures?.bends?.length ?? 0;
    const hasComplexBends = bendCount > 4;
    
    // Multiple bends increase complexity
    if (hasComplexBends) {
      complexityMultiplier += 0.15;
    }
    
    // Sharp bends or tight tolerances increase risk
    const hasSharpBends = geometry.sheetMetalFeatures?.bends?.some(b => b.angle < 90 || b.angle > 135);
    if (hasSharpBends) {
      riskPremium += 0.05;
    }
    
    // Simple flat parts with minimal bends are efficient
    if (bendCount <= 2 && geometry.complexity === 'simple') {
      efficiencyBonus = 0.12;
    }
    
    return {
      complexityMultiplier,
      qualityMultiplier: 1.0,
      riskPremium,
      efficiencyBonus
    };
  }

  private calculateDevelopedArea(geometry: GeometryData): number {
    // Estimate developed (unfolded) surface area
    // For accurate calculation, need bend deduction, but use surface area + 10% for bends
    const bendFactor = (geometry.sheetMetalFeatures?.bends?.length ?? 0) * 0.02 + 1.0;
    return geometry.surfaceArea * bendFactor;
  }

  private calculateScrapFactor(geometry: GeometryData): number {
    // Sheet metal scrap depends on nesting efficiency
    const bbox = geometry.boundingBox;
    const area = bbox.x * bbox.y;
    
    // Irregular shapes have more scrap
    const utilization = geometry.volume / (area * (geometry.sheetMetalFeatures?.thickness ?? 2));
    
    if (utilization > 0.8) return 1.15; // Efficient nesting, 15% scrap
    if (utilization > 0.6) return 1.20; // Average, 20% scrap
    return 1.25; // Complex shape, 25% scrap
  }

  private estimateCuttingTime(geometry: GeometryData): number {
    // Cutting time = perimeter / cutting speed
    // Estimate perimeter from bounding box (rough approximation)
    const perimeter = 2 * (geometry.boundingBox.x + geometry.boundingBox.y);
    const cuttingSpeed = 2000; // mm/min for laser cutting (typical)
    
    const cuttingTime = perimeter / cuttingSpeed; // minutes
    
    // Add time for holes and internal cutouts
    const holeCount = geometry.partCharacteristics?.holeCount ?? 0;
    const pierceTime = holeCount * 0.5; // 30 seconds per hole for pierce
    
    return cuttingTime + pierceTime;
  }

  private estimateBendingTime(geometry: GeometryData): number {
    // Bending time = number of bends × time per bend
    const bendCount = geometry.sheetMetalFeatures?.bends?.length ?? 0;
    const timePerBend = 1.5; // minutes per bend (includes positioning)
    
    return bendCount * timePerBend;
  }

  private estimateAssemblyTime(geometry: GeometryData): number {
    // Assembly time for hardware insertion, welding, etc.
    // Simple parts have minimal assembly
    return geometry.complexity === 'simple' ? 2 : 5; // minutes
  }
}

/**
 * CNC Turning Strategy - Rotational parts
 */
export class CNCTurningStrategy implements PricingStrategy {
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
  }

  calculateLaborCost(geometry: GeometryData, hourlyRate: number): number {
    // Turning is generally faster than milling for rotational parts
    const baseTimeHours = (geometry.estimatedMachiningTime / 60) * 0.7; // 30% faster
    
    // Adjust for complexity (threads, grooves, etc.)
    let complexityFactor = 1.0;
    if (geometry.advancedFeatures?.threads) complexityFactor += 0.3;
    if (geometry.advancedFeatures?.undercuts) complexityFactor += 0.4;
    
    return baseTimeHours * complexityFactor * hourlyRate;
  }

  calculateSetupCost(quantity: number, baseSetupCost: number): number {
    // Similar to milling but slightly lower setup time
    return baseSetupCost * 0.9 / Math.max(1, quantity);
  }

  calculateToolingCost(geometry: GeometryData, laborCost: number): number {
    // Turning tools wear differently than milling tools
    return laborCost * 0.10; // 10% tooling cost
  }

  getProcessSpecificAdjustments(geometry: GeometryData): ProcessAdjustments {
    return {
      complexityMultiplier: 1.0,
      qualityMultiplier: 1.0,
      riskPremium: 0,
      efficiencyBonus: 0.05 // Turning is efficient for rotational parts
    };
  }
}

/**
 * Strategy Factory - Returns appropriate strategy for process type
 */
export class PricingStrategyFactory {
  static getStrategy(processType: string): PricingStrategy {
    switch (processType) {
      case 'cnc-milling':
        return new CNCMillingStrategy();
      case 'sheet-metal':
        return new SheetMetalStrategy();
      case 'cnc-turning':
        return new CNCTurningStrategy();
      default:
        return new CNCMillingStrategy(); // Default fallback
    }
  }
}
