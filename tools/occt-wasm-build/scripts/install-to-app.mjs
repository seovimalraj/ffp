#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const buildRoot = path.resolve(scriptDir, "..");
const distDir = path.join(buildRoot, "dist");
const appOccDir = path.resolve(buildRoot, "..", "..", "apps", "web", "public", "occ");

const files = ["occt-import-js.js", "occt-import-js.wasm"];

function fail(message) {
  console.error(`[install-to-app] ${message}`);
  process.exit(1);
}

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "-",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
    "Z",
  ].join("");
}

function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

if (!fs.existsSync(distDir)) {
  fail(`missing dist directory: ${distDir}`);
}

if (!fs.existsSync(appOccDir)) {
  fail(`missing app occ directory: ${appOccDir}`);
}

for (const name of files) {
  const distPath = path.join(distDir, name);
  if (!fs.existsSync(distPath)) {
    fail(`missing dist artifact: ${distPath}`);
  }
}

const backupDir = path.join(appOccDir, "_backup", timestamp());
fs.mkdirSync(backupDir, { recursive: true });

for (const name of files) {
  const appPath = path.join(appOccDir, name);
  if (fs.existsSync(appPath)) {
    fs.copyFileSync(appPath, path.join(backupDir, name));
  }
}

for (const name of files) {
  const src = path.join(distDir, name);
  const dst = path.join(appOccDir, name);
  fs.copyFileSync(src, dst);
}

console.log(`[install-to-app] backup created: ${backupDir}`);
for (const name of files) {
  const filePath = path.join(appOccDir, name);
  const size = fs.statSync(filePath).size;
  console.log(`[install-to-app] ${name}`);
  console.log(`  size: ${size}`);
  console.log(`  sha256: ${sha256(filePath)}`);
}
