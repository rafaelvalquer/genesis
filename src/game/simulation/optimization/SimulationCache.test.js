import {
  describe,
  expect,
  it,
} from "vitest";
import {
  createSimulationCacheKey,
  SimulationCache,
} from "./SimulationCache.js";

describe("cache de simulações", () => {
  it("gera a mesma chave para políticas equivalentes", () => {
    const left = createSimulationCacheKey({
      phaseId: "fase_01",
      loadout: ["marine", "colono"],
      strategy: "balanced",
      policy: {
        defenseWeight: 1,
        offenseWeight: 2,
      },
      seeds: [1, 2],
      config: {},
    });

    const right = createSimulationCacheKey({
      phaseId: "fase_01",
      loadout: ["colono", "marine"],
      strategy: "balanced",
      policy: {
        offenseWeight: 2,
        defenseWeight: 1,
      },
      seeds: [1, 2],
      config: {},
    });

    expect(left).toBe(right);
  });

  it("registra hits e misses", () => {
    const cache = new SimulationCache();

    expect(cache.get("missing")).toBeNull();

    cache.set("key", {
      value: 1,
    });

    expect(cache.get("key")).toEqual({
      value: 1,
    });

    expect(cache.summary()).toEqual({
      entries: 1,
      hits: 1,
      misses: 1,
    });
  });
});
