import { CELL, FIELD } from "./visualGeometry.js";
import { isEnemyTargetable } from "./enemyTargeting.js";
import { isTideCellFlooded } from "./tideCycle.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function voltaicEnemyColumn(enemy) {
  return clamp(Math.floor(Number(enemy?.x || 0) / CELL.width), 0, FIELD.cols - 1);
}

export function isVoltaicEnemyInWater(session, enemy) {
  if (!enemy) return false;
  return isTideCellFlooded(session, enemy.row, voltaicEnemyColumn(enemy));
}

export function calculateVoltaicDamage(baseDamage, inWater, config, primary = false) {
  const factor = primary
    ? inWater ? config.primaryWaterDamageFactor : 1
    : inWater ? config.secondaryWaterDamageFactor : config.secondaryDamageFactor;
  return Math.max(0, Number(baseDamage) || 0) * factor;
}

export function selectVoltaicPrimaryTarget(
  session,
  troop,
  config,
  occupiesTargetRow = (enemy, row) => enemy?.row === row,
) {
  const maximumDistance = config.range * CELL.width;
  return session.enemies
    .filter((enemy) => (
      isEnemyTargetable(enemy)
      && occupiesTargetRow(enemy, troop.row)
      && enemy.x >= troop.x
      && enemy.x - troop.x <= maximumDistance
    ))
    .sort((left, right) => (
      left.x - right.x
      || Math.abs(left.x - troop.x) - Math.abs(right.x - troop.x)
      || String(left.id).localeCompare(String(right.id))
    ))[0] || null;
}

export function selectVoltaicChainTargets(session, primary, config) {
  const maximumTargets = Math.max(0, Math.floor(config.chainMaxTargets || 0));
  if (!primary || maximumTargets === 0) return [];

  return session.enemies
    .filter((enemy) => {
      if (!isEnemyTargetable(enemy) || enemy.id === primary.id) return false;
      const rowDistance = Math.abs(enemy.row - primary.row);
      if (rowDistance > 1) return false;
      const horizontalDistance = (enemy.x - primary.x) / CELL.width;
      return Math.hypot(horizontalDistance, rowDistance) <= config.chainRadiusTiles;
    })
    .sort((left, right) => {
      const leftRowDistance = Math.abs(left.row - primary.row);
      const rightRowDistance = Math.abs(right.row - primary.row);
      const leftDistance = Math.hypot((left.x - primary.x) / CELL.width, leftRowDistance);
      const rightDistance = Math.hypot((right.x - primary.x) / CELL.width, rightRowDistance);
      return leftDistance - rightDistance
        || leftRowDistance - rightRowDistance
        || left.x - right.x
        || String(left.id).localeCompare(String(right.id));
    })
    .slice(0, maximumTargets);
}

function setVoltaicState(troop, state, now, durationMs = Infinity) {
  troop.state = state;
  troop.stateStartedAt = now;
  troop.stateEndsAt = Number.isFinite(durationMs) ? now + durationMs : Infinity;
}

function attackReleaseOffset(config) {
  return config.attackVisual?.releaseMs
    ?? config.attackVisual?.shots?.[0]?.atMs
    ?? 0;
}

function attackReleaseFrame(config) {
  return config.attackVisual?.shots?.[0]?.frame ?? 0;
}

function beginVoltaicAttack(session, troop, config, target, dependencies) {
  const durationMs = Math.max(1, config.attackVisual?.durationMs || 420);
  setVoltaicState(troop, "attack", session.elapsed, durationMs);
  troop.attackTargetId = target.id;
  troop.attackReleased = false;
  troop.attackReleaseAt = session.elapsed + attackReleaseOffset(config);
  troop.lastAttackAt = session.elapsed;
  troop.attackStartedAt = session.elapsed;
  troop.attackReadyAt = Infinity;
}

function finishVoltaicAttack(session, troop) {
  setVoltaicState(troop, "idle", session.elapsed);
  troop.attackTargetId = null;
  troop.attackReleased = false;
  troop.attackReleaseAt = Infinity;
}

function validLockedTarget(session, troop, config, target, occupiesTargetRow) {
  return Boolean(
    isEnemyTargetable(target)
    && occupiesTargetRow(target, troop.row)
    && target.x >= troop.x
    && target.x - troop.x <= config.range * CELL.width,
  );
}

