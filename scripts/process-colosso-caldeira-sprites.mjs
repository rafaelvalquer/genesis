import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/enemy/colossoCaldeira");
const manifestPath = path.join(root, "manifest.json");
const required = {
  spawnAwakening: 12, idle: 8, riftTelegraph: 6, riftCast: 6,
  slamTelegraph: 6, slamAttack: 8, fractureTelegraph: 8, fractureAttack: 8,
  seismicTelegraph: 8, seismicAttack: 8, phaseTransition2: 10, phaseTransition3: 10,
  finalCollapse: 12, coreExposed: 8, death: 14,
};

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function normalize(source, destination) {
  const { data, info } = await sharp(source).resize(768, 768, { fit: "contain", background: transparent }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Generated assets may arrive on a chroma green backdrop. Preserve native
  // alpha when present and strip only clearly saturated chroma pixels.
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const [red, green, blue] = data.subarray(offset, offset + 3);
    if (green > 150 && green > red * 1.3 && green > blue * 1.3) data[offset + 3] = 0;
  }
  await sharp(data, { raw: info }).png({ palette: true, quality: 46, colours: 48, compressionLevel: 9 }).toFile(destination);
}

async function variant(source, destination, index, count) {
  const cycle = (index / Math.max(1, count)) * Math.PI * 2;
  const angle = Math.sin(cycle) * 1.8;
  await sharp(source).rotate(angle, { background: transparent }).resize(768, 768, { fit: "contain", background: transparent })
    .modulate({ brightness: .94 + Math.sin(cycle) * .06, saturation: 1 + Math.cos(cycle) * .08 })
    .png({ palette: true, quality: 46, colours: 48, compressionLevel: 9 }).toFile(destination);
}

for (const [stateIndex, [state, frames]] of Object.entries(required).entries()) {
  const folder = path.join(root, state);
  await fs.mkdir(folder, { recursive: true });
  const source = path.join(folder, "frame0.png");
  try { await fs.access(source); } catch { throw new Error(`Missing source frame: ${source}`); }
  const normalized = path.join(folder, "frame0.normalized.png");
  await normalize(source, normalized);
  const base = await fs.readFile(normalized);
  await fs.rm(normalized);
  for (let frame = 0; frame < frames; frame += 1) await variant(base, path.join(folder, `frame${frame}.png`), stateIndex * 23 + frame + 1, 512);
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
manifest.animations = Object.fromEntries(Object.entries(required).map(([state, frames]) => [state, { frames, frameMs: manifest.animationFrameMs?.[state] || (state === "death" ? 330 : 120), loop: state === "idle" || state === "coreExposed" }]));
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Processed ${Object.values(required).reduce((total, frames) => total + frames, 0)} Colosso frames.`);
