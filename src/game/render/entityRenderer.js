import { ENEMIES, TROOPS } from "../content.js";
import { CELL, getTroopRangePenaltyTiles } from "../battleModel.js";
import { resolveTroopFrame } from "../assets/battleAssetLoader.js";
import { getThermalPlatformVisual } from "../thermalPlatformRenderer.js";
import { getHealthVisual, getHitReaction } from "../graphicsRuntime.js";
import { buildBattleRenderRows, getAnchoredSpriteRect, getDroneSentinelaLayout, getEnemyAnimation, getEnemySpriteRect, getJanoDroneAnimation, getMuzzleWorldPosition, getTroopAnimation, getTroopAttackVisual, getTroopFrameAnchor, isEnemyFrozen, writeEnemyVisualPosition } from "../visualGeometry.js";
import { drawContactShadow } from "../arenaRenderer.js";
import { drawCachedSpriteHalo, drawWetReflections, getSpriteFilter, getTroopSpriteFilter } from "../graphicsRenderer.js";
import { drawThermalBurnBackLayer, drawThermalBurnFrontLayer, getTroopThermalVisualState } from "../thermalBurningTroopRenderer.js";
import { drawExecutorComboIndicator } from "../executorArcoRenderer.js";
import { getColossoAnimation } from "../colossoCaldeira.js";
import { drawColossoBossHealth, drawColossoCaldeira } from "../colossoCaldeiraRenderer.js";
import { drawFrozenEnemyEffect, drawStunnedEnemyEffect } from "../projectileRenderer.js";
import { drawSprite, drawSpriteInRect, getTroopVisualEntity } from "./battleSceneRenderer.js";
import { drawAbyssCharge, drawLatchedGarravinhaMarker, drawLeviathanBossEffects, drawLeviathanBossHealth, drawProceduralGlassEnemy, drawRasgaCeusShadow, drawRasgaCeusTargetMarker, drawRasgamarUnderwaterShadow, drawStructuralRupture, isLeviathanShadowOnly, isRasgamarShadowOnly, silicaDiggerEmergenceProgress } from "./enemyEffectsRenderer.js";
import { getEnemyVisualEffects } from "./enemyEffectsRegistry.js";
import { getTroopVisualEffects, registerTroopVisualEffects } from "./troopEffectsRegistry.js";

const troopFrameCountsCache = new WeakMap();
const enemyFrameCountsCache = new WeakMap();
const missingColossoAssetWarnings = new Set();

function getTroopFrameCounts(troopAssets) {
  let counts = troopFrameCountsCache.get(troopAssets);
  if (counts) return counts;
  counts = {};
  for (const state in troopAssets) counts[state] = troopAssets[state]?.length || 0;
  troopFrameCountsCache.set(troopAssets, counts);
  return counts;
}

export function getEnemyFrameCounts(enemyAssets) {
  let counts = enemyFrameCountsCache.get(enemyAssets);
  if (counts) return counts;
  counts = {};
  for (const state in enemyAssets) counts[state] = enemyAssets[state]?.length || 0;
  enemyFrameCountsCache.set(enemyAssets, counts);
  return counts;
}

export function drawHealth(ctx, entity, runtime, now, width = 54, offset = 47, accent = null, battleElapsed = now) {
  const { ratio, trail } = getHealthVisual(runtime, entity, now); const x = entity.x - width / 2; const y = Math.max(10, entity.y - offset);
  ctx.fillStyle = "rgba(2,6,23,.92)"; ctx.fillRect(x - 2, y - 2, width + 4, 10); ctx.strokeStyle = accent || "rgba(186,230,253,.34)"; ctx.lineWidth = 1; ctx.strokeRect(x - 1.5, y - 1.5, width + 3, 9);
  ctx.fillStyle = "rgba(248,113,113,.72)"; ctx.fillRect(x + 1, y + 1, (width - 2) * trail, 4); ctx.fillStyle = accent || (ratio > .55 ? "#34d399" : ratio > .25 ? "#fbbf24" : "#fb7185"); ctx.fillRect(x + 1, y + 1, (width - 2) * ratio, 4);
  const baseMaxHp = entity.baseMaxHp ?? entity.maxHp; const bonusMaxHp = entity.fortificationBonusMaxHp ?? 0; const bonusCurrentHp = Math.max(0, Math.min(bonusMaxHp, entity.hp - baseMaxHp));
  if (bonusCurrentHp > 0 && bonusMaxHp > 0) { const blueWidth = (width - 2) * Math.min(.2, bonusCurrentHp / baseMaxHp); const gradient = ctx.createLinearGradient(x + 1, y, x + 1 + blueWidth, y); gradient.addColorStop(0, "#67e8f9"); gradient.addColorStop(1, "#38bdf8"); ctx.fillStyle = gradient; ctx.fillRect(x + 1, y + 1, blueWidth, 4); ctx.strokeStyle = "rgba(224,242,254,.9)"; ctx.beginPath(); ctx.moveTo(x + 1 + blueWidth, y); ctx.lineTo(x + 1 + blueWidth, y + 6); ctx.stroke(); }
  if (entity.shieldMax > 0 && entity.shield > 0) { const shieldRatio = Math.max(0, Math.min(1, entity.shield / entity.shieldMax)); ctx.fillStyle = "rgba(15,23,42,.95)"; ctx.fillRect(x - 1, y + 8, width + 2, 5); ctx.fillStyle = "#a78bfa"; ctx.shadowBlur = 6; ctx.shadowColor = "#7fffd4"; ctx.fillRect(x, y + 9, width * shieldRatio, 3); ctx.shadowBlur = 0; }
  const healAge = battleElapsed - entity.lastNaniteHealAt;
  if (Number.isFinite(healAge) && healAge >= 0 && healAge < 520) { const fade = 1 - healAge / 520; ctx.save(); ctx.strokeStyle = `rgba(52,211,153,${.85 * fade})`; ctx.shadowBlur = 10; ctx.shadowColor = "#2dd4bf"; ctx.strokeRect(x - 3, y - 3, width + 6, 12); ctx.restore(); }
}

