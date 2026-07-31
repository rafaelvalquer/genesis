import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";

const TOTAL_DEPLOYABLE_CELLS = 45;
const key = ([row, col]) => `${row}:${col}`;

function floodedAtMaximum(hazard) {
  return new Set([
    ...hazard.permanentWaterCells,
    ...hazard.intertidalBands
      .filter((band) => band.level <= hazard.maximumLevel)
      .flatMap((band) => band.cells),
  ].map(key));
}

describe("Capítulo 5 — Maré Territorial Progressiva", () => {
  it("contém oito missões da fase 33 até a 40", () => {
    expect(CHAPTER_FIVE_PHASES).toHaveLength(8);
    expect(CHAPTER_FIVE_PHASES.map((phase) => phase.id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `fase_${33 + index}`),
    );
  });

  it("preserva seis ondas, Supply 40 e loadout de oito tropas", () => {
    for (const phase of CHAPTER_FIVE_PHASES) {
      expect(phase.waves).toHaveLength(6);
      expect(phase.supplyLimit).toBe(40);
      expect(phase.loadoutLimit).toBe(8);
      expect(phase.environmentHazard.id).toBe("tide_cycle");
      expect(phase.environmentHazard.mode).toBe("territorial_progressive");
      expect(phase.waves.flatMap((wave) => wave.enemies).length).toBeGreaterThan(0);
    }
  });

  it("define água profunda, faixas intermaré e pelo menos 15 células seguras", () => {
    for (const phase of CHAPTER_FIVE_PHASES) {
      const hazard = phase.environmentHazard;
      expect(hazard.permanentWaterCells.length).toBeGreaterThan(0);
      expect(hazard.intertidalBands.length).toBeGreaterThan(0);
      expect(hazard.maximumLevel).toBeGreaterThan(0);
      expect(TOTAL_DEPLOYABLE_CELLS - floodedAtMaximum(hazard).size).toBeGreaterThanOrEqual(15);
    }
  });

  it("aumenta a pressão territorial ao longo das missões", () => {
    const hazards = CHAPTER_FIVE_PHASES.map((phase) => phase.environmentHazard);
    for (let index = 1; index < hazards.length; index += 1) {
      expect(hazards[index].maximumAdvanceChance)
        .toBeGreaterThanOrEqual(hazards[index - 1].maximumAdvanceChance);
      expect(hazards[index].enemySpeedFactor)
        .toBeGreaterThanOrEqual(hazards[index - 1].enemySpeedFactor);
      expect(hazards[index].maximumRetreatChance)
        .toBeLessThanOrEqual(hazards[index - 1].maximumRetreatChance);
    }
    expect(hazards.at(-1).pressureMaximumHpRatio).toBe(0.28);
    expect(hazards.at(-1).submergedAttackSpeedFactor).toBe(0.70);
  });

  it("não referencia monstros novos do Capítulo 5", () => {
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
