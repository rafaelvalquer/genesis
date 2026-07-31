import { describe, expect, it } from "vitest";
import {
  clearDecodedImageCache,
  getAssetCacheMetrics,
  loadBattleAssets,
  releaseBattleAssets,
} from "./assetCatalog.js";
import { PHASES } from "./content.js";

describe("catálogo de assets de batalha", () => {
  it("carrega somente os três estados unitários do Drone Sentinela e contabiliza o cache", async () => {
    clearDecodedImageCache();
    const assets = await loadBattleAssets(PHASES[0], ["droneSentinela"]);
    expect(Object.keys(assets.troops.droneSentinela)).toEqual(["idle", "attack", "death"]);
    expect(assets.troops.droneSentinela.idle).toHaveLength(8);
    expect(assets.metrics.images).toBeGreaterThanOrEqual(24);
    expect(getAssetCacheMetrics().retainedImages).toBeGreaterThanOrEqual(24);
    releaseBattleAssets(assets);
    expect(getAssetCacheMetrics().retainedImages).toBe(0);
  });

  it("cancela uma batalha abandonada antes de iniciar a decodificação", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadBattleAssets(PHASES[0], ["droneSentinela"], undefined, {
      signal: controller.signal,
    })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("permite postergar estados raros sem mudar o formato do resultado", async () => {
    const assets = await loadBattleAssets(PHASES[0], ["droneSentinela"], undefined, {
      deferRareStates: true,
    });
    expect(assets.troops.droneSentinela.idle).toHaveLength(8);
    expect(assets.troops.droneSentinela.death).toBeUndefined();
    expect(assets.deferredStates).toBe(1);
    await assets.loadDeferred();
    expect(assets.troops.droneSentinela.death).toHaveLength(8);
    releaseBattleAssets(assets);
  });
});
