import { FIELD, CELL } from "../visualGeometry.js";
import { getQualityProfile } from "../arenaRenderer.js";
import { drawCachedRadialGlow } from "../effectTextureCache.js";
import { getWindArrowVector, getWindCurrentVisualState } from "../windCurrentRenderer.js";
import { pseudo } from "./decorMath.js";
import { getBiomeVariant } from "./biomeRegistry.js";

// Animated life for biome battlefields: floor vents with steam, blinking rail
// lights, sparks, drifting motes, glowing ground decals and weather, mixed per
// phase by its variant. Everything is a pure function of the battle clock and
// the phase seed, so it never touches session state.

const RAIL = 12;
const VENT_ROWS = [1, 3, 0, 4, 2];
const SPARK_EMITTERS = [
  { x: 0.24, top: true, period: 3300, offset: 400 },
  { x: 0.63, top: false, period: 4100, offset: 1700 },
  { x: 0.86, top: true, period: 3700, offset: 2600 },
];
const SPARK_BURST_MS = 520;
const SPARK_COUNT = 8;

const clock = (session, settings) => (settings.reduceMotion ? 0 : session.elapsed || 0);
const themeOf = (session) => session.phase?.battlefieldTheme || {};
const seedOf = (session) => themeOf(session).seed || 1;

function getVents(session, count) {
  const seed = seedOf(session);
  return VENT_ROWS.slice(0, count).map((row, index) => {
    const column = 3 + ((seed * (row + 3) + row * 5) % 7);
    return {
      x: column * CELL.width + CELL.width / 2,
      y: row * CELL.height + CELL.height / 2 + 20,
      phase: index * 1.9,
    };
  });
}

function getVentCount(variant, profile) {
  if (!variant.vents) return 0;
  return Math.max(1, Math.round(variant.vents.count * profile.atmosphere));
}

