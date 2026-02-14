import type * as THREE from "three";
import { buildLineworkFromDxf, parseDxfFromArrayBuffer } from "./loaders/dxf";
export { parseDxfFromArrayBuffer } from "./loaders/dxf";

export type DxfUnits = "mm" | "inch";

export function loadDxfFromArrayBuffer(
  buf: ArrayBuffer,
  opts?: { units?: DxfUnits },
): {
  object: THREE.Group;
  bounds: THREE.Box3;
  meta: { insUnits?: number; scaleToMm: number };
} {
  const { dxf, meta } = parseDxfFromArrayBuffer(buf);
  const scaleToMm =
    opts?.units === "inch" ? 25.4 : opts?.units === "mm" ? 1 : meta.scaleToMm;
  const { object, bounds } = buildLineworkFromDxf(dxf, scaleToMm);
  return { object, bounds, meta: { ...meta, scaleToMm } };
}
