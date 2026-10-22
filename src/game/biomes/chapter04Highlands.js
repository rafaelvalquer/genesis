import { pseudo, rgba } from "./decorMath.js";

// Chapter 4, "Cumes da Tempestade": storm-swept highlands. Plates are
// irregular mountain flagstones with grass growing in the joints, wet in the
// rainy phases; details are tufts, pebbles, puddles and lichen.

const RAIL = 12;

function stonePolygon(cell, seed) {
  const { x, y, width, height, index } = cell;
  const inset = (corner, axis) => 6 + pseudo(index * 8 + corner * 2 + axis, seed + 31) * 12;
  const jitter = (salt) => (pseudo(index, seed + salt) - .5) * 14;
  return [
    [x + inset(0, 0), y + inset(0, 1)],
    [x + width * .5 + jitter(49), y + 4 + pseudo(index, seed + 32) * 6],
    [x + width - inset(1, 0), y + inset(1, 1)],
    [x + width - 4 - pseudo(index, seed + 33) * 6, y + height * .5 + jitter(50)],
    [x + width - inset(2, 0), y + height - inset(2, 1)],
    [x + width * .5 + jitter(51), y + height - 4 - pseudo(index, seed + 34) * 6],
    [x + inset(3, 0), y + height - inset(3, 1)],
    [x + 4 + pseudo(index, seed + 35) * 6, y + height * .5 + jitter(52)],
  ];
}

function tracePolygon(ctx, points) {
  ctx.beginPath();
  points.forEach(([px, py], point) => ctx[point ? "lineTo" : "moveTo"](px, py));
  ctx.closePath();
}

// An irregular flagstone sitting in grass (or bare rock on the bleak peaks).
// Some cells hold two smaller stones so the grid does not read as a grid.
function drawFlagstonePlate(ctx, cell, theme, variant) {
  const { x, y, width, height, index } = cell;
  ctx.fillStyle = variant.grass || "#1d2228";
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  if (pseudo(index, theme.seed + 48) > .62) {
    const half = height / 2;
    drawStone(ctx, { ...cell, height: half, index: index + 1000 }, theme, variant);
    drawStone(ctx, { ...cell, y: y + half, height: half, index: index + 2000 }, theme, variant);
  } else {
    drawStone(ctx, cell, theme, variant);
  }
}

