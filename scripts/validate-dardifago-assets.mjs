import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import crypto from "node:crypto";

const root = path.resolve("src/game/assets/enemy/dardifago");
const states = ["idle", "walking", "dartAttack", "toxicAttack", "death"];
const fail = (message) => { throw new Error(`Dardifago asset QA: ${message}`); };
const hashes = new Set();
for (const state of states) {
  for (let frame = 0; frame < 8; frame += 1) {
    const file = path.join(root, state, `frame${frame}.png`);
    const image = sharp(file); const meta = await image.metadata();
    if (meta.width !== 512 || meta.height !== 512 || meta.channels !== 4) fail(`${state}/frame${frame} must be 512x512 RGBA`);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
    for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) if (data[(y * info.width + x) * info.channels + 3] > 8) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    if (minX < 16 || minY < 8 || maxX > 495 || maxY > 503) fail(`${state}/frame${frame} violates guard band`);
    const hash = crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
    if (hashes.has(`${state}:${hash}`)) fail(`duplicate frame in ${state}`); hashes.add(`${state}:${hash}`);
  }
}
for (const file of ["src/game/assets/effects/dardifagoDart/normal/frame0.png", "src/game/assets/effects/dardifagoDart/toxic/frame0.png"]) {
  const meta = await sharp(file).metadata(); if (meta.width !== 128 || meta.height !== 128 || meta.channels !== 4) fail(`${file} must be 128x128 RGBA`);
}
for (const state of states) {
  const sheet = await sharp(path.join(root, `dardifago_${state}_sheet.png`)).metadata();
  if (sheet.width !== 4096 || sheet.height !== 512) fail(`${state} sheet dimensions`);
  for (let frame = 0; frame < 8; frame += 1) {
    const actual = await sharp(path.join(root, `dardifago_${state}_sheet.png`)).extract({ left: frame * 512, top: 0, width: 512, height: 512 }).ensureAlpha().raw().toBuffer();
    const expected = await sharp(path.join(root, state, `frame${frame}.png`)).ensureAlpha().raw().toBuffer();
    let maxDelta = 0; for (let index = 0; index < actual.length; index += 4) { if (actual[index + 3] > 200 || expected[index + 3] > 200) for (let channel = 0; channel < 4; channel += 1) maxDelta = Math.max(maxDelta, Math.abs(actual[index + channel] - expected[index + channel])); }
    if (maxDelta > 1) fail(`${state} sheet round-trip pixel mismatch at frame ${frame}`);
  }
}
console.log("Dardifago asset QA passed: 40 character frames, 2 projectiles, 5 round-trippable sheets.");
