import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { DECISION_STAGE_RULES,
  ENEMIES,
  TROOPS } from "./content.js";
import { getArenaUrl } from "./assets/arenaCatalog.js";
import { getTroopPreviewUrl } from "./assets/troopPreviewCatalog.js";
import { resolveTroopFrame } from "./assets/battleAssetLoader.js";
import { getDeployCooldownProgress } from "./cooldownVisual.js";
import { waveSpawnCount } from "./domain.js";
import {
  drawArenaBackground,
  drawArenaForeground,
  drawArenaUnderlay,
  drawContactShadow,
  drawPlacementRange,
  drawTacticalGrid,
  getPlacementPreviewGeometry,
  } from "./arenaRenderer.js";
import { drawFrozenEnemyEffect,
  drawMines,
  drawParticles,
  drawProjectileCollection,
  drawStunnedEnemyEffect,
  pushEventParticles } from "./projectileRenderer.js";
import {
  drawDematerializationPulses,
  drawPulseBeams,
  drawPulseDisintegrations,
  drawPulseScorches,
  } from "./pulseRenderer.js";
import {
  getAnchoredSpriteRect,
  getEnemyAnimation,
  getEnemySpriteRect,
  getJanoDroneAnimation,
  getMuzzleWorldPosition,
  getTroopAnimation,
  getTroopAttackVisual,
  getTroopFrameAnchor,
  buildBattleRenderRows,
  createBattleRowBuffers,
  getDroneSentinelaLayout,
  isEnemyFrozen,
  writeEnemyVisualPosition,
} from "./visualGeometry.js";
import {
  clearRenderLayer, configureHiDPICanvas, configureRenderLayers, consumeGraphicsEvents,
  createGraphicsRuntime, createRenderLayers, getCameraOffset,
  getAdaptiveEffects, getHitReaction, updateGraphicsRuntime,
} from "./graphicsRuntime.js";
import {
  drawCachedSpriteHalo, drawDecals, drawDeploymentEffects, drawDynamicLights, drawPostProcessing,
  drawWetReflections, getSpriteFilter, getTroopSpriteFilter, presentScene,
} from "./graphicsRenderer.js";
import { getColossoAnimation } from "./colossoCaldeira.js";
import { drawColossoBossHealth, drawColossoCaldeira } from "./colossoCaldeiraRenderer.js";
import { drawForestObstacles } from "./chapter07/forestObstacleRenderer.js";
import {
  drawSporeClouds,
  drawSporeFruits,
} from "./chapter07/sporeFruitRenderer.js";
import { drawTartaragarraEffects } from "./chapter07/tartaragarraRenderer.js";
import { drawThermalBurnBackLayer, drawThermalBurnFrontLayer, getTroopThermalVisualState } from "./thermalBurningTroopRenderer.js";
import {
  CELL, FIELD, VIEWPORT,
  adaptiveAidBlocksIntermission,
  adaptiveAidCinematicFactor,
  adaptiveAidPausesSimulation,
  accelerateWaveOutro,
  advanceWaveOutro,
  activateDematerializationPulse,
  cellFromPoint,
  clearSandboxEntities,
  createBattleSession,
  getEligibleAdaptiveAidOptions,
  getSnapshot,
  getWaveOutroCinematicFactor,
  getTroopRangePenaltyTiles,
  forceExecutorCombo,
  forceLeviathanAttack,
  debugLeviathan,
  forceColossoAttack,
  debugColosso,
  createPositionalConfirmationEvent,
  getPositionalTargetPreview,
  injureSandboxTroops,
  isCapsuleClickable,
  openAdaptiveAidCapsule,
  pointHitsCapsule,
  repositionTroop,
  selectAdaptiveAidOption,
  selectDecision,
  setEnergyPickupPointer,
  setSandboxSettings,
  spawnEnemy,
  stepBattle,
  simulateAdaptiveAid,
  WAVE_OUTRO_TIMINGS,
  DEMATERIALIZATION_PULSE,
} from "./battleModel.js";
import { drawExecutorComboIndicator } from "./executorArcoRenderer.js";
import { drawContainmentForeground, drawContainmentUnderlay } from "./containmentRenderer.js";
import { drawThermalPlatformHeatBars } from "./thermalPlatformRenderer.js";
import { drawIncubatorFissureEffects, drawIncubatorFissureUnderlay, drawIncubatorTargetTelegraph } from "./incubatorFissureRenderer.js";
import { drawAdaptiveAid } from "./adaptiveAidRenderer.js";
import { drawWindEffects } from "./windCurrentRenderer.js";
import { drawTideOverlay, drawTideUnderlay } from "./tideRenderer.js";
import { loadSettings } from "../campaign/storage.js";
import { positionalTargetInstruction, positionalTargetMessage } from "./positionalTargeting.js";
import { isSystemEnabledForPhase } from "./phaseRules.js";
import { useBattleAssets } from "./hooks/useBattleAssets.js";
import { useBattleAudio } from "./hooks/useBattleAudio.js";
import { useBattleLoopControls } from "./hooks/useBattleLoop.js";
import {
  getNextBattleSpeed,
  getTroopSlotAvailability,
  resolveBattleHotkey,
  useBattleHotkeys,
} from "./battleHotkeys.js";
import {
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  PauseIcon,
  PlayIcon,
} from "./components/BattleControlIcons.jsx";
import { useBattleFullscreen } from "./hooks/useBattleFullscreen.js";
import { useBattleController } from "./hooks/useBattleController.js";
import BattleCanvas from "./render/BattleCanvas.jsx";
import { drawSprite, drawSpriteInRect, getTroopVisualEntity } from "./render/battleSceneRenderer.js";
import { drawBattleLayers } from "./render/battleLayerRenderer.js";
import { advanceTroopAnimationClock } from "./troopAnimationClock.js";
import { WaveOutroCinematicOverlay } from "./waveOutro/WaveOutroCinematicOverlay.jsx";
import BattlePauseMenu from "./components/BattlePauseMenu.jsx";
import { getWaveOutroCueState, getWaveOutroMusicVolumeFactor } from "./waveOutro/waveOutroAudio.js";
import { getCinematicWaveOutroCameraTransform } from "./waveOutro/waveOutroCamera.js";
import { drawConvoy } from "./chapter07/convoyRenderer.js";
import { drawConvoyImpacts } from "./chapter07/convoyImpactRenderer.js";
import { getConvoyAttackSummary } from "./chapter07/convoySummary.js";
import ConvoyCheckpointOverlay from "./chapter07/components/ConvoyCheckpointOverlay.jsx";
import ConvoySectorCountdown from "./chapter07/components/ConvoySectorCountdown.jsx";
import ConvoyToast from "./chapter07/components/ConvoyToast.jsx";
import { advanceConvoyEntry, advanceConvoySectorCountdown, startConvoySectorCountdown } from "./chapter07/convoyFlow.js";
import { acknowledgeConvoyCheckpoint } from "./chapter07/convoyCheckpoints.js";
import { applyConvoyCheckpointOption } from "./chapter07/convoyCheckpointRewards.js";
import { getBattleFieldPoint, resolveCanvasClickAction } from "./input/battlePointerActions.js";
import { ColossusSpecialButtons } from "./components/ColossusSpecialButtons.jsx";
import { DecisionModal } from "./components/DecisionModal.jsx";
import { FortuneChoiceModal } from "./components/FortuneChoiceModal.jsx";
import { CapsuleInteractionButton } from "./components/CapsuleInteractionButton.jsx";
import { SandboxPanel } from "./components/SandboxPanel.jsx";
import { getThermalBannerText, resolveInspectedTroopId } from "./components/battleHudModel.js";
import { playCriticalAlarmBeep } from "./battleAudioEffects.js";
import BattleOverlays from "./components/BattleOverlays.jsx";
import {
  drawAbyssCharge, drawLatchedGarravinhaMarker, drawLeviathanBossEffects, drawLeviathanBossHealth,
  drawLeviathanBrineJet, drawProceduralGlassEnemy, drawRasgaCeusShadow, drawRasgaCeusTargetMarker,
  drawRasgamarUnderwaterShadow, drawStructuralRupture, isLeviathanShadowOnly, isRasgamarShadowOnly,
  silicaDiggerEmergenceProgress,
} from "./render/enemyEffectsRenderer.js";
import { getEnemyVisualEffects } from "./render/enemyEffectsRegistry.js";
import {
  drawAttachedConvoyEnemies, drawBattleRows, drawHealth, drawLumiDefenseShield, drawNaniteHealingBeams,
  drawNaniteTargetEffect, drawPrismaticShield, drawTroopCooldown,
  drawTroopEntity, drawTroopSpecialReady, drawLeviathanStateEffect, drawPhysicalStunEffect, drawSporeConfusionEffect, drawAresThermalShield, drawElectricTroopStatus, drawTroopPlacementPreview, drawWorkerQueenWebDebuff, drawSandstormTroopEffects, getEnemyFrameCounts, shouldDrawEnemyHealth,
} from "./render/entityRenderer.js";
import { drawDeathVisuals, drawEmissiveBattle, drawEnergyPickups, drawTreeBroodBursts } from "./render/battleVfxRenderer.js";
import "./chapter07/chapter07.css";

export const FREE_HAND_ACTIVATED_MESSAGE = "Mão livre ativada.";

export { resolveCanvasClickAction };

export { getCinematicWaveOutroCameraTransform as getWaveOutroCameraTransform };
export { WaveOutroCinematicOverlay as WaveOutroOverlay };
export { ColossusSpecialButtons };
export { isLeviathanShadowOnly, isRasgamarShadowOnly };
export { drawLeviathanBrineJet };
export { resolveInspectedTroopId };

let entityRendererDependencies = null;

function getEntityRendererDependencies() {
  if (entityRendererDependencies) return entityRendererDependencies;
  entityRendererDependencies = Object.freeze({
    buildBattleRenderRows, drawWetReflections, getHitReaction, isRasgamarShadowOnly,
    isLeviathanShadowOnly, drawRasgamarUnderwaterShadow, drawRasgaCeusShadow,
    silicaDiggerEmergenceProgress, drawContactShadow, drawTroopEntity, drawEnemyEntity,
    enemies: ENEMIES,
  });
  return entityRendererDependencies;
}

// The screen selects the concrete visual implementations; the ordered canvas
// pipeline itself lives in render/battleLayerRenderer.
const BATTLE_LAYER_RENDERERS = Object.freeze({
  clearRenderLayer, drawContainmentUnderlay, drawArenaBackground, drawArenaUnderlay,
  drawIncubatorFissureUnderlay, getPlacementPreviewGeometry, drawTacticalGrid,
  drawPlacementRange, isSystemEnabledForPhase, drawTideUnderlay,
  drawIncubatorFissureEffects, drawIncubatorTargetTelegraph, drawDecals,
  drawPulseScorches, drawDematerializationPulses, drawMines,
  drawProjectileCollection, drawSporeFruits, drawSporeClouds,
  drawNaniteHealingBeams, drawForestObstacles,
  drawBattleRows: (ctx, session, assets, runtime, settings, adaptive, now, animationElapsed, interpolation, buffers) => drawBattleRows({
    ctx, session, assets, runtime, settings, adaptive, now, animationElapsed, interpolation, buffers,
    field: FIELD,
    dependencies: getEntityRendererDependencies(),
  }), drawConvoy,
  drawAttachedConvoyEnemies, drawEnemyEntity, drawThermalPlatformHeatBars,
  drawTroopPlacementPreview, drawDeathVisuals, drawTideOverlay, drawWindEffects,
  drawConvoyImpacts, drawAdaptiveAid, drawTreeBroodBursts,
  drawPulseDisintegrations, drawDeploymentEffects, drawTartaragarraEffects,
  drawDynamicLights, drawArenaForeground, drawPulseBeams, drawEnergyPickups,
  drawParticles, drawPostProcessing, drawContainmentForeground, drawEmissiveBattle,
});

