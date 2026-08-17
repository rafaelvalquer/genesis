import { CELL, FIELD } from "./visualGeometry.js";

const rows = () => Array.from({ length: FIELD.rows }, (_, row) => row);
const phaseFor = (enemy) => enemy.hp / Math.max(1, enemy.maxHp) <= .35 ? 3 : enemy.hp / Math.max(1, enemy.maxHp) <= .70 ? 2 : 1;
const durations = { rift: [0, 1500, 1250, 1100], slam: [0, 1400, 1200, 1050], fracture: [0, 0, 1700, 1450], seismic: [0, 0, 0, 1400] };

export function syncColossoHitZones(enemy, config) {
  const coreFactor = enemy.colossoState === "coreExposed" ? config.core.exposedDamageFactor : config.core.closedDamageFactor;
  enemy.targetableRows = enemy.colossoTargetable ? rows() : [];
  enemy.hitZones = [
    { part: "leftArm", rows: [0], damageFactor: .45 }, { part: "head", rows: [1, 2], damageFactor: .7 },
    { part: "core", rows: [2, 3], damageFactor: coreFactor }, { part: "rightArm", rows: [4], damageFactor: .45 },
  ];
}

function setState(session, enemy, state, durationMs = Infinity) {
  enemy.colossoState = state; enemy.colossoStateStartedAt = session.elapsed;
  enemy.colossoStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.colossoAttackApplied = false; syncColossoHitZones(enemy, enemy._colossoConfig);
}
function chooseRows(session, enemy, count = 1) {
  const preferred = rows().sort((a, b) => (enemy.colossoRecentRows.includes(a) ? 1 : 0) - (enemy.colossoRecentRows.includes(b) ? 1 : 0) || session.rng() - .5);
  const selected = preferred.slice(0, count); enemy.colossoRecentRows = [...enemy.colossoRecentRows, ...selected].slice(-4); return selected;
}
function spawnRift(session, enemy, config, hooks, events) {
  if (enemy.colossoRifts.length >= config.rift.maxActive[enemy.colossoPhase]) return;
  const row = chooseRows(session, enemy)[0];
  const cols = [2, 3, 4, 5, 6, 7].filter((col) => !enemy.colossoRifts.some((rift) => rift.row === row && rift.col === col));
  const col = cols[Math.floor(session.rng() * cols.length)] ?? 4;
  const hazard = hooks.createMagmaHazard(row, col, enemy.id, config.rift.durationMs);
  const rift = { id: hazard.id, row, col, endsAt: hazard.endsAt, spawned: false }; enemy.colossoRifts.push(rift);
  events.push({ type: "colossoRiftOpened", bossId: enemy.id, row, col, x: col * CELL.width + CELL.width / 2, y: row * CELL.height + CELL.height / 2 });
}
function applyAttack(session, enemy, config, hooks, events) {
  const attack = enemy.colossoQueuedAttack; const targetRows = enemy.colossoTargetRows || [];
  if (attack === "rift") spawnRift(session, enemy, config, hooks, events);
  if (attack === "slam" || attack === "seismic" || attack === "finalCollapse") {
    for (const troop of session.troops.filter((entry) => !entry.dead && targetRows.includes(entry.row))) {
      const damageFactor = attack === "slam" ? config.slam.damageFactor[enemy.colossoPhase] : attack === "finalCollapse" ? .22 : .18;
      hooks.damageTroop(troop, troop.maxHp * damageFactor);
      troop.stunnedUntil = Math.max(troop.stunnedUntil || 0, session.elapsed + config.slam.stunMs);
    }
  }
  if (attack === "fracture") for (const row of targetRows) for (const col of [2, 3, 4, 5, 6]) hooks.createMagmaHazard(row, col, enemy.id, config.fracture.durationMs[enemy.colossoPhase]);
  events.push({ type: "colossoAttackImpact", bossId: enemy.id, attack, rows: targetRows });
}
function chooseAttack(session, enemy) {
  const available = ["slam"];
  if (enemy.colossoRifts.length < enemy._colossoConfig.rift.maxActive[enemy.colossoPhase]) available.unshift("rift");
  if (enemy.colossoPhase >= 2) available.push("fracture"); if (enemy.colossoPhase >= 3) available.push("seismic");
  return available.filter((attack) => attack !== enemy.colossoPreviousAttack)[Math.floor(session.rng() * Math.max(1, available.filter((attack) => attack !== enemy.colossoPreviousAttack).length))] || "rift";
}
function updateRifts(session, enemy, config, hooks, events) {
  enemy.colossoRifts = enemy.colossoRifts.filter((rift) => session.elapsed < rift.endsAt);
  const cap = config.rift.maxActive[enemy.colossoPhase];
  for (const rift of enemy.colossoRifts) {
    if (rift.spawned || session.elapsed < rift.endsAt - config.rift.durationMs + config.rift.spawnDelayMs) continue;
    rift.spawned = true;
    const type = config.rift.spawnTypes[enemy.colossoPhase - 1][Math.floor(session.rng() * config.rift.spawnTypes[enemy.colossoPhase - 1].length)];
    hooks.enqueueSpawn({ type, row: rift.row, x: rift.col * CELL.width + CELL.width / 2, spawnSource: "bossRift", summoned: true });
    events.push({ type: "colossoRiftSpawn", bossId: enemy.id, row: rift.row, col: rift.col, enemyType: type });
  }
  if (enemy.colossoRifts.length > cap) enemy.colossoRifts.splice(0, enemy.colossoRifts.length - cap);
}
export function updateColossoCaldeira(session, enemy, config, hooks, events) {
  enemy._colossoConfig = config; syncColossoHitZones(enemy, config);
  if (enemy.colossoDying) {
    if (session.elapsed >= enemy.colossoStateEndsAt) {
      enemy.dead = true; hooks.completeDeath?.(enemy);
      events.push({ type: "bossDeath", x: enemy.x, y: enemy.y, entity: { ...enemy }, bossId: enemy.id });
    }
    return;
  }
  updateRifts(session, enemy, config, hooks, events);
  if (enemy.hp <= 0) { enemy.colossoDying = true; enemy.colossoRifts = []; hooks.clearMagmaHazards?.(enemy.id); hooks.cancelSummons?.(); setState(session, enemy, "death", config.deathDurationMs); events.push({ type: "colossoDeathStarted", bossId: enemy.id }); return; }
  const phase = phaseFor(enemy); if (phase !== enemy.colossoPhase) { enemy.colossoPhase = phase; setState(session, enemy, phase === 2 ? "phaseTransition2" : "phaseTransition3", config.transitionMs); events.push({ type: "colossoPhaseChanged", bossId: enemy.id, phase }); return; }
  if (!enemy.colossoFinalCollapseUsed && enemy.hp / enemy.maxHp <= .15) {
    enemy.colossoFinalCollapseUsed = true; enemy.colossoQueuedAttack = "finalCollapse";
    enemy.colossoCollapseRows = [0, 4, 2]; enemy.colossoCollapseIndex = 0;
    enemy.colossoTargetRows = [...enemy.colossoCollapseRows];
    setState(session, enemy, "finalCollapse", config.finalCollapse.telegraphMs);
    events.push({ type: "colossoFinalCollapse", bossId: enemy.id, rows: [...enemy.colossoCollapseRows] }); return;
  }
  if (enemy.colossoState === "spawnAwakening" && session.elapsed >= enemy.colossoStateEndsAt) { enemy.colossoTargetable = true; setState(session, enemy, "idle"); events.push({ type: "colossoAwakened", bossId: enemy.id }); return; }
  if (["phaseTransition2", "phaseTransition3"].includes(enemy.colossoState) && session.elapsed >= enemy.colossoStateEndsAt) { setState(session, enemy, "idle"); return; }
  if (enemy.colossoState === "finalCollapse" && session.elapsed >= enemy.colossoStateEndsAt) {
    const collapseRows = enemy.colossoCollapseRows || [];
    const index = enemy.colossoCollapseIndex || 0;
    if (index < collapseRows.length) {
      enemy.colossoTargetRows = [collapseRows[index]];
      applyAttack(session, enemy, config, hooks, events);
      enemy.colossoCollapseIndex = index + 1;
      enemy.colossoStateEndsAt = session.elapsed + 300;
      return;
    }
    enemy.colossoQueuedAttack = null;
    setState(session, enemy, "coreExposed", config.core.exposedMs); return;
  }
  if (enemy.colossoState === "coreExposed" && session.elapsed >= enemy.colossoStateEndsAt) { setState(session, enemy, "idle"); return; }
  if (enemy.colossoQueuedAttack && session.elapsed >= enemy.colossoStateEndsAt) { if (!enemy.colossoAttackApplied) { applyAttack(session, enemy, config, hooks, events); enemy.colossoAttackApplied = true; } enemy.colossoQueuedAttack = null; setState(session, enemy, "idle"); enemy.colossoAttackReadyAt = session.elapsed + config.attackCooldownMs[enemy.colossoPhase]; return; }
  if (enemy.colossoState !== "idle" || session.elapsed < enemy.colossoAttackReadyAt) return;
  const attack = chooseAttack(session, enemy); enemy.colossoPreviousAttack = attack; enemy.colossoQueuedAttack = attack;
  enemy.colossoTargetRows = chooseRows(session, enemy, attack === "fracture" ? 2 : attack === "seismic" ? 3 : 1);
  setState(session, enemy, `${attack}Telegraph`, durations[attack][enemy.colossoPhase]);
  events.push({ type: "colossoTelegraph", bossId: enemy.id, attack, rows: [...enemy.colossoTargetRows], endsAt: enemy.colossoStateEndsAt });
}
export function getColossoDamageFactor(enemy, row) { return enemy.hitZones?.find((zone) => zone.rows.includes(row))?.damageFactor ?? 1; }

