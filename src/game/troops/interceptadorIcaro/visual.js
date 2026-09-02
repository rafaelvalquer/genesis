export function resolveIcaroVisual(troop, config = {}, options = {}) {
  const state = options.state || troop?.state;
  const direction = options.direction || (state === "interceptionFire" ? troop?.interceptionAimDirection : null);
  if (options.direction === "up" || (state === "interceptionFire" && direction === "up")) {
    return config.interceptionFireUpVisual || config.interceptionFireVisual;
  }
  if (options.direction === "down" || (state === "interceptionFire" && direction === "down")) {
    return config.interceptionFireDownVisual || config.interceptionFireVisual;
  }
  if (state === "interceptionFire") return config.interceptionFireVisual;
  if (state === "interceptionLock") return config.interceptionLockVisual;
  if (state === "paralyzed") return config.paralyzedVisual;
  if (state === "idle") return config.idleVisual;
  return config.attackVisual;
}
