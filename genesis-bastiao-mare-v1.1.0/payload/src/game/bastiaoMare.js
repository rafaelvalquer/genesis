const DEFAULT_ENERGY_COLOR = "#fbbf24";
const DEFAULT_CELL_WIDTH = 80;
const DEFAULT_CELL_HEIGHT = 120;

const livingTarget = (enemy) => Boolean(enemy && !enemy.dead && enemy.hp > 0);

export function getBastiaoFloodedDamageFactor(config, flooded) {
  return flooded ? Number(config?.floodedDamageTakenFactor ?? 1) : 1;
}

export function pruneBastiaoEnergyWindow(troop, now, windowMs) {
  const entries = Array.isArray(troop.energyPickupSpawnTimes)
    ? troop.energyPickupSpawnTimes
    : [];
  troop.energyPickupSpawnTimes = entries.filter((timestamp) => now - timestamp < windowMs);
  return troop.energyPickupSpawnTimes;
}

function overloadDistance(troop, enemy, cellWidth, cellHeight) {
  const dxTiles = (Number(enemy.x) - Number(troop.x)) / cellWidth;
  const dyTiles = (Number(enemy.y) - Number(troop.y)) / cellHeight;
  return Math.hypot(dxTiles, dyTiles);
}

export function selectBastiaoOverloadTargets(session, troop, config, dependencies = {}) {
  const enemies = dependencies.enemies || session.enemies || [];
  const cellWidth = Math.max(1, Number(dependencies.cellWidth) || DEFAULT_CELL_WIDTH);
  const cellHeight = Math.max(1, Number(dependencies.cellHeight) || DEFAULT_CELL_HEIGHT);
  const radiusTiles = Math.max(0, Number(config.overloadRadiusTiles) || 0);
  const maximumTargets = Math.max(0, Math.floor(Number(config.overloadMaxTargets) || 0));
  if (!radiusTiles || !maximumTargets) return [];

  return enemies
    .filter((enemy) => livingTarget(enemy))
    .filter((enemy) => dependencies.isEnemyTargetable?.(enemy) ?? true)
    .filter((enemy) => !(dependencies.isEnemySubmerged?.(enemy) ?? false))
    .map((enemy) => ({
      enemy,
      distance: overloadDistance(troop, enemy, cellWidth, cellHeight),
      rowDistance: Math.abs(Number(enemy.row) - Number(troop.row)),
    }))
    .filter(({ distance }) => distance <= radiusTiles + 1e-9)
    .sort((left, right) => left.distance - right.distance
      || left.rowDistance - right.rowDistance
      || Number(left.enemy.x) - Number(right.enemy.x)
      || String(left.enemy.id).localeCompare(String(right.enemy.id)))
    .slice(0, maximumTargets)
    .map(({ enemy }) => enemy);
}

export function calculateBastiaoOverloadDamage(enemy, config, dependencies = {}) {
  const baseDamage = Math.max(0, Number(config.overloadDamage) || 0);
  const enemyConfig = dependencies.configForEnemy?.(enemy) || {};
  const bossLike = Boolean(enemyConfig.boss || enemy?.variant === "alpha");
  const factor = bossLike
    ? Math.max(0, Number(config.overloadBossDamageFactor) || 0)
    : 1;
  return baseDamage * factor;
}

export function applyBastiaoOverload(
  session,
  troop,
  config,
  events = [],
  dependencies = {},
  pulseIndex = 0,
  pulseCount = 1,
) {
  const targets = selectBastiaoOverloadTargets(session, troop, config, dependencies);
  const targetEvents = [];

  for (const enemy of targets) {
    const damage = calculateBastiaoOverloadDamage(enemy, config, dependencies);
    const target = {
      id: enemy.id,
      x: Number(enemy.x) || 0,
      y: (Number(enemy.y) || 0) - 20,
      row: enemy.row,
      damage,
      boss: Boolean(dependencies.configForEnemy?.(enemy)?.boss || enemy.variant === "alpha"),
    };
    dependencies.damageEnemy?.(enemy, damage, {
      direct: false,
      area: true,
      electric: true,
      passive: true,
      sourceX: troop.x,
      sourceTroopId: troop.id,
      sourceTroopType: troop.type,
    });
    targetEvents.push(target);
  }

  const cellWidth = Math.max(1, Number(dependencies.cellWidth) || DEFAULT_CELL_WIDTH);
  const cellHeight = Math.max(1, Number(dependencies.cellHeight) || DEFAULT_CELL_HEIGHT);
  events.push({
    type: "bastiaoOverload",
    sourceTroopId: troop.id,
    x: troop.x,
    y: troop.y - 38,
    centerX: troop.x,
    centerY: troop.y,
    radiusTiles: Number(config.overloadRadiusTiles) || 0,
    radiusX: (Number(config.overloadRadiusTiles) || 0) * cellWidth,
    radiusY: (Number(config.overloadRadiusTiles) || 0) * cellHeight,
    damage: Number(config.overloadDamage) || 0,
    targets: targetEvents,
    pulseIndex,
    pulseCount,
    delayMs: pulseIndex * 70,
    color: config.overloadColor || config.color || "#22d3ee",
    coreColor: config.overloadCoreColor || "#ecfeff",
    durationMs: Number(config.overloadDurationMs) || 420,
    seed: dependencies.nextEffectSeed?.() || pulseIndex + 1,
  });
  return targets.length;
}

