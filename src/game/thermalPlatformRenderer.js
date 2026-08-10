import { CELL } from "./visualGeometry.js";

export function drawThermalPlatformIndicators(ctx, session) {
  for (const platform of session.supportStructures || []) {
    const x = platform.col * CELL.width + CELL.width / 2;
    const y = platform.row * CELL.height + CELL.height * .66;
    ctx.save();
    // A cooled, fractured contact patch makes the structure feel seated in lava.
    ctx.fillStyle = "rgba(20,10,8,.56)";
    ctx.beginPath(); ctx.ellipse(x, y, 32, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,100,20,${platform.overheated ? .28 : .13})`;
    ctx.lineWidth = 1;
    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * 12;
      ctx.beginPath(); ctx.moveTo(x + offset, y + 5); ctx.lineTo(x + offset * 1.45, y + 10); ctx.stroke();
    }
    if (platform.heat >= 60) {
      const barY = platform.row * CELL.height + CELL.height * .18;
      ctx.fillStyle = platform.heat >= 80 ? "#ef4444" : "#f59e0b";
      ctx.fillRect(x - 22, barY, 44 * Math.min(1, platform.heat / platform.maxHeat), 4);
      if (platform.overheated) { ctx.fillStyle = "#fef08a"; ctx.font = "bold 13px sans-serif"; ctx.fillText("⚠", x - 6, barY - 4); }
    }
    ctx.restore();
  }
}
