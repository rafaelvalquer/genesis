import { describe, expect, it } from "vitest";
import { TROOPS } from "../content.js";
import { CELL, getMuzzleWorldPosition } from "../visualGeometry.js";
import { findFirstForestObstacleCollision, findFirstForestObstacleOnSegment, getForestObstacleHitbox, intersectSegmentWithForestObstacle, projectileCrossesForestObstacle } from "./forestObstacleCollision.js";

const tree = (x, type = "ferrivore", row = 1) => ({ id: `tree_${x}`, type, row, x, y: row * CELL.height + CELL.height / 2, alive: true, blocksLineOfSight: true, scale: 1 });

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

  it("detects horizontal, diagonal-up and diagonal-down segment intersections", () => {
    const obstacle = tree(600);
    expect(intersectSegmentWithForestObstacle({ x: 300, y: 180 }, { x: 800, y: 180 }, obstacle)?.point.x).toBeCloseTo(579, 0);
    expect(intersectSegmentWithForestObstacle({ x: 300, y: 300 }, { x: 800, y: 60 }, obstacle)).toEqual(expect.objectContaining({ tree: obstacle }));
    expect(intersectSegmentWithForestObstacle({ x: 300, y: 60 }, { x: 800, y: 300 }, obstacle)).toEqual(expect.objectContaining({ tree: obstacle }));
    expect(intersectSegmentWithForestObstacle({ x: 300, y: 320 }, { x: 800, y: 320 }, obstacle)).toBeNull();
  });

  it("orders two trees by the real segment intersection, not by tree.x", () => {
    const first = tree(700, "ferrivore", 1);
    const second = tree(500, "ferrivore", 3);
    const hit = findFirstForestObstacleOnSegment({ forestObstacles: [first, second] }, { x: 300, y: 660 }, { x: 800, y: 60 });
    expect(hit?.tree).toBe(second);
  });

  it("ignores dead trees and trees that do not block line of sight", () => {
    const dead = tree(500); dead.alive = false;
    const nonBlocking = tree(600); nonBlocking.blocksLineOfSight = false;
    expect(findFirstForestObstacleOnSegment({ forestObstacles: [dead, nonBlocking] }, { x: 300, y: 180 }, { x: 800, y: 180 })).toBeNull();
  });

  it("detects a fast diagonal segment without tunneling", () => {
    const hit = findFirstForestObstacleOnSegment({ forestObstacles: [tree(600)] }, { x: 0, y: 360 }, { x: 1100, y: 0 });
    expect(hit?.point.x).toBeGreaterThan(0);
    expect(hit?.point.x).toBeLessThan(1100);
  });
});
