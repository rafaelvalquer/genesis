import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [sheet, state] = process.argv.slice(2);
if (!sheet || !state) throw new Error("Uso: node scripts/crop-garravinha-pose-sheet.mjs <sheet.png> <state>");
const outputDir = path.resolve("src/game/assets/enemy/garravinha", state);
await mkdir(outputDir, { recursive: true });
const metadata = await sharp(sheet).metadata();
const cellWidth = Math.floor(metadata.width / 4);
const cellHeight = Math.floor(metadata.height / 2);
const opaqueMatte = { r: 255, g: 255, b: 255, alpha: 1 };

function keepLargestSilhouette(buffer) {
  const width = 512; const height = 512; const seen = new Uint8Array(width * height); let largest = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const start = y * width + x; if (seen[start] || buffer[start * 4 + 3] <= 20) continue;
    const queue = [start]; const component = []; seen[start] = 1;
    while (queue.length) {
      const at = queue.pop(); component.push(at); const cx = at % width; const cy = Math.floor(at / width);
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue; const next = ny * width + nx;
        if (!seen[next] && buffer[next * 4 + 3] > 20) { seen[next] = 1; queue.push(next); }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Uint8Array(width * height); for (const at of largest) keep[at] = 1;
  for (let at = 0; at < width * height; at += 1) if (!keep[at]) buffer[at * 4 + 3] = 0;
}

for (let index = 0; index < 8; index += 1) {
  const left = (index % 4) * cellWidth;
  const top = Math.floor(index / 4) * cellHeight;
  const cell = await sharp(sheet).extract({ left, top, width: cellWidth, height: cellHeight }).resize(512, 512, { fit: "contain", background: opaqueMatte }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(cell.data.length / 3 * 4);
  for (let p = 0, q = 0; p < cell.data.length; p += 3, q += 4) {
    const red = cell.data[p]; const green = cell.data[p + 1]; const blue = cell.data[p + 2];
    const grayBackground = Math.min(red, green, blue) > 145 && Math.max(red, green, blue) - Math.min(red, green, blue) < 52;
    rgba[q] = red; rgba[q + 1] = green; rgba[q + 2] = blue; rgba[q + 3] = grayBackground ? 0 : 255;
  }
  keepLargestSilhouette(rgba);
  await sharp(rgba, { raw: { width: 512, height: 512, channels: 4 } })
    .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 }, threshold: 12 })
    .resize(420, 460, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 26, bottom: 26, left: 46, right: 46, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(outputDir, `frame${index}.png`));
}
console.log(`${state}: 8 frames recortados para ${outputDir}`);
