import { describe, expect, it } from "vitest";
import { getBlockingForestObstacle, resolveForestCombatTarget } from "./forestObstacleTargeting.js";

const session = (trees) => ({ forestObstacles: trees });
const tree = (x, row = 1, alive = true) => ({ id: "tree", x, row, alive, blocksLineOfSight: alive });
const enemy = (id, x, row = 1) => ({ id, x, row, dead: false, groundTargetable: true });

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

  it("targets a living tree even when the lane has no enemies", () => {
    const result = resolveForestCombatTarget(session([tree(600)]), { row: 1, x: 300 }, { range: 6 }, []);
    expect(result).toEqual({ kind: "forestObstacle", entity: expect.objectContaining({ x: 600 }) });
  });

  it("prefers an exposed enemy and never targets an enemy behind the tree", () => {
    const result = resolveForestCombatTarget(session([tree(600)]), { row: 1, x: 300 }, { range: 8 }, [enemy("rear", 850), enemy("front", 500)]);
    expect(result).toEqual({ kind: "enemy", entity: expect.objectContaining({ id: "front" }) });
    const coveredOnly = resolveForestCombatTarget(session([tree(600)]), { row: 1, x: 300 }, { range: 8 }, [enemy("rear", 850)]);
    expect(coveredOnly.kind).toBe("forestObstacle");
  });

  it("respects row, range, destroyed trees, and mortar cover exceptions", () => {
    expect(resolveForestCombatTarget(session([tree(600, 3)]), { row: 1, x: 300 }, { range: 6 }, [])).toBeNull();
    expect(resolveForestCombatTarget(session([tree(1200)]), { row: 1, x: 300 }, { range: 6 }, [])).toBeNull();
    expect(resolveForestCombatTarget(session([tree(600, 1, false)]), { row: 1, x: 300 }, { range: 6 }, [])).toBeNull();
    const mortar = resolveForestCombatTarget(session([tree(600)]), { row: 1, x: 300 }, { range: 8, forestInteraction: { canTargetObstacle: false, ignoresCover: true } }, [enemy("rear", 850)]);
    expect(mortar).toEqual({ kind: "enemy", entity: expect.objectContaining({ id: "rear" }) });
  });

  it("makes a latched Garravinha targetable from either escort route and prioritizes it in range", () => {
    const latched = { ...enemy("latched", 700, 1), type: "garravinha", garravinhaState: "latched", targetableRows: [1, 3] };
    const normal = enemy("normal", 500, 3);
    expect(resolveForestCombatTarget(session([]), { row: 1, x: 300 }, { range: 6 }, [latched])).toEqual({ kind: "enemy", entity: latched });
    expect(resolveForestCombatTarget(session([]), { row: 3, x: 300 }, { range: 6 }, [normal, latched])).toEqual({ kind: "enemy", entity: latched });
    expect(resolveForestCombatTarget(session([]), { row: 2, x: 300 }, { range: 6 }, [latched])).toBeNull();
    expect(resolveForestCombatTarget(session([]), { row: 4, x: 300 }, { range: 6 }, [latched])).toBeNull();
    expect(resolveForestCombatTarget(session([]), { row: 3, x: 0 }, { range: 4 }, [latched])).toBeNull();
  });
});
