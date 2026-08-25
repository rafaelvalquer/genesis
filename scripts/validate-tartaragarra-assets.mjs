import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..", "src", "game", "assets", "enemy", "tartaragarra");
const states = { idle: 8, walking: 8, chargePrep: 8, charge: 4, chargeRecover: 8, attack: 8, death: 8 };
const failures = [];
const warnings = [];
const report = {};

async function readPng(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

function alphaAt(data, width, x, y) { return data[(y * width + x) * 4 + 3]; }

function connectedComponents(data, width, height) {
  const visited = new Uint8Array(width * height);
  const components = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const start = y * width + x;
    if (visited[start] || alphaAt(data, width, x, y) <= 20) continue;
    const queue = [start]; visited[start] = 1; let size = 0;
    while (queue.length) {
      const index = queue.pop(); size += 1;
      const cx = index % width; const cy = Math.floor(index / width);
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!visited[next] && alphaAt(data, width, nx, ny) > 20) { visited[next] = 1; queue.push(next); }
      }
    }
    components.push(size);
  }
  return components.sort((a, b) => b - a);
}

async function validateFrame(file) {
  const { data, info } = await readPng(file);
  if (info.width !== 512 || info.height !== 512) failures.push(`${file}: expected 512x512 PNG`);
  let visible = 0; let minX = 512; let minY = 512; let maxX = -1; let maxY = -1;
  for (let y = 0; y < 512; y += 1) for (let x = 0; x < 512; x += 1) if (alphaAt(data, info.width, x, y) > 0) {
    visible += 1; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (!visible) failures.push(`${file}: empty alpha`);
  let guardPixels = 0;
  for (let y = 0; y < 512; y += 1) for (let x = 0; x < 512; x += 1) {
    if ((x < 16 || x >= 496 || y < 8 || y >= 500) && alphaAt(data, info.width, x, y) > 0) guardPixels += 1;
  }
  if (guardPixels) failures.push(`${file}: ${guardPixels} visible guard-band pixels`);
  const components = connectedComponents(data, info.width, info.height);
  if (components.length > 1 && components[1] > 100) warnings.push(`${file}: secondary component ${components[1]} pixels`);
  return { bbox: [minX, minY, maxX, maxY], guardPixels, components: components.slice(0, 3) };
}

for (const [state, count] of Object.entries(states)) {
  const files = (await fs.readdir(path.join(root, state))).filter((file) => /^frame\d+\.png$/.test(file)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (files.length !== count) failures.push(`${state}: expected ${count} frames, found ${files.length}`);
  report[state] = [];
  for (const file of files) report[state].push({ file, ...(await validateFrame(path.join(root, state, file))) });
  const sheet = path.join(root, `tartaragarra_${state}_sheet.png`);
  const sheetInfo = (await sharp(sheet).metadata());
  const expectedWidth = state === "charge" ? 2048 : 4096;
  if (sheetInfo.width !== expectedWidth || sheetInfo.height !== 512) failures.push(`${sheet}: expected ${expectedWidth}x512`);
  for (let index = 0; index < Math.min(count, files.length); index += 1) {
    const original = (await readPng(path.join(root, state, `frame${index}.png`))).data;
    const cropped = (await sharp(sheet).extract({ left: index * 512, top: 0, width: 512, height: 512 }).ensureAlpha().raw().toBuffer());
    let mismatch = false;
    for (let pixel = 0; pixel < original.length; pixel += 4) {
      const originalAlpha = original[pixel + 3];
      const croppedAlpha = cropped[pixel + 3];
      const colorDelta = originalAlpha > 0 ? Math.max(Math.abs(original[pixel] - cropped[pixel]), Math.abs(original[pixel + 1] - cropped[pixel + 1]), Math.abs(original[pixel + 2] - cropped[pixel + 2])) : 0;
      if (originalAlpha !== croppedAlpha || colorDelta > 1) { mismatch = true; break; }
    }
    if (mismatch) failures.push(`${state}: sheet round-trip mismatch at frame${index}`);
  }
}

const allBboxes = Object.values(report).flat().map((entry) => entry.bbox);
console.log(JSON.stringify({ root, failures, warnings, maxBoundingBox: [Math.min(...allBboxes.map((b) => b[0])), Math.min(...allBboxes.map((b) => b[1])), Math.max(...allBboxes.map((b) => b[2])), Math.max(...allBboxes.map((b) => b[3]))], report }, null, 2));
if (failures.length) process.exitCode = 1;
