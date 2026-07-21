import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "art", "spritesheets", "scarabEmperor");
const DEPLOY_ROOT = path.join(ROOT, "src", "game", "assets", "enemy", "scarabEmperor");
const FRAME_COUNT = 8;
const SOURCE_COLUMNS = 8;
const SOURCE_ROWS = 5;
const SHEET_COLUMNS = 4;
const FRAME_SIZE = 256;
const MAX_WIDTH = 244;
const MAX_HEIGHT = 238;
const CENTER_X = 128;
const ROOT_Y = 248;
const CELL_INSET = 3;
const CELL_OVERLAP = 128;

const ATLASES = [
  {
    file: "scarab-emperor-phase1-atlas-chroma.png",
    states: ["phase1Walking", "phase1Idle", "phase1Attack", "phase1Hit", "transitionPhase1To2"],
  },
  {
    file: "scarab-emperor-phase2-atlas-chroma.png",
    states: ["phase2Walking", "phase2Idle", "phase2Attack", "phase2Hit", "transitionPhase2To3"],
  },
  {
    file: "scarab-emperor-phase3-atlas-chroma.png",
    states: ["phase3Walking", "phase3Idle", "phase3Attack", "phase3Hit", "death"],
  },
];

function removeGreenChroma(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = green - Math.max(red, blue);
    if (green < 105 || dominance < 24) continue;
    const matte = Math.max(0, Math.min(1, (75 - dominance) / 50));
    data[offset + 3] = Math.min(data[offset + 3], Math.round(255 * matte));
    if (data[offset + 3] < 250) data[offset + 1] = Math.min(green, Math.round((red + blue) / 2));
    if (data[offset + 3] <= 5) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
}

function removeNeighbourBleed(data, info) {
  const visited = new Uint8Array(info.width * info.height);
  const components = [];
  for (let start = 0; start < visited.length; start += 1) {
    if (visited[start] || data[start * 4 + 3] <= 8) continue;
    const queue = [start];
    const pixels = [];
    visited[start] = 1;
    let touchesSide = false;
    let minX = info.width;
    let maxX = -1;
    let minY = info.height;
    let maxY = -1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixel = queue[cursor];
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      if (x <= 1 || x >= info.width - 2) touchesSide = true;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      pixels.push(pixel);
      for (const next of [
        x > 0 ? pixel - 1 : -1,
        x + 1 < info.width ? pixel + 1 : -1,
        y > 0 ? pixel - info.width : -1,
        y + 1 < info.height ? pixel + info.width : -1,
      ]) {
        if (next < 0 || visited[next] || data[next * 4 + 3] <= 8) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
    components.push({ pixels, touchesSide, minX, maxX, minY, maxY });
  }
  const cellCenterX = info.width / 2;
  const largestSize = Math.max(...components.map((component) => component.pixels.length));
  const bodyCandidates = components.filter((component) => component.pixels.length >= largestSize * 0.25);
  const primary = bodyCandidates.reduce((best, component) => {
    const centerX = (component.minX + component.maxX) / 2;
    const score = Math.abs(centerX - cellCenterX);
    return score < (best?.score ?? Number.POSITIVE_INFINITY) ? { component, score } : best;
  }, null)?.component;
  for (const component of components) {
    if (component === primary) continue;
    const neighbourBody = component.pixels.length >= primary.pixels.length * 0.15;
    const nearSubject = component.maxX >= primary.minX - 28
      && component.minX <= primary.maxX + 28
      && component.maxY >= primary.minY - 28
      && component.minY <= primary.maxY + 28;
    if (!component.touchesSide && !neighbourBody && nearSubject) continue;
    for (const pixel of component.pixels) {
      const offset = pixel * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
}

async function extractAtlas(atlas) {
  const sourcePath = path.join(SOURCE_ROOT, atlas.file);
  const source = sharp(sourcePath);
  const metadata = await source.metadata();
  const extracted = new Map();
  for (let row = 0; row < SOURCE_ROWS; row += 1) {
    const frames = [];
    for (let column = 0; column < SOURCE_COLUMNS; column += 1) {
      const left = Math.max(0, Math.round(column * metadata.width / SOURCE_COLUMNS) - CELL_OVERLAP);
      const right = Math.min(metadata.width, Math.round((column + 1) * metadata.width / SOURCE_COLUMNS) + CELL_OVERLAP);
      const top = Math.round(row * metadata.height / SOURCE_ROWS) + CELL_INSET;
      const bottom = Math.round((row + 1) * metadata.height / SOURCE_ROWS) - CELL_INSET;
      const { data, info } = await source.clone()
        .extract({ left, top, width: right - left, height: bottom - top })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      removeGreenChroma(data);
      removeNeighbourBleed(data, info);
      const trimmed = await sharp(data, { raw: info })
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 })
        .png()
        .toBuffer();
      const frameMetadata = await sharp(trimmed).metadata();
      frames.push({ buffer: trimmed, width: frameMetadata.width, height: frameMetadata.height });
    }
    extracted.set(atlas.states[row], frames);
  }
  return extracted;
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
    .png({ palette: true, colours: 160, quality: 95, compressionLevel: 9 })
    .toBuffer();
}

async function writeState(state, frames, scale) {
  const artStateRoot = path.join(SOURCE_ROOT, "frames", state);
  const deployStateRoot = path.join(DEPLOY_ROOT, state);
  await fs.rm(artStateRoot, { recursive: true, force: true });
  await fs.rm(deployStateRoot, { recursive: true, force: true });
  await fs.mkdir(artStateRoot, { recursive: true });
  await fs.mkdir(deployStateRoot, { recursive: true });
  const normalized = [];
  let totalBytes = 0;
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    const frame = await normalizeFrame(frames[index], scale);
    normalized.push(frame);
    totalBytes += frame.length;
    await fs.writeFile(path.join(artStateRoot, `frame${index}.png`), frame);
    await fs.writeFile(path.join(deployStateRoot, `frame${index}.png`), frame);
  }
  await sharp({
    create: {
      width: FRAME_SIZE * SHEET_COLUMNS,
      height: FRAME_SIZE * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(normalized.map((input, index) => ({
      input,
      left: (index % SHEET_COLUMNS) * FRAME_SIZE,
      top: Math.floor(index / SHEET_COLUMNS) * FRAME_SIZE,
    })))
    .png({ palette: true, colours: 160, quality: 95, compressionLevel: 9 })
    .toFile(path.join(SOURCE_ROOT, `scarab-emperor-${state}.png`));
  return totalBytes;
}

async function validate(states) {
  for (const state of states) {
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
for (const atlas of ATLASES) {
  const states = await extractAtlas(atlas);
  for (const [state, frames] of states) {
    allFrames.set(state, frames);
    for (const frame of frames) {
      widest = Math.max(widest, frame.width);
      tallest = Math.max(tallest, frame.height);
    }
  }
}
const scale = Math.min(MAX_WIDTH / widest, MAX_HEIGHT / tallest);
let totalBytes = 0;
for (const [state, frames] of allFrames) totalBytes += await writeState(state, frames, scale);
await validate([...allFrames.keys()]);
console.log(`Imperador Escaravelho: ${allFrames.size * FRAME_COUNT} frames, ${totalBytes} bytes, scale ${scale.toFixed(4)}`);
