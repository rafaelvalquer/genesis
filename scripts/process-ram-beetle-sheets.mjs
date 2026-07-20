import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "art", "spritesheets", "ramBeetle");
const DEPLOY_ROOT = path.join(ROOT, "src", "game", "assets", "enemy", "ramBeetle");
const STATES = ["walking", "chargePrep", "charge", "idle", "attack"];
const FRAME_COUNT = 8;
const COLUMNS = 4;
const ROWS = 2;
const FRAME_SIZE = 256;
const MAX_WIDTH = 244;
const MAX_HEIGHT = 238;
const CENTER_X = 128;
const ROOT_Y = 248;
const CELL_INSET = 6;

function removeGreenChroma(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = green - Math.max(red, blue);
    if (green < 130 || dominance < 38) continue;
    const matte = Math.max(0, Math.min(1, (150 - dominance) / 112));
    data[offset + 3] = Math.min(data[offset + 3], Math.round(255 * matte));
    if (data[offset + 3] < 250) {
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

function removeSmallComponents(data, info) {
  const visited = new Uint8Array(info.width * info.height);
  const components = [];
  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || data[start * 4 + 3] <= 3) continue;
    const queue = [start];
    const pixels = [];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixel = queue[cursor];
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      pixels.push(pixel);
      for (const next of [
        x > 0 ? pixel - 1 : -1,
        x + 1 < info.width ? pixel + 1 : -1,
        y > 0 ? pixel - info.width : -1,
        y + 1 < info.height ? pixel + info.width : -1,
      ]) {
        if (next < 0 || visited[next] || data[next * 4 + 3] <= 3) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
    components.push(pixels);
  }
  const largest = Math.max(0, ...components.map((component) => component.length));
  for (const component of components) {
    if (component.length >= largest * 0.05) continue;
    for (const pixel of component) {
      const offset = pixel * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
}

async function extractFrames(state) {
  const source = path.join(SOURCE_ROOT, `ram-beetle-${state}-chroma.png`);
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
    removeSmallComponents(data, info);
    const trimmed = await sharp(data, { raw: info })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
      .png()
      .toBuffer();
    const frameMetadata = await sharp(trimmed).metadata();
    frames.push({ buffer: trimmed, width: frameMetadata.width, height: frameMetadata.height });
  }
  return frames;
}

async function normalizeFrame(frame, scale) {
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  const resized = await sharp(frame.buffer)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
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
      input: resized,
      left: Math.round(CENTER_X - width / 2),
      top: ROOT_Y - height,
    }])
    .png({ palette: true, colours: 128, quality: 94, compressionLevel: 9 })
    .toBuffer();
}

async function writeFrames(allFrames, scale) {
  let totalBytes = 0;
  for (const state of STATES) {
    const artStateRoot = path.join(SOURCE_ROOT, "frames", state);
    const deployStateRoot = path.join(DEPLOY_ROOT, state);
    await fs.rm(artStateRoot, { recursive: true, force: true });
    await fs.rm(deployStateRoot, { recursive: true, force: true });
    await fs.mkdir(artStateRoot, { recursive: true });
    await fs.mkdir(deployStateRoot, { recursive: true });
    const normalized = [];
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const frame = await normalizeFrame(allFrames.get(state)[index], scale);
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
      .png({ palette: true, colours: 128, quality: 94, compressionLevel: 9 })
      .toFile(path.join(SOURCE_ROOT, `ram-beetle-${state}.png`));
  }
  return totalBytes;
}

async function validate() {
  for (const state of STATES) {
    const bottoms = [];
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const file = path.join(DEPLOY_ROOT, state, `frame${index}.png`);
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
      throw new Error(`Unstable baseline in ${state}: ${bottoms.join(", ")}`);
    }
  }
}

const allFrames = new Map();
let widest = 0;
let tallest = 0;
for (const state of STATES) {
  const frames = await extractFrames(state);
  allFrames.set(state, frames);
  for (const frame of frames) {
    widest = Math.max(widest, frame.width);
    tallest = Math.max(tallest, frame.height);
  }
}
const scale = Math.min(MAX_WIDTH / widest, MAX_HEIGHT / tallest);
const totalBytes = await writeFrames(allFrames, scale);
await validate();
console.log(`Besouro-Aríete: ${STATES.length * FRAME_COUNT} frames, ${totalBytes} bytes, scale ${scale.toFixed(4)}`);
