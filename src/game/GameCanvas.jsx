import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DECISION_STAGE_RULES, ENEMIES, TROOPS } from "./content.js";
import {
  getArenaUrl, getEnemyPreviewUrl, getTroopPreviewUrl, loadBattleAssets, resolveTroopFrame,
} from "./assetCatalog.js";
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
import { drawFrozenEnemyEffect, drawMines, drawParticles, drawProjectiles, drawStunnedEnemyEffect, pushEventParticles } from "./projectileRenderer.js";
import {
  drawDematerializationPulses,
  drawPulseBeams,
  drawPulseDisintegrations,
  drawPulseScorches,
} from "./pulseRenderer.js";
import {
  getAnchoredSpriteRect, getEnemyAnimation, getEnemyMuzzleWorldPosition, getEnemySpriteRect,
  getMuzzleWorldPosition, getTroopAnimation, getTroopAttackVisual, getTroopFrameAnchor,
  buildBattleRenderRows, createBattleRowBuffers, isEnemyFrozen, viewportPointToFieldPoint, writeEnemyVisualPosition,
} from "./visualGeometry.js";
import {
  configureHiDPICanvas, consumeGraphicsEvents, createGraphicsRuntime, getCameraOffset,
  getAdaptiveEffects, getHealthVisual, getHitReaction, interpolateEntity, updateGraphicsRuntime,
} from "./graphicsRuntime.js";
import {
  drawCachedSpriteHalo, drawDecals, drawDeploymentEffects, drawDynamicLights, drawPostProcessing,
  drawWetReflections, getSpriteFilter, getTroopSpriteFilter, presentScene,
} from "./graphicsRenderer.js";
import {
  CELL, FIELD, VIEWPORT,
  adaptiveAidBlocksIntermission,
  adaptiveAidCinematicFactor,
  adaptiveAidPausesSimulation,
  activateTroopSpecial,
  cellFromPoint,
  clearSandboxEntities,
  createBattleSession,
  getEligibleAdaptiveAidOptions,
  getSnapshot,
  getTroopRangePenaltyTiles,
  forceExecutorCombo,
  injureSandboxTroops,
  isCapsuleClickable,
  openAdaptiveAidCapsule,
  placeTroop,
  pointHitsCapsule,
  removeTroop,
  selectAdaptiveAidOption,
  selectDecision,
  setEnergyPickupPointer,
  setSandboxSettings,
  spawnEnemy,
  startWave,
  stepBattle,
  simulateAdaptiveAid,
} from "./battleModel.js";
import { drawExecutorComboIndicator } from "./executorArcoRenderer.js";
import { drawContainmentForeground, drawContainmentUnderlay } from "./containmentRenderer.js";
import { drawAdaptiveAid, drawOrbitalTargeting } from "./adaptiveAidRenderer.js";
import { drawWindEffects } from "./windCurrentRenderer.js";
import { loadSettings } from "../campaign/storage.js";

export function resolveCanvasClickAction(session, fieldPoint, selectedTroop = null, removeMode = false) {
  if (!fieldPoint) return null;
  const cell = cellFromPoint(fieldPoint.x, fieldPoint.y);
  if (!cell) return null;
  if (removeMode) return { type: "remove", cell };
  const manualSpecialTroop = session.troops
    .filter((entry) => !entry.dead && TROOPS[entry.type]?.specialEveryMs)
    .map((troop) => {
      const visualY = troop.y + (TROOPS[troop.type]?.spriteOffsetY || 0);
      return {
        troop,
        visualY,
        distance: ((fieldPoint.x - troop.x) / 82) ** 2 + ((fieldPoint.y - (visualY - 31)) / 98) ** 2,
      };
    })
    .filter(({ troop, visualY }) => (
      fieldPoint.x >= troop.x - 82
      && fieldPoint.x <= troop.x + 82
      && fieldPoint.y >= visualY - 120
      && fieldPoint.y <= visualY + 66
    ))
    .sort((left, right) => left.distance - right.distance)[0]?.troop;
  if (manualSpecialTroop) {
    return { type: "special", cell, troop: manualSpecialTroop };
  }
  const troopInCell = session.troops.find((entry) => !entry.dead && entry.row === cell.row && entry.col === cell.col);
  if (troopInCell && !selectedTroop) {
    return { type: "special", cell, troop: troopInCell };
  }
  if (selectedTroop) return { type: "place", cell, troopType: selectedTroop };
  return null;
}

export function ColossusSpecialButtons({ session, onActivate }) {
  if (!session?.waveActive || session.outcome) return null;
  const readyColossi = session.troops.filter((troop) => (
    !troop.dead
    && troop.type === "colossoImpacto"
    && !troop.specialRequested
    && session.elapsed >= troop.specialReadyAt
  ));
  return readyColossi.map((troop) => (
    <button
      key={troop.id}
      type="button"
      className="colossus-special-button"
      style={{
        left: `${troop.x / FIELD.width * 100}%`,
        top: `${(VIEWPORT.fieldOffsetY + troop.y - 76) / VIEWPORT.height * 100}%`,
      }}
      aria-label={`Ativar Esmagamento Total do Colosso na rota ${troop.row + 1}`}
      onClick={() => onActivate(troop.id)}
    >
      <span>◆</span> ATIVAR ESMAGAMENTO
    </button>
  ));
}

function drawSprite(ctx, image, entity, targetHeight, opacity = 1, filter = "none", anchor = null, flipX = false) {
  if (!image?.width || !image?.height) return false;
  const rect = getAnchoredSpriteRect(entity, targetHeight, image.width / image.height, anchor);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = filter;
  if (flipX) {
    ctx.translate(rect.x + rect.width / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, -rect.width / 2, rect.y, rect.width, rect.height);
  } else {
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }
  ctx.restore();
  return true;
}

function drawSpriteInRect(ctx, image, rect, opacity = 1, filter = "none") {
  if (!image?.width || !image?.height) return false;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = filter;
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
  return true;
}

function getTroopVisualEntity(entity, config) {
  return config.spriteOffsetY ? { ...entity, y: entity.y + config.spriteOffsetY } : entity;
}

