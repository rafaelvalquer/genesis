const MULTIPLIERS = Object.freeze([1, 1.1, 1.2]);

export function getPersistentBiteMultiplier(enemy, targetId, config = {}) {
  if (enemy.persistentBiteTargetId !== targetId) return MULTIPLIERS[0];
  const multipliers = config.multipliers || MULTIPLIERS;
  return multipliers[Math.min(Math.max(enemy.persistentBiteHits || 0, 0), multipliers.length - 1)] ?? 1.2;
}

export function commitPersistentBite(enemy, targetId, config = {}) {
  if (enemy.persistentBiteTargetId !== targetId) {
    enemy.persistentBiteTargetId = targetId;
    enemy.persistentBiteHits = 1;
  } else {
    enemy.persistentBiteHits = Math.min(
      (enemy.persistentBiteHits || 0) + 1,
      config.maxHitsForScaling ? config.maxHitsForScaling + 1 : Number.MAX_SAFE_INTEGER,
    );
  }
  const multipliers = config.multipliers || MULTIPLIERS;
  enemy.persistentBiteMultiplier = multipliers[Math.min(enemy.persistentBiteHits, multipliers.length - 1)] ?? 1.2;
  enemy.frenzyLevel = Math.min(Math.max(enemy.persistentBiteHits, 0), 2);
  return enemy.frenzyLevel;
}

export function resetPersistentBite(enemy) {
  enemy.persistentBiteTargetId = null;
  enemy.persistentBiteHits = 0;
  enemy.persistentBiteMultiplier = 1;
  enemy.frenzyLevel = 0;
}
