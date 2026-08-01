import { CELL, FIELD } from "./visualGeometry.js";
import { getTideCellState, TIDE_CELL_TYPES } from "./tideCycle.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function tideEnabled(session) {
  return session?.phase?.environmentHazard?.id === "tide_cycle";
}

function qualityMode(settings = {}, adaptive = {}) {
  if (adaptive.level === "stress" || settings.quality === "low") return "low";
  if (adaptive.level === "busy" || settings.quality === "medium") return "medium";
  return "high";
}

function cellRect(row, col, inset = 0) {
  return {
    x: col * CELL.width + inset,
    y: row * CELL.height + inset,
    width: CELL.width - inset * 2,
    height: CELL.height - inset * 2,
  };
}

function forEachTideCell(callback) {
  for (let row = 0; row < FIELD.rows; row += 1) {
    // A água também cobre a coluna de entrada, onde os inimigos aparecem.
    for (let col = FIELD.firstTroopCol; col <= FIELD.enemyEntryCol; col += 1) {
      callback(row, col);
    }
  }
}

function transitionAlpha(session) {
  const config = session.phase.environmentHazard;
  const tide = session.tideCycle;
  if (tide.state === "rising") {
    return clamp((session.elapsed - tide.transitionStartedAt) / Math.max(1, config.risingMs));
  }
  if (tide.state === "receding") {
    return 1 - clamp((session.elapsed - tide.transitionStartedAt) / Math.max(1, config.recedingMs));
  }
  if (tide.state === "drying") {
    return 1 - clamp((session.elapsed - tide.dryingStartedAt) / Math.max(1, config.dryingMs));
  }
  return 1;
}

