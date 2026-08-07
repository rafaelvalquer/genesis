import { describe, expect, it } from "vitest";
import { getWaveOutroCueState, getWaveOutroMusicVolumeFactor } from "./waveOutroAudio.js";

describe("áudio e cue do final de onda", () => {
  const baseOutro = {
    status: "finalKill",
    elapsedMs: 0,
    finalWave: false,
    completedWave: 2,
    startedAt: 1000,
    lastKill: { cinematic: false, enemy: { type: "voltriz" } },
  };

  it("faz ducking antes do impacto", () => {
    expect(getWaveOutroMusicVolumeFactor(baseOutro)).toBe(1);
    expect(getWaveOutroMusicVolumeFactor({ ...baseOutro, elapsedMs: 180 })).toBeLessThan(0.5);
  });

  it("não perde o cue quando o frame pula além do limiar", () => {
    expect(getWaveOutroCueState({ ...baseOutro, elapsedMs: 140 }).impactReady).toBe(false);
    expect(getWaveOutroCueState({ ...baseOutro, status: "cleanup", elapsedMs: 700 }).impactReady).toBe(true);
  });

  it("gera chave estável para disparo único", () => {
    const a = getWaveOutroCueState({ ...baseOutro, elapsedMs: 200 });
    const b = getWaveOutroCueState({ ...baseOutro, elapsedMs: 420 });
    expect(a.key).toBe(b.key);
  });

  it("faz ducking mais profundo na última onda", () => {
    const normal = getWaveOutroMusicVolumeFactor({ ...baseOutro, elapsedMs: 300 });
    const finale = getWaveOutroMusicVolumeFactor({ ...baseOutro, elapsedMs: 300, finalWave: true });
    expect(finale).toBeLessThan(normal);
  });
});
