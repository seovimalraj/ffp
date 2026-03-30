/// <reference lib="webworker" />

/* eslint-disable */
type _TessReq = {
  id: string;
  type: "tessellate";
  payload: {
    buffer: ArrayBuffer;
    ext: "step" | "stp" | "iges" | "igs" | "brep";
    mode?: "flat" | "parts";
    linearDeflection?: number;
    angularDeflection?: number;
  };
};
type CADExt = "step" | "stp" | "iges" | "igs" | "brep";
type CadExactExportFormat = "step" | "iges" | "brep";

type SheetMetalMeta = {
  isAssembly: boolean;
  isSheetMetal: boolean;
  thicknessMM?: number;
  bendCount?: number;
  reason?:
    | "assembly"
    | "not_sheetmetal"
    | "not_brep_source"
    | "unsupported_surfaces"
    | "analysis_failed"
    | string;
};

type AnalyzeReq = {
  id: string;
  type: "analyze_sheetmetal";
  payload: {
    buffer: ArrayBuffer;
    ext: CADExt;
  };
};

type AnalyzeOk = {
  id: string;
  ok: true;
  meta: SheetMetalMeta;
};

type UnfoldReq = {
  id: string;
  type: "unfold_sheetmetal";
  payload: {
    buffer: ArrayBuffer;
    ext: CADExt;
    kFactor: number;
    thicknessOverrideMM?: number;
    linearDeflection?: number;
    angularDeflection?: number;
  };
};

type UnfoldOk = {
  id: string;
  ok: true;
  meta: SheetMetalMeta;
  flat: {
    positions: Float32Array;
    indices: Uint32Array;
  };
};
type TessOk = {
  id: string;
  ok: true;
  positions: Float32Array;
  indices: Uint32Array;
};
type TessPartsMesh = {
  name: string;
  partId?: string | null;
  color?: [number, number, number] | null;
  positions: Float32Array;
  normals?: Float32Array;
  indices: Uint32Array;
};
type TessPartsNode = {
  name: string;
  partId?: string | null;
  meshes: number[];
  children: TessPartsNode[];
};
type TessPartsOk = {
  id: string;
  ok: true;
  mode: "parts";
  root: TessPartsNode | any;
  meshes: TessPartsMesh[];
};
type TessErr = { id: string; ok: false; error: string };

type ExportPartReq = {
  id: string;
  type: "export_part";
  payload: {
    buffer: ArrayBuffer;
    ext: CADExt;
    partId: string;
    format: CadExactExportFormat;
  };
};

type WorkerCapabilities = {
  exactCadPartExport: boolean;
  supportedExactCadFormats: Array<CadExactExportFormat>;
};

type ExportPartOk = {
  id: string;
  ok: true;
  type: "export_part";
  format: CadExactExportFormat;
  bytes: Uint8Array;
};

type GetWorkerCapabilitiesOk = {
  id: string;
  ok: true;
  type: "get_worker_capabilities";
  capabilities: WorkerCapabilities;
};

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
  console.log(
    "[OCCT] AnalyzeSheetMetal:",
    typeof (occt as any).AnalyzeSheetMetal,
  );
  console.log("[OCCT] ExportPart:", typeof (occt as any).ExportPart);
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

function isArrayLikeNumber(x: unknown): x is ArrayLike<number> {
  if (!x || typeof x !== "object") return false;
  const maybeArrayLike = x as { length?: unknown };
  return typeof maybeArrayLike.length === "number";
}

function toFloat32Array(x: unknown): Float32Array {
  if (x instanceof Float32Array) return x;
  if (Array.isArray(x)) return new Float32Array(x);
  if (isArrayLikeNumber(x)) return new Float32Array(x);
  return new Float32Array(0);
}

function toUint32Array(x: unknown): Uint32Array {
  if (x instanceof Uint32Array) return x;
  if (Array.isArray(x)) return new Uint32Array(x);
  if (isArrayLikeNumber(x)) return new Uint32Array(x);
  return new Uint32Array(0);
}

function toUint8Array(x: unknown): Uint8Array {
  if (x instanceof Uint8Array) return x;
  if (Array.isArray(x)) return new Uint8Array(x);
  if (isArrayLikeNumber(x)) return new Uint8Array(x);
  return new Uint8Array(0);
}

function normalizePartId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRootNode(raw: any, meshCount: number): TessPartsNode {
  if (!raw || typeof raw !== "object") {
    return {
      name: "Root",
      partId: null,
      meshes: new Array(meshCount).fill(0).map((_, idx) => idx),
      children: [],
    };
  }

  const rawMeshes = Array.isArray(raw.meshes) ? raw.meshes : [];
  const meshes = rawMeshes
    .map((idx: unknown) => Number(idx))
    .filter((idx: number) => Number.isInteger(idx));

  const rawChildren = Array.isArray(raw.children) ? raw.children : [];
  return {
    ...(raw as object),
    name: typeof raw.name === "string" ? raw.name : "Root",
    partId: normalizePartId(raw.partId),
    meshes,
    children: rawChildren.map((child: any) => normalizeRootNode(child, meshCount)),
  };
}

