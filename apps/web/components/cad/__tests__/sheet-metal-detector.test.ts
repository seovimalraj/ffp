import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import { detectSheetMetal } from "../sheet-metal-detector";

// Same duplicated-per-face grid helper as the engine tests: shared
// boundaries weld because coordinates coincide exactly.
function addGrid(
  positions: number[],
  indices: number[],
  origin: [number, number, number],
  u: [number, number, number],
  v: [number, number, number],
  uSeg: number,
  vSeg: number,
): void {
  const baseIndex = positions.length / 3;
  for (let j = 0; j <= vSeg; j++) {
    for (let i = 0; i <= uSeg; i++) {
      positions.push(
        origin[0] + (u[0] * i) / uSeg + (v[0] * j) / vSeg,
        origin[1] + (u[1] * i) / uSeg + (v[1] * j) / vSeg,
        origin[2] + (u[2] * i) / uSeg + (v[2] * j) / vSeg,
      );
    }
  }
  const row = uSeg + 1;
  for (let j = 0; j < vSeg; j++) {
    for (let i = 0; i < uSeg; i++) {
      const a = baseIndex + j * row + i;
      indices.push(a, a + 1, a + row + 1, a, a + row + 1, a + row);
    }
  }
}

function toGeometry(positions: number[], indices: number[]): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/** Solid L-bracket, 2mm sheet, SHARP 90° bend (no cylindrical fillet). */
function buildSolidLBracket(): THREE.BufferGeometry {
  const p: number[] = [];
  const ix: number[] = [];
  const Z = 12;
  addGrid(p, ix, [0, 0, 0], [100, 0, 0], [0, 0, 60], 20, Z);
  addGrid(p, ix, [2, 2, 0], [0, 0, 60], [98, 0, 0], Z, 14);
  addGrid(p, ix, [0, 0, 0], [0, 0, 60], [0, 52, 0], Z, 13);
  addGrid(p, ix, [2, 2, 0], [0, 50, 0], [0, 0, 60], 10, Z);
  addGrid(p, ix, [0, 52, 0], [0, 0, 60], [2, 0, 0], Z, 1);
  addGrid(p, ix, [100, 0, 0], [0, 2, 0], [0, 0, 60], 1, Z);
  return toGeometry(p, ix);
}

/** Closed solid box (all six faces), e.g. a machined plate or enclosure lid. */
function buildSolidBox(sx: number, sy: number, sz: number): THREE.BufferGeometry {
  const p: number[] = [];
  const ix: number[] = [];
  addGrid(p, ix, [0, 0, 0], [sx, 0, 0], [0, 0, sz], 2, 2); // bottom
  addGrid(p, ix, [0, sy, 0], [0, 0, sz], [sx, 0, 0], 2, 2); // top
  addGrid(p, ix, [0, 0, 0], [0, sy, 0], [sx, 0, 0], 2, 2); // z=0 side
  addGrid(p, ix, [0, 0, sz], [sx, 0, 0], [0, sy, 0], 2, 2); // z=sz side
  addGrid(p, ix, [0, 0, 0], [0, 0, sz], [0, sy, 0], 2, 2); // x=0 side
  addGrid(p, ix, [sx, 0, 0], [0, sy, 0], [0, 0, sz], 2, 2); // x=sx side
  return toGeometry(p, ix);
}

// Minimal STEP texts: product name for S1, PLANE entities for S2, and —
// crucially — ZERO CYLINDRICAL_SURFACE entities, like a sharp fold exported
// without a fillet.
const STEP_SHARP_LBRACKET = [
  "#1=PRODUCT('L-BRACKET','sheet metal bracket');",
  "#10=PLANE('',#2);", "#11=PLANE('',#3);",
  "#12=PLANE('',#4);", "#13=PLANE('',#5);",
].join("\n");

const STEP_THICK_COVER = [
  "#1=PRODUCT('TOP COVER','machined cover');",
  "#10=PLANE('',#2);", "#11=PLANE('',#3);", "#12=PLANE('',#4);",
  "#13=PLANE('',#5);", "#14=PLANE('',#6);", "#15=PLANE('',#7);",
].join("\n");

const STEP_FLAT_BLANK = [
  "#1=PRODUCT('BLANK','flat blank sheet');",
  "#10=PLANE('',#2);", "#11=PLANE('',#3);",
].join("\n");

describe("sheet-metal-detector", () => {
  it("CORRECTION 3: sharp bend with no cylindrical surface still reports hasBends", () => {
    // Screenshot-5 scenario: clear 90° L-bracket, but the STEP text has no
    // CYLINDRICAL_SURFACE, so the cylinder check alone said "Already flat".
    const det = detectSheetMetal(
      buildSolidLBracket(), "l-bracket.step", STEP_SHARP_LBRACKET,
    );
    assert.equal(det.isSheetMetal, true, "must stay detected as sheet metal");
    assert.equal(det.hasBends, true, "region check must catch the sharp fold");
    assert.ok(det.bendLineCount >= 1, "at least one bend line");
  });

  it("CORRECTION 4: thick solid plate is disqualified despite flat bbox + name", () => {
    // Screenshot-6 scenario: 60×72×10 solid body. Flatness ratio 10/72 and
    // the name "cover" both score sheet-like; the thickness override must
    // veto it (no plate measures a plausible consistent stock thickness).
    const det = detectSheetMetal(
      buildSolidBox(60, 72, 10), "top-cover.step", STEP_THICK_COVER,
    );
    assert.equal(det.isSheetMetal, false, "10mm solid body is not sheet metal");
    assert.equal(det.hasBends, false);
  });

  it("keeps a genuine thin bent part detected (STEP + mesh paths)", () => {
    const geomStep = buildSolidLBracket();
    const viaStep = detectSheetMetal(geomStep, "bracket.step", STEP_SHARP_LBRACKET);
    assert.equal(viaStep.isSheetMetal, true);

    // Mesh fallback path (no STEP text), name keyword only
    const viaMesh = detectSheetMetal(buildSolidLBracket(), "mounting bracket");
    assert.equal(viaMesh.isSheetMetal, true, "thickness check must not veto 2mm sheet");
    assert.equal(viaMesh.hasBends, true);
  });

  it("keeps a flat thin blank as sheet metal WITHOUT bends (Already flat)", () => {
    const det = detectSheetMetal(
      buildSolidBox(100, 3, 60), "blank.step", STEP_FLAT_BLANK,
    );
    assert.equal(det.isSheetMetal, true, "3mm flat blank is sheet metal");
    assert.equal(det.hasBends, false, "no folds — must stay 'Already flat'");
  });
});
