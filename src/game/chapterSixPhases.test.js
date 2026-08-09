import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_ENEMY_POOL } from "./chapterSixWaves.js";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
describe("contrato do capítulo 6", () => {
  it("mantém as oito fases, energia, supply e waves definidos", () => {
    expect(CHAPTER_SIX_PHASES).toHaveLength(8);
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.waves.length)).toEqual([4,4,4,5,5,5,6,6]);
    expect(CHAPTER_SIX_PHASES.map((phase) => phase.energy)).toEqual([930,960,990,1020,1050,1080,1110,1140]);
    CHAPTER_SIX_PHASES.forEach((phase) => { expect(phase.chapterId).toBe("chapter_06"); expect(phase.supplyLimit).toBe(40); expect(phase.loadoutLimit).toBe(9); expect(phase.waves.flatMap((wave) => wave.enemies).every((enemy) => CHAPTER_SIX_ENEMY_POOL.includes(enemy.type))).toBe(true); });
  });
});
