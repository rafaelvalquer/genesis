import { describe, expect, it, vi } from "vitest";
import { createBattleSession } from "../battleModel.js";
import { PHASES } from "../content.js";
import { advanceBattleFrameProgress } from "./battleFrameProgress.js";

describe("advanceBattleFrameProgress", () => {
  it("avança somente o fluxo não-step e não exige o renderer", () => {
    const sessionRef = { current: createBattleSession(PHASES[0], ["marine"], 11) };
    const context = {
      adaptiveSettingsRef: { current: {} },
      audioRef: { current: {} },
      consumeGraphicsEventsAtVisualTime: vi.fn(),
      convoyCountdownStepRef: { current: null },
      fortunePaused: false,
      frameDelta: 16,
      lastCriticalBeepRef: { current: 0 },
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

    expect(() => advanceBattleFrameProgress(context)).not.toThrow();
    expect(context.play).not.toHaveBeenCalled();
  });
});
