import { describe, expect, it } from "vitest";
import { getUnlockedTroops, PHASES } from "./content.js";
import {
  applyDecisionState,
  buildSpawnQueue,
  calculateStars,
  phaseBudget,
  validateCampaignBalance,
  waveBudget,
} from "./domain.js";

describe("campanha e ondas", () => {
  it("libera os defensores na nova ordem da campanha", () => {
    const expectedByPhase = [
      ["colono", "muralhaReforcada"],
      ["colono", "guarda", "muralhaReforcada"],
      ["colono", "guarda", "marine", "muralhaReforcada"],
      ["colono", "guarda", "marine", "sniper", "muralhaReforcada"],
      ["colono", "guarda", "marine", "sniper", "ranger", "muralhaReforcada"],
      ["colono", "guarda", "marine", "sniper", "ranger", "caçador", "muralhaReforcada"],
      ["colono", "guarda", "marine", "sniper", "ranger", "caçador", "bombardeiro", "muralhaReforcada"],
      ["colono", "guarda", "marine", "sniper", "ranger", "caçador", "bombardeiro", "krio", "muralhaReforcada"],
    ];
    expectedByPhase.forEach((expected, phaseIndex) => {
      expect(getUnlockedTroops(phaseIndex).map((troop) => troop.id)).toEqual(expected);
    });
  });

  it("mantém orçamento crescente em todas as oito fases", () => {
    expect(validateCampaignBalance()).toEqual([]);
    for (let index = 1; index < PHASES.length; index += 1) {
      expect(phaseBudget(PHASES[index])).toBeGreaterThanOrEqual(phaseBudget(PHASES[index - 1]) * 1.1);
      expect(waveBudget(PHASES[index].waves.at(-1))).toBeGreaterThanOrEqual(waveBudget(PHASES[index - 1].waves.at(-1)) * 1.1);
    }
  });

  it("gera a quantidade exata por tipo e uma ordem reproduzível", () => {
    const phase = PHASES[2];
    const first = buildSpawnQueue(phase, 2, 1234);
    const second = buildSpawnQueue(phase, 2, 1234);
    expect(first).toEqual(second);
    expect(first.filter((entry) => entry.type === "crix")).toHaveLength(8);
    expect(first.filter((entry) => entry.type === "medu")).toHaveLength(6);
  });

  it("calcula estrelas apenas para vitórias", () => {
    expect(calculateStars({ outcome: "defeat", integrity: 100, durationMs: 1, targetDurationMs: 100 })).toBe(0);
    expect(calculateStars({ outcome: "victory", integrity: 80, durationMs: 50, targetDurationMs: 100 })).toBe(3);
    expect(calculateStars({ outcome: "victory", integrity: 50, durationMs: 200, targetDurationMs: 100 })).toBe(1);
  });

  it("aplica custos e todos os modificadores táticos", () => {
    const state = { energy: 10, supply: 10, supplyMax: 20, integrity: 50, modifiers: { enemySpeed: 1, troopDamage: 1, slowDuration: 1 } };
    expect(applyDecisionState(state, { cost: { supply: 2 }, effect: { energy: 5, supply: 1, integrity: 20, enemySpeed: 1.08, troopDamage: 1.12, slowDuration: 1.2 } })).toMatchObject({
      energy: 15, supply: 9, integrity: 70, modifiers: { enemySpeed: 1.08, troopDamage: 1.12, slowDuration: 1.2 },
    });
  });
});
