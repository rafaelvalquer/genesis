import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const ART_ROOT = path.join(ROOT, "art", "spritesheets", "saltadorAlado");
const PARTS_ROOT = path.join(ART_ROOT, "source-parts");
const RUNTIME_ROOT = path.join(ROOT, "src", "game", "assets", "enemy", "saltadorAlado");
const PREVIEW_ROOT = path.join(ROOT, ".codex-tmp", "saltadorAlado");
const STATE_CONFIG = Object.freeze({
  idle: { count: 8, columns: 4, rows: 2, airborne: false },
  walking: { count: 8, columns: 4, rows: 2, airborne: false },
  attack: { count: 8, columns: 4, rows: 2, airborne: false },
  jumpPrep: { count: 4, columns: 4, rows: 1, airborne: false },
  jumpAir: { count: 6, columns: 3, rows: 2, airborne: true },
  jumpLand: { count: 4, columns: 4, rows: 1, airborne: false },
  rasante: { count: 8, columns: 4, rows: 2, airborne: false },
});
const STATES = Object.keys(STATE_CONFIG);
const SOURCE_CELL = 1024;
const CANONICAL_SOURCE_VIEW = 627;
const FRAME_SIZE = 512;
const CENTER_X = 256;
const GROUND_Y = 500;
const AIR_BODY_CENTER_Y = 292;
const TARGET_IDLE_WIDTH = 326;
const MAX_RUNTIME_EXTENT = 470;
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
  if (right < left || bottom < top) throw new Error("Empty Saltador Alado source cell");
  return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function removeMagenta(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const sourceAlpha = data[offset + 3];
    if (!sourceAlpha) {
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
    if (dominance >= 176) alpha = 0;
    else if (dominance > 30) alpha = Math.min(sourceAlpha, Math.round((176 - dominance) / 146 * 255));
    if (alpha <= 3) {
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

function retainLargestComponent(data, info, threshold = 8) {
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

function bodyReference(data, info) {
  const xs = [];
  const ys = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] < 96) continue;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      // Green body/head/limbs only. Orange membranes are deliberately excluded,
      // so opening them never changes the character scale or airborne anchor.
      if (green < red * 1.03 || green < blue * 1.08 || green < 55) continue;
      xs.push(x);
      ys.push(y);
    }
  }
  if (xs.length < 100) {
    const bounds = alphaBounds(data, info, 96);
    return { centerX: (bounds.left + bounds.right) / 2, centerY: (bounds.top + bounds.bottom) / 2 };
  }
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  return {
    centerX: xs[Math.floor(xs.length / 2)],
    centerY: ys[Math.floor(ys.length / 2)],
  };
}

async function extractPartCell(partPath, cellIndex) {
  const image = sharp(partPath);
  const metadata = await image.metadata();
  const column = cellIndex % 2;
  const row = Math.floor(cellIndex / 2);
  const left = Math.round(column * metadata.width / 2);
  const top = Math.round(row * metadata.height / 2);
  const right = Math.round((column + 1) * metadata.width / 2);
  const bottom = Math.round((row + 1) * metadata.height / 2);
  const { data, info } = await image
    .extract({ left, top, width: right - left, height: bottom - top })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  removeMagenta(data);
  retainLargestComponent(data, info);
  const bounds = alphaBounds(data, info);
  return {
    buffer: await sharp(data, { raw: info })
      .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    viewWidth: right - left,
  };
}

function sourceFor(state, index) {
  if (["idle", "walking", "attack", "rasante"].includes(state)) {
    return { file: `${state}-${index < 4 ? "0-3" : "4-7"}.png`, cell: index % 4 };
  }
  if (state === "jumpAir") {
    return index < 4
      ? { file: "jumpAir-0-3.png", cell: index }
      : { file: "jumpAir-4-5.png", cell: index - 4 };
  }
  return { file: `${state}-0-3.png`, cell: index };
}

