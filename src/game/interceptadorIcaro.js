import { ENEMIES } from "./content.js";
import { CELL } from "./visualGeometry.js";
import { getBattleIndex, livingEnemyById } from "./battleIndex.js";
import { createProjectileTrail } from "./projectileTrail.js";

const alive = (enemy) => enemy && !enemy.dead && enemy.hp > 0;
const baseDistance = (enemy) => Number(enemy.x) || Infinity;

export function isIcaroAirTarget(enemy) {
  if (!enemy) return false;
  const config = ENEMIES[enemy.type] || {};
  return Boolean(
    config.airborne
    || enemy.airborne
    || enemy.originallyAirborne
    || enemy.temporarilyGrounded
    || Number(enemy.groundedUntil) > 0,
  );
}

function inNormalRange(enemy, troop, config) {
  return alive(enemy)
    && enemy.row === troop.row
    && enemy.x >= troop.x
    && enemy.x - troop.x <= config.range * CELL.width;
}

function normalPriority(enemy) {
  const air = isIcaroAirTarget(enemy);
  if (!air) return [5, baseDistance(enemy), enemy.id];
  if (enemy.type === "nimbarca") return [0, baseDistance(enemy), enemy.id];
  if (enemy.variant === "alpha") return [1, baseDistance(enemy), enemy.id];
  if (/suporte/i.test(ENEMIES[enemy.type]?.role || "")) return [2, baseDistance(enemy), enemy.id];
  return [3, baseDistance(enemy), enemy.id];
}

