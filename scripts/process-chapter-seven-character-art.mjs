import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceRoot = "C:/Users/Z565244/.codex/generated_images/01a020a5-3b73-7200-98db-c03fca21834f";

async function screenToAlpha(path) {
  const image = sharp(path).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const max = Math.max(data[index], data[index + 1], data[index + 2]);
    const alpha = Math.max(0, Math.min(255, Math.round((max - 4) * 2.2)));
    data[index + 3] = Math.min(data[index + 3], alpha);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function sourceCutout(path) {
  return screenToAlpha(path);
}

async function frame(source, state, index, boss = false) {
  const phase = index / 8 * Math.PI * 2;
  const bob = state === "idle" ? Math.round(Math.sin(phase) * 2)
    : state === "walking" ? Math.round(Math.sin(phase * 2) * 6) : Math.round(Math.sin(phase) * 3);
  const lunge = state === "attack" ? Math.round((1 - Math.cos(phase)) * -8) : 0;
  const angle = state === "walking" ? Math.sin(phase) * 1.4 : state === "attack" ? Math.sin(phase) * .7 : 0;
  const width = boss ? 384 : 340;
  const height = boss ? 456 : 418;
  const sprite = await sharp(source).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(width + (state === "attack" ? Math.round((1 - Math.cos(phase)) * 8) : 0), height, {
      fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: sprite, gravity: "south", left: Math.max(0, Math.round((512 - width) / 2 + lunge)), top: Math.max(0, 512 - height + bob - 12) }])
    .png({ compressionLevel: 9, palette: true, quality: 92 }).toBuffer();
}

const convoySource = `${sourceRoot}/exec-e6ca3f29-57c7-41b8-8c1d-abed9c455fe9.png`;
const { data, info } = await sharp(convoySource).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let index = 0; index < data.length; index += 4) {
  const min = Math.min(data[index], data[index + 1], data[index + 2]);
  data[index + 3] = Math.max(0, Math.min(255, Math.round((238 - min) * 7)));
}
const convoyDirectory = new URL("../src/game/assets/chapter07/", import.meta.url);
await mkdir(convoyDirectory, { recursive: true });
await sharp(data, { raw: info }).trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .resize(720, 300, { fit: "contain" }).png({ compressionLevel: 9 }).toFile(fileURLToPath(new URL("convoy.png", convoyDirectory)));
console.log("convoy");
