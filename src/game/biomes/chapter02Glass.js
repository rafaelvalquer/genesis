import { pseudo, rgba } from "./decorMath.js";

// Chapter 2, "Mar de Vidro": obsidian glass desert. Plates are faceted glass
// slabs; details are shards, prisms, lit cracks and glittering glass sand.

const RAIL = 12;

function slabPath(ctx, x, y, width, height) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, width, height, 6);
  else ctx.rect(x, y, width, height);
}

// A slab cut into four facets meeting at an off-center apex, lit from the
// top-left, so the floor reads as polished, uneven obsidian.
function drawObsidianPlate(ctx, cell, theme, variant) {
  const { x, y, width, height, index, row, column } = cell;
  const seed = theme.seed;
  const base = ctx.createLinearGradient(x, y, x + width, y + height);
  base.addColorStop(0, rgba(theme.laneAlt, 1));
  base.addColorStop(1, "#05060c");
  slabPath(ctx, x, y, width, height);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.clip();

  const apexX = x + width * (.3 + pseudo(index, seed + 11) * .4);
  const apexY = y + height * (.3 + pseudo(index, seed + 12) * .4);
  const corners = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
  const facetShade = ["rgba(255,255,255,.06)", "rgba(0,0,0,.1)", "rgba(0,0,0,.18)", "rgba(255,255,255,.03)"];
  corners.forEach(([cx, cy], facet) => {
    const [nx, ny] = corners[(facet + 1) % 4];
    ctx.beginPath();
    ctx.moveTo(apexX, apexY); ctx.lineTo(cx, cy); ctx.lineTo(nx, ny);
    ctx.closePath();
    ctx.fillStyle = facetShade[facet];
    ctx.fill();
  });
  ctx.strokeStyle = rgba(theme.edge, .16);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [cx, cy] of corners) { ctx.moveTo(apexX, apexY); ctx.lineTo(cx, cy); }
  ctx.stroke();

  if ((row + column) % 2) {
    ctx.fillStyle = "rgba(255,255,255,.025)";
    ctx.fillRect(x, y, width, height);
  }
  ctx.strokeStyle = "rgba(255,255,255,.1)";
  ctx.beginPath();
  ctx.moveTo(x + width * .12, y + height * .28);
  ctx.lineTo(x + width * .34, y + height * .08);
  ctx.stroke();

  if (variant.plateDetail === "ripples") {
    ctx.strokeStyle = rgba(theme.detail, .12);
    for (let ripple = 0; ripple < 4; ripple += 1) {
      const ry = y + height * (.2 + ripple * .2);
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.quadraticCurveTo(x + width / 2, ry - 8 + pseudo(index + ripple, seed + 13) * 6, x + width, ry);
      ctx.stroke();
    }
  } else if (variant.plateDetail === "mirrors" && pseudo(index, seed + 14) > .78) {
    const mirror = ctx.createLinearGradient(x, y, x + width, y + height);
    mirror.addColorStop(0, rgba(theme.edge, .26));
    mirror.addColorStop(.5, "rgba(255,255,255,.06)");
    mirror.addColorStop(1, rgba(theme.detail, .14));
    ctx.fillStyle = mirror;
    ctx.fillRect(x + 8, y + 8, width - 16, height - 16);
  } else if (variant.plateDetail === "crystals" && pseudo(index, seed + 15) > .8) {
    const cx = x + width * (.25 + pseudo(index, seed + 16) * .5);
    const cy = y + height * .7;
    for (let spike = -1; spike <= 1; spike += 1) {
      ctx.fillStyle = rgba(spike ? theme.edge : theme.detail, .4);
      ctx.beginPath();
      ctx.moveTo(cx + spike * 9 - 5, cy);
      ctx.lineTo(cx + spike * 9, cy - 22 + Math.abs(spike) * 8);
      ctx.lineTo(cx + spike * 9 + 5, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
  ctx.save();
  slabPath(ctx, x, y, width, height);
  ctx.strokeStyle = rgba(theme.edge, .24);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

const SCATTER = {
  shard(ctx, x, y, size, theme, roll) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll * Math.PI * 2);
    ctx.fillStyle = rgba(theme.edge, .3);
    ctx.strokeStyle = "rgba(255,255,255,.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-size * .3, size * .5); ctx.lineTo(0, -size * 1.2); ctx.lineTo(size * .4, size * .4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  },
  prism(ctx, x, y, size, theme) {
    const r = size * .75;
    const fill = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    fill.addColorStop(0, rgba(theme.detail, .55));
    fill.addColorStop(1, rgba(theme.edge, .25));
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let side = 0; side < 6; side += 1) {
      const angle = Math.PI / 6 + side * Math.PI / 3;
      ctx[side ? "lineTo" : "moveTo"](x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.fillRect(x - r * .3, y - r * .6, r * .25, r * .5);
  },
  glowCrack(ctx, x, y, size, theme) {
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - size, y - size * .3);
    ctx.lineTo(x - size * .2, y + size * .3);
    ctx.lineTo(x + size * .5, y - size * .4);
    ctx.lineTo(x + size * 1.3, y + size * .2);
    ctx.strokeStyle = rgba(theme.edge, .14);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = rgba(theme.edge, .5);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  },
  glitter(ctx, x, y, size, theme, roll) {
    for (let dot = 0; dot < 6; dot += 1) {
      ctx.fillStyle = dot % 2 ? "rgba(255,255,255,.5)" : rgba(theme.detail, .55);
      const dx = Math.cos(dot * 2.4 + roll * 6) * size * 1.4;
      const dy = Math.sin(dot * 1.7 + roll * 4) * size * .8;
      ctx.fillRect(x + dx, y + dy, 1.6, 1.6);
    }
  },
  ripple(ctx, x, y, size, theme) {
    ctx.strokeStyle = rgba(theme.detail, .16);
    ctx.lineWidth = 1.2;
    for (let arc = 0; arc < 3; arc += 1) {
      ctx.beginPath();
      ctx.moveTo(x - size * 2, y + arc * 5);
      ctx.quadraticCurveTo(x, y + arc * 5 - size * .6, x + size * 2, y + arc * 5);
      ctx.stroke();
    }
  },
};

const RAILS = {
  // A row of prismatic crystal spikes, alternating the phase's two glows.
  crystal(ctx, y, theme) {
    for (let x = 0, spike = 0; x < 1100; x += 18, spike += 1) {
      const tip = y + 1 + (spike % 3) * 1.5;
      ctx.fillStyle = rgba(spike % 2 ? theme.detail : theme.edge, .5);
      ctx.beginPath();
      ctx.moveTo(x, y + RAIL); ctx.lineTo(x + 6, tip); ctx.lineTo(x + 12, y + RAIL);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 6, tip); ctx.lineTo(x + 4, y + RAIL); ctx.stroke();
    }
  },
};

export const CHAPTER_TWO_DECOR = Object.freeze({
  plates: { obsidian: drawObsidianPlate },
  scatter: SCATTER,
  rails: RAILS,
});

const shared = { tint: null, rail: "crystal", vents: null, sparks: null, weather: {} };

const CHAPTER_TWO_VARIANTS = Object.freeze({
  "obsidian-coast": {
    ...shared,
    tint: "#1f8f8a",
    plateDetail: null,
    scatter: ["shard", "shard", "glowCrack", "glitter", "rubble"],
    lights: { colors: ["#7fffd4", "#8b5cf6"], blink: "slow" },
    motes: { count: 10, color: "200,255,240" },
    glow: { kind: "cracks", count: 5, color: "127,255,212" },
    sheen: { color: "180,255,240", period: 9000 },
    flares: null,
  },
  "singing-dunes": {
    ...shared,
    tint: "#c08a3a",
    plateDetail: "ripples",
    scatter: ["ripple", "ripple", "glitter", "shard", "stain"],
    lights: { colors: ["#ffcf70", "#a7f3d0"], blink: "slow" },
    motes: { count: 14, color: "255,225,150" },
    glow: null,
    sheen: { color: "255,220,160", period: 7000 },
    flares: null,
  },
  "shard-garden": {
    ...shared,
    tint: "#2f9a6a",
    plateDetail: "crystals",
    scatter: ["prism", "prism", "shard", "glitter", "glowCrack"],
    lights: { colors: ["#c084fc", "#7fffd4"], blink: "pulse" },
    motes: { count: 16, color: "190,160,255" },
    glow: { kind: "cracks", count: 4, color: "192,132,252" },
    sheen: { color: "200,180,255", period: 8000 },
    flares: { count: 3 },
  },
  "broken-observatory": {
    ...shared,
    tint: "#3a62a8",
    plateDetail: null,
    scatter: ["bolts", "plate", "shard", "rubble", "glowCrack"],
    lights: { colors: ["#93c5fd", "#ffcf70"], blink: "pulse" },
    sparks: { count: 2, color: "255,214,140" },
    motes: { count: 8, color: "200,220,255" },
    glow: null,
    sheen: { color: "180,210,255", period: 9000 },
    flares: null,
  },
  "mirror-canyon": {
    ...shared,
    tint: "#a04f9a",
    plateDetail: "mirrors",
    scatter: ["shard", "glitter", "rubble", "glowCrack", "stain"],
    lights: { colors: ["#f0abfc", "#7fffd4"], blink: "slow" },
    motes: { count: 10, color: "255,210,250" },
    glow: null,
    sheen: { color: "255,220,255", period: 6000 },
    flares: { count: 2 },
  },
  "prism-cathedral": {
    ...shared,
    tint: "#6a52c0",
    rail: "runic",
    plateDetail: "crystals",
    scatter: ["prism", "glitter", "shard", "glowCrack"],
    lights: { colors: ["#c4b5fd", "#ffcf70"], blink: "slow" },
    motes: { count: 14, color: "255,214,140" },
    glow: null,
    sheen: { color: "230,210,255", period: 8000 },
    flares: { count: 4 },
    weather: { searchlight: true },
  },
  "refraction-eye": {
    ...shared,
    tint: "#2a7fb0",
    plateDetail: null,
    scatter: ["glowCrack", "glowCrack", "shard", "glitter", "rubble"],
    lights: { colors: ["#7fffd4", "#8b5cf6"], blink: "pulse" },
    motes: { count: 12, color: "160,255,230" },
    glow: { kind: "cracks", count: 6, color: "127,255,212" },
    sheen: { color: "180,255,240", period: 7000 },
    flares: { count: 3 },
    weather: { lightning: true },
  },
  "reflection-throne": {
    ...shared,
    tint: "#9a6ac0",
    rail: "runic",
    plateDetail: "mirrors",
    scatter: ["prism", "shard", "glitter", "glowCrack"],
    lights: { colors: ["#e9d5ff", "#ffcf70"], blink: "pulse" },
    motes: { count: 14, color: "240,220,255" },
    glow: { kind: "runes", count: 5, color: "233,213,255" },
    sheen: { color: "240,225,255", period: 6500 },
    flares: { count: 4 },
  },
});

export const CHAPTER_TWO_BIOME = Object.freeze({
  plate: "obsidian",
  fallback: "obsidian-coast",
  phases: CHAPTER_TWO_VARIANTS,
});
