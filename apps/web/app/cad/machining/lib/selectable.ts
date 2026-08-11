import type {
  AnyMachiningFeature,
  EdgeEntity,
  FaceDetail,
  MachiningAnalysisResponse,
} from "@/types/machining-analysis";

import {
  BOX_EDGES,
  boxCorners,
  circlePoints,
  distance,
  normalize,
  scaleVec,
  add,
  type Vec3,
} from "./model-transform";
import { featureSummary, humanize } from "./format";

/**
 * One selectable thing in the viewer: a machining feature, a face, an edge or a
 * vertex.
 *
 * Everything the overlay and the panel need is resolved here once, so both read
 * from the same list and selection cannot drift between them. Coordinates stay
 * in CAD space; the overlay applies the viewer transform at draw time.
 */

export type EntityKind = "feature" | "face" | "edge" | "vertex";

export interface SelectableEntity {
  /** Unique across every kind - `HOLE-001`, `face:12`, `edge:5`, `vertex:3`. */
  id: string;
  kind: EntityKind;
  label: string;
  detail: string;
  /** Anchor point in CAD space: where the marker sits and what picking matches. */
  anchor: Vec3;
  /** Polylines in CAD space forming a hollow outline. Closed loops repeat the first point. */
  outline: Vec3[][];
  /** Rough size in mm, used to rank overlapping picks - smallest wins. */
  extent: number;
  /** Key/value rows for the detail panel. */
  properties: Array<[string, string]>;
  /** Feature status, so the panel can flag ambiguity without a second lookup. */
  ambiguous?: boolean;
  reason?: string | null;
}

const N = (value: number | null | undefined, digits = 2): string =>
  value === null || value === undefined ? "—" : value.toFixed(digits).replace(/\.?0+$/, "");

const V = (v: { x: number; y: number; z: number }): string =>
  `${N(v.x, 1)}, ${N(v.y, 1)}, ${N(v.z, 1)}`;

const asVec = (v: { x: number; y: number; z: number }): Vec3 => [v.x, v.y, v.z];

/* ------------------------------------------------------------------ */
/* Outline builders                                                    */
/* ------------------------------------------------------------------ */

/** A hollow cylinder: both rims plus four connecting lines. */
function boreOutline(
  entry: Vec3,
  axis: Vec3,
  radius: number,
  depth: number,
): Vec3[][] {
  const direction = normalize(axis);
  const far = add(entry, scaleVec(direction, -depth));
  const near = circlePoints(entry, direction, radius);
  const farRim = circlePoints(far, direction, radius);

  const loops: Vec3[][] = [close(near), close(farRim)];
  // Four rungs make the depth legible without filling the view with lines.
  for (const index of [0, 12, 24, 36]) {
    if (near[index] && farRim[index]) loops.push([near[index], farRim[index]]);
  }
  return loops;
}

function close(points: Vec3[]): Vec3[] {
  return points.length ? [...points, points[0]] : points;
}

/** Wireframe of an axis-aligned box - used for faces and feature extents. */
function boxOutline(box: Parameters<typeof boxCorners>[0]): Vec3[][] {
  const corners = boxCorners(box);
  return BOX_EDGES.map(([a, b]) => [corners[a], corners[b]]);
}

