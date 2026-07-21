import { FIELD, VIEWPORT } from "./battleModel.js";
import { colorModeFilter } from "./graphicsRuntime.js";

const spriteHaloCache = new Map();

function createHaloCanvas(size = 96) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(size, size);
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

export function getSpriteFilter(hitFlash = 0, alphaPhase = 0, isAlpha = false, isEcho = false, frozen = false) {
  if (!frozen && !isAlpha && !isEcho && hitFlash <= 0) return "none";
  let filter = frozen ? "saturate(.55) brightness(1.16)" : "";
  if (isAlpha) filter += `${filter ? " " : ""}hue-rotate(${alphaPhase * 24}deg) saturate(${1.05 + alphaPhase * .18})`;
  if (isEcho) filter += `${filter ? " " : ""}saturate(.65) brightness(1.28) hue-rotate(34deg) contrast(1.08)`;
  if (hitFlash > 0) filter += `${filter ? " " : ""}brightness(${1 + hitFlash * .75})`;
  return filter;
}

export function getTroopSpriteFilter(hitFlash = 0) {
  return hitFlash > 0 ? `brightness(${1 + hitFlash * .65})` : "none";
}

export function getHaloCacheKey(color, settings = {}, strength = 1) {
  return `${color}:${settings.quality || "high"}:${strength}`;
}

export function clearSpriteHaloCache() {
  spriteHaloCache.clear();
}

export function getCachedSpriteHalo(color, settings = {}, strength = 1, canvasFactory = createHaloCanvas) {
  const key = getHaloCacheKey(color, settings, strength);
  if (spriteHaloCache.has(key)) return spriteHaloCache.get(key);
  const canvas = canvasFactory(96);
  if (!canvas) return null;
  const haloCtx = canvas.getContext("2d");
  const alpha = (settings.quality === "low" ? 0.2 : settings.quality === "medium" ? 0.25 : 0.3) * strength;
  const gradient = haloCtx.createRadialGradient(48, 48, 4, 48, 48, 46);
  gradient.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
  gradient.addColorStop(0.42, `${color}${Math.round(alpha * 125).toString(16).padStart(2, "0")}`);
  gradient.addColorStop(1, `${color}00`);
  haloCtx.fillStyle = gradient;
  haloCtx.fillRect(0, 0, 96, 96);
  spriteHaloCache.set(key, canvas);
  return canvas;
}

export function drawCachedSpriteHalo(ctx, rect, color, settings = {}, strength = 1) {
  const halo = getCachedSpriteHalo(color, settings, strength);
  if (!halo) return;
  const paddingX = rect.width * (strength > 1 ? 0.32 : 0.2);
  const paddingY = rect.height * (strength > 1 ? 0.22 : 0.14);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(halo, rect.x - paddingX, rect.y - paddingY, rect.width + paddingX * 2, rect.height + paddingY * 2);
  ctx.restore();
}

