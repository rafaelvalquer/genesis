import { CELL } from "../visualGeometry.js";

const STATE = {
  stable: { fire: .28, crack: .35, hotspots: .28 },
  active: { fire: .6, crack: .68, hotspots: .58 },
  eruption: { fire: 1, crack: 1, hotspots: 1 },
  cooldown: { fire: .1, crack: .18, hotspots: .12 },
};

function hash(value) {
  const sine = Math.sin(value * 12.9898) * 43758.5453;
  return sine - Math.floor(sine);
}

function settingsFor(state) { return STATE[state] || STATE.stable; }

function drawCrack(ctx, x, y, seed, heat, time) {
  const points = [{ x, y }];
  for (let segment = 0; segment < 4; segment += 1) {
    const previous = points.at(-1);
    points.push({ x: previous.x + 13 + hash(seed + segment * 9) * 20, y: previous.y + (hash(seed + segment * 17) - .5) * 20 });
  }
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(31,9,6,.82)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.stroke();
  const pulse = .62 + Math.sin(time * .0017 + seed) * .38;
  ctx.strokeStyle = `rgba(255,77,12,${heat * pulse * .56})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.stroke();
  if (heat > .5) { ctx.strokeStyle = `rgba(255,210,79,${heat * pulse * .28})`; ctx.lineWidth = .75; ctx.stroke(); }
  ctx.restore();
}

function drawFire(ctx, x, y, seed, intensity, time) {
  const cycle = ((time * (.00012 + hash(seed) * .00008) + hash(seed + 4)) % 1 + 1) % 1;
  const life = Math.sin(cycle * Math.PI);
  if (life < .08) return;
  const height = (12 + hash(seed + 8) * 23) * life * intensity;
  const drift = Math.sin(time * .002 + seed) * 2.5;
  ctx.save(); ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = `rgba(255,57,8,${.28 * life * intensity})`;
  ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x + drift, y - height * 1.35, x + 9, y); ctx.quadraticCurveTo(x, y + 4, x - 9, y); ctx.fill();
  ctx.fillStyle = `rgba(255,175,34,${.4 * life * intensity})`;
  ctx.beginPath(); ctx.moveTo(x - 4.5, y); ctx.quadraticCurveTo(x + drift * .6, y - height, x + 4.5, y); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// This deliberately paints on the existing arena rather than replacing it with a
// liquid canvas. The logical cell list still controls all thermal gameplay.
export function drawMagmaGround(ctx, session, time = 0, settings = {}) {
  const cells = session?.phase?.magmaTerrain?.cells || [];
  if (!cells.length) return;
  const state = settings.thermalState || session.thermalCycle?.state || "stable";
  const level = settingsFor(state);
  const quality = settings.quality === "low" ? .5 : settings.quality === "medium" ? .75 : 1;
  const seed = session.phase.magmaTerrain.visual?.seed || 1;
  ctx.save();
  for (const [row, col] of cells) {
    const x = col * CELL.width; const y = row * CELL.height;
    ctx.fillStyle = "rgba(16,10,8,.34)";
    ctx.fillRect(x, y, CELL.width, CELL.height);
  }
  const cellCount = cells.length;
  const crackCount = Math.max(3, Math.round(cellCount * (state === "eruption" ? 1.6 : .82) * quality));
  for (let index = 0; index < crackCount; index += 1) {
    const cell = cells[Math.floor(hash(seed + index * 31) * cellCount)];
    drawCrack(ctx, cell[1] * CELL.width + 8 + hash(seed + index * 37) * 48, cell[0] * CELL.height + 18 + hash(seed + index * 41) * 54, seed + index * 17, level.crack, time);
  }
  const hotspots = Math.round(cellCount * (state === "eruption" ? 1.1 : .48) * quality);
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < hotspots; index += 1) {
    const cell = cells[Math.floor(hash(seed + index * 57) * cellCount)];
    const x = cell[1] * CELL.width + 12 + hash(seed + index * 61) * 72;
    const y = cell[0] * CELL.height + 16 + hash(seed + index * 67) * 60;
    const pulse = .55 + Math.sin(time * .0013 + index) * .3;
    const radius = 9 + hash(seed + index * 71) * 13;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
    glow.addColorStop(0, `rgba(255,115,18,${level.hotspots * pulse * .28})`); glow.addColorStop(1, "rgba(255,62,8,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x, y, radius * 2.5, radius * 1.35, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  const desiredFires = Math.round(cellCount * (state === "eruption" ? 1.3 : state === "active" ? .72 : state === "cooldown" ? .15 : .38) * quality);
  for (let index = 0; index < desiredFires; index += 1) {
    const cell = cells[Math.floor(hash(seed + index * 79) * cellCount)];
    drawFire(ctx, cell[1] * CELL.width + 12 + hash(seed + index * 83) * 74, cell[0] * CELL.height + 70 + hash(seed + index * 89) * 20, seed + index * 97, level.fire, time);
  }
  ctx.restore();
}