function normalizeColor(color: any): [number, number, number] | null {
  if (Array.isArray(color) && color.length >= 3) {
    const r = Number(color[0]);
    const g = Number(color[1]);
    const b = Number(color[2]);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return [r, g, b];
    }
  }
  if (color && typeof color === "object") {
    const r = Number(color.r);
    const g = Number(color.g);
    const b = Number(color.b);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return [r, g, b];
    }
  }
  return null;
}

function normalizeSheetMetalMeta(raw: any): SheetMetalMeta {
  const fallback: SheetMetalMeta = {
    isAssembly: false,
    isSheetMetal: false,
    reason: "analysis_failed",
  };
  if (!raw || typeof raw !== "object") return fallback;

  const isAssembly = !!raw.isAssembly;
  const isSheetMetal = !!raw.isSheetMetal;
  const thicknessMM = Number(raw.thicknessMM);
  const bendCount = Number(raw.bendCount);
  const reason =
    typeof raw.reason === "string"
      ? raw.reason
      : isSheetMetal
        ? undefined
        : "analysis_failed";

  return {
    isAssembly,
    isSheetMetal,
    thicknessMM: Number.isFinite(thicknessMM) ? thicknessMM : undefined,
    bendCount: Number.isFinite(bendCount) ? bendCount : undefined,
    reason,
  };
}

function isCadExt(ext: unknown): ext is CADExt {
  return (
    ext === "step" ||
    ext === "stp" ||
    ext === "iges" ||
    ext === "igs" ||
    ext === "brep"
  );
}

function isCadExactExportFormat(
  format: unknown,
): format is CadExactExportFormat {
  return format === "step" || format === "iges" || format === "brep";
}

function getWorkerCapabilities(mod: any): WorkerCapabilities {
  const exactCadPartExport = typeof mod?.ExportPart === "function";
  return {
    exactCadPartExport,
    supportedExactCadFormats: exactCadPartExport
      ? ["step", "iges", "brep"]
      : [],
  };
}

