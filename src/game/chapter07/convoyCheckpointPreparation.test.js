import { describe, expect, it } from "vitest";
import { acknowledgeConvoyCheckpoint, enterCheckpointPreparation } from "./convoyCheckpoints.js";
import { applyConvoyCheckpointOption } from "./convoyCheckpointRewards.js";

function createSession() {
  return {
    elapsed: 1000,
    mines: [{ id: "mine" }],
    projectiles: [{ kind: "mine" }, { kind: "bullet" }],
    mineReservations: [{ id: "reservation" }],
    effects: [{ transientSector: true }, { transientSector: false }],
    waveActive: false, preparing: false,
    convoy: { invulnerable: false, hp: 800, maxHp: 1000, reserve: 20, reserveMax: 80 },
    convoyFlow: { state: "checkpointDecision", checkpointOptionChosen: true,
      checkpointBriefingPending: true, checkpointDecisionPending: true, reachedCheckpointCount: 1 },
  };
}

describe("convoy checkpoint preparation", () => {
  it("mantém o briefing aberto depois de escolher uma recompensa", () => {
    const session = createSession();
    session.convoyFlow.checkpointOptionChosen = false;
    const result = applyConvoyCheckpointOption(session, "repair");
    expect(result.ok).toBe(true);
    expect(session.convoyFlow.state).toBe("checkpointDecision");
    expect(session.convoyFlow.checkpointOptionChosen).toBe(true);
    expect(session.convoyFlow.checkpointBriefingPending).toBe(true);
  });

  it("mantém o briefing aberto depois de reabastecer", () => {
    const session = createSession();
    session.convoyFlow.checkpointOptionChosen = false;
    const result = applyConvoyCheckpointOption(session, "refill");
    expect(result.ok).toBe(true);
    expect(session.convoyFlow.state).toBe("checkpointDecision");
    expect(session.convoyFlow.checkpointBriefingPending).toBe(true);
  });

  it("releases the start control after confirming preparation", () => {
    const session = createSession();
    expect(acknowledgeConvoyCheckpoint(session)).toBe(true);
    expect(session.convoyFlow.state).toBe("checkpointPreparation");
    expect(session.convoyFlow.checkpointBriefingPending).toBe(false);
    expect(session.convoyFlow.checkpointDecisionPending).toBe(false);
    expect(session.preparing).toBe(true);
    expect(session.convoy.invulnerable).toBe(true);
  });

  it("does not re-open the briefing after entering preparation", () => {
    const session = createSession();
    const events = [];
    expect(enterCheckpointPreparation(session, events)).toBe(true);
    expect(session.convoyFlow.checkpointBriefingPending).toBe(false);
    expect(events).toContainEqual({ type: "checkpointPreparation", checkpointIndex: 0 });
  });
});
