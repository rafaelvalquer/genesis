export function isEnemyTargetable(enemy) {
  if (!enemy || enemy.dead || enemy.hp <= 0) return false;
  if (enemy.type === "enguiaRasgamar" && enemy.rasgamarSubmerged) return false;
  if (enemy.type === "leviathanNereida") return Boolean(enemy.leviathanTargetable);
  return true;
}