function drawStone(ctx, cell, theme, variant) {
  const { x, y, width, height, index, row, column } = cell;
  const seed = theme.seed;
  const points = stonePolygon(cell, seed);
  const stone = ctx.createLinearGradient(x, y, x + width, y + height);
  stone.addColorStop(0, rgba(theme.laneAlt, 1));
  stone.addColorStop(1, rgba(theme.lane, 1));
  tracePolygon(ctx, points);
  ctx.fillStyle = stone;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if ((row + column) % 2) {
    ctx.fillStyle = "rgba(255,255,255,.03)";
    ctx.fillRect(x, y, width, height);
  }
  // Weathered stone is darker than the theme's lane color, and every stone
  // differs a little in tone and warmth.
  ctx.fillStyle = `rgba(8,12,18,${.24 + pseudo(index, seed + 36) * .18})`;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = pseudo(index, seed + 53) > .5 ? "rgba(120,100,70,.08)" : "rgba(70,95,130,.08)";
  ctx.fillRect(x, y, width, height);
  for (let speck = 0; speck < 14; speck += 1) {
    ctx.fillStyle = speck % 3 ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.08)";
    ctx.fillRect(x + pseudo(index * 20 + speck, seed + 37) * width, y + pseudo(index * 20 + speck, seed + 38) * height, 2, 2);
  }
  if (pseudo(index, seed + 39) > .55) {
    ctx.strokeStyle = "rgba(0,0,0,.3)";
    ctx.lineWidth = 1.3;
    const cx = x + width * (.3 + pseudo(index, seed + 40) * .4);
    ctx.beginPath();
    ctx.moveTo(cx, y + 6);
    ctx.lineTo(cx + 8, y + height * .4);
    ctx.lineTo(cx - 4, y + height * .7);
    ctx.stroke();
  }
  if (variant.lichen && pseudo(index, seed + 41) > .6) {
    ctx.fillStyle = variant.lichen;
    ctx.beginPath();
    ctx.ellipse(x + width * pseudo(index, seed + 42), y + height * pseudo(index, seed + 43), 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (variant.wet) {
    const gloss = ctx.createLinearGradient(x, y, x + width * .6, y + height);
    gloss.addColorStop(0, "rgba(200,220,255,.14)");
    gloss.addColorStop(1, "rgba(200,220,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(x, y, width, height);
    if (pseudo(index, seed + 44) > .72) {
      ctx.fillStyle = "rgba(10,18,30,.45)";
      ctx.beginPath();
      ctx.ellipse(x + width * .55, y + height * .62, width * .26, height * .1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(190,215,255,.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.restore();
  tracePolygon(ctx, points);
  ctx.strokeStyle = "rgba(0,0,0,.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(points[7][0], points[7][1]); ctx.lineTo(points[0][0], points[0][1]); ctx.lineTo(points[1][0], points[1][1]);
  ctx.stroke();

  if (variant.grassBlade) {
    ctx.strokeStyle = variant.grassBlade;
    ctx.lineWidth = 1.2;
    for (let blade = 0; blade < 9; blade += 1) {
      const [px, py] = points[Math.floor(pseudo(index * 6 + blade, seed + 45) * points.length)];
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (pseudo(index * 6 + blade, seed + 46) - .5) * 6, py - 5 - pseudo(index * 6 + blade, seed + 47) * 5);
      ctx.stroke();
    }
  }
}

const SCATTER = {
  tuft(ctx, x, y, size, theme, roll) {
    ctx.strokeStyle = `rgba(${110 + roll * 40},${150 + roll * 30},80,.6)`;
    ctx.lineWidth = 1.3;
    ctx.lineCap = "round";
    for (let blade = -2; blade <= 2; blade += 1) {
      ctx.beginPath();
      ctx.moveTo(x + blade * 2, y);
      ctx.lineTo(x + blade * 4, y - size * (.8 + Math.abs(blade) * -.1));
      ctx.stroke();
    }
  },
  pebbles(ctx, x, y, size) {
    for (let stone = 0; stone < 4; stone += 1) {
      const r = 1.6 + (stone % 2) * 1.4;
      ctx.fillStyle = "rgba(0,0,0,.3)";
      ctx.beginPath(); ctx.arc(x + stone * size * .6, y + (stone % 2) * 4 + 1, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(200,205,210,.32)";
      ctx.beginPath(); ctx.arc(x + stone * size * .6, y + (stone % 2) * 4, r, 0, Math.PI * 2); ctx.fill();
    }
  },
  puddle(ctx, x, y, size) {
    ctx.fillStyle = "rgba(12,22,36,.45)";
    ctx.beginPath(); ctx.ellipse(x, y, size * 2.2, size * .8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(190,215,255,.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  },
  lichen(ctx, x, y, size) {
    for (let blot = 0; blot < 3; blot += 1) {
      ctx.fillStyle = "rgba(180,190,90,.2)";
      ctx.beginPath(); ctx.arc(x + blot * size * .5, y + (blot % 2) * 3, size * .5, 0, Math.PI * 2); ctx.fill();
    }
  },
};

const RAILS = {
  // A band of rounded rocks along a cliff edge, with tufts in the gaps.
  cliff(ctx, y) {
    ctx.fillStyle = "#2a3038";
    ctx.fillRect(0, y, 1100, RAIL);
    for (let x = 0, rock = 0; x < 1100; x += 14, rock += 1) {
      const r = 6 + (rock % 3) * 1.4;
      ctx.fillStyle = rock % 2 ? "#4b5561" : "#3c4550";
      ctx.beginPath(); ctx.ellipse(x + 7, y + RAIL / 2, r, RAIL / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.fillRect(x + 4, y + 2, 5, 1.5);
      if (rock % 4 === 0) {
        ctx.strokeStyle = "rgba(130,170,90,.7)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x + 13, y + RAIL); ctx.lineTo(x + 12, y + 3); ctx.moveTo(x + 14, y + RAIL); ctx.lineTo(x + 16, y + 4); ctx.stroke();
      }
    }
  },
};

export const CHAPTER_FOUR_DECOR = Object.freeze({
  plates: { flagstone: drawFlagstonePlate },
  scatter: SCATTER,
  rails: RAILS,
});

const shared = {
  tint: null, rail: "cliff", vents: null, lights: null, sparks: null, glow: null,
  sheen: null, flares: null, motes: null, weather: {},
};
const MEADOW = "#24331f";
const WET_MEADOW = "#1c2a20";

// The storm builds from a clear windy pass to the gale on the throne.
// Rain and lightning only come from here when the phase's own ambient
// effects ("rain", "lightning") do not already draw them.
const CHAPTER_FOUR_VARIANTS = Object.freeze({
  "wind-pass": {
    ...shared,
    grass: MEADOW, grassBlade: "rgba(140,180,90,.6)", lichen: "rgba(180,190,90,.16)",
    scatter: ["tuft", "tuft", "pebbles", "lichen", "cracks"],
    grassSway: { count: 26, color: "140,185,95" },
    cloudShadows: { count: 3, speed: 22, alpha: .16 },
    sandDrift: { count: 14, color: "225,235,245", speed: 120 },
    weather: { lightning: .3 },
  },
  "alpine-fields": {
    ...shared,
    grass: "#2b3d22", grassBlade: "rgba(150,195,95,.7)", lichen: "rgba(190,200,100,.18)",
    scatter: ["tuft", "tuft", "tuft", "pebbles", "lichen"],
    grassSway: { count: 40, color: "150,200,100" },
    cloudShadows: { count: 3, speed: 18, alpha: .14 },
    sandDrift: { count: 10, color: "225,235,245", speed: 100 },
    weather: { rain: .45 },
  },
  "thunder-gorge": {
    ...shared,
    grass: WET_MEADOW, grassBlade: "rgba(120,160,90,.55)", lichen: "rgba(170,180,90,.14)", wet: true,
    scatter: ["puddle", "pebbles", "tuft", "rubble", "cracks"],
    grassSway: { count: 20, color: "120,165,90" },
    cloudShadows: { count: 4, speed: 26, alpha: .2 },
    sandDrift: { count: 16, color: "220,230,245", speed: 130 },
    weather: { lightning: .35 },
  },
  "lightning-plateau": {
    ...shared,
    grass: "#1a2420", grassBlade: "rgba(110,150,85,.5)", lichen: null, wet: true,
    scatter: ["puddle", "puddle", "cracks", "rubble", "pebbles"],
    grassSway: { count: 14, color: "110,150,85" },
    cloudShadows: { count: 4, speed: 30, alpha: .22 },
    sandDrift: { count: 18, color: "220,230,245", speed: 140 },
    glow: { kind: "cracks", count: 4, color: "250,204,21" },
  },
  "current-valley": {
    ...shared,
    grass: "#1f3328", grassBlade: "rgba(130,185,110,.6)", lichen: "rgba(170,190,110,.16)", wet: true,
    scatter: ["puddle", "puddle", "tuft", "pebbles", "lichen"],
    grassSway: { count: 30, color: "130,185,110" },
    cloudShadows: { count: 3, speed: 20, alpha: .16 },
    sandDrift: { count: 14, color: "220,235,250", speed: 110 },
    weather: { lightning: .35 },
  },
  "broken-summit": {
    ...shared,
    grass: "#1c2226", grassBlade: "rgba(110,140,90,.45)", lichen: null, wet: true,
    scatter: ["rubble", "rubble", "cracks", "puddle", "pebbles"],
    grassSway: { count: 10, color: "110,140,90" },
    cloudShadows: { count: 4, speed: 34, alpha: .22 },
    sandDrift: { count: 34, color: "215,225,240", speed: 170 },
    motes: { count: 10, color: "150,160,175" },
  },
  "storm-eye": {
    ...shared,
    grass: "#1d1f2a", grassBlade: null, lichen: null,
    scatter: ["rubble", "cracks", "pebbles", "rubble"],
    cloudShadows: { count: 5, speed: 40, alpha: .24 },
    sandDrift: { count: 40, color: "205,200,240", speed: 190 },
    motes: { count: 16, color: "150,155,180" },
    glow: { kind: "cracks", count: 5, color: "196,181,253" },
    weather: { lightning: .8 },
  },
  "storm-throne": {
    ...shared,
    grass: "#16181f", grassBlade: null, lichen: null, wet: true,
    scatter: ["puddle", "rubble", "cracks", "rubble"],
    cloudShadows: { count: 5, speed: 44, alpha: .26 },
    sandDrift: { count: 46, color: "210,215,245", speed: 210 },
    motes: { count: 12, color: "160,165,190" },
    glow: { kind: "cracks", count: 6, color: "251,191,36" },
    weather: { rain: 1.8, lightning: 1 },
  },
});

export const CHAPTER_FOUR_BIOME = Object.freeze({
  plate: "flagstone",
  fallback: "wind-pass",
  phases: CHAPTER_FOUR_VARIANTS,
});
