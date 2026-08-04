#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD_ROOT = path.join(PACKAGE_ROOT, "payload");
const repoRoot = path.resolve(process.argv[2] || process.cwd());

const REQUIRED_REPO_FILES = [
  "package.json",
  "src/game/content.js",
  "src/game/chapterFivePhases.js",
  "src/game/chapterFiveWaves.js",
  "src/game/battleModel.js",
];

const PAYLOAD_FILES = [
  "src/game/phase40StartingDefense.test.js",
  "src/game/chapterFivePhase40Balance.test.js",
];

class PatchError extends Error {}

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const write = (filePath, content) => fs.writeFileSync(filePath, content, "utf8");

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
  return [text.replace(marker, block + marker), true];
}

function findMatching(text, start, opening, closing, label) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

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
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
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

    if (char === opening) depth += 1;
    else if (char === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  throw new PatchError(`${label}: fechamento não encontrado.`);
}

function phase40Segment(original) {
  const identity = '"fase_40", "Trono Abissal"';
  const identityIndex = original.indexOf(identity);
  if (identityIndex < 0) {
    throw new PatchError("chapterFivePhases.js: configuração da fase 40 não encontrada.");
  }

  const start = original.lastIndexOf("  phase(", identityIndex);
  const endingMarker = "\n  ),\n];";
  const endingIndex = original.indexOf(endingMarker, identityIndex);
  if (start < 0 || endingIndex < 0) {
    throw new PatchError("chapterFivePhases.js: limites da fase 40 não encontrados.");
  }

  return {
    start,
    end: endingIndex + "\n  ),".length,
    text: original.slice(start, endingIndex + "\n  ),".length),
  };
}

const STARTING_TROOPS_ARRAY = `[
        { type: "bastiaoMare", row: 0, col: 6 },
        { type: "bastiaoMare", row: 1, col: 6 },
        { type: "bastiaoMare", row: 2, col: 6 },
        { type: "bastiaoMare", row: 3, col: 6 },
        { type: "bastiaoMare", row: 4, col: 6 },
        { type: "fuzileiroVoltaico", row: 0, col: 5 },
        { type: "fuzileiroVoltaico", row: 1, col: 5 },
        { type: "fuzileiroVoltaico", row: 2, col: 5 },
        { type: "fuzileiroVoltaico", row: 3, col: 5 },
        { type: "fuzileiroVoltaico", row: 4, col: 5 },
        { type: "medicaNanites", row: 0, col: 3 },
        { type: "medicaNanites", row: 1, col: 3 },
        { type: "medicaNanites", row: 2, col: 3 },
        { type: "medicaNanites", row: 3, col: 3 },
        { type: "medicaNanites", row: 4, col: 3 },
      ]`;

const STARTING_RULES = `      startingTroopRules: {
        consumeEnergy: false,
        consumeSupply: false,
        requireLoadout: false,
        removable: false,
        refundable: false,
        countTowardDeploymentLimit: true,
      },`;

