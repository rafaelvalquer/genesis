import { CELL } from "./visualGeometry.js";

const laneY = (row) => row * CELL.height + CELL.height / 2;

export function drawColossoCaldeira(ctx, enemy, settings = {}, image = null) {
  const x = enemy.x - 72;
  const y = laneY(2);
  const pulse = settings.reduceMotion ? .5 : .5 + .5 * Math.sin((enemy.colossoStateStartedAt || 0) / 120 + Date.now() / 180);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = enemy.colossoState === "spawnAwakening" ? .45 + pulse * .55 : 1;
  ctx.shadowBlur = settings.reduceMotion ? 8 : 18;
  ctx.shadowColor = "#f97316";
  if (image) {
    ctx.drawImage(image, -180, -180, 360, 360);
  } else {
    ctx.fillStyle = "#29110c";
    ctx.beginPath(); ctx.ellipse(0, 0, 105, 145, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7c2d12";
    ctx.beginPath(); ctx.ellipse(-82, -118, 55, 28, -.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-82, 118, 55, 28, .35, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#fb923c";
  ctx.beginPath(); ctx.arc(-22, 4, enemy.colossoState === "coreExposed" ? 31 : 19, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.arc(-22, 4, 8 + pulse * 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f97316";
  for (const rift of enemy.colossoRifts || []) { const rx = rift.col * CELL.width + CELL.width / 2 - x; const ry = laneY(rift.row) - y; ctx.fillRect(rx - 23, ry - 4, 46, 8); }
  if (enemy.colossoTargetRows?.length && /Telegraph|finalCollapse/.test(enemy.colossoState || "")) {
    ctx.globalAlpha = .45 + pulse * .45; ctx.strokeStyle = enemy.colossoQueuedAttack === "rift" ? "#fb923c" : "#ef4444"; ctx.lineWidth = 3;
    for (const row of enemy.colossoTargetRows) { const ry = laneY(row) - y; ctx.strokeRect(-480, ry - 27, 720, 54); }
  }
  ctx.restore();
}

export function drawColossoBossHealth(ctx, enemy) {
  const ratio = Math.max(0, enemy.hp / Math.max(1, enemy.maxHp));
  ctx.save(); ctx.fillStyle = "rgba(9,4,2,.82)"; ctx.fillRect(225, 14, 510, 35);
  ctx.fillStyle = "#7f1d1d"; ctx.fillRect(230, 32, 500, 10); ctx.fillStyle = "#f97316"; ctx.fillRect(230, 32, 500 * ratio, 10);
  ctx.fillStyle = "#fff7ed"; ctx.font = "700 13px system-ui"; ctx.textAlign = "center"; ctx.fillText(`COLOSSO DA CALDEIRA · FASE ${enemy.colossoPhase}`, 480, 27);
  ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(230 + 500 * .30, 32, 1, 10); ctx.fillRect(230 + 500 * .65, 32, 1, 10); ctx.restore();
}
