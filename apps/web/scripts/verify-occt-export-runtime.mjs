#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
const occDir = path.join(webDir, "public", "occ");
const jsPath = path.join(occDir, "occt-import-js.js");
const wasmPath = path.join(occDir, "occt-import-js.wasm");
const sampleDir = path.join(webDir, "public", "samples");

const CAD_EXTS = new Set(["step", "stp", "iges", "igs", "brep"]);
const EXACT_EXPORT_FORMATS = ["step", "iges", "brep"];
const REQUIRED_SYMBOLS = ["ReadStepFile", "ReadIgesFile", "ReadBrepFile", "ExportPart"];

function fail(message) {
  console.error(`[occ:verify:export] ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[occ:verify:export] ${message}`);
}

function getFileExt(filePath) {
  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
  return CAD_EXTS.has(ext) ? ext : null;
}

function normalizePartId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildOcctParams() {
  return {
    linearUnit: "millimeter",
    linearDeflectionType: "bounding_box_ratio",
    linearDeflection: 0.001,
    angularDeflection: 0.5,
  };
}

function readResultPartIds(result) {
  const rootPartIds = new Set();
  const meshPartIds = new Set();

  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const nodePartId = normalizePartId(node.partId);
    if (nodePartId) {
      rootPartIds.add(nodePartId);
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) {
      walk(child);
    }
  };

  walk(result?.root);

  const meshes = Array.isArray(result?.meshes) ? result.meshes : [];
  for (const mesh of meshes) {
    const meshPartId = normalizePartId(mesh?.partId);
    if (meshPartId) {
      meshPartIds.add(meshPartId);
    }
  }

  return { rootPartIds, meshPartIds };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const samples = [];
  let strictSamples = false;

  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (token === "--strict-samples") {
      strictSamples = true;
      continue;
    }
    if (token === "--sample") {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) {
        fail("missing value for --sample");
      }
      samples.push(next);
      index++;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log("Usage:");
      console.log("  node apps/web/scripts/verify-occt-export-runtime.mjs [--sample <path>] [--strict-samples]");
      console.log("");
      console.log("Examples:");
      console.log("  node apps/web/scripts/verify-occt-export-runtime.mjs --sample apps/web/public/samples/demo.step");
      console.log("  node apps/web/scripts/verify-occt-export-runtime.mjs --strict-samples");
      process.exit(0);
    }
    samples.push(token);
  }

  return { samples, strictSamples };
}

function discoverSamples() {
  const discovered = [];
  if (!fs.existsSync(sampleDir)) return discovered;

  const stack = [sampleDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!getFileExt(fullPath)) continue;
      discovered.push(fullPath);
    }
  }

  return discovered.sort((a, b) => a.localeCompare(b));
}

function uniqueExistingCadSamples(candidates) {
  const seen = new Set();
  const resolved = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const absPath = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(process.cwd(), candidate);
    if (!fs.existsSync(absPath)) {
      warn(`sample not found: ${absPath}`);
      continue;
    }
    if (!fs.statSync(absPath).isFile()) {
      warn(`sample is not a file: ${absPath}`);
      continue;
    }
    if (!getFileExt(absPath)) {
      warn(`unsupported CAD extension for sample: ${absPath}`);
      continue;
    }
    if (seen.has(absPath)) continue;
    seen.add(absPath);
    resolved.push(absPath);
  }
  return resolved;
}

function chooseReadFunction(mod, ext) {
  if (ext === "step" || ext === "stp") return mod.ReadStepFile;
  if (ext === "iges" || ext === "igs") return mod.ReadIgesFile;
  if (ext === "brep") return mod.ReadBrepFile;
  return null;
}

function asUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return new Uint8Array(value);
  if (value && typeof value === "object" && typeof value.length === "number") {
    return new Uint8Array(value);
  }
  return new Uint8Array(0);
}

async function loadOcctModule() {
  const require = createRequire(import.meta.url);
  const factory = require(jsPath);
  if (typeof factory !== "function") {
    fail(`invalid OCCT factory export at ${jsPath}`);
  }

  const module = await factory({
    locateFile: (fileName) => path.join(occDir, fileName),
  });

  for (const symbol of REQUIRED_SYMBOLS) {
    if (typeof module[symbol] !== "function") {
      fail(`missing runtime symbol '${symbol}'`);
    }
  }

  return module;
}

