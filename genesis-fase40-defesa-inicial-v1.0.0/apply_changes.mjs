#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD_ROOT = path.join(PACKAGE_ROOT, "payload");
const REQUIRED_REPO_FILES = [
  "package.json",
  "src/game/chapterFivePhases.js",
  "src/game/battleModel.js",
  "src/game/content.js",
  "src/game/bastiaoMare.js",
  "src/game/fuzileiroVoltaico.js",
];
const PAYLOAD_FILES = [
  "src/game/phase40StartingDefense.test.js",
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
  if (count !== 1) throw new PatchError(`${label}: esperado 1 marcador, encontrado ${count}.`);
  return [text.replace(oldValue, newValue), true];
}

function insertBeforeOnce(text, marker, block, identity, label) {
  if (text.includes(identity)) return [text, false];
  const count = occurrenceCount(text, marker);
  if (count !== 1) throw new PatchError(`${label}: esperado 1 marcador, encontrado ${count}.`);
  return [text.replace(marker, block + marker), true];
}

function patchChapterFivePhases(original) {
  if (!original.includes('"fase_40", "Trono Abissal"')) {
    throw new PatchError("chapterFivePhases.js: configuração da fase 40 não encontrada.");
  }
  if (original.includes("startingTroops:") && original.includes('providedByMission: "fase_40"')) {
    return [original, []];
  }

  const oldValue = String.raw`    { boss: true },
  ),
];`;
  const newValue = String.raw`    {
      boss: true,
      providedByMission: "fase_40",
      startingTroops: [
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
      ],
      startingTroopRules: {
        consumeEnergy: false,
        consumeSupply: false,
        requireLoadout: false,
        removable: false,
        refundable: false,
        countTowardDeploymentLimit: true,
      },
    },
  ),
];`;
  const [patched, changed] = replaceOnce(
    original,
    oldValue,
    newValue,
    "chapterFivePhases.js/defesa inicial",
  );
  return [patched, changed ? ["guarnição gratuita adicionada à fase 40"] : []];
}

function patchBattleModel(original) {
  let text = original;
  const changes = [];
  let changed;

  [text, changed] = replaceOnce(
    text,
    String.raw`  return {
    phase: sessionPhase,`,
    String.raw`  const session = {
    phase: sessionPhase,`,
    "battleModel.js/criação da sessão",
  );
  if (changed) changes.push("sessão materializada antes da inicialização");

  [text, changed] = replaceOnce(
    text,
    String.raw`    deployed: {},
    outcome: null,`,
    String.raw`    deployed: {},
    providedTroops: {},
    outcome: null,`,
    "battleModel.js/contador de tropas fornecidas",
  );
  if (changed) changes.push("contador separado de tropas da missão");

  [text, changed] = replaceOnce(
    text,
    String.raw`  initializeSandboxHazard(session);
  return session;`,
    String.raw`  initializeSandboxHazard(session);
  deployStartingTroops(session);
  return session;`,
    "battleModel.js/implantação inicial",
  );
  if (changed) changes.push("implantação da guarnição durante a criação da sessão");

  const deployFunction = String.raw`export function deployStartingTroops(session) {
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
      throw new Error("Tropa inicial desconhecida na fase " + session.phase.id + ": " + (troopType || "<vazia>") + ".");
    }
    if (!Number.isInteger(row) || row < 0 || row >= FIELD.rows
      || !Number.isInteger(col) || col < FIELD.firstTroopCol || col > FIELD.lastTroopCol) {
      throw new Error("Posição inválida para a tropa inicial " + troopType + ": linha " + row + ", coluna " + col + ".");
    }
    const cellKey = String(row) + ":" + String(col);
    if (occupiedCells.has(cellKey)) {
      throw new Error("Célula inicial duplicada ou ocupada na fase " + session.phase.id + ": " + cellKey + ".");
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
    session.providedTroops[troopType] = (session.providedTroops[troopType] || 0) + 1;
    occupiedCells.add(cellKey);
    provided.push(troop);

    if (rules.consumeEnergy) session.energy = Math.max(0, session.energy - energyCost);
    if (rules.consumeSupply) session.supply = Math.max(0, session.supply - supplyCost);
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
    "battleModel.js/função de tropas iniciais",
  );
  if (changed) changes.push("função genérica para tropas fornecidas pela missão");

  const oldRemoval = String.raw`  const index = session.troops.findIndex((troop) => !troop.dead && troop.row === row && troop.col === col);
  if (index < 0) return { ok: false, reason: "Nenhuma unidade nessa célula." };
  const [troop] = session.troops.splice(index, 1);`;
  const newRemoval = String.raw`  const index = session.troops.findIndex((troop) => !troop.dead && troop.row === row && troop.col === col);
  if (index < 0) return { ok: false, reason: "Nenhuma unidade nessa célula." };
  const selectedTroop = session.troops[index];
  if (selectedTroop.missionProvided && selectedTroop.lockedPlacement) {
    return { ok: false, reason: "Esta tropa faz parte da defesa inicial da missão e não pode ser removida." };
  }
  const [troop] = session.troops.splice(index, 1);`;
  [text, changed] = replaceOnce(
    text,
    oldRemoval,
    newRemoval,
    "battleModel.js/proteção contra remoção",
  );
  if (changed) changes.push("tropas bônus protegidas contra remoção manual");

  return [text, changes];
}

function main() {
  const repoRoot = path.resolve(process.argv[2] || ".");
  for (const relative of REQUIRED_REPO_FILES) {
    if (!fs.existsSync(path.join(repoRoot, relative))) {
      throw new PatchError(`Arquivo obrigatório não encontrado: ${relative}`);
    }
  }

  const content = read(path.join(repoRoot, "src/game/content.js"));
  if (!content.includes('  bastiaoMare: {') || !content.includes('  fuzileiroVoltaico: {')) {
    throw new PatchError("A fase 40 requer Bastião de Maré e Fuzileiro Voltaico instalados no catálogo de tropas.");
  }

  const originals = new Map();
  const planned = new Map();
  const reports = [];
  const patches = [
    ["src/game/chapterFivePhases.js", patchChapterFivePhases],
    ["src/game/battleModel.js", patchBattleModel],
  ];

  for (const [relative, patcher] of patches) {
    const target = path.join(repoRoot, relative);
    const original = read(target);
    originals.set(relative, original);
    const [patched, changes] = patcher(original);
    planned.set(relative, patched);
    reports.push({ file: relative, changes });
  }

  for (const relative of PAYLOAD_FILES) {
    const source = path.join(PAYLOAD_ROOT, relative);
    if (!fs.existsSync(source)) throw new PatchError(`Payload ausente: ${relative}`);
    planned.set(relative, read(source));
    reports.push({ file: relative, changes: ["teste da defesa inicial instalado"] });
  }

  // Só grava depois de todos os pontos de integração serem validados.
  for (const [relative, content] of planned) {
    const target = path.join(repoRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target) || read(target) !== content) write(target, content);
  }

  console.log("\nDefesa inicial da fase 40 aplicada com sucesso.");
  for (const report of reports) {
    console.log(`- ${report.file}: ${report.changes.length ? report.changes.join(", ") : "já estava atualizado"}`);
  }
}

try { main(); }
catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
