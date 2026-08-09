import { CELL } from "../visualGeometry.js";
import { hashNoise } from "./magmaSurfaceGenerator.js";
import { prepareMagmaFlowRuntime } from "./magmaFlowRuntime.js";
import { drawMagmaHeatShimmer } from "./magmaHeatRenderer.js";
import { getMagmaThermalVisual } from "./magmaVisualConfig.js";

function traceRegionClip(ctx, region) {
  ctx.beginPath();
  for (const [row, col] of region.cells) {
    ctx.rect(
      col * CELL.width - 0.75,
      row * CELL.height - 0.75,
      CELL.width + 1.5,
      CELL.height + 1.5,
    );
  }
}

function traceChannel(ctx, channel, bounds) {
  ctx.beginPath();
  ctx.moveTo(bounds.x + channel.startX, bounds.y + channel.startY);
  ctx.bezierCurveTo(
    bounds.x + channel.controlX1,
    bounds.y + channel.controlY1,
    bounds.x + channel.controlX2,
    bounds.y + channel.controlY2,
    bounds.x + channel.endX,
    bounds.y + channel.endY,
  );
}

function drawInterpolatedLayer(ctx, entry, property, blend, composite = "source-over", alpha = 1) {
  const { bounds } = entry.region;
  const previous = entry.previous?.[property];
  const next = entry.next?.[property];
  ctx.save();
  ctx.globalCompositeOperation = composite;
  if (previous) {
    ctx.globalAlpha = (1 - blend) * alpha;
    ctx.drawImage(previous, bounds.x, bounds.y, bounds.width, bounds.height);
  }
  if (next) {
    ctx.globalAlpha = blend * alpha;
    ctx.drawImage(next, bounds.x, bounds.y, bounds.width, bounds.height);
  }
  ctx.restore();
}

function interpolateFlowFrame(entry, blend) {
  const previous = entry.previous?.flowFrame;
  const next = entry.next?.flowFrame || previous;
  if (!previous) return next || { offsetX: 0, offsetY: 0, primaryTravel: 0 };
  const interpolate = (key) => previous[key] + ((next[key] ?? previous[key]) - previous[key]) * blend;
  return {
    ...previous,
    offsetX: interpolate("offsetX"),
    offsetY: interpolate("offsetY"),
    primaryTravel: interpolate("primaryTravel"),
  };
}

function edgeCoordinates(edge) {
  const x = edge.col * CELL.width;
  const y = edge.row * CELL.height;
  if (edge.direction === "north") return { x0: x, y0: y, x1: x + CELL.width, y1: y, nx: 0, ny: 1 };
  if (edge.direction === "south") return { x0: x, y0: y + CELL.height, x1: x + CELL.width, y1: y + CELL.height, nx: 0, ny: -1 };
  if (edge.direction === "west") return { x0: x, y0: y, x1: x, y1: y + CELL.height, nx: 1, ny: 0 };
  return { x0: x + CELL.width, y0: y, x1: x + CELL.width, y1: y + CELL.height, nx: -1, ny: 0 };
}

function traceIrregularEdge(ctx, edge, seed) {
  const geometry = edgeCoordinates(edge);
  const segments = 10;
  ctx.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const baseX = geometry.x0 + (geometry.x1 - geometry.x0) * progress;
    const baseY = geometry.y0 + (geometry.y1 - geometry.y0) * progress;
    const noise = (hashNoise(edge.row * 17 + edge.col * 31 + index, index * 7, seed) - 0.5) * 9;
    const x = baseX + geometry.nx * noise;
    const y = baseY + geometry.ny * noise;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  return geometry;
}

function drawEdgeGlow(ctx, region, thermal) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const edge of region.edges) {
    traceIrregularEdge(ctx, edge, region.seed);
    ctx.strokeStyle = `rgba(249,72,9,${0.05 * thermal.brightness})`;
    ctx.lineWidth = 26;
    ctx.stroke();
    traceIrregularEdge(ctx, edge, region.seed);
    ctx.strokeStyle = `rgba(255,144,25,${0.08 * thermal.brightness})`;
    ctx.lineWidth = 10;
    ctx.stroke();
  }
  ctx.restore();
}

