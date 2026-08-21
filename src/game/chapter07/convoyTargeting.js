import { CELL } from "../visualGeometry.js";

export function canEnemyReachConvoy(session, enemy, config = {}) {
  if (!session.convoy || enemy.dead || session.convoy.invulnerable) return false;
  const rows = config.canTargetConvoyFromOuterRow ? [0, 1, 3, 4] : (session.phase.convoy.escortRows || [1, 3]);
  const rangeTiles = config.convoyAttackRangeTiles ?? session.phase.convoy.lateralAttackRangeTiles ?? 1;
  return rows.includes(enemy.row) && Math.abs(enemy.x - session.convoy.x) <= rangeTiles * CELL.width;
}

export function hasBlockingTroop(session, enemy) {
  return session.troops.some((troop) => !troop.dead && troop.row === enemy.row
    && troop.x < enemy.x && enemy.x - troop.x <= CELL.width * .62);
}

export function updateConvoyThreat(session, enemyConfigs, events = []) {
  if (!session.convoy) return [];
  const previous = session.convoy.underAttack;
  const attackers = session.enemies.filter((enemy) => canEnemyReachConvoy(session, enemy, enemyConfigs[enemy.type])
    && !hasBlockingTroop(session, enemy));
  session.convoy.attackerIds = attackers.map((enemy) => enemy.id);
  session.convoy.underAttack = attackers.length > 0;
  if (!previous && session.convoy.underAttack) events.push({ type: "convoyUnderAttack", attackerIds: [...session.convoy.attackerIds] });
  if (previous && !session.convoy.underAttack) events.push({ type: "convoyAttackCleared" });
  return attackers;
}
