import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as THREE from "three";

import {
  buildCircularFeatureCache,
  type ExactCadMeasurementResult,
} from "../exact-cad-measurement";
import type {
  ExactEdge,
  ExactFace,
  ExactVertex,
  PickedEntity,
} from "../exact-cad-topology";
import {
  LEGACY_SEGMENT_PICKER_EXACT_MODE_MESSAGE,
  buildExactCadMeasurementOverlayInstruction,
  buildNonAutoExactCadMeasurementRequest,
  collectSuppressedCircularExactEdgeIds,
  exactCadPointToWorldForModelRoot,
  formatExactCadMeasurementLabel,
  getAutoMeasurementRequestForPickedEdge,
  getMeasurementSegmentLengthPx,
  resolveMeasurementArrowMetrics,
  resolveMeasurementArrowVisibilityForMode,
  resolveMeasurementRenderedLayoutForOverlay,
  reportLegacySegmentPickerUsageInExactCadMode,
  resolveMeasurementRenderedSegmentForOverlay,
  resolveExactCadCurveFeatureHoverPath,
  resolveExactCadEntityPickResult,
  resolveExactCadMeasurementSelection,
  resolveExactCadPickedEntityFromIntersections,
  resolveMeasurementAnchorEntity,
  type MeasurementProjectionContext,
  type ExactCadSingleEntityMeasurementMode,
} from "../viewer";

