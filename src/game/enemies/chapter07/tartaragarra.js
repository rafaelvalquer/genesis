import { enemyBehavior } from "../enemyBehavior.js";
import { CELL } from "../../visualGeometry.js";

const living = (troop) => troop && !troop.dead;

function setState(enemy, state, now, duration = Infinity) {
  if (enemy.tartaragarraState === state
    && (state !== "chargePrep" || enemy.tartaragarraStateEndsAt > now)) {
    enemy.moving = state === "walking" || state === "charge";
    return;
  }
  enemy.tartaragarraState = state;
  enemy.tartaragarraStateStartedAt = now;
  enemy.tartaragarraStateEndsAt = Number.isFinite(duration) ? now + duration : Infinity;
  enemy.moving = state === "walking" || state === "charge";
  enemy.tartaragarraImpactApplied = false;
}

function recordMetric(runtime, key, amount = 1) {
  runtime.session.chapterSevenMetrics ??= {};
  runtime.session.chapterSevenMetrics[key] = (runtime.session.chapterSevenMetrics[key] || 0) + amount;
}

function blockingTarget(runtime, enemy) {
  const target = runtime.closestTroop(enemy);
  return target && enemy.x - target.x <= runtime.troopBlockDistance(target) ? target : null;
}

function chargeTarget(runtime, enemy, config) {
  return runtime.troops()
    .filter((troop) => living(troop) && troop.row === enemy.row && troop.x <= enemy.x
      && enemy.x - troop.x <= config.charge.triggerRangeTiles * CELL.width)
    .sort((a, b) => b.x - a.x)[0] || null;
}

function beginNormalAttack(runtime, enemy, target, config) {
  setState(enemy, "attack", runtime.elapsed, config.attackVisual?.durationMs || 1200);
  enemy.tartaragarraAttackTargetId = target.id;
  enemy.tartaragarraAttackImpactAt = runtime.elapsed + (config.attackVisual?.impactMs || 700);
  enemy.attackReadyAt = runtime.elapsed + config.attackEveryMs;
  enemy.lastAttackAt = runtime.elapsed;
}

