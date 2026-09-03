import { FIELD, VIEWPORT } from "../battleModel.js";
import { getAdaptiveEffects, getCameraOffset, updateGraphicsRuntime } from "../graphicsRuntime.js";
import { presentScene } from "../graphicsRenderer.js";
import { advanceTroopAnimationClock } from "../troopAnimationClock.js";
import { getCinematicWaveOutroCameraTransform } from "../waveOutro/waveOutroCamera.js";
import { drawBattleLayers } from "./battleLayerRenderer.js";
import { BATTLE_LAYER_RENDERERS } from "./battleLayerRenderers.js";

/** Draws one frame from the already-mutated battle session. */
export function renderBattleFrame({
  adaptiveSettings,
  animationClock,
  assets,
  ctx,
  frameDelta,
  hoveredCell,
  interpolation,
  lastDrawMs,
  lastLayerTimings,
  lastPresentMs,
  layerConfig,
  layers,
  now,
  particlesRef,
  removeMode,
  renderPlan,
  renderScale,
  rowBuffers,
  runtime,
  selectedTroop,
  session,
  settings,
  stepMs,
}) {
  const activeEntities = session.troops.length + session.enemies.length
    + session.projectiles.length + session.enemyProjectiles.length;
  updateGraphicsRuntime(runtime, session.elapsed, frameDelta, {
    clockNow: now,
    stepMs,
    drawMs: lastDrawMs,
    presentMs: lastPresentMs,
    ...lastLayerTimings,
    activeEntities,
    particles: particlesRef.current.length,
  });
  const adaptive = getAdaptiveEffects(settings, runtime.adaptive.level, runtime.metrics.frameMs);
  Object.assign(adaptiveSettings, settings, { adaptiveLevel: adaptive.level });
  const animationElapsed = advanceTroopAnimationClock(animationClock, session, now);
  const drawStarted = performance.now();
  const layerTimings = drawBattleLayers({
    layers,
    layerConfig,
    session,
    assets,
    particlesRef,
    runtime,
    selectedTroop,
    removeMode,
    hoveredCell,
    settings: adaptiveSettings,
    adaptive,
    now: session.elapsed,
    animationElapsed,
    interpolation,
    rowBuffers,
    field: FIELD,
    viewport: VIEWPORT,
    renderPlan,
    renderers: BATTLE_LAYER_RENDERERS,
  });
  const drawMs = performance.now() - drawStarted;
  const presentStarted = performance.now();
  const camera = getCameraOffset(runtime, session.elapsed, adaptiveSettings);
  const outroCamera = getCinematicWaveOutroCameraTransform(session, settings.reduceMotion);
  const presentationCamera = outroCamera ? {
    ...camera,
    ...outroCamera,
    x: camera.x + outroCamera.impactX,
    y: camera.y + outroCamera.impactY,
  } : camera;
  presentScene(ctx, layers, null, renderScale, presentationCamera, adaptiveSettings, adaptive);
  return { adaptive, drawMs, layerTimings, presentMs: performance.now() - presentStarted };
}
