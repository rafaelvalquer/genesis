import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "art/source/interceptadorIcaro/v3/paralyzed-redo");
const art = path.join(root, "art/sprites/interceptadorIcaro/paralyzed");
const runtime = path.join(root, "src/game/assets/troop/interceptadorIcaro/paralyzed");
const qa = path.join(root, "art/qa/interceptadorIcaro-v3");
const size = 384;
const rootY = 371;

function borderWhiteToTransparent(data, width, height) {
  const seen = new Uint8Array(width * height);
  const stack = [];
  const isBackground = (i) => {
    const p = i * 4;
    return data[p + 3] > 0 && data[p] > 232 && data[p + 1] > 232 && data[p + 2] > 232
      && Math.max(data[p], data[p + 1], data[p + 2]) - Math.min(data[p], data[p + 1], data[p + 2]) < 16;
  };
  for (let x = 0; x < width; x += 1) { stack.push(x, (height - 1) * width + x); }
  for (let y = 1; y < height - 1; y += 1) { stack.push(y * width, y * width + width - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !isBackground(i)) continue;
    seen[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % width;
    if (x > 0) stack.push(i - 1);
    if (x + 1 < width) stack.push(i + 1);
    if (i >= width) stack.push(i - width);
    if (i + width < width * height) stack.push(i + width);
  }
}

const frames = [];
for (let index = 0; index < 8; index += 1) {
  const input = path.join(source, `frame${index}.png`);
  const inputMeta = await sharp(input).metadata();
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (!inputMeta.hasAlpha) borderWhiteToTransparent(data, info.width, info.height);
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * 4 + 3] > 8) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (right < left) throw new Error(`frame${index} has no visible pixels`);
  frames.push({ index, data, info, left, top, width: right - left + 1, height: bottom - top + 1 });
}

const scale = Math.min(...frames.map((frame) => Math.min(360 / frame.width, 327 / frame.height)));
await Promise.all([fs.mkdir(art, { recursive: true }), fs.mkdir(runtime, { recursive: true }), fs.mkdir(qa, { recursive: true })]);
const outputBuffers = [];
for (const frame of frames) {
  const extracted = await sharp(frame.data, { raw: { width: frame.info.width, height: frame.info.height, channels: 4 } })
    .extract({ left: frame.left, top: frame.top, width: frame.width, height: frame.height })
    .resize({ width: Math.round(frame.width * scale), height: Math.round(frame.height * scale), kernel: sharp.kernel.lanczos3 })
    .png().toBuffer();
  const meta = await sharp(extracted).metadata();
  const canvas = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: extracted, left: Math.round((size - meta.width) / 2), top: rootY - meta.height + 1 }]).png().toBuffer();
  outputBuffers.push(canvas);
  await Promise.all([
    fs.writeFile(path.join(art, `frame${frame.index}.png`), canvas),
    fs.writeFile(path.join(runtime, `frame${frame.index}.png`), canvas),
    fs.writeFile(path.join(source, "runtime", `frame${frame.index}.png`), canvas),
  ]);
}
const tile = 192;
const grid = await sharp({ create: { width: tile * 4, height: tile * 2, channels: 4, background: { r: 14, g: 17, b: 29, alpha: 1 } } })
  .composite(await Promise.all(outputBuffers.map(async (image, i) => ({ input: await sharp(image).resize(tile, tile).png().toBuffer(), left: (i % 4) * tile, top: Math.floor(i / 4) * tile })))).png().toBuffer();
await fs.writeFile(path.join(qa, "paralyzed-redo-runtime-grid.png"), grid);
console.log(JSON.stringify({ scale, frames: frames.map(({ index, width, height }) => ({ index, width, height })) }, null, 2));
