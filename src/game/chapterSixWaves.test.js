import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_ENEMY_POOL, createChapterSixWaves } from "./chapterSixWaves.js";
describe("waves do capítulo 6", () => {
  it("mantém a distribuição 4/5/6 e usa somente o pool do capítulo 1", () => {
    expect(Array.from({ length: 8 }, (_, index) => createChapterSixWaves(index).length)).toEqual([4,4,4,5,5,5,6,6]);
    createChapterSixWaves(7).flatMap((wave) => wave.enemies).forEach((enemy) => expect(CHAPTER_SIX_ENEMY_POOL).toContain(enemy.type));
  });
});
