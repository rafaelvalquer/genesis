import { pseudo, rgba } from "./decorMath.js";

// Chapter 6, "Caldeira Primordial": a volcanic caldera. The floor is a
// continuous field of hexagonal basalt columns whose joints glow hotter as
// the chapter nears the core; details are obsidian, ash and cooled lava.
// Magma cells and thermal platforms keep drawing on top of this ground.

const RAIL = 12;
const HEX = 21;
const HEX_WIDTH = Math.sqrt(3) * HEX;
const HEX_STEP = HEX * 1.5;

function hexPath(ctx, cx, cy) {
  ctx.beginPath();
  for (let corner = 0; corner < 6; corner += 1) {
    const angle = Math.PI / 6 + corner * Math.PI / 3;
    ctx[corner ? "lineTo" : "moveTo"](cx + Math.cos(angle) * HEX, cy + Math.sin(angle) * HEX);
  }
  ctx.closePath();
}

function isMagmaCell(phase, cell) {
  return phase?.magmaTerrain?.cells?.some(([row, column]) => row === cell.row && column === cell.column);
}

// A cooling lava surface: bright molten channels between dark crust plates.
// The magma renderer animates fires, hotspots and eruptions on top of it.
function drawLavaCell(ctx, cell, theme) {
  const { x, y, width, height, index } = cell;
  const left = x - 1;
  const top = y - 1;
  const molten = ctx.createRadialGradient(x + width / 2, y + height / 2, 6, x + width / 2, y + height / 2, width * .8);
  molten.addColorStop(0, "#ffb347");
  molten.addColorStop(.5, "#ff5a14");
  molten.addColorStop(1, "#8a1d06");
  ctx.fillStyle = molten;
  ctx.fillRect(left, top, width + 2, height + 2);
  for (let crust = 0; crust < 7; crust += 1) {
    const cx = x + pseudo(index * 7 + crust, theme.seed + 161) * width;
    const cy = y + pseudo(index * 7 + crust, theme.seed + 162) * height;
    const radius = 11 + pseudo(index * 7 + crust, theme.seed + 163) * 10;
    ctx.beginPath();
    for (let corner = 0; corner < 6; corner += 1) {
      const angle = corner * Math.PI / 3 + pseudo(index + crust, theme.seed + 164);
      const r = radius * (.7 + pseudo(index * 42 + crust * 6 + corner, theme.seed + 165) * .4);
      ctx[corner ? "lineTo" : "moveTo"](cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(28,12,8,.88)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,150,50,.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

// The hex grid is anchored to the field, not the cell, so columns run on
// seamlessly from one cell to the next; each cell just clips its share.
// The phase's magma cells become lava instead, so they read at a glance.
function drawBasaltPlate(ctx, cell, theme, variant, phase) {
  const { x, y, width, height } = cell;
  const left = x - 1;
  const top = y - 1;
  ctx.beginPath();
  ctx.rect(left, top, width + 2, height + 2);
  ctx.clip();
  if (isMagmaCell(phase, cell)) {
    drawLavaCell(ctx, cell, theme);
    return;
  }
  ctx.fillStyle = "#120b09";
  ctx.fillRect(left, top, width + 2, height + 2);
  const firstRow = Math.floor((top - HEX) / HEX_STEP);
  const lastRow = Math.ceil((top + height + HEX) / HEX_STEP);
  for (let row = firstRow; row <= lastRow; row += 1) {
    const offset = (row & 1) * HEX_WIDTH / 2;
    const firstColumn = Math.floor((left - HEX_WIDTH - offset) / HEX_WIDTH);
    const lastColumn = Math.ceil((left + width + HEX_WIDTH) / HEX_WIDTH);
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const cx = column * HEX_WIDTH + offset;
      const cy = row * HEX_STEP;
      const key = (row + 50) * 997 + column + 50;
      const tone = pseudo(key, theme.seed + 151);
      hexPath(ctx, cx, cy);
      const face = ctx.createLinearGradient(cx - HEX, cy - HEX, cx + HEX, cy + HEX);
      face.addColorStop(0, `rgb(${58 + tone * 22},${44 + tone * 14},${40 + tone * 10})`);
      face.addColorStop(1, `rgb(${30 + tone * 12},${22 + tone * 8},${20 + tone * 6})`);
      ctx.fillStyle = face;
      ctx.fill();
      ctx.strokeStyle = "rgba(5,2,1,.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
      // Only some joints run hot; how many grows with the phase's heat.
      if (pseudo(key, theme.seed + 152) < variant.heat * .7) {
        ctx.strokeStyle = rgba(theme.edge, .15 + variant.heat * .5);
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,230,210,.05)";
      ctx.beginPath();
      ctx.ellipse(cx - HEX * .25, cy - HEX * .3, HEX * .35, HEX * .15, -.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = (cell.row + cell.column) % 2 ? "rgba(255,200,160,.025)" : "rgba(0,0,0,.06)";
  ctx.fillRect(left, top, width + 2, height + 2);
}

const SCATTER = {
  obsidian(ctx, x, y, size, theme, roll) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll * Math.PI * 2);
    ctx.fillStyle = "rgba(8,6,12,.85)";
    ctx.beginPath();
    ctx.moveTo(-size * .8, size * .3); ctx.lineTo(-size * .1, -size); ctx.lineTo(size * .7, -size * .1); ctx.lineTo(size * .2, size * .6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(180,170,220,.35)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-size * .1, -size); ctx.lineTo(size * .2, size * .6); ctx.stroke();
    ctx.restore();
  },
  ash(ctx, x, y, size) {
    for (let blob = 0; blob < 3; blob += 1) {
      ctx.fillStyle = "rgba(150,140,135,.16)";
      ctx.beginPath(); ctx.ellipse(x + blob * size * .7, y + (blob % 2) * 3, size * 1.1, size * .55, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  cooledLava(ctx, x, y, size, theme, roll) {
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - size * 2, y);
    ctx.bezierCurveTo(x - size, y - size * (1 + roll), x + size, y + size, x + size * 2, y - size * .3);
    ctx.strokeStyle = "rgba(20,10,8,.8)";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = rgba(theme.edge, .4);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  },
};

const RAILS = {
  // Dark basalt blocks split by a glowing seam of lava.
  basaltSeam(ctx, y, theme) {
    ctx.fillStyle = "#0d0807";
    ctx.fillRect(0, y, 1100, RAIL);
    for (let x = 0, block = 0; x < 1100; x += 20, block += 1) {
      ctx.fillStyle = block % 2 ? "#2a1d18" : "#22170f";
      ctx.fillRect(x + 1, y + 1, 18, RAIL - 2);
    }
    ctx.strokeStyle = rgba(theme.edge, .3);
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, y + RAIL / 2); ctx.lineTo(1100, y + RAIL / 2); ctx.stroke();
    ctx.strokeStyle = rgba(theme.detail, .85);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  },
};

export const CHAPTER_SIX_DECOR = Object.freeze({
  plates: { basalt: drawBasaltPlate },
  scatter: SCATTER,
  rails: RAILS,
});

const PHASE_IDS = [
  "volcanic-threshold", "magma-lake", "breathing-caldera", "natural-forges",
  "lateral-rifts", "rupture-line", "world-veins", "caldera-core",
];

// The theme is the same in every phase, so the variants are a single heat
// ramp: hotter joints, more glowing cracks, embers and ash toward the core.
function calderaVariant(index) {
  const heat = .2 + index * .8 / 7;
  return {
    tint: null,
    rail: "basaltSeam",
    heat,
    scatter: index < 3
      ? ["obsidian", "ash", "rubble", "cooledLava", "cracks"]
      : ["obsidian", "cooledLava", "glowCrack", "ash", "rubble"],
    vents: { count: index < 2 ? 1 : 2, style: "burrow", steam: "110,100,96", glow: "0,0,0" },
    lights: null,
    sparks: index === 3 || index === 7 ? { count: 2, color: "255,170,60" } : null,
    motes: { count: Math.round(6 + heat * 14), color: "255,150,60" },
    ash: { count: Math.round(6 + heat * 12), color: "170,160,155" },
    glow: { kind: "cracks", count: 3 + Math.round(heat * 6), color: "249,115,22" },
    breath: { alpha: .02 + heat * .08, color: "249,115,22" },
    sheen: null,
    flares: null,
    weather: {},
  };
}

export const CHAPTER_SIX_BIOME = Object.freeze({
  plate: "basalt",
  fallback: PHASE_IDS[0],
  phases: Object.freeze(Object.fromEntries(PHASE_IDS.map((id, index) => [id, calderaVariant(index)]))),
});
