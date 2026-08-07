import { describe, expect, it } from "vitest";
import { evaluateDematerializationPulseLane } from "./DematerializationPulsePlanner.js";

describe("DematerializationPulsePlanner", () => {
  const pulse = { row: 2, state: "ready" };

  it("preserva o canhão em rota segura", () => {
    const result = evaluateDematerializationPulseLane({
      row: 2, risk: 2, criticalTroops: 0, hasFrontline: true,
      activeThreat: 3, bossThreat: false, lowestTimeToBaseMs: 15000,
      enemies: [{ hp: 900 }, { hp: 700 }],
    }, pulse, {});
    expect(result.shouldActivate).toBe(false);
  });

  it("antecipa o disparo para impedir colapso", () => {
    const result = evaluateDematerializationPulseLane({
      row: 2, risk: 19, criticalTroops: 2, hasFrontline: true,
      activeThreat: 28, bossThreat: false, lowestTimeToBaseMs: 6200,
      enemies: [{ hp: 800 }, { hp: 550 }, { hp: 400 }, { hp: 900 }],
    }, pulse, {});
    expect(result.shouldActivate).toBe(true);
    expect(result.potentialDamage).toBe(1900);
    expect(result.reason).toMatch(/^pulse/);
  });

  it("usa mesmo com valor menor quando a chegada à base é emergencial", () => {
    const result = evaluateDematerializationPulseLane({
      row: 1, risk: 10, criticalTroops: 0, hasFrontline: true,
      activeThreat: 8, bossThreat: false, lowestTimeToBaseMs: 2200,
      enemies: [{ hp: 450 }],
    }, { row: 1, state: "ready" }, { pulseMinimumValue: 1000, pulseEmergencyTimeMs: 5000 });
    expect(result.shouldActivate).toBe(true);
    expect(result.priority).toBeGreaterThanOrEqual(170);
  });
});
