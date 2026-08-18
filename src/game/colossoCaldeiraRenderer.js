import { CELL } from "./visualGeometry.js";

const laneY = (row) => row * CELL.height + CELL.height / 2;
const cellX = (col) => col * CELL.width + CELL.width / 2;
const attackState = (state = "") => /(?:Telegraph|Attack|finalCollapse)/.test(state);

function drawColossoUnderlay(ctx, enemy, x, y, pulse, effects, elapsed = 0) {
  ctx.save();
  ctx.fillStyle = "rgba(69,10,10,.52)";
  ctx.beginPath(); ctx.ellipse(x + 8, y + 72, 172, 42, 0, 0, Math.PI * 2); ctx.fill();
  for (const rift of enemy.colossoRifts || []) {
    const rx = cellX(rift.col); const ry = laneY(rift.row);
    ctx.strokeStyle = `rgba(251,146,60,${.52 + pulse * .38})`; ctx.lineWidth = 6 + pulse * 4;
    ctx.beginPath(); ctx.moveTo(rx - 30, ry + 4); ctx.lineTo(rx - 8, ry - 6); ctx.lineTo(rx + 8, ry + 7); ctx.lineTo(rx + 32, ry - 5); ctx.stroke();
    ctx.fillStyle = "rgba(255,236,153,.72)"; ctx.fillRect(rx - 11, ry - 3, 22, 6);
      const frames = effects?.colossoRift?.active || [];
      const startedAt = rift.startedAt ?? enemy.colossoStateStartedAt ?? elapsed;
      const frame = frames[Math.floor(Math.max(0, elapsed - startedAt) / 120) % Math.max(1, frames.length)];
    if (frame) ctx.drawImage(frame, rx - 46, ry - 46, 92, 92);
  }
  ctx.restore();
}

function drawColossoBackBody(ctx, enemy, x, y, pulse, image) {
  ctx.save(); ctx.translate(x, y);
  ctx.shadowBlur = 18; ctx.shadowColor = "#f97316";
  if (image) ctx.drawImage(image, -212, -212, 424, 424);
  else { ctx.fillStyle = "#29110c"; ctx.beginPath(); ctx.ellipse(0, 0, 118, 155, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = .3 + pulse * .2; ctx.fillStyle = "#fb923c"; ctx.beginPath(); ctx.ellipse(-35, 15, 62, 84, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTelegraphs(ctx, enemy, settings, pulse) {
  if (!attackState(enemy.colossoState)) return;
  const attack = enemy.colossoQueuedAttack;
  ctx.save(); ctx.globalAlpha = .42 + pulse * .42; ctx.lineWidth = 3;
  if (attack === "rift" && enemy.colossoRiftTarget) {
    const { row, col } = enemy.colossoRiftTarget; ctx.strokeStyle = "#fb923c"; ctx.strokeRect(cellX(col) - CELL.width / 2 + 3, laneY(row) - CELL.height / 2 + 3, CELL.width - 6, CELL.height - 6);
  } else if (attack === "slam" || attack === "fracture") {
    ctx.strokeStyle = attack === "slam" ? "#ef4444" : "#f97316";
    for (const { row, col } of enemy.colossoTargetCells || []) ctx.strokeRect(cellX(col) - CELL.width / 2 + 4, laneY(row) - CELL.height / 2 + 4, CELL.width - 8, CELL.height - 8);
  } else for (const row of enemy.colossoTargetRows || []) { ctx.strokeStyle = "#ef4444"; ctx.strokeRect(0, laneY(row) - CELL.height / 2 + 4, CELL.width * 9, CELL.height - 8); }
  ctx.restore();
}

export function drawColossoCaldeira(ctx, enemy, settings = {}, image = null, effects = {}) {
  const x = enemy.x - 72; const y = laneY(2);
  const elapsed = Number(settings.elapsed || 0); const pulse = settings.reduceMotion ? .5 : .5 + .5 * Math.sin(elapsed / 180);
  drawColossoUnderlay(ctx, enemy, x, y, pulse, effects, settings.elapsed);
  drawColossoBackBody(ctx, enemy, x, y, pulse, image);
  drawTelegraphs(ctx, enemy, settings, pulse);
}

export function drawColossoBossHealth(ctx, enemy, elapsed = 0) {
  const ratio = Math.max(0, enemy.hp / Math.max(1, enemy.maxHp)); const exposed = enemy.colossoState === "coreExposed";
  ctx.save(); ctx.fillStyle = "rgba(9,4,2,.82)"; ctx.fillRect(225, 14, 510, exposed ? 54 : 35);
  ctx.fillStyle = "#7f1d1d"; ctx.fillRect(230, 32, 500, 10); ctx.fillStyle = "#f97316"; ctx.fillRect(230, 32, 500 * ratio, 10);
  ctx.fillStyle = "#fff7ed"; ctx.font = "700 13px system-ui"; ctx.textAlign = "center"; ctx.fillText(`COLOSSO DA CALDEIRA · FASE ${enemy.colossoPhase}`, 480, 27);
  ctx.fillStyle = "rgba(255,255,255,.52)"; ctx.fillRect(230 + 500 * .35, 32, 1, 10); ctx.fillRect(230 + 500 * .70, 32, 1, 10);
  if (exposed) { const remain = Math.max(0, enemy.colossoStateEndsAt - elapsed); ctx.fillStyle = "#fef08a"; ctx.fillText(`NÚCLEO EXPOSTO  ${(remain / 1000).toFixed(1)}s`, 480, 59); }
  ctx.restore();
}
