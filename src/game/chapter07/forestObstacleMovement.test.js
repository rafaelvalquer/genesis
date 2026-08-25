import { describe, expect, it } from "vitest";
import { getBlockingForestObstacle } from "./forestObstacleTargeting.js";

describe("forest obstacle movement contract", () => {
  it("has no movement or collision behavior for an enemy crossing a tree", () => {
    const tree = { id: "tree", row: 1, x: 600, alive: true, blocksLineOfSight: true };
    const enemy = { row: 1, x: 850, dead: false };
    expect(getBlockingForestObstacle({ forestObstacles: [tree] }, { row: 1, x: 300 }, enemy)).toBeTruthy();
    enemy.x = 550;
    expect(getBlockingForestObstacle({ forestObstacles: [tree] }, { row: 1, x: 300 }, enemy)).toBeNull();
    expect(tree.alive).toBe(true);
    expect(tree.hp).toBeUndefined();
  });
});
