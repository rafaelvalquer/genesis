const resolvers = new Map();

export function registerTroopVisualResolver(type, resolver) {
  const entry = typeof resolver === "function" ? { resolveVisual: resolver } : resolver;
  if (!type || !entry || typeof entry.resolveVisual !== "function") throw new TypeError("Resolver visual inválido");
  resolvers.set(type, entry);
  return resolver;
}

export function getTroopVisualResolver(type) {
  return resolvers.get(type)?.resolveVisual || null;
}

export function getTroopAnimationResolver(type) {
  return resolvers.get(type)?.resolveAnimation || null;
}

export function hasTroopVisualResolver(type) {
  return resolvers.has(type);
}
