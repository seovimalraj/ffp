/// <reference lib="webworker" />

/* eslint-disable */
type _TessReq = {
  id: string;
  type: "tessellate";
  payload: {
    buffer: ArrayBuffer;
    ext: "step" | "stp" | "iges" | "igs" | "brep";
    linearDeflection?: number;
    angularDeflection?: number;
  };
};
type TessOk = {
  id: string;
  ok: true;
  positions: Float32Array;
  indices: Uint32Array;
};
type TessErr = { id: string; ok: false; error: string };

const ctx: any = self as any;
let occt: any | null = null;
let appOrigin: string | null = null;

async function init() {
  if (occt) return occt;

  // Ensure we have a valid base URL for absolute resolution
  // If appOrigin wasn't passed, fallback to self.location.origin
  let origin = appOrigin || self.location.origin;
  if (!origin || origin === "null") {
    // In some sandboxed/blob environments, origin is "null"
    // We should log this as it's a common cause of invalid URL errors
    console.warn(
      "OCC Worker: Base origin is null, falling back to relative paths.",
    );
  }

  // Construct absolute URL for the JS glue code
  let scriptUrl: string;
  try {
    scriptUrl =
      origin && origin !== "null"
        ? new URL("/occ/occt-import-js.js", origin).href
        : "/occ/occt-import-js.js";
  } catch (_e) {
    scriptUrl = "/occ/occt-import-js.js";
  }

  try {
    // Load the JS glue from /public/occ/
    ctx.importScripts(scriptUrl);
  } catch (e: any) {
    throw new Error(
      `Failed to load OpenCascade script at ${scriptUrl}. Error: ${e.message}`,
    );
  }

  const factory = (ctx as any).occtimportjs;
  if (!factory)
    throw new Error(
      "occtimportjs not found on global scope. Check if /public/occ/occt-import-js.js exists.",
    );

  // Initialize the factory with robust file location for the .wasm asset
  occt = await factory({
    locateFile: (f: string) => {
      try {
        return origin && origin !== "null"
          ? new URL(`/occ/${f}`, origin).href
          : `/occ/${f}`;
      } catch (_e) {
        return `/occ/${f}`;
      }
    },
  });
  return occt;
}

function buildOcctParams(
  linearDeflection?: number,
  angularDeflection?: number,
) {
  return {
    linearUnit: "millimeter",
    linearDeflectionType: "bounding_box_ratio",
    linearDeflection: linearDeflection ?? 0.001,
    angularDeflection: angularDeflection ?? 0.5,
  };
}

ctx.onmessage = async (e: MessageEvent<any>) => {
  const { id, type, payload } = e.data;

  // Handle initialization message
  if (type === "init") {
    appOrigin = payload.origin;
    return;
  }

  if (type !== "tessellate") return;
  try {
    const { buffer, ext, linearDeflection, angularDeflection } = payload;
    const u8 = new Uint8Array(buffer);
    const mod = await init();

    const params = buildOcctParams(linearDeflection, angularDeflection);

    let res: any;
    if (ext === "step" || ext === "stp") res = mod.ReadStepFile(u8, params);
    else if (ext === "iges" || ext === "igs")
      res = mod.ReadIgesFile(u8, params);
    else if (ext === "brep") res = mod.ReadBrepFile(u8, params);
    else throw new Error("Unsupported extension");

    // Flatten meshes
    // Flatten meshes
    if (!res || !res.success) {
      const errMsg = res?.error
        ? `Import failed: ${res.error}`
        : "Import failed";
      ctx.postMessage({ id, ok: false, error: errMsg } as TessErr);
      return;
    }

    let totalPos = 0;
    let totalIdx = 0;
    for (const m of res.meshes as any[]) {
      totalPos += m.attributes.position.array.length;
      totalIdx += m.index.array.length;
    }

    const pos = new Float32Array(totalPos);
    const idx = new Uint32Array(totalIdx);

    let posOffset = 0;
    let idxOffset = 0;
    let indexOffsetBonus = 0;

    for (const m of res.meshes as any[]) {
      const p = m.attributes.position.array as Float32Array | number[];
      const i = m.index.array as Uint32Array | number[];

      // Copy positions
      if (p instanceof Float32Array) {
        pos.set(p, posOffset);
      } else {
        pos.set(new Float32Array(p), posOffset);
      }

      // Copy indices with offset adjustment
      for (let k = 0; k < i.length; k++) {
        idx[idxOffset + k] = i[k] + indexOffsetBonus;
      }

      posOffset += p.length;
      idxOffset += i.length;
      indexOffsetBonus += p.length / 3;
    }

    ctx.postMessage({ id, ok: true, positions: pos, indices: idx } as TessOk, [
      pos.buffer,
      idx.buffer,
    ]);
  } catch (err: any) {
    ctx.postMessage({
      id,
      ok: false,
      error: err?.message || String(err),
    } as TessErr);
  }
};
