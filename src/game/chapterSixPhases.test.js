import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_ENEMY_POOL } from "./chapterSixWaves.js";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";

describe("contrato do capítulo 6", () => {
  it("mantém as oito fases, energia, supply e waves definidos", () => {
    expect(CHAPTER_SIX_PHASES).toHaveLength(8);
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.waves.length)).toEqual([4, 4, 4, 5, 5, 5, 6, 6]);
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.energy)).toEqual([930, 960, 990, 1020, 1050, 1080, 1110, 1140]);
    CHAPTER_SIX_PHASES.forEach((phase) => {
      expect(phase.chapterId).toBe("chapter_06");
      expect(phase.supplyLimit).toBe(40);
      expect(phase.loadoutLimit).toBe(9);
      expect(phase.waves.flatMap((wave) => wave.enemies)
        .every((enemy) => CHAPTER_SIX_ENEMY_POOL.includes(enemy.type))).toBe(true);
    });
  });

  it("configura o mesmo fluxo viscoso contínuo nas oito fases", () => {
    for (const phase of CHAPTER_SIX_PHASES) {
      expect(phase.magmaTerrain.visual).toMatchObject({
        flow: { x: -1, y: 0.025 },
        speed: 26,
        viscosity: 0.82,
        crustDensity: 0.48,
      });
    }
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.magmaTerrain.visual.seed))
      .toEqual([4141, 4242, 4343, 4444, 4545, 4646, 4747, 4848]);
  });
});
