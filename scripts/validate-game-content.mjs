#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateGameContent } from "../src/game/validation/gameContentValidator.js";

const repoRoot = path.resolve(process.cwd());
const jsonMode = process.argv.includes("--json");
const reportOnly = process.argv.includes("--report");

function walk(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, output);
    else output.push(fullPath);
  }
  return output;
}

function buildFrameManifest(kind) {
  const root = path.join(repoRoot, "src", "game", "assets", kind);
  const manifest = {};
  for (const filePath of walk(root)) {
    const relative = path.relative(root, filePath).split(path.sep).join("/");
    const match = /^([^/]+)\/([^/]+)\/frame(\d+)\.png$/i.exec(relative);
    if (!match) continue;
    const [, folder, state, frameText] = match;
    manifest[folder] ||= {};
    manifest[folder][state] ||= [];
    manifest[folder][state].push(Number(frameText));
  }
  for (const states of Object.values(manifest)) {
    for (const frames of Object.values(states)) frames.sort((a, b) => a - b);
  }
  return manifest;
}

const contentPath = path.join(repoRoot, "src", "game", "content.js");
const { TROOPS, ENEMIES } = await import(`${pathToFileURL(contentPath).href}?validation=${Date.now()}`);
const assetManifest = {
  troops: buildFrameManifest("troop"),
  enemies: buildFrameManifest("enemy"),
};
const result = validateGameContent({ troops: TROOPS, enemies: ENEMIES, assetManifest });

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log("Genesis Game Content Validator");
  console.log("──────────────────────────────");
  console.log(`Troops: ${result.stats.troops}`);
  console.log(`Enemies: ${result.stats.enemies}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);

  const printIssue = (entry) => {
    console.log(`\n[${entry.entityType.toUpperCase()}:${entry.entityId}] ${entry.code}`);
    console.log(`  ${entry.path}`);
    console.log(`  ${entry.message}`);
  };
  result.errors.forEach(printIssue);
  result.warnings.forEach(printIssue);
}

if (!reportOnly && !result.valid) process.exitCode = 1;
