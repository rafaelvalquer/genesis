import { describe, expect, it } from "vitest";
import {
  CHAPTER_SIX_ALPHA_MODIFIERS,
  countPressureTroops,
  createAlphaPressureState,
  evaluateAlphaPressureCycle,
  selectAlphaSpawnRows,
  startAlphaPressureCycle,
} from "./chapterSixAlphaPressure.js";
import { createRng } from "./domain.js";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { createBattleSession, createTroopEntity, startWave, stepBattle } from "./battleModel.js";

const config = { enabled: true, maxLevel: 4, enemyType: "devoradorCaldeira", warningMs: 1800 };

function session(seed = 41, troopCount = 5) {
  const state = {
    rng: createRng(seed),
    elapsed: 1000,
    troops: Array.from({ length: troopCount }, (_, index) => ({ id: `troop_${index}`, type: "marine", dead: false })),
    alphaPressure: createAlphaPressureState(config),
    metrics: { alphaPressure: { cyclesEvaluated: 0, triggers: 0, peakLevel: 0, spawned: 0, resets: 0 } },
  };
  startAlphaPressureCycle(state);
  return state;
}

describe("Chapter Six alpha pressure", () => {
  it("only activates the first level after the army grows, then escalates while it is maintained", () => {
    const state = session();
    expect(evaluateAlphaPressureCycle(state, config)).toMatchObject({ triggered: false, level: 0, troopCountStart: 5, troopCountEnd: 5 });

    state.troops.push({ id: "troop_5", type: "mantis", dead: false }, { id: "troop_6", type: "droneSentinela", dead: false });
    expect(evaluateAlphaPressureCycle(state, config)).toMatchObject({ triggered: true, level: 1, alphaCount: 1, enemyTypes: ["devoradorCaldeira"] });
    expect(evaluateAlphaPressureCycle(state, config)).toMatchObject({ triggered: true, level: 2, alphaCount: 2 });
    expect(state.metrics.alphaPressure).toMatchObject({ cyclesEvaluated: 3, triggers: 2, peakLevel: 2, resets: 0 });
  });

  it("resets after a troop loss and requires growth again before pressure returns", () => {
    const state = session();
    state.troops.push({ id: "troop_5", type: "mantis", dead: false }, { id: "troop_6", type: "cryo7", dead: false });
    expect(evaluateAlphaPressureCycle(state, config).level).toBe(1); // 5 -> 7
    expect(evaluateAlphaPressureCycle(state, config).level).toBe(2); // 7 -> 7
    state.troops.pop();
    expect(evaluateAlphaPressureCycle(state, config)).toMatchObject({ triggered: false, level: 0, troopCountStart: 7, troopCountEnd: 6 });
    expect(evaluateAlphaPressureCycle(state, config)).toMatchObject({ triggered: false, level: 0, troopCountStart: 6, troopCountEnd: 6 });
    expect(state.metrics.alphaPressure.resets).toBe(1);
  });

  it("uses a deterministic set of unique rows and counts each drone", () => {
    const left = { rng: createRng(123) };
    const right = { rng: createRng(123) };
    const rows = selectAlphaSpawnRows(left, 5);
    expect(rows).toEqual(selectAlphaSpawnRows(right, 5));
    expect(new Set(rows).size).toBe(5);
    expect(countPressureTroops({ troops: [{ type: "droneSentinela", dead: false }, { type: "droneSentinela", dead: false }, { type: "thermalPlatform", dead: false }] })).toBe(2);
  });

  it("caps the phase level and keeps the Chapter Six modifiers explicit", () => {
    const state = session();
    state.troops.push({ id: "extra", type: "mantis", dead: false });
    evaluateAlphaPressureCycle(state, config);
    evaluateAlphaPressureCycle(state, config);
    evaluateAlphaPressureCycle(state, config);
    expect(evaluateAlphaPressureCycle(state, config)).toMatchObject({ level: 4, alphaCount: 4 });
    expect(CHAPTER_SIX_ALPHA_MODIFIERS).toEqual({ hpMultiplier: 1.65, damageMultiplier: 1.25, speedMultiplier: 1.10, scaleMultiplier: 1.12 });
  });

  it("integrates F45 with the delayed Alpha spawn and the reset rule", () => {
    const state = createBattleSession(CHAPTER_SIX_PHASES[4], ["colono"], 415);
    state.troops = Array.from({ length: 5 }, (_, index) => createTroopEntity(state, "colono", index, 0));
    expect(startWave(state)).toBe(true);
    state.queue = [];
    state.nextSpawnAt = Infinity;
    state.troops.push(createTroopEntity(state, "colono", 0, 1), createTroopEntity(state, "colono", 1, 1));
    state.thermalCycle = { ...state.thermalCycle, state: "cooldown", cycleIndex: 3, stateEndsAt: 0 };

    const firstCycle = stepBattle(state, 1);
    expect(firstCycle).toContainEqual(expect.objectContaining({
      type: "chapterSixAlphaPressureTriggered", level: 1, troopCountStart: 5, troopCountEnd: 7,
      enemyTypes: ["devoradorCaldeira"],
    }));
    stepBattle(state, 1800);
    expect(state.enemies.find((enemy) => enemy.spawnSource === "alphaPressure")).toMatchObject({ variant: "alpha", type: "devoradorCaldeira" });

    state.thermalCycle = { ...state.thermalCycle, state: "cooldown", cycleIndex: 3, stateEndsAt: state.elapsed };
    expect(stepBattle(state, 1)).toContainEqual(expect.objectContaining({ type: "chapterSixAlphaPressureTriggered", level: 2, alphaCount: 2 }));
    state.troops.pop();
    state.alphaPressure.pendingSpawns = [];
    state.thermalCycle = { ...state.thermalCycle, state: "cooldown", cycleIndex: 3, stateEndsAt: state.elapsed };
    expect(stepBattle(state, 1)).not.toContainEqual(expect.objectContaining({ type: "chapterSixAlphaPressureTriggered" }));
    expect(state.alphaPressure.level).toBe(0);
  });
});
