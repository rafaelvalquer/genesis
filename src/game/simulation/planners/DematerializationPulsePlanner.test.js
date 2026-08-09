import { describe, expect, it } from "vitest";
import { evaluateDematerializationPulseLane, projectDematerializationPulseLane } from "./DematerializationPulsePlanner.js";

describe("DematerializationPulsePlanner", () => {
  const pulse = { row: 2, state: "ready" };

  it("preserves the cannon on a safe lane", () => {
    const result = evaluateDematerializationPulseLane({ row: 2, risk: 2, criticalTroops: 0, hasFrontline: true, activeThreat: 3, bossThreat: false, lowestTimeToBaseMs: 15000, enemies: [{ hp: 900 }, { hp: 700 }] }, pulse, {});
    expect(result.shouldActivate).toBe(false);
  });

  it("projects queued enemies during the two-second charge", () => {
    const session = { elapsed: 1000, waveStartedAt: 0, modifiers: { enemySpeed: 1 }, sandboxSettings: { enemySpeedMultiplier: 1, enemyHpMultiplier: 1 }, enemies: [], troops: [], queue: [{ type: "medu", row: 2, spawnAtMs: 1500 }] };
    const lane = { row: 2, enemies: [], troops: [], risk: 19, criticalTroops: 2, hasFrontline: true };
    const projection = projectDematerializationPulseLane(session, lane);
    expect(projection.incomingCount).toBe(1);
    expect(projection.enemyCount).toBe(1);
    expect(evaluateDematerializationPulseLane(lane, pulse, { pulseMinimumValue: 20 }, projection).projected).toBe(true);
  });

  it("excludes submerged Rasgamar from projected pulse value", () => {
    const session = {
      elapsed: 0, waveStartedAt: 0, modifiers: { enemySpeed: 1 }, sandboxSettings: {}, queue: [], troops: [],
      enemies: [
        { id: "submerged", type: "enguiaRasgamar", row: 2, x: 700, hp: 700, speed: 0, rasgamarSubmerged: true, dead: false },
        { id: "target", type: "mordelume", row: 2, x: 700, hp: 300, speed: 0, dead: false },
      ],
    };
    const lane = { row: 2, enemies: session.enemies, troops: [], risk: 19, criticalTroops: 1, hasFrontline: true };
    expect(projectDematerializationPulseLane(session, lane)).toMatchObject({ enemyCount: 1, potentialDamage: 300, potentialKills: 1 });
  });
});
