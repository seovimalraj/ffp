import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import type { Viewer } from "../viewer";
import type { ParsedDxf } from "../loaders/dxf";
import {
  applyMainDxfObjectToViewer,
  applyPreviewDxfObjectToViewer,
  buildFreshDxf2DObject,
  buildFreshDxf3DObject,
  createLoadedDxfDocument,
  disposeDxfPreviewViewer,
} from "../dxf-preview-session";

function consumedSuppressionFixture(): ParsedDxf {
  return {
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
      { type: "LINE", layer: "CUT", start: { x: 10, y: 30 }, end: { x: 90, y: 30 } },
    ],
  };
}

function createViewerMock(): {
  viewer: Viewer;
  calls: string[];
  loaded: THREE.Object3D[];
  disposeCalls: number;
} {
  const calls: string[] = [];
  const loaded: THREE.Object3D[] = [];
  let disposeCalls = 0;
  const viewer: Viewer = {
    loadMeshFromGeometry: () => undefined,
    replacePrimaryGeometry: () => undefined,
    loadObject3D: (object: THREE.Object3D) => {
      loaded.push(object);
      calls.push("loadObject3D");
    },
    clear: () => {
      calls.push("clear");
    },
    setView: (preset) => {
      calls.push(`setView:${preset}`);
    },
    setProjection: (mode) => {
      calls.push(`setProjection:${mode}`);
    },
    setFeatureEdgesEnabled: (enabled) => {
      calls.push(`setFeatureEdgesEnabled:${enabled ? "1" : "0"}`);
    },
    resize: () => {
      calls.push("resize");
    },
    dispose: () => {
      disposeCalls += 1;
      calls.push("dispose");
    },
    pickAtScreenPosition: () => null,
    pickMeshAtScreenPosition: () => null,
    pickEdgeAtScreenPosition: () => null,
    isolateObject: () => undefined,
    clearIsolation: () => undefined,
    showAllParts: () => undefined,
    highlightEdgeAtScreenPosition: () => undefined,
    clearEdgeHighlight: () => undefined,
    measureEdgeAtScreenPosition: () => null,
    setControlsEnabled: (enabled) => {
      calls.push(`setControlsEnabled:${enabled ? "1" : "0"}`);
    },
    setControlsPreset: (preset) => {
      calls.push(`setControlsPreset:${preset}`);
    },
    setMeasurementSegment: () => undefined,
    setMeasurementGraphicsScale: () => undefined,
    getScreenshotDataURL: () => "",
    getOutlineSnapshotDataURL: () => "",
    setMaterialProperties: () => undefined,
    setClipping: () => undefined,
    fitToScreen: () => {
      calls.push("fitToScreen");
    },
    frameObject: () => {
      calls.push("frameObject");
    },
    setHighlight: () => undefined,
    setBackgroundColor: () => {
      calls.push("setBackgroundColor");
    },
    setOverlayVisible: (visible) => {
      calls.push(`setOverlayVisible:${visible ? "1" : "0"}`);
    },
    setShowViewCube: (visible) => {
      calls.push(`setShowViewCube:${visible ? "1" : "0"}`);
    },
    setShowHomeButton: (visible) => {
      calls.push(`setShowHomeButton:${visible ? "1" : "0"}`);
    },
    getActiveCamera: () => new THREE.OrthographicCamera(),
    getRendererSize: () => ({ width: 300, height: 150 }),
    onViewChanged: () => () => undefined,
    projectWorldToScreen: () => ({
      x: 0,
      y: 0,
      visible: false,
    }),
  };

  return {
    viewer,
    calls,
    loaded,
    get disposeCalls() {
      return disposeCalls;
    },
  };
}

describe("dxf preview session helpers", () => {
  it("builds main 3D and preview 2D objects from one parsed DXF document", () => {
    const doc = createLoadedDxfDocument({
      fileName: "fixture.dxf",
      buffer: new ArrayBuffer(32),
      parsed: consumedSuppressionFixture(),
      scaleToMm: 1,
    });
    const mainBuilt = buildFreshDxf3DObject(doc);
    const docWithConsumed = {
      ...doc,
      consumedEntityUids: [...mainBuilt.consumedEntityUids],
    };
    const previewBuilt = buildFreshDxf2DObject(docWithConsumed);

    assert.equal(mainBuilt.object.userData.__source === "dxf-solid", true);
    assert.equal(previewBuilt.object.name, "dxfLineworkMirroredRoot");
    assert.equal(previewBuilt.object.scale.z, -1);
  });

  it("keeps preview in a single original 2D mode even with consumed entities", () => {
    const doc = createLoadedDxfDocument({
      fileName: "fixture.dxf",
      buffer: new ArrayBuffer(32),
      parsed: consumedSuppressionFixture(),
      scaleToMm: 1,
    });
    const noConsumed = buildFreshDxf2DObject(doc);
    const withConsumed = buildFreshDxf2DObject({
      ...doc,
      consumedEntityUids: ["fake-entity-1", "fake-entity-2"],
    });
    assert.notEqual(noConsumed.object, withConsumed.object);
    assert.equal(noConsumed.bounds.equals(withConsumed.bounds), true);
  });

  it("applies DXF objects to main and preview viewers independently", () => {
    const doc = createLoadedDxfDocument({
      fileName: "fixture.dxf",
      buffer: new ArrayBuffer(32),
      parsed: consumedSuppressionFixture(),
      scaleToMm: 1,
    });
    const mainViewer = createViewerMock();
    const previewViewer = createViewerMock();
    const mainBuilt = buildFreshDxf3DObject(doc);

    applyMainDxfObjectToViewer(mainViewer.viewer, mainBuilt);
    const beforePreviewMainLoads = mainViewer.loaded.length;

    const previewBuilt = buildFreshDxf2DObject(doc);
    applyPreviewDxfObjectToViewer(previewViewer.viewer, previewBuilt.object, {
      controlsEnabled: false,
    });
    applyPreviewDxfObjectToViewer(previewViewer.viewer, previewBuilt.object, {
      controlsEnabled: true,
    });

    assert.equal(mainViewer.loaded.length, beforePreviewMainLoads);
    assert.equal(mainViewer.loaded.length, 1);
    assert.equal(previewViewer.loaded.length, 2);
    assert.ok(previewViewer.calls.includes("setControlsEnabled:0"));
    assert.ok(previewViewer.calls.includes("setControlsEnabled:1"));
    assert.ok(previewViewer.calls.includes("setProjection:orthographic"));
    assert.ok(previewViewer.calls.includes("setControlsPreset:dxf2d"));
    assert.ok(previewViewer.calls.includes("setShowViewCube:0"));
    assert.ok(previewViewer.calls.includes("setShowHomeButton:0"));
    assert.ok(previewViewer.calls.includes("setOverlayVisible:0"));
    assert.ok(previewViewer.calls.includes("setView:top"));
    assert.ok(previewViewer.calls.includes("fitToScreen"));
    assert.ok(previewViewer.calls.includes("setBackgroundColor"));
  });

  it("disposes preview viewer when leaving DXF flow", () => {
    const previewViewer = createViewerMock();

    const cleared = disposeDxfPreviewViewer(previewViewer.viewer);
    assert.equal(cleared, null);
    assert.equal(previewViewer.disposeCalls, 1);

    const clearedNull = disposeDxfPreviewViewer(null);
    assert.equal(clearedNull, null);
  });
});