function approx(actual: number, expected: number, tolerance = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function sorted(values: string[]): string[] {
  return [...values].sort();
}

function approxVec(actual: THREE.Vector3, expected: THREE.Vector3, tol = 1e-6): void {
  approx(actual.x, expected.x, tol);
  approx(actual.y, expected.y, tol);
  approx(actual.z, expected.z, tol);
}

function makePerspectiveProjectionContext(params?: {
  width?: number;
  height?: number;
  position?: THREE.Vector3;
  lookAt?: THREE.Vector3;
  fov?: number;
}): MeasurementProjectionContext {
  const width = params?.width ?? 1200;
  const height = params?.height ?? 800;
  const camera = new THREE.PerspectiveCamera(
    params?.fov ?? 50,
    width / Math.max(1, height),
    0.1,
    5000,
  );
  camera.position.copy(params?.position ?? new THREE.Vector3(0, 0, 80));
  camera.lookAt(params?.lookAt ?? new THREE.Vector3(0, 0, 0));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return { camera, viewportWidth: width, viewportHeight: height };
}

const vertices: ExactVertex[] = [
  { id: "v0", partId: null, point: [0, 0, 0] },
  { id: "v1", partId: null, point: [10, 0, 0] },
  { id: "v10", partId: null, point: [24, 0, 0] },
  { id: "v11", partId: null, point: [20, 4, 0] },
  { id: "v12", partId: null, point: [16, 0, 0] },
  { id: "v13", partId: null, point: [20, -4, 0] },
  { id: "v20", partId: null, point: [-14, 0, 0] },
  { id: "v21", partId: null, point: [-20, 6, 0] },
  { id: "v22", partId: null, point: [-26, 0, 0] },
];

const edges: ExactEdge[] = [
  {
    id: "e_line",
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
    id: "e_ellipse",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "ellipse",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([0, 0, 0, 3, 2, 0, 6, 0, 0]),
  },
  {
    id: "e_bspline",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "bspline",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([0, 0, 0, 2, 1, 0, 4, 0, 0]),
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
    samplePositions: new Float32Array([24, 0, 0, 22.8284271, 2.8284271, 0, 20, 4, 0]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [24, 0, 0],
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
    samplePositions: new Float32Array([20, 4, 0, 17.1715729, 2.8284271, 0, 16, 0, 0]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [20, 4, 0],
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
    samplePositions: new Float32Array([16, 0, 0, 17.1715729, -2.8284271, 0, 20, -4, 0]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [16, 0, 0],
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
    samplePositions: new Float32Array([20, -4, 0, 22.8284271, -2.8284271, 0, 24, 0, 0]),
    analytic: {
      radius: 4,
      center: [20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [20, -4, 0],
      endPoint: [24, 0, 0],
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
    samplePositions: new Float32Array([-14, 0, 0, -15.7573593, 4.2426407, 0, -20, 6, 0]),
    analytic: {
      radius: 6,
      center: [-20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [-14, 0, 0],
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
    samplePositions: new Float32Array([-20, 6, 0, -24.2426407, 4.2426407, 0, -26, 0, 0]),
    analytic: {
      radius: 6,
      center: [-20, 0, 0],
      normal: [0, 0, 1],
      startPoint: [-20, 6, 0],
      endPoint: [-26, 0, 0],
      sweepAngleRad: Math.PI / 2,
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
      center: [30, 0, 0],
      normal: [0, 0, 1],
      startPoint: [35, 0, 0],
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
    id: "e_circle_unresolved_face_fallback",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: ["f_cyl"],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([5, 0, 0, 5, 0, 10]),
  },
  {
    id: "e_circle_unresolved_no_face",
    partId: null,
    vertexIds: null,
    adjacentFaceIds: [],
    kind: "sharp",
    curveKind: "circle",
    closed: false,
    periodic: false,
    samplePositions: new Float32Array([5, 0, 0, 5, 0, 10]),
  },
];

const faces: ExactFace[] = [
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

const context = {
  verticesById: new Map(vertices.map((entry) => [entry.id, entry])),
  edgesById: new Map(edges.map((entry) => [entry.id, entry])),
  facesById: new Map(faces.map((entry) => [entry.id, entry])),
  modelDiagonal: 120,
};
const circularFeatureCache = buildCircularFeatureCache(context);
const curveFeatureById = new Map<string, any>();
for (const [featureId, feature] of circularFeatureCache.circularFeatureById) {
  curveFeatureById.set(featureId, {
    kind: feature.isFullCircle ? "circle" : "arc",
    featureId,
    partId: feature.partId,
    edgeIds: [...feature.edgeIds],
    source: feature.source,
    edgeKind: "sharp",
    center: feature.center?.clone() ?? null,
    normal: feature.normal?.clone() ?? null,
    radius: feature.radius,
    isFullCircle: feature.isFullCircle,
    startPoint: feature.startPoint?.clone() ?? null,
    endPoint: feature.endPoint?.clone() ?? null,
    midPoint: feature.midPoint?.clone() ?? null,
    sweepAngleRad: feature.sweepAngleRad,
    arcLength: feature.arcLength,
  });
}
const autoContext = {
  ...context,
  circularFeatureById: circularFeatureCache.circularFeatureById,
  circularFeatureIdByEdgeId: circularFeatureCache.circularFeatureIdByEdgeId,
  curveFeatureById,
};

const fullCircleFeatureId =
  circularFeatureCache.circularFeatureIdByEdgeId.get("e_circle_split_q2") ?? null;
const arcFeatureId =
  circularFeatureCache.circularFeatureIdByEdgeId.get("e_arc_split_a") ?? null;
const periodicMetadataArcFeatureId =
  circularFeatureCache.circularFeatureIdByEdgeId.get(
    "e_arc_periodic_full_metadata",
  ) ?? null;

function edgeEntity(edgeId: string, point = new THREE.Vector3()): PickedEntity {
  return { kind: "edge", partId: null, edgeId, point };
}

function curveFeatureEntity(
  featureId: string,
  point = new THREE.Vector3(),
): PickedEntity {
  return { kind: "curve_feature", partId: null, featureId, point };
}

function makeIntersection(
  userData: Record<string, unknown>,
  point: THREE.Vector3,
): { object: THREE.Object3D; point: THREE.Vector3 } {
  const object = new THREE.Object3D();
  object.userData = { ...userData };
  return { object, point };
}

function makeRayIntersection(params: {
  userData: Record<string, unknown>;
  point: THREE.Vector3;
  distance?: number;
  distanceToRay?: number;
}): THREE.Intersection {
  const object = new THREE.Object3D();
  object.userData = { ...params.userData };
  return {
    object,
    point: params.point,
    distance: params.distance ?? 0,
    distanceToRay: params.distanceToRay ?? 0,
  } as THREE.Intersection;
}

describe("viewer exact CAD measurement flow helpers", () => {
  it("resolves split full circles to diameter in auto mode", () => {
    const result = getAutoMeasurementRequestForPickedEdge(
      edgeEntity("e_circle_split_q3", new THREE.Vector3(16, 0, 0)),
      autoContext,
    );

    assert.ok(result.request);
    assert.equal(result.request.kind, "diameter");
    assert.ok(result.circularTarget);
    assert.equal(result.circularTarget.isFullCircle, true);
    if (result.request.kind === "diameter") {
      assert.ok(result.request.circularTarget);
      assert.equal(result.request.circularTarget.isFullCircle, true);
    }
    assert.deepEqual(
      sorted(result.circularTarget.edgeIds),
      sorted([
        "e_circle_split_q1",
        "e_circle_split_q2",
        "e_circle_split_q3",
        "e_circle_split_q4",
      ]),
    );
  });

  it("resolves split open arcs to radius in auto mode", () => {
    const result = getAutoMeasurementRequestForPickedEdge(
      edgeEntity("e_arc_split_b", new THREE.Vector3(-24, 4, 0)),
      autoContext,
    );

    assert.ok(result.request);
    assert.equal(result.request.kind, "radius");
    assert.ok(result.circularTarget);
    assert.equal(result.circularTarget.isFullCircle, false);
    if (result.request.kind === "radius") {
      assert.ok(result.request.circularTarget);
      assert.equal(result.request.circularTarget.isFullCircle, false);
    }
    assert.deepEqual(
      sorted(result.circularTarget.edgeIds),
      sorted(["e_arc_split_a", "e_arc_split_b"]),
    );
  });

  it("keeps topology-closed partial arcs on radius in auto mode", () => {
    const result = getAutoMeasurementRequestForPickedEdge(
      edgeEntity("e_arc_closed_flag_partial", new THREE.Vector3(30, 5, 0)),
      autoContext,
    );

    assert.ok(result.request);
    assert.equal(result.request?.kind, "radius");
    assert.ok(result.circularTarget);
    assert.equal(result.circularTarget?.isFullCircle, false);
  });

  it("keeps periodic full-circle metadata with distinct endpoints on radius in auto mode", () => {
    const result = getAutoMeasurementRequestForPickedEdge(
      edgeEntity("e_arc_periodic_full_metadata", new THREE.Vector3(73, 3, 0)),
      autoContext,
    );

    assert.ok(result.request);
    assert.equal(result.request?.kind, "radius");
    assert.ok(result.circularTarget);
    assert.equal(result.circularTarget?.isFullCircle, false);
  });

  it("resolves curve_feature picks to whole-feature defaults in auto mode", () => {
    assert.ok(fullCircleFeatureId);
    assert.ok(arcFeatureId);
    if (!fullCircleFeatureId || !arcFeatureId) return;

    const fullCircle = getAutoMeasurementRequestForPickedEdge(
      curveFeatureEntity(fullCircleFeatureId, new THREE.Vector3(24, 0, 0)),
      autoContext,
    );
    const arc = getAutoMeasurementRequestForPickedEdge(
      curveFeatureEntity(arcFeatureId, new THREE.Vector3(-24, 4, 0)),
      autoContext,
    );

    assert.ok(fullCircle.request);
    assert.ok(arc.request);
    assert.equal(fullCircle.request?.kind, "diameter");
    assert.equal(arc.request?.kind, "radius");
    assert.ok(fullCircle.circularTarget);
    assert.ok(arc.circularTarget);
    assert.equal(fullCircle.circularTarget?.isFullCircle, true);
    assert.equal(arc.circularTarget?.isFullCircle, false);
  });

  it("falls back per auto rules for non-circle and unresolved circle edges", () => {
    const line = getAutoMeasurementRequestForPickedEdge(
      edgeEntity("e_line", new THREE.Vector3(3, 0, 0)),
      autoContext,
    );
    const ellipse = getAutoMeasurementRequestForPickedEdge(
      edgeEntity("e_ellipse", new THREE.Vector3(3, 1, 0)),
      autoContext,
    );
    const bspline = getAutoMeasurementRequestForPickedEdge(
      edgeEntity("e_bspline", new THREE.Vector3(2, 0.5, 0)),
      autoContext,
    );
    const unresolvedWithFace = getAutoMeasurementRequestForPickedEdge(
      edgeEntity("e_circle_unresolved_face_fallback", new THREE.Vector3(5, 0, 0)),
      autoContext,
    );
    const contextWithoutFaces = {
      ...context,
      facesById: new Map<string, ExactFace>(),
    };
    const unresolvedNoFace = getAutoMeasurementRequestForPickedEdge(
      edgeEntity("e_circle_unresolved_no_face", new THREE.Vector3(5, 0, 0)),
      contextWithoutFaces,
    );

    assert.equal(line.request?.kind, "edge_length");
    assert.equal(ellipse.request?.kind, "edge_length");
    assert.equal(bspline.request?.kind, "edge_length");

    assert.ok(unresolvedWithFace.request);
    assert.equal(unresolvedWithFace.request.kind, "radius");
    if (unresolvedWithFace.request.kind === "radius") {
      assert.equal(unresolvedWithFace.request.entity.kind, "face");
      assert.equal(unresolvedWithFace.request.entity.faceId, "f_cyl");
    }

    assert.equal(unresolvedNoFace.request?.kind, "edge_length");
  });

  it("builds non-auto requests and resolves anchor entities", () => {
    const pickedEdge = edgeEntity("e_line", new THREE.Vector3(2, 0, 0));
    const expectedKinds: Array<
      [ExactCadSingleEntityMeasurementMode, ExactCadMeasurementResult["kind"] | null]
    > = [
      ["auto", null],
      ["length", "edge_length"],
      ["radius", "radius"],
      ["diameter", "diameter"],
      ["arc_length", "arc_length"],
      ["central_angle", "central_angle"],
    ];

    for (const [mode, expectedKind] of expectedKinds) {
      const request = buildNonAutoExactCadMeasurementRequest(pickedEdge, mode);
      if (expectedKind === null) {
        assert.equal(request, null);
      } else {
        assert.ok(request);
        assert.equal(request.kind, expectedKind);
      }
    }

    const radiusRequest = { kind: "radius" as const, entity: pickedEdge };
    const lengthRequest = { kind: "edge_length" as const, edge: pickedEdge };
    const fallback = edgeEntity("e_bspline", new THREE.Vector3(1, 1, 0));

    assert.equal(resolveMeasurementAnchorEntity(lengthRequest, fallback), pickedEdge);
    assert.equal(resolveMeasurementAnchorEntity(radiusRequest, fallback), pickedEdge);
    assert.equal(resolveMeasurementAnchorEntity(null, fallback), fallback);
  });

  it("maps non-auto curve_feature length mode to arc_length", () => {
    const featureId =
      circularFeatureCache.circularFeatureIdByEdgeId.get("e_arc_split_b") ?? null;
    assert.ok(featureId);
    if (!featureId) return;
    const pickedFeature = curveFeatureEntity(
      featureId,
      new THREE.Vector3(-24, 4, 0),
    );

    const length = buildNonAutoExactCadMeasurementRequest(pickedFeature, "length");
    const radius = buildNonAutoExactCadMeasurementRequest(pickedFeature, "radius");
    const diameter = buildNonAutoExactCadMeasurementRequest(
      pickedFeature,
      "diameter",
    );
    const arcLength = buildNonAutoExactCadMeasurementRequest(
      pickedFeature,
      "arc_length",
    );
    const centralAngle = buildNonAutoExactCadMeasurementRequest(
      pickedFeature,
      "central_angle",
    );

    assert.equal(length?.kind, "arc_length");
    assert.equal(radius?.kind, "radius");
    assert.equal(diameter?.kind, "diameter");
    assert.equal(arcLength?.kind, "arc_length");
    assert.equal(centralAngle?.kind, "central_angle");
  });

  it("suppresses raw circular source edges from main exact edge targets", () => {
    const featureMap = new Map<string, any>([
      [
        "circle:1",
        {
          kind: "circle",
          edgeIds: ["e_circle_split_q1", "e_circle_split_q2"],
        },
      ],
      [
        "arc:1",
        {
          kind: "arc",
          edgeIds: ["e_arc_split_a", "e_arc_split_b"],
        },
      ],
      [
        "line:1",
        {
          kind: "line",
          edgeIds: ["e_line"],
        },
      ],
    ]);

    const suppressed = collectSuppressedCircularExactEdgeIds(featureMap);
    assert.deepEqual(
      sorted(Array.from(suppressed)),
      sorted([
        "e_circle_split_q1",
        "e_circle_split_q2",
        "e_arc_split_a",
        "e_arc_split_b",
      ]),
    );
    assert.equal(suppressed.has("e_line"), false);
  });

  it("picking prefers curve feature intersections before raw edge intersections", () => {
    const featureId =
      circularFeatureCache.circularFeatureIdByEdgeId.get("e_arc_split_b") ?? null;
    assert.ok(featureId);
    if (!featureId) return;

    const picked = resolveExactCadPickedEntityFromIntersections(
      [
        makeIntersection(
          { __exactCurveFeatureId: featureId, __cadPartId: "part-a" },
          new THREE.Vector3(-24, 4, 0),
        ),
      ],
      [
        makeIntersection(
          { __exactEdgeId: "e_line", __cadPartId: "part-b" },
          new THREE.Vector3(2, 0, 0),
        ),
      ],
      {
        curveFeatureById,
        edgesById: context.edgesById,
      },
    );

    assert.ok(picked);
    assert.equal(picked?.kind, "curve_feature");
    if (picked?.kind === "curve_feature") {
      assert.equal(picked.featureId, featureId);
      assert.equal(picked.partId, "part-a");
      approxVec(picked.point, new THREE.Vector3(-24, 4, 0));
    }
  });

  it("falls back to raw exact edges when curve feature hits are missing/invalid", () => {
    const lineFeatureMap = new Map<string, any>([
      [
        "line:e_line",
        {
          kind: "line",
          edgeIds: ["e_line"],
        },
      ],
    ]);
    const picked = resolveExactCadPickedEntityFromIntersections(
      [
        makeIntersection(
          { __exactCurveFeatureId: "missing-curve-feature" },
          new THREE.Vector3(9, 9, 9),
        ),
        makeIntersection(
          { __exactCurveFeatureId: "line:e_line" },
          new THREE.Vector3(8, 8, 8),
        ),
      ],
      [
        makeIntersection(
          { __exactEdgeId: "e_line", __cadPartId: "part-line" },
          new THREE.Vector3(1, 0, 0),
        ),
      ],
      {
        curveFeatureById: lineFeatureMap,
        edgesById: context.edgesById,
      },
    );

    assert.ok(picked);
    assert.equal(picked?.kind, "edge");
    if (picked?.kind === "edge") {
      assert.equal(picked.edgeId, "e_line");
      assert.equal(picked.partId, "part-line");
      approxVec(picked.point, new THREE.Vector3(1, 0, 0));
    }
  });

  it("exact picker helper returns curve_feature when curve intersections are present", () => {
    assert.ok(arcFeatureId);
    if (!arcFeatureId) return;

    const picked = resolveExactCadEntityPickResult({
      curveIntersections: [
        makeRayIntersection({
          userData: { __exactCurveFeatureId: arcFeatureId, __cadPartId: "part-curve" },
          point: new THREE.Vector3(-24, 4, 0),
          distance: 2,
          distanceToRay: 0.2,
        }),
      ],
      edgeIntersections: [
        makeRayIntersection({
          userData: { __exactEdgeId: "e_line", __cadPartId: "part-edge" },
          point: new THREE.Vector3(2, 0, 0),
          distance: 0.1,
          distanceToRay: 0.01,
        }),
      ],
      curveFeatureById,
      edgesById: context.edgesById,
    });

    assert.ok(picked);
    assert.equal(picked?.kind, "curve_feature");
    if (picked?.kind === "curve_feature") {
      assert.equal(picked.featureId, arcFeatureId);
      assert.equal(picked.partId, "part-curve");
    }
  });

  it("exact measurement selection chooses diameter for full circle curve_feature", () => {
    assert.ok(fullCircleFeatureId);
    if (!fullCircleFeatureId) return;

    const selection = resolveExactCadMeasurementSelection({
      pickedEntity: curveFeatureEntity(
        fullCircleFeatureId,
        new THREE.Vector3(24, 0, 0),
      ),
      measurementMode: "auto",
      context: autoContext,
    });

    assert.ok(selection.request);
    assert.equal(selection.request?.kind, "diameter");
    assert.ok(selection.anchorEntity);
    assert.equal(selection.anchorEntity?.kind, "curve_feature");
  });

  it("exact measurement selection chooses radius for arc curve_feature", () => {
    assert.ok(arcFeatureId);
    if (!arcFeatureId) return;

    const selection = resolveExactCadMeasurementSelection({
      pickedEntity: curveFeatureEntity(arcFeatureId, new THREE.Vector3(-24, 4, 0)),
      measurementMode: "auto",
      context: autoContext,
    });

    assert.ok(selection.request);
    assert.equal(selection.request?.kind, "radius");
    assert.ok(selection.anchorEntity);
    assert.equal(selection.anchorEntity?.kind, "curve_feature");
  });

  it("exact measurement selection keeps periodic full-circle metadata curve features on radius", () => {
    assert.ok(periodicMetadataArcFeatureId);
    if (!periodicMetadataArcFeatureId) return;

    const selection = resolveExactCadMeasurementSelection({
      pickedEntity: curveFeatureEntity(
        periodicMetadataArcFeatureId,
        new THREE.Vector3(73, 3, 0),
      ),
      measurementMode: "auto",
      context: autoContext,
    });

    assert.ok(selection.request);
    assert.equal(selection.request?.kind, "radius");
    assert.ok(selection.circularTarget);
    assert.equal(selection.circularTarget?.isFullCircle, false);
  });

  it("exact hover curve_feature path uses whole feature positions", () => {
    assert.ok(arcFeatureId);
    if (!arcFeatureId) return;

    const wholeFeaturePositions = [
      -14, 0, 0,
      -16, 2, 0,
      -20, 6, 0,
      -24, 4, 0,
      -26, 0, 0,
    ];
    const hitSegmentOnlyPositions = wholeFeaturePositions.slice(0, 6);

    const hover = resolveExactCadCurveFeatureHoverPath({
      pickedEntity: curveFeatureEntity(arcFeatureId, new THREE.Vector3(-20, 5, 0)),
      curveFeatureById,
      getWholeCurveFeaturePositions: () => wholeFeaturePositions,
    });

    assert.ok(hover);
    assert.equal(hover?.usedWholeFeature, true);
    assert.deepEqual(hover?.positions, wholeFeaturePositions);
    assert.notDeepEqual(hover?.positions, hitSegmentOnlyPositions);
  });

  it("exact hover path keeps periodic full-circle metadata features open with arc endpoints", () => {
    assert.ok(periodicMetadataArcFeatureId);
    if (!periodicMetadataArcFeatureId) return;

    const wholeFeaturePositions = [
      75, 0, 0,
      74.6194, 1.9134, 0,
      73.5355339, 3.5355339, 0,
      71.9134, 4.6194, 0,
      70, 5, 0,
    ];

    const hover = resolveExactCadCurveFeatureHoverPath({
      pickedEntity: curveFeatureEntity(
        periodicMetadataArcFeatureId,
        new THREE.Vector3(73, 3, 0),
      ),
      curveFeatureById,
      getWholeCurveFeaturePositions: () => wholeFeaturePositions,
    });

    assert.ok(hover);
    assert.equal(hover?.usedWholeFeature, true);
    assert.ok(hover?.endpointA);
    assert.ok(hover?.endpointB);
    if (hover?.endpointA && hover.endpointB) {
      approxVec(hover.endpointA, new THREE.Vector3(75, 0, 0), 1e-4);
      approxVec(hover.endpointB, new THREE.Vector3(70, 5, 0), 1e-4);
    }
  });

  it("classifies topology-closed partial circular features as arcs", () => {
    const featureId =
      circularFeatureCache.circularFeatureIdByEdgeId.get(
        "e_arc_closed_flag_partial",
      ) ?? null;
    assert.ok(featureId);
    if (!featureId) return;

    const feature = curveFeatureById.get(featureId);
    assert.ok(feature);
    assert.equal(feature?.kind, "arc");
    assert.equal(feature?.isFullCircle, false);
  });

  it("classifies periodic full-circle metadata with distinct endpoints as an arc", () => {
    assert.ok(periodicMetadataArcFeatureId);
    if (!periodicMetadataArcFeatureId) return;
    const feature = curveFeatureById.get(periodicMetadataArcFeatureId);
    assert.ok(feature);
    assert.equal(feature?.kind, "arc");
    assert.equal(feature?.isFullCircle, false);
  });

  it("emits a legacy picker migration warning with stack details", () => {
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };

    try {
      reportLegacySegmentPickerUsageInExactCadMode();
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], LEGACY_SEGMENT_PICKER_EXACT_MODE_MESSAGE);
    assert.equal(typeof calls[0][1], "string");
    assert.match(String(calls[0][1]), /reportLegacySegmentPickerUsageInExactCadMode/);
  });

  it("maps measurement display styles to overlay instructions", () => {
    const pickedEdge = edgeEntity("e_line", new THREE.Vector3(0, 3, 0));

    const linear = buildExactCadMeasurementOverlayInstruction(
      {
        kind: "edge_length",
        value: 8,
        unit: "mm",
        source: "topology",
        display: {
          style: "linear",
          start: new THREE.Vector3(0, 0, 0),
          end: new THREE.Vector3(8, 0, 0),
        },
      },
      pickedEdge,
    );
    assert.equal(linear.kind, "segment");
    if (linear.kind === "segment") {
      assert.equal(linear.style, "linear");
      approxVec(linear.start, new THREE.Vector3(0, 0, 0));
      approxVec(linear.end, new THREE.Vector3(8, 0, 0));
      assert.ok(linear.labelAnchor);
      if (linear.labelAnchor) {
        approxVec(linear.labelAnchor, new THREE.Vector3(4, 0, 0));
      }
      assert.equal(linear.segmentAnchor, undefined);
    }

    const radial = buildExactCadMeasurementOverlayInstruction(
      {
        kind: "radius",
        value: 5,
        unit: "mm",
        source: "analytic",
        display: {
          style: "radial",
          center: new THREE.Vector3(0, 0, 0),
          point: new THREE.Vector3(5, 0, 0),
        },
      },
      pickedEdge,
    );
    assert.equal(radial.kind, "segment");
    if (radial.kind === "segment") {
      assert.equal(radial.style, "radial");
      approxVec(radial.start, new THREE.Vector3(0, 0, 0));
      approxVec(radial.end, new THREE.Vector3(5, 0, 0));
      assert.ok(radial.segmentAnchor);
      if (radial.segmentAnchor) {
        approxVec(radial.segmentAnchor, pickedEdge.point);
      }
      assert.equal(radial.labelAnchor ?? null, null);
    }

    const diameter = buildExactCadMeasurementOverlayInstruction(
      {
        kind: "diameter",
        value: 4,
        unit: "mm",
        source: "analytic",
        display: {
          style: "diameter",
          center: new THREE.Vector3(0, 0, 0),
          start: new THREE.Vector3(-2, 0, 0),
          end: new THREE.Vector3(2, 0, 0),
        },
      },
      pickedEdge,
    );
    assert.equal(diameter.kind, "segment");
    if (diameter.kind === "segment") {
      assert.equal(diameter.style, "diameter");
      approxVec(diameter.start, new THREE.Vector3(0, -2, 0));
      approxVec(diameter.end, new THREE.Vector3(0, 2, 0));
      assert.ok(diameter.labelAnchor);
      if (diameter.labelAnchor) {
        approxVec(diameter.labelAnchor, new THREE.Vector3(0, 0, 0));
      }
    }

    const arcLabel = buildExactCadMeasurementOverlayInstruction(
      {
        kind: "arc_length",
        value: 3.14,
        unit: "mm",
        source: "sampled",
        display: { style: "arcLabel", point: new THREE.Vector3(1, 2, 0) },
      },
      pickedEdge,
    );
    assert.equal(arcLabel.kind, "label");
    if (arcLabel.kind === "label") {
      approxVec(arcLabel.point, new THREE.Vector3(1, 2, 0));
    }

    const angle = buildExactCadMeasurementOverlayInstruction(
      {
        kind: "central_angle",
        value: 90,
        unit: "deg",
        source: "analytic",
        display: {
          style: "angle",
          center: new THREE.Vector3(0, 0, 0),
          start: new THREE.Vector3(1, 0, 0),
          end: new THREE.Vector3(0, 1, 0),
        },
      },
      pickedEdge,
    );
    assert.equal(angle.kind, "label");
    if (angle.kind === "label") {
      const d = 0.55 / Math.sqrt(2);
      approxVec(angle.point, new THREE.Vector3(d, d, 0), 1e-6);
    }
  });

  it("transforms exact overlay points through translated modelRoot (bug trigger)", () => {
    const modelRoot = new THREE.Group();
    modelRoot.position.set(120, -45, 30);

    const localStart = new THREE.Vector3(1, 2, 3);
    const localEnd = new THREE.Vector3(8, 5, -2);
    const localLabel = new THREE.Vector3(-4, 6, 1);

    const worldStart = exactCadPointToWorldForModelRoot(localStart, modelRoot);
    const worldEnd = exactCadPointToWorldForModelRoot(localEnd, modelRoot);
    const worldLabel = exactCadPointToWorldForModelRoot(localLabel, modelRoot);

    assert.ok(worldStart);
    assert.ok(worldEnd);
    assert.ok(worldLabel);
    if (!worldStart || !worldEnd || !worldLabel) return;

    approxVec(worldStart, new THREE.Vector3(121, -43, 33));
    approxVec(worldEnd, new THREE.Vector3(128, -40, 28));
    approxVec(worldLabel, new THREE.Vector3(116, -39, 31));

    // Ensure conversion clones and does not mutate source local points.
    approxVec(localStart, new THREE.Vector3(1, 2, 3));
    approxVec(localEnd, new THREE.Vector3(8, 5, -2));
    approxVec(localLabel, new THREE.Vector3(-4, 6, 1));
    assert.equal(exactCadPointToWorldForModelRoot(null, modelRoot), null);
  });

  it("uses radial segment anchor for leader start and keeps label off the stem midpoint", () => {
    const center = new THREE.Vector3(10, 10, 0);
    const radiusPoint = new THREE.Vector3(14, 10, 0);
    const pickedPoint = new THREE.Vector3(16, 14, 0);

    const rendered = resolveMeasurementRenderedSegmentForOverlay({
      p1: center,
      p2: radiusPoint,
      style: "radial",
      segmentAnchor: pickedPoint,
    });

    approxVec(rendered.start, pickedPoint);
    const expectedDirection = pickedPoint.clone().sub(center).normalize();
    const actualDirection = rendered.end.clone().sub(rendered.start).normalize();
    approx(actualDirection.dot(expectedDirection), 1, 1e-6);
    const stemMidpoint = rendered.start.clone().lerp(rendered.end, 0.5);
    assert.ok(rendered.labelAnchor.distanceTo(stemMidpoint) > 1e-6);
    assert.ok(rendered.labelAnchor.distanceTo(rendered.end) > 1e-6);
  });

  it("keeps linear rendered label anchored at measured segment midpoint", () => {
    const p1 = new THREE.Vector3(-2, 1, 0);
    const p2 = new THREE.Vector3(8, 1, 0);
    const unrelatedSegmentAnchor = new THREE.Vector3(100, 100, 100);

    const rendered = resolveMeasurementRenderedSegmentForOverlay({
      p1,
      p2,
      style: "linear",
      segmentAnchor: unrelatedSegmentAnchor,
    });

    approxVec(rendered.start, p1);
    approxVec(rendered.end, p2);
    approxVec(rendered.labelAnchor, new THREE.Vector3(3, 1, 0));
  });

  it("resolves smaller arrows for short linear dimensions than long ones", () => {
    const projection = makePerspectiveProjectionContext();
    const shortMetrics = resolveMeasurementArrowMetrics({
      style: "linear",
      p1: new THREE.Vector3(0, 0, 0),
      p2: new THREE.Vector3(2, 0, 0),
      projection,
      measureGraphicsScale: 1,
    });
    const longMetrics = resolveMeasurementArrowMetrics({
      style: "linear",
      p1: new THREE.Vector3(0, 0, 0),
      p2: new THREE.Vector3(30, 0, 0),
      projection,
      measureGraphicsScale: 1,
    });

    assert.ok(shortMetrics.arrowLengthWorld < longMetrics.arrowLengthWorld);
    assert.ok(longMetrics.arrowLengthWorld > shortMetrics.arrowLengthWorld * 1.5);
  });

  it("keeps non-radial dimensions in inward-arrow mode without extending the line", () => {
    const projection = makePerspectiveProjectionContext();
    const styles: Array<"linear" | "diameter" | "generic"> = [
      "linear",
      "diameter",
      "generic",
    ];

    for (const style of styles) {
      const p1 = new THREE.Vector3(0, 0, 0);
      const p2 = new THREE.Vector3(0.5, 0, 0);
      const layout = resolveMeasurementRenderedLayoutForOverlay({
        p1,
        p2,
        style,
        segmentAnchor: null,
        projection,
        measureGraphicsScale: 1,
      });

      assert.equal(layout.arrowMode, "double-inward");
      approxVec(layout.pathPoints[0], p1, 1e-6);
      approxVec(layout.pathPoints[1], p2, 1e-6);
      approxVec(layout.startArrowTip, p1, 1e-6);
      assert.ok(layout.endArrowTip);
      if (layout.endArrowTip) {
        approxVec(layout.endArrowTip, p2, 1e-6);
      }
    }
  });

  it("resolves radial layout to single-start arrow mode", () => {
    const projection = makePerspectiveProjectionContext();
    const center = new THREE.Vector3(10, 10, 0);
    const radiusPoint = new THREE.Vector3(14, 10, 0);
    const pickedPoint = new THREE.Vector3(12.8, 12.8, 0);
    const layout = resolveMeasurementRenderedLayoutForOverlay({
      p1: center,
      p2: radiusPoint,
      style: "radial",
      segmentAnchor: pickedPoint,
      projection,
      measureGraphicsScale: 1,
    });

    assert.equal(layout.arrowMode, "single-start");
    approxVec(layout.startArrowTip, pickedPoint);
    const outward = layout.pathPoints[1].clone().sub(layout.pathPoints[0]).normalize();
    const startDirection = layout.startArrowDirection.clone().normalize();
    approx(startDirection.dot(outward), 1, 1e-6);
  });

  it("builds radial layouts as a 3-point outside leader path", () => {
    const projection = makePerspectiveProjectionContext();
    const center = new THREE.Vector3(0, 0, 0);
    const pickedPoint = new THREE.Vector3(5, 0, 0);
    const layout = resolveMeasurementRenderedLayoutForOverlay({
      p1: center,
      p2: pickedPoint,
      style: "radial",
      segmentAnchor: pickedPoint,
      projection,
      measureGraphicsScale: 1,
    });

    assert.equal(layout.pathPoints.length, 3);
    approxVec(layout.pathPoints[0], pickedPoint);
    const radialDir = pickedPoint.clone().sub(center).normalize();
    const stemDir = layout.pathPoints[1].clone().sub(layout.pathPoints[0]).normalize();
    approx(stemDir.dot(radialDir), 1, 1e-6);
    const stemLength = layout.pathPoints[1].distanceTo(layout.pathPoints[0]);
    const landingLength = layout.pathPoints[2].distanceTo(layout.pathPoints[1]);
    assert.ok(landingLength > stemLength);
  });

  it("anchors radial labels beyond the landing end", () => {
    const projection = makePerspectiveProjectionContext();
    const center = new THREE.Vector3(0, 0, 0);
    const pickedPoint = new THREE.Vector3(5, 0, 0);
    const layout = resolveMeasurementRenderedLayoutForOverlay({
      p1: center,
      p2: pickedPoint,
      style: "radial",
      segmentAnchor: pickedPoint,
      projection,
      measureGraphicsScale: 1,
    });

    const landingStart = layout.pathPoints[1];
    const landingEnd = layout.pathPoints[2];
    const landingDir = landingEnd.clone().sub(landingStart).normalize();
    const endToLabel = layout.labelAnchor.clone().sub(landingEnd);
    assert.ok(endToLabel.length() > 1e-6);
    approx(endToLabel.clone().normalize().dot(landingDir), 1, 1e-6);
    const landingMidpoint = landingStart.clone().lerp(landingEnd, 0.5);
    assert.ok(layout.labelAnchor.distanceTo(landingMidpoint) > 1e-6);
  });

  it("hides the second arrow for radial single-start mode", () => {
    const visibility = resolveMeasurementArrowVisibilityForMode("single-start");
    assert.equal(visibility.showStartArrow, true);
    assert.equal(visibility.showEndArrow, false);
  });

  it("keeps arrow sizing translation-invariant and scales with world-length changes", () => {
    const baseProjection = makePerspectiveProjectionContext({
      position: new THREE.Vector3(0, 0, 80),
      lookAt: new THREE.Vector3(0, 0, 0),
    });
    const baseP1 = new THREE.Vector3(-10, 0, 0);
    const baseP2 = new THREE.Vector3(10, 0, 0);
    const baseMetrics = resolveMeasurementArrowMetrics({
      style: "linear",
      p1: baseP1,
      p2: baseP2,
      projection: baseProjection,
      measureGraphicsScale: 1,
    });

    const translation = new THREE.Vector3(350, -120, 45);
    const translatedProjection = makePerspectiveProjectionContext({
      position: new THREE.Vector3(0, 0, 80).add(translation),
      lookAt: translation.clone(),
    });
    const translatedMetrics = resolveMeasurementArrowMetrics({
      style: "linear",
      p1: baseP1.clone().add(translation),
      p2: baseP2.clone().add(translation),
      projection: translatedProjection,
      measureGraphicsScale: 1,
    });
    approx(baseMetrics.arrowLengthWorld, translatedMetrics.arrowLengthWorld, 1e-6);

    const zoomedProjection = makePerspectiveProjectionContext({
      position: new THREE.Vector3(0, 0, 40),
      lookAt: new THREE.Vector3(0, 0, 0),
    });
    const zoomedP1 = new THREE.Vector3(-5, 0, 0);
    const zoomedP2 = new THREE.Vector3(5, 0, 0);
    const baseSegmentPx = getMeasurementSegmentLengthPx(baseP1, baseP2, baseProjection);
    const zoomedSegmentPx = getMeasurementSegmentLengthPx(
      zoomedP1,
      zoomedP2,
      zoomedProjection,
    );
    approx(baseSegmentPx, zoomedSegmentPx, 1e-6);
    const zoomedMetrics = resolveMeasurementArrowMetrics({
      style: "linear",
      p1: zoomedP1,
      p2: zoomedP2,
      projection: zoomedProjection,
      measureGraphicsScale: 1,
    });
    assert.ok(zoomedMetrics.arrowLengthWorld < baseMetrics.arrowLengthWorld);
  });

  it("formats measurement labels for length, diameter, and radius", () => {
    const lengthLabel = formatExactCadMeasurementLabel({
      kind: "edge_length",
      value: 40,
      unit: "mm",
      source: "topology",
    });
    const diameterLabel = formatExactCadMeasurementLabel({
      kind: "diameter",
      value: 24,
      unit: "mm",
      source: "analytic",
    });
    const radiusLabel = formatExactCadMeasurementLabel({
      kind: "radius",
      value: 12,
      unit: "mm",
      source: "analytic",
    });

    assert.equal(lengthLabel, "40.00 mm");
    assert.equal(diameterLabel, "Ø 24.00 mm");
    assert.equal(radiusLabel, "R 12.00 mm");
  });

  it("uses label fallback for arc/angle without display and clears others", () => {
    const pickedEdge = edgeEntity("e_line", new THREE.Vector3(4, 5, 6));
    const arcWithoutDisplay = buildExactCadMeasurementOverlayInstruction(
      {
        kind: "arc_length",
        value: 7,
        unit: "mm",
        source: "sampled",
      },
      pickedEdge,
    );
    assert.equal(arcWithoutDisplay.kind, "label");
    if (arcWithoutDisplay.kind === "label") {
      approxVec(arcWithoutDisplay.point, pickedEdge.point);
    }

    const clear = buildExactCadMeasurementOverlayInstruction(
      {
        kind: "edge_length",
        value: 7,
        unit: "mm",
        source: "sampled",
      },
      pickedEdge,
    );
    assert.equal(clear.kind, "clear");
  });
});
