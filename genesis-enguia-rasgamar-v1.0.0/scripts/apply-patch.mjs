#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const BASE_COMMIT = "842c9baaad8c6f7f1ce8b75129e32135300aeb40";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const argument of argv) {
    if (!argument.startsWith("--")) continue;
    const separator = argument.indexOf("=");
    if (separator < 0) args[argument.slice(2)] = true;
    else args[argument.slice(2, separator)] = argument.slice(separator + 1);
  }
  return args;
}

const args = parseArgs();
const repoRoot = path.resolve(args["repo-root"] || process.cwd());
const force = Boolean(args.force);
const dryRun = Boolean(args["dry-run"]);

function normalize(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function eolOf(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function withEol(text, eol) {
  return normalize(text).replace(/\n/g, eol);
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function ensureRepo() {
  const packageJson = path.join(repoRoot, "package.json");
  if (!fs.existsSync(packageJson)) throw new Error(`package.json não encontrado em ${repoRoot}`);
  const pkg = JSON.parse(readText(packageJson));
  if (pkg.name !== "genesis-defense") {
    throw new Error(`Repositório incompatível: package.json.name=${pkg.name || "<vazio>"}`);
  }
}

function currentCommit() {
  try {
    return execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  repoRoot,
  ".genesis-backups",
  `enguia-rasgamar-v${VERSION}`,
  timestamp,
);
const backupFilesRoot = path.join(backupRoot, "files");
const manifestPath = path.join(backupRoot, "manifest.json");
const touched = new Map();

function remember(relativePath) {
  if (touched.has(relativePath)) return;
  const absolutePath = path.join(repoRoot, relativePath);
  const existed = fs.existsSync(absolutePath);
  const entry = { path: relativePath, existed, backupPath: null };
  if (existed && !dryRun) {
    const backupPath = path.join(backupFilesRoot, relativePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(absolutePath, backupPath);
    entry.backupPath = path.relative(backupRoot, backupPath).replace(/\\/g, "/");
  }
  touched.set(relativePath, entry);
}

function writeFile(relativePath, content, preserveEol = true) {
  const absolutePath = path.join(repoRoot, relativePath);
  const previous = fs.existsSync(absolutePath) ? readText(absolutePath) : null;
  const eol = preserveEol && previous != null ? eolOf(previous) : "\n";
  const output = withEol(content, eol);
  if (previous != null && normalize(previous) === normalize(output)) return false;
  remember(relativePath);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, output, "utf8");
  }
  console.log(`${dryRun ? "VALIDARIA" : "ALTERADO"}: ${relativePath}`);
  return true;
}

function replaceExact(relativePath, before, after, label) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`${relativePath}: arquivo ausente`);
  const original = readText(absolutePath);
  const eol = eolOf(original);
  let content = normalize(original);
  const normalizedBefore = normalize(before);
  const normalizedAfter = normalize(after);

  if (content.includes(normalizedAfter)) {
    console.log(`JÁ INSTALADO: ${relativePath} (${label})`);
    return false;
  }

  const occurrences = content.split(normalizedBefore).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `${relativePath}: âncora '${label}' encontrada ${occurrences} vez(es); esperado 1.`,
    );
  }

  content = content.replace(normalizedBefore, normalizedAfter);
  remember(relativePath);
  if (!dryRun) fs.writeFileSync(absolutePath, withEol(content, eol), "utf8");
  console.log(`${dryRun ? "VALIDARIA" : "ALTERADO"}: ${relativePath} (${label})`);
  return true;
}

function replaceWholeFile(relativePath, payloadRelativePath, expectedOriginal, label) {
  const absolutePath = path.join(repoRoot, relativePath);
  const payloadPath = path.join(packageRoot, "payload", payloadRelativePath);
  const payload = readText(payloadPath);
  const current = fs.existsSync(absolutePath) ? readText(absolutePath) : null;

  if (current != null && normalize(current) === normalize(payload)) {
    console.log(`JÁ INSTALADO: ${relativePath}`);
    return false;
  }

  if (current != null && expectedOriginal) {
    const actualHash = sha256(normalize(current));
    const expectedHash = sha256(normalize(expectedOriginal));
    if (actualHash !== expectedHash && !force) {
      throw new Error(
        `${relativePath}: conteúdo local diverge da base conhecida (${label}). `
        + "Use -Force apenas após revisar suas alterações locais.",
      );
    }
  }

  return writeFile(relativePath, payload);
}

