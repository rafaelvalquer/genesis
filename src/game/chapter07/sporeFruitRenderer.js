import { CELL } from "../visualGeometry.js";

const FRAME_MS = 65;
const TRAJECTORY_ARC_PX = CELL.width * 0.58;
const FRUIT_SIZE = 42;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function hashSeed(value) {
  return String(value || "sporeFruit").split("").reduce((hash, char) => (
    ((hash << 5) - hash + char.charCodeAt(0)) | 0
  ), 2166136261) >>> 0;
}

export function getSporeFruitProgress(fruit, elapsed) {
  return clamp01((elapsed - fruit.startedAt) / Math.max(1, fruit.impactAt - fruit.startedAt));
}

export function getSporeFruitPosition(fruit, elapsed) {
  const progress = getSporeFruitProgress(fruit, elapsed);
  return {
    progress,
    x: fruit.startX + (fruit.targetX - fruit.startX) * progress,
    y: fruit.startY + (fruit.targetY - fruit.startY) * progress
      - Math.sin(progress * Math.PI) * TRAJECTORY_ARC_PX,
  };
}

function getQualityParticleCount(settings = {}) {
  if (settings.reduceMotion) return 0;
  if (settings.quality === "high") return 3;
  if (settings.quality === "medium") return 2;
  return 1;
}

export function drawSporeFruit(ctx, fruit, elapsed, frames = [], settings = {}) {
  const { progress, x, y } = getSporeFruitPosition(fruit, elapsed);
  const frame = frames[Math.min(frames.length - 1, Math.floor(Math.max(0, elapsed - fruit.startedAt) / FRAME_MS))]
    || frames[0]
    || null;
  const rotation = settings.reduceMotion ? 0 : progress * Math.PI * 3.5;
  const seed = fruit.seed ?? hashSeed(fruit.id);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = 1;
  if (frame) {
    ctx.drawImage(frame, -FRUIT_SIZE / 2, -FRUIT_SIZE / 2, FRUIT_SIZE, FRUIT_SIZE);
  } else {
    ctx.fillStyle = "#d9cf63";
    ctx.strokeStyle = "#237d69";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();

  const particles = getQualityParticleCount(settings);
  if (particles) {
    ctx.save();
    ctx.globalAlpha = 0.28 * (1 - progress);
    ctx.fillStyle = "#81d8a5";
    for (let index = 0; index < particles; index += 1) {
      const angle = ((seed % 360) * Math.PI / 180) + index * 2.1;
      const distance = 16 + index * 7 + progress * 8;
      ctx.beginPath();
      ctx.arc(x - Math.cos(angle) * distance, y - Math.sin(angle) * distance, 1.5 + index * .45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawSporeFruits(ctx, fruits = [], elapsed, assets = {}, settings = {}) {
  const frames = assets?.flying || [];
  fruits.forEach((fruit) => drawSporeFruit(ctx, fruit, elapsed, frames, settings));
}

export function drawSporeClouds(ctx, clouds = [], elapsed, settings = {}) {
  clouds.forEach((cloud) => {
    const progress = clamp01((elapsed - cloud.startedAt) / Math.max(1, cloud.endsAt - cloud.startedAt));
    ctx.save();
    ctx.globalAlpha = 0.42 * (1 - progress);
    ctx.fillStyle = "#e9913a";
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      ctx.beginPath();
      ctx.arc(cloud.x + Math.cos(angle) * cloud.radius * .45, cloud.y + Math.sin(angle) * cloud.radius * .25,
        11 + progress * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

export function drawSporeFruitEmissive(ctx, fruits = [], elapsed, settings = {}) {
  fruits.forEach((fruit) => {
    const { progress, x, y } = getSporeFruitPosition(fruit, elapsed);
    ctx.save();
    ctx.globalAlpha = 0.34 * (1 - progress);
    ctx.fillStyle = "#58d6ba";
    ctx.shadowColor = "#58d6ba";
    ctx.shadowBlur = settings.reduceMotion ? 4 : 10;
    ctx.beginPath(); ctx.arc(x, y, settings.reduceMotion ? 7 : 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}
