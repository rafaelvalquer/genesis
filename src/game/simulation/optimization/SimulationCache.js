function stableEntries(
  value,
) {
  if (
    value == null
    || typeof value !== "object"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stableEntries);
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [
        key,
        stableEntries(value[key]),
      ]),
  );
}

export function createSimulationCacheKey({
  phaseId,
  loadout,
  strategy,
  policy,
  seeds,
  config,
}) {
  return JSON.stringify(
    stableEntries({
      phaseId,
      loadout: [...loadout].sort(),
      strategy,
      policy,
      seeds: [...seeds],
      config,
    }),
  );
}

export class SimulationCache {
  constructor() {
    this.entries = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    if (!this.entries.has(key)) {
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    return this.entries.get(key);
  }

  set(
    key,
    value,
  ) {
    this.entries.set(key, value);
    return value;
  }

  clear() {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }

  summary() {
    return {
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
