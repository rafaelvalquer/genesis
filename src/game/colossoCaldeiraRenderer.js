import { CELL } from "./visualGeometry.js";
import colossoManifest from "./assets/enemy/colossoCaldeira/manifest.json";
import { drawColossoHitZoneOverlay } from "./colossoHitZoneDebug.js";

const laneY = (row) => row * CELL.height + CELL.height / 2;
const cellX = (col) => col * CELL.width + CELL.width / 2;
const attackState = (state = "") => /(?:Telegraph|Attack|finalCollapse)/.test(state);
// Global presentation size only. Animation anchors remain unitary; this grows
// the entire boss around its fixed foot root instead of reintroducing a
// per-state or per-frame scale correction.
const colossoRenderSize = 546;

export const COLOSSO_PHASE_VISUAL = Object.freeze({
  1: Object.freeze({ bodyGlow: 18, coreColor: "#f97316", coreInnerColor: "#fbbf24", coreGlow: 18, emberCount: 0, groundPulse: 0, smoke: 0 }),
  2: Object.freeze({ bodyGlow: 24, coreColor: "#fb923c", coreInnerColor: "#fde047", coreGlow: 28, emberCount: 4, groundPulse: .35, smoke: 0 }),
  3: Object.freeze({ bodyGlow: 30, coreColor: "#fde047", coreInnerColor: "#fff7ed", coreGlow: 42, emberCount: 8, groundPulse: .65, smoke: .30 }),
});

const CORE_OFFSET_BY_STATE = Object.freeze({
  idle: { x: 0, y: 0 }, slamAttack: { x: -3, y: 4 }, seismicAttack: { x: 0, y: 5 },
  finalCollapse: { x: -2, y: 12 }, coreExposed: { x: 0, y: 8 },
});

const EXPOSED_CORE_VISUAL = Object.freeze({ exposed: true, radius: 25, glow: 50, pulseSpeed: 260 });
const CLOSED_CORE_VISUAL = Object.freeze({ exposed: false, radius: 18, glow: 20, pulseSpeed: 900 });

export function getColossoPhaseVisual(enemy) {
  const phase = Math.max(1, Math.min(3, Number(enemy?.colossoPhase) || 1));
  return COLOSSO_PHASE_VISUAL[phase];
}

export function getColossoCoreVisual(enemy) {
  return enemy?.colossoState === "coreExposed" ? EXPOSED_CORE_VISUAL : CLOSED_CORE_VISUAL;
}

export function getColossoCorePoint(layout, state = "idle") {
  const offset = CORE_OFFSET_BY_STATE[state] || {};
  return { x: layout.rootX + (offset.x || 0), y: layout.rootY - layout.height * .39 + (offset.y || 0) };
}

export function getColossoTelegraphVisual(enemy) {
  if (!attackState(enemy?.colossoState)) return null;
  const attack = enemy.colossoQueuedAttack;
  if (attack === "rift" && enemy.colossoRiftTarget) return { attack, kind: "riftRing", cells: [enemy.colossoRiftTarget] };
  if (attack === "slam") return { attack, kind: "slamArea", cells: enemy.colossoTargetCells || [] };
  if (attack === "fracture") return { attack, kind: "fractureCracks", cells: enemy.colossoTargetCells || [] };
  if (attack === "seismic") return { attack, kind: "seismicChevrons", rows: enemy.colossoTargetRows || [] };
  return null;
}

export function getColossoCollapseTimeline(enemy) {
  if (enemy?.colossoState !== "finalCollapse") return [];
  const rows = enemy.colossoCollapseRows || [];
  const index = Math.max(0, Number(enemy.colossoCollapseIndex) || 0);
  return rows.slice(index).map((row, offset) => ({ row, order: offset + 1, imminent: offset === 0 }));
}

export function isColossoAnchorDebugEnabled(search = typeof window !== "undefined" ? window.location.search : "", isDevelopment = import.meta.env.DEV) {
  return Boolean(isDevelopment && new URLSearchParams(search).has("debugColossoAnchor"));
}

export function isColossoCoreDebugEnabled(search = typeof window !== "undefined" ? window.location.search : "", isDevelopment = import.meta.env.DEV) {
  return Boolean(isDevelopment && new URLSearchParams(search).has("debugColossoCore"));
}