export const tartaragarraBehavior = enemyBehavior({
  createState: (session, _queued, config) => ({
    tartaragarraState: "walking", tartaragarraStateStartedAt: session.elapsed,
    tartaragarraStateEndsAt: Infinity, chargeReadyAt: session.elapsed,
    chargeTargetId: null, chargeStartX: null, chargeEndX: null,
    chargeImpactApplied: false, tartaragarraAttackTargetId: null,
    tartaragarraAttackImpactAt: Infinity, tartaragarraConvoyAttackImpactAt: Infinity,
    shellHitUntil: -Infinity, shellHitStrength: 0,
    tartaragarraMetrics: { charges: 0, chargeHits: 0, chargeMisses: 0, troopsStunned: 0, shellHits: 0, shellDamagePrevented: 0, convoyHeadbutts: 0, convoyDamage: 0 },
    moving: true,
    ...config.tartaragarraState,
  }),
  receiveDamage: (runtime, enemy, amount, events, context) => {
    const rangedOrRear = context.ranged === true || (Number.isFinite(context.sourceX) && context.sourceX > enemy.x);
    if (!rangedOrRear) return;
    context.armorFactorOverride = .62;
    enemy.shellHitUntil = runtime.elapsed + 200;
    enemy.shellHitStrength = Math.max(enemy.shellHitStrength || 0, Math.min(1, amount / 40));
    enemy.tartaragarraMetrics.shellHits += 1;
    enemy.tartaragarraMetrics.shellDamagePrevented += amount * .38;
    recordMetric(runtime, "tartaragarraShellHits");
    recordMetric(runtime, "tartaragarraShellDamagePrevented", amount * .38);
    events.push({ type: "tartaragarraShellBlock", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y, strength: enemy.shellHitStrength, durationMs: 200 });
  },
  update: (runtime, enemy, config, dt, events) => {
    if (enemy.dead) return true;
    const charge = config.charge;
    const headbutt = config.convoyHeadbutt;
    if (runtime.elapsed < (enemy.stunnedUntil || 0)) {
      if (enemy.tartaragarraState === "chargePrep") {
        enemy.chargeTargetId = null;
        enemy.chargeReadyAt = runtime.elapsed + charge.interruptedCooldownMs;
        setState(enemy, "walking", runtime.elapsed);
        events.push({ type: "tartaragarraChargeInterrupted", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y });
      }
      enemy.moving = false;
      return true;
    }
    if (enemy.tartaragarraState === "chargePrep") {
      enemy.moving = false;
      const target = runtime.troops().find((troop) => troop.id === enemy.chargeTargetId && living(troop));
      if (!target || target.row !== enemy.row || target.x > enemy.x) {
        enemy.chargeTargetId = null;
        setState(enemy, "walking", runtime.elapsed);
      } else if (runtime.elapsed >= enemy.tartaragarraStateEndsAt) {
        enemy.chargeStartX = enemy.x;
        enemy.chargeEndX = Math.max(enemy.x - charge.distanceTiles * CELL.width, target.x + runtime.troopBlockDistance(target));
        enemy.tartaragarraMetrics.charges += 1;
        recordMetric(runtime, "tartaragarraCharges");
        setState(enemy, "charge", runtime.elapsed);
        events.push({ type: "tartaragarraChargeStarted", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y });
      }
      return true;
    }
    if (enemy.tartaragarraState === "charge") {
      const previousX = enemy.x;
      const nextX = Math.max(enemy.chargeEndX, previousX - charge.speed * dt / 1000);
      const collision = runtime.troops()
        .filter((troop) => living(troop) && troop.row === enemy.row && troop.x <= previousX)
        .map((troop) => ({ troop, boundary: troop.x + runtime.troopBlockDistance(troop) }))
        .filter(({ boundary }) => boundary <= previousX && boundary >= nextX)
        .sort((a, b) => b.boundary - a.boundary)[0];
      if (collision) {
        enemy.x = collision.boundary;
        runtime.damageTroop(collision.troop, charge.damage, { sourceEnemyId: enemy.id });
        runtime.stunTroop(collision.troop, charge.stunMs);
        enemy.tartaragarraMetrics.chargeHits += 1;
        enemy.tartaragarraMetrics.troopsStunned += 1;
        recordMetric(runtime, "tartaragarraChargeHits");
        recordMetric(runtime, "tartaragarraTroopsStunned");
        events.push({ type: "tartaragarraChargeImpact", sourceEnemyId: enemy.id, targetTroopId: collision.troop.id, x: collision.troop.x, y: collision.troop.y, damage: charge.damage, stunMs: charge.stunMs, shake: 5 });
        enemy.chargeReadyAt = runtime.elapsed + charge.cooldownMs;
        setState(enemy, "chargeRecover", runtime.elapsed, charge.recoveryMs);
      } else if (nextX <= enemy.chargeEndX) {
        enemy.x = nextX;
        enemy.tartaragarraMetrics.chargeMisses += 1;
        recordMetric(runtime, "tartaragarraChargeMisses");
        enemy.chargeReadyAt = runtime.elapsed + charge.cooldownMs;
        events.push({ type: "tartaragarraChargeImpact", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y, damage: 0, shake: 2 });
        setState(enemy, "chargeRecover", runtime.elapsed, charge.recoveryMs);
      } else enemy.x = nextX;
      return true;
    }
    if (enemy.tartaragarraState === "chargeRecover") {
      enemy.moving = false;
      if (runtime.elapsed >= enemy.tartaragarraStateEndsAt) setState(enemy, "walking", runtime.elapsed);
      return true;
    }
    if (enemy.tartaragarraState === "attack" || enemy.tartaragarraState === "convoyAttack") {
      enemy.moving = false;
      if (!enemy.tartaragarraImpactApplied && runtime.elapsed >= enemy.tartaragarraAttackImpactAt) {
        enemy.tartaragarraImpactApplied = true;
        const target = runtime.troops().find((troop) => troop.id === enemy.tartaragarraAttackTargetId && living(troop));
        if (enemy.tartaragarraState === "convoyAttack") {
          const dealt = runtime.damageConvoy(headbutt.damage, { attackerId: enemy.id, enemyType: enemy.type, underAttackHoldMs: headbutt.underAttackHoldMs });
          enemy.tartaragarraMetrics.convoyHeadbutts += 1;
          enemy.tartaragarraMetrics.convoyDamage += dealt;
          recordMetric(runtime, "tartaragarraConvoyHeadbutts");
          recordMetric(runtime, "tartaragarraConvoyDamage", dealt);
          events.push({ type: "tartaragarraConvoyHeadbutt", sourceEnemyId: enemy.id, x: runtime.convoyX(), y: enemy.y, damage: dealt });
        } else if (target && target.row === enemy.row && enemy.x - target.x <= runtime.troopBlockDistance(target)) {
          runtime.damageTroop(target, enemy.damage, { sourceEnemyId: enemy.id });
          events.push({ type: "melee", x: target.x, y: target.y, sourceEnemyId: enemy.id });
        }
        enemy.tartaragarraAttackTargetId = null;
        enemy.tartaragarraAttackImpactAt = Infinity;
      }
      if (runtime.elapsed >= enemy.tartaragarraStateEndsAt) setState(enemy, "walking", runtime.elapsed);
      return true;
    }
    const target = blockingTarget(runtime, enemy);
    if (target) {
      enemy.moving = false;
      if (runtime.elapsed >= enemy.chargeReadyAt) {
        enemy.chargeTargetId = target.id;
        setState(enemy, "chargePrep", runtime.elapsed, charge.prepMs);
        events.push({ type: "tartaragarraChargePrep", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y });
      } else if (runtime.elapsed >= enemy.attackReadyAt) beginNormalAttack(runtime, enemy, target, config);
      return true;
    }
    const nearbyChargeTarget = chargeTarget(runtime, enemy, config);
    if (nearbyChargeTarget && runtime.elapsed >= enemy.chargeReadyAt) {
      enemy.chargeTargetId = nearbyChargeTarget.id;
      setState(enemy, "chargePrep", runtime.elapsed, charge.prepMs);
      events.push({ type: "tartaragarraChargePrep", sourceEnemyId: enemy.id, x: enemy.x, y: enemy.y });
      return true;
    }
    if (runtime.canEnemyReachConvoy(enemy, config) && !runtime.hasBlockingTroop(enemy)) {
      enemy.moving = false;
      if (runtime.elapsed >= enemy.attackReadyAt) {
        setState(enemy, "convoyAttack", runtime.elapsed, config.attackVisual?.durationMs || headbutt.durationMs);
        enemy.tartaragarraAttackImpactAt = runtime.elapsed + (config.attackVisual?.impactMs || headbutt.impactMs);
        enemy.attackReadyAt = runtime.elapsed + headbutt.attackEveryMs;
        enemy.lastAttackAt = runtime.elapsed;
        events.push({ type: "tartaragarraHeadbutt", sourceEnemyId: enemy.id, x: runtime.convoyX(), y: enemy.y });
      }
      return true;
    }
    setState(enemy, "walking", runtime.elapsed);
    runtime.moveEnemy(enemy, dt, events);
    return true;
  },
});
