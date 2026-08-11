import { CELL } from "./visualGeometry.js";
import { TROOPS } from "./content.js";

export function getThermalPlatformVisual(platform, config = TROOPS.thermalPlatform) {
  const thresholds = config.heatThresholds || { heated: 0.6, critical: 0.8, overheat: 1 };
  const maxHeat = Math.max(1, platform.maxHeat || config.maxHeat || 100);
  const ratio = Math.max(0, Math.min(1, (platform.heat || 0) / maxHeat));
  const state = platform.destroyed ? "destroyed"
    : platform.overheated || ratio >= thresholds.overheat ? "overheat"
      : ratio >= thresholds.critical ? "critical"
        : ratio >= thresholds.heated ? "heated" : "idle";
  return { state, ratio, percent: Math.round(ratio * 100) };
}

export function drawThermalPlatformIndicators(ctx, session) {
  for (const platform of session.supportStructures || []) {
    const { state } = getThermalPlatformVisual(platform);
    const x = platform.col * CELL.width + CELL.width / 2;
    const y = platform.row * CELL.height + CELL.height * .66;
    ctx.save();
    ctx.fillStyle = "rgba(20,10,8,.56)";
    ctx.beginPath(); ctx.ellipse(x, y, 32, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,100,20,${state === "overheat" ? .28 : .13})`;
    ctx.lineWidth = 1;
    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * 12;
      ctx.beginPath(); ctx.moveTo(x + offset, y + 5); ctx.lineTo(x + offset * 1.45, y + 10); ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawThermalPlatformHeatBars(ctx, session) {
  const config = TROOPS.thermalPlatform;
  const visual = config.heatBarVisual || {};
  const width = visual.width || 62;
  const height = visual.height || 7;
  for (const platform of session.supportStructures || []) {
    const { ratio, percent, state } = getThermalPlatformVisual(platform, config);
    if (state === "destroyed") continue;
    const x = platform.col * CELL.width + CELL.width / 2;
    const y = platform.row * CELL.height + CELL.height / 2 - (visual.offsetY || 46);
    const color = state === "overheat" ? "#ef4444" : state === "critical" ? "#f97316" : state === "heated" ? "#facc15" : "#22d3ee";
    ctx.save();
    ctx.fillStyle = "rgba(2,6,23,.88)";
    ctx.fillRect(x - width / 2 - 2, y - 2, width + 4, height + 4);
    ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, y, width * ratio, height);
    ctx.strokeStyle = "rgba(226,232,240,.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width / 2 - .5, y - .5, width + 1, height + 1);
    for (const threshold of [config.heatThresholds?.heated ?? .6, config.heatThresholds?.critical ?? .8]) {
      ctx.strokeStyle = "rgba(226,232,240,.48)";
      ctx.beginPath();
      ctx.moveTo(x - width / 2 + width * threshold, y - 1);
      ctx.lineTo(x - width / 2 + width * threshold, y + height + 1);
      ctx.stroke();
    }
    if (ratio >= (visual.showPercentFrom ?? .6)) {
      ctx.fillStyle = state === "overheat" ? "#fecaca" : "#e0f2fe";
      ctx.font = "700 9px Chakra Petch, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(state === "overheat" ? "SUPERAQUECIDA" : `CALOR ${percent}%`, x, y - 5);
    }
    const cryoSupport = (session.troops || []).some((troop) => !troop.dead
      && troop.type === "cryo7" && troop.row === platform.row && troop.col === platform.col);
    if (cryoSupport) {
      ctx.fillStyle = "#a5f3fc";
      ctx.font = "700 13px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 6;
      ctx.fillText("❄", x + width / 2 + 5, y + height + 2);
    }
    if (platform.renewedAt != null && session.elapsed - platform.renewedAt < 700) {
      const progress = Math.max(0, (session.elapsed - platform.renewedAt) / 700);
      ctx.strokeStyle = `rgba(103,232,249,${1 - progress})`;
      ctx.beginPath(); ctx.arc(x, y + height / 2, 14 + progress * 18, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
