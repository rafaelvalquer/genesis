import { describe, expect, it } from "vitest";
import { createBattleSession } from "../battleModel.js";
import { CHAPTER_SEVEN_PHASES } from "../chapterSevenPhases.js";
import { getConvoyEntryX, getConvoyXForProgress } from "./convoyGeometry.js";
import {
  advanceConvoyEntry,
  advanceConvoySectorCountdown,
  startConvoySectorCountdown,
} from "./convoyFlow.js";
import { getDesiredConvoyAnimationState } from "./convoyAnimation.js";

function createSession() {
  return createBattleSession(CHAPTER_SEVEN_PHASES[0], ["colono"], 7049);
}

describe("entrada inicial do comboio", () => {
  it("mantém o veículo fora da tela durante a preparação", () => {
    const session = createSession();
    expect(session.convoy.x).toBe(getConvoyEntryX());
    expect(session.convoy.entryState).toBe("offscreen");
  });

  it("entra depois do countdown sem avançar o relógio lógico", () => {
    const session = createSession();
    const events = [];
    const firstStopX = getConvoyXForProgress(session.phase.convoy.sectorStops[0]);

    expect(startConvoySectorCountdown(session)).toBe(true);
    expect(advanceConvoySectorCountdown(session, 2400, events)).toBe(true);
    expect(session.convoyFlow.state).toBe("convoyEntry");
    expect(session.convoy.x).toBe(getConvoyEntryX());
    expect(session.waveActive).toBe(false);
    expect(session.queue).toEqual([]);
    expect(session.convoy.invulnerable).toBe(true);
    expect(session.elapsed).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "convoyEntryStarted" }));

    advanceConvoyEntry(session, 1100, events);
    expect(session.convoy.x).toBeGreaterThan(getConvoyEntryX());
    expect(session.convoy.x).toBeLessThan(firstStopX);
    expect(session.convoy.animation.state).toBe("run");
    expect(getDesiredConvoyAnimationState(session)).toBe("run");
    expect(session.elapsed).toBe(0);

    expect(advanceConvoyEntry(session, 1100, events)).toBe(true);
    expect(session.convoyFlow.state).toBe("sectorActive");
    expect(session.convoy.x).toBe(firstStopX);
    expect(session.convoy.entryState).toBe("active");
    expect(session.convoy.invulnerable).toBe(false);
    expect(session.waveActive).toBe(true);
    expect(session.queue.length).toBeGreaterThan(0);
    expect(session.elapsed).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "convoyEnteredField" }));
  });

  it("não repete a entrada nos setores seguintes", () => {
    const session = createSession();
    session.convoyFlow.state = "checkpointPreparation";
    session.convoyFlow.sectorIndex = 0;
    session.convoy.entryState = "active";
    expect(startConvoySectorCountdown(session)).toBe(true);
    expect(advanceConvoySectorCountdown(session, 2400, [])).toBe(true);
    expect(session.convoyFlow.state).toBe("sectorActive");
    expect(session.convoyFlow.sectorIndex).toBe(1);
    expect(session.convoy.entry).toBeNull();
  });
});
