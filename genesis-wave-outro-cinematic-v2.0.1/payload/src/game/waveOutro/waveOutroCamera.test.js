import { describe, expect, it } from "vitest";
import { getWaveOutroCameraTransform, getWaveOutroFocusPoint } from "./waveOutroCamera.js";

function outro(overrides = {}) {
  return {
    status: "finalKill",
    elapsedMs: 0,
    finalWave: false,
    profileId: "standard",
    lastKill: {
      row: 2,
      enemy: { x: 860, y: 360 },
      cinematic: false,
    },
    ...overrides,
  };
}

describe("wave outro camera", () => {
  it("starts at neutral zoom and focuses the last enemy", () => {
    const state = outro();
    const transform = getWaveOutroCameraTransform({ waveOutro: state });
    expect(transform.zoom).toBeCloseTo(1, 5);
    expect(transform.focusX).toBe(getWaveOutroFocusPoint(state).x);
  });

  it("reaches the standard cinematic zoom and returns smoothly", () => {
    const focused = getWaveOutroCameraTransform({ waveOutro: outro({ elapsedMs: 220 }) });
    const returning = getWaveOutroCameraTransform({ waveOutro: outro({ status: "cleanup", elapsedMs: 1149 }) });
    expect(focused.zoom).toBeCloseTo(1.10, 3);
    expect(returning.zoom).toBeCloseTo(1, 2);
  });

  it("uses stronger framing for the mission finale", () => {
    const finale = outro({
      finalWave: true,
      profileId: "missionFinale",
      elapsedMs: 320,
    });
    const transform = getWaveOutroCameraTransform({ waveOutro: finale });
    expect(transform.zoom).toBeCloseTo(1.13, 3);
  });

  it("disables camera movement with reduceMotion", () => {
    expect(getWaveOutroCameraTransform({ waveOutro: outro({ elapsedMs: 320 }) }, true)).toBeNull();
  });
});
