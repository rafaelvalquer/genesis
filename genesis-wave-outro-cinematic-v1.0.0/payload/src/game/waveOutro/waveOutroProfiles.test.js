import { describe, expect, it } from "vitest";
import {
  getWaveOutroImpactState,
  getWaveOutroPresentationProfile,
} from "./waveOutroProfiles.js";

describe("perfil cinematográfico do final da onda", () => {
  it("preserva o perfil normal e promove alfas/chefes e a última onda", () => {
    expect(getWaveOutroPresentationProfile({ finalWave: false, lastKill: { cinematic: false } }).id).toBe("standard");
    expect(getWaveOutroPresentationProfile({ finalWave: false, lastKill: { cinematic: true } }).id).toBe("cinematic");
    expect(getWaveOutroPresentationProfile({ finalWave: true, lastKill: { cinematic: false } }).id).toBe("missionFinale");
  });

  it("gera impacto somente dentro da janela visual", () => {
    expect(getWaveOutroImpactState({ status: "finalKill", elapsedMs: 100, finalWave: false }).active).toBe(false);
    const impact = getWaveOutroImpactState({ status: "finalKill", elapsedMs: 220, finalWave: false });
    expect(impact.active).toBe(true);
    expect(impact.progress).toBeGreaterThanOrEqual(0);
    expect(impact.progress).toBeLessThan(1);
  });
});
