import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";

import {
  weldMesh,
  buildTopology,
  segmentRegions,
  buildBendGraph,
  unfoldMesh,
  unfoldGeometry,
  applyToMesh,
  restoreMesh,
  resolveRotationSign,
  measureSheetThickness,
} from "../sm-unfold-engine";

// Append a subdivided rectangular face. Vertices are duplicated per face
// (like real tessellated CAD output); shared boundaries weld because the
// coordinates coincide exactly. Winding gives the face the normal of U×V.
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
      const b = a + 1;
      const c = a + row + 1;
      const d = a + row;
      indices.push(a, b, c, a, c, d);
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

/**
 * Zero-thickness open box: 100×60 base at Y=0 with four 30-tall walls bent
 * up at 90°. Walls are inset from the corners (notched, like real sheet
 * metal) so they only connect to the base. One wall is wound inside-out to
 * exercise the automatic sign correction.
 */
function buildOpenBox(): THREE.BufferGeometry {
  const p: number[] = [];
  const ix: number[] = [];
  // Base, normal +Y
  addGrid(p, ix, [0, 0, 0], [0, 0, 60], [100, 0, 0], 6, 10);
  // Wall at x=0, normal -X
  addGrid(p, ix, [0, 0, 10], [0, 0, 40], [0, 30, 0], 4, 3);
  // Wall at x=100, normal +X — deliberately wound inside-out (normal -X):
  // the sign-correction centroid test must still swing it outward.
  addGrid(p, ix, [100, 0, 10], [0, 0, 40], [0, 30, 0], 4, 3);
  // Wall at z=0, normal -Z
  addGrid(p, ix, [10, 0, 0], [0, 30, 0], [80, 0, 0], 3, 8);
  // Wall at z=60, normal +Z
  addGrid(p, ix, [10, 0, 60], [80, 0, 0], [0, 30, 0], 8, 3);
  return toGeometry(p, ix);
}

/**
 * Solid L-bracket with real 2mm thickness (two skins per plate): base plate
 * 100×60×2 plus a 50-tall wall, bent at 90°. Opposite skins are joined by
 * thin edge strips — the plate-group merge must keep each plate's two skins
 * rotating together.
 */
function buildSolidLBracket(): THREE.BufferGeometry {
  const p: number[] = [];
  const ix: number[] = [];
  const Z = 12; // shared z-segment count so boundaries weld
  // Bottom skin y=0, normal -Y
  addGrid(p, ix, [0, 0, 0], [100, 0, 0], [0, 0, 60], 20, Z);
  // Top skin of base y=2 (x from 2 to clear the wall), normal +Y
  addGrid(p, ix, [2, 2, 0], [0, 0, 60], [98, 0, 0], Z, 14);
  // Outer wall skin x=0, normal -X
  addGrid(p, ix, [0, 0, 0], [0, 0, 60], [0, 52, 0], Z, 13);
  // Inner wall skin x=2, normal +X
  addGrid(p, ix, [2, 2, 0], [0, 50, 0], [0, 0, 60], 10, Z);
  // Wall top edge strip y=52, normal +Y (joins outer+inner skins)
  addGrid(p, ix, [0, 52, 0], [0, 0, 60], [2, 0, 0], Z, 1);
  // Base end edge strip x=100, normal +X (joins bottom+top skins)
  addGrid(p, ix, [100, 0, 0], [0, 2, 0], [0, 0, 60], 1, Z);
  return toGeometry(p, ix);
}

/**
 * Zero-thickness channel with RETURN flanges: 100×60 base, two 30-tall walls
 * at x=0/x=100, and on top of each wall a 20-deep flange folded back INWARD
 * over the base (J-profile). The flanges are second-level BFS descendants
 * whose folded position hangs over the base — exactly the configuration that
 * biases a rotation-sign probe built from the whole moved set instead of the
 * immediate child plate.
 */
