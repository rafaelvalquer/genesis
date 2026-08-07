import { describe, expect, it } from "vitest";
import { getCinematicWaveOutroCameraTransform } from "./waveOutroCamera.js";

describe("câmera cinematográfica do final de onda", () => {
  const session = {
    waveOutro: {
      status: "finalKill",
      elapsedMs: 230,
      finalWave: false,
      lastKill: { row: 2, cinematic: false, enemy: { type: "voltriz", x: 760, y: 300 } },
    },
  };

  it("usa o contrato zoom/focus esperado por presentScene", () => {
    const camera = getCinematicWaveOutroCameraTransform(session, false);
    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.focusX).toBeGreaterThan(0);
    expect(camera.focusY).toBeGreaterThan(0);
    expect(camera.scale).toBeUndefined();
  });

  it("desabilita a transformação com reduceMotion", () => {
    expect(getCinematicWaveOutroCameraTransform(session, true)).toBeNull();
  });

  it("retorna suavemente a 1 durante cleanup", () => {
    const camera = getCinematicWaveOutroCameraTransform({
      waveOutro: { ...session.waveOutro, status: "cleanup", elapsedMs: 999 },
    });
    expect(camera.zoom).toBeCloseTo(1, 2);
  });
});
