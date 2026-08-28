import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const state = process.argv[process.argv.indexOf("--state") + 1];
const inputDir = process.argv[process.argv.indexOf("--input-dir") + 1];
if (!state || !inputDir) throw new Error("Uso: node scripts/import-interceptador-icaro-generated-state.mjs --state <estado> --input-dir <pasta>");

const outputDir = path.resolve("art/sprites/interceptadorIcaro", state);
const frameSize = 384;
const baseline = 371;
const outputBaseline = state === "paralyzed" ? 369 : baseline;
const rootX = 192;
const standing = state !== "death";

function isWhiteMatte(data, index) {
  const r = data[index]; const g = data[index + 1]; const b = data[index + 2];
  // Generated transparency previews sometimes arrive as a near-white checkerboard
  // baked into RGB. Flood only border-connected neutral pixels so bright armor
  // highlights inside the character remain intact.
  return r >= 220 && g >= 220 && b >= 220 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;
}

function removeBorderMatte(data, width, height, channels) {
  const seen = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    const pixel = y * width + x;
    if (seen[pixel] || !isWhiteMatte(data, pixel * channels)) return;
    seen[pixel] = 1; queue.push(pixel);
  };
  for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
  for (let y = 1; y < height - 1; y += 1) { push(0, y); push(width - 1, y); }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixel = queue[cursor];
    const x = pixel % width; const y = Math.floor(pixel / width);
    data[pixel * channels + 3] = 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) push(nx, ny);
    }
  }
}

function alphaBounds(data, width, height, channels) {
  let left = width; let right = -1; let top = height; let bottom = -1;
  for (let index = 0; index < width * height; index += 1) {
    if (data[index * channels + 3] < 8) continue;
    const x = index % width; const y = Math.floor(index / width);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error("Quadro sem pixels após remoção do matte.");
  return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function footRootX(data, width, channels, bounds) {
  const bandTop = bounds.bottom - Math.ceil(bounds.height * 0.14);
  let left = width; let right = -1;
  for (let y = bandTop; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      if (data[(y * width + x) * channels + 3] < 48) continue;
      left = Math.min(left, x); right = Math.max(right, x);
    }
  }
  return right >= left ? (left + right) / 2 : (bounds.left + bounds.right) / 2;
}

async function readClean(file) {
  const decoded = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeBorderMatte(decoded.data, decoded.info.width, decoded.info.height, decoded.info.channels);
  return { ...decoded, bounds: alphaBounds(decoded.data, decoded.info.width, decoded.info.height, decoded.info.channels) };
}

const files = Array.from({ length: 8 }, (_, frame) => path.resolve(inputDir, `frame${frame}.png`));
const frames = await Promise.all(files.map(readClean));
const reference = frames[0];
const crop = {
  left: reference.bounds.left,
  top: reference.bounds.top,
  width: reference.bounds.width,
  height: reference.bounds.height,
};
// Every standing state shares this single source-to-runtime scale.  Individual
// frames may never choose their own scale; a pose that does not fit is rejected.
const scale = 0.25;
if (reference.bounds.width * scale > 360 || reference.bounds.height * scale > (standing ? 327 : 350)) {
  throw new Error(`${state}/frame0 excede o canvas no scale global ${scale}; regenere com enquadramento mais compacto.`);
}
const scaledRoot = (footRootX(
  reference.data,
  reference.info.width,
  reference.info.channels,
  reference.bounds,
) - crop.left) * scale;
const left = Math.round(rootX - scaledRoot);
const top = Math.round(baseline - reference.bounds.height * scale);

await fs.mkdir(outputDir, { recursive: true });
for (let frame = 0; frame < frames.length; frame += 1) {
  const decoded = frames[frame];
  const scaled = await sharp(decoded.data, { raw: decoded.info })
    .extract(crop)
    .resize({ width: Math.round(crop.width * scale), height: Math.round(crop.height * scale), kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  let output = await sharp({ create: { width: frameSize, height: frameSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
    .toBuffer();
  if (standing) {
    const canvas = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bounds = alphaBounds(canvas.data, canvas.info.width, canvas.info.height, canvas.info.channels);
    const actualRootX = footRootX(canvas.data, canvas.info.width, canvas.info.channels, bounds);
    // This only compensates generator framing drift; it never changes scale or pose.
    output = await sharp({ create: { width: frameSize, height: frameSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{
        input: canvas.data,
        raw: canvas.info,
        left: Math.round(rootX - actualRootX),
        top: Math.round(outputBaseline - bounds.bottom),
      }])
      .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
      .toBuffer();
  }
  await fs.writeFile(path.join(outputDir, `frame${frame}.png`), output);
}

console.log(`${state}: 8 frames importados com matriz de canvas comum (scale=${scale.toFixed(6)}, left=${left}, top=${top}).`);
