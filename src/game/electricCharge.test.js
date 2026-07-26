import { describe, expect, it } from "vitest";
import {
  ELECTRIC_CHARGE,
  applyConductivity,
  applyElectricCharge,
  expireElectricState,
  initializeElectricState,
  isElectricParalyzed,
} from "./electricCharge.js";

describe("Carga Iônica", () => {
  it("acumula três cargas, paralisa e concede imunidade posterior", () => {
    const troop = initializeElectricState({ type: "colono" });
    expect(applyElectricCharge(troop, 0).stacks).toBe(1);
    expect(applyElectricCharge(troop, 100).stacks).toBe(2);
    const third = applyElectricCharge(troop, 200);
    expect(third.paralyzed).toBe(true);
    expect(troop.electricStacks).toBe(0);
    expect(isElectricParalyzed(troop, 999)).toBe(true);
    expect(applyElectricCharge(troop, 1000)).toMatchObject({ paralyzed: false });
    expect(troop.electricImmunityUntil).toBe(200 + ELECTRIC_CHARGE.paralysisDurationMs
      + ELECTRIC_CHARGE.paralysisImmunityMs);
  });

  it("expira cargas e consome condutividade aplicando duas", () => {
    const troop = initializeElectricState({ type: "guarda" });
    applyElectricCharge(troop, 0);
    expireElectricState(troop, ELECTRIC_CHARGE.stackDurationMs);
    expect(troop.electricStacks).toBe(0);
    applyConductivity(troop, 7000);
    const result = applyElectricCharge(troop, 7100);
    expect(result).toMatchObject({ appliedStacks: 2, stacks: 2, conductivityConsumed: true });
  });

  it("pausa o reator e expõe a muralha ao completar a carga", () => {
    const reactor = initializeElectricState({ type: "reator" });
    const wall = initializeElectricState({ type: "muralhaReforcada" });
    applyElectricCharge(reactor, 0, { stacks: 3 });
    applyElectricCharge(wall, 0, { stacks: 3 });
    expect(reactor.electricReactorPausedUntil).toBe(ELECTRIC_CHARGE.reactorPauseMs);
    expect(wall.electricVulnerabilityUntil).toBe(ELECTRIC_CHARGE.structureVulnerabilityMs);
  });
});
