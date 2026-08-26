import { describe, expect, it } from "vitest";
import { drawForestObstacles, getForestObstacleSpriteStage } from "./forestObstacleRenderer.js";

describe("forest obstacle renderer", () => {
  it("maps gameplay damage stages to the five visual states", () => {
    expect(getForestObstacleSpriteStage({ damageStage: "healthy" })).toBe("healthy");
    expect(getForestObstacleSpriteStage({ damageStage: "damaged75" })).toBe("damaged75");
    expect(getForestObstacleSpriteStage({ damageStage: "damaged50" })).toBe("damaged50");
    expect(getForestObstacleSpriteStage({ damageStage: "damaged25" })).toBe("damaged25");
    expect(getForestObstacleSpriteStage({ damageStage: "destroyed" })).toBe("destroyed");
  });

  it("draws the exact loaded stage without a cross-type fallback", () => {
    const drawImage = (...args) => calls.push(args);
    const calls = [];
    const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage, fillRect() {}, fillText() {}, font: "", textAlign: "" };
    const image = { width: 256, height: 256 };
    drawForestObstacles(ctx, { phase: { chapterId: "chapter_07" }, elapsed: 0, forestObstacles: [{ id: "tree", type: "spores", damageStage: "damaged50", hp: 50, maxHp: 100, alive: true, x: 120, y: 180, scale: 1, flipX: false, hitShakeUntil: 0 }] }, 0, {}, { forestObstacles: { spores: { hp50: image } } });
    expect(calls.some((call) => call[0] === image)).toBe(true);
  });
});
