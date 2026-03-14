#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const buildRoot = path.resolve(scriptDir, "..");
const configPath = path.join(buildRoot, "config.json");
const cacheDir = path.join(buildRoot, ".cache");
const upstreamDir = path.join(buildRoot, "upstream-src");
const metadataPath = path.join(cacheDir, "fetch-metadata.json");

const DEFAULT_REPO = "https://github.com/kovacsv/occt-import-js.git";
const DEFAULT_OCCT_MIRROR = "https://github.com/Open-Cascade-SAS/OCCT.git";

function fail(message, details = "") {
  console.error(`[fetch-upstream] ${message}`);
  if (details) {
    console.error(details.trim());
  }
  process.exit(1);
}

function run(command, args, cwd = buildRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const joined = [result.stdout || "", result.stderr || ""].join("\n").trim();
    throw new Error(`${command} ${args.join(" ")}\n${joined}`.trim());
  }

  return (result.stdout || "").trim();
}

function tryRun(command, args, cwd = buildRoot) {
  try {
    return { ok: true, output: run(command, args, cwd) };
  } catch (error) {
    return { ok: false, error };
  }
}

function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

if (!fs.existsSync(configPath)) {
  fail(`missing config file: ${configPath}`);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  fail(`failed to parse ${configPath}`, String(err));
}

const version = config?.version;
if (typeof version !== "string" || version.length === 0) {
  fail(`config.json must contain a non-empty string "version"`);
}

const repo =
  typeof config?.repo === "string" && config.repo.trim().length > 0
    ? config.repo.trim()
    : DEFAULT_REPO;

const explicitRef =
  typeof config?.ref === "string" && config.ref.trim().length > 0
    ? config.ref.trim()
    : null;

const candidateRefs = explicitRef ? [explicitRef] : [`v${version}`, version];

fs.mkdirSync(cacheDir, { recursive: true });
fs.rmSync(upstreamDir, { recursive: true, force: true });

const cloneErrors = [];
let selectedRef = null;
for (const ref of candidateRefs) {
  try {
    run("git", ["clone", "--depth", "1", "--branch", ref, repo, upstreamDir]);
    selectedRef = ref;
    break;
  } catch (err) {
    cloneErrors.push(`ref '${ref}': ${String(err)}`);
    fs.rmSync(upstreamDir, { recursive: true, force: true });
  }
}

if (!selectedRef) {
  fail(
    `unable to clone ${repo} using candidate refs: ${candidateRefs.join(", ")}`,
    cloneErrors.join("\n\n"),
  );
}

try {
  const submoduleInit = tryRun(
    "git",
    ["submodule", "update", "--init", "--recursive"],
    upstreamDir,
  );
  if (!submoduleInit.ok) {
    const fallbackUrl =
      typeof config?.occtMirror === "string" && config.occtMirror.trim().length > 0
        ? config.occtMirror.trim()
        : DEFAULT_OCCT_MIRROR;

    const detectedSubmoduleUrl = tryRun(
      "git",
      ["config", "-f", ".gitmodules", "--get", "submodule.occt.url"],
      upstreamDir,
    );
    const currentSubmoduleUrl = detectedSubmoduleUrl.ok
      ? detectedSubmoduleUrl.output
      : "";
    const shouldTryMirror =
      currentSubmoduleUrl.includes("git.dev.opencascade.org") &&
      fallbackUrl.length > 0;

    if (!shouldTryMirror) {
      throw submoduleInit.error;
    }

    console.warn(
      `[fetch-upstream] submodule fetch from '${currentSubmoduleUrl}' failed; retrying with mirror '${fallbackUrl}'`,
    );
    run(
      "git",
      ["config", "-f", ".gitmodules", "submodule.occt.url", fallbackUrl],
      upstreamDir,
    );
    run("git", ["submodule", "sync", "--recursive"], upstreamDir);
    run("git", ["submodule", "update", "--init", "--recursive"], upstreamDir);
  }
} catch (err) {
  fail("failed to initialize OCCT git submodule", String(err));
}

const upstreamPackageJson = path.join(upstreamDir, "package.json");
if (!fs.existsSync(upstreamPackageJson)) {
  fail(`cloned upstream source is missing package.json at ${upstreamDir}`);
}

const occtSrcDir = path.join(upstreamDir, "occt", "src");
if (!fs.existsSync(occtSrcDir) || !fs.statSync(occtSrcDir).isDirectory()) {
  fail(
    `upstream clone is missing occt submodule sources at ${occtSrcDir}`,
    "run this script again after checking network/auth access to the submodule origin",
  );
}

const headCommit = run("git", ["rev-parse", "HEAD"], upstreamDir);

const metadata = {
  package: "occt-import-js",
  version,
  source: {
    repo,
    ref: selectedRef,
    commit: headCommit,
  },
};

fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

const packageJsonHash = sha256(upstreamPackageJson);

console.log("[fetch-upstream] complete");
console.log(`[fetch-upstream] package: ${metadata.package}@${metadata.version}`);
console.log(`[fetch-upstream] repo: ${repo}`);
console.log(`[fetch-upstream] ref: ${selectedRef}`);
console.log(`[fetch-upstream] commit: ${headCommit}`);
console.log(`[fetch-upstream] package.json sha256: ${packageJsonHash}`);
console.log(`[fetch-upstream] extracted to: ${path.relative(buildRoot, upstreamDir)}`);
