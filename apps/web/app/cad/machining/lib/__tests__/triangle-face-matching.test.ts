import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FaceSurfaceGeometry } from "../triangle-face-matching";
import { classifyTriangles } from "../triangle-face-matching";

function makeBoundingBox(
  min: [number, number, number],
  max: [number, number, number],
) {
  const [minx, miny, minz] = min;
  const [maxx, maxy, maxz] = max;
  const length_mm = maxx - minx;
  const width_mm = maxy - miny;
  const height_mm = maxz - minz;
  return {
    min: { x: minx, y: miny, z: minz },
    max: { x: maxx, y: maxy, z: maxz },
    length_mm,
    width_mm,
    height_mm,
    diagonal_mm: Math.sqrt(length_mm ** 2 + width_mm ** 2 + height_mm ** 2),
  };
}

function makeFaceDetail(
  overrides: Partial<FaceSurfaceGeometry> = {},
): FaceSurfaceGeometry {
  return {
    surface_type: "PLANE",
    bounding_box: makeBoundingBox([-10, -10, -10], [10, 10, 10]),
    centroid: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    axis: null,
    axis_location: { x: 0, y: 0, z: 0 },
    radius_mm: null,
    cone_half_angle_deg: null,
    ...overrides,
  };
}

// A flat 2x2 plane made of two triangles, in the z=0 plane, centered near
// (0.5, 0.5).
const PLANE_POSITIONS = new Float32Array([
  0, 0, 0, // 0
  1, 0, 0, // 1
  1, 1, 0, // 2
  0, 1, 0, // 3
]);
const PLANE_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);

// A small band of a cylinder of radius 5 around the Z axis, four triangles
// (two quads split diagonally) spanning a small angular arc so the geometric
// normal points radially outward.
function cylinderBand(radius: number, zLow: number, zHigh: number) {
  const angles = [0, 0.2, 0.4];
  const positions: number[] = [];
  for (const z of [zLow, zHigh]) {
    for (const a of angles) {
      positions.push(radius * Math.cos(a), radius * Math.sin(a), z);
    }
  }
  // positions layout: [zLow: a0,a1,a2][zHigh: a0,a1,a2] -> indices 0-2 low, 3-5 high
  const indices: number[] = [];
  for (let i = 0; i < angles.length - 1; i++) {
    const lo0 = i;
    const lo1 = i + 1;
    const hi0 = i + angles.length;
    const hi1 = i + 1 + angles.length;
    indices.push(lo0, lo1, hi0);
    indices.push(lo1, hi1, hi0);
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

describe("classifyTriangles", () => {
  it("matches triangles on a clear PLANE face", () => {
    const face = makeFaceDetail({
      surface_type: "PLANE",
      normal: { x: 0, y: 0, z: 1 },
      axis_location: { x: 0, y: 0, z: 0 },
      bounding_box: makeBoundingBox([-1, -1, -1], [2, 2, 1]),
    });

    const matched = classifyTriangles(PLANE_POSITIONS, PLANE_INDICES, [face]);
    assert.deepEqual(matched, [0, 1]);
  });

  it("does not match a plane whose normal disagrees with the triangle normal", () => {
    const face = makeFaceDetail({
      surface_type: "PLANE",
      // Flip the face's own reported normal to be perpendicular (not merely
      // reversed - dot ~ 0) to the actual triangle normal (+Z), so alignment
      // fails outright rather than passing on the "either sense" allowance.
      normal: { x: 1, y: 0, z: 0 },
      axis_location: { x: 0, y: 0, z: 0 },
      bounding_box: makeBoundingBox([-1, -1, -1], [2, 2, 1]),
    });

    const matched = classifyTriangles(PLANE_POSITIONS, PLANE_INDICES, [face]);
    assert.deepEqual(matched, []);
  });

  it("matches triangles on a clear CYLINDER face", () => {
    const { positions, indices } = cylinderBand(5, 0, 10);
    const face = makeFaceDetail({
      surface_type: "CYLINDER",
      normal: null,
      axis: { x: 0, y: 0, z: 1 },
      axis_location: { x: 0, y: 0, z: 0 },
      radius_mm: 5,
      bounding_box: makeBoundingBox([-6, -6, -1], [6, 6, 11]),
    });

    const matched = classifyTriangles(positions, indices, [face]);
    assert.equal(matched.length, 4);
  });

  it("rejects a cylinder candidate whose radius is out of tolerance", () => {
    const { positions, indices } = cylinderBand(5, 0, 10);
    const face = makeFaceDetail({
      surface_type: "CYLINDER",
      normal: null,
      axis: { x: 0, y: 0, z: 1 },
      axis_location: { x: 0, y: 0, z: 0 },
      radius_mm: 8, // 60% off - well outside the 2% default tolerance
      bounding_box: makeBoundingBox([-9, -9, -1], [9, 9, 11]),
    });

    const matched = classifyTriangles(positions, indices, [face]);
    assert.deepEqual(matched, []);
  });

  it("disambiguates two same-radius, same-axis cylinders by bounding box", () => {
    const near = cylinderBand(5, 0, 10);
    const far = cylinderBand(5, 1000, 1010);

    // Concatenate both bands into one mesh.
    const positions = new Float32Array([...near.positions, ...far.positions]);
    const farIndices = far.indices.map((i) => i + near.positions.length / 3);
    const indices = new Uint32Array([...near.indices, ...farIndices]);

    const nearFace = makeFaceDetail({
      surface_type: "CYLINDER",
      normal: null,
      axis: { x: 0, y: 0, z: 1 },
      axis_location: { x: 0, y: 0, z: 0 },
      radius_mm: 5,
      bounding_box: makeBoundingBox([-6, -6, -1], [6, 6, 11]),
    });

    const matched = classifyTriangles(positions, indices, [nearFace]);
    // Only the near band's four triangles should match; the far band shares
    // identical radius/axis direction but its centroid falls far outside
    // `nearFace.bounding_box`.
    assert.equal(matched.length, 4);
    for (const idx of matched) {
      assert.ok(idx < near.indices.length / 3);
    }
  });

  it("does not match a plane's triangles against a cylinder face", () => {
    const face = makeFaceDetail({
      surface_type: "CYLINDER",
      normal: null,
      axis: { x: 0, y: 0, z: 1 },
      axis_location: { x: 0, y: 0, z: 0 },
      radius_mm: 5,
      bounding_box: makeBoundingBox([-6, -6, -6], [6, 6, 6]),
    });

    const matched = classifyTriangles(PLANE_POSITIONS, PLANE_INDICES, [face]);
    assert.deepEqual(matched, []);
  });
});
