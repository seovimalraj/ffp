import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import {
  getViewerControlsPresetConfig,
  getViewerViewUpVector,
  resolveFramingDirection,
} from "../viewer";

describe("viewer presets", () => {
  it("configures dxf2d controls as pan/zoom only", () => {
    const preset = getViewerControlsPresetConfig("dxf2d");

    assert.equal(preset.enableRotate, false);
    assert.equal(preset.enablePan, true);
    assert.equal(preset.enableZoom, true);
    assert.equal(preset.enableDamping, false);
    assert.equal(preset.screenSpacePanning, true);
    assert.equal(preset.mouseButtons.LEFT, THREE.MOUSE.PAN);
    assert.equal(preset.mouseButtons.MIDDLE, THREE.MOUSE.DOLLY);
    assert.equal(preset.mouseButtons.RIGHT, THREE.MOUSE.PAN);
    assert.equal(preset.touches.ONE, THREE.TOUCH.PAN);
    assert.equal(preset.touches.TWO, THREE.TOUCH.DOLLY_PAN);
  });

  it("uses stable up vectors for top and bottom views", () => {
    const top = getViewerViewUpVector("top");
    const bottom = getViewerViewUpVector("bottom");
    const iso = getViewerViewUpVector("iso");

    assert.deepEqual(top.toArray(), [0, 0, -1]);
    assert.deepEqual(bottom.toArray(), [0, 0, 1]);
    assert.deepEqual(iso.toArray(), [0, 1, 0]);
  });

  it("resolves framing direction from camera-to-target and deterministic fallback", () => {
    const direction = resolveFramingDirection({
      cameraPosition: new THREE.Vector3(0, 10, 0),
      target: new THREE.Vector3(0, 0, 0),
    });
    assert.deepEqual(direction.toArray(), [0, 1, 0]);

    const withFallback = resolveFramingDirection({
      cameraPosition: new THREE.Vector3(5, 5, 5),
      target: new THREE.Vector3(5, 5, 5),
      fallbackDirection: new THREE.Vector3(0, 0, -2),
    });
    assert.deepEqual(withFallback.toArray(), [0, 0, -1]);

    const defaultFallback = resolveFramingDirection({
      cameraPosition: new THREE.Vector3(1, 1, 1),
      target: new THREE.Vector3(1, 1, 1),
    });
    assert.ok(defaultFallback.length() > 0.999 && defaultFallback.length() < 1.001);
  });
});
