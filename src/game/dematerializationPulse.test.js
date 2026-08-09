import { describe, expect, it } from "vitest";
import {
  DEMATERIALIZATION_PULSE,
  beginDematerializationPulse,
  calculateDematerializationPulseCollapseScore,
  createDematerializationPulseState,
  estimateDematerializationPulseValue,
  getDematerializationPulseTargets,
} from "./dematerializationPulse.js";

describe("dematerialization pulse domain", () => {
  it("keeps 500 damage per eligible enemy", () => {
    expect(DEMATERIALIZATION_PULSE.damage).toBe(500);
    expect(estimateDematerializationPulseValue([
      { hp: 200 }, { hp: 500 }, { hp: 750 }, { hp: 1200 },
    ])).toEqual({ enemyCount: 4, potentialDamage: 1700, potentialKills: 2 });
  });

  it("uses the shared target selection for rows, submerged enemies and Leviathan", () => {
    const targets = getDematerializationPulseTargets({
      enemies: [
        { id: "normal", type: "medu", row: 2, hp: 200, dead: false },
        { id: "submerged", type: "enguiaRasgamar", row: 2, hp: 700, rasgamarSubmerged: true, dead: false },
        { id: "leviathan", type: "leviathanNereida", row: 1, hp: 6000, dead: false, leviathanTargetable: true, leviathanTargetableRows: [2] },
        { id: "other-row", type: "medu", row: 3, hp: 200, dead: false },
      ],
    }, 2);

    expect(targets.map((enemy) => enemy.id)).toEqual(["normal", "leviathan"]);
  });

  it("activates once and preserves the source", () => {
    const session = { elapsed: 1000, waveActive: true, outcome: null, dematerializationPulses: [createDematerializationPulseState(2)] };
    const first = beginDematerializationPulse(session, 2, { source: "player", requireTargets: true, hasTargets: true, events: [] });
    expect(first.ok).toBe(true);
    expect(session.dematerializationPulses[0].state).toBe("charging");
    expect(session.dematerializationPulses[0].activationSource).toBe("player");
    expect(beginDematerializationPulse(session, 2, { source: "ai", events: [] }).ok).toBe(false);
  });

  it("increases score near lane collapse", () => {
    expect(calculateDematerializationPulseCollapseScore({
      risk: 18, criticalTroops: 2, hasFrontline: false, activeThreat: 10,
      bossThreat: true, lowestTimeToBaseMs: 2500,
    })).toBeGreaterThan(40);
  });
});
