import { FIELD } from "../visualGeometry.js";
import { getFerrivorePhaseProfile } from "../chapter07/ferrivoreBiomeProfiles.js";
import { pseudo, rgba } from "./decorMath.js";

// Chapter 7, "Fronteira Ferrívora": a ferric forest swallowing the colony
// frontier. Combat rows are forest floor (moss, rust-red soil, leaf litter,
// cyan veins) dosed by each phase's ferrivore profile; the convoy row is a
// road whose surface follows the phase's route type.

const RAIL = 12;
const ROAD_HALF = 40;
const CYAN = "#63D8C7";

function drawForestFloor(ctx, cell, theme, profile) {
  const { x, y, width, height, index, row, column } = cell;
  const seed = theme.seed;
  const floor = ctx.createLinearGradient(x, y, x + width, y + height);
  floor.addColorStop(0, "#26321f");
  floor.addColorStop(1, "#151c12");
  ctx.fillStyle = floor;
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  const soil = Math.round(profile.infestation * 2);
  for (let patch = 0; patch < soil; patch += 1) {
    ctx.fillStyle = "rgba(130,55,30,.16)";
    ctx.beginPath();
    ctx.ellipse(x + pseudo(index * 9 + patch, seed + 171) * width, y + pseudo(index * 9 + patch, seed + 172) * height, 12 + pseudo(index + patch, seed + 173) * 16, 7 + pseudo(index + patch, seed + 174) * 8, pseudo(index, seed + 175) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const moss = Math.round(1 + profile.vegetationDensity * 2);
  for (let blob = 0; blob < moss; blob += 1) {
    ctx.fillStyle = blob % 2 ? "rgba(80,98,56,.26)" : "rgba(116,130,74,.18)";
    ctx.beginPath();
    ctx.ellipse(x + pseudo(index * 11 + blob, seed + 176) * width, y + pseudo(index * 11 + blob, seed + 177) * height, 8 + pseudo(index + blob, seed + 178) * 12, 5 + pseudo(index + blob, seed + 179) * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let leaf = 0; leaf < 4; leaf += 1) {
    const roll = pseudo(index * 13 + leaf, seed + 180);
    ctx.fillStyle = roll > .66 ? "rgba(168,78,45,.45)" : roll > .33 ? "rgba(116,130,74,.45)" : "rgba(68,53,35,.5)";
    ctx.beginPath();
    ctx.ellipse(x + pseudo(index * 13 + leaf, seed + 181) * width, y + pseudo(index * 13 + leaf, seed + 182) * height, 4, 2, roll * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pseudo(index, seed + 183) < profile.veins * .25) {
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + height * pseudo(index, seed + 184));
    ctx.bezierCurveTo(x + width * .35, y + height * .1, x + width * .65, y + height * .9, x + width, y + height * pseudo(index, seed + 185));
    ctx.strokeStyle = rgba(CYAN, .12);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = rgba(CYAN, .45);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.fillStyle = (row + column) % 2 ? "rgba(255,255,220,.025)" : "rgba(0,0,0,.07)";
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.strokeStyle = "rgba(0,0,0,.1)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, width - 1, height - 1);
}

// Repeating marks (sleepers, dashes, planks) are anchored to the field's x,
// not the cell's, so the road runs on unbroken from cell to cell.
function eachAnchored(start, end, step, offset, draw) {
  for (let mark = Math.ceil((start - offset) / step) * step + offset; mark < end; mark += step) draw(mark);
}

const ROADS = {
  paved(ctx, left, right, top, bottom) {
    ctx.fillStyle = "#2a2c2d";
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.fillStyle = "rgba(240,240,230,.45)";
    eachAnchored(left, right, 60, 10, (mark) => ctx.fillRect(mark, (top + bottom) / 2 - 2, 32, 4));
    ctx.fillStyle = "rgba(250,204,21,.28)";
    ctx.fillRect(left, top + 4, right - left, 2);
    ctx.fillRect(left, bottom - 6, right - left, 2);
  },
  dirt(ctx, left, right, top, bottom) {
    const mud = ctx.createLinearGradient(0, top, 0, bottom);
    mud.addColorStop(0, "#4a3a28"); mud.addColorStop(.5, "#5a4931"); mud.addColorStop(1, "#30281f");
    ctx.fillStyle = mud;
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.fillStyle = "rgba(25,18,10,.35)";
    ctx.fillRect(left, top + 18, right - left, 9);
    ctx.fillRect(left, bottom - 27, right - left, 9);
  },
  rail(ctx, left, right, top, bottom) {
    ctx.fillStyle = "#3b3631";
    ctx.fillRect(left, top, right - left, bottom - top);
    const center = (top + bottom) / 2;
    ctx.fillStyle = "rgba(75,56,40,.95)";
    eachAnchored(left, right, 38, 20, (mark) => ctx.fillRect(mark, center - 24, 8, 48));
    for (const offset of [-16, 16]) {
      ctx.fillStyle = "#6b6560";
      ctx.fillRect(left, center + offset - 2, right - left, 4);
      ctx.fillStyle = "rgba(220,225,230,.4)";
      ctx.fillRect(left, center + offset - 2, right - left, 1);
    }
  },
  industrial(ctx, left, right, top, bottom) {
    ctx.fillStyle = "#3a3d40";
    ctx.fillRect(left, top, right - left, bottom - top);
    const center = (top + bottom) / 2;
    ctx.fillStyle = "rgba(250,204,21,.6)";
    for (const edge of [top, bottom - 6]) {
      eachAnchored(left, right, 24, 0, (mark) => ctx.fillRect(mark, edge, 12, 6));
    }
    for (const offset of [-14, 14]) {
      ctx.fillStyle = "#7c7772";
      ctx.fillRect(left, center + offset - 2, right - left, 4);
    }
  },
  bridge(ctx, left, right, top, bottom) {
    ctx.fillStyle = "#07090a";
    ctx.fillRect(left, top, right - left, bottom - top);
    eachAnchored(left, right, 14, 0, (mark) => {
      ctx.fillStyle = (mark / 14) % 2 ? "#5a4330" : "#4d3828";
      ctx.fillRect(mark, top + 4, 12, bottom - top - 8);
    });
    ctx.fillStyle = "#2b2016";
    ctx.fillRect(left, top, right - left, 4);
    ctx.fillRect(left, bottom - 4, right - left, 4);
    ctx.fillStyle = "#6b5038";
    eachAnchored(left, right, 50, 0, (mark) => { ctx.fillRect(mark, top - 4, 5, 8); ctx.fillRect(mark, bottom - 4, 5, 8); });
  },
};

function roadSurface(kind) {
  if (kind === "damaged" || kind === "evacuation") return ROADS.paved;
  if (kind === "war") return ROADS.dirt;
  return ROADS[kind] || ROADS.paved;
}

function drawRoadCell(ctx, cell, theme, variant) {
  const { x, y, width, height, index } = cell;
  const seed = theme.seed;
  const center = y + height / 2;
  const top = center - ROAD_HALF;
  const bottom = center + ROAD_HALF;
  const left = x - 1;
  const right = x + width + 1;
  roadSurface(variant.road)(ctx, left, right, top, bottom);
  if (variant.road === "damaged" || variant.road === "war") {
    const holes = variant.road === "war" ? 2 : 1;
    for (let hole = 0; hole < holes; hole += 1) {
      if (pseudo(index * 3 + hole, seed + 191) < .45) continue;
      const hx = x + 15 + pseudo(index * 3 + hole, seed + 192) * (width - 30);
      const hy = top + 18 + pseudo(index * 3 + hole, seed + 193) * (ROAD_HALF * 2 - 36);
      const radius = variant.road === "war" ? 14 : 9;
      ctx.fillStyle = "rgba(120,100,80,.3)";
      ctx.beginPath(); ctx.ellipse(hx, hy, radius + 5, (radius + 5) * .6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = variant.road === "war" ? "rgba(15,10,8,.85)" : "rgba(20,30,35,.8)";
      ctx.beginPath(); ctx.ellipse(hx, hy, radius, radius * .6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (variant.road === "evacuation") {
    ctx.strokeStyle = rgba(CYAN, .55);
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    eachAnchored(left, right, 90, 30, (mark) => {
      ctx.beginPath();
      ctx.moveTo(mark, center - 14); ctx.lineTo(mark + 14, center); ctx.lineTo(mark, center + 14);
      ctx.stroke();
    });
  }
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(left, top - 3, right - left, 3);
  ctx.fillRect(left, bottom, right - left, 3);
}

function drawFrontierPlate(ctx, cell, theme, variant, phase) {
  const { x, y, width, height } = cell;
  ctx.beginPath();
  ctx.rect(x - 1, y - 1, width + 2, height + 2);
  ctx.clip();
  const profile = getFerrivorePhaseProfile(phase);
  drawForestFloor(ctx, cell, theme, profile);
  const transportRow = phase?.rules?.transportRow ?? 2;
  if (phase?.terrain?.mode === "convoy" && cell.row === transportRow) drawRoadCell(ctx, cell, theme, variant);
}

const SCATTER = {
  leafLitter(ctx, x, y, size, theme, roll) {
    for (let leaf = 0; leaf < 4; leaf += 1) {
      ctx.fillStyle = leaf % 2 ? "rgba(168,78,45,.5)" : "rgba(116,130,74,.5)";
      ctx.beginPath();
      ctx.ellipse(x + leaf * size * .5, y + (leaf % 2) * 4, size * .5, size * .22, roll * 6 + leaf, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  mushroom(ctx, x, y, size, theme, roll) {
    for (let cap = 0; cap < 3; cap += 1) {
      const cx = x + cap * 7;
      const cy = y + (cap % 2) * 3;
      ctx.fillStyle = "rgba(220,210,190,.6)";
      ctx.fillRect(cx - 1, cy - 4, 2, 5);
      ctx.fillStyle = roll > .5 ? rgba(CYAN, .7) : "rgba(200,90,60,.7)";
      ctx.beginPath(); ctx.ellipse(cx, cy - 4, 4, 2.4, 0, Math.PI, Math.PI * 2); ctx.fill();
    }
  },
  rustFlakes(ctx, x, y, size, theme, roll) {
    for (let flake = 0; flake < 5; flake += 1) {
      ctx.fillStyle = flake % 2 ? "rgba(168,78,45,.55)" : "rgba(120,55,30,.55)";
      ctx.fillRect(x + Math.cos(flake * 2.1 + roll) * size, y + Math.sin(flake * 1.7) * size * .6, 3, 2);
    }
  },
  fern(ctx, x, y, size) {
    ctx.strokeStyle = "rgba(90,120,60,.6)";
    ctx.lineWidth = 1.2;
    for (let frond = -2; frond <= 2; frond += 1) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + frond * 4, y - size, x + frond * 7, y - size * .6);
      ctx.stroke();
    }
  },
};

const RAILS = {
  // A dense hedge of dark foliage with roots spilling over the edge.
  roots(ctx, y) {
    ctx.fillStyle = "#0d140c";
    ctx.fillRect(0, y, FIELD.width, RAIL);
    for (let x = 0, leaf = 0; x < FIELD.width; x += 11, leaf += 1) {
      ctx.fillStyle = leaf % 3 === 0 ? "#3d4f2a" : leaf % 3 === 1 ? "#2b3a20" : "#506238";
      ctx.beginPath(); ctx.ellipse(x + 5, y + RAIL / 2 + (leaf % 2 ? 1 : -1), 8, 5, leaf * .7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(68,53,35,.9)";
    ctx.lineWidth = 2;
    for (let x = 30; x < FIELD.width; x += 140) {
      ctx.beginPath(); ctx.moveTo(x, y + RAIL / 2); ctx.bezierCurveTo(x + 20, y, x + 40, y + RAIL, x + 70, y + RAIL / 2); ctx.stroke();
    }
  },
};

export const CHAPTER_SEVEN_DECOR = Object.freeze({
  plates: { frontier: drawFrontierPlate },
  scatter: SCATTER,
  rails: RAILS,
});

const shared = {
  tint: null, rail: "roots", vents: null, lights: null, sparks: null, sheen: null, flares: null, weather: {},
};

// The forest thickens and darkens along the route toward evacuation, while
// the colony's ruins thin out (both follow the ferrivore phase profiles).
const CHAPTER_SEVEN_VARIANTS = Object.freeze({
  pavedRoad: {
    ...shared, road: "paved",
    scatter: ["leafLitter", "rustFlakes", "plate", "bolts", "fern"],
    motes: { count: 10, color: "190,255,150" },
    grassSway: { count: 14, color: "110,140,70", height: 14 },
    lightShafts: { count: 4, alpha: .09 },
    cloudShadows: { count: 3, speed: 10, alpha: .12 },
    glow: null,
  },
  dirtRoad: {
    ...shared, road: "dirt",
    scatter: ["leafLitter", "leafLitter", "mushroom", "fern", "rustFlakes"],
    motes: { count: 12, color: "190,255,150" },
    grassSway: { count: 18, color: "110,140,70", height: 15 },
    lightShafts: { count: 4, alpha: .08 },
    cloudShadows: { count: 3, speed: 10, alpha: .14 },
    glow: { kind: "spots", count: 3, color: "99,216,199" },
  },
  damagedRoad: {
    ...shared, road: "damaged",
    scatter: ["rubble", "leafLitter", "rustFlakes", "plate", "fern"],
    motes: { count: 12, color: "190,255,150" },
    grassSway: { count: 18, color: "105,135,68", height: 15 },
    lightShafts: { count: 3, alpha: .08 },
    cloudShadows: { count: 3, speed: 12, alpha: .15 },
    glow: { kind: "spots", count: 4, color: "99,216,199" },
  },
  railway: {
    ...shared, road: "rail",
    scatter: ["rustFlakes", "rustFlakes", "bolts", "leafLitter", "mushroom"],
    motes: { count: 14, color: "190,255,150" },
    grassSway: { count: 20, color: "100,130,65", height: 16 },
    lightShafts: { count: 3, alpha: .07 },
    cloudShadows: { count: 4, speed: 12, alpha: .16 },
    glow: { kind: "spots", count: 4, color: "99,216,199" },
  },
  industrialTrack: {
    ...shared, road: "industrial",
    scatter: ["bolts", "plate", "rustFlakes", "rubble", "mushroom"],
    motes: { count: 14, color: "190,255,150" },
    grassSway: { count: 20, color: "100,128,62", height: 16 },
    lightShafts: { count: 3, alpha: .07 },
    cloudShadows: { count: 4, speed: 12, alpha: .17 },
    sparks: { count: 1, color: "255,200,120" },
    glow: { kind: "veins", count: 4, color: "99,216,199" },
  },
  bridge: {
    ...shared, road: "bridge",
    scatter: ["leafLitter", "mushroom", "fern", "rustFlakes"],
    motes: { count: 16, color: "190,255,150" },
    grassSway: { count: 22, color: "95,125,60", height: 17 },
    lightShafts: { count: 2, alpha: .07 },
    cloudShadows: { count: 4, speed: 14, alpha: .18 },
    glow: { kind: "veins", count: 5, color: "99,216,199" },
  },
  warRoad: {
    ...shared, road: "war",
    scatter: ["rubble", "rubble", "rustFlakes", "plate", "mushroom"],
    motes: { count: 18, color: "190,255,150" },
    grassSway: { count: 24, color: "92,120,58", height: 18 },
    lightShafts: { count: 2, alpha: .06 },
    cloudShadows: { count: 5, speed: 14, alpha: .2 },
    glow: { kind: "veins", count: 6, color: "99,216,199" },
  },
  evacuationCorridor: {
    ...shared, road: "evacuation",
    scatter: ["mushroom", "mushroom", "fern", "leafLitter", "rustFlakes"],
    motes: { count: 22, color: "120,240,220" },
    grassSway: { count: 28, color: "90,118,56", height: 19 },
    lightShafts: { count: 2, alpha: .06 },
    cloudShadows: { count: 5, speed: 16, alpha: .22 },
    glow: { kind: "veins", count: 7, color: "99,216,199" },
  },
});

export const CHAPTER_SEVEN_BIOME = Object.freeze({
  plate: "frontier",
  fallback: "pavedRoad",
  phases: CHAPTER_SEVEN_VARIANTS,
});
