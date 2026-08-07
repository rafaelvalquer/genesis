import { describe, expect, it } from "vitest";
import { getCinematicWaveOutroCameraTransform } from "./waveOutroCamera.js";

describe("câmera cinematográfica do final da onda", () => {
  it("foca o último inimigo e amplia mais a última onda", () => {
    const base = {
      waveOutro: {
        status: "finalKill",
        elapsedMs: 220,
        finalWave: false,
        lastKill: { row: 2, cinematic: false, enemy: { x: 720 } },
      },
    };
    const normal = getCinematicWaveOutroCameraTransform(base);
    const finale = getCinematicWaveOutroCameraTransform({
      waveOutro: { ...base.waveOutro, finalWave: true },
    });
    expect(normal.focusX).toBe(720);
    expect(normal.zoom).toBeGreaterThan(1);
    expect(finale.zoom).toBeGreaterThan(normal.zoom);
  });

  it("respeita redução de movimento", () => {
    expect(getCinematicWaveOutroCameraTransform({ waveOutro: { status: "finalKill", elapsedMs: 200 } }, true)).toBeNull();
  });
});
