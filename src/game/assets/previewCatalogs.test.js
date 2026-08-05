import { describe, expect, it } from "vitest";
import { PHASES } from "../content.js";
import {
  getArenaCatalogSize,
  getArenaUrl,
} from "./arenaCatalog.js";
import {
  getEnemyConceptUrl,
  getEnemyPreviewCatalogSize,
  getEnemyPreviewUrl,
} from "./enemyPreviewCatalog.js";
import {
  getTroopPreviewCatalogSize,
  getTroopPreviewUrl,
} from "./troopPreviewCatalog.js";
import {
  clearTroopPreviewFrameCache,
  getTroopPreviewFrameCacheSize,
  loadTroopPreviewFrameUrls,
} from "./troopPreviewAnimationCatalog.js";

describe("catálogos focados de preview", () => {
  it("resolve o preview estático das tropas sem carregar o loader de batalha", () => {
    expect(getTroopPreviewCatalogSize()).toBeGreaterThan(0);
    expect(getTroopPreviewUrl("colono"))
      .toMatch(/colono\/idle\/frame0.*\.png/i);
    expect(getTroopPreviewUrl("muralhaReforcada"))
      .toMatch(/muralhaReforcada\/defense\/frame0.*\.png/i);
  });

  it("resolve previews e conceitos dos inimigos", () => {
    expect(getEnemyPreviewCatalogSize()).toBeGreaterThan(0);
    expect(
      getEnemyPreviewUrl("medu")
        || getEnemyConceptUrl("medu"),
    ).toBeTruthy();
  });

  it("resolve a arena sem importar frames de batalha", () => {
    expect(getArenaCatalogSize()).toBeGreaterThan(0);
    expect(getArenaUrl(PHASES[0].arenaId))
      .toMatch(/\.webp/i);
  });

  it("carrega a animação de preview somente quando solicitada", async () => {
    clearTroopPreviewFrameCache();
    expect(getTroopPreviewFrameCacheSize()).toBe(0);

    const frames = await loadTroopPreviewFrameUrls(
      "colono",
      "idle",
    );

    expect(frames.length).toBeGreaterThan(1);
    expect(frames[0]).toMatch(/frame0.*\.png/i);
    expect(getTroopPreviewFrameCacheSize()).toBe(1);

    clearTroopPreviewFrameCache();
  });
});
