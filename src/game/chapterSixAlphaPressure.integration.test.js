import { describe, expect, it } from "vitest";
import { canPlaceTroop, createBattleSession, getSnapshot, placeTroop, startWave, stepBattle } from "./battleModel.js";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { ENEMIES } from "./content.js";

describe("Alpha Pressure integrado ao battle engine", () => {
  it("dispara em 18s sem depender do ciclo térmico e nasce após o warning", () => {
    const phase = CHAPTER_SIX_PHASES.find((entry) => entry.id === "fase_48");
    const session = createBattleSession(phase, ["marine"], 48123, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    [0, 1, 2, 3, 4].forEach((row) => {
      const col = Array.from({ length: 8 }, (_, index) => index + 1).find((candidate) => !canPlaceTroop(session, "marine", row, candidate));
      const placed = placeTroop(session, "marine", row, col);
      if (!placed.ok) throw new Error(`row ${row}: ${placed.reason}`);
      expect(placed).toMatchObject({ ok: true });
    });
    session.waveIndex = 0;
    expect(startWave(session)).toBe(true);
    session.rng = () => 0;
    const trigger = stepBattle(session, 18000);
    expect(trigger).toContainEqual(expect.objectContaining({ type: "chapterSixAlphaPressureTriggered" }));
    expect(session.enemies.some((enemy) => enemy.spawnSource === "alphaPressure")).toBe(false);
    stepBattle(session, 1799);
    expect(session.enemies.some((enemy) => enemy.spawnSource === "alphaPressure")).toBe(false);
    stepBattle(session, 1);
    const alpha = session.enemies.find((enemy) => enemy.spawnSource === "alphaPressure");
    expect(alpha).toMatchObject({ variant: "alpha", spawnSource: "alphaPressure" });
    expect(alpha.maxHp).toBeCloseTo(ENEMIES[alpha.type].hp * 1.65);
    expect(alpha.damage).toBeCloseTo(ENEMIES[alpha.type].damage * 1.25);
    expect(alpha.speed).toBeCloseTo(ENEMIES[alpha.type].speed * 1.10);
    expect(alpha.scale).toBeCloseTo(ENEMIES[alpha.type].scale * 1.12);
    expect(getSnapshot(session).alphaPressure).toMatchObject({
      checksThisWave: 1,
      spawnsThisWave: 1,
      totalAlphaSpawned: 1,
      lastTriggeredAt: 18000,
      lastSpawnType: expect.any(String),
      lastSpawnRow: expect.any(Number),
      failedChecksThisWave: 0,
    });
  });

  it("cancela Alpha pendente quando a wave normal termina", () => {
    const phase = CHAPTER_SIX_PHASES.find((entry) => entry.id === "fase_48");
    const session = createBattleSession(phase, ["marine"], 48124, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    for (const row of [0, 1, 2, 3, 4]) {
      const col = Array.from({ length: 8 }, (_, index) => index + 1).find((candidate) => !canPlaceTroop(session, "marine", row, candidate));
      expect(placeTroop(session, "marine", row, col).ok).toBe(true);
    }
    session.waveIndex = 0; expect(startWave(session)).toBe(true); session.rng = () => 0;
    stepBattle(session, 18000);
    expect(session.alphaPressure.pendingSpawns).toHaveLength(1);
    session.queue = []; session.enemies = []; session.sandbox = false;
    stepBattle(session, 1);
    expect(session.alphaPressure.pendingSpawns).toHaveLength(0);
  });
});
