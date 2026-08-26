import { describe, expect, it } from "vitest";
import { CHAPTER_SEVEN_PHASES } from "../chapterSevenPhases.js";
import { FOREST_OBSTACLE_STAGES, getForestObstacleAssetUrl, resolveForestObstacleAssetDependencies } from "../assets/forestObstacleAssetCatalog.js";
import { loadBattleAssets } from "../assets/battleAssetLoader.js";

describe("forest obstacle assets", () => {
  it("resolves exactly twenty dependencies only for enabled chapter phases", () => {
    expect(resolveForestObstacleAssetDependencies(CHAPTER_SEVEN_PHASES[0])).toHaveLength(0);
    expect(resolveForestObstacleAssetDependencies(CHAPTER_SEVEN_PHASES[1])).toHaveLength(20);
    expect(FOREST_OBSTACLE_STAGES).toHaveLength(5);
  });
  it("keeps a stable type/stage lookup", () => {
    const value = getForestObstacleAssetUrl("ferrivore", "hp100");
    expect(value).toBeTruthy();
  });

  it("decodes all twenty assets through the battle loader", async () => {
    const assets = await loadBattleAssets(CHAPTER_SEVEN_PHASES[1], [], () => {}, { enemyIds: [], skipDefenses: true });
    for (const type of ["fragile", "ferrivore", "mineralized", "spores"]) {
      for (const stage of FOREST_OBSTACLE_STAGES) expect(assets.forestObstacles[type][stage]).toBeTruthy();
    }
  });
});