function buildReturnFlangeChannel(): THREE.BufferGeometry {
  const p: number[] = [];
  const ix: number[] = [];
  // Base, normal +Y
  addGrid(p, ix, [0, 0, 0], [0, 0, 60], [100, 0, 0], 6, 10);
  // Wall at x=0 (normal -X), z inset like a notched part
  addGrid(p, ix, [0, 0, 10], [0, 0, 40], [0, 30, 0], 4, 3);
  // Return flange on top of x=0 wall, folded inward over the base (normal +Y)
  addGrid(p, ix, [0, 30, 10], [0, 0, 40], [20, 0, 0], 4, 2);
  // Wall at x=100 (normal +X)
  addGrid(p, ix, [100, 0, 10], [0, 30, 0], [0, 0, 40], 3, 4);
  // Return flange on top of x=100 wall, folded inward over the base
  addGrid(p, ix, [100, 30, 10], [-20, 0, 0], [0, 0, 40], 2, 4);
  return toGeometry(p, ix);
}

function arcPt(c: [number, number], r: number, phi: number): [number, number] {
  return [c[0] - r * Math.sin(phi), c[1] - r * Math.cos(phi)];
}

/**
 * Solid L-bracket with a REAL cylindrical bend: 2mm sheet, inner radius 3mm,
 * 90° bend tessellated into 6 facet rows per skin (inner + outer arcs).
 * `jitterAmp` adds deterministic radial noise to the interior arc samples —
 * the same kind of drift real tessellation produces — which, without the
 * thickness constraint, leaves the flattened bend strip pinched/bulged.
 * Boundary samples stay exact so the arc welds to the plates.
 */
function buildArcBendBracket(jitterAmp: number): THREE.BufferGeometry {
  const p: number[] = [];
  const ix: number[] = [];
  const Z = 10;
  const Ri = 3;
  const Ro = 5; // Ri + 2mm sheet
  const C: [number, number] = [5, 5]; // bend axis along Z
  const N = 6;
  // Base plate skins y=0 / y=2, x from the arc tangent (x=5) to x=100
  addGrid(p, ix, [5, 0, 0], [95, 0, 0], [0, 0, 60], 19, Z);
  addGrid(p, ix, [5, 2, 0], [0, 0, 60], [95, 0, 0], Z, 19);
  // Wall skins x=0 (outer) / x=2 (inner), y from the arc tangent (y=5) to 45
  addGrid(p, ix, [0, 5, 0], [0, 0, 60], [0, 40, 0], Z, 8);
  addGrid(p, ix, [2, 5, 0], [0, 40, 0], [0, 0, 60], 8, Z);
  // Edge strips joining each plate's two skins
  addGrid(p, ix, [100, 0, 0], [0, 2, 0], [0, 0, 60], 1, Z);
  addGrid(p, ix, [0, 45, 0], [2, 0, 0], [0, 0, 60], 1, Z);
  // Bend arcs, one narrow planar row per facet
  const jro = (k: number) =>
    k === 0 || k === N ? 0 : jitterAmp * Math.sin(k * 2.7 + 0.5);
  const jri = (k: number) =>
    k === 0 || k === N ? 0 : jitterAmp * Math.cos(k * 1.9);
  for (let k = 0; k < N; k++) {
    const phiA = (k * (Math.PI / 2)) / N;
    const phiB = ((k + 1) * (Math.PI / 2)) / N;
    const [oxA, oyA] = arcPt(C, Ro + jro(k), phiA);
    const [oxB, oyB] = arcPt(C, Ro + jro(k + 1), phiB);
    addGrid(p, ix, [oxA, oyA, 0], [0, 0, 60], [oxB - oxA, oyB - oyA, 0], Z, 1);
    const [inxA, inyA] = arcPt(C, Ri + jri(k), phiA);
    const [inxB, inyB] = arcPt(C, Ri + jri(k + 1), phiB);
    addGrid(p, ix, [inxA, inyA, 0], [0, 0, 60], [inxB - inxA, inyB - inyA, 0], Z, 1);
  }
  return toGeometry(p, ix);
}

/**
 * Zero-thickness wall with a SHALLOW 4mm hem folded outward at the top —
 * the Img 5/8 false-negative scenario: the hem's width (area / longest
 * boundary = 4mm) sits under the 5mm strip scale, so the width rule alone
 * files it as a bend strip and its fold never enters the graph. The
 * face-count promotion rule must recover it.
 */
