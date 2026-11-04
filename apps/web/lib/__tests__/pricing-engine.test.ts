import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GeometryData } from "../cad-analysis";
import {
  calculatePricing,
  estimateCncMachiningMinutes,
  getFinish,
  getMaterialForProcess,
  getSheetMetalMaterialForThickness,
  isPricingLocked,
  normalizeSelectableProcess,
  PROCESSES,
} from "../pricing-engine";

function cncGeometry(overrides: Partial<GeometryData> = {}): GeometryData {
  return {
    volume: 30_000,
    surfaceArea: 9_000,
    boundingBox: { x: 60, y: 40, z: 20 },
    complexity: "moderate",
    estimatedMachiningTime: 30,
    dfmIssues: [],
    ...overrides,
  } as GeometryData;
}

function sheetGeometry(x: number, y: number, bendCount = 0): GeometryData {
  return {
    volume: x * y * 2,
    surfaceArea: x * y * 2,
    boundingBox: { x, y, z: 2 },
    complexity: "simple",
    estimatedMachiningTime: 5,
    dfmIssues: [],
    sheetMetalFeatures: {
      thickness: 2,
      flatArea: x * y,
      perimeterLength: 2 * (x + y),
      bendCount,
      holeCount: 0,
      totalHoleDiameter: 0,
      cornerCount: 4,
      complexCuts: 0,
      hasHems: false,
      hasCountersinks: false,
    },
  } as unknown as GeometryData;
}

type Options = Partial<{
  finish: string;
  quantity: number;
  tolerance: "standard" | "precision" | "tight";
  leadTimeType: "economy" | "standard" | "expedited";
}>;

function priceCnc(geometry: GeometryData, options: Options = {}) {
  return calculatePricing({
    geometry,
    material: getMaterialForProcess("aluminum-6061", "cnc-milling")!,
    process: PROCESSES["cnc-milling"],
    finish: getFinish(options.finish ?? "as-machined", "cnc-milling"),
    quantity: options.quantity ?? 1,
    tolerance: options.tolerance ?? "standard",
    leadTimeType: options.leadTimeType ?? "standard",
  });
}

function priceSheet(geometry: GeometryData, options: Options = {}) {
  return calculatePricing({
    geometry,
    material: getMaterialForProcess("AL5052-2.0", "sheet-metal")!,
    process: PROCESSES["sheet-metal"],
    finish: getFinish(options.finish ?? "as-cut", "sheet-metal"),
    quantity: options.quantity ?? 1,
    tolerance: options.tolerance ?? "standard",
    leadTimeType: options.leadTimeType ?? "standard",
  });
}

describe("getSheetMetalMaterialForThickness", () => {
  it("picks the closest stock gauge to the detected thickness", () => {
    assert.equal(getSheetMetalMaterialForThickness(1.5).code, "AL5052-1.5");
    assert.equal(getSheetMetalMaterialForThickness(1.998).code, "AL5052-2.0");
    assert.equal(getSheetMetalMaterialForThickness(0.9).thickness, 0.8);
  });

  it("uses 2 mm when there is no usable thickness", () => {
    assert.equal(getSheetMetalMaterialForThickness(undefined).thickness, 2);
    assert.equal(getSheetMetalMaterialForThickness(0).thickness, 2);
  });
});

describe("normalizeSelectableProcess", () => {
  it("maps the old admin value and missing values to CNC milling", () => {
    assert.equal(normalizeSelectableProcess("cnc-machining"), "cnc-milling");
    assert.equal(normalizeSelectableProcess(undefined), "cnc-milling");
  });

  it("leaves real processes unchanged", () => {
    assert.equal(normalizeSelectableProcess("cnc-turning"), "cnc-turning");
    assert.equal(normalizeSelectableProcess("sheet-metal"), "sheet-metal");
  });
});

describe("isPricingLocked", () => {
  it("locks a quote once an order exists or payment has started", () => {
    assert.equal(isPricingLocked({ status: "paid" }), true);
    assert.equal(isPricingLocked({ status: "payment pending" }), true);
    assert.equal(isPricingLocked({ status: "submitted", order_id: "order-1" }), true);
  });

  it("locks a manual quote, whose prices are entered by an admin", () => {
    assert.equal(isPricingLocked({ status: "pending approval", rfq_type: "manual" }), true);
  });

  it("leaves an open general quote unlocked", () => {
    assert.equal(isPricingLocked({ status: "draft", rfq_type: "general", order_id: null }), false);
    assert.equal(isPricingLocked({}), false);
  });
});

