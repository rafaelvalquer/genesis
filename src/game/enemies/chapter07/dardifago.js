import { enemyBehavior } from "../enemyBehavior.js";
import { CELL } from "../../visualGeometry.js";
import { launchDardifagoDart, dardifagoTargetInRange } from "../../chapter07/dardifagoDart.js";

const living = (troop) => troop && !troop.dead && !troop.structure;
const setState = (enemy, state, now, duration = Infinity) => {
  enemy.dardifagoState = state; enemy.dardifagoStateStartedAt = now;
  enemy.dardifagoStateEndsAt = Number.isFinite(duration) ? now + duration : Infinity;
  enemy.moving = state === "walking";
};

export function selectDardifagoTarget(runtime, enemy, config) {
  const range = config.rangedAttack.rangeTiles * CELL.width;
  const blocker = runtime.troops().filter((t) => living(t) && t.row === enemy.row && t.x < enemy.x && enemy.x - t.x <= runtime.troopBlockDistance(t))
    .sort((a, b) => b.x - a.x)[0];
  if (blocker) return { ...blocker, targetType: "troop" };
  const escortRow = enemy.row === 0 ? 1 : enemy.row === 4 ? 3 : null;
  const escorts = runtime.troops().filter((t) => living(t) && t.row === escortRow && Math.abs(t.x - enemy.x) <= range)
    .sort((a, b) => Math.abs(a.x - runtime.convoyX()) - Math.abs(b.x - runtime.convoyX()) || Math.abs(a.x - enemy.x) - Math.abs(b.x - enemy.x) || String(a.id).localeCompare(String(b.id)));
  if (escorts[0]) return { ...escorts[0], targetType: "troop" };
  const convoy = runtime.session.convoy;
  if (config.canTargetConvoyFromOuterRow && convoy && dardifagoTargetInRange(enemy, convoy, config.rangedAttack.rangeTiles)) return { ...convoy, id: "convoy", type: "convoy", targetType: "convoy" };
  return null;
}

export const dardifagoBehavior = enemyBehavior({
  createState: (session, _queued, config) => ({ dardifagoState: "walking", dardifagoStateStartedAt: session.elapsed,
    dardifagoStateEndsAt: Infinity, shotReadyAt: session.elapsed + config.rangedAttack.firstShotDelayMs, shotsReleased: 0,
    shotTargetType: null, shotTargetId: null, shotTargetX: null, shotTargetY: null, shotReleased: false, nextShotIsToxic: false }),
  update: (runtime, enemy, config, dt, events) => {
    if (enemy.dead) return true;
    const stunned = runtime.elapsed < (enemy.stunnedUntil || 0);
    if (stunned) { if (["dartAttack", "toxicAttack"].includes(enemy.dardifagoState) && !enemy.shotReleased) { runtime.session.chapterSevenMetrics.dardifagoInterruptedShots += 1; events.push({ type: "dardifagoAttackInterrupted", sourceEnemyId: enemy.id }); } setState(enemy, "walking", runtime.elapsed); enemy.shotReleased = false; enemy.shotTargetId = null; enemy.shotReadyAt = runtime.elapsed + config.attackEveryMs; enemy.moving = false; return true; }
    if (["dartAttack", "toxicAttack"].includes(enemy.dardifagoState)) {
      enemy.moving = false;
      if (!enemy.shotReleased && runtime.elapsed >= enemy.dardifagoStateStartedAt + config.rangedAttack.releaseMs) {
        launchDardifagoDart(runtime.session, enemy, { id: enemy.shotTargetId, type: enemy.shotTargetType, x: enemy.shotTargetX, y: enemy.shotTargetY }, config, runtime.createId, events);
        enemy.shotReleased = true; enemy.shotsReleased += 1; enemy.nextShotIsToxic = enemy.shotsReleased % config.toxinDart.everyShots === 0;
      }
      if (runtime.elapsed >= enemy.dardifagoStateEndsAt) { setState(enemy, "walking", runtime.elapsed); enemy.shotReadyAt = runtime.elapsed + config.attackEveryMs; }
      return true;
    }
    const target = selectDardifagoTarget(runtime, enemy, config);
    if (target && runtime.elapsed >= enemy.shotReadyAt) {
      enemy.shotTargetType = target.targetType; enemy.shotTargetId = target.id; enemy.shotTargetX = target.x; enemy.shotTargetY = target.y;
      const toxic = (enemy.shotsReleased + 1) % config.toxinDart.everyShots === 0;
      setState(enemy, toxic ? "toxicAttack" : "dartAttack", runtime.elapsed, config.rangedAttack.durationMs);
      enemy.shotReleased = false; enemy.nextShotIsToxic = toxic; enemy.lastAttackAt = runtime.elapsed;
      events.push({ type: "dardifagoAttackStarted", sourceEnemyId: enemy.id, targetId: target.id, toxic });
      return true;
    }
    setState(enemy, "walking", runtime.elapsed); runtime.moveEnemy(enemy, dt, events); return true;
  },
});
