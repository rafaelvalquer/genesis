#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const checks = [
  ["src/game/content.js", ["laneRelocationBaseMs", "baseAttackDamage"]],
  ["src/game/enemyTargeting.js", ["laneRelocation"]],
  ["src/game/visualGeometry.js", ["laneRelocation: \"swimSubmerged\""]],
  ["src/game/enemies/chapter05/enguiaRasgamar.js", ["rasgamarTargetRow", "rasgamarBaseAssault"]],
  ["src/game/enemies/chapter05/enguiaRasgamarTactics.js", ["selectRasgamarRelocationRow"]],
  ["src/game/battleModel.js", [
    "startRasgamarRelocation",
    "updateRasgamarLaneRelocation",
    "applyRasgamarBaseAttack",
    "rasgamarRelocationStarted",
    "rasgamarBaseAttack",
  ]],
];

const failures = [];
for (const [relativePath, markers] of checks) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    failures.push(`${relativePath}: arquivo ausente`);
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const marker of markers) {
    if (!content.includes(marker)) failures.push(`${relativePath}: marcador ausente ${marker}`);
  }
}

if (failures.length) {
  console.error("Contrato da nova mecânica da Enguia Rasgamar inválido:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Contrato da nova mecânica da Enguia Rasgamar: OK");