export function forceColossoAttack(session, enemy, attack, config, events = []) {
  if (!enemy || enemy.dead || enemy.type !== "colossoCaldeira") return { ok: false, reason: "Colosso não está ativo." };
  if (enemy.colossoDying || enemy.colossoState !== "idle") return { ok: false, reason: "Aguarde o Colosso terminar a ação atual." };
  const available = ["rift", "slam", ...(enemy.colossoPhase >= 2 ? ["fracture"] : []), ...(enemy.colossoPhase >= 3 ? ["seismic"] : [])];
  if (!available.includes(attack)) return { ok: false, reason: "Ataque indisponível nesta fase." };
  if (attack === "rift" && enemy.colossoRifts.length >= config.rift.maxActive[enemy.colossoPhase]) return { ok: false, reason: "Limite de fissuras ativas atingido." };
  enemy.colossoPreviousAttack = attack; enemy.colossoQueuedAttack = attack;
  enemy.colossoTargetRows = chooseRows(session, enemy, attack === "fracture" ? 2 : attack === "seismic" ? 3 : 1);
  setState(session, enemy, `${attack}Telegraph`, durations[attack][enemy.colossoPhase]);
  events.push({ type: "colossoTelegraph", bossId: enemy.id, attack, rows: [...enemy.colossoTargetRows], endsAt: enemy.colossoStateEndsAt });
  return { ok: true, attack };
}

export function debugColosso(session, enemy, action, config, events = []) {
  if (!enemy || enemy.dead || enemy.type !== "colossoCaldeira") return { ok: false, reason: "Colosso não está ativo." };
  if (action === "phase1" || action === "phase2" || action === "phase3") {
    const ratio = action === "phase1" ? 1 : action === "phase2" ? .70 : .35;
    enemy.hp = enemy.maxHp * ratio; enemy.colossoPhase = Number(action.at(-1));
    setState(session, enemy, enemy.colossoPhase === 1 ? "idle" : `phaseTransition${enemy.colossoPhase}`, enemy.colossoPhase === 1 ? Infinity : config.transitionMs);
  } else if (action === "exposeCore") {
    setState(session, enemy, "coreExposed", config.core.exposedMs);
  } else if (action === "resetCooldowns") {
    enemy.colossoAttackReadyAt = session.elapsed; enemy.colossoPreviousAttack = null;
  } else if (action === "kill") {
    enemy.hp = 0;
  } else return { ok: false, reason: "Ação de depuração desconhecida." };
  events.push({ type: "colossoDebug", bossId: enemy.id, action });
  return { ok: true, action };
}
