import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/chapter07/trees");
const types = {
  fragile: { trunk: 18, canopy: 48, accent: "#7d8f57" },
  ferrivore: { trunk: 26, canopy: 62, accent: "#82955b" },
  mineralized: { trunk: 42, canopy: 58, accent: "#9aa79b" },
  spores: { trunk: 28, canopy: 60, accent: "#86c98d" },
};
const stages = { hp100: 1, hp75: .82, hp50: .62, hp25: .4, hp0: .08 };

function svg(type, stage, scale) {
  const profile = types[type]; const broken = stage === "hp0";
  const canopy = profile.canopy * scale;
  const trunk = profile.trunk * (type === "mineralized" ? 1.15 : 1);
  const fruits = type === "spores" ? `<circle cx="105" cy="${138 - 55 * scale}" r="12" fill="#63e6d6"/><circle cx="155" cy="${120 - 45 * scale}" r="10" fill="#b6f7bf"/>` : "";
  const minerals = type === "mineralized" ? `<path d="M${105 - trunk} 135 L${85 - trunk / 3} 72 L105 50 L${125 + trunk / 3} 72 L${105 + trunk} 135" fill="#788985" opacity=".8"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="t" x1="0" x2="1"><stop stop-color="#3b2b23"/><stop offset=".5" stop-color="#a84e2d"/><stop offset="1" stop-color="#536344"/></linearGradient></defs><g stroke="#18251d" stroke-width="6" stroke-linejoin="round"><path d="M105 232 Q${80 - trunk} 224 ${105 - trunk} 198 L${105 - trunk / 2} ${90 + 100 * (1 - scale)} L${105 + trunk / 2} ${90 + 100 * (1 - scale)} L${105 + trunk} 198 Q130 224 105 232Z" fill="url(#t)"/>${minerals}${broken ? "" : `<g fill="${profile.accent}" opacity=".95"><circle cx="68" cy="${85 + 40 * (1 - scale)}" r="${canopy}"/><circle cx="145" cy="${65 + 48 * (1 - scale)}" r="${canopy * .85}"/><circle cx="105" cy="35" r="${canopy * .8}"/></g>${fruits}`}</g><path d="M105 232 Q70 240 46 232 M105 232 Q145 240 173 232" stroke="#73402f" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`;
}

await Promise.all(Object.entries(types).flatMap(async ([type]) => {
  await fs.mkdir(path.join(root, type), { recursive: true });
  await Promise.all(Object.entries(stages).map(async ([stage, scale]) => {
    await sharp(Buffer.from(svg(type, stage, scale))).png().toFile(path.join(root, type, `${stage}.png`));
  }));
}));
/**
 * DEV PLACEHOLDER ONLY.
 * This script must never be used to produce or overwrite production sprites.
 * Use import-forest-obstacle-sprite-atlases.mjs for final art imports.
 */
