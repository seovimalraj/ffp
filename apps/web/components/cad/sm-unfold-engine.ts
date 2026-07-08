import * as THREE from "three";

// ---------------------------------------------------------------------------
// Sheet-metal mesh unfold engine.
//
// Operates on the REAL render mesh: welds duplicated vertices, segments the
// triangles into flat regions, groups opposite skins of the same plate,
// builds a bend graph between plates, and rigidly rotates each plate (with
// all of its holes, edge faces and downstream plates) about its bend axis
// until the whole part lies flat. The result is a plain vertex-position
// transform — every hole, slot and tab appears exactly where it is on the
// part because the part's own triangles are what get moved.
//
// The original positions are never mutated here; callers keep the source
// geometry as the exact refold state.
// ---------------------------------------------------------------------------

// Faces whose normals are within this dihedral are one flat region. Planar
// STEP faces tessellate exactly coplanar, while the facet rows of a bend
// cylinder differ by well over 5° at the viewer's deflection settings —
// anything looser lets region growth flow straight through smooth bends.
const FLAT_DIHEDRAL_DEG = 5;
// A region is a plate skin when it is wider than this (area / longest
// boundary). Bend arcs, perimeter edge faces and hole walls are all
// thickness-or-radius scale (~1–4 mm); real flanges are wider.
const STRIP_MAX_WIDTH_MM = 5;
// Narrow regions chain into one bend strip only across smooth boundaries
// (bend-arc facet rows differ by ≤ the tessellator's angular deflection);
// a bend arc meets notch/edge faces at ~90°, which must break the chain.
const SMOOTH_CLUSTER_RAD = (45 * Math.PI) / 180;
// Plate pairs closer to parallel than this co-move instead of folding
// (tessellation noise, plane split by hole rows).
const COPLANAR_MERGE_RAD = (8 * Math.PI) / 180;
// Plate pairs closer to anti-parallel than this are the two skins of one
// physical plate (solid sheet has thickness) — they must rotate together,
// never "unfold" 180° away from each other.
const ANTIPARALLEL_MERGE_RAD = Math.PI - 0.45; // ~154°
// Residual hinge rotations smaller than this are treated as already flat.
const MIN_FOLD_RAD = 0.05;

export type WeldResult = {
  weldedPos: number[];
  faces: Array<[number, number, number]>;
  remap: Int32Array;
  srcIndex: number[];
};

export type MeshTopology = {
  normals: THREE.Vector3[];
  edgeMap: Map<string, number[]>;
  v: (i: number) => THREE.Vector3;
};

export type RegionSegmentation = {
  region: Int32Array;
  regionCount: number;
  sizes: number[];
};

export type SheetFold = {
  gA: number;
  gB: number;
  rA: number;
  rB: number;
  // ALL bend-arc regions between the two plates (empty for sharp direct
  // folds) — includes both skins' arcs; they swing with the child side.
  strip: number[];
  // Hinge boundary edges on the rA side / rB side (rB side only for strips)
  edgesA: Array<[number, number]>;
  edgesB: Array<[number, number]> | null;
  angle: number;
  // Developable bend: the winning arc's facet rows ordered from the rA side,
  // with the boundary edge sets between consecutive elements
  // (chainBoundaries[0] = rA↔row0, last = rowK↔rB). Null → rotate rigidly.
  chainMembers: number[] | null;
  chainBoundaries: Array<Array<[number, number]>> | null;
};

export type BendGraph = {
  folds: SheetFold[];
  // region -> plate-group id for plate regions, -1 for strip-scale ones
  groupOf: Int32Array;
  groupCount: number;
  regNormal: THREE.Vector3[];
  regCentroid: THREE.Vector3[];
  // "plate skin" flag (width-based, not face-count-based)
  isLarge: boolean[];
  // strip-scale region -> plate region it rides with (-1 = static)
  anchorOf: Int32Array;
};

// ============ VERTEX WELD ============
export function weldMesh(geometry: THREE.BufferGeometry): WeldResult {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const srcIndex: number[] = geometry.index
    ? Array.from(geometry.index.array as ArrayLike<number>)
    : Array.from({ length: pos.count }, (_, i) => i);

  const map = new Map<string, number>(); // "x,y,z" -> welded index
  const weldedPos: number[] = [];
  const remap = new Int32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const key =
      pos.getX(i).toFixed(3) +
      "," +
      pos.getY(i).toFixed(3) +
      "," +
      pos.getZ(i).toFixed(3);
    let w = map.get(key);
    if (w === undefined) {
      w = weldedPos.length / 3;
      map.set(key, w);
      weldedPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    remap[i] = w;
  }

  const faces: Array<[number, number, number]> = [];
  for (let i = 0; i < srcIndex.length; i += 3) {
    const a = remap[srcIndex[i]];
    const b = remap[srcIndex[i + 1]];
    const c = remap[srcIndex[i + 2]];
    if (a !== b && b !== c && a !== c) faces.push([a, b, c]);
  }
  console.log(
    "[SM-WELD]",
    pos.count,
    "->",
    weldedPos.length / 3,
    "verts |",
    faces.length,
    "faces",
  );
  return { weldedPos, faces, remap, srcIndex };
}

// ============ FACE NORMALS + EDGE MAP ============
export function buildTopology(
  weldedPos: number[],
  faces: Array<[number, number, number]>,
): MeshTopology {
  const v = (i: number) =>
    new THREE.Vector3(weldedPos[i * 3], weldedPos[i * 3 + 1], weldedPos[i * 3 + 2]);

  const normals = faces.map((f) => {
    const a = v(f[0]);
    const b = v(f[1]);
    const c = v(f[2]);
    return b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  });

  const edgeMap = new Map<string, number[]>(); // "lo_hi" -> [faceIdx, faceIdx]
  faces.forEach((f, fi) => {
    for (let e = 0; e < 3; e++) {
      const p = f[e];
      const q = f[(e + 1) % 3];
      const key = Math.min(p, q) + "_" + Math.max(p, q);
      let list = edgeMap.get(key);
      if (!list) {
        list = [];
        edgeMap.set(key, list);
      }
      list.push(fi);
    }
  });
  return { normals, edgeMap, v };
}

// ============ REGION SEGMENTATION ============
export function segmentRegions(
  faces: Array<[number, number, number]>,
  normals: THREE.Vector3[],
  edgeMap: Map<string, number[]>,
  flatDihedralDeg: number = FLAT_DIHEDRAL_DEG,
): RegionSegmentation {
  const cos = Math.cos((flatDihedralDeg * Math.PI) / 180);
  const region = new Int32Array(faces.length).fill(-1);
  let regionCount = 0;

  for (let seed = 0; seed < faces.length; seed++) {
    if (region[seed] !== -1) continue;
    const stack = [seed];
    region[seed] = regionCount;
    while (stack.length) {
      const fi = stack.pop()!;
      const f = faces[fi];
      for (let e = 0; e < 3; e++) {
        const p = f[e];
        const q = f[(e + 1) % 3];
        const key = Math.min(p, q) + "_" + Math.max(p, q);
        for (const nb of edgeMap.get(key)!) {
          if (region[nb] !== -1) continue;
          if (normals[fi].dot(normals[nb]) > cos) {
            region[nb] = regionCount;
            stack.push(nb);
          }
        }
      }
    }
    regionCount++;
  }

  const sizes = new Array<number>(regionCount).fill(0);
  for (let i = 0; i < faces.length; i++) sizes[region[i]]++;
  console.log(
    "[SM-SEG]",
    regionCount,
    "regions | largest:",
    Math.max(...sizes),
    "faces",
  );
  return { region, regionCount, sizes };
}

function longestAxisFromEdges(
  edges: Array<[number, number]>,
  v: (i: number) => THREE.Vector3,
): { axisA: THREE.Vector3; axisB: THREE.Vector3 } | null {
  let best: [number, number] | null = null;
  let bestLen = -1;
  for (const [p, q] of edges) {
    const len = v(p).distanceTo(v(q));
    if (len > bestLen) {
      bestLen = len;
      best = [p, q];
    }
  }
  if (!best || bestLen < 1e-9) return null;
  // Axis through the two extreme points of all edge vertices along the
  // dominant boundary direction.
  const dir = v(best[1]).clone().sub(v(best[0])).normalize();
  let minT = Infinity;
  let maxT = -Infinity;
  const base = v(best[0]);
  const allPts = new Set<number>();
  edges.forEach(([p, q]) => {
    allPts.add(p);
    allPts.add(q);
  });
  for (const p of allPts) {
    const t = v(p).clone().sub(base).dot(dir);
    minT = Math.min(minT, t);
    maxT = Math.max(maxT, t);
  }
  return {
    axisA: base.clone().add(dir.clone().multiplyScalar(minT)),
    axisB: base.clone().add(dir.clone().multiplyScalar(maxT)),
  };
}

