import { describe, expect, it } from "vitest";
import { getForestObstacleSpriteStage } from "./forestObstacleRenderer.js";

describe("forest obstacle renderer", () => {
  it("maps gameplay damage stages to the five visual states", () => {
    expect(getForestObstacleSpriteStage({ damageStage: "healthy" })).toBe("healthy");
    expect(getForestObstacleSpriteStage({ damageStage: "damaged75" })).toBe("damaged75");
    expect(getForestObstacleSpriteStage({ damageStage: "damaged50" })).toBe("damaged50");
    expect(getForestObstacleSpriteStage({ damageStage: "damaged25" })).toBe("damaged25");
    expect(getForestObstacleSpriteStage({ damageStage: "destroyed" })).toBe("destroyed");
  });
});
