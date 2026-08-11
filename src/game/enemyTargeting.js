export const RASGAMAR_SUBMERGED_STATES = new Set([
  "spawnSubmerged",
  "submergedPatrol",
  "submergedApproach",
  "rangedPositioning",
  "tideEscape",
  "dive",
  "laneRelocation",
]);

export function isRasgamarSubmerged(enemy) {
  return Boolean(
    enemy?.type === "enguiaRasgamar"
    && (enemy.rasgamarSubmerged || RASGAMAR_SUBMERGED_STATES.has(enemy.rasgamarState)),
  );
}

export function isIncubatorSubmerged(enemy) {
  return Boolean(enemy?.type === "vermeIncubador" && enemy.incubatorSubmerged);
}

export function isEnemyTargetable(enemy) {
  if (!enemy || enemy.dead || enemy.hp <= 0) return false;
  if (isRasgamarSubmerged(enemy)) return false;
  if (isIncubatorSubmerged(enemy)) return false;
  if (enemy.type === "leviathanNereida") return Boolean(enemy.leviathanTargetable);
  return true;
}

export function canTroopTargetEnemy(session, troop, troopConfig, enemy, enemyConfig = {}) {
  if (!isEnemyTargetable(enemy)) return false;
  if (!enemyConfig.airborne) return true;
  if (troopConfig?.canTargetAir) return true;
  const ranged = troopConfig?.range > 0 || ["bullet", "flame", "arcane", "missile", "projectile", "droneVolley", "janoDual"].includes(troopConfig?.attack);
  return Boolean(enemy.groundRangedTargetable && ranged);
}
