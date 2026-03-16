import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDxf2DFeatureModel } from "../dxf-preview-feature-model";
import { createLoadedDxfDocument } from "../dxf-preview-session";

function approx(actual: number, expected: number, eps = 1e-3): void {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${actual} to be within ${eps} of ${expected}`,
  );
}

describe("dxf-preview-feature-model", () => {
  it("extracts physical 2D features with global extents and exact slot/circle geometry", () => {
    const doc = createLoadedDxfDocument({
      fileName: "fixture.dxf",
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
          {
            type: "LWPOLYLINE",
            flags: 1,
            vertices: [
              { x: 150, y: 10 },
              { x: 170, y: 10 },
              { x: 170, y: 20 },
              { x: 150, y: 20 },
            ],
          },
          {
            type: "CIRCLE",
            center: { x: 20, y: 20 },
            radius: 4,
          },
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
          {
            type: "LINE",
            layer: "DIM",
            start: { x: -300, y: -300 },
            end: { x: 300, y: 300 },
          },
          {
            type: "LINE",
            layer: "CONSTRUCTION",
            start: { x: 500, y: 500 },
            end: { x: 650, y: 500 },
          },
        ],
      },
    });

    const model = buildDxf2DFeatureModel({ doc });

    approx(model.bounds.minX, 0, 1e-6);
    approx(model.bounds.maxX, 170, 1e-6);
    approx(model.bounds.minY, 0, 1e-6);
    approx(model.bounds.maxY, 60, 1e-6);

    assert.ok(model.outerOutline);
    approx(model.outerOutline?.area ?? 0, 6000, 1e-3);
    assert.ok(model.innerOutlines.length >= 1);
    assert.ok(model.innerOutlines.some((outline) => Math.abs(outline.area - 200) <= 1e-3));

    assert.equal(model.circles.length, 1);
    approx(model.circles[0].center.x, 20, 1e-6);
    approx(model.circles[0].center.y, 20, 1e-6);
    approx(model.circles[0].radius, 4, 1e-6);

    assert.equal(model.slots.length, 1);
    approx(model.slots[0].length, 26, 1e-2);
    approx(model.slots[0].width, 6, 1e-2);
  });

  it("excludes non-uniformly transformed circles from exact hole features", () => {
    const doc = createLoadedDxfDocument({
      fileName: "non-uniform-circle.dxf",
      buffer: new ArrayBuffer(16),
      scaleToMm: 1,
      parsed: {
        entities: [
          {
            type: "CIRCLE",
            center: { x: 10, y: 5 },
            radius: 2,
          },
          {
            type: "INSERT",
            name: "ELLIPSELIKE",
            position: { x: 80, y: 20 },
            xScale: 2,
            yScale: 1,
          },
        ],
        blocks: {
          ELLIPSELIKE: {
            name: "ELLIPSELIKE",
            basePoint: { x: 0, y: 0 },
            entities: [
              {
                type: "CIRCLE",
                center: { x: 0, y: 0 },
                radius: 3,
              },
            ],
          },
        },
      },
    });

    const model = buildDxf2DFeatureModel({ doc });
    assert.equal(model.circles.length, 1);
    approx(model.circles[0].radius, 2, 1e-6);

    // Non-uniform transformed circle still contributes to bounds through sampled geometry.
    assert.ok(model.bounds.maxX > 80);
  });

  it("clusters near-identical circles into one physical hole feature", () => {
    const doc = createLoadedDxfDocument({
      fileName: "clustered-circles.dxf",
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
              { x: 120, y: 80 },
              { x: 0, y: 80 },
            ],
          },
          { type: "CIRCLE", center: { x: 30, y: 30 }, radius: 5 },
          { type: "CIRCLE", center: { x: 30.02, y: 29.99 }, radius: 4.99 },
          { type: "CIRCLE", center: { x: 80, y: 35 }, radius: 4 },
        ],
      },
    });

    const model = buildDxf2DFeatureModel({ doc });
    assert.equal(model.circles.length, 2);
    approx(model.circles[0].diameter, 10, 0.05);
    approx(model.circles[1].diameter, 8, 0.05);
  });

  it("suppresses standalone circle features that are slot end radii", () => {
    const doc = createLoadedDxfDocument({
      fileName: "slot-end-circles.dxf",
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

    const model = buildDxf2DFeatureModel({ doc });
    assert.equal(model.slots.length, 1);
    assert.equal(model.circles.length, 0);
  });
});
