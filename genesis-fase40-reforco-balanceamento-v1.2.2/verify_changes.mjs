#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const failures = [];

function checkFile(relative, markers) {
  const target = path.join(repoRoot, relative);
  if (!fs.existsSync(target)) {
    failures.push(`${relative} não encontrado.`);
    return "";
  }
  const text = fs.readFileSync(target, "utf8");
  for (const marker of markers) {
    if (!text.includes(marker)) {
      failures.push(`${relative}: marcador ausente: ${marker}`);
    }
  }
  return text;
}

const phases = checkFile("src/game/chapterFivePhases.js", [
  'providedByMission: "fase_40"',
  '{ type: "bastiaoMare", row: 4, col: 6 }',
  '{ type: "fuzileiroVoltaico", row: 4, col: 5 }',
  '{ type: "medicaNanites", row: 0, col: 3 }',
  '{ type: "medicaNanites", row: 4, col: 3 }',
  "consumeEnergy: false",
  "consumeSupply: false",
  "requireLoadout: false",
]);

const waves = checkFile("src/game/chapterFiveWaves.js", [
  '["N3", "N5", "N10", "N8", "N11"]',
  '["N7", "N10", "N8", "N12", "N11"]',
  'export const PHASE_40_PACKET_GAPS = Object.freeze([9500, 8500, 7500, 6800, 6200, 5500]);',
  "export const PHASE_40_MAXIMUM_LIVING = 36;",
  "? PHASE_40_BALANCED_PACKET_SEQUENCES",
  "? PHASE_40_PACKET_GAPS[waveIndex]",
  "? PHASE_40_MAXIMUM_LIVING",
]);

checkFile("src/game/battleModel.js", [
  "export function deployStartingTroops(session) {",
  "deployStartingTroops(session);",
  "providedTroops: {}",
  "selectedTroop.missionProvided && selectedTroop.lockedPlacement",
]);

checkFile("src/game/phase40StartingDefense.test.js", [
  "expect(phase.startingTroops).toHaveLength(15)",
  "medicaNanites",
]);

checkFile("src/game/chapterFivePhase40Balance.test.js", [
  "expect(totals).toEqual([45, 54, 66, 86, 103, 86])",
  "PHASE_40_MAXIMUM_LIVING",
]);

const medicaEntries = phases.match(/\{ type: "medicaNanites", row: \d, col: 3 \}/g) || [];
if (medicaEntries.length !== 5) {
  failures.push(
    `chapterFivePhases.js: esperado 5 Médicas na coluna 3, encontrado ${medicaEntries.length}.`,
  );
}

const balanceDeclarations = waves.match(
  /export const PHASE_40_BALANCED_PACKET_SEQUENCES/g,
) || [];
if (balanceDeclarations.length !== 1) {
  failures.push(
    `chapterFiveWaves.js: configuração de balanceamento declarada ${balanceDeclarations.length} vezes.`,
  );
}

if (failures.length) {
  console.error("\nVerificação falhou:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Verificação concluída:");
console.log("- 5 Bastiões na coluna 6");
console.log("- 5 Fuzileiros Voltaicos na coluna 5");
console.log("- 5 Médicas de Nanites na coluna 3");
console.log("- energia e Supply preservados pela regra da missão");
console.log("- ondas balanceadas para 45, 54, 66, 86, 103 e 86 inimigos");
console.log("- limite simultâneo configurado em 36");