export { DecisionModal };

const missingColossoAssetWarnings = new Set();

/* Migrated to render/entityRenderer.js. Kept as a non-executable reference
 * only until the broader entity migration removes the matching legacy imports. */
/*
function legacyDrawTroopEntity(ctx, entry, session, assets, runtime, settings, now, animationElapsed, scratch, drawHalo = true) {
  const logicalEntity = entry.entity;
  const reaction = getHitReaction(runtime, logicalEntity.id, now);
  const config = TROOPS[logicalEntity.type];
  const troopAssets = assets.troops[logicalEntity.type] || {};
  Object.assign(scratch, logicalEntity);
  scratch.x = entry.x + reaction.offsetX;
  scratch.y = entry.y + (config.spriteOffsetY || 0);
  const troopElapsed = logicalEntity.state === "idle" ? animationElapsed : session.elapsed;
  const animation = getTroopAnimation(logicalEntity, config, troopElapsed, getTroopFrameCounts(troopAssets));
  const image = resolveTroopFrame(troopAssets, animation.state, animation.frame);
  const frameAnchor = getTroopFrameAnchor(config, animation.state, animation.frame);
  const visual = getTroopAttackVisual(logicalEntity, config);
  const height = (visual?.height || config.attackVisual?.height || (logicalEntity.type === "muralhaReforcada" ? 112 : 126))
    * (config.spriteScale || 1);
  const troopFilter = getTroopSpriteFilter(reaction.flash);
  const thermalState = getTroopThermalVisualState(logicalEntity, session.elapsed);
  const thermalRect = image?.width && image?.height
    ? getAnchoredSpriteRect(scratch, height, image.width / image.height, frameAnchor)
    : { x: scratch.x - 24, y: scratch.y - 60, width: 48, height: 68 };
  drawThermalBurnBackLayer(ctx, logicalEntity, thermalRect, session.elapsed, settings, thermalState);
  let spriteDrawn = false;
  if (logicalEntity.type === "droneSentinela") {
    const baseX = scratch.x;
    const baseY = scratch.y;
    const layout = getDroneSentinelaLayout(logicalEntity.droneCount);
    const frames = troopAssets[animation.state] || [];
    for (const unit of layout) {
      const frameIndex = animation.state === "idle"
        ? (animation.frame + unit.idlePhase) % Math.max(1, frames.length)
        : animation.frame;
      const unitImage = resolveTroopFrame(troopAssets, animation.state, frameIndex);
      scratch.x = baseX + unit.x;
      scratch.y = baseY + unit.y;
      if (drawHalo && unitImage?.width && unitImage?.height) {
        const rect = getAnchoredSpriteRect(
          scratch, height * unit.scale, unitImage.width / unitImage.height, frameAnchor,
        );
        drawCachedSpriteHalo(ctx, rect, session.phase.palette.primary, settings);
      }
      spriteDrawn = drawSprite(
        ctx, unitImage, scratch, height * unit.scale, 1, troopFilter, frameAnchor, config.flipX,
      ) || spriteDrawn;
    }
    scratch.x = baseX;
    scratch.y = baseY;
  } else {
    if (drawHalo && image?.width && image?.height) {
      const rect = getAnchoredSpriteRect(scratch, height, image.width / image.height, frameAnchor);
      drawCachedSpriteHalo(ctx, rect, session.phase.palette.primary, settings);
    }
    spriteDrawn = drawSprite(ctx, image, scratch, height, 1, troopFilter, frameAnchor, config.flipX);
  }
  if (logicalEntity.type === "operadorJano") {
    const droneAnimation = getJanoDroneAnimation(
      logicalEntity, config, session.elapsed, getTroopFrameCounts(troopAssets),
    );
    const droneImage = resolveTroopFrame(troopAssets, droneAnimation.state, droneAnimation.frame);
    const offset = config.droneOffset || { x: 42, y: -76 };
    const droneEntity = {
      x: scratch.x + offset.x,
      y: scratch.y + offset.y - 51.6,
    };
    const droneHeight = config.droneVisuals?.[droneAnimation.state]?.height || 72;
    if (drawHalo && droneImage?.width && droneImage?.height) {
      const rect = getAnchoredSpriteRect(droneEntity, droneHeight, droneImage.width / droneImage.height, { x: 0.5, y: 0.5 });
      drawCachedSpriteHalo(ctx, rect, session.phase.palette.primary, settings);
    }
    drawSprite(ctx, droneImage, droneEntity, droneHeight, 1, troopFilter, { x: 0.5, y: 0.5 }, false);
  }
  if (!spriteDrawn) {
    ctx.fillStyle = config.color;
    ctx.fillRect(scratch.x - 24, scratch.y - 34, 48, 68);
  }
  drawThermalBurnFrontLayer(ctx, logicalEntity, thermalRect, session.elapsed, settings, thermalState);
  drawLumiDefenseShield(ctx, scratch, config, session.elapsed, settings);
  if (config.specialEveryMs && !logicalEntity.specialRequested && session.elapsed >= logicalEntity.specialReadyAt) {
    drawTroopSpecialReady(ctx, scratch, session.elapsed, settings);
  }
  drawNaniteTargetEffect(ctx, scratch, session, settings);
  drawTroopCooldown(ctx, scratch, session, settings);
  drawLeviathanStateEffect(ctx, scratch, session, settings);
  drawExecutorComboIndicator(ctx, scratch, session.elapsed, settings);
  drawWorkerQueenWebDebuff(ctx, logicalEntity, session, settings);
  drawSandstormTroopEffects(ctx, logicalEntity, session, assets, settings, height);
  drawElectricTroopStatus(ctx, logicalEntity, session.elapsed, settings);
  drawPhysicalStunEffect(ctx, logicalEntity, session.elapsed, settings);
  drawSporeConfusionEffect(ctx, logicalEntity, session.elapsed, settings);
  drawHealth(ctx, logicalEntity, runtime, now, config.healthBarWidth || 54, config.healthBarOffset || 52, null, session.elapsed);
  drawAresThermalShield(ctx, logicalEntity, settings);
  if (logicalEntity.type === "droneSentinela") {
    ctx.save();
    ctx.font = "700 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e0f2fe";
    ctx.strokeStyle = "#082f49";
    ctx.lineWidth = 3;
    const countLabel = `×${Number(logicalEntity.droneCount || 1)}`;
    ctx.strokeText(countLabel, scratch.x + 33, scratch.y - 58);
    ctx.fillText(countLabel, scratch.x + 33, scratch.y - 58);
    ctx.restore();
  }
}
*/

