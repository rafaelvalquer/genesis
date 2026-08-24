import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const ART_ROOT = path.join(ROOT, "art", "spritesheets", "rastejanteMata");
const PARTS_ROOT = path.join(ART_ROOT, "source-parts");
const RUNTIME_ROOT = path.join(ROOT, "src", "game", "assets", "enemy", "rastejanteMata");
const PREVIEW_ROOT = path.join(ROOT, ".codex-tmp", "rastejanteMata");
const STATES = ["idle", "walking", "attack"];
const FRAME_COUNT = 8;
const SOURCE_CELL = 1024;
const SOURCE_COLUMNS = 4;
const SOURCE_ROWS = 2;
const SOURCE_WIDTH = SOURCE_CELL * SOURCE_COLUMNS;
const SOURCE_HEIGHT = SOURCE_CELL * SOURCE_ROWS;
const CANONICAL_SOURCE_VIEW_WIDTH = 768;
const FRAME_SIZE = 512;
const CENTER_X = 256;
const GROUND_Y = 500;
const MAGENTA = { r: 255, g: 0, b: 255 };

function alphaBounds(data, info, threshold = 12) {
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < threshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("Empty Rastejante source cell");
  return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function removeGeneratedBackdrop(data, info) {
  const visited = new Uint8Array(info.width * info.height);
  const queue = [];
  const isBackdrop = (pixel) => {
    const offset = pixel * 4;
    if (data[offset + 3] < 10) return true;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return Math.min(red, green, blue) >= 216
      && Math.max(red, green, blue) - Math.min(red, green, blue) <= 14;
  };
  const enqueue = (pixel) => {
    if (visited[pixel] || !isBackdrop(pixel)) return;
    visited[pixel] = 1;
    queue.push(pixel);
  };
  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 0; y < info.height; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixel = queue[cursor];
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < info.width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - info.width);
    if (y + 1 < info.height) enqueue(pixel + info.width);
  }
  for (let pixel = 0; pixel < visited.length; pixel += 1) {
    if (!visited[pixel]) continue;
    const offset = pixel * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }
  for (let pass = 0; pass < 3; pass += 1) {
    const alpha = new Uint8Array(info.width * info.height);
    for (let pixel = 0; pixel < alpha.length; pixel += 1) alpha[pixel] = data[pixel * 4 + 3];
    for (let pixel = 0; pixel < alpha.length; pixel += 1) {
      if (!alpha[pixel]) continue;
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      const touchesTransparency = (x > 0 && !alpha[pixel - 1])
        || (x + 1 < info.width && !alpha[pixel + 1])
        || (y > 0 && !alpha[pixel - info.width])
        || (y + 1 < info.height && !alpha[pixel + info.width]);
      if (!touchesTransparency) continue;
      const offset = pixel * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      if (Math.min(red, green, blue) < 178
        || Math.max(red, green, blue) - Math.min(red, green, blue) > 42) continue;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
}

function retainLargestAlphaComponent(data, info, threshold = 8) {
  const visited = new Uint8Array(info.width * info.height);
  let largest = [];
  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || data[start * 4 + 3] < threshold) continue;
    const queue = [start];
    const component = [];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixel = queue[cursor];
      component.push(pixel);
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      const neighbours = [
        x > 0 ? pixel - 1 : -1,
        x + 1 < info.width ? pixel + 1 : -1,
        y > 0 ? pixel - info.width : -1,
        y + 1 < info.height ? pixel + info.width : -1,
        x > 0 && y > 0 ? pixel - info.width - 1 : -1,
        x + 1 < info.width && y > 0 ? pixel - info.width + 1 : -1,
        x > 0 && y + 1 < info.height ? pixel + info.width - 1 : -1,
        x + 1 < info.width && y + 1 < info.height ? pixel + info.width + 1 : -1,
      ];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || visited[neighbour] || data[neighbour * 4 + 3] < threshold) continue;
        visited[neighbour] = 1;
        queue.push(neighbour);
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Uint8Array(info.width * info.height);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < keep.length; pixel += 1) {
    if (keep[pixel]) continue;
    const offset = pixel * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }
}

async function extractPartCell(partPath, index) {
  const image = sharp(partPath);
  const metadata = await image.metadata();
  const column = index % 2;
  const row = Math.floor(index / 2);
  const left = Math.round(column * metadata.width / 2);
  const top = Math.round(row * metadata.height / 2);
  const right = Math.round((column + 1) * metadata.width / 2);
  const bottom = Math.round((row + 1) * metadata.height / 2);
  const { data, info } = await image
    .extract({ left, top, width: right - left, height: bottom - top })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  removeGeneratedBackdrop(data, info);
  retainLargestAlphaComponent(data, info);
  const bounds = alphaBounds(data, info);
  const buffer = await sharp(data, { raw: info })
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { buffer, viewWidth: (right - left) };
}

