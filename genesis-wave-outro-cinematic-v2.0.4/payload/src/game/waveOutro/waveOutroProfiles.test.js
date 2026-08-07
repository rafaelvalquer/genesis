import { describe, expect, it } from "vitest";
import {
  getWaveOutroPhaseEnds,
  getWaveOutroProfile,
  getWaveOutroSlowMotionFactor,
} from "./waveOutroProfiles.js";
import { buildWaveOutroImpactEvent, getFinalImpactIntensity } from "./waveOutroEffects.js";
import { getWaveOutroMusicVolume } from "./waveOutroAudio.js";
import { getWaveOutroOverlayModel } from "./waveOutroRenderer.js";

describe("wave outro cinematic profiles", () => {
  it("does not render cinematic UI during normal battle mount", () => {
    expect(getWaveOutroOverlayModel({ status: "idle", lastKill: null }, { name: "Teste" })).toBeNull();
    expect(getWaveOutroOverlayModel({ status: undefined }, { name: "Teste" })).toBeNull();
  });

  it("prioritizes boss finale", () => {
    const outro = { finalWave: true, lastKill: { boss: true } };
    expect(getWaveOutroProfile(outro).id).toBe("bossFinale");
    expect(getWaveOutroPhaseEnds(outro).decisionIntro).toBe(6500);
  });

  it("keeps reduceMotion at 1x", () => {
    const outro = { status: "finalKill", elapsedMs: 350, finalWave: true, lastKill: {} };
    expect(getWaveOutroSlowMotionFactor(outro, true)).toBe(1);
    expect(getWaveOutroSlowMotionFactor(outro, false)).toBeLessThan(.3);
  });

  it("ducks music before impact", () => {
    const outro = { status: "finalKill", elapsedMs: 180, finalWave: true, lastKill: {} };
    expect(getWaveOutroMusicVolume(outro, 1)).toBeLessThan(1);
  });

  it("builds stronger boss final impact", () => {
    const outro = { finalWave: true, completedWave: 10, lastKill: { boss: true, cinematic: true, enemy: { id: "boss", x: 800, y: 300 } } };
    expect(getFinalImpactIntensity(outro)).toBe(1.8);
    const event = buildWaveOutroImpactEvent(outro);
    expect(event.type).toBe("missionFinalImpact");
    expect(event.freezeMs).toBe(90);
  });

  it("uses two-stage final mission copy", () => {
    const secured = getWaveOutroOverlayModel({ status: "waveCompleteBanner", finalWave: true, killed: 12, lastKill: {} }, { name: "Nereida" });
    expect(secured.title).toBe("PERÍMETRO ASSEGURADO");
    const victory = getWaveOutroOverlayModel({ status: "victoryIntro", finalWave: true, killed: 12, lastKill: {} }, { name: "Nereida" });
    expect(victory.title).toBe("MISSÃO CONCLUÍDA");
    expect(victory.subtitle).toBe("Nereida");
  });
});
