import { CELL, FIELD } from "./visualGeometry.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function getWindCurrentVisualState(session, time = session?.elapsed || 0) {
  const wind = session?.windCurrent;
  const config = session?.phase?.environmentHazard;
  if (!wind || config?.id !== "wind_current") {
    return { state: "idle", intensity: 0, warningProgress: 0, recoveryProgress: 1 };
  }
  const warningProgress = wind.state === "warning"
    ? clamp((time - wind.warningStartedAt) / Math.max(1, wind.startsAt - wind.warningStartedAt))
    : 0;
  const recoveryProgress = wind.state === "recovering"
    ? clamp((time - wind.recoveryStartedAt) / Math.max(1, wind.recoveryEndsAt - wind.recoveryStartedAt))
    : wind.state === "idle" ? 1 : 0;
  const intensity = wind.state === "active"
    ? 1
    : wind.state === "warning"
      ? 0.25 + warningProgress * 0.35
      : wind.state === "recovering"
        ? 1 - recoveryProgress
        : 0;
  return {
    state: wind.state,
    intensity,
    warningProgress,
    recoveryProgress,
    direction: wind.direction,
    verticalDirection: wind.verticalDirection,
    selectedRows: [...wind.selectedRows],
    sourceRow: wind.sourceRow,
    targetRow: wind.targetRow,
  };
}

export function getWindArrowVector(wind) {
  if (wind.direction === "headwind") return { x: -1, y: 0, glyph: "←" };
  if (wind.direction === "tailwind") return { x: 1, y: 0, glyph: "→" };
  if (wind.verticalDirection < 0) return { x: 0, y: -1, glyph: "↑" };
  return { x: 0, y: 1, glyph: "↓" };
}

function windColor(direction) {
  if (direction === "tailwind") return "#a5f3fc";
  if (direction === "lateral") return "#c4b5fd";
  return "#93c5fd";
}

export function drawWindRouteOverlay(ctx, visual, time, settings = {}) {
  if (!["warning", "active"].includes(visual.state)) return;
  const rows = visual.direction === "lateral" ? [visual.sourceRow] : visual.selectedRows;
  const color = windColor(visual.direction);
  const vector = getWindArrowVector(visual);
  ctx.save();
  for (const row of rows) {
    if (!Number.isInteger(row)) continue;
    const y = row * CELL.height;
    const alpha = visual.state === "warning" ? 0.13 + visual.warningProgress * 0.09 : 0.08;
    ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
    ctx.fillRect(0, y, FIELD.width, CELL.height);
    ctx.strokeStyle = `${color}aa`;
    ctx.lineWidth = visual.state === "warning" ? 2 : 1;
    ctx.strokeRect(1, y + 2, FIELD.width - 2, CELL.height - 4);
    ctx.fillStyle = color;
    ctx.globalAlpha = visual.state === "warning" ? 0.82 : 0.46;
    ctx.font = settings.reduceMotion ? "700 22px system-ui" : "800 28px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const offset = settings.reduceMotion ? 0 : (time / 18) % 74;
    for (let index = -1; index < 16; index += 1) {
      const x = index * 74 + offset * (vector.x || 1);
      const arrowY = y + CELL.height / 2 + (vector.y ? ((index % 3) - 1) * 20 : 0);
      ctx.fillText(vector.glyph, x, arrowY);
    }
  }
  ctx.restore();
}

export function drawWindWarning(ctx, session, time, settings = {}) {
  const visual = getWindCurrentVisualState(session, time);
  if (visual.state !== "warning") return;
  drawWindRouteOverlay(ctx, visual, time, settings);
}

function drawWindStreaks(ctx, visual, time, settings = {}, adaptive = {}) {
  if (visual.intensity <= 0) return;
  const vector = getWindArrowVector(visual);
  const qualityCount = settings.quality === "low" ? 18 : settings.quality === "medium" ? 32 : 52;
  const count = Math.max(10, Math.round(qualityCount * (adaptive.particleBudgetScale ?? 1)));
  const color = windColor(visual.direction);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let index = 0; index < count; index += 1) {
    const seedX = (index * 193 + 47) % FIELD.width;
    const seedY = (index * 89 + 31) % FIELD.height;
    const speed = settings.reduceMotion ? 0 : 0.11 + (index % 7) * 0.012;
    const travel = time * speed;
    const x = (seedX + vector.x * travel + FIELD.width * 3) % FIELD.width;
    const y = (seedY + vector.y * travel + FIELD.height * 3) % FIELD.height;
    const length = 22 + (index % 6) * 8;
    ctx.globalAlpha = visual.intensity * (0.12 + (index % 5) * 0.035);
    ctx.lineWidth = 1 + (index % 3) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - vector.x * length, y - vector.y * length);
    ctx.quadraticCurveTo(
      x - vector.x * length * 0.45 + vector.y * 5,
      y - vector.y * length * 0.45 - vector.x * 5,
      x,
      y,
    );
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWindCurrent(ctx, session, time, settings = {}, adaptive = {}) {
  const visual = getWindCurrentVisualState(session, time);
  if (visual.state === "idle") return;
  if (visual.state === "warning") drawWindRouteOverlay(ctx, visual, time, settings);
  drawWindStreaks(ctx, visual, time, settings, adaptive);
  if (visual.state === "active" && settings.quality !== "low") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.025 * visual.intensity;
    ctx.fillStyle = windColor(visual.direction);
    const wobble = settings.reduceMotion ? 0 : Math.sin(time / 130) * 6;
    ctx.fillRect(wobble, 0, FIELD.width, FIELD.height);
    ctx.restore();
  }
}

