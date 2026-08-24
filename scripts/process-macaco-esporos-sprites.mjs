import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "art", "source", "macacoEsporos");
const previewRoot = path.join(root, "art", "spritesheets", "macacoEsporos");
const outputRoot = path.join(root, "src", "game", "assets", "enemy", "macacoEsporos");
const qaRoot = path.join(root, "qa");
const states = ["idle", "walking", "attack", "sporeThrow"];
const size = 512;
const groundY = 498;
const hash = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

function cleanChroma(data) {
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (Math.min(r, b) - g > 110) data[i + 3] = 0;
    // Some generators render a checkerboard instead of returning alpha. It is
    // never part of this character's palette, so remove it before components.
    if (r > 170 && g > 170 && b > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 22) data[i + 3] = 0;
    if (data[i + 3] < 6) data.fill(0, i, i + 4);
  }
}
function alphaBounds(data, info) {
  let left = info.width; let right = -1; let top = info.height; let bottom = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * 4 + 3] < 20) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error("Empty Macaco de Esporos source frame");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}
function removeBorderNoise(data, info) {
  const seen = new Uint8Array(info.width * info.height); const parts = [];
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] || data[start * 4 + 3] < 20) continue;
    const queue = [start]; seen[start] = 1; let edge = false;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const p = queue[cursor]; const x = p % info.width; const y = Math.floor(p / info.width);
      edge ||= x < 2 || y < 2 || x >= info.width - 2 || y >= info.height - 2;
      for (const next of [x ? p - 1 : -1, x + 1 < info.width ? p + 1 : -1, y ? p - info.width : -1, y + 1 < info.height ? p + info.width : -1]) {
        if (next >= 0 && !seen[next] && data[next * 4 + 3] >= 20) { seen[next] = 1; queue.push(next); }
      }
    }
    parts.push({ pixels: queue, edge });
  }
  const largest = Math.max(1, ...parts.map((part) => part.pixels.length));
  for (const part of parts) if (part.edge && part.pixels.length < largest * .015) for (const p of part.pixels) data.fill(0, p * 4, p * 4 + 4);
}
async function readSource(state, index) {
  const file = state === "master" ? path.join(sourceRoot, "master", "macacoEsporos-master.png") : path.join(sourceRoot, state, `frame${index}.png`);
  const { data, info } = await sharp(file).resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  cleanChroma(data); removeBorderNoise(data, info);
  return { state, index, data, info, box: alphaBounds(data, info) };
}
function assertDistinct(frames) {
  for (const state of states) if (new Set(frames.filter((f) => f.state === state).map((f) => hash(f.data))).size < 8) throw new Error(`${state} has duplicate source frames`);
  for (let index = 0; index < 8; index += 1) if (new Set(states.map((state) => hash(frames.find((f) => f.state === state && f.index === index).data))).size !== 4) throw new Error(`frame ${index} duplicated across states`);
}
async function render(frame, scale) {
  const { data, info, box } = frame;
  const crop = await sharp(data, { raw: info }).extract({ left: box.left, top: box.top, width: box.width, height: box.height }).resize({ width: Math.round(box.width * scale), height: Math.round(box.height * scale), kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const meta = await sharp(crop).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: crop, left: Math.round(256 - meta.width / 2), top: groundY - meta.height }]).png({ compressionLevel: 9 }).toBuffer();
}
async function sheet(file, buffers, rows = 1) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  return sharp({ create: { width: 8 * size, height: rows * size, channels: 4, background: { r: 24, g: 57, b: 67, alpha: 1 } } }).composite(buffers.map((input, i) => ({ input, left: i % 8 * size, top: Math.floor(i / 8) * size }))).png().toFile(file);
}

const frames = await Promise.all(states.flatMap((state) => Array.from({ length: 8 }, (_, index) => readSource(state, index))));
assertDistinct(frames);
const master = await readSource("master", 0);
const scale = Math.min(420 / master.box.height, 460 / master.box.width); // exactly one body scale across all 32 frames
const rendered = new Map();
for (const frame of frames) rendered.set(`${frame.state}/${frame.index}`, await render(frame, scale));
for (const state of states) {
  const buffers = Array.from({ length: 8 }, (_, index) => rendered.get(`${state}/${index}`));
  await fs.mkdir(path.join(outputRoot, state), { recursive: true });
  await Promise.all(buffers.map((buffer, index) => fs.writeFile(path.join(outputRoot, state, `frame${index}.png`), buffer)));
  await sheet(path.join(previewRoot, `preview-${state}.png`), buffers);
  await sheet(path.join(qaRoot, `macacoEsporos-${state}.webp`), buffers);
}
await sheet(path.join(qaRoot, "macacoEsporos-all-animations.png"), states.flatMap((state) => Array.from({ length: 8 }, (_, index) => rendered.get(`${state}/${index}`))), 4);
console.log(`Processed 32 individual Macaco de Esporos frames with one global scale ${scale.toFixed(4)}.`);