async function buildChromaSheet(state) {
  const frames = [];
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const half = index < 4 ? "0-3" : "4-7";
    const source = path.join(PARTS_ROOT, `${state}-${half}.png`);
    const frame = await extractPartCell(source, index % 4);
    const metadata = await sharp(frame.buffer).metadata();
    // ImageGen may return different overall canvas sizes between calls. Map the
    // authored camera view to one common source view before the single global
    // runtime scale is calculated. Every original silhouette is still larger
    // than its final runtime silhouette, so the final operation is a downscale.
    const cameraScale = CANONICAL_SOURCE_VIEW_WIDTH / frame.viewWidth;
    const scale = Math.min(cameraScale, 920 / metadata.width, 920 / metadata.height);
    frames.push(Math.abs(scale - 1) > 0.001
      ? await sharp(frame.buffer).resize({
        width: Math.round(metadata.width * scale),
        height: Math.round(metadata.height * scale),
        kernel: sharp.kernel.lanczos3,
      }).png({ compressionLevel: 9 }).toBuffer()
      : frame.buffer);
  }

  const sheetPath = path.join(ART_ROOT, `rastejanteMata-${state}-chroma.png`);
  await sharp({
    create: {
      width: SOURCE_WIDTH,
      height: SOURCE_HEIGHT,
      channels: 3,
      background: MAGENTA,
    },
  }).composite(await Promise.all(frames.map(async (input, index) => {
    const metadata = await sharp(input).metadata();
    return {
      input,
      left: (index % SOURCE_COLUMNS) * SOURCE_CELL + Math.round((SOURCE_CELL - metadata.width) / 2),
      top: Math.floor(index / SOURCE_COLUMNS) * SOURCE_CELL + 970 - metadata.height,
    };
  }))).png({ compressionLevel: 9 }).toFile(sheetPath);
  return sheetPath;
}

function removeMagenta(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const sourceAlpha = data[offset + 3];
    if (sourceAlpha === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      continue;
    }
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = Math.min(red, blue) - green;
    let alpha = sourceAlpha;
    if (dominance >= 178) alpha = 0;
    else if (dominance > 34) alpha = Math.min(
      sourceAlpha,
      Math.round((178 - dominance) / 144 * 255),
    );
    if (alpha <= 2) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
      continue;
    }
    if (alpha < 255) {
      const ratio = alpha / 255;
      data[offset] = Math.max(0, Math.min(255, Math.round((red - (1 - ratio) * 255) / ratio)));
      data[offset + 1] = Math.max(0, Math.min(255, Math.round(green / ratio)));
      data[offset + 2] = Math.max(0, Math.min(255, Math.round((blue - (1 - ratio) * 255) / ratio)));
    }
    data[offset + 3] = alpha;
  }
}

async function readChromaFrames(sheetPath) {
  const frames = [];
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const { data, info } = await sharp(sheetPath)
      .extract({
        left: (index % SOURCE_COLUMNS) * SOURCE_CELL,
        top: Math.floor(index / SOURCE_COLUMNS) * SOURCE_CELL,
        width: SOURCE_CELL,
        height: SOURCE_CELL,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    removeMagenta(data);
    retainLargestAlphaComponent(data, info);
    const bounds = alphaBounds(data, info);
    const buffer = await sharp(data, { raw: info })
      .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
      .png({ compressionLevel: 9 })
      .toBuffer();
    frames.push({ buffer, width: bounds.width, height: bounds.height });
  }
  return frames;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

async function normalizeFrame(frame, globalScale) {
  const width = Math.max(1, Math.round(frame.width * globalScale));
  const height = Math.max(1, Math.round(frame.height * globalScale));
  const { data, info } = await sharp(frame.buffer)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  removeMagenta(data);
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] > 6) continue;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 0;
  }
  return sharp({
    create: {
      width: FRAME_SIZE,
      height: FRAME_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{
    input: data,
    raw: info,
    left: Math.round(CENTER_X - width / 2),
    top: GROUND_Y - height,
  }]).png({ compressionLevel: 9 }).toBuffer();
}