function copyPayload(relativePath) {
  const payloadPath = path.join(packageRoot, "payload", relativePath);
  if (!fs.existsSync(payloadPath)) throw new Error(`Payload ausente: ${relativePath}`);
  return writeFile(relativePath, readText(payloadPath), false);
}

function restoreTouched() {
  if (dryRun) return;
  for (const entry of [...touched.values()].reverse()) {
    const absolutePath = path.join(repoRoot, entry.path);
    if (entry.existed) {
      const backupPath = path.join(backupRoot, entry.backupPath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.copyFileSync(backupPath, absolutePath);
    } else if (fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { force: true });
    }
  }
}

const ORIGINAL_ENEMY_TARGETING = `export const RASGAMAR_SUBMERGED_STATES = new Set([
  "spawnSubmerged",
  "submergedPatrol",
  "submergedApproach",
  "rangedPositioning",
  "tideEscape",
  "dive",
]);

export function isRasgamarSubmerged(enemy) {
  return Boolean(
    enemy?.type === "enguiaRasgamar"
    && (enemy.rasgamarSubmerged || RASGAMAR_SUBMERGED_STATES.has(enemy.rasgamarState)),
  );
}

export function isEnemyTargetable(enemy) {
  if (!enemy || enemy.dead || enemy.hp <= 0) return false;
  if (isRasgamarSubmerged(enemy)) return false;
  if (enemy.type === "leviathanNereida") return Boolean(enemy.leviathanTargetable);
  return true;
}
`;

const ORIGINAL_RASGAMAR_BEHAVIOR = `import { CELL, FIELD } from "../../visualGeometry.js";
import { enemyBehavior } from "../enemyBehavior.js";
export const enguiaRasgamarBehavior = enemyBehavior({
  createState: (session, queued, config) => ({ rasgamarState: "spawnSubmerged", rasgamarStateStartedAt: session.elapsed, rasgamarStateEndsAt: session.elapsed + config.submergedSpawnMs, rasgamarTargetId: null, rasgamarTargetX: null, rasgamarPulseIndexes: [], rasgamarNextActionAt: session.elapsed + config.submergedSpawnMs, rasgamarNextExposureAt: session.elapsed + config.idleSurfaceExposureEveryMs, rasgamarSubmerged: true, rasgamarPatrolCol: null }),
  onSpawn: (session, enemy) => { enemy.x = FIELD.enemyEntryCol * CELL.width + CELL.width / 2; enemy.previousRenderX = enemy.x; enemy.moving = false; },
  update: (runtime, enemy, config, dt, events) => (runtime.updateRasgamar(enemy, config, dt, events), true),
});
`;

const CONTENT_BEFORE = `    rangedCooldownMs: 5500,
    rangedRecoveryMs: 2200,
    idleSurfaceExposureEveryMs: 6000,
`;

const CONTENT_AFTER = `    rangedCooldownMs: 5500,
    rangedRecoveryMs: 2200,
    laneRetargetDiveMs: 480,
    laneRelocationBaseMs: 450,
    laneRelocationPerRowMs: 220,
    laneRelocationCooldownMs: 1200,
    baseAttackDamage: 4,
    baseAttackCooldownMs: 2200,
    idleSurfaceExposureEveryMs: 6000,
`;

const DESCRIPTION_BEFORE = `    description: "Predador abissal bioluminescente que embosca tropas alagadas e cospe muco eletroplasmático a partir da água.",
`;
const DESCRIPTION_AFTER = `    description: "Predador abissal bioluminescente que embosca tropas alagadas, muda de rota ao ficar sem alvos e ataca a base quando não restam tropas.",
`;

const VISUAL_BEFORE = `        submergedPatrol: "swimSubmerged",
        submergedApproach: "swimSubmerged",
        rangedPositioning: "swimSubmerged",
`;
const VISUAL_AFTER = `        submergedPatrol: "swimSubmerged",
        submergedApproach: "swimSubmerged",
        rangedPositioning: "swimSubmerged",
        laneRelocation: "swimSubmerged",
`;

