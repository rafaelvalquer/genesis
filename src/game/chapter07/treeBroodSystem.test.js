import { describe, expect, it } from "vitest";
import { createBattleSession, damageForestObstacleInBattle, stepBattle } from "../battleModel.js";
import { buildSectorQueue } from "./convoySpawnDirector.js";
import { PHASES } from "../content.js";
import { createForestObstacle } from "./forestObstacleGeneration.js";
import { TREE_BROOD_CONFIG, TREE_BROOD_PHASE_CONFIG } from "./treeBroodConfig.js";
import { tryTriggerTreeBrood } from "./treeBroodSystem.js";

const phase = (id) => PHASES.find((entry) => entry.id === id);
const tree = (type = "fragile") => createForestObstacle({ id: `tree-${type}`, type, row: 1, col: 6, x: 416, y: 72 });
const sessionFor = (id = "fase_52", random = 0) => {
  const session = createBattleSession(phase(id), ["colono"], 77);
  session.rng = () => random;
  session.spawnEnemy = (queued) => ({ id: "larva-1", type: queued.type, row: queued.row, x: queued.x, y: 72, spawnSource: queued.spawnSource, sourceTreeId: queued.sourceTreeId });
  session.enemies = [];
  return session;
};

describe("tree brood", () => {
  it("triggers from a living tree and preserves origin/emerge metadata", () => {
    const session = sessionFor("fase_52", 0);
    const current = tree("mineralized"); const events = [];
    expect(tryTriggerTreeBrood(session, current, {}, events)).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ type: "treeBroodTriggered", treeId: current.id, treeType: "mineralized" }));
    expect(events).toContainEqual(expect.objectContaining({ type: "treeLarvaSpawned", treeId: current.id, enemyType: "larvaRaizFerro", row: current.row }));
    expect(current.brood.spawnedCount).toBe(1);
    expect(session.chapterSevenMetrics.forestBroodRolls).toBe(1);
  });

  it("respects chance, cooldown, per-tree maximum and global cap", () => {
    const miss = sessionFor("fase_52", 1); expect(tryTriggerTreeBrood(miss, tree(), {}, [])).toBe(false);
    const cooldown = sessionFor("fase_52", 0); const current = tree("fragile");
    expect(tryTriggerTreeBrood(cooldown, current, {}, [])).toBe(true);
    expect(tryTriggerTreeBrood(cooldown, current, {}, [])).toBe(false);
    cooldown.elapsed = 900; expect(tryTriggerTreeBrood(cooldown, current, {}, [])).toBe(false);
    const capped = sessionFor("fase_52", 0); capped.enemies = Array.from({ length: 3 }, (_, index) => ({ id: `larva-${index}`, type: "larvaRaizFerro", spawnSource: "forestBrood", dead: false }));
    expect(tryTriggerTreeBrood(capped, tree("ferrivore"), {}, [])).toBe(false);
    const maxed = sessionFor("fase_52", 0); const mineral = tree("mineralized"); mineral.brood.spawnedCount = TREE_BROOD_CONFIG.mineralized.maxSpawnsPerTree;
    expect(tryTriggerTreeBrood(maxed, mineral, {}, [])).toBe(false);
    for (const [type, limit] of Object.entries({ fragile: 1, ferrivore: 2, mineralized: 3, spores: 2 })) {
      const bounded = sessionFor("fase_56", 0); const current = tree(type);
      for (let index = 0; index < limit; index += 1) {
        bounded.elapsed = index * 900;
        expect(tryTriggerTreeBrood(bounded, current, {}, [])).toBe(true);
      }
      bounded.elapsed = limit * 900;
      expect(tryTriggerTreeBrood(bounded, current, {}, [])).toBe(false);
      expect(current.brood.spawnedCount).toBe(limit);
    }
  });

  it("disables phases 49-51 and never triggers on a dead or lethal tree hit", () => {
    expect(TREE_BROOD_PHASE_CONFIG.fase_50.enabled).toBe(false);
    const disabled = sessionFor("fase_50", 0); expect(tryTriggerTreeBrood(disabled, tree(), {}, [])).toBe(false);
    const lethal = sessionFor("fase_52", 0); const current = tree("spores");
    damageForestObstacleInBattle(lethal, current, current.hp, []);
    expect(current.alive).toBe(false); expect(lethal.enemies).toHaveLength(0);
  });

  it("keeps the spores tree death effect independent from brood", () => {
    const session = sessionFor("fase_56", 0); const current = tree("spores");
    damageForestObstacleInBattle(session, current, current.hp, []);
    expect(current.deathEffectTriggered).toBe(true);
    expect(session.enemies).toHaveLength(0);
  });

  it("uses emerge only for brood spawns and then resumes normal movement", () => {
    const session = createBattleSession(phase("fase_52"), ["colono"], 99);
    const larva = session.spawnEnemy({ type: "larvaRaizFerro", row: 1, x: 520, spawnSource: "forestBrood", sourceTreeId: "tree-1" });
    larva.animationState = "emerge"; larva.emergeState = "emerging"; larva.emergeStartedAt = 0; larva.emergeEndsAt = 720; larva.emergeUntil = 720; larva.attackReadyAt = 720;
    session.waveActive = true; session.convoyFlow.state = "sectorActive"; session.convoyFlow.sectorStartedAt = 0;
    stepBattle(session, 350);
    expect(larva.animationState).toBe("emerge"); expect(larva.x).toBe(520); expect(larva.meleeAttackPending).toBe(false);
    stepBattle(session, 370);
    expect(larva.animationState).toBe("walking"); expect(larva.emergeState).toBeNull(); expect(larva.x).toBeLessThan(520);
  });

  it("treats a three-shot burst as one brood roll during the cooldown window", () => {
    const session = sessionFor("fase_52", 1); const current = tree("ferrivore");
    expect(tryTriggerTreeBrood(session, current, { projectileKind: "bullet" }, [])).toBe(false);
    session.elapsed = 100; expect(tryTriggerTreeBrood(session, current, { projectileKind: "bullet" }, [])).toBe(false);
    session.elapsed = 150; expect(tryTriggerTreeBrood(session, current, { projectileKind: "bullet" }, [])).toBe(false);
    expect(session.chapterSevenMetrics.forestBroodRolls).toBe(1);
  });

  it("spawns naturally in walking state and supports grouped 110ms packets", () => {
    const queue = buildSectorQueue(phase("fase_50"), 0, 1).filter((entry) => entry.type === "larvaRaizFerro");
    expect(queue.length).toBeGreaterThanOrEqual(5);
    expect(queue.every((entry) => entry.spawnSource === "convoySector")).toBe(true);
    const session = createBattleSession(phase("fase_50"), ["colono"], 101);
    const larva = session.spawnEnemy({ type: "larvaRaizFerro", row: 1 });
    expect(larva.animationState).toBe("walking"); expect(larva.emergeState).toBeNull();
  });
});
