import { CELL, FIELD } from "./visualGeometry.js";

const hash = (index, seed) => {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

export function drawIncubatorFissureUnderlay(ctx, session) {
  for (const hazard of session.temporaryMagmaHazards || []) {
    const x = hazard.col * CELL.width + CELL.width / 2;
    const y = hazard.row * CELL.height + CELL.height * .68;
    const fade = hazard.active ? 1 : Math.max(0, (hazard.visualEndsAt - session.elapsed) / 600);
    ctx.save();
    ctx.globalAlpha = .9 * fade;
    ctx.fillStyle = "rgba(38,12,10,.9)";
    ctx.beginPath(); ctx.ellipse(x, y, 42, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(248,113,42,.9)";
    ctx.lineWidth = 2;
    for (let index = 0; index < 4; index += 1) {
      const offset = (index - 1.5) * 18;
      ctx.beginPath();
      ctx.moveTo(x + offset, y + 9);
      ctx.lineTo(x + offset + (index % 2 ? 9 : -8), y - 8);
      ctx.lineTo(x + offset + (index % 2 ? 16 : -15), y - 14);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(251,146,60,.7)";
    ctx.beginPath(); ctx.ellipse(x, y - 2, 18, 6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

export function drawIncubatorFissureEffects(ctx, session, elapsed, settings = {}) {
  if (settings.reduceMotion) return;
  for (const hazard of session.temporaryMagmaHazards || []) {
    const x = hazard.col * CELL.width + CELL.width / 2;
    const y = hazard.row * CELL.height + CELL.height * .58;
    const fade = hazard.active ? 1 : Math.max(0, (hazard.visualEndsAt - elapsed) / 600);
    ctx.save(); ctx.globalAlpha = fade;
    for (let index = 0; index < 5; index += 1) {
      const phase = elapsed / 260 + index * 1.7 + hash(index, hazard.col + hazard.row * 7);
      const px = x + Math.sin(phase) * (18 + index * 5);
      const py = y - ((elapsed / 85 + index * 13) % 24);
      ctx.fillStyle = index % 2 ? "#fb923c" : "#facc15";
      ctx.beginPath(); ctx.arc(px, py, 1.4 + (index % 2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

export function drawIncubatorTargetTelegraph(ctx, session, elapsed, settings = {}) {
  if (settings.reduceMotion) return;
  for (const enemy of session.enemies || []) {
    if (enemy.dead || enemy.type !== "vermeIncubador" || !["burrowOrigin", "undergroundToTarget"].includes(enemy.incubatorState)) continue;
    if (!Number.isInteger(enemy.incubatorTargetRow) || !Number.isInteger(enemy.incubatorTargetCol)) continue;
    const x = enemy.incubatorTargetCol * CELL.width + CELL.width / 2;
    const y = enemy.incubatorTargetRow * CELL.height + CELL.height * .66;
    const pulse = .5 + .5 * Math.sin(elapsed / 90);
    ctx.save();
    ctx.strokeStyle = `rgba(251,146,60,${.35 + pulse * .35})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 18 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 24, y + 6); ctx.lineTo(x - 12, y - 3); ctx.lineTo(x - 3, y + 4); ctx.lineTo(x + 10, y - 5); ctx.lineTo(x + 24, y + 5); ctx.stroke();
    ctx.restore();
  }
}