// A sand burrow: a dark hole with a raised rim, used instead of a metal grate.
function drawBurrow(ctx, vent) {
  ctx.save();
  ctx.translate(vent.x, vent.y);
  ctx.fillStyle = "rgba(255,225,180,.14)";
  ctx.beginPath(); ctx.ellipse(0, 2, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(12,5,2,.75)";
  ctx.beginPath(); ctx.ellipse(0, 0, 19, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawVentGrate(ctx, vent, time, edge, glow, style) {
  if (style === "burrow") {
    drawBurrow(ctx, vent);
    return;
  }
  const pulse = .5 + .5 * Math.sin(time / 1700 + vent.phase);
  ctx.save();
  ctx.translate(vent.x, vent.y);
  ctx.fillStyle = "rgba(2,8,14,.82)";
  ctx.fillRect(-28, -12, 56, 24);
  ctx.strokeStyle = `${edge}59`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-28, -12, 56, 24);
  ctx.fillStyle = `rgba(${glow},${.1 + pulse * .22})`;
  ctx.fillRect(-25, -9, 50, 18);
  ctx.fillStyle = "rgba(0,0,0,.7)";
  for (let slat = -8; slat <= 8; slat += 5) ctx.fillRect(-25, slat - 1, 50, 2.4);
  ctx.restore();
}

function lightLevel(blink, time, index) {
  if (blink === "strobe") return ((time / 620 + index * .5) % 1) < .35 ? 1 : .12;
  if (blink === "slow") return .35 + .65 * (.5 + .5 * Math.sin(time / 1100 + index * 1.3));
  return .3 + .7 * Math.max(0, Math.sin(time / (380 + (index % 3) * 140) + index * 1.7));
}

function drawRailLights(ctx, time, count, lights) {
  const spacing = Math.max(80, Math.round(FIELD.width / count));
  for (let index = 0; index < count; index += 1) {
    const x = FIELD.baseX + 20 + index * spacing;
    if (x > FIELD.width - 40) break;
    const color = lights.colors[index % lights.colors.length];
    const level = lightLevel(lights.blink, time, index);
    for (const y of [RAIL / 2, FIELD.height - RAIL / 2]) {
      ctx.save();
      ctx.globalAlpha = level * .85;
      drawCachedRadialGlow(ctx, `ch1-light-${color}`, x, y, 22, 22, `${color}ff`, `${color}77`, `${color}00`);
      ctx.globalAlpha = .55 + level * .45;
      ctx.fillStyle = color;
      ctx.fillRect(x - 4, y - 2, 8, 4);
      ctx.restore();
    }
  }
}

function getGlowSpots(session, count, seedOffset = 0) {
  const seed = seedOf(session) + seedOffset;
  return Array.from({ length: count }, (_, index) => ({
    x: (2 + Math.floor(pseudo(index, seed + 510) * 8)) * CELL.width + 20 + pseudo(index, seed + 520) * 60,
    y: Math.floor(pseudo(index, seed + 530) * FIELD.rows) * CELL.height + 30 + pseudo(index, seed + 540) * 60,
    phase: index * 1.3,
  }));
}

function drawGlowDecals(ctx, session, time, glow) {
  ctx.save();
  ctx.lineCap = "round";
  for (const spot of getGlowSpots(session, glow.count)) {
    const pulse = .5 + .5 * Math.sin(time / 900 + spot.phase);
    const { x, y } = spot;
    if (glow.kind === "spots") {
      for (let dot = 0; dot < 3; dot += 1) {
        const dx = x + (dot - 1) * 9;
        const dy = y + (dot % 2) * 6;
        ctx.globalAlpha = .35 + pulse * .55 * (dot === 1 ? 1 : .7);
        drawCachedRadialGlow(ctx, `biome-spot-${glow.color}`, dx, dy, 9, 9, `rgba(${glow.color},1)`, `rgba(${glow.color},.35)`, `rgba(${glow.color},0)`);
      }
      ctx.globalAlpha = 1;
      continue;
    }
    if (glow.kind === "eggs") {
      for (let egg = 0; egg < 3; egg += 1) {
        const ex = x + (egg - 1) * 14;
        const ey = y + (egg % 2) * 5;
        const beat = .5 + .5 * Math.sin(time / 700 + spot.phase + egg);
        ctx.fillStyle = `rgba(${glow.color},${.12 + beat * .28})`;
        ctx.beginPath(); ctx.ellipse(ex, ey, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${glow.color},.55)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      continue;
    }
    if (glow.kind === "runes") {
      ctx.strokeStyle = `rgba(${glow.color},${.25 + pulse * .4})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([4, 5]);
      ctx.lineDashOffset = -time / 80;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${glow.color},${.4 + pulse * .5})`;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.beginPath();
    if (glow.kind === "veins") {
      ctx.moveTo(x - 34, y + 8);
      ctx.quadraticCurveTo(x, y - 22, x + 34, y + 6);
    } else {
      ctx.moveTo(x - 22, y - 6);
      ctx.lineTo(x - 6, y + 4);
      ctx.lineTo(x + 6, y - 8);
      ctx.lineTo(x + 24, y + 6);
    }
    ctx.strokeStyle = `rgba(${glow.color},${.08 + pulse * .18})`;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${glow.color},${.5 + pulse * .4})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.restore();
}

// A soft diagonal band of light sliding across polished floors.
function drawSheen(ctx, time, sheen) {
  const travel = FIELD.width + 700;
  const center = ((time / sheen.period) % 1) * travel - 100;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.transform(1, 0, -.45, 1, 0, 0);
  const band = ctx.createLinearGradient(center - 110, 0, center + 110, 0);
  band.addColorStop(0, `rgba(${sheen.color},0)`);
  band.addColorStop(.5, `rgba(${sheen.color},.09)`);
  band.addColorStop(1, `rgba(${sheen.color},0)`);
  ctx.fillStyle = band;
  ctx.fillRect(center - 110, 0, 220, FIELD.height);
  ctx.restore();
}

// Grass tufts swaying in the breeze; an active wind current leans them all
// along its direction.
function drawGrassSway(ctx, session, time, profile, grass) {
  const seed = seedOf(session);
  const count = Math.max(6, Math.round(grass.count * profile.detail));
  const wind = getWindCurrentVisualState(session, session.elapsed || 0);
  const lean = wind.intensity ? getWindArrowVector(wind).x * wind.intensity * .6 : 0;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = `rgba(${grass.color},.75)`;
  ctx.beginPath();
  for (let index = 0; index < count; index += 1) {
    const x = FIELD.baseX + 20 + pseudo(index, seed + 910) * (FIELD.width - FIELD.baseX - 40);
    const row = Math.floor(pseudo(index, seed + 920) * FIELD.rows);
    const y = row * CELL.height + (pseudo(index, seed + 930) > .5 ? 6 : CELL.height - 4);
    const sway = Math.sin(time / 650 + index * 1.7) * .22 + lean;
    for (let blade = -2; blade <= 2; blade += 1) {
      const height = (grass.height || 9) + (2 - Math.abs(blade)) * 3;
      ctx.moveTo(x + blade * 2.2, y);
      ctx.quadraticCurveTo(x + blade * 2.6, y - height * .6, x + blade * 3 + Math.sin(sway) * height, y - Math.cos(sway) * height);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// Rippling water light on the floor: two sets of wavy bands crossing each
// other and drifting, added on top of the ground.
function drawCaustics(ctx, time, profile, caustics) {
  const bands = Math.max(5, Math.round(9 * profile.atmosphere));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(${caustics.color},.07)`;
  ctx.beginPath();
  for (let band = 0; band < bands; band += 1) {
    const baseY = (band + .5) * FIELD.height / bands;
    for (let x = 0; x <= FIELD.width; x += 40) {
      const y = baseY + Math.sin(x / 70 + time / 900 + band * 1.7) * 14 + Math.sin(x / 31 - time / 1300) * 5;
      if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  }
  for (let band = 0; band < bands + 2; band += 1) {
    const baseX = (band + .5) * FIELD.width / (bands + 2);
    for (let y = 0; y <= FIELD.height; y += 40) {
      const x = baseX + Math.sin(y / 60 - time / 1100 + band * 2.1) * 18;
      if (y) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// Bubbles rising and wobbling from fixed spots on the seabed.
function drawBubbles(ctx, session, time, profile, bubbles) {
  const seed = seedOf(session);
  const count = Math.max(4, Math.round(bubbles.count * profile.particles));
  ctx.save();
  ctx.lineWidth = 1.2;
  for (let index = 0; index < count; index += 1) {
    const cycle = 2800 + pseudo(index, seed + 1110) * 2200;
    const progress = ((time + pseudo(index, seed + 1120) * cycle) % cycle) / cycle;
    const x = FIELD.baseX + 30 + pseudo(index, seed + 1130) * (FIELD.width - FIELD.baseX - 60) + Math.sin(progress * 12 + index) * 4;
    const y = 30 + pseudo(index, seed + 1140) * (FIELD.height - 40) - progress * 70;
    const radius = 2 + pseudo(index, seed + 1150) * 3 + progress * 1.5;
    ctx.strokeStyle = `rgba(200,240,255,${.55 * (1 - progress)})`;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${.45 * (1 - progress)})`;
    ctx.fillRect(x - radius * .45, y - radius * .5, 1.4, 1.4);
  }
  ctx.restore();
}

// A slow heartbeat of heat washing over the whole floor.
function drawBreath(ctx, time, breath) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = `rgba(${breath.color},${breath.alpha * (.5 + .5 * Math.sin(time / 1600))})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();
}

// Soft diagonal beams of light falling through a canopy, slowly breathing.
function drawLightShafts(ctx, session, time, shafts) {
  const seed = seedOf(session);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let index = 0; index < shafts.count; index += 1) {
    const x = FIELD.baseX + 120 + pseudo(index, seed + 1210) * (FIELD.width - FIELD.baseX - 80);
    const alpha = shafts.alpha * (.6 + .4 * Math.sin(time / 3000 + index * 1.9));
    const beam = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    beam.addColorStop(0, `rgba(210,240,170,${alpha})`);
    beam.addColorStop(1, "rgba(210,240,170,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 18, 0); ctx.lineTo(x + 26, 0);
    ctx.lineTo(x - 110, FIELD.height); ctx.lineTo(x - 210, FIELD.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Large soft cloud shadows drifting slowly across the whole field.
function drawCloudShadows(ctx, session, time, clouds) {
  const seed = seedOf(session);
  const span = FIELD.width + 700;
  ctx.save();
  ctx.globalAlpha = clouds.alpha;
  for (let index = 0; index < clouds.count; index += 1) {
    const radiusX = 180 + pseudo(index, seed + 950) * 120;
    const radiusY = radiusX * .5;
    const x = ((pseudo(index, seed + 960) * span + time / 1000 * clouds.speed) % span) - 350;
    const y = pseudo(index, seed + 970) * FIELD.height;
    drawCachedRadialGlow(ctx, "biome-cloud-shadow", x, y, radiusX, radiusY, "rgba(0,0,0,1)", "rgba(0,0,0,.55)", "rgba(0,0,0,0)", .5);
  }
  ctx.restore();
}

// Thin streaks of sand blown low across the floor, right to left.
function drawSandDrift(ctx, session, time, profile, drift) {
  const seed = seedOf(session);
  const count = Math.max(6, Math.round(drift.count * profile.particles));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 1.4;
  for (let index = 0; index < count; index += 1) {
    const speed = drift.speed * (.6 + pseudo(index, seed + 820) * .8);
    const y = 20 + pseudo(index, seed + 810) * (FIELD.height - 40);
    const x = ((pseudo(index, seed + 830) * FIELD.width - time / 1000 * speed) % FIELD.width + FIELD.width) % FIELD.width;
    const length = 14 + pseudo(index, seed + 840) * 26;
    ctx.strokeStyle = `rgba(${drift.color},${.1 + pseudo(index, seed + 850) * .14})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y + Math.sin(time / 400 + index) * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

// Short-lived prismatic star flares that cycle through the spectrum.
function drawFlares(ctx, session, time, flares) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const spot of getGlowSpots(session, flares.count, 1000)) {
    const local = (time / 2400 + spot.phase * .37) % 1;
    const strength = Math.max(0, Math.sin(local * Math.PI)) ** 3;
    if (strength < .02) continue;
    const length = 10 + strength * 22;
    ctx.globalAlpha = strength * .8;
    drawCachedRadialGlow(ctx, "biome-flare", spot.x, spot.y, length * .7, length * .7, "rgba(255,255,255,.9)", "rgba(255,255,255,.25)", "rgba(255,255,255,0)");
    ctx.strokeStyle = `hsl(${(time / 12 + spot.phase * 80) % 360},95%,72%)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(spot.x - length, spot.y); ctx.lineTo(spot.x + length, spot.y);
    ctx.moveTo(spot.x, spot.y - length * .6); ctx.lineTo(spot.x, spot.y + length * .6);
    ctx.stroke();
  }
  ctx.restore();
}

/** Layer below the units: sheen, vent grates, glowing decals and rail lights. */
export function drawBiomeGroundEffects(ctx, session, settings) {
  const variant = getBiomeVariant(session.phase);
  if (!variant) return;
  const profile = getQualityProfile(settings);
  const time = clock(session, settings);
  const edge = themeOf(session).edge || "#38bdf8";
  if (variant.sheen && !settings.reduceMotion) drawSheen(ctx, time, variant.sheen);
  if (variant.breath && !settings.reduceMotion) drawBreath(ctx, time, variant.breath);
  if (variant.sandDrift && !settings.reduceMotion) drawSandDrift(ctx, session, time, profile, variant.sandDrift);
  if (variant.caustics && !settings.reduceMotion) drawCaustics(ctx, time, profile, variant.caustics);
  if (variant.grassSway) drawGrassSway(ctx, session, time, profile, variant.grassSway);
  for (const vent of getVents(session, getVentCount(variant, profile))) drawVentGrate(ctx, vent, time, edge, variant.vents.glow, variant.vents.style);
  if (variant.glow) drawGlowDecals(ctx, session, time, variant.glow);
  if (variant.lights) drawRailLights(ctx, time, Math.max(5, Math.round(10 * profile.detail)), variant.lights);
}

function drawSteam(ctx, session, time, profile, vents) {
  const puffs = profile.particles > .5 ? 4 : 3;
  const cycle = 2600;
  ctx.save();
  getVents(session, getVentCount({ vents }, profile)).forEach((vent) => {
    const envelope = .35 + .65 * (.5 + .5 * Math.sin(time / 1700 + vent.phase));
    for (let puff = 0; puff < puffs; puff += 1) {
      const progress = ((time / cycle) + puff / puffs + vent.phase * .13) % 1;
      const fadeIn = Math.min(1, progress / .14);
      ctx.globalAlpha = .6 * (1 - progress) * fadeIn * envelope * profile.atmosphere;
      const x = vent.x + Math.sin(progress * 5 + vent.phase + puff) * 12 + progress * 20;
      const y = vent.y - progress * 90;
      const radius = 10 + progress * 30;
      drawCachedRadialGlow(ctx, `ch1-steam-${vents.steam}`, x, y, radius, radius, `rgba(${vents.steam},.6)`, `rgba(${vents.steam},.28)`, `rgba(${vents.steam},0)`);
    }
  });
  ctx.restore();
}

function drawSparks(ctx, time, profile, sparks) {
  const emitters = SPARK_EMITTERS.slice(0, profile.particles > .5 ? sparks.count : 1);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  emitters.forEach((emitter, index) => {
    const local = (time + emitter.offset) % emitter.period;
    if (local > SPARK_BURST_MS) return;
    const x0 = FIELD.baseX + 40 + emitter.x * (FIELD.width - FIELD.baseX - 120);
    const dir = emitter.top ? 1 : -1;
    const y0 = emitter.top ? RAIL : FIELD.height - RAIL;
    const life = 1 - local / SPARK_BURST_MS;
    if (local < 140) {
      ctx.globalAlpha = (1 - local / 140) * .8;
      drawCachedRadialGlow(ctx, `ch1-spark-${sparks.color}`, x0, y0, 22, 22, "rgba(255,245,220,1)", `rgba(${sparks.color},.4)`, `rgba(${sparks.color},0)`);
    }
    for (let spark = 0; spark < SPARK_COUNT; spark += 1) {
      const spread = (spark / (SPARK_COUNT - 1) - .5) * 2.2;
      const speed = 70 + ((spark * 7 + index * 3) % 5) * 22;
      const position = (seconds) => ({
        x: x0 + Math.sin(spread) * speed * seconds,
        y: y0 + dir * (Math.cos(spread) * speed * .8 * seconds) + 260 * seconds * seconds,
      });
      const head = position(local / 1000);
      const tail = position(Math.max(0, local - 36) / 1000);
      ctx.globalAlpha = life;
      ctx.strokeStyle = `rgba(${sparks.color},1)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
    }
  });
  ctx.restore();
}

// Motes rise by default; falling ones (ash) take a different seed salt so
// they never overlap a rising set in the same phase.
function drawMotes(ctx, session, time, profile, motes, fall = false) {
  const seed = seedOf(session) + (fall ? 5000 : 0);
  const count = Math.round(motes.count * profile.particles);
  const span = FIELD.width - FIELD.baseX - 60;
  ctx.save();
  for (let index = 0; index < count; index += 1) {
    const speed = 14 + pseudo(index, seed + 610) * 18;
    const startY = pseudo(index, seed + 620) * FIELD.height;
    const y = (((startY + (fall ? 1 : -1) * time / 1000 * speed) % FIELD.height) + FIELD.height) % FIELD.height;
    const x = FIELD.baseX + 30 + pseudo(index, seed + 630) * span + Math.sin(time / 1300 + index) * 14;
    const radius = 3 + pseudo(index, seed + 640) * 3;
    ctx.globalAlpha = (.35 + .65 * (.5 + .5 * Math.sin(time / 600 + index * 2))) * .75;
    drawCachedRadialGlow(ctx, `ch1-mote-${motes.color}`, x, y, radius * 2.2, radius * 2.2, `rgba(${motes.color},1)`, `rgba(${motes.color},.35)`, `rgba(${motes.color},0)`);
  }
  ctx.restore();
}

function drawRain(ctx, session, time, profile, amount) {
  const seed = seedOf(session);
  const drops = Math.round(Math.max(20, Math.round(46 * profile.atmosphere)) * amount);
  ctx.save();
  ctx.strokeStyle = "rgba(190,210,255,.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let index = 0; index < drops; index += 1) {
    const y = (pseudo(index, seed + 710) * FIELD.height + time * .9) % FIELD.height;
    const x = ((pseudo(index, seed + 720) * FIELD.width - y * .25) % FIELD.width + FIELD.width) % FIELD.width;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 14);
  }
  ctx.stroke();
  for (let index = 0; index < 10; index += 1) {
    const progress = (time / 900 + pseudo(index, seed + 730)) % 1;
    const x = FIELD.baseX + 20 + pseudo(index, seed + 740) * (FIELD.width - FIELD.baseX - 40);
    const y = 20 + pseudo(index, seed + 750) * (FIELD.height - 40);
    const radiusX = 4 + progress * 16;
    ctx.strokeStyle = `rgba(200,220,255,${(1 - progress) * .4})`;
    ctx.beginPath(); ctx.ellipse(x, y, radiusX, radiusX * .35, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawLightning(ctx, time, strength) {
  const local = (time + 2100) % 7400;
  const alpha = (local < 90 ? .32 * (1 - local / 90) : local > 160 && local < 230 ? .2 : 0) * strength;
  if (!alpha) return;
  ctx.save();
  ctx.fillStyle = `rgba(205,215,255,${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();
}

function drawSearchlight(ctx, time) {
  const x = FIELD.width * .55 + Math.sin(time / 2600) * FIELD.width * .36;
  const beam = ctx.createLinearGradient(0, RAIL, 0, FIELD.height);
  beam.addColorStop(0, "rgba(255,240,220,.16)");
  beam.addColorStop(1, "rgba(255,240,220,.03)");
  ctx.save();
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(x - 10, RAIL);
  ctx.lineTo(x + 10, RAIL);
  ctx.lineTo(x + 90 + Math.sin(time / 1900) * 30, FIELD.height);
  ctx.lineTo(x - 90 + Math.sin(time / 1900) * 30, FIELD.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Layer above the units: steam, sparks, motes and weather. Skipped when motion is reduced. */
export function drawBiomeAtmosphere(ctx, session, settings) {
  if (settings.reduceMotion) return;
  const variant = getBiomeVariant(session.phase);
  if (!variant) return;
  const profile = getQualityProfile(settings);
  const time = clock(session, settings);
  if (variant.weather.searchlight) drawSearchlight(ctx, time);
  if (variant.vents) drawSteam(ctx, session, time, profile, variant.vents);
  if (variant.cloudShadows) drawCloudShadows(ctx, session, time, variant.cloudShadows);
  if (variant.lightShafts) drawLightShafts(ctx, session, time, variant.lightShafts);
  if (variant.bubbles) drawBubbles(ctx, session, time, profile, variant.bubbles);
  if (variant.motes) drawMotes(ctx, session, time, profile, variant.motes);
  if (variant.ash) drawMotes(ctx, session, time, profile, variant.ash, true);
  if (variant.sparks) drawSparks(ctx, time, profile, variant.sparks);
  if (variant.flares) drawFlares(ctx, session, time, variant.flares);
  if (variant.weather.rain) drawRain(ctx, session, time, profile, Number(variant.weather.rain));
  if (variant.weather.lightning) drawLightning(ctx, time, Number(variant.weather.lightning));
}
