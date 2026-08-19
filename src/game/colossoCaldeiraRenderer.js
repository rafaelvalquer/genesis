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

function drawColossoUnderlay(ctx, enemy, x, y, pulse, effects, elapsed = 0) {
  ctx.save();
  ctx.fillStyle = "rgba(69,10,10,.52)";
  // `y` is the fixed midpoint between the Colosso's feet. Keep the contact
  // shadow at that same ground plane; the former +72 offset belonged to the
  // pre-anchor art and visibly floated below the new bipedal sprite.
  ctx.beginPath(); ctx.ellipse(x + 10, y + 14, 220, 43, 0, 0, Math.PI * 2); ctx.fill();
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

function drawColossoBackBody(ctx, layout, image, animation, previous = null) {
  ctx.save();
  ctx.shadowBlur = 18; ctx.shadowColor = "#f97316";
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
  drawColossoUnderlay(ctx, enemy, layout.rootX, layout.rootY, pulse, effects, settings.elapsed);
  drawColossoBackBody(ctx, layout, image, settings.animation, previous);
  drawTelegraphs(ctx, enemy, settings, pulse);
  if (isColossoAnchorDebugEnabled()) {
    const curatedRoot = colossoManifest?.curation?.states?.[settings.animation?.state || "idle"]?.root;
    drawColossoHitZoneOverlay(ctx, { anchorX: layout.rootX, anchorY: layout.rootY });
    ctx.save();
    ctx.strokeStyle = "rgba(34,211,238,.85)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, layout.rootY); ctx.lineTo(ctx.canvas.width, layout.rootY); ctx.stroke();
    ctx.fillStyle = "#fef08a"; ctx.beginPath(); ctx.arc(layout.rootX, layout.rootY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e0f2fe"; ctx.font = "700 14px system-ui"; ctx.textAlign = "left";
    ctx.fillText(`${settings.animation?.state || "idle"} · frame ${settings.animation?.frame ?? 0}`, layout.rootX + 10, layout.rootY - 28);
    if (curatedRoot) ctx.fillText(`pé-fonte ${curatedRoot.x.toFixed(3)} / ${curatedRoot.y.toFixed(3)} → root 0.500 / 0.860`, layout.rootX + 10, layout.rootY - 10);
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