// ============ BEND GRAPH ============
// Plate skins are the WIDE regions (area / longest boundary); bend arcs,
// perimeter edge faces and hole walls are thickness/radius-scale narrow.
// Skins joined near-parallel or near-anti-parallel belong to the same rigid
// plate group. Remaining connections between groups — direct sharp edges,
// or chains of narrow bend-arc regions bridging exactly two plates — are
// folds. Narrow regions that are nobody's bend strip get anchored to their
// dominant plate neighbour so they travel with it.
export function buildBendGraph(
  faces: Array<[number, number, number]>,
  normals: THREE.Vector3[],
  edgeMap: Map<string, number[]>,
  region: Int32Array,
  regionCount: number,
  sizes: number[],
  v: (i: number) => THREE.Vector3,
  stripMaxWidthMm: number = STRIP_MAX_WIDTH_MM,
): BendGraph {
  // Boundary edges between different regions
  type Adj = { a: number; b: number; edges: Array<[number, number]>; length: number };
  const adj = new Map<string, Adj>(); // "rA_rB" (rA<rB)
  for (const [key, fl] of edgeMap) {
    if (fl.length !== 2) continue;
    const rA = region[fl[0]];
    const rB = region[fl[1]];
    if (rA === rB) continue;
    const k = Math.min(rA, rB) + "_" + Math.max(rA, rB);
    let entry = adj.get(k);
    if (!entry) {
      entry = { a: Math.min(rA, rB), b: Math.max(rA, rB), edges: [], length: 0 };
      adj.set(k, entry);
    }
    const [p, q] = key.split("_").map(Number);
    entry.edges.push([p, q]);
    entry.length += v(p).distanceTo(v(q));
  }

  // Region average normal, centroid and area
  const regNormal = Array.from({ length: regionCount }, () => new THREE.Vector3());
  const regCentroid = Array.from({ length: regionCount }, () => new THREE.Vector3());
  const regFaceCount = new Array<number>(regionCount).fill(0);
  const regArea = new Array<number>(regionCount).fill(0);
  faces.forEach((f, fi) => {
    const r = region[fi];
    regNormal[r].add(normals[fi]);
    regCentroid[r].add(v(f[0])).add(v(f[1])).add(v(f[2]));
    regFaceCount[r] += 1;
    const a = v(f[0]);
    regArea[r] +=
      v(f[1]).sub(a).cross(v(f[2]).sub(a)).length() / 2;
  });
  for (let r = 0; r < regionCount; r++) {
    regNormal[r].normalize();
    if (regFaceCount[r] > 0) regCentroid[r].divideScalar(regFaceCount[r] * 3);
  }

  // Plate classification by width: a bend row 130mm long is still only
  // radius-scale wide, while a real skin/flange is wide in both directions.
  const longestBoundary = new Array<number>(regionCount).fill(0);
  for (const { a, b, length } of adj.values()) {
    longestBoundary[a] = Math.max(longestBoundary[a], length);
    longestBoundary[b] = Math.max(longestBoundary[b], length);
  }
  const regWidth = new Array<number>(regionCount);
  const isLarge = new Array<boolean>(regionCount);
  for (let r = 0; r < regionCount; r++) {
    regWidth[r] =
      longestBoundary[r] > 1e-9 ? regArea[r] / longestBoundary[r] : Infinity;
    isLarge[r] = regArea[r] > 0 && regWidth[r] > stripMaxWidthMm;
  }

  // Small-but-real flanges: a shallow hem reads only 3–4mm wide, which the
  // width rule alone files under strip scale — the flange then never enters
  // the bend graph and the part reports "no folds". A region whose face
  // count is a meaningful fraction of the LARGEST region is a plate too, as
  // long as it is not radius-scale narrow (bend-arc facet rows stay ~1mm)
  // and it is not a blank's perimeter face (recognisable because it borders
  // two near-anti-parallel plates: the top and bottom skins of the stock).
  let largestRegion = 0;
  for (let r = 1; r < regionCount; r++) {
    if (sizes[r] > sizes[largestRegion]) largestRegion = r;
  }
  const largeFaceThreshold = Math.max(8, sizes[largestRegion] * 0.08);
  const largeNeighbors = new Map<number, number[]>();
  for (const { a, b } of adj.values()) {
    if (isLarge[b]) {
      if (!largeNeighbors.has(a)) largeNeighbors.set(a, []);
      largeNeighbors.get(a)!.push(b);
    }
    if (isLarge[a]) {
      if (!largeNeighbors.has(b)) largeNeighbors.set(b, []);
      largeNeighbors.get(b)!.push(a);
    }
  }
  const angleBetweenNormals = (a: number, b: number) =>
    Math.acos(THREE.MathUtils.clamp(regNormal[a].dot(regNormal[b]), -1, 1));
  const promoted: number[] = [];
  for (let r = 0; r < regionCount; r++) {
    if (isLarge[r] || regArea[r] <= 0) continue;
    if (sizes[r] < largeFaceThreshold) continue;
    if (regWidth[r] <= stripMaxWidthMm / 2) continue;
    const nbrs = largeNeighbors.get(r) ?? [];
    let bridgesOppositeSkins = false;
    for (let i = 0; i < nbrs.length && !bridgesOppositeSkins; i++) {
      for (let j = i + 1; j < nbrs.length; j++) {
        if (angleBetweenNormals(nbrs[i], nbrs[j]) > ANTIPARALLEL_MERGE_RAD) {
          bridgesOppositeSkins = true;
          break;
        }
      }
    }
    if (bridgesOppositeSkins) continue;
    isLarge[r] = true;
    promoted.push(r);
  }
  if (promoted.length > 0) {
    console.log(
      "[SM-BENDS-V2] promoted",
      promoted.length,
      "small flange region(s) to plates:",
      promoted.join(", "),
    );
  }

  // Fold/merge candidates between plates
  type Candidate = {
    a: number;
    b: number;
    strip: number[];
    edgesA: Array<[number, number]>;
    edgesB: Array<[number, number]> | null;
    angle: number;
  };
  const candidates: Candidate[] = [];
  const angleBetween = (a: number, b: number) =>
    Math.acos(THREE.MathUtils.clamp(regNormal[a].dot(regNormal[b]), -1, 1));

  // Direct plate-plate edges
  for (const { a, b, edges } of adj.values()) {
    if (isLarge[a] && isLarge[b]) {
      candidates.push({
        a,
        b,
        strip: [],
        edgesA: edges,
        edgesB: null,
        angle: angleBetween(a, b),
      });
    }
  }

  // Strip clusters: connected components of narrow regions. A cluster that
  // bridges exactly two plates is a bend (the facet rows of one bend arc
  // cluster together); anything touching more plates is left for anchoring.
  const stripAdj = new Map<number, number[]>(); // narrow region -> narrow neighbours
  for (const { a, b } of adj.values()) {
    if (isLarge[a] || isLarge[b]) continue;
    if (angleBetween(a, b) > SMOOTH_CLUSTER_RAD) continue;
    if (!stripAdj.has(a)) stripAdj.set(a, []);
    if (!stripAdj.has(b)) stripAdj.set(b, []);
    stripAdj.get(a)!.push(b);
    stripAdj.get(b)!.push(a);
  }
  const clusterOf = new Int32Array(regionCount).fill(-1);
  const clusters: number[][] = [];
  for (let s = 0; s < regionCount; s++) {
    if (isLarge[s] || clusterOf[s] !== -1 || regFaceCount[s] === 0) continue;
    const members: number[] = [];
    const stack = [s];
    clusterOf[s] = clusters.length;
    while (stack.length) {
      const cur = stack.pop()!;
      members.push(cur);
      for (const nb of stripAdj.get(cur) ?? []) {
        if (clusterOf[nb] === -1) {
          clusterOf[nb] = clusters.length;
          stack.push(nb);
        }
      }
    }
    clusters.push(members);
  }

  // Skin merges discovered from clusters, applied to the union-find below.
  const pendingUnions: Array<[number, number]> = [];

  for (const members of clusters) {
    // Plates touched by this cluster, with the hinge boundary per plate
    const plateEdges = new Map<number, Array<[number, number]>>();
    const memberSet = new Set(members);
    for (const { a, b, edges } of adj.values()) {
      const strip = memberSet.has(a) ? a : memberSet.has(b) ? b : null;
      if (strip === null) continue;
      const plate = strip === a ? b : a;
      if (!isLarge[plate]) continue;
      let list = plateEdges.get(plate);
      if (!list) {
        list = [];
        plateEdges.set(plate, list);
      }
      list.push(...edges);
    }

    // Opposite skins of one solid plate are near-anti-parallel AND only a
    // sheet thickness apart — merge them whatever the cluster arity (a part's
    // planar side-profile face can touch all skins of several plates at
    // once). Distant anti-parallel plates (opposite walls of a box) must
    // stay separate, hence the plane-gap check.
    const plates = [...plateEdges.keys()];
    for (let i = 0; i < plates.length; i++) {
      for (let j = i + 1; j < plates.length; j++) {
        const ang = angleBetween(plates[i], plates[j]);
        if (ang >= COPLANAR_MERGE_RAD && ang <= ANTIPARALLEL_MERGE_RAD) continue;
        const gap = Math.abs(
          regCentroid[plates[i]]
            .clone()
            .sub(regCentroid[plates[j]])
            .dot(regNormal[plates[i]]),
        );
        if (gap <= stripMaxWidthMm) pendingUnions.push([plates[i], plates[j]]);
      }
    }

    // A cluster bridging exactly two plates at a bend angle is a fold hinge
    if (plateEdges.size !== 2) continue;
    const [[pA, edgesA], [pB, edgesB]] = [...plateEdges.entries()];
    const angle = angleBetween(pA, pB);
    if (angle < COPLANAR_MERGE_RAD || angle > ANTIPARALLEL_MERGE_RAD) continue;
    candidates.push({
      a: pA,
      b: pB,
      strip: members,
      edgesA,
      edgesB,
      angle,
    });
  }

  // Union-find over large regions: near-parallel and near-anti-parallel
  // skins co-move as one plate group.
  const parent = new Int32Array(regionCount);
  for (let r = 0; r < regionCount; r++) parent[r] = r;
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    while (parent[x] !== root) {
      const nxt = parent[x];
      parent[x] = root;
      x = nxt;
    }
    return root;
  };
  const union = (x: number, y: number) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent[rx] = ry;
  };

  for (const c of candidates) {
    if (c.angle < COPLANAR_MERGE_RAD || c.angle > ANTIPARALLEL_MERGE_RAD) {
      union(c.a, c.b);
    }
  }
  for (const [a, b] of pendingUnions) union(a, b);

  // Compact plate-group ids for large regions
  const groupOf = new Int32Array(regionCount).fill(-1);
  const groupIdOfRoot = new Map<number, number>();
  let groupCount = 0;
  for (let r = 0; r < regionCount; r++) {
    if (!isLarge[r]) continue;
    const root = find(r);
    let g = groupIdOfRoot.get(root);
    if (g === undefined) {
      g = groupCount++;
      groupIdOfRoot.set(root, g);
    }
    groupOf[r] = g;
  }

  // Folds between distinct plate groups; one WINNING candidate per pair
  // (the one with the longest hinge boundary — the most reliable axis fit),
  // but the losing candidates' arcs (the other skin's bend rows) still
  // belong to the same physical bend and must swing with it.
  const edgesBetween = (x: number, y: number): Array<[number, number]> =>
    adj.get(Math.min(x, y) + "_" + Math.max(x, y))?.edges ?? [];

  // Order a bend's facet rows into a simple path from plate pA to plate pB.
  // Returns null for anything that is not a clean single-file chain — those
  // bends rotate rigidly instead of being developed row by row.
  const buildChain = (
    members: number[],
    pA: number,
    pB: number,
  ): { members: number[]; boundaries: Array<Array<[number, number]>> } | null => {
    if (members.length === 0) return null;
    const memberSet = new Set(members);
    const nbrs = new Map<number, number[]>();
    for (const m of members) nbrs.set(m, []);
    for (const { a, b } of adj.values()) {
      if (memberSet.has(a) && memberSet.has(b)) {
        nbrs.get(a)!.push(b);
        nbrs.get(b)!.push(a);
      }
    }
    const startCandidates = members.filter((m) => edgesBetween(m, pA).length > 0);
    if (startCandidates.length !== 1) return null;
    const ordered = [startCandidates[0]];
    const seen = new Set(ordered);
    for (;;) {
      const cur = ordered[ordered.length - 1];
      const nexts = (nbrs.get(cur) ?? []).filter((n) => !seen.has(n));
      if (nexts.length === 0) break;
      if (nexts.length > 1) return null;
      ordered.push(nexts[0]);
      seen.add(nexts[0]);
    }
    if (ordered.length !== members.length) return null;
    if (edgesBetween(ordered[ordered.length - 1], pB).length === 0) return null;
    const boundaries = [edgesBetween(ordered[0], pA)];
    for (let i = 1; i < ordered.length; i++) {
      boundaries.push(edgesBetween(ordered[i - 1], ordered[i]));
    }
    boundaries.push(edgesBetween(ordered[ordered.length - 1], pB));
    return { members: ordered, boundaries };
  };

  type PairEntry = { best: Candidate; allStrips: Set<number> };
  const foldByPair = new Map<string, PairEntry>();
  for (const c of candidates) {
    if (c.angle < COPLANAR_MERGE_RAD || c.angle > ANTIPARALLEL_MERGE_RAD) continue;
    const gA = groupOf[c.a];
    const gB = groupOf[c.b];
    if (gA === gB) continue; // bend inside one rigid group (cycle) — skip
    const pairKey = Math.min(gA, gB) + "_" + Math.max(gA, gB);
    let entry = foldByPair.get(pairKey);
    if (!entry) {
      entry = { best: c, allStrips: new Set() };
      foldByPair.set(pairKey, entry);
    }
    for (const s of c.strip) entry.allStrips.add(s);
    const count = (x: Candidate) => x.edgesA.length + (x.edgesB?.length ?? 0);
    if (count(c) > count(entry.best)) entry.best = c;
  }

  const folds: SheetFold[] = [];
  for (const { best, allStrips } of foldByPair.values()) {
    const chain = buildChain(best.strip, best.a, best.b);
    folds.push({
      gA: groupOf[best.a],
      gB: groupOf[best.b],
      rA: best.a,
      rB: best.b,
      strip: [...allStrips],
      edgesA: best.edgesA,
      edgesB: best.edgesB,
      angle: best.angle,
      chainMembers: chain ? chain.members : null,
      chainBoundaries: chain ? chain.boundaries : null,
    });
  }

  // Anchor leftover small regions (hole walls, edge faces, merged strips) to
  // the large region they share the most boundary edges with, so they move
  // rigidly with that plate. Strips consumed by folds are handled per fold.
  const usedStrips = new Set<number>();
  for (const f of folds) for (const s of f.strip) usedStrips.add(s);

  const neigh = new Map<number, Map<number, number>>(); // region -> (region -> edge count)
  const bumpNeigh = (from: number, to: number, count: number) => {
    let m = neigh.get(from);
    if (!m) {
      m = new Map();
      neigh.set(from, m);
    }
    m.set(to, (m.get(to) ?? 0) + count);
  };
  for (const { a, b, edges } of adj.values()) {
    bumpNeigh(a, b, edges.length);
    bumpNeigh(b, a, edges.length);
  }

  const anchorOf = new Int32Array(regionCount).fill(-1);
  // Narrow regions spanning MULTIPLE plate groups (a part's side-profile
  // face runs across the bend) must not be anchored: rigidly attaching them
  // to one plate would drag the other plate's welded boundary verts along.
  // Their verts already ride with whichever plate they are welded to.
  const staticNarrow = new Set<number>();
  for (let s = 0; s < regionCount; s++) {
    if (isLarge[s] || usedStrips.has(s)) continue;
    let bestLargeNeighbor = -1;
    let bestCount = -1;
    const touchedGroups = new Set<number>();
    for (const [n, count] of neigh.get(s) ?? []) {
      if (!isLarge[n]) continue;
      touchedGroups.add(groupOf[n]);
      if (count > bestCount) {
        bestCount = count;
        bestLargeNeighbor = n;
      }
    }
    if (touchedGroups.size > 1) {
      staticNarrow.add(s);
      continue;
    }
    anchorOf[s] = bestLargeNeighbor;
  }
  // Resolve chains: smalls touching only smalls adopt a neighbour's anchor.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let s = 0; s < regionCount; s++) {
      if (isLarge[s] || usedStrips.has(s) || staticNarrow.has(s) || anchorOf[s] !== -1) continue;
      let bestAnchor = -1;
      let bestCount = -1;
      for (const [n, count] of neigh.get(s) ?? []) {
        if (isLarge[n]) continue;
        if (anchorOf[n] !== -1 && count > bestCount) {
          bestCount = count;
          bestAnchor = anchorOf[n];
        }
      }
      if (bestAnchor !== -1) {
        anchorOf[s] = bestAnchor;
        changed = true;
      }
    }
    if (!changed) break;
  }

  console.log(
    "[SM-GRAPH]",
    folds.length,
    "folds between",
    groupCount,
    "plate groups |",
    folds.map((f) => Math.round((f.angle * 180) / Math.PI) + "°").join(", "),
  );
  return { folds, groupOf, groupCount, regNormal, regCentroid, isLarge, anchorOf };
}

