/**
 * Owns the ordered canvas-layer pipeline. Concrete visual renderers are
 * injected by BattleScreen so this module remains a rendering composition
 * boundary, not a second source of gameplay or environment rules.
 */
export function drawBattleLayers({
  layers, layerConfig, session, assets, particlesRef, runtime, selectedTroop,
  removeMode, hoveredCell, settings, adaptive, now, animationElapsed,
  interpolation, rowBuffers, field, viewport, renderPlan, renderers,
}) {
  const { contexts, scales } = layerConfig;
  const {
    clearRenderLayer, drawContainmentUnderlay, drawArenaBackground, drawArenaUnderlay,
    drawIncubatorFissureUnderlay, getPlacementPreviewGeometry, drawTacticalGrid,
    drawPlacementRange, isSystemEnabledForPhase, drawTideUnderlay,
    drawIncubatorFissureEffects, drawIncubatorTargetTelegraph, drawDecals,
    drawPulseScorches, drawDematerializationPulses, drawMines,
    drawProjectileCollection, drawSporeFruits, drawSporeClouds,
    drawNaniteHealingBeams, drawForestObstacles, drawBattleRows, drawConvoy,
    drawAttachedConvoyEnemies, drawThermalPlatformHeatBars,
    drawTroopPlacementPreview, drawDeathVisuals, drawTideOverlay, drawWindEffects,
    drawConvoyImpacts, drawAdaptiveAid, drawTreeBroodBursts,
    drawPulseDisintegrations, drawDeploymentEffects, drawTartaragarraEffects,
    drawDynamicLights, drawArenaForeground, drawPulseBeams, drawEnergyPickups,
    drawParticles, drawPostProcessing, drawContainmentForeground, drawEmissiveBattle,
  } = renderers;
  const arenaCtx = contexts.arenaLayer;
  const effectCtx = contexts.effectLayer;
  const entityCtx = contexts.entityLayer;
  const overlayCtx = contexts.overlayEffectLayer;
  const emissiveCtx = contexts.emissiveLayer;
  const timings = { arenaMs: 0, effectMs: 0, entityMs: 0, emissiveMs: 0 };
  // Keep phase systems on the graphics runtime: it is visual-only and allows
  // environment renderers to opt into a precomputed plan without touching gameplay.
  runtime.renderPlan = renderPlan;
  const dematerializationEnabled = isSystemEnabledForPhase(session.phase, "dematerializationPulse");

  let started = performance.now();
  clearRenderLayer(arenaCtx, layers.arenaLayer, scales.arenaLayer);
  drawContainmentUnderlay(arenaCtx, session.phase, session, runtime, now, settings);
  arenaCtx.save();
  arenaCtx.translate(0, viewport.fieldOffsetY);
  drawArenaBackground(arenaCtx, session.phase, settings);
  drawArenaUnderlay(arenaCtx, session.phase, settings, session, now, adaptive, runtime);
  drawIncubatorFissureUnderlay(arenaCtx, session);
  const placementPreview = getPlacementPreviewGeometry(session, selectedTroop, hoveredCell, removeMode);
  drawTacticalGrid(arenaCtx, session, selectedTroop, removeMode, hoveredCell);
  drawPlacementRange(arenaCtx, placementPreview);
  const baseGradient = arenaCtx.createLinearGradient(0, 0, 48, 0);
  baseGradient.addColorStop(0, `${session.phase.palette.primary}55`);
  baseGradient.addColorStop(1, "transparent");
  arenaCtx.fillStyle = baseGradient;
  arenaCtx.fillRect(0, 0, field.baseX + 40, field.height);
  arenaCtx.restore();
  timings.arenaMs = performance.now() - started;

  started = performance.now();
  clearRenderLayer(effectCtx, layers.effectLayer, scales.effectLayer);
  effectCtx.save(); effectCtx.translate(0, viewport.fieldOffsetY);
  drawTideUnderlay(effectCtx, session, now, settings, adaptive);
  drawIncubatorFissureEffects(effectCtx, session, now, settings);
  drawIncubatorTargetTelegraph(effectCtx, session, now, settings);
  drawDecals(effectCtx, runtime, settings);
  if (dematerializationEnabled) drawPulseScorches(effectCtx, runtime, now, settings);
  if (dematerializationEnabled) drawDematerializationPulses(effectCtx, session.dematerializationPulses, assets.defenses?.pulsoDesmaterializacao, session.elapsed, settings);
  const mineAssets = assets.troops.demolidora || {};
  drawMines(effectCtx, session.mines, mineAssets.mine?.[0], session.elapsed);
  if (!runtime.projectileAssets || runtime.projectileAssets.mineSource !== mineAssets || runtime.projectileAssets.executorSource !== assets.effects?.executorArcSlash || runtime.projectileAssets.dardifagoSource !== assets.effects?.dardifagoDart) {
    runtime.projectileAssets = { ...mineAssets, executorArcSlash: assets.effects?.executorArcSlash, mineSource: mineAssets, executorSource: assets.effects?.executorArcSlash, dardifagoDart: assets.effects?.dardifagoDart, dardifagoSource: assets.effects?.dardifagoDart };
  }
  drawProjectileCollection(effectCtx, session.projectiles, interpolation, settings, runtime.projectileAssets);
  drawProjectileCollection(effectCtx, session.enemyProjectiles, interpolation, settings, runtime.projectileAssets);
  drawSporeFruits(effectCtx, session.sporeFruits, session.elapsed, assets.effects?.sporeFruit, settings);
  drawSporeClouds(effectCtx, session.sporeClouds, session.elapsed, settings);
  drawNaniteHealingBeams(effectCtx, session, settings);
  effectCtx.restore();
  const backEffectMs = performance.now() - started;

  started = performance.now();
  clearRenderLayer(entityCtx, layers.entityLayer, scales.entityLayer);
  entityCtx.save(); entityCtx.translate(0, viewport.fieldOffsetY);
  drawForestObstacles(entityCtx, session, session.elapsed, settings, assets);
  drawBattleRows(entityCtx, session, assets, runtime, settings, adaptive, now, animationElapsed, interpolation, rowBuffers);
  drawConvoy(entityCtx, session, performance.now(), { ...settings, paused: Boolean(session.renderPaused) });
  drawAttachedConvoyEnemies(entityCtx, session, assets, runtime, settings, adaptive, now, interpolation, rowBuffers, renderers.drawEnemyEntity);
  drawThermalPlatformHeatBars(entityCtx, session);
  drawTroopPlacementPreview(entityCtx, assets, selectedTroop, placementPreview, now, settings);
  drawDeathVisuals(entityCtx, runtime, assets, now, session.phase);
  entityCtx.restore();
  timings.entityMs = performance.now() - started;

  clearRenderLayer(overlayCtx, layers.overlayEffectLayer, scales.overlayEffectLayer);
  overlayCtx.save(); overlayCtx.translate(0, viewport.fieldOffsetY);
  drawTideOverlay(overlayCtx, session, now, settings, adaptive, hoveredCell);
  drawWindEffects(overlayCtx, runtime, now, settings, assets.effects?.windCurrent);
  drawConvoyImpacts(overlayCtx, runtime.convoyImpacts, now, settings);
  drawAdaptiveAid(overlayCtx, session, assets, session.elapsed, settings);
  drawTreeBroodBursts(overlayCtx, runtime, assets, now, settings);
  if (dematerializationEnabled) drawPulseDisintegrations(overlayCtx, runtime, assets, now, settings);
  drawDeploymentEffects(overlayCtx, runtime, now, settings);
  drawTartaragarraEffects(overlayCtx, session, session.elapsed, settings);
  drawDynamicLights(overlayCtx, runtime, now, settings, adaptive);
  drawArenaForeground(overlayCtx, session.phase, settings, session, now, adaptive, runtime);
  if (dematerializationEnabled) drawPulseBeams(overlayCtx, runtime, now, settings);
  drawEnergyPickups(overlayCtx, session.energyPickups, session.elapsed, settings);
  particlesRef.current = drawParticles(overlayCtx, particlesRef.current, now, settings);
  drawPostProcessing(overlayCtx, session.phase, settings, session, now);
  overlayCtx.restore();
  drawContainmentForeground(overlayCtx, session.phase, session, runtime, now, settings);
  timings.effectMs = backEffectMs + performance.now() - started;

  started = performance.now();
  clearRenderLayer(emissiveCtx, layers.emissiveLayer, scales.emissiveLayer);
  if (settings.quality === "high" && adaptive.bloom !== false) drawEmissiveBattle(emissiveCtx, session, assets, particlesRef.current, runtime, settings, adaptive, now, interpolation, runtime.projectileAssets, drawTreeBroodBursts, drawEnergyPickups);
  timings.emissiveMs = performance.now() - started;
  return timings;
}
