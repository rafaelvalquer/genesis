import { CELL, FIELD } from "./visualGeometry.js";
import { getTideCellState, TIDE_CELL_TYPES } from "./tideCycle.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (start, end, progress) => start + (end - start) * progress;
const smoothstep = (value) => {
  const normalized = clamp(value);
  return normalized * normalized * (3 - 2 * normalized);
};

const DEFAULT_VISUAL = Object.freeze({
  mainWaveAmplitudePx: 7,
  secondaryWaveAmplitudePx: 2.6,
  slowSwellAmplitudePx: 3.2,
  mainWaveFrequency: 0.028,
  secondaryWaveFrequency: 0.071,
  slowSwellFrequency: 0.012,
  stableWaveSpeed: 2.1,
  secondaryWaveSpeed: 3.3,
  slowSwellSpeed: 0.65,
  breathingAmplitudePx: 1.8,
  breathingSpeed: 0.18,
  risingAmplitudeFactor: 1.65,
  recedingAmplitudeFactor: 0.78,
  foamWidthPx: 3,
  secondaryFoamOffsetPx: 9,
  wetTrailDurationMs: 1400,
  currentLineCount: 4,
  splashIntensity: 0.72,
});

function tideEnabled(session) {
  return session?.phase?.environmentHazard?.id === "tide_cycle";
}

function qualityMode(settings = {}, adaptive = {}) {
  if (adaptive.level === "stress" || settings.quality === "low") return "low";
  if (adaptive.level === "busy" || settings.quality === "medium") return "medium";
  return "high";
}

function qualityProfile(mode) {
  if (mode === "low") {
    return {
      sampleStep: 18,
      currentLines: 1,
      caustics: 0,
      bubbles: 0,
      enemyWakes: 0,
      intertidalDetails: 1,
    };
  }
  if (mode === "medium") {
    return {
      sampleStep: 10,
      currentLines: 3,
      caustics: 5,
      bubbles: 10,
      enemyWakes: 10,
      intertidalDetails: 2,
    };
  }
  return {
    sampleStep: 6,
    currentLines: 5,
    caustics: 12,
    bubbles: 24,
    enemyWakes: 18,
    intertidalDetails: 3,
  };
}

function visualConfig(session) {
  const missionIndex = clamp(Number(session?.phase?.chapterIndex) || 0, 0, 7);
  const missionProgression = {
    mainWaveAmplitudePx: DEFAULT_VISUAL.mainWaveAmplitudePx + missionIndex * 0.42,
    secondaryWaveAmplitudePx: DEFAULT_VISUAL.secondaryWaveAmplitudePx + missionIndex * 0.14,
    slowSwellAmplitudePx: DEFAULT_VISUAL.slowSwellAmplitudePx + missionIndex * 0.10,
    stableWaveSpeed: DEFAULT_VISUAL.stableWaveSpeed + missionIndex * 0.055,
    foamWidthPx: DEFAULT_VISUAL.foamWidthPx + missionIndex * 0.10,
    currentLineCount: DEFAULT_VISUAL.currentLineCount + Math.floor(missionIndex / 2),
    splashIntensity: DEFAULT_VISUAL.splashIntensity + missionIndex * 0.035,
  };
  return {
    ...DEFAULT_VISUAL,
    ...missionProgression,
    ...(session?.phase?.environmentHazard?.visual || {}),
  };
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
    for (let col = FIELD.firstTroopCol; col <= FIELD.enemyEntryCol; col += 1) {
      callback(row, col);
    }
  }
}

function transitionProgress(session) {
  const config = session.phase.environmentHazard;
  const tide = session.tideCycle;
  if (tide.state === "rising") {
    return smoothstep(
      (session.elapsed - tide.transitionStartedAt) / Math.max(1, config.risingMs),
    );
  }
  if (tide.state === "receding") {
    return smoothstep(
      (session.elapsed - tide.transitionStartedAt) / Math.max(1, config.recedingMs),
    );
  }
  if (tide.state === "drying") {
    return smoothstep(
      (session.elapsed - tide.dryingStartedAt) / Math.max(1, config.dryingMs),
    );
  }
  return 1;
}

