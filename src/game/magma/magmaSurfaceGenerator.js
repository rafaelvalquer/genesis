import {
  MAGMA_COLOR_STOPS,
  MAGMA_VISUAL_CONFIG,
  clamp01,
  getMagmaThermalVisual,
} from "./magmaVisualConfig.js";
import { getMagmaFlowFrame } from "./magmaFlowField.js";
import { sampleMagmaDynamicField } from "./magmaDynamicField.js";

const TAU = Math.PI * 2;

const fade = (value) => value * value * (3 - 2 * value);
const lerp = (from, to, amount) => from + (to - from) * amount;
const smoothstep = (from, to, value) => {
  const t = clamp01((value - from) / Math.max(0.00001, to - from));
  return t * t * (3 - 2 * t);
};

export function hashNoise(x, y, seed = 1) {
  let value = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise(x, y, seed = 1) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const top = lerp(hashNoise(x0, y0, seed), hashNoise(x0 + 1, y0, seed), tx);
  const bottom = lerp(hashNoise(x0, y0 + 1, seed), hashNoise(x0 + 1, y0 + 1, seed), tx);
  return lerp(top, bottom, ty);
}

export function fractalNoise(x, y, seed, octaves = 3) {
  let amplitude = 0.58;
  let frequency = 1;
  let value = 0;
  let total = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise(x * frequency, y * frequency, seed + octave * 101) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / total;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function cubic(from, controlA, controlB, to, t) {
  const inverse = 1 - t;
  return inverse ** 3 * from
    + 3 * inverse ** 2 * t * controlA
    + 3 * inverse * t ** 2 * controlB
    + t ** 3 * to;
}

export function buildMajorChannels(region, count = MAGMA_VISUAL_CONFIG.majorChannelCount, seed = region.seed) {
  const random = seededRandom(seed ^ 0x7f4a7c15);
  const { width, height } = region.bounds;
  return Array.from({ length: count }, (_, index) => {
    const lane = (index + 0.55 + (random() - 0.5) * 0.45) / Math.max(1, count);
    const startY = clamp01(lane) * height;
    const endY = clamp01(lane + (random() - 0.5) * 0.52) * height;
    const bend = Math.max(24, height * (0.3 + random() * 0.26));
    const baseControlY1 = Math.max(0, Math.min(height, startY + (random() - 0.5) * bend));
    const baseControlY2 = Math.max(0, Math.min(height, endY + (random() - 0.5) * bend));
    const baseRadius = 12 + random() * 20;
    return {
      id: `${region.id}-channel-${index}`,
      startX: -width * 0.06,
      startY,
      controlX1: width * (0.2 + random() * 0.1),
      controlY1: baseControlY1,
      baseControlY1,
      controlX2: width * (0.68 + random() * 0.12),
      controlY2: baseControlY2,
      baseControlY2,
      endX: width * 1.06,
      endY,
      radius: baseRadius,
      baseRadius,
      phase: random() * TAU,
      speed: 0.72 + random() * 0.68,
      strength: 0.64 + random() * 0.2,
      swayAmplitude1: 8 + random() * Math.max(12, height * 0.12),
      swayAmplitude2: 8 + random() * Math.max(12, height * 0.14),
      swaySpeed1: 0.18 + random() * 0.24,
      swaySpeed2: 0.13 + random() * 0.22,
      widthPulsePhase: random() * TAU,
      widthPulseSpeed: 0.22 + random() * 0.3,
      branches: random() > 0.28 ? [{
        start: 0.2 + random() * 0.22,
        end: 0.64 + random() * 0.24,
        offset: (random() > 0.5 ? 1 : -1) * (13 + random() * 27),
        strength: 0.42 + random() * 0.24,
        cycleMs: 8500 + random() * 8000,
        phaseMs: random() * 9000,
      }] : [],
    };
  });
}

export function getDynamicChannelGeometry(channel, time = 0) {
  const controlY1 = (channel.baseControlY1 ?? channel.controlY1)
    + Math.sin(time * (channel.swaySpeed1 || 0) + channel.phase) * (channel.swayAmplitude1 || 0);
  const controlY2 = (channel.baseControlY2 ?? channel.controlY2)
    + Math.sin(time * (channel.swaySpeed2 || 0) + channel.phase * 1.37) * (channel.swayAmplitude2 || 0);
  const radius = (channel.baseRadius ?? channel.radius) * (
    1 + Math.sin(time * (channel.widthPulseSpeed || 0) + (channel.widthPulsePhase || 0)) * 0.18
  );
  return { ...channel, controlY1, controlY2, radius };
}

export function getChannelPoint(channel, progress, time = 0) {
  const t = clamp01(progress);
  const geometry = getDynamicChannelGeometry(channel, time);
  return {
    x: cubic(geometry.startX, geometry.controlX1, geometry.controlX2, geometry.endX, t),
    y: cubic(geometry.startY, geometry.controlY1, geometry.controlY2, geometry.endY, t),
  };
}

function branchEnvelope(branch, progress, timeMs) {
  if (progress <= branch.start || progress >= branch.end) return 0;
  const spatial = Math.sin((progress - branch.start) / (branch.end - branch.start) * Math.PI);
  const cycle = ((timeMs + branch.phaseMs) % branch.cycleMs) / branch.cycleMs;
  const temporal = cycle < 0.18
    ? smoothstep(0, 0.18, cycle)
    : cycle > 0.68
      ? 1 - smoothstep(0.68, 0.95, cycle)
      : 1;
  return spatial * temporal;
}

function sampleChannels(channels, localX, localY, regionWidth, flowFrame, time) {
  let river = 0;
  let hotspot = 0;
  let longitudinal = 0;
  for (const channel of channels) {
    const geometry = getDynamicChannelGeometry(channel, time);
    const progress = clamp01((localX - channel.startX) / Math.max(1, channel.endX - channel.startX));
    const point = getChannelPoint(channel, progress, time);
    const advectedX = localX - flowFrame.offsetX;
    const rippleProgress = (advectedX - channel.startX) / Math.max(1, channel.endX - channel.startX);
    const widthWave = Math.max(0.58, Math.min(1.18,
      0.82
      + Math.sin(rippleProgress * TAU * 1.7 + channel.phase * 0.8) * 0.2
      + Math.sin(rippleProgress * TAU * 4.3 - channel.phase) * 0.12,
    ));
    const localRadius = geometry.radius * widthWave;
    const ripple = (
      Math.sin(rippleProgress * TAU * 2.2 + channel.phase) * 0.26
      + Math.sin(rippleProgress * TAU * 5.6 - channel.phase * 0.7) * 0.11
    ) * geometry.radius;
    const distance = Math.abs(localY - point.y - ripple);
    const continuity = 0.62 + 0.38 * (
      0.5 + 0.5 * Math.sin(rippleProgress * TAU * 2.85 + channel.phase * 1.6)
    );
    let channelHeat = (1 - smoothstep(localRadius * 0.32, localRadius, distance)) * continuity;
    for (const branch of channel.branches || []) {
      const envelope = branchEnvelope(branch, progress, time * 1000);
      if (envelope <= 0) continue;
      const branchDistance = Math.abs(localY - point.y - ripple - branch.offset * envelope);
      const branchRadius = geometry.radius * (0.46 + branch.strength * 0.32);
      const branchHeat = (1 - smoothstep(branchRadius * 0.32, branchRadius, branchDistance))
        * envelope
        * branch.strength;
      channelHeat = Math.max(channelHeat, branchHeat);
    }
    river = Math.max(river, channelHeat * channel.strength);
    const coreSpacing = Math.max(34, regionWidth * (0.042 + channel.speed * 0.009));
    const movingCore = Math.max(0, Math.sin(
      advectedX / coreSpacing * TAU
      + channel.phase,
    )) ** 12;
    hotspot = Math.max(hotspot, channelHeat * movingCore);
    longitudinal = Math.max(longitudinal, channelHeat * (0.5 + 0.5 * Math.sin(
      advectedX / Math.max(24, regionWidth * 0.045) + channel.phase,
    )));
  }
  return { river, hotspot, longitudinal };
}

export function sampleMagmaField({
  worldX,
  worldY,
  localX,
  localY,
  region,
  channels,
  time = 0,
  config = MAGMA_VISUAL_CONFIG,
  thermalState = "stable",
  flowFrame,
  dynamic,
  dynamicSample,
}) {
  const thermal = getMagmaThermalVisual(thermalState);
  const flow = flowFrame || getMagmaFlowFrame({
    region,
    visualConfig: config,
    thermalState,
    time: time * 1000,
    reduceMotion: false,
  });
  const warpScale = config.warpScale || MAGMA_VISUAL_CONFIG.warpScale;
  const warpStrength = (config.warpStrength || MAGMA_VISUAL_CONFIG.warpStrength)
    * (config.warpMultiplier ?? 1);
  const dynamicField = dynamicSample
    || sampleMagmaDynamicField(worldX, worldY, dynamic, time * 1000);
  const localAdvectionScale = Math.max(0, config.flowMultiplier ?? 1);

  // The crust topology only creeps a few percent of the liquid travel. The
  // brighter material below it receives the full advection vector.
  const anchorX = worldX - flow.crustOffsetX + flow.anchorDrift;
  const anchorY = worldY - flow.crustOffsetY + flow.anchorDrift * 0.35;
  const warpX = (fractalNoise(
    anchorX * warpScale + flow.turbulenceTime * 0.22,
    anchorY * warpScale,
    region.seed + 17,
    2,
  ) - 0.5) * 2 * warpStrength;
  const warpY = (fractalNoise(
    anchorX * warpScale,
    anchorY * warpScale - flow.turbulenceTime * 0.16,
    region.seed + 43,
    2,
  ) - 0.5) * 2 * warpStrength * 0.76;
  const warpedX = anchorX + warpX;
  const warpedY = anchorY + warpY;
  const large = fractalNoise(
    anchorX * (config.largeCrustScale || MAGMA_VISUAL_CONFIG.largeCrustScale),
    anchorY * (config.largeCrustScale || MAGMA_VISUAL_CONFIG.largeCrustScale),
    region.seed + 71,
    3,
  );
  const medium = fractalNoise(
    warpedX * (config.mediumCrustScale || MAGMA_VISUAL_CONFIG.mediumCrustScale),
    warpedY * (config.mediumCrustScale || MAGMA_VISUAL_CONFIG.mediumCrustScale),
    region.seed + 113,
    2,
  );
  const anchoredFine = valueNoise(
    warpedX * (config.detailScale || MAGMA_VISUAL_CONFIG.detailScale),
    warpedY * (config.detailScale || MAGMA_VISUAL_CONFIG.detailScale),
    region.seed + 197,
  );
  const combined = large * 0.58 + medium * 0.3 + anchoredFine * 0.12;
  const crustThreshold = config.calibratedCrustThreshold
    ?? 0.535 + ((config.crustCoverage ?? MAGMA_VISUAL_CONFIG.crustCoverage) - 0.43) * 0.72;
  let baseHeat = 0.38 + (combined - crustThreshold) * 1.78 + thermal.liquidBias;
  baseHeat += dynamicField.crustHeatDelta + dynamicField.crackHeat;

  const primaryX = worldX - flow.offsetX
    - dynamicField.offsetX * localAdvectionScale + warpX * 0.24;
  const primaryY = worldY - flow.offsetY
    - dynamicField.offsetY * localAdvectionScale + warpY * 0.16;
  const secondaryX = worldX - flow.secondaryOffsetX
    - dynamicField.offsetX * 0.46 * localAdvectionScale - warpY * 0.12;
  const secondaryY = worldY - flow.secondaryOffsetY
    - dynamicField.offsetY * 0.46 * localAdvectionScale + warpX * 0.1;
  const flowScale = config.flowScale || MAGMA_VISUAL_CONFIG.flowScale;
  const primaryFlow = fractalNoise(
    primaryX * flowScale,
    primaryY * flowScale * 1.28,
    region.seed + 251,
    2,
  );
  const secondaryFlow = fractalNoise(
    secondaryX * flowScale * 0.72,
    secondaryY * flowScale * 1.66,
    region.seed + 293,
    2,
  );
  const directionLength = Math.max(0.0001, Math.hypot(flow.directionX, flow.directionY));
  const directionX = flow.directionX / directionLength;
  const directionY = flow.directionY / directionLength;
  const along = primaryX * directionX + primaryY * directionY;
  const across = -primaryX * directionY + primaryY * directionX;
  const filamentNoise = fractalNoise(along * 0.011, across * 0.068, region.seed + 337, 2);
  const flowStreak = smoothstep(0.42, 0.78, filamentNoise);
  const liquidFlow = primaryFlow * 0.58 + secondaryFlow * 0.29 + flowStreak * 0.13;
  const liquidMask = smoothstep(0.33, 0.57, baseHeat);
  baseHeat += (
    (primaryFlow - 0.5) * 0.12
    + (secondaryFlow - 0.5) * 0.075
    + (flowStreak - 0.5) * 0.09
  ) * liquidMask;

  const channel = sampleChannels(channels, localX, localY, region.bounds.width, flow, time);
  const riverInfluence = smoothstep(0.46, 0.84, channel.river);
  const riverHeat = 0.44
    + channel.river * (0.17 + liquidFlow * 0.12)
    + channel.longitudinal * 0.038
    + flowStreak * 0.045
    + (liquidFlow - 0.5) * 0.06;
  let heat = Math.max(baseHeat, riverHeat * riverInfluence + baseHeat * (1 - riverInfluence));
  heat += channel.hotspot * 0.22 * thermal.hotAlpha
    + dynamicField.hotspotHeat * thermal.hotAlpha;
  heat = clamp01(heat);

  return {
    heat,
    crust: 1 - smoothstep(0.35, 0.48, heat),
    river: channel.river,
    hotspot: Math.max(channel.hotspot, smoothstep(config.hotspotThreshold || 0.91, 0.995, heat)),
    grain: anchoredFine * 0.55 + primaryFlow * 0.3 + flowStreak * 0.15,
    flowStreak,
  };
}

export function calibrateMagmaCrustThreshold(region, channels, config = MAGMA_VISUAL_CONFIG) {
  const targetCoverage = config.crustCoverage ?? MAGMA_VISUAL_CONFIG.crustCoverage;
  const cellWidth = region.cellWidth || 100;
  const cellHeight = region.cellHeight || 100;
  const flowFrame = getMagmaFlowFrame({
    region,
    visualConfig: config,
    thermalState: "stable",
    time: 0,
  });
  let low = 0.42;
  let high = 0.68;
  for (let pass = 0; pass < 8; pass += 1) {
    const threshold = (low + high) / 2;
    const calibrated = { ...config, calibratedCrustThreshold: threshold };
    let crust = 0;
    let samples = 0;
    for (const [row, col] of region.cells) {
      for (let sampleY = 0; sampleY < 6; sampleY += 1) {
        const worldY = row * cellHeight + (sampleY + 0.5) * cellHeight / 6;
        for (let sampleX = 0; sampleX < 6; sampleX += 1) {
          const worldX = col * cellWidth + (sampleX + 0.5) * cellWidth / 6;
          const field = sampleMagmaField({
            worldX,
            worldY,
            localX: worldX - region.bounds.x,
            localY: worldY - region.bounds.y,
            region,
            channels,
            time: 0,
            config: calibrated,
            thermalState: "stable",
            flowFrame,
          });
          samples += 1;
          if (field.heat < 0.38) crust += 1;
        }
      }
    }
    const coverage = crust / Math.max(1, samples);
    if (coverage > targetCoverage) high = threshold;
    else low = threshold;
  }
  return (low + high) / 2;
}

export function getMagmaColor(heat, brightness = 1, grain = 0.5) {
  let left = MAGMA_COLOR_STOPS[0];
  let right = MAGMA_COLOR_STOPS[MAGMA_COLOR_STOPS.length - 1];
  for (let index = 1; index < MAGMA_COLOR_STOPS.length; index += 1) {
    if (heat <= MAGMA_COLOR_STOPS[index].at) {
      left = MAGMA_COLOR_STOPS[index - 1];
      right = MAGMA_COLOR_STOPS[index];
      break;
    }
  }
  const amount = smoothstep(left.at, right.at, heat);
  const liquidBrightness = lerp(0.82 + (grain - 0.5) * 0.08, brightness, smoothstep(0.38, 0.82, heat));
  return left.color.map((value, index) => Math.round(
    Math.max(0, Math.min(255, lerp(value, right.color[index], amount) * liquidBrightness)),
  ));
}

export function createSurfaceCanvas(width, height, canvasFactory) {
  const canvas = canvasFactory
    ? canvasFactory(width, height)
    : typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : globalThis.document?.createElement?.("canvas");
  if (!canvas) return null;
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createMagmaSurfaceFrame(region, resolutionScale, canvasFactory) {
  const width = Math.max(1, Math.ceil(region.bounds.width * resolutionScale));
  const height = Math.max(1, Math.ceil(region.bounds.height * resolutionScale));
  return {
    width,
    height,
    surfaceCanvas: createSurfaceCanvas(width, height, canvasFactory),
    hotCanvas: createSurfaceCanvas(width, height, canvasFactory),
    crustCanvas: createSurfaceCanvas(width, height, canvasFactory),
    heatCanvas: createSurfaceCanvas(width, height, canvasFactory),
    generatedAt: -Infinity,
  };
}

function writePixel(data, offset, red, green, blue, alpha = 255) {
  data[offset] = red;
  data[offset + 1] = green;
  data[offset + 2] = blue;
  data[offset + 3] = alpha;
}

function buildDynamicGrid(frame, region, dynamic, time) {
  if (!dynamic) return null;
  const step = 4;
  const width = Math.ceil((frame.width - 1) / step) + 1;
  const height = Math.ceil((frame.height - 1) / step) + 1;
  const values = new Float32Array(width * height * 5);
  const scaleX = region.bounds.width / frame.width;
  const scaleY = region.bounds.height / frame.height;
  for (let gridY = 0; gridY < height; gridY += 1) {
    const py = Math.min(frame.height - 1, gridY * step);
    const worldY = region.bounds.y + (py + 0.5) * scaleY;
    for (let gridX = 0; gridX < width; gridX += 1) {
      const px = Math.min(frame.width - 1, gridX * step);
      const worldX = region.bounds.x + (px + 0.5) * scaleX;
      const sample = sampleMagmaDynamicField(worldX, worldY, dynamic, time * 1000);
      const offset = (gridY * width + gridX) * 5;
      values[offset] = sample.offsetX;
      values[offset + 1] = sample.offsetY;
      values[offset + 2] = sample.crustHeatDelta;
      values[offset + 3] = sample.crackHeat;
      values[offset + 4] = sample.hotspotHeat;
    }
  }
  return { step, width, height, values };
}

function sampleDynamicGrid(grid, px, py) {
  if (!grid) return null;
  const rawX = px / grid.step;
  const rawY = py / grid.step;
  const x0 = Math.min(grid.width - 1, Math.floor(rawX));
  const y0 = Math.min(grid.height - 1, Math.floor(rawY));
  const x1 = Math.min(grid.width - 1, x0 + 1);
  const y1 = Math.min(grid.height - 1, y0 + 1);
  const tx = rawX - x0;
  const ty = rawY - y0;
  const interpolate = (component) => {
    const top = lerp(
      grid.values[(y0 * grid.width + x0) * 5 + component],
      grid.values[(y0 * grid.width + x1) * 5 + component],
      tx,
    );
    const bottom = lerp(
      grid.values[(y1 * grid.width + x0) * 5 + component],
      grid.values[(y1 * grid.width + x1) * 5 + component],
      tx,
    );
    return lerp(top, bottom, ty);
  };
  return {
    offsetX: interpolate(0),
    offsetY: interpolate(1),
    crustHeatDelta: interpolate(2),
    crackHeat: interpolate(3),
    hotspotHeat: interpolate(4),
  };
}

export function renderMagmaSurfaceFrame(frame, {
  region,
  channels,
  time = 0,
  config = MAGMA_VISUAL_CONFIG,
  thermalState = "stable",
  flowFrame,
  dynamic,
} = {}) {
  if (!frame?.surfaceCanvas) return frame;
  const surfaceContext = frame.surfaceCanvas.getContext("2d");
  const hotContext = frame.hotCanvas?.getContext("2d");
  const crustContext = frame.crustCanvas?.getContext("2d");
  const heatContext = frame.heatCanvas?.getContext("2d");
  if (!surfaceContext?.createImageData || !surfaceContext?.putImageData) return frame;
  const surfaceImage = surfaceContext.createImageData(frame.width, frame.height);
  const hotImage = hotContext?.createImageData(frame.width, frame.height);
  const crustImage = crustContext?.createImageData(frame.width, frame.height);
  const heatImage = heatContext?.createImageData(frame.width, frame.height);
  const thermal = getMagmaThermalVisual(thermalState);
  const resolvedFlowFrame = flowFrame || getMagmaFlowFrame({
    region,
    visualConfig: config,
    thermalState,
    time: time * 1000,
  });
  const scaleX = region.bounds.width / frame.width;
  const scaleY = region.bounds.height / frame.height;
  const dynamicGrid = buildDynamicGrid(frame, region, dynamic, time);

  for (let py = 0; py < frame.height; py += 1) {
    const localY = (py + 0.5) * scaleY;
    const worldY = region.bounds.y + localY;
    for (let px = 0; px < frame.width; px += 1) {
      const localX = (px + 0.5) * scaleX;
      const worldX = region.bounds.x + localX;
      const sample = sampleMagmaField({
        worldX, worldY, localX, localY, region, channels, time, config, thermalState,
        flowFrame: resolvedFlowFrame,
        dynamic,
        dynamicSample: sampleDynamicGrid(dynamicGrid, px, py),
      });
      const offset = (py * frame.width + px) * 4;
      const [red, green, blue] = getMagmaColor(sample.heat, thermal.brightness, sample.grain);
      writePixel(surfaceImage.data, offset, red, green, blue);
      if (hotImage) {
        const glow = Math.max(
          smoothstep(0.58, 0.98, sample.heat),
          sample.flowStreak * sample.river * 0.72,
        ) * thermal.hotAlpha;
        writePixel(hotImage.data, offset, 255, 126 + Math.round(sample.heat * 112), 22, Math.round(glow * 185));
      }
      if (crustImage) {
        const ridge = sample.crust * (0.68 + sample.grain * 0.32);
        writePixel(crustImage.data, offset, 17, 7, 6, Math.round(ridge * 105));
      }
      if (heatImage) {
        const heat = sample.heat;
        const heatColor = heat < 0.38
          ? [Math.round(heat * 80), 0, 0]
          : heat < 0.75
            ? [220, Math.round((heat - 0.38) / 0.37 * 185), 0]
            : [255, 210 + Math.round((heat - 0.75) * 180), Math.round((heat - 0.75) * 520)];
        writePixel(heatImage.data, offset, ...heatColor);
      }
    }
  }

  surfaceContext.putImageData(surfaceImage, 0, 0);
  if (hotImage) hotContext.putImageData(hotImage, 0, 0);
  if (crustImage) crustContext.putImageData(crustImage, 0, 0);
  if (heatImage) heatContext.putImageData(heatImage, 0, 0);
  frame.generatedAt = time;
  frame.flowFrame = resolvedFlowFrame;
  return frame;
}