function drawWetIntertidalCell(ctx, row, col, now, settings, mode) {
  const rect = cellRect(row, col, 3);
  const shimmer = settings.reduceMotion ? 0.5 : 0.5 + Math.sin(now / 850 + row * 1.7 + col) * 0.5;
  ctx.save();
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
  gradient.addColorStop(0, "rgba(8, 145, 178, .055)");
  gradient.addColorStop(0.55, "rgba(45, 212, 191, .10)");
  gradient.addColorStop(1, "rgba(2, 44, 58, .13)");
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  ctx.strokeStyle = `rgba(103, 232, 249, ${0.32 + shimmer * 0.16})`;
  ctx.lineWidth = 1.25;
  ctx.setLineDash([7, 6]);
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);

  if (mode !== "low") {
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(165, 243, 252, ${0.035 + shimmer * 0.035})`;
    const puddles = mode === "high" ? 3 : 2;
    for (let index = 0; index < puddles; index += 1) {
      const px = rect.x + rect.width * (0.22 + ((index * 0.31 + row * 0.09) % 0.6));
      const py = rect.y + rect.height * (0.62 + ((index * 0.13 + col * 0.04) % 0.2));
      ctx.beginPath();
      ctx.ellipse(px, py, 10 + index * 3, 2.5 + index, -0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = "rgba(207, 250, 254, .62)";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("≈", rect.x + rect.width - 7, rect.y + 5);
  ctx.restore();
}

function drawDeepWaterCell(ctx, row, col, now, settings, mode) {
  const rect = cellRect(row, col);
  const drift = settings.reduceMotion ? 0 : Math.sin(now / 760 + row * 0.9 + col * 0.55) * 0.025;
  ctx.save();
  const water = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y);
  water.addColorStop(0, `rgba(2, 32, 47, ${0.64 + drift})`);
  water.addColorStop(0.45, `rgba(4, 71, 84, ${0.58 + drift})`);
  water.addColorStop(1, `rgba(1, 22, 38, ${0.72 + drift})`);
  ctx.fillStyle = water;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  const depth = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.height);
  depth.addColorStop(0, "rgba(34, 211, 238, .06)");
  depth.addColorStop(1, "rgba(1, 8, 22, .42)");
  ctx.fillStyle = depth;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  if (mode !== "low") {
    ctx.strokeStyle = mode === "high" ? "rgba(94, 234, 212, .14)" : "rgba(94, 234, 212, .08)";
    ctx.lineWidth = 1;
    const lines = mode === "high" ? 4 : 2;
    for (let index = 0; index < lines; index += 1) {
      const y = rect.y + 18 + index * (rect.height / lines);
      ctx.beginPath();
      for (let x = rect.x; x <= rect.x + rect.width; x += 12) {
        const wave = settings.reduceMotion ? 0 : Math.sin(x / 23 + now / 600 + index) * 2.5;
        if (x === rect.x) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFloodedIntertidalCell(ctx, session, row, col, now, settings, mode) {
  const rect = cellRect(row, col);
  const state = getTideCellState(session, row, col);
  let alpha = 1;
  if (session.tideCycle.state === "rising" && state.level === session.tideCycle.targetLevel) {
    alpha = transitionAlpha(session);
  }
  if (session.tideCycle.state === "receding" && state.level === session.tideCycle.currentLevel) {
    alpha = transitionAlpha(session);
  }
  const drift = settings.reduceMotion ? 0 : Math.sin(now / 620 + row * 0.7 + col) * 0.025;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0.12, 1);
  const water = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y);
  water.addColorStop(0, `rgba(45, 212, 191, ${0.20 + drift})`);
  water.addColorStop(0.5, `rgba(8, 145, 178, ${0.27 + drift})`);
  water.addColorStop(1, `rgba(3, 60, 77, ${0.42 + drift})`);
  ctx.fillStyle = water;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  const depth = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.height);
  depth.addColorStop(0, "rgba(165, 243, 252, .035)");
  depth.addColorStop(1, "rgba(1, 15, 29, .23)");
  ctx.fillStyle = depth;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  if (mode !== "low") {
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = mode === "high" ? "rgba(153, 246, 228, .15)" : "rgba(153, 246, 228, .09)";
    ctx.lineWidth = 1;
    const lineCount = mode === "high" ? 3 : 2;
    for (let index = 0; index < lineCount; index += 1) {
      const baseY = rect.y + 22 + index * 30;
      ctx.beginPath();
      for (let x = rect.x; x <= rect.x + rect.width; x += 12) {
        const wave = settings.reduceMotion ? 0 : Math.sin(x / 28 + now / 730 + index + row) * 3;
        if (x === rect.x) ctx.moveTo(x, baseY + wave);
        else ctx.lineTo(x, baseY + wave);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWarningCell(ctx, session, row, col, now, settings, advancing) {
  const rect = cellRect(row, col, 2);
  const pulse = settings.reduceMotion ? 0.28 : 0.18 + (Math.sin(now / 170 + row) + 1) * 0.10;
  ctx.save();
  const gradient = ctx.createLinearGradient(rect.x + rect.width, rect.y, rect.x, rect.y);
  if (advancing) {
    gradient.addColorStop(0, `rgba(34, 211, 238, ${pulse + 0.08})`);
    gradient.addColorStop(1, `rgba(14, 116, 144, ${pulse * 0.35})`);
  } else {
    gradient.addColorStop(0, `rgba(94, 234, 212, ${pulse * 0.25})`);
    gradient.addColorStop(1, `rgba(207, 250, 254, ${pulse})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = advancing ? "rgba(207, 250, 254, .9)" : "rgba(153, 246, 228, .78)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);

  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(236, 254, 255, .88)";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(advancing ? "← ≋" : "≋ →", rect.x + rect.width / 2, rect.y + 19);
  ctx.restore();
}

