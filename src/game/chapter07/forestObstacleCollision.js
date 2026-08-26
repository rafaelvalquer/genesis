import { forestObstacleBaseY, getForestObstacleType } from "./forestObstacleConfig.js";

export function getForestObstacleHitbox(tree) {
  const collision = getForestObstacleType(tree?.type).collision;
  const scale = Number(tree?.scale) || 1;
  const width = collision.width * scale;
  const height = collision.height * scale;
  const baseY = forestObstacleBaseY(tree);
  return {
    x: tree?.x || 0,
    y: baseY - height / 2,
    width,
    height,
  };
}

export function projectileCrossesForestObstacle(projectile, tree, previousX, previousY, currentX, currentY) {
  if (!tree?.alive || tree.row !== projectile.row) return false;
  const hitbox = getForestObstacleHitbox(tree);
  const minX = Math.min(previousX, currentX) - 24;
  const maxX = Math.max(previousX, currentX) + 24;
  if (hitbox.x + hitbox.width / 2 < minX || hitbox.x - hitbox.width / 2 > maxX) return false;
  const dx = currentX - previousX;
  const progress = Math.abs(dx) > 0 ? Math.max(0, Math.min(1, (hitbox.x - previousX) / dx)) : 0;
  const y = previousY + (currentY - previousY) * progress;
  return y >= hitbox.y - hitbox.height / 2 && y <= hitbox.y + hitbox.height / 2;
}

export function findFirstForestObstacleCollision(session, projectile, previousX = projectile.previousX, previousY = projectile.previousY, currentX = projectile.x, currentY = projectile.y) {
  return (session?.forestObstacles || [])
    .filter((tree) => projectileCrossesForestObstacle(projectile, tree, previousX, previousY, currentX, currentY))
    .sort((left, right) => left.x - right.x)[0] || null;
}
