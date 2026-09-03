import { CELL, FIELD } from "../battleModel.js";
import { ENEMIES } from "../content.js";
import { getEnemyMuzzleWorldPosition, getLeviathanBrineMouthPosition } from "../visualGeometry.js";
import { LEVIATHAN_SHADOW_ONLY_STATES, LEVIATHAN_UNDERWATER_STATES } from "../leviathanNereida.js";
import { isRasgamarSubmerged } from "../enemyTargeting.js";
import { registerEnemyVisualEffects } from "./enemyEffectsRegistry.js";

export function drawAbyssCharge(ctx, enemy, config, elapsed, settings) {
  if (!enemy.casting || config.attack !== "arcane") return;
  const progress = Math.max(0, Math.min(1, (elapsed - enemy.castStartedAt) / Math.max(1, config.chargeMs)));
  const origin = getEnemyMuzzleWorldPosition(enemy, config);
  const pulse = settings.reduceMotion ? 1 : 0.9 + Math.sin(elapsed / 70) * 0.1;
  const radius = (5 + progress * 10) * pulse * (enemy.scale || 1);
  const glow = ctx.createRadialGradient(origin.x - 2, origin.y - 2, 1, origin.x, origin.y, radius * 2.3);
  glow.addColorStop(0, "#ffffff"); glow.addColorStop(0.2, "#e9d5ff"); glow.addColorStop(0.55, config.color); glow.addColorStop(1, "rgba(88,28,135,0)");
  ctx.save(); ctx.fillStyle = glow; ctx.shadowBlur = 16 + progress * 12; ctx.shadowColor = config.color;
  ctx.beginPath(); ctx.arc(origin.x, origin.y, radius * 2.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f5e8ff"; ctx.beginPath(); ctx.arc(origin.x, origin.y, radius * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

export function drawStructuralRupture(ctx, entity, elapsed, settings) {
  const stacks = Number(entity.structuralRuptureHits || 0);
  if (!stacks && !entity.structuralRuptured) return;
  const y = entity.y - 58 * (entity.scale || 1) - 8;
  ctx.save(); ctx.strokeStyle = entity.structuralRuptured ? "#e0f2fe" : "#38bdf8"; ctx.fillStyle = entity.structuralRuptured ? "#38bdf8" : "rgba(56,189,248,.25)"; ctx.shadowColor = "#38bdf8"; ctx.shadowBlur = entity.structuralRuptured ? 12 : 5;
  for (let index = 0; index < 3; index += 1) { ctx.strokeRect(entity.x - 13 + index * 10, y, 7, 3); if (index < stacks) ctx.fillRect(entity.x - 13 + index * 10, y, 7, 3); }
  if (entity.structuralRuptured) {
    const pulse = settings.reduceMotion ? 0 : Math.sin(elapsed / 110) * 1.5;
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(entity.x - 18, entity.y - 25); ctx.lineTo(entity.x - 7 + pulse, entity.y - 12); ctx.lineTo(entity.x - 13, entity.y + 2); ctx.moveTo(entity.x + 16, entity.y - 21); ctx.lineTo(entity.x + 5 - pulse, entity.y - 7); ctx.lineTo(entity.x + 12, entity.y + 8); ctx.stroke();
  }
  ctx.restore();
}

export function drawRasgaCeusShadow(ctx, enemy) {
  const ratio = Math.min(1, Math.max(0, enemy.flightAltitude || 0) / Math.max(1, enemy.maximumFlightAltitude || 38));
  ctx.save(); ctx.fillStyle = `rgba(15,23,42,${.3 - ratio * .2})`; ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y, 30 * (1 - ratio * .52), 8 * (1 - ratio * .45), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

export function drawRasgaCeusTargetMarker(ctx, session, enemy) {
  if (enemy.rasgaCeusState !== "targeting" || !enemy.diveTargetId) return;
  const target = session.troops.find((troop) => troop.id === enemy.diveTargetId && !troop.dead);
  if (!target) return;
  const pulse = .5 + .5 * Math.sin(session.elapsed / 90);
  ctx.save(); ctx.strokeStyle = `rgba(251,113,133,${.45 + pulse * .35})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(target.x, target.y - 42, 22 + pulse * 4, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#fb7185"; ctx.beginPath(); ctx.moveTo(target.x, target.y - 66 - pulse * 3); ctx.lineTo(target.x - 6, target.y - 78 - pulse * 3); ctx.lineTo(target.x + 6, target.y - 78 - pulse * 3); ctx.closePath(); ctx.fill(); ctx.restore();
}

export function drawLatchedGarravinhaMarker(ctx, session, enemy) {
  if (enemy.type !== "garravinha" || enemy.garravinhaState !== "latched") return;
  const latchAge = Math.max(0, session.elapsed - (enemy.garravinhaStateStartedAt || session.elapsed)); const pulse = .5 + Math.sin(session.elapsed / 110) * .5; const teachingAlpha = latchAge < 1100 ? 1 - latchAge / 1100 : 0; const y = enemy.y - 18;
  ctx.save(); ctx.strokeStyle = `rgba(251,146,60,${.55 + pulse * .35})`; ctx.lineWidth = 1.75; ctx.shadowBlur = 10; ctx.shadowColor = "#fb7185"; ctx.beginPath(); ctx.arc(enemy.x, y, 29 + pulse * 3, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
  if (teachingAlpha > 0) { ctx.strokeStyle = `rgba(251,191,36,${teachingAlpha * .7})`; [1, 3].forEach((row) => { const laneY = row * CELL.height + CELL.height / 2; ctx.beginPath(); ctx.moveTo(enemy.x - 48, laneY); ctx.lineTo(enemy.x - 26, y); ctx.stroke(); }); }
  ctx.fillStyle = `rgba(254,215,170,${.72 + pulse * .2})`; ctx.font = "800 9px system-ui"; ctx.textAlign = "center"; ctx.fillText("ALVO PRIORITÁRIO", enemy.x, Math.max(14, y - 37)); ctx.restore();
}

export function isLeviathanShadowOnly(entity, elapsed, animationFrame = null) {
  if (entity?.type !== "leviathanNereida") return false;
  if (LEVIATHAN_SHADOW_ONLY_STATES.has(entity.leviathanState)) return true;
  if (entity.leviathanState !== "submerge") return false;
  if (Number.isInteger(animationFrame)) return animationFrame >= 5;
  const duration = Math.max(1, entity.leviathanStateEndsAt - entity.leviathanStateStartedAt);
  return (elapsed - entity.leviathanStateStartedAt) / duration >= 5 / 8;
}

export function isRasgamarShadowOnly(entity, elapsed, animationFrame = null) {
  if (!isRasgamarSubmerged(entity)) return false;
  if (entity.rasgamarState !== "dive") return true;
  if (Number.isInteger(animationFrame)) return animationFrame >= 3;
  if (!Number.isFinite(elapsed)) return false;
  const duration = Math.max(1, entity.rasgamarStateEndsAt - entity.rasgamarStateStartedAt);
  return (elapsed - entity.rasgamarStateStartedAt) / duration >= 3 / 4;
}

export function drawLeviathanBossHealth(ctx, entity) {
  if (entity.type !== "leviathanNereida") return;
  const width = 420; const x = (FIELD.width - width) / 2; const y = 14; const hp = Math.max(0, Math.min(1, entity.hp / Math.max(1, entity.maxHp)));
  ctx.save(); ctx.fillStyle = "rgba(2,12,24,.86)"; ctx.fillRect(x - 5, y - 6, width + 10, 30); ctx.fillStyle = "#102b45"; ctx.fillRect(x, y + 10, width, 10); ctx.fillStyle = entity.leviathanPhase === 3 ? "#a78bfa" : entity.leviathanPhase === 2 ? "#38bdf8" : "#67e8f9"; ctx.fillRect(x, y + 10, width * hp, 10); ctx.strokeStyle = "#bae6fd"; ctx.strokeRect(x, y + 10, width, 10); ctx.strokeStyle = "rgba(255,255,255,.45)"; [.35, .70].forEach((mark) => { ctx.beginPath(); ctx.moveTo(x + width * mark, y + 8); ctx.lineTo(x + width * mark, y + 22); ctx.stroke(); }); ctx.fillStyle = "#e0f2fe"; ctx.font = "800 12px system-ui"; ctx.textAlign = "center"; ctx.fillText(`LEVIATÃ DE NEREIDA · FASE ${entity.leviathanPhase || 1}`, FIELD.width / 2, y + 1); ctx.restore();
}

export function drawRasgamarUnderwaterShadow(ctx, entity, elapsed, settings) {
  const pulse = settings.reduceMotion ? 0 : Math.sin(elapsed / 180) * 2;
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "rgba(2, 30, 48, 0.78)";
  ctx.shadowColor = "rgba(34, 211, 238, 0.28)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(entity.x, entity.y + 34, 38 + pulse, 11 + pulse * 0.25, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#67e8f9";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(entity.x, entity.y + 34, 46 + pulse * 2, 15 + pulse * 0.4, -0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLeviathanUnderwaterShadow(ctx, entity, session, config, settings) {
  const age = session.elapsed - entity.leviathanStateStartedAt;
  const pulse = settings.reduceMotion ? 0 : Math.sin(age / 260);
  const range = config.devastatingDive.shadowOpacityMax - config.devastatingDive.shadowOpacityMin;
  const visualX = entity.x + (config.visualOffsetX || config.spriteOffsetX || 0) * (entity.scale || config.scale || 1);
  ctx.save();
  ctx.globalAlpha = Math.max(.34, config.devastatingDive.shadowOpacityMin + range * (.5 + pulse * .5));
  ctx.fillStyle = "#062c43";
  ctx.shadowColor = "rgba(34,211,238,.48)";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.ellipse(visualX - 44, entity.y + 16, 72 + pulse * 3, 24 + pulse, -.18, 0, Math.PI * 2);
  ctx.ellipse(visualX + 34, entity.y + 24, 80 + pulse * 4, 18 + pulse, .16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = settings.reduceMotion ? .38 : .46 + pulse * .08;
  ctx.strokeStyle = "rgba(103,232,249,.78)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(visualX - 4, entity.y + 20, 126 + pulse * 5, 34 + pulse * 2, -.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = .28;
  ctx.strokeStyle = "rgba(186,230,253,.8)";
  ctx.beginPath();
  ctx.moveTo(visualX - 132, entity.y + 28);
  ctx.quadraticCurveTo(visualX - 18, entity.y + 42 + pulse * 3, visualX + 126, entity.y + 30);
  ctx.stroke();
  if (["submergedStalk", "submergedFinalApproach"].includes(entity.leviathanState)) {
    const interval = entity.leviathanState === "submergedFinalApproach" ? 300 : config.devastatingDive.submergedBreathEveryMs;
    const phase = (age % interval) / interval;
    ctx.strokeStyle = `rgba(165,243,252,${.12 + phase * .38})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(entity.x - 10, entity.y - 6, 8 + phase * 24, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(207,250,254,.62)";
    for (let index = 0; index < 3; index += 1) { ctx.beginPath(); ctx.arc(visualX - 18 + index * 11, entity.y + 8 - phase * (20 + index * 5), 2 + index * .5, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

export function drawLeviathanBrineJet(ctx, entity, session, config) {
  const attackRow = entity.leviathanAttackRow;
  if (!Number.isInteger(attackRow)) return;
  const laneTop = attackRow * CELL.height; const laneY = laneTop + CELL.height * .72;
  const releasedAt = entity.leviathanBrineReleasedAt;
  if (!Number.isFinite(releasedAt)) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, laneTop, FIELD.width, CELL.height); ctx.clip();
    ctx.fillStyle = "rgba(34,211,238,.12)"; ctx.fillRect(0, laneTop, FIELD.width, CELL.height);
    ctx.strokeStyle = "rgba(186,230,253,.66)"; ctx.lineWidth = 2; ctx.setLineDash?.([12, 10]);
    ctx.beginPath(); ctx.moveTo(0, laneY); ctx.lineTo(FIELD.width, laneY); ctx.stroke(); ctx.restore();
    return;
  }
  const elapsed = session.elapsed - releasedAt;
  if (elapsed < 0) return;
  const height = config.brineJet.streamHeightPx || 58;
  const logicalFrontX = Number.isFinite(entity.leviathanBrineFrontX)
    ? entity.leviathanBrineFrontX : FIELD.enemyEntryCol * CELL.width + CELL.width;
  const fadeStart = Math.max(0, (entity.leviathanBrineEndsAt || Infinity) - config.brineJet.fadeOutMs);
  const fade = session.elapsed >= fadeStart ? Math.max(0, (entity.leviathanBrineEndsAt - session.elapsed) / config.brineJet.fadeOutMs) : 1;
  const mouthPhase = elapsed < config.brineJet.mouthToGroundMs;
  const frame = Math.min(7, Math.max(0, Math.floor((session.elapsed - entity.leviathanAnimationStartedAt) / (config.animationFrameMs?.brineJet || 150))));
  const mouth = getLeviathanBrineMouthPosition(entity, config, frame);
  const sourceX = mouth.x - 8;
  const frontX = Math.min(logicalFrontX, sourceX - (config.brineJet.visualTravelLeadPx || 34));
  const wave = (x, phase = 0) => Math.sin(x * .042 + elapsed * .019 + phase) * 3;
  ctx.save();
  if (!mouthPhase) { ctx.beginPath(); ctx.rect(0, laneTop, FIELD.width, CELL.height); ctx.clip(); }
  ctx.globalAlpha = fade;
  ctx.beginPath();
  if (mouthPhase) {
    const t = elapsed / Math.max(1, config.brineJet.mouthToGroundMs);
    const contactX = sourceX - Math.max(42, CELL.width * .62 * t);
    ctx.moveTo(mouth.x, mouth.y - height * .13);
    ctx.quadraticCurveTo(sourceX - CELL.width * .18, mouth.y - 20, contactX, laneY - height * t);
    ctx.lineTo(contactX, laneY);
    ctx.quadraticCurveTo(sourceX - CELL.width * .14, mouth.y + height * .12, mouth.x, mouth.y + height * .13);
  } else {
    ctx.moveTo(sourceX, laneY);
    for (let x = sourceX; x >= frontX; x -= 12) ctx.lineTo(x, laneY - height + wave(x));
    ctx.lineTo(frontX, laneY);
  }
  ctx.closePath(); ctx.fillStyle = "rgba(14,165,194,.56)"; ctx.fill();
  if (!mouthPhase) {
    ctx.beginPath();
    for (let x = sourceX; x >= frontX; x -= 12) { const y = laneY - height + wave(x, .7); if (x === sourceX) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = "rgba(240,249,255,.86)"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(frontX, laneY - height * .4, config.brineJet.frontSplashRadiusPx || 34, Math.PI * .92, Math.PI * 1.92);
    ctx.strokeStyle = "rgba(103,232,249,.72)"; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

export function drawLeviathanBossEffects(ctx, entity, session, settings) {
  if (entity.type !== "leviathanNereida") return;
  const state = entity.leviathanState;
  const submerged = entity.leviathanSubmerged || LEVIATHAN_UNDERWATER_STATES.has(state);
  const pulse = settings.reduceMotion ? 0 : Math.sin(session.elapsed / 130) * 4;
  ctx.save();
  if (submerged) drawLeviathanUnderwaterShadow(ctx, entity, session, ENEMIES.leviathanNereida, settings);
  const targets = entity.leviathanTargetCells || [];
  if (entity.leviathanQueuedAttack && ["surfaceSwim", "submerge", "submergedTravel", "vortexCast", "biteAbyss", "tailSweep", "brineJet", "delugeCharge"].includes(state)) {
    ctx.strokeStyle = entity.leviathanQueuedAttack === "deluge" ? "#a78bfa" : "#67e8f9"; ctx.lineWidth = 2;
    targets.forEach((target) => { const x = target.col * CELL.width + CELL.width / 2; const y = target.row * CELL.height + CELL.height / 2; ctx.beginPath(); ctx.arc(x, y, 18 + pulse, 0, Math.PI * 2); ctx.stroke(); });
  }
  if (state === "brineJet") drawLeviathanBrineJet(ctx, entity, session, ENEMIES.leviathanNereida);
  if (state === "vortexCast") { ctx.strokeStyle = "rgba(103,232,249,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(entity.x, entity.y, 48 + pulse, 0, Math.PI * 1.8); ctx.stroke(); }
  if (state === "delugeRelease") { ctx.fillStyle = "rgba(103,232,249,.22)"; ctx.fillRect(0, 0, FIELD.width, FIELD.height); }
  if (state === "exposedGills") { ctx.fillStyle = "rgba(167,139,250,.35)"; ctx.beginPath(); ctx.arc(entity.x - 18, entity.y - 42, 22 + pulse, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

export function drawSilicaDiggerSand(ctx, enemy, elapsed, settings) {
  if (enemy.type !== "silicaDigger" || !enemy.moving || settings.reduceMotion) return;
  const seed = Number(/\d+/.exec(enemy.id)?.[0] || 0); const phase = elapsed / 65 + seed * 0.73;
  ctx.save(); ctx.fillStyle = "rgba(245, 158, 11, .42)";
  for (let index = 0; index < 3; index += 1) {
    const cycle = (phase + index * 1.7) % 5;
    const x = enemy.x - 25 + cycle * 5; const y = enemy.y + CELL.height * 0.39 - Math.sin(cycle / 5 * Math.PI) * 7;
    ctx.globalAlpha = Math.max(0, 0.55 - cycle * 0.09); ctx.beginPath(); ctx.ellipse(x, y, 2.6 - index * 0.35, 1.4 - index * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function silicaDiggerEmergenceProgress(enemy, elapsed) {
  if (enemy.type !== "silicaDigger" || enemy.emergeState !== "emerging") return 1;
  return Math.max(0, Math.min(1, (elapsed - enemy.emergeStartedAt) / Math.max(1, ENEMIES.silicaDigger.emergeDurationMs)));
}

export function drawSilicaDiggerEmergence(ctx, enemy, elapsed, settings) {
  if (enemy.type !== "silicaDigger" || enemy.emergeState !== "emerging") return;
  const progress = silicaDiggerEmergenceProgress(enemy, elapsed); const fade = 1 - progress; const intensity = Math.sin(progress * Math.PI) * fade;
  const groundY = enemy.y + 42 * enemy.scale; const seed = Number(/\d+/.exec(enemy.id)?.[0] || 0);
  ctx.save(); ctx.fillStyle = `rgba(180, 112, 32, ${0.34 * fade})`; ctx.beginPath(); ctx.ellipse(enemy.x, groundY, (32 + 8 * intensity) * enemy.scale, (7 + 3 * intensity) * enemy.scale, 0, 0, Math.PI * 2); ctx.fill();
  if (!settings.reduceMotion) {
    ctx.fillStyle = `rgba(245, 158, 11, ${0.64 * intensity})`;
    for (let index = 0; index < 5; index += 1) { const phase = seed * 0.37 + index * 1.31; const spread = (10 + index * 4) * enemy.scale; const x = enemy.x + Math.cos(phase) * spread; const y = groundY - Math.sin(progress * Math.PI) * (10 + index * 3) * enemy.scale + Math.sin(phase) * 3; ctx.beginPath(); ctx.arc(x, y, (1.2 + index % 2) * enemy.scale, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.58 * intensity})`; ctx.lineWidth = Math.max(1, enemy.scale);
    for (let index = 0; index < 3; index += 1) { const direction = index % 2 ? 1 : -1; const x = enemy.x + direction * (12 + index * 7) * enemy.scale; const y = groundY - (5 + index * 4) * intensity * enemy.scale; ctx.beginPath(); ctx.moveTo(x - 2, y + 2); ctx.lineTo(x + direction * 4, y - 2); ctx.stroke(); }
  }
  ctx.restore();
}

registerEnemyVisualEffects("silicaDigger", { underlay: drawSilicaDiggerSand, beforeSprite: drawSilicaDiggerEmergence });

/** Procedural fallback art for glass enemies without a raster sprite. */
export function drawProceduralGlassEnemy(ctx, entity, config, elapsed, filter = "none") {
  if (!config.proceduralKind) return false;
  const scale = entity.scale || 1; const pulse = .82 + Math.sin(elapsed / 150 + entity.row) * .12;
  const glass = ctx.createLinearGradient(-30 * scale, -28 * scale, 34 * scale, 25 * scale); glass.addColorStop(0, "#07111a"); glass.addColorStop(.48, config.color); glass.addColorStop(1, "#8b5cf6");
  const polygon = (points, fill = glass, stroke = "#c7fff0") => { ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(.8, 1.15 * scale); ctx.stroke(); };
  ctx.save(); ctx.translate(entity.x, entity.y); ctx.filter = filter; ctx.shadowBlur = 12 * scale; ctx.shadowColor = config.color;
  if (config.proceduralKind === "estilha") {
    polygon([[-30, -4], [-13, -20], [18, -17], [31, 1], [10, 17], [-20, 13]], "#101128"); for (const side of [-1, 1]) { ctx.strokeStyle = side < 0 ? "#7fffd4" : "#8b5cf6"; ctx.lineWidth = 4 * scale; [-17, 0, 17].forEach((offset, index) => { ctx.beginPath(); ctx.moveTo(offset * scale, (4 + index * 2) * scale); ctx.lineTo((offset + side * (17 + index * 3)) * scale, (20 + index * 3) * scale); ctx.lineTo((offset + side * (23 + index * 4)) * scale, 27 * scale); ctx.stroke(); }); } polygon([[-24, -12], [-9, -31], [0, -10]], "#211247"); ctx.fillStyle = "#ffcf70"; ctx.fillRect(-34 * scale, -2 * scale, 11 * scale, 3.5 * scale);
  } else if (config.proceduralKind === "vitrarca") {
    polygon([[-19, -42], [0, -58], [19, -42], [15, 3], [0, 20], [-15, 3]], "#0a1220"); polygon([[-22, -37], [-44, -18], [-27, 4], [-8, -19]], "#102f35"); polygon([[22, -37], [44, -18], [27, 4], [8, -19]], "#28164c"); ctx.strokeStyle = "#7fffd4"; ctx.lineWidth = 7 * scale; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * 18 * scale, -15 * scale); ctx.quadraticCurveTo(side * 48 * scale, 5 * scale, side * 33 * scale, 38 * scale); ctx.stroke(); ctx.beginPath(); ctx.moveTo(side * 8 * scale, 8 * scale); ctx.lineTo(side * 20 * scale, 42 * scale); ctx.stroke(); } ctx.fillStyle = "#8b5cf6"; ctx.beginPath(); ctx.arc(0, -38 * scale, 5 * scale * pulse, 0, Math.PI * 2); ctx.fill();
  } else if (config.proceduralKind === "obsidonte") {
    polygon([[-42, -43], [-10, -61], [34, -49], [49, -15], [35, 11], [-35, 12], [-53, -16]], "#080a12", "#7fffd4"); polygon([[-42, -26], [-61, -7], [-54, 30], [-32, 20], [-21, -9]], "#111522"); polygon([[39, -29], [60, -8], [55, 32], [31, 22], [20, -8]], "#111522"); polygon([[-27, 7], [-18, 39], [-4, 39], [-1, 8]], "#080a12"); polygon([[27, 7], [18, 39], [4, 39], [1, 8]], "#080a12"); ctx.fillStyle = "#ffcf70"; ctx.shadowColor = "#ffcf70"; ctx.beginPath(); ctx.arc(0, -18 * scale, 10 * scale * pulse, 0, Math.PI * 2); ctx.fill();
  } else if (config.proceduralKind === "refrator") {
    polygon([[0, -43], [17, -18], [10, 18], [0, 33], [-10, 18], [-17, -18]], "#090b18"); polygon([[-8, -19], [-51, -39], [-39, 6], [-15, 20]], "rgba(127,255,212,.44)"); polygon([[8, -19], [51, -39], [39, 6], [15, 20]], "rgba(127,255,212,.44)"); ctx.strokeStyle = "#ffcf70"; ctx.lineWidth = 3 * scale; for (let index = 0; index < 3; index += 1) { const angle = elapsed / 520 + index * Math.PI * 2 / 3; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 9 * scale, (-13 + Math.sin(angle) * 9) * scale); ctx.lineTo(Math.cos(angle) * 19 * scale, (-13 + Math.sin(angle) * 19) * scale); ctx.stroke(); } ctx.fillStyle = "#8b5cf6"; ctx.beginPath(); ctx.arc(0, -13 * scale, 9 * scale * pulse, 0, Math.PI * 2); ctx.fill();
  } else if (config.proceduralKind === "crisalio") {
    polygon([[-38, -25], [-28, -52], [-13, -68], [13, -68], [30, -50], [40, -22], [31, 16], [-31, 16]], "#070913", "#a78bfa"); polygon([[-28, -35], [-48, -20], [-43, 14], [-25, 28], [-15, -7]], "#111522", "#7fffd4"); polygon([[28, -35], [48, -20], [43, 14], [25, 28], [15, -7]], "#111522", "#7fffd4"); for (let index = 0; index < 5; index += 1) { const x = (index - 2) * 12; polygon([[x - 6, -67], [x, -92 - Math.abs(index - 2) * 2], [x + 7, -67], [x, -55]], index % 2 ? "#7c3aed" : "#5eead4", "#e9d5ff"); } ctx.strokeStyle = "#7fffd4"; ctx.lineWidth = 2.4 * scale; for (let index = 0; index < 3; index += 1) { const angle = elapsed / 760 + index * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(0, -28 * scale, (28 + index * 8) * scale, angle, angle + .75); ctx.stroke(); } ctx.fillStyle = "#e9d5ff"; ctx.beginPath(); ctx.arc(0, -35 * scale, 7 * scale * pulse, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore(); return true;
}
