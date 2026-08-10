import { describe, expect, it } from "vitest";
import { createMagmaFlowRuntime, prepareMagmaFlowRuntime } from "../magmaFlowRuntime.js";
import { getMagmaVentPhase } from "../magmaEruptionRenderer.js";
import {
  MAGMA_VISUAL_CONFIG,
  MAGMA_THERMAL_VISUALS,
  getMagmaQualityProfile,
  resolveMagmaVisualOptions,
} from "../magmaVisualConfig.js";

describe("alocacoes do runtime de magma", () => {
  it("reutiliza ImageData e a grade dinamica ao reciclar os buffers", () => {
    let imageDataAllocations = 0;
    const countingCanvasFactory = () => {
      const context = {
        createImageData: (width, height) => {
          imageDataAllocations += 1;
          return { data: new Uint8ClampedArray(width * height * 4) };
        },
        putImageData: () => {},
      };
      return { width: 0, height: 0, getContext: () => context };
    };
    const runtime = createMagmaFlowRuntime();
    const session = {
      phase: {
        id: "magma-allocation-test",
        magmaTerrain: { cells: [[0, 0]], visual: { seed: 101 } },
      },
      thermalCycle: { state: "stable" },
      sandboxSettings: {},
    };

    prepareMagmaFlowRuntime(runtime, session, 1000, { quality: "high" }, {}, countingCanvasFactory);
    const recycledFrame = runtime.regions[0].previous;
    const recycledGrid = recycledFrame.dynamicGrid.values;
    expect(imageDataAllocations).toBe(6);
    expect(recycledFrame.heatImageData).toBeNull();

    prepareMagmaFlowRuntime(runtime, session, 1110, { quality: "high" }, {}, countingCanvasFactory);
    expect(runtime.regions[0].next).toBe(recycledFrame);
    expect(runtime.regions[0].next.dynamicGrid.values).toBe(recycledGrid);
    expect(imageDataAllocations).toBe(6);
  });
});

