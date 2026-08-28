import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputRoot = path.resolve(process.argv[2] || "art/qa/remaster/garravinha-separated-frames");
const seedRoot = path.resolve("art/qa/remaster/garravinha-separated-seeds");
const canvas = 512;
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const cycles = {
  idle: [[1, 0, 0, 0], [1.005, 0, 0, -1], [1.01, 0, 0, -2], [1.005, 0, 0, -1], [1, 0, 0, 0], [.995, 0, 0, 1], [.998, 0, 0, 1], [1, 0, 0, 0]],
  walking: [[1, -2, -2, 2], [.99, -1, -1, 3], [1, 1, 1, 0], [1.01, 2, 2, -1], [1, 2, 2, 0], [.99, 1, 1, 3], [1, -1, -1, 0], [1.01, -2, -2, -1]],
  attack: [[1, 0, 0, 0], [.985, 1, 1, 2], [.965, 2, 2, 5], [.945, 3, 3, 9], [1.06, -5, -8, -2], [1.04, -3, -5, -1], [1.01, -1, -2, 0], [1, 0, 0, 0]],
  latchPrep: [[1, 0, 0, 0], [.99, 0, 0, 2], [.97, 1, 1, 5], [.95, 2, 2, 8], [.93, 2, 2, 11], [.95, -1, -1, 7]],
  latchLeap: [[.96, -3, -2, 4], [.99, -5, -5, -5], [1.01, -7, -8, -14], [1.02, -8, -10, -20], [1.01, -5, -7, -14], [.99, -2, -3, -6]],
  latched: [[1, 0, 0, 0], [.998, 0, 0, 1], [.995, 1, 1, 1], [.998, 0, 0, 0], [1.002, -1, -1, 0], [.997, 1, 1, 1], [.999, 0, 0, 0], [1, 0, 0, 0]],
  death: [[1, 0, 0, -20], [.99, 7, 3, -15], [.97, 12, 7, -8], [.95, 17, 12, 0], [.91, 22, 16, 12], [.9, 18, 14, 16], [.9, 12, 10, 18], [.9, 8, 8, 20]],
};

async function prepareSeed(state) {
  const seed = await sharp(path.join(seedRoot, `${state}.png`))
    .ensureAlpha()
    .trim({ background: transparent, threshold: 10 })
    .resize({ width: 400, height: 400, fit: "contain", background: transparent })
    .png()
    .toBuffer();
  return seed;
}

async function renderFrame(seed, [scale, angle, dx, dy]) {
  const size = Math.round(400 * scale);
  const image = await sharp(seed)
    .resize({ width: size, height: size, fit: "contain", background: transparent })
    .rotate(angle, { background: transparent })
    .png()
    .toBuffer();
  const metadata = await sharp(image).metadata();
  const left = Math.round((canvas - metadata.width) / 2 + dx);
  const top = Math.round((canvas - metadata.height) / 2 + 32 + dy);
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: transparent } })
    .composite([{ input: image, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toBuffer();
}

for (const [state, frames] of Object.entries(cycles)) {
  const directory = path.join(outputRoot, state);
  const seed = await prepareSeed(state);
  await mkdir(directory, { recursive: true });
  for (let frame = 0; frame < frames.length; frame += 1) {
    await sharp(await renderFrame(seed, frames[frame])).toFile(path.join(directory, `frame${frame}.png`));
  }
}

console.log(`Garravinha: 52 sprites separados gerados em ${outputRoot}.`);