function boxExtent(box: Parameters<typeof boxCorners>[0]): number {
  return Math.max(
    box.max.x - box.min.x,
    box.max.y - box.min.y,
    box.max.z - box.min.z,
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

function featureOutline(
  feature: AnyMachiningFeature,
  faceBoxes: Map<number, FaceDetail>,
): { outline: Vec3[][]; anchor: Vec3; extent: number } {
  const f = feature as unknown as Record<string, any>;
  const outline: Vec3[][] = [];
  let anchor: Vec3 = [0, 0, 0];
  let extent = 1;

  if (f.position) anchor = asVec(f.position);

  // Bores get an exact analytic outline from their own parameters.
  if (
    (feature.type === "hole" ||
      feature.type === "bore" ||
      feature.type === "internal_cylindrical_feature") &&
    f.position &&
    f.axis
  ) {
    const radius = (f.diameter_mm ?? 0) / 2;
    outline.push(...boreOutline(anchor, asVec(f.axis), radius, f.depth_mm ?? 0));
    extent = Math.max(radius * 2, 1);
  }

  // Everything else is outlined by the bounds of the faces it is made of, which
  // is exact wherever the analysis reported face ids and topology was loaded.
  for (const faceId of feature.face_ids ?? []) {
    const face = faceBoxes.get(faceId);
    if (!face) continue;
    outline.push(...boxOutline(face.bounding_box));
    extent = Math.max(extent, boxExtent(face.bounding_box));
  }

  if (!outline.length && f.position) {
    // No geometry to draw: fall back to a small marker circle so the feature is
    // still locatable rather than silently invisible.
    const size = Math.max(f.width_mm ?? f.diameter_mm ?? 2, 2) / 2;
    outline.push(close(circlePoints(anchor, [0, 0, 1], size)));
    extent = size * 2;
  }

  return { outline, anchor, extent };
}

function featureProperties(feature: AnyMachiningFeature): Array<[string, string]> {
  const f = feature as unknown as Record<string, any>;
  const rows: Array<[string, string]> = [["Type", humanize(feature.type)]];
  if (f.subtype) rows.push(["Subtype", humanize(f.subtype)]);
  for (const [key, label] of [
    ["diameter_mm", "Diameter"],
    ["radius_mm", "Radius"],
    ["depth_mm", "Depth"],
    ["length_mm", "Length"],
    ["width_mm", "Width"],
    ["height_mm", "Height"],
    ["size_mm", "Size"],
    ["angle_deg", "Angle"],
    ["corner_radius_mm", "Corner radius"],
  ] as Array<[string, string]>) {
    if (typeof f[key] === "number") rows.push([label, N(f[key], 3)]);
  }
  if (f.position) rows.push(["Position", V(f.position)]);
  if (f.axis) rows.push(["Axis", V(f.axis)]);
  if (typeof f.through === "boolean") rows.push(["Through", f.through ? "Yes" : "No"]);
  rows.push([
    "Detected by",
    `${humanize(feature.detection.method)} · ${(feature.detection.confidence * 100).toFixed(0)}%`,
  ]);
  if (feature.face_ids?.length) rows.push(["Faces", feature.face_ids.join(", ")]);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export function buildSelectableEntities(
  result: MachiningAnalysisResponse,
  unit: string,
): SelectableEntity[] {
  const entities: SelectableEntity[] = [];
  const topology = result.topology_entities;
  const faceBoxes = new Map<number, FaceDetail>(
    (topology?.faces ?? result.face_details ?? []).map((face) => [face.face_id, face]),
  );

  const features: AnyMachiningFeature[] = [
    ...result.features.holes,
    ...result.features.bores,
    ...result.features.internal_cylindrical_features,
    ...result.features.pockets,
    ...result.features.slots,
    ...result.features.bosses,
    ...result.features.threads,
    ...result.features.fillets,
    ...result.features.chamfers,
  ];

  for (const feature of features) {
    const { outline, anchor, extent } = featureOutline(feature, faceBoxes);
    entities.push({
      id: feature.id,
      kind: "feature",
      label: feature.id,
      detail: featureSummary(feature, unit),
      anchor,
      outline,
      extent,
      properties: featureProperties(feature),
      ambiguous: feature.status === "ambiguous",
      reason: feature.reason,
    });
  }

  for (const face of topology?.faces ?? []) {
    const centroid = face.centroid ?? {
      x: (face.bounding_box.min.x + face.bounding_box.max.x) / 2,
      y: (face.bounding_box.min.y + face.bounding_box.max.y) / 2,
      z: (face.bounding_box.min.z + face.bounding_box.max.z) / 2,
    };
    const properties: Array<[string, string]> = [
      ["Surface", face.surface_type],
      ["Area", `${N(face.area_mm2, 2)} mm²`],
      ["Centroid", V(centroid)],
      ["Edges", String(face.edge_count)],
    ];
    if (face.radius_mm !== null) properties.push(["Radius", N(face.radius_mm, 3)]);
    if (face.normal) properties.push(["Normal", V(face.normal)]);
    if (face.axis) properties.push(["Axis", V(face.axis)]);
    if (face.is_internal !== null) {
      properties.push(["Concavity", face.is_internal ? "Internal" : "External"]);
    }

    entities.push({
      id: `face:${face.face_id}`,
      kind: "face",
      label: `Face ${face.face_id}`,
      detail: `${face.surface_type} · ${N(face.area_mm2, 1)} mm²`,
      anchor: asVec(centroid),
      outline: boxOutline(face.bounding_box),
      extent: boxExtent(face.bounding_box),
      properties,
    });
  }

  for (const edge of topology?.edges ?? []) {
    entities.push({
      id: `edge:${edge.edge_id}`,
      kind: "edge",
      label: `Edge ${edge.edge_id}`,
      detail: `${edge.curve_type} · ${N(edge.length_mm, 2)} mm${edge.is_seam ? " · seam" : ""}`,
      anchor: asVec(edge.midpoint),
      outline: edgeOutline(edge),
      extent: Math.max(edge.length_mm, 1),
      properties: [
        ["Curve", edge.curve_type],
        ["Length", `${N(edge.length_mm, 3)} mm`],
        ["Start", V(edge.start)],
        ["End", V(edge.end)],
        ...(edge.radius_mm !== null
          ? ([["Radius", N(edge.radius_mm, 3)]] as Array<[string, string]>)
          : []),
        ["Faces", edge.face_ids.join(", ") || "—"],
        ...(edge.is_seam
          ? ([["Seam", "Yes - closing line of a periodic surface"]] as Array<
              [string, string]
            >)
          : []),
      ],
    });
  }

  for (const vertex of topology?.vertices ?? []) {
    entities.push({
      id: `vertex:${vertex.vertex_id}`,
      kind: "vertex",
      label: `Vertex ${vertex.vertex_id}`,
      detail: V(vertex.position),
      anchor: asVec(vertex.position),
      outline: [],
      extent: 0.5,
      properties: [["Position", V(vertex.position)]],
    });
  }

  return entities;
}

function edgeOutline(edge: EdgeEntity): Vec3[][] {
  const start = asVec(edge.start);
  const end = asVec(edge.end);
  const mid = asVec(edge.midpoint);

  if (edge.curve_type === "CIRCLE" && edge.radius_mm && edge.axis) {
    // A closed circular edge reports start == end, so the midpoint is
    // diametrically opposite and the centre is halfway between them.
    if (edge.is_closed) {
      const centre: Vec3 = [
        (start[0] + mid[0]) / 2,
        (start[1] + mid[1]) / 2,
        (start[2] + mid[2]) / 2,
      ];
      return [close(circlePoints(centre, asVec(edge.axis), edge.radius_mm))];
    }
  }
  if (distance(start, end) < 1e-9) return [[start]];
  return [[start, mid, end]];
}

/** Nearest entity to a CAD-space point, preferring smaller ones when nested. */
export function pickNearestEntity(
  entities: SelectableEntity[],
  point: Vec3,
  maxDistance: number,
): SelectableEntity | null {
  let best: SelectableEntity | null = null;
  let bestScore = Infinity;

  for (const entity of entities) {
    const d = distance(entity.anchor, point);
    if (d > maxDistance) continue;
    // Bias towards tighter geometry so clicking inside a hole selects the hole
    // rather than the large face that surrounds it.
    const score = d + entity.extent * 0.25;
    if (score < bestScore) {
      bestScore = score;
      best = entity;
    }
  }
  return best;
}

export const KIND_LABELS: Record<EntityKind, string> = {
  feature: "Machining features",
  face: "Faces",
  edge: "Edges",
  vertex: "Vertices",
};

export const KIND_COLORS: Record<EntityKind, string> = {
  feature: "#2563eb",
  face: "#7c3aed",
  edge: "#0891b2",
  vertex: "#db2777",
};