async function buildChromaSheet(state) {
  const config = STATE_CONFIG[state];
  const frames = [];
  for (let index = 0; index < config.count; index += 1) {
    const source = sourceFor(state, index);
    const frame = await extractPartCell(path.join(PARTS_ROOT, source.file), source.cell);
    const metadata = await sharp(frame.buffer).metadata();
    const cameraScale = CANONICAL_SOURCE_VIEW / frame.viewWidth;
    const safeScale = Math.min(cameraScale, 940 / metadata.width, 940 / metadata.height);
    frames.push(Math.abs(safeScale - 1) > 0.001
      ? await sharp(frame.buffer).resize({
        width: Math.round(metadata.width * safeScale),
        height: Math.round(metadata.height * safeScale),
        kernel: sharp.kernel.lanczos3,
      }).png({ compressionLevel: 9 }).toBuffer()
      : frame.buffer);
  }
  const sheetPath = path.join(ART_ROOT, `saltadorAlado-${state}-chroma.png`);
  await sharp({
    create: {
      width: config.columns * SOURCE_CELL,
      height: config.rows * SOURCE_CELL,
      channels: 3,
      background: MAGENTA,
    },
  }).composite(await Promise.all(frames.map(async (input, index) => {
    const metadata = await sharp(input).metadata();
    return {
      input,
      left: (index % config.columns) * SOURCE_CELL + Math.round((SOURCE_CELL - metadata.width) / 2),
      top: Math.floor(index / config.columns) * SOURCE_CELL + Math.round((SOURCE_CELL - metadata.height) / 2),
    };
  }))).png({ compressionLevel: 9 }).toFile(sheetPath);
  return sheetPath;
}

