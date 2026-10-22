import { CELL, FIELD } from "../visualGeometry.js";
import { getFerrivorePhaseProfile } from "./ferrivoreBiomeProfiles.js";

// The chapter 7 ground itself is drawn by the biome battlefield
// (biomes/chapter07Frontier.js); this module keeps the ferrivore spores and
// living haze that float over the field.
const C = { shadow: "#08100B", green: "#102016", floor: "#1A2518", mud: "#34281C", wet: "#463322", root: "#443523", moss: "#506238", leaf: "#74824A", rust: "#A84E2D", cyan: "#63D8C7", fog: "#15231A" };
const rgba = (hex, alpha) => { const n = Number.parseInt(String(hex).replace("#", ""), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`; };
const seeded = (seed) => { let value = seed >>> 0; return () => { value = Math.imul(value ^ value >>> 16, 2246822519); value = Math.imul(value ^ value >>> 13, 3266489917); return ((value ^ value >>> 16) >>> 0) / 4294967296; }; };
const routeY = (row) => row * CELL.height + CELL.height / 2;
const nearRoute = (y, margin = 46) => Array.from({ length: FIELD.rows }, (_, row) => Math.abs(y - routeY(row)) < margin).some(Boolean);

export function drawFerrivoreAmbient(ctx, phase, time, quality = {}, reduceMotion = false) { const profile = getFerrivorePhaseProfile(phase); const random = seeded((phase.battlefieldTheme?.seed || 1) + 330); const count = Math.round((8 + profile.spores * 28) * (quality.particles ?? 1)); const motion = reduceMotion ? 0 : time; ctx.save(); for (let i = 0; i < count; i += 1) { const x = (random() * FIELD.width + motion * .008 * (i % 2 ? 1 : -1)) % FIELD.width; const y = 30 + (random() * FIELD.height + Math.sin(motion * .0007 + i) * 12) % (FIELD.height - 50); if (nearRoute(y, 42)) continue; ctx.fillStyle = rgba(i % 4 ? C.leaf : C.cyan, .12 + profile.spores * .1); ctx.beginPath(); ctx.arc(x, y, .8 + random() * 2, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = rgba(C.fog, .08 * profile.fogDensity); ctx.fillRect(0, 0, FIELD.width, FIELD.height); ctx.restore(); }