describe("tolerance upcharge", () => {
  it("adds 15% and 30% of subtotal to the CNC price", () => {
    const precision = priceCnc(cncGeometry(), { tolerance: "precision" });
    const tight = priceCnc(cncGeometry(), { tolerance: "tight" });

    assert.equal(precision.toleranceUpcharge, Number((precision.subtotal * 0.15).toFixed(2)));
    assert.equal(tight.toleranceUpcharge, Number((tight.subtotal * 0.3).toFixed(2)));
  });

  it("applies the same rates to sheet metal", () => {
    const precision = priceSheet(sheetGeometry(300, 300), { tolerance: "precision" });
    assert.equal(precision.toleranceUpcharge, Number((precision.subtotal * 0.15).toFixed(2)));
  });
});

describe("lead time multipliers", () => {
  it("prices economy, standard and expedited at 0.85, 1 and 1.35", () => {
    const geometry = cncGeometry();
    assert.equal(priceCnc(geometry, { leadTimeType: "economy" }).leadTimeMultiplier, 0.85);
    assert.equal(priceCnc(geometry, { leadTimeType: "standard" }).leadTimeMultiplier, 1);
    assert.equal(priceCnc(geometry, { leadTimeType: "expedited" }).leadTimeMultiplier, 1.35);
  });
});

describe("getFinish", () => {
  it("uses the CNC per-cm² rate for zinc on a CNC part", () => {
    assert.equal(getFinish("zinc-plated", "cnc-milling").perAreaCost, 0.04);
    assert.equal(priceCnc(cncGeometry(), { finish: "zinc-plated" }).finishCost, 18.6);
  });

  it("uses the per-m² rate for zinc on a sheet metal part", () => {
    assert.equal(getFinish("zinc-plated", "sheet-metal").perAreaCost, 5);
  });

  it("gives chrome and nickel a real CNC rate", () => {
    assert.ok(getFinish("chrome-plated", "cnc-milling").perAreaCost > 0);
    assert.ok(getFinish("nickel-plated", "cnc-milling").perAreaCost > 0);
  });

  it("resolves values from the quote page's sheet metal dropdown", () => {
    assert.equal(getFinish("deburring", "sheet-metal").code, "DEBURRED");
    assert.equal(getFinish("powder-coated", "sheet-metal").code, "PC-BLACK");
    assert.equal(getFinish("powder-coated-custom", "sheet-metal").code, "PC-CUSTOM");
    assert.equal(getFinish("anodized-clear", "sheet-metal").code, "ANOD-T2");
    assert.equal(getFinish("electropolished", "sheet-metal").code, "EPOL-SM");
  });

  it("maps each process's no-finish default to the other process", () => {
    assert.equal(getFinish("as-cut", "cnc-milling").code, "AS-MACH");
    assert.equal(getFinish("as-machined", "sheet-metal").code, "AS-CUT");
  });

  it("defaults a missing finish to the process's no-finish option", () => {
    assert.equal(getFinish(undefined, "cnc-milling").code, "AS-MACH");
    assert.equal(getFinish(null, "sheet-metal").code, "AS-CUT");
  });

  it("sends an unknown finish to manual quote instead of pricing it free", () => {
    const pricing = priceCnc(cncGeometry(), { finish: "gold-leaf" });
    assert.equal(pricing.requiresManualQuote, true);
    assert.equal(pricing.totalPrice, 0);
    assert.match(pricing.manualQuoteReason ?? "", /gold-leaf/);
  });
});

describe("CNC finish base fee", () => {
  it("is split across the batch", () => {
    const geometry = cncGeometry();
    const single = priceCnc(geometry, { finish: "anodized-clear" });
    const batch = priceCnc(geometry, { finish: "anodized-clear", quantity: 100 });
    // base $18 + $0.05/cm² × 90 cm² = $22.50 at qty 1; $0.18 + $4.50 at qty 100
    assert.equal(single.finishCost, 22.5);
    assert.equal(batch.finishCost, 4.68);
  });
});

