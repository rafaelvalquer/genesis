import { CELL } from "../visualGeometry.js";
import {
  getChannelPoint,
  getDynamicChannelGeometry,
  hashNoise,
} from "./magmaSurfaceGenerator.js";
import { prepareMagmaFlowRuntime } from "./magmaFlowRuntime.js";
import { drawMagmaHeatShimmer } from "./magmaHeatRenderer.js";
import { getMagmaThermalVisual } from "./magmaVisualConfig.js";
import { drawMagmaTransition } from "./magmaTransitionRenderer.js";

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
  // visualMask is intentionally broader and softer than the cell union. It only
  // affects paint; region.cellSet remains the exact gameplay terrain.
  const mask = region.visualMask;
  if (!mask) return;
  for (const edge of region.edges) {
    const geometry = edgeCoordinates(edge);
    const lobes = Math.max(1, Math.round(geometry.x0 === geometry.x1 ? CELL.height : CELL.width) / mask.wavelength);
    for (let index = 0; index < lobes; index += 1) {
      const noise = hashNoise(edge.row * 37 + edge.col * 19, index * 41, region.seed);
      const progress = (index + .5) / lobes;
      const x = geometry.x0 + (geometry.x1 - geometry.x0) * progress + geometry.nx * (mask.lowFrequencyAmplitude * (.35 + noise * .55));
      const y = geometry.y0 + (geometry.y1 - geometry.y0) * progress + geometry.ny * (mask.lowFrequencyAmplitude * (.35 + noise * .55));
      const tangent = Math.atan2(geometry.y1 - geometry.y0, geometry.x1 - geometry.x0);
      ctx.ellipse(x, y, 24 + noise * 18, 7 + noise * 6, tangent, 0, Math.PI * 2);
    }
  }
}

function traceChannel(ctx, channel, bounds, time = 0) {
  const geometry = getDynamicChannelGeometry(channel, time);
  ctx.beginPath();
  ctx.moveTo(bounds.x + geometry.startX, bounds.y + geometry.startY);
  ctx.bezierCurveTo(
    bounds.x + geometry.controlX1,
    bounds.y + geometry.controlY1,
    bounds.x + geometry.controlX2,
    bounds.y + geometry.controlY2,
    bounds.x + geometry.endX,
    bounds.y + geometry.endY,
  );
  return geometry;
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

function traceIrregularEdge(ctx, edge, seed, visualTimeMs = 0, thermalState = "stable") {
  const geometry = edgeCoordinates(edge);
  const segments = 10;
  const dynamicAmplitude = thermalState === "eruption" ? 7 : thermalState === "active" ? 4.5 : 3;
  ctx.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const baseX = geometry.x0 + (geometry.x1 - geometry.x0) * progress;
    const baseY = geometry.y0 + (geometry.y1 - geometry.y0) * progress;
    const staticNoise = hashNoise(edge.row * 17 + edge.col * 31 + index, index * 7, seed);
    const edgePhase = hashNoise(edge.row * 41 + edge.col * 13, index * 23, seed + 91) * Math.PI * 2;
    const pulse = Math.sin(visualTimeMs * 0.00042 + edgePhase) * dynamicAmplitude;
    const noise = Math.max(0.75, 1.5 + staticNoise * 4.5 + pulse);
    const x = baseX + geometry.nx * noise;
    const y = baseY + geometry.ny * noise;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  return geometry;
}

function drawChannelHighlights(ctx, entry, flowFrame, thermal, options) {
  const { bounds } = entry.region;
  const time = entry.next?.generatedAt ?? entry.previous?.generatedAt ?? 0;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  for (const channel of entry.channels) {
    const geometry = traceChannel(ctx, channel, bounds, time);
    ctx.strokeStyle = `rgba(255,92,12,${0.012 * thermal.brightness})`;
    ctx.lineWidth = geometry.radius * 2.2;
    ctx.stroke();
    for (let index = 0; index < 3; index += 1) {
      const progress = ((index / 3 + channel.phase / (Math.PI * 2)
        - flowFrame.primaryTravel / Math.max(180, bounds.width * 0.72)) % 1 + 1) % 1;
      const point = getChannelPoint(channel, progress, time);
      const radius = geometry.radius * (0.18 + index * 0.035);
      const glow = ctx.createRadialGradient(
        bounds.x + point.x,
        bounds.y + point.y,
        0,
        bounds.x + point.x,
        bounds.y + point.y,
        radius * 3.2,
      );
      glow.addColorStop(0, `rgba(255,235,146,${0.2 * thermal.hotAlpha})`);
      glow.addColorStop(0.35, `rgba(255,126,20,${0.11 * thermal.hotAlpha})`);
      glow.addColorStop(1, "rgba(255,70,8,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(
        bounds.x + point.x,
        bounds.y + point.y,
        radius * 3.2,
        radius * 1.45,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
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
      drawInterpolatedLayer(ctx, entry, "crustCanvas", blend, "multiply", 0.54);
      drawInterpolatedLayer(ctx, entry, "hotCanvas", blend, "screen", 0.34);
      drawChannelHighlights(ctx, entry, flowFrame, thermal, options);
      drawMagmaHeatShimmer(ctx, entry, blend, now, options);
    }
    traceRegionClip(ctx, entry.region);
    drawRegionDebug(ctx, entry, options);
    ctx.restore();
    drawMagmaTransition(ctx, entry.region, session.phase, runtime, options);
  }
  ctx.restore();
  return runtime;
}
