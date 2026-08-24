import { enemyBehavior } from "../enemyBehavior.js";
import { CELL } from "../../visualGeometry.js";
import { launchSporeFruit } from "../../chapter07/sporeField.js";

const living = (troop) => troop && !troop.dead && !troop.structure;

export function selectMacacoEsporosTarget(runtime, enemy, config) {
  const spell = config.sporeFruit;
  const candidates = runtime.troops().filter((troop) => living(troop)
    && Math.abs(troop.row - enemy.row) <= 2
    && Math.hypot(troop.x - enemy.x, troop.y - enemy.y) <= spell.rangeTiles * CELL.width);
  const grouped = (troop) => candidates.filter((other) => Math.hypot(other.x - troop.x, other.y - troop.y) <= spell.radiusTiles * CELL.width).length >= 2;
  return candidates.sort((a, b) => {
    const pa = runtime.escortIds().includes(a.id) ? 0 : grouped(a) ? 1 : 2;
    const pb = runtime.escortIds().includes(b.id) ? 0 : grouped(b) ? 1 : 2;
    return pa - pb || Number(grouped(b)) - Number(grouped(a))
      || Number((a.sporeConfusedUntil || 0) > runtime.elapsed) - Number((b.sporeConfusedUntil || 0) > runtime.elapsed)
      || Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y)
      || String(a.id).localeCompare(String(b.id));
  })[0] || null;
}

function setState(enemy, state, now, duration = Infinity) {
  enemy.sporeState = state; enemy.sporeStateStartedAt = now; enemy.sporeStateEndsAt = Number.isFinite(duration) ? now + duration : Infinity;
}

export const macacoEsporosBehavior = enemyBehavior({
  createState: (session, _queued, config) => ({ sporeState: "walking", sporeStateStartedAt: session.elapsed,
    sporeStateEndsAt: Infinity, sporeReadyAt: session.elapsed + config.sporeFruit.firstCastDelayMs,
    sporeTargetId: null, sporeTargetX: null, sporeTargetY: null, sporeReleased: false }),
  selectTarget: selectMacacoEsporosTarget,
  update: (runtime, enemy, config, dt, events) => {
    if (enemy.dead) return true;
    if (runtime.elapsed < (enemy.stunnedUntil || 0)) { enemy.moving = false; return true; }
    const target = runtime.closestTroop(enemy);
    if (enemy.meleeAttackPending) {
      enemy.moving = false;
      if (runtime.elapsed >= enemy.meleeImpactAt) {
        const victim = runtime.troops().find((troop) => troop.id === enemy.meleeTargetId && living(troop));
        if (victim && victim.row === enemy.row && enemy.x - victim.x <= runtime.troopBlockDistance(victim)) runtime.damageTroop(victim, enemy.damage, { sourceEnemyId: enemy.id });
        enemy.meleeAttackPending = false; enemy.meleeImpactAt = Infinity; enemy.meleeTargetId = null;
      }
      return true;
    }
    if (enemy.sporeState === "sporeCast") {
      enemy.moving = false;
      if (!enemy.sporeReleased && runtime.elapsed >= enemy.sporeStateStartedAt + config.sporeFruit.releaseMs) {
        const victim = runtime.troops().find((troop) => troop.id === enemy.sporeTargetId && living(troop));
        if (victim) launchSporeFruit(runtime.session, enemy, { ...victim, x: enemy.sporeTargetX, y: enemy.sporeTargetY }, config, runtime.createId, events);
        // Keep the cast start timestamp so frame 4 remains the release pose.
        enemy.sporeReleased = true; enemy.sporeState = "released";
      }
      if (runtime.elapsed >= enemy.sporeStateEndsAt) { setState(enemy, "walking", runtime.elapsed); enemy.sporeReadyAt = runtime.elapsed + config.sporeFruit.cooldownMs; }
      return true;
    }
    const spellTarget = selectMacacoEsporosTarget(runtime, enemy, config);
    if (spellTarget && runtime.elapsed >= enemy.sporeReadyAt) {
      enemy.sporeTargetId = spellTarget.id; enemy.sporeTargetX = spellTarget.x; enemy.sporeTargetY = spellTarget.y; enemy.sporeReleased = false;
      setState(enemy, "sporeCast", runtime.elapsed, config.sporeFruit.castDurationMs); return true;
    }
    if (target && enemy.x - target.x <= runtime.troopBlockDistance(target)) {
      enemy.moving = false; enemy.meleeAttackPending = runtime.elapsed >= enemy.attackReadyAt;
      if (enemy.meleeAttackPending) { enemy.meleeAttackStartedAt = runtime.elapsed; enemy.meleeImpactAt = runtime.elapsed + config.attackVisual.impactMs; enemy.meleeTargetId = target.id; enemy.attackReadyAt = runtime.elapsed + config.attackEveryMs; }
      return true;
    }
    runtime.moveEnemy(enemy, dt, events); return true;
  },
});
