const resolvers = new Map();

export function registerTroopVisualResolver(type, resolver) {
  if (!type || typeof resolver !== "function") throw new TypeError("Resolver visual inválido");
  resolvers.set(type, resolver);
  return resolver;
}

export function getTroopVisualResolver(type) {
  return resolvers.get(type) || null;
}

export function hasTroopVisualResolver(type) {
  return resolvers.has(type);
}
