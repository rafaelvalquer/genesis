import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets-source/enemy/colossoCaldeira");
const states = { spawnAwakening: 12, idle: 8, riftTelegraph: 6, riftAttack: 6, slamTelegraph: 6, slamAttack: 8, fractureTelegraph: 8, fractureAttack: 8, seismicTelegraph: 8, seismicAttack: 8, phaseTransition2: 10, phaseTransition3: 10, finalCollapse: 12, coreExposed: 8, death: 14 };
const canvas = 768; const targetFootRoot = { x: 384, y: 660 };

function removeBackdrop(data, info) {
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const [red, green, blue] = data.subarray(offset, offset + 3);
    if ((green > 150 && green > red * 1.3 && green > blue * 1.3) || (red > 232 && green > 232 && blue > 232 && Math.max(red, green, blue) - Math.min(red, green, blue) < 14)) data[offset + 3] = 0;
  }
}

function footRoot(data, info) {
  let minX = info.width; let minY = info.height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * info.channels + 3] < 16) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < 0) throw new Error("empty source frame");
  const supportTop = Math.max(minY, Math.floor(maxY - (maxY - minY + 1) * .07));
  let footMinX = info.width; let footMaxX = -1;
  for (let y = supportTop; y <= maxY; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * info.channels + 3] < 16) continue;
    footMinX = Math.min(footMinX, x); footMaxX = Math.max(footMaxX, x);
  }
  return { x: (footMinX + footMaxX) / 2, y: maxY };
}

for (const [state, frames] of Object.entries(states)) {
  const loaded = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const file = path.join(root, state, `frame${frame === 13 && state === "death" ? 12 : frame}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeBackdrop(data, info);
    let minX = info.width; let minY = info.height; let maxX = -1; let maxY = -1;
    for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) if (data[(y * info.width + x) * info.channels + 3] >= 16) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const foot = footRoot(data, info);
    loaded.push({ file, data, info, minX, minY, maxX, maxY, foot });
  }
  let stateScale = 1;
  for (const frame of loaded) {
    const left = frame.foot.x - frame.minX; const right = frame.maxX - frame.foot.x;
    const top = frame.foot.y - frame.minY; const bottom = frame.maxY - frame.foot.y;
    if (left > 0) stateScale = Math.min(stateScale, (targetFootRoot.x - 8) / left);
    if (right > 0) stateScale = Math.min(stateScale, (canvas - 8 - targetFootRoot.x) / right);
    if (top > 0) stateScale = Math.min(stateScale, (targetFootRoot.y - 8) / top);
    if (bottom > 0) stateScale = Math.min(stateScale, (canvas - 8 - targetFootRoot.y) / bottom);
  }
  for (const frame of loaded) {
    const width = frame.maxX - frame.minX + 1; const height = frame.maxY - frame.minY + 1;
    const crop = Buffer.alloc(width * height * frame.info.channels);
    for (let y = frame.minY; y <= frame.maxY; y += 1) for (let x = frame.minX; x <= frame.maxX; x += 1) {
      const source = (y * frame.info.width + x) * frame.info.channels;
      const target = ((y - frame.minY) * width + x - frame.minX) * frame.info.channels;
      frame.data.copy(crop, target, source, source + frame.info.channels);
    }
    const scaledWidth = Math.max(1, Math.round(width * stateScale)); const scaledHeight = Math.max(1, Math.round(height * stateScale));
    const { data, info } = await sharp(crop, { raw: { width, height, channels: frame.info.channels } }).resize(scaledWidth, scaledHeight, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.alloc(canvas * canvas * info.channels);
    const footX = (frame.foot.x - frame.minX) / width * info.width;
    const footY = (frame.foot.y - frame.minY) / height * info.height;
    const dx = Math.round(targetFootRoot.x - footX); const dy = Math.round(targetFootRoot.y - footY);
    for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
      const source = (y * info.width + x) * info.channels;
      if (data[source + 3] < 16) continue;
      const tx = x + dx; const ty = y + dy;
      if (tx < 0 || tx >= canvas || ty < 0 || ty >= canvas) throw new Error(`${state}: shared source scale still clips a frame`);
      data.copy(out, (ty * canvas + tx) * info.channels, source, source + info.channels);
    }
    await sharp(out, { raw: { width: canvas, height: canvas, channels: info.channels } }).png().toFile(frame.file);
  }
}
console.log("Reframed 132 Colosso source frames around a common foot root.");
