import { ENEMIES } from "./content.js";
import { CELL } from "./visualGeometry.js";
import { getBattleIndex, livingEnemyById } from "./battleIndex.js";
import { createProjectileTrail } from "./projectileTrail.js";
import { isEnemyTargetable } from "./enemyTargeting.js";
import { getBlockingForestObstacle, resolveForestCombatTarget } from "./chapter07/forestObstacleTargeting.js";
import { getVisualShotTime } from "./troops/interceptadorIcaro/visual.js";

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

function normalPriority(enemy) {
  return [isIcaroAirTarget(enemy) ? icaroAirPriority(enemy) : 5, baseDistance(enemy), enemy.id];
}

function icaroAirPriority(enemy) {
  if (enemy.type === "nimbarca") return 0;
  if (enemy.variant === "alpha") return 1;
  if (/suporte/i.test(ENEMIES[enemy.type]?.role || "") || enemy.variant === "support") return 2;
  return 3;
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

export function selectIcaroCombatTarget(session, troop, config) {
  const candidates = getBattleIndex(session)?.enemiesByRow[troop.row] || session.enemies;
  return resolveForestCombatTarget(session, troop, config, candidates, {
    compareEnemies: (left, right) => comparePriority(left, right, normalPriority),
  });
}

function inInterceptionRange(session, enemy, troop, config) {
  if (!isEnemyTargetable(enemy) || !isIcaroAirTarget(enemy) || enemy.x < troop.x) return false;
  const dx = (enemy.x - troop.x) / CELL.width;
  const dy = (enemy.y - troop.y) / CELL.height;
  return Math.hypot(dx, dy) <= config.range && !getBlockingForestObstacle(session, troop, enemy);
}

function interceptionPriority(enemy) {
  return [icaroAirPriority(enemy), baseDistance(enemy), enemy.hp, enemy.id];
}

export function selectIcaroInterceptionTargets(session, troop, config) {
  const selected = [];
  const seenTargetIds = new Set();
  const rows = getBattleIndex(session)?.enemiesByRow;
  const consider = (enemy) => {
    if (seenTargetIds.has(enemy.id)) return;
    if (!inInterceptionRange(session, enemy, troop, config)) return;
    seenTargetIds.add(enemy.id);
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
  const rangeOrigin = projectile.rangeOrigin || projectile.origin;
  const surrogate = { x: rangeOrigin.x, y: rangeOrigin.y, row: rangeOrigin.row ?? projectile.row };
  return selectIcaroCombatTarget(session, surrogate, config);
}

function setState(troop, state, now, durationMs) {
  troop.state = state;
  troop.stateStartedAt = now;
  troop.stateEndsAt = now + durationMs;
}

export function clearIcaroCombatState(troop) {
  troop.icaroLockedTargetIds = [];
  troop.icaroInterceptionShotPlan = [];
  troop.interceptionAimDirection = "forward";
  troop.attackTargetId = null;
  troop.attackTargetKind = null;
  troop.interceptionFireStartedAt = null;
}

function launchProjectile(session, troop, config, target, special, shotIndex, dependencies, aimDirection = "forward", launchAt = session.elapsed) {
  const entity = target.entity || target;
  const targetKind = target.kind || "enemy";
  const origin = dependencies.getMuzzleWorldPosition(troop, config, {
    shotIndex,
    state: special ? "interceptionFire" : "attackBurst",
    direction: special ? aimDirection : "forward",
  });
  session.projectiles.push({
    id: dependencies.createId("projectile"),
    kind: special ? "icaroInterceptionShot" : "icaroBullet",
    visualKind: special ? "icaroInterceptionShot" : "icaroBullet",
    troopType: troop.type,
    sourceTroopId: troop.id,
    targetKind,
    targetId: entity.id,
    lockedTargetId: targetKind === "enemy" ? entity.id : null,
    aimDirection,
    row: troop.row,
    shotIndex,
    x: origin.x,
    y: origin.y,
    previousX: origin.x,
    previousY: origin.y,
    origin: { ...origin },
    rangeOrigin: { x: troop.x, y: troop.y, row: troop.row },
    ageMs: 0,
    trail: createProjectileTrail(special ? 8 : 4, origin.x, origin.y),
    speed: special ? config.interceptionProjectileSpeed : config.projectileSpeed,
    baseDamage: special ? config.interceptionDamage : config.damage,
    special,
    color: config.color,
    active: true,
    launched: false,
    seed: dependencies.nextEffectSeed(),
    launchAt,
  });
}

function startInterception(session, troop, config, targets, events, dependencies) {
  troop.icaroLockedTargetIds = targets.map((target) => target.id);
  const target = targets[0];
  const rowDelta = target ? target.row - troop.row : 0;
  troop.interceptionAimDirection = rowDelta < 0
    ? "up"
    : rowDelta > 0
      ? "down"
      : "forward";
  troop.icaroInterceptionShotPlan = targets.map((entry, shotIndex) => ({
    targetId: entry.id,
    shotIndex,
    direction: entry.row < troop.row ? "up" : entry.row > troop.row ? "down" : "forward",
  }));
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
  const index = getBattleIndex(session);
  const plan = troop.icaroInterceptionShotPlan || troop.icaroLockedTargetIds.map((targetId, shotIndex) => ({ targetId, shotIndex, direction: troop.interceptionAimDirection || "forward" }));
  const targets = [];
  for (const entry of plan) {
    const targetId = entry.targetId;
    const enemy = index
      ? livingEnemyById(index, targetId)
      : session.enemies.find((candidate) => candidate.id === targetId && alive(candidate));
    if (!enemy || !isIcaroAirTarget(enemy)) continue;
    targets.push(enemy);
    launchProjectile(session, troop, config, { kind: "enemy", entity: enemy }, true, entry.shotIndex, dependencies,
      entry.direction || "forward", session.elapsed + getVisualShotTime(config.interceptionFireVisual, entry.shotIndex));
  }
  troop.interceptionFireStartedAt = session.elapsed;
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
  troop.attackTargetId = target.entity.id;
  troop.attackTargetKind = target.kind;
  if (target.kind === "forestObstacle" && target.reason === "cover") {
    session.chapterSevenMetrics ??= {};
    session.chapterSevenMetrics.forestCoverBlocks = (session.chapterSevenMetrics.forestCoverBlocks || 0) + 1;
  }
  troop.attackReadyAt = session.elapsed + dependencies.recoveryFor(config.attackEveryMs);
  for (let shot = 0; shot < config.burstCount; shot += 1) {
    launchProjectile(session, troop, config, target, false, shot, dependencies, "forward",
      session.elapsed + getVisualShotTime(config.attackVisual, shot));
  }
}

export function updateInterceptadorIcaro(session, troop, config, events, dependencies) {
  if (troop.dead || troop.state === "death") {
    clearIcaroCombatState(troop);
    return;
  }
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
    clearIcaroCombatState(troop);
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
  const target = selectIcaroCombatTarget(session, troop, config);
  if (target) startBurst(session, troop, config, target, dependencies);
}
