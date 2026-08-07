import { describe, expect, it } from "vitest";
import { getWaveOutroCueState, getWaveOutroMusicVolumeFactor } from "./waveOutroAudio.js";

describe("mixagem do final da onda", () => {
  it("abaixa a música antes do impacto sem alterar o estado lógico", () => {
    const outro = { status: "finalKill", elapsedMs: 0, finalWave: false, completedWave: 2, startedAt: 10, lastKill: { cinematic: false } };
    expect(getWaveOutroMusicVolumeFactor(outro)).toBe(1);
    outro.elapsedMs = 180;
    expect(getWaveOutroMusicVolumeFactor(outro)).toBeLessThanOrEqual(0.36);
    expect(getWaveOutroCueState(outro).impactReady).toBe(true);
  });

  it("faz ducking mais profundo na última onda", () => {
    const normal = { status: "cleanup", elapsedMs: 900, finalWave: false, lastKill: { cinematic: false } };
    const finale = { ...normal, finalWave: true };
    expect(getWaveOutroMusicVolumeFactor(finale)).toBeLessThan(getWaveOutroMusicVolumeFactor(normal));
  });
});
