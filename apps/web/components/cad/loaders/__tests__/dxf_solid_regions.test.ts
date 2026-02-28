import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type ParsedDxf } from "../dxf";
import { extractSolidRegionsFromDxf } from "../dxf_solid";

type Vec2 = { x: number; y: number };

function rectangleVertices(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Vec2[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function boundsOf(points: Vec2[]): { width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { width: maxX - minX, height: maxY - minY };
}

function largestRegion<T extends { area: number }>(regions: T[]): T {
  return regions.reduce((best, region) =>
    region.area > best.area ? region : best,
  );
}

function frameBorderFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        layer: "FRAME",
        lineType: "DASHED",
        vertices: rectangleVertices(-10, -10, 210, 130),
      },
      {
        type: "LWPOLYLINE",
        flags: 1,
        layer: "CUT",
        vertices: rectangleVertices(20, 20, 180, 110),
      },
      { type: "CIRCLE", layer: "CUT", center: { x: 70, y: 65 }, radius: 12 },
      {
        type: "LWPOLYLINE",
        flags: 1,
        layer: "CUT",
        vertices: rectangleVertices(120, 50, 150, 80),
      },
    ],
  };
}

function sameWindingFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        layer: "CUT",
        vertices: rectangleVertices(0, 0, 80, 60),
      },
      {
        type: "LWPOLYLINE",
        flags: 1,
        layer: "CUT",
        vertices: rectangleVertices(20, 15, 50, 40),
      },
    ],
  };
}

function tinyGapFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        shape: false,
        layer: "CUT",
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 60 },
          { x: 0, y: 60 },
          { x: 0, y: 0.015 },
        ],
      },
    ],
  };
}

function concaveNestedLoopsFixture(): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        layer: "CUT",
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 20 },
          { x: 20, y: 20 },
          { x: 20, y: 80 },
          { x: 100, y: 80 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      },
      {
        type: "LWPOLYLINE",
        flags: 1,
        layer: "CUT",
        vertices: [
          { x: 5, y: 5 },
          { x: 60, y: 5 },
          { x: 60, y: 15 },
          { x: 15, y: 15 },
          { x: 15, y: 85 },
          { x: 60, y: 85 },
          { x: 60, y: 95 },
          { x: 5, y: 95 },
        ],
      },
    ],
  };
}

function translatedPrecisionFixture(offset: number): ParsedDxf {
  return {
    entities: [
      {
        type: "LWPOLYLINE",
        flags: 1,
        layer: "CUT",
        vertices: [
          { x: offset + 0, y: offset + 0 },
          { x: offset + 100, y: offset + 0 },
          { x: offset + 100, y: offset + 80 },
          { x: offset + 0, y: offset + 80 },
        ],
      },
      {
        type: "LWPOLYLINE",
        flags: 1,
        layer: "CUT",
        vertices: [
          { x: offset + 20, y: offset + 20 },
          { x: offset + 21, y: offset + 20 },
          { x: offset + 21, y: offset + 21 },
          { x: offset + 20, y: offset + 21 },
        ],
      },
    ],
  };
}

describe("DXF solid region extraction", () => {
  it("suppresses a dashed border frame and keeps inner holes", () => {
    const extracted = extractSolidRegionsFromDxf(frameBorderFixture(), 1, {
      joinToleranceMm: 0.2,
      chordalToleranceMm: 0.1,
    });
    assert.ok(extracted, "expected extracted regions");
    assert.equal(extracted!.diagnostics.frameSuppressed, true);
    assert.ok(extracted!.regions.length >= 1);

    const main = largestRegion(extracted!.regions);
    const region = extracted!.regions.find((entry) => entry.area === main.area)!;
    const outerBounds = boundsOf(region.outer);
    assert.ok(
      outerBounds.width >= 150 && outerBounds.width <= 165,
      `expected inner-part width, got ${outerBounds.width}`,
    );
    assert.ok(region.holes.length >= 2, "expected circle + slot holes");
  });

  it("treats same-winding inner loop as a hole via nesting parity", () => {
    const extracted = extractSolidRegionsFromDxf(sameWindingFixture(), 1, {
      joinToleranceMm: 0.2,
      chordalToleranceMm: 0.1,
    });
    assert.ok(extracted, "expected extracted regions");
    assert.ok(extracted!.regions.length >= 1);
    assert.ok(
      extracted!.regions.some((region) => region.holes.length > 0),
      "expected at least one region with holes",
    );
  });

  it("recovers a region from a tiny-gap outline", () => {
    const extracted = extractSolidRegionsFromDxf(tinyGapFixture(), 1, {
      joinToleranceMm: 0.001,
      chordalToleranceMm: 0.1,
    });
    assert.ok(extracted, "expected extracted regions");
    assert.ok(extracted!.regions.length >= 1);

    const main = largestRegion(extracted!.regions);
    assert.ok(main.area > 5000, `expected meaningful recovered area, got ${main.area}`);
  });

  it("classifies nested concave loops with a robust interior sample point", () => {
    const extracted = extractSolidRegionsFromDxf(concaveNestedLoopsFixture(), 1, {
      joinToleranceMm: 0.2,
      chordalToleranceMm: 0.1,
    });
    assert.ok(extracted, "expected extracted regions for concave nested loops");
    assert.ok(extracted!.regions.length >= 1);
    assert.ok(extracted!.diagnostics.holesSubtracted >= 1);
    assert.ok(
      extracted!.regions.some((region) => region.holes.length >= 1),
      "expected nested concave loop to be classified as a hole",
    );
  });

  it("keeps region extraction stable for large translated coordinates", () => {
    const opts = {
      joinToleranceMm: 0.02,
      chordalToleranceMm: 0.05,
    };
    const near = extractSolidRegionsFromDxf(translatedPrecisionFixture(0), 1, opts);
    const far = extractSolidRegionsFromDxf(translatedPrecisionFixture(8e11), 1, opts);

    assert.ok(near, "expected near-origin extraction to succeed");
    assert.ok(far, "expected far-from-origin extraction to succeed");

    const nearMain = largestRegion(near!.regions);
    const farMain = largestRegion(far!.regions);
    assert.ok(nearMain.area > 1000);
    assert.ok(farMain.area > 1000);
    assert.equal(farMain.holes.length, nearMain.holes.length);
    assert.ok(
      Math.abs(farMain.area - nearMain.area) <= 0.5,
      `expected translated area parity, near=${nearMain.area}, far=${farMain.area}`,
    );
  });
});
