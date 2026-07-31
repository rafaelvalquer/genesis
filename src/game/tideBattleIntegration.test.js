import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import {
  canPlaceTroop,
  createBattleSession,
  placeTroop,
  removeTroop,
  startWave,
  stepBattle,
} from "./battleModel.js";

describe("integração da maré territorial com a batalha", () => {
  it("bloqueia água profunda e permite intermaré seca", () => {
    const phase = CHAPTER_FIVE_PHASES[0];
    const session = createBattleSession(phase, ["colono"], 123);

    expect(canPlaceTroop(session, "colono", 0, 9)).toContain("Água profunda");
    expect(canPlaceTroop(session, "colono", 0, 8)).toBeNull();
  });

  it("mantém a regeneração, consumo e devolução de Supply sem alterações", () => {
    const phase = CHAPTER_FIVE_PHASES[0];
    const session = createBattleSession(phase, ["colono"], 456);
    const supplyMaxBefore = session.supplyMax;
    const accumulatorBefore = session.supplyAccumulator;

    const placement = placeTroop(session, "colono", 0, 1);
    expect(placement.ok).toBe(true);
    expect(session.supply).toBe(supplyMaxBefore - 3);
    expect(session.supplyMax).toBe(supplyMaxBefore);

    expect(startWave(session)).toBe(true);
    stepBattle(session, 1000);
    expect(session.supply).toBe(supplyMaxBefore - 2);
    expect(session.supplyMax).toBe(supplyMaxBefore);
    expect(session.supplyAccumulator).toBe(accumulatorBefore);

    const removal = removeTroop(session, 0, 1);
    expect(removal.ok).toBe(true);
    expect(session.supply).toBe(supplyMaxBefore);
    expect(session.supplyMax).toBe(supplyMaxBefore);
  });
});