function patchChapterFivePhases(original) {
  const located = phase40Segment(original);
  let segment = located.text;
  const changes = [];

  const propertyIndex = segment.indexOf("startingTroops:");
  if (propertyIndex >= 0) {
    const arrayStart = segment.indexOf("[", propertyIndex);
    const arrayEnd = findMatching(
      segment,
      arrayStart,
      "[",
      "]",
      "chapterFivePhases.js/startingTroops",
    );
    const currentArray = segment.slice(arrayStart, arrayEnd + 1);
    if (currentArray !== STARTING_TROOPS_ARRAY) {
      segment = segment.slice(0, arrayStart)
        + STARTING_TROOPS_ARRAY
        + segment.slice(arrayEnd + 1);
      changes.push("terceira coluna de Médicas de Nanites adicionada");
    }
  } else {
    const oldExtra = "    { boss: true },";
    const newExtra = `    {
      boss: true,
      providedByMission: "fase_40",
      startingTroops: ${STARTING_TROOPS_ARRAY},
${STARTING_RULES}
    },`;
    const count = occurrenceCount(segment, oldExtra);
    if (count !== 1) {
      throw new PatchError(
        `chapterFivePhases.js/defesa inicial: esperado 1 marcador, encontrado ${count}.`,
      );
    }
    segment = segment.replace(oldExtra, newExtra);
    changes.push("defesa inicial completa adicionada");
  }

  if (!segment.includes('providedByMission: "fase_40"')) {
    const [patched, changed] = replaceOnce(
      segment,
      "      boss: true,\n",
      '      boss: true,\n      providedByMission: "fase_40",\n',
      "chapterFivePhases.js/identificação da missão",
    );
    segment = patched;
    if (changed) changes.push("identificação da guarnição adicionada");
  }

  if (!segment.includes("startingTroopRules:")) {
    const arrayPropertyIndex = segment.indexOf("startingTroops:");
    const arrayStart = segment.indexOf("[", arrayPropertyIndex);
    const arrayEnd = findMatching(
      segment,
      arrayStart,
      "[",
      "]",
      "chapterFivePhases.js/regras",
    );
    segment = segment.slice(0, arrayEnd + 1)
      + ",\n"
      + STARTING_RULES
      + segment.slice(arrayEnd + 2);
    changes.push("regras econômicas da guarnição adicionadas");
  }

  return [
    original.slice(0, located.start) + segment + original.slice(located.end),
    changes,
  ];
}

const PHASE_40_BALANCE_BLOCK = `export const PHASE_40_BALANCED_PACKET_SEQUENCES = Object.freeze([
  ["N3", "N5", "N10", "N8", "N11"],
  ["N7", "N10", "N8", "N12", "N11"],
  ["N10", "N13", "N8", "N12", "N11"],
  ["N13", "N10", "N14", "N8", "N12", "N11"],
  ["N10", "N13", "N8", "N12", "N11", "N14", "N13"],
  ["N10", "N11", "N8", "N12", "N13", "N14"],
].map((wave) => Object.freeze(wave)));
export const PHASE_40_PACKET_GAPS = Object.freeze([9500, 8500, 7500, 6800, 6200, 5500]);
export const PHASE_40_MAXIMUM_LIVING = 36;

`;

function patchChapterFiveWaves(original) {
  let text = original;
  const changes = [];

  const existingBlock = /export const PHASE_40_BALANCED_PACKET_SEQUENCES[\s\S]*?export const PHASE_40_MAXIMUM_LIVING = \d+;\n\n/;
  if (existingBlock.test(text)) {
    const current = text.match(existingBlock)?.[0] || "";
    if (current !== PHASE_40_BALANCE_BLOCK) {
      text = text.replace(existingBlock, PHASE_40_BALANCE_BLOCK);
      changes.push("quantidades e intervalos da fase 40 reduzidos");
    }
  } else {
    const marker = "export const PHASE_PACKET_GAPS = Object.freeze([";
    const count = occurrenceCount(text, marker);
    if (count !== 1) {
      throw new PatchError(
        `chapterFiveWaves.js/configuração: esperado 1 marcador, encontrado ${count}.`,
      );
    }
    text = text.replace(marker, PHASE_40_BALANCE_BLOCK + marker);
    changes.push("configuração de balanceamento da fase 40 adicionada");
  }

  let changed;
  [text, changed] = replaceOnce(
    text,
    "  const sequences = PHASE_PACKET_SEQUENCES[phaseIndex] || [];",
    "  const sequences = phaseIndex === 7\n"
      + "    ? PHASE_40_BALANCED_PACKET_SEQUENCES\n"
      + "    : PHASE_PACKET_SEQUENCES[phaseIndex] || [];",
    "chapterFiveWaves.js/sequências",
  );
  if (changed) changes.push("sequências especiais da fase 40 ativadas");

  [text, changed] = replaceOnce(
    text,
    "    const gap = PHASE_PACKET_GAPS[phaseIndex]?.[waveIndex] || 10000;",
    "    const gap = phaseIndex === 7\n"
      + "      ? PHASE_40_PACKET_GAPS[waveIndex]\n"
      + "      : PHASE_PACKET_GAPS[phaseIndex]?.[waveIndex] || 10000;",
    "chapterFiveWaves.js/intervalos",
  );
  if (changed) changes.push("intervalos especiais da fase 40 ativados");

  [text, changed] = replaceOnce(
    text,
    "maximumLivingEnemies: PHASE_MAXIMUM_LIVING[phaseIndex],",
    "maximumLivingEnemies: phaseIndex === 7\n"
      + "      ? PHASE_40_MAXIMUM_LIVING\n"
      + "      : PHASE_MAXIMUM_LIVING[phaseIndex],",
    "chapterFiveWaves.js/limite simultâneo",
  );
  if (changed) changes.push("limite simultâneo especial da fase 40 ativado");

  return [text, changes];
}

