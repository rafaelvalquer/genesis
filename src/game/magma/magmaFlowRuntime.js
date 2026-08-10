import { CELL } from "../visualGeometry.js";
import { getMagmaCells } from "../thermalTerrain.js";
import { buildMagmaRegions } from "./magmaRegionBuilder.js";
import { getMagmaFlowFrame } from "./magmaFlowField.js";
import {
  createMagmaDynamicRegion,
  updateMagmaDynamicRegion,
} from "./magmaDynamicField.js";
import {
  buildMajorChannels,
  calibrateMagmaCrustThreshold,
  createMagmaSurfaceFrame,
  renderMagmaSurfaceFrame,
} from "./magmaSurfaceGenerator.js";
import {
  MAGMA_VISUAL_CONFIG,
  getMagmaSurfaceFps,
  resolveMagmaVisualOptions,
} from "./magmaVisualConfig.js";
import {
  applyMagmaSurfaceWorkerResult,
  createMagmaSurfaceWorkerClient,
} from "./magmaSurfaceWorkerClient.js";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createParticle() {
  return {
    active: false, x: 0, y: 0, vx: 0, vy: 0, gravity: 0,
    life: 0, maxLife: 0, radius: 0, temperature: 0, seed: 0,
    type: "ember", surfaceY: 0, hasSplashed: false,
  };
}

function pickPointInRegion(region, random, inset = 12) {
  const cell = region.cells[Math.floor(random() * region.cells.length)] || region.cells[0] || [0, 0];
  return {
    x: cell[1] * CELL.width + inset + random() * Math.max(1, CELL.width - inset * 2),
    y: cell[0] * CELL.height + inset + random() * Math.max(1, CELL.height - inset * 2),
  };
}

function buildVents(region, random) {
  const count = Math.max(...Object.values(MAGMA_VISUAL_CONFIG.ventCount));
  return Array.from({ length: count }, (_, index) => {
    const point = pickPointInRegion(region, random, 18);
    const periodMs = 4300 + random() * 1100;
    const typeRoll = random();
    return {
      id: `${region.id}-vent-${index}`,
      x: point.x,
      y: point.y,
      radius: 7 + random() * 7,
      periodMs,
      phaseMs: periodMs * index / Math.max(1, count) + random() * 180,
      strength: 0.56 + random() * 0.44,
      rareJet: random() > 0.88,
      type: typeRoll < 0.48
        ? "bubblePop"
        : typeRoll < 0.73
          ? "spatter"
          : typeRoll < 0.94
            ? "ventJet"
            : "crustBurst",
      seed: Math.floor(random() * 0x7fffffff),
    };
  });
}

function buildSmoke(regions, random) {
  return Array.from({ length: 10 }, (_, index) => {
    const region = regions[index % Math.max(1, regions.length)];
    const point = region ? pickPointInRegion(region, random, 8) : { x: 0, y: 0 };
    return {
      x: point.x,
      y: point.y,
      radius: 52 + random() * 58,
      rise: 18 + random() * 26,
      drift: (random() - 0.3) * 22,
      periodMs: 5200 + random() * 4100,
      phaseMs: random() * 8000,
      opacity: 0.55 + random() * 0.45,
      seed: index,
    };
  });
}

function configSignature(session, options) {
  return [
    session?.phase?.id,
    options.quality.quality,
    options.quality.resolutionScale.toFixed(3),
    Number(options.crustCoverage).toFixed(3),
    Number(options.warpMultiplier).toFixed(2),
    Number(options.majorChannelCount),
    session?.phase?.magmaTerrain?.visual?.seed || 1,
  ].join(":");
}

export function createMagmaFlowRuntime() {
  return {
    phaseId: null,
    signature: null,
    regions: [],
    surface: {
      lastUpdateAt: -Infinity,
      blendProgress: 0,
      fps: 0,
      pending: false,
      workerActive: false,
      workerDisabled: false,
    },
    surfaceWorker: null,
    vents: [],
    transientVents: [],
    particles: Array.from({ length: MAGMA_VISUAL_CONFIG.particlePoolSize }, createParticle),
    splashes: [],
    smoke: [],
    currentFlowSpeed: 0,
    currentFlowVector: { x: 0, y: 0 },
    flowTravelPx: 0,
    thermalState: "stable",
    visualTimeMs: 0,
    lastClockAt: null,
    lastParticleUpdateAt: null,
    randomState: 1,
    debug: { showHeatmap: false, showRegionMask: false },
  };
}