function buildHemChannel(): THREE.BufferGeometry {
  const p: number[] = [];
  const ix: number[] = [];
  // Base, normal +Y
  addGrid(p, ix, [0, 0, 0], [0, 0, 60], [100, 0, 0], 6, 10);
  // Wall at x=0, normal -X, z inset (notched)
  addGrid(p, ix, [0, 0, 10], [0, 0, 40], [0, 30, 0], 4, 3);
  // 4mm hem on top of the wall, folded outward (normal +Y), 16 faces
  addGrid(p, ix, [0, 30, 10], [-4, 0, 0], [0, 0, 40], 2, 4);
  return toGeometry(p, ix);
}

/**
 * Zero-thickness plate with a WINDOW cutout and a tab hinged on the window's
 * inner edge, folded up 90° — the Img 6/7 failure: the correct unfold lays
 * the tab INTO the window, i.e. TOWARD the base centroid, so the local
 * "swing away from the parent" probe picks the branch that folds the tab
 * back over the base rim instead. Only the global overlap pass corrects it.
 * Ring: 100×60 outer, window x∈[30,70] z∈[20,40]; tab 15 long hinged at
 * z=20, x∈[40,60].
 */
function buildTabInWindowPlate(): THREE.BufferGeometry {
  const p: number[] = [];
  const ix: number[] = [];
  // Ring built from four coplanar rectangles (10mm vertex pitch so shared
  // boundaries weld); segmentation joins them into ONE base region.
  addGrid(p, ix, [0, 0, 0], [30, 0, 0], [0, 0, 60], 3, 6); // left
  addGrid(p, ix, [70, 0, 0], [30, 0, 0], [0, 0, 60], 3, 6); // right
  addGrid(p, ix, [30, 0, 0], [40, 0, 0], [0, 0, 20], 4, 2); // top strip
  addGrid(p, ix, [30, 0, 40], [40, 0, 0], [0, 0, 20], 4, 2); // bottom strip
  // Tab hinged on the window edge at z=20, folded up (+Y), 15 deep
  addGrid(p, ix, [40, 0, 20], [20, 0, 0], [0, 15, 0], 2, 3);
  return toGeometry(p, ix);
}

/**
 * Zero-thickness 3-way corner bracket (Img 9-12 scenario): 60×60 base, two
 * 40-tall walls, and a diagonal gusset web (plane x+z=10) welded to BOTH
 * walls — a cycle in the bend graph. Folds: base-wallA, base-wallB,
 * wallA-gusset, wallB-gusset. Rigid rotation cannot satisfy the gusset's two
 * anchors; it must be triangle-unrolled.
 */
function buildGussetCornerBracket(): THREE.BufferGeometry {
  const p: number[] = [];
  const ix: number[] = [];
  // Base, normal +Y (10mm pitch)
  addGrid(p, ix, [0, 0, 0], [0, 0, 60], [60, 0, 0], 6, 6);
  // Wall A at x=0, z in [10,60]
  addGrid(p, ix, [0, 0, 10], [0, 0, 50], [0, 40, 0], 5, 4);
  // Wall B at z=0, x in [10,60]
  addGrid(p, ix, [10, 0, 0], [0, 40, 0], [50, 0, 0], 4, 5);
  // Gusset web across the corner, plane x+z=10, welded to both walls
  addGrid(p, ix, [0, 0, 10], [10, 0, -10], [0, 40, 0], 1, 4);
  return toGeometry(p, ix);
}

function positionSnapshot(geom: THREE.BufferGeometry): Float32Array {
  return new Float32Array(
    (geom.attributes.position as THREE.BufferAttribute).array as Float32Array,
  );
}

function yExtent(geom: THREE.BufferGeometry): number {
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  return bb.max.y - bb.min.y;
}