// ============ EMPIRICAL ROTATION-BRANCH RESOLUTION ============
// Two candidate hinge rotations lay the child coplanar with the parent: the
// outward swing and the branch that tucks the flap back over/under the base
// (they differ by π; at a 90° bend they are exactly +angle / −angle). Formula
// sign inference from normals is unreliable — a region normal can point into
// the sheet instead of out of it and silently flip the sign — so the branch
// is resolved empirically: rotate a COPY of the child plate's centroid both
// ways and keep the branch that INCREASES its separation from the base/parent
// centroid. A correct outward unfold always moves the flap away, never
// toward or across the base.
export function resolveRotationSign(
  pivot: THREE.Vector3,
  axisDir: THREE.Vector3,
  anglePos: number,
  angleNeg: number,
  childCentroid: THREE.Vector3,
  baseCentroid: THREE.Vector3,
): number {
  const testQuatPos = new THREE.Quaternion().setFromAxisAngle(axisDir, anglePos);
  const testQuatNeg = new THREE.Quaternion().setFromAxisAngle(axisDir, angleNeg);
  const posResult = childCentroid.clone().sub(pivot).applyQuaternion(testQuatPos).add(pivot);
  const negResult = childCentroid.clone().sub(pivot).applyQuaternion(testQuatNeg).add(pivot);
  const distBefore = childCentroid.distanceTo(baseCentroid);
  const distPos = posResult.distanceTo(baseCentroid);
  const distNeg = negResult.distanceTo(baseCentroid);
  return distPos - distBefore >= distNeg - distBefore ? anglePos : angleNeg;
}