function initializeRuntime(runtime, session, now, options, canvasFactory) {
  const cells = getMagmaCells(session?.phase);
  const seed = session?.phase?.magmaTerrain?.visual?.seed || 1;
  const baseRegions = buildMagmaRegions(cells, {
    cellWidth: CELL.width,
    cellHeight: CELL.height,
    seed,
  });
  const random = seededRandom(seed ^ 0x51f15e);
  runtime.phaseId = session?.phase?.id || null;
  runtime.signature = configSignature(session, options);
  runtime.visualTimeMs = 0;
  runtime.flowTravelPx = 0;
  runtime.lastClockAt = now;
  runtime.lastParticleUpdateAt = now;
  runtime.randomState = (seed ^ 0xa341316c) >>> 0;
  if (!runtime.surfaceWorker && !runtime.surface.workerDisabled) {
    runtime.surfaceWorker = createMagmaSurfaceWorkerClient();
  }
  runtime.surface.pending = false;
  runtime.surface.workerActive = Boolean(runtime.surfaceWorker);
  runtime.particles.forEach((particle) => { particle.active = false; });
  runtime.splashes.length = 0;
  const surfaceFps = getMagmaSurfaceFps(options);
  runtime.regions = baseRegions.map((region) => {
    const channelCount = Math.max(2, Math.min(
      options.majorChannelCount,
      Math.round(region.bounds.width / 320),
    ));
    const channels = buildMajorChannels(region, channelCount, region.seed);
    const crustThreshold = calibrateMagmaCrustThreshold(region, channels, options);
    const calibratedOptions = { ...options, calibratedCrustThreshold: crustThreshold };
    const previous = createMagmaSurfaceFrame(region, options.quality.resolutionScale, canvasFactory);
    const next = createMagmaSurfaceFrame(region, options.quality.resolutionScale, canvasFactory);
    const interval = 1000 / surfaceFps;
    const dynamic = createMagmaDynamicRegion(region, random, 0);
    const initialFlow = getMagmaFlowFrame({
      region,
      visualConfig: options,
      thermalState: options.thermalState,
      travel: 0,
      reduceMotion: options.reduceMotion,
    });
    const nextFlow = getMagmaFlowFrame({
      region,
      visualConfig: options,
      thermalState: options.thermalState,
      travel: initialFlow.speed * interval / 1000,
      reduceMotion: options.reduceMotion,
    });
    renderMagmaSurfaceFrame(previous, {
      region, channels, time: 0, config: calibratedOptions, thermalState: options.thermalState,
      flowFrame: initialFlow, dynamic,
    });
    renderMagmaSurfaceFrame(next, {
      region, channels, time: interval / 1000, config: calibratedOptions, thermalState: options.thermalState,
      flowFrame: nextFlow, dynamic,
    });
    return {
      region,
      channels,
      crustThreshold,
      vents: buildVents(region, random),
      dynamic,
      previous,
      next,
    };
  });
  runtime.vents = runtime.regions.flatMap((entry) => entry.vents);
  runtime.smoke = buildSmoke(baseRegions, random);
  runtime.surface.lastUpdateAt = now;
  runtime.surface.blendProgress = 0;
  runtime.transientVents = [];
  runtime.surface.fps = surfaceFps;
}

function advanceVisualClock(runtime, now, options) {
  if (runtime.lastClockAt == null) runtime.lastClockAt = now;
  const delta = Math.max(0, Math.min(100, now - runtime.lastClockAt));
  runtime.lastClockAt = now;
  const referenceRegion = runtime.regions[0]?.region;
  const flow = getMagmaFlowFrame({
    region: referenceRegion,
    visualConfig: options,
    thermalState: options.thermalState,
    time: 1000,
    reduceMotion: options.reduceMotion,
  });
  runtime.currentFlowSpeed = flow.speed;
  runtime.currentFlowVector = {
    x: flow.directionX * flow.speed,
    y: flow.directionY * flow.speed,
  };
  if (!options.paused) {
    const motionScale = options.reduceMotion ? 0.12 : options.quality.quality === "low" ? 0.9 : 1;
    runtime.visualTimeMs += delta * motionScale;
    runtime.flowTravelPx += flow.speed * delta / 1000;
    const dynamicDelta = delta * motionScale;
    const random = () => nextMagmaRandom(runtime);
    for (const entry of runtime.regions) {
      updateMagmaDynamicRegion(
        entry.dynamic,
        entry.region,
        runtime,
        options,
        dynamicDelta,
        random,
      );
    }
    runtime.transientVents = runtime.regions.flatMap(
      (entry) => entry.dynamic.transientVents,
    );
  }
}

function closeWorkerResult(result) {
  result?.surface?.close?.();
  result?.hot?.close?.();
  result?.crust?.close?.();
  result?.heat?.close?.();
}

