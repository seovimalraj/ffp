#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const buildRoot = path.resolve(scriptDir, "..");
const upstreamDir = path.join(buildRoot, "upstream-src");
const patchPath = path.join(buildRoot, "patches", "0001-add-analyze-sheetmetal.patch");

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

if (!fs.existsSync(patchPath)) {
  fail(`missing patch file: ${patchPath}`);
}

function runGitApply(args) {
  return spawnSync("git", ["apply", ...args, patchPath], {
    cwd: upstreamDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const checkResult = runGitApply([
  "--check",
  "--ignore-space-change",
  "--ignore-whitespace",
  "--whitespace=nowarn",
]);
if (checkResult.status !== 0) {
  fail(
    "patch drift detected; patch does not apply cleanly to upstream-src",
    `${checkResult.stdout || ""}\n${checkResult.stderr || ""}`,
  );
}

const applyResult = runGitApply([
  "--ignore-space-change",
  "--ignore-whitespace",
  "--whitespace=nowarn",
]);
if (applyResult.status !== 0) {
  fail(
    "failed to apply patch after successful --check",
    `${applyResult.stdout || ""}\n${applyResult.stderr || ""}`,
  );
}

console.log("[apply-patch] patch applied successfully");
console.log(`[apply-patch] ${path.relative(buildRoot, patchPath)}`);
console.log(`[apply-patch] target: ${path.relative(buildRoot, upstreamDir)}`);
