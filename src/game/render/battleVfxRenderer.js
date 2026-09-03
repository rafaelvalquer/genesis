import { ENEMIES, TROOPS } from "../content.js";
import { VIEWPORT } from "../battleModel.js";
import { getDroneSentinelaLayout, getEnemyDeathVisualY, getEnemySpriteRect } from "../visualGeometry.js";
import { drawSprite, drawSpriteInRect, getTroopVisualEntity } from "./battleSceneRenderer.js";
import { isSystemEnabledForPhase } from "../phaseRules.js";
import { drawParticles, drawProjectileCollection } from "../projectileRenderer.js";
import { drawDematerializationPulses, drawPulseBeams, drawPulseDisintegrations } from "../pulseRenderer.js";
import { drawDeploymentEffects, drawDynamicLights } from "../graphicsRenderer.js";
import { drawSporeClouds, drawSporeFruitEmissive } from "../chapter07/sporeFruitRenderer.js";
import { drawWindEffects } from "../windCurrentRenderer.js";
import { drawAdaptiveAid } from "../adaptiveAidRenderer.js";

/** Collectible visual pass; it has no gameplay side effects. */
export function drawEnergyPickups(ctx, pickups, elapsed, settings) {
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
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = halo; ctx.shadowBlur = 20; ctx.shadowColor = "#facc15";
    ctx.beginPath(); ctx.arc(x, y, 25 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff7ae"; ctx.beginPath(); ctx.arc(x, y, 7 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x - 2, y - 2, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export function drawTreeBroodBursts(ctx, runtime, assets, now, settings) {
  const frames = assets.effects?.treeBroodBurst?.burst || [];
  if (!frames.length) return;
  for (const burst of runtime.broodBursts || []) {
    const progress = Math.min(.999, Math.max(0, (now - burst.born) / burst.life));
    const image = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
    if (!image) continue;
    const size = 128;
    ctx.save();
    ctx.globalAlpha = settings.reduceMotion ? .55 : 1 - progress * .35;
    ctx.drawImage(image, burst.x - size / 2, burst.y - size * .2, size, size);
    ctx.restore();
  }
}

export function drawEmissiveBattle(ctx, session, assets, particles, runtime, settings, adaptive, now, interpolation, projectileAssets, drawTreeBroodBursts, drawEnergyPickups) {
  ctx.save(); ctx.translate(0, VIEWPORT.fieldOffsetY);
  const dematerializationEnabled = isSystemEnabledForPhase(session.phase, "dematerializationPulse");
  if (dematerializationEnabled) drawDematerializationPulses(ctx, session.dematerializationPulses, assets.defenses?.pulsoDesmaterializacao, session.elapsed, settings);
  drawProjectileCollection(ctx, session.projectiles, interpolation, settings, projectileAssets); drawProjectileCollection(ctx, session.enemyProjectiles, interpolation, settings, projectileAssets);
  drawSporeFruitEmissive(ctx, session.sporeFruits, session.elapsed, settings); drawSporeClouds(ctx, session.sporeClouds, session.elapsed, settings); drawTreeBroodBursts(ctx, runtime, assets, now, settings); drawWindEffects(ctx, runtime, now, settings, assets.effects?.windCurrent); drawAdaptiveAid(ctx, session, assets, session.elapsed, settings);
  if (dematerializationEnabled) drawPulseDisintegrations(ctx, runtime, assets, now, settings);
  drawDeploymentEffects(ctx, runtime, now, settings); drawDynamicLights(ctx, runtime, now, settings, adaptive); if (dematerializationEnabled) drawPulseBeams(ctx, runtime, now, settings); drawEnergyPickups(ctx, session.energyPickups, session.elapsed, settings); drawParticles(ctx, particles, now, settings, true); ctx.restore();
}

/** Sprite death passes are visual-only and consume graphics runtime snapshots. */
export function drawDeathVisuals(ctx, runtime, assets, now, phase) {
  for (const death of runtime.deaths) {
    const progress = Math.min(1, (now - death.born) / death.life); const entity = death.entity;
    const config = death.kind === "troop" ? TROOPS[entity.type] : ENEMIES[entity.type]; const groups = death.kind === "troop" ? assets.troops[entity.type] : assets.enemies[entity.type];
    const droneDeathState = death.kind === "troop" && entity.type === "droneSentinela" ? "death" : null;
    const dedicatedDeathState = droneDeathState || (death.kind === "enemy" ? (entity.type === "enguiaRasgamar" ? (entity.rasgamarSubmerged ? "deathSubmerged" : "deathSurface") : entity.type === "workerQueenEgg" ? "destroy" : groups?.death ? "death" : null) : groups?.death ? "death" : null);
    const state = dedicatedDeathState || (groups?.attack ? "attack" : groups?.walking ? "walking" : groups?.idle ? "idle" : "defense"); const frames = groups?.[state] || []; const frame = Math.min(frames.length - 1, Math.floor(progress * Math.max(1, frames.length))); const image = frames[frame] || frames[0];
    const height = death.kind === "troop" ? (entity.type === "droneSentinela" ? config.deathVisual.height : config?.attackVisual?.height || 126) * (config?.spriteScale || 1) : 128 * (entity.scale || 1); const deathY = death.kind === "enemy" ? getEnemyDeathVisualY(entity, progress) : entity.y;
    const airborneDerivante = entity.type === "derivante" && ["jumpPrepare", "jumpTakeoff", "jumping", "windGlide", "landing"].includes(entity.chapterFourState);
    ctx.save(); ctx.translate(entity.x, deathY); if (!dedicatedDeathState) ctx.rotate((death.kind === "enemy" ? .22 : -.18) * progress); const deathEntity = { ...entity, x: 0, y: airborneDerivante ? 0 : progress * 9 }; const filter = dedicatedDeathState ? `drop-shadow(0 0 7px ${phase.palette.accent})` : `grayscale(${progress * .6}) drop-shadow(0 0 5px ${phase.palette.accent})`;
    if (death.kind === "troop") {
      if (entity.type === "droneSentinela") for (const unit of getDroneSentinelaLayout(entity.droneDeathLevel || entity.droneCount)) { deathEntity.x = unit.x; deathEntity.y = unit.y + progress * 9; drawSprite(ctx, image, deathEntity, height * unit.scale, Math.max(0, 1 - progress * progress), filter, null, config?.flipX); }
      else drawSprite(ctx, image, getTroopVisualEntity(deathEntity, config), height, Math.max(0, 1 - progress * progress), filter, null, config?.flipX);
    } else { const aspectRatio = image?.width && image?.height ? image.width / image.height : 1; const rect = getEnemySpriteRect(deathEntity, config, state, frame, aspectRatio); drawSpriteInRect(ctx, image, rect, dedicatedDeathState ? Math.max(0, 1 - progress * .45) : Math.max(0, 1 - progress * progress), filter); }
    ctx.restore();
  }
}