function cellsFloodedAtLevel(config, row, level) {
  const columns = [FIELD.enemyEntryCol];
  for (const [cellRow, col] of config.permanentWaterCells || []) {
    if (cellRow === row) columns.push(col);
  }
  for (const band of config.intertidalBands || []) {
    if (Number(band.level) > Number(level)) continue;
    for (const [cellRow, col] of band.cells || []) {
      if (cellRow === row) columns.push(col);
    }
  }
  return columns;
}

function boundaryColumnForRow(session, row, level) {
  const config = session.phase.environmentHazard;
  const columns = cellsFloodedAtLevel(config, row, level);
  return Math.min(...columns);
}

export function getTideVisualBoundaryX(session, row, now = session?.elapsed || 0) {
  if (!tideEnabled(session)) return FIELD.width;
  const tide = session.tideCycle;
  const safeRow = clamp(Math.floor(row), 0, FIELD.rows - 1);
  const currentColumn = boundaryColumnForRow(session, safeRow, tide.currentLevel);
  if (tide.state !== "rising" && tide.state !== "receding") {
    return currentColumn * CELL.width;
  }

  const targetColumn = boundaryColumnForRow(session, safeRow, tide.targetLevel);
  const config = session.phase.environmentHazard;
  const duration = tide.state === "rising" ? config.risingMs : config.recedingMs;
  const progress = smoothstep(
    (now - tide.transitionStartedAt) / Math.max(1, duration),
  );
  return lerp(currentColumn * CELL.width, targetColumn * CELL.width, progress);
}

function interpolateRowBoundaries(y, boundaryForRow) {
  const rowPosition = clamp(y / CELL.height - 0.5, 0, FIELD.rows - 1);
  const rowA = Math.floor(rowPosition);
  const rowB = Math.min(FIELD.rows - 1, rowA + 1);
  const local = smoothstep(rowPosition - rowA);
  return lerp(boundaryForRow(rowA), boundaryForRow(rowB), local);
}

function baseWaterlineAtY(session, y, now) {
  return interpolateRowBoundaries(
    y,
    (row) => getTideVisualBoundaryX(session, row, now),
  );
}

function baseWaterlineAtLevel(session, y, level) {
  return interpolateRowBoundaries(
    y,
    (row) => boundaryColumnForRow(session, row, level) * CELL.width,
  );
}

function waveStateFactors(session) {
  const state = session.tideCycle?.state;
  if (state === "rising") return { amplitude: 1.65, speed: 1.45, foam: 1.45 };
  if (state === "warningAdvance") return { amplitude: 1.18, speed: 1.18, foam: 1.15 };
  if (state === "receding") return { amplitude: 0.78, speed: 0.82, foam: 0.72 };
  if (state === "warningRetreat") return { amplitude: 0.88, speed: 0.9, foam: 0.85 };
  return { amplitude: 1, speed: 1, foam: 1 };
}

function waveOffsetAtY(session, y, now, settings, offsetX = 0) {
  const config = visualConfig(session);
  const state = waveStateFactors(session);
  if (settings.reduceMotion) {
    return Math.sin(y * config.mainWaveFrequency) * 1.5 + offsetX;
  }

  const time = now * 0.001;
  const amplitude = state.amplitude;
  const mainWave = Math.sin(
    y * config.mainWaveFrequency + time * config.stableWaveSpeed * state.speed,
  ) * config.mainWaveAmplitudePx * amplitude;
  const secondaryWave = Math.sin(
    y * config.secondaryWaveFrequency - time * config.secondaryWaveSpeed * state.speed,
  ) * config.secondaryWaveAmplitudePx * amplitude;
  const slowSwell = Math.sin(
    y * config.slowSwellFrequency + time * config.slowSwellSpeed,
  ) * config.slowSwellAmplitudePx * Math.min(1.25, amplitude);
  const breathing = Math.sin(time * config.breathingSpeed)
    * config.breathingAmplitudePx;
  return mainWave + secondaryWave + slowSwell + breathing + offsetX;
}

export function getTideVisualWaterlineX(
  session,
  y,
  now = session?.elapsed || 0,
  settings = {},
  offsetX = 0,
) {
  return baseWaterlineAtY(session, y, now)
    + waveOffsetAtY(session, y, now, settings, offsetX);
}

