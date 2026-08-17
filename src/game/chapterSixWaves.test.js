import { describe, expect, it } from "vitest";
import {
  CHAPTER_SIX_ENEMY_POOL,
  CHAPTER_SIX_MAXIMUM_LIVING,
  CHAPTER_SIX_PACKET_COUNTS,
  CHAPTER_SIX_PACKETS,
  CHAPTER_SIX_PACKET_ROLES,
  CHAPTER_SIX_PHASE_POLICIES,
  CHAPTER_SIX_TIER_PROFILES,
  composeChapterSixWave,
  createChapterSixWaves,
} from "./chapterSixWaves.js";

const composition = (packet) => packet.units.map((entry) => [entry.type, entry.count]);

describe("pacotes e ondas do capítulo 6", () => {
  it("define os doze pacotes reutilizáveis com a composição planejada", () => {
    expect(Object.keys(CHAPTER_SIX_PACKETS)).toEqual([
      "C6-01", "C6-02", "C6-03", "C6-04", "C6-05", "C6-06", "C6-07", "C6-08", "C6-09", "C6-10", "C6-11", "C6-12",
    ]);
    expect(composition(CHAPTER_SIX_PACKETS["C6-01"])).toEqual([["cuspidorBrasa", 2]]);
    expect(composition(CHAPTER_SIX_PACKETS["C6-03"])).toEqual([["vermeIncubador", 1], ["cuspidorBrasa", 1]]);
    expect(composition(CHAPTER_SIX_PACKETS["C6-06"])).toEqual([["predadorCaldeira", 1], ["cuspidorBrasa", 2]]);
    expect(composition(CHAPTER_SIX_PACKETS["C6-11"])).toEqual([
      ["rasgaCeusCinereo", 1], ["vermeIncubador", 1], ["cuspidorBrasa", 1], ["predadorCaldeira", 1],
    ]);
  });

  it("mantém a distribuição de tiers proposta", () => {
    expect(CHAPTER_SIX_TIER_PROFILES).toEqual([
      [100], [65, 35], [45, 55], [30, 55, 15], [25, 40, 35], [20, 35, 30, 15], [15, 30, 30, 25], [10, 25, 35, 30],
    ]);
  });

  it("usa seis ondas por fase e a curva planejada de pacotes", () => {
    expect(Array.from({ length: 8 }, (_, index) => createChapterSixWaves(index).length)).toEqual(Array(8).fill(6));
    expect(Array.from({ length: 8 }, (_, index) => createChapterSixWaves(index).map((wave) => wave.packetCount))).toEqual(CHAPTER_SIX_PACKET_COUNTS);
  });

  it("mantém progressão estrita de dificuldade e limite vivo por fase", () => {
    for (let phase = 0; phase < 8; phase += 1) {
      const waves = createChapterSixWaves(phase);
      expect(waves.every((wave) => wave.maximumLivingEnemies === CHAPTER_SIX_MAXIMUM_LIVING[phase])).toBe(true);
      for (let wave = 1; wave < waves.length; wave += 1) {
        expect(waves[wave].packetCount).toBeGreaterThanOrEqual(waves[wave - 1].packetCount);
        expect(waves[wave].difficulty).toBeGreaterThan(waves[wave - 1].difficulty);
      }
    }
  });

  it("começa a fase 41 com uma pressão leve para permitir posicionamento", () => {
    const firstWave = createChapterSixWaves(0)[0];
    expect(firstWave.chapterSixPacketKeys).toEqual(Array(6).fill("C6-01"));
    expect(firstWave.packetThreat).toBe(6 * CHAPTER_SIX_PACKETS["C6-01"].threat);
    expect(firstWave.enemies).toEqual([{ type: "cuspidorBrasa", count: 24 }]);
  });

  it("distribui pacotes pelas cinco rotas e respeita os intervalos", () => {
    const final = createChapterSixWaves(7).at(-1);
    expect(final.spawnBlocks.flatMap((block) => block.packets)).toHaveLength(14);
    expect(final.spawnBlocks.flatMap((block) => block.packets).map((packet) => packet.spawnAtMs)).toEqual(Array.from({ length: 14 }, (_, index) => index * 3200));
    expect(new Set(final.spawnBlocks.flatMap((block) => block.packets).flatMap((packet) => packet.units.flatMap((unit) => unit.rows)))).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it("libera os inimigos na ordem de introdução do capítulo", () => {
    const firstSeen = new Map();
    for (let phase = 0; phase < 8; phase += 1) {
      createChapterSixWaves(phase).flatMap((entry) => entry.enemies).forEach((enemy) => {
        if (!firstSeen.has(enemy.type)) firstSeen.set(enemy.type, phase);
      });
    }
    expect(firstSeen.get("vermeIncubador")).toBe(1);
    expect(firstSeen.get("predadorCaldeira")).toBe(2);
    expect(firstSeen.get("devoradorCaldeira")).toBe(4);
    expect(firstSeen.get("rasgaCeusCinereo")).toBe(5);
    expect(firstSeen.get("salamandraCinerea")).toBe(6);
    createChapterSixWaves(7).flatMap((wave) => wave.enemies).forEach((enemy) => expect(CHAPTER_SIX_ENEMY_POOL).toContain(enemy.type));
  });

  it("compõe de forma determinística, sem spam, e respeita as políticas", () => {
    for (let phase = 0; phase < 8; phase += 1) {
      const policy = CHAPTER_SIX_PHASE_POLICIES[phase];
      for (let wave = 0; wave < 6; wave += 1) {
        const keys = composeChapterSixWave({ phaseIndex: phase, waveIndex: wave, packetCount: CHAPTER_SIX_PACKET_COUNTS[phase][wave] }).map((entry) => entry.key);
        expect(keys).toEqual(composeChapterSixWave({ phaseIndex: phase, waveIndex: wave, packetCount: CHAPTER_SIX_PACKET_COUNTS[phase][wave] }).map((entry) => entry.key));
        expect(keys.every((key) => policy.allowedPackets.includes(key))).toBe(true);
        if (!(phase === 0 && wave === 0)) {
          expect(keys.some((key, index) => index > 1 && keys[index - 1] === key && keys[index - 2] === key)).toBe(false);
        }
        const airRatio = keys.filter((key) => CHAPTER_SIX_PACKET_ROLES[key].includes("air")).length / keys.length;
        expect(airRatio).toBeLessThanOrEqual(policy.maxAirRatio || 0);
      }
    }
  });

  it("introduz cada função na fase correta e fecha F48 com diversidade real", () => {
    const rolesByPhase = Array.from({ length: 8 }, (_, phase) => new Set(createChapterSixWaves(phase).flatMap((wave) => wave.chapterSixPacketKeys).flatMap((key) => CHAPTER_SIX_PACKET_ROLES[key])));
    expect(rolesByPhase[1]).toContain("disruption");
    expect(rolesByPhase[2]).toContain("assault");
    expect(rolesByPhase[4]).toContain("anchor");
    expect(rolesByPhase[5]).toContain("air");
    expect(rolesByPhase[6]).toContain("finisher");
    ["anchor", "artillery", "disruption", "assault", "air", "finisher"].forEach((role) => expect(rolesByPhase[7]).toContain(role));
    expect(new Set(createChapterSixWaves(7).at(-1).chapterSixPacketKeys).size).toBeGreaterThanOrEqual(7);
  });

  it("usa estratégias de rota e cria uma rota quente nas ondas avançadas", () => {
    const advanced = createChapterSixWaves(7).at(-1).spawnBlocks[0].packets;
    expect(new Set(advanced.map((packet) => packet.routeStrategy))).toEqual(new Set(["focused", "split", "spread"]));
    expect(Object.values(createChapterSixWaves(7).at(-1).chapterSixRouteCounts).some((count) => count >= 3)).toBe(true);
  });
});