describe("estimateCncMachiningMinutes", () => {
  const cube = (volumeCm3: number, surfaceAreaCm2: number) =>
    cncGeometry({
      volume: volumeCm3 * 1000,
      surfaceArea: surfaceAreaCm2 * 100,
      boundingBox: { x: 100, y: 100, z: 100 },
      complexity: "simple",
    });

  it("charges a solid block less than the same block with most material removed", () => {
    const solid = estimateCncMachiningMinutes(cube(1000, 600), "cnc-milling");
    const hollowed = estimateCncMachiningMinutes(cube(300, 600), "cnc-milling");
    assert.ok(solid < hollowed, `${solid} should be less than ${hollowed}`);
  });

  it("calculates from removed volume, surface and features", () => {
    const minutes = estimateCncMachiningMinutes(
      cncGeometry({
        volume: 900_000,
        surfaceArea: 60_000,
        boundingBox: { x: 95, y: 95, z: 95 },
        complexity: "moderate",
        advancedFeatures: {
          holes: { count: 4 },
          pockets: { count: 2 },
          threads: { count: 1 },
          fillets: { count: 10 },
        } as unknown as GeometryData["advancedFeatures"],
      }),
      "cnc-milling",
    );
    // 100 mm stock cube: (1000 - 900) cm³ × 0.2 + 600 cm² × 0.05 + 4 + 6 + 2 + 3
    assert.equal(Math.round(minutes), 65);
  });

  it("uses round bar stock for turning, so a cylinder has little to remove", () => {
    const shaft = cncGeometry({
      volume: Math.PI * 25 * 25 * 100,
      surfaceArea: 19_000,
      boundingBox: { x: 50, y: 50, z: 100 },
      complexity: "simple",
    });
    assert.ok(
      estimateCncMachiningMinutes(shaft, "cnc-turning") <
        estimateCncMachiningMinutes(shaft, "cnc-milling"),
    );
  });

  it("uses the analyzer's removed volume when it is available", () => {
    const geometry = cncGeometry({
      volume: 900_000,
      surfaceArea: 0,
      boundingBox: { x: 95, y: 95, z: 95 },
      complexity: "moderate",
      stockAnalysis: { stockVolumeMm3: 1_000_000, removedVolumeMm3: 200_000 },
    });
    assert.equal(estimateCncMachiningMinutes(geometry, "cnc-milling"), 40);
  });

  it("falls back to the saved time when the volume is unusable", () => {
    assert.equal(
      estimateCncMachiningMinutes(cncGeometry({ volume: 0, estimatedMachiningTime: 42 }), "cnc-milling"),
      42,
    );
  });

  it("never goes below the minimum handling time", () => {
    const nearlySolid = cncGeometry({
      volume: 124,
      surfaceArea: 100,
      boundingBox: { x: 0.5, y: 0.5, z: 0.5 },
      complexity: "simple",
    });
    assert.equal(estimateCncMachiningMinutes(nearlySolid, "cnc-milling"), 5);
  });
});

describe("sheet metal pricing", () => {
  it("calculates material weight in kg", () => {
    // 0.25 m² × 2 mm × 2.68 g/cm³ = 1.34 kg, with 15% scrap
    const pricing = priceSheet(sheetGeometry(500, 500));
    const material = getMaterialForProcess("AL5052-2.0", "sheet-metal")!;
    assert.equal(pricing.materialCost, Number((1.34 * material.costPerKg * 1.15).toFixed(2)));
  });

  it("costs more for a larger part", () => {
    const small = priceSheet(sheetGeometry(100, 100)).unitPrice;
    const large = priceSheet(sheetGeometry(690, 690)).unitPrice;
    assert.ok(large > small + 15, `${large} should be well above ${small}`);
  });

  it("prices a part with no sheet metal features instead of throwing", () => {
    const pricing = priceSheet(cncGeometry({ boundingBox: { x: 200, y: 150, z: 3 } }));
    assert.equal(pricing.requiresManualQuote, false);
    assert.ok(pricing.unitPrice > 0);
    assert.ok(Number.isFinite(pricing.leadTimeDays));
  });

  it("no longer adds the quality premium or markup", () => {
    const pricing = priceSheet(sheetGeometry(300, 300));
    assert.equal(pricing.qualityPremiumAdjustment, undefined);
    assert.ok(pricing.unitPrice < pricing.subtotal * 1.1, `${pricing.unitPrice} vs ${pricing.subtotal}`);
  });
});