function drawIrregularBanks(ctx, region) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const edge of region.edges) {
    const geometry = traceIrregularEdge(ctx, edge, region.seed);
    ctx.strokeStyle = "rgba(12,5,4,.96)";
    ctx.lineWidth = 6;
    ctx.stroke();
    traceIrregularEdge(ctx, edge, region.seed);
    ctx.strokeStyle = "rgba(109,30,8,.72)";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let index = 1; index < 5; index += 1) {
      const progress = index / 5;
      const random = hashNoise(edge.row * 31 + edge.col, index * 19, region.seed);
      if (random < 0.38) continue;
      const x = geometry.x0 + (geometry.x1 - geometry.x0) * progress + geometry.nx * (3 + random * 4);
      const y = geometry.y0 + (geometry.y1 - geometry.y0) * progress + geometry.ny * (3 + random * 4);
      ctx.fillStyle = random > 0.72 ? "#1a0906" : "#260d07";
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + random * 6, 2.5 + random * 3.5, random * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawChannelHighlights(ctx, entry, flowFrame, thermal, options) {
  const { bounds } = entry.region;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  for (const channel of entry.channels) {
    traceChannel(ctx, channel, bounds);
    ctx.strokeStyle = `rgba(218,55,7,${0.035 * thermal.brightness})`;
    ctx.lineWidth = channel.radius * 2.15;
    ctx.stroke();
    traceChannel(ctx, channel, bounds);
    ctx.strokeStyle = `rgba(255,112,14,${0.075 * thermal.hotAlpha})`;
    ctx.lineWidth = Math.max(3, channel.radius * 0.72);
    ctx.setLineDash([32 + channel.radius, 9, 54 + channel.radius * 1.5, 17]);
    ctx.lineDashOffset = flowFrame.offsetX * 0.72 * channel.speed;
    ctx.stroke();
    ctx.setLineDash([]);
    if (!options.paused) {
      traceChannel(ctx, channel, bounds);
      ctx.strokeStyle = `rgba(255,226,107,${0.11 * thermal.hotAlpha})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([2, 13 + channel.speed * 4]);
      ctx.lineDashOffset = flowFrame.offsetX * 1.55 * channel.speed;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

function drawRegionDebug(ctx, entry, options) {
  if (!options.showRegionMask) return;
  const { region } = entry;
  ctx.save();
  ctx.fillStyle = "rgba(34,211,238,.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(103,232,249,.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const edge of region.edges) {
    const { x0, y0, x1, y1 } = edgeCoordinates(edge);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  ctx.fillStyle = "#cffafe";
  ctx.font = "700 11px system-ui";
  ctx.fillText(region.id, region.bounds.x + 8, region.bounds.y + 16);
  ctx.restore();
}

export function drawMagmaSurface(
  ctx,
  session,
  suppliedRuntime,
  now = 0,
  settings = {},
  adaptive = {},
) {
  if (!session?.phase?.magmaTerrain?.cells?.length) return suppliedRuntime;
  const prepared = prepareMagmaFlowRuntime(suppliedRuntime, session, now, settings, adaptive);
  const { runtime, options } = prepared;
  const thermal = getMagmaThermalVisual(options.thermalState);
  const blend = runtime.surface.blendProgress;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  for (const entry of runtime.regions) {
    const flowFrame = interpolateFlowFrame(entry, blend);
    drawEdgeGlow(ctx, entry.region, thermal);
    ctx.save();
    traceRegionClip(ctx, entry.region);
    ctx.clip();
    ctx.fillStyle = "#120604";
    ctx.fillRect(
      entry.region.bounds.x,
      entry.region.bounds.y,
      entry.region.bounds.width,
      entry.region.bounds.height,
    );
    if (options.showHeatmap) {
      drawInterpolatedLayer(ctx, entry, "heatCanvas", blend);
    } else {
      drawInterpolatedLayer(ctx, entry, "surfaceCanvas", blend);
      drawInterpolatedLayer(ctx, entry, "crustCanvas", blend, "multiply", 0.42);
      drawInterpolatedLayer(ctx, entry, "hotCanvas", blend, "screen", 0.22);
      drawChannelHighlights(ctx, entry, flowFrame, thermal, options);
      drawMagmaHeatShimmer(ctx, entry, blend, now, options);
    }
    traceRegionClip(ctx, entry.region);
    drawRegionDebug(ctx, entry, options);
    ctx.restore();
    drawIrregularBanks(ctx, entry.region);
  }
  ctx.restore();
  return runtime;
}
