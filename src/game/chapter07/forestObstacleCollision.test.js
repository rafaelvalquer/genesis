import { describe, expect, it } from "vitest";
import { TROOPS } from "../content.js";
import { CELL, getMuzzleWorldPosition } from "../visualGeometry.js";
import { findFirstForestObstacleCollision, getForestObstacleHitbox, projectileCrossesForestObstacle } from "./forestObstacleCollision.js";

const tree = (x, type = "ferrivore") => ({ id: `tree_${x}`, type, row: 1, x, y: 180, alive: true, scale: 1 });

describe("forest obstacle projectile collision", () => {
  it("anchors the trunk hitbox to the same ground line used by the renderer", () => {
    const obstacle = tree(520);
    const hitbox = getForestObstacleHitbox(obstacle);
    expect(hitbox.width).toBe(42);
    expect(hitbox.y + hitbox.height / 2).toBeCloseTo(obstacle.y + CELL.height * 0.4);
  });

  it("catches a fast straight projectile across the rendered trunk", () => {
    const obstacle = tree(520);
    const projectile = { row: 1 };
    expect(projectileCrossesForestObstacle(projectile, obstacle, 490, 190, 535, 190)).toBe(true);
  });

  it("catches every Marine burst shot despite the per-frame muzzle height", () => {
    const obstacle = tree(520);
    const projectile = { row: 1 };
    const marine = { type: "marine", x: 250, y: obstacle.y };

    TROOPS.marine.attackVisual.shots.forEach((_, shotIndex) => {
      const muzzle = getMuzzleWorldPosition(marine, TROOPS.marine, shotIndex);
      expect(projectileCrossesForestObstacle(
        projectile,
        obstacle,
        490,
        muzzle.y,
        535,
        muzzle.y,
      )).toBe(true);
    });
  });

  it("returns the first tree in the projectile segment", () => {
    const session = { forestObstacles: [tree(620), tree(520)] };
    const projectile = { row: 1 };
    expect(findFirstForestObstacleCollision(session, projectile, 490, 190, 700, 190)?.id).toBe("tree_520");
  });
});
