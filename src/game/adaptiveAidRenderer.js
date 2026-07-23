import { CELL, FIELD } from "./visualGeometry.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const easeOutCubic = (value) => 1 - ((1 - value) ** 3);

export function quadraticBezier(start, control, end, progress) {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
  };
}

export function getCapsuleRenderState(capsule, elapsed) {
  if (!capsule) return null;
  if (capsule.state !== "falling") return { ...capsule, progress: 1, scale: 1, rotation: 0 };
  const raw = (elapsed - capsule.stateStartedAt) / Math.max(1, capsule.stateEndsAt - capsule.stateStartedAt);
  const progress = easeOutCubic(clamp(raw, 0, 1));
  const point = quadraticBezier(
    { x: capsule.startX, y: capsule.startY },
    { x: capsule.controlX, y: capsule.controlY },
    { x: capsule.landingX, y: capsule.landingY },
    progress,
  );
  return { ...capsule, ...point, progress, scale: 0.7 + progress * 0.3, rotation: (1 - progress) * 0.42 };
}

function frameFor(capsule, elapsed, assets) {
  const frames = assets?.effects?.colonyCapsule?.[capsule.state] || [];
  if (!frames.length) return null;
  const durations = { falling: 900, idle: 1400, opening: 800 };
  const progress = clamp((elapsed - capsule.stateStartedAt) / durations[capsule.state], 0, capsule.state === "idle" ? Infinity : 0.999);
  const index = capsule.state === "idle"
    ? Math.floor(((elapsed - capsule.stateStartedAt) % durations.idle) / durations.idle * frames.length)
    : Math.floor(progress * frames.length);
  return frames[index] || frames.find(Boolean) || null;
}

export function drawAdaptiveAid(ctx, session, assets, elapsed, settings = {}) {
  const capsule = session.adaptiveAid?.capsule;
  if (!capsule) return;
  const visual = getCapsuleRenderState(capsule, elapsed);
  const frame = frameFor(capsule, elapsed, assets);
  const reducedMotion = settings.reduceMotion;
  const pulse = reducedMotion ? 1 : 0.86 + Math.sin(elapsed / 180) * 0.14;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  const shadowProgress = capsule.state === "falling" ? visual.progress : 1;
  ctx.globalAlpha = 0.12 + shadowProgress * 0.28;
  ctx.fillStyle = "#020617";
  ctx.beginPath();
  ctx.ellipse(capsule.landingX, capsule.landingY + CELL.height * 0.28, 10 + shadowProgress * 24, 5 + shadowProgress * 8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (capsule.state !== "falling") {
    ctx.globalAlpha = 0.34 * pulse;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(visual.x, visual.y + CELL.height * 0.28, CELL.width * 0.38, CELL.height * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.translate(visual.x, visual.y);
  ctx.rotate(reducedMotion ? 0 : visual.rotation);
  ctx.scale(visual.scale, visual.scale);
  ctx.globalAlpha = 1;
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = settings.quality === "low" ? 8 : 18 * pulse;
  if (frame) {
    const size = 92;
    ctx.drawImage(frame, -size / 2, -size / 2, size, size);
  } else {
    const gradient = ctx.createLinearGradient(-30, -34, 30, 34);
    gradient.addColorStop(0, "#e2e8f0");
    gradient.addColorStop(0.45, "#334155");
    gradient.addColorStop(1, "#0f172a");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-28, -34, 56, 68, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(-18, 9, 36, 7);
  }
  ctx.restore();
}

export function drawOrbitalTargeting(ctx, row, hovered, elapsed) {
  if (!Number.isInteger(row)) return;
  ctx.save();
  ctx.fillStyle = hovered ? "rgba(251, 191, 36, .16)" : "rgba(2, 6, 23, .58)";
  ctx.fillRect(0, row * CELL.height, FIELD.width, CELL.height);
  if (hovered) {
    ctx.strokeStyle = "rgba(251, 191, 36, .9)";
    ctx.lineWidth = 3 + Math.sin(elapsed / 120);
    ctx.strokeRect(2, row * CELL.height + 2, FIELD.width - 4, CELL.height - 4);
  }
  ctx.restore();
}
