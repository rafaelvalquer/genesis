import { ENEMIES } from "./content.js";
import { CELL } from "./visualGeometry.js";
import { getBattleIndex, livingEnemyById } from "./battleIndex.js";

const MODES = ["combo1", "combo2", "combo3"];

export function isExecutorArco(config) {
  return config?.id === "executorArco";
}

function setExecutorState(troop, state, elapsed) {
  if (troop.state === state) return;
  troop.state = state;
  troop.stateStartedAt = elapsed;
}

function enemyPriority(enemy) {
  if (enemy.variant === "alpha") return 2;
  return ENEMIES[enemy.type]?.role?.includes("Elite") ? 1 : 0;
}

export function isEnemyWithinExecutorRange(troop, enemy, config) {
  if (!troop || !enemy || enemy.dead || enemy.hp <= 0) return false;
  if (enemy.row !== troop.row || enemy.x < troop.x) return false;
  if (enemy.airborne || ENEMIES[enemy.type]?.airborne) return false;
  return enemy.x - troop.x <= config.range * CELL.width;
}

export function isEnemyWithinExecutorRangedRange(troop, enemy, config) {
  if (!troop || !enemy || enemy.dead || enemy.hp <= 0) return false;
  if (enemy.row !== troop.row || enemy.x < troop.x) return false;
  if (enemy.airborne || ENEMIES[enemy.type]?.airborne) return false;
  const distance = enemy.x - troop.x;
  return distance > config.range * CELL.width
    && distance <= config.rangedRange * CELL.width;
}

export function selectExecutorRangedTarget(session, troop, config, { blockingX = Infinity } = {}) {
  let selected = null;
  const candidates = getBattleIndex(session)?.enemiesByRow[troop.row] || session.enemies;
  for (const enemy of candidates) {
    if (!isEnemyWithinExecutorRangedRange(troop, enemy, config) || enemy.x >= blockingX) continue;
    if (!selected
      || enemy.x < selected.x
      || (enemy.x === selected.x && enemyPriority(enemy) > enemyPriority(selected))
      || (enemy.x === selected.x && enemyPriority(enemy) === enemyPriority(selected) && enemy.hp > selected.hp)
      || (enemy.x === selected.x && enemyPriority(enemy) === enemyPriority(selected)
        && enemy.hp === selected.hp && String(enemy.id).localeCompare(String(selected.id)) < 0)) selected = enemy;
  }
  return selected;
}

export function selectExecutorTarget(session, troop, config, enemyColumn, { blockingX = Infinity } = {}) {
  let selected = null;
  const candidates = getBattleIndex(session)?.enemiesByRow[troop.row] || session.enemies;
  for (const enemy of candidates) {
    if (!isEnemyWithinExecutorRange(troop, enemy, config) || enemy.x >= blockingX) continue;
    const enemyInTile = Number(enemyColumn(enemy) === troop.col);
    const selectedInTile = Number(selected && enemyColumn(selected) === troop.col);
    if (!selected
      || enemyInTile > selectedInTile
      || (enemyInTile === selectedInTile && enemy.x < selected.x)
      || (enemyInTile === selectedInTile && enemy.x === selected.x
        && enemyPriority(enemy) > enemyPriority(selected))
      || (enemyInTile === selectedInTile && enemy.x === selected.x
        && enemyPriority(enemy) === enemyPriority(selected) && enemy.hp > selected.hp)
      || (enemyInTile === selectedInTile && enemy.x === selected.x
        && enemyPriority(enemy) === enemyPriority(selected) && enemy.hp === selected.hp
        && String(enemy.id).localeCompare(String(selected.id)) < 0)) selected = enemy;
  }
  return selected;
}

export function resetExecutorCombo(
  troop,
  elapsed,
  events = null,
  services = null,
  reason = "reset",
  preserveVisual = false,
) {
  const hadCombo = troop.comboStep > 0 || Boolean(troop.comboTargetId);
  const previousTargetId = troop.comboTargetId;
  const previousTargetKind = troop.comboTargetKind || "enemy";
  troop.comboStep = 0;
  troop.comboTargetId = null;
  troop.comboTargetKind = null;
  troop.comboExpiresAt = null;
  troop.pendingComboImpact = null;
  troop.attackTargetId = null;
  if (!preserveVisual) {
    troop.lastAttackMode = null;
    troop.lastAttackAt = -Infinity;
    setExecutorState(troop, "idle", elapsed);
  }
  if (hadCombo && events && services) {
    events.push({
      type: "executorComboReset",
      sourceTroopId: troop.id,
      targetKind: previousTargetKind,
      targetId: previousTargetId,
      x: troop.x,
      y: troop.y,
      reason,
      color: services.color,
      seed: services.nextEffectSeed(),
    });
  }
}

