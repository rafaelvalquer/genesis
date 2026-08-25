import { CELL } from "../visualGeometry.js";
import { getForestObstacleType } from "./forestObstacleConfig.js";

export function getForestObstacleDamageStage(tree) {
  if (!tree || tree.hp <= 0) return "destroyed";
  const ratio = tree.hp / Math.max(1, tree.maxHp);
  if (ratio > .75) return "healthy";
  if (ratio > .5) return "damaged75";
  if (ratio > .25) return "damaged50";
  return "damaged25";
}

function metric(session, key, amount = 1) {
  if (session.chapterSevenMetrics) session.chapterSevenMetrics[key] = (session.chapterSevenMetrics[key] || 0) + amount;
}

export function triggerForestSporeBurst(session, tree, events = [], stunEnemy = () => {}) {
  if (!tree || tree.type !== "spores" || tree.deathEffectTriggered) return false;
  tree.deathEffectTriggered = true;
  const radius = 1.35 * CELL.width;
  let stunned = 0;
  for (const enemy of session.enemies || []) {
    if (enemy.dead || enemy.x == null || enemy.y == null || Math.hypot(enemy.x - tree.x, enemy.y - tree.y) > radius) continue;
    const config = session.enemyConfigs?.[enemy.type];
    if (config?.boss || config?.controlImmune) continue;
    const heavy = config?.role?.includes?.("Resistente") || config?.role?.includes?.("Elite") || config?.role?.includes?.("Colosso");
    stunEnemy(session, enemy, heavy ? 900 : 1800);
    stunned += 1;
  }
  metric(session, "forestSporeBursts");
  metric(session, "forestEnemiesStunned", stunned);
  events.push({ type: "forestSporeBurst", obstacleId: tree.id, x: tree.x, y: tree.y, radius, stunned });
  return true;
}

export function destroyForestObstacle(session, tree, events = [], stunEnemy) {
  if (!tree || !tree.alive) return false;
  tree.hp = 0;
  tree.alive = false;
  tree.blocksPlacement = false;
  tree.blocksLineOfSight = false;
  tree.damageStage = "destroyed";
  tree.destroyedAt = session.elapsed;
  metric(session, "forestTreesDestroyed");
  if (tree.type === "spores") { metric(session, "forestSporeTreesDestroyed"); triggerForestSporeBurst(session, tree, events, stunEnemy); }
  events.push({ type: "forestObstacleDestroyed", obstacleId: tree.id, x: tree.x, y: tree.y, obstacleType: tree.type });
  return true;
}

export function damageForestObstacle(session, tree, amount, events = [], stunEnemy) {
  if (!tree || !tree.alive || amount <= 0) return 0;
  const applied = Math.min(tree.hp, amount);
  tree.hp -= applied;
  tree.lastHitAt = session.elapsed;
  tree.hitShakeUntil = session.elapsed + 130;
  const nextStage = getForestObstacleDamageStage(tree);
  const stageChanged = nextStage !== tree.damageStage;
  tree.damageStage = nextStage;
  metric(session, "forestDamageReceived", applied);
  events.push({ type: "forestObstacleHit", targetId: tree.id, x: tree.x, y: tree.y, amount: Math.round(applied), stage: nextStage, stageChanged });
  if (tree.hp <= 0) destroyForestObstacle(session, tree, events, stunEnemy);
  return applied;
}
