import { pseudo, rgba } from "./decorMath.js";

// Chapter 3, "Dunas de Quitina": a desert of living silica. Plates are
// wind-rippled sandstone with the odd slab of segmented chitin; details are
// bones, shell fragments, amber, crystal needles and burrows.

const RAIL = 12;
const BONE = "#e8d7b0";

function slabPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
  else ctx.rect(x, y, width, height);
}

function drawChitinSlab(ctx, cell, theme) {
  const { x, y, width, height } = cell;
  const shell = ctx.createLinearGradient(x, y, x + width, y + height);
  shell.addColorStop(0, "#7a4a2c");
  shell.addColorStop(1, "#3a2214");
  slabPath(ctx, x + 6, y + 6, width - 12, height - 12, 22);
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.clip();
  for (let band = 0; band < 4; band += 1) {
    const by = y + 14 + band * (height - 20) / 4;
    ctx.strokeStyle = "rgba(30,14,6,.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, by + 8);
    ctx.quadraticCurveTo(x + width / 2, by - 6, x + width, by + 8);
    ctx.stroke();
    ctx.strokeStyle = rgba(theme.detail, .22);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 6, by + 4);
    ctx.quadraticCurveTo(x + width / 2, by - 9, x + width - 6, by + 4);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,240,210,.14)";
  ctx.beginPath();
  ctx.ellipse(x + width * .35, y + height * .3, width * .22, height * .08, -.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  slabPath(ctx, x + 6, y + 6, width - 12, height - 12, 22);
  ctx.strokeStyle = rgba(theme.detail, .3);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Sandstone slab with wind ripples and pitting; some cells are chitin shell.
function drawSandstonePlate(ctx, cell, theme, variant) {
  const { x, y, width, height, index, row, column } = cell;
  const seed = theme.seed;
  if (pseudo(index, seed + 21) < (variant.chitinChance || 0)) {
    drawChitinSlab(ctx, cell, theme);
    return;
  }
  const sand = ctx.createLinearGradient(x, y, x, y + height);
  sand.addColorStop(0, rgba(theme.laneAlt, 1));
  sand.addColorStop(1, rgba(theme.lane, 1));
  slabPath(ctx, x, y, width, height, 9);
  ctx.fillStyle = sand;
  ctx.fill();
  ctx.clip();
  if ((row + column) % 2) {
    ctx.fillStyle = "rgba(255,235,200,.04)";
    ctx.fillRect(x, y, width, height);
  }
  // Each slab is lit from the top-left and slightly varied in tone.
  const relief = ctx.createLinearGradient(x, y, x + width, y + height);
  relief.addColorStop(0, "rgba(255,236,200,.1)");
  relief.addColorStop(.55, "rgba(0,0,0,0)");
  relief.addColorStop(1, "rgba(0,0,0,.16)");
  ctx.fillStyle = relief;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = `rgba(20,8,2,${pseudo(index, seed + 28) * .1})`;
  ctx.fillRect(x, y, width, height);
  const phase = pseudo(index, seed + 22) * Math.PI * 2;
  for (let ripple = 0; ripple < 6; ripple += 1) {
    const ry = y + 10 + ripple * (height - 16) / 6;
    ctx.beginPath();
    ctx.moveTo(x, ry);
    for (let step = 1; step <= 6; step += 1) {
      const px = x + (width / 6) * step;
      ctx.lineTo(px, ry + Math.sin(phase + step * .9 + ripple) * 2.4);
    }
    ctx.strokeStyle = "rgba(0,0,0,.16)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.translate(0, -1.2);
    ctx.strokeStyle = "rgba(255,230,190,.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.translate(0, 1.2);
  }
  for (let pit = 0; pit < 4; pit += 1) {
    ctx.fillStyle = "rgba(0,0,0,.16)";
    ctx.beginPath();
    ctx.arc(x + pseudo(index + pit, seed + 23) * width, y + pseudo(index + pit, seed + 24) * height, 1.2 + pseudo(index + pit, seed + 25) * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const detailRoll = pseudo(index, seed + 26);
  if (variant.plateDetail === "bones" && detailRoll > .78) {
    ctx.strokeStyle = rgba(BONE, .32);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let rib = 0; rib < 3; rib += 1) {
      ctx.beginPath();
      ctx.arc(x + width / 2, y + height + 6, 22 + rib * 13, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else if (variant.plateDetail === "amber" && detailRoll > .7) {
    ctx.strokeStyle = rgba(theme.edge, .18);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y + height * .6);
    ctx.quadraticCurveTo(x + width * .5, y + height * .3, x + width, y + height * .55);
    ctx.stroke();
    ctx.strokeStyle = rgba(theme.edge, .55);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else if (variant.plateDetail === "nest" && detailRoll > .78) {
    ctx.fillStyle = rgba(theme.detail, .16);
    ctx.beginPath(); ctx.ellipse(x + width / 2, y + height / 2, width * .32, height * .22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba(theme.detail, .3);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (variant.plateDetail === "crystal" && detailRoll > .8) {
    const cx = x + width * (.3 + pseudo(index, seed + 27) * .4);
    const cy = y + height * .72;
    for (let spike = -2; spike <= 2; spike += 1) {
      ctx.fillStyle = rgba(spike % 2 ? theme.detail : "#e0fbff", .42);
      ctx.beginPath();
      ctx.moveTo(cx + spike * 6 - 2.5, cy);
      ctx.lineTo(cx + spike * 7, cy - 30 + Math.abs(spike) * 7);
      ctx.lineTo(cx + spike * 6 + 2.5, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
  ctx.save();
  slabPath(ctx, x, y, width, height, 9);
  ctx.strokeStyle = "rgba(40,18,8,.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

const SCATTER = {
  bone(ctx, x, y, size, theme, roll) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll * Math.PI);
    ctx.strokeStyle = rgba(BONE, .55);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.stroke();
    ctx.fillStyle = rgba(BONE, .55);
    for (const end of [-size, size]) {
      ctx.beginPath(); ctx.arc(end, -1.6, 2, 0, Math.PI * 2); ctx.arc(end, 1.6, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
  chitinShard(ctx, x, y, size, theme, roll) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll * Math.PI * 2);
    ctx.fillStyle = "rgba(40,20,12,.6)";
    ctx.beginPath();
    ctx.moveTo(-size, size * .3);
    ctx.quadraticCurveTo(0, -size * .9, size, size * .3);
    ctx.quadraticCurveTo(0, -size * .2, -size, size * .3);
    ctx.fill();
    ctx.strokeStyle = rgba(theme.detail, .35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },
  amber(ctx, x, y, size, theme) {
    ctx.fillStyle = rgba(theme.edge, .45);
    ctx.beginPath(); ctx.ellipse(x, y, size * .9, size * .65, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,240,200,.45)";
    ctx.beginPath(); ctx.ellipse(x - size * .3, y - size * .2, size * .25, size * .15, -.5, 0, Math.PI * 2); ctx.fill();
  },
  needle(ctx, x, y, size, theme) {
    for (let spike = -1; spike <= 1; spike += 1) {
      ctx.strokeStyle = rgba(spike ? theme.detail : "#e0fbff", .55);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + spike * 4, y);
      ctx.lineTo(x + spike * 7, y - size * 1.6 + Math.abs(spike) * 4);
      ctx.stroke();
    }
  },
  burrow(ctx, x, y, size) {
    ctx.fillStyle = "rgba(255,225,180,.12)";
    ctx.beginPath(); ctx.ellipse(x, y + 1, size * 1.4, size * .7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(15,6,2,.6)";
    ctx.beginPath(); ctx.ellipse(x, y, size * .9, size * .42, 0, 0, Math.PI * 2); ctx.fill();
  },
};

const RAILS = {
  // Bleached rib bones arching along the border.
  ribs(ctx, y, theme) {
    ctx.strokeStyle = rgba(BONE, .6);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    for (let x = 8; x < 1100; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, y + RAIL - 1);
      ctx.quadraticCurveTo(x + 5, y + 1, x + 10, y + RAIL - 1);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(theme.edge, .35);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y + RAIL - .5); ctx.lineTo(1100, y + RAIL - .5); ctx.stroke();
  },
};

export const CHAPTER_THREE_DECOR = Object.freeze({
  plates: { sandstone: drawSandstonePlate },
  scatter: SCATTER,
  rails: RAILS,
});

const burrows = (count) => ({ count, style: "burrow", steam: "222,184,135", glow: "0,0,0" });
const shared = { tint: null, rail: "ribs", lights: null, sparks: null, sheen: null, flares: null, weather: {} };

const CHAPTER_THREE_VARIANTS = Object.freeze({
  "chitin-threshold": {
    ...shared,
    plateDetail: null,
    chitinChance: .08,
    scatter: ["ripple", "ripple", "chitinShard", "burrow", "stain"],
    vents: burrows(3),
    lights: { colors: ["#22d3ee", "#67e8f9"], blink: "slow" },
    glow: { kind: "spots", count: 6, color: "34,211,238" },
    sandDrift: { count: 30, color: "236,200,150", speed: 60 },
    motes: null,
  },
  "sun-ossuary": {
    ...shared,
    plateDetail: "bones",
    chitinChance: .05,
    scatter: ["bone", "bone", "ripple", "rubble", "stain"],
    vents: burrows(2),
    glow: null,
    sandDrift: { count: 24, color: "243,220,180", speed: 55 },
    motes: { count: 8, color: "255,230,190" },
  },
  "amber-crater": {
    ...shared,
    plateDetail: "amber",
    chitinChance: .06,
    scatter: ["amber", "amber", "rubble", "ripple", "glowCrack"],
    vents: burrows(2),
    glow: { kind: "veins", count: 6, color: "251,146,60" },
    sandDrift: { count: 20, color: "240,190,130", speed: 50 },
    motes: { count: 10, color: "255,170,80" },
  },
  "shallow-galleries": {
    ...shared,
    plateDetail: null,
    chitinChance: .16,
    scatter: ["chitinShard", "burrow", "burrow", "ripple", "stain"],
    vents: burrows(4),
    glow: { kind: "spots", count: 8, color: "34,211,238" },
    sandDrift: { count: 16, color: "230,195,150", speed: 45 },
    motes: { count: 16, color: "167,139,250" },
  },
  "buried-nursery": {
    ...shared,
    plateDetail: "nest",
    chitinChance: .1,
    scatter: ["resin", "resin", "chitinShard", "vein", "burrow"],
    vents: burrows(2),
    glow: { kind: "eggs", count: 6, color: "163,230,53" },
    sandDrift: { count: 16, color: "230,190,140", speed: 45 },
    motes: { count: 10, color: "190,240,120" },
  },
  "needle-grove": {
    ...shared,
    plateDetail: "crystal",
    chitinChance: .05,
    scatter: ["needle", "needle", "ripple", "glitter", "stain"],
    vents: null,
    glow: { kind: "spots", count: 5, color: "103,232,249" },
    sandDrift: { count: 24, color: "240,215,170", speed: 55 },
    motes: { count: 10, color: "200,250,255" },
    sheen: { color: "255,230,170", period: 9000 },
    flares: { count: 3 },
  },
  "living-dust-valley": {
    ...shared,
    plateDetail: null,
    chitinChance: .08,
    scatter: ["ripple", "ripple", "bone", "rubble", "burrow"],
    vents: burrows(3),
    glow: null,
    sandDrift: { count: 70, color: "240,200,150", speed: 110 },
    motes: { count: 14, color: "240,200,150" },
  },
  "chitin-throne": {
    ...shared,
    plateDetail: "bones",
    chitinChance: .2,
    scatter: ["chitinShard", "bone", "vein", "amber", "needle"],
    vents: null,
    lights: { colors: ["#67e8f9", "#f59e0b"], blink: "pulse" },
    glow: { kind: "veins", count: 7, color: "103,232,249" },
    sandDrift: { count: 20, color: "235,195,145", speed: 50 },
    motes: { count: 12, color: "103,232,249" },
    flares: { count: 2 },
  },
});

export const CHAPTER_THREE_BIOME = Object.freeze({
  plate: "sandstone",
  fallback: "chitin-threshold",
  phases: CHAPTER_THREE_VARIANTS,
});
