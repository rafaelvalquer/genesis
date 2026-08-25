import { describe, expect, it } from "vitest";
import { damageForestObstacle, destroyForestObstacle } from "./forestObstacleSystem.js";

const makeTree = (type = "ferrivore") => ({ id: "tree_1", type, x: 600, y: 180, hp: type === "spores" ? 110 : 130, maxHp: type === "spores" ? 110 : 130, alive: true, damageStage: "healthy", blocksPlacement: true, blocksLineOfSight: true, deathEffectTriggered: false });

describe("forest obstacle system", () => {
  it("updates HP stages, shake and releases a destroyed cell", () => {
    const tree = makeTree(); const session = { elapsed: 100, enemies: [], chapterSevenMetrics: {} }; const events = [];
    damageForestObstacle(session, tree, 40, events);
    expect(tree.damageStage).toBe("damaged75");
    expect(tree.hitShakeUntil).toBe(230);
    damageForestObstacle(session, tree, 1000, events);
    expect(tree.alive).toBe(false); expect(tree.blocksPlacement).toBe(false); expect(tree.blocksLineOfSight).toBe(false);
  });
  it("bursts spores once and affects enemies, never troops", () => {
    const tree = makeTree("spores"); const enemy = { id: "e", x: 630, y: 180, type: "rastejanteMata", dead: false }; const session = { elapsed: 0, enemies: [enemy], chapterSevenMetrics: {}, enemyConfigs: {} }; const events = []; let calls = 0;
    const stun = () => { calls += 1; };
    destroyForestObstacle(session, tree, events, stun); destroyForestObstacle(session, tree, events, stun);
    expect(calls).toBe(1); expect(session.chapterSevenMetrics.forestSporeBursts).toBe(1); expect(events.filter((event) => event.type === "forestSporeBurst")).toHaveLength(1);
  });
});