const IMPORT_BEFORE = `import { createEnemyEntity } from "./enemies/enemyFactory.js";
import { getEnemyBehavior } from "./enemies/enemyRegistry.js";
`;
const IMPORT_AFTER = `import { createEnemyEntity } from "./enemies/enemyFactory.js";
import { getEnemyBehavior } from "./enemies/enemyRegistry.js";
import {
  getRasgamarRelocationDuration,
  hasLivingTroopsForRasgamar,
  hasLivingTroopsInRasgamarRow,
  selectRasgamarRelocationRow,
} from "./enemies/chapter05/enguiaRasgamarTactics.js";
`;

const STATE_BEFORE = `  enemy.moving = ["submergedPatrol", "submergedApproach", "rangedPositioning", "tideEscape", "dive"].includes(state);
`;
const STATE_AFTER = `  enemy.moving = ["submergedPatrol", "submergedApproach", "rangedPositioning", "tideEscape", "dive", "laneRelocation"].includes(state);
`;

const MOVE_HELPER_BEFORE = `function moveRasgamarTo(session, enemy, targetX, dt, speedFactor = 1) {
  const distance = targetX - enemy.x;
  if (Math.abs(distance) <= 2) {
    enemy.x = targetX;
    enemy.moving = false;
    return true;
  }
  enemy.x += Math.sign(distance) * enemy.speed * speedFactor * dt / 1000;
  enemy.moving = true;
  return false;
}
`;

const MOVE_HELPER_AFTER = `${MOVE_HELPER_BEFORE}
function clearRasgamarTarget(enemy) {
  enemy.rasgamarTargetId = null;
  enemy.rasgamarTargetX = null;
  enemy.rasgamarPatrolCol = null;
}

function startRasgamarRelocation(session, enemy, config, targetRow, events) {
  clearRasgamarCoil(session, enemy);
  clearRasgamarTarget(enemy);
  enemy.rasgamarBaseAssault = false;
  enemy.rasgamarTargetRow = targetRow;
  enemy.rasgamarRelocationSourceRow = enemy.row;
  enemy.rasgamarRelocationSourceY = enemy.y;
  enemy.rasgamarRelocationDurationMs = getRasgamarRelocationDuration(config, enemy.row, targetRow);
  enemy.rasgamarNextRelocationAt = session.elapsed
    + config.laneRetargetDiveMs
    + enemy.rasgamarRelocationDurationMs
    + config.laneRelocationCooldownMs;
  setRasgamarState(session, enemy, "dive", config.laneRetargetDiveMs);
  events.push({
    type: "rasgamarRelocationStarted",
    enemyId: enemy.id,
    fromRow: enemy.row,
    toRow: targetRow,
    troopCountAtDestination: session.troops.filter((troop) => !troop.dead && troop.row === targetRow).length,
    x: enemy.x,
    y: enemy.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
}

function updateRasgamarLaneRelocation(session, enemy, dt, events) {
  const targetRow = enemy.rasgamarTargetRow;
  if (!Number.isInteger(targetRow)) {
    setRasgamarState(session, enemy, "submergedPatrol");
    return true;
  }
  const duration = Math.max(1, Number(enemy.rasgamarRelocationDurationMs) || 1);
  const progress = clamp((session.elapsed - enemy.rasgamarStateStartedAt) / duration, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const fromY = Number.isFinite(enemy.rasgamarRelocationSourceY)
    ? enemy.rasgamarRelocationSourceY
    : enemy.y;
  const targetY = targetRow * CELL.height + CELL.height / 2;
  enemy.y = fromY + (targetY - fromY) * eased;
  enemy.moving = true;
  if (progress < 1) return true;

  const fromRow = enemy.rasgamarRelocationSourceRow;
  enemy.row = targetRow;
  enemy.y = targetY;
  enemy.rasgamarTargetRow = null;
  enemy.rasgamarRelocationSourceRow = null;
  enemy.rasgamarRelocationSourceY = null;
  enemy.rasgamarRelocationDurationMs = 0;
  rebuildBattleIndex(session);
  setRasgamarState(session, enemy, "submergedPatrol");
  events.push({
    type: "rasgamarRelocationCompleted",
    enemyId: enemy.id,
    fromRow,
    toRow: enemy.row,
    x: enemy.x,
    y: enemy.y,
  });
  return true;
}

function startRasgamarBaseAssault(session, enemy, config, events) {
  const columns = rasgamarFloodedColumns(session, enemy.row).sort((left, right) => left - right);
  if (!columns.length) return false;
  clearRasgamarCoil(session, enemy);
  clearRasgamarTarget(enemy);
  enemy.rasgamarBaseAssault = true;
  enemy.rasgamarTargetX = columns[0] * CELL.width + CELL.width / 2;
  setRasgamarState(session, enemy, "rangedPositioning");
  events.push({
    type: "rasgamarBaseAssaultStarted",
    enemyId: enemy.id,
    row: enemy.row,
    x: enemy.x,
    y: enemy.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
  return true;
}

function applyRasgamarBaseAttack(session, enemy, config, events) {
  const integrityBefore = session.integrity;
  const invulnerable = Boolean(session.sandboxSettings?.invulnerableBase);
  const shielded = !session.sandbox && session.shieldCharges > 0;
  if (shielded) session.shieldCharges -= 1;
  const damageMultiplier = Number(session.currentWaveBaseDamageFactor) || 1;
  const sandboxMultiplier = session.sandboxSettings?.enemyDamageMultiplier ?? 1;
  const requestedDamage = Math.max(1, Math.round(config.baseAttackDamage * damageMultiplier * sandboxMultiplier));
  const damage = shielded || invulnerable ? 0 : requestedDamage;
  if (damage > 0) session.integrity = Math.max(0, session.integrity - damage);
  if (shielded) {
    events.push({
      type: "shieldBlock",
      x: FIELD.baseX,
      y: enemy.y,
      remaining: session.shieldCharges,
    });
  }
  if (damage > 0) events.push({ type: "breach", damage, x: FIELD.baseX, y: enemy.y });
  enemy.rasgamarBaseAttackCount = Number(enemy.rasgamarBaseAttackCount || 0) + 1;
  enemy.rasgamarNextBaseAttackAt = session.elapsed + config.baseAttackCooldownMs;
  events.push({
    type: "rasgamarBaseAttack",
    enemyId: enemy.id,
    row: enemy.row,
    damage,
    requestedDamage,
    shielded,
    integrityBefore,
    integrityAfter: session.integrity,
    x: FIELD.baseX,
    y: enemy.y,
    color: config.color,
    seed: nextEffectSeed(session),
  });
}
`;

