import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ExactFace } from "@/components/cad/exact-cad-topology";
import type { FaceDetail } from "@/types/machining-analysis";

import {
  DEFAULT_FACE_MATCH_TOLERANCES,
  matchFaceDetail,
  matchFeatureFaces,
  scaleDistanceTolerance,
} from "../face-matching";

function makeExactFace(overrides: Partial<ExactFace> = {}): ExactFace {
  return {
    id: "f_0",
    partId: null,
    kind: "cylinder",
    analytic: {
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      radius: 5,
    },
    ...overrides,
  };
}

function makeFaceDetail(overrides: Partial<FaceDetail> = {}): FaceDetail {
  return {
    face_id: 0,
    surface_type: "CYLINDER",
    area_mm2: 100,
    bounding_box: {
      min: { x: -5, y: -5, z: 0 },
      max: { x: 5, y: 5, z: 10 },
      length_mm: 10,
      width_mm: 10,
      height_mm: 10,
      diagonal_mm: 17.32,
    },
    centroid: { x: 0, y: 0, z: 5 },
    normal: null,
    axis: { x: 0, y: 0, z: 1 },
    axis_location: { x: 0, y: 0, z: 0 },
    radius_mm: 5,
    minor_radius_mm: null,
    cone_half_angle_deg: null,
    angular_span_deg: null,
    is_internal: true,
    is_planar_extreme: false,
    edge_count: 2,
    ...overrides,
  };
}

describe("matchFaceDetail", () => {
  it("finds a clear single match on kind, radius, axis and position", () => {
    const detail = makeFaceDetail();
    const faces = [
      makeExactFace({ id: "f_far", analytic: { origin: [500, 500, 500], axis: [0, 0, 1], radius: 5 } }),
      makeExactFace({ id: "f_match" }),
      makeExactFace({ id: "f_plane", kind: "plane", analytic: { origin: [0, 0, 0], normal: [0, 0, 1] } }),
    ];

    const result = matchFaceDetail(detail, faces);
    assert.equal(result.match?.id, "f_match");
    assert.ok(result.candidates.length >= 1);
  });

  it("reports no match when nothing clears tolerance", () => {
    const detail = makeFaceDetail({ radius_mm: 5 });
    const faces = [
      // Wrong kind entirely.
      makeExactFace({ id: "f_plane", kind: "plane", analytic: { origin: [0, 0, 0], normal: [0, 0, 1] } }),
      // Right kind, radius far outside tolerance.
      makeExactFace({ id: "f_wrong_radius", analytic: { origin: [0, 0, 0], axis: [0, 0, 1], radius: 20 } }),
      // Right kind/radius, axis perpendicular instead of parallel.
      makeExactFace({ id: "f_wrong_axis", analytic: { origin: [0, 0, 0], axis: [1, 0, 0], radius: 5 } }),
    ];

    const result = matchFaceDetail(detail, faces);
    assert.equal(result.match, null);
    assert.equal(result.candidates.length, 0);
  });

  it("picks the closest of several otherwise-plausible candidates", () => {
    const detail = makeFaceDetail();
    const faces = [
      makeExactFace({ id: "f_near", analytic: { origin: [0.01, 0, 0], axis: [0, 0, 1], radius: 5.02 } }),
      makeExactFace({ id: "f_medium", analytic: { origin: [0.2, 0, 0], axis: [0, 0, 1], radius: 4.98 } }),
      makeExactFace({ id: "f_far_but_valid", analytic: { origin: [0.8, 0, 0], axis: [0, 0, 1], radius: 5.0 } }),
    ];

    const result = matchFaceDetail(detail, faces, {
      ...DEFAULT_FACE_MATCH_TOLERANCES,
      distanceTolerance: 1,
    });
    assert.equal(result.match?.id, "f_near");
    assert.equal(result.candidates[0]?.face.id, "f_near");
    assert.ok(
      result.candidates.every(
        (c, i) => i === 0 || c.score >= result.candidates[i - 1].score,
      ),
      "candidates must be sorted best-first",
    );
  });

  it("treats an anti-parallel axis as a match (a face's normal sense is not physically meaningful here)", () => {
    const detail = makeFaceDetail({ axis: { x: 0, y: 0, z: -1 } });
    const faces = [makeExactFace({ id: "f_match", analytic: { origin: [0, 0, 0], axis: [0, 0, 1], radius: 5 } })];
    const result = matchFaceDetail(detail, faces);
    assert.equal(result.match?.id, "f_match");
  });
});

describe("matchFeatureFaces", () => {
  it("resolves a feature's face_ids into matched frontend ids, skipping unresolved ones", () => {
    const faceDetails: FaceDetail[] = [
      makeFaceDetail({ face_id: 0 }),
      makeFaceDetail({
        face_id: 1,
        surface_type: "PLANE",
        axis: null,
        normal: { x: 0, y: 0, z: 1 },
        axis_location: null,
        centroid: { x: 0, y: 0, z: 10 },
        radius_mm: null,
      }),
    ];
    const faces = [
      makeExactFace({ id: "f_cyl" }),
      makeExactFace({
        id: "f_plane",
        kind: "plane",
        analytic: { origin: [0, 0, 10], normal: [0, 0, 1] },
      }),
    ];

    // face_id 2 does not exist in faceDetails and must be skipped, not throw.
    const matched = matchFeatureFaces([0, 1, 2], faceDetails, faces);
    assert.deepEqual([...matched].sort(), ["f_cyl", "f_plane"]);
  });

  it("returns an empty array (fallback signal) when face_details is unavailable", () => {
    const faces = [makeExactFace()];
    assert.deepEqual(matchFeatureFaces([0], null, faces), []);
    assert.deepEqual(matchFeatureFaces([0], undefined, faces), []);
  });

  it("returns an empty array when no ExactFace geometry has loaded yet", () => {
    const faceDetails = [makeFaceDetail()];
    assert.deepEqual(matchFeatureFaces([0], faceDetails, []), []);
  });
});

describe("scaleDistanceTolerance", () => {
  it("scales with model size but never collapses to zero for a tiny part", () => {
    assert.ok(scaleDistanceTolerance(0) >= 0.05);
    assert.ok(scaleDistanceTolerance(1000) > scaleDistanceTolerance(10));
  });
});
