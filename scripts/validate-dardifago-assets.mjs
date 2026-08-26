import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import crypto from "node:crypto";

const root = path.resolve("src/game/assets/enemy/dardifago");
const states = ["idle", "walking", "dartAttack", "toxicAttack", "death"];
const fail = (message) => { throw new Error(`Dardifago asset QA: ${message}`); };
const warnings = [];
const frames = new Map();

function connectedComponents(data, width, height) {
  const occupied = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) occupied[index] = data[index * 4 + 3] > 8 ? 1 : 0;
  const components = [];
  const queue = new Int32Array(width * height);
  for (let start = 0; start < occupied.length; start += 1) {
    if (!occupied[start]) continue;
    occupied[start] = 0;
    let head = 0; let tail = 0; let size = 0;
    queue[tail++] = start;
    while (head < tail) {
      const index = queue[head++]; size += 1;
      const x = index % width; const y = Math.floor(index / width);
      const neighbors = [index - 1, index + 1, index - width, index + width];
      if (x === 0) neighbors[0] = -1;
      if (x === width - 1) neighbors[1] = -1;
      if (y === 0) neighbors[2] = -1;
      if (y === height - 1) neighbors[3] = -1;
      for (const neighbor of neighbors) if (neighbor >= 0 && occupied[neighbor]) { occupied[neighbor] = 0; queue[tail++] = neighbor; }
    }
    if (size >= 12) components.push(size);
  }
  return components.sort((a, b) => b - a);
}

function boundingBox(data, width, height) {
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (data[(y * width + x) * 4 + 3] <= 8) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

const hashes = new Set();
for (const state of states) {
  const stateFrames = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const relative = `${state}/frame${frame}.png`;
    const file = path.join(root, relative);
    const meta = await sharp(file).metadata();
    if (meta.width !== 512 || meta.height !== 512 || meta.channels !== 4) fail(`${relative} must be 512x512 RGBA`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const box = boundingBox(data, info.width, info.height);
    if (box.minX < 24 || box.minY < 16 || box.maxX > 488 || box.maxY > 488) fail(`${relative} violates safe area x=24..488 y=16..488`);
    const components = connectedComponents(data, info.width, info.height);
    if (!components.length) fail(`${relative} has no visible character`);
    if (components.length > 1) warnings.push(`${relative} has ${components.length} visible components; inspect for detached fragments`);
    const hash = crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
    if (hashes.has(`${state}:${hash}`)) fail(`duplicate frame in ${state}`);
    hashes.add(`${state}:${hash}`);
    const entry = { data, box, components };
    frames.set(relative, entry); stateFrames.push(entry);
  }
  const limit = state === "idle" ? 4 : state === "walking" ? 8 : null;
  if (limit) for (let frame = 1; frame < stateFrames.length; frame += 1) {
    const previous = stateFrames[frame - 1].box; const current = stateFrames[frame].box;
    const drift = Math.hypot(current.centerX - previous.centerX, current.centerY - previous.centerY);
    if (drift > limit) warnings.push(`${state}/frame${frame - 1}→frame${frame} center drift ${drift.toFixed(1)}px exceeds ${limit}px guideline`);
  }
}

for (const state of ["dartAttack", "toxicAttack"]) {
  const before = frames.get(`${state}/frame3.png`).data;
  const after = frames.get(`${state}/frame4.png`).data;
  let changed = 0; let occupied = 0;
  for (let index = 0; index < before.length; index += 4) {
    const beforeAlpha = before[index + 3] > 8; const afterAlpha = after[index + 3] > 8;
    if (beforeAlpha || afterAlpha) occupied += 1;
    if (beforeAlpha !== afterAlpha || Math.abs(before[index] - after[index]) + Math.abs(before[index + 1] - after[index + 1]) + Math.abs(before[index + 2] - after[index + 2]) > 36) changed += 1;
  }
  if (changed < occupied * 0.015) fail(`${state} frame3→frame4 is visually unchanged; release pose is missing`);
}

for (const file of ["src/game/assets/effects/dardifagoDart/normal/frame0.png", "src/game/assets/effects/dardifagoDart/toxic/frame0.png"]) {
  const meta = await sharp(file).metadata();
  if (meta.width !== 128 || meta.height !== 128 || meta.channels !== 4) fail(`${file} must be 128x128 RGBA`);
}

for (const state of states) {
  const sheetPath = path.join(root, `dardifago_${state}_sheet.png`);
  const sheet = await sharp(sheetPath).metadata();
  if (sheet.width !== 4096 || sheet.height !== 512) fail(`${state} sheet dimensions`);
  for (let frame = 0; frame < 8; frame += 1) {
    const actual = await sharp(sheetPath).extract({ left: frame * 512, top: 0, width: 512, height: 512 }).ensureAlpha().raw().toBuffer();
    const expected = frames.get(`${state}/frame${frame}.png`).data;
    let maxDelta = 0;
    for (let index = 0; index < actual.length; index += 4) if (actual[index + 3] > 200 || expected[index + 3] > 200) for (let channel = 0; channel < 4; channel += 1) maxDelta = Math.max(maxDelta, Math.abs(actual[index + channel] - expected[index + channel]));
    if (maxDelta > 1) fail(`${state} sheet round-trip pixel mismatch at frame ${frame}`);
  }
}

if (warnings.length) console.warn(`Dardifago asset QA warnings (${warnings.length}):\n- ${warnings.join("\n- ")}`);
console.log(`Dardifago asset QA passed: 40 character frames, 2 projectiles, 5 round-trippable sheets${warnings.length ? `, ${warnings.length} visual warnings` : ""}.`);
