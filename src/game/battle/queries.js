import { getBattleIndex, livingEnemyById, livingTroopById } from "../battleIndex.js";
import { isEnemyTargetable } from "../enemyTargeting.js";

export function indexedTroopById(session, troopId) {
  const index = getBattleIndex(session);
  if (index) return livingTroopById(index, troopId);
  return session.troops.find((troop) => troop.id === troopId && !troop.dead) || null;
}

export function indexedEnemyById(session, enemyId) {
  const index = getBattleIndex(session);
  if (index) return livingEnemyById(index, enemyId);
  return session.enemies.find((enemy) => enemy.id === enemyId && !enemy.dead && enemy.hp > 0) || null;
}

export function getEnemyTargetableRows(enemy) {
  if (enemy?.targetableRows) return isEnemyTargetable(enemy) ? enemy.targetableRows : [];
  if (enemy?.type === "leviathanNereida") {
    if (!enemy.leviathanTargetable) return [];
    return enemy.leviathanTargetableRows?.length ? enemy.leviathanTargetableRows : [enemy.row];
  }
  return [enemy?.row];
}

export function enemyOccupiesTargetRow(enemy, row) {
  if (!isEnemyTargetable(enemy)) return false;
  return enemy.targetableRows
    ? enemy.targetableRows.includes(row)
    : enemy.type === "leviathanNereida"
    ? Boolean(enemy.leviathanTargetable && enemy.leviathanTargetableRows?.includes(row))
    : enemy.row === row;
}

export function enemiesForRow(session, row) {
  const indexed = getBattleIndex(session)?.targetableEnemiesByRow[row];
  if (indexed) return indexed;
  return session.enemies.filter((enemy) => enemyOccupiesTargetRow(enemy, row));
}

export function troopsForRow(session, row) {
  return getBattleIndex(session)?.troopsByRow[row] || session.troops;
}