export function recordBastiaoDamage(session, troop, actualHpDamage, events = [], dependencies = {}) {
  const config = dependencies.config || dependencies.configFor?.(troop);
  if (!config || config.id !== "bastiaoMare" || troop.dead || !(actualHpDamage > 0)) return 0;

  const now = Number(session.elapsed) || 0;
  const windowMs = Math.max(1, Number(config.energyPickupWindowMs) || 10000);
  const limit = Math.max(1, Math.floor(Number(config.energyPickupLimit) || 5));
  const spawnTimes = pruneBastiaoEnergyWindow(troop, now, windowMs);
  troop.energyChargeProgress = Math.max(0, Number(troop.energyChargeProgress) || 0);

  if (spawnTimes.length >= limit) {
    troop.energyChargeProgress = Math.min(0.99, troop.energyChargeProgress);
    return 0;
  }

  const flooded = dependencies.flooded === true;
  const threshold = Math.max(1, Number(
    flooded ? config.floodedEnergyDamageThreshold : config.energyDamageThreshold,
  ) || 1);
  troop.energyChargeProgress += actualHpDamage / threshold;

  const available = Math.max(0, limit - troop.energyPickupSpawnTimes.length);
  const spawnCount = Math.min(Math.floor(troop.energyChargeProgress), available);
  for (let pulseIndex = 0; pulseIndex < spawnCount; pulseIndex += 1) {
    troop.energyChargeProgress -= 1;
    troop.energyPickupSpawnTimes.push(now);
    const offset = config.energyPickupOffset || { x: 6, y: -68 };
    dependencies.spawnEnergyPickup?.(session, {
      x: troop.x + Number(offset.x || 0),
      y: troop.y + Number(offset.y || 0),
      amount: Number(config.energyPickupAmount) || 1,
      sourceTroopId: troop.id,
    }, events);
    events.push({
      type: "bastiaoEnergyCharged",
      sourceTroopId: troop.id,
      x: troop.x,
      y: troop.y - 48,
      color: config.color,
      pickupColor: DEFAULT_ENERGY_COLOR,
      pulseIndex,
      pulseCount: spawnCount,
    });
    applyBastiaoOverload(
      session,
      troop,
      config,
      events,
      dependencies,
      pulseIndex,
      spawnCount,
    );
  }

  if (troop.energyPickupSpawnTimes.length >= limit && troop.energyChargeProgress >= 1) {
    troop.energyChargeProgress = 0.99;
  }
  return spawnCount;
}

export function selectBastiaoTarget(session, troop, config, dependencies = {}) {
  const candidates = dependencies.enemiesForRow
    ? dependencies.enemiesForRow(troop.row)
    : session.enemies;
  return candidates
    .filter((enemy) => livingTarget(enemy)
      && (dependencies.occupiesTargetRow?.(enemy, troop.row) ?? enemy.row === troop.row)
      && enemy.x >= troop.x
      && enemy.x - troop.x <= config.range * dependencies.cellWidth)
    .sort((left, right) => left.x - right.x || String(left.id).localeCompare(String(right.id)))[0] || null;
}

function targetStillValid(session, troop, target, config, dependencies) {
  return livingTarget(target)
    && (dependencies.occupiesTargetRow?.(target, troop.row) ?? target.row === troop.row)
    && target.x >= troop.x
    && target.x - troop.x <= config.range * dependencies.cellWidth;
}

function beginAttack(session, troop, target, config, dependencies) {
  const durationMs = Number(config.attackVisual?.durationMs) || 720;
  const impactMs = Number(config.attackVisual?.impactMs) || 360;
  troop.state = "attack";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = session.elapsed + durationMs;
  troop.attackTargetId = target.id;
  troop.attackReleased = false;
  troop.attackReleaseAt = session.elapsed + impactMs;
  troop.attackReadyAt = session.elapsed + dependencies.recoveryFor(config.attackEveryMs);
}

function finishAttack(session, troop) {
  troop.state = "idle";
  troop.stateStartedAt = session.elapsed;
  troop.stateEndsAt = Infinity;
  troop.attackTargetId = null;
  troop.attackReleased = false;
  troop.attackReleaseAt = Infinity;
}

export function updateBastiaoMare(session, troop, config, events = [], dependencies = {}) {
  const deps = {
    cellWidth: DEFAULT_CELL_WIDTH,
    recoveryFor: (milliseconds) => milliseconds,
    ...dependencies,
  };

  if (troop.state === "attack") {
    if (!troop.attackReleased && session.elapsed >= troop.attackReleaseAt) {
      let target = session.enemies.find((enemy) => enemy.id === troop.attackTargetId) || null;
      if (!targetStillValid(session, troop, target, config, deps)) {
        target = selectBastiaoTarget(session, troop, config, deps);
        troop.attackTargetId = target?.id || null;
      }
      if (target) {
        const damage = config.damage * deps.damageMultiplier(target);
        deps.damageEnemy(target, damage, {
          direct: true,
          sourceX: troop.x,
          sourceTroopType: troop.type,
          sourceTroopId: troop.id,
        });
        events.push({
          type: "bastiaoShieldImpact",
          sourceTroopId: troop.id,
          targetId: target.id,
          x: target.x,
          y: target.y,
          color: config.color,
          seed: deps.nextEffectSeed?.() || 1,
        });
        events.push({ type: "melee", x: target.x, y: target.y, sourceTroopId: troop.id });
      }
      troop.attackReleased = true;
    }
    if (session.elapsed >= troop.stateEndsAt) finishAttack(session, troop);
    return;
  }

  if (session.elapsed < troop.attackReadyAt) return;
  const target = selectBastiaoTarget(session, troop, config, deps);
  if (target) beginAttack(session, troop, target, config, deps);
}