// ============ SHEET THICKNESS ============
// Authoritative sheet thickness: the spread of a plate's vertices along its
// skin normal. Measured on a NON-BEND region (the base plate) it is the true
// stock thickness; bend strips are later constrained to exactly this value.
export function measureSheetThickness(
  pos: ArrayLike<number>,
  verts: Iterable<number>,
  normal: THREE.Vector3,
): number {
  let min = Infinity;
  let max = -Infinity;
  for (const vi of verts) {
    const d =
      normal.x * (pos[vi * 3] as number) +
      normal.y * (pos[vi * 3 + 1] as number) +
      normal.z * (pos[vi * 3 + 2] as number);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return max > min ? max - min : 0;
}

// ============ BFS UNFOLD ============
export function unfoldMesh(
  weldedPos: number[],
  faces: Array<[number, number, number]>,
  region: Int32Array,
  regionCount: number,
  graph: BendGraph,
): Float64Array {
  const { folds, groupOf, groupCount, regNormal, anchorOf, isLarge } = graph;

  // Working copy of vertex positions — the source array is never touched.
  const work = Float64Array.from(weldedPos);
  const V = (i: number) =>
    new THREE.Vector3(work[i * 3], work[i * 3 + 1], work[i * 3 + 2]);
  const setV = (i: number, p: THREE.Vector3) => {
    work[i * 3] = p.x;
    work[i * 3 + 1] = p.y;
    work[i * 3 + 2] = p.z;
  };
  const vNow = V; // hinge axis fit reads current (working) positions

  // Region -> vertex set
  const regVerts: Array<Set<number>> = Array.from(
    { length: regionCount },
    () => new Set<number>(),
  );
  faces.forEach((f, fi) => {
    const r = region[fi];
    for (const vi of f) regVerts[r].add(vi);
  });

  // Plate group -> member regions (large skins + anchored smalls)
  const groupRegions: number[][] = Array.from({ length: groupCount }, () => []);
  const groupFaces = new Array<number>(groupCount).fill(0);
  for (let r = 0; r < regionCount; r++) {
    const g = isLarge[r] ? groupOf[r] : anchorOf[r] !== -1 ? groupOf[anchorOf[r]] : -1;
    if (g === -1) continue;
    groupRegions[g].push(r);
    if (isLarge[r]) groupFaces[g] += regVerts[r].size;
  }

  // Base = plate group with the most geometry
  let base = 0;
  for (let g = 1; g < groupCount; g++) if (groupFaces[g] > groupFaces[base]) base = g;

  // Base plate skin normal — largest skin wins (the two skins of a solid
  // plate have opposite normals, so a sum would cancel). The base never
  // moves during the BFS, so this is valid before and after unfolding.
  const nBase = new THREE.Vector3();
  let nBaseSize = -1;
  for (const r of groupRegions[base]) {
    if (isLarge[r] && regVerts[r].size > nBaseSize) {
      nBaseSize = regVerts[r].size;
      nBase.copy(regNormal[r]);
    }
  }
  if (nBase.lengthSq() < 1e-10) nBase.set(0, 1, 0);
  nBase.normalize();

  // Shared 2D basis of the base plane — the flat sheet's plane before grid
  // placement. Used by the gusset unroll and the global overlap resolver.
  const planeE1 = new THREE.Vector3(1, 0, 0);
  if (Math.abs(nBase.dot(planeE1)) > 0.9) planeE1.set(0, 0, 1);
  planeE1.sub(nBase.clone().multiplyScalar(planeE1.dot(nBase))).normalize();
  const planeE2 = new THREE.Vector3().crossVectors(nBase, planeE1);

  // True stock thickness, measured ONCE before any unfolding from the base
  // plate — a region that is not a bend. Bend strips are constrained to
  // exactly this value after the unfold.
  const sheetThickness = measureSheetThickness(
    work,
    groupRegions[base].flatMap((r) => [...regVerts[r]]),
    nBase,
  );

  // BFS over folds
  const visited = new Set<number>([base]);
  const order: number[] = [];
  const foldOf = new Map<number, { fold: SheetFold; parent: number }>();
  const bfsDepth = new Map<number, number>([[base, 0]]);
  let frontier = [base];
  while (frontier.length) {
    const next: number[] = [];
    for (const g of frontier) {
      for (const fo of folds) {
        const other = fo.gA === g ? fo.gB : fo.gB === g ? fo.gA : null;
        if (other === null || visited.has(other)) continue;
        visited.add(other);
        foldOf.set(other, { fold: fo, parent: g });
        bfsDepth.set(other, (bfsDepth.get(g) ?? 0) + 1);
        order.push(other);
        next.push(other);
      }
    }
    frontier = next;
  }

  const children = new Map<number, number[]>();
  for (const [g, info] of foldOf) {
    let list = children.get(info.parent);
    if (!list) {
      list = [];
      children.set(info.parent, list);
    }
    list.push(g);
  }
  const collectDescendants = (g: number, out: Set<number>) => {
    out.add(g);
    for (const c of children.get(g) ?? []) collectDescendants(c, out);
  };

  // Everything that swings with plate group g: the group itself, all BFS
  // descendants, their anchored small regions, and the bend strips of every
  // fold on the moving side. Shared between the BFS unfold loop and the
  // global overlap resolver (which re-rotates the same set when flipping).
  const movedRegionSetFor = (g: number): Set<number> => {
    const movedGroups = new Set<number>();
    collectDescendants(g, movedGroups);
    // Cycle groups (gussets) are re-flattened from scratch by the unroll —
    // dragging their regions along here would move verts they share with a
    // SIBLING anchor's hinge row and poison that anchor's axis fit. Their
    // verts welded into this group's own skins still travel via those
    // regions' vertex sets.
    for (const mg of [...movedGroups]) {
      if (mg !== g && cycleGroups.has(mg)) movedGroups.delete(mg);
    }
    const regions = new Set<number>();
    for (const mg of movedGroups) {
      for (const r of groupRegions[mg]) regions.add(r);
    }
    for (const f of folds) {
      if (movedGroups.has(f.gA) || movedGroups.has(f.gB)) {
        for (const s of f.strip) regions.add(s);
      }
    }
    return regions;
  };

  // Cycle regions (gussets / diagonal braces): a fold NOT used as a BFS tree
  // edge connects two groups that are both already positioned — the deeper
  // endpoint is anchored to two independent plates at once. Rigid rotation
  // about a single hinge cannot satisfy both anchors, so these groups are
  // excluded from the BFS rotation loop and flattened afterwards with a
  // triangle-based unroll (true 3D edge lengths, law of cosines).
  const treeFolds = new Set<SheetFold>();
  for (const info of foldOf.values()) treeFolds.add(info.fold);
  const cycleGroups = new Set<number>();
  for (const f of folds) {
    if (treeFolds.has(f)) continue;
    if (!visited.has(f.gA) || !visited.has(f.gB)) continue;
    const dA = bfsDepth.get(f.gA) ?? 0;
    const dB = bfsDepth.get(f.gB) ?? 0;
    const cand = dA >= dB ? f.gA : f.gB;
    if (cand === base) continue;
    if ((children.get(cand) ?? []).length > 0) {
      console.warn(
        "[SM-CYCLE] group",
        cand,
        "closes a cycle but carries a subtree — keeping rigid rotation",
      );
      continue;
    }
    cycleGroups.add(cand);
  }
  console.log(
    "[SM-CYCLE]",
    cycleGroups.size,
    "gusset/cycle regions found:",
    [...cycleGroups].join(", ") || "-",
  );

  const centroidOfVerts = (verts: Iterable<number>): THREE.Vector3 => {
    const c = new THREE.Vector3();
    let n = 0;
    for (const vi of verts) {
      c.add(V(vi));
      n++;
    }
    if (n > 0) c.divideScalar(n);
    return c;
  };

  // One hinge rotation: fit the axis from the given boundary edges (at the
  // CURRENT vertex positions), rotate everything in movedRegions so that
  // curRegion's normal maps onto prevRegion's, picking the rotation branch
  // that swings the moved geometry AWAY from the parent plate (automatic
  // sign correction — the wrong branch folds it underneath).
  type AppliedHinge = { angle: number; pivot: THREE.Vector3; axisDir: THREE.Vector3 };
  const applyHinge = (
    hingeEdges: Array<[number, number]>,
    prevRegion: number,
    curRegion: number,
    movedRegions: Set<number>,
    parentCentroid: THREE.Vector3,
    probeVerts: number[],
  ): AppliedHinge | null => {
    const axis = longestAxisFromEdges(hingeEdges, vNow);
    if (!axis) return null;
    const axisDir = axis.axisB.clone().sub(axis.axisA).normalize();
    if (axisDir.lengthSq() < 1e-12) return null;
    const pivot = axis.axisA;

    const nP = regNormal[prevRegion].clone().projectOnPlane(axisDir);
    const nC = regNormal[curRegion].clone().projectOnPlane(axisDir);
    if (nP.lengthSq() < 1e-10 || nC.lengthSq() < 1e-10) return null;
    nP.normalize();
    nC.normalize();
    const signed = Math.atan2(nC.clone().cross(nP).dot(axisDir), nC.dot(nP));
    if (Math.abs(signed) < MIN_FOLD_RAD) return null; // already nearly flat

    const movedVerts = new Set<number>();
    for (const r of movedRegions) for (const vi of regVerts[r]) movedVerts.add(vi);

    // Branch pick is probed on the IMMEDIATE child plate's centroid only —
    // BFS descendants and bend strips in the moved set would bias the
    // distance measurement (a tab folded back over the base can drag the
    // combined centroid to the wrong side of the hinge).
    const childCentroid = centroidOfVerts(probeVerts);
    const alt = signed - Math.sign(signed) * Math.PI;
    const chosen = resolveRotationSign(
      pivot,
      axisDir,
      signed,
      alt,
      childCentroid,
      parentCentroid,
    );

    const q = new THREE.Quaternion().setFromAxisAngle(axisDir, chosen);
    for (const vi of movedVerts) {
      const p = V(vi).sub(pivot).applyQuaternion(q).add(pivot);
      setV(vi, p);
    }
    // Keep stored region normals in sync for downstream hinges
    for (const r of movedRegions) regNormal[r].applyQuaternion(q);
    return { angle: chosen, pivot: pivot.clone(), axisDir: axisDir.clone() };
  };

  // Parent-side hinge each group was rotated about — the overlap resolver
  // flips a wrongly-branched group by exactly π about this axis. Both pivot
  // and axis sit on the fixed parent side, so they stay valid afterwards.
  const groupHinge = new Map<number, { pivot: THREE.Vector3; axisDir: THREE.Vector3 }>();

  // Unfold each plate group in BFS order (cycle groups ride with their tree
  // parent here and are shape-preserving-unrolled afterwards instead)
  for (const g of order) {
    if (cycleGroups.has(g)) continue;
    const { fold, parent } = foldOf.get(g)!;
    const childOnA = groupOf[fold.rA] === g;
    // Parent-side / child-side representative skins
    const rP = childOnA ? fold.rB : fold.rA;
    const rC = childOnA ? fold.rA : fold.rB;

    // Everything that swings with this bend: the child plate group, all of
    // its BFS descendants, their anchored small regions, and the bend strips
    // of every fold on the moving side (both skins' arcs of this bend).
    const childRegions = movedRegionSetFor(g);

    const parentCentroid = centroidOfVerts(
      groupRegions[parent].flatMap((r) => [...regVerts[r]]),
    );
    // Immediate child plate only — the empirical sign probe (descendants
    // and strips excluded on purpose).
    const probeVerts = groupRegions[g].flatMap((r) => [...regVerts[r]]);

    if (fold.chainMembers && fold.chainBoundaries) {
      // Developed bend: walk the arc's facet rows from the parent side,
      // rotating everything downstream at each row boundary. This lays the
      // arc itself out flat (true developed length) instead of leaving a
      // curved ridge at the bend line.
      const memberSeq = childOnA
        ? fold.chainMembers.slice().reverse()
        : fold.chainMembers.slice();
      const hingeSeq = childOnA
        ? fold.chainBoundaries.slice().reverse()
        : fold.chainBoundaries.slice();

      let prevRegion = rP;
      let applied = 0;
      for (let j = 0; j <= memberSeq.length; j++) {
        const curRegion = j < memberSeq.length ? memberSeq[j] : rC;
        const movedRegions = new Set(childRegions);
        // Rows already laid flat stay with the parent side
        for (let k = 0; k < j; k++) movedRegions.delete(memberSeq[k]);
        const applied1 = applyHinge(
          hingeSeq[j],
          prevRegion,
          curRegion,
          movedRegions,
          parentCentroid,
          probeVerts,
        );
        if (applied1 !== null) {
          applied++;
          // The FIRST row hinge lies on the fixed parent side — the axis a
          // branch flip must mirror the whole developed bend + child about.
          if (!groupHinge.has(g)) {
            groupHinge.set(g, { pivot: applied1.pivot, axisDir: applied1.axisDir });
          }
        }
        prevRegion = curRegion;
      }
      console.log(
        "[SM-FOLD] group",
        g,
        "developed through",
        memberSeq.length,
        "bend rows (",
        applied,
        "hinge rotations )",
      );
    } else {
      // Rigid fold: single rotation about the parent-side hinge
      const parentEdges = childOnA ? fold.edgesB ?? fold.edgesA : fold.edgesA;
      const applied1 = applyHinge(
        parentEdges,
        rP,
        rC,
        childRegions,
        parentCentroid,
        probeVerts,
      );
      if (applied1 !== null) {
        groupHinge.set(g, { pivot: applied1.pivot, axisDir: applied1.axisDir });
        console.log(
          "[SM-FOLD] group",
          g,
          "rotated rigidly",
          Math.round((applied1.angle * 180) / Math.PI) + "°",
        );
      }
    }
  }

  // Report plates the BFS could not reach — they stay folded.
  for (let g = 0; g < groupCount; g++) {
    if (!visited.has(g)) {
      console.warn("[SM-UNFOLD] plate group", g, "is not connected by any fold — left as-is");
    }
  }

  // ============ GUSSET / CYCLE-REGION UNROLL ============
  for (const g of cycleGroups) unrollGussetGroup(g);

  function unrollGussetGroup(g: number): void {
    const { fold, parent } = foldOf.get(g)!;
    const childOnA = groupOf[fold.rA] === g;
    const parentEdges = childOnA ? fold.edgesB ?? fold.edgesA : fold.edgesA;

    const orig = (i: number) =>
      new THREE.Vector3(weldedPos[i * 3], weldedPos[i * 3 + 1], weldedPos[i * 3 + 2]);
    const proj = (p: THREE.Vector3): [number, number] => [
      p.dot(planeE1),
      p.dot(planeE2),
    ];

    // Seed: hinge verts shared with the already-flat tree anchor. The
    // dominant skin to unroll is the gusset region that actually owns those
    // seed verts (a solid gusset's opposite skin doesn't touch the hinge).
    const seedVerts = new Set<number>();
    for (const [a, b] of parentEdges) {
      seedVerts.add(a);
      seedVerts.add(b);
    }
    let domRegion = -1;
    let domSeeds = -1;
    for (const r of groupRegions[g]) {
      if (!isLarge[r]) continue;
      let s = 0;
      for (const vi of seedVerts) if (regVerts[r].has(vi)) s++;
      if (s > domSeeds || (s === domSeeds && domRegion !== -1 && regVerts[r].size > regVerts[domRegion].size)) {
        domSeeds = s;
        domRegion = r;
      }
    }
    if (domRegion === -1 || domSeeds < 2) {
      console.warn("[SM-CYCLE] group", g, "has no unrollable skin at its anchor hinge — left as positioned");
      return;
    }

    const placed = new Map<number, [number, number]>();
    let h0 = 0;
    {
      let n = 0;
      for (const vi of seedVerts) {
        if (!regVerts[domRegion].has(vi)) continue;
        const p = V(vi);
        placed.set(vi, proj(p));
        h0 += p.dot(nBase);
        n++;
      }
      h0 /= n;
    }

    // Consistent 2D orientation: every triangle keeps its ORIGINAL winding
    // relative to the skin normal, mirrored uniformly by a single flip sign
    // chosen so the gusset extends away from the anchor plate.
    const domFaces: number[] = [];
    faces.forEach((_f, fi) => {
      if (region[fi] === domRegion) domFaces.push(fi);
    });
    const nOrig = new THREE.Vector3();
    for (const fi of domFaces) {
      const f = faces[fi];
      nOrig.add(
        orig(f[1]).sub(orig(f[0])).cross(orig(f[2]).sub(orig(f[0]))),
      );
    }
    nOrig.normalize();
    const triSign3D = (fi: number): number => {
      const f = faces[fi];
      const n = orig(f[1]).sub(orig(f[0])).cross(orig(f[2]).sub(orig(f[0])));
      return n.dot(nOrig) >= 0 ? 1 : -1;
    };

    const parentC2 = proj(
      centroidOfVerts(groupRegions[parent].flatMap((r) => [...regVerts[r]])),
    );

    const cross2 = (
      ax: number, ay: number, bx: number, by: number, px: number, py: number,
    ) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);

    let globalFlip = 0;
    const queue = domFaces.slice();
    let guard = 0;
    let unrolled = 0;
    while (queue.length && guard++ < domFaces.length * 4) {
      const fi = queue.shift()!;
      const f = faces[fi];
      const known = f.filter((vi) => placed.has(vi));
      if (known.length === 3) continue;
      if (known.length < 2) {
        queue.push(fi);
        continue;
      }
      const [vA, vB] = known;
      const vC = f.find((vi) => !placed.has(vi))!;
      const A2 = placed.get(vA)!;
      const B2 = placed.get(vB)!;
      // True 3D edge lengths — this is what preserves the real shape
      const lenAC = orig(vA).distanceTo(orig(vC));
      const lenBC = orig(vB).distanceTo(orig(vC));
      const d = Math.hypot(B2[0] - A2[0], B2[1] - A2[1]);
      if (d < 1e-9) {
        queue.push(fi);
        continue;
      }
      // Law of cosines / circle-circle intersection about A2 and B2
      const along = (lenAC * lenAC - lenBC * lenBC + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, lenAC * lenAC - along * along));
      const ux = (B2[0] - A2[0]) / d;
      const uy = (B2[1] - A2[1]) / d;
      const bx = A2[0] + along * ux;
      const by = A2[1] + along * uy;
      const candidate = (s: number): [number, number] =>
        [bx + s * h * -uy, by + s * h * ux];
      const areaSign = (c: [number, number]): number => {
        const P = (vi: number): [number, number] =>
          vi === vC ? c : placed.get(vi)!;
        const p0 = P(f[0]);
        const p1 = P(f[1]);
        const p2 = P(f[2]);
        return Math.sign(
          (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]),
        );
      };
      let chosen: [number, number];
      if (globalFlip === 0) {
        // First triangle: build outward, on the opposite side of the seed
        // edge from the anchor plate
        const sideParent = Math.sign(
          cross2(A2[0], A2[1], B2[0], B2[1], parentC2[0], parentC2[1]),
        );
        const cPlus = candidate(1);
        const sidePlus = Math.sign(
          cross2(A2[0], A2[1], B2[0], B2[1], cPlus[0], cPlus[1]),
        );
        chosen =
          sideParent === 0 || (sidePlus !== 0 && sidePlus === -sideParent)
            ? cPlus
            : candidate(-1);
        globalFlip = (areaSign(chosen) || 1) * triSign3D(fi);
      } else {
        const desired = triSign3D(fi) * globalFlip;
        const cPlus = candidate(1);
        chosen = (areaSign(cPlus) || desired) === desired ? cPlus : candidate(-1);
      }
      placed.set(vC, chosen);
      unrolled++;
    }

    // Write the unrolled skin back, lying on the sheet level of its seeds
    for (const [vi, [u, w]] of placed) {
      setV(
        vi,
        planeE1
          .clone()
          .multiplyScalar(u)
          .add(planeE2.clone().multiplyScalar(w))
          .add(nBase.clone().multiplyScalar(h0)),
      );
    }

    // Remaining group verts (opposite skin, perimeter walls, this group's
    // bend strips — including the seam verts the sibling anchor's rotation
    // double-dragged) follow their nearest unrolled neighbour; the thickness
    // pass then restores the two skin levels.
    const overwrite = new Set<number>();
    for (const r of groupRegions[g]) for (const vi of regVerts[r]) overwrite.add(vi);
    for (const f2 of folds) {
      if (f2.gA === g || f2.gB === g) {
        for (const s of f2.strip) for (const vi of regVerts[s]) overwrite.add(vi);
      }
    }
    const parentVerts = new Set<number>();
    for (const r of groupRegions[parent]) {
      if (isLarge[r]) for (const vi of regVerts[r]) parentVerts.add(vi);
    }
    const placedList = [...placed.keys()];
    let mapped = 0;
    for (const vi of overwrite) {
      if (placed.has(vi) || parentVerts.has(vi)) continue;
      let bestVi = -1;
      let bestD = Infinity;
      const p0 = orig(vi);
      for (const pv of placedList) {
        const dd = p0.distanceToSquared(orig(pv));
        if (dd < bestD) {
          bestD = dd;
          bestVi = pv;
        }
      }
      if (bestVi === -1) continue;
      setV(vi, V(bestVi));
      mapped++;
    }
    console.log(
      "[SM-CYCLE] unrolled group",
      g,
      "|",
      unrolled,
      "triangles placed,",
      mapped,
      "companion verts mapped",
    );
  }

  // ============ GLOBAL OVERLAP RESOLUTION ============
  // The empirical rotation-branch probe only measures distance from the
  // immediate parent — a flap hinged on the edge of a cutout (correct branch
  // folds TOWARD the part centroid, into the window) or deep BFS chains can
  // still pick the branch that lands on top of other plates. Check the fully
  // assembled layout in the base-plane projection and flip the wrongly
  // branched group by exactly π about its own recorded hinge (the two
  // branches differ by exactly π, so this reproduces the alternate branch
  // without re-running the unfold).
  detectAndResolveOverlaps();

  function detectAndResolveOverlaps(): void {
    const proj = (vi: number): [number, number] => {
      const p = V(vi);
      return [p.dot(planeE1), p.dot(planeE2)];
    };

    const largeVertsOf = (g: number): number[] => {
      const out: number[] = [];
      for (const r of groupRegions[g]) {
        if (isLarge[r]) for (const vi of regVerts[r]) out.push(vi);
      }
      return out;
    };

    type BBox2 = { minU: number; maxU: number; minV: number; maxV: number };
    const bboxOf = (g: number): BBox2 | null => {
      const verts = largeVertsOf(g);
      if (verts.length === 0) return null;
      const box = { minU: Infinity, maxU: -Infinity, minV: Infinity, maxV: -Infinity };
      for (const vi of verts) {
        const [u, w] = proj(vi);
        box.minU = Math.min(box.minU, u);
        box.maxU = Math.max(box.maxU, u);
        box.minV = Math.min(box.minV, w);
        box.maxV = Math.max(box.maxV, w);
      }
      return box;
    };
    const boxesOverlap = (a: BBox2, b: BBox2, tol: number): boolean =>
      Math.min(a.maxU, b.maxU) - Math.max(a.minU, b.minU) > tol &&
      Math.min(a.maxV, b.maxV) - Math.max(a.minV, b.minV) > tol;

    const facesOfRegion: number[][] = Array.from({ length: regionCount }, () => []);
    faces.forEach((_f, fi) => facesOfRegion[region[fi]].push(fi));
    const largeFacesOf = (g: number): number[] => {
      const out: number[] = [];
      for (const r of groupRegions[g]) {
        if (isLarge[r]) out.push(...facesOfRegion[r]);
      }
      return out;
    };

    // Depth of a point inside a 2D triangle: min distance to the three
    // edges when inside, -1 when outside. Depth > margin means genuine
    // material overlap rather than hinge-line / seam contact.
    const depthInTriangle = (
      pu: number, pv: number,
      a: [number, number], b: [number, number], c: [number, number],
    ): number => {
      const cross = (
        ox: number, oy: number, x1: number, y1: number, x2: number, y2: number,
      ) => (x1 - ox) * (y2 - oy) - (y1 - oy) * (x2 - ox);
      const dAB = cross(a[0], a[1], b[0], b[1], pu, pv);
      const dBC = cross(b[0], b[1], c[0], c[1], pu, pv);
      const dCA = cross(c[0], c[1], a[0], a[1], pu, pv);
      const sameSign =
        (dAB >= 0 && dBC >= 0 && dCA >= 0) || (dAB <= 0 && dBC <= 0 && dCA <= 0);
      if (!sameSign) return -1;
      const len = (p: [number, number], q: [number, number]) =>
        Math.hypot(q[0] - p[0], q[1] - p[1]) || 1e-12;
      return Math.min(
        Math.abs(dAB) / len(a, b),
        Math.abs(dBC) / len(b, c),
        Math.abs(dCA) / len(c, a),
      );
    };

    // Do gA's face centroids sit deeper than `margin` inside gB's triangles
    // (or vice versa)? Centroids, not vertices: tessellation grids of two
    // plates routinely align, putting every vertex exactly ON the other
    // plate's triangle edges (depth 0). Two independent hits = real overlap.
    const MAX_PROBES = 600;
    const deepOverlap = (gA: number, gB: number, margin: number): boolean => {
      let hits = 0;
      const oneWay = (from: number, into: number): boolean => {
        const probeFaces = largeFacesOf(from);
        const stride = Math.max(1, Math.floor(probeFaces.length / MAX_PROBES));
        const tris = largeFacesOf(into).map((fi) => {
          const f = faces[fi];
          return [proj(f[0]), proj(f[1]), proj(f[2])] as const;
        });
        for (let i = 0; i < probeFaces.length; i += stride) {
          const f = faces[probeFaces[i]];
          const pa = proj(f[0]);
          const pb = proj(f[1]);
          const pc = proj(f[2]);
          const u = (pa[0] + pb[0] + pc[0]) / 3;
          const w = (pa[1] + pb[1] + pc[1]) / 3;
          for (const [a, b, c] of tris) {
            if (depthInTriangle(u, w, a, b, c) > margin) {
              if (++hits >= 2) return true;
              break;
            }
          }
        }
        return false;
      };
      return oneWay(gA, gB) || oneWay(gB, gA);
    };

    const connectedPairs = new Set<string>();
    for (const f of folds) {
      connectedPairs.add(Math.min(f.gA, f.gB) + "_" + Math.max(f.gA, f.gB));
    }

    const findOverlaps = (): Array<[number, number]> => {
      const boxes: Array<BBox2 | null> = [];
      for (let g = 0; g < groupCount; g++) boxes.push(bboxOf(g));
      const out: Array<[number, number]> = [];
      for (let a = 0; a < groupCount; a++) {
        if (!boxes[a]) continue;
        for (let b = a + 1; b < groupCount; b++) {
          if (!boxes[b]) continue;
          // Fold-connected groups legitimately touch along their hinge and,
          // on solid sheets, interpenetrate up to corner-material scale at
          // the bend line — those need a coarser margin, not an exemption
          // (a flap folded back over its own parent IS the failure mode).
          const margin = connectedPairs.has(a + "_" + b)
            ? Math.max(1, 1.5 * sheetThickness)
            : 0.5;
          if (!boxesOverlap(boxes[a]!, boxes[b]!, margin)) continue;
          if (deepOverlap(a, b, margin)) out.push([a, b]);
        }
      }
      return out;
    };

    const flipGroup = (g: number): boolean => {
      const hinge = groupHinge.get(g);
      if (!hinge) {
        console.warn("[SM-OVERLAP] group", g, "has no recorded hinge — cannot flip");
        return false;
      }
      const q = new THREE.Quaternion().setFromAxisAngle(hinge.axisDir, Math.PI);
      const movedRegions = movedRegionSetFor(g);
      const movedVerts = new Set<number>();
      for (const r of movedRegions) for (const vi of regVerts[r]) movedVerts.add(vi);
      for (const vi of movedVerts) {
        setV(vi, V(vi).sub(hinge.pivot).applyQuaternion(q).add(hinge.pivot));
      }
      for (const r of movedRegions) regNormal[r].applyQuaternion(q);
      // Keep descendants' recorded hinges valid in case they flip later too
      const movedGroups = new Set<number>();
      collectDescendants(g, movedGroups);
      for (const mg of movedGroups) {
        if (mg === g) continue;
        const h = groupHinge.get(mg);
        if (h) {
          h.pivot.sub(hinge.pivot).applyQuaternion(q).add(hinge.pivot);
          h.axisDir.applyQuaternion(q);
        }
      }
      return true;
    };

    let pairs = findOverlaps();
    console.log(
      "[SM-OVERLAP]",
      pairs.length,
      "overlapping region pairs found:",
      JSON.stringify(pairs),
    );
    for (let pass = 0; pass < 2 && pairs.length > 0; pass++) {
      const flippedThisPass = new Set<number>();
      let flippedAny = false;
      for (const [a, b] of pairs) {
        // The later-BFS group is the one that was positioned wrong
        const da = bfsDepth.get(a) ?? 0;
        const db = bfsDepth.get(b) ?? 0;
        const target = da > db ? a : db > da ? b : groupHinge.has(a) ? a : b;
        if (flippedThisPass.has(target)) continue;
        flippedThisPass.add(target);
        if (flipGroup(target)) flippedAny = true;
      }
      if (!flippedAny) break;
      pairs = findOverlaps();
      console.log(
        "[SM-OVERLAP] after correction pass",
        pass + 1,
        ":",
        pairs.length,
        "overlapping pairs",
      );
    }
    if (pairs.length > 0) {
      console.warn(
        "[SM-OVERLAP] unresolved overlaps between plate groups:",
        JSON.stringify(pairs),
      );
    }
  }

  // Place on grid: rotate the flat sheet so the base plate's normal points
  // +Y, drop it onto Y=0 and center it in XZ — like a sheet on a laser bed.
  const up = new THREE.Vector3(0, 1, 0);
  const qUp = new THREE.Quaternion().setFromUnitVectors(nBase, up);

  const vertCount = work.length / 3;
  for (let i = 0; i < vertCount; i++) {
    setV(i, V(i).applyQuaternion(qUp));
  }

  normalizeAllRegionThickness();

  // Drop onto Y=0 and center in XZ (after the thickness pass, so strips a
  // carried arc dragged below the sheet no longer define the bed level).
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < vertCount; i++) {
    minX = Math.min(minX, work[i * 3]);
    maxX = Math.max(maxX, work[i * 3]);
    minY = Math.min(minY, work[i * 3 + 1]);
    minZ = Math.min(minZ, work[i * 3 + 2]);
    maxZ = Math.max(maxZ, work[i * 3 + 2]);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  for (let i = 0; i < vertCount; i++) {
    work[i * 3] -= cx;
    work[i * 3 + 1] -= minY;
    work[i * 3 + 2] -= cz;
  }

  // Region-wide thickness normalization. The v14 pass only snapped bend-strip
  // vertices, so any plate that flattened one hinge-offset up (the hinge sits
  // at a skin, not the mid-plane) or a transition zone merged into a plate
  // kept a wrong thickness. With the sheet lying flat (base normal = +Y) the
  // finished blank has exactly two Y levels one sheet thickness apart, taken
  // from the MEDIAN y of the base skins (min/max would lie when a carried arc
  // drags shared hinge verts). Every plate GROUP — this engine's unit for one
  // physical plate, both skins plus its anchored small regions — is split
  // into its top/bottom surface along the local mean and forced onto those
  // two levels; the level assignment is picked to move verts already
  // committed by earlier (parent) groups the least, so welded seams stay
  // put. Fold-strip verts snap per-vertex to the nearer level, as before.
  // Vertices far outside the slab are left alone — a fold that failed to
  // flatten must stay visible to the caller's flatness guard, not be masked.
  function normalizeAllRegionThickness(): void {
    if (sheetThickness <= 0.05) return; // zero-thickness shell — nothing to do
    let baseLo = Infinity;
    for (const r of groupRegions[base]) {
      if (!isLarge[r]) continue;
      const ys = [...regVerts[r]].map((vi) => work[vi * 3 + 1]).sort((a, b) => a - b);
      if (ys.length === 0) continue;
      baseLo = Math.min(baseLo, ys[ys.length >> 1]);
    }
    if (!Number.isFinite(baseLo)) return;
    const baseHi = baseLo + sheetThickness;
    const bandLo = baseLo - 1.5 * sheetThickness;
    const bandHi = baseHi + 1.5 * sheetThickness;
    const nearerLevel = (y: number) =>
      y - baseLo < sheetThickness / 2 ? baseLo : baseHi;

    const committed = new Set<number>();
    let snapped = 0;
    let maxDrift = 0;
    const snapTo = (vi: number, level: number) => {
      maxDrift = Math.max(maxDrift, Math.abs(work[vi * 3 + 1] - level));
      work[vi * 3 + 1] = level;
      committed.add(vi);
      snapped++;
    };

    // Base first, then BFS order — parents commit the welded seam verts
    // their children key their level assignment on.
    for (const g of [base, ...order]) {
      const vertSet = new Set<number>();
      for (const r of groupRegions[g]) for (const vi of regVerts[r]) vertSet.add(vi);
      const inBand: number[] = [];
      let lo = Infinity;
      let hi = -Infinity;
      let sum = 0;
      for (const vi of vertSet) {
        const y = work[vi * 3 + 1];
        if (y < bandLo || y > bandHi) continue;
        inBand.push(vi);
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
        sum += y;
      }
      if (inBand.length === 0) continue;

      if (hi - lo < sheetThickness / 2) {
        // Single-surface group — snap each vert to the nearer skin level
        for (const vi of inBand) snapTo(vi, nearerLevel(work[vi * 3 + 1]));
        continue;
      }

      // Two-surface group: either the local bottom is the blank's bottom
      // skin (mapping A) or the group flattened one hinge-offset up/down and
      // its local bottom is really the top skin (mapping B). Choose by the
      // movement of already-committed seam verts; when no seam is committed
      // (or it ties), by total movement.
      const mean = sum / inBand.length;
      const targetA = (y: number) => (y < mean ? baseLo : baseHi);
      const targetB = (y: number) => (y < mean ? baseHi : baseLo);
      let seamCostA = 0;
      let seamCostB = 0;
      let totalCostA = 0;
      let totalCostB = 0;
      let seamCount = 0;
      for (const vi of inBand) {
        const y = work[vi * 3 + 1];
        totalCostA += Math.abs(y - targetA(y));
        totalCostB += Math.abs(y - targetB(y));
        if (committed.has(vi)) {
          seamCount++;
          seamCostA += Math.abs(y - targetA(y));
          seamCostB += Math.abs(y - targetB(y));
        }
      }
      const useB =
        seamCount > 0 && Math.abs(seamCostA - seamCostB) > 1e-9
          ? seamCostB < seamCostA
          : totalCostB < totalCostA - 1e-9;
      const target = useB ? targetB : targetA;
      for (const vi of inBand) snapTo(vi, target(work[vi * 3 + 1]));
    }

    // Bend-strip vertices accumulate drift during row-by-row development;
    // snap the leftovers per-vertex onto the nearer skin level.
    for (const f of folds) {
      for (const s of f.strip) {
        for (const vi of regVerts[s]) {
          if (committed.has(vi)) continue;
          const y = work[vi * 3 + 1];
          if (y < bandLo || y > bandHi) continue;
          snapTo(vi, nearerLevel(y));
        }
      }
    }
    console.log(
      "[SM-THICKNESS] normalized",
      groupCount,
      "plate groups to",
      sheetThickness.toFixed(3) + "mm |",
      snapped,
      "verts snapped | max drift",
      maxDrift.toFixed(3) + "mm",
    );
  }

  console.log(
    "[SM-UNFOLD] done. Flat size:",
    Math.round(maxX - minX),
    "x",
    Math.round(maxZ - minZ),
  );
  return work;
}

