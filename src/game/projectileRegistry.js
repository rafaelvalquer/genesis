const handlers = new Map();

export function registerProjectileHandler(kind, handler) {
  if (!kind || typeof handler !== "function") throw new TypeError("Projectile handler inválido");
  handlers.set(kind, handler);
  return handler;
}

export function getProjectileHandler(kind) {
  return handlers.get(kind) || null;
}

export function hasProjectileHandler(kind) {
  return handlers.has(kind);
}
