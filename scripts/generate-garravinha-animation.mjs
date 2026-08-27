import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Uso: node scripts/generate-garravinha-animation.mjs <master.png>");

const root = path.resolve("src/game/assets/enemy/garravinha");
const canvas = 512;
const baseSize = 400;
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const cycles = {
  idle: [
    [1, 0, 0, 0], [1, 0, -1, 0], [1.005, 0, -2, 0], [1.01, 0, -2, 0],
    [1.005, 0, 1, 0], [.995, 0, 2, 1], [.998, 0, 1, 0], [1, 0.15, 0, 0],
  ],
  walking: [
    [1, -2, 2, 0], [.99, -1, 3, 2], [1, 1, 0, 0], [1.01, 2, -2, -1],
    [1, 2, 2, 0], [.99, 1, 3, 2], [1, -1, 0, 0], [1.01, -2, -2, -1],
  ],
  attack: [
    [1, 0, 0, 0], [.985, 1, 1, 1], [.965, 2, 2, 3], [.945, 2, 3, 5],
    [1.06, -4, -2, -2], [1.035, -3, -1, -1], [1.01, -1, 0, 0], [1, -0.15, 0, 0],
  ],
  latchPrep: [
    [1, 0, 0, 0], [.99, 0, 1, 1], [.965, 1, 2, 3], [.94, 1, 3, 5],
    [.925, 0, 4, 7], [.95, -2, 2, 4],
  ],
  latchLeap: [
    [.97, -3, -1, 0], [.99, -5, -5, -8], [1.01, -7, -9, -14], [1.025, -8, -11, -18],
    [1.01, -5, -7, -14], [.995, -2, -3, -8],
  ],
  latched: [
    [1, 0, 0, 0], [.998, 0, 0, 1], [.995, 0, 1, 1], [.998, 0, 0, 0],
    [1.002, 0, -1, 0], [.997, 0, 1, 1], [.999, 0.12, 0, 0], [1, -0.12, 0, 0],
  ],
  death: [
    [1, 0, 0, 0], [.99, 7, 0, 2], [.97, 12, 3, 6], [.95, 17, 7, 12],
    [.88, 22, 12, 18], [.92, 18, 9, 13], [.96, 12, 6, 8], [.96, 8, 8, 4],
  ],
};

async function renderFrame([scale, angle, dx, dy]) {
  const size = Math.round(baseSize * scale);
  const image = await sharp(source)
    .resize({ width: size, height: size, fit: "contain", background: transparent })
    .rotate(angle, { background: transparent })
    .png()
    .toBuffer();
  const metadata = await sharp(image).metadata();
  const left = Math.round((canvas - metadata.width) / 2 + dx);
  const top = Math.round((canvas - metadata.height) / 2 + dy);
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: transparent } })
    .composite([{ input: image, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toBuffer();
}

for (const [state, frames] of Object.entries(cycles)) {
  const directory = path.join(root, state);
  await mkdir(directory, { recursive: true });
  for (let index = 0; index < frames.length; index += 1) {
    await sharp(await renderFrame(frames[index])).toFile(path.join(directory, `frame${index}.png`));
  }
}

console.log(`Garravinha: ${Object.values(cycles).reduce((total, frames) => total + frames.length, 0)} frames gerados em canvas ${canvas}x${canvas}.`);