export function getColossoSpriteLayout(enemy, animation = {}, manifest = colossoManifest) {
  const state = animation.state || "idle";
  const frame = Math.max(0, Number(animation.frame) || 0);
  const frameAnchor = manifest?.frameAnchors?.[state]?.[frame] || manifest?.anchor || { x: .68, y: .72 };
  const scale = Number(frameAnchor.scale) > 0 ? Number(frameAnchor.scale) : 1;
  const width = colossoRenderSize * scale;
  const height = colossoRenderSize * scale;
  const rootOffset = manifest?.visualRootOffset || {};
  const rootX = (Number.isFinite(enemy?.x) ? enemy.x : 0) + (Number(rootOffset.x) || 0);
  const rootY = (Number.isFinite(enemy?.y) ? enemy.y : laneY(2)) + (Number(rootOffset.y) || 0);
  return {
    rootX, rootY, width, height,
    left: rootX - width * frameAnchor.x,
    top: rootY - height * frameAnchor.y,
    anchor: frameAnchor,
  };
}

function drawColossoUnderlay(ctx, enemy, layout, pulse, effects, elapsed = 0, settings = {}) {
  const phaseVisual = getColossoPhaseVisual(enemy);
  const x = layout.rootX; const y = layout.rootY;
  ctx.save();
  ctx.fillStyle = "rgba(69,10,10,.52)";
  // `y` is the fixed midpoint between the Colosso's feet. Keep the contact
  // shadow at that same ground plane; the former +72 offset belonged to the
  // pre-anchor art and visibly floated below the new bipedal sprite.
  ctx.beginPath(); ctx.ellipse(x + 10, y + 14, 220, 43, 0, 0, Math.PI * 2); ctx.fill();
  if (phaseVisual.groundPulse > 0) {
    const groundPulse = settings.reduceMotion ? 0 : .5 + .5 * Math.sin(elapsed / 420);
    ctx.globalAlpha = phaseVisual.groundPulse * (.22 + groundPulse * .28);
    ctx.strokeStyle = phaseVisual.coreColor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 12, 155 + groundPulse * 12, 30 + groundPulse * 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (phaseVisual.smoke > 0 && !settings.reduceMotion) {
    const smokePoints = [-.22, 0, .22];
    smokePoints.forEach((offset, index) => {
      const smokePulse = (elapsed / (3200 + index * 330) + index * .31) % 1;
      ctx.globalAlpha = phaseVisual.smoke * .18 * (1 - smokePulse);
      ctx.fillStyle = "#57534e";
      ctx.beginPath(); ctx.arc(layout.rootX + layout.width * offset, layout.rootY - layout.height * (.42 + smokePulse * .16), 13 + smokePulse * 13, 0, Math.PI * 2); ctx.fill();
    });
  }
  for (const rift of enemy.colossoRifts || []) {
    const rx = cellX(rift.col); const ry = laneY(rift.row);
    ctx.strokeStyle = `rgba(251,146,60,${.52 + pulse * .38})`; ctx.lineWidth = 6 + pulse * 4;
    ctx.beginPath(); ctx.moveTo(rx - 30, ry + 4); ctx.lineTo(rx - 8, ry - 6); ctx.lineTo(rx + 8, ry + 7); ctx.lineTo(rx + 32, ry - 5); ctx.stroke();
    ctx.fillStyle = "rgba(255,236,153,.72)"; ctx.fillRect(rx - 11, ry - 3, 22, 6);
      const frames = effects?.colossoRift?.active || [];
      const startedAt = rift.startedAt ?? enemy.colossoStateStartedAt ?? elapsed;
      const frame = frames[Math.floor(Math.max(0, elapsed - startedAt) / 120) % Math.max(1, frames.length)];
    if (frame) ctx.drawImage(frame, rx - 46, ry - 46, 92, 92);
  }
  ctx.restore();
}

function drawColossoBackBody(ctx, layout, image, animation, previous = null, phaseVisual = COLOSSO_PHASE_VISUAL[1]) {
  ctx.save();
  ctx.shadowBlur = phaseVisual.bodyGlow; ctx.shadowColor = phaseVisual.coreColor;
  if (previous?.image) {
    ctx.globalAlpha = Math.max(0, 1 - previous.progress);
    ctx.drawImage(previous.image, previous.layout.left, previous.layout.top, previous.layout.width, previous.layout.height);
    ctx.globalAlpha = Math.min(1, previous.progress);
  }
  if (image) ctx.drawImage(image, layout.left, layout.top, layout.width, layout.height);
  else {
    ctx.fillStyle = "rgba(220,38,38,.22)"; ctx.strokeStyle = "#f87171"; ctx.lineWidth = 3;
    ctx.strokeRect(layout.left, layout.top, layout.width, layout.height);
    ctx.fillRect(layout.left, layout.top, layout.width, layout.height);
    ctx.fillStyle = "#fecaca"; ctx.font = "700 14px system-ui"; ctx.textAlign = "center";
    ctx.fillText(`COLOSSO ASSET AUSENTE: ${animation?.state || "?"}/${animation?.frame ?? "?"}`, layout.rootX, layout.rootY - layout.height * .55);
  }
  ctx.restore();
}

function drawColossoCoreOverlay(ctx, enemy, layout, elapsed, settings = {}) {
  const phaseVisual = getColossoPhaseVisual(enemy);
  const coreVisual = getColossoCoreVisual(enemy);
  const point = getColossoCorePoint(layout, enemy.colossoState);
  const pulse = settings.reduceMotion ? 1 : 1 + Math.sin(elapsed / coreVisual.pulseSpeed) * (coreVisual.exposed ? .12 : .04);
  const radius = coreVisual.radius * pulse;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(point.x, point.y, 2, point.x, point.y, coreVisual.glow * 2.5);
  glow.addColorStop(0, `${coreVisual.exposed ? "rgba(255,255,255,.98)" : "rgba(255,237,180,.9)"}`);
  glow.addColorStop(.25, `${phaseVisual.coreColor}cc`); glow.addColorStop(1, `${phaseVisual.coreColor}00`);
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(point.x, point.y, coreVisual.glow * 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  if (!coreVisual.exposed) {
    ctx.fillStyle = "rgba(69,10,10,.88)"; ctx.strokeStyle = "rgba(127,29,29,.95)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius + 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = coreVisual.exposed ? "#fff7ed" : phaseVisual.coreInnerColor;
  ctx.shadowBlur = coreVisual.glow; ctx.shadowColor = phaseVisual.coreColor;
  ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
  if (coreVisual.exposed) {
    const remain = Math.max(0, Number(enemy.colossoStateEndsAt) - elapsed);
    const ratio = Math.max(0, Math.min(1, remain / Math.max(1, Number(enemy._colossoConfig?.core?.exposedMs) || 6000)));
    ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,247,237,.85)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio); ctx.stroke();
  }
  ctx.restore();
}

function drawColossoPhaseParticles(ctx, enemy, layout, elapsed, settings = {}) {
  const visual = getColossoPhaseVisual(enemy);
  if (!visual.emberCount || settings.reduceMotion) return;
  const seed = String(enemy.id || "colosso").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  ctx.save(); ctx.fillStyle = visual.coreInnerColor; ctx.shadowBlur = 8; ctx.shadowColor = visual.coreColor;
  for (let index = 0; index < visual.emberCount; index += 1) {
    const phase = (elapsed / (900 + index * 73) + (seed + index * 17) * .013) % 1;
    const x = layout.rootX + ((seed + index * 29) % 100 - 50) * .65;
    const y = layout.rootY - 20 - phase * 105;
    ctx.globalAlpha = .75 * (1 - phase); ctx.beginPath(); ctx.arc(x, y, 2 + (index % 2), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawColossoCoreHitFeedback(ctx, enemy, layout, elapsed, effects = {}) {
  const hits = (effects.colossoCoreHits || []).filter((hit) => hit.bossId === enemy.id && elapsed - hit.born < hit.life);
  if (!hits.length) return;
  const point = getColossoCorePoint(layout, enemy.colossoState);
  hits.forEach((hit) => {
    const progress = Math.max(0, Math.min(1, (elapsed - hit.born) / hit.life));
    const strength = hit.exposed ? 1.25 : .75;
    ctx.save(); ctx.globalAlpha = (1 - progress) * .85; ctx.strokeStyle = hit.exposed ? "#fff7ed" : "#c2410c"; ctx.lineWidth = hit.exposed ? 3 : 2;
    ctx.beginPath(); ctx.arc(point.x, point.y, (hit.exposed ? 25 : 12) + progress * (hit.exposed ? 18 : 8), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = hit.exposed ? "#fff7ed" : "#9a3412";
    for (let index = 0; index < (hit.exposed ? 8 : 3); index += 1) {
      const angle = index * Math.PI * 2 / (hit.exposed ? 8 : 3); const distance = (hit.exposed ? 16 : 8) + progress * 20;
      ctx.beginPath(); ctx.arc(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance, 2 * strength, 0, Math.PI * 2); ctx.fill();
    }
    if (hit.resisted && progress < .72) { ctx.font = "800 10px system-ui"; ctx.textAlign = "center"; ctx.fillText("RESISTIDO", point.x, point.y - 32 - progress * 8); }
    ctx.restore();
  });
}

function drawCellCrack(ctx, x, y, size = 26) {
  ctx.beginPath();
  ctx.moveTo(x - size, y - 4); ctx.lineTo(x - size * .35, y - 12); ctx.lineTo(x + size * .08, y + 5); ctx.lineTo(x + size, y - 7);
  ctx.stroke();
}

function drawTelegraphs(ctx, enemy, settings, pulse) {
  const visual = getColossoTelegraphVisual(enemy);
  if (!visual) return;
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (visual.kind === "riftRing") {
    const { row, col } = visual.cells[0]; const x = cellX(col); const y = laneY(row); const radius = 21 + pulse * 12;
    ctx.globalAlpha = .46 + pulse * .4; ctx.strokeStyle = "#fef08a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = .7 + pulse * .25; ctx.strokeStyle = "#fb923c"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, Math.max(8, radius - 11), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#fff7ed"; ctx.lineWidth = 3; drawCellCrack(ctx, x, y, 17);
  } else if (visual.kind === "slamArea") {
    for (const { row, col } of visual.cells) {
      const left = cellX(col) - CELL.width / 2 + 4; const top = laneY(row) - CELL.height / 2 + 4;
      ctx.globalAlpha = .28 + pulse * .32; ctx.fillStyle = "#dc2626"; ctx.fillRect(left, top, CELL.width - 8, CELL.height - 8);
      ctx.globalAlpha = .6 + pulse * .35; ctx.strokeStyle = "#fca5a5"; ctx.lineWidth = 2; ctx.strokeRect(left, top, CELL.width - 8, CELL.height - 8);
    }
  } else if (visual.kind === "fractureCracks") {
    ctx.globalAlpha = .5 + pulse * .42; ctx.strokeStyle = "#fb923c"; ctx.lineWidth = 4;
    for (const { row, col } of visual.cells) drawCellCrack(ctx, cellX(col), laneY(row));
  } else if (visual.kind === "seismicChevrons") {
    const step = 34; const shift = settings.reduceMotion ? 0 : (Number(settings.elapsed || 0) / 4) % step;
    ctx.globalAlpha = .46 + pulse * .42; ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 4;
    for (const row of visual.rows) {
      const y = laneY(row);
      for (let x = -step + shift; x < CELL.width * 9 + step; x += step) {
        ctx.beginPath(); ctx.moveTo(x - 9, y - 12); ctx.lineTo(x + 5, y); ctx.lineTo(x - 9, y + 12); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function drawColossoCaldeira(ctx, enemy, settings = {}, image = null, effects = {}) {
  const layout = getColossoSpriteLayout(enemy, settings.animation, colossoManifest);
  const previous = settings.transitionImage ? {
    image: settings.transitionImage,
    layout: getColossoSpriteLayout(enemy, { state: settings.animation?.previousState, frame: settings.animation?.previousFrame }, colossoManifest),
    progress: settings.animation?.transitionProgress ?? 1,
  } : null;
  const elapsed = Number(settings.elapsed || 0); const pulse = settings.reduceMotion ? .5 : .5 + .5 * Math.sin(elapsed / 180);
  const phaseVisual = getColossoPhaseVisual(enemy);
  drawColossoUnderlay(ctx, enemy, layout, pulse, effects, settings.elapsed, settings);
  drawColossoBackBody(ctx, layout, image, settings.animation, previous, phaseVisual);
  drawColossoCoreOverlay(ctx, enemy, layout, elapsed, settings);
  drawColossoCoreHitFeedback(ctx, enemy, layout, elapsed, effects);
  drawColossoPhaseParticles(ctx, enemy, layout, elapsed, settings);
  drawTelegraphs(ctx, enemy, settings, pulse);
  if (isColossoAnchorDebugEnabled() || isColossoCoreDebugEnabled()) {
    const curatedRoot = colossoManifest?.curation?.states?.[settings.animation?.state || "idle"]?.root;
    drawColossoHitZoneOverlay(ctx, { anchorX: layout.rootX, anchorY: layout.rootY });
    ctx.save();
    ctx.strokeStyle = "rgba(34,211,238,.85)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, layout.rootY); ctx.lineTo(ctx.canvas.width, layout.rootY); ctx.stroke();
    ctx.fillStyle = "#fef08a"; ctx.beginPath(); ctx.arc(layout.rootX, layout.rootY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e0f2fe"; ctx.font = "700 14px system-ui"; ctx.textAlign = "left";
    ctx.fillText(`${settings.animation?.state || "idle"} · frame ${settings.animation?.frame ?? 0}`, layout.rootX + 10, layout.rootY - 28);
    if (curatedRoot) ctx.fillText(`pé-fonte ${curatedRoot.x.toFixed(3)} / ${curatedRoot.y.toFixed(3)} → root 0.500 / 0.860`, layout.rootX + 10, layout.rootY - 10);
    if (isColossoCoreDebugEnabled()) {
      const point = getColossoCorePoint(layout, settings.animation?.state || "idle");
      ctx.fillStyle = "#fff7ed"; ctx.strokeStyle = "#22d3ee"; ctx.beginPath(); ctx.arc(point.x, point.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillText(`CORE POINT ${Math.round(point.x)},${Math.round(point.y)} · phase ${enemy.colossoPhase} · ${enemy.colossoState}`, point.x + 10, point.y - 10);
    }
    ctx.restore();
  }
}

export function drawColossoBossHealth(ctx, enemy, elapsed = 0) {
  const ratio = Math.max(0, enemy.hp / Math.max(1, enemy.maxHp)); const exposed = enemy.colossoState === "coreExposed"; const collapse = getColossoCollapseTimeline(enemy);
  const panelHeight = collapse.length ? 110 : exposed ? 54 : 35;
  ctx.save(); ctx.fillStyle = "rgba(9,4,2,.82)"; ctx.fillRect(225, 14, 510, panelHeight);
  ctx.fillStyle = "#7f1d1d"; ctx.fillRect(230, 32, 500, 10); ctx.fillStyle = "#f97316"; ctx.fillRect(230, 32, 500 * ratio, 10);
  ctx.fillStyle = "#fff7ed"; ctx.font = "700 13px system-ui"; ctx.textAlign = "center"; ctx.fillText(`COLOSSO DA CALDEIRA · FASE ${enemy.colossoPhase}`, 480, 27);
  ctx.fillStyle = "rgba(255,255,255,.52)"; ctx.fillRect(230 + 500 * .35, 32, 1, 10); ctx.fillRect(230 + 500 * .70, 32, 1, 10);
  if (collapse.length) {
    ctx.fillStyle = "#fb923c"; ctx.fillText("COLAPSO FINAL", 480, 59);
    collapse.forEach((entry, index) => {
      ctx.fillStyle = entry.imminent ? "#fef08a" : "#fed7aa";
      ctx.fillText(`ROTA ${entry.row + 1}  ·  ${entry.imminent ? "⚠ IMPACTO" : entry.order}`, 480, 77 + index * 16);
    });
  } else if (exposed) { const remain = Math.max(0, enemy.colossoStateEndsAt - elapsed); ctx.fillStyle = "#fef08a"; ctx.fillText(`NÚCLEO EXPOSTO  ${(remain / 1000).toFixed(1)}s`, 480, 59); }
  ctx.restore();
}
