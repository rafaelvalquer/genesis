import { describe, expect, it } from "vitest";
import {
  updateMagmaDynamicRegion,
  sampleCrustPatches,
  sampleHotspots,
  sampleLocalCurrents,
  sampleVortices,
} from "../magmaDynamicField.js";
import { buildMagmaRegions } from "../magmaRegionBuilder.js";

const alive = { birthAt: 0, peakAt: 2000, deathAt: 10000 };

describe("ciclo e limites do campo dinamico", () => {
  it("encerra um hotspot assim que ele cruza uma lacuna da mascara real", () => {
    const region = buildMagmaRegions([[0, 0], [0, 1], [1, 1]], { seed: 7 })[0];
    const hotspot = {
      id: "mask-hotspot",
      ...alive,
      x: 50,
      y: 50,
      radius: 20,
      strength: 0.2,
      drift: 0,
    };
    const dynamic = {
      localCurrents: [],
      vortices: [],
      crustPatches: [],
      hotspots: [hotspot],
      transientVents: [],
      nextTransientVentAt: Infinity,
      targetCounts: { currentCount: 0, vortexCount: 0, patchCount: 0, hotspotCount: 1 },
    };

    updateMagmaDynamicRegion(
      dynamic,
      region,
      { visualTimeMs: 1000, currentFlowVector: { x: 0, y: 200 }, thermalState: "stable" },
      { thermalState: "stable", flowMultiplier: 1 },
      1000,
      () => 0.5,
    );

    expect(hotspot.deathAt).toBe(1000);
  });

  it("encurta a vida das features ao entrar em resfriamento", () => {
    const region = buildMagmaRegions([[0, 0]], { seed: 11 })[0];
    const current = {
      id: "cooldown-current",
      ...alive,
      x: 50,
      y: 50,
      radiusX: 80,
      radiusY: 40,
      directionX: -1,
      directionY: 0,
      strength: 0,
      phase: 0,
      phaseSpeed: 0,
    };
    const dynamic = {
      localCurrents: [current, { ...current, id: "current-2" }, { ...current, id: "current-3" }],
      vortices: [{ ...current, id: "vortex", radius: 40, pulsePhase: 0 }],
      crustPatches: [],
      hotspots: [],
      transientVents: [],
      nextTransientVentAt: Infinity,
      targetCounts: { currentCount: 3, vortexCount: 1, patchCount: 0, hotspotCount: 0 },
    };

    updateMagmaDynamicRegion(
      dynamic,
      region,
      { visualTimeMs: 1000, currentFlowVector: { x: 0, y: 0 }, thermalState: "eruption" },
      { thermalState: "cooldown", flowMultiplier: 1 },
      16,
      () => 0.5,
    );

    expect(current.deathAt).toBe(4750);
  });
});

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
