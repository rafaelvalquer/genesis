const effectsByEnemyType = new Map();
const EMPTY_EFFECTS = Object.freeze({});

export function registerEnemyVisualEffects(type, effects, { replace = false } = {}) {
  if (!type || !effects || typeof effects !== "object") throw new TypeError("Enemy visual effects inválidos");
  if (effectsByEnemyType.has(type) && !replace) throw new Error(`Enemy visual effects already registered: ${type}`);
  effectsByEnemyType.set(type, Object.freeze({ ...effects }));
  return effects;
}

export function getEnemyVisualEffects(type) {
  return effectsByEnemyType.get(type) || EMPTY_EFFECTS;
}

export function hasEnemyVisualEffects(type) {
  return effectsByEnemyType.has(type);
}
