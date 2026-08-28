import path from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error("Uso: node scripts/prepare-garravinha-single-sprite.mjs <source.png> <destination.png>");

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const sourceImage = sharp(source);
const metadata = await sourceImage.metadata();
const { data, info } = await sourceImage.ensureAlpha().removeAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc((data.length / 3) * 4);
for (let sourceIndex = 0, targetIndex = 0; sourceIndex < data.length; sourceIndex += 3, targetIndex += 4) {
  const r = data[sourceIndex]; const g = data[sourceIndex + 1]; const b = data[sourceIndex + 2];
  const lightMatte = !metadata.hasAlpha && Math.min(r, g, b) > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 35;
  rgba[targetIndex] = r; rgba[targetIndex + 1] = g; rgba[targetIndex + 2] = b; rgba[targetIndex + 3] = lightMatte ? 0 : 255;
}

const seen = new Uint8Array(info.width * info.height); let largest = [];
for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
  const start = y * info.width + x;
  if (seen[start] || rgba[start * 4 + 3] <= 20) continue;
  const queue = [start]; const component = []; seen[start] = 1;
  while (queue.length) {
    const current = queue.pop(); component.push(current);
    const cx = current % info.width; const cy = Math.floor(current / info.width);
    for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
      if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
      const next = ny * info.width + nx;
      if (!seen[next] && rgba[next * 4 + 3] > 20) { seen[next] = 1; queue.push(next); }
    }
  }
  if (component.length > largest.length) largest = component;
}
const keep = new Uint8Array(info.width * info.height); for (const pixel of largest) keep[pixel] = 1;
for (let pixel = 0; pixel < keep.length; pixel += 1) if (!keep[pixel]) rgba[pixel * 4 + 3] = 0;

await mkdir(path.dirname(path.resolve(destination)), { recursive: true });
await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ background: transparent, threshold: 10 })
  .resize(384, 384, { fit: "contain", background: transparent })
  .extend({ top: 64, bottom: 64, left: 64, right: 64, background: transparent })
  .png()
  .toFile(path.resolve(destination));
console.log(`Sprite preparado: ${destination}`);