const UPDATE_TOP_BEFORE = `function updateRasgamar(session, enemy, config, dt, events) {
  const currentCellFlooded = isTideCellFlooded(session, enemy.row, rasgamarColumn(enemy));
`;
const UPDATE_TOP_AFTER = `function updateRasgamar(session, enemy, config, dt, events) {
  if (enemy.rasgamarState === "laneRelocation") {
    return updateRasgamarLaneRelocation(session, enemy, dt, events);
  }
  if (enemy.rasgamarState === "dive" && Number.isInteger(enemy.rasgamarTargetRow)) {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) {
      setRasgamarState(
        session,
        enemy,
        "laneRelocation",
        Math.max(1, Number(enemy.rasgamarRelocationDurationMs) || 1),
      );
    }
    return true;
  }
  const currentCellFlooded = isTideCellFlooded(session, enemy.row, rasgamarColumn(enemy));
`;

const RANGED_POSITION_BEFORE = `  if (enemy.rasgamarState === "rangedPositioning") {
    if (!target || isTideCellFlooded(session, target.row, target.col)) { setRasgamarState(session, enemy, "submergedPatrol"); return true; }
    if (moveRasgamarTo(session, enemy, enemy.rasgamarTargetX, dt)) setRasgamarState(session, enemy, "rangedEmerge", config.rangedEmergeMs);
    return true;
  }
`;
const RANGED_POSITION_AFTER = `  if (enemy.rasgamarState === "rangedPositioning") {
    if (enemy.rasgamarBaseAssault) {
      if (hasLivingTroopsForRasgamar(session)) {
        enemy.rasgamarBaseAssault = false;
        clearRasgamarTarget(enemy);
        setRasgamarState(session, enemy, "dive", config.laneRetargetDiveMs);
        return true;
      }
      if (moveRasgamarTo(session, enemy, enemy.rasgamarTargetX, dt)) {
        setRasgamarState(session, enemy, "rangedEmerge", config.rangedEmergeMs);
      }
      return true;
    }
    if (!target || isTideCellFlooded(session, target.row, target.col)) {
      clearRasgamarTarget(enemy);
      setRasgamarState(session, enemy, "submergedPatrol");
      return true;
    }
    if (moveRasgamarTo(session, enemy, enemy.rasgamarTargetX, dt)) {
      setRasgamarState(session, enemy, "rangedEmerge", config.rangedEmergeMs);
    }
    return true;
  }
`;

