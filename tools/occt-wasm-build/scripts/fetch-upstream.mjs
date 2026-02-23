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
    fail(
      `command failed: ${command} ${args.join(" ")}`,
      `${result.stdout || ""}\n${result.stderr || ""}`,
    );
  }

  return result.stdout;
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

fs.mkdirSync(cacheDir, { recursive: true });
fs.rmSync(upstreamDir, { recursive: true, force: true });
fs.mkdirSync(upstreamDir, { recursive: true });

const npmOutput = run("npm", [
  "pack",
  `occt-import-js@${version}`,
  "--pack-destination",
  cacheDir,
  "--json",
]);

let packInfo;
try {
  packInfo = JSON.parse(npmOutput);
} catch (err) {
  fail("unable to parse npm pack output", `${npmOutput}\n${String(err)}`);
}

if (!Array.isArray(packInfo) || packInfo.length === 0) {
  fail("npm pack did not return tarball metadata", npmOutput);
}

const tarballName = packInfo[0]?.filename;
if (typeof tarballName !== "string" || !tarballName.endsWith(".tgz")) {
  fail("npm pack did not return a valid tarball filename", npmOutput);
}

const tarballPath = path.join(cacheDir, tarballName);
if (!fs.existsSync(tarballPath)) {
  fail(`expected tarball was not found: ${tarballPath}`);
}

run("tar", ["-xzf", tarballPath, "-C", upstreamDir, "--strip-components=1"]);

if (!fs.existsSync(path.join(upstreamDir, "package.json"))) {
  fail(`extracted upstream source is missing package.json at ${upstreamDir}`);
}

const metadata = {
  package: "occt-import-js",
  version,
  tarball: path.relative(buildRoot, tarballPath),
  sha256: sha256(tarballPath),
};

fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

console.log("[fetch-upstream] complete");
console.log(`[fetch-upstream] package: ${metadata.package}@${metadata.version}`);
console.log(`[fetch-upstream] tarball: ${metadata.tarball}`);
console.log(`[fetch-upstream] sha256: ${metadata.sha256}`);
console.log(`[fetch-upstream] extracted to: ${path.relative(buildRoot, upstreamDir)}`);
