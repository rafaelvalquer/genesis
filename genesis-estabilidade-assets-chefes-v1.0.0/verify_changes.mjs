#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
let failed = false;
function read(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) { console.error(`[ERRO] Ausente: ${relativePath}`); failed = true; return ""; }
  return fs.readFileSync(target, "utf8");
}
function markers(relativePath, values) {
  const text = read(relativePath);
  values.forEach((value) => {
    if (!text.includes(value)) { console.error(`[ERRO] ${relativePath}: marcador ausente: ${value}`); failed = true; }
  });
  return text;
}

const packageJson = JSON.parse(read("package.json") || "{}");
const expectedScripts = {
  build: "vite build",
  "verify:encoding": "node scripts/check-encoding.mjs",
  "verify:assets": "node scripts/check-assets.js",
  "verify:crisalio": "node scripts/check-crisalio-frames.mjs",
  "audit:leviathan": "node scripts/audit-leviathan-sprite-components.mjs",
  ci: "npm run verify:encoding && npm run test && npm run build",
};
for (const [name, value] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[name] !== value) { console.error(`[ERRO] script ${name} incorreto.`); failed = true; }
}
markers("src/game/assetCatalog.js", [
  "export class AssetDependencyError",
  "resolvePhaseEnemyAssetDependencies",
  "resolvePhaseEnemyEffectDependencies",
  "runWithConcurrency",
  "assetConcurrency",
]);
markers("src/game/content.js", [
  'assetDependencies: Object.freeze(["workerQueenEgg", "silicaDigger"])',
  "effectDependencies: Object.freeze([",
]);
markers("src/game/battleModel.js", [
  'from "./systems/bossEncounterSystem.js"',
  "initializeBossEncounterForWave(session, wave",
  "markBossEncounterSpawned(session, queued)",
  "getTroopDeploymentLimit(troopId, phaseOrSession = null)",
]);
markers("src/game/chapterFivePhases.js", [
  "CHAPTER_FIVE_PHASE_BLUEPRINTS = Object.freeze([",
  "].map((blueprint) => Object.freeze(blueprint)))",
]);
markers("src/game/chapterFiveWaves.js", [
  "phaseIndex entre 0 e",
  "Configuração inconsistente",
]);
markers("src/game/chapter05/phase40Scenario.js", [
  "const requiredTroopAssetIds = troopAssetDependencies.required;",
  "deploymentLimits",
]);
markers("src/game/systems/bossEncounterSystem.js", [
  "initializeBossEncounterForWave",
  "enqueueBossReinforcement",
  "shouldDeferBossAwareSpawn",
]);
markers("scripts/check-encoding.mjs", ["badPattern", "Codificação UTF-8 validada"]);

if (failed) process.exitCode = 1;
else console.log("Verificação estrutural concluída com sucesso.");
