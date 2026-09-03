import { describe, expect, it, vi } from "vitest";
import { createBattleSession } from "../battleModel.js";
import { PHASES } from "../content.js";
import { advanceBattleFrameProgress } from "./battleFrameProgress.js";

function createContext() {
  const sessionRef = { current: createBattleSession(PHASES[0], ["marine"], 11) };
  return {
    adaptiveSettingsRef: { current: {} },
    audioRef: { current: {} },
    consumeGraphicsEventsAtVisualTime: vi.fn(),
    convoyCountdownStepRef: { current: null },
    fortunePaused: false,
    frameDelta: 16,
    lastCriticalBeepRef: { current: 0 },
    now: 16,
    particlesRef: { current: [] },
    paused: false,
    phase: PHASES[0],
    play: vi.fn(),
    pushEventParticles: vi.fn(),
    sessionRef,
    setBanner: vi.fn(),
    settings: { reduceMotion: false, masterVolume: 1, musicVolume: 1, effectsVolume: 1 },
    speed: 1,
    waveOutroCueRef: { current: null },
  };
}

describe("advanceBattleFrameProgress", () => {
  it("avança somente o fluxo não-step e não exige o renderer", () => {
    const context = createContext();

    expect(() => advanceBattleFrameProgress(context)).not.toThrow();
    expect(context.play).not.toHaveBeenCalled();
  });

  it("usa o relógio do frame no alarme de integridade crítica <=25%", () => {
    const context = createContext();
    context.sessionRef.current.integrity = 20;
    context.sessionRef.current.integrityMax = 100;
    context.now = 1500;

    expect(() => advanceBattleFrameProgress(context)).not.toThrow();
    expect(context.lastCriticalBeepRef.current).toBe(1500);

    context.now = 2000;
    advanceBattleFrameProgress(context);
    expect(context.lastCriticalBeepRef.current).toBe(1500);

    context.now = 2700;
    advanceBattleFrameProgress(context);
    expect(context.lastCriticalBeepRef.current).toBe(2700);
  });
});
