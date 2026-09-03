import {
  drawArenaBackground, drawArenaForeground, drawArenaUnderlay, drawPlacementRange,
  drawTacticalGrid, getPlacementPreviewGeometry,
} from "../arenaRenderer.js";
import { drawMines, drawParticles, drawProjectileCollection } from "../projectileRenderer.js";
import { drawDematerializationPulses, drawPulseBeams, drawPulseDisintegrations, drawPulseScorches } from "../pulseRenderer.js";
import { FIELD } from "../battleModel.js";
import { clearRenderLayer } from "../graphicsRuntime.js";
import { drawDecals, drawDeploymentEffects, drawDynamicLights, drawPostProcessing } from "../graphicsRenderer.js";
import { drawForestObstacles } from "../chapter07/forestObstacleRenderer.js";
import { drawSporeClouds, drawSporeFruits } from "../chapter07/sporeFruitRenderer.js";
import { drawTartaragarraEffects } from "../chapter07/tartaragarraRenderer.js";
import { drawContainmentForeground, drawContainmentUnderlay } from "../containmentRenderer.js";
import { drawThermalPlatformHeatBars } from "../thermalPlatformRenderer.js";
import { drawIncubatorFissureEffects, drawIncubatorFissureUnderlay, drawIncubatorTargetTelegraph } from "../incubatorFissureRenderer.js";
import { drawAdaptiveAid } from "../adaptiveAidRenderer.js";
import { drawWindEffects } from "../windCurrentRenderer.js";
import { drawTideOverlay, drawTideUnderlay } from "../tideRenderer.js";
import { isSystemEnabledForPhase } from "../phaseRules.js";
import { drawConvoy } from "../chapter07/convoyRenderer.js";
import { drawConvoyImpacts } from "../chapter07/convoyImpactRenderer.js";
import { drawAttachedConvoyEnemies, drawBattleRows, drawNaniteHealingBeams, drawTroopPlacementPreview } from "./entityRenderer.js";
import { drawDeathVisuals, drawEmissiveBattle, drawEnergyPickups, drawTreeBroodBursts } from "./battleVfxRenderer.js";
import { registerEnvironmentRenderer } from "./environmentRenderer.js";

registerEnvironmentRenderer("forest", ({ stage, ctx, session, settings, assets }) => {
  if (stage === "entitiesBefore") drawForestObstacles(ctx, session, session.elapsed, settings, assets);
}, { replace: true });
registerEnvironmentRenderer("spores", ({ stage, ctx, session, settings, assets }) => {
  if (stage !== "effects") return;
  drawSporeFruits(ctx, session.sporeFruits, session.elapsed, assets.effects?.sporeFruit, settings);
  drawSporeClouds(ctx, session.sporeClouds, session.elapsed, settings);
}, { replace: true });
registerEnvironmentRenderer("convoy", ({ stage, ctx, session, settings }) => {
  if (stage === "entitiesAfter") drawConvoy(ctx, session, performance.now(), { ...settings, paused: Boolean(session.renderPaused) });
}, { replace: true });

/**
 * Concrete visual services consumed by battleLayerRenderer. Keeping this
 * assembly in render/ prevents the React screen from becoming a registry of
 * environment and entity implementations.
 */
export const BATTLE_LAYER_RENDERERS = Object.freeze({
  clearRenderLayer, drawContainmentUnderlay, drawArenaBackground, drawArenaUnderlay,
  drawIncubatorFissureUnderlay, getPlacementPreviewGeometry, drawTacticalGrid,
  drawPlacementRange, isSystemEnabledForPhase, drawTideUnderlay,
  drawIncubatorFissureEffects, drawIncubatorTargetTelegraph, drawDecals,
  drawPulseScorches, drawDematerializationPulses, drawMines,
  drawProjectileCollection,
  drawNaniteHealingBeams,
  drawBattleRows: (ctx, session, assets, runtime, settings, adaptive, now, animationElapsed, interpolation, buffers) => drawBattleRows({
    ctx, session, assets, runtime, settings, adaptive, now, animationElapsed, interpolation, buffers,
    field: FIELD,
  }),
  drawAttachedConvoyEnemies, drawThermalPlatformHeatBars,
  drawTroopPlacementPreview, drawDeathVisuals, drawTideOverlay, drawWindEffects,
  drawConvoyImpacts, drawAdaptiveAid, drawTreeBroodBursts,
  drawPulseDisintegrations, drawDeploymentEffects, drawTartaragarraEffects,
  drawDynamicLights, drawArenaForeground, drawPulseBeams, drawEnergyPickups,
  drawParticles, drawPostProcessing, drawContainmentForeground, drawEmissiveBattle,
});
