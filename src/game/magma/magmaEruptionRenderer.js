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

function drawSpatter(ctx, vent, phase, thermal) {
  if (phase < 0.68 || phase > 0.94 || thermal.splashFactor <= 0.02) return;
  const progress = (phase - 0.68) / 0.26;
  const envelope = Math.sin(progress * Math.PI);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 7; index += 1) {
    const direction = (index - 3) * 0.34 + Math.sin(vent.seed * 0.01 + index) * 0.12;
    const travel = (8 + index % 3 * 7 + vent.strength * 12) * envelope;
    const x = vent.x + Math.sin(direction) * travel;
    const y = vent.y - Math.cos(direction) * travel * 0.62 - Math.sin(progress * Math.PI) * 9;
    ctx.fillStyle = `rgba(255,${92 + index * 16},18,${envelope * thermal.splashFactor * 0.72})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.9 + (index % 3) * 0.55, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBubblePop(ctx, vent, phase, thermal) {
  if (phase < 0.76 || phase > 0.93) return;
  const progress = (phase - 0.76) / 0.17;
  const envelope = Math.sin(progress * Math.PI);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = `rgba(255,197,72,${envelope * thermal.hotAlpha * 0.7})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(vent.x, vent.y, vent.radius * (0.6 + progress), vent.radius * 0.28, 0, 0, TAU);
  ctx.stroke();
  for (let index = 0; index < 4; index += 1) {
    const angle = -2.6 + index * 0.65 + Math.sin(vent.seed + index) * 0.12;
    const travel = (7 + index * 3) * envelope;
    ctx.fillStyle = `rgba(255,${132 + index * 20},24,${envelope * thermal.splashFactor})`;
    ctx.beginPath();
    ctx.arc(
      vent.x + Math.cos(angle) * travel,
      vent.y + Math.sin(angle) * travel - 3 * envelope,
      1.2 + (index % 2) * 0.6,
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawCrustBurst(ctx, vent, phase, thermal) {
  if (phase < 0.62 || phase > 0.94) return;
  const progress = (phase - 0.62) / 0.32;
  const envelope = Math.sin(progress * Math.PI);
  ctx.save();
  ctx.strokeStyle = `rgba(255,105,14,${envelope * thermal.hotAlpha * 0.8})`;
  ctx.lineWidth = 1 + envelope;
  for (let index = 0; index < 3; index += 1) {
    const angle = index * TAU / 3 + vent.seed * 0.001;
    ctx.beginPath();
    ctx.moveTo(vent.x, vent.y);
    ctx.lineTo(
      vent.x + Math.cos(angle) * vent.radius * (1.2 + envelope),
      vent.y + Math.sin(angle) * vent.radius * 0.55 * (1.2 + envelope),
    );
    ctx.stroke();
    const fragmentX = vent.x + Math.cos(angle) * (5 + index * 3) * envelope;
    const fragmentY = vent.y - Math.sin(progress * Math.PI) * (7 + index * 2)
      + Math.sin(angle) * 3;
    ctx.fillStyle = `rgba(24,8,5,${0.75 * envelope})`;
    ctx.beginPath();
    ctx.rect(fragmentX - 1.8, fragmentY - 1.2, 3.6, 2.4);
    ctx.fill();
  }
  ctx.restore();
}

function drawVentByType(ctx, vent, phase, thermal, options) {
  drawVentGlow(ctx, vent, phase, thermal);
  const type = vent.type || (vent.rareJet ? "ventJet" : "bubblePop");
  if (type === "bubblePop") {
    drawBubble(ctx, vent, phase, thermal);
    drawBubblePop(ctx, vent, phase, thermal);
  } else if (type === "spatter") {
    drawSpatter(ctx, vent, phase, thermal);
  } else if (type === "ventJet") {
    drawBubble(ctx, vent, phase, thermal);
    drawJet(ctx, vent, phase, thermal, options);
  } else {
    drawCrustBurst(ctx, vent, phase, thermal);
  }
}

export function drawMagmaEruptions(ctx, runtime, options) {
  if (!runtime?.vents?.length) return;
  const vents = [...runtime.vents].sort((left, right) => (
    (right.thermalState === "eruption" ? 1 : 0) - (left.thermalState === "eruption" ? 1 : 0)
  ));
  const count = Math.max(0, Math.min(
    vents.length,
    options.ventLimit,
    options.ventCount[options.thermalState],
  ));
  ctx.save();
  for (let index = 0; index < count; index += 1) {
    const vent = vents[index];
    const phase = getMagmaVentPhase(vent, runtime.visualTimeMs);
    const thermal = getMagmaThermalVisual(vent.thermalState || options.thermalState);
    drawVentByType(ctx, vent, phase, thermal, options);
  }
  const transientLimit = Math.max(0, options.ventLimit - count);
  for (const vent of (runtime.transientVents || []).slice(0, transientLimit)) {
    const phase = getMagmaVentPhase(vent, runtime.visualTimeMs);
    const thermal = getMagmaThermalVisual(vent.thermalState || options.thermalState);
    drawVentByType(ctx, vent, phase, thermal, options);
  }
  ctx.restore();
}