function getTideVisualWaterlineXAtLevel(session, y, level, now, settings, offsetX = 0) {
  return baseWaterlineAtLevel(session, y, level)
    + waveOffsetAtY(session, y, now, settings, offsetX);
}

function traceCoastline(ctx, session, now, settings, profile, offsetX = 0, levelOverride = null) {
  ctx.beginPath();
  for (let y = 0; y <= FIELD.height; y += profile.sampleStep) {
    const x = levelOverride == null
      ? getTideVisualWaterlineX(session, y, now, settings, offsetX)
      : getTideVisualWaterlineXAtLevel(session, y, levelOverride, now, settings, offsetX);
    if (y === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if (FIELD.height % profile.sampleStep !== 0) {
    const x = levelOverride == null
      ? getTideVisualWaterlineX(session, FIELD.height, now, settings, offsetX)
      : getTideVisualWaterlineXAtLevel(
        session,
        FIELD.height,
        levelOverride,
        now,
        settings,
        offsetX,
      );
    ctx.lineTo(x, FIELD.height);
  }
}

function traceWaterBody(ctx, session, now, settings, profile) {
  ctx.beginPath();
  ctx.moveTo(FIELD.width, 0);
  ctx.lineTo(getTideVisualWaterlineX(session, 0, now, settings), 0);
  for (let y = profile.sampleStep; y <= FIELD.height; y += profile.sampleStep) {
    ctx.lineTo(getTideVisualWaterlineX(session, y, now, settings), y);
  }
  if (FIELD.height % profile.sampleStep !== 0) {
    ctx.lineTo(getTideVisualWaterlineX(session, FIELD.height, now, settings), FIELD.height);
  }
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.closePath();
}

function minimumVisualBoundaryX(session, now) {
  let minimum = FIELD.width;
  for (let row = 0; row < FIELD.rows; row += 1) {
    minimum = Math.min(minimum, getTideVisualBoundaryX(session, row, now));
  }
  return minimum;
}

function drawContinuousWaterBody(ctx, session, now, settings, mode, profile) {
  const boundaryX = minimumVisualBoundaryX(session, now);
  const state = waveStateFactors(session);
  const gradient = ctx.createLinearGradient(boundaryX, 0, FIELD.width, 0);
  gradient.addColorStop(0, "rgba(8, 145, 178, .36)");
  gradient.addColorStop(0.22, "rgba(6, 102, 119, .48)");
  gradient.addColorStop(0.58, "rgba(3, 57, 73, .66)");
  gradient.addColorStop(1, "rgba(1, 16, 31, .82)");

  ctx.save();
  traceWaterBody(ctx, session, now, settings, profile);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.clip();

  const depth = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  depth.addColorStop(0, "rgba(103, 232, 249, .055)");
  depth.addColorStop(0.48, "rgba(14, 116, 144, .025)");
  depth.addColorStop(1, "rgba(1, 7, 20, .42)");
  ctx.fillStyle = depth;
  ctx.fillRect(boundaryX - 20, 0, FIELD.width - boundaryX + 20, FIELD.height);

  drawInternalCurrents(ctx, session, now, settings, mode, profile, boundaryX, state);
  drawCaustics(ctx, session, now, settings, profile, boundaryX);
  drawOpenWaterBubbles(ctx, session, now, settings, profile, boundaryX);
  ctx.restore();
}

function drawInternalCurrents(ctx, session, now, settings, mode, profile, boundaryX, state) {
  const config = visualConfig(session);
  const count = Math.min(profile.currentLines, config.currentLineCount + (mode === "high" ? 1 : 0));
  if (count <= 0) return;
  const time = settings.reduceMotion ? 0 : now * 0.001;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = mode === "low"
    ? "rgba(94, 234, 212, .075)"
    : "rgba(153, 246, 228, .12)";
  ctx.lineWidth = mode === "high" ? 1.3 : 1;
  for (let index = 0; index < count; index += 1) {
    const baseY = (index + 0.7) * FIELD.height / count;
    ctx.beginPath();
    for (let x = Math.max(0, boundaryX - 20); x <= FIELD.width + 16; x += mode === "high" ? 14 : 22) {
      const wave = Math.sin(x * 0.019 + time * (0.72 + index * 0.11) + index * 1.9) * (3.5 + index * 0.6);
      const drift = Math.sin(x * 0.006 - time * 0.28) * 2.5 * state.speed;
      if (x === Math.max(0, boundaryX - 20)) ctx.moveTo(x, baseY + wave + drift);
      else ctx.lineTo(x, baseY + wave + drift);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCaustics(ctx, session, now, settings, profile, boundaryX) {
  if (profile.caustics <= 0) return;
  const time = settings.reduceMotion ? 0 : now * 0.00045;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < profile.caustics; index += 1) {
    const seed = index * 2.417;
    const travel = (time * (0.12 + (index % 3) * 0.035) + seed) % 1;
    const x = lerp(boundaryX + 28, FIELD.width + 30, travel);
    const y = ((index * 83 + Math.sin(time + seed) * 37) % FIELD.height + FIELD.height) % FIELD.height;
    ctx.strokeStyle = `rgba(165, 243, 252, ${0.025 + (index % 3) * 0.012})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 22 + (index % 4) * 6, 5 + (index % 2) * 2, -0.18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOpenWaterBubbles(ctx, session, now, settings, profile, boundaryX) {
  if (profile.bubbles <= 0 || settings.reduceMotion) return;
  ctx.save();
  ctx.fillStyle = "rgba(165, 243, 252, .28)";
  for (let index = 0; index < profile.bubbles; index += 1) {
    const duration = 1700 + (index % 7) * 170;
    const cycle = (now / duration + index * 0.137) % 1;
    const span = Math.max(40, FIELD.width - boundaryX - 30);
    const x = boundaryX + 24 + ((index * 73) % span) + Math.sin(cycle * Math.PI * 2 + index) * 4;
    const y = FIELD.height + 12 - cycle * (FIELD.height + 30);
    ctx.globalAlpha = Math.sin(cycle * Math.PI) * 0.42;
    ctx.beginPath();
    ctx.arc(x, y, 1.1 + (index % 3) * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWetIntertidalCell(ctx, row, col, now, settings, profile) {
  const rect = cellRect(row, col, 5);
  const time = settings.reduceMotion ? 0 : now * 0.001;
  const shimmer = 0.5 + Math.sin(time * 1.15 + row * 1.7 + col) * 0.5;
  ctx.save();

  const wet = ctx.createRadialGradient(
    rect.x + rect.width * 0.72,
    rect.y + rect.height * 0.55,
    2,
    rect.x + rect.width * 0.62,
    rect.y + rect.height * 0.56,
    rect.width * 0.72,
  );
  wet.addColorStop(0, `rgba(45, 212, 191, ${0.105 + shimmer * 0.025})`);
  wet.addColorStop(0.55, "rgba(8, 145, 178, .055)");
  wet.addColorStop(1, "rgba(2, 44, 58, 0)");
  ctx.fillStyle = wet;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  ctx.strokeStyle = `rgba(103, 232, 249, ${0.19 + shimmer * 0.11})`;
  ctx.lineWidth = 1.1;
  const detailCount = profile.intertidalDetails;
  for (let index = 0; index < detailCount; index += 1) {
    const py = rect.y + rect.height * (0.62 + index * 0.10);
    const px = rect.x + rect.width * (0.38 + ((row * 0.17 + col * 0.09 + index * 0.23) % 0.38));
    ctx.beginPath();
    ctx.ellipse(px, py, 13 + index * 4, 3 + index * 0.6, -0.1, 0.12 * Math.PI, 1.9 * Math.PI);
    ctx.stroke();
  }

  // Apenas pequenos cantos indicam risco; não há mais um retângulo completo por tile.
  ctx.strokeStyle = `rgba(103, 232, 249, ${0.25 + shimmer * 0.12})`;
  ctx.lineWidth = 1.4;
  const corner = 12;
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.width - corner, rect.y + 1);
  ctx.lineTo(rect.x + rect.width - 1, rect.y + 1);
  ctx.lineTo(rect.x + rect.width - 1, rect.y + corner);
  ctx.stroke();
  ctx.restore();
}

function drawWarningCells(ctx, session, now, settings, advancing) {
  const cells = session.tideCycle?.warningCells || [];
  if (!cells.length) return;
  const pulse = settings.reduceMotion ? 0.45 : 0.42 + Math.sin(now / 165) * 0.16;
  ctx.save();
  for (const [row, col] of cells) {
    const rect = cellRect(row, col, 5);
    const glow = ctx.createRadialGradient(
      rect.x + rect.width * 0.72,
      rect.y + rect.height * 0.52,
      4,
      rect.x + rect.width * 0.58,
      rect.y + rect.height * 0.52,
      rect.width * 0.72,
    );
    glow.addColorStop(0, advancing
      ? `rgba(34, 211, 238, ${0.18 + pulse * 0.20})`
      : `rgba(94, 234, 212, ${0.12 + pulse * 0.14})`);
    glow.addColorStop(1, "rgba(14, 116, 144, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    ctx.strokeStyle = advancing
      ? `rgba(207, 250, 254, ${0.55 + pulse * 0.25})`
      : `rgba(153, 246, 228, ${0.48 + pulse * 0.20})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const edgeX = advancing ? rect.x + rect.width - 6 : rect.x + 8;
    for (let y = rect.y + 8; y <= rect.y + rect.height - 8; y += 8) {
      const x = edgeX + Math.sin(y * 0.11 + now / 170 + row) * 3;
      if (y === rect.y + 8) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawTargetCoastline(ctx, session, now, settings, profile, advancing) {
  const tide = session.tideCycle;
  if (!tide || !["warningAdvance", "warningRetreat"].includes(tide.state)) return;
  ctx.save();
  ctx.strokeStyle = advancing ? "rgba(207, 250, 254, .72)" : "rgba(153, 246, 228, .58)";
  ctx.lineWidth = 1.6;
  ctx.setLineDash([9, 8]);
  traceCoastline(ctx, session, now, settings, profile, 0, tide.targetLevel);
  ctx.stroke();
  ctx.restore();
}

function drawDryingCells(ctx, session, now, settings, profile) {
  const cells = session.tideCycle?.dryingCells || [];
  if (!cells.length) return;
  const fade = 1 - transitionProgress(session);
  ctx.save();
  for (const [row, col] of cells) {
    const rect = cellRect(row, col, 4);
    const wet = ctx.createRadialGradient(
      rect.x + rect.width * 0.62,
      rect.y + rect.height * 0.62,
      2,
      rect.x + rect.width * 0.58,
      rect.y + rect.height * 0.60,
      rect.width * 0.70,
    );
    wet.addColorStop(0, `rgba(103, 232, 249, ${0.12 * fade})`);
    wet.addColorStop(0.48, `rgba(8, 145, 178, ${0.08 * fade})`);
    wet.addColorStop(1, "rgba(2, 44, 58, 0)");
    ctx.fillStyle = wet;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    if (profile.intertidalDetails > 1) {
      ctx.strokeStyle = `rgba(165, 243, 252, ${0.24 * fade})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(rect.x + rect.width * 0.67, rect.y + rect.height * 0.72, 18, 4, -0.12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCoastFoam(ctx, session, now, settings, mode, profile) {
  const config = visualConfig(session);
  const state = waveStateFactors(session);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(103, 232, 249, .72)";
  ctx.shadowBlur = mode === "high" ? 8 : mode === "medium" ? 4 : 1;

  ctx.strokeStyle = mode === "low" ? "rgba(207, 250, 254, .62)" : "rgba(236, 254, 255, .88)";
  ctx.lineWidth = Math.max(1.4, config.foamWidthPx * state.foam);
  traceCoastline(ctx, session, now, settings, profile, 0);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = mode === "low" ? "rgba(103, 232, 249, .15)" : "rgba(153, 246, 228, .29)";
  ctx.lineWidth = Math.max(0.8, config.foamWidthPx * 0.42 * state.foam);
  traceCoastline(ctx, session, now + 90, settings, profile, config.secondaryFoamOffsetPx);
  ctx.stroke();

  if (session.tideCycle?.state === "rising" && mode === "high") {
    ctx.strokeStyle = "rgba(207, 250, 254, .16)";
    ctx.lineWidth = 1.1;
    traceCoastline(ctx, session, now + 180, settings, profile, config.secondaryFoamOffsetPx * 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSubmergedTroopEffects(ctx, session, now, settings, mode) {
  const submerged = new Set(session.tideCycle?.submergedTroopIds || []);
  if (!submerged.size) return;
  ctx.save();
  for (const troop of session.troops) {
    if (troop.dead || !submerged.has(troop.id)) continue;
    const pulse = settings.reduceMotion ? 1 : 0.84 + Math.sin(now / 190 + troop.row) * 0.16;
    const waterY = troop.y + CELL.height * 0.35;
    ctx.strokeStyle = `rgba(165, 243, 252, ${0.38 * pulse})`;
    ctx.lineWidth = mode === "low" ? 1.2 : 1.7;
    ctx.beginPath();
    ctx.ellipse(troop.x, waterY, 28 + pulse * 5, 7 + pulse * 1.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (mode !== "low") {
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.20 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(troop.x + 3, waterY, 39 + pulse * 7, 10 + pulse * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ícone compacto substitui o texto permanente “SUBMERSA”.
    ctx.fillStyle = "rgba(2, 20, 31, .78)";
    ctx.strokeStyle = "rgba(103, 232, 249, .70)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(troop.x + 31, troop.y - 43, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(207, 250, 254, .90)";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("≈", troop.x + 31, troop.y - 44);
  }
  ctx.restore();
}

function drawEnemyWakes(ctx, session, now, settings, profile) {
  if (profile.enemyWakes <= 0 || settings.reduceMotion) return;
  let drawn = 0;
  ctx.save();
  ctx.lineCap = "round";
  for (const enemy of session.enemies || []) {
    if (drawn >= profile.enemyWakes) break;
    if (enemy.dead || enemy.hp <= 0 || enemy.moving === false) continue;
    const col = clamp(Math.floor(Number(enemy.x || 0) / CELL.width), 0, FIELD.enemyEntryCol);
    if (!getTideCellState(session, enemy.row, col).flooded) continue;
    const phase = now / 150 + drawn * 0.83;
    const length = 18 + Math.sin(phase) * 3;
    const spread = 5 + Math.cos(phase * 0.7) * 1.5;
    const y = enemy.y + CELL.height * 0.37;
    ctx.strokeStyle = "rgba(165, 243, 252, .22)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(enemy.x + 8, y);
    ctx.quadraticCurveTo(enemy.x + length * 0.55, y - spread * 0.45, enemy.x + length, y - spread);
    ctx.moveTo(enemy.x + 8, y);
    ctx.quadraticCurveTo(enemy.x + length * 0.55, y + spread * 0.45, enemy.x + length, y + spread);
    ctx.stroke();
    drawn += 1;
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
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
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

export function drawTideUnderlay(ctx, session, now, settings = {}, adaptive = {}) {
  if (!tideEnabled(session)) return;
  const mode = qualityMode(settings, adaptive);
  const profile = qualityProfile(mode);

  // A zona intermaré seca continua legível, mas sem moldura quadrada completa.
  forEachTideCell((row, col) => {
    const state = getTideCellState(session, row, col);
    if (state.type === TIDE_CELL_TYPES.INTERTIDAL && state.status === "dry") {
      drawWetIntertidalCell(ctx, row, col, now, settings, profile);
    }
  });

  // Toda água profunda e intermaré alagada formam uma única massa contínua.
  drawContinuousWaterBody(ctx, session, now, settings, mode, profile);

  const state = session.tideCycle?.state;
  if (state === "warningAdvance" || state === "warningRetreat") {
    drawWarningCells(ctx, session, now, settings, state === "warningAdvance");
    drawTargetCoastline(ctx, session, now, settings, profile, state === "warningAdvance");
  }
  if (state === "drying") drawDryingCells(ctx, session, now, settings, profile);
}

export function drawTideOverlay(ctx, session, now, settings = {}, adaptive = {}, hoveredCell = null) {
  if (!tideEnabled(session)) return;
  const mode = qualityMode(settings, adaptive);
  const profile = qualityProfile(mode);
  ctx.save();
  drawCoastFoam(ctx, session, now, settings, mode, profile);
  drawEnemyWakes(ctx, session, now, settings, profile);
  drawSubmergedTroopEffects(ctx, session, now, settings, mode);
  drawCellTooltip(ctx, session, hoveredCell);
  ctx.restore();
}
