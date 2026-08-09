import { CELL } from "./visualGeometry.js";
import { getMagmaCells } from "./thermalTerrain.js";

export function drawMagmaTerrain(ctx, session, time, settings = {}) {
  const cells = getMagmaCells(session?.phase);
  if (!cells.length) return;
  const state = session.thermalCycle?.state || "stable";
  const intensity = state === "eruption" ? 1 : state === "active" ? .72 : state === "cooldown" ? .36 : .48;
  const pulse = settings.reduceMotion ? .5 : .5 + .5 * Math.sin(time / 330);
  ctx.save();
  for (const [row, col] of cells) {
    const x = col * CELL.width; const y = row * CELL.height;
    const gradient = ctx.createRadialGradient(x + CELL.width * .5, y + CELL.height * .5, 5, x + CELL.width * .5, y + CELL.height * .5, CELL.width * .72);
    gradient.addColorStop(0, `rgba(255,190,40,${.38 * intensity + pulse * .18})`);
    gradient.addColorStop(.48, `rgba(234,88,12,${.72 * intensity})`);
    gradient.addColorStop(1, "rgba(49,15,8,.92)");
    ctx.fillStyle = gradient; ctx.fillRect(x + 2, y + 2, CELL.width - 4, CELL.height - 4);
    ctx.strokeStyle = `rgba(255,220,110,${.2 + intensity * .35})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 12, y + CELL.height * .45); ctx.lineTo(x + CELL.width * .42, y + CELL.height * .58); ctx.lineTo(x + CELL.width - 10, y + CELL.height * .35); ctx.stroke();
  }
  for (const platform of session.supportStructures || []) {
    const x = platform.col * CELL.width + CELL.width / 2; const y = platform.row * CELL.height + CELL.height / 2;
    ctx.fillStyle = "#475569"; ctx.fillRect(x - 27, y + 19, 54, 9); ctx.fillStyle = "#94a3b8"; ctx.fillRect(x - 20, y + 10, 40, 10);
    if (platform.heat >= 60) { ctx.fillStyle = platform.heat >= 80 ? "#ef4444" : "#f59e0b"; ctx.fillRect(x - 22, y + 5, 44 * platform.heat / platform.maxHeat, 4); }
    if (platform.overheated) { ctx.fillStyle = "#fef08a"; ctx.font = "bold 15px sans-serif"; ctx.fillText("⚠", x - 8, y); }
  }
  ctx.restore();
}
