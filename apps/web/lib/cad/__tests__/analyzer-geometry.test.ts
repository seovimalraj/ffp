import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MachiningAnalysisResponse } from "@/types/machining-analysis";
import type { SheetMetalAnalysisResponse } from "@/types/sheet-metal-analysis";

import {
  machiningComplexityFromAnalyzer,
  reconcileProcess,
  requestedProcessProblem,
  sheetMetalComplexityFromAnalyzer,
  sheetMetalFeaturesFromAnalyzer,
} from "../analyzer-geometry";

type SheetOverrides = {
  status?: string;
  confidence?: number;
  isUniform?: boolean;
  thickness?: number;
  volume?: number;
  area?: number;
  warnings?: string[];
  bends?: { length_mm: number; angle_deg?: number }[];
  holes?: { diameter_mm: number }[];
  cutouts?: { perimeter_mm: number }[];
  slots?: { length_mm: number; width_mm: number }[];
  outerPerimeter?: number;
};

// Defaults are the measured sample enclosure: tests/json/sheet-metal.json
function sheet(overrides: SheetOverrides = {}): SheetMetalAnalysisResponse {
  return {
    success: true,
    sheet_metal_candidate: {
      is_candidate: true,
      confidence: overrides.confidence ?? 0.9,
      status: overrides.status ?? "resolved",
      evidence: { dominant_thickness_mm: overrides.thickness ?? 2 },
    },
    thickness: {
      dominant_thickness_mm: overrides.thickness ?? 2,
      is_uniform: overrides.isUniform ?? true,
      method: "paired_planar_faces",
    },
    geometry: {
      volume_mm3: overrides.volume ?? 56773.7,
      surface_area_mm2: overrides.area ?? 60097.1,
    },
    outer_profile: { perimeter_mm: overrides.outerPerimeter ?? 448.32 },
    warnings: (overrides.warnings ?? []).map((code) => ({ code })),
    bends: overrides.bends ?? [],
    holes: overrides.holes ?? [],
    cutouts: overrides.cutouts ?? [],
    slots: overrides.slots ?? [],
    hems: [],
  } as unknown as SheetMetalAnalysisResponse;
}

function machining(
  indicators: Partial<MachiningAnalysisResponse["complexity_indicators"]> = {},
  directions = 1,
  stockForm = "SHEET",
): MachiningAnalysisResponse {
  return {
    success: true,
    complexity_indicators: {
      hole_count: 0,
      pocket_count: 0,
      slot_count: 0,
      bore_count: 0,
      thread_count: 0,
      freeform_surface_count: 0,
      ...indicators,
    },
    setup_analysis: { minimum_direction_count_covering_all: directions },
    suggestions: { stock_form: { form: stockForm } },
  } as unknown as MachiningAnalysisResponse;
}

describe("sheetMetalFeaturesFromAnalyzer", () => {
  it("derives flat area and cut length from a uniform sheet part", () => {
    const features = sheetMetalFeaturesFromAnalyzer(sheet());
    assert.equal(features.thickness, 2);
    assert.equal(Math.round(features.flatArea), 28387);
    assert.equal(Math.round(features.perimeterLength), 1662);
  });

  it("takes hole circumference out of the perimeter, since holes are priced separately", () => {
    const features = sheetMetalFeaturesFromAnalyzer(
      sheet({ holes: [{ diameter_mm: 10 }, { diameter_mm: 10 }] }),
    );
    assert.equal(features.holeCount, 2);
    assert.equal(Math.round(features.totalHoleDiameter), 63);
    assert.equal(Math.round(features.perimeterLength), 1662 - 63);
  });

  it("falls back to detected features when the formula goes negative (motor mount)", () => {
    const features = sheetMetalFeaturesFromAnalyzer(
      sheet({
        status: "rejected",
        thickness: 5,
        volume: 57525.54,
        area: 18096.31,
        outerPerimeter: 253.7,
      }),
    );
    assert.equal(features.perimeterLength, 253.7);
  });

  it("does not trust the formula on a part that isn't clearly sheet (lunch box)", () => {
    // Formula would give 20.7 m here, from freeform surfaces and ribs
    const features = sheetMetalFeaturesFromAnalyzer(
      sheet({
        status: "ambiguous",
        thickness: 1.998,
        volume: 308765.22,
        area: 350488.07,
        outerPerimeter: 537.36,
        cutouts: [{ perimeter_mm: 100 }],
        slots: [{ length_mm: 20, width_mm: 5 }],
      }),
    );
    assert.equal(features.perimeterLength, 537.36 + 100 + 50);
  });

  it("falls back to half the surface area when the reported volume is wrong", () => {
    // Generated L bracket: true flat area is about 6400 mm2, volume says 823
    const features = sheetMetalFeaturesFromAnalyzer(
      sheet({ volume: 1646.02, area: 13396.75, outerPerimeter: 240 }),
    );
    assert.equal(features.flatArea, 13396.75 / 2);
    assert.equal(features.perimeterLength, 240);
  });

  it("falls back to half the surface area when thickness varies", () => {
    const features = sheetMetalFeaturesFromAnalyzer(sheet({ isUniform: false }));
    assert.equal(features.flatArea, 60097.1 / 2);
  });

  it("ignores corner blends too short to be a bend", () => {
    const features = sheetMetalFeaturesFromAnalyzer(
      sheet({
        bends: [
          { length_mm: 124.16 },
          { length_mm: 12 },
          { length_mm: 2 },
          { length_mm: 2 },
        ],
      }),
    );
    assert.equal(features.bendCount, 2);
  });
});