export function consumeWindCurrentGraphicsEvents(runtime, events, now) {
  runtime.windEffects ||= [];
  for (const event of events) {
    if (event.type === "windPrimaryGust") {
      runtime.windEffects.push({ kind: "gust", ...event, born: now, life: 480 });
    } else if (event.type === "windTroopEjected" || event.type === "windEnemyEjected") {
      runtime.windEffects.push({ kind: "ejection", ...event, born: now, life: event.durationMs || 800 });
    } else if (event.type === "windEmergencyReturn") {
      runtime.windEffects.push({ kind: "return", ...event, born: now, life: event.durationMs || 650 });
    } else if (event.type === "windTroopShifted" || event.type === "windTroopChainShifted"
      || event.type === "windEnemyShifted") {
      runtime.windEffects.push({ kind: "shift", ...event, born: now, life: event.durationMs || 600 });
    }
  }
  runtime.windEffects = runtime.windEffects.slice(-48);
}

export function updateWindCurrentGraphics(runtime, now) {
  runtime.windEffects ||= [];
  runtime.windEffects = runtime.windEffects.filter((effect) => now - effect.born < effect.life);
}

export function drawWindEjection(ctx, effect, now, assets = {}) {
  const progress = clamp((now - effect.born) / effect.life);
  const entity = effect.entity || {};
  const x = effect.from?.x ?? entity.x ?? FIELD.width / 2;
  const startY = effect.from?.y ?? entity.y ?? FIELD.height / 2;
  const direction = effect.verticalDirection || 1;
  const y = startY + direction * (progress * 170 + progress * progress * 90);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(progress * direction * Math.PI * 1.4);
  ctx.scale(1 - progress * 0.6, 1 - progress * 0.6);
  ctx.globalAlpha = 1 - progress;
  const frames = effect.type === "windEnemyEjected" ? assets.rockDebris : assets.dustDebris;
  const frame = frames?.[Math.min(3, Math.floor(progress * 4))];
  if (frame) {
    ctx.drawImage(frame, -36, -36, 72, 72);
  } else {
    ctx.fillStyle = effect.type === "windEnemyEjected" ? "#fda4af" : "#e0e7ff";
    ctx.shadowColor = "#c4b5fd";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawEmergencyReturn(ctx, effect, now, assets = {}) {
  const progress = clamp((now - effect.born) / effect.life);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 1 - progress;
  const frame = assets.emergencyReturn?.[Math.min(3, Math.floor(progress * 4))];
  if (frame) {
    const size = 58 + progress * 24;
    ctx.drawImage(frame, effect.x - size / 2, effect.y + 38 - size / 2, size, size);
  } else {
    ctx.strokeStyle = "#a5f3fc";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(effect.x, effect.y + 38, 12 + progress * 34, 5 + progress * 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWindShiftedEntity(ctx, effect, now) {
  const progress = clamp((now - effect.born) / effect.life);
  const from = effect.from || {};
  const to = effect.to || from;
  const x = from.x + ((to.x ?? from.x) - from.x) * progress;
  const y = from.y + ((to.y ?? from.y) - from.y) * progress - Math.sin(progress * Math.PI) * 20;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = (1 - progress) * 0.48;
  ctx.strokeStyle = "#bfdbfe";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo((from.x + x) / 2, Math.min(from.y, y) - 24, x, y);
  ctx.stroke();
  ctx.restore();
}

export function drawWindEffects(ctx, runtime, now, settings = {}, assets = {}) {
  for (const effect of runtime.windEffects || []) {
    if (effect.kind === "ejection") drawWindEjection(ctx, effect, now, assets);
    else if (effect.kind === "return") drawEmergencyReturn(ctx, effect, now, assets);
    else if (effect.kind === "shift" && settings.quality !== "low") drawWindShiftedEntity(ctx, effect, now);
    else if (effect.kind === "gust") {
      const progress = clamp((now - effect.born) / effect.life);
      const vector = getWindArrowVector(effect);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = (1 - progress) * 0.38;
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 12 * (1 - progress) + 2;
      const originX = vector.x < 0 ? FIELD.width : vector.x > 0 ? 0 : FIELD.width / 2;
      const originY = vector.y < 0 ? FIELD.height : vector.y > 0 ? 0 : FIELD.height / 2;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + vector.x * FIELD.width, originY + vector.y * FIELD.height);
      ctx.stroke();
      ctx.restore();
    }
  }
}
