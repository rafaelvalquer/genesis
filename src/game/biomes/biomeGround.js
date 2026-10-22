import { CELL, FIELD } from "../visualGeometry.js";
import { pseudo, rgba } from "./decorMath.js";
import { CHAPTER_TWO_DECOR } from "./chapter02Glass.js";
import { CHAPTER_THREE_DECOR } from "./chapter03Dunes.js";

// Static biome ground, drawn once into the battlefield cache: one plate per
// grid cell (tile images or a procedural plate style), re-colored per phase,
// scattered wear details and a framing rail.

const RAIL = 12;
const COLUMNS = Math.round(FIELD.width / CELL.width);

// Procedural plate styles, keyed by a biome's `plate`. Each draws one cell.
const PLATE_STYLES = {
  ...CHAPTER_TWO_DECOR.plates,
  ...CHAPTER_THREE_DECOR.plates,
};

// One ground plate per grid cell, in a checker of two tones, so the field reads
// as a built surface rather than a backdrop. Rare stone plates break repetition.
function drawGroundTiles(ctx, tiles, theme) {
  ctx.fillStyle = rgba(theme.lane, 1);
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const index = row * COLUMNS + column;
      const accent = tiles.length > 2 && pseudo(index, theme.seed + 300) > .93;
      const tile = accent ? tiles[2] : tiles[(row + column) % 2];
      const x = column * CELL.width + 1;
      const y = row * CELL.height + 1;
      ctx.drawImage(tile, x, y, CELL.width - 2, CELL.height - 2);
      // The stone plate is much lighter than the metal ones, so it is dimmed.
      ctx.fillStyle = accent ? "rgba(4,12,22,.5)" : (row + column) % 2 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.08)";
      ctx.fillRect(x, y, CELL.width - 2, CELL.height - 2);
    }
  }
}

function drawProceduralPlates(ctx, drawPlate, theme, variant) {
  ctx.fillStyle = rgba(theme.lane, 1);
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const cell = {
        x: column * CELL.width + 1,
        y: row * CELL.height + 1,
        width: CELL.width - 2,
        height: CELL.height - 2,
        row,
        column,
        index: row * COLUMNS + column,
      };
      ctx.save();
      drawPlate(ctx, cell, theme, variant);
      ctx.restore();
    }
  }
}

function applyTint(ctx, theme, variant) {
  if (variant.tint) {
    // "color" keeps the plates' shading and swaps their hue for the phase's.
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = rgba(variant.tint, .5);
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Pull the result back toward the phase's own dark lane color so the hue
    // stays moody instead of saturated.
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = rgba(theme.laneAlt, .35);
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
  }
}

