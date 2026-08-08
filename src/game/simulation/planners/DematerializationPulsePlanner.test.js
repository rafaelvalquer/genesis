import { describe, expect, it } from "vitest";
import {
  evaluateDematerializationPulseLane,
  projectDematerializationPulseLane,
} from "./DematerializationPulsePlanner.js";

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

  it("inclui hostis que entrarão na rota durante os dois segundos de carga", () => {
    const session = {
      elapsed: 1000, waveStartedAt: 0, modifiers: { enemySpeed: 1 },
      sandboxSettings: { enemySpeedMultiplier: 1, enemyHpMultiplier: 1 },
      enemies: [], troops: [],
      queue: [{ type: "medu", row: 2, spawnAtMs: 1500 }],
    };
    const lane = { row: 2, enemies: [], troops: [], risk: 19, criticalTroops: 2, hasFrontline: true };
    const projection = projectDematerializationPulseLane(session, lane);

    expect(projection.incomingCount).toBe(1);
    expect(projection.enemyCount).toBe(1);
    expect(evaluateDematerializationPulseLane(lane, pulse, { pulseMinimumValue: 20 }, projection).projected).toBe(true);
  });

  it("descarta hostis que atravessarão a base antes do disparo", () => {
    const session = {
      elapsed: 0, waveStartedAt: 0, modifiers: { enemySpeed: 1 }, sandboxSettings: {}, queue: [], troops: [],
      enemies: [{ type: "medu", row: 1, x: 55, hp: 100, speed: 28, dead: false }],
    };
    const lane = { row: 1, enemies: session.enemies, troops: [], risk: 20, criticalTroops: 2, hasFrontline: false };

    expect(projectDematerializationPulseLane(session, lane).enemyCount).toBe(0);
  });
});
