import { CELL, FIELD } from "../visualGeometry.js";
import { getFerrivorePhaseProfile } from "./ferrivoreBiomeProfiles.js";

const rgba = (hex, alpha) => {
  const value = Number.parseInt(String(hex).replace("#", ""), 16);
  return `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${alpha})`;
};
const seeded = (seed) => { let value = seed >>> 0; return () => { value = Math.imul(value ^ value >>> 16, 2246822519); value = Math.imul(value ^ value >>> 13, 3266489917); return ((value ^ value >>> 16) >>> 0) / 4294967296; }; };

export function drawFerrivoreTerrainBase(ctx, phase) {
  const theme = phase.battlefieldTheme; const profile = getFerrivorePhaseProfile(phase); const random = seeded(theme.seed);
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, "#171514"); gradient.addColorStop(.48, "#3a251d"); gradient.addColorStop(1, "#171514");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = rgba("#6f3526", .16 + profile.infestation * .1);
  for (let i = 0; i < 18 + profile.nests * 22; i += 1) {
    const x = random() * FIELD.width; const y = 20 + random() * FIELD.height;
    ctx.beginPath(); ctx.moveTo(x - 45, y + 24); ctx.lineTo(x - 9, y - 18 - random() * 30); ctx.lineTo(x + 48, y + 25); ctx.closePath(); ctx.fill();
  }
}

export function drawFerrivoreBackground(ctx, phase) {
  drawFerrivoreTerrainBase(ctx, phase);
}

export function drawFerrivoreConvoyRoute(ctx, phase) {
  const row = phase.rules?.transportRow ?? 2;
  const y = row * CELL.height + CELL.height / 2;
  ctx.save(); ctx.strokeStyle = rgba("#C7AE7B", .28); ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(FIELD.width - 34, y); ctx.stroke();
  ctx.strokeStyle = rgba("#63E6D6", .22); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, y - 7); ctx.bezierCurveTo(310, y + 10, 560, y - 13, FIELD.width - 80, y + 4); ctx.stroke();
  ctx.restore();
}

export function drawFerrivoreGroundVeins(ctx, phase, time = 0, reduceMotion = false) {
  const profile = getFerrivorePhaseProfile(phase); const pulse = reduceMotion ? .42 : .34 + (Math.sin(time * .0015) + 1) * .04;
  ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = rgba("#63e6d6", pulse * profile.veins); ctx.lineWidth = 2.2;
  for (let row = 0; row < FIELD.rows; row += 1) {
    const y = row * CELL.height + 18; ctx.beginPath(); ctx.moveTo(70, y + 26);
    for (let x = 140; x < FIELD.width; x += 110) ctx.bezierCurveTo(x - 60, y - 18, x - 24, y + 52, x, y + 8);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFerrivoreGrowths(ctx, phase) {
  const profile = getFerrivorePhaseProfile(phase); const random = seeded(phase.battlefieldTheme.seed + 91);
  ctx.save(); ctx.strokeStyle = rgba("#8b5940", .32 + profile.roots * .2); ctx.lineWidth = 5;
  for (let i = 0; i < Math.round(8 + profile.roots * 20); i += 1) {
    const x = random() * FIELD.width; const y = random() * FIELD.height;
    ctx.beginPath(); ctx.moveTo(x, y + 32); ctx.bezierCurveTo(x - 24, y - 6, x + 34, y - 18, x + (random() - .5) * 80, y - 46); ctx.stroke();
  }
  ctx.fillStyle = rgba("#c7ae7b", .1 + profile.nests * .12);
  for (let i = 0; i < Math.round(profile.nests * 20); i += 1) { const x=random()*FIELD.width; const y=random()*FIELD.height; ctx.beginPath(); ctx.ellipse(x,y,18+random()*24,8+random()*12,random(),0,Math.PI*2); ctx.fill(); }
  ctx.restore();
}

export function drawFerrivoreForeground(ctx, phase) {
  drawFerrivoreGrowths(ctx, phase);
}

export function drawFerrivoreAmbient(ctx, phase, time, profile, reduceMotion = false) {
  const spec = getFerrivorePhaseProfile(phase); const count = Math.round((10 + spec.spores * 40) * (profile?.particles ?? 1));
  const motion = reduceMotion ? 0 : time;
  ctx.save();
  ctx.fillStyle = rgba("#3A251D", .055 * spec.infestation); ctx.fillRect(0, FIELD.height - 110, FIELD.width, 110);
  ctx.fillStyle = rgba("#C65A33", .18 * spec.spores);
  for (let i = 0; i < count; i += 1) { const x=(i*97 + motion*.012)%FIELD.width; const y=(i*53 + Math.sin(motion*.0007+i)*14)%FIELD.height; const fade=.45+.35*Math.sin(motion*.001+i); ctx.globalAlpha=fade; ctx.beginPath(); ctx.arc(x,y,1.3+(i%3),0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.restore();
}
