#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
const occDir = path.join(webDir, "public", "occ");
const jsPath = path.join(occDir, "occt-import-js.js");
const wasmPath = path.join(occDir, "occt-import-js.wasm");

function fail(message) {
  console.error(`[occ:verify:export] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(jsPath)) fail(`missing JS artifact: ${jsPath}`);
if (!fs.existsSync(wasmPath)) fail(`missing WASM artifact: ${wasmPath}`);

const marker = "AnalyzeSheetMetal";
const jsText = fs.readFileSync(jsPath, "utf8");
const wasmBin = fs.readFileSync(wasmPath);

const jsHasMarker = jsText.includes(marker);
const wasmHasMarker = wasmBin.includes(Buffer.from(marker, "utf8"));

console.log("[occ:verify:export] Best-effort export marker check");
console.log(`- JS marker '${marker}': ${jsHasMarker ? "found" : "not found"}`);
console.log(`- WASM marker '${marker}': ${wasmHasMarker ? "found" : "not found"}`);

if (!jsHasMarker && !wasmHasMarker) {
  console.log(
    "[occ:verify:export] Marker not found in static artifacts; this does not prove absence of the export.",
  );
}

console.log("Run app and check worker console for AnalyzeSheetMetal function");
console.log("Expected worker log after init: [OCCT] AnalyzeSheetMetal: function");
