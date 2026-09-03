const effectsByTroopType = new Map();
const EMPTY_EFFECTS = Object.freeze({});

export function registerTroopVisualEffects(type, effects, { replace = false } = {}) {
  if (!type || !effects || typeof effects !== "object") throw new TypeError("Troop visual effects inválidos");
  if (effectsByTroopType.has(type) && !replace) throw new Error(`Troop visual effects already registered: ${type}`);
  effectsByTroopType.set(type, Object.freeze({ ...effects }));
  return effects;
}

export function getTroopVisualEffects(type) {
  return effectsByTroopType.get(type) || EMPTY_EFFECTS;
}

export function hasTroopVisualEffects(type) {
  return effectsByTroopType.has(type);
}
