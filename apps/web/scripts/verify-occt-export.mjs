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

function markerStatus(name, jsText, wasmBin) {
  return {
    js: jsText.includes(name),
    wasm: wasmBin.includes(Buffer.from(name, "utf8")),
  };
}

if (!fs.existsSync(jsPath)) fail(`missing JS artifact: ${jsPath}`);
if (!fs.existsSync(wasmPath)) fail(`missing WASM artifact: ${wasmPath}`);

const jsText = fs.readFileSync(jsPath, "utf8");
const wasmBin = fs.readFileSync(wasmPath);
if (!jsText.includes("occt-import-js.wasm")) {
  fail(`expected '${path.basename(jsPath)}' to reference 'occt-import-js.wasm'`);
}

const jsSize = fs.statSync(jsPath).size;
const wasmSize = fs.statSync(wasmPath).size;

const requiredMarkers = ["ExportPart"];
const advisoryMarkers = ["partId", "AnalyzeSheetMetal"];

console.log("[occ:verify:artifacts] Runtime OCCT artifacts");
console.log(`- JS:   ${jsPath}`);
console.log(`  size: ${jsSize}`);
console.log(`  sha256: ${sha256(jsPath)}`);
console.log(`- WASM: ${wasmPath}`);
console.log(`  size: ${wasmSize}`);
console.log(`  sha256: ${sha256(wasmPath)}`);
console.log("");

for (const marker of requiredMarkers) {
  const status = markerStatus(marker, jsText, wasmBin);
  console.log(
    `- required marker '${marker}': JS=${status.js ? "yes" : "no"}, WASM=${
      status.wasm ? "yes" : "no"
    }`,
  );
  if (!status.js && !status.wasm) {
    fail(
      `required marker '${marker}' was not found in JS or WASM artifact payload`,
    );
  }
}

for (const marker of advisoryMarkers) {
  const status = markerStatus(marker, jsText, wasmBin);
  console.log(
    `- advisory marker '${marker}': JS=${status.js ? "yes" : "no"}, WASM=${
      status.wasm ? "yes" : "no"
    }`,
  );
}

console.log("");
console.log(
  "For runtime checks, run: pnpm occ:verify:export -- --sample apps/web/public/samples/<file.step>",
);