function releaseVoltaicAttack(session, troop, config, events, dependencies) {
  let primary = session.enemies.find((enemy) => enemy.id === troop.attackTargetId) || null;
  if (!validLockedTarget(session, troop, config, primary, dependencies.occupiesTargetRow)) {
    primary = selectVoltaicPrimaryTarget(
      session,
      troop,
      config,
      dependencies.occupiesTargetRow,
    );
    troop.attackTargetId = primary?.id || null;
  }

  troop.attackReleased = true;
  troop.attackReadyAt = session.elapsed + dependencies.recoveryFor(config.attackEveryMs);
  if (!primary) return;

  const secondaryTargets = selectVoltaicChainTargets(session, primary, config);
  const baseDamage = config.damage * dependencies.damageMultiplier(primary);
  const primaryInWater = isVoltaicEnemyInWater(session, primary);
  const primaryPoint = dependencies.getTargetPoint(primary, troop.row);
  const muzzle = dependencies.getMuzzlePosition(attackReleaseFrame(config));
  const chains = secondaryTargets.map((target, index) => ({
    target,
    targetPoint: dependencies.getTargetPoint(target, target.row),
    inWater: isVoltaicEnemyInWater(session, target),
    seed: dependencies.nextEffectSeed() + index + 1,
  }));

  dependencies.damageEnemy(
    primary,
    calculateVoltaicDamage(baseDamage, primaryInWater, config, true),
    {
      direct: true,
      ranged: true,
      sourceX: troop.x,
      sourceTroopType: troop.type,
      sourceTroopId: troop.id,
    },
  );

  for (const chain of chains) {
    dependencies.damageEnemy(
      chain.target,
      calculateVoltaicDamage(baseDamage, chain.inWater, config, false),
      {
        direct: false,
        ranged: true,
        sourceX: primary.x,
        sourceTroopType: troop.type,
        sourceTroopId: troop.id,
      },
    );
  }

  events.push({
    type: "voltaicDischarge",
    weapon: "voltaicDischarge",
    troopType: troop.type,
    sourceTroopId: troop.id,
    primaryTargetId: primary.id,
    x0: muzzle.x,
    y0: muzzle.y,
    x1: primaryPoint.x,
    y1: primaryPoint.y,
    primaryInWater,
    chains: chains.map((chain) => ({
      targetId: chain.target.id,
      x0: primaryPoint.x,
      y0: primaryPoint.y,
      x1: chain.targetPoint.x,
      y1: chain.targetPoint.y,
      inWater: chain.inWater,
      seed: chain.seed,
    })),
    color: config.color,
    seed: dependencies.nextEffectSeed(),
  });
}

export function updateFuzileiroVoltaico(
  session,
  troop,
  config,
  events,
  dependencies,
) {
  const resolved = {
    damageEnemy: dependencies.damageEnemy,
    damageMultiplier: dependencies.damageMultiplier || (() => 1),
    getMuzzlePosition: dependencies.getMuzzlePosition || (() => ({ x: troop.x, y: troop.y })),
    getTargetPoint: dependencies.getTargetPoint || ((target) => ({ x: target.x, y: target.y })),
    nextEffectSeed: dependencies.nextEffectSeed || (() => 1),
    recoveryFor: dependencies.recoveryFor || ((milliseconds) => milliseconds),
    occupiesTargetRow: dependencies.occupiesTargetRow || ((enemy, row) => enemy?.row === row),
  };

  if (!Number.isFinite(troop.attackReleaseAt)) troop.attackReleaseAt = Infinity;
  if (typeof troop.attackReleased !== "boolean") troop.attackReleased = false;
  if (!troop.state) setVoltaicState(troop, "idle", session.elapsed);

  if (troop.state === "attack") {
    if (!troop.attackReleased && session.elapsed >= troop.attackReleaseAt) {
      releaseVoltaicAttack(session, troop, config, events, resolved);
    }
    if (session.elapsed >= troop.stateEndsAt) finishVoltaicAttack(session, troop);
    return;
  }

  if (session.outcome || (!session.waveActive && !session.sandbox)) return;
  if (session.elapsed < troop.attackReadyAt) return;

  const target = selectVoltaicPrimaryTarget(
    session,
    troop,
    config,
    resolved.occupiesTargetRow,
  );
  if (target) beginVoltaicAttack(session, troop, config, target, resolved);
}
