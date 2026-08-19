import { CELL } from "./visualGeometry.js";
import colossoManifest from "./assets/enemy/colossoCaldeira/manifest.json";

const laneY = (row) => row * CELL.height + CELL.height / 2;
const cellX = (col) => col * CELL.width + CELL.width / 2;
const attackState = (state = "") => /(?:Telegraph|Attack|finalCollapse)/.test(state);
const anchorDebugEnabled = import.meta.env.DEV
  && typeof window !== "undefined"
  && new URLSearchParams(window.location.search).has("debugColossoAnchor");

export function getColossoSpriteLayout(enemy, animation = {}, manifest = colossoManifest) {
  const state = animation.state || "idle";
  const frame = Math.max(0, Number(animation.frame) || 0);
  const frameAnchor = manifest?.frameAnchors?.[state]?.[frame] || manifest?.anchor || { x: .68, y: .72 };
  const scale = Number(frameAnchor.scale) > 0 ? Number(frameAnchor.scale) : 1;
  const width = 424 * scale;
  const height = 424 * scale;
  const visualOffsetX = Number(manifest?.visualOffsetX) || 0;
  const visualOffsetY = Number(manifest?.visualOffsetY) || 0;
  const rootX = (Number.isFinite(enemy?.x) ? enemy.x : 0) + visualOffsetX;
  const rootY = (Number.isFinite(enemy?.y) ? enemy.y : laneY(2)) + visualOffsetY;
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
  ctx.beginPath(); ctx.ellipse(x + 8, y + 12, 172, 34, 0, 0, Math.PI * 2); ctx.fill();
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

function drawTelegraphs(ctx, enemy, settings, pulse) {
  if (!attackState(enemy.colossoState)) return;
  const attack = enemy.colossoQueuedAttack;
  ctx.save(); ctx.globalAlpha = .42 + pulse * .42; ctx.lineWidth = 3;
  if (attack === "rift" && enemy.colossoRiftTarget) {
    const { row, col } = enemy.colossoRiftTarget; ctx.strokeStyle = "#fb923c"; ctx.strokeRect(cellX(col) - CELL.width / 2 + 3, laneY(row) - CELL.height / 2 + 3, CELL.width - 6, CELL.height - 6);
  } else if (attack === "slam" || attack === "fracture") {
    ctx.strokeStyle = attack === "slam" ? "#ef4444" : "#f97316";
    for (const { row, col } of enemy.colossoTargetCells || []) ctx.strokeRect(cellX(col) - CELL.width / 2 + 4, laneY(row) - CELL.height / 2 + 4, CELL.width - 8, CELL.height - 8);
  } else for (const row of enemy.colossoTargetRows || []) { ctx.strokeStyle = "#ef4444"; ctx.strokeRect(0, laneY(row) - CELL.height / 2 + 4, CELL.width * 9, CELL.height - 8); }
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
  if (anchorDebugEnabled) {
    ctx.save();
    ctx.strokeStyle = "rgba(34,211,238,.85)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, layout.rootY); ctx.lineTo(ctx.canvas.width, layout.rootY); ctx.stroke();
    ctx.fillStyle = "#fef08a"; ctx.beginPath(); ctx.arc(layout.rootX, layout.rootY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e0f2fe"; ctx.font = "700 14px system-ui"; ctx.textAlign = "left";
    ctx.fillText(`${settings.animation?.state || "idle"} · frame ${settings.animation?.frame ?? 0}`, layout.rootX + 10, layout.rootY - 10);
    ctx.restore();
  }
}

export function drawColossoBossHealth(ctx, enemy, elapsed = 0) {
  const ratio = Math.max(0, enemy.hp / Math.max(1, enemy.maxHp)); const exposed = enemy.colossoState === "coreExposed";
  ctx.save(); ctx.fillStyle = "rgba(9,4,2,.82)"; ctx.fillRect(225, 14, 510, exposed ? 54 : 35);
  ctx.fillStyle = "#7f1d1d"; ctx.fillRect(230, 32, 500, 10); ctx.fillStyle = "#f97316"; ctx.fillRect(230, 32, 500 * ratio, 10);
  ctx.fillStyle = "#fff7ed"; ctx.font = "700 13px system-ui"; ctx.textAlign = "center"; ctx.fillText(`COLOSSO DA CALDEIRA · FASE ${enemy.colossoPhase}`, 480, 27);
  ctx.fillStyle = "rgba(255,255,255,.52)"; ctx.fillRect(230 + 500 * .35, 32, 1, 10); ctx.fillRect(230 + 500 * .70, 32, 1, 10);
  if (exposed) { const remain = Math.max(0, enemy.colossoStateEndsAt - elapsed); ctx.fillStyle = "#fef08a"; ctx.fillText(`NÚCLEO EXPOSTO  ${(remain / 1000).toFixed(1)}s`, 480, 59); }
  ctx.restore();
}