export function drawEnemyEntity(ctx, entry, session, assets, runtime, settings, adaptive, now, interpolation, scratch, drawHalo = true) {
  const logicalEntity = entry.entity;
  if (logicalEntity.type === "colossoCaldeira") {
    const enemyAssets = assets.enemies.colossoCaldeira || {};
    const animation = getColossoAnimation(logicalEntity, session.elapsed, getEnemyFrameCounts(enemyAssets), settings.reduceMotion);
    const image = enemyAssets?.[animation.state]?.[animation.frame] || null;
    const transitionImage = animation.previousState ? enemyAssets?.[animation.previousState]?.[animation.previousFrame] || null : null;
    if (!image) {
      const missingKey = `${animation.state}:${animation.frame}`;
      if (!missingColossoAssetWarnings.has(missingKey)) {
        missingColossoAssetWarnings.add(missingKey);
        console.error(`[Colosso] Asset ausente para ${missingKey}; fallback para idle desativado.`);
      }
    }
    drawColossoCaldeira(ctx, logicalEntity, { ...settings, elapsed: session.elapsed, animation, transitionImage }, image, {
      ...(assets.effects || {}),
      colossoCoreHits: runtime?.colossoCoreHits || [],
    });
    drawColossoBossHealth(ctx, logicalEntity, session.elapsed);
    return;
  }
  if (logicalEntity.type === "vermeIncubador" && logicalEntity.incubatorSubmerged) return;
  if (isRasgamarShadowOnly(logicalEntity, session.elapsed)) return;
  const config = ENEMIES[logicalEntity.type];
  const reaction = getHitReaction(runtime, logicalEntity.id, now);
  Object.assign(scratch, logicalEntity);
  writeEnemyVisualPosition(logicalEntity, config, session.elapsed, interpolation, settings.reduceMotion, scratch);
  scratch.x += reaction.offsetX;
  const frozen = isEnemyFrozen(logicalEntity, session.elapsed);
  const stunned = session.elapsed < (logicalEntity.stunnedUntil || 0);
  if (logicalEntity.type === "duneRipper" && logicalEntity.duneState === "roar"
    && !settings.reduceMotion && !stunned) {
    const roarAge = session.elapsed - logicalEntity.duneStateStartedAt;
    scratch.x += Math.sin(roarAge / 24) * 1.8;
    scratch.y += Math.cos(roarAge / 31) * 0.8;
  }
  const enemyAssets = assets.enemies[logicalEntity.type] || {};
  const frameCounts = getEnemyFrameCounts(enemyAssets);
  let animation = getEnemyAnimation(logicalEntity, config, session.elapsed, frameCounts);
  if (logicalEntity.type === "workerQueen" && reaction.flash > 0.12 && enemyAssets.hit?.length) {
    animation = {
      state: "hit",
      frame: Math.min(enemyAssets.hit.length - 1, Math.floor((1 - reaction.flash) * enemyAssets.hit.length)),
    };
  }
  if (logicalEntity.type === "scarabEmperor" && !logicalEntity.scarabTransitionToPhase && reaction.flash > 0.12) {
    const hitState = `phase${logicalEntity.bossPhase || 1}Hit`;
    if (enemyAssets[hitState]?.length) {
      animation = {
        state: hitState,
        frame: Math.min(enemyAssets[hitState].length - 1, Math.floor((1 - reaction.flash) * enemyAssets[hitState].length)),
      };
    }
  }
  const frames =
    enemyAssets[animation.state] ||
    enemyAssets.flying ||
    enemyAssets.walking ||
    enemyAssets.idle ||
    [];
  const image = frames[animation.frame % Math.max(1, frames.length)];
  const enemyAspectRatio = image?.width && image?.height ? image.width / image.height : 1;
  const enemyRect = getEnemySpriteRect(scratch, config, animation.state, animation.frame, enemyAspectRatio);
  const leviathanShadowOnly = isLeviathanShadowOnly(logicalEntity, session.elapsed, animation.frame);
  const spriteFilter = getSpriteFilter(
    reaction.flash,
    logicalEntity.bossPhase || 0,
    logicalEntity.variant === "alpha",
    logicalEntity.isEcho,
    frozen,
  );
  const visualEffects = getEnemyVisualEffects(logicalEntity.type);
  visualEffects.underlay?.(ctx, scratch, session.elapsed, settings);
  visualEffects.beforeSprite?.(ctx, scratch, session.elapsed, settings);
  const emergenceProgress = silicaDiggerEmergenceProgress(logicalEntity, session.elapsed);
  if (drawHalo && !leviathanShadowOnly && emergenceProgress >= 0.45) {
    drawCachedSpriteHalo(
      ctx,
      enemyRect,
      logicalEntity.isEcho ? "#7fffd4" : session.phase.palette.accent,
      settings,
      logicalEntity.isEcho ? 1.4 : 1,
    );
  }
  const flipEnemy = logicalEntity.type === "garravinha"
    || (logicalEntity.type === "rasgaCeusCinereo" && logicalEntity.visualFacing > 0);
  let spriteDrawn = leviathanShadowOnly ? false : drawSpriteInRect(ctx, image, enemyRect, logicalEntity.isEcho ? 0.72 : 1, spriteFilter, flipEnemy);
  if (!spriteDrawn && !leviathanShadowOnly) spriteDrawn = drawProceduralGlassEnemy(ctx, scratch, config, session.elapsed, spriteFilter);
  if (frozen && spriteDrawn) {
    drawSpriteInRect(ctx, image, enemyRect, 0.38, "brightness(0) saturate(100%) invert(82%) sepia(46%) saturate(1134%) hue-rotate(156deg) brightness(104%) contrast(102%)");
  }
  if (!spriteDrawn && !leviathanShadowOnly) {
    ctx.fillStyle = frozen ? "#38bdf8" : config.color;
    ctx.beginPath();
    ctx.arc(scratch.x, scratch.y, 24 * logicalEntity.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  drawLeviathanBossEffects(ctx, scratch, session, settings);
  drawLeviathanBossHealth(ctx, logicalEntity);
  drawAbyssCharge(ctx, scratch, config, session.elapsed, settings);
  drawPrismaticShield(ctx, scratch, session.elapsed, settings);
  if (frozen && !leviathanShadowOnly) drawFrozenEnemyEffect(ctx, scratch, session.elapsed, settings);
  if (stunned) drawStunnedEnemyEffect(ctx, scratch, session.elapsed, settings);
  if (logicalEntity.isEcho) {
    const radius = 31 * logicalEntity.scale;
    ctx.save();
    ctx.strokeStyle = "rgba(127,255,212,.72)";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#8b5cf6";
    ctx.beginPath();
    ctx.moveTo(scratch.x, scratch.y - radius);
    ctx.lineTo(scratch.x + radius * .72, scratch.y);
    ctx.lineTo(scratch.x, scratch.y + radius * .45);
    ctx.lineTo(scratch.x - radius * .72, scratch.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  drawStructuralRupture(ctx, scratch, session.elapsed, settings);
  if (logicalEntity.type !== "leviathanNereida" && emergenceProgress >= 0.45 && !logicalEntity.rasgamarSubmerged && (shouldDrawEnemyHealth(logicalEntity, frozen, stunned, adaptive) || (logicalEntity.type === "garravinha" && logicalEntity.garravinhaState === "latched"))) {
    drawHealth(ctx, logicalEntity, runtime, now, logicalEntity.variant === "alpha" ? 100 : 58, 58 * logicalEntity.scale, logicalEntity.isEcho ? "#7fffd4" : null);
  }
  drawLatchedGarravinhaMarker(ctx, session, logicalEntity);
  if (logicalEntity.variant === "alpha") {
    ctx.fillStyle = "#fecdd3";
    ctx.font = "700 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${config.label.toUpperCase()} ALFA`, scratch.x, Math.max(30, scratch.y - 76 * logicalEntity.scale));
  }
  drawRasgaCeusTargetMarker(ctx, session, logicalEntity);
}

export { CapsuleInteractionButton };

export { FortuneChoiceModal };

export { SandboxPanel };

export { getThermalBannerText };

export function BattleScreen({ phase, unlockedTroops, onFinish, onExit, sandbox = false }) {
  const controller = useBattleController({ phase, unlockedTroops, sandbox });
  const frameLoopRef = useRef(null);
  const {
    loadout, battleShellRef, canvasRef, assetsRef, sessionRef, particlesRef, graphicsRef, battleRowsRef,
    adaptiveSettingsRef, hoveredCellRef, finishSentRef, convoyDestructionRevealUntilRef, audioRef,
    lastCriticalBeepRef, notificationIdRef, waveOutroCueRef, convoyCountdownStepRef, troopAnimationClockRef,
    snapshot, setSnapshot, paused, setPaused, speed, setSpeed, runtimeRevision, setRuntimeRevision,
    sandboxSettingsState, setSandboxSettingsState, selectedEnemy, setSelectedEnemy, spawnRow, setSpawnRow,
    spawnCount, setSpawnCount, spawnAlpha, setSpawnAlpha, spawnGrouped, setSpawnGrouped, fortuneTier,
    setFortuneTier, selectedTroop, setSelectedTroop, repositionTroopId, setRepositionTroopId, hoveredTroop,
    setHoveredTroop, removeMode, setRemoveMode, targetingDecision, setTargetingDecision, graphicsMetrics,
    setGraphicsMetrics, notification, setNotification, banner, setBanner,
    renderPlan, getOverlayModel,
  } = controller;
  const consumeGraphicsEventsAtVisualTime = (events, simulationNow = sessionRef.current.elapsed) => {
    const visualNow = performance.now();
    consumeGraphicsEvents(
      graphicsRef.current,
      events,
      simulationNow,
      { ...settings, clockNow: visualNow },
    );
  };
  const { pausedRef, speedRef } = useBattleLoopControls(paused, speed);
  const {
    isFullscreen,
    fullscreenSupported,
    toggleFullscreen,
    exitFullscreen,
  } = useBattleFullscreen(battleShellRef);
  const showGraphicsMetrics = useMemo(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has("gfxstats"), []);
  const setMessage = useCallback((text, options = {}) => {
    setNotification({
      id: notificationIdRef.current++,
      text,
      tone: options.tone || "info",
      persistent: Boolean(options.persistent),
    });
  }, []);
  const setActionMessage = useCallback((text) => {
    setMessage(text, { persistent: true, tone: "action" });
  }, [setMessage]);
  const handleToggleFullscreen = useCallback(async () => {
    const entering = !isFullscreen;
    const result = await toggleFullscreen();
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setMessage(
      entering
        ? "Modo tela cheia ativado · pressione Esc para sair."
        : "Modo tela cheia encerrado.",
    );
  }, [isFullscreen, setMessage, toggleFullscreen]);
  const handleBattleExit = useCallback(async () => {
    await exitFullscreen();
    onExit();
  }, [exitFullscreen, onExit]);
  const settings = useMemo(loadSettings, []);
  const { configureAudio, play, stopAudio } = useBattleAudio({
    audioRef,
    settings,
    paused,
    windActive: sessionRef.current.windCurrent?.state === "active",
    convoyActive: phase.chapterId === "chapter_07" && snapshot.convoy?.moving,
    chapterId: phase.chapterId,
  });
  const resetBattleRuntime = useCallback((nextSandboxSettings = sandboxSettingsState) => {
    stopAudio();
    sessionRef.current = createBattleSession(phase, loadout, Date.now(), { sandbox, ...(sandbox ? { sandboxSettings: nextSandboxSettings } : {}) });
    particlesRef.current = [];
    graphicsRef.current = createGraphicsRuntime();
    battleRowsRef.current = createBattleRowBuffers();
    hoveredCellRef.current = null;
    finishSentRef.current = false;
    convoyDestructionRevealUntilRef.current = 0;
    waveOutroCueRef.current = null;
    convoyCountdownStepRef.current = null;
    lastCriticalBeepRef.current = 0;
    setSelectedTroop(null); setHoveredTroop(null); setRemoveMode(false); setTargetingDecision(null);
    setSpeed(1); setPaused(false); setSnapshot(getSnapshot(sessionRef.current));
    setRuntimeRevision((value) => value + 1);
  }, [loadout, phase, sandbox, sandboxSettingsState, stopAudio]);
  const loading = useBattleAssets({
    phase,
    loadout,
    sandbox,
    assetsRef,
    onAssetsReady: configureAudio,
    onCleanup: stopAudio,
  });

  useEffect(() => {
    if (!loading.ready || sandbox || phase.id !== "fase_49") return;
    setMessage("MANTENHA UMA TROPA EM R2 OU R4 PRÓXIMA AO TRANSPORTE.", { tone: "action", persistent: true });
  }, [loading.ready, phase.id, sandbox, setMessage]);

  useEffect(() => {
    if (!loading.ready || sandbox || phase.id !== "fase_50") return;
    const key = "genesis.chapter07.forestObstacleTutorial";
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "shown");
    setBanner("COBERTURA FERRÍVORA");
    setMessage("Árvores bloqueiam seus disparos, mas não impedem o avanço inimigo. Destrua a cobertura ou espere os inimigos ultrapassá-la.", { tone: "info" });
  }, [loading.ready, phase.id, sandbox, setBanner, setMessage]);

  useEffect(() => {
    if (!notification?.text || notification.persistent) return undefined;
    const timeout = window.setTimeout(() => {
      setNotification((current) => current?.id === notification.id ? null : current);
    }, 3000);
    return () => window.clearTimeout(timeout);
  }, [notification]);
  useEffect(() => {
    if (!targetingDecision && snapshot.adaptiveAid.status !== "targeting") return undefined;
    const cancel = (event) => {
      if (event.key === "Escape") {
        setTargetingDecision(null);
        sessionRef.current.pendingPositionalDecision = null;
        if (sessionRef.current.adaptiveAid?.status === "targeting") {
          sessionRef.current.adaptiveAid.status = "choosing";
          sessionRef.current.adaptiveAid.pendingTarget = null;
        }
        setSnapshot(getSnapshot(sessionRef.current));
        setMessage("Seleção de alvo cancelada.");
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [targetingDecision, snapshot.adaptiveAid.status]);

  useEffect(() => {
    if (!loading.ready) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const renderScale = configureHiDPICanvas(canvas, settings, window.devicePixelRatio || 1);
    const renderLayers = createRenderLayers();
    const layerConfig = configureRenderLayers(renderLayers, settings, window.devicePixelRatio || 1);
    let previous = performance.now();
    let accumulator = 0;
    let lastUi = 0;
    let lastDrawMs = 0;
    let lastPresentMs = 0;
    let lastLayerTimings = { arenaMs: 0, effectMs: 0, entityMs: 0, emissiveMs: 0 };
    const loop = (now) => {
      const frameDelta = Math.min(100, now - previous);
      previous = now;
      const fortunePaused = adaptiveAidPausesSimulation(sessionRef.current.adaptiveAid?.status);
      const outroFactor = getWaveOutroCinematicFactor(sessionRef.current, settings.reduceMotion);
      if (!pausedRef.current && !fortunePaused) {
        const battleSpeed = outroFactor < 1 ? outroFactor : speedRef.current;
        accumulator += frameDelta * battleSpeed * adaptiveAidCinematicFactor(sessionRef.current);
      }
      const outroEvents = advanceWaveOutro(sessionRef.current, frameDelta);
      if (outroEvents.length) {
        pushEventParticles(particlesRef.current, outroEvents, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        consumeGraphicsEventsAtVisualTime(outroEvents, sessionRef.current.elapsed);
        if (outroEvents.some((event) => event.type === "waveCompleteBanner")) {
          audioRef.current.theme?.pause();
          setBanner(sessionRef.current.waveOutro.finalWave
            ? "PERÍMETRO ASSEGURADO"
            : `ONDA ${sessionRef.current.waveOutro.completedWave} CONCLUÍDA`);
          play("alert", 0.38);
        }
        if (outroEvents.some((event) => event.type === "decisionIntro")) setBanner("NOVA VANTAGEM TÁTICA");
        if (outroEvents.some((event) => event.type === "victoryIntro")) {
          setBanner("MISSÃO CONCLUÍDA");
          play("alert", 0.62);
        }
      }
      const activeSession = sessionRef.current;
      if (!pausedRef.current && !fortunePaused && activeSession?.convoyFlow?.state === "sectorCountdown") {
        const remainingBeforeStep = Math.max(0, (activeSession.convoyFlow.countdownDurationMs || 2400) - (activeSession.convoyFlow.countdownElapsedMs || 0));
        const countdownStep = Math.max(1, Math.min(3, Math.ceil(remainingBeforeStep / 800)));
        if (convoyCountdownStepRef.current !== countdownStep) {
          convoyCountdownStepRef.current = countdownStep;
          play("alert", 0.2);
        }
        const countdownEvents = [];
        advanceConvoySectorCountdown(activeSession, frameDelta * speedRef.current, countdownEvents);
        if (countdownEvents.length) {
          consumeGraphicsEventsAtVisualTime(countdownEvents, activeSession.elapsed);
          play("alert", 0.45);
          convoyCountdownStepRef.current = null;
        }
      }
      if (!pausedRef.current && !fortunePaused && activeSession?.convoyFlow?.state === "convoyEntry") {
        const entryEvents = [];
        advanceConvoyEntry(activeSession, frameDelta, entryEvents);
        if (entryEvents.length) consumeGraphicsEventsAtVisualTime(entryEvents, activeSession.elapsed);
      }
      const activeOutro = activeSession?.waveOutro?.status
        && !["idle", "completed"].includes(activeSession.waveOutro.status);
      const cueState = getWaveOutroCueState(activeSession?.waveOutro);
      if (cueState?.impactReady && waveOutroCueRef.current !== cueState.key) {
        waveOutroCueRef.current = cueState.key;
        const lastEnemy = activeSession.waveOutro.lastKill?.enemy;
        const impactEvent = {
          type: cueState.finalWave ? "missionFinalImpact" : "waveFinalImpact",
          x: Number.isFinite(lastEnemy?.x) ? lastEnemy.x : FIELD.width * 0.64,
          y: Number.isFinite(lastEnemy?.y)
            ? lastEnemy.y
            : ((activeSession.waveOutro.lastKill?.row ?? 2) + 0.5) * CELL.height,
          shake: settings.reduceMotion ? 0 : cueState.shake,
          color: phase.palette.accent,
          seed: Math.round((lastEnemy?.x || 17) * 31 + (lastEnemy?.y || 23) * 17),
        };
        consumeGraphicsEventsAtVisualTime([impactEvent], activeSession.elapsed);
        play("melee", cueState.finalWave ? 0.88 : cueState.cinematic ? 0.68 : 0.48);
        play("alert", cueState.finalWave ? 0.30 : 0.14);
      }
      const themeAudio = audioRef.current.theme;
      if (themeAudio && activeOutro) {
        const baseMusicVolume = settings.masterVolume * settings.musicVolume;
        themeAudio.volume = baseMusicVolume * getWaveOutroMusicVolumeFactor(activeSession.waveOutro);
      }
      if (activeSession && !activeOutro && !activeSession.outcome && activeSession.integrity > 0 && (activeSession.integrity / activeSession.integrityMax) <= 0.25) {
        if (now - lastCriticalBeepRef.current >= 1200) {
          lastCriticalBeepRef.current = now;
          playCriticalAlarmBeep(settings.masterVolume * settings.effectsVolume);
        }
      }
      const stepStarted = performance.now();
      while (accumulator >= 32) {
        const events = stepBattle(sessionRef.current, 32);
        pushEventParticles(particlesRef.current, events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        consumeGraphicsEventsAtVisualTime(events, sessionRef.current.elapsed);
        if (events.some((event) => event.type === "spawn")) play("alert", 0.08);
        if (events.some((event) => event.type === "convoyUnderAttack")) play("convoyAttack", .34);
        if (events.some((event) => event.type === "convoyUnderAttack")) setMessage("TRANSPORTE SOB ATAQUE", { tone: "danger" });
        if (events.some((event) => event.type === "escortLost")) setMessage("SEM ESCOLTA · o transporte permanecerá parado", { tone: "warning", persistent: true });
        if (events.some((event) => event.type === "escortRestored")) setMessage("ESCOLTA RESTAURADA", { tone: "info" });
        if (events.some((event) => event.type === "convoyAttackCleared")) setMessage("ESCOLTA RESTAURADA", { tone: "info" });
        if (events.some((event) => event.type === "convoyHit")) play("convoyHit", .42);
        if (events.some((event) => event.type === "convoyCritical")) play("convoyCritical", .68);
        if (events.some((event) => event.type === "checkpointReached")) play("convoyCheckpoint", .72);
        if (events.some((event) => event.type === "checkpointReached")) setMessage("CHECKPOINT ALCANÇADO", { tone: "info" });
        if (events.some((event) => event.type === "checkpointPreparation")) {
          setSelectedTroop(null);
          setRepositionTroopId(null);
          setRemoveMode(false);
          setMessage("CHECKPOINT ALCANÇADO", { tone: "info" });
        }
        if (events.some((event) => event.type === "energyGenerated" && event.sourceKind === "convoy")) play("convoyLogistics", .24);
        if (events.some((event) => event.type === "reserveEmpty")) play("convoyReserveEmpty", .58);
        if (events.some((event) => event.type === "reserveEmpty")) setMessage("RESERVA ESGOTADA", { tone: "warning" });
        if (events.some((event) => event.type === "reinforcementWarning")) play("convoyReinforcement", .5);
        if (events.some((event) => event.type === "reinforcementWarning")) setMessage("REFORÇOS INIMIGOS", { tone: "danger" });
        if (events.some((event) => event.type === "convoyDestroyed")) play("convoyDestruction", .85);
        if (events.some((event) => event.type === "convoyEvacuated")) play("convoyEvacuation", .85);
        if (events.some((event) => event.type === "rastejanteBite")) play("rastejanteBite", .35);
        if (events.some((event) => event.type === "treeBroodTriggered")) play("treeBroodOpen", .32);
        if (events.some((event) => event.type === "treeLarvaSpawned")) play("larvaEmerge", .18);
        if (events.some((event) => event.type === "melee" && event.sourceEnemyId === "larvaRaizFerro")) play("larvaAttack", .16);
        if (events.some((event) => event.type === "enemyDeath" && event.entity?.type === "larvaRaizFerro")) play("larvaDeath", .12);
        if (events.some((event) => event.type === "rastejanteFrenzyChanged" && event.frenzyLevel === 2)) play("rastejanteFrenzy", .45);
        if (events.some((event) => event.type === "saltadorJumpStart")) play("saltadorJump", .32);
        if (events.some((event) => event.type === "saltadorJumpLand")) play("saltadorLand", .28);
        if (events.some((event) => event.type === "saltadorRasanteImpact")) play("saltadorRasante", .42);
        if (events.some((event) => event.type === "pulseCharging")) play("alert", 0.65);
        if (events.some((event) => event.type === "shoot" && !["icaroBullet", "icaroInterceptionShot"].includes(event.weapon))) play("shoot", 0.18);
        if (events.some((event) => event.type === "shoot" && event.weapon === "icaroBullet")) play("icaroBurstShot", 0.34);
        if (events.some((event) => event.type === "mantisSpikeImpact")) play("shoot", 0.12);
        if (events.some((event) => event.type === "mantisSpikeDetonation")) play("melee", 0.24);
        if (events.some((event) => event.type === "icaroTargetLock")) play("icaroInterceptionLock", 0.5);
        if (events.some((event) => event.type === "icaroInterceptionFire")) play("icaroInterceptionFire", 0.58);
        if (events.some((event) => event.type === "troopDeath" && event.entity?.type === "interceptadorIcaro")) play("icaroDeath", 0.5);
        if (events.some((event) => event.type === "leviathanChargeStarted")) play("leviathanCharge", 0.5);
        if (events.some((event) => event.type === "leviathanFire")) play("leviathanFire", 0.78);
        if (events.some((event) => ["leviathanImpact", "leviathanSecondImpact"].includes(event.type))) play("leviathanImpact", 0.58);
        if (events.some((event) => event.type === "structuralRuptureApplied")) play("leviathanRupture", 0.72);
        if (events.some((event) => event.type === "leviathanCooldownStarted")) play("leviathanCooldown", 0.35);
        if (events.some((event) => event.type === "colossoAwakened")) {
          setBanner("⚠ COLOSSO DA CALDEIRA");
          play("colossoAwaken", 0.88);
        }
        if (events.some((event) => event.type === "permanentThermalHazardStarted")) {
          setBanner("⚠ A CALDEIRA ENTROU EM ERUPÇÃO · LINHA FRONTAL INSTÁVEL");
          play("alert", 0.72);
        }
        const colossoTelegraph = events.find((event) => event.type === "colossoTelegraph");
        if (colossoTelegraph) play({ rift: "colossoRiftCharge", slam: "colossoSlamCharge", fracture: "colossoFracture", seismic: "colossoSeismicCharge" }[colossoTelegraph.attack], 0.52);
        const colossoImpact = events.find((event) => event.type === "colossoAttackImpact");
        if (colossoImpact) play({ rift: "colossoRiftOpen", slam: "colossoSlamImpact", fracture: "colossoFracture", seismic: "colossoSeismicImpact", finalCollapse: "colossoFinalCollapse" }[colossoImpact.attack], 0.72);
        const colossoPhaseEvent = events.find((event) => event.type === "colossoPhaseChanged");
        if (colossoPhaseEvent) {
          setBanner(colossoPhaseEvent.phase === 2 ? "FASE II · RUPTURA" : "FASE III · COLAPSO");
          play(colossoPhaseEvent.phase === 2 ? "colossoPhase2" : "colossoPhase3", 0.76);
        }
        if (events.some((event) => event.type === "colossoFinalCollapse")) {
          setBanner("⚠ COLAPSO DA CALDEIRA");
          play("colossoFinalCollapse", 0.9);
        }
        if (events.some((event) => event.type === "colossoDeathStarted")) {
          setBanner("NÚCLEO INSTÁVEL · COLOSSO EM COLAPSO");
          play("colossoDeath", 0.84);
        }
        if (events.some((event) => event.type === "pulseFired")) play("shoot", 0.85);
        if (events.some((event) => event.type === "melee")) play("melee", 0.2);
        if (events.some((event) => event.type === "ramImpact")) play("melee", 0.65);
        if (events.some((event) => event.type === "duneRipperRoar")) play("alert", 0.45);
        if (events.some((event) => event.type === "executorSlash" && event.combo === 1)) play("executorSlash1", 0.45);
        if (events.some((event) => event.type === "executorSlash" && event.combo === 2)) play("executorSlash2", 0.5);
        if (events.some((event) => event.type === "executorFinisher")) play("executorFinisher", 0.7);
        if (events.some((event) => event.type === "executorComboReset")) play("executorComboReset", 0.25);
        if (events.some((event) => event.type === "windCurrentWarning")) {
          play("windWarning", 0.55);
          play("thunder", 0.18);
        }
        if (events.some((event) => event.type === "windCurrentStarted")) {
          const loopAudio = audioRef.current.windActiveLoop;
          if (loopAudio) {
            loopAudio.currentTime = 0;
            loopAudio.volume = Math.max(0, Math.min(1,
              settings.masterVolume * settings.effectsVolume * 0.42));
            loopAudio.play().catch(() => {});
          }
        }
        if (events.some((event) => event.type === "windPrimaryGust")) play("windPrimaryGust", 0.78);
        if (events.some((event) => event.type === "windTroopShifted"
          || event.type === "windTroopChainShifted"
          || event.type === "windEnemyShifted")) play("windTroopShift", 0.42);
        if (events.some((event) => event.type === "windTroopEjected"
          || event.type === "windTroopEjectedPermanent"
          || event.type === "windTroopCollision"
          || event.type === "windEnemyEjected")) play("windEjection", 0.72);
        if (events.some((event) => event.type === "windCurrentRecovering")) {
          audioRef.current.windActiveLoop?.pause();
          play("windRecovery", 0.48);
        }
        if (events.some((event) => event.type === "windCurrentEnded")) {
          audioRef.current.windActiveLoop?.pause();
        }
        if (events.some((event) => event.type === "tideWarning")) play("alert", 0.52);
        if (events.some((event) => event.type === "tideHighStarted")) play("melee", 0.38);
        if (events.some((event) => event.type === "tideLowStarted")) play("deploy", 0.24);
        if (events.some((event) => event.type === "capsuleIncoming")) {
          setBanner("OPORTUNIDADE TÁTICA");
          setMessage("Transmissão aliada interceptada. Recursos de emergência disponíveis.");
          play("alert", 0.7);
        }
        if (events.some((event) => event.type === "capsuleLanded")) play("melee", 0.45);
        if (events.some((event) => event.type === "capsuleOpening")) play("deploy", 0.5);
        const phaseEvent = events.find((event) => event.type === "bossPhase");
        if (phaseEvent) {
          const alpha = sessionRef.current.enemies.find((enemy) => enemy.variant === "alpha");
          const alphaName = ENEMIES[alpha?.type]?.label?.toUpperCase() || "ALFA";
          setBanner(`⚠ ${alphaName} ALFA · FASE ${phaseEvent.phase + 1}`);
        }
        if (events.some((event) => event.type === "waveComplete")) {
          audioRef.current.windActiveLoop?.pause();
          setBanner("PERÍMETRO SEGURO · REORGANIZAÇÃO EM CURSO");
        }
        accumulator -= 32;
      }
      const stepMs = performance.now() - stepStarted;
      const interpolation = Math.min(1, accumulator / 32);
      const activeEntities = sessionRef.current.troops.length + sessionRef.current.enemies.length
        + sessionRef.current.projectiles.length + sessionRef.current.enemyProjectiles.length;
      updateGraphicsRuntime(graphicsRef.current, sessionRef.current.elapsed, frameDelta, {
        clockNow: now,
        stepMs,
        drawMs: lastDrawMs,
        presentMs: lastPresentMs,
        ...lastLayerTimings,
        activeEntities,
        particles: particlesRef.current.length,
      });
      const adaptive = getAdaptiveEffects(
        settings,
        graphicsRef.current.adaptive.level,
        graphicsRef.current.metrics.frameMs,
      );
      Object.assign(adaptiveSettingsRef.current, settings, { adaptiveLevel: adaptive.level });
      sessionRef.current.renderPaused = pausedRef.current;
      const troopAnimationElapsed = advanceTroopAnimationClock(
        troopAnimationClockRef.current,
        sessionRef.current,
        now,
      );
      const drawStarted = performance.now();
      lastLayerTimings = drawBattleLayers({
        layers: renderLayers,
        layerConfig,
        session: sessionRef.current,
        assets: assetsRef.current,
        particlesRef,
        runtime: graphicsRef.current,
        selectedTroop,
        removeMode,
        hoveredCell: hoveredCellRef.current,
        settings: adaptiveSettingsRef.current,
        adaptive,
        now: sessionRef.current.elapsed,
        animationElapsed: troopAnimationElapsed,
        interpolation,
        rowBuffers: battleRowsRef.current,
        field: FIELD,
        viewport: VIEWPORT,
        renderPlan,
        renderers: BATTLE_LAYER_RENDERERS,
      });
      lastDrawMs = performance.now() - drawStarted;
      const presentStarted = performance.now();
      const camera = getCameraOffset(graphicsRef.current, sessionRef.current.elapsed, adaptiveSettingsRef.current);
      const outroCamera = getCinematicWaveOutroCameraTransform(sessionRef.current, settings.reduceMotion);
      const presentationCamera = outroCamera ? {
        ...camera,
        ...outroCamera,
        x: camera.x + outroCamera.impactX,
        y: camera.y + outroCamera.impactY,
      } : camera;
      presentScene(
        ctx, renderLayers, null, renderScale,
        presentationCamera,
        adaptiveSettingsRef.current, adaptive,
      );

      lastPresentMs = performance.now() - presentStarted;
      if (now - lastUi > 100) {
        lastUi = now;
        setSnapshot(getSnapshot(sessionRef.current));
        if (showGraphicsMetrics) setGraphicsMetrics({ ...graphicsRef.current.metrics });
      }
      if (sessionRef.current.result && !finishSentRef.current) {
        const convoyDestroyed = sessionRef.current.phase?.progressionMode === "convoy"
          && sessionRef.current.result.outcome === "defeat" && sessionRef.current.convoy?.hp <= 0;
        if (convoyDestroyed && !convoyDestructionRevealUntilRef.current) convoyDestructionRevealUntilRef.current = now + 1200;
        if (convoyDestroyed && now < convoyDestructionRevealUntilRef.current) {
          return;
        }
        finishSentRef.current = true;
        audioRef.current.theme?.pause();
        audioRef.current.windActiveLoop?.pause();
        onFinish?.(sessionRef.current.result);
      }
    };
    frameLoopRef.current = loop;
    return () => {
      if (frameLoopRef.current === loop) frameLoopRef.current = null;
    };
  }, [loading.ready, onFinish, play, removeMode, selectedTroop, settings, showGraphicsMetrics, runtimeRevision]);

  const canvasPointFromPointer = (event) => getBattleFieldPoint(event, VIEWPORT);

  const handleCanvasMove = (event) => {
    const point = canvasPointFromPointer(event);
    hoveredCellRef.current = point ? cellFromPoint(point.x, point.y) : null;
    const pending = sessionRef.current.pendingPositionalDecision;
    if (pending) {
      const preview = getPositionalTargetPreview(sessionRef.current, pending, hoveredCellRef.current);
      if (preview && point) {
        preview.pointerX = point.x;
        preview.pointerY = point.y;
      }
      pending.preview = preview;
      event.currentTarget.style.cursor = preview ? (preview.valid ? "pointer" : "not-allowed") : "default";
    }
    setEnergyPickupPointer(sessionRef.current, point);
  };

  const releaseMouseTool = () => {
    if (sessionRef.current.adaptiveAid?.status === "targeting") return;
    setSelectedTroop(null);
    setRemoveMode(false);
    setMessage(FREE_HAND_ACTIVATED_MESSAGE);
  };

  const handleActivateDematerializationPulse = (row) => {
    const result = activateDematerializationPulse(sessionRef.current, row, {
      source: "player",
      reason: "manualTactical",
    });
    if (!result.ok) {
      setMessage(result.reason || "Não foi possível disparar o canhão.");
      return;
    }
    pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
    play("alert", 0.55);
    setMessage(`Pulso da rota ${row + 1} carregando · ${DEMATERIALIZATION_PULSE.damage} de dano por inimigo.`);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleCanvasContextMenu = (event) => {
    if (targetingDecision || sessionRef.current.adaptiveAid?.status === "targeting") {
      setTargetingDecision(null);
      sessionRef.current.pendingPositionalDecision = null;
      if (sessionRef.current.adaptiveAid?.status === "targeting") {
        sessionRef.current.adaptiveAid.status = "choosing";
        sessionRef.current.adaptiveAid.pendingTarget = null;
      }
      setSnapshot(getSnapshot(sessionRef.current));
      setMessage("Seleção de alvo cancelada.");
      return;
    }
    releaseMouseTool();
  };

  const activateColossusSpecial = (troopId) => {
    const result = controller.actions.activateSpecial(troopId);
    setMessage(result.ok
      ? result.queued ? "Esmagamento Total enfileirado após o golpe atual." : "Esmagamento Total ativado."
      : result.reason);
    if (result.ok) {
      pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, adaptiveSettingsRef.current);
      consumeGraphicsEventsAtVisualTime([result.event], sessionRef.current.elapsed);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleCanvasClick = (event) => {
    if (snapshot.outcome) return;
    if (sessionRef.current.waveOutro?.status && !["idle", "completed"].includes(sessionRef.current.waveOutro.status)) {
      if (accelerateWaveOutro(sessionRef.current)) setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    const fieldPoint = canvasPointFromPointer(event);
    if (sessionRef.current.convoyFlow?.state === "checkpointPreparation"
      && sessionRef.current.convoyFlow.checkpointBriefingPending) return;
    if (["sectorCountdown", "convoyEntry"].includes(sessionRef.current.convoyFlow?.state)) {
      setMessage("O setor está iniciando. Aguarde a contagem regressiva.");
      return;
    }
    if (sessionRef.current.convoyFlow?.state === "checkpointPreparation" && fieldPoint && !removeMode) {
      const cell = cellFromPoint(fieldPoint.x, fieldPoint.y);
      const troopAtCell = sessionRef.current.troops.find((troop) => !troop.dead && troop.row === cell?.row && troop.col === cell?.col);
      if (repositionTroopId) {
        const result = repositionTroop(sessionRef.current, repositionTroopId, cell.row, cell.col);
        setMessage(result.ok ? "Patrulha reposicionada sem custo; estado operacional preservado." : result.reason);
        if (result.ok) {
          consumeGraphicsEventsAtVisualTime([result.event], sessionRef.current.elapsed);
          setRepositionTroopId(null); setSelectedTroop(null); setSnapshot(getSnapshot(sessionRef.current));
        }
        return;
      }
      if (!selectedTroop && troopAtCell) {
        setRepositionTroopId(troopAtCell.id); setSelectedTroop(troopAtCell.type);
        setMessage("Origem selecionada. Escolha uma célula válida em R1, R2, R4 ou R5.");
        return;
      }
    }
    if (sessionRef.current.adaptiveAid?.status === "targeting") {
      const row = fieldPoint ? Math.floor(fieldPoint.y / CELL.height) : -1;
      const result = selectAdaptiveAidOption(sessionRef.current, sessionRef.current.adaptiveAid.pendingTarget, { row });
      if (result.ok) {
        const confirmation = result.events.find((entry) => entry.type === "fortuneOrbitalStrike");
        if (confirmation) sessionRef.current.positionalConfirmationEffect = { ...confirmation, startedAt: sessionRef.current.elapsed, until: sessionRef.current.elapsed + 1400 };
        consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
        pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        setMessage(positionalTargetMessage({ id: "emergency_orbital" }, { row }));
      } else setMessage(result.reason);
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (isCapsuleClickable(sessionRef.current)
      && pointHitsCapsule(sessionRef.current.adaptiveAid.capsule, fieldPoint)) {
      const result = openAdaptiveAidCapsule(sessionRef.current);
      if (result.ok) {
        consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
        pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        setSelectedTroop(null);
        setRemoveMode(false);
        setMessage("Cápsula em abertura. Aguarde a transmissão.");
      }
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (targetingDecision) {
      const preview = sessionRef.current.pendingPositionalDecision?.preview
        || getPositionalTargetPreview(sessionRef.current, targetingDecision, fieldPoint ? cellFromPoint(fieldPoint.x, fieldPoint.y) : null);
      const target = preview?.type === "columnBlock"
        ? { centerCol: preview.centerCol, columns: preview.columns }
        : { row: preview?.row };
      if (!preview?.valid) {
        setMessage(preview?.reason || "Alvo inválido.");
        return;
      }
      const eventData = createPositionalConfirmationEvent(sessionRef.current, targetingDecision, target);
      if (eventData && selectDecision(sessionRef.current, targetingDecision, target)) {
        sessionRef.current.pendingPositionalDecision = null;
        sessionRef.current.positionalConfirmationEffect = { ...eventData, startedAt: sessionRef.current.elapsed, until: sessionRef.current.elapsed + 1400 };
        consumeGraphicsEventsAtVisualTime([eventData], sessionRef.current.elapsed);
        pushEventParticles(particlesRef.current, [eventData], sessionRef.current.elapsed, adaptiveSettingsRef.current);
        setTargetingDecision(null);
        setMessage(positionalTargetMessage(targetingDecision, target));
        setSnapshot(getSnapshot(sessionRef.current));
      }
      return;
    }
    const action = resolveCanvasClickAction(
      sessionRef.current,
      fieldPoint,
      selectedTroop,
      removeMode,
    );
    if (!action) return;
    if (action.type === "remove") {
      const result = controller.actions.removeTroop(action.cell.row, action.cell.col);
      setMessage(result.ok ? `Unidade removida · +${result.refund} energia.` : result.reason);
      if (result.ok) {
        consumeGraphicsEventsAtVisualTime([result.event], sessionRef.current.elapsed);
        pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, adaptiveSettingsRef.current);
      }
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (action.type === "special") {
      activateColossusSpecial(action.troop.id);
      return;
    }
    if (action.type === "inspectDrone") {
      const count = Number(action.troop.droneCount || 1);
      const damage = TROOPS.droneSentinela.damage;
      setMessage(
        `Drone Sentinela · Formação: ${count}/3 · Vida: ${Math.ceil(action.troop.hp)}/${Math.ceil(action.troop.maxHp)} · Disparos: ${count} · Dano por disparo: ${damage} · Dano por rajada: ${count * damage}`,
      );
      return;
    }
    const result = controller.actions.placeTroop(action.troopType, action.cell.row, action.cell.col);
    setMessage(result.ok
      ? result.upgraded
        ? `Drone adicionado · Formação ${result.troop.droneCount}/3.`
        : result.renewed
          ? "Plataforma Térmica renovada — calor zerado."
          : `${TROOPS[action.troopType].label} implantado.`
      : result.reason);
    if (result.ok) {
      play("deploy", 0.55);
      pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, adaptiveSettingsRef.current);
      consumeGraphicsEventsAtVisualTime([result.event], sessionRef.current.elapsed);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleStartWave = () => {
    if (targetingDecision
      || sessionRef.current.convoyFlow?.checkpointBriefingPending
      || adaptiveAidBlocksIntermission(sessionRef.current.adaptiveAid?.status)) return;
    const isConvoy = sessionRef.current.phase?.progressionMode === "convoy";
    const started = isConvoy
      ? startConvoySectorCountdown(sessionRef.current)
      : controller.actions.startWave();
    if (started) {
      setSelectedTroop(null);
      setRepositionTroopId(null);
      setRemoveMode(false);
      consumeGraphicsEventsAtVisualTime([{ type: "waveStart" }], sessionRef.current.elapsed);
      const convoy = sessionRef.current.convoyFlow;
      setBanner(convoy ? `SETOR ${convoy.sectorIndex + 1}/4 · ROTA ATIVA` : `ONDA ${sessionRef.current.waveIndex + 1} · CONTATO`);
      setMessage(convoy ? "Contagem regressiva iniciada. Prepare R2/R4." : "Onda em andamento. Novas implantações entram em cooldown.");
      play("alert", 0.75);
      play("theme", 0.75);
      setSnapshot(getSnapshot(sessionRef.current));
    }
  };

  const handleCheckpointContinue = () => {
    if (!acknowledgeConvoyCheckpoint(sessionRef.current)) return;
    setSelectedTroop(null);
    setRepositionTroopId(null);
    setRemoveMode(false);
    setMessage("REPOSICIONE SUAS TROPAS", { tone: "action" });
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleCheckpointReward = (optionId) => {
    const result = applyConvoyCheckpointOption(sessionRef.current, optionId, []);
    if (!result.ok) return;
    setMessage(optionId === "repair" ? "BLINDAGEM REPARADA" : "RESERVA REABASTECIDA");
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleDecision = (option) => {
    if (adaptiveAidBlocksIntermission(sessionRef.current.adaptiveAid?.status)) return;
    if (option.positional) {
      sessionRef.current.pendingPositionalDecision = { ...option, preview: null };
      setTargetingDecision(option);
      setSelectedTroop(null);
      setRemoveMode(false);
      setActionMessage(positionalTargetInstruction(option));
      return;
    }
    if (selectDecision(sessionRef.current, option)) {
      setMessage(`${option.label}: efeito aplicado.`);
      setSnapshot(getSnapshot(sessionRef.current));
    } else {
      setMessage("Não foi possível aplicar essa decisão.");
    }
  };

  const resetSandbox = (nextSettings = sandboxSettingsState) => {
    if (!sandbox) return;
    sessionRef.current = createBattleSession(phase, loadout, Date.now(), { sandbox: true, sandboxSettings: nextSettings });
    particlesRef.current = [];
    graphicsRef.current = createGraphicsRuntime();
    hoveredCellRef.current = null;
    setSelectedTroop(null);
    setRemoveMode(false);
    setFortuneTier("critical");
    setSnapshot(getSnapshot(sessionRef.current));
    setBanner("LABORATÓRIO · CAMPO DE PROVAS");
    setMessage("Arena reiniciada. Selecione uma tropa ou gere hostis.");
  };

  const updateSandboxSetting = (key, value) => {
    const next = { ...sandboxSettingsState, [key]: value };
    setSandboxSettingsState(next);
    setSandboxSettings(sessionRef.current, { [key]: value });
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const changeRulesMode = (rulesMode) => {
    const next = { ...sandboxSettingsState, rulesMode };
    setSandboxSettingsState(next);
    resetSandbox(next);
  };

  const changeSandboxMechanic = (mechanicMode) => {
    const next = { ...sandboxSettingsState, mechanicMode };
    setSandboxSettingsState(next);
    resetSandbox(next);
  };

  const handleSpawnEnemy = () => {
    const result = spawnEnemy(sessionRef.current, {
      type: selectedEnemy,
      row: spawnRow,
      count: spawnCount,
      variant: spawnAlpha ? "alpha" : undefined,
      groupInTile: spawnGrouped,
    });
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
    pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    setSnapshot(getSnapshot(sessionRef.current));
    setBanner(`${ENEMIES[selectedEnemy].label.toUpperCase()}${spawnAlpha ? " ALFA" : ""} · ROTA ${spawnRow + 1}`);
    setMessage(`${spawnCount} ${ENEMIES[selectedEnemy].label}${spawnCount > 1 ? "s" : ""} gerado${spawnCount > 1 ? "s" : ""} na rota ${spawnRow + 1}.`);
  };

  const handleForceExecutorCombo = (step) => {
    const result = forceExecutorCombo(sessionRef.current, step);
    setMessage(result.ok
      ? `Vórtice preparado para o Combo ${result.step} contra ${ENEMIES[result.target.type]?.label || "o alvo"}.`
      : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleForceLeviathan = (attack) => {
    const result = forceLeviathanAttack(sessionRef.current, attack);
    if (result.events?.length) {
      consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
      pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    }
    setMessage(result.ok ? `Leviatã preparado: ${attack}.` : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleDebugLeviathan = (action) => {
    const result = debugLeviathan(sessionRef.current, action);
    setMessage(result.ok ? `Leviatã: ${action}.` : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleForceColosso = (attack) => {
    const result = forceColossoAttack(sessionRef.current, attack);
    if (result.events?.length) {
      consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
      pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    }
    setMessage(result.ok ? `Colosso preparado: ${attack}.` : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleDebugColosso = (action) => {
    const result = debugColosso(sessionRef.current, action);
    if (result.events?.length) {
      consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
      pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    }
    setMessage(result.ok ? `Colosso: ${action}.` : result.reason);
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleClear = (target) => {
    clearSandboxEntities(sessionRef.current, target);
    particlesRef.current = [];
    graphicsRef.current = createGraphicsRuntime();
    setSnapshot(getSnapshot(sessionRef.current));
    setMessage(target === "enemies" ? "Todos os hostis foram removidos." : "Todas as tropas foram removidas.");
  };

  const handleInjureTroops = () => {
    const events = injureSandboxTroops(sessionRef.current, 10);
    consumeGraphicsEventsAtVisualTime(events, sessionRef.current.elapsed);
    pushEventParticles(particlesRef.current, events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    setSnapshot(getSnapshot(sessionRef.current));
    setMessage(events.length ? "Tropas vivas perderam 10 HP para teste de cura." : "Posicione tropas antes de aplicar dano.");
  };

  const handleOpenCapsule = () => {
    const result = openAdaptiveAidCapsule(sessionRef.current);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
    pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    setSelectedTroop(null);
    setRemoveMode(false);
    setMessage("Cápsula em abertura. Aguarde a transmissão.");
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleSimulateFortune = () => {
    const result = simulateAdaptiveAid(sessionRef.current, fortuneTier);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
    pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
    setSelectedTroop(null);
    setRemoveMode(false);
    setBanner("OPORTUNIDADE TÁTICA");
    setMessage("Transmissão aliada interceptada. Recursos de emergência disponíveis.");
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleFortuneChoice = (optionId) => {
    const result = selectAdaptiveAidOption(sessionRef.current, optionId);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    if (result.targeting) {
      setSelectedTroop(null);
      setRemoveMode(false);
      setActionMessage("Selecione uma rota para o ataque orbital.");
    } else {
      consumeGraphicsEventsAtVisualTime(result.events, sessionRef.current.elapsed);
      pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
      setMessage(`${result.option.label}: recurso aplicado.`);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const fortuneEligibleCount = sandbox ? getEligibleAdaptiveAidOptions(sessionRef.current, fortuneTier).length : 0;
  const fortuneDisabled = Boolean(snapshot.adaptiveAid.triggered || fortuneEligibleCount < 2);
  const fortuneReason = snapshot.adaptiveAid.triggered
    ? "Ajuda já simulada. Use Reiniciar para testar novamente."
    : fortuneEligibleCount < 2
      ? "Prepare o campo para disponibilizar ao menos duas recompensas úteis."
      : "Executa o fluxo completo da Cápsula da Colônia.";
  const fortuneStatus = snapshot.adaptiveAid.status;
  const fortuneBlocksIntermission = adaptiveAidBlocksIntermission(fortuneStatus);
  const fortuneTargeting = fortuneStatus === "targeting";
  const waveOutroActive = Boolean(snapshot.waveOutro?.status && !["idle", "completed"].includes(snapshot.waveOutro.status));
  const positionalTargeting = fortuneTargeting || Boolean(targetingDecision) || waveOutroActive;
  const convoyBriefingPending = Boolean(snapshot.convoy?.checkpointBriefingPending);
  const convoyCountdown = snapshot.convoy?.state === "sectorCountdown";

  useBattleHotkeys((event) => {
    const action = resolveBattleHotkey(event);
    if (!action || snapshot.outcome) return;
    if (convoyBriefingPending) return;
    if (paused && action.type !== "togglePause" && action.type !== "toggleFullscreen") return;

    // Deixa o navegador consumir Esc para sair da tela cheia sem cancelar a ferramenta.
    if (action.type === "cancelTool" && isFullscreen) return;

    event.preventDefault();

    if (action.type === "togglePause") {
      if (!fortuneTargeting) setPaused((current) => !current);
      return;
    }

    if (action.type === "selectTroop") {
      const troopId = loadout[action.loadoutIndex];
      const troop = TROOPS[troopId];
      if (!troopId || !troop) return;

      const availability = getTroopSlotAvailability({
        troopId,
        troop,
        snapshot,
        sandbox,
        sandboxSettings: sandboxSettingsState,
        positionalTargeting,
      });

      if (!availability.available) {
        setMessage(availability.message);
        return;
      }

      if (selectedTroop === troopId && !removeMode) {
        setSelectedTroop(null);
        setMessage("Mão livre ativada.");
        return;
      }

      setRemoveMode(false);
      setSelectedTroop(troopId);
      setMessage(
        troop.label + " selecionado · tecla " + (action.loadoutIndex + 1) + ".",
      );
      return;
    }

    if (action.type === "cancelTool") {
      if (targetingDecision || sessionRef.current.adaptiveAid?.status === "targeting") return;
      setSelectedTroop(null);
      setRemoveMode(false);
      setMessage("Ferramenta cancelada · mão livre ativada.");
      return;
    }

    if (action.type === "toggleFullscreen") {
      if (!fullscreenSupported) {
        setMessage("Tela cheia não é suportada neste navegador.");
        return;
      }
      handleToggleFullscreen();
      return;
    }

    if (action.type === "toggleRemove") {
      if (positionalTargeting) return;
      setSelectedTroop(null);
      setRemoveMode((current) => {
        const next = !current;
        setMessage(next ? "Modo de remoção ativado · tecla R." : "Modo de remoção desativado.");
        return next;
      });
      return;
    }

    if (action.type === "startWave") {
      const hotkeyCanStartWave = !sandbox
        && snapshot.preparing
        && !snapshot.pendingDecision
        && !waveOutroActive
        && !targetingDecision
        && !snapshot.outcome
        && !fortuneBlocksIntermission;

      if (hotkeyCanStartWave) handleStartWave();
      else setMessage("A onda não pode ser iniciada agora.");
      return;
    }

    if (action.type === "adjustSpeed") {
      if (paused || fortuneTargeting) return;
      const nextSpeed = getNextBattleSpeed(speed, sandbox, action.direction);
      if (nextSpeed !== speed) {
        setSpeed(nextSpeed);
        setMessage("Velocidade alterada para " + nextSpeed + "×.");
      }
    }
  }, loading.ready);

  if (!loading.ready) {
    const loadingFailed = loading.stage === "error";

    return (
      <div
        className="battle-loader"
        style={{
          "--arena-image": `url(${getArenaUrl(phase.arenaId)})`,
          "--arena-primary": phase.palette.primary,
        }}
      >
        <div className="loader-scrim" />
        <div className="loader-content">
          <div className="loader-mark">GD</div>
          <span className="eyebrow">{phase.name}</span>
          <h2>
            {loadingFailed
              ? "Falha ao preparar campo tático"
              : "Preparando campo tático"}
          </h2>
          <div className="progress-track">
            <span
              style={{
                width: `${loading.percent}%`,
              }}
            />
          </div>
          <p>
            {loadingFailed
              ? loading.error
              : `${loading.percent}% · sincronizando arena, loadout e hostis`}
          </p>
          {loadingFailed && (
            <button
              type="button"
              className="battle-loader-exit"
              onClick={onExit}
            >
              VOLTAR À CAMPANHA
            </button>
          )}
        </div>
      </div>
    );
  }

  const tide = snapshot.tideCycle;
  const tidePressureLabel = tide?.pressureScore >= .7
    ? "PRESSÃO ALTA"
    : tide?.pressureScore >= .35
      ? "PRESSÃO MODERADA"
      : "PRESSÃO BAIXA";
  const tideBanner = tide?.state === "warningAdvance"
    ? `A MARÉ ESTÁ AVANÇANDO · NÍVEL ${tide.currentLevel}→${tide.targetLevel} · ${(tide.remainingMs / 1000).toFixed(1)}s`
    : tide?.state === "rising"
      ? `ÁGUA AVANÇANDO · ${tide.warningCells.length} CÉLULAS EM RISCO · ${(tide.remainingMs / 1000).toFixed(1)}s`
      : tide?.state === "warningRetreat"
        ? `A MARÉ ESTÁ PERDENDO FORÇA · ${(tide.remainingMs / 1000).toFixed(1)}s`
        : tide?.state === "receding"
          ? `A MARÉ ESTÁ RECUANDO · NOVAS POSIÇÕES SERÃO LIBERADAS · ${(tide.remainingMs / 1000).toFixed(1)}s`
          : tide?.state === "drying"
            ? `ZONA INTERMARÉ SECANDO · ${(tide.remainingMs / 1000).toFixed(1)}s`
            : tide?.enabled
              ? `MARÉ NÍVEL ${tide.currentLevel}/${tide.maximumLevel} · ${tidePressureLabel} · ${tide.safeCells} CÉLULAS SEGURAS`
              : null;
  const sandstormBanner = snapshot.sandstorm?.state === "warning"
    ? `TEMPESTADE DE AREIA SE APROXIMANDO · ${(snapshot.sandstorm.startsInMs / 1000).toFixed(1)}s`
    : snapshot.sandstorm?.state === "active"
      ? `TEMPESTADE DE AREIA · ALCANCE À DISTÂNCIA -1 · ${(snapshot.sandstorm.remainingMs / 1000).toFixed(1)}s`
      : snapshot.sandstorm?.state === "recovering"
        ? `TEMPESTADE DISSIPANDO · ${(snapshot.sandstorm.remainingMs / 1000).toFixed(1)}s`
        : null;
  const wind = snapshot.windCurrent;
  const windRoute = wind?.direction === "lateral" && Number.isInteger(wind.sourceRow)
    ? ` · ROTA ${wind.sourceRow + 1}${Number.isInteger(wind.targetRow) && wind.targetRow >= 0 && wind.targetRow < FIELD.rows ? ` → ROTA ${wind.targetRow + 1}` : " → FORA DO CAMPO"}`
    : wind?.selectedRows?.length
      ? ` · ROTAS ${wind.selectedRows.map((row) => row + 1).join(", ")}`
      : "";
  const windLabel = wind?.direction === "headwind"
    ? "CORRENTE CONTRÁRIA"
    : wind?.direction === "tailwind"
      ? "VENTO FAVORÁVEL"
      : "RAJADA LATERAL";
  const windBanner = wind?.state === "warning"
    ? `${windLabel} SE FORMANDO${windRoute} · ${(wind.startsInMs / 1000).toFixed(1)}s`
    : wind?.state === "active"
      ? `${windLabel}${windRoute} · ${(wind.remainingMs / 1000).toFixed(1)}s`
      : wind?.state === "recovering"
        ? `CORRENTE DISSIPANDO · ${(wind.remainingMs / 1000).toFixed(1)}s`
        : null;
  const thermalBanner = getThermalBannerText(phase, snapshot);
  const alphaPressure = snapshot.alphaPressure;
  const alphaWarning = alphaPressure?.pendingSpawns?.length
    ? `⚠ PRESENÇA ALPHA DETECTADA · ROTA ${alphaPressure.pendingSpawns[0].row + 1}`
    : alphaPressure?.enabled
      ? `PRESSÃO ALPHA · PRÓXIMA CHECAGEM ${Math.ceil((alphaPressure.nextCheckInMs || 0) / 1000)}s · TROPAS ${alphaPressure.troopCountCurrent}`
      : null;
  const canStartWave = !sandbox
    && snapshot.preparing
    && !snapshot.pendingDecision
    && !waveOutroActive
    && !targetingDecision
    && !snapshot.outcome
    && !fortuneBlocksIntermission
    && !convoyBriefingPending;
  const integrityPercent = Math.round(snapshot.integrity / Math.max(1, snapshot.integrityMax) * 100);
  const hostileCount = snapshot.enemies + snapshot.queued;
  const convoyAttackSummary = snapshot.progressionMode === "convoy"
    ? getConvoyAttackSummary(snapshot.convoy, hostileCount)
    : null;
  const threatSummary = snapshot.upcomingThreat
    ? ` · ${snapshot.upcomingThreat.isAlpha ? "AMEAÇA ALFA" : snapshot.upcomingThreat.isBoss ? "CHEFE" : "AMEAÇA"} NA ROTA ${snapshot.upcomingThreat.row + 1}`
    : "";
  const defaultContainmentSummary = sandbox
    ? `CAMPO DE PROVAS · ${snapshot.enemies} HOSTIS EM CAMPO`
    : `${snapshot.progressionMode === "convoy" ? "SETOR" : "ONDA"} ${snapshot.wave}/${snapshot.totalWaves} · ${hostileCount} HOSTIS RESTANTES${threatSummary}`;
  const containmentSummary = waveOutroActive
    ? "PERÍMETRO SEGURO · SISTEMAS EM REORGANIZAÇÃO"
    : snapshot.adaptiveAid.status === "targeting"
    ? "ATAQUE ORBITAL · PASSE O MOUSE E CLIQUE EM UMA ROTA"
    : snapshot.adaptiveAid.status === "incoming"
      ? "OPORTUNIDADE TÁTICA · CÁPSULA EM APROXIMAÇÃO"
      : snapshot.adaptiveAid.status === "landed"
        ? "OPORTUNIDADE TÁTICA · RECURSOS DE EMERGÊNCIA DISPONÍVEIS"
        : targetingDecision?.targetType === "columnBlock"
          ? "FORMAÇÃO AVANÇADA · PASSE O MOUSE E CLIQUE EM TRÊS COLUNAS"
          : targetingDecision
            ? "SELEÇÃO DE ROTA · CLIQUE PARA FORTIFICAR"
            : convoyAttackSummary || alphaWarning || tideBanner || windBanner || sandstormBanner || thermalBanner || defaultContainmentSummary;
  const inspectedTroopId = resolveInspectedTroopId({ hoveredTroop, selectedTroop });
  const inspectedTroop = inspectedTroopId ? TROOPS[inspectedTroopId] : null;
  const overlayModel = useMemo(() => getOverlayModel({ fortuneBlocksIntermission }), [getOverlayModel, fortuneBlocksIntermission]);

  return (
    <section ref={battleShellRef} className={`battle-shell environment-${phase.environment} ${phase.chapterId === "chapter_02" ? "chapter-2-battle" : ""} ${phase.chapterId === "chapter_03" ? "chapter-3-battle" : ""} ${phase.chapterId === "chapter_04" ? "chapter-4-battle" : ""} ${phase.chapterId === "chapter_06" ? "chapter-6-battle" : ""} ${phase.chapterId === "chapter_07" ? "chapter-7-battle" : ""} ${sandbox ? "sandbox-battle" : ""}`}>
      <header className="battle-topbar">
        <div className="battle-operation"><span>OPERAÇÃO</span><h1>{sandbox ? "CAMPO DE PROVAS" : phase.name}</h1></div>
          <div className="battle-stats">
          <div className={snapshot.energyPulse ? "energy-pulse" : ""}><span>Energia</span><strong className="cyan">{sandboxSettingsState?.rulesMode === "free" ? "∞" : `${snapshot.energy}/${snapshot.energyMax}`}</strong></div>
            {snapshot.progressionMode === "convoy" && <div className="convoy-reserve-stat"><span>Veículo</span><strong>🚚⚡ {snapshot.convoy?.reserve} / {snapshot.convoy?.reserveMax}</strong></div>}
            <div><span>Supply</span><strong>{sandboxSettingsState?.rulesMode === "free" ? "∞" : `${snapshot.supply}/${snapshot.supplyMax}`}</strong></div>
          <div><span>Integridade</span><strong className={integrityPercent <= 40 ? "danger" : "success"}>{integrityPercent}%</strong></div>
        </div>
        
        <div className="battle-actions">
          <button type="button" className="icon-button battle-control-button" disabled={fortuneTargeting || convoyBriefingPending} aria-label={paused ? "Continuar batalha" : "Pausar batalha"} aria-pressed={paused} aria-keyshortcuts="Space" title={paused ? "Continuar · Espaço" : "Pausar · Espaço"} onClick={() => paused ? controller.actions.resume() : controller.actions.pause()}>{paused ? <PlayIcon /> : <PauseIcon />}</button>
          <button type="button" className="speed-button" aria-label="Alterar velocidade da batalha" aria-keyshortcuts="+ -" title="Velocidade · teclas + e -" disabled={paused || fortuneTargeting || convoyBriefingPending} onClick={() => controller.actions.changeSpeed((() => {
            const speeds = sandbox ? [0.5, 1, 2, 4] : [1, 2];
            return speeds[(speeds.indexOf(speed) + 1) % speeds.length];
          })())}>{speed}×</button>
          <button
            type="button"
            className="icon-button battle-control-button fullscreen-button"
            disabled={!fullscreenSupported || convoyBriefingPending}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}
            aria-pressed={isFullscreen}
            aria-keyshortcuts="F"
            title={isFullscreen ? "Sair da tela cheia · F ou Esc" : "Tela cheia · F"}
            onClick={handleToggleFullscreen}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
          </button>
          <button type="button" className="release-tool-button topbar-tool-button" disabled={positionalTargeting || convoyBriefingPending} aria-keyshortcuts="Escape" onClick={releaseMouseTool} title="Mão livre · Esc ou botão direito no campo">✥ Mão livre</button>
          <button type="button" className="ghost-button" disabled={convoyBriefingPending} onClick={handleBattleExit}>Sair</button>
        </div>
      </header>

      <div className="battle-main">
        <aside className={`troop-rail ${positionalTargeting || convoyBriefingPending || convoyCountdown ? "interaction-locked" : ""}`} aria-disabled={positionalTargeting || convoyBriefingPending || convoyCountdown} inert={positionalTargeting || convoyBriefingPending || convoyCountdown ? true : undefined}>
          <div className="rail-heading"><span>LOADOUT</span><small>{sandboxSettingsState?.rulesMode === "free" ? "∞ ⚡ · ∞ SUP" : `${snapshot.energy} ⚡ · ${snapshot.supply} SUP`}</small></div>
          <div className="troop-grid">
            {loadout.map((troopId, index) => {
            const troop = TROOPS[troopId];
            const deployment = snapshot.deploymentStats[troopId];
            const cooldown = snapshot.cooldowns[troopId] || 0;
            const coolingDown = cooldown > 0;
            const deploymentLimitReached = deployment.limitReached && troopId !== "droneSentinela";
            const cooldownEnding = coolingDown && cooldown <= 800;
            const lacksEnergy = snapshot.energy < deployment.price;
            const lacksSupply = snapshot.supply < troop.supply;
            const freeMode = sandbox && sandboxSettingsState.rulesMode === "free";
            const disabled = positionalTargeting || convoyBriefingPending || convoyCountdown || (!freeMode && (lacksEnergy || lacksSupply || coolingDown || deploymentLimitReached));
            const cooldownProgress = getDeployCooldownProgress(cooldown, deployment.deployCooldownMs);
            const cooldownSeconds = (cooldown / 1000).toFixed(1);
            const unavailableReason = freeMode ? "" : lacksEnergy ? "energia insuficiente" : lacksSupply ? "supply insuficiente" : "";
            const slotLabel = coolingDown
              ? `${troop.label}, recarregando, ${cooldownSeconds} segundos restantes`
              : unavailableReason ? `${troop.label}, ${unavailableReason}` : `${troop.label}, disponível para implantação`;
            const previewUrl = getTroopPreviewUrl(troopId);
            return <button key={troopId} className={`troop-slot ${selectedTroop === troopId && !removeMode ? "selected" : ""} ${coolingDown ? "cooling-down" : ""} ${cooldownEnding ? "cooldown-ending" : ""} ${unavailableReason ? "resource-locked" : ""}`} style={{ "--troop-color": troop.color }} disabled={disabled} aria-label={slotLabel} aria-keyshortcuts={String(index + 1)} aria-describedby={inspectedTroopId === troopId ? `troop-help-${troopId}` : undefined} onMouseEnter={() => setHoveredTroop(troopId)} onMouseLeave={() => setHoveredTroop(null)} onClick={() => { setRepositionTroopId(null); setRemoveMode(false); setSelectedTroop(troopId); }}>
              <span className="troop-hotkey" aria-hidden="true">{index + 1}</span>
              <span className="troop-portrait" style={{ "--cooldown-progress": `${cooldownProgress * 360}deg` }}>
                {previewUrl && <img src={previewUrl} alt="" aria-hidden="true" />}
                {coolingDown && <span className="cooldown-sweep" aria-hidden="true" />}
              </span>
              <span className="troop-details"><b>{troop.label}</b><small>{troop.role}</small></span>
              <span className="slot-cost">{freeMode ? "∞" : `⚡${deployment.price}`}<small>{freeMode ? "LIVRE" : deploymentLimitReached ? `${deployment.activeCount}/${deployment.maxDeployed}` : coolingDown ? `${cooldownSeconds}s` : `S${troop.supply}`}</small></span>
            </button>;
            })}
          </div>
          <button type="button" disabled={positionalTargeting || convoyBriefingPending || convoyCountdown} aria-keyshortcuts="R" className={`remove-button ${removeMode ? "active" : ""}`} onClick={() => { setRemoveMode((value) => !value); setSelectedTroop(null); }}>⌫ Remover · {Math.round(snapshot.refundRate * 100)}% <kbd>R</kbd></button>
          <div className="battle-hotkey-help" aria-label="Atalhos da batalha">
            <span><kbd>1–9</kbd> Tropas</span><span><kbd>Espaço</kbd> Pausa</span><span><kbd>F</kbd> Tela cheia</span><span><kbd>R</kbd> Remover</span><span><kbd>Esc</kbd> Cancelar</span><span><kbd>Enter</kbd> Onda</span>
          </div>
          {inspectedTroop && <div id={`troop-help-${inspectedTroopId}`} className="troop-tooltip" role="tooltip" style={{ "--troop-color": inspectedTroop.color }}>
            <b>{inspectedTroop.label}</b>
            <span>{inspectedTroop.role}</span>
            <p>{inspectedTroop.description}</p>
          </div>}
        </aside>

        <div className="canvas-wrap">
          <div className="battle-canvas-stage">
            <div className={`containment-summary ${convoyAttackSummary ? "convoy-danger" : windBanner ? "wind-current-banner" : sandstormBanner ? "sandstorm-banner" : ""}`}>
              {canStartWave
                ? <button type="button" className="start-wave containment-start-wave" aria-keyshortcuts="Enter" title={snapshot.progressionMode === "convoy" ? `Iniciar setor ${snapshot.convoy?.nextSector || 1} · Enter` : "Iniciar onda · Enter"} onClick={handleStartWave}>{snapshot.progressionMode === "convoy" ? `INICIAR SETOR ${snapshot.convoy?.nextSector || 1}` : `INICIAR ONDA ${snapshot.wave}`}<span>{snapshot.progressionMode === "convoy" ? "4 setores · 3 checkpoints" : `${waveSpawnCount(phase, snapshot.wave - 1, snapshot.nextWaveEnemyCountFactor)} assinaturas`}</span></button>
                : <span>{containmentSummary}</span>}
            </div>
            <BattleCanvas canvasRef={canvasRef} ready={loading.ready} onFrame={(now) => frameLoopRef.current?.(now)} onClick={handleCanvasClick} onContextMenu={handleCanvasContextMenu} onPointerMove={handleCanvasMove} onPointerLeave={(event) => {
              hoveredCellRef.current = null;
              if (sessionRef.current.pendingPositionalDecision) sessionRef.current.pendingPositionalDecision.preview = null;
              setEnergyPickupPointer(sessionRef.current, null);
              event.currentTarget.style.cursor = "default";
            }} label={snapshot.progressionMode === "convoy" ? "Campo de escolta com quatro rotas de combate e uma rota central de transporte" : "Campo de batalha em cinco rotas"} />
            {snapshot.adaptiveAid.status === "landed" && <CapsuleInteractionButton capsule={snapshot.adaptiveAid.capsule} onOpen={handleOpenCapsule} />}
            <BattleOverlays
              phase={phase}
              settings={settings}
              model={overlayModel}
              actions={{
                onCheckpointReward: handleCheckpointReward,
                onCheckpointContinue: handleCheckpointContinue,
                onActivateDematerializationPulse: handleActivateDematerializationPulse,
                onActivateColossusSpecial: activateColossusSpecial,
              }}
            />
          </div>
          {graphicsMetrics && <div className="graphics-metrics">
            <b>{graphicsMetrics.fps.toFixed(0)} FPS · {graphicsMetrics.adaptiveLevel}</b>
            <span>F {graphicsMetrics.frameMs.toFixed(1)} ms</span>
            <span>S {graphicsMetrics.stepMs.toFixed(1)} ms</span>
            <span>D {graphicsMetrics.drawMs.toFixed(1)} ms</span>
            <span>P {graphicsMetrics.presentMs.toFixed(1)} ms</span>
            <span>A {graphicsMetrics.arenaMs.toFixed(1)} ms</span>
            <span>FX {graphicsMetrics.effectMs.toFixed(1)} ms</span>
            <span>Ent {graphicsMetrics.entityMs.toFixed(1)} ms</span>
            <span>Em {graphicsMetrics.emissiveMs.toFixed(1)} ms</span>
            <span>E {graphicsMetrics.activeEntities}</span>
            <span>Part {graphicsMetrics.particles}</span>
            <span>Dec {graphicsMetrics.decals}</span>
            <span>V {graphicsMetrics.visualEntities}</span>
          </div>}
        </div>

        {sandbox && <SandboxPanel
          selectedEnemy={selectedEnemy}
          onSelectEnemy={setSelectedEnemy}
          row={spawnRow}
          onRow={setSpawnRow}
          count={spawnCount}
          onCount={setSpawnCount}
          alpha={spawnAlpha}
          onAlpha={setSpawnAlpha}
          grouped={spawnGrouped}
          onGrouped={setSpawnGrouped}
          settings={sandboxSettingsState}
          onSetting={updateSandboxSetting}
          onRulesMode={changeRulesMode}
          mechanicOptions={Object.entries(phase.sandboxMechanics || {}).map(([id, profile]) => ({ id, label: profile.label }))}
          onMechanic={changeSandboxMechanic}
          onSpawn={handleSpawnEnemy}
          onForceCombo={handleForceExecutorCombo}
          onForceLeviathan={handleForceLeviathan}
          onDebugLeviathan={handleDebugLeviathan}
          onForceColosso={handleForceColosso}
          onDebugColosso={handleDebugColosso}
          onInjure={handleInjureTroops}
          onClear={handleClear}
          onReset={() => resetSandbox()}
          fortuneTier={fortuneTier}
          onFortuneTier={setFortuneTier}
          onSimulateFortune={handleSimulateFortune}
          fortuneDisabled={fortuneDisabled}
          fortuneReason={fortuneReason}
          disabled={fortuneTargeting}
          magmaEnabled={phase.chapterId === "chapter_06" && Boolean(sessionRef.current.phase.magmaTerrain)}
        />}
      </div>

      {paused && <BattlePauseMenu phase={phase} snapshot={snapshot} loadout={loadout} reduceMotion={settings.reduceMotion} onContinue={() => setPaused(false)} onRestart={async () => { await new Promise((resolve) => window.setTimeout(resolve, 280)); resetBattleRuntime(); }} onExit={handleBattleExit} />}

      {snapshot.adaptiveAid.status === "choosing"
        ? <FortuneChoiceModal tier={snapshot.adaptiveAid.triggerTier} options={snapshot.adaptiveAid.availableOptions} onChoose={handleFortuneChoice} />
        : snapshot.pendingDecision && !targetingDecision && !fortuneBlocksIntermission && !waveOutroActive
          ? <DecisionModal level={snapshot.pendingDecisionLevel} options={snapshot.pendingDecision} onChoose={handleDecision} />
          : null}
    </section>
  );
}

export default BattleScreen;
