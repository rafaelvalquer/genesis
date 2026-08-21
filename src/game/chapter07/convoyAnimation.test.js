import { describe, expect, it } from "vitest";
import { resolveConvoyAnimationFrame, updateConvoyAnimation } from "./convoyAnimation.js";

describe("convoy animation state", () => {
  it("uses run only while the escorted convoy can move", () => {
    const session = { elapsed: 40, convoyFlow: { state: "sectorActive" }, convoy: { hp: 100, escorted: true, underAttack: false, animation: { state: "idle", startedAt: 0, previousState: null } } };
    updateConvoyAnimation(session);
    expect(session.convoy.animation.state).toBe("run");
    session.elapsed = 80; session.convoy.underAttack = true; updateConvoyAnimation(session);
    expect(session.convoy.animation.state).toBe("idle");
  });

  it("keeps the destruction transition terminal before its loop", () => {
    const session = { elapsed: 0, convoyFlow: { state: "defeat" }, convoy: { hp: 0, escorted: false, underAttack: false, animation: { state: "idle", startedAt: 0, previousState: null } } };
    updateConvoyAnimation(session);
    expect(session.convoy.animation.state).toBe("destroyed_transition");
    session.elapsed = 1200; updateConvoyAnimation(session);
    expect(session.convoy.animation.state).toBe("destroyed_loop");
  });

  it("loops moving frames and clamps the destruction transition", () => {
    expect(resolveConvoyAnimationFrame("run", 680, 8)).toBe(0);
    expect(resolveConvoyAnimationFrame("destroyed_transition", 9999, 10)).toBe(9);
  });
});