const RANGED_CHARGE_BEFORE = `  if (enemy.rasgamarState === "rangedCharge") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) {
      launchRasgamarDart(session, enemy, config, target, events);
      setRasgamarState(session, enemy, "rangedAttack", config.rangedAttackMs);
    }
    return true;
  }
`;
const RANGED_CHARGE_AFTER = `  if (enemy.rasgamarState === "rangedCharge") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) {
      if (enemy.rasgamarBaseAssault) {
        applyRasgamarBaseAttack(session, enemy, config, events);
      } else if (target) {
        launchRasgamarDart(session, enemy, config, target, events);
      } else {
        clearRasgamarTarget(enemy);
        setRasgamarState(session, enemy, "dive", config.laneRetargetDiveMs);
        return true;
      }
      setRasgamarState(session, enemy, "rangedAttack", config.rangedAttackMs);
    }
    return true;
  }
`;

const DIVE_BEFORE = `  if (enemy.rasgamarState === "dive") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) setRasgamarState(session, enemy, "submergedPatrol");
    return true;
  }
`;
const DIVE_AFTER = `  if (enemy.rasgamarState === "dive") {
    if (session.elapsed >= enemy.rasgamarStateEndsAt) {
      enemy.rasgamarBaseAssault = false;
      clearRasgamarTarget(enemy);
      setRasgamarState(session, enemy, "submergedPatrol");
    }
    return true;
  }
`;

const FALLBACK_BEFORE = `  if (ranged && session.elapsed >= enemy.rasgamarNextActionAt) {
    enemy.rasgamarTargetId = ranged.troop.id;
    enemy.rasgamarTargetX = ranged.x;
    enemy.rasgamarNextActionAt = session.elapsed + config.rangedCooldownMs;
    setRasgamarState(session, enemy, "rangedPositioning");
    return true;
  }
  if (session.elapsed >= enemy.rasgamarNextExposureAt) {
`;
const FALLBACK_AFTER = `  if (ranged && session.elapsed >= enemy.rasgamarNextActionAt) {
    enemy.rasgamarTargetId = ranged.troop.id;
    enemy.rasgamarTargetX = ranged.x;
    enemy.rasgamarNextActionAt = session.elapsed + config.rangedCooldownMs;
    setRasgamarState(session, enemy, "rangedPositioning");
    return true;
  }
  const currentRowHasTroops = hasLivingTroopsInRasgamarRow(session, enemy.row);
  if (!currentRowHasTroops) {
    const hasAnyTroops = hasLivingTroopsForRasgamar(session);
    if (hasAnyTroops && session.elapsed >= Number(enemy.rasgamarNextRelocationAt || 0)) {
      const eligibleRows = Array.from({ length: FIELD.rows }, (_, row) => row)
        .filter((row) => row !== enemy.row && rasgamarFloodedColumns(session, row).length > 0);
      const relocationRow = selectRasgamarRelocationRow(session, enemy, eligibleRows);
      if (Number.isInteger(relocationRow)) {
        startRasgamarRelocation(session, enemy, config, relocationRow, events);
        return true;
      }
    }
    if (!hasAnyTroops && session.elapsed >= Number(enemy.rasgamarNextBaseAttackAt || 0)) {
      if (startRasgamarBaseAssault(session, enemy, config, events)) return true;
    }
  }
  if (session.elapsed >= enemy.rasgamarNextExposureAt) {
`;

function syntaxCheck(relativePath) {
  if (dryRun) return;
  execFileSync(process.execPath, ["--check", path.join(repoRoot, relativePath)], {
    cwd: repoRoot,
    stdio: "pipe",
  });
}

