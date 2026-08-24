import { describe, expect, it } from "vitest";
import { advanceTroopAnimationClock, isTroopAnimationPlanningState } from "./troopAnimationClock.js";

const session = (state, elapsed = 0) => ({ elapsed, phase: { progressionMode: "convoy" }, convoyFlow: { state } });

describe("troop animation clock", () => {
  it("identifies planning without changing simulation time", () => {
    const current = session("initialPreparation", 120);
    expect(isTroopAnimationPlanningState(current)).toBe(true);
    expect(current.elapsed).toBe(120);
  });

  it("advances visually while preparation is frozen", () => {
    const current = session("initialPreparation", 120);
    const clock = { session: null, elapsed: 0, lastNow: 0, planning: false };
    expect(advanceTroopAnimationClock(clock, current, 1000)).toBe(120);
    expect(advanceTroopAnimationClock(clock, current, 1050)).toBe(170);
    expect(current.elapsed).toBe(120);
  });

  it("resets to simulation time when combat resumes", () => {
    const current = session("checkpointPreparation", 80);
    const clock = { session: null, elapsed: 0, lastNow: 0, planning: false };
    advanceTroopAnimationClock(clock, current, 1000);
    current.convoyFlow.state = "sectorActive";
    current.elapsed = 112;
    expect(advanceTroopAnimationClock(clock, current, 1100)).toBe(112);
  });
});