describe("complexity from features", () => {
  it("rates a plain flat sheet simple and a heavily formed part complex", () => {
    assert.equal(sheetMetalComplexityFromAnalyzer(sheet()), "simple");
    const bends = Array.from({ length: 14 }, () => ({ length_mm: 100 }));
    assert.equal(sheetMetalComplexityFromAnalyzer(sheet({ bends })), "complex");
  });

  it("rates machined parts by their features and setups", () => {
    assert.equal(machiningComplexityFromAnalyzer(machining({ hole_count: 4 })), "simple");
    assert.equal(
      machiningComplexityFromAnalyzer(machining({ hole_count: 12, pocket_count: 3 }, 2)),
      "moderate",
    );
    assert.equal(
      machiningComplexityFromAnalyzer(machining({ pocket_count: 12 }, 3)),
      "complex",
    );
  });
});

describe("requestedProcessProblem", () => {
  const withForm = (form: string, status = "resolved") =>
    ({
      sheetMetal: sheet(),
      machining: {
        ...machining(),
        suggestions: { stock_form: { form, status } },
      },
    }) as unknown as Parameters<typeof requestedProcessProblem>[1];

  it("rejects sheet metal for a solid", () => {
    const problem = requestedProcessProblem("sheet-metal", {
      sheetMetal: sheet({ status: "rejected" }),
      machining: machining(),
    });
    assert.match(problem ?? "", /thin, even walls/);
  });

  it("rejects sheet metal for an unbent part with pockets", () => {
    const problem = requestedProcessProblem("sheet-metal", {
      sheetMetal: sheet(),
      machining: machining({ pocket_count: 1 }),
    });
    assert.match(problem ?? "", /pockets/);
  });

  it("allows sheet metal for a bent part with a false pocket", () => {
    const problem = requestedProcessProblem("sheet-metal", {
      sheetMetal: sheet({ bends: [{ length_mm: 60 }] }),
      machining: machining({ pocket_count: 1 }),
    });
    assert.equal(problem, null);
  });

  it("allows sheet metal on an ambiguous part", () => {
    assert.equal(
      requestedProcessProblem("sheet-metal", {
        sheetMetal: sheet({ status: "ambiguous" }),
        machining: machining(),
      }),
      null,
    );
  });

  it("rejects turning for a part that clearly isn't round", () => {
    assert.match(
      requestedProcessProblem("cnc-turning", withForm("BLOCK")) ?? "",
      /round enough/,
    );
  });

  it("allows turning a disc or flange, which reads as a plate", () => {
    assert.equal(requestedProcessProblem("cnc-turning", withForm("PLATE")), null);
    assert.equal(requestedProcessProblem("cnc-turning", withForm("SHEET")), null);
  });

  it("allows turning on round bar, or when the form is unclear", () => {
    assert.equal(requestedProcessProblem("cnc-turning", withForm("ROUND_BAR")), null);
    assert.equal(requestedProcessProblem("cnc-turning", withForm("BLOCK", "ambiguous")), null);
  });

  it("always allows milling, which can make anything", () => {
    assert.equal(requestedProcessProblem("cnc-milling", withForm("SHEET")), null);
  });

  it("allows anything when the analyzers did not run", () => {
    const none = { sheetMetal: null, machining: null };
    assert.equal(requestedProcessProblem("sheet-metal", none), null);
    assert.equal(requestedProcessProblem("cnc-turning", none), null);
  });
});