try {
  ensureRepo();
  const commit = currentCommit();
  if (commit && commit !== BASE_COMMIT) {
    const message = `HEAD local ${commit} difere da base validada ${BASE_COMMIT}.`;
    if (!force) console.warn(`AVISO: ${message} A instalação continuará somente se todas as âncoras forem compatíveis.`);
    else console.warn(`AVISO -FORCE: ${message}`);
  }

  replaceWholeFile(
    "src/game/enemyTargeting.js",
    "src/game/enemyTargeting.js",
    ORIGINAL_ENEMY_TARGETING,
    "enemyTargeting original",
  );
  replaceWholeFile(
    "src/game/enemies/chapter05/enguiaRasgamar.js",
    "src/game/enemies/chapter05/enguiaRasgamar.js",
    ORIGINAL_RASGAMAR_BEHAVIOR,
    "comportamento original da Enguia",
  );
  copyPayload("src/game/enemies/chapter05/enguiaRasgamarTactics.js");
  copyPayload("src/game/enemies/chapter05/enguiaRasgamarTactics.test.js");
  copyPayload("scripts/check-rasgamar-relocation-contract.mjs");

  replaceExact("src/game/content.js", CONTENT_BEFORE, CONTENT_AFTER, "configuração da Enguia");
  replaceExact("src/game/content.js", DESCRIPTION_BEFORE, DESCRIPTION_AFTER, "descrição da Enguia");
  replaceExact("src/game/visualGeometry.js", VISUAL_BEFORE, VISUAL_AFTER, "animação laneRelocation");
  replaceExact("src/game/battleModel.js", IMPORT_BEFORE, IMPORT_AFTER, "import das táticas");
  replaceExact("src/game/battleModel.js", STATE_BEFORE, STATE_AFTER, "estado móvel laneRelocation");
  replaceExact("src/game/battleModel.js", MOVE_HELPER_BEFORE, MOVE_HELPER_AFTER, "helpers de relocação e ataque à base");
  replaceExact("src/game/battleModel.js", UPDATE_TOP_BEFORE, UPDATE_TOP_AFTER, "entrada da máquina de estados");
  replaceExact("src/game/battleModel.js", RANGED_POSITION_BEFORE, RANGED_POSITION_AFTER, "posicionamento do ataque à base");
  replaceExact("src/game/battleModel.js", RANGED_CHARGE_BEFORE, RANGED_CHARGE_AFTER, "impacto do ataque à base");
  replaceExact("src/game/battleModel.js", DIVE_BEFORE, DIVE_AFTER, "saída do mergulho");
  replaceExact("src/game/battleModel.js", FALLBACK_BEFORE, FALLBACK_AFTER, "seleção de nova rota e assalto à base");

  const changedFiles = [...touched.keys()];
  for (const relativePath of changedFiles.filter((entry) => /\.(?:js|mjs)$/.test(entry))) {
    syntaxCheck(relativePath);
  }

  let effectiveManifestPath = "<dry-run>";
  if (!dryRun) {
    const latestPath = path.join(
      repoRoot,
      ".genesis-backups",
      `enguia-rasgamar-v${VERSION}`,
      "latest.txt",
    );
    if (touched.size > 0) {
      fs.mkdirSync(backupRoot, { recursive: true });
      const manifest = {
        version: VERSION,
        feature: "Nova mecânica da Enguia Rasgamar",
        baseCommit: BASE_COMMIT,
        installedCommit: commit,
        installedAt: new Date().toISOString(),
        repoRoot,
        files: [...touched.values()],
      };
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      fs.mkdirSync(path.dirname(latestPath), { recursive: true });
      fs.writeFileSync(latestPath, manifestPath, "utf8");
      effectiveManifestPath = manifestPath;
    } else if (fs.existsSync(latestPath)) {
      effectiveManifestPath = fs.readFileSync(latestPath, "utf8").trim();
    } else {
      effectiveManifestPath = "<nenhuma alteração>";
    }
  }

  console.log(`BASE_COMMIT=${BASE_COMMIT}`);
  console.log(`BACKUP_MANIFEST=${effectiveManifestPath}`);
  console.log(`Arquivos alterados: ${touched.size}`);
} catch (error) {
  console.error(`Falha ao aplicar a nova mecânica: ${error.message}`);
  try {
    restoreTouched();
    if (!dryRun && touched.size) console.error("Rollback automático concluído.");
  } catch (rollbackError) {
    console.error(`Falha adicional durante rollback: ${rollbackError.message}`);
  }
  process.exit(1);
}
