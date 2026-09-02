import { CELL } from "../visualGeometry.js";
import { isEnemyTargetable } from "../enemyTargeting.js";
import { resolveCombatLine } from "./forestObstacleCollision.js";

/** @typedef {{ kind: "enemy" | "forestObstacle", entity: object, reason?: "direct" | "cover", blockedTargetId?: string | null }} CombatTarget */

export function getForestObstacleAt(session, row, col) {
  return session?.forestObstacles?.find((tree) => tree.row === row && tree.col === col) || null;
}

export function getBlockingForestObstacle(session, troop, enemy) {
  if (!troop || !enemy || enemy.x == null) return null;
  const troopY = troop.y ?? troop.row * CELL.height + CELL.height / 2;
  const enemyY = enemy.y ?? enemy.row * CELL.height + CELL.height / 2;
  return resolveCombatLine(session, { x: troop.x, y: troopY }, { x: enemy.x, y: enemyY }).blocker || null;
}

export function isForestObstacleBlocking(session, troop, enemy) {
  return Boolean(getBlockingForestObstacle(session, troop, enemy));
}

export function getNearestTargetableForestObstacle(session, troop, rangeTiles) {
  const range = Math.max(0, Number(rangeTiles) || 0) * CELL.width;
  return (session?.forestObstacles || [])
    .filter((tree) => tree.alive && tree.blocksLineOfSight !== false
      && tree.row === troop?.row && tree.x > troop?.x && tree.x - troop.x <= range)
    .sort((left, right) => left.x - right.x)[0] || null;
}

function targetRow(enemy, row) {
  return enemy?.row === row
    || Boolean(enemy?.targetableRows?.includes?.(row))
    || Boolean(enemy?.targetRows?.includes?.(row))
    || Boolean(enemy?.leviathanTargetableRows?.includes?.(row));
}

function targetPriority(enemy) {
  return enemy?.type === "garravinha" && enemy.garravinhaState === "latched" ? 1 : 0;
}

export function resolveForestCombatTarget(session, troop, config = {}, enemies = session?.enemies || [], options = {}) {
  if (!session || !troop) return null;
  const range = Math.max(0, Number(config.range || 0) * CELL.width);
  const canTargetObstacle = config.forestInteraction?.canTargetObstacle !== false;
  const ignoresCover = config.forestInteraction?.ignoresCover === true;
  const nearestTree = canTargetObstacle ? getNearestTargetableForestObstacle(session, troop, config.range) : null;
  const enemyTargetable = config.enemyTargetable || isEnemyTargetable;
  const compareEnemies = options.compareEnemies || ((left, right) =>
    targetPriority(right) - targetPriority(left)
      || left.x - right.x || String(left.id).localeCompare(String(right.id)));
  const visibleEnemies = (enemies || [])
    .filter((enemy) => !enemy.dead && enemyTargetable(enemy)
      && targetRow(enemy, troop.row)
      && enemy.x >= troop.x
      && enemy.x - troop.x <= range
      && (ignoresCover || !getBlockingForestObstacle(session, troop, enemy)))
    .sort(compareEnemies);
  if (visibleEnemies[0]) return { kind: "enemy", entity: visibleEnemies[0] };
  if (nearestTree) {
    const blocked = (enemies || []).find((enemy) => !enemy.dead && enemyTargetable(enemy)
      && targetRow(enemy, troop.row) && enemy.x >= troop.x && enemy.x - troop.x <= range
      && getBlockingForestObstacle(session, troop, enemy)?.id === nearestTree.id);
    return {
      kind: "forestObstacle",
      entity: nearestTree,
      reason: blocked ? "cover" : "direct",
      blockedTargetId: blocked?.id || null,
    };
  }
  return null;
}

export function getForestObstacleHitPoint(tree) {
  const yOffset = tree?.type === "fragile" ? 16 : tree?.type === "mineralized" ? 28 : 22;
  return { x: tree?.x || 0, y: (tree?.y || 0) - yOffset };
}
