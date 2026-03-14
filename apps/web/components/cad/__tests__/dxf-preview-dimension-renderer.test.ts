import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import type { Dxf2DFeatureModel } from "../dxf-preview-feature-model";
import type { DxfPreviewDimension } from "../dxf-preview-dimensions";
import {
  buildDxfPreviewOverlayPrimitives,
  renderDxfPreviewDimensions,
} from "../dxf-preview-dimension-renderer";

function approx(actual: number, expected: number, eps = 1e-2): void {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${actual} to be within ${eps} of ${expected}`,
  );
}

function createViewerMock(scale: number) {
  return {
    getRendererSize: () => ({ width: 420, height: 320 }),
    projectWorldToScreen: (point: THREE.Vector3) => ({
      x: point.x * scale + 210,
      y: -point.z * scale + 160,
      visible: true,
    }),
  };
}

function createFeatureModel(bounds?: Partial<Dxf2DFeatureModel["bounds"]>): Dxf2DFeatureModel {
  const outerPoints = [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 120, y: 60 },
    { x: 0, y: 60 },
  ];
  const outerOutline = {
    kind: "outline" as const,
    entityUid: "outer",
    points: outerPoints,
    area: 7200,
  };
  return {
    bounds: {
      minX: 0,
      maxX: 120,
      minY: 0,
      maxY: 60,
      width: 120,
      height: 60,
      center: { x: 60, y: 30 },
      minXAnchor: { x: 0, y: 60 },
      maxXAnchor: { x: 120, y: 60 },
      minYAnchor: { x: 120, y: 0 },
      maxYAnchor: { x: 120, y: 60 },
      ...bounds,
    },
    outlines: [outerOutline],
    outerOutline,
    innerOutlines: [],
    circles: [],
    slots: [],
  };
}

function createPreviewRoot(): THREE.Object3D {
  const root = new THREE.Group();
  root.position.set(20, 0, 5);
  root.scale.set(1, 1, -1);
  root.updateMatrixWorld(true);
  return root;
}

type FakeSvgNode = {
  tagName: string;
  attributes: Map<string, string>;
  children: FakeSvgNode[];
  parentNode: FakeSvgNode | null;
  textContent: string | null;
  setAttribute: (name: string, value: string) => void;
  appendChild: (child: FakeSvgNode) => FakeSvgNode;
  removeChild: (child: FakeSvgNode) => FakeSvgNode;
  getBBox: () => { x: number; y: number; width: number; height: number };
  firstChild: FakeSvgNode | null;
};

function createFakeSvgFactory(params: {
  onMeasure: (text: string) => { width: number; height: number };
}): {
  svg: FakeSvgNode;
  createElementNS: (namespace: string, tagName: string) => FakeSvgNode;
} {
  const createNode = (tagName: string): FakeSvgNode => {
    const node: FakeSvgNode = {
      tagName,
      attributes: new Map<string, string>(),
      children: [],
      parentNode: null,
      textContent: null,
      setAttribute(name: string, value: string) {
        this.attributes.set(name, value);
      },
      appendChild(child: FakeSvgNode) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      removeChild(child: FakeSvgNode) {
        const index = this.children.indexOf(child);
        if (index >= 0) {
          this.children.splice(index, 1);
        }
        child.parentNode = null;
        return child;
      },
      getBBox() {
        if (this.tagName !== "text") {
          return { x: 0, y: 0, width: 0, height: 0 };
        }
        return {
          x: 0,
          y: 0,
          ...params.onMeasure(this.textContent ?? ""),
        };
      },
      get firstChild() {
        return this.children.length > 0 ? this.children[0] : null;
      },
    };
    return node;
  };

  const svg = createNode("svg");
  return {
    svg,
    createElementNS: (_namespace: string, tagName: string) => createNode(tagName),
  };
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

describe("dxf-preview-dimension-renderer", () => {
  it("projects local anchors through previewRoot.matrixWorld", () => {
    const featureModel = createFeatureModel();
    const previewRoot = createPreviewRoot();
    const dimensions: DxfPreviewDimension[] = [
      {
        type: "linear",
        kind: "overall-width",
        p1Local: { x: 0, y: 0 },
        p2Local: { x: 100, y: 0 },
        axisLocal: { x: 1, y: 0 },
        valueText: "100.00 mm",
        priority: 1,
        required: true,
        sideHints: ["top", "bottom", "left", "right"],
      },
    ];

    const primitives = buildDxfPreviewOverlayPrimitives({
      viewer: createViewerMock(2),
      previewRoot,
      featureModel,
      dimensions,
    });

    assert.ok(primitives.lines.length >= 3);
    const firstExtension = primitives.lines[0];
    // local (0,0) -> world (20,0,5) -> screen (250,150)
    approx(firstExtension.x1, 250, 2);
    assert.ok(firstExtension.y1 < 150);
  });

  it("keeps all labels outside the projected silhouette bbox", () => {
    const featureModel = createFeatureModel();
    const previewRoot = createPreviewRoot();
    const dimensions: DxfPreviewDimension[] = [
      {
        type: "linear",
        kind: "overall-width",
        p1Local: { x: 0, y: 0 },
        p2Local: { x: 120, y: 0 },
        axisLocal: { x: 1, y: 0 },
        valueText: "120.00 mm",
        priority: 1,
        required: true,
        sideHints: ["top", "bottom", "left", "right"],
      },
      {
        type: "linear",
        kind: "overall-height",
        p1Local: { x: 120, y: 0 },
        p2Local: { x: 120, y: 60 },
        axisLocal: { x: 0, y: 1 },
        valueText: "60.00 mm",
        priority: 2,
        required: true,
        sideHints: ["right", "left", "top", "bottom"],
      },
      {
        type: "diameter",
        kind: "hole-diameter",
        centerLocal: { x: 20, y: 20 },
        radiusLocal: 3,
        valueText: "2X ⌀6.00",
        count: 2,
        priority: 3,
        required: false,
        sideHints: ["left", "top", "bottom", "right"],
      },
    ];

    const primitives = buildDxfPreviewOverlayPrimitives({
      viewer: createViewerMock(2),
      previewRoot,
      featureModel,
      dimensions,
    });

    const minX = 250;
    const maxX = 490;
    const minY = 150;
    const maxY = 270;
    const silhouetteBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

    assert.ok(primitives.labels.length >= 2);
    for (const label of primitives.labels) {
      assert.equal(boxesOverlap(label.box, silhouetteBox), false);
    }
  });

  it("places overall width and overall height labels outside the silhouette", () => {
    const featureModel = createFeatureModel();
    const previewRoot = createPreviewRoot();
    const dimensions: DxfPreviewDimension[] = [
      {
        type: "linear",
        kind: "overall-width",
        p1Local: { x: 0, y: 0 },
        p2Local: { x: 120, y: 0 },
        axisLocal: { x: 1, y: 0 },
        valueText: "WIDTH",
        priority: 1,
        required: true,
        sideHints: ["top", "bottom", "left", "right"],
      },
      {
        type: "linear",
        kind: "overall-height",
        p1Local: { x: 120, y: 0 },
        p2Local: { x: 120, y: 60 },
        axisLocal: { x: 0, y: 1 },
        valueText: "HEIGHT",
        priority: 2,
        required: true,
        sideHints: ["right", "left", "top", "bottom"],
      },
    ];

    const primitives = buildDxfPreviewOverlayPrimitives({
      viewer: createViewerMock(2),
      previewRoot,
      featureModel,
      dimensions,
    });
    const minX = 250;
    const maxX = 490;
    const minY = 150;
    const maxY = 270;
    const silhouetteBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

    const widthLabel = primitives.labels.find((entry) => entry.text === "WIDTH");
    const heightLabel = primitives.labels.find((entry) => entry.text === "HEIGHT");
    assert.ok(widthLabel);
    assert.ok(heightLabel);
    assert.equal(boxesOverlap(widthLabel!.box, silhouetteBox), false);
    assert.equal(boxesOverlap(heightLabel!.box, silhouetteBox), false);
  });

  it("never suppresses required dimensions", () => {
    const featureModel = createFeatureModel();
    const previewRoot = createPreviewRoot();
    const dimensions: DxfPreviewDimension[] = [
      {
        type: "linear",
        kind: "overall-width",
        p1Local: { x: 0, y: 0 },
        p2Local: { x: 100, y: 0 },
        axisLocal: { x: 1, y: 0 },
        valueText: "REQ-A",
        priority: 1,
        required: true,
        sideHints: ["top"],
      },
      {
        type: "linear",
        kind: "overall-width",
        p1Local: { x: 0, y: 0 },
        p2Local: { x: 100, y: 0 },
        axisLocal: { x: 1, y: 0 },
        valueText: "REQ-B",
        priority: 2,
        required: true,
        sideHints: ["top"],
      },
    ];

    const primitives = buildDxfPreviewOverlayPrimitives({
      viewer: createViewerMock(2),
      previewRoot,
      featureModel,
      dimensions,
      measureLabel: () => ({ width: 180, height: 14 }),
    });

    const texts = primitives.labels.map((entry) => entry.text);
    assert.ok(texts.includes("REQ-A"));
    assert.ok(texts.includes("REQ-B"));
  });

  it("uses two-pass SVG text getBBox measurement for final label boxes", () => {
    const featureModel = createFeatureModel();
    const previewRoot = createPreviewRoot();
    const dimensions: DxfPreviewDimension[] = [
      {
        type: "linear",
        kind: "overall-width",
        p1Local: { x: 0, y: 0 },
        p2Local: { x: 100, y: 0 },
        axisLocal: { x: 1, y: 0 },
        valueText: "WIDE_LABEL",
        priority: 1,
        required: true,
        sideHints: ["top", "bottom"],
      },
    ];

    let bboxCallCount = 0;
    const fakeDom = createFakeSvgFactory({
      onMeasure: (text) => {
        bboxCallCount += 1;
        if (text === "WIDE_LABEL") {
          return { width: 180, height: 14 };
        }
        return { width: 40, height: 14 };
      },
    });

    const previousDocument = (globalThis as any).document;
    (globalThis as any).document = {
      createElementNS: fakeDom.createElementNS,
    };

    try {
      const primitives = renderDxfPreviewDimensions({
        svg: fakeDom.svg as unknown as SVGSVGElement,
        viewer: createViewerMock(2),
        previewRoot,
        featureModel,
        dimensions,
      });

      assert.ok(bboxCallCount > 0);
      assert.equal(primitives.labels.length, 1);
      assert.ok(primitives.labels[0].box.width > 180);
    } finally {
      (globalThis as any).document = previousDocument;
    }
  });
});