describe("reconcileProcess", () => {
  it("corrects a folded box the classifier called CNC, and flags it", () => {
    const decision = reconcileProcess("cnc-milling", 0.7, {
      sheetMetal: sheet(),
      machining: machining(),
    });
    assert.equal(decision.process, "sheet-metal");
    assert.equal(decision.overridden, true);
    assert.equal(decision.needsReview, true);
    assert.equal(decision.confidence, 0.85);
  });

  it("leaves even walls as CNC when an unbent part has pockets (milled tray)", () => {
    const decision = reconcileProcess("cnc-milling", 0.9, {
      sheetMetal: sheet(),
      machining: machining({ pocket_count: 1 }),
    });
    assert.equal(decision.process, "cnc-milling");
    assert.equal(decision.needsReview, true);
  });

  it("flags a pocketed tray the classifier called sheet metal", () => {
    const decision = reconcileProcess("sheet-metal", 0.9, {
      sheetMetal: sheet(),
      machining: machining({ pocket_count: 1 }),
    });
    assert.equal(decision.process, "sheet-metal");
    assert.equal(decision.needsReview, true);
  });

  it("still corrects a bent bracket, where the detector reports a false pocket", () => {
    const decision = reconcileProcess("cnc-milling", 0.9, {
      sheetMetal: sheet({ bends: [{ length_mm: 60 }] }),
      machining: machining({ pocket_count: 1 }),
    });
    assert.equal(decision.process, "sheet-metal");
    assert.equal(decision.overridden, true);
  });

  it("does not switch to sheet metal when machining analysis did not finish", () => {
    const decision = reconcileProcess("cnc-milling", 0.9, {
      sheetMetal: sheet(),
      machining: null,
    });
    assert.equal(decision.process, "cnc-milling");
    assert.equal(decision.overridden, false);
    assert.equal(decision.needsReview, true);
  });

  it("corrects a solid the classifier called sheet metal (motor mount)", () => {
    const decision = reconcileProcess("sheet-metal", 0.8, {
      sheetMetal: sheet({ status: "rejected" }),
      machining: machining(),
    });
    assert.equal(decision.process, "cnc-milling");
    assert.equal(decision.overridden, true);
    assert.equal(decision.needsReview, true);
  });

  it("does nothing when both agree it is sheet metal, and keeps the higher confidence", () => {
    const decision = reconcileProcess("sheet-metal", 0.7, {
      sheetMetal: sheet({ confidence: 0.9 }),
      machining: machining(),
    });
    assert.equal(decision.process, "sheet-metal");
    assert.equal(decision.overridden, false);
    assert.equal(decision.needsReview, false);
    assert.equal(decision.confidence, 0.9);
  });

  it("does nothing when both agree it is machined", () => {
    const decision = reconcileProcess("cnc-turning", 0.9, {
      sheetMetal: sheet({ status: "rejected" }),
      machining: machining(),
    });
    assert.equal(decision.process, "cnc-turning");
    assert.equal(decision.needsReview, false);
  });

  it("flags a part with many freeform surfaces instead of calling it sheet", () => {
    const decision = reconcileProcess("cnc-milling", 0.9, {
      sheetMetal: sheet(),
      machining: machining({ freeform_surface_count: 285 }),
    });
    assert.equal(decision.process, "cnc-milling");
    assert.equal(decision.overridden, false);
    assert.equal(decision.needsReview, true);
  });

  it("flags an inconclusive part and keeps the classifier's answer", () => {
    const decision = reconcileProcess("sheet-metal", 0.8, {
      sheetMetal: sheet({ status: "ambiguous" }),
      machining: machining(),
    });
    assert.equal(decision.process, "sheet-metal");
    assert.equal(decision.needsReview, true);
  });

  it("flags an open shell, whose volume can't be trusted, whatever else it shows", () => {
    const decision = reconcileProcess("cnc-milling", 0.9, {
      sheetMetal: sheet({ warnings: ["OPEN_SHELL"] }),
      machining: machining(),
    });
    assert.equal(decision.process, "cnc-milling");
    assert.equal(decision.needsReview, true);
  });

  it("changes nothing when the analyzers did not run", () => {
    const decision = reconcileProcess("cnc-milling", 0.9, {
      sheetMetal: null,
      machining: null,
    });
    assert.deepEqual(decision, {
      process: "cnc-milling",
      confidence: 0.9,
      needsReview: false,
      overridden: false,
      reason: undefined,
    });
  });

  it("never overrides a manual quote", () => {
    const decision = reconcileProcess("manual-quote", 0, {
      sheetMetal: sheet(),
      machining: machining(),
    });
    assert.equal(decision.process, "manual-quote");
  });
});