async function readChromaFrames(state, sheetPath) {
  const config = STATE_CONFIG[state];
  const frames = [];
  for (let index = 0; index < config.count; index += 1) {
    const { data, info } = await sharp(sheetPath)
      .extract({
        left: (index % config.columns) * SOURCE_CELL,
        top: Math.floor(index / config.columns) * SOURCE_CELL,
        width: SOURCE_CELL,
        height: SOURCE_CELL,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    removeMagenta(data);
    retainLargestComponent(data, info);
    const bounds = alphaBounds(data, info);
    const croppedData = await sharp(data, { raw: info })
      .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
      .raw()
      .toBuffer({ resolveWithObject: true });
    frames.push({
      buffer: await sharp(croppedData.data, { raw: croppedData.info }).png({ compressionLevel: 9 }).toBuffer(),
      width: bounds.width,
      height: bounds.height,
      body: bodyReference(croppedData.data, croppedData.info),
    });
  }
  return frames;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function normalizeFrame(frame, state, globalScale) {
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
  let left;
  let top;
  if (STATE_CONFIG[state].airborne) {
    left = Math.round(CENTER_X - frame.body.centerX * globalScale);
    top = Math.round(AIR_BODY_CENTER_Y - frame.body.centerY * globalScale);
  } else {
    left = Math.round(CENTER_X - width / 2);
    top = GROUND_Y - height;
  }
  if (left < 6 || top < 6 || left + width > FRAME_SIZE - 6 || top + height > FRAME_SIZE - 6) {
    throw new Error(`Sprite would be clipped in ${state}: ${width}x${height} at ${left},${top}`);
  }
  return sharp({
    create: { width: FRAME_SIZE, height: FRAME_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: data, raw: info, left, top }]).png({ compressionLevel: 9 }).toBuffer();
}

async function validateFrame(framePath, state) {
  const metadata = await sharp(framePath).metadata();
  if (metadata.width !== FRAME_SIZE || metadata.height !== FRAME_SIZE || !metadata.hasAlpha) {
    throw new Error(`Invalid runtime frame metadata: ${framePath}`);
  }
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let fringe = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3];
    if (!alpha) {
      transparent += 1;
      if (data[offset] || data[offset + 1] || data[offset + 2]) throw new Error(`Dirty transparent RGB: ${framePath}`);
    }
    if (alpha > 0 && alpha < 255 && Math.min(data[offset], data[offset + 2]) - data[offset + 1] > 30) fringe += 1;
  }
  if (!transparent) throw new Error(`Missing transparent pixels: ${framePath}`);
  if (fringe) throw new Error(`Magenta fringe (${fringe} pixels): ${framePath}`);
  const bounds = alphaBounds(data, info);
  if (!STATE_CONFIG[state].airborne && Math.abs(bounds.bottom - (GROUND_Y - 1)) > 2) {
    throw new Error(`Foot root drift: ${framePath}`);
  }
  return bounds;
}

async function buildPreview(normalized, background, filename, scale = 128) {
  const columns = 8;
  const composites = [];
  for (let row = 0; row < STATES.length; row += 1) {
    const frames = normalized.get(STATES[row]);
    for (let column = 0; column < frames.length; column += 1) {
      composites.push({
        input: await sharp(frames[column]).resize(scale, scale, { kernel: sharp.kernel.lanczos3 }).png().toBuffer(),
        left: column * scale,
        top: row * scale,
      });
    }
  }
  await sharp({ create: { width: columns * scale, height: STATES.length * scale, channels: 4, background } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(PREVIEW_ROOT, filename));
}

async function buildGameScaleComparison(normalized) {
  const entries = [
    { input: normalized.get("idle")[0], size: Math.round(128 * 0.95), left: 24 },
    { input: path.join(ROOT, "src", "game", "assets", "enemy", "rastejanteMata", "idle", "frame0.png"), size: 128, left: 184 },
    { input: path.join(ROOT, "src", "game", "assets", "enemy", "duneRipper", "idle", "frame0.png"), size: 128, left: 344 },
  ];
  await sharp({
    create: { width: 496, height: 176, channels: 4, background: { r: 18, g: 28, b: 25, alpha: 255 } },
  }).composite(await Promise.all(entries.map(async (entry) => ({
    input: await sharp(entry.input).resize(entry.size, entry.size, { kernel: sharp.kernel.lanczos3 }).png().toBuffer(),
    left: entry.left,
    top: 154 - entry.size,
  })))).png({ compressionLevel: 9 }).toFile(path.join(PREVIEW_ROOT, "comparison-game-scale.png"));
}

await fs.mkdir(ART_ROOT, { recursive: true });
await fs.mkdir(PREVIEW_ROOT, { recursive: true });
const sourceSheets = new Map();
const extracted = new Map();
for (const state of STATES) {
  const sheet = await buildChromaSheet(state);
  sourceSheets.set(state, sheet);
  extracted.set(state, await readChromaFrames(state, sheet));
}

const everyFrame = STATES.flatMap((state) => extracted.get(state));
const idleMedianWidth = median(extracted.get("idle").map((frame) => frame.width));
const globalScale = Math.min(
  1,
  TARGET_IDLE_WIDTH / idleMedianWidth,
  MAX_RUNTIME_EXTENT / Math.max(...everyFrame.map((frame) => frame.width)),
  MAX_RUNTIME_EXTENT / Math.max(...everyFrame.map((frame) => frame.height)),
);
const normalized = new Map();
const boundsByState = new Map();

for (const state of STATES) {
  const stateRoot = path.join(RUNTIME_ROOT, state);
  await fs.mkdir(stateRoot, { recursive: true });
  const buffers = [];
  const bounds = [];
  for (let index = 0; index < STATE_CONFIG[state].count; index += 1) {
    const buffer = await normalizeFrame(extracted.get(state)[index], state, globalScale);
    const framePath = path.join(stateRoot, `frame${index}.png`);
    await fs.writeFile(framePath, buffer);
    buffers.push(buffer);
    bounds.push(await validateFrame(framePath, state));
  }
  normalized.set(state, buffers);
  boundsByState.set(state, bounds);
}

await Promise.all([
  buildPreview(normalized, { r: 0, g: 0, b: 0, alpha: 255 }, "preview-black.png"),
  buildPreview(normalized, { r: 255, g: 255, b: 255, alpha: 255 }, "preview-white.png"),
  buildPreview(normalized, { r: 38, g: 82, b: 45, alpha: 255 }, "preview-green.png"),
  buildPreview(normalized, { r: 130, g: 20, b: 24, alpha: 255 }, "preview-red.png"),
  buildPreview(normalized, { r: 18, g: 24, b: 30, alpha: 255 }, "preview-256.png", 256),
  buildGameScaleComparison(normalized),
]);

const summary = Object.fromEntries(STATES.map((state) => [state, boundsByState.get(state).map((bounds) => ({
  width: bounds.width,
  height: bounds.height,
  left: bounds.left,
  top: bounds.top,
  bottom: bounds.bottom,
}))]));
await fs.writeFile(path.join(PREVIEW_ROOT, "metrics.json"), `${JSON.stringify({
  sourceSheets: Object.fromEntries(sourceSheets),
  sourceCell: SOURCE_CELL,
  globalScale,
  idleMedianSourceWidth: idleMedianWidth,
  maxSourceWidth: Math.max(...everyFrame.map((frame) => frame.width)),
  maxSourceHeight: Math.max(...everyFrame.map((frame) => frame.height)),
  frames: summary,
}, null, 2)}\n`);

console.log(`Saltador Alado: 46 RGBA frames at ${FRAME_SIZE}x${FRAME_SIZE}`);
console.log(`Shared body scale across all seven states: ${globalScale.toFixed(4)}`);
console.log(`Chroma sheets and previews: ${ART_ROOT} | ${PREVIEW_ROOT}`);
