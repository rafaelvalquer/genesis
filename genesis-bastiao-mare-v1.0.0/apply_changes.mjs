#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD_ROOT = path.join(PACKAGE_ROOT, "payload");
const REQUIRED_REPO_FILES = [
  "package.json", "src/game/content.js", "src/game/battleModel.js",
  "src/game/tideCycle.js", "src/game/windCurrent.js", "src/game/assetCatalog.js",
];
const NEW_TEXT_FILES = [
  "src/game/bastiaoMare.js",
  "src/game/bastiaoMare.test.js",
  "src/game/bastiaoMare.integration.test.js",
];
const ASSET_ROOT = "src/game/assets/troop/bastiaoMare";

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

function patchContent(original) {
  let text = original;
  const changes = [];
  const block = String.raw`  bastiaoMare: {
    id: "bastiaoMare",
    label: "Bastião de Maré",
    title: "Escudo Capacitor",
    role: "Tanque anfíbio / Geração de energia",
    spriteKey: "bastiaoMare",
    price: 28,
    supply: 8,
    deployCooldownMs: 9000,
    maxDeployed: 3,
    hp: 110,
    range: 0.9,
    attackEveryMs: 1800,
    damage: 3,
    attack: "tileMelee",
    floodedDamageTakenFactor: 0.85,
    energyDamageThreshold: 18,
    floodedEnergyDamageThreshold: 14,
    energyPickupAmount: 1,
    energyPickupLimit: 5,
    energyPickupWindowMs: 10000,
    energyPickupOffset: { x: 6, y: -68 },
    amphibious: true,
    canDeployInFloodedCells: true,
    canDeployInDeepWater: true,
    ignoreTidePressure: true,
    ignoreTideAttackSpeedPenalty: true,
    ignoreTideReactorPause: true,
    anchoredWhenFlooded: true,
    windAnchor: true,
    blockDistancePx: 62,
    color: "#22d3ee",
    unlockAt: 32,
    healthBarOffset: 112,
    healthBarWidth: 78,
    assetStates: ["idle", "attack", "death"],
    idleVisual: {
      state: "idle", height: 138, durationMs: 1280, loop: true,
      timeline: [{ atMs: 0, frame: 0 }],
    },
    attackVisual: {
      state: "attack", height: 138, durationMs: 720, impactMs: 360, loop: false,
      timeline: [{ atMs: 0, frame: 0 }],
    },
    deathVisual: {
      state: "death", height: 138, durationMs: 960, loop: false,
      timeline: [{ atMs: 0, frame: 0 }],
    },
    description:
      "Tanque anfíbio que converte o dano recebido em bolas de energia. Dentro da água, recebe menos dano e carrega o gerador mais rapidamente.",
  },
`;
  let changed;
  [text, changed] = insertBeforeOnce(text, '  fuzileiroVoltaico: {\n', block,
    '  bastiaoMare: {', "content.js/configuração");
  if (changed) changes.push("configuração do Bastião de Maré");

  [text, changed] = replaceOnce(text,
    '["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto"].includes(troop.type)',
    '["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto", "bastiaoMare"].includes(troop.type)',
    "content.js/doutrina de linha de frente");
  if (changed) changes.push("Bastião na doutrina de linha de frente");
  return [text, changes];
}