function patchBattleModel(original) {
  let text = original;
  const changes = [];
  let changed;

  if (!text.includes("export function deployStartingTroops(session) {")) {
    if (!text.includes("  const session = {\n    phase: sessionPhase,")) {
      [text, changed] = replaceOnce(
        text,
        "  return {\n    phase: sessionPhase,",
        "  const session = {\n    phase: sessionPhase,",
        "battleModel.js/criação da sessão",
      );
      if (changed) changes.push("sessão materializada antes da guarnição");
    }

    if (!text.includes("    providedTroops: {},")) {
      [text, changed] = replaceOnce(
        text,
        "    deployed: {},\n    outcome: null,",
        "    deployed: {},\n    providedTroops: {},\n    outcome: null,",
        "battleModel.js/contador da missão",
      );
      if (changed) changes.push("contador de tropas fornecidas adicionado");
    }

    if (!text.includes("  deployStartingTroops(session);\n")) {
      [text, changed] = replaceOnce(
        text,
        "  initializeSandboxHazard(session);\n  return session;",
        "  initializeSandboxHazard(session);\n  deployStartingTroops(session);\n  return session;",
        "battleModel.js/implantação inicial",
      );
      if (changed) changes.push("implantação inicial ligada à criação da sessão");
    }

    const deployFunction = `export function deployStartingTroops(session) {
  const entries = Array.isArray(session?.phase?.startingTroops)
    ? session.phase.startingTroops
    : [];
  if (!entries.length) return [];

  const rules = {
    consumeEnergy: false,
    consumeSupply: false,
    requireLoadout: false,
    removable: false,
    refundable: false,
    countTowardDeploymentLimit: true,
    ...(session.phase.startingTroopRules || {}),
  };
  const occupiedCells = new Set(
    session.troops
      .filter((troop) => !troop.dead)
      .map((troop) => String(troop.row) + ":" + String(troop.col)),
  );
  const provided = [];

  for (const entry of entries) {
    const troopType = String(entry?.type || "");
    const row = Number(entry?.row);
    const col = Number(entry?.col);

    if (!TROOPS[troopType]) {
      throw new Error(
        "Tropa inicial desconhecida na fase "
          + session.phase.id + ": " + (troopType || "<vazia>") + ".",
      );
    }
    if (!Number.isInteger(row) || row < 0 || row >= FIELD.rows
      || !Number.isInteger(col) || col < FIELD.firstTroopCol
      || col > FIELD.lastTroopCol) {
      throw new Error(
        "Posição inválida para a tropa inicial " + troopType
          + ": linha " + row + ", coluna " + col + ".",
      );
    }

    const cellKey = String(row) + ":" + String(col);
    if (occupiedCells.has(cellKey)) {
      throw new Error(
        "Célula inicial duplicada ou ocupada na fase "
          + session.phase.id + ": " + cellKey + ".",
      );
    }

    const config = TROOPS[troopType];
    const energyCost = rules.consumeEnergy ? Number(config.price) || 0 : 0;
    const supplyCost = rules.consumeSupply ? Number(config.supply) || 0 : 0;
    const troop = createTroopEntity(session, troopType, row, col, {
      energyCost,
      supplyCost,
    });
    if (!troop) continue;

    troop.missionProvided = true;
    troop.providedByPhaseId = session.phase.id;
    troop.providedAtStart = true;
    troop.lockedPlacement = rules.removable === false;
    troop.refundable = rules.refundable !== false;
    troop.countTowardDeploymentLimit = rules.countTowardDeploymentLimit !== false;
    troop.requiresLoadout = rules.requireLoadout === true;

    session.troops.push(troop);
    session.providedTroops[troopType]
      = (session.providedTroops[troopType] || 0) + 1;
    occupiedCells.add(cellKey);
    provided.push(troop);

    if (rules.consumeEnergy) {
      session.energy = Math.max(0, session.energy - energyCost);
    }
    if (rules.consumeSupply) {
      session.supply = Math.max(0, session.supply - supplyCost);
    }
  }

  if (provided.length) rebuildBattleIndex(session);
  return provided;
}

`;

    [text, changed] = insertBeforeOnce(
      text,
      "export function addDroneToStack(session, troop, config, effective, events = []) {\n",
      deployFunction,
      "export function deployStartingTroops(session) {",
      "battleModel.js/função da guarnição",
    );
    if (changed) changes.push("função genérica de guarnição adicionada");
  }

  if (!text.includes("selectedTroop.missionProvided && selectedTroop.lockedPlacement")) {
    const oldRemoval = `  const index = session.troops.findIndex((troop) => !troop.dead && troop.row === row && troop.col === col);
  if (index < 0) return { ok: false, reason: "Nenhuma unidade nessa célula." };
  const [troop] = session.troops.splice(index, 1);`;
    const newRemoval = `  const index = session.troops.findIndex((troop) => !troop.dead && troop.row === row && troop.col === col);
  if (index < 0) return { ok: false, reason: "Nenhuma unidade nessa célula." };
  const selectedTroop = session.troops[index];
  if (selectedTroop.missionProvided && selectedTroop.lockedPlacement) {
    return {
      ok: false,
      reason: "Esta tropa faz parte da defesa inicial da missão e não pode ser removida.",
    };
  }
  const [troop] = session.troops.splice(index, 1);`;

    [text, changed] = replaceOnce(
      text,
      oldRemoval,
      newRemoval,
      "battleModel.js/proteção contra remoção",
    );
    if (changed) changes.push("guarnição protegida contra remoção manual");
  }

  return [text, changes];
}

