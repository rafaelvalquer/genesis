const handlers = new Map();

export function registerProjectileHandler(kind, handler, { replace = false } = {}) {
  if (!kind || typeof handler !== "function") throw new TypeError("Projectile handler inválido");
  if (handlers.has(kind) && !replace) throw new Error(`Projectile handler already registered: ${kind}`);
  handlers.set(kind, handler);
  return handler;
}

export function getProjectileHandler(kind) {
  return handlers.get(kind) || null;
}

export function hasProjectileHandler(kind) {
  return handlers.has(kind);
}
