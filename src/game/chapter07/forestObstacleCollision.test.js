import { describe, expect, it } from "vitest";
import { findFirstForestObstacleCollision, getForestObstacleHitbox, projectileCrossesForestObstacle } from "./forestObstacleCollision.js";

const tree = (x, type = "ferrivore") => ({ id: `tree_${x}`, type, row: 1, x, y: 180, alive: true });

describe("forest obstacle projectile collision", () => {
  it("uses a trunk hitbox and catches a fast straight projectile", () => {
    const obstacle = tree(520);
    const projectile = { row: 1 };
    expect(getForestObstacleHitbox(obstacle).width).toBe(42);
    expect(projectileCrossesForestObstacle(projectile, obstacle, 490, 180, 535, 180)).toBe(true);
  });

  it("returns the first tree in the projectile segment", () => {
    const session = { forestObstacles: [tree(620), tree(520)] };
    const projectile = { row: 1 };
    expect(findFirstForestObstacleCollision(session, projectile, 490, 180, 700, 180)?.id).toBe("tree_520");
  });
});