function main() {
  for (const relative of REQUIRED_REPO_FILES) {
    const target = path.join(repoRoot, relative);
    if (!fs.existsSync(target)) {
      throw new PatchError(`Arquivo obrigatório não encontrado: ${relative}`);
    }
  }

  const content = read(path.join(repoRoot, "src/game/content.js"));
  for (const troopId of ["bastiaoMare", "fuzileiroVoltaico", "medicaNanites"]) {
    if (!content.includes(`  ${troopId}: {`)) {
      throw new PatchError(
        `A tropa ${troopId} não foi encontrada em src/game/content.js.`,
      );
    }
  }

  const patches = [
    ["src/game/chapterFivePhases.js", patchChapterFivePhases],
    ["src/game/chapterFiveWaves.js", patchChapterFiveWaves],
    ["src/game/battleModel.js", patchBattleModel],
  ];

  const planned = new Map();
  const reports = [];

  for (const [relative, patcher] of patches) {
    const target = path.join(repoRoot, relative);
    const original = read(target);
    const [patched, changes] = patcher(original);
    planned.set(relative, patched);
    reports.push({ relative, changes });
  }

  // Grava somente depois que todos os patchers concluírem com sucesso.
  for (const [relative, patched] of planned) {
    write(path.join(repoRoot, relative), patched);
  }

  for (const relative of PAYLOAD_FILES) {
    const source = path.join(PAYLOAD_ROOT, relative);
    const destination = path.join(repoRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }

  const appliedChanges = reports.flatMap((report) =>
    report.changes.map((change) => `${report.relative}: ${change}`),
  );

  if (appliedChanges.length) {
    console.log("Alterações aplicadas:");
    appliedChanges.forEach((change) => console.log(`- ${change}`));
  } else {
    console.log("As configurações principais já estavam aplicadas.");
  }

  console.log("- testes da Fase 40 atualizados");
}

try {
  main();
} catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
