import { CELL } from "../visualGeometry.js";

const living = (target) => target && !target.dead;

export function launchDardifagoDart(session, enemy, target, config, createId, events) {
  const ranged = config.rangedAttack;
  const targetType = target.type === "convoy" ? "convoy" : "troop";
  const targetPoint = targetType === "convoy" ? { x: session.convoy.x, y: session.convoy.y } : { x: target.x, y: target.y - 18 };
  const origin = { x: enemy.x + (ranged.releaseVisual?.offsetX || -46), y: enemy.y + (ranged.releaseVisual?.offsetY || -22) };
  const distance = Math.max(1, Math.hypot(targetPoint.x - origin.x, targetPoint.y - origin.y));
  const toxic = Boolean(enemy.nextShotIsToxic);
  const projectile = { id: createId("dardifago_dart"), kind: "dardifagoDart", visualKind: toxic ? "toxicVertebralDart" : "vertebralDart",
    toxic, sourceEnemyId: enemy.id, targetType, targetId: target.id, x: origin.x, y: origin.y,
    previousX: origin.x, previousY: origin.y, targetX: targetPoint.x, targetY: targetPoint.y,
    lastKnownTargetX: targetPoint.x, lastKnownTargetY: targetPoint.y, speed: ranged.projectileSpeed,
    vx: (targetPoint.x - origin.x) / distance * ranged.projectileSpeed,
    vy: (targetPoint.y - origin.y) / distance * ranged.projectileSpeed,
    damage: targetType === "convoy" ? ranged.convoyDamage : ranged.troopDamage, active: true, ageMs: 0, launched: false,
    row: enemy.row, trail: [], launched: true,
  };
  session.enemyProjectiles.push(projectile);
  session.chapterSevenMetrics.dardifagoShots += 1;
  session.chapterSevenMetrics[ toxic ? "dardifagoToxicShots" : "dardifagoNormalShots" ] += 1;
  events.push({ type: toxic ? "dardifagoToxicDartReleased" : "dardifagoDartReleased", sourceEnemyId: enemy.id, projectileId: projectile.id, x: origin.x, y: origin.y, targetId: target.id });
  return projectile;
}

export function dardifagoTargetInRange(enemy, target, rangeTiles) {
  return living(target) && Math.abs(target.x - enemy.x) <= rangeTiles * CELL.width;
}
