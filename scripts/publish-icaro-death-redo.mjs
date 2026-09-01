import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "art/source/interceptadorIcaro/v3/death-redo");
const destinations = [path.join(root, "art/sprites/interceptadorIcaro/death"), path.join(root, "src/game/assets/troop/interceptadorIcaro/death"), path.join(source, "runtime")];
const frames = [];
for (let i = 0; i < 8; i += 1) {
  const { data, info } = await sharp(path.join(source, `frame${i}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) if (data[(y * info.width + x) * 4 + 3] > 8) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  frames.push({ i, data, info, left, top, width: right - left + 1, height: bottom - top + 1 });
}
const scale = Math.min(...frames.map(f => Math.min(360 / f.width, 348 / f.height)));
await Promise.all(destinations.map(d => fs.mkdir(d, { recursive: true })));
const outputs = [];
for (const f of frames) {
  const sprite = await sharp(f.data, { raw: { width: f.info.width, height: f.info.height, channels: 4 } })
    .extract({ left: f.left, top: f.top, width: f.width, height: f.height })
    .resize({ width: Math.round(f.width * scale), height: Math.round(f.height * scale), kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const meta = await sharp(sprite).metadata();
  const canvas = await sharp({ create: { width: 384, height: 384, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: sprite, left: Math.round((384 - meta.width) / 2), top: 371 - meta.height + 1 }]).png().toBuffer();
  outputs.push(canvas);
  await Promise.all(destinations.map(d => fs.writeFile(path.join(d, `frame${f.i}.png`), canvas)));
}
const tiles = await Promise.all(outputs.map(async (image, i) => ({ input: await sharp(image).resize(192, 192).png().toBuffer(), left: (i % 4) * 192, top: Math.floor(i / 4) * 192 })));
await fs.mkdir(path.join(root, "art/qa/interceptadorIcaro-v3"), { recursive: true });
await sharp({ create: { width: 768, height: 384, channels: 4, background: { r: 14, g: 17, b: 29, alpha: 1 } } }).composite(tiles).png().toFile(path.join(root, "art/qa/interceptadorIcaro-v3/death-redo-runtime-grid.png"));
console.log(`Published at common scale ${scale}`);
