import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDefaultDxfPreviewPanelState,
  expandDxfPreviewPanel,
  getDxfPreviewPanelVisibility,
  toggleDxfPreviewPanelDimensions,
} from "../dxf-preview-panel-state";

describe("dxf-preview-panel-state", () => {
  it("uses an expand transition that preserves framing and does not request refit", () => {
    const transition = expandDxfPreviewPanel();
    assert.equal(transition.preserveFraming, true);
    assert.equal(transition.requestRefit, false);
  });

  it("collapsed preview shows only expand and no dimensions controls", () => {
    const state = createDefaultDxfPreviewPanelState();
    const visibility = getDxfPreviewPanelVisibility(state);
    assert.equal(visibility.showExpandButton, true);
    assert.equal(visibility.showCollapseButton, false);
    assert.equal(visibility.showDimensionsToggle, false);
    assert.equal(visibility.showDimensionsOverlay, false);
  });

  it("expanded state defaults dimensions off and overlay hidden", () => {
    const expanded = expandDxfPreviewPanel().nextState;
    const visibility = getDxfPreviewPanelVisibility(expanded);
    assert.equal(expanded.expanded, true);
    assert.equal(expanded.dimensionsEnabled, false);
    assert.equal(visibility.showExpandButton, false);
    assert.equal(visibility.showCollapseButton, true);
    assert.equal(visibility.showDimensionsToggle, true);
    assert.equal(visibility.showDimensionsOverlay, false);

    const withDimensions = toggleDxfPreviewPanelDimensions(expanded);
    const withDimensionsVisibility = getDxfPreviewPanelVisibility(withDimensions);
    assert.equal(withDimensions.dimensionsEnabled, true);
    assert.equal(withDimensionsVisibility.showDimensionsOverlay, true);
  });
});