describe("runtime visual de magma", () => {
  const canvasFactory = () => {
    const context = {
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: () => {},
    };
    return { width: 0, height: 0, getContext: () => context };
  };

  it("pré-aloca o pool global de 80 partículas fora da sessão", () => {
    const runtime = createMagmaFlowRuntime();
    expect(runtime.particles).toHaveLength(80);
    expect(runtime.particles.every((particle) => particle.active === false)).toBe(true);
  });

  it("reduz resolução, FPS, partículas e shimmer com qualidade/adaptive", () => {
    const high = getMagmaQualityProfile({ quality: "high" }, { level: "full", particleBudgetScale: 1 });
    const stress = getMagmaQualityProfile({ quality: "high" }, { level: "stress", particleBudgetScale: 0.55 });
    expect(high.resolutionScale).toBe(0.54);
    expect(high.surfaceFps).toBe(12);
    expect(high.shimmer).toBe(true);
    expect(stress.resolutionScale).toBeLessThan(high.resolutionScale);
    expect(stress.surfaceFps).toBe(8);
    expect(stress.shimmer).toBe(false);
    expect(stress.particleScale).toBeLessThan(high.particleScale);
  });

  it("integra simultaneamente todos os parâmetros dos estados térmicos", () => {
    expect(MAGMA_THERMAL_VISUALS.eruption.flowSpeed).toBeGreaterThan(MAGMA_THERMAL_VISUALS.stable.flowSpeed);
    expect(MAGMA_THERMAL_VISUALS.eruption.brightness).toBeGreaterThan(MAGMA_THERMAL_VISUALS.cooldown.brightness);
    expect(MAGMA_THERMAL_VISUALS.eruption.liquidBias).toBeGreaterThan(MAGMA_THERMAL_VISUALS.stable.liquidBias);
    expect(MAGMA_THERMAL_VISUALS.eruption.smokeFactor).toBeGreaterThan(MAGMA_THERMAL_VISUALS.cooldown.smokeFactor);
    expect(MAGMA_VISUAL_CONFIG.activeParticles.eruption).toBe(36);
    expect(MAGMA_VISUAL_CONFIG.smokeCount.eruption).toBe(6);
  });

  it("aceita todos os overrides de depuração do laboratório", () => {
    const options = resolveMagmaVisualOptions({
      phase: { magmaTerrain: { visual: {} } },
      thermalCycle: { state: "stable" },
      sandboxSettings: {
        magmaThermalState: "eruption", magmaCrustCoverage: 0.6,
        magmaFlowMultiplier: 1.7, magmaWarpMultiplier: 1.4,
        magmaVentLimit: 5, magmaParticleLimit: 44, magmaPaused: true,
        magmaShowHeatmap: true, magmaShowRegionMask: true,
      },
    }, { quality: "high" });
    expect(options).toMatchObject({
      thermalState: "eruption", crustCoverage: 0.6, flowMultiplier: 1.7,
      warpMultiplier: 1.4, ventLimit: 5, particleLimit: 44, paused: true,
      showHeatmap: true, showRegionMask: true,
    });
  });

  it("distribui ciclos de vent deterministicamente", () => {
    const vent = { phaseMs: 1200, periodMs: 4800 };
    expect(getMagmaVentPhase(vent, 0)).toBeCloseTo(0.25);
    expect(getMagmaVentPhase(vent, 4800)).toBeCloseTo(0.25);
  });

  it("mantém dois buffers e usa 10 FPS no estado estável", () => {
    const runtime = createMagmaFlowRuntime();
    const session = {
      phase: {
        id: "magma-runtime-test",
        magmaTerrain: { cells: [[0, 0]], visual: { seed: 81 } },
      },
      thermalCycle: { state: "stable" },
      sandboxSettings: {},
    };
    prepareMagmaFlowRuntime(runtime, session, 1000, { quality: "high" }, {}, canvasFactory);
    const firstPrevious = runtime.regions[0].previous;
    const firstNext = runtime.regions[0].next;
    expect(firstPrevious).not.toBe(firstNext);
    expect(firstPrevious).toMatchObject({ width: 54, height: 65, generatedAt: 0 });
    expect(firstNext.generatedAt).toBeCloseTo(0.1);
    expect(runtime.surface.fps).toBe(10);
    expect(runtime.vents).toHaveLength(7);
    expect(runtime.smoke).toHaveLength(10);

    prepareMagmaFlowRuntime(runtime, session, 1030, { quality: "high" }, {}, canvasFactory);
    expect(runtime.regions[0].previous).toBe(firstPrevious);
    expect(runtime.surface.blendProgress).toBeCloseTo(0.3);

    prepareMagmaFlowRuntime(runtime, session, 1110, { quality: "high" }, {}, canvasFactory);
    expect(runtime.regions[0].previous).toBe(firstNext);
    expect(runtime.regions[0].next).toBe(firstPrevious);
  });

  it("mantém a distância do fluxo ao pausar ou usar multiplicador zero", () => {
    const runtime = createMagmaFlowRuntime();
    const session = {
      phase: {
        id: "magma-pause-test",
        magmaTerrain: {
          cells: [[0, 0]],
          visual: { seed: 91, flow: { x: -1, y: 0.025 }, speed: 26 },
        },
      },
      thermalCycle: { state: "active" },
      sandboxSettings: {},
    };

    prepareMagmaFlowRuntime(runtime, session, 1000, { quality: "high" }, {}, canvasFactory);
    prepareMagmaFlowRuntime(runtime, session, 1100, { quality: "high" }, {}, canvasFactory);
    const movingTravel = runtime.flowTravelPx;
    const movingVisualTime = runtime.visualTimeMs;
    expect(movingTravel).toBeCloseTo(2.6, 4);

    session.sandboxSettings.magmaPaused = true;
    prepareMagmaFlowRuntime(runtime, session, 1300, { quality: "high" }, {}, canvasFactory);
    expect(runtime.flowTravelPx).toBe(movingTravel);
    expect(runtime.visualTimeMs).toBe(movingVisualTime);

    session.sandboxSettings.magmaPaused = false;
    session.sandboxSettings.magmaFlowMultiplier = 0;
    prepareMagmaFlowRuntime(runtime, session, 1500, { quality: "high" }, {}, canvasFactory);
    expect(runtime.flowTravelPx).toBe(movingTravel);
    expect(runtime.currentFlowSpeed).toBe(0);
  });
});
