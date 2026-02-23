#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
const occDir = path.join(webDir, "public", "occ");
const jsPath = path.join(occDir, "occt-import-js.js");
const wasmPath = path.join(occDir, "occt-import-js.wasm");

function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function fail(message) {
  console.error(`[occ:verify:artifacts] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(jsPath)) fail(`missing JS artifact: ${jsPath}`);
if (!fs.existsSync(wasmPath)) fail(`missing WASM artifact: ${wasmPath}`);

const jsText = fs.readFileSync(jsPath, "utf8");
if (!jsText.includes("occt-import-js.wasm")) {
  fail(`expected '${path.basename(jsPath)}' to reference 'occt-import-js.wasm'`);
}

const jsSize = fs.statSync(jsPath).size;
const wasmSize = fs.statSync(wasmPath).size;

console.log("[occ:verify:artifacts] Runtime OCCT artifacts");
console.log(`- JS:   ${jsPath}`);
console.log(`  size: ${jsSize}`);
console.log(`  sha256: ${sha256(jsPath)}`);
console.log(`- WASM: ${wasmPath}`);
console.log(`  size: ${wasmSize}`);
console.log(`  sha256: ${sha256(wasmPath)}`);
console.log("");
console.log(
  "Reminder: authoritative AnalyzeSheetMetal export verification must be done in the browser worker console.",
);
console.log("Expected worker log after init: [OCCT] AnalyzeSheetMetal: function");
