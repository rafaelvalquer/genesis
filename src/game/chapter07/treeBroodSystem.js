import { CELL } from "../visualGeometry.js";
import { TREE_BROOD_CONFIG, TREE_BROOD_ENEMY_ID, TREE_BROOD_PHASE_CONFIG } from "./treeBroodConfig.js";

const metric = (session, key, amount = 1) => {
  if (session.chapterSevenMetrics) session.chapterSevenMetrics[key] = (session.chapterSevenMetrics[key] || 0) + amount;
};

export function spawnLarvaFromTree(session, tree, events = []) {
  if (typeof session.spawnEnemy !== "function") return null;
  const larva = session.spawnEnemy({
    type: TREE_BROOD_ENEMY_ID,
    row: tree.row,
    x: tree.x + CELL.width * .08,
    spawnSource: "forestBrood",
    sourceTreeId: tree.id,
    animationState: "emerge",
  });
  if (!larva) return null;
  const until = session.elapsed + 720;
  larva.animationState = "emerge";
  larva.emergeState = "emerging";
  larva.emergeStartedAt = session.elapsed;
  larva.emergeEndsAt = until;
  larva.emergeUntil = until;
  larva.moving = false;
  larva.attackReadyAt = until;
  metric(session, "larvaRaizFerroSpawned");
  events.push({ type: "treeLarvaSpawned", treeId: tree.id, enemyId: larva.id, enemyType: TREE_BROOD_ENEMY_ID, row: tree.row });
  return larva;
}

export function tryTriggerTreeBrood(session, tree, source = {}, events = []) {
  if (!tree?.alive) return false;
  const phaseConfig = TREE_BROOD_PHASE_CONFIG[session.phase?.id];
  const config = TREE_BROOD_CONFIG[tree.type];
  if (!phaseConfig?.enabled || !config) return false;
  tree.brood ??= { spawnedCount: 0, nextRollAt: 0 };
  if (tree.brood.spawnedCount >= config.maxSpawnsPerTree) return false;
  if (session.elapsed < tree.brood.nextRollAt) {
    metric(session, "forestBroodSuppressedByCooldown");
    return false;
  }
  tree.brood.nextRollAt = session.elapsed + config.rollCooldownMs;
  metric(session, "forestBroodRolls");
  const active = (session.enemies || []).filter((enemy) => !enemy.dead && enemy.type === TREE_BROOD_ENEMY_ID && enemy.spawnSource === "forestBrood").length;
  if (active >= phaseConfig.maxActiveBroodLarvae) {
    metric(session, "forestBroodSuppressedByCap");
    return false;
  }
  if (session.rng() >= config.chance) return false;
  const larva = spawnLarvaFromTree(session, tree, events);
  if (!larva) return false;
  tree.brood.spawnedCount += 1;
  metric(session, "forestBroodTriggered");
  events.push({ type: "treeBroodTriggered", treeId: tree.id, treeType: tree.type, x: tree.x, y: tree.y, row: tree.row, source });
  return true;
}
