import { canPlaceTroop, CELL, FIELD } from "./battleModel.js";
import { TROOPS } from "./content.js";

export const QUALITY_PROFILES = {
  low: { parallax: 0, particles: 0.25, atmosphere: 0.38, shadows: 0.55, detail: 0.42 },
  medium: { parallax: 0.4, particles: 0.58, atmosphere: 0.68, shadows: 0.8, detail: 0.7 },
  high: { parallax: 1, particles: 1, atmosphere: 1, shadows: 1, detail: 1 },
};

const staticBattlefieldCache = new Map();
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function pseudo(index, seed = 1) {
  return seeded(seed * 997 + index * 131)();
}

function rgba(hex, alpha) {
  const clean = String(hex || "#ffffff").replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean, 16);
  return `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${alpha})`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function getQualityProfile(settings = {}) {
  return QUALITY_PROFILES[settings.quality] || QUALITY_PROFILES.high;
}

export function getArenaIntensity(phase, waveIndex = 0) {
  const values = phase.waveIntensity || [0.3, 0.55, 0.78, 1];
  return clamp(values[Math.min(values.length - 1, Math.max(0, waveIndex))] ?? 1);
}

export function getBattlefieldBlueprint(phase) {
  const theme = phase.battlefieldTheme || {
    id: "fallback", seed: 1, material: "metal", base: "bunker", entrance: "fortified",
    lane: "#173447", laneAlt: "#1d4052", edge: phase.palette?.primary || "#22d3ee", detail: phase.palette?.accent || "#f59e0b",
  };
  const lanes = Array.from({ length: FIELD.rows }, (_, row) => ({
    row,
    top: row * CELL.height + 9,
    bottom: (row + 1) * CELL.height - 9,
    center: row * CELL.height + CELL.height / 2,
    footline: row * CELL.height + CELL.height * 0.85,
  }));
  const random = seeded(theme.seed);
  const features = Array.from({ length: 48 }, (_, index) => ({
    index,
    row: index % FIELD.rows,
    x: FIELD.combatOffsetX + 82 + random() * 830,
    offset: random(),
    size: 0.55 + random() * 0.9,
    flip: random() > 0.5,
  }));
  return { arenaId: phase.arenaId, theme: { ...theme }, lanes, features };
}

export function getBattlefieldCacheKey(phase, settings = {}) {
  const profile = settings.quality && QUALITY_PROFILES[settings.quality] ? settings.quality : "high";
  return `${phase.arenaId}:${phase.battlefieldTheme?.seed || 1}:${profile}`;
}

export function clearBattlefieldCache() {
  staticBattlefieldCache.clear();
}

function createCacheCanvas() {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(FIELD.width, FIELD.height);
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  return canvas;
}

function drawBackdrop(ctx, phase, blueprint) {
  const { theme } = blueprint;
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, phase.palette?.shadow || "#030712");
  gradient.addColorStop(0.48, rgba(theme.lane, 0.96));
  gradient.addColorStop(1, phase.palette?.shadow || "#030712");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  ctx.fillStyle = rgba(theme.detail, 0.08);
  for (let index = 0; index < 9; index += 1) {
    const x = 70 + index * 120 + pseudo(index, theme.seed) * 45;
    const height = 36 + pseudo(index, theme.seed + 8) * 70;
    ctx.beginPath();
    ctx.moveTo(x - 55, 0);
    ctx.lineTo(x, height);
    ctx.lineTo(x + 62, 0);
    ctx.closePath();
    ctx.fill();
  }

  const horizon = ctx.createLinearGradient(0, 0, FIELD.width, 0);
  horizon.addColorStop(0, rgba(phase.palette?.primary, 0.16));
  horizon.addColorStop(0.18, "transparent");
  horizon.addColorStop(0.78, "transparent");
  horizon.addColorStop(1, rgba(phase.palette?.accent, 0.15));
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  if (theme.material === "obsidian-glass") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let index = 0; index < 18; index += 1) {
      const x = pseudo(index, theme.seed + 610) * FIELD.width;
      const y = pseudo(index, theme.seed + 620) * FIELD.height;
      const radius = 28 + pseudo(index, theme.seed + 630) * 74;
      ctx.fillStyle = rgba(index % 2 ? theme.edge : theme.detail, 0.018 + pseudo(index, 640) * 0.035);
      ctx.beginPath();
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x + radius * .8, y - radius * .12);
      ctx.lineTo(x + radius * .25, y + radius * .72);
      ctx.lineTo(x - radius * .65, y + radius * .36);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function lanePath(ctx, lane) {
  ctx.beginPath();
  ctx.moveTo(FIELD.baseX + 26, lane.top + 3);
  ctx.lineTo(FIELD.width - 38, lane.top - 2);
  ctx.lineTo(FIELD.width - 28, lane.bottom - 2);
  ctx.lineTo(FIELD.baseX + 34, lane.bottom + 3);
  ctx.closePath();
}

