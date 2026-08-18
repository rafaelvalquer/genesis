import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const runtimeRoot = path.resolve("src/game/assets/enemy/colossoCaldeira");
const sourceRoot = path.resolve("src/game/assets-source/enemy/colossoCaldeira");
const manifestPath = path.join(runtimeRoot, "manifest.json");
const required = {
  spawnAwakening: 12, idle: 8, riftTelegraph: 6, riftCast: 6,
  slamTelegraph: 6, slamAttack: 8, fractureTelegraph: 8, fractureAttack: 8,
  seismicTelegraph: 8, seismicAttack: 8, phaseTransition2: 10, phaseTransition3: 10,
  finalCollapse: 12, coreExposed: 8, death: 14,
};
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function normalizeAuthoredFrame(source, destination) {
  const { data, info } = await sharp(source)
    .resize(768, 768, { fit: "contain", background: transparent })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const [red, green, blue] = data.subarray(offset, offset + 3);
    if (green > 150 && green > red * 1.3 && green > blue * 1.3) data[offset + 3] = 0;
  }
  await sharp(data, { raw: info })
    .png({ palette: true, quality: 46, colours: 48, compressionLevel: 9 })
    .toFile(destination);
}

for (const [state, frames] of Object.entries(required)) {
  const authoredFolder = path.join(sourceRoot, state);
  const runtimeFolder = path.join(runtimeRoot, state);
  await fs.mkdir(runtimeFolder, { recursive: true });
  for (let frame = 0; frame < frames; frame += 1) {
    const source = path.join(authoredFolder, `frame${frame}.png`);
    try { await fs.access(source); } catch { throw new Error(`Missing authored pose: ${source}`); }
    await normalizeAuthoredFrame(source, path.join(runtimeFolder, `frame${frame}.png`));
  }
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
manifest.animations = Object.fromEntries(Object.entries(required).map(([state, frames]) => [state, {
  frames,
  frameMs: manifest.animationFrameMs?.[state] || (state === "death" ? 330 : 120),
  loop: state === "idle" || state === "coreExposed",
}]));
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Processed ${Object.values(required).reduce((total, frames) => total + frames, 0)} individually-authored Colosso frames.`);