function drawAbyssCharge(ctx, enemy, config, elapsed, settings) {
  if (!enemy.casting || config.attack !== "arcane") return;
  const progress = Math.max(0, Math.min(1, (elapsed - enemy.castStartedAt) / Math.max(1, config.chargeMs)));
  const origin = getEnemyMuzzleWorldPosition(enemy, config);
  const pulse = settings.reduceMotion ? 1 : 0.9 + Math.sin(elapsed / 70) * 0.1;
  const radius = (5 + progress * 10) * pulse * (enemy.scale || 1);
  const glow = ctx.createRadialGradient(origin.x - 2, origin.y - 2, 1, origin.x, origin.y, radius * 2.3);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(0.2, "#e9d5ff");
  glow.addColorStop(0.55, config.color);
  glow.addColorStop(1, "rgba(88,28,135,0)");
  ctx.save();
  ctx.fillStyle = glow;
  ctx.shadowBlur = 16 + progress * 12;
  ctx.shadowColor = config.color;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, radius * 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5e8ff";
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSilicaDiggerSand(ctx, enemy, elapsed, settings) {
  if (enemy.type !== "silicaDigger" || !enemy.moving || settings.reduceMotion) return;
  const seed = Number(/\d+/.exec(enemy.id)?.[0] || 0);
  const phase = elapsed / 65 + seed * 0.73;
  ctx.save();
  ctx.fillStyle = "rgba(245, 158, 11, .42)";
  for (let index = 0; index < 3; index += 1) {
    const cycle = (phase + index * 1.7) % 5;
    const x = enemy.x - 25 + cycle * 5;
    const y = enemy.y + CELL.height * 0.39 - Math.sin(cycle / 5 * Math.PI) * 7;
    ctx.globalAlpha = Math.max(0, 0.55 - cycle * 0.09);
    ctx.beginPath();
    ctx.ellipse(x, y, 2.6 - index * 0.35, 1.4 - index * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function silicaDiggerEmergenceProgress(enemy, elapsed) {
  if (enemy.type !== "silicaDigger" || enemy.emergeState !== "emerging") return 1;
  return Math.max(0, Math.min(1, (elapsed - enemy.emergeStartedAt)
    / Math.max(1, ENEMIES.silicaDigger.emergeDurationMs)));
}

function drawSilicaDiggerEmergence(ctx, enemy, elapsed, settings) {
  if (enemy.type !== "silicaDigger" || enemy.emergeState !== "emerging") return;
  const progress = silicaDiggerEmergenceProgress(enemy, elapsed);
  const fade = 1 - progress;
  const intensity = Math.sin(progress * Math.PI) * fade;
  const groundY = enemy.y + 42 * enemy.scale;
  const seed = Number(/\d+/.exec(enemy.id)?.[0] || 0);
  ctx.save();
  ctx.fillStyle = `rgba(180, 112, 32, ${0.34 * fade})`;
  ctx.beginPath();
  ctx.ellipse(enemy.x, groundY, (32 + 8 * intensity) * enemy.scale,
    (7 + 3 * intensity) * enemy.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!settings.reduceMotion) {
    ctx.fillStyle = `rgba(245, 158, 11, ${0.64 * intensity})`;
    for (let index = 0; index < 5; index += 1) {
      const phase = seed * 0.37 + index * 1.31;
      const spread = (10 + index * 4) * enemy.scale;
      const x = enemy.x + Math.cos(phase) * spread;
      const y = groundY - Math.sin(progress * Math.PI) * (10 + index * 3) * enemy.scale
        + Math.sin(phase) * 3;
      const radius = (1.2 + index % 2) * enemy.scale;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.58 * intensity})`;
    ctx.lineWidth = Math.max(1, enemy.scale);
    for (let index = 0; index < 3; index += 1) {
      const direction = index % 2 ? 1 : -1;
      const x = enemy.x + direction * (12 + index * 7) * enemy.scale;
      const y = groundY - (5 + index * 4) * intensity * enemy.scale;
      ctx.beginPath();
      ctx.moveTo(x - 2, y + 2);
      ctx.lineTo(x + direction * 4, y - 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHealth(ctx, entity, runtime, now, width = 54, offset = 47, accent = null, battleElapsed = now) {
  const { ratio, trail } = getHealthVisual(runtime, entity, now);
  const x = entity.x - width / 2;
  const y = Math.max(10, entity.y - offset);
  ctx.fillStyle = "rgba(2,6,23,.92)";
  ctx.fillRect(x - 2, y - 2, width + 4, 10);
  ctx.strokeStyle = accent || "rgba(186,230,253,.34)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1.5, y - 1.5, width + 3, 9);
  ctx.fillStyle = "rgba(248,113,113,.72)";
  ctx.fillRect(x + 1, y + 1, (width - 2) * trail, 4);
  ctx.fillStyle = accent || (ratio > 0.55 ? "#34d399" : ratio > 0.25 ? "#fbbf24" : "#fb7185");
  ctx.fillRect(x + 1, y + 1, (width - 2) * ratio, 4);
  const baseMaxHp = entity.baseMaxHp ?? entity.maxHp;
  const bonusMaxHp = entity.fortificationBonusMaxHp ?? 0;
  const bonusCurrentHp = Math.max(0, Math.min(bonusMaxHp, entity.hp - baseMaxHp));
  if (bonusCurrentHp > 0 && bonusMaxHp > 0) {
    const blueWidth = (width - 2) * Math.min(0.2, bonusCurrentHp / baseMaxHp);
    const gradient = ctx.createLinearGradient(x + 1, y, x + 1 + blueWidth, y);
    gradient.addColorStop(0, "#67e8f9"); gradient.addColorStop(1, "#38bdf8");
    ctx.fillStyle = gradient;
    ctx.fillRect(x + 1, y + 1, blueWidth, 4);
    ctx.strokeStyle = "rgba(224,242,254,.9)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 1 + blueWidth, y); ctx.lineTo(x + 1 + blueWidth, y + 6); ctx.stroke();
  }
  if (entity.shieldMax > 0 && entity.shield > 0) {
    const shieldRatio = Math.max(0, Math.min(1, entity.shield / entity.shieldMax));
    ctx.fillStyle = "rgba(15,23,42,.95)";
    ctx.fillRect(x - 1, y + 8, width + 2, 5);
    ctx.fillStyle = "#a78bfa";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#7fffd4";
    ctx.fillRect(x, y + 9, width * shieldRatio, 3);
    ctx.shadowBlur = 0;
  }
  const healAge = battleElapsed - entity.lastNaniteHealAt;
  if (Number.isFinite(healAge) && healAge >= 0 && healAge < 520) {
    const fade = 1 - healAge / 520;
    ctx.save();
    ctx.strokeStyle = `rgba(52,211,153,${0.85 * fade})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#2dd4bf";
    ctx.strokeRect(x - 3, y - 3, width + 6, 12);
    ctx.restore();
  }
}

function activeNaniteHealers(session, targetId) {
  return session.troops.filter((troop) => !troop.dead
    && troop.type === "medicaNanites"
    && troop.state === "healing"
    && troop.healTargetId === targetId);
}

function drawNaniteHealingBeams(ctx, session, settings) {
  for (const medic of session.troops) {
    if (medic.dead || medic.type !== "medicaNanites" || medic.state !== "healing" || !medic.healTargetId) continue;
    const target = session.troops.find((troop) => troop.id === medic.healTargetId && !troop.dead);
    if (!target) continue;
    const config = TROOPS.medicaNanites;
    const origin = getMuzzleWorldPosition(medic, config, 0);
    const end = { x: target.x, y: target.y - 18 };
    const sway = settings.reduceMotion ? 0 : Math.sin(session.elapsed / 120 + medic.col) * 2.5;
    const drawBeam = () => {
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.quadraticCurveTo((origin.x + end.x) / 2, (origin.y + end.y) / 2 + sway, end.x, end.y);
      ctx.stroke();
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(45,212,191,.16)";
    ctx.lineWidth = 13;
    drawBeam();
    ctx.strokeStyle = "rgba(52,211,153,.7)";
    ctx.lineWidth = 6;
    drawBeam();
    ctx.strokeStyle = "rgba(236,253,245,.95)";
    ctx.lineWidth = 2;
    drawBeam();
    if (!settings.reduceMotion) {
      for (let index = 0; index < 4; index += 1) {
        const progress = ((session.elapsed / 700 + index / 4) % 1);
        const x = origin.x + (end.x - origin.x) * progress;
        const y = origin.y + (end.y - origin.y) * progress + Math.sin(progress * Math.PI) * sway;
        ctx.fillStyle = index % 2 ? "#6ee7b7" : "#ecfdf5";
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawNaniteTargetEffect(ctx, entity, session, settings) {
  if (!activeNaniteHealers(session, entity.id).length) return;
  const pulse = settings.reduceMotion ? 1 : 0.94 + Math.sin(session.elapsed / 140) * 0.06;
  ctx.save();
  ctx.strokeStyle = "rgba(52,211,153,.82)";
  ctx.fillStyle = "rgba(45,212,191,.08)";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#34d399";
  ctx.beginPath();
  ctx.ellipse(entity.x, entity.y + 42, 31 * pulse, 9 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(entity.x, entity.y - 9, 29, 43, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawNaniteCooldown(ctx, entity, session, settings) {
  if (entity.type !== "medicaNanites" || entity.state !== "cooldown") return;
  const duration = Math.max(1, TROOPS.medicaNanites.healCooldownMs);
  const progress = Math.max(0, Math.min(1, 1 - (entity.cooldownEndsAt - session.elapsed) / duration));
  ctx.save();
  ctx.strokeStyle = "rgba(45,212,191,.28)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(entity.x, entity.y - 62, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#5eead4";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#2dd4bf";
  ctx.beginPath();
  ctx.arc(entity.x, entity.y - 62, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();
  if (!settings.reduceMotion) {
    ctx.fillStyle = "#ccfbf1";
    ctx.font = "700 8px Chakra Petch, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("RECARGA", entity.x, entity.y - 79);
  }
  ctx.restore();
}

function drawLumiDefenseShield(ctx, entity, config, elapsed, settings) {
  if (entity.type !== "lumiUrsa7" || !entity.defenseActive) return;
  const base = config.defenseShieldVisual || {};
  const stateOverride = entity.state === "transitionOut" ? base.transitionOut || {} : {};
  const offsetX = stateOverride.offsetX ?? base.offsetX ?? 0;
  const offsetY = stateOverride.offsetY ?? base.offsetY ?? -4;
  const radiusX = stateOverride.radiusX ?? base.radiusX ?? 67;
  const radiusY = stateOverride.radiusY ?? base.radiusY ?? 61;
  const pulse = settings.reduceMotion ? 1 : 1 + Math.sin(elapsed / 170) * 0.035;
  ctx.save();
  ctx.translate(entity.x + offsetX, entity.y + offsetY);
  ctx.scale(pulse, pulse);
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(0, 3, 25, 0, 0, Math.max(radiusX, radiusY) + 4);
  glow.addColorStop(0, "rgba(34,211,238,0)");
  glow.addColorStop(0.72, "rgba(34,211,238,.08)");
  glow.addColorStop(1, "rgba(103,232,249,.24)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(103,232,249,.72)";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#22d3ee";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX - 2, radiusY - 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (!settings.reduceMotion) {
    ctx.setLineDash([8, 10]);
    ctx.globalAlpha = 0.42;
    ctx.rotate(elapsed / 2600);
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX - 8, radiusY - 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTroopSpecialReady(ctx, entity, elapsed, settings) {
  const pulse = settings.reduceMotion ? 1 : 0.9 + Math.sin(elapsed / 130) * 0.1;
  const glow = ctx.createRadialGradient(entity.x, entity.y - 36, 2, entity.x, entity.y - 36, 34 * pulse);
  glow.addColorStop(0, "rgba(236,253,245,.98)");
  glow.addColorStop(.28, "rgba(110,231,183,.82)");
  glow.addColorStop(1, "rgba(16,185,129,0)");
  ctx.save();
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(entity.x, entity.y - 36, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(110,231,183,${.38 + pulse * .3})`;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#34d399";
  ctx.beginPath();
  ctx.ellipse(entity.x, entity.y + 39, 36 * pulse, 10 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#d1fae5";
  ctx.font = "700 9px Chakra Petch, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("ESMAGAMENTO PRONTO", entity.x, entity.y - 105);
  ctx.restore();
}

function drawPrismaticShield(ctx, entity, elapsed, settings) {
  if (!(entity.shield > 0)) return;
  const radiusX = 30 * (entity.scale || 1);
  const radiusY = 42 * (entity.scale || 1);
  const pulse = settings.reduceMotion ? 1 : 0.96 + Math.sin(elapsed / 180 + entity.row) * 0.04;
  ctx.save();
  ctx.translate(entity.x, entity.y - 14 * (entity.scale || 1));
  ctx.scale(radiusX * pulse, radiusY * pulse);
  ctx.strokeStyle = "rgba(167,139,250,.72)";
  ctx.fillStyle = "rgba(127,255,212,.06)";
  ctx.lineWidth = 1.4 / radiusX;
  ctx.shadowBlur = 12 / radiusX;
  ctx.shadowColor = "#7fffd4";
  ctx.beginPath();
  for (let index = 0; index < 8; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 4;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawProceduralGlassEnemy(ctx, entity, config, elapsed, filter = "none") {
  if (!config.proceduralKind) return false;
  const scale = entity.scale || 1;
  const pulse = 0.82 + Math.sin(elapsed / 150 + entity.row) * 0.12;
  const glass = ctx.createLinearGradient(-30 * scale, -28 * scale, 34 * scale, 25 * scale);
  glass.addColorStop(0, "#07111a");
  glass.addColorStop(0.48, config.color);
  glass.addColorStop(1, "#8b5cf6");
  const polygon = (points, fill = glass, stroke = "#c7fff0") => {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(0.8, 1.15 * scale);
    ctx.stroke();
  };

  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.filter = filter;
  ctx.shadowBlur = 12 * scale;
  ctx.shadowColor = config.color;
  if (config.proceduralKind === "estilha") {
    polygon([[-30, -4], [-13, -20], [18, -17], [31, 1], [10, 17], [-20, 13]], "#101128");
    for (const side of [-1, 1]) {
      ctx.strokeStyle = side < 0 ? "#7fffd4" : "#8b5cf6";
      ctx.lineWidth = 4 * scale;
      [-17, 0, 17].forEach((offset, index) => {
        ctx.beginPath();
        ctx.moveTo(offset * scale, (4 + index * 2) * scale);
        ctx.lineTo((offset + side * (17 + index * 3)) * scale, (20 + index * 3) * scale);
        ctx.lineTo((offset + side * (23 + index * 4)) * scale, 27 * scale);
        ctx.stroke();
      });
    }
    polygon([[-24, -12], [-9, -31], [0, -10]], "#211247");
    ctx.fillStyle = "#ffcf70";
    ctx.fillRect(-34 * scale, -2 * scale, 11 * scale, 3.5 * scale);
  } else if (config.proceduralKind === "vitrarca") {
    polygon([[-19, -42], [0, -58], [19, -42], [15, 3], [0, 20], [-15, 3]], "#0a1220");
    polygon([[-22, -37], [-44, -18], [-27, 4], [-8, -19]], "#102f35");
    polygon([[22, -37], [44, -18], [27, 4], [8, -19]], "#28164c");
    ctx.strokeStyle = "#7fffd4";
    ctx.lineWidth = 7 * scale;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 18 * scale, -15 * scale);
      ctx.quadraticCurveTo(side * 48 * scale, 5 * scale, side * 33 * scale, 38 * scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(side * 8 * scale, 8 * scale);
      ctx.lineTo(side * 20 * scale, 42 * scale);
      ctx.stroke();
    }
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.arc(0, -38 * scale, 5 * scale * pulse, 0, Math.PI * 2);
    ctx.fill();
  } else if (config.proceduralKind === "obsidonte") {
    polygon([[-42, -43], [-10, -61], [34, -49], [49, -15], [35, 11], [-35, 12], [-53, -16]], "#080a12", "#7fffd4");
    polygon([[-42, -26], [-61, -7], [-54, 30], [-32, 20], [-21, -9]], "#111522");
    polygon([[39, -29], [60, -8], [55, 32], [31, 22], [20, -8]], "#111522");
    polygon([[-27, 7], [-18, 39], [-4, 39], [-1, 8]], "#080a12");
    polygon([[27, 7], [18, 39], [4, 39], [1, 8]], "#080a12");
    ctx.fillStyle = "#ffcf70";
    ctx.shadowColor = "#ffcf70";
    ctx.beginPath();
    ctx.arc(0, -18 * scale, 10 * scale * pulse, 0, Math.PI * 2);
    ctx.fill();
  } else if (config.proceduralKind === "refrator") {
    polygon([[0, -43], [17, -18], [10, 18], [0, 33], [-10, 18], [-17, -18]], "#090b18");
    polygon([[-8, -19], [-51, -39], [-39, 6], [-15, 20]], "rgba(127,255,212,.44)");
    polygon([[8, -19], [51, -39], [39, 6], [15, 20]], "rgba(127,255,212,.44)");
    ctx.strokeStyle = "#ffcf70";
    ctx.lineWidth = 3 * scale;
    for (let index = 0; index < 3; index += 1) {
      const angle = elapsed / 520 + index * Math.PI * 2 / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 9 * scale, (-13 + Math.sin(angle) * 9) * scale);
      ctx.lineTo(Math.cos(angle) * 19 * scale, (-13 + Math.sin(angle) * 19) * scale);
      ctx.stroke();
    }
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.arc(0, -13 * scale, 9 * scale * pulse, 0, Math.PI * 2);
    ctx.fill();
  } else if (config.proceduralKind === "crisalio") {
    polygon([[-38, -25], [-28, -52], [-13, -68], [13, -68], [30, -50], [40, -22], [31, 16], [-31, 16]], "#070913", "#a78bfa");
    polygon([[-28, -35], [-48, -20], [-43, 14], [-25, 28], [-15, -7]], "#111522", "#7fffd4");
    polygon([[28, -35], [48, -20], [43, 14], [25, 28], [15, -7]], "#111522", "#7fffd4");
    for (let index = 0; index < 5; index += 1) {
      const x = (index - 2) * 12;
      polygon([[x - 6, -67], [x, -92 - Math.abs(index - 2) * 2], [x + 7, -67], [x, -55]], index % 2 ? "#7c3aed" : "#5eead4", "#e9d5ff");
    }
    ctx.strokeStyle = "#7fffd4";
    ctx.lineWidth = 2.4 * scale;
    for (let index = 0; index < 3; index += 1) {
      const angle = elapsed / 760 + index * Math.PI * 2 / 3;
      ctx.beginPath();
      ctx.arc(0, -28 * scale, (28 + index * 8) * scale, angle, angle + 0.75);
      ctx.stroke();
    }
    ctx.fillStyle = "#e9d5ff";
    ctx.beginPath();
    ctx.arc(0, -35 * scale, 7 * scale * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return true;
}

export function DecisionModal({ level, options, onChoose }) {
  const categories = { attack: "Ataque", defense: "Defesa", economy: "Economia", specialization: "Especialização" };
  const stage = DECISION_STAGE_RULES[level]?.label || "Decisão tática";
  return <div className="modal-backdrop"><div className="decision-modal"><span className="eyebrow amber">Decisão · {stage}</span><h2>Escolha uma vantagem tática</h2><p>Escolha obrigatória antes da próxima onda. A duração está indicada em cada efeito.</p><div className="decision-grid">{options.map((option) => <button key={option.id} onClick={() => onChoose(option)}><span className="decision-meta"><em>{categories[option.category]}</em><em>Poder {option.power}</em>{option.scope === "nextWave" && <em>Somente próxima onda</em>}</span><b>{option.label}</b><span>{option.description}</span></button>)}</div></div></div>;
}

function drawDeathVisuals(ctx, runtime, assets, now, phase) {
  for (const death of runtime.deaths) {
    const progress = Math.min(1, (now - death.born) / death.life);
    const entity = death.entity;
    const config = death.kind === "troop" ? TROOPS[entity.type] : ENEMIES[entity.type];
    const groups = death.kind === "troop" ? assets.troops[entity.type] : assets.enemies[entity.type];
    const dedicatedDeathState = death.kind === "enemy"
      ? (entity.type === "workerQueenEgg" ? "destroy" : groups?.death ? "death" : null)
      : null;
    const state = dedicatedDeathState
      || (groups?.attack ? "attack" : groups?.walking ? "walking" : groups?.idle ? "idle" : "defense");
    const frames = groups?.[state] || [];
    const frame = Math.min(frames.length - 1, Math.floor(progress * Math.max(1, frames.length)));
    const image = frames[frame] || frames[0];
    const height = death.kind === "troop" ? config?.attackVisual?.height || 126 : 128 * (entity.scale || 1);
    ctx.save();
    ctx.translate(entity.x, entity.y);
    if (!dedicatedDeathState) ctx.rotate((death.kind === "enemy" ? .22 : -.18) * progress);
    const deathEntity = { ...entity, x: 0, y: progress * 9 };
    const filter = dedicatedDeathState
      ? `drop-shadow(0 0 7px ${phase.palette.accent})`
      : `grayscale(${progress * .6}) drop-shadow(0 0 5px ${phase.palette.accent})`;
    if (death.kind === "troop") {
      drawSprite(ctx, image, getTroopVisualEntity(deathEntity, config), height, Math.max(0, 1 - progress * progress), filter, null, config?.flipX);
    } else {
      const aspectRatio = image?.width && image?.height ? image.width / image.height : 1;
      const rect = getEnemySpriteRect(deathEntity, config, state, frame, aspectRatio);
      drawSpriteInRect(ctx, image, rect, dedicatedDeathState ? Math.max(0, 1 - progress * .45) : Math.max(0, 1 - progress * progress), filter);
    }
    ctx.restore();
  }
}

function drawWorkerQueenWebDebuff(ctx, troop, session, settings) {
  const elapsed = session.elapsed;
  const remaining = (troop.webSlowUntil || 0) - elapsed;
  if (remaining <= 0) return;
  const duration = ENEMIES.workerQueen.webSlowDurationMs;
  const fade = Math.min(1, remaining / 420, (duration - remaining + 180) / 180);
  const pulse = settings.reduceMotion ? 0 : Math.sin(elapsed / 95) * 2;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade) * 0.9;
  ctx.strokeStyle = "#f5e7c6";
  ctx.fillStyle = "rgba(245,231,198,.2)";
  ctx.shadowBlur = 7;
  ctx.shadowColor = "#f59e0b";
  ctx.lineWidth = 2;
  for (const offset of [-18, -7, 7, 18]) {
    ctx.beginPath();
    ctx.moveTo(troop.x - 29, troop.y - 48 + offset * .35);
    ctx.quadraticCurveTo(troop.x + pulse, troop.y - 35 + offset, troop.x + 29, troop.y - 44 + offset * .3);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(troop.x, troop.y - 70, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  for (let spoke = 0; spoke < 6; spoke += 1) {
    const angle = spoke * Math.PI / 3;
    ctx.moveTo(troop.x, troop.y - 70);
    ctx.lineTo(troop.x + Math.cos(angle) * 9, troop.y - 70 + Math.sin(angle) * 9);
  }
  ctx.stroke();
  const clockX = troop.x - 19;
  const clockY = troop.y - 71;
  ctx.fillStyle = "rgba(61,32,15,.94)";
  ctx.beginPath();
  ctx.arc(clockX, clockY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(clockX, clockY - 5);
  ctx.lineTo(clockX, clockY);
  ctx.lineTo(clockX + 4, clockY + 2);
  ctx.stroke();
  const rangePenalty = getTroopRangePenaltyTiles(session, troop);
  if (rangePenalty > 0) {
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#fff7ed";
    ctx.font = "bold 9px Chakra Petch, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`ALCANCE -${rangePenalty}`, troop.x, troop.y - 94 + pulse * 0.25);
  }
  ctx.restore();
}

function drawSandstormTroopEffects(ctx, troop, session, assets, settings, visualHeight) {
  const buried = session.elapsed < (troop.sandBuriedUntil || 0);
  const slowed = session.sandstorm?.slowedTroopIds?.includes(troop.id);
  if (!buried && !slowed) return;
  const pulse = settings.reduceMotion ? 0 : Math.sin(session.elapsed / 120) * 1.5;
  ctx.save();
  if (buried) {
    const frames = assets.effects?.sandBurial?.buried || [];
    const buriedAge = Math.max(0, session.elapsed - (troop.sandBuriedStartedAt || session.elapsed));
    const frameIndex = buriedAge < 600
      ? Math.min(3, Math.floor(buriedAge / 150))
      : 4 + Math.floor((buriedAge - 600) / 180) % 4;
    const image = frames[frameIndex] || frames.find(Boolean);
    if (image) {
      const size = Math.max(140, Math.min(230, visualHeight * 1.15));
      const offsetY = TROOPS[troop.type]?.spriteOffsetY || 0;
      // The artwork occupies the lower portion of its square frame. Anchor that
      // visible mound at the troop's feet instead of around its waist.
      ctx.drawImage(image, troop.x - size / 2, troop.y + offsetY - size * 0.36, size, size);
    }
    ctx.fillStyle = "rgba(61,32,15,.94)";
    ctx.strokeStyle = "#fdba74";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(troop.x, troop.y - 61 + pulse, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff7ed";
    ctx.font = "bold 12px Chakra Petch";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", troop.x, troop.y - 61 + pulse);
  } else if (slowed) {
    ctx.strokeStyle = "#fbbf24";
    ctx.fillStyle = "rgba(69,38,13,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(troop.x, troop.y - 61 + pulse, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(troop.x, troop.y - 67 + pulse);
    ctx.lineTo(troop.x, troop.y - 61 + pulse);
    ctx.lineTo(troop.x + 5, troop.y - 58 + pulse);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTroopPlacementPreview(ctx, assets, selectedTroop, preview, elapsed, settings) {
  if (!preview || !selectedTroop) return;
  const config = TROOPS[selectedTroop];
  const troopAssets = assets.troops[selectedTroop] || {};
  const entity = {
    ...preview,
    type: selectedTroop,
    hp: config.hp,
    maxHp: config.hp,
    lastAttackAt: -Infinity,
  };
  const visualEntity = getTroopVisualEntity(entity, config);
  const animation = getTroopAnimation(entity, config, elapsed, {
    idle: troopAssets.idle?.length,
    attack: troopAssets.attack?.length,
    attackMine: troopAssets.attackMine?.length,
    attackGun: troopAssets.attackGun?.length,
    defense: troopAssets.defense?.length,
    transitionIn: troopAssets.transitionIn?.length,
    transitionOut: troopAssets.transitionOut?.length,
  });
  const frames = troopAssets[animation.state] || troopAssets.idle || troopAssets.defense || [];
  const image = frames[animation.frame % Math.max(1, frames.length)];
  const frameAnchor = getTroopFrameAnchor(config, animation.state, animation.frame);
  const height = getTroopAttackVisual(entity, config)?.height
    || config.attackVisual?.height
    || (selectedTroop === "muralhaReforcada" ? 112 : 126);

  ctx.save();
  ctx.globalAlpha = preview.valid ? 0.32 : 0.18;
  drawContactShadow(ctx, entity, 1, settings);
  ctx.restore();

  const opacity = preview.valid ? 0.45 : 0.27;
  const filter = preview.valid
    ? `brightness(1.15) drop-shadow(0 0 8px ${config.color})`
    : "grayscale(.55) sepia(1) saturate(6) hue-rotate(310deg) brightness(.95) drop-shadow(0 0 7px #fb7185)";
  if (!drawSprite(ctx, image, visualEntity, height, opacity, filter, frameAnchor, config.flipX)) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = preview.color;
    ctx.fillRect(visualEntity.x - 24, visualEntity.y - 34, 48, 68);
    ctx.restore();
  }
}

function drawEnergyPickups(ctx, pickups, elapsed, settings) {
  for (const pickup of pickups) {
    const motionTime = settings.reduceMotion ? 0 : elapsed;
    const bob = settings.reduceMotion ? 0 : Math.sin(motionTime / 280 + pickup.phase) * 5;
    const pulse = settings.reduceMotion ? 1 : 0.92 + Math.sin(motionTime / 170 + pickup.phase) * 0.08;
    const x = pickup.x;
    const y = pickup.y + bob;
    const halo = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, 25 * pulse);
    halo.addColorStop(0, "rgba(255,255,255,.98)");
    halo.addColorStop(0.18, "rgba(254,240,138,.98)");
    halo.addColorStop(0.46, "rgba(250,204,21,.72)");
    halo.addColorStop(1, "rgba(245,158,11,0)");

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = halo;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#facc15";
    ctx.beginPath();
    ctx.arc(x, y, 25 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7ae";
    ctx.beginPath();
    ctx.arc(x, y, 7 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const enemyFrameCountsCache = new WeakMap();
const troopFrameCountsCache = new WeakMap();

function getTroopFrameCounts(troopAssets) {
  let counts = troopFrameCountsCache.get(troopAssets);
  if (counts) return counts;
  counts = {};
  for (const state in troopAssets) counts[state] = troopAssets[state]?.length || 0;
  troopFrameCountsCache.set(troopAssets, counts);
  return counts;
}

function getEnemyFrameCounts(enemyAssets) {
  let counts = enemyFrameCountsCache.get(enemyAssets);
  if (counts) return counts;
  counts = {};
  for (const state in enemyAssets) counts[state] = enemyAssets[state]?.length || 0;
  enemyFrameCountsCache.set(enemyAssets, counts);
  return counts;
}

export function drawTroopEntity(ctx, entry, session, assets, runtime, settings, now, scratch, drawHalo = true) {
  const logicalEntity = entry.entity;
  const reaction = getHitReaction(runtime, logicalEntity.id, now);
  const config = TROOPS[logicalEntity.type];
  const troopAssets = assets.troops[logicalEntity.type] || {};
  Object.assign(scratch, logicalEntity);
  scratch.x = entry.x + reaction.offsetX;
  scratch.y = entry.y + (config.spriteOffsetY || 0);
  const animation = getTroopAnimation(logicalEntity, config, session.elapsed, getTroopFrameCounts(troopAssets));
  const image = resolveTroopFrame(troopAssets, animation.state, animation.frame);
  const frameAnchor = getTroopFrameAnchor(config, animation.state, animation.frame);
  const visual = getTroopAttackVisual(logicalEntity, config);
  const height = visual?.height || config.attackVisual?.height || (logicalEntity.type === "muralhaReforcada" ? 112 : 126);
  if (drawHalo && image?.width && image?.height) {
    const rect = getAnchoredSpriteRect(scratch, height, image.width / image.height, frameAnchor);
    drawCachedSpriteHalo(ctx, rect, session.phase.palette.primary, settings);
  }
  const troopFilter = getTroopSpriteFilter(reaction.flash);
  if (!drawSprite(ctx, image, scratch, height, 1, troopFilter, frameAnchor, config.flipX)) {
    ctx.fillStyle = config.color;
    ctx.fillRect(scratch.x - 24, scratch.y - 34, 48, 68);
  }
  drawLumiDefenseShield(ctx, scratch, config, session.elapsed, settings);
  if (config.specialEveryMs && !logicalEntity.specialRequested && session.elapsed >= logicalEntity.specialReadyAt) {
    drawTroopSpecialReady(ctx, scratch, session.elapsed, settings);
  }
  drawNaniteTargetEffect(ctx, scratch, session, settings);
  drawNaniteCooldown(ctx, scratch, session, settings);
  drawExecutorComboIndicator(ctx, scratch, session.elapsed, settings);
  drawWorkerQueenWebDebuff(ctx, logicalEntity, session, settings);
  drawSandstormTroopEffects(ctx, logicalEntity, session, assets, settings, height);
  drawHealth(ctx, logicalEntity, runtime, now, config.healthBarWidth || 54, config.healthBarOffset || 52, null, session.elapsed);
}

function shouldDrawEnemyHealth(entity, frozen, stunned, adaptive) {
  if (!adaptive.hideFullHealthEnemies || entity.variant === "alpha" || entity.isEcho || frozen || stunned) return true;
  const fullHealth = entity.hp >= entity.maxHp;
  const fullShield = !(entity.shieldMax > 0) || entity.shield >= entity.shieldMax;
  return !fullHealth || !fullShield;
}

export function drawEnemyEntity(ctx, entry, session, assets, runtime, settings, adaptive, now, interpolation, scratch, drawHalo = true) {
  const logicalEntity = entry.entity;
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
  const frames = enemyAssets[animation.state] || enemyAssets.walking || enemyAssets.idle || [];
  const image = frames[animation.frame % Math.max(1, frames.length)];
  const enemyAspectRatio = image?.width && image?.height ? image.width / image.height : 1;
  const enemyRect = getEnemySpriteRect(scratch, config, animation.state, animation.frame, enemyAspectRatio);
  const spriteFilter = getSpriteFilter(
    reaction.flash,
    logicalEntity.bossPhase || 0,
    logicalEntity.variant === "alpha",
    logicalEntity.isEcho,
    frozen,
  );
  drawSilicaDiggerSand(ctx, scratch, session.elapsed, settings);
  drawSilicaDiggerEmergence(ctx, scratch, session.elapsed, settings);
  const emergenceProgress = silicaDiggerEmergenceProgress(logicalEntity, session.elapsed);
  if (drawHalo && emergenceProgress >= 0.45) {
    drawCachedSpriteHalo(
      ctx,
      enemyRect,
      logicalEntity.isEcho ? "#7fffd4" : session.phase.palette.accent,
      settings,
      logicalEntity.isEcho ? 1.4 : 1,
    );
  }
  let spriteDrawn = drawSpriteInRect(ctx, image, enemyRect, logicalEntity.isEcho ? 0.72 : 1, spriteFilter);
  if (!spriteDrawn) spriteDrawn = drawProceduralGlassEnemy(ctx, scratch, config, session.elapsed, spriteFilter);
  if (frozen && spriteDrawn) {
    drawSpriteInRect(ctx, image, enemyRect, 0.38, "brightness(0) saturate(100%) invert(82%) sepia(46%) saturate(1134%) hue-rotate(156deg) brightness(104%) contrast(102%)");
  }
  if (!spriteDrawn) {
    ctx.fillStyle = frozen ? "#38bdf8" : config.color;
    ctx.beginPath();
    ctx.arc(scratch.x, scratch.y, 24 * logicalEntity.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  drawAbyssCharge(ctx, scratch, config, session.elapsed, settings);
  drawPrismaticShield(ctx, scratch, session.elapsed, settings);
  if (frozen) drawFrozenEnemyEffect(ctx, scratch, session.elapsed, settings);
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
  if (emergenceProgress >= 0.45 && shouldDrawEnemyHealth(logicalEntity, frozen, stunned, adaptive)) {
    drawHealth(ctx, logicalEntity, runtime, now, logicalEntity.variant === "alpha" ? 100 : 58, 58 * logicalEntity.scale, logicalEntity.isEcho ? "#7fffd4" : null);
  }
  if (logicalEntity.variant === "alpha") {
    ctx.fillStyle = "#fecdd3";
    ctx.font = "700 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${config.label.toUpperCase()} ALFA`, scratch.x, Math.max(30, scratch.y - 76 * logicalEntity.scale));
  }
}

export function drawBattleRows(ctx, session, assets, runtime, settings, adaptive, now, interpolation, buffers) {
  buildBattleRenderRows(session.troops, session.enemies, interpolation, session.elapsed, settings.reduceMotion, buffers);
  drawWetReflections(ctx, session.phase, buffers.rows, settings, adaptive);
  for (let row = 0; row < FIELD.rows; row += 1) {
    let lastHaloX = -Infinity;
    for (const entry of buffers.rows[row]) {
      const entity = entry.entity;
      const drawHalo = Math.abs(entry.x - lastHaloX) > 2;
      if (drawHalo) lastHaloX = entry.x;
      const reaction = getHitReaction(runtime, entity.id, now);
      buffers.position.x = entry.x + reaction.offsetX;
      buffers.position.y = entry.y;
      if (entry.kind !== "enemy" || !entity.attachedToTroopId) {
        const emergenceScale = entry.kind === "enemy"
          ? 0.2 + 0.8 * silicaDiggerEmergenceProgress(entity, session.elapsed)
          : 1;
        drawContactShadow(ctx, buffers.position,
          (entry.kind === "enemy" ? entity.scale : 1) * emergenceScale, settings);
      }
      if (entry.kind === "troop") {
        drawTroopEntity(ctx, entry, session, assets, runtime, settings, now, buffers.troopScratch, drawHalo);
      } else {
        drawEnemyEntity(ctx, entry, session, assets, runtime, settings, adaptive, now, interpolation, buffers.enemyScratch, drawHalo);
      }
    }
  }
}

function drawBattle(ctx, session, assets, particlesRef, runtime, selectedTroop, removeMode, hoveredCell, settings, adaptive, now, interpolation, rowBuffers) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, VIEWPORT.width, VIEWPORT.height);
  drawContainmentUnderlay(ctx, session.phase, session, runtime, now, settings);
  ctx.save();
  ctx.translate(0, VIEWPORT.fieldOffsetY);
  drawArenaBackground(ctx, session.phase, settings);
  drawArenaUnderlay(ctx, session.phase, settings, session, now);
  const placementPreview = getPlacementPreviewGeometry(session, selectedTroop, hoveredCell, removeMode);
  drawTacticalGrid(ctx, session, selectedTroop, removeMode, hoveredCell);
  drawPlacementRange(ctx, placementPreview);
  drawDecals(ctx, runtime, settings);
  drawPulseScorches(ctx, runtime, now, settings);

  const baseGradient = ctx.createLinearGradient(0, 0, 48, 0);
  baseGradient.addColorStop(0, `${session.phase.palette.primary}55`);
  baseGradient.addColorStop(1, "transparent");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, FIELD.baseX + 40, FIELD.height);

  drawDematerializationPulses(
    ctx,
    session.dematerializationPulses,
    assets.defenses?.pulsoDesmaterializacao,
    session.elapsed,
    settings,
  );

  const mineAssets = assets.troops.demolidora || {};
  drawMines(ctx, session.mines, mineAssets.mine?.[0], session.elapsed);
  drawProjectiles(ctx, [
    ...session.projectiles.map((entity) => interpolateEntity(entity, interpolation)),
    ...session.enemyProjectiles.map((entity) => interpolateEntity(entity, interpolation)),
  ], settings, {
    ...mineAssets,
    executorArcSlash: assets.effects?.executorArcSlash,
  });
  drawNaniteHealingBeams(ctx, session, settings);

  drawBattleRows(ctx, session, assets, runtime, settings, adaptive, now, interpolation, rowBuffers);
  drawWindEffects(ctx, runtime, now, settings, assets.effects?.windCurrent);
  if (session.adaptiveAid?.status === "targeting") {
    for (let row = 0; row < FIELD.rows; row += 1) {
      drawOrbitalTargeting(ctx, row, hoveredCell?.row === row, session.elapsed);
    }
  }
  drawAdaptiveAid(ctx, session, assets, session.elapsed, settings);

  drawTroopPlacementPreview(ctx, assets, selectedTroop, placementPreview, now, settings);
  drawDeathVisuals(ctx, runtime, assets, now, session.phase);
  drawPulseDisintegrations(ctx, runtime, assets, now, settings);
  drawDeploymentEffects(ctx, runtime, now, settings);
  drawDynamicLights(ctx, runtime, now, settings, adaptive);
  drawArenaForeground(ctx, session.phase, settings, session, now, adaptive);
  drawPulseBeams(ctx, runtime, now, settings);
  drawEnergyPickups(ctx, session.energyPickups, session.elapsed, settings);
  particlesRef.current = drawParticles(ctx, particlesRef.current, now, settings);
  drawPostProcessing(ctx, session.phase, settings, session, now);
  ctx.restore();
  drawContainmentForeground(ctx, session.phase, session, runtime, now, settings);
}

export function CapsuleInteractionButton({ capsule, onOpen }) {
  if (!capsule) return null;
  return <button
    type="button"
    className="capsule-interaction-button"
    style={{ left: `${capsule.x / FIELD.width * 100}%`, top: `${(capsule.y + VIEWPORT.fieldOffsetY) / VIEWPORT.height * 100}%` }}
    aria-label="Abrir Cápsula da Colônia"
    onClick={onOpen}
  ><span aria-hidden="true">◇</span></button>;
}

const RARITY_LABELS = { common: "COMUM", rare: "RARA", epic: "ÉPICA" };

export function FortuneChoiceModal({ tier, options, onChoose }) {
  return <div className="modal-backdrop fortune-overlay" role="dialog" aria-modal="true" aria-labelledby="fortune-title">
    <section className="decision-modal fortune-modal">
      <span className="eyebrow amber">PROTOCOLO FORTUNA · {tier === "critical" ? "SITUAÇÃO CRÍTICA" : "SITUAÇÃO DIFÍCIL"}</span>
      <h2 id="fortune-title">Transmissão aliada interceptada.</h2>
      <p>Selecione um recurso de emergência.</p>
      <div className="fortune-options">{options.map((option) => <button key={option.id} type="button" className={`fortune-option rarity-${option.rarity}`} onClick={() => onChoose(option.id)}>
        <small>{RARITY_LABELS[option.rarity]}</small><b>{option.label}</b><span>{option.description}</span>{option.requiresTarget && <em>REQUER SELEÇÃO DE ROTA</em>}
      </button>)}</div>
    </section>
  </div>;
}

export function SandboxPanel({
  selectedEnemy, onSelectEnemy, row, onRow, count, onCount, alpha, onAlpha,
  grouped, onGrouped, settings, onSetting, onRulesMode, onSpawn, onForceCombo,
  onInjure, onClear, onReset, fortuneTier, onFortuneTier, onSimulateFortune,
  fortuneDisabled, fortuneReason, disabled = false,
}) {
  const selected = ENEMIES[selectedEnemy];
  const slider = (key, label, min, max) => <label className="sandbox-slider" key={key}>
    <span><b>{label}</b><output>{Math.round(settings[key] * 100)}%</output></span>
    <input type="range" min={min} max={max} step="0.25" value={settings[key]} onChange={(event) => onSetting(key, Number(event.target.value))} />
  </label>;
  return <aside className={`sandbox-panel ${disabled ? "interaction-locked" : ""}`} aria-label="Controles do laboratório" aria-disabled={disabled} inert={disabled ? true : undefined}>
    <div className="sandbox-panel-heading"><div><span className="eyebrow">LABORATÓRIO</span><h2>Gerador de hostis</h2></div><button className="sandbox-reset" onClick={onReset}>Reiniciar</button></div>
    <div className="sandbox-mode-toggle" aria-label="Regras da arena">
      <button className={settings.rulesMode === "free" ? "active" : ""} onClick={() => onRulesMode("free")}>Livre</button>
      <button className={settings.rulesMode === "real" ? "active" : ""} onClick={() => onRulesMode("real")}>Regras reais</button>
    </div>
    <div className="enemy-catalog" aria-label="Catálogo de inimigos">{Object.values(ENEMIES).filter((enemy) => !enemy.hiddenFromCatalog).map((enemy) => <button
      key={enemy.id}
      className={selectedEnemy === enemy.id ? "selected" : ""}
      style={{ "--enemy-color": enemy.color }}
      onClick={() => onSelectEnemy(enemy.id)}
      title={`${enemy.label}: ${enemy.hp} HP, ${enemy.damage} dano`}
    ><img src={getEnemyPreviewUrl(enemy.id)} alt="" /><span>{enemy.label}</span></button>)}</div>
    <section className="sandbox-spawn-card">
      <header><div><span>HOSTIL SELECIONADO</span><b>{selected.label}</b></div><dl><div><dt>HP</dt><dd>{selected.hp}</dd></div><div><dt>VEL</dt><dd>{selected.speed}</dd></div><div><dt>DMG</dt><dd>{selected.damage}</dd></div></dl></header>
      <div className="sandbox-choice"><span>Rota</span><div>{[0, 1, 2, 3, 4].map((value) => <button key={value} className={row === value ? "active" : ""} onClick={() => onRow(value)}>{value + 1}</button>)}</div></div>
      <div className="sandbox-choice"><span>Quantidade</span><div>{[1, 5, 10].map((value) => <button key={value} className={count === value ? "active" : ""} onClick={() => onCount(value)}>{value}</button>)}</div></div>
      <label className="sandbox-check"><span><b>Variante Alpha</b><small>{selected.allowAlphaVariant === false ? "Indisponível para este chefe" : "8× HP, maior escala e dano"}</small></span><input type="checkbox" disabled={selected.allowAlphaVariant === false} checked={selected.allowAlphaVariant === false ? false : alpha} onChange={(event) => onAlpha(event.target.checked)} /></label>
      <label className="sandbox-check"><span><b>Agrupar no mesmo tile</b><small>Gera o grupo na mesma coluna lógica</small></span><input type="checkbox" checked={grouped} onChange={(event) => onGrouped(event.target.checked)} /></label>
          <button className="sandbox-spawn-button" onClick={onSpawn}>
            {count > 1 ? `GERAR ${count} HOSTIS` : "GERAR 1 HOSTIL"}
          </button>
    </section>
    <section className="sandbox-spawn-card">
      <header><div><span>VÓRTICE</span><b>Controle de combo</b></div></header>
      <div className="sandbox-choice"><span>Próximo golpe</span><div>{[1, 2, 3].map((step) => <button key={step} onClick={() => onForceCombo(step)}>Combo {step}</button>)}</div></div>
    </section>
    <section className="sandbox-spawn-card fortune-lab-card">
      <header><div><span>ASSISTÊNCIA ADAPTATIVA</span><b>Protocolo Fortuna</b></div></header>
      <div className="sandbox-mode-toggle" role="group" aria-label="Nível da ajuda simulada">
        <button type="button" className={fortuneTier === "difficult" ? "active" : ""} disabled={fortuneDisabled} onClick={() => onFortuneTier("difficult")}>Difícil</button>
        <button type="button" className={fortuneTier === "critical" ? "active" : ""} disabled={fortuneDisabled} onClick={() => onFortuneTier("critical")}>Crítica</button>
      </div>
      <button type="button" className="sandbox-fortune-button" disabled={fortuneDisabled} onClick={onSimulateFortune}>SIMULAR AJUDA</button>
      <small className="sandbox-fortune-reason" aria-live="polite">{fortuneReason || "Executa o fluxo completo da Cápsula da Colônia."}</small>
    </section>
    <details className="sandbox-balance" open>
      <summary>Balanceamento temporário</summary>
      {slider("enemyHpMultiplier", "HP inimigo", 0.25, 4)}
      {slider("enemySpeedMultiplier", "Velocidade inimigo", 0, 3)}
      {slider("enemyDamageMultiplier", "Dano inimigo", 0, 3)}
      {slider("troopDamageMultiplier", "Dano das tropas", 0.25, 3)}
      <label className="sandbox-check"><span><b>Base invulnerável</b><small>Rupturas não reduzem integridade</small></span><input type="checkbox" checked={settings.invulnerableBase} onChange={(event) => onSetting("invulnerableBase", event.target.checked)} /></label>
    </details>
    <div className="sandbox-cleanup"><button onClick={onInjure}>Ferir tropas −10 HP</button><button onClick={() => onClear("enemies")}>Limpar hostis</button><button onClick={() => onClear("troops")}>Limpar tropas</button></div>
  </aside>;
}

export default function GameCanvas({ phase, unlockedTroops, onFinish, onExit, sandbox = false }) {
  const loadout = useMemo(() => unlockedTroops.map((entry) => typeof entry === "string" ? entry : entry.id), [unlockedTroops]);
  const canvasRef = useRef(null);
  const assetsRef = useRef(null);
  const sessionRef = useRef(null);
  const particlesRef = useRef([]);
  const graphicsRef = useRef(createGraphicsRuntime());
  const battleRowsRef = useRef(createBattleRowBuffers());
  const adaptiveSettingsRef = useRef({});
  const hoveredCellRef = useRef(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const finishSentRef = useRef(false);
  const audioRef = useRef({});
  if (!sessionRef.current) sessionRef.current = createBattleSession(phase, loadout, Date.now(), { sandbox });

  const [loading, setLoading] = useState({ ready: false, percent: 0 });
  const [snapshot, setSnapshot] = useState(() => getSnapshot(sessionRef.current));
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sandboxSettingsState, setSandboxSettingsState] = useState(() => ({ ...sessionRef.current.sandboxSettings }));
  const [selectedEnemy, setSelectedEnemy] = useState(() => Object.keys(ENEMIES)[0]);
  const [spawnRow, setSpawnRow] = useState(0);
  const [spawnCount, setSpawnCount] = useState(1);
  const [spawnAlpha, setSpawnAlpha] = useState(false);
  const [spawnGrouped, setSpawnGrouped] = useState(false);
  const [fortuneTier, setFortuneTier] = useState("critical");
  const [selectedTroop, setSelectedTroop] = useState(null);
  const [removeMode, setRemoveMode] = useState(false);
  const [targetingDecision, setTargetingDecision] = useState(null);
  const [graphicsMetrics, setGraphicsMetrics] = useState(null);
  const showGraphicsMetrics = useMemo(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has("gfxstats"), []);
  const [message, setMessage] = useState("Selecione uma unidade e posicione-a no campo.");
  const [banner, setBanner] = useState(sandbox
    ? "LABORATÓRIO · CAMPO DE PROVAS"
    : phase.chapterMechanic?.id === "glass_echoes"
      ? `◇ ECOS DE VIDRO ${Math.round(phase.chapterMechanic.chance * 100)}% · FASE ${Number(phase.id.slice(-2))}`
      : `FASE ${Number(phase.id.slice(-2))} · ${phase.name}`);
  const settings = useMemo(loadSettings, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    if (!targetingDecision) return undefined;
    const cancel = (event) => {
      if (event.key === "Escape") {
        setTargetingDecision(null);
        sessionRef.current.pendingPositionalDecision = null;
        setMessage("Seleção de rota cancelada.");
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [targetingDecision]);

  const configureAudio = useCallback((assets) => {
    const build = (name, loop = false) => {
      const url = assets.audio[name];
      if (!url) return null;
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.loop = loop;
      return audio;
    };
    const buildFirst = (base) => build(`${base}.ogg`) || build(`${base}.wav`);
    audioRef.current = {
      theme: build("wave_theme.ogg", true),
      alert: build("wave_alert.ogg"),
      deploy: build("deploy.ogg"),
      shoot: [1, 2, 3, 4].map((index) => build(`shoot_ball_${index}.wav`)).filter(Boolean),
      melee: [1, 2, 3, 4].map((index) => build(`melee_${index}.wav`)).filter(Boolean),
      executorSlash1: buildFirst("executor_slash_1"),
      executorSlash2: buildFirst("executor_slash_2"),
      executorFinisher: buildFirst("executor_finisher"),
      executorComboReset: buildFirst("executor_combo_reset"),
      windWarning: build("wind_warning.ogg"),
      windActiveLoop: build("wind_active_loop.ogg", true),
      windPrimaryGust: build("wind_primary_gust.ogg"),
      windTroopShift: build("wind_troop_shift.ogg"),
      windEjection: build("wind_ejection.ogg"),
      windRecovery: build("wind_recovery.ogg"),
      thunder: [build("thunder_distant_1.ogg"), build("thunder_distant_2.ogg")].filter(Boolean),
    };
  }, []);

  const play = useCallback((channel, intensity = 1) => {
    const source = Array.isArray(audioRef.current[channel])
      ? audioRef.current[channel][Math.floor(Math.random() * audioRef.current[channel].length)]
      : audioRef.current[channel];
    if (!source) return;
    const instance = channel === "theme" ? source : source.cloneNode();
    const group = channel === "theme" ? settings.musicVolume : settings.effectsVolume;
    instance.volume = Math.max(0, Math.min(1, settings.masterVolume * group * intensity));
    instance.play().catch(() => {});
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    loadBattleAssets(
      phase,
      loadout,
      ({ percent }) => !cancelled && setLoading({ ready: false, percent }),
      sandbox ? { enemyIds: Object.keys(ENEMIES) } : {},
    )
      .then((assets) => {
        if (cancelled) return;
        assetsRef.current = assets;
        configureAudio(assets);
        setLoading({ ready: true, percent: 100 });
      });
    return () => {
      cancelled = true;
      audioRef.current.theme?.pause();
      audioRef.current.windActiveLoop?.pause();
    };
  }, [configureAudio, loadout, phase]);

  useEffect(() => {
    const loopAudio = audioRef.current.windActiveLoop;
    if (!loopAudio) return;
    if (paused || sessionRef.current.windCurrent?.state !== "active") {
      loopAudio.pause();
      return;
    }
    loopAudio.volume = Math.max(0, Math.min(1,
      settings.masterVolume * settings.effectsVolume * 0.42));
    loopAudio.play().catch(() => {});
  }, [paused, settings.effectsVolume, settings.masterVolume]);

  useEffect(() => {
    if (!loading.ready) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const renderScale = configureHiDPICanvas(canvas, settings, window.devicePixelRatio || 1);
    const scene = document.createElement("canvas");
    scene.width = VIEWPORT.width;
    scene.height = VIEWPORT.height;
    const sceneCtx = scene.getContext("2d");
    let animationId;
    let previous = performance.now();
    let accumulator = 0;
    let lastUi = 0;
    let lastDrawMs = 0;
    let lastPresentMs = 0;
    const loop = (now) => {
      const frameDelta = Math.min(100, now - previous);
      previous = now;
      const fortunePaused = adaptiveAidPausesSimulation(sessionRef.current.adaptiveAid?.status);
      if (!pausedRef.current && !fortunePaused) {
        accumulator += frameDelta * speedRef.current * adaptiveAidCinematicFactor(sessionRef.current);
      }
      const stepStarted = performance.now();
      while (accumulator >= 32) {
        const events = stepBattle(sessionRef.current, 32);
        pushEventParticles(particlesRef.current, events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        consumeGraphicsEvents(graphicsRef.current, events, sessionRef.current.elapsed, settings);
        if (events.some((event) => event.type === "spawn")) play("alert", 0.08);
        if (events.some((event) => event.type === "pulseCharging")) play("alert", 0.65);
        if (events.some((event) => event.type === "shoot")) play("shoot", 0.18);
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
          || event.type === "windEnemyEjected")) play("windEjection", 0.72);
        if (events.some((event) => event.type === "windCurrentRecovering")) {
          audioRef.current.windActiveLoop?.pause();
          play("windRecovery", 0.48);
        }
        if (events.some((event) => event.type === "windCurrentEnded")) {
          audioRef.current.windActiveLoop?.pause();
        }
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
          audioRef.current.theme?.pause();
          audioRef.current.windActiveLoop?.pause();
          setBanner("ONDA CONCLUÍDA · REORGANIZE A DEFESA");
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
        activeEntities,
        particles: particlesRef.current.length,
      });
      const adaptive = getAdaptiveEffects(settings, graphicsRef.current.adaptive.level);
      Object.assign(adaptiveSettingsRef.current, settings, { adaptiveLevel: adaptive.level });
      const drawStarted = performance.now();
      drawBattle(
        sceneCtx, sessionRef.current, assetsRef.current, particlesRef, graphicsRef.current,
        selectedTroop, removeMode, hoveredCellRef.current, adaptiveSettingsRef.current, adaptive,
        sessionRef.current.elapsed, interpolation, battleRowsRef.current,
      );
      lastDrawMs = performance.now() - drawStarted;
      const presentStarted = performance.now();
      presentScene(
        ctx, scene, renderScale,
        getCameraOffset(graphicsRef.current, sessionRef.current.elapsed, adaptiveSettingsRef.current),
        adaptiveSettingsRef.current, adaptive,
      );
      lastPresentMs = performance.now() - presentStarted;
      if (now - lastUi > 100) {
        lastUi = now;
        setSnapshot(getSnapshot(sessionRef.current));
        if (showGraphicsMetrics) setGraphicsMetrics({ ...graphicsRef.current.metrics });
      }
      if (sessionRef.current.result && !finishSentRef.current) {
        finishSentRef.current = true;
        audioRef.current.theme?.pause();
        audioRef.current.windActiveLoop?.pause();
        onFinish?.(sessionRef.current.result);
      }
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [loading.ready, onFinish, play, removeMode, selectedTroop, settings, showGraphicsMetrics]);

  const canvasPointFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportX = (event.clientX - rect.left) * VIEWPORT.width / rect.width;
    const viewportY = (event.clientY - rect.top) * VIEWPORT.height / rect.height;
    return viewportPointToFieldPoint(viewportX, viewportY);
  };

  const handleCanvasMove = (event) => {
    const point = canvasPointFromPointer(event);
    hoveredCellRef.current = point ? cellFromPoint(point.x, point.y) : null;
    const row = targetingDecision?.targetType === "occupiedRow" && point ? Math.floor(point.y / CELL.height) : null;
    const hoveredCol = targetingDecision?.targetType === "columnBlock" && point ? Math.floor(point.x / CELL.width) : null;
    const centerCol = hoveredCol == null ? null : Math.max(FIELD.firstTroopCol + 1, Math.min(FIELD.lastTroopCol - 1, hoveredCol));
    const preview = targetingDecision?.targetType === "columnBlock" && centerCol != null
      ? { type: "columnBlock", centerCol, columns: [centerCol - 1, centerCol, centerCol + 1] }
      : targetingDecision?.targetType === "occupiedRow" ? { type: "row", row } : null;
    if (sessionRef.current.pendingPositionalDecision) {
      sessionRef.current.pendingPositionalDecision.preview = preview;
    }
    setEnergyPickupPointer(sessionRef.current, point);
  };

  const releaseMouseTool = () => {
    if (sessionRef.current.adaptiveAid?.status === "targeting") return;
    setSelectedTroop(null);
    setRemoveMode(false);
    setMessage("Mão livre: clique em um Colosso carregado para usar o Esmagamento Total.");
  };

  const handleCanvasContextMenu = (event) => {
    event.preventDefault();
    if (sessionRef.current.adaptiveAid?.status === "targeting") return;
    if (targetingDecision) {
      setTargetingDecision(null);
      sessionRef.current.pendingPositionalDecision = null;
      setMessage(targetingDecision.targetType === "columnBlock"
        ? "Seleção da Formação avançada cancelada."
        : "Seleção de rota cancelada.");
      return;
    }
    releaseMouseTool();
  };

  const activateColossusSpecial = (troopId) => {
    const result = activateTroopSpecial(sessionRef.current, troopId);
    setMessage(result.ok
      ? result.queued ? "Esmagamento Total enfileirado após o golpe atual." : "Esmagamento Total ativado."
      : result.reason);
    if (result.ok) {
      pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, adaptiveSettingsRef.current);
      consumeGraphicsEvents(graphicsRef.current, [result.event], sessionRef.current.elapsed, settings);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleCanvasClick = (event) => {
    if (snapshot.outcome) return;
    const fieldPoint = canvasPointFromPointer(event);
    if (sessionRef.current.adaptiveAid?.status === "targeting") {
      const row = fieldPoint ? Math.floor(fieldPoint.y / CELL.height) : -1;
      const result = selectAdaptiveAidOption(sessionRef.current, sessionRef.current.adaptiveAid.pendingTarget, { row });
      if (result.ok) {
        consumeGraphicsEvents(graphicsRef.current, result.events, sessionRef.current.elapsed, settings);
        pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        setMessage(`Ataque orbital confirmado na Rota ${row + 1}.`);
      } else setMessage(result.reason);
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (isCapsuleClickable(sessionRef.current)
      && pointHitsCapsule(sessionRef.current.adaptiveAid.capsule, fieldPoint)) {
      const result = openAdaptiveAidCapsule(sessionRef.current);
      if (result.ok) {
        consumeGraphicsEvents(graphicsRef.current, result.events, sessionRef.current.elapsed, settings);
        pushEventParticles(particlesRef.current, result.events, sessionRef.current.elapsed, adaptiveSettingsRef.current);
        setSelectedTroop(null);
        setRemoveMode(false);
        setMessage("Cápsula em abertura. Aguarde a transmissão.");
      }
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (targetingDecision) {
      const point = fieldPoint;
      if (targetingDecision.targetType === "columnBlock") {
        const hoveredCol = point ? Math.floor(point.x / CELL.width) : -1;
        const centerCol = Math.max(FIELD.firstTroopCol + 1, Math.min(FIELD.lastTroopCol - 1, hoveredCol));
        const columns = [centerCol - 1, centerCol, centerCol + 1];
        if (selectDecision(sessionRef.current, targetingDecision, { centerCol, columns })) {
          sessionRef.current.pendingPositionalDecision = null;
          const eventData = { type: "advancedFormationActivated", columns, centerCol, damageBonus: 0.15, color: "#ef4444" };
          sessionRef.current.advancedFormationPulse = { columns, startedAt: sessionRef.current.elapsed, until: sessionRef.current.elapsed + 1200 };
          consumeGraphicsEvents(graphicsRef.current, [eventData], sessionRef.current.elapsed, settings);
          setTargetingDecision(null); setSnapshot(getSnapshot(sessionRef.current));
          setMessage(`Formação avançada ativada nas colunas C${columns[0] + 1} a C${columns[2] + 1}.`);
        }
        return;
      }
      const row = point ? Math.floor(point.y / CELL.height) : -1;
      const occupied = sessionRef.current.troops.some((troop) => !troop.dead && troop.row === row);
      if (!occupied) {
        setMessage(`A Rota ${row + 1} está vazia e não pode ser fortificada.`);
        return;
      }
      if (selectDecision(sessionRef.current, targetingDecision, { row })) {
        sessionRef.current.pendingPositionalDecision = null;
        const troopIds = sessionRef.current.troops.filter((troop) => !troop.dead && troop.row === row).map((troop) => troop.id);
        const eventData = { type: "routeFortified", row, hpBonus: 0.2, troopIds };
        sessionRef.current.routeFortificationPulse = { row, startedAt: sessionRef.current.elapsed, until: sessionRef.current.elapsed + 1400 };
        consumeGraphicsEvents(graphicsRef.current, [eventData], sessionRef.current.elapsed, settings);
        pushEventParticles(particlesRef.current, [eventData], sessionRef.current.elapsed, adaptiveSettingsRef.current);
        setTargetingDecision(null);
        setMessage(`Rota ${row + 1} fortificada. Tropas atuais e futuras recebem +20% de HP máximo.`);
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
      const result = removeTroop(sessionRef.current, action.cell.row, action.cell.col);
      setMessage(result.ok ? `Unidade removida · +${result.refund} energia.` : result.reason);
      if (result.ok) {
        consumeGraphicsEvents(graphicsRef.current, [result.event], sessionRef.current.elapsed, settings);
        pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, adaptiveSettingsRef.current);
      }
      setSnapshot(getSnapshot(sessionRef.current));
      return;
    }
    if (action.type === "special") {
      activateColossusSpecial(action.troop.id);
      return;
    }
    const result = placeTroop(sessionRef.current, action.troopType, action.cell.row, action.cell.col);
    setMessage(result.ok ? `${TROOPS[action.troopType].label} implantado.` : result.reason);
    if (result.ok) {
      play("deploy", 0.55);
      pushEventParticles(particlesRef.current, [result.event], sessionRef.current.elapsed, adaptiveSettingsRef.current);
      consumeGraphicsEvents(graphicsRef.current, [result.event], sessionRef.current.elapsed, settings);
    }
    setSnapshot(getSnapshot(sessionRef.current));
  };

  const handleStartWave = () => {
    if (targetingDecision || adaptiveAidBlocksIntermission(sessionRef.current.adaptiveAid?.status)) return;
    if (startWave(sessionRef.current)) {
      consumeGraphicsEvents(graphicsRef.current, [{ type: "waveStart" }], sessionRef.current.elapsed, settings);
      setBanner(`ONDA ${sessionRef.current.waveIndex + 1} · CONTATO`);
      setMessage("Onda em andamento. Novas implantações entram em cooldown.");
      play("alert", 0.75);
      play("theme", 0.75);
      setSnapshot(getSnapshot(sessionRef.current));
    }
  };

  const handleDecision = (option) => {
    if (adaptiveAidBlocksIntermission(sessionRef.current.adaptiveAid?.status)) return;
    if (option.positional) {
      sessionRef.current.pendingPositionalDecision = { id: option.id, targetType: option.targetType, targetSize: option.targetSize };
      setTargetingDecision(option);
      setSelectedTroop(null);
      setRemoveMode(false);
      setMessage(option.targetType === "columnBlock"
        ? "Passe o mouse pelo campo e clique para escolher três colunas adjacentes."
        : "Selecione uma rota ocupada para receber a fortificação.");
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
    consumeGraphicsEvents(graphicsRef.current, result.events, sessionRef.current.elapsed, settings);
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

  const handleClear = (target) => {
    clearSandboxEntities(sessionRef.current, target);
    particlesRef.current = [];
    graphicsRef.current = createGraphicsRuntime();
    setSnapshot(getSnapshot(sessionRef.current));
    setMessage(target === "enemies" ? "Todos os hostis foram removidos." : "Todas as tropas foram removidas.");
  };

  const handleInjureTroops = () => {
    const events = injureSandboxTroops(sessionRef.current, 10);
    consumeGraphicsEvents(graphicsRef.current, events, sessionRef.current.elapsed, settings);
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
    consumeGraphicsEvents(graphicsRef.current, result.events, sessionRef.current.elapsed, settings);
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
    consumeGraphicsEvents(graphicsRef.current, result.events, sessionRef.current.elapsed, settings);
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
      setMessage("Selecione uma rota para o ataque orbital.");
    } else {
      consumeGraphicsEvents(graphicsRef.current, result.events, sessionRef.current.elapsed, settings);
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

  if (!loading.ready) {
    return <div className="battle-loader" style={{ "--arena-image": `url(${getArenaUrl(phase.arenaId)})`, "--arena-primary": phase.palette.primary }}><div className="loader-scrim" /><div className="loader-content"><div className="loader-mark">GD</div><span className="eyebrow">{phase.name}</span><h2>Preparando campo tático</h2><div className="progress-track"><span style={{ width: `${loading.percent}%` }} /></div><p>{loading.percent}% · sincronizando arena, loadout e hostis</p></div></div>;
  }

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

  return (
    <section className={`battle-shell environment-${phase.environment} ${phase.chapterId === "chapter_02" ? "chapter-2-battle" : ""} ${phase.chapterId === "chapter_03" ? "chapter-3-battle" : ""} ${phase.chapterId === "chapter_04" ? "chapter-4-battle" : ""} ${sandbox ? "sandbox-battle" : ""}`}>
      <header className="battle-topbar">
        <div><span className="eyebrow">{phase.subtitle}</span><h1>{phase.name}</h1></div>
        <div className="battle-stats">
          <div className={snapshot.energyPulse ? "energy-pulse" : ""}><span>Energia</span><strong className="cyan">{sandboxSettingsState?.rulesMode === "free" ? "∞" : `${snapshot.energy}/${snapshot.energyMax}`}</strong></div>
          <div><span>Supply</span><strong>{sandboxSettingsState?.rulesMode === "free" ? "∞" : `${snapshot.supply}/${snapshot.supplyMax}`}</strong></div>
          <div><span>Integridade</span><strong className={snapshot.integrity / snapshot.integrityMax <= 0.4 ? "danger" : "success"}>{snapshot.integrity}/{snapshot.integrityMax}</strong></div>
          <div><span>{sandbox ? "Modo" : "Onda"}</span><strong>{sandbox ? (sandboxSettingsState.rulesMode === "free" ? "LIVRE" : "REAL") : `${snapshot.wave}/${snapshot.totalWaves}`}</strong></div>
          <div><span>Hostis</span><strong>{snapshot.enemies + snapshot.queued}</strong></div>
        </div>
        <div className="battle-actions">
          <button className="icon-button" disabled={fortuneTargeting} onClick={() => setPaused((value) => !value)}>{paused ? "▶" : "Ⅱ"}</button>
          <button className="speed-button" disabled={paused || fortuneTargeting} onClick={() => setSpeed((value) => {
            const speeds = sandbox ? [0.5, 1, 2, 4] : [1, 2];
            return speeds[(speeds.indexOf(value) + 1) % speeds.length];
          })}>{speed}×</button>
          <button type="button" className="release-tool-button topbar-tool-button" disabled={fortuneTargeting} onClick={releaseMouseTool} title="Também disponível com o botão direito no campo">✥ Mão livre</button>
          {!sandbox && snapshot.preparing && !snapshot.pendingDecision && !targetingDecision && !snapshot.outcome && !fortuneBlocksIntermission && <button className="start-wave topbar-start-wave" onClick={handleStartWave}>INICIAR ONDA {snapshot.wave}<span>{waveSpawnCount(phase, snapshot.wave - 1, snapshot.nextWaveEnemyCountFactor)} assinaturas</span></button>}
          <button className="ghost-button" onClick={onExit}>Sair</button>
        </div>
      </header>

      <div className="battle-main">
        <aside className={`troop-rail ${fortuneTargeting ? "interaction-locked" : ""}`} aria-disabled={fortuneTargeting} inert={fortuneTargeting ? true : undefined}>
          <div className="rail-heading"><span>LOADOUT</span><small>Selecione e posicione</small></div>
          {loadout.map((troopId) => {
            const troop = TROOPS[troopId];
            const deployment = snapshot.deploymentStats[troopId];
            const cooldown = snapshot.cooldowns[troopId] || 0;
            const coolingDown = cooldown > 0;
            const deploymentLimitReached = deployment.limitReached;
            const cooldownEnding = coolingDown && cooldown <= 800;
            const lacksEnergy = snapshot.energy < deployment.price;
            const lacksSupply = snapshot.supply < troop.supply;
            const freeMode = sandbox && sandboxSettingsState.rulesMode === "free";
            const disabled = fortuneTargeting || (!freeMode && (lacksEnergy || lacksSupply || coolingDown || deploymentLimitReached));
            const cooldownProgress = getDeployCooldownProgress(cooldown, deployment.deployCooldownMs);
            const cooldownSeconds = (cooldown / 1000).toFixed(1);
            const unavailableReason = freeMode ? "" : lacksEnergy ? "energia insuficiente" : lacksSupply ? "supply insuficiente" : "";
            const slotLabel = coolingDown
              ? `${troop.label}, recarregando, ${cooldownSeconds} segundos restantes`
              : unavailableReason ? `${troop.label}, ${unavailableReason}` : `${troop.label}, disponível para implantação`;
            return <button key={troopId} className={`troop-slot ${selectedTroop === troopId && !removeMode ? "selected" : ""} ${coolingDown ? "cooling-down" : ""} ${cooldownEnding ? "cooldown-ending" : ""} ${unavailableReason ? "resource-locked" : ""}`} style={{ "--troop-color": troop.color }} disabled={disabled} aria-label={slotLabel} onClick={() => { setRemoveMode(false); setSelectedTroop(troopId); }}>
              <span className="troop-portrait" style={{ "--cooldown-progress": `${cooldownProgress * 360}deg` }}>
                <img src={getTroopPreviewUrl(troopId)} alt="" aria-hidden="true" />
                {coolingDown && <span className="cooldown-sweep" aria-hidden="true" />}
              </span>
              <span className="troop-details"><b>{troop.label}</b><small>{troop.role}</small></span>
              <span className="slot-cost">{freeMode ? "∞" : `⚡${deployment.price}`}<small>{freeMode ? "LIVRE" : deploymentLimitReached ? `${deployment.activeCount}/${deployment.maxDeployed}` : coolingDown ? `${cooldownSeconds}s` : `S${troop.supply}`}</small></span>
            </button>;
          })}
          <button type="button" disabled={fortuneTargeting} className={`remove-button ${removeMode ? "active" : ""}`} onClick={() => { setRemoveMode((value) => !value); setSelectedTroop(null); }}>⌫ Remover · {Math.round(snapshot.refundRate * 100)}%</button>
          <div className="rail-tip">{message}</div>
        </aside>

        <div className="canvas-wrap">
          <div className={`wave-banner ${windBanner ? "wind-current-banner" : sandstormBanner ? "sandstorm-banner" : ""}`}>{snapshot.adaptiveAid.status === "targeting"
            ? "ATAQUE ORBITAL · PASSE O MOUSE E CLIQUE EM UMA ROTA"
            : snapshot.adaptiveAid.status === "incoming"
              ? "OPORTUNIDADE TÁTICA · CÁPSULA EM APROXIMAÇÃO"
              : snapshot.adaptiveAid.status === "landed"
                ? "OPORTUNIDADE TÁTICA · RECURSOS DE EMERGÊNCIA DISPONÍVEIS"
                : targetingDecision?.targetType === "columnBlock"
                  ? "FORMAÇÃO AVANÇADA · PASSE O MOUSE E CLIQUE EM TRÊS COLUNAS"
                : targetingDecision ? "SELEÇÃO DE ROTA · passe o mouse e clique para fortificar" : (windBanner || sandstormBanner || banner)}</div>
          <div className="battle-canvas-stage">
            <canvas ref={canvasRef} width={VIEWPORT.width} height={VIEWPORT.height} onClick={handleCanvasClick} onContextMenu={handleCanvasContextMenu} onMouseMove={handleCanvasMove} onMouseLeave={() => {
              hoveredCellRef.current = null;
              if (sessionRef.current.pendingPositionalDecision) sessionRef.current.pendingPositionalDecision.preview = null;
              setEnergyPickupPointer(sessionRef.current, null);
            }} aria-label="Campo de batalha em cinco rotas" />
            {!fortuneBlocksIntermission && <ColossusSpecialButtons session={sessionRef.current} onActivate={activateColossusSpecial} />}
            {snapshot.adaptiveAid.status === "landed" && <CapsuleInteractionButton capsule={snapshot.adaptiveAid.capsule} onOpen={handleOpenCapsule} />}
          </div>
          {graphicsMetrics && <div className="graphics-metrics">
            <b>{graphicsMetrics.fps.toFixed(0)} FPS · {graphicsMetrics.adaptiveLevel}</b>
            <span>F {graphicsMetrics.frameMs.toFixed(1)} ms</span>
            <span>S {graphicsMetrics.stepMs.toFixed(1)} ms</span>
            <span>D {graphicsMetrics.drawMs.toFixed(1)} ms</span>
            <span>P {graphicsMetrics.presentMs.toFixed(1)} ms</span>
            <span>E {graphicsMetrics.activeEntities}</span>
            <span>Part {graphicsMetrics.particles}</span>
            <span>Dec {graphicsMetrics.decals}</span>
            <span>V {graphicsMetrics.visualEntities}</span>
          </div>}
          {paused && <div className="pause-overlay"><span>SIMULAÇÃO PAUSADA</span><button onClick={() => setPaused(false)}>Continuar</button></div>}
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
          onSpawn={handleSpawnEnemy}
          onForceCombo={handleForceExecutorCombo}
          onInjure={handleInjureTroops}
          onClear={handleClear}
          onReset={() => resetSandbox()}
          fortuneTier={fortuneTier}
          onFortuneTier={setFortuneTier}
          onSimulateFortune={handleSimulateFortune}
          fortuneDisabled={fortuneDisabled}
          fortuneReason={fortuneReason}
          disabled={fortuneTargeting}
        />}
      </div>

      {snapshot.adaptiveAid.status === "choosing"
        ? <FortuneChoiceModal tier={snapshot.adaptiveAid.triggerTier} options={snapshot.adaptiveAid.availableOptions} onChoose={handleFortuneChoice} />
        : snapshot.pendingDecision && !targetingDecision && !fortuneBlocksIntermission
          ? <DecisionModal level={snapshot.pendingDecisionLevel} options={snapshot.pendingDecision} onChoose={handleDecision} />
          : null}
    </section>
  );
}
