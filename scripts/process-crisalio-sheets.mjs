import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SHEET_ROOT = path.join(ROOT, "art", "spritesheets", "crisalio");
const TARGET_ROOT = path.join(ROOT, "src", "game", "assets", "enemy", "crisalio");
const STATES = ["idle", "walking", "attack", "pulse"];
const FRAME_SIZE = 256;
const ROOT_X = 128;
const ROOT_Y = 232;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function chromaToAlpha(data, info) {
  const output = Buffer.alloc(info.width * info.height * 4);
  for (let index = 0; index < info.width * info.height; index += 1) {
    const source = index * info.channels;
    const target = index * 4;
    const r = data[source];
    const g = data[source + 1];
    const b = data[source + 2];
    const greenDominance = g - Math.max(r, b);
    const keyStrength = Math.min((g - 145) / 80, (greenDominance - 70) / 95);
    const alpha = clamp(Math.round((1 - keyStrength) * 255), 0, 255);
    const spill = Math.max(0, greenDominance - 30);
    const despill = clamp(Math.round(Math.max(Math.max(r, b), g - spill * 0.85 - (255 - alpha) * 0.3)), 0, 255);
    output[target] = r;
    output[target + 1] = despill;
    output[target + 2] = b;
    output[target + 3] = alpha;
  }
  return output;
}

function alphaBounds(data, width, height, threshold = 20) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("Frame sem conteúdo após remoção do chroma key.");
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function coreAxis(data, width, bounds) {
  let weightedX = 0;
  let weight = 0;
  const y0 = bounds.minY + bounds.height * 0.35;
  const y1 = bounds.minY + bounds.height * 0.78;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];
      if (a < 100 || r < 105 || b < 135 || b < g * 1.04) continue;
      const pixelWeight = (r + b - g) * a / 255;
      weightedX += x * pixelWeight;
      weight += pixelWeight;
    }
  }
  return weight > 0 ? weightedX / weight : (bounds.minX + bounds.maxX) / 2;
}

async function readKeyedSheet(state) {
  const source = path.join(SHEET_ROOT, `crisalio-${state}-chroma.png`);
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = chromaToAlpha(data, info);
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9, palette: true, colors: 256, dither: 0.5 })
    .toFile(path.join(SHEET_ROOT, `crisalio-${state}.png`));
  return { rgba, width: info.width, height: info.height };
}

async function extractCells(sheet) {
  const cells = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const col = frame % 4;
    const row = Math.floor(frame / 4);
    const left = Math.round(col * sheet.width / 4);
    const right = Math.round((col + 1) * sheet.width / 4);
    const top = Math.round(row * sheet.height / 2);
    const bottom = Math.round((row + 1) * sheet.height / 2);
    const width = right - left;
    const height = bottom - top;
    const { data, info } = await sharp(sheet.rgba, {
      raw: { width: sheet.width, height: sheet.height, channels: 4 },
    }).extract({ left, top, width, height }).raw().toBuffer({ resolveWithObject: true });
    const bounds = alphaBounds(data, info.width, info.height);
    cells.push({ data, info, bounds, axis: coreAxis(data, info.width, bounds) });
  }
  return cells;
}

async function writeFrames(state, cells) {
  const maxHeight = Math.max(...cells.map(({ bounds }) => bounds.height));
  const maxLeft = Math.max(...cells.map(({ bounds, axis }) => axis - bounds.minX));
  const maxRight = Math.max(...cells.map(({ bounds, axis }) => bounds.maxX - axis));
  const loopScale = Math.min(216 / maxHeight, 120 / Math.max(maxLeft, maxRight));
  const outputDirectory = path.join(TARGET_ROOT, state);
  await fs.mkdir(outputDirectory, { recursive: true });

  for (let frame = 0; frame < cells.length; frame += 1) {
    const { data, info, bounds, axis } = cells[frame];
    const scale = ["attack", "pulse"].includes(state)
      ? Math.min(220 / bounds.height, 250 / bounds.width)
      : loopScale;
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    const axisOffset = (axis - bounds.minX) * scale;
    const left = clamp(Math.round(ROOT_X - axisOffset), 0, FRAME_SIZE - width);
    const top = clamp(ROOT_Y - height, 0, FRAME_SIZE - height);
    const sprite = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({ left: bounds.minX, top: bounds.minY, width: bounds.width, height: bounds.height })
      .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    await sharp({
      create: { width: FRAME_SIZE, height: FRAME_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: sprite, left, top }])
      .png({ compressionLevel: 9, palette: true, colors: 256, dither: 0.5 })
      .toFile(path.join(outputDirectory, `frame${frame}.png`));
  }
  console.log(`${state}: 8 frames, escala-base ${loopScale.toFixed(3)}, raiz (${ROOT_X}, ${ROOT_Y})`);
}

for (const state of STATES) {
  const sheet = await readKeyedSheet(state);
  const cells = await extractCells(sheet);
  await writeFrames(state, cells);
}

const idleSheet = await sharp(path.join(SHEET_ROOT, "crisalio-idle.png")).metadata();
const conceptCharacter = await sharp(path.join(SHEET_ROOT, "crisalio-idle.png"))
  .extract({ left: 0, top: 0, width: Math.round(idleSheet.width / 4), height: Math.round(idleSheet.height / 2) })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize(660, 700, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const conceptBackground = Buffer.from(`<svg width="1280" height="853" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#241144"/><stop offset="0.48" stop-color="#101424"/><stop offset="1" stop-color="#060810"/></radialGradient></defs>
  <rect width="1280" height="853" fill="url(#g)"/>
  <ellipse cx="640" cy="742" rx="360" ry="48" fill="#7fffd4" opacity="0.08"/>
</svg>`);
await fs.mkdir(path.join(ROOT, "src", "game", "assets", "enemy", "concepts"), { recursive: true });
await sharp(conceptBackground)
  .composite([{ input: conceptCharacter, left: 310, top: 90 }])
  .webp({ quality: 88, effort: 6 })
  .toFile(path.join(ROOT, "src", "game", "assets", "enemy", "concepts", "crisalio.webp"));
