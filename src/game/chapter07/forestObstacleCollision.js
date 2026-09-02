import { forestObstacleBaseY, getForestObstacleType } from "./forestObstacleConfig.js";
import { CELL } from "../visualGeometry.js";

export function getForestObstacleHitbox(tree) {
  const collision = getForestObstacleType(tree?.type).collision;
  const scale = Number(tree?.scale) || 1;
  const width = collision.width * scale;
  const height = collision.height * scale;
  const baseY = forestObstacleBaseY(tree?.y == null
    ? { ...tree, y: (tree?.row || 0) * CELL.height + CELL.height / 2 }
    : tree);
  return {
    x: tree?.x || 0,
    y: baseY - height / 2,
    width,
    height,
  };
}

/** Segmento contra a AABB da árvore. Retorna a primeira interseção no segmento. */
export function intersectSegmentWithForestObstacle(start, end, tree, options = {}) {
  if (!tree?.alive || (options.requireLineOfSight !== false && tree.blocksLineOfSight === false)) return null;
  const box = getForestObstacleHitbox(tree);
  const minX = box.x - box.width / 2; const maxX = box.x + box.width / 2;
  const minY = box.y - box.height / 2; const maxY = box.y + box.height / 2;
  const dx = end.x - start.x; const dy = end.y - start.y;
  let tMin = 0; let tMax = 1;
  for (const [origin, delta, min, max] of [[start.x, dx, minX, maxX], [start.y, dy, minY, maxY]]) {
    if (Math.abs(delta) < 1e-9) { if (origin < min || origin > max) return null; continue; }
    const t1 = (min - origin) / delta; const t2 = (max - origin) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2)); tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return null;
  }
  return { tree, t: tMin, point: { x: start.x + dx * tMin, y: start.y + dy * tMin } };
}

export function findFirstForestObstacleOnSegment(session, start, end, options = {}) {
  return (session?.forestObstacles || [])
    .map((tree) => intersectSegmentWithForestObstacle(start, end, tree, options))
    .filter(Boolean)
    .sort((left, right) => left.t - right.t)[0] || null;
}

export function resolveCombatLine(session, sourcePoint, targetPoint, options = {}) {
  const blocker = findFirstForestObstacleOnSegment(session, sourcePoint, targetPoint, options);
  return blocker
    ? { clear: false, blocker: blocker.tree, intersection: { t: blocker.t, point: blocker.point } }
    : { clear: true, blocker: null, intersection: null };
}

export function projectileCrossesForestObstacle(projectile, tree, previousX, previousY, currentX, currentY) {
  return Boolean(intersectSegmentWithForestObstacle(
    { x: previousX, y: previousY }, { x: currentX, y: currentY }, tree,
  ));
}

export function findFirstForestObstacleCollision(session, projectile, previousX = projectile.previousX, previousY = projectile.previousY, currentX = projectile.x, currentY = projectile.y) {
  return (session?.forestObstacles || [])
    .map((tree) => ({ tree, hit: intersectSegmentWithForestObstacle({ x: previousX, y: previousY }, { x: currentX, y: currentY }, tree) }))
    .filter((entry) => entry.hit)
    .sort((left, right) => left.hit.t - right.hit.t)[0]?.tree || null;
}
