import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "art", "spritesheets", "lumiUrsa7");
const TARGET = path.join(SOURCE, "frames");
const DEPLOY_TARGET = path.join(ROOT, "src", "game", "assets", "troop", "lumiUrsa7");
const STATES = ["idle", "attack", "transitionIn", "defense", "transitionOut"];
const FRAME_SIZE = 256;
const ROOT_X = 112;
const ROOT_Y = 248;
const MAX_WIDTH = 248;
const MAX_HEIGHT = 242;
const MAX_TOTAL_BYTES = 700_000;

function removeChroma(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const magentaDominance = Math.min(red, blue) - green;
    const alpha = Math.max(0, Math.min(255, Math.round((105 - magentaDominance) / 70 * 255)));
    data[offset + 3] = Math.min(data[offset + 3], alpha);

    if (alpha > 20 && alpha < 250) {
      const ratio = alpha / 255;
      data[offset] = Math.max(0, Math.min(255, Math.round((red - (1 - ratio) * 255) / ratio)));
      data[offset + 1] = Math.max(0, Math.min(255, Math.round(green / ratio)));
      data[offset + 2] = Math.max(0, Math.min(255, Math.round((blue - (1 - ratio) * 255) / ratio)));
    }
  }
}

function supportPoint(data, info) {
  let bottom = -1;
  for (let y = info.height - 1; y >= 0 && bottom < 0; y -= 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] >= 96) {
        bottom = y;
        break;
      }
    }
  }
  if (bottom < 0) throw new Error("empty Lumi/URSA-7 sprite cell");

  const support = [];
  for (let y = Math.max(0, bottom - 48); y <= bottom; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] >= 96) support.push(x);
    }
  }
  return {
    x: support.length ? (Math.min(...support) + Math.max(...support)) / 2 : info.width / 2,
    y: bottom,
  };
}

async function extractCell(sheet, metadata, index) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const left = Math.round(column * metadata.width / 4);
  const right = Math.round((column + 1) * metadata.width / 4);
  const top = Math.round(row * metadata.height / 2);
  const bottom = Math.round((row + 1) * metadata.height / 2);
  const { data, info } = await sheet.clone()
    .extract({ left, top, width: right - left, height: bottom - top })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  removeChroma(data);
  return sharp(data, { raw: info })
    .trim({ background: { r: 255, g: 0, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

async function readCells() {
  const cells = new Map();
  let widest = 0;
  let tallest = 0;
  for (const state of STATES) {
    const sheet = sharp(path.join(SOURCE, `lumi-ursa7-${state}-chroma.png`));
    const metadata = await sheet.metadata();
    const stateCells = [];
    for (let index = 0; index < 8; index += 1) {
      const cell = await extractCell(sheet, metadata, index);
      const cellMetadata = await sharp(cell).metadata();
      widest = Math.max(widest, cellMetadata.width);
      tallest = Math.max(tallest, cellMetadata.height);
      stateCells.push(cell);
    }
    cells.set(state, stateCells);
  }
  return {
    cells,
    scale: Math.min(MAX_WIDTH / widest, MAX_HEIGHT / tallest),
  };
}

async function normalizeCell(cell, scale) {
  const metadata = await sharp(cell).metadata();
  const width = Math.max(1, Math.round(metadata.width * scale));
  const height = Math.max(1, Math.round(metadata.height * scale));
  const { data, info } = await sharp(cell)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const root = supportPoint(data, info);
  return sharp({
    create: {
      width: FRAME_SIZE,
      height: FRAME_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: data,
      raw: info,
      left: Math.round(ROOT_X - root.x),
      top: ROOT_Y - root.y,
    }])
    .png()
    .toBuffer();
}

async function writeAssets(cells, scale, colours) {
  await fs.mkdir(TARGET, { recursive: true });
  for (const state of STATES) {
    const output = path.join(TARGET, state);
    await fs.mkdir(output, { recursive: true });
    const frames = [];
    for (let index = 0; index < 8; index += 1) {
      const normalized = await normalizeCell(cells.get(state)[index], scale);
      const encoded = await sharp(normalized)
        .png({ palette: true, colours, quality: 86, compressionLevel: 9 })
        .toBuffer();
      frames.push(encoded);
      await fs.writeFile(path.join(output, `frame${index}.png`), encoded);
    }

    await sharp({
      create: {
        width: FRAME_SIZE * 4,
        height: FRAME_SIZE * 2,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(frames.map((input, index) => ({
        input,
        left: (index % 4) * FRAME_SIZE,
        top: Math.floor(index / 4) * FRAME_SIZE,
      })))
      .png({ palette: true, colours, quality: 86, compressionLevel: 9 })
      .toFile(path.join(SOURCE, `lumi-ursa7-${state}.png`));
  }
}

async function validate() {
  let totalBytes = 0;
  for (const state of STATES) {
    const roots = [];
    for (let index = 0; index < 8; index += 1) {
      const framePath = path.join(TARGET, state, `frame${index}.png`);
      const stat = await fs.stat(framePath);
      totalBytes += stat.size;
      const metadata = await sharp(framePath).metadata();
      if (metadata.width !== FRAME_SIZE || metadata.height !== FRAME_SIZE || !metadata.hasAlpha || !metadata.isPalette) {
        throw new Error(`invalid Lumi/URSA-7 frame: ${framePath}`);
      }
      const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
      if (corners.some((pixel) => data[pixel * 4 + 3] !== 0)) throw new Error(`opaque corner: ${framePath}`);
      roots.push(supportPoint(data, info).y);
    }
    if (Math.max(...roots) - Math.min(...roots) > 1) {
      throw new Error(`unstable Lumi/URSA-7 root in ${state}: ${roots.join(", ")}`);
    }
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(`Lumi/URSA-7 frames exceed ${MAX_TOTAL_BYTES} bytes: ${totalBytes}`);
  }
  return totalBytes;
}

async function writeDeploymentFrames() {
  let totalBytes = 0;
  for (const state of STATES) {
    const output = path.join(DEPLOY_TARGET, state);
    await fs.mkdir(output, { recursive: true });
    for (let index = 0; index < 8; index += 1) {
      const sourcePath = path.join(TARGET, state, `frame${index}.png`);
      const outputPath = path.join(output, `frame${index}.png`);
      await sharp(sourcePath)
        .png({ palette: true, colours: 64, quality: 90, compressionLevel: 9 })
        .toFile(outputPath);
      const metadata = await sharp(outputPath).metadata();
      if (metadata.width !== FRAME_SIZE || metadata.height !== FRAME_SIZE || !metadata.hasAlpha || !metadata.isPalette) {
        throw new Error(`invalid deployed Lumi/URSA-7 frame: ${outputPath}`);
      }
      totalBytes += (await fs.stat(outputPath)).size;
    }
  }
  return totalBytes;
}

const { cells, scale } = await readCells();
await writeAssets(cells, scale, 64);
const totalBytes = await validate();
const deployedBytes = await writeDeploymentFrames();
console.log(`Lumi e URSA-7: 40 source frames (${totalBytes} bytes) and 40 deployed frames (${deployedBytes} bytes).`);