function startExecutorAttack(session, troop, config, target, services) {
  const mode = MODES[troop.comboStep] || MODES[0];
  const visual = config.attackVisuals[mode];
  troop.comboTargetId = target.entity.id;
  troop.comboTargetKind = target.kind;
  troop.attackTargetId = target.entity.id;
  troop.lastAttackMode = mode;
  troop.lastAttackAt = session.elapsed;
  troop.state = visual.state;
  troop.stateStartedAt = session.elapsed;
  troop.attackBusyUntil = session.elapsed + visual.durationMs;
  troop.pendingComboImpact = {
    mode,
    targetKind: target.kind,
    targetId: target.entity.id,
    impactAt: session.elapsed + visual.impactMs,
  };
  troop.attackReadyAt = session.elapsed + services.recoveryFor(visual.recoveryMs);
}

function startExecutorRangedAttack(session, troop, config, target, services) {
  const visual = config.rangedAttackVisual;
  troop.attackTargetId = target.entity.id;
  troop.lastAttackMode = "ranged";
  troop.lastAttackAt = session.elapsed;
  troop.state = visual.state;
  troop.stateStartedAt = session.elapsed;
  troop.attackBusyUntil = session.elapsed + visual.durationMs;
  troop.attackReadyAt = session.elapsed + services.recoveryFor(config.rangedAttackEveryMs);
  services.launchRangedSlash(troop, target, visual);
}

function enemiesInTargetTile(session, target, enemyColumn) {
  const column = enemyColumn(target);
  return session.enemies.filter((enemy) =>
    !enemy.dead
    && enemy.hp > 0
    && enemy.row === target.row
    && enemyColumn(enemy) === column);
}

function pushSlashEvent(session, troop, config, target, targetKind, mode, events, services) {
  const point = targetKind === "forestObstacle" ? services.forestHitPoint(target) : { x: target.x, y: target.y };
  events.push({
    type: "executorSlash",
    combo: mode === "combo1" ? 1 : 2,
    sourceTroopId: troop.id,
    targetKind,
    targetId: target.id,
    x: point.x,
    y: point.y,
    color: config.color,
    seed: services.nextEffectSeed(),
  });
}

function applyExecutorFinisher(session, troop, config, target, targetKind, events, services) {
  if (targetKind === "forestObstacle") {
    const damage = config.combo3Damage;
    services.damageForestObstacle(target, damage);
    const point = services.forestHitPoint(target);
    events.push({ type: "executorFinisher", sourceTroopId: troop.id, targetKind, targetId: target.id, targetIds: [target.id], row: target.row, x: point.x, y: point.y, damage, collateralDamage: 0, color: config.color, seed: services.nextEffectSeed(), shake: 6, lightRadius: CELL.width * .65 });
    resetExecutorCombo(troop, session.elapsed, null, null, "complete", true);
    return;
  }
  const occupants = enemiesInTargetTile(session, target, services.enemyColumn);
  const primaryDamage = config.combo3Damage * services.damageMultiplier(target);
  const collateralDamage = primaryDamage * config.combo3CollateralFactor;
  const row = target.row;
  const col = services.enemyColumn(target);
  const x = target.x;
  const y = target.y;
  const targetIds = occupants.map((enemy) => enemy.id);

  services.damageEnemy(target, primaryDamage);
  for (const enemy of occupants) {
    if (enemy.id === target.id || enemy.dead) continue;
    services.damageEnemy(enemy, collateralDamage);
  }

  events.push({
    type: "executorFinisher",
    sourceTroopId: troop.id,
    targetKind,
    targetId: target.id,
    targetIds,
    row,
    col,
    x,
    y,
    damage: primaryDamage,
    collateralDamage,
    color: config.color,
    seed: services.nextEffectSeed(),
    shake: 6,
    lightRadius: CELL.width * 0.65,
  });
  resetExecutorCombo(troop, session.elapsed, null, null, "complete", true);
}

function resolveExecutorImpact(session, troop, config, events, services) {
  const impact = troop.pendingComboImpact;
  troop.pendingComboImpact = null;
  if (!impact) return;
  const targetKind = impact.targetKind || "enemy";
  const target = targetKind === "forestObstacle"
    ? services.resolveForestTarget(impact.targetId)
    : (getBattleIndex(session) ? livingEnemyById(getBattleIndex(session), impact.targetId) : session.enemies.find((enemy) => enemy.id === impact.targetId && !enemy.dead));
  const inRange = target && (targetKind === "forestObstacle" ? services.isForestInRange(troop, target, config.range) : isEnemyWithinExecutorRange(troop, target, config));
  if (!target || !inRange) {
    resetExecutorCombo(troop, session.elapsed, events, services, target ? "outOfRange" : "targetLost");
    return;
  }

  switch (impact.mode) {
    case "combo1": {
      const damage = targetKind === "forestObstacle" ? config.combo1Damage : config.combo1Damage * services.damageMultiplier(target);
      targetKind === "forestObstacle" ? services.damageForestObstacle(target, damage) : services.damageEnemy(target, damage);
      pushSlashEvent(session, troop, config, target, targetKind, impact.mode, events, services);
      if (targetKind === "forestObstacle" ? !target.alive : target.dead) {
        resetExecutorCombo(troop, session.elapsed, events, services, "targetDefeated");
        return;
      }
      troop.comboStep = 1;
      troop.comboExpiresAt = session.elapsed + config.comboWindowMs;
      return;
    }
    case "combo2": {
      const damage = targetKind === "forestObstacle" ? config.combo2Damage : config.combo2Damage * services.damageMultiplier(target);
      targetKind === "forestObstacle" ? services.damageForestObstacle(target, damage) : services.damageEnemy(target, damage);
      pushSlashEvent(session, troop, config, target, targetKind, impact.mode, events, services);
      if (targetKind === "forestObstacle" ? !target.alive : target.dead) {
        resetExecutorCombo(troop, session.elapsed, events, services, "targetDefeated");
        return;
      }
      troop.comboStep = 2;
      troop.comboExpiresAt = session.elapsed + config.comboWindowMs;
      return;
    }
    case "combo3":
      applyExecutorFinisher(session, troop, config, target, targetKind, events, services);
      return;
    default:
      resetExecutorCombo(troop, session.elapsed, events, services, "invalidImpact");
  }
}