function patchBattleModel(original) {
  let text = original;
  const changes = [];
  let changed;

  [text, changed] = replaceOnce(text,
    'import { updateFuzileiroVoltaico } from "./fuzileiroVoltaico.js";\n',
    'import { updateFuzileiroVoltaico } from "./fuzileiroVoltaico.js";\nimport { getBastiaoFloodedDamageFactor, recordBastiaoDamage, updateBastiaoMare } from "./bastiaoMare.js";\n',
    "battleModel.js/import");
  if (changed) changes.push("importação do Bastião");

  [text, changed] = replaceOnce(text, String.raw`    ignoreTidePressure: Boolean(config.ignoreTidePressure),
    ignoreTideAttackSpeedPenalty: Boolean(config.ignoreTideAttackSpeedPenalty),
    droneCount: troopId === "droneSentinela" ? 1 : undefined,`, String.raw`    ignoreTidePressure: Boolean(config.ignoreTidePressure),
    ignoreTideAttackSpeedPenalty: Boolean(config.ignoreTideAttackSpeedPenalty),
    ignoreTideReactorPause: Boolean(config.ignoreTideReactorPause),
    anchoredWhenFlooded: Boolean(config.anchoredWhenFlooded),
    floodedDamageTakenFactor: Number(config.floodedDamageTakenFactor) || 1,
    blockDistancePx: Number(config.blockDistancePx) || undefined,
    droneCount: troopId === "droneSentinela" ? 1 : undefined,`, "battleModel.js/flags");
  if (changed) changes.push("propriedades anfíbias e defensivas");

  [text, changed] = replaceOnce(text,
    '    energyAccumulator: 0, lastAttackAt: -Infinity, attackStartedAt: -Infinity,',
    '    energyAccumulator: 0, energyChargeProgress: 0, energyPickupSpawnTimes: [],\n    lastAttackAt: -Infinity, attackStartedAt: -Infinity,',
    "battleModel.js/estado econômico");
  if (changed) changes.push("estado de carga de energia");

  const oldPickup = String.raw`export function trySpawnEnergyPickup(session, source, events = []) {
  const chance = ENEMIES[source?.type]?.energyDropChance;
  if (!chance || source?.variant === "alpha") return null;
  const roll = session.rng();
  if (roll >= chance) return null;
  const pickup = {
    id: id("energy_pickup"),
    x: source.x,
    y: source.y - 28,
    vx: 0,
    vy: 0,
    amount: 1,
    ageMs: 0,
    phase: roll * Math.PI * 2,
  };
  session.energyPickups.push(pickup);
  events.push({ type: "energyDropSpawned", x: pickup.x, y: pickup.y, amount: pickup.amount, color: "#fbbf24" });
  return pickup;
}`;
  const newPickup = String.raw`export function spawnEnergyPickup(session, options = {}, events = []) {
  const pickup = {
    id: id("energy_pickup"),
    x: Number(options.x) || 0,
    y: Number(options.y) || 0,
    vx: 0,
    vy: 0,
    amount: Math.max(1, Number(options.amount) || 1),
    ageMs: 0,
    phase: Number.isFinite(options.phase) ? options.phase : session.rng() * Math.PI * 2,
    sourceTroopId: options.sourceTroopId || null,
    sourceEnemyId: options.sourceEnemyId || null,
  };
  session.energyPickups.push(pickup);
  events.push({
    type: "energyDropSpawned", x: pickup.x, y: pickup.y,
    amount: pickup.amount, color: "#fbbf24",
    sourceTroopId: pickup.sourceTroopId, sourceEnemyId: pickup.sourceEnemyId,
  });
  return pickup;
}

export function trySpawnEnergyPickup(session, source, events = []) {
  const chance = ENEMIES[source?.type]?.energyDropChance;
  if (!chance || source?.variant === "alpha") return null;
  const roll = session.rng();
  if (roll >= chance) return null;
  return spawnEnergyPickup(session, {
    x: source.x,
    y: source.y - 28,
    amount: 1,
    phase: roll * Math.PI * 2,
    sourceEnemyId: source.id,
  }, events);
}`;
  [text, changed] = replaceOnce(text, oldPickup, newPickup, "battleModel.js/pickup genérico");
  if (changed) changes.push("fábrica compartilhada da bola amarela");

  const oldDamage = String.raw`function damageTroop(session, troop, amount, events) {
  if (!troop || troop.dead) return;
  const config = TROOPS[troop.type];
  const defenseFactor = isLumiUrsa7(config) && troop.defenseActive ? config.defenseDamageFactor : 1;
  const lastLineFactor = troop.col <= 1 ? session.modifiers.lastLineDamageTaken : 1;
  const advancedFormationFactor = session.modifiers.advancedFormation
    && session.advancedFormationColumns.includes(troop.col) ? 1.1 : 1;
  const finalFortressFactor = session.activeTemporaryDecisions.includes("final_fortress") ? 0.75 : 1;
  let incoming = amount * defenseFactor * lastLineFactor * advancedFormationFactor * finalFortressFactor
    * electricDamageTakenFactor(troop, session.elapsed)
    * (session.sandboxSettings?.enemyDamageMultiplier ?? 1);
  if (troop.reactiveShield > 0 && session.elapsed < troop.reactiveShieldUntil) {
    const absorbed = Math.min(troop.reactiveShield, incoming);
    troop.reactiveShield -= absorbed;
    incoming -= absorbed;
  }
  troop.hp -= incoming;
  if (session.modifiers.reactiveBarrier && troop.hp > 0 && troop.hp / troop.maxHp < 0.3
    && !session.reactiveBarrierRows.includes(troop.row)) {
    session.reactiveBarrierRows.push(troop.row);
    troop.reactiveShield = troop.maxHp * 0.25;
    troop.reactiveShieldUntil = session.elapsed + 6000;
    events.push({ type: "shieldHit", targetId: troop.id, x: troop.x, y: troop.y, reactive: true });
  }
  if (defenseFactor < 1) {
    events.push({
      type: "shieldHit",
      targetId: troop.id,
      x: troop.x,
      y: troop.y - 46,
      color: config.color,
      seed: nextEffectSeed(session),
    });
  }
  events.push({ type: "troopHit", targetId: troop.id, x: troop.x, y: troop.y });
  if (troop.hp <= 0) {
    eliminateTroop(session, troop, events, session.sandbox ? "sandbox" : "enemy");
  }
}`;
  const newDamage = String.raw`function damageTroop(session, troop, amount, events, context = {}) {
  if (!troop || troop.dead) return 0;
  const config = TROOPS[troop.type];
  const defenseFactor = isLumiUrsa7(config) && troop.defenseActive ? config.defenseDamageFactor : 1;
  const lastLineFactor = troop.col <= 1 ? session.modifiers.lastLineDamageTaken : 1;
  const advancedFormationFactor = session.modifiers.advancedFormation
    && session.advancedFormationColumns.includes(troop.col) ? 1.1 : 1;
  const finalFortressFactor = session.activeTemporaryDecisions.includes("final_fortress") ? 0.75 : 1;
  const flooded = isTideCellFlooded(session, troop.row, troop.col);
  const bastiaoFactor = config.id === "bastiaoMare"
    ? getBastiaoFloodedDamageFactor(config, flooded)
    : 1;
  let incoming = amount * defenseFactor * lastLineFactor * advancedFormationFactor
    * finalFortressFactor * bastiaoFactor
    * electricDamageTakenFactor(troop, session.elapsed)
    * (session.sandboxSettings?.enemyDamageMultiplier ?? 1);
  if (troop.reactiveShield > 0 && session.elapsed < troop.reactiveShieldUntil) {
    const absorbed = Math.min(troop.reactiveShield, incoming);
    troop.reactiveShield -= absorbed;
    incoming -= absorbed;
  }
  const hpBefore = Math.max(0, troop.hp);
  const actualHpDamage = Math.min(hpBefore, Math.max(0, incoming));
  troop.hp = hpBefore - actualHpDamage;
  if (session.modifiers.reactiveBarrier && troop.hp > 0 && troop.hp / troop.maxHp < 0.3
    && !session.reactiveBarrierRows.includes(troop.row)) {
    session.reactiveBarrierRows.push(troop.row);
    troop.reactiveShield = troop.maxHp * 0.25;
    troop.reactiveShieldUntil = session.elapsed + 6000;
    events.push({ type: "shieldHit", targetId: troop.id, x: troop.x, y: troop.y, reactive: true });
  }
  if (defenseFactor < 1 || bastiaoFactor < 1) {
    events.push({
      type: "shieldHit",
      targetId: troop.id,
      x: troop.x,
      y: troop.y - 46,
      color: config.color,
      seed: nextEffectSeed(session),
    });
  }
  events.push({
    type: "troopHit", targetId: troop.id, x: troop.x, y: troop.y,
    amount: Math.round(actualHpDamage),
  });
  if (config.id === "bastiaoMare" && context.generateEnergy !== false && actualHpDamage > 0) {
    recordBastiaoDamage(session, troop, actualHpDamage, events, {
      config,
      flooded,
      spawnEnergyPickup,
    });
  }
  if (troop.hp <= 0) {
    eliminateTroop(session, troop, events, session.sandbox ? "sandbox" : "enemy");
  }
  return actualHpDamage;
}`;
  [text, changed] = replaceOnce(text, oldDamage, newDamage, "battleModel.js/dano e geração");
  if (changed) changes.push("redução aquática e carga por dano real");

  const handler = String.raw`    if (config.id === "bastiaoMare") {
      updateBastiaoMare(session, troop, config, events, {
        cellWidth: CELL.width,
        enemiesForRow: (row) => enemiesForRow(session, row),
        occupiesTargetRow: enemyOccupiesTargetRow,
        damageEnemy: (target, damage, context) =>
          damageEnemy(session, target, damage, events, context),
        damageMultiplier: (target) => attackDamageMultiplier(session, troop, { target }),
        recoveryFor: (milliseconds) => attackIntervalFor(session, troop, config, milliseconds),
        nextEffectSeed: () => nextEffectSeed(session),
      });
      continue;
    }
`;
  [text, changed] = insertBeforeOnce(text,
    '    if (config.attack === "flame") {\n', handler,
    '    if (config.id === "bastiaoMare") {', "battleModel.js/ciclo de ataque");
  if (changed) changes.push("golpe de escudo com idle/attack");

  [text, changed] = replaceOnce(text, String.raw`function troopBlockDistance(troop) {
  return troop?.type === "colossoImpacto" ? 48 : 54;
}`, String.raw`function troopBlockDistance(troop) {
  return Number(troop?.blockDistancePx || TROOPS[troop?.type]?.blockDistancePx)
    || (troop?.type === "colossoImpacto" ? 48 : 54);
}`, "battleModel.js/bloqueio");
  if (changed) changes.push("distância de bloqueio do escudo");

  [text, changed] = replaceOnce(text, String.raw`  const blocked = rowTroops.some((troop) => GORJAL_ANCHORS.has(troop.type))
    || rowTroops.some((troop) => troop.col - 1 < FIELD.firstTroopCol)`, String.raw`  const blocked = rowTroops.some((troop) => GORJAL_ANCHORS.has(troop.type)
      || (troop.anchoredWhenFlooded && isTideCellFlooded(session, troop.row, troop.col)))
    || rowTroops.some((troop) => troop.col - 1 < FIELD.firstTroopCol)`, "battleModel.js/ancoragem");
  if (changed) changes.push("ancoragem contra empurrão quando alagado");

  [text, changed] = replaceOnce(text,
    '["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto"].includes(troopId)',
    '["colono", "lumiUrsa7", "muralhaReforcada", "colossoImpacto", "bastiaoMare"].includes(troopId)',
    "battleModel.js/doutrina de linha de frente");
  if (changed) changes.push("HP da doutrina de linha de frente");

  return [text, changes];
}

