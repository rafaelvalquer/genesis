import { describe, expect, it } from "vitest";
import {
  CHAPTER_SIX_ENEMY_POOL,
  CHAPTER_SIX_PACKETS,
  CHAPTER_SIX_TIER_PROFILES,
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

  it("usa os oito conjuntos de ondas, com rotas e atrasos coordenados", () => {
    expect(Array.from({ length: 8 }, (_, index) => createChapterSixWaves(index).length)).toEqual([4, 4, 4, 5, 5, 5, 6, 6]);
    const final = createChapterSixWaves(7).at(-1);
    expect(final.spawnBlocks.flatMap((block) => block.packets)).toHaveLength(5);
    expect(final.spawnBlocks.flatMap((block) => block.packets).map((packet) => packet.spawnAtMs)).toEqual([0, 4000, 8000, 12000, 16000]);
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
});
