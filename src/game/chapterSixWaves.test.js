import { describe, expect, it } from "vitest";
import {
  CHAPTER_SIX_ENEMY_POOL,
  CHAPTER_SIX_MAXIMUM_LIVING,
  CHAPTER_SIX_PACKET_COUNTS,
  CHAPTER_SIX_PACKETS,
  CHAPTER_SIX_PACKET_ROLES,
  CHAPTER_SIX_PHASE_POLICIES,
  CHAPTER_SIX_UNIT_THREATS,
  CHAPTER_SIX_TIER_PROFILES,
  calculateChapterSixDifficulty,
  analyzeChapterSixSpawnPattern,
  buildChapterSixSpawnPattern,
  composeChapterSixWave,
  createChapterSixWaves,
  getChapterSixPacketMetrics,
  getChapterSixPhaseMetrics,
  instantiateChapterSixPacket,
  scoreCandidateByPolicy,
  violatesConsecutiveLimit,
  violatesRoleLimit,
  violatesAirThreatLimit,
} from "./chapterSixWaves.js";
import { ENEMIES } from "./content.js";

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

  it("keeps unit threat synchronized with the enemy catalog", () => {
    Object.entries(CHAPTER_SIX_UNIT_THREATS).forEach(([type, threat]) => {
      expect(threat).toBe(ENEMIES[type].threat);
    });
  });

  it("measures air pressure by units and threat", () => {
    const attack = getChapterSixPacketMetrics(["C6-10"]);
    const siege = getChapterSixPacketMetrics(["C6-11"]);
    expect(attack.airUnitCount).toBe(2);
    expect(siege.airUnitCount).toBe(1);
    expect(attack.airThreatRatio).toBeGreaterThan(siege.airThreatRatio);
    expect(violatesAirThreatLimit(["C6-10"], "C6-10", { maxAirThreatRatio: .5 })).toBe(true);
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
        expect(waves[wave].difficulty).toBeGreaterThanOrEqual(Math.ceil(waves[wave - 1].difficulty * 1.05));
        expect(waves[wave].difficultyBreakdown.total).toBe(waves[wave].difficulty);
      }
    }
  });

  it("começa a fase 41 com uma pressão leve para permitir posicionamento", () => {
    const firstWave = createChapterSixWaves(0)[0];
    expect(firstWave.chapterSixPacketKeys).toEqual(Array(6).fill("C6-01"));
    expect(firstWave.packetThreat).toBe(6 * CHAPTER_SIX_PACKETS["C6-01"].threat);
    expect(firstWave.enemies).toEqual([{ type: "cuspidorBrasa", count: 12 }]);
  });

  it("calcula dificuldade sem depender da cadência e expõe a pressão tática", () => {
    const input = {
      packetThreat: 100,
      packetCount: 4,
      roleCounts: { pressure: 2, anchor: 1 },
      routeCounts: { 0: 4, 1: 2, 2: 1, 3: 1, 4: 0 },
      roleWeights: { pressure: 18, anchor: 20 },
    };
    const first = calculateChapterSixDifficulty({ ...input, waveIndex: 0 });
    const later = calculateChapterSixDifficulty({ ...input, waveIndex: 5 });
    expect(first).toEqual({
      difficulty: 244,
      difficultyBreakdown: { packetThreat: 100, volume: 40, rolePressure: 56, routeConcentration: 48, intentPressure: 0, total: 244 },
    });
    expect(later).toEqual({
      difficulty: 894,
      difficultyBreakdown: { packetThreat: 100, volume: 40, rolePressure: 56, routeConcentration: 48, intentPressure: 650, total: 894 },
    });
  });

  it("distribui contagens nas rotas sem replicar a quantidade do pacote", () => {
    const packet = instantiateChapterSixPacket("C6-02", 0, 0, "main", [0, 2, 4], { distribute: true });
    expect(packet.units.map((entry) => [entry.rows, entry.countPerRow])).toEqual([[[0], 1], [[2], 1], [[4], 1]]);
    expect(packet.units.reduce((total, entry) => total + entry.countPerRow, 0)).toBe(3);
    const splitPacket = instantiateChapterSixPacket("C6-02", 0, 0, "main", [1, 3], { distribute: true });
    expect(splitPacket.units.map((entry) => [entry.rows, entry.countPerRow])).toEqual([[[1], 2], [[3], 1]]);
    expect(splitPacket.units.reduce((total, entry) => total + entry.countPerRow, 0)).toBe(3);
  });

  it("deriva limites e preferência de candidatos da política", () => {
    const policy = { maxConsecutiveSame: 2, maxDisruptionConsecutive: 1, roleWeights: { disruption: 18, artillery: 20 } };
    expect(violatesConsecutiveLimit(["C6-01", "C6-01"], "C6-01", policy)).toBe(true);
    expect(violatesRoleLimit(["C6-03"], "C6-04", policy)).toBe(true);
    expect(scoreCandidateByPolicy("C6-04", policy, [])).toBe(CHAPTER_SIX_PACKETS["C6-04"].threat + 38);
  });

  it("distribui pacotes pelas cinco rotas e usa burst legível no clímax", () => {
    const final = createChapterSixWaves(7).at(-1);
    expect(final.spawnBlocks.flatMap((block) => block.packets)).toHaveLength(14);
    expect(final.spawnBlocks.flatMap((block) => block.packets).map((packet) => packet.spawnAtMs)).toEqual(final.chapterSixSpawnPattern);
    const cadence = analyzeChapterSixSpawnPattern(final.chapterSixSpawnPattern);
    expect(cadence.longestBurst).toBeLessThanOrEqual(3);
    expect(cadence.minBurstInterval).toBeGreaterThanOrEqual(900);
    expect(cadence.maxPause).toBeGreaterThanOrEqual(3000);
    expect(new Set(final.spawnBlocks.flatMap((block) => block.packets).flatMap((packet) => packet.units.flatMap((unit) => unit.rows)))).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it("preserva W1–W3 regulares e impede que F46 W4 vire um despejo", () => {
    const regular = buildChapterSixSpawnPattern({ phaseIndex: 5, waveIndex: 2, packetCount: 10 });
    expect(regular[1] - regular[0]).toBe(4500);
    const f46w4 = buildChapterSixSpawnPattern({ phaseIndex: 5, waveIndex: 3, packetCount: 10 });
    expect(f46w4.at(-1)).toBeGreaterThan(12000);
    expect(analyzeChapterSixSpawnPattern(f46w4).longestBurst).toBeLessThanOrEqual(3);
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
          expect(keys.some((key, index) => index > 0 && CHAPTER_SIX_PACKET_ROLES[key].includes("disruption") && CHAPTER_SIX_PACKET_ROLES[keys[index - 1]].includes("disruption"))).toBe(false);
        }
        const airMetrics = getChapterSixPacketMetrics(keys);
        expect(airMetrics.airThreatRatio).toBeLessThanOrEqual(policy.maxAirThreatRatio || 0);
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
