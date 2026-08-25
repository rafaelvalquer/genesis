import { describe, expect, it } from "vitest";
import { getBlockingForestObstacle } from "./forestObstacleTargeting.js";

const session = (trees) => ({ forestObstacles: trees });
const tree = (x, row = 1, alive = true) => ({ id: "tree", x, row, alive, blocksLineOfSight: alive });

describe("forest obstacle targeting", () => {
  it("blocks a target behind a living tree", () => {
    expect(getBlockingForestObstacle(session([tree(600)]), { row: 1, x: 300 }, { row: 1, x: 850 })).toBeTruthy();
  });
  it("does not block targets before the tree or after destruction", () => {
    expect(getBlockingForestObstacle(session([tree(600)]), { row: 1, x: 300 }, { row: 1, x: 550 })).toBeNull();
    expect(getBlockingForestObstacle(session([tree(600, 1, false)]), { row: 1, x: 300 }, { row: 1, x: 850 })).toBeNull();
  });
  it("does not block another route", () => {
    expect(getBlockingForestObstacle(session([tree(600, 3)]), { row: 1, x: 300 }, { row: 1, x: 850 })).toBeNull();
  });
});
