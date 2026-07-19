import { CELL, FIELD } from "./battleModel.js";
import { getSpriteRect } from "./visualGeometry.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

function drawFrame(ctx, image, entity, height, opacity = 1, filter = "none") {
  if (!image?.width || !image?.height) return false;
  const rect = getSpriteRect(entity, height, image.width / image.height);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = filter;
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
  return true;
}

function pulseVisual(pulse, elapsed, assets) {
  if (pulse.state === "charging") {
    const frames = assets.attack || assets.idle || [];
    const progress = clamp((elapsed - pulse.chargeStartedAt) / Math.max(1, pulse.fireAt - pulse.chargeStartedAt), 0, 0.999);
    return { frames, frame: Math.floor(progress * Math.max(1, frames.length)), progress };
  }
  if (pulse.state === "spent") {
    const frames = assets.dead || assets.idle || [];
    const progress = clamp((elapsed - pulse.fireAt) / 720, 0, 0.999);
    return { frames, frame: Math.floor(progress * Math.max(1, frames.length)), progress: 1 };
  }
  const frames = assets.idle || [];
  return { frames, frame: Math.floor(elapsed / 150 + pulse.row * 2) % Math.max(1, frames.length), progress: 0 };
}

function drawLaneAlert(ctx, pulse, elapsed, settings) {
  if (pulse.state !== "charging") return;
  const progress = clamp((elapsed - pulse.chargeStartedAt) / Math.max(1, pulse.fireAt - pulse.chargeStartedAt), 0, 1);
  const pulseAlpha = settings.reduceMotion ? 0.12 : 0.08 + Math.sin(elapsed / 85) * 0.035;
  const top = pulse.row * CELL.height + 8;
  const gradient = ctx.createLinearGradient(FIELD.combatOffsetX, 0, FIELD.width, 0);
  gradient.addColorStop(0, `rgba(34,211,238,${pulseAlpha + progress * 0.05})`);
  gradient.addColorStop(0.7, `rgba(34,211,238,${pulseAlpha * 0.45})`);
  gradient.addColorStop(1, "rgba(34,211,238,0)");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(FIELD.combatOffsetX, top, FIELD.width - FIELD.combatOffsetX, CELL.height - 16);
  ctx.strokeStyle = `rgba(103,232,249,${0.38 + progress * 0.5})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(FIELD.combatOffsetX + 1, top + 1, FIELD.width - FIELD.combatOffsetX - 2, CELL.height - 18);
  ctx.restore();
}

export function drawDematerializationPulses(ctx, pulses, assets = {}, elapsed = 0, settings = {}) {
  for (const pulse of pulses || []) drawLaneAlert(ctx, pulse, elapsed, settings);
  for (const pulse of pulses || []) {
    const visual = pulseVisual(pulse, elapsed, assets);
    const image = visual.frames[visual.frame % Math.max(1, visual.frames.length)];
    const entity = {
      x: FIELD.defenseCol * CELL.width + CELL.width / 2,
      y: pulse.row * CELL.height + CELL.height / 2 + 1,
    };
    const glow = pulse.state === "charging"
      ? `drop-shadow(0 0 ${8 + visual.progress * 14}px #22d3ee) brightness(${1 + visual.progress * 0.3})`
      : pulse.state === "ready"
        ? "drop-shadow(0 0 5px #22d3ee)"
        : "grayscale(.45) brightness(.72)";
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.38)";
    ctx.beginPath();
    ctx.ellipse(entity.x, entity.y + 44, 42, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!drawFrame(ctx, image, entity, 116, 1, glow)) {
      ctx.fillStyle = pulse.state === "spent" ? "#27272a" : "#334155";
      ctx.fillRect(entity.x - 38, entity.y - 28, 78, 62);
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(entity.x + 20, entity.y - 13, 34, 9);
    }
    if (pulse.state === "spent" && settings.quality !== "low") {
      const smokeAge = Math.max(0, elapsed - pulse.fireAt);
      const drift = settings.reduceMotion ? 0 : Math.sin(smokeAge / 420 + pulse.row) * 4;
      ctx.globalAlpha = 0.18 + Math.sin(smokeAge / 310) * 0.04;
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.arc(entity.x - 4 + drift, entity.y - 59, 7, 0, Math.PI * 2);
      ctx.arc(entity.x + 2 + drift, entity.y - 69, 9, 0, Math.PI * 2);
      ctx.arc(entity.x - 3 + drift, entity.y - 80, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawPulseScorches(ctx, runtime, now, settings = {}) {
  ctx.save();
  for (const mark of runtime.pulseScorches || []) {
    const progress = clamp((now - mark.born) / mark.life, 0, 1);
    const random = seeded(mark.seed);
    const radius = 13 + random() * 15;
    const alpha = (1 - progress) * (settings.quality === "low" ? 0.45 : 0.72);
    const gradient = ctx.createRadialGradient(mark.x, mark.y, 1, mark.x, mark.y, radius);
    gradient.addColorStop(0, `rgba(1,5,9,${alpha})`);
    gradient.addColorStop(0.62, `rgba(7,22,27,${alpha * 0.8})`);
    gradient.addColorStop(0.84, `rgba(34,211,238,${alpha * 0.34})`);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(mark.x - radius, mark.y - radius * 0.45, radius * 2, radius * 0.9);
    if (settings.quality === "high" && progress < 0.68) {
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(mark.x + (random() - 0.5) * 8, mark.y - 10 - progress * 24, 3 + random() * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function enemyFrame(assets, entity) {
  const frames = assets.enemies?.[entity.type];
  return frames?.walking?.[0] || frames?.idle?.[0] || frames?.attack?.[0] || null;
}

export function drawPulseDisintegrations(ctx, runtime, assets, now, settings = {}) {
  for (const visual of runtime.disintegrations || []) {
    const progress = clamp((now - visual.born) / visual.life, 0, 1);
    const entity = visual.entity;
    const image = enemyFrame(assets, entity);
    const height = 128 * (entity.scale || 1);
    const opacity = progress < 0.14 ? 1 : Math.max(0, 1 - (progress - 0.14) / 0.65);
    const filter = progress < 0.12
      ? "brightness(3.5) saturate(0) drop-shadow(0 0 12px #22d3ee)"
      : `brightness(${1.65 + progress}) saturate(${Math.max(0, 1 - progress)}) drop-shadow(0 0 9px #22d3ee)`;
    if (!drawFrame(ctx, image, entity, height, opacity, filter)) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = progress < 0.14 ? "#ffffff" : "#67e8f9";
      ctx.beginPath();
      ctx.arc(entity.x, entity.y - 12, 26 * (entity.scale || 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (settings.reduceMotion || progress < 0.12) continue;
    const random = seeded(visual.seed);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let index = 0; index < (settings.quality === "low" ? 9 : settings.quality === "medium" ? 16 : 24); index += 1) {
      const startX = entity.x + (random() - 0.5) * 54 * (entity.scale || 1);
      const startY = entity.y - 58 * (entity.scale || 1) + random() * 92 * (entity.scale || 1);
      const size = 2 + random() * 5;
      ctx.globalAlpha = Math.max(0, (1 - progress) * (0.45 + random() * 0.55));
      ctx.fillStyle = index % 4 === 0 ? "#ffffff" : "#22d3ee";
      ctx.fillRect(startX + progress * (35 + random() * 78), startY + (random() - 0.5) * progress * 12, size, size);
    }
    ctx.restore();
  }
}

export function drawPulseBeams(ctx, runtime, now, settings = {}) {
  for (const beam of runtime.pulseBeams || []) {
    const progress = clamp((now - beam.born) / beam.life, 0, 1);
    const envelope = Math.sin(Math.min(1, progress * 2.2) * Math.PI / 2) * (1 - progress * 0.72);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const stroke = (style, width, alpha = 1) => {
      ctx.globalAlpha = envelope * alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(beam.x0, beam.y0);
      ctx.lineTo(beam.x1, beam.y1);
      ctx.stroke();
    };
    stroke("#22d3ee", 42, 0.2);
    stroke("#22d3ee", 22, 0.78);
    stroke("#ffffff", 7, 1);
    if (!settings.reduceMotion && settings.quality !== "low") {
      const random = seeded(beam.seed);
      ctx.lineWidth = 1.5;
      for (let index = 0; index < (settings.quality === "high" ? 18 : 10); index += 1) {
        const x = beam.x0 + random() * (beam.x1 - beam.x0);
        const y = beam.y0 + (random() - 0.5) * 24;
        ctx.globalAlpha = envelope * (0.28 + random() * 0.45);
        ctx.strokeStyle = index % 3 === 0 ? "#ffffff" : "#67e8f9";
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x, y + (random() - 0.5) * 15);
        ctx.lineTo(x + 9, y + (random() - 0.5) * 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
