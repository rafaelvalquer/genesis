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

  it("ignora novas cargas durante a paralisia sem consumir condutividade", () => {
    const troop = initializeElectricState({ type: "colono" });
    applyElectricCharge(troop, 0);
    applyElectricCharge(troop, 100);
    const paralysis = applyElectricCharge(troop, 200);
    applyConductivity(troop, 300);
    const conductivityUntil = troop.electricConductivityUntil;
    const paralysisUntil = troop.electricParalyzedUntil;

    for (let now = 400; now < paralysisUntil; now += 100) {
      expect(applyElectricCharge(troop, now)).toMatchObject({
        appliedStacks: 0,
        stacks: 0,
        paralyzed: false,
        conductivityConsumed: false,
        ignored: true,
        ignoredReason: "paralyzed",
      });
      expect(troop.electricStacks).toBe(0);
    }
    expect(troop.electricStacksExpireAt).toBe(0);
    expect(troop.electricConductivityUntil).toBe(conductivityUntil);
    expect(troop.electricParalyzedUntil).toBe(paralysisUntil);
    expect(paralysis.paralyzed).toBe(true);
  });

  it("volta a acumular depois da paralisia, mas respeita a imunidade posterior", () => {
    const troop = initializeElectricState({ type: "colono" });
    applyElectricCharge(troop, 0);
    applyElectricCharge(troop, 100);
    const paralysis = applyElectricCharge(troop, 200);
    const afterParalysis = paralysis.paralyzed
      ? troop.electricParalyzedUntil + 1
      : 1000;
    expect(applyElectricCharge(troop, afterParalysis)).toMatchObject({
      appliedStacks: 1,
      stacks: 1,
      paralyzed: false,
    });
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
