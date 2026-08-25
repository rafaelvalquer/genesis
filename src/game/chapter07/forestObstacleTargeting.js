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
