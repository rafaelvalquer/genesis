import { CELL, FIELD } from "./visualGeometry.js";
import { getTideWaterlineX } from "./tideCycle.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function tideEnabled(session) {
  return session?.phase?.environmentHazard?.id === "tide_cycle";
}

function qualityMode(settings = {}, adaptive = {}) {
  if (adaptive.level === "stress" || settings.quality === "low") return "low";
  if (adaptive.level === "busy" || settings.quality === "medium") return "medium";
  return "high";
}

function drawWarning(ctx, session, now, settings) {
  const tide = session.tideCycle;
  const targetX = tide.floodedFromCol * CELL.width;
  const pulse = settings.reduceMotion ? 0.28 : 0.2 + (Math.sin(now / 180) + 1) * 0.07;
  ctx.save();
  const gradient = ctx.createLinearGradient(targetX, 0, FIELD.width, 0);
  gradient.addColorStop(0, `rgba(34, 211, 238, ${pulse})`);
  gradient.addColorStop(1, "rgba(14, 116, 144, .08)");
  ctx.fillStyle = gradient;
  ctx.fillRect(targetX, 0, FIELD.width - targetX, FIELD.height);
  ctx.strokeStyle = "rgba(165, 243, 252, .78)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(targetX, 0);
  ctx.lineTo(targetX, FIELD.height);
  ctx.stroke();
  ctx.restore();
}

export function drawTideUnderlay(ctx, session, now, settings = {}, adaptive = {}) {
  if (!tideEnabled(session)) return;
  if (session.tideCycle.state === "warning") {
    drawWarning(ctx, session, now, settings);
    return;
  }
  if (!["rising", "high", "receding"].includes(session.tideCycle.state)) return;

  const mode = qualityMode(settings, adaptive);
  const waterlineX = getTideWaterlineX(session, session.elapsed);
  const width = Math.max(0, FIELD.width - waterlineX);
  if (width <= 0) return;

  ctx.save();
  const water = ctx.createLinearGradient(waterlineX, 0, FIELD.width, 0);
  water.addColorStop(0, "rgba(45, 212, 191, .2)");
  water.addColorStop(0.28, "rgba(8, 145, 178, .25)");
  water.addColorStop(1, "rgba(3, 40, 58, .48)");
  ctx.fillStyle = water;
  ctx.fillRect(waterlineX, 0, width, FIELD.height);

  const depth = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  depth.addColorStop(0, "rgba(103, 232, 249, .05)");
  depth.addColorStop(1, "rgba(1, 15, 29, .28)");
  ctx.fillStyle = depth;
  ctx.fillRect(waterlineX, 0, width, FIELD.height);

  if (mode !== "low") {
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = mode === "high" ? "rgba(153, 246, 228, .13)" : "rgba(153, 246, 228, .08)";
    ctx.lineWidth = 1.2;
    const lineCount = mode === "high" ? 9 : 5;
    for (let index = 0; index < lineCount; index += 1) {
      const baseY = 25 + index * (FIELD.height / lineCount);
      ctx.beginPath();
      for (let x = waterlineX; x <= FIELD.width; x += 24) {
        const wave = settings.reduceMotion ? 0 : Math.sin(x / 52 + now / 850 + index) * 5;
        if (x === waterlineX) ctx.moveTo(x, baseY + wave);
        else ctx.lineTo(x, baseY + wave);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function foamPath(ctx, x, now, reduceMotion) {
  ctx.beginPath();
  for (let y = 0; y <= FIELD.height + 12; y += 16) {
    const wave = reduceMotion ? 0 : Math.sin(y / 31 + now / 180) * 4 + Math.sin(y / 73 - now / 330) * 2;
    if (y === 0) ctx.moveTo(x + wave, y);
    else ctx.lineTo(x + wave, y);
  }
}

export function drawTideOverlay(ctx, session, now, settings = {}, adaptive = {}) {
  if (!tideEnabled(session) || !["rising", "high", "receding"].includes(session.tideCycle.state)) return;
  const mode = qualityMode(settings, adaptive);
  const waterlineX = getTideWaterlineX(session, session.elapsed);
  const width = Math.max(0, FIELD.width - waterlineX);
  if (width <= 0) return;

  ctx.save();
  for (let row = 0; row < FIELD.rows; row += 1) {
    const laneBottom = (row + 1) * CELL.height;
    const surfaceY = laneBottom - CELL.height * 0.2;
    const band = ctx.createLinearGradient(0, surfaceY, 0, laneBottom);
    band.addColorStop(0, "rgba(34, 211, 238, .03)");
    band.addColorStop(1, mode === "low" ? "rgba(8, 145, 178, .16)" : "rgba(8, 145, 178, .24)");
    ctx.fillStyle = band;
    ctx.fillRect(waterlineX, surfaceY, width, laneBottom - surfaceY);
  }

  ctx.shadowColor = "rgba(103, 232, 249, .75)";
  ctx.shadowBlur = mode === "high" ? 8 : 3;
  ctx.strokeStyle = mode === "low" ? "rgba(207, 250, 254, .72)" : "rgba(236, 254, 255, .88)";
  ctx.lineWidth = mode === "high" ? 3 : 2;
  foamPath(ctx, waterlineX, now, settings.reduceMotion);
  ctx.stroke();

  if (mode === "high" && !settings.reduceMotion) {
    ctx.fillStyle = "rgba(165, 243, 252, .36)";
    const bubbleCount = 12;
    for (let index = 0; index < bubbleCount; index += 1) {
      const cycle = (now / (900 + index * 37) + index * 0.137) % 1;
      const x = waterlineX + 25 + ((index * 83) % Math.max(30, width - 35));
      const y = FIELD.height - cycle * FIELD.height;
      const radius = 1.2 + (index % 3) * 0.7;
      ctx.globalAlpha = clamp(1 - cycle, 0, 1) * 0.65;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
