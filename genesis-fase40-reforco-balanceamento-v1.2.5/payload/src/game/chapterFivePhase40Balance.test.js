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
  return wave.spawnBlocks
    .flatMap((block) => block.packets)
    .map((packet) => packet.key);
}

describe("balanceamento reforçado da Fase 40", () => {
  it("abre com uma progressão menor antes dos pacotes pesados", () => {
    const firstWave = createChapterFiveWaves(7)[0];

    expect(packetKeys(firstWave)).toEqual([
      "N3", "N5", "N10", "N8", "N11",
    ]);
    expect(totalEnemies(firstWave)).toBe(45);
    expect(firstWave.packetGapMs).toBe(9000);
  });

  it("mantém progressão controlada nas seis ondas", () => {
    const totals = createChapterFiveWaves(7).map(totalEnemies);
    expect(totals).toEqual([45, 54, 66, 86, 103, 86]);
  });

  it("reduz a pressão simultânea apenas na Fase 40", () => {
    const phase40 = createChapterFiveWaves(7);
    const phase39 = createChapterFiveWaves(6);

    expect(PHASE_40_MAXIMUM_LIVING).toBe(48);
    expect(phase40.every((wave) => wave.maximumLivingEnemies === 48)).toBe(true);
    expect(phase39.every((wave) => wave.maximumLivingEnemies === 44)).toBe(true);
  });

  it("preserva o chefe e reduz somente a escolta da onda final", () => {
    const finalWave = createChapterFiveWaves(7)[5];

    expect(totalEnemies(finalWave)).toBe(86);
    expect(finalWave.bossEncounter).toMatchObject({
      type: "leviathanNereida",
      spawnAtMs: 18000,
    });
  });

  it("expõe uma configuração estável", () => {
    expect(PHASE_40_BALANCED_PACKET_SEQUENCES).toHaveLength(6);
    expect(PHASE_40_PACKET_GAPS).toEqual([
      9000, 8500, 7500, 6800, 6200, 5500,
    ]);
  });
});
