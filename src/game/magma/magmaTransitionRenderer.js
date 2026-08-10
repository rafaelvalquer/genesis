import { CELL } from "../visualGeometry.js";
import { hashNoise } from "./magmaSurfaceGenerator.js";

function edgeGeometry(edge) {
  const x = edge.col * CELL.width;
  const y = edge.row * CELL.height;
  if (edge.direction === "north") return { x, y, dx: 1, dy: 0, nx: 0, ny: -1, length: CELL.width };
  if (edge.direction === "south") return { x, y: y + CELL.height, dx: 1, dy: 0, nx: 0, ny: 1, length: CELL.width };
  if (edge.direction === "west") return { x, y, dx: 0, dy: 1, nx: -1, ny: 0, length: CELL.height };
  return { x: x + CELL.width, y, dx: 0, dy: 1, nx: 1, ny: 0, length: CELL.height };
}

function thermalFactor(state) {
  return state === "eruption" ? 1 : state === "active" ? .72 : state === "cooldown" ? .22 : .42;
}

function patch(ctx, x, y, rx, ry, rotation, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fill();
}

function crack(ctx, x, y, normalX, normalY, tangentX, tangentY, length, heat) {
  const endX = x + normalX * length + tangentX * length * .24;
  const endY = y + normalY * length + tangentY * length * .24;
  ctx.strokeStyle = `rgba(30,10,7,${.62 + heat * .15})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.lineTo(endX + tangentX * 5, endY + tangentY * 5); ctx.stroke();
  if (heat > .35) {
    ctx.strokeStyle = `rgba(255,89,15,${.12 + heat * .22})`;
    ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(x + normalX * 3, y + normalY * 3); ctx.lineTo(endX, endY); ctx.stroke();
  }
}

// This is deliberately made of independent patches instead of a stroke: it lets the
// gameplay cell boundary remain exact while the terrain reads as a natural caldera.
export function drawMagmaTransition(ctx, region, phase, runtime, options = {}) {
  const heat = thermalFactor(options.thermalState);
  const seed = region.seed;
  const transitionWidth = region.visualMask?.transitionWidth ?? 30;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (const edge of region.edges) {
    const geometry = edgeGeometry(edge);
    const count = Math.max(2, Math.ceil(geometry.length / 38));
    for (let index = 0; index < count; index += 1) {
      const noise = hashNoise(edge.row * 43 + edge.col * 17, index * 29, seed);
      if (noise < .18) continue;
      const along = (index + .25 + hashNoise(index, edge.row, seed + 81) * .5) / count * geometry.length;
      const x = geometry.x + geometry.dx * along + geometry.nx * (transitionWidth * .28 + noise * transitionWidth * .46);
      const y = geometry.y + geometry.dy * along + geometry.ny * (transitionWidth * .28 + noise * transitionWidth * .46);
      const rotation = Math.atan2(geometry.dy, geometry.dx) + (noise - .5) * .8;
      // Broad, low-alpha scorched soil blends into the arena 12–30 px from the magma.
      patch(ctx, x + geometry.nx * (7 + noise * 8), y + geometry.ny * (7 + noise * 8), 14 + noise * 12, 6 + noise * 6, rotation, `rgba(36,16,10,${.12 + noise * .13})`);
      // Fragmented edge crust lives closer to the liquid and never joins into a border.
      if (noise > .34) patch(ctx, x - geometry.nx * 3, y - geometry.ny * 3, 7 + noise * 10, 3 + noise * 4, rotation, `rgba(26,10,7,${.48 + noise * .24})`);
      if (noise > .72) patch(ctx, x, y, 5 + noise * 6, 1.5 + noise * 2, rotation, `rgba(104,38,14,${.23 + heat * .18})`);
      if (noise > .78) crack(ctx, x + geometry.nx * 8, y + geometry.ny * 8, geometry.nx, geometry.ny, geometry.dx, geometry.dy, 9 + noise * 22, heat);
      if (noise > .58 && heat > .25) {
        ctx.globalCompositeOperation = "screen";
        patch(ctx, x + geometry.nx * 16, y + geometry.ny * 16, 18 + noise * 14, 7 + noise * 5, rotation, `rgba(255,91,17,${.018 + heat * .035})`);
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }
  ctx.restore();
}
