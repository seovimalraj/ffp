import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as THREE from "three";

import {
  buildCircularFeatureCache,
  measureExactCad,
  resolveCircularMeasureTarget,
  type ExactCadMeasurementContext,
} from "../exact-cad-measurement";
import type {
  ExactEdge,
  ExactFace,
  ExactVertex,
  PickedEntity,
} from "../exact-cad-topology";

function approx(actual: number, expected: number, tolerance = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function sorted(values: string[]): string[] {
  return [...values].sort();
}

function approxVec(
  actual: THREE.Vector3,
  expected: THREE.Vector3,
  tolerance = 1e-6,
): void {
  approx(actual.x, expected.x, tolerance);
  approx(actual.y, expected.y, tolerance);
  approx(actual.z, expected.z, tolerance);
}

const vertices: ExactVertex[] = [
  { id: "v0", partId: null, point: [0, 0, 0] },
  { id: "v1", partId: null, point: [10, 0, 0] },
  { id: "v2", partId: null, point: [0, 10, 0] },
  { id: "v3", partId: null, point: [0, 0, 10] },
  { id: "v10", partId: null, point: [24, 0, 0] },
  { id: "v11", partId: null, point: [20, 4, 0] },
  { id: "v12", partId: null, point: [16, 0, 0] },
  { id: "v13", partId: null, point: [20, -4, 0] },
  { id: "v20", partId: null, point: [-14, 0, 0] },
  { id: "v21", partId: null, point: [-20, 6, 0] },
  { id: "v22", partId: null, point: [-26, 0, 0] },
  { id: "v30", partId: null, point: [58, 10, 0] },
  { id: "v31", partId: null, point: [50, 18, 0] },
  { id: "v32", partId: null, point: [50.0008, 18.0004, 0] },
  { id: "v33", partId: null, point: [42, 10, 0] },
  { id: "v34", partId: null, point: [41.9993, 10.0007, 0] },
  { id: "v35", partId: null, point: [50, 2, 0] },
  { id: "v36", partId: null, point: [50.0006, 1.9995, 0] },
  { id: "v37", partId: null, point: [57.9991, 10.0005, 0] },
  { id: "v40", partId: null, point: [-35, 30, 0] },
  { id: "v41", partId: null, point: [-40, 35, 0] },
  { id: "v42", partId: null, point: [-39.9993, 35.0006, 0] },
  { id: "v43", partId: null, point: [-45, 30, 0] },
];

const edges: ExactEdge[] = [
  {
    id: "e_line_x",
    partId: null,
    vertexIds: ["v0", "v1"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "line",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([0, 0, 0, 10, 0, 0]),
  },
  {
    id: "e_line_y",
    partId: null,
    vertexIds: ["v0", "v2"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "line",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([0, 0, 0, 0, 10, 0]),
  },
  {
    id: "e_line_sampled",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "line",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([0, 0, 0, 2, 0, 0, 4, 0, 0]),
  },
  {
    id: "e_circle_analytic",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: ["f_cyl"],
    kind: "seam",
    curveKind: "circle",
    closed: true,
    periodic: true,
    samplePositions: new Float32Array([
      5, 0, 0,
      0, 5, 0,
      -5, 0, 0,
      0, -5, 0,
      5, 0, 0,
    ]),
    analytic: {
      radius: 5,
      diameter: 10,
      center: [0, 0, 0],
      axis: [0, 0, 1],
      normal: [0, 0, 1],
    },
  },
  {
    id: "e_circle_sampled",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "seam",
    curveKind: "circle",
    closed: true,
    periodic: true,
    samplePositions: new Float32Array([
      3, 0, 0,
      0, 3, 0,
      -3, 0, 0,
      0, -3, 0,
      3, 0, 0,
    ]),
  },
  {
    id: "e_arc_analytic",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      5, 0, 0,
      3.5355339, 3.5355339, 0,
      0, 5, 0,
      -3.5355339, 3.5355339, 0,
      -5, 0, 0,
    ]),
    analytic: {
      radius: 5,
      diameter: 10,
      center: [0, 0, 0],
      normal: [0, 0, 1],
      startPoint: [5, 0, 0],
      midPoint: [0, 5, 0],
      endPoint: [-5, 0, 0],
      sweepAngleRad: Math.PI,
      isFullCircle: false,
    },
  },
  {
    id: "e_arc_closed_flag_partial",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: true,
    periodic: true,
    samplePositions: new Float32Array([
      35, 0, 0,
      33.5355339, 3.5355339, 0,
      30, 5, 0,
      26.4644661, 3.5355339, 0,
      25, 0, 0,
    ]),
    analytic: {
      radius: 5,
      diameter: 10,
      center: [30, 0, 0],
      normal: [0, 0, 1],
      startPoint: [35, 0, 0],
      midPoint: [30, 5, 0],
      endPoint: [25, 0, 0],
      sweepAngleRad: Math.PI,
      isFullCircle: false,
    },
  },
  {
    id: "e_arc_periodic_full_metadata",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: true,
    periodic: true,
    samplePositions: new Float32Array([
      75, 0, 0,
      74.6194, 1.9134, 0,
      73.5355339, 3.5355339, 0,
      71.9134, 4.6194, 0,
      70, 5, 0,
    ]),
    analytic: {
      radius: 5,
      diameter: 10,
      center: [70, 0, 0],
      normal: [0, 0, 1],
      startPoint: [75, 0, 0],
      midPoint: [73.5355339, 3.5355339, 0],
      endPoint: [70, 5, 0],
      sweepAngleRad: Math.PI * 2,
      isFullCircle: true,
    },
  },
  {
    id: "e_arc_sampled",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      4, 0, 0,
      3.6955181, 1.5307337, 0,
      2.8284271, 2.8284271, 0,
      1.5307337, 3.6955181, 0,
      0, 4, 0,
    ]),
  },
  {
    id: "e_circle_split_q1",
    partId: null,
    vertexIds: ["v10", "v11"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      24, 0, 0,
      22.8284271, 2.8284271, 0,
      20, 4, 0,
    ]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [24, 0, 0],
      midPoint: [22.8284271, 2.8284271, 0],
      endPoint: [20, 4, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_circle_split_q2",
    partId: null,
    vertexIds: ["v11", "v12"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      20, 4, 0,
      17.1715729, 2.8284271, 0,
      16, 0, 0,
    ]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [20, 4, 0],
      midPoint: [17.1715729, 2.8284271, 0],
      endPoint: [16, 0, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_circle_split_q3",
    partId: null,
    vertexIds: ["v12", "v13"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      16, 0, 0,
      17.1715729, -2.8284271, 0,
      20, -4, 0,
    ]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [16, 0, 0],
      midPoint: [17.1715729, -2.8284271, 0],
      endPoint: [20, -4, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_circle_split_q4",
    partId: null,
    vertexIds: ["v13", "v10"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      20, -4, 0,
      22.8284271, -2.8284271, 0,
      24, 0, 0,
    ]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [20, -4, 0],
      midPoint: [22.8284271, -2.8284271, 0],
      endPoint: [24, 0, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_circle_disconnected_piece",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      22.8284271, 2.8284271, 0,
      20, 3.9, 0,
      17.1715729, 2.8284271, 0,
    ]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [22.8284271, 2.8284271, 0],
      midPoint: [20, 3.9, 0],
      endPoint: [17.1715729, 2.8284271, 0],
      sweepAngleRad: Math.PI / 3,
      isFullCircle: false,
    },
  },
  {
    id: "e_circle_split_other_part",
    partId: "other",
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      24, 0, 0,
      22.8284271, 2.8284271, 0,
      20, 4, 0,
    ]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_arc_split_a",
    partId: null,
    vertexIds: ["v20", "v21"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      -14, 0, 0,
      -15.7573593, 4.2426407, 0,
      -20, 6, 0,
    ]),
    analytic: {
      radius: 6,
      center: [-20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [-14, 0, 0],
      midPoint: [-15.7573593, 4.2426407, 0],
      endPoint: [-20, 6, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_arc_split_b",
    partId: null,
    vertexIds: ["v21", "v22"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      -20, 6, 0,
      -24.2426407, 4.2426407, 0,
      -26, 0, 0,
    ]),
    analytic: {
      radius: 6,
      center: [-20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [-20, 6, 0],
      midPoint: [-24.2426407, 4.2426407, 0],
      endPoint: [-26, 0, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_arc_split_novtx_a",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      5, 20, 0,
      3.5355339, 23.5355339, 0,
      0, 25, 0,
    ]),
    analytic: {
      radius: 5,
      center: [0, 20, 0],
      normal: [0, 0, 1],
      startPoint: [5, 20, 0],
      midPoint: [3.5355339, 23.5355339, 0],
      endPoint: [0, 25, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_arc_split_novtx_b",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      0.000001, 25, 0,
      -3.5355339, 23.5355339, 0,
      -5, 20, 0,
    ]),
    analytic: {
      radius: 5,
      center: [0, 20, 0],
      normal: [0, 0, 1],
      startPoint: [0.000001, 25, 0],
      midPoint: [-3.5355339, 23.5355339, 0],
      endPoint: [-5, 20, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_noisy_circle_a",
    partId: null,
    vertexIds: ["v30", "v31"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      58, 10, 0,
      55.6568, 15.6568, 0,
      50, 18, 0,
    ]),
    analytic: {
      radius: 8.001,
      center: [50.001, 10.0006, 0],
      normal: [0, 0, 1],
      startPoint: [58, 10, 0],
      midPoint: [55.6568, 15.6568, 0],
      endPoint: [50, 18, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_noisy_circle_b",
    partId: null,
    vertexIds: ["v32", "v33"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      50.0008, 18.0004, 0,
      44.3438, 15.6566, 0,
      42, 10, 0,
    ]),
    analytic: {
      radius: 7.9988,
      center: [49.9995, 9.9998, 0],
      normal: [0, 0, 1],
      startPoint: [50.0008, 18.0004, 0],
      midPoint: [44.3438, 15.6566, 0],
      endPoint: [42, 10, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_noisy_circle_c",
    partId: null,
    vertexIds: ["v34", "v35"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      41.9993, 10.0007, 0,
      44.3436, 4.3432, 0,
      50, 2, 0,
    ]),
    analytic: {
      radius: 8.0013,
      center: [50.0004, 10.0002, 0],
      normal: [0, 0, 1],
      startPoint: [41.9993, 10.0007, 0],
      midPoint: [44.3436, 4.3432, 0],
      endPoint: [50, 2, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_noisy_circle_d",
    partId: null,
    vertexIds: ["v36", "v37"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      50.0006, 1.9995, 0,
      55.6565, 4.3435, 0,
      57.9991, 10.0005, 0,
    ]),
    analytic: {
      radius: 7.9994,
      center: [49.9997, 9.9996, 0],
      normal: [0, 0, 1],
      startPoint: [50.0006, 1.9995, 0],
      midPoint: [55.6565, 4.3435, 0],
      endPoint: [57.9991, 10.0005, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_noisy_arc_a",
    partId: null,
    vertexIds: ["v40", "v41"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      -35, 30, 0,
      -36.4645, 33.5355, 0,
      -40, 35, 0,
    ]),
    analytic: {
      radius: 5.0009,
      center: [-40.0008, 30.0004, 0],
      normal: [0, 0, 1],
      startPoint: [-35, 30, 0],
      midPoint: [-36.4645, 33.5355, 0],
      endPoint: [-40, 35, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_noisy_arc_b",
    partId: null,
    vertexIds: ["v42", "v43"],
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      -39.9993, 35.0006, 0,
      -43.5352, 33.5351, 0,
      -45, 30, 0,
    ]),
    analytic: {
      radius: 4.9992,
      center: [-39.9994, 29.9996, 0],
      normal: [0, 0, 1],
      startPoint: [-39.9993, 35.0006, 0],
      midPoint: [-43.5352, 33.5351, 0],
      endPoint: [-45, 30, 0],
      sweepAngleRad: Math.PI / 2,
      isFullCircle: false,
    },
  },
  {
    id: "e_circle_unresolved_face_fallback",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: ["f_cyl"],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([
      5, 0, 0,
      5, 0, 10,
    ]),
  },
];

const faces: ExactFace[] = [
  {
    id: "f_xy",
    partId: null,
    kind: "plane",
    analytic: {
      origin: [0, 0, 0],
      normal: [0, 0, 1],
    },
  },
  {
    id: "f_xz",
    partId: null,
    kind: "plane",
    analytic: {
      origin: [0, 0, 0],
      normal: [0, 1, 0],
    },
  },
  {
    id: "f_pick_only",
    partId: null,
    kind: "plane",
  },
  {
    id: "f_cyl",
    partId: null,
    kind: "cylinder",
    analytic: {
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      radius: 5,
    },
  },
];

const context: ExactCadMeasurementContext = {
  verticesById: new Map(vertices.map((entry) => [entry.id, entry])),
  edgesById: new Map(edges.map((entry) => [entry.id, entry])),
  facesById: new Map(faces.map((entry) => [entry.id, entry])),
  modelDiagonal: 120,
};

function edgeEntity(edgeId: string, point = new THREE.Vector3()): PickedEntity {
  return { kind: "edge", partId: null, edgeId, point };
}

function curveFeatureEntity(
  featureId: string,
  point = new THREE.Vector3(),
): PickedEntity {
  return { kind: "curve_feature", partId: null, featureId, point };
}

function faceEntity(
  faceId: string,
  point = new THREE.Vector3(),
  normal?: THREE.Vector3,
): PickedEntity {
  return { kind: "face", partId: null, faceId, point, normal };
}

function vertexEntity(vertexId: string): PickedEntity {
  return {
    kind: "vertex",
    partId: null,
    vertexId,
    point: new THREE.Vector3(999, 999, 999),
  };
}

describe("exact-cad measurement", () => {
  it("measures line edge length from topology endpoints", () => {
    const result = measureExactCad(
      {
        kind: "edge_length",
        edge: edgeEntity("e_line_x", new THREE.Vector3(3, 0, 0)),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "edge_length");
    assert.equal(result.unit, "mm");
    assert.equal(result.source, "topology");
    approx(result.value, 10, 1e-9);
  });

  it("falls back to sampled polyline length when endpoints are unavailable", () => {
    const result = measureExactCad(
      {
        kind: "edge_length",
        edge: edgeEntity("e_line_sampled", new THREE.Vector3(1, 0, 0)),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.source, "sampled");
    approx(result.value, 4, 1e-9);
  });

  it("prefers analytic circumference for closed circles", () => {
    const result = measureExactCad(
      {
        kind: "edge_length",
        edge: edgeEntity("e_circle_analytic", new THREE.Vector3(5, 0, 0)),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.source, "analytic");
    approx(result.value, Math.PI * 10, 1e-6);
  });

  it("supports point-point distance", () => {
    const result = measureExactCad(
      {
        kind: "point_point_distance",
        a: vertexEntity("v0"),
        b: vertexEntity("v3"),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "point_point_distance");
    assert.equal(result.source, "topology");
    approx(result.value, 10, 1e-9);
  });

  it("supports point-edge distance", () => {
    const result = measureExactCad(
      {
        kind: "point_edge_distance",
        point: vertexEntity("v2"),
        edge: edgeEntity("e_line_x", new THREE.Vector3(1, 0, 0)),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "point_edge_distance");
    approx(result.value, 10, 1e-9);
  });

  it("supports point-face distance", () => {
    const result = measureExactCad(
      {
        kind: "point_face_distance",
        point: vertexEntity("v3"),
        face: faceEntity("f_xy", new THREE.Vector3()),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "point_face_distance");
    assert.equal(result.source, "analytic");
    approx(result.value, 10, 1e-9);
  });

  it("supports angle between edges", () => {
    const result = measureExactCad(
      {
        kind: "edge_edge_angle",
        a: edgeEntity("e_line_x"),
        b: edgeEntity("e_line_y"),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "edge_edge_angle");
    assert.equal(result.unit, "deg");
    approx(result.value, 90, 1e-6);
  });

  it("supports angle between faces", () => {
    const result = measureExactCad(
      {
        kind: "face_face_angle",
        a: faceEntity("f_xy"),
        b: faceEntity("f_xz"),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "face_face_angle");
    assert.equal(result.unit, "deg");
    approx(result.value, 90, 1e-6);
  });

  it("supports radius and diameter for analytic entities", () => {
    const radius = measureExactCad(
      {
        kind: "radius",
        entity: edgeEntity("e_circle_analytic", new THREE.Vector3(5, 0, 0)),
      },
      context,
    );
    const diameter = measureExactCad(
      {
        kind: "diameter",
        entity: edgeEntity("e_circle_analytic", new THREE.Vector3(5, 0, 0)),
      },
      context,
    );

    assert.ok(radius);
    assert.ok(diameter);
    assert.equal(radius.source, "analytic");
    assert.equal(diameter.source, "analytic");
    assert.equal(radius.display?.style, "radial");
    assert.equal(diameter.display?.style, "diameter");
    assert.ok(radius.segment);
    assert.ok(diameter.segment);
    approx(radius.value, 5, 1e-9);
    approx(diameter.value, 10, 1e-9);
  });

  it("supports curve_feature entities when circularTarget is provided", () => {
    const fullTarget = resolveCircularMeasureTarget(
      edgeEntity("e_circle_split_q2", new THREE.Vector3(18, 3, 0)),
      context,
    );
    const arcTarget = resolveCircularMeasureTarget(
      edgeEntity("e_arc_split_a", new THREE.Vector3(-16, 4, 0)),
      context,
    );
    assert.ok(fullTarget);
    assert.ok(arcTarget);

    const diameter = measureExactCad(
      {
        kind: "diameter",
        entity: curveFeatureEntity("curve:full", new THREE.Vector3(24, 0, 0)),
        circularTarget: fullTarget ?? undefined,
      },
      context,
    );
    const radius = measureExactCad(
      {
        kind: "radius",
        entity: curveFeatureEntity("curve:arc", new THREE.Vector3(-24, 4, 0)),
        circularTarget: arcTarget ?? undefined,
      },
      context,
    );
    const arcLength = measureExactCad(
      {
        kind: "arc_length",
        entity: curveFeatureEntity("curve:arc", new THREE.Vector3(-24, 4, 0)),
        circularTarget: arcTarget ?? undefined,
      },
      context,
    );
    const angle = measureExactCad(
      {
        kind: "central_angle",
        entity: curveFeatureEntity("curve:arc", new THREE.Vector3(-24, 4, 0)),
        circularTarget: arcTarget ?? undefined,
      },
      context,
    );

    assert.ok(diameter);
    assert.ok(radius);
    assert.ok(arcLength);
    assert.ok(angle);
    approx(diameter.value, 8, 1e-6);
    approx(radius.value, 6, 1e-6);
    approx(arcLength.value, Math.PI * 6, 1e-6);
    approx(angle.value, 180, 1e-6);
  });

  it("preserves sampled source for curve_feature requests with sampled targets", () => {
    const sampledTarget = resolveCircularMeasureTarget(
      edgeEntity("e_arc_sampled", new THREE.Vector3(3, 13, 0)),
      context,
    );
    assert.ok(sampledTarget);

    const result = measureExactCad(
      {
        kind: "radius",
        entity: curveFeatureEntity("curve:sampled", new THREE.Vector3(3, 13, 0)),
        circularTarget: sampledTarget ?? undefined,
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.source, "sampled");
  });

  it("falls back to sampled radius/diameter when analytic metadata is missing", () => {
    const radius = measureExactCad(
      {
        kind: "radius",
        entity: edgeEntity("e_circle_sampled"),
      },
      context,
    );
    const diameter = measureExactCad(
      {
        kind: "diameter",
        entity: edgeEntity("e_circle_sampled"),
      },
      context,
    );

    assert.ok(radius);
    assert.ok(diameter);
    assert.equal(radius.source, "sampled");
    assert.equal(diameter.source, "sampled");
    assert.equal(radius.display?.style, "radial");
    assert.equal(diameter.display?.style, "diameter");
    assert.ok(radius.segment);
    assert.ok(diameter.segment);
    approx(radius.value, 3, 1e-3);
    approx(diameter.value, 6, 2e-3);
  });

  it("supports arc length for full circles", () => {
    const result = measureExactCad(
      {
        kind: "arc_length",
        entity: edgeEntity("e_circle_analytic"),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "arc_length");
    assert.equal(result.unit, "mm");
    assert.equal(result.source, "analytic");
    assert.equal(result.display?.style, "arcLabel");
    assert.equal(result.segment, undefined);
    approx(result.value, Math.PI * 10, 1e-6);
  });

  it("supports arc length for analytic partial arcs via sweep", () => {
    const result = measureExactCad(
      {
        kind: "arc_length",
        entity: edgeEntity("e_arc_analytic"),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "arc_length");
    assert.equal(result.source, "analytic");
    assert.equal(result.display?.style, "arcLabel");
    approx(result.value, Math.PI * 5, 1e-6);
  });

  it("falls back to sampled arc length when analytic sweep is unavailable", () => {
    const result = measureExactCad(
      {
        kind: "arc_length",
        entity: edgeEntity("e_arc_sampled"),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "arc_length");
    assert.equal(result.source, "sampled");
    assert.equal(result.display?.style, "arcLabel");
    approx(result.value, Math.PI * 2, 0.12);
  });

  it("supports central angle from analytic sweep", () => {
    const result = measureExactCad(
      {
        kind: "central_angle",
        entity: edgeEntity("e_arc_analytic"),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "central_angle");
    assert.equal(result.unit, "deg");
    assert.equal(result.source, "analytic");
    assert.equal(result.display?.style, "angle");
    approx(result.value, 180, 1e-6);
  });

  it("estimates central angle from sampled points when analytic sweep is missing", () => {
    const result = measureExactCad(
      {
        kind: "central_angle",
        entity: edgeEntity("e_arc_sampled"),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.kind, "central_angle");
    assert.equal(result.unit, "deg");
    assert.equal(result.source, "sampled");
    assert.equal(result.display?.style, "angle");
    approx(result.value, 90, 2);
  });

  it("resolves full circular components across split topology edges", () => {
    const target = resolveCircularMeasureTarget(
      edgeEntity("e_circle_split_q1", new THREE.Vector3(24, 0, 0)),
      context,
    );

    assert.ok(target);
    assert.equal(target.closedLoop, true);
    assert.equal(target.isFullCircle, true);
    assert.deepEqual(
      sorted(target.edgeIds),
      sorted([
        "e_circle_split_other_part",
        "e_circle_split_q1",
        "e_circle_split_q2",
        "e_circle_split_q3",
        "e_circle_split_q4",
      ]),
    );
    assert.equal(target.edgeIds.includes("e_circle_disconnected_piece"), false);
    assert.ok(target.radius !== null);
    assert.ok(target.sweepAngleRad !== null);
    approx(target.radius ?? 0, 4, 1e-6);
    approx(target.sweepAngleRad ?? 0, Math.PI * 2, 1e-4);
  });

  it("resolves split arcs by vertex connectivity", () => {
    const target = resolveCircularMeasureTarget(
      edgeEntity("e_arc_split_a", new THREE.Vector3(-15, 2, 0)),
      context,
    );

    assert.ok(target);
    assert.equal(target.closedLoop, false);
    assert.equal(target.isFullCircle, false);
    assert.deepEqual(
      sorted(target.edgeIds),
      sorted(["e_arc_split_a", "e_arc_split_b"]),
    );
    assert.ok(target.radius !== null);
    assert.ok(target.sweepAngleRad !== null);
    assert.ok(target.arcLength !== null);
    approx(target.radius ?? 0, 6, 1e-6);
    approx(target.sweepAngleRad ?? 0, Math.PI, 1e-6);
    approx(target.arcLength ?? 0, Math.PI * 6, 1e-6);
  });

  it("keeps topology-closed analytic arcs classified as open arcs", () => {
    const target = resolveCircularMeasureTarget(
      edgeEntity("e_arc_closed_flag_partial", new THREE.Vector3(30, 5, 0)),
      context,
    );

    assert.ok(target);
    assert.equal(target.closedLoop, false);
    assert.equal(target.isFullCircle, false);
    assert.ok(target.sweepAngleRad !== null);
    approx(target.sweepAngleRad ?? 0, Math.PI, 1e-6);

    const radius = measureExactCad(
      {
        kind: "radius",
        entity: edgeEntity(
          "e_arc_closed_flag_partial",
          new THREE.Vector3(30, 5, 0),
        ),
      },
      context,
    );
    assert.ok(radius);
    assert.equal(radius.kind, "radius");
    approx(radius.value, 5, 1e-6);
  });

  it("treats periodic full-circle metadata with distinct endpoints as an open arc", () => {
    const target = resolveCircularMeasureTarget(
      edgeEntity("e_arc_periodic_full_metadata", new THREE.Vector3(73, 3, 0)),
      context,
    );
    assert.ok(target);
    assert.equal(target.closedLoop, false);
    assert.equal(target.isFullCircle, false);
    assert.ok(target.startPoint);
    assert.ok(target.endPoint);
    if (target.startPoint && target.endPoint) {
      assert.ok(target.startPoint.distanceToSquared(target.endPoint) > 1e-8);
    }
    assert.ok(target.sweepAngleRad !== null);
    approx(target.sweepAngleRad ?? 0, Math.PI / 2, 5e-2);

    const arcDiameter = measureExactCad(
      {
        kind: "diameter",
        entity: edgeEntity(
          "e_arc_periodic_full_metadata",
          new THREE.Vector3(73, 3, 0),
        ),
      },
      context,
    );
    const arcRadius = measureExactCad(
      {
        kind: "radius",
        entity: edgeEntity(
          "e_arc_periodic_full_metadata",
          new THREE.Vector3(73, 3, 0),
        ),
      },
      context,
    );
    const circleDiameter = measureExactCad(
      {
        kind: "diameter",
        entity: edgeEntity("e_circle_analytic", new THREE.Vector3(5, 0, 0)),
      },
      context,
    );

    assert.equal(arcDiameter, null);
    assert.ok(arcRadius);
    approx(arcRadius.value, 5, 1e-6);
    assert.ok(circleDiameter);
    approx(circleDiameter.value, 10, 1e-9);
  });

  it("resolves split arcs by sampled endpoint proximity when vertex IDs are missing", () => {
    const target = resolveCircularMeasureTarget(
      edgeEntity("e_arc_split_novtx_a", new THREE.Vector3(4, 22, 0)),
      context,
    );

    assert.ok(target);
    assert.equal(target.closedLoop, false);
    assert.equal(target.isFullCircle, false);
    assert.deepEqual(
      sorted(target.edgeIds),
      sorted(["e_arc_split_novtx_a", "e_arc_split_novtx_b"]),
    );
    assert.ok(target.sweepAngleRad !== null);
    approx(target.sweepAngleRad ?? 0, Math.PI, 1e-5);
  });

  it("does not merge circular components across explicit part-id mismatch", () => {
    const edgeA = edges.find((entry) => entry.id === "e_arc_split_a");
    const edgeB = edges.find((entry) => entry.id === "e_arc_split_b");
    assert.ok(edgeA);
    assert.ok(edgeB);
    if (!edgeA || !edgeB) return;

    const localContext: ExactCadMeasurementContext = {
      verticesById: context.verticesById,
      facesById: new Map(),
      modelDiagonal: context.modelDiagonal,
      edgesById: new Map([
        [edgeA.id, { ...edgeA, partId: "part-a" }],
        [edgeB.id, { ...edgeB, partId: "part-b" }],
      ]),
    };
    const cache = buildCircularFeatureCache(localContext);
    assert.equal(cache.circularFeatureById.size, 2);
  });

  it("marks circular feature source as sampled when analytic metadata is insufficient", () => {
    const sampledEdge = edges.find((entry) => entry.id === "e_arc_sampled");
    assert.ok(sampledEdge);
    if (!sampledEdge) return;

    const localContext: ExactCadMeasurementContext = {
      verticesById: context.verticesById,
      facesById: context.facesById,
      modelDiagonal: context.modelDiagonal,
      edgesById: new Map([[sampledEdge.id, sampledEdge]]),
    };
    const cache = buildCircularFeatureCache(localContext);
    const featureId = cache.circularFeatureIdByEdgeId.get(sampledEdge.id);
    assert.ok(featureId);
    if (!featureId) return;
    const feature = cache.circularFeatureById.get(featureId);
    assert.ok(feature);
    assert.equal(feature?.source, "sampled");
  });

  it("merges noisy split full circles with duplicated non-shared endpoints", () => {
    const target = resolveCircularMeasureTarget(
      edgeEntity("e_noisy_circle_c", new THREE.Vector3(42, 10, 0)),
      context,
    );

    assert.ok(target);
    assert.equal(target.closedLoop, true);
    assert.equal(target.isFullCircle, true);
    assert.deepEqual(
      sorted(target.edgeIds),
      sorted([
        "e_noisy_circle_a",
        "e_noisy_circle_b",
        "e_noisy_circle_c",
        "e_noisy_circle_d",
      ]),
    );
    assert.ok(target.radius !== null);
    approx(target.radius ?? 0, 8, 5e-3);

    const cache = buildCircularFeatureCache(context);
    const featureId = cache.circularFeatureIdByEdgeId.get("e_noisy_circle_a");
    assert.ok(featureId);
    if (featureId) {
      assert.equal(
        cache.circularFeatureIdByEdgeId.get("e_noisy_circle_d"),
        featureId,
      );
      const feature = cache.circularFeatureById.get(featureId);
      assert.ok(feature);
      assert.equal(feature?.edgeIds.length, 4);
    }

    const diameter = measureExactCad(
      {
        kind: "diameter",
        entity: edgeEntity("e_noisy_circle_b", new THREE.Vector3(45, 16, 0)),
      },
      context,
    );
    assert.ok(diameter);
    approx(diameter.value, 16, 1e-2);
  });

  it("merges noisy split arcs with duplicated endpoints and tiny drift", () => {
    const target = resolveCircularMeasureTarget(
      edgeEntity("e_noisy_arc_b", new THREE.Vector3(-43, 34, 0)),
      context,
    );

    assert.ok(target);
    assert.equal(target.closedLoop, false);
    assert.equal(target.isFullCircle, false);
    assert.deepEqual(
      sorted(target.edgeIds),
      sorted(["e_noisy_arc_a", "e_noisy_arc_b"]),
    );
    assert.ok(target.radius !== null);
    approx(target.radius ?? 0, 5, 5e-3);

    const radius = measureExactCad(
      {
        kind: "radius",
        entity: edgeEntity("e_noisy_arc_a", new THREE.Vector3(-37, 33, 0)),
      },
      context,
    );
    assert.ok(radius);
    approx(radius.value, 5, 1e-2);
  });

  it("measures merged split circles as whole-circle features", () => {
    const diameter = measureExactCad(
      {
        kind: "diameter",
        entity: edgeEntity("e_circle_split_q3", new THREE.Vector3(16, 0, 0)),
      },
      context,
    );
    const arcLength = measureExactCad(
      {
        kind: "arc_length",
        entity: edgeEntity("e_circle_split_q2", new THREE.Vector3(18, 3, 0)),
      },
      context,
    );
    const angle = measureExactCad(
      {
        kind: "central_angle",
        entity: edgeEntity("e_circle_split_q4", new THREE.Vector3(22, -2, 0)),
      },
      context,
    );

    assert.ok(diameter);
    assert.ok(arcLength);
    assert.ok(angle);
    assert.equal(diameter.display?.style, "diameter");
    assert.equal(arcLength.display?.style, "arcLabel");
    assert.equal(angle.display?.style, "angle");
    approx(diameter.value, 8, 1e-6);
    approx(arcLength.value, Math.PI * 8, 1e-5);
    approx(angle.value, 360, 1e-6);
  });

  it("measures merged split arcs as whole-arc features", () => {
    const radius = measureExactCad(
      {
        kind: "radius",
        entity: edgeEntity("e_arc_split_b", new THREE.Vector3(-24, 4, 0)),
      },
      context,
    );
    const arcLength = measureExactCad(
      {
        kind: "arc_length",
        entity: edgeEntity("e_arc_split_a", new THREE.Vector3(-16, 4, 0)),
      },
      context,
    );
    const angle = measureExactCad(
      {
        kind: "central_angle",
        entity: edgeEntity("e_arc_split_b", new THREE.Vector3(-24, 4, 0)),
      },
      context,
    );

    assert.ok(radius);
    assert.ok(arcLength);
    assert.ok(angle);
    assert.equal(radius.display?.style, "radial");
    assert.equal(arcLength.display?.style, "arcLabel");
    assert.equal(angle.display?.style, "angle");
    approx(radius.value, 6, 1e-6);
    approx(arcLength.value, Math.PI * 6, 1e-6);
    approx(angle.value, 180, 1e-6);
  });

  it("falls back to adjacent cylindrical face radius/diameter when circular edge resolution fails", () => {
    const radius = measureExactCad(
      {
        kind: "radius",
        entity: edgeEntity(
          "e_circle_unresolved_face_fallback",
          new THREE.Vector3(5, 0, 0),
        ),
      },
      context,
    );
    const diameter = measureExactCad(
      {
        kind: "diameter",
        entity: edgeEntity(
          "e_circle_unresolved_face_fallback",
          new THREE.Vector3(5, 0, 0),
        ),
      },
      context,
    );

    assert.ok(radius);
    assert.ok(diameter);
    assert.equal(radius.source, "analytic");
    assert.equal(diameter.source, "analytic");
    assert.equal(radius.display?.style, "radial");
    assert.equal(diameter.display?.style, "diameter");
    approx(radius.value, 5, 1e-9);
    approx(diameter.value, 10, 1e-9);
  });

  it("uses request-provided circular targets before resolving from topology", () => {
    const circularTarget = {
      partId: null,
      edgeIds: ["provided"],
      center: new THREE.Vector3(2, 2, 0),
      normal: new THREE.Vector3(0, 0, 1),
      radius: 3,
      closedLoop: false,
      isFullCircle: false,
      startPoint: new THREE.Vector3(5, 2, 0),
      endPoint: new THREE.Vector3(2, 5, 0),
      midPoint: new THREE.Vector3(4.1213, 4.1213, 0),
      sweepAngleRad: Math.PI / 2,
      arcLength: null,
      source: "analytic" as const,
    };

    const radius = measureExactCad(
      {
        kind: "radius",
        entity: edgeEntity("e_line_x", new THREE.Vector3(5, 0, 0)),
        circularTarget,
      },
      context,
    );
    const diameter = measureExactCad(
      {
        kind: "diameter",
        entity: edgeEntity("e_line_x", new THREE.Vector3(5, 0, 0)),
        circularTarget,
      },
      context,
    );
    const arcLength = measureExactCad(
      {
        kind: "arc_length",
        entity: edgeEntity("e_line_x", new THREE.Vector3(5, 0, 0)),
        circularTarget,
      },
      context,
    );
    const angle = measureExactCad(
      {
        kind: "central_angle",
        entity: edgeEntity("e_line_x", new THREE.Vector3(5, 0, 0)),
        circularTarget,
      },
      context,
    );

    assert.ok(radius);
    assert.equal(diameter, null);
    assert.ok(arcLength);
    assert.ok(angle);
    assert.equal(radius.display?.style, "radial");
    if (radius.display?.style === "radial") {
      approxVec(radius.display.point, circularTarget.midPoint, 1e-4);
    }
    approx(radius.value, 3, 1e-9);
    approx(arcLength.value, (Math.PI / 2) * 3, 1e-9);
    approx(angle.value, 90, 1e-9);
  });

  it("keeps compatibility segment output for linear measurements", () => {
    const result = measureExactCad(
      {
        kind: "edge_length",
        edge: edgeEntity("e_line_x"),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.display?.style, "linear");
    assert.ok(result.segment);
  });

  it("uses picked face normals when analytic face data is unavailable", () => {
    const result = measureExactCad(
      {
        kind: "point_face_distance",
        point: edgeEntity("e_line_x", new THREE.Vector3(0, 7, 0)),
        face: faceEntity(
          "f_pick_only",
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 1, 0),
        ),
      },
      context,
    );

    assert.ok(result);
    assert.equal(result.source, "picked");
    approx(result.value, 7, 1e-9);
  });
});
