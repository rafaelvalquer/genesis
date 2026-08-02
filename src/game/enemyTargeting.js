export const RASGAMAR_SUBMERGED_STATES = new Set([
  "spawnSubmerged",
  "submergedPatrol",
  "submergedApproach",
  "rangedPositioning",
  "tideEscape",
  "dive",
]);

export function isRasgamarSubmerged(enemy) {
  return Boolean(
    enemy?.type === "enguiaRasgamar"
    && (enemy.rasgamarSubmerged || RASGAMAR_SUBMERGED_STATES.has(enemy.rasgamarState)),
  );
}

export function isEnemyTargetable(enemy) {
  if (!enemy || enemy.dead || enemy.hp <= 0) return false;
  if (isRasgamarSubmerged(enemy)) return false;
  if (enemy.type === "leviathanNereida") return Boolean(enemy.leviathanTargetable);
  return true;
}
