import { describe, expect, it } from "vitest";
import { getCinematicWaveOutroCameraTransform, getKillCinematicCameraTransform } from "./waveOutroCamera.js";

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

  it("reutiliza o foco cinematográfico do último inimigo durante o cleanup", () => {
    const camera = getKillCinematicCameraTransform({
      status: "cleanup", elapsedMs: 400, focusX: 220, focusRow: 2,
      lastKill: { row: 2, enemy: { x: 275, y: 300 } },
      profile: { zoom: 1.12, impactAtMs: 650 }, enterEndMs: 650, exitStartMs: 1650, endMs: 2300,
    });
    expect(camera.zoom).toBeGreaterThan(1);
    expect(camera.focusX).toBe(275);
    expect(camera.focusY).toBeGreaterThan(0);
  });
});
