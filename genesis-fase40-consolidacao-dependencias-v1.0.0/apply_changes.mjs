#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD_ROOT = path.join(PACKAGE_ROOT, "payload");
const repoRoot = path.resolve(process.argv[2] || process.cwd());

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

function copyPayload(relativePath) {
  const source = path.join(PAYLOAD_ROOT, relativePath);
  const destination = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function findMatching(source, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new PatchError(`Delimitador ${openChar}${closeChar} não foi fechado.`);
}

function splitTopLevelArguments(source) {
  const args = [];
  let start = 0;
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(") paren += 1;
    else if (char === ")") paren -= 1;
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket -= 1;
    else if (char === "{") brace += 1;
    else if (char === "}") brace -= 1;
    else if (char === "," && paren === 0 && bracket === 0 && brace === 0) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  const tail = source.slice(start).trim();
  if (tail) args.push(tail);
  return args;
}

function patchAssetCatalog(original) {
  let text = original;
  const changes = [];

  const oldResolver = `export function resolveBattleTroopAssetIds(phase, loadout = []) {
  const selectedTroopIds = Array.isArray(loadout) ? loadout : [];
  const missionTroopIds = Array.isArray(phase?.startingTroops)
    ? phase.startingTroops.map((entry) => entry?.type)
    : [];

  return [...new Set([...selectedTroopIds, ...missionTroopIds])]
    .filter((troopId) => typeof troopId === "string" && TROOPS[troopId]);
}`;

  const newResolver = `const TROOP_ASSET_REFERENCE_KEYS = Object.freeze([
  "type",
  "troopId",
  "assetTroopId",
  "sourceType",
  "targetType",
  "from",
  "to",
  "resultType",
  "transformsInto",
]);

const TROOP_ASSET_COLLECTION_KEYS = Object.freeze([
  "required",
  "requiredTroopAssetIds",
  "alliedSummons",
  "temporaryTroops",
  "transformations",
  "troopTransformations",
  "dependencies",
  "entries",
]);

function appendTroopAssetReferences(value, destination, visited = new WeakSet()) {
  if (typeof value === "string") {
    destination.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => appendTroopAssetReferences(entry, destination, visited));
    return;
  }
  if (!value || typeof value !== "object" || visited.has(value)) return;

  visited.add(value);
  TROOP_ASSET_REFERENCE_KEYS.forEach((key) => {
    if (typeof value[key] === "string") destination.push(value[key]);
  });
  TROOP_ASSET_COLLECTION_KEYS.forEach((key) => {
    if (value[key] != null) {
      appendTroopAssetReferences(value[key], destination, visited);
    }
  });
}

export function resolvePhaseTroopAssetDependencies(phase, loadout = []) {
  const troopIds = [];
  appendTroopAssetReferences(Array.isArray(loadout) ? loadout : [], troopIds);
  appendTroopAssetReferences(phase?.startingTroops, troopIds);
  appendTroopAssetReferences(phase?.requiredTroopAssetIds, troopIds);
  appendTroopAssetReferences(phase?.alliedSummons, troopIds);
  appendTroopAssetReferences(phase?.temporaryTroops, troopIds);
  appendTroopAssetReferences(phase?.troopTransformations, troopIds);
  appendTroopAssetReferences(phase?.troopAssetDependencies, troopIds);

  return [...new Set(troopIds)]
    .filter((troopId) => typeof troopId === "string" && TROOPS[troopId]);
}

export function resolveBattleTroopAssetIds(phase, loadout = []) {
  return resolvePhaseTroopAssetDependencies(phase, loadout);
}`;

  let changed;
  [text, changed] = replaceOnce(
    text,
    oldResolver,
    newResolver,
    "assetCatalog.js/resolvedor genérico",
  );
  if (changed) changes.push("resolvedor genérico de dependências de tropas");

  [text, changed] = replaceOnce(
    text,
    "  const troopIds = resolveBattleTroopAssetIds(phase, loadout);",
    "  const troopIds = resolvePhaseTroopAssetDependencies(phase, loadout);",
    "assetCatalog.js/uso do resolvedor",
  );
  if (changed) changes.push("carregamento passou a usar o contrato genérico");

  return [text, changes];
}

function patchChapterFivePhases(original) {
  let text = original;
  const changes = [];
  let changed;

  [text, changed] = replaceOnce(
    text,
    'import { createChapterFiveWaves } from "./chapterFiveWaves.js";',
    'import { createChapterFiveWaves } from "./chapterFiveWaves.js";\n'
      + 'import { PHASE_40_SCENARIO } from "./chapter05/phase40Scenario.js";',
    "chapterFivePhases.js/import do cenário",
  );
  if (changed) changes.push("importação do contrato da Fase 40");

  const oldPhaseHelper = `const phase = (
  id, name, subtitle, energy, arenaId, palette, battlefieldTheme, tide, waves, extra = {},
) => ({ id, name, subtitle, energy, arenaId, palette, battlefieldTheme, tide, waves, ...extra });`;

  const newPhaseHelper = `const phase = (
  id, name, subtitle, energy, arenaId, palette, battlefieldTheme, tide, extra = {},
) => ({ id, name, subtitle, energy, arenaId, palette, battlefieldTheme, tide, ...extra });`;

  [text, changed] = replaceOnce(
    text,
    oldPhaseHelper,
    newPhaseHelper,
    "chapterFivePhases.js/fábrica sem ondas legadas",
  );
  if (changed) changes.push("fábrica de blueprints sem parâmetro de ondas legadas");

  if (!text.includes("export const CHAPTER_FIVE_PHASE_BLUEPRINTS = [")) {
    const declaration = "const PHASE_BLUEPRINTS = [";
    const declarationIndex = text.indexOf(declaration);
    if (declarationIndex < 0) {
      throw new PatchError("chapterFivePhases.js: declaração PHASE_BLUEPRINTS não encontrada.");
    }

    const arrayOpen = text.indexOf("[", declarationIndex);
    const arrayClose = findMatching(text, arrayOpen, "[", "]");
    const replacements = [];
    let cursor = arrayOpen + 1;

    while (cursor < arrayClose) {
      const callStart = text.indexOf("phase(", cursor);
      if (callStart < 0 || callStart > arrayClose) break;
      const openParen = callStart + "phase".length;
      const closeParen = findMatching(text, openParen, "(", ")");
      const args = splitTopLevelArguments(text.slice(openParen + 1, closeParen));
      const phaseId = /^["'](fase_\d{2})["']$/.exec(args[0])?.[1];

      if (phaseId && Number(phaseId.slice(-2)) >= 33 && Number(phaseId.slice(-2)) <= 40) {
        if (![9, 10].includes(args.length)) {
          throw new PatchError(
            `chapterFivePhases.js/${phaseId}: esperado 9 ou 10 argumentos antes da consolidação; encontrados ${args.length}.`,
          );
        }
        args.splice(8, 1);
        if (phaseId === PHASE_40_SCENARIO_ID) {
          if (args.length === 8) args.push("PHASE_40_SCENARIO.phaseExtra");
          else args[8] = "PHASE_40_SCENARIO.phaseExtra";
        }
        const rebuilt = `phase(\n    ${args.join(",\n    ")},\n  )`;
        replacements.push({ start: callStart, end: closeParen + 1, value: rebuilt });
      }
      cursor = closeParen + 1;
    }

    if (replacements.length !== 8) {
      throw new PatchError(
        `chapterFivePhases.js: esperadas 8 fases do Capítulo 5; encontradas ${replacements.length}.`,
      );
    }

    replacements.reverse().forEach(({ start, end, value }) => {
      text = text.slice(0, start) + value + text.slice(end);
    });

    text = text.replace(
      "const PHASE_BLUEPRINTS = [",
      "export const CHAPTER_FIVE_PHASE_BLUEPRINTS = [",
    );
    text = text.replace(
      "export const CHAPTER_FIVE_PHASES = PHASE_BLUEPRINTS.map(createChapterFivePhase);",
      "export const CHAPTER_FIVE_PHASES = CHAPTER_FIVE_PHASE_BLUEPRINTS.map(createChapterFivePhase);",
    );
    changes.push("remoção das ondas legadas dos oito blueprints");
  }

  const oldFactory = `function createChapterFivePhase(blueprint, chapterIndex) {
  const { tide, waves: _legacyWaveBlueprints, ...rest } = blueprint;
  const waves = createChapterFiveWaves(chapterIndex);`;

  const newFactory = `function createChapterFivePhase(blueprint, chapterIndex) {
  const { tide, ...rest } = blueprint;
  const waves = createChapterFiveWaves({
    phaseIndex: chapterIndex,
    phaseId: blueprint.id,
    finalMission: blueprint.id === PHASE_40_SCENARIO.id,
  });`;

  [text, changed] = replaceOnce(
    text,
    oldFactory,
    newFactory,
    "chapterFivePhases.js/criação das ondas",
  );
  if (changed) changes.push("criação de ondas baseada no ID da missão");

  return [text, changes];
}

const PHASE_40_SCENARIO_ID = "fase_40";

function assertRepository() {
  const required = [
    "package.json",
    "src/game/assetCatalog.js",
    "src/game/chapterFivePhases.js",
    "src/game/chapterFiveWaves.js",
    "src/game/chapterFivePackets.js",
    "src/game/battleModel.js",
  ].map((relativePath) => path.join(repoRoot, relativePath));
  const missing = required.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length) {
    throw new PatchError(
      `Estrutura do Genesis não encontrada. Arquivos ausentes:\n${missing.join("\n")}`,
    );
  }
}

function main() {
  assertRepository();
  const changes = [];

  const assetCatalogPath = path.join(repoRoot, "src/game/assetCatalog.js");
  const phasesPath = path.join(repoRoot, "src/game/chapterFivePhases.js");

  const [assetCatalog, assetChanges] = patchAssetCatalog(
    fs.readFileSync(assetCatalogPath, "utf8"),
  );
  const [phases, phaseChanges] = patchChapterFivePhases(
    fs.readFileSync(phasesPath, "utf8"),
  );

  fs.writeFileSync(assetCatalogPath, assetCatalog, "utf8");
  fs.writeFileSync(phasesPath, phases, "utf8");

  [
    "src/game/chapter05/phase40Scenario.js",
    "src/game/chapterFiveWaves.js",
    "src/game/missionProvidedAssets.test.js",
    "src/game/chapterFivePhase40Balance.test.js",
    "src/game/phase40Scenario.test.js",
  ].forEach(copyPayload);

  changes.push(...assetChanges, ...phaseChanges);
  changes.push("contrato único src/game/chapter05/phase40Scenario.js");
  changes.push("testes de cenário, ondas e dependências atualizados");

  console.log("Alterações aplicadas:");
  changes.forEach((change) => console.log(`- ${change}`));
}

try {
  main();
} catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
