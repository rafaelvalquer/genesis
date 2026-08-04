#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const CHECKS = new Map([
  ["src/game/content.js", [
    'fuzileiroVoltaico: {',
    'attack: "chainLightning"',
    'spriteKey: "guarda"',
    'assetStates: ["idle", "attack", "death"]',
    'assetStateFallbacks: { death: "attack" }',
    'primaryWaterDamageFactor: 1.2',
    'secondaryWaterDamageFactor: 0.4',
    'fuzileiroVoltaico: "medium"',
  ]],
  ["src/game/battleModel.js", [
    'import { updateFuzileiroVoltaico } from "./fuzileiroVoltaico.js";',
    'const tideCell = getTideCellState(session, row, col);',
    'troop.canDeployInDeepWater',
    'troop.canDeployInFloodedCells',
    'ignoreTidePressure: Boolean(config.ignoreTidePressure)',
    'config.id === "fuzileiroVoltaico"',
    'updateFuzileiroVoltaico(session, troop, config, events',
  ]],
  ["src/game/tideCycle.js", [
    'troop.ignoreTideAttackSpeedPenalty',
    'if (troop.ignoreTidePressure)',
  ]],
  ["src/game/projectileRenderer.js", [
    'event.type === "voltaicDischarge"',
    'kind: "voltaicArc"',
    'function drawVoltaicArc(',
    'particle.kind === "voltaicArc"',
  ]],
  ["src/game/assetCatalog.js", [
    'const fallbackState = troop.assetStateFallbacks?.[state];',
    'if (!frames.some(Boolean) && fallbackState)',
  ]],
  ["src/game/fuzileiroVoltaico.js", [
    'export function selectVoltaicPrimaryTarget',
    'export function selectVoltaicChainTargets',
    'export function updateFuzileiroVoltaico',
    'direct: false',
    'type: "voltaicDischarge"',
    'troop.attackReadyAt = session.elapsed + dependencies.recoveryFor',
  ]],
  ["src/game/fuzileiroVoltaico.test.js", [
    'Fuzileiro Voltaico — fórmulas',
    'retargeta na liberação',
  ]],
  ["src/game/fuzileiroVoltaico.integration.test.js", [
    'permite implantação em água profunda',
    'não sofre dano de pressão',
  ]],
]);

function parseArgs(argv) {
  let repoRoot = "";
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--repo-root") repoRoot = argv[++index] || "";
    else throw new Error(`Argumento desconhecido: ${argv[index]}`);
  }
  if (!repoRoot) throw new Error("Informe --repo-root com a raiz do Genesis.");
  return path.resolve(repoRoot);
}

function countOccurrences(text, value) {
  let count = 0;
  let cursor = 0;
  while ((cursor = text.indexOf(value, cursor)) >= 0) {
    count += 1;
    cursor += value.length;
  }
  return count;
}

function main() {
  try {
    const root = parseArgs(process.argv.slice(2));
    const failures = [];
    for (const [relative, markers] of CHECKS) {
      const filePath = path.join(root, relative);
      if (!fs.existsSync(filePath)) {
        failures.push(`arquivo ausente: ${relative}`);
        continue;
      }
      const content = fs.readFileSync(filePath, "utf8");
      for (const marker of markers) {
        if (!content.includes(marker)) failures.push(`marcador ausente em ${relative}: ${marker}`);
      }
    }

    const contentPath = path.join(root, "src/game/content.js");
    if (fs.existsSync(contentPath)) {
      const content = fs.readFileSync(contentPath, "utf8");
      if (countOccurrences(content, '  fuzileiroVoltaico: {') !== 1) {
        failures.push("content.js deve conter exatamente uma configuração fuzileiroVoltaico");
      }
    }
    const battlePath = path.join(root, "src/game/battleModel.js");
    if (fs.existsSync(battlePath)) {
      const battle = fs.readFileSync(battlePath, "utf8");
      if (countOccurrences(battle, 'import { updateFuzileiroVoltaico }') !== 1) {
        failures.push("battleModel.js deve conter exatamente uma importação voltaica");
      }
    }

    if (failures.length) {
      console.error("[ERRO] A instalação não passou na verificação:");
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exitCode = 1;
      return;
    }
    console.log("[OK] Estrutura e marcadores da implementação validados.");
  } catch (error) {
    console.error(`[ERRO] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
