import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/effects");
const effects = { colossoRift: "#fb923c", colossoSlam: "#ef4444", colossoFracture: "#f97316", colossoSeismic: "#facc15", colossoCore: "#fef08a", colossoDeath: "#fb7185" };
for (const [id, color] of Object.entries(effects)) {
  const folder = path.join(root, id, "active"); await fs.mkdir(folder, { recursive: true });
  for (let frame = 0; frame < 4; frame += 1) {
    const radius = 30 + frame * 14;
    const svg = `<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${color}" stroke-width="${5 - frame * .5}" opacity="${.9 - frame * .14}"><circle cx="96" cy="96" r="${radius}"/><path d="M20 96h${152 - frame * 12}M96 20v${152 - frame * 12}"/></g></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(folder, `frame${frame}.png`));
  }
}
console.log(`Generated ${Object.keys(effects).length} Colosso VFX sets.`);