function summarizePartIds(ids) {
  const all = Array.from(ids);
  if (all.length === 0) return "<none>";
  if (all.length <= 3) return all.join(", ");
  return `${all.slice(0, 3).join(", ")}, ...`;
}

function resolveSampleList() {
  const parsed = parseArgs(process.argv);
  const envVar = process.env.OCC_VERIFY_SAMPLES;
  const envSamples = envVar
    ? envVar
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

  const fallbackDiscovered = discoverSamples();
  const combined = [...parsed.samples, ...envSamples, ...fallbackDiscovered];
  const samples = uniqueExistingCadSamples(combined);

  return { samples, strictSamples: parsed.strictSamples };
}

if (!fs.existsSync(jsPath)) fail(`missing JS artifact: ${jsPath}`);
if (!fs.existsSync(wasmPath)) fail(`missing WASM artifact: ${wasmPath}`);

const occt = await loadOcctModule();
console.log("[occ:verify:export] Runtime symbols");
for (const symbol of REQUIRED_SYMBOLS) {
  console.log(`- ${symbol}: ${typeof occt[symbol]}`);
}

const { samples, strictSamples } = resolveSampleList();
if (samples.length === 0) {
  const message =
    "No CAD sample files found. Provide --sample <path> (repeatable), set OCC_VERIFY_SAMPLES, or place .step/.iges/.brep files in apps/web/public/samples.";
  if (strictSamples) {
    fail(message);
  }
  warn(message);
  console.log("[occ:verify:export] Skipped smoke export checks.");
  process.exit(0);
}

console.log(`[occ:verify:export] Running smoke checks on ${samples.length} CAD sample(s)`);

for (const samplePath of samples) {
  const ext = getFileExt(samplePath);
  if (!ext) {
    fail(`unsupported CAD sample extension: ${samplePath}`);
  }

  const readFn = chooseReadFunction(occt, ext);
  if (typeof readFn !== "function") {
    fail(`missing OCCT read function for extension '${ext}'`);
  }

  const sourceBytes = fs.readFileSync(samplePath);
  const input = new Uint8Array(sourceBytes.buffer, sourceBytes.byteOffset, sourceBytes.byteLength);
  const readResult = readFn(input, buildOcctParams());
  if (!readResult || readResult.success === false) {
    fail(`Read failed for '${samplePath}': ${readResult?.error || "unknown error"}`);
  }

  const { rootPartIds, meshPartIds } = readResultPartIds(readResult);
  if (rootPartIds.size === 0) {
    fail(`Read succeeded but root hierarchy has no partId: ${samplePath}`);
  }
  if (meshPartIds.size === 0) {
    fail(`Read succeeded but meshes have no partId: ${samplePath}`);
  }

  const partId = Array.from(meshPartIds)[0] || Array.from(rootPartIds)[0];
  if (!partId) {
    fail(`Unable to pick partId for export: ${samplePath}`);
  }

  console.log(`- ${samplePath}`);
  console.log(`  root partIds: ${summarizePartIds(rootPartIds)}`);
  console.log(`  mesh partIds: ${summarizePartIds(meshPartIds)}`);
  console.log(`  export partId: ${partId}`);

  for (const format of EXACT_EXPORT_FORMATS) {
    const exportResult = occt.ExportPart(new Uint8Array(input), {
      inputExt: ext,
      partId,
      format,
    });

    if (!exportResult || exportResult.success === false) {
      fail(
        `ExportPart failed (${format}) for '${samplePath}': ${
          exportResult?.error || "unknown error"
        }`,
      );
    }

    const outputBytes = asUint8Array(exportResult.bytes);
    if (outputBytes.length === 0) {
      fail(`ExportPart returned empty ${format} output for '${samplePath}'`);
    }

    console.log(`  ${format.toUpperCase()} bytes: ${outputBytes.length}`);
  }
}

console.log("[occ:verify:export] Smoke checks passed.");
