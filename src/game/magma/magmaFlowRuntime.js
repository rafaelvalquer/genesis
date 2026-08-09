import { CELL } from "../visualGeometry.js";
import { getMagmaCells } from "../thermalTerrain.js";
import { buildMagmaRegions } from "./magmaRegionBuilder.js";
import { getMagmaFlowFrame } from "./magmaFlowField.js";
import {
  buildMajorChannels,
  calibrateMagmaCrustThreshold,
  createMagmaSurfaceFrame,
  renderMagmaSurfaceFrame,
} from "./magmaSurfaceGenerator.js";
import {
  MAGMA_VISUAL_CONFIG,
  resolveMagmaVisualOptions,
} from "./magmaVisualConfig.js";

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
    return {
      id: `${region.id}-vent-${index}`,
      x: point.x,
      y: point.y,
      radius: 7 + random() * 7,
      periodMs,
      phaseMs: periodMs * index / Math.max(1, count) + random() * 180,
      strength: 0.56 + random() * 0.44,
      rareJet: random() > 0.88,
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
    surface: { lastUpdateAt: -Infinity, blendProgress: 0, fps: 0 },
    vents: [],
    particles: Array.from({ length: MAGMA_VISUAL_CONFIG.particlePoolSize }, createParticle),
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
  runtime.particles.forEach((particle) => { particle.active = false; });
  runtime.regions = baseRegions.map((region) => {
    const channelCount = Math.max(2, Math.min(
      options.majorChannelCount,
      Math.round(region.bounds.width / 225),
    ));
    const channels = buildMajorChannels(region, channelCount, region.seed);
    const crustThreshold = calibrateMagmaCrustThreshold(region, channels, options);
    const calibratedOptions = { ...options, calibratedCrustThreshold: crustThreshold };
    const previous = createMagmaSurfaceFrame(region, options.quality.resolutionScale, canvasFactory);
    const next = createMagmaSurfaceFrame(region, options.quality.resolutionScale, canvasFactory);
    const interval = 1000 / options.quality.surfaceFps;
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
      flowFrame: initialFlow,
    });
    renderMagmaSurfaceFrame(next, {
      region, channels, time: interval / 1000, config: calibratedOptions, thermalState: options.thermalState,
      flowFrame: nextFlow,
    });
    return { region, channels, crustThreshold, vents: buildVents(region, random), previous, next };
  });
  runtime.vents = runtime.regions.flatMap((entry) => entry.vents);
  runtime.smoke = buildSmoke(baseRegions, random);
  runtime.surface.lastUpdateAt = now;
  runtime.surface.blendProgress = 0;
  runtime.surface.fps = options.quality.surfaceFps;
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
  }
}

function updateSurfaces(runtime, now, options) {
  const interval = 1000 / options.quality.surfaceFps;
  const elapsed = now - runtime.surface.lastUpdateAt;
  if (options.paused) {
    runtime.surface.blendProgress = 0;
    return;
  }
  if (elapsed >= interval) {
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
  updateSurfaces(runtime, now, options);
  return { runtime, options };
}

export function nextMagmaRandom(runtime) {
  runtime.randomState = (Math.imul(runtime.randomState, 1664525) + 1013904223) >>> 0;
  return runtime.randomState / 4294967296;
}

export function resetMagmaFlowRuntime(runtime) {
  if (!runtime) return;
  Object.assign(runtime, createMagmaFlowRuntime());
}
