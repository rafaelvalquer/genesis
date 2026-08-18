import { CELL, FIELD } from "./visualGeometry.js";

const rows = () => Array.from({ length: FIELD.rows }, (_, row) => row);
const riftCols = [2, 3, 4, 5, 6, 7];
const phaseFor = (enemy) => enemy.hp / Math.max(1, enemy.maxHp) <= .35 ? 3 : enemy.hp / Math.max(1, enemy.maxHp) <= .70 ? 2 : 1;
const attackName = (state = "") => state.replace(/(Telegraph|Attack)$/, "");
const isAttackState = (state) => /(?:Telegraph|Attack)$/.test(state || "");
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function syncColossoHitZones(enemy, config) {
  const coreFactor = enemy.colossoState === "coreExposed" ? config.core.exposedDamageFactor : config.core.closedDamageFactor;
  enemy.targetableRows = enemy.colossoTargetable ? rows() : [];
  // Zones are intentionally disjoint: attacks through rows 2 and 3 always hit
  // the core, rather than resolving against the head first.
  enemy.hitZones = [
    { part: "leftArm", rows: [0], damageFactor: .45, priority: 1 },
    { part: "head", rows: [1], damageFactor: .7, priority: 2 },
    { part: "core", rows: [2, 3], damageFactor: coreFactor, priority: 3 },
    { part: "rightArm", rows: [4], damageFactor: .45, priority: 1 },
  ];
}

function setState(session, enemy, state, durationMs = Infinity) {
  enemy.colossoState = state;
  enemy.colossoStateStartedAt = session.elapsed;
  enemy.colossoStateEndsAt = Number.isFinite(durationMs) ? session.elapsed + durationMs : Infinity;
  enemy.colossoAttackApplied = false;
  enemy.colossoImpactStarted = false;
  enemy.colossoImpactQueue = [];
  enemy.colossoNextImpactAt = Infinity;
  syncColossoHitZones(enemy, enemy._colossoConfig);
}

