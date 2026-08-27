import { CELL } from "../visualGeometry.js";
import { isEnemyTargetable } from "../enemyTargeting.js";

export function getForestObstacleAt(session, row, col) {
  return session?.forestObstacles?.find((tree) => tree.row === row && tree.col === col) || null;
}

export function getBlockingForestObstacle(session, troop, enemy) {
  if (!troop || !enemy || troop.row == null || enemy.x == null) return null;
  if (troop.row !== enemy.row && !enemy.targetRows?.includes?.(troop.row)) return null;
  return (session.forestObstacles || [])
    .filter((tree) => tree.alive && tree.blocksLineOfSight && tree.row === troop.row
      && tree.x > troop.x && tree.x < enemy.x)
    .sort((left, right) => left.x - right.x)[0] || null;
}

export function isForestObstacleBlocking(session, troop, enemy) {
  return Boolean(getBlockingForestObstacle(session, troop, enemy));
}

function targetRow(enemy, row) {
  return enemy?.row === row
    || Boolean(enemy?.targetRows?.includes?.(row))
    || Boolean(enemy?.leviathanTargetableRows?.includes?.(row));
}

export function resolveForestCombatTarget(session, troop, config = {}, enemies = session?.enemies || []) {
  if (!session || !troop) return null;
  const range = Math.max(0, Number(config.range || 0) * CELL.width);
  const canTargetObstacle = config.forestInteraction?.canTargetObstacle !== false;
  const ignoresCover = config.forestInteraction?.ignoresCover === true;
  const trees = canTargetObstacle
    ? (session.forestObstacles || [])
      .filter((tree) => tree.alive && tree.blocksLineOfSight !== false
        && tree.row === troop.row && tree.x > troop.x && tree.x - troop.x <= range)
      .sort((left, right) => left.x - right.x)
    : [];
  const nearestTree = trees[0] || null;
  const enemyTargetable = config.enemyTargetable || isEnemyTargetable;
  const visibleEnemies = (enemies || [])
    .filter((enemy) => !enemy.dead && enemyTargetable(enemy)
      && targetRow(enemy, troop.row)
      && enemy.x >= troop.x
      && enemy.x - troop.x <= range
      && (ignoresCover || !nearestTree || enemy.x < nearestTree.x))
    .sort((left, right) => left.x - right.x || String(left.id).localeCompare(String(right.id)));
  if (visibleEnemies[0]) return { kind: "enemy", entity: visibleEnemies[0] };
  if (nearestTree) return { kind: "forestObstacle", entity: nearestTree };
  return null;
}

export function getForestObstacleHitPoint(tree) {
  const yOffset = tree?.type === "fragile" ? 16 : tree?.type === "mineralized" ? 28 : 22;
  return { x: tree?.x || 0, y: (tree?.y || 0) - yOffset };
}