function drawMetalDetail(ctx, feature, lane, theme, profile, wet = false) {
  const width = 65 + feature.size * 48;
  const x = feature.x - width / 2;
  const y = lane.top + 10 + feature.offset * 48;
  ctx.strokeStyle = rgba(theme.edge, wet ? 0.18 : 0.12);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, 34 + feature.size * 12);
  ctx.fillStyle = rgba(theme.detail, 0.25);
  ctx.beginPath();
  ctx.arc(x + 7, y + 7, 1.8, 0, Math.PI * 2);
  ctx.arc(x + width - 7, y + 7, 1.8, 0, Math.PI * 2);
  ctx.fill();
  if (wet && profile.detail > 0.5) {
    ctx.fillStyle = rgba(theme.edge, 0.09);
    ctx.beginPath();
    ctx.ellipse(feature.x, lane.footline - 5, width * 0.42, 5 + feature.size * 3, -0.04, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEarthDetail(ctx, feature, lane, theme) {
  const y = lane.top + 16 + feature.offset * 62;
  ctx.strokeStyle = rgba(theme.detail, 0.2);
  ctx.lineWidth = 2.5 * feature.size;
  ctx.beginPath();
  ctx.moveTo(feature.x - 34 * feature.size, y + (feature.flip ? 8 : 0));
  ctx.bezierCurveTo(feature.x - 10, y - 10, feature.x + 14, y + 17, feature.x + 38 * feature.size, y - 4);
  ctx.stroke();
  ctx.fillStyle = rgba(theme.edge, 0.16);
  ctx.beginPath();
  ctx.arc(feature.x + 8, y - 3, 3.5 * feature.size, 0, Math.PI * 2);
  ctx.fill();
}

function drawRockDetail(ctx, feature, lane, theme) {
  const y = lane.top + 20 + feature.offset * 54;
  ctx.strokeStyle = rgba(theme.detail, 0.24);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(feature.x - 20, y - 8);
  ctx.lineTo(feature.x - 5, y + 2);
  ctx.lineTo(feature.x + 8, y - 7);
  ctx.lineTo(feature.x + 25, y + 8);
  ctx.stroke();
  ctx.fillStyle = "rgba(1,4,9,.2)";
  ctx.beginPath();
  ctx.ellipse(feature.x - 24, y + 12, 9 * feature.size, 4 * feature.size, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawOrganicDetail(ctx, feature, lane, theme, chitin = false) {
  const y = lane.top + 15 + feature.offset * 62;
  ctx.strokeStyle = rgba(theme.detail, chitin ? 0.19 : 0.28);
  ctx.lineWidth = chitin ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(feature.x - 32 * feature.size, y);
  ctx.bezierCurveTo(feature.x - 12, y - 18, feature.x + 12, y + 18, feature.x + 34 * feature.size, y);
  ctx.stroke();
  if (!chitin) {
    ctx.fillStyle = rgba(theme.detail, 0.1);
    ctx.beginPath();
    ctx.ellipse(feature.x, y, 15 * feature.size, 7 * feature.size, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAncientDetail(ctx, feature, lane, theme) {
  const y = lane.top + 18 + feature.offset * 52;
  ctx.strokeStyle = rgba(theme.detail, 0.26);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(feature.x, y, 9 * feature.size, 0, Math.PI * 2);
  ctx.moveTo(feature.x - 13 * feature.size, y);
  ctx.lineTo(feature.x + 13 * feature.size, y);
  ctx.moveTo(feature.x, y - 13 * feature.size);
  ctx.lineTo(feature.x, y + 13 * feature.size);
  ctx.stroke();
}

function drawGlassDetail(ctx, feature, lane, theme) {
  const y = lane.top + 18 + feature.offset * 52;
  const radius = (13 + feature.size * 8);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = rgba(feature.flip ? theme.edge : theme.detail, 0.08);
  ctx.strokeStyle = rgba(theme.edge, 0.26);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(feature.x, y - radius);
  ctx.lineTo(feature.x + radius * .7, y + radius * .15);
  ctx.lineTo(feature.x + radius * .18, y + radius);
  ctx.lineTo(feature.x - radius * .58, y + radius * .3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawLanes(ctx, blueprint, profile) {
  const { theme } = blueprint;
  for (const lane of blueprint.lanes) {
    ctx.save();
    lanePath(ctx, lane);
    const floor = ctx.createLinearGradient(0, lane.top, 0, lane.bottom);
    floor.addColorStop(0, lane.row % 2 ? theme.laneAlt : theme.lane);
    floor.addColorStop(0.58, lane.row % 2 ? theme.lane : theme.laneAlt);
    floor.addColorStop(1, "#071019");
    ctx.fillStyle = floor;
    ctx.fill();
    ctx.strokeStyle = "rgba(1,4,9,.88)";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.clip();

    const details = Math.max(3, Math.round(9 * profile.detail));
    const laneFeatures = blueprint.features.filter((feature) => feature.row === lane.row).slice(0, details);
    for (const feature of laneFeatures) {
      if (["metal", "station", "wet-metal"].includes(theme.material)) drawMetalDetail(ctx, feature, lane, theme, profile, theme.material === "wet-metal");
      else if (theme.material === "earth") drawEarthDetail(ctx, feature, lane, theme);
      else if (theme.material === "rock") drawRockDetail(ctx, feature, lane, theme);
      else if (["chitin", "organic"].includes(theme.material)) drawOrganicDetail(ctx, feature, lane, theme, theme.material === "chitin");
      else if (theme.material === "obsidian-glass") drawGlassDetail(ctx, feature, lane, theme);
      else drawAncientDetail(ctx, feature, lane, theme);
    }

    const sheen = ctx.createLinearGradient(0, lane.top, 0, lane.bottom);
    sheen.addColorStop(0, rgba(theme.edge, 0.12));
    sheen.addColorStop(0.2, "transparent");
    sheen.addColorStop(0.86, "transparent");
    sheen.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, lane.top, FIELD.width, lane.bottom - lane.top);
    ctx.restore();

    ctx.strokeStyle = rgba(theme.edge, 0.23);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(FIELD.baseX + 31, lane.top + 2);
    ctx.lineTo(FIELD.width - 39, lane.top - 2);
    ctx.stroke();
  }
}

function drawBase(ctx, blueprint) {
  const { theme } = blueprint;
  ctx.save();
  const baseGradient = ctx.createLinearGradient(0, 0, FIELD.baseX + 4, 0);
  baseGradient.addColorStop(0, "#02060b");
  baseGradient.addColorStop(0.7, rgba(theme.laneAlt, 0.98));
  baseGradient.addColorStop(1, rgba(theme.edge, 0.18));
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, FIELD.baseX, FIELD.height);
  ctx.strokeStyle = rgba(theme.edge, 0.72);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(FIELD.baseX, 0);
  ctx.lineTo(FIELD.baseX, FIELD.height);
  ctx.stroke();

  for (const lane of blueprint.lanes) {
    const y = lane.top + 17;
    roundedRect(ctx, 7, y, 51, 66, theme.material === "organic" || theme.material === "chitin" ? 24 : 7);
    ctx.fillStyle = "rgba(2,8,15,.84)";
    ctx.fill();
    ctx.strokeStyle = rgba(theme.edge, 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = rgba(theme.edge, 0.7);
    ctx.fillRect(52, y + 12, 4, 42);
    if (!["organic", "chitin", "earth"].includes(theme.material)) {
      ctx.fillStyle = rgba(theme.detail, 0.7);
      ctx.fillRect(13, y + 8, 18, 4);
    }
    ctx.strokeStyle = rgba(theme.edge, 0.28);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(4, lane.row * CELL.height + 4, CELL.width - 8, CELL.height - 8);
    ctx.fillStyle = rgba(theme.detail, 0.42);
    ctx.fillRect(7, lane.row * CELL.height + CELL.height - 10, 22, 3);
    ctx.fillRect(CELL.width - 29, lane.row * CELL.height + CELL.height - 10, 22, 3);
  }
  ctx.restore();
}

function drawEntrance(ctx, blueprint) {
  const { theme } = blueprint;
  ctx.save();
  const glow = ctx.createLinearGradient(FIELD.width - 115, 0, FIELD.width, 0);
  glow.addColorStop(0, "transparent");
  glow.addColorStop(1, rgba(theme.detail, 0.24));
  ctx.fillStyle = glow;
  ctx.fillRect(FIELD.width - 130, 0, 130, FIELD.height);

  for (const lane of blueprint.lanes) {
    const cy = lane.center + 10;
    if (["maw", "womb", "overgrowth"].includes(theme.entrance)) {
      ctx.fillStyle = "rgba(6,3,12,.78)";
      ctx.beginPath();
      ctx.ellipse(FIELD.width - 17, cy, 48, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(theme.detail, 0.65);
      ctx.lineWidth = 4;
      ctx.stroke();
      for (let index = -2; index <= 2; index += 1) {
        ctx.fillStyle = rgba(theme.detail, 0.5);
        ctx.beginPath();
        ctx.moveTo(FIELD.width - 54, cy + index * 13);
        ctx.lineTo(FIELD.width - 36, cy + index * 13 - 5);
        ctx.lineTo(FIELD.width - 36, cy + index * 13 + 5);
        ctx.closePath();
        ctx.fill();
      }
    } else if (theme.entrance === "portal") {
      ctx.strokeStyle = rgba(theme.detail, 0.7);
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.ellipse(FIELD.width - 21, cy, 43, 47, 0, Math.PI * 0.55, Math.PI * 1.45);
      ctx.stroke();
      ctx.strokeStyle = rgba(theme.edge, 0.45);
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(theme.laneAlt, 0.94);
      ctx.fillRect(FIELD.width - 52, lane.top + 8, 52, lane.bottom - lane.top - 15);
      ctx.strokeStyle = rgba(theme.detail, 0.55);
      ctx.lineWidth = 3;
      ctx.strokeRect(FIELD.width - 49, lane.top + 13, 48, lane.bottom - lane.top - 25);
      for (let bar = 0; bar < 3; bar += 1) {
        ctx.fillStyle = rgba(theme.detail, 0.35);
        ctx.fillRect(FIELD.width - 45 + bar * 15, lane.top + 17, 5, lane.bottom - lane.top - 33);
      }
    }
  }
  ctx.restore();
}

function drawLaneLabels(ctx, blueprint, profile) {
  if (profile.detail < 0.6) return;
  ctx.save();
  ctx.font = "700 9px system-ui";
  ctx.textAlign = "left";
  for (const lane of blueprint.lanes) {
    ctx.fillStyle = rgba(blueprint.theme.edge, 0.5);
    ctx.fillText(`R${lane.row + 1}`, FIELD.baseX + 8, lane.top + 16);
    ctx.fillStyle = rgba(blueprint.theme.detail, 0.35);
    ctx.fillRect(FIELD.baseX + 28, lane.top + 10, 35, 2);
  }
  ctx.restore();
}

function renderStaticBattlefield(ctx, phase, settings = {}) {
  const blueprint = getBattlefieldBlueprint(phase);
  const profile = getQualityProfile(settings);
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  drawBackdrop(ctx, phase, blueprint);
  drawLanes(ctx, blueprint, profile);
  drawBase(ctx, blueprint);
  drawEntrance(ctx, blueprint);
  drawLaneLabels(ctx, blueprint, profile);
}

function getStaticBattlefield(phase, settings) {
  const key = getBattlefieldCacheKey(phase, settings);
  if (staticBattlefieldCache.has(key)) return staticBattlefieldCache.get(key);
  const canvas = createCacheCanvas();
  const context = canvas?.getContext?.("2d");
  if (!context) return null;
  renderStaticBattlefield(context, phase, settings);
  staticBattlefieldCache.set(key, canvas);
  return canvas;
}

export function drawArenaBackground(ctx, phase, settings = {}) {
  const cached = getStaticBattlefield(phase, settings);
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  if (cached) ctx.drawImage(cached, 0, 0);
  else renderStaticBattlefield(ctx, phase, settings);
}

function drawDamageMarks(ctx, phase, intensity) {
  const theme = phase.battlefieldTheme;
  const count = Math.round(intensity * 9);
  ctx.save();
  ctx.strokeStyle = rgba(theme.detail, 0.12 + intensity * 0.12);
  ctx.lineWidth = 1.5;
  for (let index = 0; index < count; index += 1) {
    const x = FIELD.combatOffsetX + 130 + pseudo(index, theme.seed + 90) * 720;
    const row = index % FIELD.rows;
    const y = row * CELL.height + 28 + pseudo(index, theme.seed + 100) * 55;
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x - 4, y + 7);
    ctx.lineTo(x + 5, y - 5);
    ctx.lineTo(x + 18, y + 4);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawArenaUnderlay(ctx, phase, settings, session, time) {
  const profile = getQualityProfile(settings);
  const intensity = getArenaIntensity(phase, session.waveIndex);
  const motionTime = settings.reduceMotion ? 0 : time;
  const theme = phase.battlefieldTheme;
  drawDamageMarks(ctx, phase, intensity);

  ctx.save();
  if (profile.parallax > 0) {
    const drift = settings.reduceMotion ? 0 : Math.sin(motionTime / 3200) * 12 * profile.parallax;
    ctx.globalAlpha = 0.12 * profile.parallax;
    ctx.fillStyle = theme.detail;
    for (let index = 0; index < 7; index += 1) {
      const x = FIELD.combatOffsetX + 75 + index * 155 + drift * (index % 2 ? 1 : -0.6);
      const height = 24 + pseudo(index, theme.seed + 430) * 42;
      ctx.beginPath(); ctx.moveTo(x - 55, 0); ctx.lineTo(x, height); ctx.lineTo(x + 62, 0); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const basePulse = settings.reduceMotion ? 0.5 : (Math.sin(motionTime / 900) + 1) / 2;
  const baseGlow = ctx.createLinearGradient(0, 0, 145, 0);
  baseGlow.addColorStop(0, rgba(theme.edge, 0.15 + basePulse * 0.12));
  baseGlow.addColorStop(1, "transparent");
  ctx.fillStyle = baseGlow;
  ctx.fillRect(0, 0, 150, FIELD.height);

  if (["organic", "chitin", "ancient"].includes(theme.material) && profile.atmosphere > 0.5) {
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = rgba(theme.detail, 0.08 + intensity * 0.11);
    ctx.lineWidth = theme.material === "ancient" ? 2 : 3;
    for (let row = 0; row < FIELD.rows; row += 1) {
      const y = row * CELL.height + 88;
      ctx.beginPath();
      for (let x = FIELD.combatOffsetX + 85; x <= FIELD.combatOffsetX + 920; x += 45) {
        const offset = Math.sin(x / 74 + row * 1.8 + motionTime / 1700) * 4;
        x === FIELD.combatOffsetX + 85 ? ctx.moveTo(x, y + offset) : ctx.lineTo(x, y + offset);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function shouldShowGrid({ selectedTroop, removeMode, hoveredCell }) {
  return Boolean(selectedTroop || removeMode || hoveredCell);
}

export function getGridCellState(session, row, col, selectedTroop, removeMode, hoveredCell) {
  const hovered = hoveredCell?.row === row && hoveredCell?.col === col;
  const troopOccupied = session.troops.some((troop) => !troop.dead && troop.row === row && troop.col === col);
  const mineOccupied = session.mines.some((mine) => mine.active && mine.row === row && mine.col === col)
    || session.projectiles.some((projectile) => projectile.active && projectile.kind === "mine" && projectile.targetRow === row && projectile.targetCol === col);
  const occupied = troopOccupied || mineOccupied;
  if (removeMode) return { state: troopOccupied ? "removable" : "neutral", hovered, occupied: troopOccupied };
  if (!selectedTroop) return { state: "neutral", hovered, occupied };
  const reason = canPlaceTroop(session, selectedTroop, row, col);
  return { state: reason ? "invalid" : "valid", hovered, occupied, reason };
}

export function getPlacementPreviewGeometry(session, selectedTroop, hoveredCell, removeMode = false) {
  if (!selectedTroop || !hoveredCell || removeMode || session.outcome) return null;
  const config = TROOPS[selectedTroop];
  if (!config) return null;
  const { row, col } = hoveredCell;
  const x = col * CELL.width + CELL.width / 2;
  const y = row * CELL.height + CELL.height / 2;
  const reason = canPlaceTroop(session, selectedTroop, row, col);
  const hasAttackRange = config.range > 0 && !["none", "energy"].includes(config.attack);
  return {
    row, col, x, y, valid: !reason, reason,
    color: reason ? "#fb7185" : config.color,
    range: config.attack === "mine" ? {
      kind: "mine",
      x0: Math.min(FIELD.width, (col + 1) * CELL.width),
      y0: 0,
      x1: Math.min(FIELD.width, (col + 1 + config.mineRangeCols) * CELL.width),
      y1: FIELD.height,
    } : config.attack === "mortar" ? {
      kind: "mortar",
      x0: Math.min(FIELD.width, (col + config.minRange) * CELL.width),
      y0: row * CELL.height,
      x1: Math.min(FIELD.width, (col + Math.floor(config.range) + 1) * CELL.width),
      y1: (row + 1) * CELL.height,
      blindX0: Math.min(FIELD.width, (col + 1) * CELL.width),
    } : hasAttackRange ? {
      x0: x,
      y0: y,
      x1: Math.min(FIELD.width, x + config.range * CELL.width),
      y1: y,
    } : null,
  };
}

export function drawPlacementRange(ctx, preview) {
  if (!preview?.range) return;
  const { x0, y0, x1, y1 } = preview.range;
  const color = preview.color;
  ctx.save();
  if (preview.range.kind === "mine") {
    ctx.fillStyle = `${color}18`;
    ctx.strokeStyle = color;
    ctx.globalAlpha = preview.valid ? 0.8 : 0.58;
    ctx.setLineDash([8, 6]);
    ctx.fillRect(x0, y0, Math.max(0, x1 - x0), y1 - y0);
    for (let row = 0; row <= FIELD.rows; row += 1) {
      ctx.beginPath();
      ctx.moveTo(x0, row * CELL.height);
      ctx.lineTo(x1, row * CELL.height);
      ctx.stroke();
    }
    for (let x = x0; x <= x1; x += CELL.width) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (preview.range.kind === "mortar") {
    ctx.globalAlpha = preview.valid ? 0.8 : 0.58;
    ctx.fillStyle = "rgba(248,113,113,.07)";
    ctx.fillRect(preview.range.blindX0, y0, Math.max(0, x0 - preview.range.blindX0), y1 - y0);
    ctx.fillStyle = `${color}20`;
    ctx.strokeStyle = color;
    ctx.setLineDash([8, 6]);
    ctx.fillRect(x0, y0, Math.max(0, x1 - x0), y1 - y0);
    ctx.strokeRect(x0, y0, Math.max(0, x1 - x0), y1 - y0);
    for (let x = x0 + CELL.width; x < x1; x += CELL.width) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const band = ctx.createLinearGradient(x0, y0, x1, y1);
  band.addColorStop(0, `${color}2e`);
  band.addColorStop(1, `${color}08`);
  ctx.fillStyle = band;
  ctx.fillRect(x0, y0 - 9, Math.max(0, x1 - x0), 18);
  ctx.strokeStyle = color;
  ctx.globalAlpha = preview.valid ? 0.85 : 0.72;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1 - 11);
  ctx.lineTo(x1, y1 + 11);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x0, y0, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawPad(ctx, x, y, visual) {
  const palette = {
    valid: ["#67e8f9", "#22d3ee"],
    invalid: ["#fb7185", "#e11d48"],
    removable: ["#fda4af", "#fb7185"],
    neutral: ["#94a3b8", "#67e8f9"],
  }[visual.state];
  const width = visual.hovered ? 39 : 22;
  const height = visual.hovered ? 13 : 6;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = rgba(palette[0], visual.hovered ? 0.24 : 0.08);
  ctx.strokeStyle = rgba(palette[0], visual.hovered ? 0.95 : 0.38);
  ctx.lineWidth = visual.hovered ? 2.5 : 1.25;
  ctx.shadowBlur = visual.hovered ? 12 : 4;
  ctx.shadowColor = palette[1];
  ctx.beginPath();
  ctx.ellipse(x, y, width, height, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (visual.hovered) {
    ctx.strokeStyle = palette[0];
    ctx.lineWidth = 2;
    const halfW = 47;
    const halfH = 23;
    const corner = 11;
    for (const [cx, cy, dx, dy] of [[x - halfW, y - halfH, 1, 1], [x + halfW, y - halfH, -1, 1], [x - halfW, y + halfH, 1, -1], [x + halfW, y + halfH, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * corner, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * corner);
      ctx.stroke();
    }
    if (visual.state === "invalid") {
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 7);
      ctx.lineTo(x + 7, y + 7);
      ctx.moveTo(x + 7, y - 7);
      ctx.lineTo(x - 7, y + 7);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawTacticalGrid(ctx, session, selectedTroop, removeMode, hoveredCell) {
  if (!shouldShowGrid({ selectedTroop, removeMode, hoveredCell })) return;
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let col = 0; col < FIELD.cols; col += 1) {
      const visual = getGridCellState(session, row, col, selectedTroop, removeMode, hoveredCell);
      const visible = removeMode
        ? visual.state === "removable"
        : selectedTroop
          ? visual.state === "valid" || visual.occupied || visual.hovered
          : visual.hovered;
      if (!visible) continue;
      const x = col * CELL.width + CELL.width / 2;
      const y = row * CELL.height + CELL.height * 0.85;
      drawPad(ctx, x, y, visual);
    }
  }
}

export function drawContactShadow(ctx, entity, scale = 1, settings = {}) {
  const strength = getQualityProfile(settings).shadows;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.38 * strength})`;
  ctx.beginPath();
  ctx.ellipse(entity.x, entity.y + 43, 34 * scale, 10 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(180,225,235,${0.08 * strength})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawDriftingPoints(ctx, phase, count, time, intensity, kind) {
  const palette = phase.palette;
  for (let index = 0; index < count; index += 1) {
    const speed = kind === "dust" ? 0.01 : 0.018;
    const x = (pseudo(index, 2) * FIELD.width + time * speed * (0.4 + pseudo(index, 3))) % (FIELD.width + 40) - 20;
    const y = (pseudo(index, 5) * FIELD.height + Math.sin(time / 900 + index) * 18) % FIELD.height;
    const size = 0.7 + pseudo(index, 8) * (kind === "spores" ? 2.3 : 1.5);
    ctx.fillStyle = kind === "dust" ? `rgba(226,190,138,${0.08 + intensity * 0.13})` : rgba(palette.accent, 0.16 + intensity * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFogOrSmoke(ctx, count, time, intensity, smoke = false) {
  for (let index = 0; index < count; index += 1) {
    const radius = 120 + pseudo(index, 12) * 180;
    const x = ((pseudo(index, 13) * (FIELD.width + radius * 2) + time * (smoke ? 0.004 : 0.009)) % (FIELD.width + radius * 2)) - radius;
    const y = smoke ? FIELD.height - ((time * 0.007 + pseudo(index, 14) * FIELD.height) % (FIELD.height + 180)) : 70 + pseudo(index, 14) * 470;
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, smoke ? `rgba(12,18,24,${0.045 + intensity * 0.055})` : `rgba(210,230,235,${0.026 + intensity * 0.035})`);
    cloud.addColorStop(1, "transparent");
    ctx.fillStyle = cloud;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

export function getSandstormVisualIntensity(session) {
  const storm = session?.sandstorm;
  if (storm?.state === "warning") return 0.45;
  if (storm?.state === "active") return 1;
  if (storm?.state === "recovering") {
    const duration = Math.max(1, storm.recoveryEndsAt - storm.recoveryStartedAt);
    return Math.max(0, Math.min(0.65, 0.65 * (storm.recoveryEndsAt - session.elapsed) / duration));
  }
  return 0;
}

export function getSandstormGustVisual(session, settings = {}, adaptive = {}) {
  const storm = session?.sandstorm;
  const durationMs = session?.phase?.environmentHazard?.startGustMs || 1200;
  const ageMs = session?.elapsed - storm?.startsAt;
  const active = storm?.state === "active" && Number.isFinite(ageMs) && ageMs >= 0 && ageMs < durationMs;
  const adaptiveScale = adaptive.level === "stress" ? 0.45 : adaptive.level === "busy" ? 0.72 : 1;
  return {
    active,
    progress: active ? Math.max(0, Math.min(1, ageMs / durationMs)) : 0,
    moving: active && !settings.reduceMotion,
    particleScale: adaptiveScale,
  };
}

function drawSandstormStartGust(ctx, session, settings, adaptive, particleScale) {
  const gust = getSandstormGustVisual(session, settings, adaptive);
  if (!gust.active) return;
  const fade = 1 - gust.progress;
  ctx.save();
  if (!gust.moving) {
    ctx.fillStyle = `rgba(245,158,11,${0.14 * fade})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
    return;
  }

  const eased = 1 - Math.pow(1 - gust.progress, 2);
  const x = FIELD.width + 300 - eased * (FIELD.width + 600);
  ctx.translate(x, FIELD.height / 2);
  ctx.rotate(-0.22);
  const band = ctx.createLinearGradient(-250, 0, 250, 0);
  band.addColorStop(0, "rgba(245,158,11,0)");
  band.addColorStop(0.35, `rgba(217,119,6,${0.12 * fade})`);
  band.addColorStop(0.55, `rgba(255,237,174,${0.24 * fade})`);
  band.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = band;
  ctx.fillRect(-250, -FIELD.height, 500, FIELD.height * 2);
  ctx.strokeStyle = `rgba(255,226,158,${0.52 * fade})`;
  ctx.lineWidth = 2;
  const count = Math.round(90 * particleScale * gust.particleScale);
  for (let index = 0; index < count; index += 1) {
    const px = -230 + pseudo(index, 950) * 460;
    const py = -FIELD.height * 0.65 + pseudo(index, 951) * FIELD.height * 1.3;
    const length = 16 + pseudo(index, 952) * 42;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - length, py + length * 0.28);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSandstorm(ctx, session, time, settings, profile, adaptive) {
  const intensity = getSandstormVisualIntensity(session);
  if (intensity <= 0) return;
  const motionTime = settings.reduceMotion ? 0 : time;
  const adaptiveScale = adaptive.level === "stress" ? 0.45 : adaptive.level === "busy" ? 0.72 : 1;
  const particleScale = profile.particles * adaptiveScale;
  ctx.save();
  ctx.fillStyle = `rgba(179,112,38,${0.12 * intensity})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawSandstormStartGust(ctx, session, settings, adaptive, profile.particles);

  if (adaptive.heavyAtmosphere !== false) {
    const cloudCount = Math.max(1, Math.round(5 * particleScale));
    for (let index = 0; index < cloudCount; index += 1) {
      const radius = 150 + pseudo(index, 920) * 190;
      const x = ((pseudo(index, 921) * (FIELD.width + radius * 2) + motionTime * 0.025) % (FIELD.width + radius * 2)) - radius;
      const y = FIELD.height - 35 - pseudo(index, 922) * 105;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
      cloud.addColorStop(0, `rgba(126,73,27,${0.075 * intensity})`);
      cloud.addColorStop(1, "transparent");
      ctx.fillStyle = cloud;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }

  ctx.strokeStyle = `rgba(255,208,128,${0.25 * intensity})`;
  ctx.lineWidth = 1.5;
  const count = Math.round(70 * particleScale * intensity);
  for (let index = 0; index < count; index += 1) {
    const x = (pseudo(index, 900) * FIELD.width + motionTime * 0.34) % (FIELD.width + 160) - 80;
    const y = (pseudo(index, 901) * FIELD.height + motionTime * 0.13) % (FIELD.height + 100) - 50;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 34, y + 12);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawArenaForeground(ctx, phase, settings, session, time, adaptive = {}) {
  const profile = getQualityProfile(settings);
  const effects = phase.ambientEffects || [];
  const intensity = getArenaIntensity(phase, session.waveIndex);
  const motionTime = settings.reduceMotion ? 0 : time;
  const atmosphereScale = adaptive.atmosphereScale ?? 1;
  const particleScale = adaptive.level === "stress" ? 0.55 : adaptive.level === "busy" ? 0.82 : 1;
  ctx.save();
  ctx.globalAlpha = profile.atmosphere * atmosphereScale;

  if (adaptive.heavyAtmosphere !== false && effects.includes("fog")) drawFogOrSmoke(ctx, Math.round(2 + 3 * profile.particles), motionTime, intensity);
  if (adaptive.heavyAtmosphere !== false && effects.includes("smoke")) drawFogOrSmoke(ctx, Math.round(2 + 3 * profile.particles), motionTime, intensity, true);
  if (effects.includes("spores")) drawDriftingPoints(ctx, phase, Math.round((12 + 30 * profile.particles) * particleScale), motionTime, intensity, "spores");
  if (effects.includes("dust") || effects.includes("debris")) drawDriftingPoints(ctx, phase, Math.round((10 + 22 * profile.particles) * particleScale), motionTime, intensity, "dust");
  if (effects.includes("glassDust")) drawDriftingPoints(ctx, phase, Math.round((14 + 34 * profile.particles) * particleScale), motionTime * 0.72, intensity, "spores");
  drawSandstorm(ctx, session, time, settings, profile, adaptive);

  if (effects.includes("refraction")) {
    const drift = settings.reduceMotion ? 0 : Math.sin(motionTime / 1800) * 24;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let index = 0; index < 4; index += 1) {
      const x = 120 + index * 270 + drift * (index % 2 ? -1 : 1);
      const gradient = ctx.createLinearGradient(x - 80, 0, x + 100, FIELD.height);
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(.48, rgba(index % 2 ? phase.palette.primary : phase.palette.accent, .025 * intensity));
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x - 60, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 130, FIELD.height); ctx.lineTo(x + 20, FIELD.height); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  if (effects.includes("shardStorm")) {
    ctx.save();
    ctx.strokeStyle = rgba(phase.palette.primary, .18 + intensity * .16);
    ctx.lineWidth = 1.2;
    const count = Math.round((12 + 34 * profile.particles) * particleScale);
    for (let index = 0; index < count; index += 1) {
      const x = (pseudo(index, 710) * FIELD.width + motionTime * (0.055 + pseudo(index, 711) * .035)) % (FIELD.width + 100) - 50;
      const y = (pseudo(index, 712) * FIELD.height + motionTime * .08) % (FIELD.height + 50) - 25;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 18); ctx.lineTo(x + 2, y + 14); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }

  if (effects.includes("mirrors")) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = rgba(phase.palette.accent, .035 * intensity);
    for (let index = 0; index < 7; index += 1) {
      const x = 110 + pseudo(index, phase.battlefieldTheme.seed + 760) * 820;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 42, 0); ctx.lineTo(x - 8, FIELD.height); ctx.lineTo(x - 36, FIELD.height); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  if (effects.includes("rain")) {
    ctx.strokeStyle = `rgba(170,225,255,${0.09 + intensity * 0.13})`;
    ctx.lineWidth = 1.5;
    const count = Math.round((24 + 62 * profile.particles) * particleScale);
    for (let index = 0; index < count; index += 1) {
      const x = (pseudo(index, 20) * FIELD.width + motionTime * (0.1 + pseudo(index, 21) * 0.04)) % (FIELD.width + 160) - 80;
      const y = (pseudo(index, 22) * FIELD.height + motionTime * 0.24) % (FIELD.height + 80) - 40;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 19, y + 52);
      ctx.stroke();
    }
  }

  if (effects.includes("fissures") || effects.includes("veins")) {
    const pulse = settings.reduceMotion ? .45 : .35 + (Math.sin(motionTime / 520) + 1) * .18;
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = rgba(phase.palette.accent, pulse * intensity); ctx.lineWidth = effects.includes("veins") ? 2.5 : 1.5;
    for (let row = 0; row < FIELD.rows; row += 1) {
      const y = row * CELL.height + 93;
      ctx.beginPath(); ctx.moveTo(150, y);
      for (let x = 210; x < 880; x += 70) ctx.lineTo(x, y + Math.sin(x * .04 + row + motionTime / 1000) * 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (effects.includes("portal")) {
    const pulse = settings.reduceMotion ? .5 : .5 + Math.sin(motionTime / 360) * .16;
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = rgba(phase.palette.primary, .35 * pulse * intensity); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(FIELD.width - 46, FIELD.height / 2, 28 + pulse * 7, 165 + pulse * 12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  if (effects.includes("bioluminescence") || effects.includes("pulse")) {
    const pulse = settings.reduceMotion ? .4 : .38 + (Math.sin(motionTime / 620) + 1) * .18;
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.fillStyle = rgba(phase.palette.accent, pulse * .14 * intensity);
    for (let index = 0; index < 18; index += 1) {
      const x = 80 + pseudo(index, phase.battlefieldTheme.seed + 330) * 860;
      const y = 20 + pseudo(index, phase.battlefieldTheme.seed + 340) * 550;
      ctx.beginPath(); ctx.arc(x, y, 2 + pseudo(index, 350) * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  if (effects.includes("searchlights") && profile.atmosphere > 0.5) {
    for (let index = 0; index < 2; index += 1) {
      const originX = 260 + index * 410;
      const targetX = originX + Math.sin(motionTime / 2100 + index * 1.7) * 150;
      ctx.fillStyle = "rgba(148,220,255,.035)";
      ctx.beginPath();
      ctx.moveTo(originX - 10, 0);
      ctx.lineTo(originX + 10, 0);
      ctx.lineTo(targetX + 85, FIELD.height);
      ctx.lineTo(targetX - 85, FIELD.height);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (effects.includes("emergency")) {
    const pulse = settings.reduceMotion ? 0.2 : (Math.sin(motionTime / 420) + 1) / 2;
    ctx.fillStyle = `rgba(239,68,68,${pulse * 0.045 * intensity})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  if (effects.includes("lightning") && !settings.reduceMotion) {
    const flash = Math.sin(motionTime / 410 + Math.sin(motionTime / 1730) * 4);
    if (flash > 0.972) {
      ctx.fillStyle = `rgba(195,225,255,${(flash - 0.972) * 3.4})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  const edge = ctx.createRadialGradient(FIELD.width / 2, FIELD.height * 0.48, FIELD.height * 0.25, FIELD.width / 2, FIELD.height * 0.48, FIELD.width * 0.72);
  edge.addColorStop(0, "transparent");
  edge.addColorStop(0.76, "rgba(1,4,10,.045)");
  edge.addColorStop(1, "rgba(1,3,8,.4)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();
}