function shuffle(session, values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(session.rng() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function chooseRows(session, enemy, count = 1) {
  const fresh = rows().filter((row) => !enemy.colossoRecentRows.includes(row));
  const selected = [...shuffle(session, fresh), ...shuffle(session, rows().filter((row) => enemy.colossoRecentRows.includes(row)))].slice(0, count);
  enemy.colossoRecentRows = [...enemy.colossoRecentRows, ...selected].slice(-6);
  return selected;
}

function rememberCells(enemy, cells) {
  enemy.colossoRecentCells = [...(enemy.colossoRecentCells || []), ...cells.map(({ row, col }) => `${row}:${col}`)].slice(-10);
}

function chooseRiftTarget(session, enemy) {
  const candidates = [];
  for (const row of rows()) for (const col of riftCols) {
    if (!enemy.colossoRifts.some((rift) => rift.row === row && rift.col === col)) candidates.push({ row, col });
  }
  const fresh = candidates.filter(({ row, col }) => !(enemy.colossoRecentCells || []).includes(`${row}:${col}`));
  const target = shuffle(session, fresh.length ? fresh : candidates)[0] || { row: 2, col: 4 };
  rememberCells(enemy, [target]);
  return target;
}

function chooseSlamCells(session, enemy, targetRows, width) {
  const row = targetRows[0] ?? 2;
  const targets = session.troops.filter((troop) => !troop.dead && troop.row === row);
  const preferred = targets.length ? shuffle(session, targets)[0] : null;
  const center = clamp(Number(preferred?.col ?? (3 + Math.floor(session.rng() * 4))), 1, FIELD.cols - 2);
  const start = clamp(center - Math.floor(width / 2), 1, FIELD.cols - width);
  return Array.from({ length: width }, (_, offset) => ({ row, col: start + offset }));
}

function configureAttackTargets(session, enemy, config, attack) {
  const count = attack === "fracture" ? 2 : attack === "seismic" ? 3 : 1;
  enemy.colossoTargetRows = chooseRows(session, enemy, count);
  if (attack === "rift") enemy.colossoRiftTarget = chooseRiftTarget(session, enemy);
  else if (attack === "slam") enemy.colossoTargetCells = chooseSlamCells(session, enemy, enemy.colossoTargetRows, config.slam.width[enemy.colossoPhase]);
  else if (attack === "fracture") enemy.colossoTargetCells = enemy.colossoTargetRows.flatMap((row) => config.fracture.columns.map((col) => ({ row, col })));
  else enemy.colossoTargetCells = [];
}

function startAttack(session, enemy, config, events, attack) {
  enemy.colossoPreviousAttack = attack;
  enemy.colossoRecentAttackSequence = [...(enemy.colossoRecentAttackSequence || []), attack].slice(-4);
  enemy.colossoQueuedAttack = attack;
  configureAttackTargets(session, enemy, config, attack);
  setState(session, enemy, `${attack}Telegraph`, config.attackTelegraphMs[attack][enemy.colossoPhase]);
  events.push({
    type: "colossoTelegraph", bossId: enemy.id, attack, rows: [...enemy.colossoTargetRows],
    cells: [...(enemy.colossoTargetCells || [])], riftTarget: enemy.colossoRiftTarget ? { ...enemy.colossoRiftTarget } : null,
    endsAt: enemy.colossoStateEndsAt,
  });
}

function spawnRift(session, enemy, config, hooks, events) {
  if (enemy.colossoRifts.length >= config.rift.maxActive[enemy.colossoPhase]) return;
  const target = enemy.colossoRiftTarget || chooseRiftTarget(session, enemy);
  const hazard = hooks.createMagmaHazard(target.row, target.col, enemy.id, config.rift.durationMs);
    enemy.colossoRifts.push({ id: hazard.id, row: target.row, col: target.col, startedAt: session.elapsed, endsAt: hazard.endsAt, spawned: false });
  events.push({ type: "colossoRiftOpened", bossId: enemy.id, row: target.row, col: target.col, x: target.col * CELL.width + CELL.width / 2, y: target.row * CELL.height + CELL.height / 2 });
}

function damageCells(session, enemy, cells, damageFactor, config, hooks) {
  for (const troop of session.troops.filter((entry) => !entry.dead && cells.some((cell) => cell.row === entry.row && cell.col === entry.col))) {
    hooks.damageTroop(troop, troop.maxHp * damageFactor);
    troop.stunnedUntil = Math.max(troop.stunnedUntil || 0, session.elapsed + config.slam.stunMs);
  }
}

function impact(session, enemy, config, hooks, events, attack, rowsForImpact = enemy.colossoTargetRows, cells = enemy.colossoTargetCells) {
  if (attack === "rift") spawnRift(session, enemy, config, hooks, events);
  else if (attack === "slam") damageCells(session, enemy, cells, config.slam.damageFactor[enemy.colossoPhase], config, hooks);
  else if (attack === "seismic" || attack === "finalCollapse") {
    const multiplier = attack === "finalCollapse" ? .22 : config.seismic.damageFactor;
    for (const troop of session.troops.filter((entry) => !entry.dead && rowsForImpact.includes(entry.row))) {
      hooks.damageTroop(troop, troop.maxHp * multiplier);
      troop.stunnedUntil = Math.max(troop.stunnedUntil || 0, session.elapsed + config.seismic.stunMs);
    }
  } else if (attack === "fracture") for (const cell of cells) hooks.createMagmaHazard(cell.row, cell.col, enemy.id, config.fracture.durationMs[enemy.colossoPhase]);
  const shake = attack === "slam" ? 8 : attack === "fracture" ? 5 : attack === "seismic" ? 9 : attack === "finalCollapse" ? 10 : 3;
  events.push({ type: "colossoAttackImpact", bossId: enemy.id, attack, rows: [...rowsForImpact], cells: [...cells], shake });
}

function beginAttackImpact(session, enemy, config, hooks, events) {
  const attack = enemy.colossoQueuedAttack;
  enemy.colossoImpactStarted = true;
  if (attack === "fracture") {
    enemy.colossoImpactQueue = [...(enemy.colossoTargetCells || [])];
    enemy.colossoNextImpactAt = session.elapsed;
  } else if (attack === "seismic") {
    enemy.colossoImpactQueue = (enemy.colossoTargetRows || []).map((row) => ({ row }));
    enemy.colossoNextImpactAt = session.elapsed;
  } else {
    impact(session, enemy, config, hooks, events, attack);
    enemy.colossoAttackApplied = true;
  }
}

function updateImpactQueue(session, enemy, config, hooks, events) {
  const attack = enemy.colossoQueuedAttack;
  while (enemy.colossoImpactQueue?.length && session.elapsed >= enemy.colossoNextImpactAt) {
    const next = enemy.colossoImpactQueue.shift();
    if (attack === "fracture") impact(session, enemy, config, hooks, events, attack, [next.row], [next]);
    else impact(session, enemy, config, hooks, events, attack, [next.row], []);
    enemy.colossoNextImpactAt += attack === "fracture" ? config.fracture.cellIntervalMs : config.seismic.rowIntervalMs;
  }
  if (!enemy.colossoImpactQueue.length) enemy.colossoAttackApplied = true;
}

function chooseAttack(session, enemy) {
  const config = enemy._colossoConfig;
  const available = ["slam"];
  if (enemy.colossoRifts.length < config.rift.maxActive[enemy.colossoPhase] && (enemy.colossoRiftSpawnCounts?.[enemy.colossoPhase] || 0) < config.rift.maxSpawnedEnemies[enemy.colossoPhase]) available.unshift("rift");
  if (enemy.colossoPhase >= 2) available.push("fracture");
  if (enemy.colossoPhase >= 3) available.push("seismic");
  const nonRepeating = available.filter((attack) => attack !== enemy.colossoPreviousAttack);
  return shuffle(session, nonRepeating.length ? nonRepeating : available)[0] || "slam";
}

function updateRifts(session, enemy, config, hooks, events) {
  enemy.colossoRifts = enemy.colossoRifts.filter((rift) => session.elapsed < rift.endsAt);
  for (const rift of enemy.colossoRifts) {
    if (rift.spawned || session.elapsed < rift.endsAt - config.rift.durationMs + config.rift.spawnDelayMs) continue;
    const phase = enemy.colossoPhase;
    const available = Math.max(0, config.rift.maxSpawnedEnemies[phase] - (enemy.colossoRiftSpawnCounts?.[phase] || 0));
    if (!available) { rift.spawned = true; continue; }
    const profile = shuffle(session, config.rift.spawnProfiles[phase])[0] || 1;
    const count = Math.min(profile, available);
    rift.spawned = true;
    for (let index = 0; index < count; index += 1) {
      const types = config.rift.spawnTypes[phase - 1];
      const type = types[Math.floor(session.rng() * types.length)];
      hooks.enqueueSpawn({ type, row: rift.row, x: rift.col * CELL.width + CELL.width / 2, spawnSource: "bossRift", summoned: true });
      events.push({ type: "colossoRiftSpawn", bossId: enemy.id, row: rift.row, col: rift.col, enemyType: type });
    }
    enemy.colossoRiftSpawnCounts[phase] += count;
  }
}

function updateFinalCollapse(session, enemy, config, hooks, events) {
  if (session.elapsed < enemy.colossoStateEndsAt) return;
  while ((enemy.colossoCollapseIndex || 0) < enemy.colossoCollapseRows.length && session.elapsed >= enemy.colossoStateEndsAt) {
    const index = enemy.colossoCollapseIndex || 0;
    enemy.colossoTargetRows = [enemy.colossoCollapseRows[index]];
    impact(session, enemy, config, hooks, events, "finalCollapse", enemy.colossoTargetRows, []);
    enemy.colossoCollapseIndex = index + 1;
    enemy.colossoStateEndsAt += config.finalCollapse.rowIntervalMs;
  }
  if (enemy.colossoCollapseIndex >= enemy.colossoCollapseRows.length && session.elapsed >= enemy.colossoStateEndsAt) {
    enemy.colossoQueuedAttack = null;
    setState(session, enemy, "coreExposed", config.core.exposedMs);
  }
}

export function updateColossoCaldeira(session, enemy, config, hooks, events) {
  enemy._colossoConfig = config;
  syncColossoHitZones(enemy, config);
  if (enemy.colossoDying) {
    if (session.elapsed >= enemy.colossoStateEndsAt) { enemy.dead = true; hooks.completeDeath?.(enemy); events.push({ type: "bossDeath", x: enemy.x, y: enemy.y, entity: { ...enemy }, bossId: enemy.id }); }
    return;
  }
  updateRifts(session, enemy, config, hooks, events);
  if (enemy.hp <= 0) { enemy.colossoDying = true; enemy.colossoRifts = []; hooks.clearMagmaHazards?.(enemy.id); hooks.cancelSummons?.(); setState(session, enemy, "death", config.deathDurationMs); events.push({ type: "colossoDeathStarted", bossId: enemy.id, shake: 12 }); return; }
  const phase = phaseFor(enemy);
  if (phase !== enemy.colossoPhase) { enemy.colossoPhase = phase; enemy.colossoTargetable = false; setState(session, enemy, `phaseTransition${phase}`, config.transitionMs); events.push({ type: "colossoPhaseChanged", bossId: enemy.id, phase, shake: phase === 3 ? 7 : 5 }); return; }
  if (!enemy.colossoFinalCollapseUsed && enemy.hp / enemy.maxHp <= .15) {
    enemy.colossoFinalCollapseUsed = true; enemy.colossoQueuedAttack = "finalCollapse"; enemy.colossoCollapseRows = [0, 4, 2]; enemy.colossoCollapseIndex = 0; enemy.colossoTargetRows = [...enemy.colossoCollapseRows];
    setState(session, enemy, "finalCollapse", config.finalCollapse.telegraphMs); events.push({ type: "colossoFinalCollapse", bossId: enemy.id, rows: [...enemy.colossoCollapseRows], shake: 7 }); return;
  }
  if (enemy.colossoState === "spawnAwakening" && session.elapsed >= enemy.colossoStateEndsAt) { enemy.colossoTargetable = true; setState(session, enemy, "idle"); events.push({ type: "colossoAwakened", bossId: enemy.id }); return; }
  if (["phaseTransition2", "phaseTransition3"].includes(enemy.colossoState) && session.elapsed >= enemy.colossoStateEndsAt) { enemy.colossoTargetable = true; setState(session, enemy, "idle"); return; }
  if (enemy.colossoState === "finalCollapse") { updateFinalCollapse(session, enemy, config, hooks, events); return; }
  if (enemy.colossoState === "coreExposed" && session.elapsed >= enemy.colossoStateEndsAt) { setState(session, enemy, "idle"); return; }
  if (enemy.colossoState.endsWith("Telegraph") && session.elapsed >= enemy.colossoStateEndsAt) {
    const attack = attackName(enemy.colossoState); setState(session, enemy, `${attack}Attack`, config.attackExecutionMs[attack]);
    events.push({ type: "colossoAttackStarted", bossId: enemy.id, attack, endsAt: enemy.colossoStateEndsAt }); return;
  }
  if (enemy.colossoState.endsWith("Attack")) {
    const attack = attackName(enemy.colossoState);
    const progress = (session.elapsed - enemy.colossoStateStartedAt) / Math.max(1, config.attackExecutionMs[attack]);
    if (!enemy.colossoImpactStarted && progress >= config.attackImpactProgress[attack]) beginAttackImpact(session, enemy, config, hooks, events);
    updateImpactQueue(session, enemy, config, hooks, events);
    if (session.elapsed >= enemy.colossoStateEndsAt && enemy.colossoAttackApplied) { enemy.colossoQueuedAttack = null; setState(session, enemy, "idle"); enemy.colossoAttackReadyAt = session.elapsed + config.attackCooldownMs[enemy.colossoPhase]; }
    return;
  }
  if (enemy.colossoState !== "idle" || session.elapsed < enemy.colossoAttackReadyAt) return;
  startAttack(session, enemy, config, events, chooseAttack(session, enemy));
}

export function getColossoDamageFactor(enemy, row) { return [...(enemy.hitZones || [])].sort((a, b) => b.priority - a.priority).find((zone) => zone.rows.includes(row))?.damageFactor ?? 1; }

export function getColossoAnimation(enemy, elapsed, frameCounts = {}, reduceMotion = false) {
  const state = enemy?.dead ? "death" : enemy?.colossoState || "idle";
  const count = Math.max(1, Number(frameCounts[state] || 1));
  const elapsedState = Math.max(0, elapsed - Number(enemy?.colossoStateStartedAt || 0));
  const loop = state === "idle" || state === "coreExposed";
  const duration = Math.max(1, Number(enemy?.colossoStateEndsAt || 0) - Number(enemy?.colossoStateStartedAt || 0));
  const frameMs = Number(enemy?._colossoConfig?.animationFrameMs?.[state] || 120);
  // Reduced motion preserves the state silhouette without stopping gameplay.
  const frame = reduceMotion ? (loop ? 0 : Math.min(count - 1, Math.floor(elapsedState / duration * count))) : (loop ? Math.floor(elapsedState / frameMs) % count : Math.min(count - 1, Math.floor(elapsedState / duration * count)));
  return { state, frame, loop };
}

export function forceColossoAttack(session, enemy, attack, config, events = []) {
  if (!enemy || enemy.dead || enemy.type !== "colossoCaldeira") return { ok: false, reason: "Colosso não está ativo." };
  if (enemy.colossoDying || enemy.colossoState !== "idle") return { ok: false, reason: "Aguarde o Colosso terminar a ação atual." };
  const available = ["rift", "slam", ...(enemy.colossoPhase >= 2 ? ["fracture"] : []), ...(enemy.colossoPhase >= 3 ? ["seismic"] : [])];
  if (!available.includes(attack)) return { ok: false, reason: "Ataque indisponível nesta fase." };
  if (attack === "rift" && enemy.colossoRifts.length >= config.rift.maxActive[enemy.colossoPhase]) return { ok: false, reason: "Limite de fissuras ativas atingido." };
  startAttack(session, enemy, config, events, attack);
  return { ok: true, attack };
}

export function debugColosso(session, enemy, action, config, events = []) {
  if (!enemy || enemy.dead || enemy.type !== "colossoCaldeira") return { ok: false, reason: "Colosso não está ativo." };
  if (["phase1", "phase2", "phase3"].includes(action)) {
    const ratio = action === "phase1" ? 1 : action === "phase2" ? .70 : .35;
    enemy.hp = enemy.maxHp * ratio; enemy.colossoPhase = Number(action.at(-1)); enemy.colossoTargetable = enemy.colossoPhase === 1;
    setState(session, enemy, enemy.colossoPhase === 1 ? "idle" : `phaseTransition${enemy.colossoPhase}`, enemy.colossoPhase === 1 ? Infinity : config.transitionMs);
  } else if (action === "exposeCore") setState(session, enemy, "coreExposed", config.core.exposedMs);
  else if (action === "resetCooldowns") { enemy.colossoAttackReadyAt = session.elapsed; enemy.colossoPreviousAttack = null; }
  else if (action === "kill") enemy.hp = 0;
  else return { ok: false, reason: "Ação de depuração desconhecida." };
  events.push({ type: "colossoDebug", bossId: enemy.id, action }); return { ok: true, action };
}