ctx.onmessage = async (e: MessageEvent<any>) => {
  const { id, type, payload } = e.data;

  // Handle initialization message
  if (type === "init") {
    appOrigin = payload.origin;
    return;
  }

  if (type === "get_worker_capabilities") {
    try {
      const mod = await init();
      const capabilities = getWorkerCapabilities(mod);
      ctx.postMessage({
        id,
        ok: true,
        type: "get_worker_capabilities",
        capabilities,
      } as GetWorkerCapabilitiesOk);
    } catch {
      const fallback: WorkerCapabilities = {
        exactCadPartExport: false,
        supportedExactCadFormats: [],
      };
      ctx.postMessage({
        id,
        ok: true,
        type: "get_worker_capabilities",
        capabilities: fallback,
      } as GetWorkerCapabilitiesOk);
    }
    return;
  }

  if (type === "tessellate") {
    try {
      const { buffer, ext, mode, linearDeflection, angularDeflection } = payload;
      const effectiveMode: "flat" | "parts" = mode ?? "flat";
      const u8 = new Uint8Array(buffer);
      const mod = await init();

      const params = buildOcctParams(linearDeflection, angularDeflection);

      let res: any;
      if (ext === "step" || ext === "stp") res = mod.ReadStepFile(u8, params);
      else if (ext === "iges" || ext === "igs")
        res = mod.ReadIgesFile(u8, params);
      else if (ext === "brep") res = mod.ReadBrepFile(u8, params);
      else throw new Error("Unsupported extension");

      if (!res || !res.success) {
        const errMsg = res?.error
          ? `Import failed: ${res.error}`
          : "Import failed";
        ctx.postMessage({ id, ok: false, error: errMsg } as TessErr);
        return;
      }

      if (effectiveMode === "parts") {
        const sourceMeshes = Array.isArray(res.meshes) ? (res.meshes as any[]) : [];
        const meshes: TessPartsMesh[] = [];
        const transferables: Transferable[] = [];

        for (let meshIndex = 0; meshIndex < sourceMeshes.length; meshIndex++) {
          const m = sourceMeshes[meshIndex];
          const p = toFloat32Array(m?.attributes?.position?.array);
          const nSrc = m?.attributes?.normal?.array;
          const n = nSrc != null ? toFloat32Array(nSrc) : undefined;
          const i = toUint32Array(m?.index?.array);

          const packed: TessPartsMesh = {
            name: typeof m?.name === "string" ? m.name : `Part ${meshIndex + 1}`,
            partId: normalizePartId(m?.partId),
            color: normalizeColor(m?.color),
            positions: p,
            indices: i,
          };
          if (n) packed.normals = n;
          meshes.push(packed);

          transferables.push(p.buffer, i.buffer);
          if (n) transferables.push(n.buffer);
        }

        const root = normalizeRootNode(res.root, meshes.length);

        ctx.postMessage(
          { id, ok: true, mode: "parts", root, meshes } as TessPartsOk,
          transferables,
        );
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

        if (p instanceof Float32Array) {
          pos.set(p, posOffset);
        } else {
          pos.set(new Float32Array(p), posOffset);
        }

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
    return;
  }

  if (type === "export_part") {
    try {
      const req = payload as ExportPartReq["payload"];
      if (!isCadExt(req?.ext)) {
        throw new Error("Unsupported source extension");
      }
      if (!isCadExactExportFormat(req?.format)) {
        throw new Error("Unsupported export format");
      }

      const partId = normalizePartId(req?.partId);
      if (!partId) {
        throw new Error("Missing CAD partId for exact export");
      }

      const mod = await init();
      const exportPart = mod?.ExportPart;
      if (typeof exportPart !== "function") {
        throw new Error(
          "Exact CAD export is unavailable in this OpenCascade runtime. Replace /public/occ artifacts with ExportPart support.",
        );
      }

      const sourceBytes = new Uint8Array(req.buffer);
      const result = exportPart(sourceBytes, {
        inputExt: req.ext,
        partId,
        format: req.format,
      });

      if (!result || result.success === false) {
        throw new Error(result?.error || "Failed to export exact CAD part");
      }

      const bytes = toUint8Array(result?.bytes);
      if (bytes.length === 0) {
        throw new Error("Exact CAD export returned empty output");
      }

      ctx.postMessage(
        {
          id,
          ok: true,
          type: "export_part",
          format: req.format,
          bytes,
        } as ExportPartOk,
        [bytes.buffer],
      );
    } catch (err: any) {
      ctx.postMessage({
        id,
        ok: false,
        error: err?.message || String(err),
      } as TessErr);
    }
    return;
  }

  if (type === "analyze_sheetmetal") {
    try {
      const req = payload as AnalyzeReq["payload"];
      if (!isCadExt(req?.ext)) {
        const meta: SheetMetalMeta = {
          isAssembly: false,
          isSheetMetal: false,
          reason: "not_brep_source",
        };
        ctx.postMessage({ id, ok: true, meta } as AnalyzeOk);
        return;
      }

      const mod = await init();
      const u8 = new Uint8Array(req.buffer);
      const analyze = mod?.AnalyzeSheetMetal;
      if (typeof analyze !== "function") {
        const meta: SheetMetalMeta = {
          isAssembly: false,
          isSheetMetal: false,
          reason: "analysis_failed",
        };
        ctx.postMessage({ id, ok: true, meta } as AnalyzeOk);
        return;
      }

      let meta = normalizeSheetMetalMeta(analyze(u8, { ext: req.ext }));
      if (!meta.isSheetMetal && !meta.reason) {
        meta = { ...meta, reason: "analysis_failed" };
      }
      ctx.postMessage({ id, ok: true, meta } as AnalyzeOk);
    } catch (_err: any) {
      const meta: SheetMetalMeta = {
        isAssembly: false,
        isSheetMetal: false,
        reason: "analysis_failed",
      };
      ctx.postMessage({ id, ok: true, meta } as AnalyzeOk);
    }
    return;
  }

  if (type === "unfold_sheetmetal") {
    try {
      const req = payload as UnfoldReq["payload"];
      if (!isCadExt(req?.ext)) {
        throw new Error("Unsupported extension");
      }
      const mod = await init();
      const u8 = new Uint8Array(req.buffer);
      const unfold = mod?.UnfoldSheetMetal;
      if (typeof unfold !== "function") {
        throw new Error("UnfoldSheetMetal export is not available");
      }

      const result = unfold(u8, {
        ext: req.ext,
        kFactor: req.kFactor,
        thicknessOverrideMM: req.thicknessOverrideMM,
        mesh: {
          linearDeflection: req.linearDeflection ?? 0.001,
          angularDeflection: req.angularDeflection ?? 0.5,
        },
      });

      if (!result || result.success === false) {
        const err = result?.error || "Failed to unfold sheet metal geometry";
        throw new Error(err);
      }

      const meta = normalizeSheetMetalMeta(result?.meta);
      const flatPositions = toFloat32Array(result?.flat?.positions);
      const flatIndices = toUint32Array(result?.flat?.indices);
      if (flatPositions.length === 0 || flatIndices.length === 0) {
        throw new Error("Unfolded flat pattern is empty");
      }

      ctx.postMessage(
        {
          id,
          ok: true,
          meta,
          flat: {
            positions: flatPositions,
            indices: flatIndices,
          },
        } as UnfoldOk,
        [flatPositions.buffer, flatIndices.buffer],
      );
    } catch (err: any) {
      ctx.postMessage({
        id,
        ok: false,
        error: err?.message || String(err),
      } as TessErr);
    }
  }
};