function scheduleWorkerSurfaceUpdate(runtime, options, interval, canvasFactory) {
  if (!runtime.surfaceWorker || runtime.surface.pending) return false;
  const signature = runtime.signature;
  const thermalState = options.thermalState;
  const showHeatmap = options.showHeatmap;
  const targetTime = (runtime.visualTimeMs + interval) / 1000;
  runtime.surface.pending = true;
  const requests = runtime.regions.map((entry) => {
    const flowFrame = getMagmaFlowFrame({
      region: entry.region,
      visualConfig: options,
      thermalState: options.thermalState,
      travel: runtime.flowTravelPx + runtime.currentFlowSpeed * interval / 1000,
      reduceMotion: options.reduceMotion,
    });
    return runtime.surfaceWorker.render({
      frameKey: `${signature}:${entry.region.id}`,
      resolutionScale: options.quality.resolutionScale,
      region: entry.region,
      render: {
        region: entry.region,
        channels: entry.channels,
        time: targetTime,
        config: { ...options, calibratedCrustThreshold: entry.crustThreshold },
        thermalState: options.thermalState,
        dynamic: entry.dynamic,
        flowFrame,
      },
    });
  });

  Promise.all(requests).then((results) => {
    if (
      runtime.signature !== signature
      || runtime.thermalState !== thermalState
      || runtime.debug.showHeatmap !== showHeatmap
    ) {
      results.forEach(closeWorkerResult);
      return;
    }
    results.forEach((result, index) => {
      const entry = runtime.regions[index];
      const recycled = entry.previous;
      applyMagmaSurfaceWorkerResult(recycled, result, canvasFactory);
      entry.previous = entry.next;
      entry.next = recycled;
    });
    runtime.surface.lastUpdateAt = runtime.lastClockAt ?? 0;
  }).catch(() => {
    runtime.surfaceWorker?.terminate?.();
    runtime.surfaceWorker = null;
    runtime.surface.workerActive = false;
    runtime.surface.workerDisabled = true;
  }).finally(() => {
    runtime.surface.pending = false;
  });
  return true;
}

function updateSurfaces(runtime, now, options, canvasFactory) {
  const surfaceFps = getMagmaSurfaceFps(options);
  const interval = 1000 / surfaceFps;
  runtime.surface.fps = surfaceFps;
  const elapsed = now - runtime.surface.lastUpdateAt;
  if (options.paused) {
    runtime.surface.blendProgress = 0;
    return;
  }
  if (elapsed >= interval) {
    if (runtime.surfaceWorker) {
      scheduleWorkerSurfaceUpdate(runtime, options, interval, canvasFactory);
      runtime.surface.blendProgress = 1;
      return;
    }
    for (const entry of runtime.regions) {
      const recycled = entry.previous;
      entry.previous = entry.next;
      entry.next = recycled;
      renderMagmaSurfaceFrame(entry.next, {
        region: entry.region,
        channels: entry.channels,
        time: (runtime.visualTimeMs + interval) / 1000,
        config: { ...options, calibratedCrustThreshold: entry.crustThreshold },
        thermalState: options.thermalState,
        dynamic: entry.dynamic,
        flowFrame: getMagmaFlowFrame({
          region: entry.region,
          visualConfig: options,
          thermalState: options.thermalState,
          travel: runtime.flowTravelPx + runtime.currentFlowSpeed * interval / 1000,
          reduceMotion: options.reduceMotion,
        }),
      });
    }
    runtime.surface.lastUpdateAt = now - (elapsed % interval);
  }
  runtime.surface.blendProgress = Math.max(0, Math.min(1, (now - runtime.surface.lastUpdateAt) / interval));
}

export function prepareMagmaFlowRuntime(
  suppliedRuntime,
  session,
  now,
  settings = {},
  adaptive = {},
  canvasFactory,
) {
  const runtime = suppliedRuntime || createMagmaFlowRuntime();
  const options = resolveMagmaVisualOptions(session, settings, adaptive);
  const signature = configSignature(session, options);
  if (runtime.signature !== signature) initializeRuntime(runtime, session, now, options, canvasFactory);
  advanceVisualClock(runtime, now, options);
  runtime.thermalState = options.thermalState;
  runtime.debug.showHeatmap = options.showHeatmap;
  runtime.debug.showRegionMask = options.showRegionMask;
  updateSurfaces(runtime, now, options, canvasFactory);
  return { runtime, options };
}

export function nextMagmaRandom(runtime) {
  runtime.randomState = (Math.imul(runtime.randomState, 1664525) + 1013904223) >>> 0;
  return runtime.randomState / 4294967296;
}

export function resetMagmaFlowRuntime(runtime) {
  if (!runtime) return;
  runtime.surfaceWorker?.terminate?.();
  Object.assign(runtime, createMagmaFlowRuntime());
}
