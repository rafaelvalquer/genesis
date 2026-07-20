import { CELL } from "./visualGeometry.js";

function seededRandom(seed) {
  let value = Number(seed) || 1;
  return () => {
    value = (Math.imul(value ^ value >>> 15, value | 1) + 0x6d2b79f5) >>> 0;
    return value / 4294967296;
  };
}

function sparks(event, now, settings, count, color) {
  const random = seededRandom(event.seed);
  const amount = settings.reduceMotion ? Math.max(2, Math.round(count * 0.3)) : count;
  return Array.from({ length: amount }, () => {
    const angle = random() * Math.PI * 2;
    const speed = 35 + random() * 95;
    return {
      kind: "spark",
      x: event.x,
      y: event.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 28,
      gravity: 145,
      color,
      born: now,
      life: 240 + random() * 180,
      size: 1.3 + random() * 1.5,
    };
  });
}

export function createExecutorParticles(event, now, settings = {}) {
  if (event.type === "executorSlash") {
    const opposite = event.combo === 2;
    const length = opposite ? 54 : 42;
    const tilt = opposite ? 0.12 : -0.72;
    return [
      {
        kind: "executorArc",
        x: event.x,
        y: event.y,
        radius: length,
        startAngle: tilt - 1.5,
        endAngle: tilt + 1.25,
        color: event.color,
        born: now,
        life: settings.reduceMotion ? 130 : 210,
        reverse: opposite,
      },
      {
        kind: "muzzle",
        x: event.x,
        y: event.y,
        color: "#fff7ed",
        born: now,
        life: 120,
        size: opposite ? 19 : 15,
      },
      ...sparks(event, now, settings, opposite ? 10 : 7, "#fb923c"),
    ];
  }
  if (event.type === "executorFinisher") {
    const half = Math.min(CELL.width, CELL.height) * 0.31;
    return [
      {
        kind: "executorX",
        x: event.x,
        y: event.y,
        half,
        color: event.color,
        born: now,
        life: 300,
      },
      {
        kind: "ring",
        x: event.x,
        y: event.y,
        color: event.color,
        born: now,
        life: settings.reduceMotion ? 260 : 420,
        maxRadius: Math.min(CELL.width, CELL.height) * 0.48,
      },
      {
        kind: "muzzle",
        x: event.x,
        y: event.y,
        color: "#fff7ed",
        born: now,
        life: 190,
        size: 35,
      },
      ...sparks(event, now, settings, 24, "#f97316"),
    ];
  }
  if (event.type === "executorComboReset") {
    return settings.reduceMotion ? [] : [{
      kind: "ring",
      x: event.x,
      y: event.y - 42,
      color: "#fb923c",
      born: now,
      life: 260,
      maxRadius: 18,
    }];
  }
  return null;
}

export function drawExecutorParticle(ctx, particle, progress) {
  if (particle.kind === "executorArc") {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = particle.color;
    ctx.shadowBlur = 13;
    ctx.shadowColor = particle.color;
    ctx.lineCap = "round";
    ctx.lineWidth = 7 * (1 - progress);
    ctx.beginPath();
    ctx.arc(
      particle.x,
      particle.y,
      particle.radius * (0.8 + progress * 0.2),
      particle.reverse ? particle.endAngle : particle.startAngle,
      particle.reverse ? particle.startAngle : particle.endAngle,
      particle.reverse,
    );
    ctx.stroke();
    return true;
  }
  if (particle.kind === "executorX") {
    const alpha = Math.pow(1 - progress, 0.7);
    const half = particle.half * (0.8 + progress * 0.2);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = particle.color;
    ctx.shadowBlur = 18;
    ctx.shadowColor = particle.color;
    ctx.lineCap = "round";
    ctx.lineWidth = 8 * alpha;
    ctx.beginPath();
    ctx.moveTo(particle.x - half, particle.y - half);
    ctx.lineTo(particle.x + half, particle.y + half);
    ctx.moveTo(particle.x + half, particle.y - half);
    ctx.lineTo(particle.x - half, particle.y + half);
    ctx.stroke();
    return true;
  }
  return false;
}

export function drawExecutorComboIndicator(ctx, troop, elapsed, settings = {}) {
  if (troop.type !== "executorArco") return;
  const charged = troop.pendingComboImpact?.mode === "combo3" ? 3 : troop.comboStep;
  if (!charged) return;
  const pulse = settings.reduceMotion ? 1 : 0.85 + Math.sin(elapsed / 120) * 0.15;
  const startX = troop.x - 13;
  const y = troop.y - 58;
  ctx.save();
  ctx.lineCap = "round";
  for (let index = 0; index < 3; index += 1) {
    ctx.strokeStyle = index < charged ? `rgba(251,146,60,${pulse})` : "rgba(100,116,139,.35)";
    ctx.shadowBlur = index < charged ? 7 : 0;
    ctx.shadowColor = "#fb923c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX + index * 10, y);
    ctx.lineTo(startX + 6 + index * 10, y);
    ctx.stroke();
  }
  ctx.restore();
}