function comparePriority(left, right, priority) {
  const a = priority(left);
  const b = priority(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

export function selectIcaroTarget(session, troop, config) {
  const candidates = getBattleIndex(session)?.enemiesByRow[troop.row] || session.enemies;
  let bestAir = null;
  let bestGround = null;
  for (const enemy of candidates) {
    if (!inNormalRange(enemy, troop, config)) continue;
    if (isIcaroAirTarget(enemy)) {
      if (!bestAir || comparePriority(enemy, bestAir, normalPriority) < 0) bestAir = enemy;
    } else if (!bestGround || comparePriority(enemy, bestGround, normalPriority) < 0) {
      bestGround = enemy;
    }
  }
  return bestAir || bestGround;
}

function inInterceptionRange(enemy, troop, config) {
  if (!alive(enemy) || !isIcaroAirTarget(enemy) || enemy.x < troop.x) return false;
  const dx = (enemy.x - troop.x) / CELL.width;
  const dy = (enemy.y - troop.y) / CELL.height;
  return Math.hypot(dx, dy) <= config.range;
}

function interceptionPriority(enemy) {
  if (enemy.type === "nimbarca") return [0, baseDistance(enemy), enemy.hp, enemy.id];
  if (enemy.variant === "alpha") return [1, baseDistance(enemy), enemy.hp, enemy.id];
  return [2, baseDistance(enemy), enemy.hp, enemy.id];
}

export function selectIcaroInterceptionTargets(session, troop, config) {
  const selected = [];
  const rows = getBattleIndex(session)?.enemiesByRow;
  const consider = (enemy) => {
    if (!inInterceptionRange(enemy, troop, config)) return;
    let insertAt = selected.length;
    while (insertAt > 0
      && comparePriority(enemy, selected[insertAt - 1], interceptionPriority) < 0) insertAt -= 1;
    selected.splice(insertAt, 0, enemy);
    if (selected.length > config.interceptionMaxTargets) selected.length = config.interceptionMaxTargets;
  };
  if (rows) {
    for (const row of rows) for (const enemy of row) consider(enemy);
  } else {
    for (const enemy of session.enemies) consider(enemy);
  }
  return selected;
}

export function selectIcaroBurstRetarget(session, projectile, config) {
  const candidates = getBattleIndex(session)?.enemiesByRow[projectile.row] || session.enemies;
  let best = null;
  for (const enemy of candidates) {
    if (!alive(enemy) || enemy.row !== projectile.row || !isIcaroAirTarget(enemy)
      || enemy.x < projectile.origin.x
      || enemy.x - projectile.origin.x > config.range * CELL.width) continue;
    if (!best || comparePriority(enemy, best, normalPriority) < 0) best = enemy;
  }
  return best;
}

function setState(troop, state, now, durationMs) {
  troop.state = state;
  troop.stateStartedAt = now;
  troop.stateEndsAt = now + durationMs;
}

function launchProjectile(session, troop, config, target, special, shotIndex, dependencies) {
  const origin = dependencies.getMuzzleWorldPosition(troop, config, shotIndex);
  session.projectiles.push({
    id: dependencies.createId("projectile"),
    kind: special ? "icaroInterceptionShot" : "icaroBullet",
    visualKind: special ? "icaroInterceptionShot" : "icaroBullet",
    troopType: troop.type,
    sourceTroopId: troop.id,
    targetId: target.id,
    lockedTargetId: target.id,
    row: troop.row,
    shotIndex,
    x: origin.x,
    y: origin.y,
    previousX: origin.x,
    previousY: origin.y,
    origin: { ...origin },
    ageMs: 0,
    trail: createProjectileTrail(special ? 8 : 4, origin.x, origin.y),
    speed: special ? config.interceptionProjectileSpeed : config.projectileSpeed,
    baseDamage: special ? config.interceptionDamage : config.damage,
    special,
    color: config.color,
    active: true,
    launched: false,
    seed: dependencies.nextEffectSeed(),
    launchAt: session.elapsed + (special
      ? shotIndex * config.interceptionShotIntervalMs
      : shotIndex * config.burstIntervalMs),
  });
}

function startInterception(session, troop, config, targets, events, dependencies) {
  troop.icaroLockedTargetIds = targets.map((target) => target.id);
  troop.interceptionReadyAt = session.elapsed
    + dependencies.recoveryFor(config.interceptionCooldownMs);
  setState(troop, "interceptionLock", session.elapsed, config.interceptionLockVisual.durationMs);
  events.push({
    type: "icaroTargetLock",
    sourceTroopId: troop.id,
    targetIds: [...troop.icaroLockedTargetIds],
    locks: targets.map((target) => ({ targetId: target.id, x: target.x, y: target.y })),
    x: troop.x,
    y: troop.y,
    color: config.color,
    seed: dependencies.nextEffectSeed(),
  });
}

function fireInterception(session, troop, config, events, dependencies) {
  const targets = [];
  const index = getBattleIndex(session);
  for (const targetId of troop.icaroLockedTargetIds) {
    const enemy = index
      ? livingEnemyById(index, targetId)
      : session.enemies.find((candidate) => candidate.id === targetId && alive(candidate));
    if (enemy && isIcaroAirTarget(enemy)) targets.push(enemy);
  }
  targets.forEach((target, index) =>
    launchProjectile(session, troop, config, target, true, index, dependencies));
  setState(troop, "interceptionFire", session.elapsed, config.interceptionFireVisual.durationMs);
  troop.lastAttackAt = session.elapsed;
  events.push({
    type: "icaroInterceptionFire",
    sourceTroopId: troop.id,
    targetIds: targets.map((target) => target.id),
    x: troop.x,
    y: troop.y,
    color: config.color,
    seed: dependencies.nextEffectSeed(),
  });
}

function startBurst(session, troop, config, target, dependencies) {
  setState(troop, "attackBurst", session.elapsed, config.attackVisual.durationMs);
  troop.lastAttackAt = session.elapsed;
  troop.attackStartedAt = session.elapsed;
  troop.attackTargetId = target.id;
  troop.attackReadyAt = session.elapsed + dependencies.recoveryFor(config.attackEveryMs);
  for (let shot = 0; shot < config.burstCount; shot += 1) {
    launchProjectile(session, troop, config, target, false, shot, dependencies);
  }
}

export function updateInterceptadorIcaro(session, troop, config, events, dependencies) {
  if (!Number.isFinite(troop.interceptionReadyAt)) {
    troop.interceptionReadyAt = session.elapsed + config.interceptionCooldownMs;
  }

  if (troop.state === "interceptionLock") {
    if (session.elapsed >= troop.stateEndsAt) fireInterception(session, troop, config, events, dependencies);
    return;
  }
  if (troop.state === "interceptionFire" || troop.state === "attackBurst") {
    if (session.elapsed < troop.stateEndsAt) return;
    setState(troop, "idle", session.elapsed, Infinity);
    troop.icaroLockedTargetIds = [];
  }

  if (session.outcome || (!session.waveActive && !session.sandbox)) return;
  if (session.elapsed >= troop.interceptionReadyAt) {
    const targets = selectIcaroInterceptionTargets(session, troop, config);
    if (targets.length) {
      startInterception(session, troop, config, targets, events, dependencies);
      return;
    }
  }
  if (session.elapsed < troop.attackReadyAt) return;
  const target = selectIcaroTarget(session, troop, config);
  if (target) startBurst(session, troop, config, target, dependencies);
}
