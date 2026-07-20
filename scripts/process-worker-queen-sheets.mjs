import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const FRAME_COUNT = 8;
const COLUMNS = 4;
const ROWS = 2;
const FRAME_SIZE = 256;
const ROOT_Y = 248;
const CELL_INSET = 5;

const DEFINITIONS = [
  {
    id: "workerQueen",
    sourceRoot: path.join(ROOT, "art", "spritesheets", "workerQueen"),
    deployRoot: path.join(ROOT, "src", "game", "assets", "enemy", "workerQueen"),
    states: ["spawn", "walking", "idle", "webAttack", "eggLay", "meleeAttack", "hit", "stunned", "death"],
    sourcePrefix: "worker-queen",
    maxWidth: 250,
    maxHeight: 238,
    stateScales: { webAttack: 1.07, eggLay: 1.07 },
  },
  {
    id: "workerQueenEgg",
    sourceRoot: path.join(ROOT, "art", "spritesheets", "workerQueenEgg"),
    deployRoot: path.join(ROOT, "src", "game", "assets", "enemy", "workerQueenEgg"),
    states: ["idle", "hatch", "destroy"],
    sourcePrefix: "worker-queen-egg",
    maxWidth: 190,
    maxHeight: 218,
  },
];

function removeGreenChroma(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = green - Math.max(red, blue);
    if (green < 105 || dominance < 24) continue;
    const alpha = Math.round(255 * Math.max(0, Math.min(1, (dominance - 24) / 92)));
    data[offset + 3] = Math.min(data[offset + 3], 255 - alpha);
    if (data[offset + 3] < 245) {
      data[offset + 1] = Math.min(green, Math.round((red + blue) / 2));
    }
    if (data[offset + 3] <= 5) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
}

async function extractFrames(definition, state) {
  const source = path.join(definition.sourceRoot, `${definition.sourcePrefix}-${state}-chroma.png`);
  const sheet = sharp(source);
  const metadata = await sheet.metadata();
  const frames = [];
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const left = Math.round(column * metadata.width / COLUMNS) + CELL_INSET;
    const right = Math.round((column + 1) * metadata.width / COLUMNS) - CELL_INSET;
    const top = Math.round(row * metadata.height / ROWS) + CELL_INSET;
    const bottom = Math.round((row + 1) * metadata.height / ROWS) - CELL_INSET;
    const { data, info } = await sheet.clone()
      .extract({ left, top, width: right - left, height: bottom - top })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    removeGreenChroma(data);
    const trimmed = await sharp(data, { raw: info })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 })
      .png()
      .toBuffer();
    const { data: trimmedData, info: trimmedInfo } = await sharp(trimmed)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const bodyBounds = findLargestAlphaComponent(trimmedData, trimmedInfo);
    frames.push({ buffer: trimmed, width: trimmedInfo.width, height: trimmedInfo.height, bodyBounds });
  }
  return frames;
}

function findLargestAlphaComponent(data, info) {
  const seen = new Uint8Array(info.width * info.height);
  let largest = null;
  for (let pixel = 0; pixel < seen.length; pixel += 1) {
    if (seen[pixel] || data[pixel * 4 + 3] < 32) continue;
    const stack = [pixel];
    seen[pixel] = 1;
    let area = 0;
    let left = info.width;
    let top = info.height;
    let right = -1;
    let bottom = -1;
    while (stack.length) {
      const current = stack.pop();
      const x = current % info.width;
      const y = Math.floor(current / info.width);
      area += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nextX < 0 || nextY < 0 || nextX >= info.width || nextY >= info.height) continue;
        const next = nextY * info.width + nextX;
        if (seen[next] || data[next * 4 + 3] < 32) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (!largest || area > largest.area) {
      largest = { area, left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
    }
  }
  return largest || { left: 0, top: 0, right: info.width - 1, bottom: info.height - 1, width: info.width, height: info.height };
}

async function normalizeFrame(frame, scale, stateScale = 1) {
  const appliedScale = scale * stateScale;
  const width = Math.max(1, Math.round(frame.width * appliedScale));
  const height = Math.max(1, Math.round(frame.height * appliedScale));
  const resized = await sharp(frame.buffer)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const anchor = stateScale === 1
    ? { centerX: frame.width / 2, bottom: frame.height }
    : { centerX: frame.bodyBounds.left + frame.bodyBounds.width / 2, bottom: frame.bodyBounds.bottom + 1 };
  const left = Math.round(FRAME_SIZE / 2 - anchor.centerX * appliedScale);
  const top = Math.round(ROOT_Y - anchor.bottom * appliedScale);
  const sourceLeft = Math.max(0, -left);
  const sourceTop = Math.max(0, -top);
  const targetLeft = Math.max(0, left);
  const targetTop = Math.max(0, top);
  const visibleWidth = Math.min(width - sourceLeft, FRAME_SIZE - targetLeft);
  const targetBottom = stateScale === 1 ? FRAME_SIZE : ROOT_Y;
  const visibleHeight = Math.min(height - sourceTop, targetBottom - targetTop);
  const visible = await sharp(resized)
    .extract({ left: sourceLeft, top: sourceTop, width: visibleWidth, height: visibleHeight })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: FRAME_SIZE,
      height: FRAME_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: visible,
      left: targetLeft,
      top: targetTop,
    }])
    .png({ palette: true, colours: 192, quality: 95, compressionLevel: 9 })
    .toBuffer();
}

