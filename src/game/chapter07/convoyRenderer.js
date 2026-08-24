import { getConvoyFrames, loadConvoyAssets } from "../assets/convoyAssetCatalog.js";
import { resolveConvoyAnimationFrame } from "./convoyAnimation.js";
import { getConvoyVehicleId } from "./convoyVehicleConfig.js";
import { CONVOY_RENDER_WIDTH } from "./convoyGeometry.js";
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
export function getConvoyThreatVisual(convoy, now = 0) {
  const hitAge = now - (convoy?.lastHitAt ?? -Infinity);
  const recent = hitAge >= 0 && hitAge < 900;
  const critical = convoy?.damageState === "critical" || convoy?.damageState === "destroyed";
  const danger = convoy?.damageState === "heavy" || critical;
  return { level: critical ? "critical" : danger ? "danger" : (convoy?.underAttack || recent ? "warning" : "none"), recent, critical };
}
export function drawConvoy(ctx, session, time = 0, settings = {}) {
  const convoy = session?.convoy; if (!convoy) return;
  const vehicleId = getConvoyVehicleId(session.phase);
  if (!requestedVehicles.has(vehicleId)) { requestedVehicles.add(vehicleId); loadConvoyAssets(vehicleId).catch(() => requestedVehicles.delete(vehicleId)); }
  const state = convoy.animation?.state || "idle"; const elapsed = visualElapsed(convoy, state, time, settings.paused);
  const frames = getConvoyFrames(vehicleId, state); const image = imageFor(frames[resolveConvoyAnimationFrame(state, elapsed, frames.length)]);
  const hitAge = session.elapsed - (convoy.lastHitAt ?? -Infinity); const hitOffset = hitAge >= 0 && hitAge < 180 && !settings.reduceMotion ? Math.sin(hitAge * .32) * 4 * (1 - hitAge / 180) : 0;
  const x = convoy.x + hitOffset; const y = convoy.y;
  const threat = getConvoyThreatVisual(convoy, session.elapsed);
  ctx.save(); ctx.fillStyle = "rgba(0,0,0,.42)"; ctx.beginPath(); ctx.ellipse(x, y + 29, 56, 12, 0, 0, Math.PI * 2); ctx.fill();
  if (threat.level !== "none") { ctx.fillStyle = threat.critical ? "rgba(251,113,133,.3)" : "rgba(251,113,133,.18)"; ctx.filter = `blur(${threat.critical ? 13 : 8}px)`; ctx.beginPath(); ctx.ellipse(x, y + 29, 62, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.filter = "none"; }
  if (threat.level !== "none") ctx.filter = `drop-shadow(0 0 ${threat.critical ? 10 : 6}px rgba(251,113,133,${threat.critical ? .8 : .55}))`;
  if (image?.complete && image.naturalWidth) { ctx.globalAlpha = convoy.damageState === "critical" ? .8 : 1; ctx.drawImage(image, x - CONVOY_RENDER_WIDTH / 2, y - 56, CONVOY_RENDER_WIDTH, 112); ctx.globalAlpha = 1; } else if (fallbackImage?.complete && fallbackImage.naturalWidth) ctx.drawImage(fallbackImage, x - 72, y - 45, 144, 60);
  ctx.filter = "none";
  drawEffects(ctx, convoy, session, x, y, time, settings, state);
  if (threat.recent && !settings.reduceMotion) { const flash = Math.max(0, 1 - hitAge / 180); ctx.globalAlpha = flash * .7; ctx.globalCompositeOperation = "screen"; ctx.fillStyle = "white"; ctx.fillRect(x - 58, y - 48, 116, 82); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
  ctx.restore();
}
