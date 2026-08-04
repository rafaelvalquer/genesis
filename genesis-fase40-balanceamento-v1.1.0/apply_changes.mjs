#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD_ROOT = path.join(PACKAGE_ROOT, "payload");
const repoRoot = path.resolve(process.argv[2] || process.cwd());

const wavesPath = path.join(repoRoot, "src/game/chapterFiveWaves.js");
const testSource = path.join(PAYLOAD_ROOT, "src/game/chapterFivePhase40Balance.test.js");
const testDestination = path.join(repoRoot, "src/game/chapterFivePhase40Balance.test.js");

class PatchError extends Error {}

function occurrenceCount(text, value) {
  let count = 0;
  let cursor = 0;
  while (value && (cursor = text.indexOf(value, cursor)) >= 0) {
    count += 1;
    cursor += value.length;
  }
  return count;
}

function replaceOnce(text, oldValue, newValue, label) {
  if (text.includes(newValue)) return [text, false];

  const count = occurrenceCount(text, oldValue);
  if (count !== 1) {
    throw new PatchError(`${label}: esperado 1 marcador, encontrado ${count}.`);
  }
  return [text.replace(oldValue, newValue), true];
}

function insertBeforeOnce(text, marker, block, identity, label) {
  if (text.includes(identity)) return [text, false];

  const count = occurrenceCount(text, marker);
  if (count !== 1) {
    throw new PatchError(`${label}: esperado 1 marcador, encontrado ${count}.`);
  }
  return [text.replace(marker, `${block}${marker}`), true];
}

function assertRepository() {
  const required = [
    path.join(repoRoot, "package.json"),
    wavesPath,
    path.join(repoRoot, "src/game/chapterFivePackets.js"),
  ];
  const missing = required.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length) {
    throw new PatchError(
      `Estrutura do Genesis não encontrada. Arquivos ausentes:\n${missing.join("\n")}`,
    );
  }
}

function patchWaves(original) {
  let text = original;
  const changes = [];

  const balanceBlock = `export const PHASE_40_BALANCED_PACKET_SEQUENCES = Object.freeze([\n`
    + `  ["N10", "N8", "N12", "N11", "N13"],\n`
    + `  ["N13", "N10", "N8", "N12", "N11", "N14"],\n`
    + `  ["N10", "N13", "N8", "N12", "N11", "N9", "N14"],\n`
    + `  ["N13", "N10", "N14", "N8", "N12", "N11", "N13"],\n`
    + `  ["N10", "N13", "N8", "N12", "N11", "N14", "N9", "N13"],\n`
    + `  ["N10", "N11", "N8", "N12", "N13", "N10", "N14"],\n`
    + `].map((wave) => Object.freeze(wave)));\n`
    + `export const PHASE_40_PACKET_GAPS = Object.freeze([8000, 7000, 6500, 6000, 5600, 5000]);\n`
    + `export const PHASE_40_MAXIMUM_LIVING = 42;\n\n`;

  let changed;
  [text, changed] = insertBeforeOnce(
    text,
    "export const PHASE_PACKET_GAPS = Object.freeze([",
    balanceBlock,
    "export const PHASE_40_BALANCED_PACKET_SEQUENCES",
    "chapterFiveWaves.js/configuração da Fase 40",
  );
  if (changed) changes.push("configuração balanceada da Fase 40");

  [text, changed] = replaceOnce(
    text,
    "  const sequences = PHASE_PACKET_SEQUENCES[phaseIndex] || [];",
    "  const sequences = phaseIndex === 7\n"
      + "    ? PHASE_40_BALANCED_PACKET_SEQUENCES\n"
      + "    : PHASE_PACKET_SEQUENCES[phaseIndex] || [];",
    "chapterFiveWaves.js/sequências",
  );
  if (changed) changes.push("seleção das sequências balanceadas");

  [text, changed] = replaceOnce(
    text,
    "    const gap = PHASE_PACKET_GAPS[phaseIndex]?.[waveIndex] || 10000;",
    "    const gap = phaseIndex === 7\n"
      + "      ? PHASE_40_PACKET_GAPS[waveIndex]\n"
      + "      : PHASE_PACKET_GAPS[phaseIndex]?.[waveIndex] || 10000;",
    "chapterFiveWaves.js/intervalos",
  );
  if (changed) changes.push("intervalos entre pacotes da Fase 40");

  [text, changed] = replaceOnce(
    text,
    "maximumLivingEnemies: PHASE_MAXIMUM_LIVING[phaseIndex],",
    "maximumLivingEnemies: phaseIndex === 7\n"
      + "      ? PHASE_40_MAXIMUM_LIVING\n"
      + "      : PHASE_MAXIMUM_LIVING[phaseIndex],",
    "chapterFiveWaves.js/limite simultâneo",
  );
  if (changed) changes.push("limite simultâneo da Fase 40");

  return [text, changes];
}

function main() {
  assertRepository();

  const original = fs.readFileSync(wavesPath, "utf8");
  const [patched, changes] = patchWaves(original);

  // Todas as validações são concluídas antes de qualquer alteração do arquivo principal.
  if (!patched.includes("PHASE_40_BALANCED_PACKET_SEQUENCES")) {
    throw new PatchError("A configuração balanceada não foi inserida.");
  }
  if (!patched.includes("PHASE_40_MAXIMUM_LIVING")) {
    throw new PatchError("O limite simultâneo não foi configurado.");
  }

  if (patched !== original) {
    fs.writeFileSync(wavesPath, patched, "utf8");
  }

  fs.mkdirSync(path.dirname(testDestination), { recursive: true });
  fs.copyFileSync(testSource, testDestination);

  if (changes.length) {
    console.log("Alterações aplicadas:");
    changes.forEach((change) => console.log(`- ${change}`));
  } else {
    console.log("A configuração principal já estava aplicada.");
  }
  console.log("- teste de balanceamento instalado");
}

try {
  main();
} catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
