import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";

describe("Capítulo 5 — Abismo de Nereida", () => {
  it("contains eight missions from fase_33 to fase_40", () => {
    expect(CHAPTER_FIVE_PHASES).toHaveLength(8);
    expect(CHAPTER_FIVE_PHASES.map((phase) => phase.id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `fase_${33 + index}`),
    );
  });

  it("uses six waves, 40 supply and the tide mechanic", () => {
    for (const phase of CHAPTER_FIVE_PHASES) {
      expect(phase.waves).toHaveLength(6);
      expect(phase.supplyLimit).toBe(40);
      expect(phase.environmentHazard.id).toBe("tide_cycle");
      expect(phase.waves.flatMap((wave) => wave.enemies).length).toBeGreaterThan(0);
    }
  });

  it("does not reference chapter-five-only enemy assets", () => {
    const allowed = new Set([
      "medu", "crix", "krulax", "krakhul", "parasitaSaltador", "brakor", "oculis",
    ]);
    for (const phase of CHAPTER_FIVE_PHASES) {
      for (const enemy of phase.waves.flatMap((wave) => wave.enemies)) {
        expect(allowed.has(enemy.type)).toBe(true);
      }
    }
  });
});
