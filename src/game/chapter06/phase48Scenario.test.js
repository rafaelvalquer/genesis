import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "../chapterSixPhases.js";
import { ENEMIES } from "../content.js";
import { PHASE_48_SCENARIO } from "./phase48Scenario.js";

describe("cenário da Fase 48", () => {
  it("reserva o Colosso exclusivamente para a sexta onda", () => {
    const phase = CHAPTER_SIX_PHASES.find((entry) => entry.id === "fase_48");
    expect(phase.boss).toBe(true);
    expect(phase.waves.slice(0, 5).every((wave) => !wave.bossEncounter)).toBe(true);
    expect(phase.waves[5].bossEncounter).toBe(PHASE_48_SCENARIO.bossEncounter);
    expect(phase.waves[5].maximumLivingEnemies).toBeLessThan(76);
  });

  it("declara limites de reforço e um boss estacionário multi-rota", () => {
    expect(ENEMIES.colossoCaldeira).toMatchObject({ boss: true, stationary: true, multiRowBoss: true, chapterId: "chapter_06" });
    expect(PHASE_48_SCENARIO.bossEncounter.maximumLivingByType.salamandraCinerea).toBeGreaterThan(0);
  });

  it("declara a coluna 9 como erupção permanente do encounter", () => {
    expect(PHASE_48_SCENARIO.bossEncounter.permanentEruption).toMatchObject({
      type: "permanentEruption",
      thermalState: "eruption",
      cells: [[0, 9], [1, 9], [2, 9], [3, 9], [4, 9]],
    });
  });
});