function patchWindCurrent(original) {
  let text = original;
  const changes = [];
  let changed;
  [text, changed] = replaceOnce(text,
    '  dependencies.damageTroop?.(session, troop, damage, events);',
    '  dependencies.damageTroop?.(session, troop, damage, events, { generateEnergy: false, environmental: true });',
    "windCurrent.js/dano ambiental");
  if (changed) changes.push("colisão de vento não gera energia");
  return [text, changes];
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dst = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function main() {
  const repoRoot = path.resolve(process.argv[2] || ".");
  for (const relative of REQUIRED_REPO_FILES) {
    if (!fs.existsSync(path.join(repoRoot, relative))) {
      throw new PatchError(`Arquivo obrigatório não encontrado: ${relative}`);
    }
  }
  if (!read(path.join(repoRoot, "src/game/content.js")).includes('  fuzileiroVoltaico: {')) {
    throw new PatchError("Esta versão requer o repositório atualizado com o Fuzileiro Voltaico (commit 7466334 ou posterior).");
  }

  const reports = [];
  const patches = [
    ["src/game/content.js", patchContent],
    ["src/game/battleModel.js", patchBattleModel],
    ["src/game/windCurrent.js", patchWindCurrent],
  ];
  for (const [relative, patcher] of patches) {
    const target = path.join(repoRoot, relative);
    const [patched, changes] = patcher(read(target));
    if (patched !== read(target)) write(target, patched);
    reports.push({ file: relative, changes });
  }

  for (const relative of NEW_TEXT_FILES) {
    const source = path.join(PAYLOAD_ROOT, relative);
    const target = path.join(repoRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  copyDirectory(path.join(PAYLOAD_ROOT, ASSET_ROOT), path.join(repoRoot, ASSET_ROOT));

  console.log("\nBastião de Maré aplicado com sucesso.");
  for (const report of reports) {
    console.log(`- ${report.file}: ${report.changes.length ? report.changes.join(", ") : "já estava atualizado"}`);
  }
}

try { main(); }
catch (error) {
  console.error(`\n[ERRO] ${error.message}`);
  process.exitCode = 1;
}
