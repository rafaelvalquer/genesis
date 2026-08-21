import { getConvoyFrames, loadConvoyAssets } from "../assets/convoyAssetCatalog.js";
import { CELL } from "../visualGeometry.js";
import { resolveConvoyAnimationFrame } from "./convoyAnimation.js";
import { getConvoyVehicleId } from "./convoyVehicleConfig.js";
import { getConvoyColumn } from "./convoyGeometry.js";
import fallbackUrl from "../assets/chapter07/convoy.png?url";

const images = new Map(); const requestedVehicles = new Set(); const visualStates = new WeakMap();
let fallbackImage = null;
if (typeof Image !== "undefined") { fallbackImage = new Image(); fallbackImage.src = fallbackUrl; }
function imageFor(url) { if (!url || typeof Image === "undefined") return null; if (!images.has(url)) { const image = new Image(); image.src = url; images.set(url, image); } return images.get(url); }
function visualElapsed(convoy, state, time, paused) {
  const previous = visualStates.get(convoy);
  if (!previous || previous.state !== state) { visualStates.set(convoy, { state, startedAt: time, frozenAt: 0 }); return 0; }
  if (paused) { previous.frozenAt ||= time; return Math.max(0, previous.frozenAt - previous.startedAt); }
  if (previous.frozenAt) previous.startedAt += time - previous.frozenAt;
  previous.frozenAt = 0; return Math.max(0, time - previous.startedAt);
}
function drawEffects(ctx, convoy, session, x, y, time, settings, state) {
  const density = settings.reduceMotion || settings.quality === "low" ? 1 : settings.quality === "medium" ? 2 : 3;
  if (state === "run" && !settings.reduceMotion) {
    ctx.fillStyle = "rgba(188,109,58,.22)"; for (let i = 0; i < density; i += 1) { ctx.beginPath(); ctx.arc(x - 48 - i * 11, y + 25 + (i % 2) * 4, 5 + i * 3, 0, Math.PI * 2); ctx.fill(); }
    if (session.phase?.terrain?.routeType === "railway") { ctx.strokeStyle = "rgba(251,191,36,.62)"; ctx.lineWidth = 1.5; for (let i = 0; i < density; i += 1) { ctx.beginPath(); ctx.moveTo(x - 36 - i * 9, y + 29); ctx.lineTo(x - 42 - i * 9, y + 36 + i * 2); ctx.stroke(); } }
  }
  if (["light", "heavy", "critical", "destroyed"].includes(convoy.damageState) || state.startsWith("destroyed")) { const count = convoy.damageState === "critical" || state.startsWith("destroyed") ? density : 1; ctx.fillStyle = `rgba(62,68,70,${settings.reduceMotion ? .22 : .16 + Math.sin(time * .004) * .06})`; for (let i = 0; i < count; i += 1) { ctx.beginPath(); ctx.arc(x - 22 + i * 12, y - 36 - i * 9, 13 + i * 5, 0, Math.PI * 2); ctx.fill(); } }
  if (!settings.reduceMotion && (state === "idle" || state === "run")) { ctx.fillStyle = `rgba(103,232,249,${.16 + Math.sin(time * .006) * .08})`; ctx.beginPath(); ctx.arc(x + 39, y - 16, state === "run" ? 9 : 7, 0, Math.PI * 2); ctx.fill(); }
}
export function drawConvoy(ctx, session, time = 0, settings = {}) {
  const convoy = session?.convoy; if (!convoy) return;
  const vehicleId = getConvoyVehicleId(session.phase);
  if (!requestedVehicles.has(vehicleId)) { requestedVehicles.add(vehicleId); loadConvoyAssets(vehicleId).catch(() => requestedVehicles.delete(vehicleId)); }
  const state = convoy.animation?.state || "idle"; const elapsed = visualElapsed(convoy, state, time, settings.paused);
  const frames = getConvoyFrames(vehicleId, state); const image = imageFor(frames[resolveConvoyAnimationFrame(state, elapsed, frames.length)]);
  const hitAge = session.elapsed - (convoy.lastHitAt ?? -Infinity); const hitOffset = hitAge >= 0 && hitAge < 140 && !settings.reduceMotion ? Math.sin(hitAge * .32) * 4 * (1 - hitAge / 140) : 0;
  const x = convoy.x + hitOffset; const y = convoy.y;
  ctx.save(); ctx.fillStyle = "rgba(0,0,0,.42)"; ctx.beginPath(); ctx.ellipse(x, y + 29, 56, 12, 0, 0, Math.PI * 2); ctx.fill();
  if (image?.complete && image.naturalWidth) { ctx.globalAlpha = convoy.damageState === "critical" ? .8 : 1; ctx.drawImage(image, x - 112, y - 56, 224, 112); ctx.globalAlpha = 1; } else if (fallbackImage?.complete && fallbackImage.naturalWidth) ctx.drawImage(fallbackImage, x - 72, y - 45, 144, 60);
  drawEffects(ctx, convoy, session, x, y, time, settings, state);
  if (convoy.underAttack) { ctx.strokeStyle = "#fb7185"; ctx.lineWidth = 2.5; ctx.strokeRect(x - 74, y - 47, 148, 64); }
  ctx.restore();
}

export function drawEscortZone(ctx, session, visible = false) {
  if (!visible || !session?.convoy) return;
  const col = getConvoyColumn(session.convoy);
  ctx.save();
  ctx.fillStyle = "rgba(103,232,249,.13)"; ctx.strokeStyle = "rgba(103,232,249,.68)"; ctx.lineWidth = 2;
  for (const row of session.phase.convoy.escortRows) for (let offset = -1; offset <= 1; offset += 1) {
    const targetCol = col + offset;
    if (targetCol < 1 || targetCol > 9) continue;
    ctx.fillRect(targetCol * CELL.width + 4, row * CELL.height + 9, CELL.width - 8, CELL.height - 18);
    ctx.strokeRect(targetCol * CELL.width + 4, row * CELL.height + 9, CELL.width - 8, CELL.height - 18);
  }
  ctx.restore();
}
