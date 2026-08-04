import { describe, expect, it } from "vitest";
import {
  createChapterFiveWaves,
  PHASE_40_BALANCED_PACKET_SEQUENCES,
  PHASE_40_MAXIMUM_LIVING,
  PHASE_40_PACKET_GAPS,
} from "./chapterFiveWaves.js";

function totalEnemies(wave) {
  return wave.enemies.reduce((total, enemy) => total + enemy.count, 0);
}

function packetKeys(wave) {
  return wave.spawnBlocks.flatMap((block) => block.packets).map((packet) => packet.key);
}

describe("balanceamento da Fase 40", () => {
  it("reduz principalmente a primeira onda", () => {
    const waves = createChapterFiveWaves(7);

    expect(packetKeys(waves[0])).toEqual(["N10", "N8", "N12", "N11", "N13"]);
    expect(totalEnemies(waves[0])).toBe(66);
    expect(waves[0].packetGapMs).toBe(8000);
  });

  it("mantém uma progressão controlada nas seis ondas", () => {
    const totals = createChapterFiveWaves(7).map(totalEnemies);
    expect(totals).toEqual([66, 86, 106, 103, 123, 95]);
  });

  it("reduz a pressão simultânea sem alterar outras fases", () => {
    const phase40 = createChapterFiveWaves(7);
    const phase39 = createChapterFiveWaves(6);

    expect(PHASE_40_MAXIMUM_LIVING).toBe(42);
    expect(phase40.every((wave) => wave.maximumLivingEnemies === 42)).toBe(true);
    expect(phase39.every((wave) => wave.maximumLivingEnemies === 44)).toBe(true);
  });

  it("preserva o encontro final com o Leviatã de Nereida", () => {
    const finalWave = createChapterFiveWaves(7)[5];

    expect(totalEnemies(finalWave)).toBe(95);
    expect(finalWave.bossEncounter).toMatchObject({
      type: "leviathanNereida",
      spawnAtMs: 18000,
    });
  });

  it("expõe uma configuração estável e verificável", () => {
    expect(PHASE_40_BALANCED_PACKET_SEQUENCES).toHaveLength(6);
    expect(PHASE_40_PACKET_GAPS).toEqual([8000, 7000, 6500, 6000, 5600, 5000]);
  });
});
