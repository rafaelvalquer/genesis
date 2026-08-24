import { CELL } from "../visualGeometry.js";

export const isSporeConfused = (troop, elapsed) => Boolean(troop && elapsed < (troop.sporeConfusedUntil || 0));

export function applySporeConfusion(session, troop, durationMs) {
  if (!troop || troop.dead || troop.structure || durationMs <= 0) return false;
  const now = session.elapsed;
  const previous = troop.sporeConfusedUntil || 0;
  // Effects never stack additively: a second fruit only refreshes the longer end time.
  const next = Math.max(previous, now + durationMs);
  const extension = Math.max(0, next - Math.max(previous, now));
  troop.sporeConfusedUntil = next;
  for (const key of ["attackReadyAt", "attackBusyUntil", "attackReleaseAt", "stateEndsAt", "mineReadyAt", "gunReadyAt"]) {
    if (Number.isFinite(troop[key]) && troop[key] > now) troop[key] += extension;
  }
  return previous <= now;
}

export function launchSporeFruit(session, enemy, target, config, createId, events) {
  const spell = config.sporeFruit;
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const travelMs = Math.max(180, Math.hypot(dx, dy) / spell.projectileSpeed * 1000);
  session.sporeFruits.push({
    id: createId("sporeFruit"), active: true, sourceEnemyId: enemy.id,
    startX: enemy.x - 18, startY: enemy.y - 42, targetX: target.x, targetY: target.y,
    targetRow: target.row, startedAt: session.elapsed, impactAt: session.elapsed + travelMs,
    radiusTiles: spell.radiusTiles, confusionMinMs: spell.confusionMinMs,
    confusionMaxMs: spell.confusionMaxMs, cloudVisualMs: spell.cloudVisualMs,
  });
  session.chapterSevenMetrics.sporeFruitsThrown += 1;
  events.push({ type: "sporeFruitThrown", sourceEnemyId: enemy.id, targetTroopId: target.id, x: target.x, y: target.y });
}

export function updateSporeField(session, events) {
  for (const fruit of session.sporeFruits) {
    if (!fruit.active || session.elapsed < fruit.impactAt) continue;
    fruit.active = false;
    const radius = fruit.radiusTiles * CELL.width;
    const affected = session.troops.filter((troop) => !troop.dead && !troop.structure
      && Math.abs(troop.row - fruit.targetRow) <= 2
      && Math.hypot(troop.x - fruit.targetX, troop.y - fruit.targetY) <= radius);
    let newlyConfused = 0;
    for (const troop of affected) {
      const duration = fruit.confusionMinMs + session.rng() * (fruit.confusionMaxMs - fruit.confusionMinMs);
      if (applySporeConfusion(session, troop, duration)) newlyConfused += 1;
    }
    session.chapterSevenMetrics.sporeFruitsHit += 1;
    session.chapterSevenMetrics.sporeTroopsConfused += newlyConfused;
    if (affected.length >= 2) session.chapterSevenMetrics.sporeMultiHits += 1;
    session.sporeClouds.push({ id: `sporeCloud-${fruit.id}`, x: fruit.targetX, y: fruit.targetY, startedAt: session.elapsed, endsAt: session.elapsed + fruit.cloudVisualMs, radius });
    events.push({ type: "sporeFruitImpact", sourceEnemyId: fruit.sourceEnemyId, x: fruit.targetX, y: fruit.targetY, affectedTroopIds: affected.map((troop) => troop.id) });
  }
  session.sporeFruits = session.sporeFruits.filter((fruit) => fruit.active);
  session.sporeClouds = session.sporeClouds.filter((cloud) => session.elapsed < cloud.endsAt);
}
