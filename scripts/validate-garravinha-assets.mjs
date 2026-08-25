import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..", "src/game/assets/enemy/garravinha");
const states = { idle: 8, walking: 8, attack: 8, latchPrep: 6, latchLeap: 6, latched: 8, death: 8 };
const failures = []; const warnings = []; const report = {};
async function raw(file) { return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
function alpha(data, width, x, y) { return data[(y * width + x) * 4 + 3]; }
function components(data, width, height) {
  const seen = new Uint8Array(width * height); const result = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const start = y * width + x; if (seen[start] || alpha(data, width, x, y) <= 20) continue;
    const queue = [start]; const pixels = []; seen[start] = 1;
    while (queue.length) { const at = queue.pop(); pixels.push(at); const cx = at % width; const cy = Math.floor(at / width);
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue; const next = ny * width + nx;
        if (!seen[next] && alpha(data, width, nx, ny) > 20) { seen[next] = 1; queue.push(next); }
      }
    } result.push(pixels.length);
  } return result.sort((a, b) => b - a);
}
async function frameReport(file) {
  const { data, info } = await raw(file); if (info.width !== 512 || info.height !== 512) failures.push(`${file}: expected 512x512`);
  let visible = 0; let minX = 512; let minY = 512; let maxX = -1; let maxY = -1; let guard = 0;
  for (let y = 0; y < 512; y += 1) for (let x = 0; x < 512; x += 1) if (alpha(data, info.width, x, y) > 0) {
    visible += 1; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    if (x < 16 || x >= 496 || y < 8 || y >= 500) guard += 1;
  }
  if (!visible) failures.push(`${file}: empty`); if (guard) failures.push(`${file}: ${guard} guard-band pixels`);
  const parts = components(data, info.width, info.height); if (parts[1] > 100) failures.push(`${file}: secondary component ${parts[1]} pixels`);
  return { bbox: [minX, minY, maxX, maxY], guardPixels: guard, components: parts.slice(0, 3) };
}
for (const [state, count] of Object.entries(states)) {
  const dir = path.join(root, state); const files = (await fs.readdir(dir)).filter((name) => /^frame\d+\.png$/.test(name)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (files.length !== count) failures.push(`${state}: expected ${count}, found ${files.length}`); report[state] = [];
  const hashes = new Set();
  for (const file of files) { const bytes = await fs.readFile(path.join(dir, file)); const hash = crypto.createHash("sha256").update(bytes).digest("hex"); if (hashes.has(hash)) failures.push(`${state}: duplicate frame ${file}`); hashes.add(hash); report[state].push({ file, ...(await frameReport(path.join(dir, file))) }); }
  const sheet = path.join(root, `garravinha_${state}_sheet.png`); const metadata = await sharp(sheet).metadata(); const expectedWidth = ["latchPrep", "latchLeap"].includes(state) ? 3072 : 4096;
  if (metadata.width !== expectedWidth || metadata.height !== 512) failures.push(`${sheet}: expected ${expectedWidth}x512`);
  for (let i = 0; i < Math.min(count, files.length); i += 1) {
    const source = (await raw(path.join(dir, `frame${i}.png`))).data; const crop = await sharp(sheet).extract({ left: i * 512, top: 0, width: 512, height: 512 }).ensureAlpha().raw().toBuffer(); let mismatch = false;
    for (let p = 0; p < source.length; p += 4) { const delta = source[p + 3] ? Math.max(Math.abs(source[p] - crop[p]), Math.abs(source[p + 1] - crop[p + 1]), Math.abs(source[p + 2] - crop[p + 2])) : 0; if (source[p + 3] !== crop[p + 3] || delta > 1) { mismatch = true; break; } }
    if (mismatch) failures.push(`${state}: round-trip mismatch frame${i}`);
  }
}
const boxes = Object.values(report).flat().map((entry) => entry.bbox);
const maxBoundingBox = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
console.log(JSON.stringify({ failures, warnings, maxBoundingBox, report }, null, 2)); if (failures.length) process.exitCode = 1;