function seeded(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

export function drawDecals(ctx, runtime, settings = {}) {
  if (settings.quality === "low" && runtime.decals.length > 28) return;
  ctx.save();
  for (const decal of runtime.decals) {
    const random = seeded(decal.seed);
    if (decal.kind === "bullet") {
      ctx.fillStyle = "rgba(3,7,12,.55)";
      ctx.beginPath(); ctx.ellipse(decal.x, decal.y, 5, 2, random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    } else if (decal.kind === "scorch" || decal.kind === "crater") {
      const radius = decal.kind === "crater" ? 34 : 17;
      const gradient = ctx.createRadialGradient(decal.x, decal.y, 1, decal.x, decal.y, radius);
      gradient.addColorStop(0, "rgba(15,8,5,.62)"); gradient.addColorStop(.55, "rgba(45,15,7,.28)"); gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient; ctx.fillRect(decal.x - radius, decal.y - radius, radius * 2, radius * 2);
    } else if (decal.kind === "frost") {
      ctx.strokeStyle = "rgba(165,243,252,.3)"; ctx.lineWidth = 1;
      for (let index = 0; index < 5; index += 1) {
        const angle = random() * Math.PI * 2; const length = 9 + random() * 14;
        ctx.beginPath(); ctx.moveTo(decal.x, decal.y); ctx.lineTo(decal.x + Math.cos(angle) * length, decal.y + Math.sin(angle) * length * .35); ctx.stroke();
      }
    } else {
      ctx.fillStyle = decal.kind === "stain" ? "rgba(79,20,55,.16)" : "rgba(30,41,59,.18)";
      ctx.beginPath(); ctx.ellipse(decal.x, decal.y, 12 + random() * 10, 4 + random() * 4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawDynamicLights(ctx, runtime, now, settings = {}, adaptive = {}) {
  const lightScale = adaptive.dynamicLightScale ?? 1;
  if (settings.quality === "low" || lightScale <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const light of runtime.lights) {
    const progress = Math.min(1, (now - light.born) / light.life);
    const alpha = (1 - progress) * (settings.quality === "high" ? .22 : .12) * lightScale;
    const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
    gradient.addColorStop(0, `${light.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient; ctx.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
  }
  ctx.restore();
}

export function drawDeploymentEffects(ctx, runtime, now, settings = {}) {
  ctx.save();
  for (const effect of runtime.deployments) {
    const progress = Math.min(1, (now - effect.born) / effect.life);
    const alpha = 1 - progress;
    ctx.strokeStyle = effect.kind === "remove" ? `rgba(251,191,36,${alpha})` : effect.kind === "wave" ? `rgba(244,63,94,${alpha})` : `rgba(103,232,249,${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(effect.x, effect.y + 42, 34 + progress * 20, 9 + progress * 5, 0, 0, Math.PI * 2); ctx.stroke();
    if (settings.quality !== "low") {
      ctx.globalAlpha = alpha * .35;
      ctx.fillStyle = effect.kind === "remove" ? "#fbbf24" : effect.kind === "wave" ? "#f43f5e" : "#67e8f9";
      const y = effect.kind === "remove" ? effect.y - 55 + progress * 120 : effect.y + 60 - progress * 120;
      ctx.fillRect(effect.x - 31, y, 62, 2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

export function drawWetReflections(ctx, phase, rows, settings = {}, adaptive = {}) {
  if (!phase.ambientEffects?.includes("reflections") || settings.quality !== "high" || adaptive.reflections === false) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const grouped = Array.isArray(rows?.[0]);
  const groups = grouped ? rows : [rows];
  for (const group of groups) {
    for (const item of group || []) {
      const entity = item.entity || item;
      const x = Number.isFinite(item.x) ? item.x : entity.x;
      const y = Number.isFinite(item.y) ? item.y : entity.y;
      const gradient = ctx.createLinearGradient(x, y + 38, x, y + 90);
      gradient.addColorStop(0, "rgba(125,211,252,.09)"); gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(x, y + 55, 18 * (entity.scale || 1), 34, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawPostProcessing(ctx, phase, settings, session, now) {
  ctx.save();
  const tint = ctx.createLinearGradient(0, 0, FIELD.width, FIELD.height);
  tint.addColorStop(0, `${phase.palette.primary}08`); tint.addColorStop(1, `${phase.palette.accent}0b`);
  ctx.fillStyle = tint; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const boss = session.enemies.find((enemy) => enemy.variant === "alpha");
  if (boss?.bossPhase > 0 && settings.quality === "high" && !settings.reduceMotion) {
    const pulse = (Math.sin(now / 90) + 1) * .5;
    ctx.fillStyle = `rgba(244,63,94,${.018 + pulse * .02 * boss.bossPhase})`; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  ctx.restore();
}

export function presentScene(ctx, scene, renderScale, camera, settings = {}, adaptive = {}) {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.clearRect(0, 0, VIEWPORT.width, VIEWPORT.height);
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.filter = colorModeFilter(settings.colorMode);
  if (settings.quality === "high" && adaptive.bloom !== false) {
    ctx.save(); ctx.globalAlpha = .09; ctx.globalCompositeOperation = "screen"; ctx.filter = "blur(6px) saturate(1.2)"; ctx.drawImage(scene, 0, 0); ctx.restore();
    ctx.filter = colorModeFilter(settings.colorMode);
  }
  ctx.drawImage(scene, 0, 0);
  ctx.restore();
}
