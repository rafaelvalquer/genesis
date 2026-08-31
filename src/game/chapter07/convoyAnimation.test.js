import { describe, expect, it } from "vitest";
import { getDesiredConvoyAnimationState, resolveConvoyAnimationFrame, triggerConvoyEnergySpawn, updateConvoyAnimation } from "./convoyAnimation.js";

describe("convoy animation state", () => {
  it("keeps idle while the convoy changes position", () => {
    const session = { elapsed: 40, convoyFlow: { state: "convoyEntry" }, convoy: { animation: { state: "idle", startedAt: 0 } } };
    expect(getDesiredConvoyAnimationState(session)).toBe("idle");
    updateConvoyAnimation(session);
    expect(session.convoy.animation.state).toBe("idle");
    session.elapsed = 80; session.convoyFlow.state = "convoyTransit"; updateConvoyAnimation(session);
    expect(session.convoy.animation.state).toBe("idle");
  });

  it("plays energy_spawn once and returns to idle", () => {
    const session = { elapsed: 100, convoy: { animation: { state: "idle", startedAt: 0 } } };
    triggerConvoyEnergySpawn(session.convoy, session.elapsed);
    session.elapsed = 999; updateConvoyAnimation(session);
    expect(session.convoy.animation.state).toBe("energy_spawn");
    session.elapsed = 1000; updateConvoyAnimation(session);
    expect(session.convoy.animation.state).toBe("idle");
  });

  it("loops idle frames and clamps energy_spawn", () => {
    expect(resolveConvoyAnimationFrame("idle", 1200, 8)).toBe(0);
    expect(resolveConvoyAnimationFrame("energy_spawn", 9999, 10)).toBe(9);
  });
});
