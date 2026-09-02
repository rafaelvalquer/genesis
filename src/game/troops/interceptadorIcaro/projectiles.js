import { ENEMIES, TROOPS } from "../../content.js";
import { indexedEnemyById, indexedTroopById } from "../../battle/queries.js";
import { isEnemyTargetable } from "../../enemyTargeting.js";
import { isIcaroAirTarget, selectIcaroBurstRetarget } from "../../interceptadorIcaro.js";
import { getEnemyHitPoint } from "../../visualGeometry.js";
import { getForestObstacleHitPoint } from "../../chapter07/forestObstacleTargeting.js";
import { findFirstForestObstacleOnSegment } from "../../chapter07/forestObstacleCollision.js";
import { pushProjectileTrail } from "../../projectileTrail.js";
import { registerProjectileHandler } from "../../projectileRegistry.js";

function impactForestObstacle({ session, projectile, tree, impactPoint, source, events, dependencies, amount }) {
  const factor = source ? dependencies.attackDamageMultiplier(session, source, { target: null }) : session.modifiers.troopDamage;
  dependencies.damageForestObstacle(session, tree, amount ?? projectile.baseDamage * factor);
  events.push({
    type: projectile.special ? "icaroInterceptionImpact" : "icaroBulletImpact",
    weapon: projectile.visualKind,
    sourceTroopId: projectile.sourceTroopId,
    targetKind: "forestObstacle",
    targetId: tree.id,
    x: impactPoint?.x ?? tree.x,
    y: impactPoint?.y ?? tree.y,
    color: projectile.color,
    seed: projectile.seed,
  });
  projectile.active = false;
}

export function updateIcaroProjectile({ session, projectile, dt, events, dependencies }) {
  const config = TROOPS.interceptadorIcaro;
  const source = indexedTroopById(session, projectile.sourceTroopId);
  let target = projectile.targetKind === "forestObstacle"
    ? session.forestObstacles?.find((tree) => tree.id === projectile.targetId && tree.alive) || null
    : indexedEnemyById(session, projectile.targetId);
  if (projectile.targetKind !== "forestObstacle" && !isEnemyTargetable(target)) target = null;
  if (!target && !projectile.special) {
    const replacement = selectIcaroBurstRetarget(session, projectile, config);
    target = replacement?.entity || null;
    projectile.targetKind = replacement?.kind || null;
    projectile.targetId = target?.id || null;
  }
  if (!target || (projectile.special && (projectile.targetKind !== "enemy" || !isIcaroAirTarget(target)))) {
    projectile.active = false;
    return true;
  }
  const targetPoint = projectile.targetKind === "forestObstacle"
    ? getForestObstacleHitPoint(target)
    : getEnemyHitPoint(target, ENEMIES[target.type]);
  const angle = Math.atan2(targetPoint.y - projectile.y, targetPoint.x - projectile.x);
  projectile.vx = Math.cos(angle) * projectile.speed;
  projectile.vy = Math.sin(angle) * projectile.speed;
  projectile.previousX = projectile.x;
  projectile.previousY = projectile.y;
  projectile.previousRenderX = projectile.x;
  projectile.previousRenderY = projectile.y;
  projectile.x += projectile.vx * dt / 1000;
  projectile.y += projectile.vy * dt / 1000;
  pushProjectileTrail(projectile.trail, projectile.x, projectile.y);
  const treeCollision = findFirstForestObstacleOnSegment(session, { x: projectile.previousX, y: projectile.previousY }, { x: projectile.x, y: projectile.y });
  if (treeCollision) {
    impactForestObstacle({ session, projectile, tree: treeCollision.tree, impactPoint: treeCollision.point, source, events, dependencies });
    return true;
  }
  const hit = Math.hypot(targetPoint.x - projectile.x, targetPoint.y - projectile.y) <= Math.max(32, projectile.speed * dt / 1000);
  if (!hit) {
    if (projectile.ageMs <= 3000) return true;
    projectile.active = false;
    return true;
  }
  const targetFactor = projectile.targetKind === "forestObstacle" ? 1 : projectile.special ? 1 : isIcaroAirTarget(target) ? config.airborneDamageFactor : config.groundDamageFactor;
  const decisionFactor = source ? dependencies.attackDamageMultiplier(session, source, { target: projectile.targetKind === "enemy" ? target : null }) : session.modifiers.troopDamage;
  if (projectile.targetKind === "forestObstacle") {
    impactForestObstacle({ session, projectile, tree: target, impactPoint: targetPoint, source, events, dependencies, amount: projectile.baseDamage * decisionFactor });
    return true;
  }
  else dependencies.damageEnemy(session, target, projectile.baseDamage * targetFactor * decisionFactor, events, { direct: true, ranged: true, sourceX: projectile.origin.x, sourceTroopType: projectile.troopType, sourceTroopId: projectile.sourceTroopId, nimbarcaShieldIgnoreFactor: config.nimbarcaShieldIgnoreFactor });
  events.push({ type: projectile.special ? "icaroInterceptionImpact" : "icaroBulletImpact", weapon: projectile.visualKind, sourceTroopId: projectile.sourceTroopId, targetKind: projectile.targetKind || "enemy", targetId: target.id, x: targetPoint.x, y: targetPoint.y, color: projectile.color, seed: projectile.seed });
  projectile.active = false;
  return true;
}

registerProjectileHandler("icaroBullet", updateIcaroProjectile);
registerProjectileHandler("icaroInterceptionShot", updateIcaroProjectile);
