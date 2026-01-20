/**
 * Advanced Cost Calculator Service
 * Centralized cost calculation with caching and optimization
 */

import { GeometryData } from "../cad-analysis";
import { MaterialSpec, SheetMetalMaterialSpec, ProcessConfig, FinishOption, SheetMetalFinish, PricingInput, PricingBreakdown } from "../pricing-engine";
import { PricingStrategyFactory, ProcessAdjustments } from "./pricing-strategies";

/**
 * Cache for cost calculations to avoid redundant computation
 */
class CostCalculationCache {
  private cache: Map<string, any> = new Map();
  private maxSize: number = 1000;
  
  getCacheKey(input: Partial<PricingInput>): string {
    // Generate cache key from geometry and process
    const key = JSON.stringify({
      volume: input.geometry?.volume,
      bbox: input.geometry?.boundingBox,
      complexity: input.geometry?.complexity,
      process: input.process?.type,
      material: (input.material as any)?.code,
      quantity: input.quantity
    });
    return key;
  }
  
  get(key: string): any | null {
    return this.cache.get(key) || null;
  }
  
  set(key: string, value: any): void {
    if (this.cache.size >= this.maxSize) {
      // Simple LRU: remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Advanced Cost Calculator with intelligent pricing
 */
export class AdvancedCostCalculator {
  private cache: CostCalculationCache;
  
  constructor() {
    this.cache = new CostCalculationCache();
  }
  
  /**
   * Calculate comprehensive pricing breakdown
   */
  calculate(input: PricingInput): PricingBreakdown {
    // Check cache
    const cacheKey = this.cache.getCacheKey(input);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log("💰 Using cached pricing calculation");
      return cached;
    }
    
    // Get appropriate pricing strategy
    const strategy = PricingStrategyFactory.getStrategy(input.process.type);
    
    // Calculate base costs using strategy
    const materialCost = strategy.calculateMaterialCost(input.geometry, input.material);
    const laborCost = strategy.calculateLaborCost(input.geometry, input.process.hourlyRate);
    const setupCost = strategy.calculateSetupCost(input.quantity, input.process.setupCost);
    const toolingCost = strategy.calculateToolingCost(input.geometry, laborCost);
    
    // Calculate finish cost
    const surfaceAreaCm2 = input.geometry.surfaceArea / 100;
    const finishCost = input.finish.baseCost + (input.finish.perAreaCost * surfaceAreaCm2);
    
    // Get process-specific adjustments
    const adjustments = strategy.getProcessSpecificAdjustments(input.geometry);
    
    // Calculate inspection cost based on tolerance
    const inspectionCost = this.calculateInspectionCost(
      materialCost + laborCost,
      input.tolerance
    );
    
    // Calculate overhead (10% of direct costs)
    const directCosts = materialCost + laborCost + setupCost + finishCost + toolingCost + inspectionCost;
    const overheadCost = directCosts * 0.10;
    
    // Apply process-specific adjustments
    const adjustedCosts = directCosts * adjustments.complexityMultiplier;
    const riskPremium = adjustedCosts * adjustments.riskPremium;
    
    // Calculate margin (8% competitive)
    const costBeforeMargin = adjustedCosts + overheadCost + riskPremium;
    const marginCost = costBeforeMargin * 0.08;
    
    // Calculate volume discount
    const volumeDiscount = this.calculateVolumeDiscount(input.quantity, materialCost);
    
    // Calculate tolerance upcharge
    const toleranceUpcharge = this.calculateToleranceUpcharge(costBeforeMargin, input.tolerance);
    
    // Calculate lead time multiplier
    const leadTimeMultiplier = this.getLeadTimeMultiplier(input.leadTimeType);
    
    // Calculate final total
    const subtotal = costBeforeMargin + marginCost;
    const total = (subtotal - volumeDiscount + toleranceUpcharge) * leadTimeMultiplier;
    
    // Build breakdown
    const breakdown: PricingBreakdown = {
      materialCost: materialCost * input.quantity,
      machiningCost: laborCost * input.quantity,
      setupCost: setupCost * input.quantity,
      finishCost: finishCost * input.quantity,
      toolingCost: toolingCost * input.quantity,
      inspectionCost: inspectionCost * input.quantity,
      overheadCost: overheadCost * input.quantity,
      marginCost: marginCost * input.quantity,
      subtotal: subtotal * input.quantity,
      quantityDiscount: volumeDiscount * input.quantity,
      toleranceUpcharge: toleranceUpcharge * input.quantity,
      leadTimeMultiplier: leadTimeMultiplier,
      demandAdjustment: 0,
      complexityRiskPremium: riskPremium * input.quantity,
      materialDifficultyPremium: 0,
      batchOptimizationBonus: adjustments.efficiencyBonus * subtotal * input.quantity,
      totalPerUnit: total,
      totalPrice: total * input.quantity,
      unitBreakdown: {
        material: materialCost,
        labor: laborCost,
        setup: setupCost,
        finish: finishCost,
        tooling: toolingCost,
        inspection: inspectionCost,
        overhead: overheadCost,
        margin: marginCost
      }
    };
    
    // Cache result
    this.cache.set(cacheKey, breakdown);
    
    return breakdown;
  }
  
  /**
   * Calculate inspection cost based on tolerance requirements
   */
  private calculateInspectionCost(baseCost: number, tolerance: string): number {
    const toleranceFactors = {
      standard: 0.03,   // 3% for basic inspection
      precision: 0.08,  // 8% for precision measurement
      tight: 0.15       // 15% for tight tolerance verification
    };
    
    return baseCost * (toleranceFactors[tolerance as keyof typeof toleranceFactors] || toleranceFactors.standard);
  }
  
  /**
   * Calculate volume discount with intelligent scaling
   */
  private calculateVolumeDiscount(quantity: number, materialCost: number): number {
    let discountPercent = 0;
    
    if (quantity >= 100) {
      discountPercent = 0.25; // 25% discount for large volumes
    } else if (quantity >= 50) {
      discountPercent = 0.18; // 18% discount
    } else if (quantity >= 25) {
      discountPercent = 0.12; // 12% discount
    } else if (quantity >= 10) {
      discountPercent = 0.08; // 8% discount
    } else if (quantity >= 5) {
      discountPercent = 0.04; // 4% discount
    }
    
    // Discount applies primarily to material and setup costs
    return materialCost * discountPercent;
  }
  
  /**
   * Calculate tolerance upcharge
   */
  private calculateToleranceUpcharge(baseCost: number, tolerance: string): number {
    const upchargeFactors = {
      standard: 0,      // No upcharge for standard
      precision: 0.15,  // 15% upcharge
      tight: 0.25       // 25% upcharge
    };
    
    return baseCost * (upchargeFactors[tolerance as keyof typeof upchargeFactors] || 0);
  }
  
  /**
   * Get lead time pricing multiplier
   */
  private getLeadTimeMultiplier(leadTimeType: string): number {
    const multipliers = {
      economy: 0.90,    // 10% discount for longer lead time
      standard: 1.00,   // Normal pricing
      expedited: 1.35   // 35% upcharge for rush
    };
    
    return multipliers[leadTimeType as keyof typeof multipliers] || 1.0;
  }
  
  /**
   * Calculate price for multiple quantities (matrix pricing)
   */
  calculatePriceMatrix(input: Omit<PricingInput, 'quantity'>, quantities: number[]): Array<{ quantity: number; pricePerUnit: number; totalPrice: number }> {
    return quantities.map(qty => {
      const breakdown = this.calculate({ ...input, quantity: qty });
      return {
        quantity: qty,
        pricePerUnit: breakdown.totalPerUnit,
        totalPrice: breakdown.totalPrice
      };
    });
  }
  
  /**
   * Clear calculation cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Singleton instance for application-wide use
 */
export const costCalculator = new AdvancedCostCalculator();
