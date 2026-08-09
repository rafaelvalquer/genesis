const freeze = (value) => Object.freeze(value);

export const MAGMA_VISUAL_CONFIG = freeze({
  surfaceFps: 15,
  crustCoverage: 0.48,
  largeCrustScale: 0.018,
  mediumCrustScale: 0.037,
  detailScale: 0.086,
  flowScale: 0.024,
  flowSpeed: 0.018,
  warpScale: 0.011,
  warpStrength: 32,
  majorChannelCount: 4,
  hotspotThreshold: 0.91,
  particlePoolSize: 80,
  ventCount: freeze({ stable: 2, active: 4, eruption: 7, cooldown: 1 }),
  activeParticles: freeze({ stable: 10, active: 22, eruption: 54, cooldown: 6 }),
  smokeCount: freeze({ stable: 5, active: 7, eruption: 10, cooldown: 3 }),
  maxParticles: freeze({ high: 60, medium: 32, low: 14 }),
});

export const MAGMA_THERMAL_VISUALS = freeze({
  stable: freeze({
    flowSpeed: 0.72, brightness: 0.78, liquidBias: -0.025, hotAlpha: 0.52,
    bubbleFactor: 0.3, emberFactor: 0.2, splashFactor: 0.08, smokeFactor: 0.42,
  }),
  active: freeze({
    flowSpeed: 1, brightness: 0.92, liquidBias: 0.015, hotAlpha: 0.7,
    bubbleFactor: 0.65, emberFactor: 0.55, splashFactor: 0.34, smokeFactor: 0.7,
  }),
  eruption: freeze({
    flowSpeed: 1.35, brightness: 1.08, liquidBias: 0.065, hotAlpha: 0.9,
    bubbleFactor: 1, emberFactor: 1, splashFactor: 1, smokeFactor: 1,
  }),
  cooldown: freeze({
    flowSpeed: 0.5, brightness: 0.62, liquidBias: -0.07, hotAlpha: 0.32,
    bubbleFactor: 0.15, emberFactor: 0.08, splashFactor: 0.03, smokeFactor: 0.28,
  }),
});

export const MAGMA_QUALITY_PROFILES = freeze({
  high: freeze({ resolutionScale: 0.65, surfaceFps: 15, shimmer: true, channelSamples: 42, smokeScale: 1 }),
  medium: freeze({ resolutionScale: 0.5, surfaceFps: 12, shimmer: false, channelSamples: 30, smokeScale: 0.72 }),
  low: freeze({ resolutionScale: 0.35, surfaceFps: 8, shimmer: false, channelSamples: 20, smokeScale: 0.4 }),
});

export const MAGMA_COLOR_STOPS = freeze([
  freeze({ at: 0, color: freeze([10, 4, 4]) }),
  freeze({ at: 0.2, color: freeze([19, 7, 6]) }),
  freeze({ at: 0.38, color: freeze([33, 13, 9]) }),
  freeze({ at: 0.46, color: freeze([76, 18, 7]) }),
  freeze({ at: 0.52, color: freeze([126, 27, 7]) }),
  freeze({ at: 0.7, color: freeze([218, 56, 9]) }),
  freeze({ at: 0.87, color: freeze([255, 126, 18]) }),
  freeze({ at: 0.96, color: freeze([255, 205, 69]) }),
  freeze({ at: 1, color: freeze([255, 242, 172]) }),
]);

export const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function getMagmaThermalVisual(state = "stable") {
  return MAGMA_THERMAL_VISUALS[state] || MAGMA_THERMAL_VISUALS.stable;
}

export function getMagmaQualityProfile(settings = {}, adaptive = {}) {
  const quality = MAGMA_QUALITY_PROFILES[settings.quality] ? settings.quality : "high";
  const base = MAGMA_QUALITY_PROFILES[quality];
  const adaptiveScale = adaptive.level === "stress" ? 0.72 : adaptive.level === "busy" ? 0.88 : 1;
  const fpsCap = adaptive.level === "stress" ? 8 : adaptive.level === "busy" ? 12 : base.surfaceFps;
  return {
    ...base,
    quality,
    resolutionScale: base.resolutionScale * adaptiveScale,
    surfaceFps: Math.min(base.surfaceFps, fpsCap),
    shimmer: base.shimmer && adaptive.level !== "stress" && settings.reduceMotion !== true,
    particleScale: (adaptive.particleBudgetScale ?? 1) * (settings.reduceMotion ? 0.42 : 1),
    smokeScale: base.smokeScale * (adaptive.heavyAtmosphere === false ? 0 : 1),
  };
}

export function resolveMagmaVisualOptions(session, settings = {}, adaptive = {}) {
  const sandbox = session?.sandboxSettings || {};
  const phaseVisual = session?.phase?.magmaTerrain?.visual || {};
  const thermalState = sandbox.magmaThermalState && sandbox.magmaThermalState !== "auto"
    ? sandbox.magmaThermalState
    : session?.thermalCycle?.state || "stable";
  const quality = getMagmaQualityProfile(settings, adaptive);
  return {
    ...MAGMA_VISUAL_CONFIG,
    ...phaseVisual,
    thermalState,
    quality,
    crustCoverage: Number.isFinite(sandbox.magmaCrustCoverage)
      ? sandbox.magmaCrustCoverage
      : phaseVisual.crustDensity ?? MAGMA_VISUAL_CONFIG.crustCoverage,
    flowMultiplier: Number.isFinite(sandbox.magmaFlowMultiplier) ? sandbox.magmaFlowMultiplier : 1,
    warpMultiplier: Number.isFinite(sandbox.magmaWarpMultiplier) ? sandbox.magmaWarpMultiplier : 1,
    ventLimit: Number.isFinite(sandbox.magmaVentLimit) ? sandbox.magmaVentLimit : 10,
    particleLimit: Number.isFinite(sandbox.magmaParticleLimit) ? sandbox.magmaParticleLimit : 80,
    reduceMotion: Boolean(settings.reduceMotion),
    paused: Boolean(sandbox.magmaPaused),
    showHeatmap: Boolean(sandbox.magmaShowHeatmap),
    showRegionMask: Boolean(sandbox.magmaShowRegionMask),
  };
}