// ============ APPLY BACK TO RENDER MESH ============
export function applyToMesh(
  mesh: THREE.Mesh,
  remap: Int32Array,
  flatWelded: Float64Array,
): void {
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const w = remap[i];
    pos.setXYZ(i, flatWelded[w * 3], flatWelded[w * 3 + 1], flatWelded[w * 3 + 2]);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

export function restoreMesh(
  mesh: THREE.Mesh,
  savedOriginal: ArrayLike<number>,
): void {
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  (pos.array as Float32Array).set(savedOriginal as ArrayLike<number> & { length: number });
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

// ============ FULL PIPELINE ============
export type UnfoldGeometryResult = {
  flatGeometry: THREE.BufferGeometry;
  flatWidth: number;
  flatLength: number;
  foldCount: number;
};

/**
 * Unfold a sheet-metal render geometry into a flat sheet.
 *
 * Returns a NEW BufferGeometry (same vertex/index layout as the input, so
 * the caller's original stays byte-identical for exact refold), or null when
 * no folds are detected.
 */
export function unfoldGeometry(
  geometry: THREE.BufferGeometry,
): UnfoldGeometryResult | null {
  const { weldedPos, faces, remap } = weldMesh(geometry);
  if (faces.length === 0) return null;

  const { normals, edgeMap, v } = buildTopology(weldedPos, faces);
  const { region, regionCount, sizes } = segmentRegions(faces, normals, edgeMap);

  // Attempt at the default strip scale first; thick-plate parts (5mm+
  // material) need a coarser scale. Each attempt must actually END UP FLAT —
  // a result thicker than sheet scale means the plate/strip classification
  // misread this part, and showing it would be garbage.
  let flatWelded: Float64Array | null = null;
  let foldCount = 0;
  let sawFolds = false;
  for (const stripWidth of [STRIP_MAX_WIDTH_MM, STRIP_MAX_WIDTH_MM * 3]) {
    const graph = buildBendGraph(
      faces,
      normals,
      edgeMap,
      region,
      regionCount,
      sizes,
      v,
      stripWidth,
    );
    if (graph.folds.length === 0) continue;
    sawFolds = true;
    const attempt = unfoldMesh(weldedPos, faces, region, regionCount, graph);
    let maxY = -Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    let minX = Infinity;
    let minZ = Infinity;
    for (let i = 0; i < attempt.length / 3; i++) {
      maxX = Math.max(maxX, attempt[i * 3]);
      minX = Math.min(minX, attempt[i * 3]);
      maxY = Math.max(maxY, attempt[i * 3 + 1]);
      maxZ = Math.max(maxZ, attempt[i * 3 + 2]);
      minZ = Math.min(minZ, attempt[i * 3 + 2]);
    }
    const stackLimit = Math.max(12, 0.08 * Math.max(maxX - minX, maxZ - minZ));
    if (maxY <= stackLimit) {
      flatWelded = attempt;
      foldCount = graph.folds.length;
      break;
    }
    console.warn(
      "[SM-UNFOLD] result not flat (stack",
      maxY.toFixed(1),
      "> limit",
      stackLimit.toFixed(1),
      ") at strip scale",
      stripWidth,
      "— discarding attempt",
    );
  }
  if (!flatWelded) {
    console.warn(
      sawFolds
        ? "[SM] Unfold did not converge to a flat sheet — refusing to show a bad result."
        : "[SM] No folds detected — cannot unfold this part.",
    );
    return null;
  }

  const flatGeometry = geometry.clone();
  const pos = flatGeometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const w = remap[i];
    pos.setXYZ(i, flatWelded[w * 3], flatWelded[w * 3 + 1], flatWelded[w * 3 + 2]);
  }
  pos.needsUpdate = true;
  flatGeometry.computeVertexNormals();
  flatGeometry.computeBoundingBox();
  flatGeometry.computeBoundingSphere();

  const bb = flatGeometry.boundingBox!;
  return {
    flatGeometry,
    flatWidth: bb.max.x - bb.min.x,
    flatLength: bb.max.z - bb.min.z,
    foldCount,
  };
}
