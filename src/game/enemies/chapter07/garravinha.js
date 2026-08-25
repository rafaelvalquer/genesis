import { enemyBehavior } from "../enemyBehavior.js";
import { CELL } from "../../visualGeometry.js";
import {
  canReserveConvoyGrapple,
  commitConvoyGrapple,
  releaseConvoyGrapple,
  reserveConvoyGrapple,
} from "../../chapter07/convoyGrapple.js";

const living = (troop) => troop && !troop.dead && !troop.structure;

function recordMetric(runtime, key, amount = 1) {
  runtime.session.chapterSevenMetrics ??= {};
  runtime.session.chapterSevenMetrics[key] = (runtime.session.chapterSevenMetrics[key] || 0) + amount;
}

function setState(enemy, state, now, duration = Infinity) {
  enemy.garravinhaState = state;
  enemy.garravinhaStateStartedAt = now;
  enemy.garravinhaStateEndsAt = Number.isFinite(duration) ? now + duration : Infinity;
  enemy.moving = state === "walking";
}

function blocker(runtime, enemy) {
  return runtime.troops()
    .filter((troop) => living(troop) && troop.row === enemy.row && troop.x < enemy.x
      && enemy.x - troop.x <= runtime.troopBlockDistance(troop))
    .sort((a, b) => b.x - a.x)[0] || null;
}

function beginAttack(runtime, enemy, target, config, state = "attack") {
  setState(enemy, state, runtime.elapsed, config.attackVisual?.durationMs || 800);
  enemy.garravinhaAttackTargetId = target?.id || null;
  enemy.garravinhaAttackImpactAt = runtime.elapsed + (config.attackVisual?.impactMs || 400);
  enemy.attackReadyAt = runtime.elapsed + (state === "sideAttack" ? config.latch.sideAttackEveryMs : config.attackEveryMs);
  enemy.lastAttackAt = runtime.elapsed;
}

function cancelLatch(runtime, enemy, events, reason = "interrupted") {
  const config = runtime.configFor(enemy);
  releaseConvoyGrapple(runtime.session, enemy.id);
  enemy.leapFromX = null;
  enemy.leapFromY = null;
  enemy.leapToX = null;
  enemy.leapToY = null;
  enemy.leapStartedAt = null;
  enemy.garravinhaReadyAt = runtime.elapsed + config.latch.interruptedCooldownMs;
  enemy.attachedToConvoy = false;
  setState(enemy, "walking", runtime.elapsed);
  enemy.garravinhaMetrics.latchInterruptions += 1;
  recordMetric(runtime, "garravinhaLatchInterruptions");
  events.push({ type: "garravinhaLatchInterrupted", sourceEnemyId: enemy.id, reason, x: enemy.x, y: enemy.y });
}

function attachToConvoy(runtime, enemy, config) {
  const convoy = runtime.session.convoy;
  enemy.x = convoy.x + config.latch.attachOffsetX;
  enemy.y = convoy.y + config.latch.attachOffsetY;
  enemy.previousRenderX = enemy.x;
  enemy.previousRenderY = enemy.y;
  enemy.moving = false;
  enemy.attachedToConvoy = true;
}

