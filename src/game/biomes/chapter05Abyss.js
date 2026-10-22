import { pseudo, rgba } from "./decorMath.js";

// Chapter 5, "Abismo de Nereida": a drowned coast sinking into the abyss.
// Every phase has its own seabed (wreck decking, mangrove mud, ossified
// coral, rusted station metal, hydrothermal rock, fleshy gardens, leviathan
// bone, abyssal dark), all wet; details are shells, starfish, kelp and
// barnacles.

const RAIL = 12;

function slabPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
  else ctx.rect(x, y, width, height);
}

function specks(ctx, cell, seed, count, color, size = 2) {
  const { x, y, width, height, index } = cell;
  ctx.fillStyle = color;
  for (let speck = 0; speck < count; speck += 1) {
    ctx.beginPath();
    ctx.arc(x + pseudo(index * 30 + speck, seed + 61) * width, y + pseudo(index * 30 + speck, seed + 62) * height, size * (.5 + pseudo(index * 30 + speck, seed + 63)), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Each kind paints the seabed of one cell; the shared wet finish comes after.
const SEABED = {
  deck(ctx, cell) {
    const { x, y, width, height, index } = cell;
    const planks = 4;
    for (let plank = 0; plank < planks; plank += 1) {
      const py = y + plank * height / planks;
      const tone = pseudo(index * 4 + plank, 71);
      ctx.fillStyle = `rgb(${62 + tone * 22},${44 + tone * 14},${30 + tone * 8})`;
      ctx.fillRect(x, py + 1, width, height / planks - 2);
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.lineWidth = 1;
      for (let grain = 0; grain < 3; grain += 1) {
        const gy = py + 5 + grain * 7;
        ctx.beginPath(); ctx.moveTo(x + 4, gy); ctx.bezierCurveTo(x + width * .3, gy - 2, x + width * .7, gy + 2, x + width - 4, gy); ctx.stroke();
      }
      ctx.fillStyle = "rgba(20,14,10,.8)";
      ctx.fillRect(x + 6, py + 6, 3, 3);
      ctx.fillRect(x + width - 9, py + 6, 3, 3);
    }
  },
  mud(ctx, cell, theme) {
    const { x, y, width, height, index } = cell;
    ctx.fillStyle = "#26301f";
    ctx.fillRect(x, y, width, height);
    specks(ctx, cell, 81, 10, "rgba(0,0,0,.25)", 3);
    ctx.strokeStyle = "rgba(70,55,35,.85)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    if (pseudo(index, 82) > .45) {
      ctx.beginPath();
      ctx.moveTo(x, y + height * pseudo(index, 83));
      ctx.bezierCurveTo(x + width * .3, y + height * .2, x + width * .6, y + height * .9, x + width, y + height * pseudo(index, 84));
      ctx.stroke();
    }
    ctx.fillStyle = rgba(theme.detail, .12);
    ctx.fillRect(x, y, width, height);
  },
  coral(ctx, cell) {
    const { x, y, width, height } = cell;
    const rock = ctx.createLinearGradient(x, y, x + width, y + height);
    rock.addColorStop(0, "#6f6a86");
    rock.addColorStop(1, "#3c3a52");
    slabPath(ctx, x + 3, y + 3, width - 6, height - 6, 16);
    ctx.fillStyle = rock;
    ctx.fill();
    specks(ctx, cell, 91, 18, "rgba(20,15,40,.4)", 2.4);
    specks(ctx, cell, 92, 8, "rgba(230,220,255,.18)", 1.6);
  },
  rustMetal(ctx, cell) {
    const { x, y, width, height, index } = cell;
    const metal = ctx.createLinearGradient(x, y, x, y + height);
    metal.addColorStop(0, "#2e4a58");
    metal.addColorStop(1, "#1a2e3a");
    ctx.fillStyle = metal;
    ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
    ctx.fillStyle = "rgba(160,80,30,.32)";
    for (let patch = 0; patch < 3; patch += 1) {
      ctx.beginPath();
      ctx.ellipse(x + pseudo(index * 3 + patch, 101) * width, y + pseudo(index * 3 + patch, 102) * height, 8 + pseudo(index + patch, 103) * 12, 5 + pseudo(index + patch, 104) * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,.5)";
    for (const [rx, ry] of [[6, 6], [width - 9, 6], [6, height - 9], [width - 9, height - 9]]) ctx.fillRect(x + rx, y + ry, 3, 3);
    ctx.strokeStyle = "rgba(125,211,252,.18)";
    ctx.strokeRect(x + 2.5, y + 2.5, width - 5, height - 5);
  },
  rock(ctx, cell, theme) {
    const { x, y, width, height, index } = cell;
    ctx.fillStyle = "#1f2a2d";
    slabPath(ctx, x + 2, y + 2, width - 4, height - 4, 10);
    ctx.fill();
    specks(ctx, cell, 111, 12, "rgba(0,0,0,.35)", 2.5);
    if (pseudo(index, 112) > .5) {
      ctx.strokeStyle = rgba(theme.detail, .35);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + height * pseudo(index, 113));
      ctx.lineTo(x + width * .5, y + height * pseudo(index, 114));
      ctx.lineTo(x + width - 8, y + height * pseudo(index, 115));
      ctx.stroke();
    }
  },
  organic(ctx, cell, theme) {
    const { x, y, width, height } = cell;
    const flesh = ctx.createRadialGradient(x + width / 2, y + height / 2, 6, x + width / 2, y + height / 2, width * .7);
    flesh.addColorStop(0, "#3d2f55");
    flesh.addColorStop(1, "#1e1a33");
    slabPath(ctx, x + 2, y + 2, width - 4, height - 4, 24);
    ctx.fillStyle = flesh;
    ctx.fill();
    specks(ctx, cell, 121, 9, rgba(theme.detail, .3), 2.6);
    specks(ctx, cell, 122, 6, "rgba(0,0,0,.4)", 3);
  },
  bone(ctx, cell) {
    const { x, y, width, height, index } = cell;
    ctx.fillStyle = "#1a2638";
    ctx.fillRect(x, y, width, height);
    if (pseudo(index, 131) > .4) {
      ctx.fillStyle = "rgba(205,200,180,.32)";
      for (let rib = 0; rib < 4; rib += 1) {
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + 16 + rib * (height - 28) / 3, width * .38, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(205,200,180,.38)";
      ctx.fillRect(x + width / 2 - 4, y + 8, 8, height - 16);
    }
    specks(ctx, cell, 132, 8, "rgba(0,0,0,.3)", 2.4);
  },
  abyss(ctx, cell, theme) {
    const { x, y, width, height, index } = cell;
    ctx.fillStyle = "#111528";
    slabPath(ctx, x + 2, y + 2, width - 4, height - 4, 12);
    ctx.fill();
    if (pseudo(index, 141) > .7) {
      ctx.strokeStyle = rgba(theme.edge, .3);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + width / 2, y + height / 2, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + width / 2, y + height / 2, 9, 0, Math.PI * 2); ctx.stroke();
    }
    specks(ctx, cell, 142, 5, rgba(theme.detail, .35), 1.4);
  },
};

function drawSeabedPlate(ctx, cell, theme, variant) {
  const { x, y, width, height, row, column } = cell;
  ctx.beginPath();
  ctx.rect(x - 1, y - 1, width + 2, height + 2);
  ctx.clip();
  (SEABED[variant.seabed] || SEABED.rock)(ctx, cell, theme);
  // Everything down here is wet: a cool gloss and a faint water tint.
  const gloss = ctx.createLinearGradient(x, y, x + width * .7, y + height);
  gloss.addColorStop(0, "rgba(190,240,255,.12)");
  gloss.addColorStop(1, "rgba(190,240,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = (row + column) % 2 ? rgba(theme.edge, .05) : "rgba(0,10,20,.12)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + .5, y + .5, width - 1, height - 1);
}

const SCATTER = {
  shell(ctx, x, y, size, theme, roll) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((roll - .5) * 1.2);
    ctx.fillStyle = "rgba(235,215,190,.5)";
    ctx.beginPath(); ctx.moveTo(0, size * .5); ctx.arc(0, size * .5, size * .9, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(120,90,70,.5)";
    ctx.lineWidth = .8;
    for (let rib = -2; rib <= 2; rib += 1) {
      ctx.beginPath(); ctx.moveTo(0, size * .5); ctx.lineTo(rib * size * .3, -size * .25); ctx.stroke();
    }
    ctx.restore();
  },
  starfish(ctx, x, y, size, theme, roll) {
    ctx.fillStyle = roll > .5 ? "rgba(251,146,60,.55)" : "rgba(244,114,182,.5)";
    ctx.beginPath();
    for (let arm = 0; arm < 10; arm += 1) {
      const angle = roll * 2 + arm * Math.PI / 5;
      const r = arm % 2 ? size * .35 : size * .95;
      ctx[arm ? "lineTo" : "moveTo"](x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
  },
  seaweed(ctx, x, y, size, theme, roll) {
    ctx.strokeStyle = `rgba(${40 + roll * 40},${120 + roll * 40},90,.55)`;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let strand = -1; strand <= 1; strand += 1) {
      ctx.beginPath();
      ctx.moveTo(x + strand * 4, y);
      ctx.bezierCurveTo(x + strand * 4 + 6, y - size * .7, x + strand * 4 - 6, y - size * 1.3, x + strand * 6, y - size * 2);
      ctx.stroke();
    }
  },
  barnacles(ctx, x, y, size) {
    for (let shell = 0; shell < 5; shell += 1) {
      const bx = x + Math.cos(shell * 1.9) * size * .8;
      const by = y + Math.sin(shell * 2.3) * size * .5;
      ctx.fillStyle = "rgba(210,205,190,.45)";
      ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.5)";
      ctx.beginPath(); ctx.arc(bx, by, 1, 0, Math.PI * 2); ctx.fill();
    }
  },
};

const RAILS = {
  // Wet dark stones with a rope running along them and barnacle crusts.
  wetStone(ctx, y) {
    ctx.fillStyle = "#16242b";
    ctx.fillRect(0, y, 1100, RAIL);
    for (let x = 0, stone = 0; x < 1100; x += 16, stone += 1) {
      ctx.fillStyle = stone % 2 ? "#23363f" : "#1c2d35";
      ctx.beginPath(); ctx.ellipse(x + 8, y + RAIL / 2, 8, RAIL / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(190,240,255,.16)";
      ctx.fillRect(x + 4, y + 2, 6, 1.5);
      if (stone % 3 === 0) {
        ctx.fillStyle = "rgba(210,205,190,.45)";
        ctx.beginPath(); ctx.arc(x + 12, y + RAIL - 3, 1.8, 0, Math.PI * 2); ctx.arc(x + 9, y + RAIL - 2, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(160,130,90,.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(0, y + RAIL / 2); ctx.lineTo(1100, y + RAIL / 2); ctx.stroke();
    ctx.setLineDash([]);
  },
};

export const CHAPTER_FIVE_DECOR = Object.freeze({
  plates: { seabed: drawSeabedPlate },
  scatter: SCATTER,
  rails: RAILS,
});

const shared = {
  tint: null, rail: "wetStone", vents: null, lights: null, sparks: null, glow: null,
  sheen: null, flares: null, weather: {},
};

const CHAPTER_FIVE_VARIANTS = Object.freeze({
  "nereida-wreck-coast": {
    ...shared,
    seabed: "deck",
    scatter: ["shell", "barnacles", "seaweed", "puddle", "rubble"],
    caustics: { color: "160,240,255" },
    bubbles: { count: 10 },
    grassSway: { count: 12, color: "60,150,110", height: 22 },
    motes: { count: 8, color: "103,232,249" },
  },
  "nereida-luminous-mangrove": {
    ...shared,
    seabed: "mud",
    scatter: ["seaweed", "seaweed", "shell", "puddle", "moss"],
    caustics: { color: "170,255,210" },
    bubbles: { count: 8 },
    grassSway: { count: 24, color: "90,170,90", height: 20 },
    motes: { count: 18, color: "163,230,53" },
    glow: { kind: "spots", count: 6, color: "94,234,212" },
  },
  "nereida-ossified-reef": {
    ...shared,
    seabed: "coral",
    scatter: ["shell", "starfish", "barnacles", "seaweed"],
    caustics: { color: "200,230,255" },
    bubbles: { count: 14 },
    grassSway: { count: 12, color: "150,110,190", height: 20 },
    motes: { count: 12, color: "192,132,252" },
  },
  "nereida-flooded-station": {
    ...shared,
    seabed: "rustMetal",
    scatter: ["bolts", "plate", "barnacles", "puddle", "seaweed"],
    caustics: { color: "150,220,255" },
    bubbles: { count: 12 },
    vents: { count: 3, steam: "190,230,255", glow: "251,191,36" },
    lights: { colors: ["#fbbf24", "#7dd3fc"], blink: "pulse" },
    sparks: { count: 1, color: "255,220,150" },
    motes: { count: 6, color: "125,211,252" },
  },
  "nereida-hydrothermal-rifts": {
    ...shared,
    seabed: "rock",
    scatter: ["rubble", "cracks", "barnacles", "shell"],
    caustics: { color: "150,230,240" },
    bubbles: { count: 18 },
    vents: { count: 3, style: "burrow", steam: "220,230,240", glow: "0,0,0" },
    glow: { kind: "cracks", count: 6, color: "251,113,133" },
    motes: { count: 10, color: "255,150,150" },
  },
  "nereida-predatory-gardens": {
    ...shared,
    seabed: "organic",
    scatter: ["seaweed", "resin", "vein", "starfish"],
    caustics: { color: "190,170,255" },
    bubbles: { count: 10 },
    grassSway: { count: 30, color: "170,110,230", height: 24 },
    motes: { count: 14, color: "45,212,191" },
    glow: { kind: "veins", count: 5, color: "45,212,191" },
  },
  "nereida-leviathan-graveyard": {
    ...shared,
    seabed: "bone",
    scatter: ["bone", "shell", "barnacles", "rubble"],
    caustics: { color: "150,190,255" },
    bubbles: { count: 10 },
    grassSway: { count: 10, color: "70,130,120", height: 18 },
    motes: { count: 10, color: "167,139,250" },
    glow: { kind: "spots", count: 5, color: "147,197,253" },
  },
  "nereida-abyssal-throne": {
    ...shared,
    seabed: "abyss",
    scatter: ["vein", "starfish", "resin", "shell"],
    caustics: { color: "200,150,255" },
    bubbles: { count: 16 },
    grassSway: { count: 12, color: "200,110,230", height: 22 },
    motes: { count: 20, color: "34,211,238" },
    glow: { kind: "runes", count: 5, color: "232,121,249" },
  },
});

export const CHAPTER_FIVE_BIOME = Object.freeze({
  plate: "seabed",
  fallback: "nereida-wreck-coast",
  phases: CHAPTER_FIVE_VARIANTS,
});