function drawDryingCell(ctx, session, row, col, now, settings) {
  const rect = cellRect(row, col, 2);
  const fade = transitionAlpha(session);
  const shimmer = settings.reduceMotion ? 0.5 : 0.5 + Math.sin(now / 360 + row + col) * 0.5;
  ctx.save();
  ctx.fillStyle = `rgba(103, 232, 249, ${0.05 + fade * 0.12})`;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = `rgba(165, 243, 252, ${0.25 + shimmer * 0.25})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 8]);
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
  ctx.restore();
}

function hasFloodedNeighbor(session, row, col) {
  return getTideCellState(session, row, col).flooded;
}

function drawCoastFoam(ctx, session, row, col, now, settings, mode) {
  const rect = cellRect(row, col);
  const neighbors = [
    { row, col: col - 1, side: "left" },
    { row, col: col + 1, side: "right" },
    { row: row - 1, col, side: "top" },
    { row: row + 1, col, side: "bottom" },
  ];
  ctx.save();
  ctx.strokeStyle = mode === "low" ? "rgba(207, 250, 254, .62)" : "rgba(236, 254, 255, .86)";
  ctx.shadowColor = "rgba(103, 232, 249, .7)";
  ctx.shadowBlur = mode === "high" ? 7 : 2;
  ctx.lineWidth = mode === "high" ? 2.4 : 1.6;
  for (const neighbor of neighbors) {
    if (neighbor.side === "right" && col === FIELD.enemyEntryCol) continue;
    const inside = neighbor.row >= 0 && neighbor.row < FIELD.rows
      && neighbor.col >= FIELD.firstTroopCol && neighbor.col <= FIELD.enemyEntryCol;
    if (inside && hasFloodedNeighbor(session, neighbor.row, neighbor.col)) continue;
    ctx.beginPath();
    const wave = settings.reduceMotion ? 0 : Math.sin(now / 190 + row * 1.3 + col) * 2;
    if (neighbor.side === "left") {
      ctx.moveTo(rect.x + wave, rect.y);
      ctx.lineTo(rect.x - wave, rect.y + rect.height);
    } else if (neighbor.side === "right") {
      ctx.moveTo(rect.x + rect.width + wave, rect.y);
      ctx.lineTo(rect.x + rect.width - wave, rect.y + rect.height);
    } else if (neighbor.side === "top") {
      ctx.moveTo(rect.x, rect.y + wave);
      ctx.lineTo(rect.x + rect.width, rect.y - wave);
    } else {
      ctx.moveTo(rect.x, rect.y + rect.height + wave);
      ctx.lineTo(rect.x + rect.width, rect.y + rect.height - wave);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTideUnderlay(ctx, session, now, settings = {}, adaptive = {}) {
  if (!tideEnabled(session)) return;
  const mode = qualityMode(settings, adaptive);

  // Deep water is always visible and never deployable.
  forEachTideCell((row, col) => {
    const state = getTideCellState(session, row, col);
    if (state.type === TIDE_CELL_TYPES.DEEP_WATER) {
      drawDeepWaterCell(ctx, row, col, now, settings, mode);
    }
  });

  // Dry intertidal cells communicate risk before the water arrives.
  forEachTideCell((row, col) => {
    const state = getTideCellState(session, row, col);
    if (state.type === TIDE_CELL_TYPES.INTERTIDAL && state.status === "dry") {
      drawWetIntertidalCell(ctx, row, col, now, settings, mode);
    }
  });

  forEachTideCell((row, col) => {
    const state = getTideCellState(session, row, col);
    if (state.type === TIDE_CELL_TYPES.INTERTIDAL && state.flooded) {
      drawFloodedIntertidalCell(ctx, session, row, col, now, settings, mode);
    }
  });

  forEachTideCell((row, col) => {
    const state = getTideCellState(session, row, col);
    if (state.status === "warningAdvance") drawWarningCell(ctx, session, row, col, now, settings, true);
    else if (state.status === "warningRetreat") drawWarningCell(ctx, session, row, col, now, settings, false);
    else if (state.status === "drying") drawDryingCell(ctx, session, row, col, now, settings);
  });
}

function drawSubmergedBand(ctx, session, row, col, mode) {
  const rect = cellRect(row, col);
  const surfaceY = rect.y + rect.height * 0.78;
  const band = ctx.createLinearGradient(0, surfaceY, 0, rect.y + rect.height);
  band.addColorStop(0, "rgba(34, 211, 238, .025)");
  band.addColorStop(1, mode === "low" ? "rgba(8, 145, 178, .17)" : "rgba(8, 145, 178, .27)");
  ctx.fillStyle = band;
  ctx.fillRect(rect.x, surfaceY, rect.width, rect.y + rect.height - surfaceY);
}

function drawBubbles(ctx, row, col, now, mode) {
  if (mode !== "high") return;
  const rect = cellRect(row, col);
  ctx.fillStyle = "rgba(165, 243, 252, .34)";
  for (let index = 0; index < 3; index += 1) {
    const cycle = (now / (980 + index * 83) + row * 0.17 + col * 0.11 + index * 0.31) % 1;
    const x = rect.x + 20 + ((col * 19 + row * 31 + index * 27) % Math.max(30, rect.width - 36));
    const y = rect.y + rect.height - cycle * rect.height;
    ctx.globalAlpha = clamp(1 - cycle) * 0.55;
    ctx.beginPath();
    ctx.arc(x, y, 1.3 + index * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSubmergedTroopMarkers(ctx, session, now, settings) {
  const submerged = new Set(session.tideCycle?.submergedTroopIds || []);
  if (!submerged.size) return;
  ctx.save();
  for (const troop of session.troops) {
    if (troop.dead || !submerged.has(troop.id)) continue;
    const pulse = settings.reduceMotion ? 1 : 0.85 + Math.sin(now / 170 + troop.row) * 0.15;
    ctx.strokeStyle = `rgba(103, 232, 249, ${0.55 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.ellipse(troop.x, troop.y + CELL.height * 0.34, 31, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(207, 250, 254, .84)";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SUBMERSA", troop.x, troop.y - 49);
  }
  ctx.restore();
}


function drawCellTooltip(ctx, session, hoveredCell) {
  if (!hoveredCell) return;
  const { row, col } = hoveredCell;
  const state = getTideCellState(session, row, col);
  if (state.type === TIDE_CELL_TYPES.FIRM_GROUND) return;
  const title = state.type === TIDE_CELL_TYPES.DEEP_WATER
    ? "ÁGUA PROFUNDA"
    : state.flooded
      ? "INTERMARÉ ALAGADA"
      : state.status === "drying"
        ? "INTERMARÉ SECANDO"
        : "ZONA INTERMARÉ";
  const detail = state.type === TIDE_CELL_TYPES.DEEP_WATER
    ? "Implantação impossível"
    : state.flooded
      ? "Novas tropas bloqueadas"
      : state.status === "drying"
        ? "Aguarde o solo estabilizar"
        : "Pode ser inundada pela próxima maré";
  const rect = cellRect(row, col);
  const width = 184;
  const height = 42;
  const x = clamp(rect.x + rect.width / 2 - width / 2, 4, FIELD.width - width - 4);
  const y = Math.max(4, rect.y + 5);
  ctx.save();
  ctx.fillStyle = "rgba(2, 11, 18, .90)";
  ctx.strokeStyle = state.flooded || state.type === TIDE_CELL_TYPES.DEEP_WATER
    ? "rgba(34, 211, 238, .82)"
    : "rgba(103, 232, 249, .62)";
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x + .5, y + .5, width - 1, height - 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#cffafe";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(title, x + width / 2, y + 13);
  ctx.fillStyle = "rgba(207, 250, 254, .76)";
  ctx.font = "10px sans-serif";
  ctx.fillText(detail, x + width / 2, y + 29);
  ctx.restore();
}

export function drawTideOverlay(ctx, session, now, settings = {}, adaptive = {}, hoveredCell = null) {
  if (!tideEnabled(session)) return;
  const mode = qualityMode(settings, adaptive);
  ctx.save();
  forEachTideCell((row, col) => {
    const state = getTideCellState(session, row, col);
    if (!state.flooded) return;
    drawSubmergedBand(ctx, session, row, col, mode);
    if (!settings.reduceMotion) drawBubbles(ctx, row, col, now, mode);
  });
  forEachTideCell((row, col) => {
    const state = getTideCellState(session, row, col);
    if (state.flooded) drawCoastFoam(ctx, session, row, col, now, settings, mode);
  });
  drawSubmergedTroopMarkers(ctx, session, now, settings);
  drawCellTooltip(ctx, session, hoveredCell);
  ctx.restore();
}
