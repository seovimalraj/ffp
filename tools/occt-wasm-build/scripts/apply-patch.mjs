#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const buildRoot = path.resolve(scriptDir, "..");
const upstreamDir = path.join(buildRoot, "upstream-src");
const patchesDir = path.join(buildRoot, "patches");

function fail(message, details = "") {
  console.error(`[apply-patch] ${message}`);
  if (details) {
    console.error(details.trim());
  }
  process.exit(1);
}

if (!fs.existsSync(upstreamDir) || !fs.statSync(upstreamDir).isDirectory()) {
  fail(`missing upstream source directory: ${upstreamDir}`);
}

if (!fs.existsSync(path.join(upstreamDir, "package.json"))) {
  fail(`upstream source directory is incomplete: ${upstreamDir}`);
}

if (!fs.existsSync(patchesDir) || !fs.statSync(patchesDir).isDirectory()) {
  fail(`missing patches directory: ${patchesDir}`);
}

const patchFiles = fs
  .readdirSync(patchesDir)
  .filter((name) => name.endsWith(".patch"))
  .sort((a, b) => a.localeCompare(b));

if (patchFiles.length === 0) {
  fail(`no patch files found under ${patchesDir}`);
}

function runGitApply(patchPath, args) {
  return spawnSync("git", ["apply", ...args, patchPath], {
    cwd: upstreamDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const applyArgs = [
  "--ignore-space-change",
  "--ignore-whitespace",
  "--whitespace=nowarn",
];

for (const patchName of patchFiles) {
  const patchPath = path.join(patchesDir, patchName);

  const checkResult = runGitApply(patchPath, ["--check", ...applyArgs]);
  if (checkResult.status !== 0) {
    fail(
      `patch drift detected; '${patchName}' does not apply cleanly to upstream-src`,
      `${checkResult.stdout || ""}\n${checkResult.stderr || ""}`,
    );
  }

  const applyResult = runGitApply(patchPath, applyArgs);
  if (applyResult.status !== 0) {
    fail(
      `failed to apply patch '${patchName}' after successful --check`,
      `${applyResult.stdout || ""}\n${applyResult.stderr || ""}`,
    );
  }

  console.log(`[apply-patch] applied: ${path.relative(buildRoot, patchPath)}`);
}

console.log(`[apply-patch] target: ${path.relative(buildRoot, upstreamDir)}`);
console.log(`[apply-patch] total patches: ${patchFiles.length}`);
