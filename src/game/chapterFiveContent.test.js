import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import { CHAPTER_FIVE_PACKETS } from "./chapterFivePackets.js";
import { buildSpawnQueue, wavePressure } from "./domain.js";
import { createBattleSession, startWave, stepBattle } from "./battleModel.js";

describe("Chapter 5 coordinated pressure", () => {
  it("keeps eight missions, six waves, and only Nereida enemies", () => {
    const allowed = new Set(["mordelume", "enguiaRasgamar", "carapacaNereida", "medusaVeuSalino"]);
    expect(CHAPTER_FIVE_PHASES).toHaveLength(8);
    CHAPTER_FIVE_PHASES.forEach((phase, phaseIndex) => {
      expect(phase.id).toBe(`fase_${33 + phaseIndex}`);
      expect(phase.waves).toHaveLength(6);
      phase.waves.forEach((wave) => {
        expect(wave.coordinated).toBe(true);
        expect(wave.maximumLivingEnemies).toBe(20 + phaseIndex * 4);
        wave.enemies.forEach((enemy) => expect(allowed.has(enemy.type)).toBe(true));
      });
    });
  });

  it("distributes N10 across three rows with simultaneous eels", () => {
    const queue = buildSpawnQueue(CHAPTER_FIVE_PHASES[2], 2, 99);
    const eels = queue.filter((entry) => entry.packetId.startsWith("triphase_ambush") && entry.type === "enguiaRasgamar");
    expect(eels.map((entry) => entry.row).sort()).toEqual([0, 2, 4]);
    expect(Math.max(...eels.map((entry) => entry.spawnAtMs)) - Math.min(...eels.map((entry) => entry.spawnAtMs))).toBeLessThanOrEqual(100);
  });

  it("respects short packet gaps and increases pressure by phase", () => {
    let previousPressure = -Infinity;
    CHAPTER_FIVE_PHASES.forEach((phase) => {
      const phasePressure = phase.waves.reduce((total, wave, waveIndex) => {
        const queue = buildSpawnQueue(phase, waveIndex, 99);
        const startByPacket = new Map();
        queue.forEach((entry) => startByPacket.set(entry.packetId, Math.min(startByPacket.get(entry.packetId) ?? Infinity, entry.spawnAtMs)));
        const starts = [...startByPacket.values()].sort((a, b) => a - b);
        for (let index = 1; index < starts.length; index += 1) expect(starts[index] - starts[index - 1]).toBeLessThanOrEqual(wave.packetGapMs + 500);
        if (Number(phase.id.slice(-2)) >= 37) expect(Math.max(...starts.slice(1).map((start, index) => start - starts[index]))).toBeLessThanOrEqual(9000);
        return total + wavePressure(phase, waveIndex);
      }, 0);
      expect(phasePressure).toBeGreaterThan(previousPressure);
      previousPressure = phasePressure;
    });
  });

  it("configures the final boss encounter and its limits", () => {
    expect(CHAPTER_FIVE_PACKETS.N14.units.flatMap((unit) => unit.rows || [])).toContain(4);
    expect(Object.values(CHAPTER_FIVE_PACKETS).flatMap((packet) => packet.units).some((unit) => unit.type === "leviathanNereida")).toBe(false);
    const bossWave = CHAPTER_FIVE_PHASES.at(-1).waves.at(-1);
    expect(bossWave.bossEncounter).toMatchObject({ type: "leviathanNereida", spawnAtMs: 18000 });
    expect(bossWave.bossEncounter.reinforcements).toEqual([{ hpFactor: .85, packet: "N6" }, { hpFactor: .70, packet: "N10" }, { hpFactor: .55, packet: "N11" }, { hpFactor: .40, packet: "N12" }, { hpFactor: .25, packet: "N13" }, { hpFactor: .12, packet: "N14" }]);
    expect(bossWave.bossEncounter.maximumLivingByType).toEqual({ medusaVeuSalino: 3, carapacaNereida: 4, enguiaRasgamar: 5, mordelume: 16 });
  });

  it("defers a full packet when its living-enemy ceiling is reached", () => {
    const source = CHAPTER_FIVE_PHASES[0];
    const phase = { ...source, waves: [{ ...source.waves[0], maximumLivingEnemies: 1 }] };
    const session = createBattleSession(phase, [], 7, { sandbox: true });
    startWave(session);
    stepBattle(session, 1);
    expect(session.enemies.filter((enemy) => !enemy.dead)).toHaveLength(1);
    stepBattle(session, 180);
    const delayed = session.queue.filter((entry) => entry.packetId === session.queue[0].packetId);
    expect(delayed.every((entry) => entry.spawnAtMs >= 930)).toBe(true);
  });
});