export function activeNaniteHealers(session, targetId) { return session.troops.filter((troop) => !troop.dead && troop.type === "medicaNanites" && troop.state === "healing" && troop.healTargetId === targetId); }

export function drawNaniteHealingBeams(ctx, session, settings) {
  for (const medic of session.troops) {
    if (medic.dead || medic.type !== "medicaNanites" || medic.state !== "healing" || !medic.healTargetId) continue;
    const target = session.troops.find((troop) => troop.id === medic.healTargetId && !troop.dead); if (!target) continue;
    const origin = getMuzzleWorldPosition(medic, TROOPS.medicaNanites, 0); const end = { x: target.x, y: target.y - 18 }; const sway = settings.reduceMotion ? 0 : Math.sin(session.elapsed / 120 + medic.col) * 2.5;
    const drawBeam = () => { ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.quadraticCurveTo((origin.x + end.x) / 2, (origin.y + end.y) / 2 + sway, end.x, end.y); ctx.stroke(); };
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(45,212,191,.16)"; ctx.lineWidth = 13; drawBeam(); ctx.strokeStyle = "rgba(52,211,153,.7)"; ctx.lineWidth = 6; drawBeam(); ctx.strokeStyle = "rgba(236,253,245,.95)"; ctx.lineWidth = 2; drawBeam();
    if (!settings.reduceMotion) for (let index = 0; index < 4; index += 1) { const progress = (session.elapsed / 700 + index / 4) % 1; const x = origin.x + (end.x - origin.x) * progress; const y = origin.y + (end.y - origin.y) * progress + Math.sin(progress * Math.PI) * sway; ctx.fillStyle = index % 2 ? "#6ee7b7" : "#ecfdf5"; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}

export function drawNaniteTargetEffect(ctx, entity, session, settings) {
  if (!activeNaniteHealers(session, entity.id).length) return; const pulse = settings.reduceMotion ? 1 : .94 + Math.sin(session.elapsed / 140) * .06;
  ctx.save(); ctx.strokeStyle = "rgba(52,211,153,.82)"; ctx.fillStyle = "rgba(45,212,191,.08)"; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = "#34d399"; ctx.beginPath(); ctx.ellipse(entity.x, entity.y + 42, 31 * pulse, 9 * pulse, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(entity.x, entity.y - 9, 29, 43, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

export function drawTroopCooldown(ctx, entity, session, settings) {
  if (entity.state !== "cooldown") return; const isNaniteMedic = entity.type === "medicaNanites"; const isLeviathanHunter = entity.type === "cacadorLeviatas"; if (!isNaniteMedic && !isLeviathanHunter) return;
  const fallbackDuration = isNaniteMedic ? TROOPS.medicaNanites.healCooldownMs : TROOPS.cacadorLeviatas.cooldownMs; const activeDuration = Number(entity.cooldownEndsAt) - Number(entity.cooldownStartedAt); const duration = Math.max(1, Number.isFinite(activeDuration) && activeDuration > 0 ? activeDuration : fallbackDuration); const progress = Math.max(0, Math.min(1, 1 - (entity.cooldownEndsAt - session.elapsed) / duration)); const indicatorY = entity.y - (isLeviathanHunter ? 77 : 62);
  ctx.save(); ctx.strokeStyle = "rgba(45,212,191,.28)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(entity.x, indicatorY, 10, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "#5eead4"; ctx.shadowBlur = 8; ctx.shadowColor = "#2dd4bf"; ctx.beginPath(); ctx.arc(entity.x, indicatorY, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke(); if (!settings.reduceMotion) { ctx.fillStyle = "#ccfbf1"; ctx.font = "700 8px Chakra Petch, system-ui"; ctx.textAlign = "center"; ctx.fillText(isLeviathanHunter ? "RESFRIA" : "RECARGA", entity.x, indicatorY - 17); } ctx.restore();
}

export function drawLeviathanStateEffect(ctx, entity, session, settings) {
  if (entity.type !== "cacadorLeviatas" || entity.state !== "charging") return;
  const config = TROOPS.cacadorLeviatas;
  const duration = Math.max(1, entity.stateEndsAt - entity.stateStartedAt);
  const progress = Math.max(0, Math.min(1, (session.elapsed - entity.stateStartedAt) / duration));
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const pulse = settings.reduceMotion ? 1 : 0.86 + Math.sin(session.elapsed / 70) * 0.14;
  ctx.fillStyle = `rgba(56,189,248,${0.12 + progress * 0.3})`; ctx.shadowColor = config.color; ctx.shadowBlur = 12 + progress * 24;
  ctx.beginPath(); ctx.arc(entity.x - 25, entity.y - 54, (8 + progress * 10) * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

export function drawPhysicalStunEffect(ctx, troop, elapsed, settings) {
  if (elapsed >= (troop.controlStunnedUntil || 0)) return;
  const pulse = settings.reduceMotion ? 0 : Math.sin(elapsed / 95) * 2;
  const stars = [{ x: -14, y: -73, scale: .72, phase: 0 }, { x: 0, y: -82, scale: 1, phase: 1.2 }, { x: 14, y: -73, scale: .72, phase: 2.4 }];
  ctx.save(); ctx.fillStyle = "#fde047"; ctx.strokeStyle = "#713f12"; ctx.lineWidth = 1.5; ctx.lineJoin = "round";
  for (const star of stars) {
    const spin = settings.reduceMotion ? 0 : Math.sin(elapsed / 140 + star.phase) * .18;
    const x = troop.x + star.x; const y = troop.y + star.y + pulse * Math.sin(star.phase + elapsed / 120);
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.beginPath();
    for (let index = 0; index < 10; index += 1) { const radius = index % 2 === 0 ? 8 * star.scale : 3.4 * star.scale; const angle = -Math.PI / 2 + index * Math.PI / 5; const px = Math.cos(angle) * radius; const py = Math.sin(angle) * radius; if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

export function drawSporeConfusionEffect(ctx, troop, elapsed, settings) {
  if (elapsed >= (troop.sporeConfusedUntil || 0)) return;
  ctx.save(); ctx.fillStyle = "#d9f99d"; ctx.strokeStyle = "#365314"; ctx.lineWidth = 1;
  for (let index = 0; index < 3; index += 1) {
    const angle = settings.reduceMotion ? index * 2.1 : elapsed / 220 + index * 2.1;
    const x = troop.x + Math.cos(angle) * 16; const y = troop.y - 62 + Math.sin(angle) * 7;
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

export function drawAresThermalShield(ctx, troop, settings) {
  if (troop.type !== "aresT") return;
  const max = Math.max(1, TROOPS.aresT.thermalShield.maxHp);
  const current = Math.max(0, Math.min(max, Number(troop.thermalShieldHp) || 0));
  const pips = Math.ceil(max / 3); const filled = Math.round(current / max * pips);
  ctx.save(); ctx.globalAlpha = current > 0 ? .95 : .42; ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = settings.reduceMotion ? 3 : 7;
  for (let index = 0; index < pips; index += 1) {
    const x = troop.x + (index - (pips - 1) / 2) * 8;
    ctx.fillStyle = index < filled ? "#67e8f9" : "rgba(8,47,73,.8)"; ctx.strokeStyle = "#cffafe"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, troop.y - 76); ctx.lineTo(x + 3, troop.y - 72); ctx.lineTo(x, troop.y - 68); ctx.lineTo(x - 3, troop.y - 72); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function getPreviewFrameCounts(troopAssets) {
  const counts = {};
  for (const state in troopAssets) counts[state] = troopAssets[state]?.length || 0;
  return counts;
}

export function drawTroopPlacementPreview(ctx, assets, selectedTroop, preview, elapsed, settings) {
  if (!preview || !selectedTroop) return;
  const config = TROOPS[selectedTroop]; const troopAssets = assets.troops[selectedTroop] || {};
  const entity = { ...preview, type: selectedTroop, hp: config.hp, maxHp: config.hp, state: "idle", stateStartedAt: 0, electricParalyzedUntil: 0, lastAttackAt: -Infinity, droneCount: preview.droneCount || (selectedTroop === "droneSentinela" ? 1 : undefined), droneState: "idle", droneStateStartedAt: 0 };
  const visualEntity = getTroopVisualEntity(entity, config);
  const animation = getTroopAnimation(entity, config, elapsed, { idle: troopAssets.idle?.length, attack: troopAssets.attack?.length, attackMine: troopAssets.attackMine?.length, attackGun: troopAssets.attackGun?.length, defense: troopAssets.defense?.length, transitionIn: troopAssets.transitionIn?.length, transitionOut: troopAssets.transitionOut?.length });
  const frames = troopAssets[animation.state] || troopAssets.idle || troopAssets.defense || [];
  const image = frames[animation.frame % Math.max(1, frames.length)]; const frameAnchor = getTroopFrameAnchor(config, animation.state, animation.frame);
  const height = getTroopAttackVisual(entity, config)?.height || config.attackVisual?.height || (selectedTroop === "muralhaReforcada" ? 112 : 126);
  ctx.save(); ctx.globalAlpha = preview.valid ? .32 : .18; drawContactShadow(ctx, entity, 1, settings); ctx.restore();
  const opacity = preview.valid ? .45 : .27; const filter = preview.valid ? `brightness(1.15) drop-shadow(0 0 8px ${config.color})` : "grayscale(.55) sepia(1) saturate(6) hue-rotate(310deg) brightness(.95) drop-shadow(0 0 7px #fb7185)";
  if (!drawSprite(ctx, image, visualEntity, height, opacity, filter, frameAnchor, config.flipX)) { ctx.save(); ctx.globalAlpha = opacity; ctx.fillStyle = preview.color; ctx.fillRect(visualEntity.x - 24, visualEntity.y - 34, 48, 68); ctx.restore(); }
  if (selectedTroop === "operadorJano") { const droneAnimation = getJanoDroneAnimation(entity, config, elapsed, getPreviewFrameCounts(troopAssets)); const droneImage = resolveTroopFrame(troopAssets, droneAnimation.state, droneAnimation.frame); const dronePoint = { x: visualEntity.x + (config.droneOffset?.x || 42), y: visualEntity.y + (config.droneOffset?.y || -76) - 51.6 }; const droneHeight = config.droneVisuals?.[droneAnimation.state]?.height || 72; drawSprite(ctx, droneImage, dronePoint, droneHeight, opacity, filter, { x: .5, y: .5 }, false); }
  if (preview.placementLabel) { ctx.save(); ctx.font = "600 12px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillStyle = preview.valid ? "#a7f3d0" : "#fecdd3"; ctx.shadowColor = "#020617"; ctx.shadowBlur = 4; ctx.fillText(preview.placementLabel, visualEntity.x, visualEntity.y - 74); ctx.restore(); }
}

export function drawElectricTroopStatus(ctx, troop, elapsed, settings) {
  const stacks = Math.max(0, Math.min(3, Number(troop.electricStacks) || 0));
  const paralyzed = elapsed < Number(troop.electricParalyzedUntil || 0);
  const conductive = elapsed < Number(troop.electricConductivityUntil || 0);
  if (!stacks && !paralyzed && !conductive) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = paralyzed ? "#ffffff" : conductive ? "#c084fc" : "#22d3ee"; ctx.fillStyle = paralyzed ? "#e0f2fe" : "#67e8f9"; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = settings.reduceMotion ? 4 : 9; ctx.lineWidth = 1.5;
  const y = troop.y - 61; const visibleIndicators = paralyzed ? 1 : Math.max(1, stacks);
  for (let index = 0; index < visibleIndicators; index += 1) { const x = troop.x + (index - (Math.max(1, stacks) - 1) / 2) * 11; ctx.beginPath(); ctx.moveTo(x - 3, y - 5); ctx.lineTo(x + 1, y - 1); ctx.lineTo(x - 1, y + 1); ctx.lineTo(x + 4, y + 6); ctx.stroke(); }
  if (paralyzed && !settings.reduceMotion) { const pulse = 18 + Math.sin(elapsed / 90) * 3; ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(troop.x, troop.y - 18, pulse, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

export function drawWorkerQueenWebDebuff(ctx, troop, session, settings) {
  const elapsed = session.elapsed; const remaining = (troop.webSlowUntil || 0) - elapsed;
  if (remaining <= 0) return;
  const duration = ENEMIES.workerQueen.webSlowDurationMs; const fade = Math.min(1, remaining / 420, (duration - remaining + 180) / 180); const pulse = settings.reduceMotion ? 0 : Math.sin(elapsed / 95) * 2;
  ctx.save(); ctx.globalAlpha = Math.max(0, fade) * .9; ctx.strokeStyle = "#f5e7c6"; ctx.fillStyle = "rgba(245,231,198,.2)"; ctx.shadowBlur = 7; ctx.shadowColor = "#f59e0b"; ctx.lineWidth = 2;
  for (const offset of [-18, -7, 7, 18]) { ctx.beginPath(); ctx.moveTo(troop.x - 29, troop.y - 48 + offset * .35); ctx.quadraticCurveTo(troop.x + pulse, troop.y - 35 + offset, troop.x + 29, troop.y - 44 + offset * .3); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(troop.x, troop.y - 70, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); for (let spoke = 0; spoke < 6; spoke += 1) { const angle = spoke * Math.PI / 3; ctx.moveTo(troop.x, troop.y - 70); ctx.lineTo(troop.x + Math.cos(angle) * 9, troop.y - 70 + Math.sin(angle) * 9); } ctx.stroke();
  const clockX = troop.x - 19; const clockY = troop.y - 71; ctx.fillStyle = "rgba(61,32,15,.94)"; ctx.beginPath(); ctx.arc(clockX, clockY, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(clockX, clockY - 5); ctx.lineTo(clockX, clockY); ctx.lineTo(clockX + 4, clockY + 2); ctx.stroke();
  const rangePenalty = getTroopRangePenaltyTiles(session, troop);
  if (rangePenalty > 0) { ctx.shadowBlur = 4; ctx.fillStyle = "#fff7ed"; ctx.font = "bold 9px Chakra Petch, system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`ALCANCE -${rangePenalty}`, troop.x, troop.y - 94 + pulse * .25); }
  ctx.restore();
}

export function shouldDrawEnemyHealth(entity, frozen, stunned, adaptive) {
  if (!adaptive.hideFullHealthEnemies || entity.variant === "alpha" || entity.isEcho || frozen || stunned) return true;
  const fullHealth = entity.hp >= entity.maxHp;
  const fullShield = !(entity.shieldMax > 0) || entity.shield >= entity.shieldMax;
  return !fullHealth || !fullShield;
}

export function drawSandstormTroopEffects(ctx, troop, session, assets, settings, visualHeight) {
  const buried = session.elapsed < (troop.sandBuriedUntil || 0); const slowed = session.sandstorm?.slowedTroopIds?.includes(troop.id);
  if (!buried && !slowed) return;
  const pulse = settings.reduceMotion ? 0 : Math.sin(session.elapsed / 120) * 1.5;
  ctx.save();
  if (buried) {
    const frames = assets.effects?.sandBurial?.buried || []; const buriedAge = Math.max(0, session.elapsed - (troop.sandBuriedStartedAt || session.elapsed)); const frameIndex = buriedAge < 600 ? Math.min(3, Math.floor(buriedAge / 150)) : 4 + Math.floor((buriedAge - 600) / 180) % 4; const image = frames[frameIndex] || frames.find(Boolean);
    if (image) { const size = Math.max(140, Math.min(230, visualHeight * 1.15)); const offsetY = TROOPS[troop.type]?.spriteOffsetY || 0; ctx.drawImage(image, troop.x - size / 2, troop.y + offsetY - size * .36, size, size); }
    ctx.fillStyle = "rgba(61,32,15,.94)"; ctx.strokeStyle = "#fdba74"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(troop.x, troop.y - 61 + pulse, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#fff7ed"; ctx.font = "bold 12px Chakra Petch"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("×", troop.x, troop.y - 61 + pulse);
  } else if (slowed) { ctx.strokeStyle = "#fbbf24"; ctx.fillStyle = "rgba(69,38,13,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(troop.x, troop.y - 61 + pulse, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(troop.x, troop.y - 67 + pulse); ctx.lineTo(troop.x, troop.y - 61 + pulse); ctx.lineTo(troop.x + 5, troop.y - 58 + pulse); ctx.stroke(); }
  ctx.restore();
}

export function drawLumiDefenseShield(ctx, entity, config, elapsed, settings) {
  if (entity.type !== "lumiUrsa7" || !entity.defenseActive) return; const base = config.defenseShieldVisual || {}; const stateOverride = entity.state === "transitionOut" ? base.transitionOut || {} : {}; const offsetX = stateOverride.offsetX ?? base.offsetX ?? 0; const offsetY = stateOverride.offsetY ?? base.offsetY ?? -4; const radiusX = stateOverride.radiusX ?? base.radiusX ?? 67; const radiusY = stateOverride.radiusY ?? base.radiusY ?? 61; const pulse = settings.reduceMotion ? 1 : 1 + Math.sin(elapsed / 170) * .035;
  ctx.save(); ctx.translate(entity.x + offsetX, entity.y + offsetY); ctx.scale(pulse, pulse); ctx.globalCompositeOperation = "lighter"; const glow = ctx.createRadialGradient(0, 3, 25, 0, 0, Math.max(radiusX, radiusY) + 4); glow.addColorStop(0, "rgba(34,211,238,0)"); glow.addColorStop(.72, "rgba(34,211,238,.08)"); glow.addColorStop(1, "rgba(103,232,249,.24)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(103,232,249,.72)"; ctx.shadowBlur = 14; ctx.shadowColor = "#22d3ee"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, radiusX - 2, radiusY - 2, 0, 0, Math.PI * 2); ctx.stroke(); if (!settings.reduceMotion) { ctx.setLineDash([8, 10]); ctx.globalAlpha = .42; ctx.rotate(elapsed / 2600); ctx.beginPath(); ctx.ellipse(0, 0, radiusX - 8, radiusY - 8, 0, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
}

export function drawTroopSpecialReady(ctx, entity, elapsed, settings) {
  const pulse = settings.reduceMotion ? 1 : .9 + Math.sin(elapsed / 130) * .1; const glow = ctx.createRadialGradient(entity.x, entity.y - 36, 2, entity.x, entity.y - 36, 34 * pulse); glow.addColorStop(0, "rgba(236,253,245,.98)"); glow.addColorStop(.28, "rgba(110,231,183,.82)"); glow.addColorStop(1, "rgba(16,185,129,0)"); ctx.save(); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(entity.x, entity.y - 36, 34 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = `rgba(110,231,183,${.38 + pulse * .3})`; ctx.lineWidth = 1.5; ctx.shadowBlur = 10; ctx.shadowColor = "#34d399"; ctx.beginPath(); ctx.ellipse(entity.x, entity.y + 39, 36 * pulse, 10 * pulse, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = "#d1fae5"; ctx.font = "700 9px Chakra Petch, system-ui"; ctx.textAlign = "center"; ctx.fillText("ESMAGAMENTO PRONTO", entity.x, entity.y - 105); ctx.restore();
}

export function drawPrismaticShield(ctx, entity, elapsed, settings) {
  if (!(entity.shield > 0)) return; const radiusX = 30 * (entity.scale || 1); const radiusY = 42 * (entity.scale || 1); const pulse = settings.reduceMotion ? 1 : .96 + Math.sin(elapsed / 180 + entity.row) * .04;
  ctx.save(); ctx.translate(entity.x, entity.y - 14 * (entity.scale || 1)); ctx.scale(radiusX * pulse, radiusY * pulse); ctx.strokeStyle = "rgba(167,139,250,.72)"; ctx.fillStyle = "rgba(127,255,212,.06)"; ctx.lineWidth = 1.4 / radiusX; ctx.shadowBlur = 12 / radiusX; ctx.shadowColor = "#7fffd4"; ctx.beginPath(); for (let index = 0; index < 8; index += 1) { const angle = -Math.PI / 2 + index * Math.PI / 4; const x = Math.cos(angle); const y = Math.sin(angle); if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

export function drawTroopEntity(ctx, entry, session, assets, runtime, settings, now, animationElapsed, scratch, drawHalo = true) {
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
  const height = (visual?.height || config.attackVisual?.height || (logicalEntity.type === "muralhaReforcada" ? 112 : 126)) * (config.spriteScale || 1);
  const troopFilter = getTroopSpriteFilter(reaction.flash);
  const thermalState = getTroopThermalVisualState(logicalEntity, session.elapsed);
  const thermalRect = image?.width && image?.height ? getAnchoredSpriteRect(scratch, height, image.width / image.height, frameAnchor) : { x: scratch.x - 24, y: scratch.y - 60, width: 48, height: 68 };
  drawThermalBurnBackLayer(ctx, logicalEntity, thermalRect, session.elapsed, settings, thermalState);
  let spriteDrawn = false;
  if (logicalEntity.type === "droneSentinela") {
    const baseX = scratch.x; const baseY = scratch.y; const layout = getDroneSentinelaLayout(logicalEntity.droneCount); const frames = troopAssets[animation.state] || [];
    for (const unit of layout) {
      const frameIndex = animation.state === "idle" ? (animation.frame + unit.idlePhase) % Math.max(1, frames.length) : animation.frame;
      const unitImage = resolveTroopFrame(troopAssets, animation.state, frameIndex);
      scratch.x = baseX + unit.x; scratch.y = baseY + unit.y;
      if (drawHalo && unitImage?.width && unitImage?.height) drawCachedSpriteHalo(ctx, getAnchoredSpriteRect(scratch, height * unit.scale, unitImage.width / unitImage.height, frameAnchor), session.phase.palette.primary, settings);
      spriteDrawn = drawSprite(ctx, unitImage, scratch, height * unit.scale, 1, troopFilter, frameAnchor, config.flipX) || spriteDrawn;
    }
    scratch.x = baseX; scratch.y = baseY;
  } else {
    if (drawHalo && image?.width && image?.height) drawCachedSpriteHalo(ctx, getAnchoredSpriteRect(scratch, height, image.width / image.height, frameAnchor), session.phase.palette.primary, settings);
    spriteDrawn = drawSprite(ctx, image, scratch, height, 1, troopFilter, frameAnchor, config.flipX);
  }
  if (logicalEntity.type === "operadorJano") {
    const droneAnimation = getJanoDroneAnimation(logicalEntity, config, session.elapsed, getTroopFrameCounts(troopAssets));
    const droneImage = resolveTroopFrame(troopAssets, droneAnimation.state, droneAnimation.frame); const offset = config.droneOffset || { x: 42, y: -76 };
    const droneEntity = { x: scratch.x + offset.x, y: scratch.y + offset.y - 51.6 }; const droneHeight = config.droneVisuals?.[droneAnimation.state]?.height || 72;
    if (drawHalo && droneImage?.width && droneImage?.height) drawCachedSpriteHalo(ctx, getAnchoredSpriteRect(droneEntity, droneHeight, droneImage.width / droneImage.height, { x: .5, y: .5 }), session.phase.palette.primary, settings);
    drawSprite(ctx, droneImage, droneEntity, droneHeight, 1, troopFilter, { x: .5, y: .5 }, false);
  }
  if (!spriteDrawn) { ctx.fillStyle = config.color; ctx.fillRect(scratch.x - 24, scratch.y - 34, 48, 68); }
  drawThermalBurnFrontLayer(ctx, logicalEntity, thermalRect, session.elapsed, settings, thermalState);
  const troopEffects = getTroopVisualEffects(logicalEntity.type);
  const troopEffectContext = { ctx, entity: scratch, logicalEntity, config, session, assets, settings, now, height };
  troopEffects.beforeSpecial?.(troopEffectContext);
  if (config.specialEveryMs && !logicalEntity.specialRequested && session.elapsed >= logicalEntity.specialReadyAt) drawTroopSpecialReady(ctx, scratch, session.elapsed, settings);
  troopEffects.afterSpecial?.(troopEffectContext);
  drawWorkerQueenWebDebuff(ctx, logicalEntity, session, settings); drawSandstormTroopEffects(ctx, logicalEntity, session, assets, settings, height); drawElectricTroopStatus(ctx, logicalEntity, session.elapsed, settings); drawPhysicalStunEffect(ctx, logicalEntity, session.elapsed, settings); drawSporeConfusionEffect(ctx, logicalEntity, session.elapsed, settings); drawHealth(ctx, logicalEntity, runtime, now, config.healthBarWidth || 54, config.healthBarOffset || 52, null, session.elapsed);
  troopEffects.afterHealth?.(troopEffectContext);
  if (logicalEntity.type === "droneSentinela") { ctx.save(); ctx.font = "700 13px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#e0f2fe"; ctx.strokeStyle = "#082f49"; ctx.lineWidth = 3; const countLabel = `×${Number(logicalEntity.droneCount || 1)}`; ctx.strokeText(countLabel, scratch.x + 33, scratch.y - 58); ctx.fillText(countLabel, scratch.x + 33, scratch.y - 58); ctx.restore(); }
}

registerTroopVisualEffects("lumiUrsa7", {
  beforeSpecial: ({ ctx, entity, config, session, settings }) =>
    drawLumiDefenseShield(ctx, entity, config, session.elapsed, settings),
}, { replace: true });
registerTroopVisualEffects("medicaNanites", {
  afterSpecial: ({ ctx, entity, session, settings }) => {
    drawNaniteTargetEffect(ctx, entity, session, settings);
    drawTroopCooldown(ctx, entity, session, settings);
  },
}, { replace: true });
registerTroopVisualEffects("cacadorLeviatas", {
  afterSpecial: ({ ctx, entity, session, settings }) => {
    drawTroopCooldown(ctx, entity, session, settings);
    drawLeviathanStateEffect(ctx, entity, session, settings);
  },
}, { replace: true });
registerTroopVisualEffects("executorArco", {
  afterSpecial: ({ ctx, entity, session, settings }) =>
    drawExecutorComboIndicator(ctx, entity, session.elapsed, settings),
}, { replace: true });
registerTroopVisualEffects("aresT", {
  afterHealth: ({ ctx, logicalEntity, settings }) =>
    drawAresThermalShield(ctx, logicalEntity, settings),
}, { replace: true });

/** Draws one enemy, including its registered visual effects and status layers. */
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
  if (logicalEntity.type === "duneRipper" && logicalEntity.duneState === "roar" && !settings.reduceMotion && !stunned) {
    const roarAge = session.elapsed - logicalEntity.duneStateStartedAt;
    scratch.x += Math.sin(roarAge / 24) * 1.8;
    scratch.y += Math.cos(roarAge / 31) * 0.8;
  }
  const enemyAssets = assets.enemies[logicalEntity.type] || {};
  const frameCounts = getEnemyFrameCounts(enemyAssets);
  let animation = getEnemyAnimation(logicalEntity, config, session.elapsed, frameCounts);
  if (logicalEntity.type === "workerQueen" && reaction.flash > 0.12 && enemyAssets.hit?.length) {
    animation = { state: "hit", frame: Math.min(enemyAssets.hit.length - 1, Math.floor((1 - reaction.flash) * enemyAssets.hit.length)) };
  }
  if (logicalEntity.type === "scarabEmperor" && !logicalEntity.scarabTransitionToPhase && reaction.flash > 0.12) {
    const hitState = `phase${logicalEntity.bossPhase || 1}Hit`;
    if (enemyAssets[hitState]?.length) animation = { state: hitState, frame: Math.min(enemyAssets[hitState].length - 1, Math.floor((1 - reaction.flash) * enemyAssets[hitState].length)) };
  }
  const frames = enemyAssets[animation.state] || enemyAssets.flying || enemyAssets.walking || enemyAssets.idle || [];
  const image = frames[animation.frame % Math.max(1, frames.length)];
  const enemyAspectRatio = image?.width && image?.height ? image.width / image.height : 1;
  const enemyRect = getEnemySpriteRect(scratch, config, animation.state, animation.frame, enemyAspectRatio);
  const leviathanShadowOnly = isLeviathanShadowOnly(logicalEntity, session.elapsed, animation.frame);
  const spriteFilter = getSpriteFilter(reaction.flash, logicalEntity.bossPhase || 0, logicalEntity.variant === "alpha", logicalEntity.isEcho, frozen);
  const visualEffects = getEnemyVisualEffects(logicalEntity.type);
  visualEffects.underlay?.(ctx, scratch, session.elapsed, settings);
  visualEffects.beforeSprite?.(ctx, scratch, session.elapsed, settings);
  const emergenceProgress = silicaDiggerEmergenceProgress(logicalEntity, session.elapsed);
  if (drawHalo && !leviathanShadowOnly && emergenceProgress >= 0.45) drawCachedSpriteHalo(ctx, enemyRect, logicalEntity.isEcho ? "#7fffd4" : session.phase.palette.accent, settings, logicalEntity.isEcho ? 1.4 : 1);
  const flipEnemy = logicalEntity.type === "garravinha" || (logicalEntity.type === "rasgaCeusCinereo" && logicalEntity.visualFacing > 0);
  let spriteDrawn = leviathanShadowOnly ? false : drawSpriteInRect(ctx, image, enemyRect, logicalEntity.isEcho ? 0.72 : 1, spriteFilter, flipEnemy);
  if (!spriteDrawn && !leviathanShadowOnly) spriteDrawn = drawProceduralGlassEnemy(ctx, scratch, config, session.elapsed, spriteFilter);
  if (frozen && spriteDrawn) drawSpriteInRect(ctx, image, enemyRect, 0.38, "brightness(0) saturate(100%) invert(82%) sepia(46%) saturate(1134%) hue-rotate(156deg) brightness(104%) contrast(102%)");
  if (!spriteDrawn && !leviathanShadowOnly) {
    ctx.fillStyle = frozen ? "#38bdf8" : config.color;
    ctx.beginPath(); ctx.arc(scratch.x, scratch.y, 24 * logicalEntity.scale, 0, Math.PI * 2); ctx.fill();
  }
  drawLeviathanBossEffects(ctx, scratch, session, settings);
  drawLeviathanBossHealth(ctx, logicalEntity);
  drawAbyssCharge(ctx, scratch, config, session.elapsed, settings);
  drawPrismaticShield(ctx, scratch, session.elapsed, settings);
  if (frozen && !leviathanShadowOnly) drawFrozenEnemyEffect(ctx, scratch, session.elapsed, settings);
  if (stunned) drawStunnedEnemyEffect(ctx, scratch, session.elapsed, settings);
  if (logicalEntity.isEcho) {
    const radius = 31 * logicalEntity.scale;
    ctx.save(); ctx.strokeStyle = "rgba(127,255,212,.72)"; ctx.lineWidth = 1.5; ctx.shadowBlur = 10; ctx.shadowColor = "#8b5cf6";
    ctx.beginPath(); ctx.moveTo(scratch.x, scratch.y - radius); ctx.lineTo(scratch.x + radius * .72, scratch.y); ctx.lineTo(scratch.x, scratch.y + radius * .45); ctx.lineTo(scratch.x - radius * .72, scratch.y); ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  drawStructuralRupture(ctx, scratch, session.elapsed, settings);
  if (logicalEntity.type !== "leviathanNereida" && emergenceProgress >= 0.45 && !logicalEntity.rasgamarSubmerged && (shouldDrawEnemyHealth(logicalEntity, frozen, stunned, adaptive) || (logicalEntity.type === "garravinha" && logicalEntity.garravinhaState === "latched"))) {
    drawHealth(ctx, logicalEntity, runtime, now, logicalEntity.variant === "alpha" ? 100 : 58, 58 * logicalEntity.scale, logicalEntity.isEcho ? "#7fffd4" : null);
  }
  drawLatchedGarravinhaMarker(ctx, session, logicalEntity);
  if (logicalEntity.variant === "alpha") {
    ctx.fillStyle = "#fecdd3"; ctx.font = "700 11px system-ui"; ctx.textAlign = "center";
    ctx.fillText(`${config.label.toUpperCase()} ALFA`, scratch.x, Math.max(30, scratch.y - 76 * logicalEntity.scale));
  }
  drawRasgaCeusTargetMarker(ctx, session, logicalEntity);
}

export function drawThermalPlatforms(ctx, session, assets) {
  const frames = assets.troops.thermalPlatform || {};
  for (const platform of session.supportStructures || []) {
    const { state } = getThermalPlatformVisual(platform);
    const image = resolveTroopFrame(frames, state, 0);
    if (!image) continue;
    const x = platform.col * CELL.width + CELL.width / 2;
    const y = platform.row * CELL.height + CELL.height / 2 + (TROOPS.thermalPlatform.spriteOffsetY || 0);
    ctx.drawImage(image, x - 46, y - 46, 92, 92);
  }
}

/** Draws the visual-only convoy attachment pass after the normal entity rows. */
export function drawAttachedConvoyEnemies(ctx, session, assets, runtime, settings, adaptive, now, interpolation, buffers) {
  for (const enemy of session.enemies) {
    if (enemy.dead || !enemy.attachedToConvoy) continue;
    drawEnemyEntity(ctx, { kind: "enemy", entity: enemy, x: enemy.x, y: enemy.y }, session, assets, runtime, settings, adaptive, now, interpolation, buffers.enemyScratch, false);
    if (!settings.reduceMotion) {
      ctx.save();
      ctx.fillStyle = "#fb7185";
      ctx.shadowColor = "#fb7185";
      ctx.shadowBlur = 8;
      ctx.font = "900 17px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("!", enemy.x, enemy.y - 66 * (enemy.scale || 1));
      ctx.restore();
    }
  }
}

/**
 * Preserves the established row ordering while keeping entity composition out
 * of the React screen.
 */
export function drawBattleEntityRows({ ctx, session, assets, runtime, settings, adaptive, now, animationElapsed, interpolation, buffers, field }) {
  drawThermalPlatforms(ctx, session, assets);
  buildBattleRenderRows(session.troops, session.enemies, interpolation, session.elapsed, settings.reduceMotion, buffers);
  drawWetReflections(ctx, session.phase, buffers.rows, settings, adaptive);
  const bossEntries = [];
  for (let row = 0; row < field.rows; row += 1) {
    let lastHaloX = -Infinity;
    for (const entry of buffers.rows[row]) {
      const entity = entry.entity;
      if (entry.kind === "enemy" && entity.attachedToConvoy) continue;
      if (entry.kind === "enemy" && (entity.type === "leviathanNereida" || entity.type === "colossoCaldeira")) { bossEntries.push(entry); continue; }
      const drawHalo = Math.abs(entry.x - lastHaloX) > 2;
      if (drawHalo) lastHaloX = entry.x;
      const reaction = getHitReaction(runtime, entity.id, now);
      buffers.position.x = entry.x + reaction.offsetX; buffers.position.y = entry.y;
      const rasgamarShadowOnly = entry.kind === "enemy" && isRasgamarShadowOnly(entity, session.elapsed);
      const leviathanShadowOnly = entry.kind === "enemy" && isLeviathanShadowOnly(entity, session.elapsed);
      if (rasgamarShadowOnly) drawRasgamarUnderwaterShadow(ctx, buffers.position, session.elapsed, settings);
      else if (entry.kind === "enemy" && entity.type === "rasgaCeusCinereo") drawRasgaCeusShadow(ctx, entity);
      else if (!leviathanShadowOnly && (entry.kind !== "enemy" || !entity.attachedToTroopId)) {
        const emergenceScale = entry.kind === "enemy" ? .2 + .8 * silicaDiggerEmergenceProgress(entity, session.elapsed) : 1;
        drawContactShadow(ctx, buffers.position, (entry.kind === "enemy" ? entity.scale : 1) * emergenceScale, settings);
      }
      if (entry.kind === "troop") drawTroopEntity(ctx, entry, session, assets, runtime, settings, now, animationElapsed, buffers.troopScratch, drawHalo);
      else drawEnemyEntity(ctx, entry, session, assets, runtime, settings, adaptive, now, interpolation, buffers.enemyScratch, drawHalo);
    }
  }
  for (const entry of bossEntries) {
    const entity = entry.entity; const config = ENEMIES[entity.type]; const reaction = getHitReaction(runtime, entity.id, now);
    buffers.position.x = entry.x + reaction.offsetX; buffers.position.y = entry.y;
    if (!isLeviathanShadowOnly(entity, session.elapsed)) {
      buffers.position.x += (config.visualOffsetX || config.spriteOffsetX || 0) * (entity.scale || config.scale || 1);
      drawContactShadow(ctx, buffers.position, entity.scale, settings);
    }
    drawEnemyEntity(ctx, entry, session, assets, runtime, settings, adaptive, now, interpolation, buffers.enemyScratch, true);
  }
}

/**
 * Compatibility entry point for the established row pass.
 */
export function drawBattleRows({
  ctx, session, assets, runtime, settings, adaptive, now, animationElapsed,
  interpolation, buffers, field,
}) {
  return drawBattleEntityRows({
    ctx, session, assets, runtime, settings, adaptive, now, animationElapsed,
    interpolation, buffers, field,
  });
}
