import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import type { PickedEntity } from "../exact-cad-topology";
import {
  runMeasurementClickInteraction,
  runMeasurementHoverInteraction,
  type MeasurementInteractionViewer,
} from "../cad-viewer-measurement-interaction";

function makePickedCurveFeature(): PickedEntity {
  return {
    kind: "curve_feature",
    partId: "part-1",
    featureId: "curve-arc-1",
    point: new THREE.Vector3(2, 3, 4),
  };
}

describe("cad-viewer measurement interaction adapter", () => {
  it("picks entity first and then highlights via entity path", () => {
    const pickedEntity = makePickedCurveFeature();
    const calls: string[] = [];
    let highlightedEntity: PickedEntity | null | undefined;

    const viewer: MeasurementInteractionViewer = {
      pickMeasurementEntityAtScreenPosition: (x, y) => {
        calls.push(`pick:${x.toFixed(2)}:${y.toFixed(2)}`);
        return pickedEntity;
      },
      highlightEdgeAtScreenPosition: (_x, _y, entity) => {
        calls.push("highlight");
        highlightedEntity = entity;
      },
      measureEdgeAtScreenPosition: () => null,
    };

    const result = runMeasurementHoverInteraction({
      viewer,
      ndcX: 0.25,
      ndcY: -0.5,
    });

    assert.equal(result, pickedEntity);
    assert.deepEqual(calls, ["pick:0.25:-0.50", "highlight"]);
    assert.equal(highlightedEntity, pickedEntity);
  });

  it("picks entity first and then measures via entity path", () => {
    const pickedEntity = makePickedCurveFeature();
    const calls: string[] = [];
    let measuredEntity: PickedEntity | null | undefined;

    const viewer: MeasurementInteractionViewer = {
      pickMeasurementEntityAtScreenPosition: (x, y) => {
        calls.push(`pick:${x.toFixed(2)}:${y.toFixed(2)}`);
        return pickedEntity;
      },
      highlightEdgeAtScreenPosition: () => undefined,
      measureEdgeAtScreenPosition: (_x, _y, entity) => {
        calls.push("measure");
        measuredEntity = entity;
        return 12.5;
      },
    };

    const result = runMeasurementClickInteraction({
      viewer,
      ndcX: -0.1,
      ndcY: 0.75,
    });

    assert.deepEqual(calls, ["pick:-0.10:0.75", "measure"]);
    assert.equal(measuredEntity, pickedEntity);
    assert.equal(result.pickedEntity, pickedEntity);
    assert.equal(result.length, 12.5);
  });
});