export function updateExecutorArco(session, troop, config, events, services) {
  if (troop.pendingComboImpact && session.elapsed >= troop.pendingComboImpact.impactAt) {
    resolveExecutorImpact(session, troop, config, events, services);
  }
  if (troop.pendingComboImpact || session.elapsed < troop.attackBusyUntil) return;

  if (troop.comboStep > 0
    && Number.isFinite(troop.comboExpiresAt)
    && session.elapsed >= troop.comboExpiresAt) {
    resetExecutorCombo(troop, session.elapsed, events, services, "expired");
  }

  const blockingForest = services.getForestTarget(troop, config.rangedRange);
  const blockingX = blockingForest?.x ?? Infinity;
  const lockedKind = troop.comboTargetKind || "enemy";
  let target = troop.comboTargetId
    ? (lockedKind === "forestObstacle"
      ? services.resolveForestTarget(troop.comboTargetId)
      : (getBattleIndex(session)
        ? livingEnemyById(getBattleIndex(session), troop.comboTargetId)
        : session.enemies.find((enemy) => enemy.id === troop.comboTargetId && !enemy.dead)))
    : null;
  if (troop.comboTargetId && !target) {
    resetExecutorCombo(troop, session.elapsed, events, services, "targetLost");
  }
  if (target && !(lockedKind === "forestObstacle"
    ? services.isForestInRange(troop, target, config.range)
    : isEnemyWithinExecutorRange(troop, target, config))) {
    resetExecutorCombo(troop, session.elapsed, events, services, "outOfRange");
    target = null;
  }
  if (target) target = { kind: lockedKind, entity: target };
  if (!target) {
    const enemy = selectExecutorTarget(session, troop, config, services.enemyColumn, { blockingX });
    target = enemy ? { kind: "enemy", entity: enemy } : (blockingForest && services.isForestInRange(troop, blockingForest, config.range) ? { kind: "forestObstacle", entity: blockingForest } : null);
    if (target) {
      troop.comboTargetId = target.entity.id;
      troop.comboTargetKind = target.kind;
    }
  }
  if (target) {
    if (session.elapsed >= troop.attackReadyAt) {
      startExecutorAttack(session, troop, config, target, services);
    }
    return;
  }

  const rangedEnemy = selectExecutorRangedTarget(session, troop, config, { blockingX });
  const rangedTarget = rangedEnemy ? { kind: "enemy", entity: rangedEnemy } : (blockingForest && services.isForestInRange(troop, blockingForest, config.rangedRange, config.range) ? { kind: "forestObstacle", entity: blockingForest } : null);
  if (rangedTarget) {
    if (session.elapsed >= troop.attackReadyAt) {
      startExecutorRangedAttack(session, troop, config, rangedTarget, services);
    }
    return;
  }

  troop.attackTargetId = null;
  setExecutorState(troop, "idle", session.elapsed);
}

export function forceExecutorComboStep(session, step, config, enemyColumn) {
  const troop = [...session.troops]
    .reverse()
    .find((candidate) => !candidate.dead && candidate.type === config.id);
  if (!troop) return { ok: false, reason: "Implante um Vórtice antes de forçar o combo." };
  if (troop.pendingComboImpact || session.elapsed < troop.attackBusyUntil) {
    return { ok: false, reason: "O Vórtice ainda está executando um golpe." };
  }
  const target = troop.comboTargetId
    ? session.enemies.find((enemy) =>
      enemy.id === troop.comboTargetId && isEnemyWithinExecutorRange(troop, enemy, config))
    : selectExecutorTarget(session, troop, config, enemyColumn);
  if (!target) return { ok: false, reason: "Nenhum alvo terrestre válido está ao alcance." };
  const normalized = Math.max(1, Math.min(3, Math.floor(Number(step) || 1)));
  troop.comboStep = normalized - 1;
  troop.comboTargetId = target.id;
  troop.comboTargetKind = "enemy";
  troop.comboExpiresAt = normalized === 1 ? null : session.elapsed + config.comboWindowMs;
  troop.pendingComboImpact = null;
  troop.attackTargetId = null;
  troop.attackReadyAt = session.elapsed;
  troop.lastAttackMode = null;
  troop.lastAttackAt = -Infinity;
  setExecutorState(troop, "idle", session.elapsed);
  return { ok: true, troop, target, step: normalized };
}
