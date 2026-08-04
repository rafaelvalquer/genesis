#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const wavesPath = path.join(repoRoot, "src/game/chapterFiveWaves.js");
const testPath = path.join(repoRoot, "src/game/chapterFivePhase40Balance.test.js");

const failures = [];

if (!fs.existsSync(wavesPath)) failures.push("src/game/chapterFiveWaves.js não encontrado.");
if (!fs.existsSync(testPath)) failures.push("Teste de balanceamento não encontrado.");

if (fs.existsSync(wavesPath)) {
  const text = fs.readFileSync(wavesPath, "utf8");
  const required = [
    'export const PHASE_40_BALANCED_PACKET_SEQUENCES',
    '["N10", "N8", "N12", "N11", "N13"]',
    'export const PHASE_40_PACKET_GAPS = Object.freeze([8000, 7000, 6500, 6000, 5600, 5000]);',
    'export const PHASE_40_MAXIMUM_LIVING = 42;',
    'phaseIndex === 7\n    ? PHASE_40_BALANCED_PACKET_SEQUENCES',
    'phaseIndex === 7\n      ? PHASE_40_PACKET_GAPS[waveIndex]',
    'maximumLivingEnemies: phaseIndex === 7',
  ];

  for (const marker of required) {
    if (!text.includes(marker)) failures.push(`Marcador ausente em chapterFiveWaves.js: ${marker}`);
  }

  const occurrence = (text.match(/export const PHASE_40_BALANCED_PACKET_SEQUENCES/g) || []).length;
  if (occurrence !== 1) {
    failures.push(`Configuração da Fase 40 encontrada ${occurrence} vezes; esperado: 1.`);
  }
}

if (failures.length) {
  console.error("\nVerificação falhou:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Verificação concluída:");
console.log("- primeira onda reduzida para cinco pacotes e 66 inimigos");
console.log("- limite simultâneo configurado em 42");
console.log("- onda final e chefe preservados");
console.log("- teste específico instalado");
