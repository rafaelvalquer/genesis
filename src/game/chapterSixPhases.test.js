import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_ENEMY_POOL } from "./chapterSixWaves.js";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";

describe("contrato do capítulo 6", () => {
  it("mantém as oito fases, energia, supply e waves definidos", () => {
    expect(CHAPTER_SIX_PHASES).toHaveLength(8);
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.waves.length)).toEqual(Array(8).fill(6));
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.energy)).toEqual([630, 660, 690, 720, 750, 780, 810, 840]);
    CHAPTER_SIX_PHASES.forEach((phase) => {
      expect(phase.chapterId).toBe("chapter_06");
      expect(phase.supplyLimit).toBe(40);
      expect(phase.loadoutLimit).toBe(9);
      expect(phase.waves.flatMap((wave) => wave.enemies)
        .every((enemy) => CHAPTER_SIX_ENEMY_POOL.includes(enemy.type))).toBe(true);
    });
  });

  it("configura fluxo viscoso e crosta progressivamente mais exposta", () => {
    for (const phase of CHAPTER_SIX_PHASES) {
      expect(phase.magmaTerrain.visual).toMatchObject({
        flow: { x: -1, y: 0.025 },
        speed: 26,
        viscosity: 0.82,
      });
    }
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.magmaTerrain.visual.crustDensity))
      .toEqual([0.44, 0.43, 0.42, 0.41, 0.43, 0.42, 0.41, 0.4]);
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.magmaTerrain.visual.seed))
      .toEqual([4141, 4242, 4343, 4444, 4545, 4646, 4747, 4848]);
  });

  it("expõe foco, tiers e progressão de introdução para a campanha", () => {
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.chapterSixFocus)).toEqual([
      null, "vermeIncubador", "predadorCaldeira", null, "devoradorCaldeira", "rasgaCeusCinereo", "salamandraCinerea", null,
    ]);
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.chapterSixTierProfile)).toEqual([
      [100], [65, 35], [45, 55], [30, 55, 15], [25, 40, 35], [20, 35, 30, 15], [15, 30, 30, 25], [10, 25, 35, 30],
    ]);
    expect(CHAPTER_SIX_PHASES[7].waves.at(-1).chapterSixPacketKeys).toHaveLength(14);
  });
});
