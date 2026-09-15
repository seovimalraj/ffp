import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AnyMachiningFeature } from "@/types/machining-analysis";

import { subgroupFeatures } from "../format";

function hole(id: string, diameter_mm: number): AnyMachiningFeature {
  return {
    id,
    type: "hole",
    status: "resolved",
    reason: null,
    face_ids: [],
    detection: { method: "geometry", confidence: 1, evidence: [], source: "GEOMETRY" },
    subtype: "through",
    diameter_mm,
    radius_mm: diameter_mm / 2,
    depth_mm: 10,
    through: true,
    position: { x: 0, y: 0, z: 0 },
    axis: { x: 0, y: 0, z: 1 },
    quantity: 1,
    depth_diameter_ratio: null,
    is_stepped: false,
    has_counterbore: false,
    has_countersink: false,
    counterbore_diameter_mm: null,
    counterbore_depth_mm: null,
    countersink_diameter_mm: null,
    countersink_angle_deg: null,
    counterbores: [],
    steps: [],
    coaxial_feature_ids: [],
    thread_candidate: null,
  } as unknown as AnyMachiningFeature;
}

function pocket(id: string, length_mm: number, width_mm: number): AnyMachiningFeature {
  return {
    id,
    type: "pocket",
    status: "resolved",
    reason: null,
    face_ids: [],
    detection: { method: "geometry", confidence: 1, evidence: [], source: "GEOMETRY" },
    length_mm,
    width_mm,
    depth_mm: 5,
    area_mm2: length_mm * width_mm,
    bottom_type: "planar",
    closed: true,
    corner_radius_mm: null,
    minimum_internal_radius_mm: null,
    machining_direction: [0, 0, 1],
    position: { x: 0, y: 0, z: 0 },
    depth_width_ratio: null,
    wall_count: 4,
  } as unknown as AnyMachiningFeature;
}

describe("subgroupFeatures", () => {
  it("buckets same-diameter holes together, distinct diameters apart", () => {
    const groups = subgroupFeatures([
      hole("HOLE-001", 32.5),
      hole("HOLE-002", 32.5),
      hole("HOLE-003", 38),
    ]);
    assert.equal(groups.length, 2);
    const byLabel = new Map(groups.map((g) => [g.label, g.features.map((f) => f.id)]));
    assert.deepEqual(byLabel.get("⌀ 32.5"), ["HOLE-001", "HOLE-002"]);
    assert.deepEqual(byLabel.get("⌀ 38"), ["HOLE-003"]);
  });

  it("rounds away kernel precision noise before bucketing", () => {
    const groups = subgroupFeatures([
      hole("HOLE-001", 32.500000002),
      hole("HOLE-002", 32.499999998),
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].features.length, 2);
  });

  it("buckets pockets by length x width, not by length or width alone", () => {
    const groups = subgroupFeatures([
      pocket("POCKET-001", 48, 9.91),
      pocket("POCKET-002", 48, 9.91),
      pocket("POCKET-003", 48, 20),
    ]);
    assert.equal(groups.length, 2);
    const labels = groups.map((g) => g.label).sort();
    assert.deepEqual(labels, ["48 × 20", "48 × 9.91"]);
  });

  it("falls back to one 'Unspecified size' bucket rather than dropping or mis-bucketing", () => {
    const noDiameter = { ...hole("HOLE-001", 10), diameter_mm: undefined } as unknown as AnyMachiningFeature;
    const groups = subgroupFeatures([noDiameter]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].label, "Unspecified size");
    assert.equal(groups[0].features.length, 1);
  });

  it("sorts labels naturally (numeric order, not string order)", () => {
    const groups = subgroupFeatures([
      hole("HOLE-001", 9),
      hole("HOLE-002", 38),
      hole("HOLE-003", 45),
    ]);
    assert.deepEqual(
      groups.map((g) => g.label),
      ["⌀ 9", "⌀ 38", "⌀ 45"],
    );
  });
});
