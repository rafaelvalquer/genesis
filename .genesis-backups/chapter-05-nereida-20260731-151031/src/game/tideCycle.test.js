import { describe, expect, it } from "vitest";
import {
  createTideCycleHazard,
  createTideCycleState,
  getTideEnemySpeedFactor,
  recordTideTroopElimination,
  resetTideCycleForWave,
  updateTideCycle,
} from "./tideCycle.js";

function session(overrides = {}) {
  const hazard = createTideCycleHazard(0, {
    firstCheckDelayMs: 0,
    checkEveryMs: 100,
    warningMs: 10,
    risingMs: 10,
    highDurationMs: 20,
    recedingMs: 10,
    baseChance: 1,
    maxChance: 1,
    floodedFromCol: 8,
  });
  return {
    phase: { environmentHazard: hazard },
    tideCycle: createTideCycleState(),
    elapsed: 0,
    waveActive: true,
    rng: () => 0,
    troops: Array.from({ length: 5 }, (_, index) => ({ id: `troop-${index}`, dead: false })),
    ...overrides,
  };
}

function advance(value, milliseconds, events = []) {
  value.elapsed += milliseconds;
  updateTideCycle(value, events);
}

describe("tideCycle", () => {
  it("starts by chance and reaches high tide", () => {
    const value = session();
    resetTideCycleForWave(value);
    const events = [];
    updateTideCycle(value, events);
    expect(value.tideCycle.state).toBe("warning");
    advance(value, 10, events);
    expect(value.tideCycle.state).toBe("rising");
    advance(value, 10, events);
    expect(value.tideCycle.state).toBe("high");
  });

  it("allows another tide when no troop is eliminated", () => {
    const value = session();
    resetTideCycleForWave(value);
    const events = [];
    updateTideCycle(value, events);
    advance(value, 10, events);
    advance(value, 10, events);
    advance(value, 20, events);
    expect(value.tideCycle.state).toBe("receding");
    expect(value.tideCycle.repeatEligible).toBe(true);
    advance(value, 10, events);
    expect(value.tideCycle.state).toBe("idle");
    expect(Number.isFinite(value.tideCycle.nextCheckAt)).toBe(true);
  });

  it("blocks another tide after a troop is eliminated during high tide", () => {
    const value = session();
    resetTideCycleForWave(value);
    updateTideCycle(value, []);
    advance(value, 10);
    advance(value, 10);
    recordTideTroopElimination(value, value.troops[0], "enemy");
    value.troops[0].dead = true;
    advance(value, 20);
    expect(value.tideCycle.repeatEligible).toBe(false);
    expect(value.tideCycle.nextCheckAt).toBe(Infinity);
  });

  it("only accelerates enemies inside the flooded columns", () => {
    const value = session();
    value.tideCycle.state = "high";
    value.tideCycle.floodedFromCol = 8;
    expect(getTideEnemySpeedFactor(value, { x: 850, dead: false })).toBeGreaterThan(1);
    expect(getTideEnemySpeedFactor(value, { x: 650, dead: false })).toBe(1);
  });
});