async function validateFrame(framePath) {
  const metadata = await sharp(framePath).metadata();
  if (metadata.width !== FRAME_SIZE || metadata.height !== FRAME_SIZE || !metadata.hasAlpha) {
    throw new Error(`Invalid runtime frame metadata: ${framePath}`);
  }
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let magentaFringe = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3];
    if (alpha === 0) {
      transparent += 1;
      if (data[offset] !== 0 || data[offset + 1] !== 0 || data[offset + 2] !== 0) {
        throw new Error(`Dirty transparent RGB: ${framePath}`);
      }
    }
    if (alpha > 0 && alpha < 255 && Math.min(data[offset], data[offset + 2]) - data[offset + 1] > 34) {
      magentaFringe += 1;
    }
  }
  if (!transparent) throw new Error(`Missing transparent pixels: ${framePath}`);
  if (magentaFringe) throw new Error(`Magenta fringe (${magentaFringe} pixels): ${framePath}`);
  const bounds = alphaBounds(data, info);
  if (Math.abs(bounds.bottom - GROUND_Y) > 1) throw new Error(`Foot drift: ${framePath}`);
  return bounds;
}

async function buildPreview(allFrames, background, filename) {
  const cell = 128;
  const composites = [];
  for (let row = 0; row < STATES.length; row += 1) {
    for (let column = 0; column < FRAME_COUNT; column += 1) {
      composites.push({
        input: await sharp(allFrames.get(STATES[row])[column]).resize(cell, cell, { kernel: sharp.kernel.lanczos3 }).png().toBuffer(),
        left: column * cell,
        top: row * cell,
      });
    }
  }
  await sharp({ create: { width: cell * FRAME_COUNT, height: cell * STATES.length, channels: 4, background } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(PREVIEW_ROOT, filename));
}

await fs.mkdir(ART_ROOT, { recursive: true });
await fs.mkdir(PREVIEW_ROOT, { recursive: true });
const sourceSheets = new Map();
const extracted = new Map();
for (const state of STATES) {
  const sheet = await buildChromaSheet(state);
  sourceSheets.set(state, sheet);
  extracted.set(state, await readChromaFrames(sheet));
}

const everyFrame = STATES.flatMap((state) => extracted.get(state));
const maxWidth = Math.max(...everyFrame.map((frame) => frame.width));
const maxHeight = Math.max(...everyFrame.map((frame) => frame.height));
const idleMedianWidth = median(extracted.get("idle").map((frame) => frame.width));
const globalScale = Math.min(1, 354 / idleMedianWidth, 398 / maxWidth, 312 / maxHeight);
const normalized = new Map();
const boundsByState = new Map();

for (const state of STATES) {
  const stateRoot = path.join(RUNTIME_ROOT, state);
  await fs.mkdir(stateRoot, { recursive: true });
  const frames = [];
  const bounds = [];
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const buffer = await normalizeFrame(extracted.get(state)[index], globalScale);
    const framePath = path.join(stateRoot, `frame${index}.png`);
    await fs.writeFile(framePath, buffer);
    frames.push(buffer);
    bounds.push(await validateFrame(framePath));
  }
  normalized.set(state, frames);
  boundsByState.set(state, bounds);
}

await Promise.all([
  buildPreview(normalized, { r: 0, g: 0, b: 0, alpha: 255 }, "preview-black.png"),
  buildPreview(normalized, { r: 255, g: 255, b: 255, alpha: 255 }, "preview-white.png"),
  buildPreview(normalized, { r: 38, g: 82, b: 45, alpha: 255 }, "preview-green.png"),
  buildPreview(normalized, { r: 130, g: 20, b: 24, alpha: 255 }, "preview-red.png"),
]);

const summary = Object.fromEntries(STATES.map((state) => [state, boundsByState.get(state).map((bounds) => ({
  width: bounds.width,
  height: bounds.height,
  bottom: bounds.bottom,
}))]));
await fs.writeFile(path.join(PREVIEW_ROOT, "metrics.json"), `${JSON.stringify({
  sourceSheets: Object.fromEntries(sourceSheets),
  sourceCell: SOURCE_CELL,
  globalScale,
  maxSourceWidth: maxWidth,
  maxSourceHeight: maxHeight,
  frames: summary,
}, null, 2)}\n`);

console.log(`Rastejante da Mata: 24 RGBA frames at ${FRAME_SIZE}x${FRAME_SIZE}`);
console.log(`Source sheets: ${SOURCE_WIDTH}x${SOURCE_HEIGHT}, ${SOURCE_CELL}px cells`);
console.log(`Shared global scale: ${globalScale.toFixed(4)}`);
console.log(`Previews: ${PREVIEW_ROOT}`);
