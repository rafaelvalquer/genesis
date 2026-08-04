#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());

function fail(message) {
  console.error(`[ERRO] ${message}`);
  process.exitCode = 1;
}

function read(relativePath) {
  const target = path.join(repoRoot, relativePath);
  if (!fs.existsSync(target)) {
    fail(`Arquivo ausente: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function requireMarkers(relativePath, markers) {
  const text = read(relativePath);
  markers.forEach((marker) => {
    if (!text.includes(marker)) {
      fail(`${relativePath}: marcador ausente: ${marker}`);
    }
  });
  return text;
}

const scenario = requireMarkers("src/game/chapter05/phase40Scenario.js", [
  'id: "fase_40"',
  "startingDefense",
  "requiredTroopAssetIds",
  "troopAssetDependencies",
  "packetSequences",
  "packetGaps",
  "maximumLivingEnemies: 48",
  "bossEncounter",
]);

const assetCatalog = requireMarkers("src/game/assetCatalog.js", [
  "resolvePhaseTroopAssetDependencies",
  "TROOP_ASSET_REFERENCE_KEYS",
  "alliedSummons",
  "temporaryTroops",
  "troopTransformations",
  "const troopIds = resolvePhaseTroopAssetDependencies(phase, loadout);",
]);

const phases = requireMarkers("src/game/chapterFivePhases.js", [
  'import { PHASE_40_SCENARIO } from "./chapter05/phase40Scenario.js";',
  "export const CHAPTER_FIVE_PHASE_BLUEPRINTS = [",
  "PHASE_40_SCENARIO.phaseExtra",
  "finalMission: blueprint.id === PHASE_40_SCENARIO.id",
]);

const waves = requireMarkers("src/game/chapterFiveWaves.js", [
  'import { PHASE_40_SCENARIO, isPhase40Scenario }',
  "normalizeWaveOptions",
  "PHASE_40_SCENARIO.packetSequences",
  "PHASE_40_SCENARIO.maximumLivingEnemies",
]);

if (phases.includes("waves: _legacyWaveBlueprints")) {
  fail("chapterFivePhases.js ainda contém descarte de ondas legadas.");
}
if (phases.includes("const PHASE_BLUEPRINTS = [")) {
  fail("chapterFivePhases.js ainda usa a coleção antiga de blueprints.");
}
if (waves.includes("phaseIndex === 7")) {
  fail("chapterFiveWaves.js ainda contém o número mágico phaseIndex === 7.");
}
if (scenario.includes("phaseIndex === 7")) {
  fail("O contrato não deve depender de comparação mágica repetida.");
}
if (!assetCatalog.includes("export function resolveBattleTroopAssetIds")) {
  fail("O alias de compatibilidade resolveBattleTroopAssetIds foi removido.");
}

[
  "src/game/missionProvidedAssets.test.js",
  "src/game/chapterFivePhase40Balance.test.js",
  "src/game/phase40Scenario.test.js",
].forEach((relativePath) => read(relativePath));

if (!process.exitCode) {
  console.log("Verificação concluída:");
  console.log("- contrato único da Fase 40 instalado");
  console.log("- ondas legadas removidas dos oito blueprints");
  console.log("- número mágico da missão final eliminado");
  console.log("- limite simultâneo mantido em 48");
  console.log("- dependências de assets generalizadas");
}