export const garravinhaBehavior = enemyBehavior({
  createState: (session, _queued, config) => ({
    garravinhaState: "walking",
    garravinhaStateStartedAt: session.elapsed,
    garravinhaStateEndsAt: Infinity,
    garravinhaReadyAt: session.elapsed,
    garravinhaAttackTargetId: null,
    garravinhaAttackImpactAt: Infinity,
    leapFromX: null,
    leapFromY: null,
    leapToX: null,
    leapToY: null,
    leapStartedAt: null,
    attachedToConvoy: false,
    nextLatchDamageAt: Infinity,
    latchStunPauseStartedAt: null,
    garravinhaMetrics: {
      latchAttempts: 0, latches: 0, latchTicks: 0, latchDamage: 0,
      latchInterruptions: 0, released: 0, sideAttacks: 0,
    },
    moving: true,
    ...config.garravinhaState,
  }),

  onDeath: (runtime, enemy, events) => {
    const released = releaseConvoyGrapple(runtime.session, enemy.id);
    if (!released) return;
    enemy.attachedToConvoy = false;
    enemy.garravinhaMetrics.released += 1;
    recordMetric(runtime, "garravinhaReleased");
    events.push({ type: "garravinhaReleased", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y });
  },

  update: (runtime, enemy, config, dt, events) => {
    if (enemy.dead) return true;
    const latch = config.latch;
    const stunned = runtime.elapsed < (enemy.stunnedUntil || 0);

    if (enemy.garravinhaState === "latched") {
      attachToConvoy(runtime, enemy, config);
      if (stunned) {
        enemy.moving = false;
        enemy.latchStunPauseStartedAt ??= runtime.elapsed;
        return true;
      }
      if (enemy.latchStunPauseStartedAt != null) {
        const pausedFor = runtime.elapsed - enemy.latchStunPauseStartedAt;
        enemy.nextLatchDamageAt += Math.max(0, pausedFor);
        enemy.latchStunPauseStartedAt = null;
      }
      if (runtime.elapsed >= enemy.nextLatchDamageAt) {
        const dealt = runtime.damageConvoy(latch.tickDamage, {
          attackerId: enemy.id, enemyType: enemy.type, underAttackHoldMs: 1100,
        });
        enemy.nextLatchDamageAt += latch.tickEveryMs;
        enemy.garravinhaMetrics.latchTicks += 1;
        enemy.garravinhaMetrics.latchDamage += dealt;
        recordMetric(runtime, "garravinhaLatchTicks");
        recordMetric(runtime, "garravinhaLatchDamage", dealt);
        events.push({ type: "garravinhaLatchTick", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y, damage: dealt });
      }
      return true;
    }

    if (stunned) {
      if (["latchPrep", "latchLeap"].includes(enemy.garravinhaState)) cancelLatch(runtime, enemy, events, "stun");
      enemy.moving = false;
      return true;
    }

    if (enemy.garravinhaState === "latchPrep") {
      enemy.moving = false;
      if (!runtime.canEnemyReachConvoy(enemy, config) || runtime.hasBlockingTroop(enemy)) {
        cancelLatch(runtime, enemy, events, "access-lost");
      } else if (runtime.elapsed >= enemy.garravinhaStateEndsAt) {
        const convoy = runtime.session.convoy;
        enemy.leapFromX = enemy.x;
        enemy.leapFromY = enemy.y;
        enemy.leapToX = convoy.x + latch.attachOffsetX;
        enemy.leapToY = convoy.y + latch.attachOffsetY;
        enemy.leapStartedAt = runtime.elapsed;
        setState(enemy, "latchLeap", runtime.elapsed, latch.leapMs);
        events.push({ type: "garravinhaLeapStarted", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y, targetX: enemy.leapToX, targetY: enemy.leapToY });
      }
      return true;
    }

    if (enemy.garravinhaState === "latchLeap") {
      const progress = Math.max(0, Math.min(1, (runtime.elapsed - enemy.leapStartedAt) / latch.leapMs));
      const convoy = runtime.session.convoy;
      enemy.leapToX = convoy.x + latch.attachOffsetX;
      enemy.leapToY = convoy.y + latch.attachOffsetY;
      enemy.x = enemy.leapFromX + (enemy.leapToX - enemy.leapFromX) * progress;
      enemy.y = enemy.leapFromY + (enemy.leapToY - enemy.leapFromY) * progress - Math.sin(progress * Math.PI) * latch.arcHeightPx;
      enemy.moving = false;
      if (progress >= 1) {
        if (!commitConvoyGrapple(runtime.session, enemy.id)) { cancelLatch(runtime, enemy, events, "slot-lost"); return true; }
        setState(enemy, "latched", runtime.elapsed);
        enemy.nextLatchDamageAt = runtime.elapsed + latch.tickEveryMs;
        enemy.garravinhaMetrics.latches += 1;
        recordMetric(runtime, "garravinhaLatches");
        attachToConvoy(runtime, enemy, config);
        const dealt = runtime.damageConvoy(latch.initialDamage, {
          attackerId: enemy.id, enemyType: enemy.type, underAttackHoldMs: 1100,
        });
        enemy.garravinhaMetrics.latchDamage += dealt;
        recordMetric(runtime, "garravinhaLatchDamage", dealt);
        events.push({ type: "garravinhaLatched", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y, damage: dealt });
      }
      return true;
    }

    if (["attack", "sideAttack"].includes(enemy.garravinhaState)) {
      enemy.moving = false;
      if (runtime.elapsed >= enemy.garravinhaAttackImpactAt) {
        const target = runtime.troops().find((troop) => troop.id === enemy.garravinhaAttackTargetId && living(troop));
        if (enemy.garravinhaState === "sideAttack") {
          const dealt = runtime.damageConvoy(latch.sideAttackDamage, { attackerId: enemy.id, enemyType: enemy.type, underAttackHoldMs: 1100 });
          enemy.garravinhaMetrics.sideAttacks += 1;
          recordMetric(runtime, "garravinhaSideAttacks");
          events.push({ type: "garravinhaSideAttack", sourceEnemyId: enemy.id, damage: dealt, x: runtime.convoyX(), y: enemy.y });
        } else if (target && target.row === enemy.row && enemy.x - target.x <= runtime.troopBlockDistance(target)) {
          runtime.damageTroop(target, enemy.damage, { sourceEnemyId: enemy.id });
          events.push({ type: "melee", x: target.x, y: target.y, sourceEnemyId: enemy.id });
        }
        enemy.garravinhaAttackImpactAt = Infinity;
        enemy.garravinhaAttackTargetId = null;
      }
      if (runtime.elapsed >= enemy.garravinhaStateEndsAt) setState(enemy, "walking", runtime.elapsed);
      return true;
    }

    const blocked = blocker(runtime, enemy);
    if (blocked) {
      enemy.moving = false;
      if (runtime.elapsed >= enemy.attackReadyAt) beginAttack(runtime, enemy, blocked, config);
      return true;
    }

    const canReach = runtime.canEnemyReachConvoy(enemy, config) && !runtime.hasBlockingTroop(enemy);
    if (canReach) {
      if (canReserveConvoyGrapple(runtime.session, enemy.id) && runtime.elapsed >= enemy.garravinhaReadyAt) {
        reserveConvoyGrapple(runtime.session, enemy.id);
        enemy.garravinhaMetrics.latchAttempts += 1;
        recordMetric(runtime, "garravinhaLatchAttempts");
        setState(enemy, "latchPrep", runtime.elapsed, latch.prepMs);
        events.push({ type: "garravinhaLatchPrep", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y });
      } else if (!canReserveConvoyGrapple(runtime.session, enemy.id) && runtime.elapsed >= enemy.attackReadyAt) {
        beginAttack(runtime, enemy, null, config, "sideAttack");
      } else {
        enemy.moving = false;
      }
      return true;
    }

    setState(enemy, "walking", runtime.elapsed);
    runtime.moveEnemy(enemy, dt, events);
    return true;
  },
});