describe("sm-unfold-engine", () => {
  it("welds duplicated face-boundary vertices and drops none of the faces", () => {
    const geom = buildOpenBox();
    const { weldedPos, faces } = weldMesh(geom);
    const rawCount = (geom.attributes.position as THREE.BufferAttribute).count;
    assert.ok(weldedPos.length / 3 < rawCount, "welded count must shrink");
    assert.ok(faces.length > 100, "expect a real face count");
  });

  it("segments the open box into one region per plate", () => {
    const geom = buildOpenBox();
    const { weldedPos, faces } = weldMesh(geom);
    const { normals, edgeMap } = buildTopology(weldedPos, faces);
    const { regionCount, sizes } = segmentRegions(faces, normals, edgeMap);
    assert.equal(regionCount, 5, "base + 4 walls");
    assert.equal(Math.max(...sizes), 120, "base is the largest region");
  });

  it("finds four ~90° folds on the open box", () => {
    const geom = buildOpenBox();
    const { weldedPos, faces } = weldMesh(geom);
    const { normals, edgeMap, v } = buildTopology(weldedPos, faces);
    const seg = segmentRegions(faces, normals, edgeMap);
    const graph = buildBendGraph(
      faces,
      normals,
      edgeMap,
      seg.region,
      seg.regionCount,
      seg.sizes,
      v,
    );
    assert.equal(graph.groupCount, 5);
    assert.equal(graph.folds.length, 4);
    for (const fold of graph.folds) {
      assert.ok(
        Math.abs(fold.angle - Math.PI / 2) < 0.02,
        `fold angle ${fold.angle} should be ~90°`,
      );
    }
  });

  it("unfolds the open box flat onto Y=0 with the right blank size", () => {
    const geom = buildOpenBox();
    const before = positionSnapshot(geom);

    const result = unfoldGeometry(geom);
    assert.ok(result, "expected an unfold result");
    assert.equal(result!.foldCount, 4);

    // Blank: 100 + 30 + 30 across, 60 + 30 + 30 deep
    assert.ok(Math.abs(result!.flatWidth - 160) < 0.01, `width ${result!.flatWidth}`);
    assert.ok(Math.abs(result!.flatLength - 120) < 0.01, `length ${result!.flatLength}`);

    // Zero-thickness sheet must be dead flat on the bed
    assert.ok(yExtent(result!.flatGeometry) < 1e-3, "sheet must lie in Y=0 plane");
    result!.flatGeometry.computeBoundingBox();
    assert.ok(Math.abs(result!.flatGeometry.boundingBox!.min.y) < 1e-6, "rests on Y=0");

    // The source geometry is the refold state — it must be untouched
    assert.deepEqual(positionSnapshot(geom), before, "input must not be mutated");
  });

  it("resolveRotationSign picks the branch that moves the child away from the base", () => {
    const pivot = new THREE.Vector3(0, 0, 0);
    const axis = new THREE.Vector3(0, 0, 1);
    const child = new THREE.Vector3(0, 15, 0); // wall centroid, above hinge
    const base = new THREE.Vector3(50, 0, 0); // base plate centroid
    // +90° about Z sends the child to (-15, 0, 0): away from the base.
    // -90° sends it to (+15, 0, 0): folded across the base. Expect +90°.
    const chosen = resolveRotationSign(
      pivot, axis, Math.PI / 2, -Math.PI / 2, child, base,
    );
    assert.equal(chosen, Math.PI / 2);
    // Swapping the candidate order must not change the geometric outcome
    const swapped = resolveRotationSign(
      pivot, axis, -Math.PI / 2, Math.PI / 2, child, base,
    );
    assert.equal(swapped, Math.PI / 2);
  });

  it("unfolds inward return flanges outward (no fold back across the base)", () => {
    const geom = buildReturnFlangeChannel();
    const result = unfoldGeometry(geom);
    assert.ok(result, "expected an unfold result");
    assert.equal(result!.foldCount, 4, "two wall bends + two flange bends");

    // Blank: 20 + 30 + 100 + 30 + 20 across, 60 deep. Any flap folded the
    // wrong way (inward, over the base) shrinks the width below 200.
    assert.ok(Math.abs(result!.flatWidth - 200) < 0.01, `width ${result!.flatWidth}`);
    assert.ok(Math.abs(result!.flatLength - 60) < 0.01, `length ${result!.flatLength}`);
    assert.ok(yExtent(result!.flatGeometry) < 1e-3, "must lie flat");
  });

  it("keeps both skins of a solid plate together (thickness-aware groups)", () => {
    const geom = buildSolidLBracket();
    const { weldedPos, faces } = weldMesh(geom);
    const { normals, edgeMap, v } = buildTopology(weldedPos, faces);
    const seg = segmentRegions(faces, normals, edgeMap);
    const graph = buildBendGraph(
      faces,
      normals,
      edgeMap,
      seg.region,
      seg.regionCount,
      seg.sizes,
      v,
    );
    // bottom+top skins = base plate, outer+inner skins = wall plate
    assert.equal(graph.groupCount, 2, "two plate groups");
    assert.equal(graph.folds.length, 1, "one bend between the plates");
    assert.ok(Math.abs(graph.folds[0].angle - Math.PI / 2) < 0.02);
  });

  it("unfolds the solid L-bracket flat within thickness tolerance", () => {
    const geom = buildSolidLBracket();
    const result = unfoldGeometry(geom);
    assert.ok(result, "expected an unfold result");

    // Base 100 long + wall 52 hinged near the base line; hinge sits at a
    // skin rather than mid-plane, so allow thickness-order slack.
    assert.ok(
      result!.flatWidth > 145 && result!.flatWidth < 158,
      `width ${result!.flatWidth}`,
    );
    assert.ok(Math.abs(result!.flatLength - 60) < 0.01, `length ${result!.flatLength}`);

    // Flat solid sheet: total height ≤ thickness + hinge offset (2t)
    const extent = yExtent(result!.flatGeometry);
    assert.ok(extent < 4.1, `flattened stack height ${extent} must be ~thickness`);
  });

  it("flattens a jittered cylindrical bend to exactly one sheet thickness", () => {
    const geom = buildArcBendBracket(0.05);
    const { weldedPos, faces } = weldMesh(geom);
    const { normals, edgeMap, v } = buildTopology(weldedPos, faces);
    const seg = segmentRegions(faces, normals, edgeMap);
    const graph = buildBendGraph(
      faces, normals, edgeMap, seg.region, seg.regionCount, seg.sizes, v,
    );
    assert.equal(graph.folds.length, 1, "one bend between base and wall");
    const fold = graph.folds[0];
    assert.equal(fold.strip.length, 12, "both skins' arc rows belong to the bend");
    assert.ok(fold.chainMembers, "winning arc must develop as a chain");

    // Authoritative thickness from the base plate (skins normal to ±Y in
    // the folded orientation) must read the 2mm stock exactly.
    const baseSkinVerts = new Set<number>();
    faces.forEach((f, fi) => {
      const r = seg.region[fi];
      if (graph.isLarge[r] && Math.abs(graph.regNormal[r].y) > 0.9)
        for (const vi of f) baseSkinVerts.add(vi);
    });
    const measured = measureSheetThickness(
      weldedPos, baseSkinVerts, new THREE.Vector3(0, 1, 0),
    );
    assert.ok(Math.abs(measured - 2) < 1e-6, `measured stock ${measured} must be 2mm`);

    const flat = unfoldMesh(weldedPos, faces, seg.region, seg.regionCount, graph);

    // Every bend-strip vertex must sit on one of the sheet's two surfaces,
    // and the two surfaces must be exactly one sheet thickness apart. The
    // 0.05mm injected jitter would otherwise show up here directly.
    const stripYs: number[] = [];
    for (const s of fold.strip) {
      faces.forEach((f, fi) => {
        if (seg.region[fi] === s) for (const vi of f) stripYs.push(flat[vi * 3 + 1]);
      });
    }
    assert.ok(stripYs.length > 0, "strip verts found");
    const lo = Math.min(...stripYs);
    const hi = Math.max(...stripYs);
    assert.ok(Math.abs(hi - lo - 2) < 0.05, `strip thickness ${hi - lo} must be 2mm`);
    for (const y of stripYs) {
      assert.ok(
        Math.min(Math.abs(y - lo), Math.abs(y - hi)) < 1e-6,
        `strip vert y=${y} must sit on a skin surface (lo=${lo}, hi=${hi})`,
      );
    }

    // Whole part must still be sheet-flat
    let maxY = -Infinity;
    for (let i = 0; i < flat.length / 3; i++) maxY = Math.max(maxY, flat[i * 3 + 1]);
    assert.ok(maxY < 4, `flattened stack height ${maxY} must be ~thickness`);
  });

  it("CORRECTION 3: promotes a 4mm hem flange to a plate and unfolds its fold", () => {
    const geom = buildHemChannel();
    const { weldedPos, faces } = weldMesh(geom);
    const { normals, edgeMap, v } = buildTopology(weldedPos, faces);
    const seg = segmentRegions(faces, normals, edgeMap);
    const graph = buildBendGraph(
      faces, normals, edgeMap, seg.region, seg.regionCount, seg.sizes, v,
    );
    assert.equal(graph.groupCount, 3, "base + wall + promoted hem");
    assert.equal(graph.folds.length, 2, "base-wall and wall-hem folds");

    const result = unfoldGeometry(geom);
    assert.ok(result, "expected an unfold result");
    assert.equal(result!.foldCount, 2);
    // Blank: 4 (hem) + 30 (wall) + 100 (base) across, 60 deep
    assert.ok(Math.abs(result!.flatWidth - 134) < 0.01, `width ${result!.flatWidth}`);
    assert.ok(Math.abs(result!.flatLength - 60) < 0.01, `length ${result!.flatLength}`);
    assert.ok(yExtent(result!.flatGeometry) < 1e-3, "must lie flat");
  });

  it("CORRECTION 1: resolves a tab folded over the base into the window cutout", () => {
    const geom = buildTabInWindowPlate();
    const result = unfoldGeometry(geom);
    assert.ok(result, "expected an unfold result");
    assert.equal(result!.foldCount, 1, "one tab fold");
    assert.ok(yExtent(result!.flatGeometry) < 1e-3, "must lie flat");
    // Either branch keeps the 100×60 outline — the tab must end up INSIDE
    // the window (z > hinge in centered coords), not folded over the rim.
    assert.ok(Math.abs(result!.flatWidth - 100) < 0.01, `width ${result!.flatWidth}`);
    assert.ok(Math.abs(result!.flatLength - 60) < 0.01, `length ${result!.flatLength}`);
    // Tab tip vertices started at y=15; part is centered afterwards, so the
    // hinge (z=20) sits at z=-10. Correct branch: tip at z=+5. Wrong branch
    // (over the rim): tip at z=-25.
    const src = geom.attributes.position as THREE.BufferAttribute;
    const out = result!.flatGeometry.attributes.position as THREE.BufferAttribute;
    let tipCount = 0;
    for (let i = 0; i < src.count; i++) {
      if (Math.abs(src.getY(i) - 15) < 1e-6) {
        tipCount++;
        assert.ok(
          Math.abs(out.getZ(i) - 5) < 0.01,
          `tab tip vert ${i} must land in the window (z=5), got z=${out.getZ(i)}`,
        );
      }
    }
    assert.ok(tipCount >= 3, "tab tip verts found");
  });

  it("CORRECTION 2: normalizes EVERY plate to the stock thickness, not just strips", () => {
    // The wall plate of the solid L-bracket flattens one hinge-offset up
    // (levels ~2..4 instead of 0..2) because the hinge sits at a skin. The
    // group-wide normalization must put every plate onto the same two skin
    // levels exactly one sheet thickness apart.
    const result = unfoldGeometry(buildSolidLBracket());
    assert.ok(result, "expected an unfold result");
    result!.flatGeometry.computeBoundingBox();
    const bb = result!.flatGeometry.boundingBox!;
    assert.ok(
      Math.abs(bb.max.y - bb.min.y - 2) < 0.05,
      `total stack ${bb.max.y - bb.min.y} must equal the 2mm stock`,
    );
    // Sample thickness across the whole blank: every vertex — base plate,
    // near the fold and far from it — must sit on one of the two skin
    // levels within 0.05mm.
    const pos = result!.flatGeometry.attributes.position as THREE.BufferAttribute;
    const lo = bb.min.y;
    const hi = bb.min.y + 2;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      assert.ok(
        Math.min(Math.abs(y - lo), Math.abs(y - hi)) < 0.05,
        `vert ${i} y=${y} must sit on a skin surface (lo=${lo}, hi=${hi})`,
      );
    }
  });

  it("CORRECTION 4: flattens a gusset bridging two walls without distortion", () => {
    const geom = buildGussetCornerBracket();

    // The gusset closes a cycle: 4 folds between 4 plate groups
    const { weldedPos, faces } = weldMesh(geom);
    const { normals, edgeMap, v } = buildTopology(weldedPos, faces);
    const seg = segmentRegions(faces, normals, edgeMap);
    const graph = buildBendGraph(
      faces, normals, edgeMap, seg.region, seg.regionCount, seg.sizes, v,
    );
    assert.equal(graph.groupCount, 4, "base + 2 walls + gusset");
    assert.equal(graph.folds.length, 4, "cycle: one more fold than tree edges");

    const result = unfoldGeometry(geom);
    assert.ok(result, "expected an unfold result");
    assert.ok(yExtent(result!.flatGeometry) < 1e-3, "gusset must lie flat too");

    // Shape preservation: the unroll uses true 3D edge lengths, so every
    // gusset triangle keeps its area exactly (rigid distortion would not).
    const src = geom.attributes.position as THREE.BufferAttribute;
    const out = result!.flatGeometry.attributes.position as THREE.BufferAttribute;
    const idx = geom.index!;
    const triArea = (att: THREE.BufferAttribute, i: number) => {
      const a = new THREE.Vector3().fromBufferAttribute(att, idx.getX(i));
      const b = new THREE.Vector3().fromBufferAttribute(att, idx.getX(i + 1));
      const c = new THREE.Vector3().fromBufferAttribute(att, idx.getX(i + 2));
      return b.sub(a).cross(c.sub(a)).length() / 2;
    };
    let gussetAreaBefore = 0;
    let gussetAreaAfter = 0;
    for (let i = 0; i < idx.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(src, idx.getX(i));
      const b = new THREE.Vector3().fromBufferAttribute(src, idx.getX(i + 1));
      const c = new THREE.Vector3().fromBufferAttribute(src, idx.getX(i + 2));
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      if (n.x > 0.5 && n.z > 0.5) {
        gussetAreaBefore += triArea(src, i);
        gussetAreaAfter += triArea(out, i);
      }
    }
    assert.ok(gussetAreaBefore > 500, "gusset faces found");
    assert.ok(
      Math.abs(gussetAreaAfter - gussetAreaBefore) / gussetAreaBefore < 0.01,
      `gusset area must be preserved (${gussetAreaBefore} -> ${gussetAreaAfter})`,
    );
  });

  it("is deterministic and refolds exactly via mesh apply/restore", () => {
    const geom = buildSolidLBracket();
    const saved = positionSnapshot(geom);

    const a = unfoldGeometry(geom);
    const b = unfoldGeometry(geom);
    assert.ok(a && b);
    assert.deepEqual(
      positionSnapshot(a!.flatGeometry),
      positionSnapshot(b!.flatGeometry),
      "repeat unfolds must be identical (no drift)",
    );

    // applyToMesh / restoreMesh round-trip on a real mesh
    const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
    const { remap, weldedPos, faces } = weldMesh(geom);
    const { normals, edgeMap, v } = buildTopology(weldedPos, faces);
    const seg = segmentRegions(faces, normals, edgeMap);
    const graph = buildBendGraph(
      faces,
      normals,
      edgeMap,
      seg.region,
      seg.regionCount,
      seg.sizes,
      v,
    );
    const flatWelded = unfoldMesh(weldedPos, faces, seg.region, seg.regionCount, graph);

    applyToMesh(mesh, remap, flatWelded);
    assert.ok(yExtent(mesh.geometry as THREE.BufferGeometry) < 4.1, "mesh unbent");

    restoreMesh(mesh, saved);
    assert.deepEqual(
      positionSnapshot(mesh.geometry as THREE.BufferGeometry),
      saved,
      "refold must restore the original positions exactly",
    );
  });
});
