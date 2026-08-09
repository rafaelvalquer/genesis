import { describe, expect, it } from "vitest";
import {
  sampleCrustPatches,
  sampleHotspots,
  sampleLocalCurrents,
  sampleVortices,
} from "../magmaDynamicField.js";

const alive = { birthAt: 0, peakAt: 2000, deathAt: 10000 };

describe("campo dinâmico do magma", () => {
  it("aplica correntes locais somente dentro da elipse de influência", () => {
    const current = {
      ...alive,
      x: 100,
      y: 100,
      radiusX: 80,
      radiusY: 40,
      directionX: -1,
      directionY: 0.2,
      strength: 12,
      phase: 0,
      phaseSpeed: 0,
    };
    const inside = sampleLocalCurrents(100, 100, [current], 3000);
    const outside = sampleLocalCurrents(300, 100, [current], 3000);
    expect(inside.x).toBeLessThan(-5);
    expect(inside.y).toBeGreaterThan(0);
    expect(outside).toEqual({ x: 0, y: 0 });
  });

  it("produz rotação tangencial com sentidos opostos", () => {
    const clockwise = {
      ...alive,
      x: 100,
      y: 100,
      radius: 80,
      strength: 12,
      pulsePhase: 0,
    };
    const counter = { ...clockwise, strength: -12 };
    const first = sampleVortices(140, 100, [clockwise], 3000);
    const second = sampleVortices(140, 100, [counter], 3000);
    expect(first.y).toBeGreaterThan(0);
    expect(second.y).toBeLessThan(0);
  });

  it("faz a crosta resfriar, rachar e derreter durante o ciclo", () => {
    const patch = {
      ...alive,
      x: 100,
      y: 100,
      radiusX: 60,
      radiusY: 30,
      rotation: 0,
      strength: 0.2,
      crackAngle: 0,
      crackFrequency: 0.1,
    };
    const stable = sampleCrustPatches(100, 100, [patch], 3500);
    const breaking = sampleCrustPatches(100, 100, [patch], 6500);
    const melted = sampleCrustPatches(100, 100, [patch], 9900);
    expect(stable.heatDelta).toBeLessThan(-0.15);
    expect(breaking.crackHeat).toBeGreaterThan(0);
    expect(Math.abs(melted.heatDelta)).toBeLessThan(Math.abs(stable.heatDelta));
  });

  it("mantém hotspots móveis com influência térmica localizada", () => {
    const hotspot = { ...alive, x: 100, y: 100, radius: 30, strength: 0.25 };
    expect(sampleHotspots(100, 100, [hotspot], 3000)).toBeGreaterThan(0.2);
    expect(sampleHotspots(160, 100, [hotspot], 3000)).toBe(0);
  });
});
