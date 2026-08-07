import { describe, expect, it } from "vitest";
import {
  DEMATERIALIZATION_PULSE,
  beginDematerializationPulse,
  calculateDematerializationPulseCollapseScore,
  createDematerializationPulseState,
  estimateDematerializationPulseValue,
} from "./dematerializationPulse.js";

describe("dematerialization pulse domain", () => {
  it("mantém 500 de dano fixo por inimigo", () => {
    expect(DEMATERIALIZATION_PULSE.damage).toBe(500);
    expect(estimateDematerializationPulseValue([
      { hp: 200 }, { hp: 500 }, { hp: 750 }, { hp: 1200 },
    ])).toEqual({ enemyCount: 4, potentialDamage: 1700, potentialKills: 2 });
  });

  it("ativa uma única vez e preserva a origem", () => {
    const session = {
      elapsed: 1000,
      waveActive: true,
      outcome: null,
      dematerializationPulses: [createDematerializationPulseState(2)],
    };
    const first = beginDematerializationPulse(session, 2, {
      source: "player", requireTargets: true, hasTargets: true, events: [],
    });
    expect(first.ok).toBe(true);
    expect(session.dematerializationPulses[0].state).toBe("charging");
    expect(session.dematerializationPulses[0].activationSource).toBe("player");
    const second = beginDematerializationPulse(session, 2, { source: "ai", events: [] });
    expect(second.ok).toBe(false);
  });

  it("aumenta score quando a rota está perto do colapso", () => {
    expect(calculateDematerializationPulseCollapseScore({
      risk: 18, criticalTroops: 2, hasFrontline: false, activeThreat: 10,
      bossThreat: true, lowestTimeToBaseMs: 2500,
    })).toBeGreaterThan(40);
  });
});
