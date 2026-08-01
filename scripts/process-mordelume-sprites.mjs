import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const generated = "C:/Users/Z565244/.codex/generated_images/019fbe2e-01a5-7042-9287-35973fb165fe";
const sources = {
  land: path.join(generated, "exec-1d250097-a506-4d48-a00a-4159fb995d58.png"),
  idle: path.join(generated, "exec-a25ec970-bc0b-4957-a43f-05b213941862.png"),
  moveWater: path.join(generated, "exec-b119fad3-89bb-47c9-b92b-c07270aad640.png"),
  sprintWater: path.join(generated, "exec-d143736f-2227-47e6-b165-be89f92d760a.png"),
  attackBite: path.join(generated, "exec-9282cc5a-fd2c-465b-8b14-4660ed2e6bb2.png"),
  death: path.join(generated, "exec-954fd70f-fa27-49ba-b8d7-01c98bdc6011.png"),
  spawnEmerge: path.join(generated, "exec-90123ccb-d0f9-4d4f-a81e-d7fa1472f9f7.png"),
};
const output = path.join(root, "src/game/assets/enemy/mordelume");

function removeMagenta({ data, info }) {
  for (let index = 0; index < data.length; index += 4) {
    const [r, g, b] = data.subarray(index, index + 3);
    const saturatedKey = r > 190 && b > 120 && g < 120 && r - g > 100;
    const magentaFringe = r > 60 && b > 70 && r > g * 1.25 && b > g * 1.25
      && Math.abs(r - b) < 160;
    if (saturatedKey || magentaFringe) {
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 0;
    }
  }
  return { data, info };
}

function retainLargestSpriteComponent({ data, info }) {
  const total = info.width * info.height;
  const seen = new Uint8Array(total);
  let largest = [];
  for (let start = 0; start < total; start += 1) {
    if (seen[start] || data[start * 4 + 3] <= 24) continue;
    const component = [];
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      component.push(current);
      const x = current % info.width;
      const y = Math.floor(current / info.width);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
        const next = ny * info.width + nx;
        if (seen[next] || data[next * 4 + 3] <= 24) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Uint8Array(total);
  largest.forEach((pixel) => { keep[pixel] = 1; });
  for (let pixel = 0; pixel < total; pixel += 1) if (!keep[pixel]) data[pixel * 4 + 3] = 0;
  return { data, info };
}

async function extractFrames(source, { layout = "strip", maxWidth = 214, maxHeight = 196, baseline = 244 } = {}) {
  const { data, info } = removeMagenta(await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  let regions;
  if (layout === "grid") {
    regions = Array.from({ length: 8 }, (_, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const left = Math.floor(col * info.width / 4);
      const right = Math.floor((col + 1) * info.width / 4);
      const top = Math.floor(row * info.height / 2);
      const bottom = Math.floor((row + 1) * info.height / 2);
      return { left, top, width: right - left, height: bottom - top };
    });
  } else {
  const columnWeight = Array.from({ length: info.width }, (_, x) => {
    let opaquePixels = 0;
    for (let y = 0; y < info.height; y += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 120) opaquePixels += 1;
    }
    return opaquePixels;
  });
  const boundaries = [0];
  for (let index = 1; index < 8; index += 1) {
    const expected = Math.round(index * info.width / 8);
    let boundary = expected;
    for (let x = Math.max(1, expected - 48); x <= Math.min(info.width - 2, expected + 48); x += 1) {
      if (columnWeight[x] < columnWeight[boundary]) boundary = x;
    }
    boundaries.push(boundary);
  }
  boundaries.push(info.width);
  regions = boundaries.slice(0, -1).map((left, index) => ({ left, top: 0, width: boundaries[index + 1] - left, height: info.height }));
  }
  const frames = [];
  for (const region of regions) {
    const raw = await sharp(source).extract(region)
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const keyed = retainLargestSpriteComponent(removeMagenta(raw));
    const alpha = keyed.data.filter((_, pixel) => pixel % 4 === 3);
    let minX = keyed.info.width, minY = keyed.info.height, maxX = -1, maxY = -1;
    for (let y = 0; y < keyed.info.height; y += 1) for (let x = 0; x < keyed.info.width; x += 1) {
      if (alpha[y * keyed.info.width + x] > 24) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    const trimmed = await sharp(keyed.data, { raw: keyed.info })
      .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }).png().toBuffer();
    const fitted = await sharp(trimmed).resize(maxWidth, maxHeight, { fit: "inside", kernel: "lanczos3" }).png().toBuffer();
    const meta = await sharp(fitted).metadata();
    frames.push(await sharp({ create: { width: 256, height: 256, channels: 4, background: "#00000000" } })
      .composite([{ input: fitted, left: Math.round((256 - meta.width) / 2), top: baseline - meta.height }]).png().toBuffer());
  }
  return frames;
}

const [land, idle, moveWater, sprintWater, attackBite, death, spawnEmerge] = await Promise.all([
  extractFrames(sources.land, { layout: "grid" }),
  extractFrames(sources.idle),
  extractFrames(sources.moveWater, { maxWidth: 232, maxHeight: 166, baseline: 231 }),
  extractFrames(sources.sprintWater, { maxWidth: 238, maxHeight: 158, baseline: 231 }),
  extractFrames(sources.attackBite),
  extractFrames(sources.death),
  extractFrames(sources.spawnEmerge),
]);
const states = {
  idle,
  moveLand: land,
  moveWater,
  sprintWater,
  attackBite,
  death,
  spawnEmerge,
};

await fs.rm(path.join(output, "hit"), { recursive: true, force: true });
for (const [state, pendingFrames] of Object.entries(states)) {
  const directory = path.join(output, state);
  await fs.mkdir(directory, { recursive: true });
  const frames = await Promise.all(pendingFrames);
  await Promise.all(frames.map((frame, index) => fs.writeFile(path.join(directory, `frame${index}.png`), frame)));
}
