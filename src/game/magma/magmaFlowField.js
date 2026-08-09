import { getMagmaThermalVisual } from "./magmaVisualConfig.js";

export function getMagmaFlowFrame({
  region,
  visualConfig = {},
  thermalState = "stable",
  time = 0,
  reduceMotion = false,
  travel,
} = {}) {
  const thermal = getMagmaThermalVisual(thermalState);
  const motionFactor = reduceMotion ? 0.12 : 1;
  const seconds = time / 1000;
  const direction = visualConfig.flow || { x: -1, y: 0.025 };
  const flowMultiplier = Number.isFinite(visualConfig.flowMultiplier)
    ? Math.max(0, visualConfig.flowMultiplier)
    : 1;
  const baseSpeed = Number.isFinite(visualConfig.speed) ? Math.max(0, visualConfig.speed) : 26;
  const speed = baseSpeed * thermal.flowSpeed * motionFactor * flowMultiplier;
  const internalTravel = Number.isFinite(travel) ? Math.max(0, travel) : seconds * speed;
  const normalizedSeconds = internalTravel / Math.max(1, baseSpeed);

  return {
    // Compatibility fields now describe internal channel motion. Renderers must not
    // translate the whole surface with these values.
    offsetX: direction.x * internalTravel,
    offsetY: direction.y * internalTravel,
    secondaryOffsetX: direction.x * internalTravel * 0.47,
    secondaryOffsetY: direction.y * internalTravel * 0.47
      + Math.sin(normalizedSeconds * 0.7 + (region?.seed || 0)) * 8,
    crustOffsetX: direction.x * internalTravel * 0.025,
    crustOffsetY: direction.y * internalTravel * 0.025,
    flowTime: normalizedSeconds * (visualConfig.flowSpeed || 0.018),
    turbulenceTime: normalizedSeconds * 0.035,
    anchorDrift: Math.sin(normalizedSeconds * 0.65 + (region?.seed || 0)) * 1.5,
    directionX: direction.x,
    directionY: direction.y,
    primaryTravel: internalTravel,
    speed,
    brightness: thermal.brightness,
    liquidBias: thermal.liquidBias,
    hotAlpha: thermal.hotAlpha,
    turbulence: visualConfig.turbulence ?? 0.16,
  };
}