const SCATTER = {
  bolts(ctx, x, y, size, theme) {
    for (let bolt = 0; bolt < 3; bolt += 1) {
      const bx = x + bolt * 9;
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.beginPath(); ctx.arc(bx, y + 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(theme.edge, .35);
      ctx.beginPath(); ctx.arc(bx, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  },
  cracks(ctx, x, y, size) {
    ctx.strokeStyle = "rgba(0,0,0,.38)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y + size * .4);
    ctx.lineTo(x + size * 1.5, y + size * 1.3);
    ctx.moveTo(x + size, y + size * .4);
    ctx.lineTo(x + size * 1.9, y - size * .2);
    ctx.stroke();
  },
  stain(ctx, x, y, size, theme, roll) {
    ctx.fillStyle = "rgba(0,0,0,.2)";
    ctx.beginPath(); ctx.ellipse(x, y, size * 2, size, roll * 3, 0, Math.PI * 2); ctx.fill();
  },
  light(ctx, x, y, size, theme, roll, index) {
    const color = index % 2 ? theme.edge : theme.detail;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 14);
    glow.addColorStop(0, rgba(color, .5));
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.fillStyle = rgba(color, .95);
    ctx.fillRect(x - 3, y - 2, 6, 4);
  },
  plate(ctx, x, y, size, theme, roll) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((roll - .5) * .7);
    ctx.fillStyle = rgba(theme.edge, .1);
    ctx.fillRect(-size, -size * .6, size * 2, size * 1.2);
    ctx.strokeStyle = rgba(theme.edge, .3);
    ctx.lineWidth = 1;
    ctx.strokeRect(-size, -size * .6, size * 2, size * 1.2);
    ctx.restore();
  },
  moss(ctx, x, y, size) {
    for (let blob = 0; blob < 3; blob += 1) {
      ctx.fillStyle = `rgba(${70 + blob * 20},${150 + blob * 15},90,.2)`;
      ctx.beginPath(); ctx.ellipse(x + blob * size * .7, y + (blob % 2) * 4, size * 1.2, size * .7, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "rgba(180,255,200,.35)";
    ctx.fillRect(x + size * .4, y - 2, 2, 2);
  },
  rubble(ctx, x, y, size, theme, roll) {
    for (let stone = 0; stone < 3; stone += 1) {
      const sx = x + stone * size * .9;
      const sy = y + (stone % 2) * 5;
      const r = size * (.45 + roll * .3);
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.beginPath();
      ctx.moveTo(sx - r, sy); ctx.lineTo(sx - r * .3, sy - r * .8); ctx.lineTo(sx + r, sy - r * .3); ctx.lineTo(sx + r * .6, sy + r * .6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  },
  resin(ctx, x, y, size, theme) {
    ctx.fillStyle = rgba(theme.detail, .2);
    ctx.beginPath(); ctx.ellipse(x, y, size * 1.8, size * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.2)";
    ctx.beginPath(); ctx.ellipse(x - size * .5, y - size * .3, size * .5, size * .25, -.4, 0, Math.PI * 2); ctx.fill();
  },
  vein(ctx, x, y, size, theme, roll) {
    ctx.strokeStyle = rgba(theme.detail, .3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - size * 2, y + size * .4);
    ctx.quadraticCurveTo(x, y - size * (1 + roll), x + size * 2, y + size * .2);
    ctx.stroke();
  },
  rune(ctx, x, y, size, theme) {
    ctx.strokeStyle = rgba(theme.edge, .28);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, size * 1.6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - size * .8, y); ctx.lineTo(x + size * .8, y);
    ctx.moveTo(x, y - size * .8); ctx.lineTo(x, y + size * .8);
    ctx.stroke();
  },
  ...CHAPTER_TWO_DECOR.scatter,
  ...CHAPTER_THREE_DECOR.scatter,
};

// Small deterministic details scattered over the plates so the ground has
// wear and life; the mix of kinds comes from the phase variant.
function drawGroundScatter(ctx, theme, profile, variant) {
  const count = Math.round(46 * profile.detail);
  const spanX = FIELD.width - FIELD.baseX - 80;
  ctx.save();
  for (let index = 0; index < count; index += 1) {
    const x = FIELD.baseX + 30 + pseudo(index, theme.seed + 410) * spanX;
    const y = 16 + pseudo(index, theme.seed + 420) * (FIELD.height - 32);
    const kind = variant.scatter[Math.floor(pseudo(index, theme.seed + 430) * variant.scatter.length)];
    const size = 5 + pseudo(index, theme.seed + 440) * 9;
    SCATTER[kind]?.(ctx, x, y, size, theme, pseudo(index, theme.seed + 450), index);
  }
  ctx.restore();
}

// Rail patterns, keyed by a variant's `rail`; unknown styles fall back to hazard.
const RAILS = {
  hazard(ctx, y, theme) {
    ctx.fillStyle = rgba(theme.detail, .55);
    for (let x = -RAIL; x < FIELD.width; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, y + RAIL);
      ctx.lineTo(x + RAIL, y);
      ctx.lineTo(x + RAIL + 10, y);
      ctx.lineTo(x + 10, y + RAIL);
      ctx.closePath();
      ctx.fill();
    }
  },
  organic(ctx, y, theme) {
    for (let x = 6; x < FIELD.width; x += 22) {
      ctx.fillStyle = rgba(theme.detail, .45);
      ctx.beginPath(); ctx.ellipse(x, y + RAIL / 2, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  runic(ctx, y, theme) {
    ctx.fillStyle = rgba(theme.edge, .6);
    for (let x = 10; x < FIELD.width; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, y + 2); ctx.lineTo(x + 4, y + RAIL / 2); ctx.lineTo(x, y + RAIL - 2); ctx.lineTo(x - 4, y + RAIL / 2);
      ctx.closePath(); ctx.fill();
    }
  },
  ...CHAPTER_TWO_DECOR.rails,
  ...CHAPTER_THREE_DECOR.rails,
};

function drawRailPattern(ctx, y, theme, style) {
  (RAILS[style] || RAILS.hazard)(ctx, y, theme);
}

// Rails along the top and bottom of the field, with an inner shadow, framing
// the arena the way the fence frames a lawn. The pattern follows the phase.
function drawFieldFrame(ctx, theme, variant) {
  for (const top of [true, false]) {
    const y = top ? 0 : FIELD.height - RAIL;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, FIELD.width, RAIL);
    ctx.clip();
    const steel = ctx.createLinearGradient(0, y, 0, y + RAIL);
    steel.addColorStop(0, top ? "#2b3a47" : "#121a22");
    steel.addColorStop(1, top ? "#121a22" : "#2b3a47");
    ctx.fillStyle = steel;
    ctx.fillRect(0, y, FIELD.width, RAIL);
    if (variant.rail !== "hazard") {
      ctx.fillStyle = rgba(theme.lane, .6);
      ctx.fillRect(0, y, FIELD.width, RAIL);
    }
    drawRailPattern(ctx, y, theme, variant.rail);
    ctx.restore();
    const shade = ctx.createLinearGradient(0, top ? RAIL : FIELD.height - RAIL, 0, top ? RAIL + 30 : FIELD.height - RAIL - 30);
    shade.addColorStop(0, "rgba(0,0,0,.5)");
    shade.addColorStop(1, "transparent");
    ctx.fillStyle = shade;
    ctx.fillRect(0, top ? RAIL : FIELD.height - RAIL - 30, FIELD.width, 30);
  }
}

/**
 * Draws a biome ground into the static battlefield cache. Returns false when
 * it cannot (a "kit" biome whose tiles are not loaded, or an unknown plate
 * style), so the caller can fall back to the generic battlefield.
 */
export function drawBiomeGround(ctx, theme, variant, profile, tiles = null) {
  if (variant.plate === "kit") {
    if (!tiles) return false;
    drawGroundTiles(ctx, tiles, theme);
  } else {
    const drawPlate = PLATE_STYLES[variant.plate];
    if (!drawPlate) return false;
    drawProceduralPlates(ctx, drawPlate, theme, variant);
  }
  applyTint(ctx, theme, variant);
  drawGroundScatter(ctx, theme, profile, variant);
  drawFieldFrame(ctx, theme, variant);
  return true;
}
