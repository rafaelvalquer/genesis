import { describe, expect, it } from "vitest";
import { PHASE_40_SCENARIO } from "./chapter05/phase40Scenario.js";
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

describe("contrato de balanceamento da Fase 40", () => {
  it("abre com uma progressão menor antes dos pacotes pesados", () => {
    const firstWave = createChapterFiveWaves({
      phaseIndex: PHASE_40_SCENARIO.finalPhaseIndex,
      phaseId: PHASE_40_SCENARIO.id,
    })[0];

    expect(packetKeys(firstWave)).toEqual([
      "N3", "N5", "N10", "N8", "N11",
    ]);
    expect(totalEnemies(firstWave)).toBe(45);
    expect(firstWave.packetGapMs).toBe(9000);
  });

  it("mantém progressão controlada nas seis ondas", () => {
    const totals = createChapterFiveWaves({
      phaseIndex: PHASE_40_SCENARIO.finalPhaseIndex,
      finalMission: true,
    }).map(totalEnemies);

    expect(totals).toEqual([45, 54, 66, 86, 103, 86]);
  });

  it("mantém o limite simultâneo necessário para o encontro final", () => {
    const phase40 = createChapterFiveWaves({
      phaseIndex: PHASE_40_SCENARIO.finalPhaseIndex,
      finalMission: true,
    });
    const phase39 = createChapterFiveWaves(6);

    expect(PHASE_40_MAXIMUM_LIVING).toBe(48);
    expect(phase40.every((wave) => wave.maximumLivingEnemies === 48)).toBe(true);
    expect(phase39.every((wave) => wave.maximumLivingEnemies === 44)).toBe(true);
  });

  it("preserva o chefe e reduz somente a escolta da onda final", () => {
    const finalWave = createChapterFiveWaves({
      phaseIndex: PHASE_40_SCENARIO.finalPhaseIndex,
      finalMission: true,
    })[5];

    expect(totalEnemies(finalWave)).toBe(86);
    expect(finalWave.bossEncounter).toBe(PHASE_40_SCENARIO.bossEncounter);
    expect(finalWave.bossEncounter).toMatchObject({
      type: "leviathanNereida",
      spawnAtMs: 18000,
    });
  });

  it("mantém compatibilidade com a assinatura numérica anterior", () => {
    expect(createChapterFiveWaves(7)).toEqual(createChapterFiveWaves({
      phaseIndex: 7,
      phaseId: "fase_40",
    }));
  });

  it("reexporta os valores do contrato sem duplicar a configuração", () => {
    expect(PHASE_40_BALANCED_PACKET_SEQUENCES)
      .toBe(PHASE_40_SCENARIO.packetSequences);
    expect(PHASE_40_PACKET_GAPS).toBe(PHASE_40_SCENARIO.packetGaps);
    expect(PHASE_40_MAXIMUM_LIVING)
      .toBe(PHASE_40_SCENARIO.maximumLivingEnemies);
  });
});
