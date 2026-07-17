import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [idleSheet, walkingSheet, attackSheet] = process.argv.slice(2);
if (!idleSheet || !walkingSheet || !attackSheet) {
  throw new Error("uso: node scripts/process-mago-abissal-sheets.mjs IDLE WALKING ATTACK");
}

const root = path.resolve(import.meta.dirname, "..");
const targetRoot = path.join(root, "src", "game", "assets", "enemy", "magoAbissal");
const states = [
  { id: "idle", source: path.resolve(idleSheet), columns: 4, rows: 2, frames: 8, scale: 1 },
  { id: "walking", source: path.resolve(walkingSheet), columns: 4, rows: 2, frames: 8, scale: 1.18 },
  { id: "attack", source: path.resolve(attackSheet), columns: 4, rows: 3, frames: 12, scale: 1.25 },
];

async function alignFloatingAnchor(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 40) bottom = y;
    }
  }
  if (bottom < 0) return input;

  const bandTop = Math.max(0, bottom - 12);
  const anchorPixels = [];
  for (let y = bandTop; y <= bottom; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 80) anchorPixels.push(x);
    }
  }
  anchorPixels.sort((left, right) => left - right);
  const anchorX = anchorPixels[Math.floor(anchorPixels.length / 2)] ?? info.width / 2;
  const offsetX = Math.round(128 - anchorX);
  const offsetY = Math.round(238 - bottom);
  const margin = 256;
  const composed = await sharp({
    create: { width: 768, height: 768, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input, left: margin + offsetX, top: margin + offsetY }])
    .png()
    .toBuffer();
  return sharp(composed)
    .extract({ left: margin, top: margin, width: 256, height: 256 })
    .png({ compressionLevel: 9, palette: true, colors: 256, quality: 92, dither: 0.6 })
    .toBuffer();
}

async function processState(state) {
  const metadata = await sharp(state.source).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`folha inválida: ${state.source}`);
  const target = path.join(targetRoot, state.id);
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });

  for (let index = 0; index < state.frames; index += 1) {
    const column = index % state.columns;
    const row = Math.floor(index / state.columns);
    const left = Math.round(column * metadata.width / state.columns);
    const right = Math.round((column + 1) * metadata.width / state.columns);
    const top = Math.round(row * metadata.height / state.rows);
    const bottom = Math.round((row + 1) * metadata.height / state.rows);
    let frame = await sharp(state.source)
      .extract({ left, top, width: right - left, height: bottom - top })
      .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true, colors: 256, quality: 92, dither: 0.6 })
      .toBuffer();
    if (state.scale !== 1) {
      frame = await sharp(frame)
        .resize(Math.round(256 * state.scale), Math.round(256 * state.scale))
        .png()
        .toBuffer();
    }
    await fs.writeFile(path.join(target, `frame${index}.png`), await alignFloatingAnchor(frame));
  }
  console.log(`${state.id}: ${state.frames} frames (${metadata.width}x${metadata.height})`);
}

for (const state of states) await processState(state);
