import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDxf2DFeatureModel } from "../dxf-preview-feature-model";
import {
  buildDxfPreviewDimensionPlan,
  buildDxfPreviewDimensions,
  selectDxfPreviewDimensionsFromPlan,
} from "../dxf-preview-dimensions";
import { createLoadedDxfDocument } from "../dxf-preview-session";

describe("dxf-preview-dimensions", () => {
  it("groups repeated equal-diameter holes into one grouped callout", () => {
    const doc = createLoadedDxfDocument({
      fileName: "grouped-holes.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 120, y: 0 },
              { x: 120, y: 90 },
              { x: 0, y: 90 },
            ],
          },
          { type: "CIRCLE", center: { x: 20, y: 20 }, radius: 2.5 },
          { type: "CIRCLE", center: { x: 100, y: 20 }, radius: 2.5 },
          { type: "CIRCLE", center: { x: 20, y: 70 }, radius: 2.5 },
          { type: "CIRCLE", center: { x: 100, y: 70 }, radius: 2.5 },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const dimensions = buildDxfPreviewDimensions({
      featureModel,
      mode: "collapsed",
    });

    const groupedHoles = dimensions.filter(
      (entry) => entry.type === "diameter" && entry.kind === "hole-diameter",
    );
    assert.equal(groupedHoles.length, 1);
    assert.equal(groupedHoles[0].valueText, "4X ⌀5.00");
  });

  it("suppresses individual hole callouts when grouped callout covers the same holes", () => {
    const doc = createLoadedDxfDocument({
      fileName: "grouped-hole-coverage.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 120, y: 0 },
              { x: 120, y: 90 },
              { x: 0, y: 90 },
            ],
          },
          { type: "CIRCLE", center: { x: 20, y: 20 }, radius: 3.25 },
          { type: "CIRCLE", center: { x: 100, y: 20 }, radius: 3.25 },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const dimensions = buildDxfPreviewDimensions({
      featureModel,
      mode: "collapsed",
    });

    const holeDims = dimensions.filter((entry) => entry.type === "diameter");
    assert.equal(holeDims.length, 1);
    assert.equal(holeDims[0].valueText, "2X ⌀6.50");
  });

  it("uses hole auto-diameter-family coverage keys for all members in a grouped hole callout", () => {
    const doc = createLoadedDxfDocument({
      fileName: "grouped-hole-family-keys.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 120, y: 0 },
              { x: 120, y: 90 },
              { x: 0, y: 90 },
            ],
          },
          { type: "CIRCLE", center: { x: 20, y: 20 }, radius: 2.5 },
          { type: "CIRCLE", center: { x: 100, y: 20 }, radius: 2.5 },
          { type: "CIRCLE", center: { x: 20, y: 70 }, radius: 2.5 },
          { type: "CIRCLE", center: { x: 100, y: 70 }, radius: 2.5 },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const plan = buildDxfPreviewDimensionPlan({ featureModel });
    const groupedHole = plan.essential.find(
      (entry) =>
        entry.renderData.type === "diameter" &&
        entry.renderData.valueText === "4X ⌀5.00",
    );

    assert.ok(groupedHole);
    assert.equal(groupedHole?.coveredKeys.length, 4);
    for (const key of groupedHole?.coveredKeys ?? []) {
      assert.match(key, /^hole:.+:auto-diameter-family$/);
    }
  });

  it("grouped hole notes suppress all individual hole auto-size members of the same family", () => {
    const doc = createLoadedDxfDocument({
      fileName: "grouped-hole-family-suppression.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 120, y: 0 },
              { x: 120, y: 90 },
              { x: 0, y: 90 },
            ],
          },
          { type: "CIRCLE", center: { x: 20, y: 20 }, radius: 3.25 },
          { type: "CIRCLE", center: { x: 100, y: 20 }, radius: 3.25 },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const plan = buildDxfPreviewDimensionPlan({ featureModel });
    const groupedHole = plan.essential.find(
      (entry) =>
        entry.renderData.type === "diameter" &&
        entry.renderData.valueText === "2X ⌀6.50",
    );
    assert.ok(groupedHole);

    const overlapping = [...plan.essential, ...plan.expanded].filter(
      (entry) =>
        entry.id !== groupedHole?.id &&
        entry.coveredKeys.some((key) => groupedHole?.coveredKeys.includes(key)),
    );
    assert.equal(overlapping.length, 0);

    const selectedExpanded = selectDxfPreviewDimensionsFromPlan({
      plan,
      mode: "expanded",
    });
    const holeLabels = selectedExpanded
      .filter((entry) => entry.type === "diameter")
      .map((entry) => entry.valueText)
      .sort();
    assert.deepEqual(holeLabels, ["2X ⌀6.50"]);
  });

  it("keeps unique hole callouts for diameters not covered by grouped holes", () => {
    const doc = createLoadedDxfDocument({
      fileName: "mixed-hole-groups.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 150, y: 0 },
              { x: 150, y: 90 },
              { x: 0, y: 90 },
            ],
          },
          { type: "CIRCLE", center: { x: 20, y: 20 }, radius: 3.25 },
          { type: "CIRCLE", center: { x: 130, y: 20 }, radius: 3.25 },
          { type: "CIRCLE", center: { x: 75, y: 65 }, radius: 5 },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const dimensions = buildDxfPreviewDimensions({
      featureModel,
      mode: "collapsed",
    });
    const holeDims = dimensions.filter((entry) => entry.type === "diameter");
    const labels = holeDims.map((entry) => entry.valueText).sort();

    assert.equal(holeDims.length, 2);
    assert.deepEqual(labels, ["2X ⌀6.50", "⌀10.00"]);
  });

  it("does not emit standalone hole dimensions for slot-end circles", () => {
    const doc = createLoadedDxfDocument({
      fileName: "slot-consumed.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 30, y: 20, bulge: 0 },
              { x: 50, y: 20, bulge: 1 },
              { x: 50, y: 26, bulge: 0 },
              { x: 30, y: 26, bulge: 1 },
            ],
          },
          { type: "CIRCLE", center: { x: 30, y: 23 }, radius: 3 },
          { type: "CIRCLE", center: { x: 50, y: 23 }, radius: 3 },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const dimensions = buildDxfPreviewDimensions({
      featureModel,
      mode: "expanded",
    });
    const holeDims = dimensions.filter((entry) => entry.type === "diameter");
    const slotLengthDims = dimensions.filter(
      (entry) => entry.type === "linear" && entry.kind === "slot-length",
    );
    const slotWidthDims = dimensions.filter(
      (entry) => entry.type === "linear" && entry.kind === "slot-width",
    );

    assert.equal(holeDims.length, 0);
    assert.equal(slotLengthDims.length, 1);
    assert.equal(slotWidthDims.length, 1);
  });

  it("always includes overall width/height from global bounds even without closed contours", () => {
    const doc = createLoadedDxfDocument({
      fileName: "partial-contours.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          { type: "LINE", start: { x: 10, y: 20 }, end: { x: 110, y: 20 } },
          { type: "LINE", start: { x: 110, y: 20 }, end: { x: 110, y: 70 } },
          { type: "LINE", start: { x: 10, y: 70 }, end: { x: 110, y: 70 } },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const dimensions = buildDxfPreviewDimensions({
      featureModel,
      mode: "collapsed",
    });

    const width = dimensions.find(
      (entry) => entry.type === "linear" && entry.kind === "overall-width",
    );
    const height = dimensions.find(
      (entry) => entry.type === "linear" && entry.kind === "overall-height",
    );

    assert.ok(width);
    assert.ok(height);
    assert.equal(width?.valueText, "100.00 mm");
    assert.equal(height?.valueText, "50.00 mm");
  });

  it("emits more dimensions in expanded mode than collapsed mode", () => {
    const doc = createLoadedDxfDocument({
      fileName: "expanded-vs-collapsed.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 140, y: 0 },
              { x: 140, y: 90 },
              { x: 0, y: 90 },
            ],
          },
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 40, y: 30 },
              { x: 100, y: 30 },
              { x: 100, y: 55 },
              { x: 40, y: 55 },
            ],
          },
          { type: "CIRCLE", center: { x: 20, y: 20 }, radius: 2.5 },
          { type: "CIRCLE", center: { x: 120, y: 20 }, radius: 2.5 },
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 30, y: 65, bulge: 0 },
              { x: 60, y: 65, bulge: 1 },
              { x: 60, y: 75, bulge: 0 },
              { x: 30, y: 75, bulge: 1 },
            ],
          },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const collapsed = buildDxfPreviewDimensions({ featureModel, mode: "collapsed" });
    const expanded = buildDxfPreviewDimensions({ featureModel, mode: "expanded" });

    const collapsedHoleLabels = collapsed
      .filter((entry) => entry.type === "diameter")
      .map((entry) => entry.valueText)
      .sort();
    const expandedHoleLabels = expanded
      .filter((entry) => entry.type === "diameter")
      .map((entry) => entry.valueText)
      .sort();
    const collapsedNonHoleCount = collapsed.filter((entry) => entry.type !== "diameter").length;
    const expandedNonHoleCount = expanded.filter((entry) => entry.type !== "diameter").length;

    assert.ok(expanded.length > collapsed.length);
    assert.deepEqual(expandedHoleLabels, collapsedHoleLabels);
    assert.ok(expandedNonHoleCount > collapsedNonHoleCount);
  });

  it("does not emit interior auto linear dimensions in auto preview mode", () => {
    const doc = createLoadedDxfDocument({
      fileName: "auto-outside-only.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 140, y: 0 },
              { x: 140, y: 90 },
              { x: 0, y: 90 },
            ],
          },
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 40, y: 30 },
              { x: 100, y: 30 },
              { x: 100, y: 55 },
              { x: 40, y: 55 },
            ],
          },
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 30, y: 65, bulge: 0 },
              { x: 60, y: 65, bulge: 1 },
              { x: 60, y: 75, bulge: 0 },
              { x: 30, y: 75, bulge: 1 },
            ],
          },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const dimensions = buildDxfPreviewDimensions({
      featureModel,
      mode: "expanded",
    });

    const hasInteriorKind = dimensions.some(
      (entry) =>
        entry.type === "linear" &&
        String(entry.kind).startsWith("internal-span"),
    );
    assert.equal(hasInteriorKind, false);
  });

  it("does not leak duplicate individual hole diameters in expanded mode when grouped callouts exist", () => {
    const doc = createLoadedDxfDocument({
      fileName: "grouped-holes-expanded-coverage.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 140, y: 0 },
              { x: 140, y: 90 },
              { x: 0, y: 90 },
            ],
          },
          { type: "CIRCLE", center: { x: 20, y: 20 }, radius: 3.25 },
          { type: "CIRCLE", center: { x: 120, y: 20 }, radius: 3.25 },
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 30, y: 65, bulge: 0 },
              { x: 60, y: 65, bulge: 1 },
              { x: 60, y: 75, bulge: 0 },
              { x: 30, y: 75, bulge: 1 },
            ],
          },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const dimensions = buildDxfPreviewDimensions({
      featureModel,
      mode: "expanded",
    });
    const holeDims = dimensions.filter((entry) => entry.type === "diameter");
    const grouped = holeDims.filter((entry) => entry.valueText === "2X ⌀6.50");
    const singles = holeDims.filter((entry) => entry.valueText === "⌀6.50");

    assert.equal(grouped.length, 1);
    assert.equal(singles.length, 0);
  });

  it("keeps grouped hole diameter coverage identical between collapsed and expanded output", () => {
    const doc = createLoadedDxfDocument({
      fileName: "grouped-holes-tier-consistency.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 150, y: 0 },
              { x: 150, y: 100 },
              { x: 0, y: 100 },
            ],
          },
          { type: "CIRCLE", center: { x: 20, y: 20 }, radius: 2.5 },
          { type: "CIRCLE", center: { x: 130, y: 20 }, radius: 2.5 },
          { type: "CIRCLE", center: { x: 75, y: 75 }, radius: 4 },
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 35, y: 45, bulge: 0 },
              { x: 95, y: 45, bulge: 1 },
              { x: 95, y: 55, bulge: 0 },
              { x: 35, y: 55, bulge: 1 },
            ],
          },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const collapsed = buildDxfPreviewDimensions({ featureModel, mode: "collapsed" });
    const expanded = buildDxfPreviewDimensions({ featureModel, mode: "expanded" });
    const collapsedHoleLabels = collapsed
      .filter((entry) => entry.type === "diameter")
      .map((entry) => entry.valueText)
      .sort();
    const expandedHoleLabels = expanded
      .filter((entry) => entry.type === "diameter")
      .map((entry) => entry.valueText)
      .sort();

    assert.deepEqual(expandedHoleLabels, collapsedHoleLabels);
  });

  it("uses one canonical plan across tiers without reintroducing grouped-hole duplicates", () => {
    const doc = createLoadedDxfDocument({
      fileName: "grouped-hole-canonical-tiering.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 150, y: 0 },
              { x: 150, y: 100 },
              { x: 0, y: 100 },
            ],
          },
          { type: "CIRCLE", center: { x: 20, y: 20 }, radius: 3.25 },
          { type: "CIRCLE", center: { x: 130, y: 20 }, radius: 3.25 },
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 35, y: 45, bulge: 0 },
              { x: 95, y: 45, bulge: 1 },
              { x: 95, y: 55, bulge: 0 },
              { x: 35, y: 55, bulge: 1 },
            ],
          },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const plan = buildDxfPreviewDimensionPlan({ featureModel });
    const collapsed = selectDxfPreviewDimensionsFromPlan({
      plan,
      mode: "collapsed",
    });
    const expanded = selectDxfPreviewDimensionsFromPlan({
      plan,
      mode: "expanded",
    });

    const collapsedHoleLabels = collapsed
      .filter((entry) => entry.type === "diameter")
      .map((entry) => entry.valueText)
      .sort();
    const expandedHoleLabels = expanded
      .filter((entry) => entry.type === "diameter")
      .map((entry) => entry.valueText)
      .sort();
    assert.deepEqual(collapsedHoleLabels, ["2X ⌀6.50"]);
    assert.deepEqual(expandedHoleLabels, ["2X ⌀6.50"]);
  });

  it("maps duplicate circle entities to one physical hole dimension", () => {
    const doc = createLoadedDxfDocument({
      fileName: "duplicate-hole-entities.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 60 },
              { x: 0, y: 60 },
            ],
          },
          { type: "CIRCLE", center: { x: 30, y: 30 }, radius: 3 },
          { type: "CIRCLE", center: { x: 30.01, y: 29.99 }, radius: 3.01 },
        ],
      },
    });

    const featureModel = buildDxf2DFeatureModel({ doc });
    const dimensions = buildDxfPreviewDimensions({ featureModel, mode: "collapsed" });
    const holeDims = dimensions.filter((entry) => entry.type === "diameter");

    assert.equal(holeDims.length, 1);
    assert.equal(holeDims[0].valueText, "⌀6.01");
  });
});