async function writeDefinition(definition, allFrames, scale) {
  let totalBytes = 0;
  for (const state of definition.states) {
    const artStateRoot = path.join(definition.sourceRoot, "frames", state);
    const deployStateRoot = path.join(definition.deployRoot, state);
    await fs.rm(artStateRoot, { recursive: true, force: true });
    await fs.rm(deployStateRoot, { recursive: true, force: true });
    await fs.mkdir(artStateRoot, { recursive: true });
    await fs.mkdir(deployStateRoot, { recursive: true });
    const normalized = [];
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const frame = await normalizeFrame(allFrames.get(state)[index], scale, definition.stateScales?.[state] || 1);
      normalized.push(frame);
      totalBytes += frame.length;
      await fs.writeFile(path.join(artStateRoot, `frame${index}.png`), frame);
      await fs.writeFile(path.join(deployStateRoot, `frame${index}.png`), frame);
    }
    await sharp({
      create: {
        width: FRAME_SIZE * COLUMNS,
        height: FRAME_SIZE * ROWS,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(normalized.map((input, index) => ({
        input,
        left: (index % COLUMNS) * FRAME_SIZE,
        top: Math.floor(index / COLUMNS) * FRAME_SIZE,
      })))
      .png({ palette: true, colours: 192, quality: 95, compressionLevel: 9 })
      .toFile(path.join(definition.sourceRoot, `${definition.sourcePrefix}-${state}.png`));
  }
  return totalBytes;
}

async function validate(definition) {
  for (const state of definition.states) {
    const bottoms = [];
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const file = path.join(definition.deployRoot, state, `frame${index}.png`);
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width !== FRAME_SIZE || info.height !== FRAME_SIZE || info.channels !== 4) {
        throw new Error(`Invalid frame geometry: ${file}`);
      }
      const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
      if (corners.some((pixel) => data[pixel * 4 + 3] > 1)) throw new Error(`Opaque corner: ${file}`);
      let bottom = -1;
      for (let y = info.height - 1; y >= 0 && bottom < 0; y -= 1) {
        for (let x = 0; x < info.width; x += 1) {
          if (data[(y * info.width + x) * 4 + 3] >= 96) {
            bottom = y;
            break;
          }
        }
      }
      bottoms.push(bottom);
    }
    if (Math.max(...bottoms) - Math.min(...bottoms) > 1) {
      throw new Error(`Unstable baseline in ${definition.id}/${state}: ${bottoms.join(", ")}`);
    }
  }
}

for (const definition of DEFINITIONS) {
  const allFrames = new Map();
  let widest = 0;
  let tallest = 0;
  for (const state of definition.states) {
    const frames = await extractFrames(definition, state);
    allFrames.set(state, frames);
    for (const frame of frames) {
      widest = Math.max(widest, frame.width);
      tallest = Math.max(tallest, frame.height);
    }
  }
  const scale = Math.min(definition.maxWidth / widest, definition.maxHeight / tallest);
  const totalBytes = await writeDefinition(definition, allFrames, scale);
  await validate(definition);
  console.log(`${definition.id}: ${definition.states.length * FRAME_COUNT} frames, ${totalBytes} bytes, scale ${scale.toFixed(4)}`);
}
