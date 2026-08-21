import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/effects");
const size = 256;
const frames = 8;

const shell = (body) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="water"><stop stop-color="#ecfeff" stop-opacity=".96"/><stop offset=".35" stop-color="#22d3ee" stop-opacity=".8"/><stop offset="1" stop-color="#0e7490" stop-opacity="0"/></radialGradient>
    <linearGradient id="stream"><stop stop-color="#ecfeff"/><stop offset=".35" stop-color="#67e8f9"/><stop offset="1" stop-color="#0891b2" stop-opacity="0"/></linearGradient>
  </defs>${body}</svg>`;

function brine(frame) {
  const progress = frame / (frames - 1);
  const length = 76 + progress * 140;
  const splash = 16 + Math.sin(progress * Math.PI) * 20;
  return shell(`
    <g filter="url(#glow)" opacity="${.58 + progress * .35}">
      <path d="M22 112 C72 ${88 - frame * 2}, ${length - 20} ${132 + frame}, ${length} 128 C${length - 34} 146, 78 150, 22 142 Z" fill="url(#stream)"/>
      <ellipse cx="${Math.min(224, length)}" cy="132" rx="${splash}" ry="${splash * .62}" fill="url(#water)"/>
      ${Array.from({ length: 7 }, (_, i) => `<circle cx="${Math.min(240, length - 8 + Math.cos(i * 2.1 + frame) * splash)}" cy="${132 + Math.sin(i * 1.8 + frame) * splash}" r="${2 + i % 3}" fill="#cffafe" opacity="${.35 + i * .07}"/>`).join("")}
    </g>`);
}

function vortex(frame) {
  const angle = frame * 45;
  const radius = 42 + frame * 4;
  return shell(`
    <g transform="rotate(${angle} 128 128)" filter="url(#glow)">
      <circle cx="128" cy="128" r="${radius}" fill="none" stroke="#22d3ee" stroke-width="9" stroke-dasharray="40 16 20 12" opacity=".78"/>
      <circle cx="128" cy="128" r="${radius - 21}" fill="none" stroke="#a5f3fc" stroke-width="5" stroke-dasharray="18 11" opacity=".82"/>
      <path d="M128 128 C155 88, 196 104, ${128 + radius} 128 C178 150, 153 184, 128 168 C91 190, 64 153, ${128 - radius} 128 C72 93, 108 72, 128 88 Z" fill="url(#water)" opacity=".5"/>
    </g>
    <circle cx="128" cy="128" r="14" fill="#ecfeff" opacity=".8"/>`);
}

function deluge(frame) {
  const progress = frame / (frames - 1);
  const crest = 228 - progress * 170;
  return shell(`
    <g filter="url(#glow)">
      <path d="M8 230 C42 ${crest}, 72 ${crest + 38}, 108 ${crest + 10} C145 ${crest - 20}, 175 ${crest + 42}, 248 ${crest - 4} L248 252 L8 252 Z" fill="#0891b2" opacity="${.5 + progress * .35}"/>
      <path d="M8 222 C48 ${crest - 10}, 75 ${crest + 24}, 110 ${crest} C150 ${crest - 34}, 178 ${crest + 27}, 248 ${crest - 15}" fill="none" stroke="#cffafe" stroke-width="10" stroke-linecap="round" opacity=".9"/>
      ${Array.from({ length: 12 }, (_, i) => `<circle cx="${14 + i * 21}" cy="${Math.max(12, crest - 10 - ((i * 17 + frame * 13) % 42))}" r="${2 + i % 4}" fill="#67e8f9" opacity=".7"/>`).join("")}
    </g>`);
}

const definitions = [
  ["leviathanBrine", "active", brine],
  ["leviathanVortex", "active", vortex],
  ["leviathanDeluge", "active", deluge],
];

for (const [effect, state, render] of definitions) {
  const directory = path.join(root, effect, state);
  await mkdir(directory, { recursive: true });
  for (let frame = 0; frame < frames; frame += 1) {
    await sharp(Buffer.from(render(frame)))
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(directory, `frame${frame}.png`));
  }
}

console.log(`Leviatã: ${definitions.length * frames} frames de efeito gerados.`);
