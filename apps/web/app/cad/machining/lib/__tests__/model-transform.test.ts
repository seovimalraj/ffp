import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  circlePoints,
  deriveModelTransform,
  lengthToWorld,
  perpendicularBasis,
  toCad,
  toWorld,
  type Vec3,
} from "../model-transform";
import type { BoundingBox } from "@/types/machining-analysis";

/**
 * The viewer re-centres geometry on load, so every feature coordinate has to be
 * mapped before it can be drawn. Getting this wrong puts outlines confidently
 * in the wrong place, which is worse than drawing nothing - hence the explicit
 * invalid path.
 */

function box(
  min: [number, number, number],
  max: [number, number, number],
): BoundingBox {
  return {
    min: { x: min[0], y: min[1], z: min[2] },
    max: { x: max[0], y: max[1], z: max[2] },
    length_mm: max[0] - min[0],
    width_mm: max[1] - min[1],
    height_mm: max[2] - min[2],
    diagonal_mm: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
  };
}

function worldBox(
  min: [number, number, number],
  max: [number, number, number],
) {
  return {
    min: { x: min[0], y: min[1], z: min[2] },
    max: { x: max[0], y: max[1], z: max[2] },
  };
}

describe("deriveModelTransform", () => {
  it("recovers the translation the viewer applies when it recentres a model", () => {
    // The viewer moves the model so its minimum corner sits at the origin.
    const analysis = box([10, 20, 30], [110, 80, 60]);
    const world = worldBox([0, 0, 0], [100, 60, 30]);

    const transform = deriveModelTransform(analysis, world);

    assert.equal(transform.valid, true);
    assert.deepEqual(transform.scale, [1, 1, 1]);
    assert.deepEqual(transform.offset, [-10, -20, -30]);
  });

  it("maps a CAD point onto the recentred model", () => {
    const transform = deriveModelTransform(
      box([10, 20, 30], [110, 80, 60]),
      worldBox([0, 0, 0], [100, 60, 30]),
    );
    assert.deepEqual(toWorld({ x: 10, y: 20, z: 30 }, transform), [0, 0, 0]);
    assert.deepEqual(toWorld({ x: 60, y: 50, z: 45 }, transform), [50, 30, 15]);
  });

  it("is an identity when the model already sits in CAD coordinates", () => {
    const analysis = box([0, 0, 0], [100, 60, 20]);
    const transform = deriveModelTransform(analysis, worldBox([0, 0, 0], [100, 60, 20]));
    assert.deepEqual(transform.offset, [0, 0, 0]);
    assert.deepEqual(toWorld({ x: 30, y: 30, z: 20 }, transform), [30, 30, 20]);
  });

  it("absorbs a uniform scale, so unit conversion cannot displace outlines", () => {
    const analysis = box([0, 0, 0], [100, 60, 20]);
    const transform = deriveModelTransform(analysis, worldBox([0, 0, 0], [10, 6, 2]));
    assert.equal(transform.valid, true);
    transform.scale.forEach((s) => assert.ok(Math.abs(s - 0.1) < 1e-9));
    assert.deepEqual(toWorld({ x: 100, y: 60, z: 20 }, transform), [10, 6, 2]);
  });

  it("round-trips a point back to CAD space for picking", () => {
    const transform = deriveModelTransform(
      box([10, 20, 30], [110, 80, 60]),
      worldBox([0, 0, 0], [100, 60, 30]),
    );
    const cad = toCad({ x: 50, y: 30, z: 15 }, transform);
    assert.deepEqual(cad, [60, 50, 45]);
  });

  it("refuses to map when the axes appear rotated", () => {
    // Analysis says 100 x 60 x 20; the viewer reports 20 x 60 x 100. Something
    // permuted the axes and no translation can reconcile that.
    const transform = deriveModelTransform(
      box([0, 0, 0], [100, 60, 20]),
      worldBox([0, 0, 0], [20, 60, 100]),
    );
    assert.equal(transform.valid, false);
    assert.match(String(transform.reason), /rotated|scaled/i);
  });

  it("refuses to map before the viewer reports bounds", () => {
    const transform = deriveModelTransform(box([0, 0, 0], [10, 10, 10]), null);
    assert.equal(transform.valid, false);
  });

  it("refuses to map a degenerate model", () => {
    const transform = deriveModelTransform(
      box([0, 0, 0], [0, 0, 0]),
      worldBox([0, 0, 0], [1, 1, 1]),
    );
    assert.equal(transform.valid, false);
  });

  it("tolerates the small bounding-box differences tessellation introduces", () => {
    // The viewer's mesh is a tessellation, so its bounds sit a hair inside the
    // exact B-Rep bounds. That must not invalidate the transform.
    const transform = deriveModelTransform(
      box([0, 0, 0], [100, 60, 20]),
      worldBox([0, 0, 0], [99.9, 59.95, 19.98]),
    );
    assert.equal(transform.valid, true);
  });

  it("scales a length by the mean axis scale", () => {
    const transform = deriveModelTransform(
      box([0, 0, 0], [100, 60, 20]),
      worldBox([0, 0, 0], [10, 6, 2]),
    );
    assert.ok(Math.abs(lengthToWorld(5, transform) - 0.5) < 1e-9);
  });
});

describe("circle construction", () => {
  it("puts every point at the requested radius from the centre", () => {
    const centre: Vec3 = [10, 20, 30];
    const points = circlePoints(centre, [0, 0, 1], 5, 16);
    assert.equal(points.length, 16);
    for (const point of points) {
      const radius = Math.hypot(point[0] - centre[0], point[1] - centre[1]);
      assert.ok(Math.abs(radius - 5) < 1e-9, `radius was ${radius}`);
      assert.ok(Math.abs(point[2] - centre[2]) < 1e-9, "circle left its plane");
    }
  });

  it("lies in the plane normal to an arbitrary axis", () => {
    const axis: Vec3 = [1, 1, 0];
    const points = circlePoints([0, 0, 0], axis, 3, 12);
    const unit = 1 / Math.SQRT2;
    for (const point of points) {
      const along = point[0] * unit + point[1] * unit;
      assert.ok(Math.abs(along) < 1e-9, "point drifted along the axis");
    }
  });

  it("produces a deterministic basis, so outlines do not jitter between runs", () => {
    const first = perpendicularBasis([0, 0, 1]);
    const second = perpendicularBasis([0, 0, 1]);
    assert.deepEqual(first, second);
  });

  it("keeps the basis orthogonal to the axis", () => {
    const [u, v] = perpendicularBasis([0.3, -0.7, 0.65]);
    const axis: Vec3 = [0.3, -0.7, 0.65];
    const norm = Math.hypot(...axis);
    const unit: Vec3 = [axis[0] / norm, axis[1] / norm, axis[2] / norm];
    const dotU = u[0] * unit[0] + u[1] * unit[1] + u[2] * unit[2];
    const dotV = v[0] * unit[0] + v[1] * unit[1] + v[2] * unit[2];
    assert.ok(Math.abs(dotU) < 1e-9);
    assert.ok(Math.abs(dotV) < 1e-9);
  });
});
