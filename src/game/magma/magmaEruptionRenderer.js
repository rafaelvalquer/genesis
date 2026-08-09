import { getMagmaThermalVisual } from "./magmaVisualConfig.js";

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOut = (value) => 1 - (1 - value) ** 3;

export function getMagmaVentPhase(vent, visualTimeMs) {
  return ((visualTimeMs + vent.phaseMs) % vent.periodMs) / vent.periodMs;
}

function drawVentGlow(ctx, vent, phase, thermal) {
  const growth = phase < 0.55 ? clamp01(phase / 0.55) * 0.18 : clamp01((phase - 0.55) / 0.18);
  const fade = phase > 0.88 ? 1 - (phase - 0.88) / 0.12 : 1;
  const intensity = growth * fade * vent.strength * thermal.bubbleFactor;
  if (intensity <= 0.015) return;
  const radius = vent.radius * (1.1 + growth * 1.25);
  const glow = ctx.createRadialGradient(vent.x, vent.y, 0, vent.x, vent.y, radius * 2.3);
  glow.addColorStop(0, `rgba(255,240,148,${0.5 * intensity})`);
  glow.addColorStop(0.32, `rgba(255,121,18,${0.45 * intensity})`);
  glow.addColorStop(1, "rgba(155,35,5,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(vent.x, vent.y, radius * 2.3, radius, 0, 0, TAU);
  ctx.fill();
}

function drawBubble(ctx, vent, phase, thermal) {
  if (phase < 0.56 || phase > 0.79) return;
  const progress = (phase - 0.56) / 0.23;
  const radius = vent.radius * (0.3 + easeOut(progress) * 0.85);
  ctx.fillStyle = `rgba(126,28,6,${0.32 * thermal.bubbleFactor})`;
  ctx.strokeStyle = `rgba(255,188,54,${(0.22 + progress * 0.48) * thermal.hotAlpha})`;
  ctx.lineWidth = 1.25 + progress;
  ctx.beginPath();
  ctx.ellipse(vent.x, vent.y - progress * 3, radius, radius * 0.55, -0.12, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,239,156,${progress * 0.55 * thermal.hotAlpha})`;
  ctx.beginPath();
  ctx.arc(vent.x - radius * 0.25, vent.y - progress * 3 - radius * 0.12, Math.max(1, radius * 0.18), Math.PI, TAU * 0.94);
  ctx.stroke();
}

function drawJet(ctx, vent, phase, thermal, options) {
  if (phase < 0.775 || phase > 0.91 || thermal.splashFactor <= 0.02) return;
  const progress = (phase - 0.775) / 0.135;
  const envelope = Math.sin(progress * Math.PI);
  const height = (vent.rareJet ? 62 : 18 + vent.strength * 27) * envelope * thermal.splashFactor;
  const width = vent.radius * (0.35 + envelope * 0.32);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const jet = ctx.createLinearGradient(vent.x, vent.y, vent.x, vent.y - Math.max(1, height));
  jet.addColorStop(0, `rgba(226,55,7,${0.75 * envelope})`);
  jet.addColorStop(0.52, `rgba(255,132,24,${0.82 * envelope})`);
  jet.addColorStop(1, `rgba(255,229,128,${0.48 * envelope})`);
  ctx.fillStyle = jet;
  ctx.beginPath();
  ctx.moveTo(vent.x - width, vent.y);
  ctx.quadraticCurveTo(vent.x - width * 0.35, vent.y - height * 0.62, vent.x, vent.y - height);
  ctx.quadraticCurveTo(vent.x + width * 0.38, vent.y - height * 0.58, vent.x + width, vent.y);
  ctx.closePath();
  ctx.fill();
  if (!options.paused) {
    for (let index = 0; index < 4; index += 1) {
      const angle = -Math.PI * (0.28 + index * 0.145) + Math.sin(vent.seed + index) * 0.08;
      const travel = (10 + index * 5 + vent.strength * 9) * envelope;
      const x = vent.x + Math.cos(angle) * travel;
      const y = vent.y + Math.sin(angle) * travel - height * 0.34;
      ctx.fillStyle = `rgba(255,${130 + index * 22},35,${envelope * (0.75 - index * 0.1)})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + (3 - index) * 0.45, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawMagmaEruptions(ctx, runtime, options) {
  if (!runtime?.vents?.length) return;
  const thermal = getMagmaThermalVisual(options.thermalState);
  const count = Math.max(0, Math.min(
    runtime.vents.length,
    options.ventLimit,
    options.ventCount[options.thermalState],
  ));
  ctx.save();
  for (let index = 0; index < count; index += 1) {
    const vent = runtime.vents[index];
    const phase = getMagmaVentPhase(vent, runtime.visualTimeMs);
    drawVentGlow(ctx, vent, phase, thermal);
    drawBubble(ctx, vent, phase, thermal);
    drawJet(ctx, vent, phase, thermal, options);
  }
  ctx.restore();
}
