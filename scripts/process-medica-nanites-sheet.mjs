import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "art", "spritesheets", "medicaNanites");
const TARGET = path.join(ROOT, "src", "game", "assets", "troop", "medicaNanites");
const STATES = ["idle", "heal", "attack", "cooldown"];
const FRAME_SIZE = 192;
const ROOT_X = 70;
const ROOT_Y = 184;
const MAX_WIDTH = 164;
const MAX_HEIGHT = 158;
const MAX_TOTAL_BYTES = 120_000;

function removeChroma(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const magentaDominance = Math.min(red, blue) - green;
    const alpha = Math.max(0, Math.min(255, Math.round((145 - magentaDominance) / 55 * 255)));
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
  if (bottom < 0) throw new Error("empty medic sprite cell");

  const support = [];
  for (let y = Math.max(0, bottom - 9); y <= bottom; y += 1) {
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

async function normalizeCell(cell) {
  const metadata = await sharp(cell).metadata();
  const scale = Math.min(MAX_WIDTH / metadata.width, MAX_HEIGHT / metadata.height);
  const width = Math.max(1, Math.round(metadata.width * scale));
  const height = Math.max(1, Math.round(metadata.height * scale));
  const { data, info } = await sharp(cell)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const root = supportPoint(data, info);
  const left = Math.round(ROOT_X - root.x);
  const top = ROOT_Y - root.y;
  return sharp({
    create: {
      width: FRAME_SIZE,
      height: FRAME_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: data, raw: info, left, top }])
    .png()
    .toBuffer();
}

async function writeFrames(colours) {
  for (const state of STATES) {
    const sourcePath = path.join(SOURCE, `medica-nanites-${state}-chroma.png`);
    const sheet = sharp(sourcePath);
    const metadata = await sheet.metadata();
    const output = path.join(TARGET, state);
    await fs.mkdir(output, { recursive: true });
    const existing = await fs.readdir(output);
    await Promise.all(existing
      .filter((filename) => /^frame\d+\.png$/.test(filename))
      .map((filename) => fs.unlink(path.join(output, filename))));

    const frames = [];
    for (let index = 0; index < 8; index += 1) {
      const normalized = await normalizeCell(await extractCell(sheet, metadata, index));
      const encoded = await sharp(normalized)
        .png({ palette: true, colours, quality: 86, compressionLevel: 9 })
        .toBuffer();
      frames.push(encoded);
      await fs.writeFile(path.join(output, `frame${index}.png`), encoded);
    }

    const preview = sharp({
      create: {
        width: FRAME_SIZE * 4,
        height: FRAME_SIZE * 2,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });
    await preview
      .composite(frames.map((input, index) => ({
        input,
        left: (index % 4) * FRAME_SIZE,
        top: Math.floor(index / 4) * FRAME_SIZE,
      })))
      .png({ palette: true, colours, quality: 86, compressionLevel: 9 })
      .toFile(path.join(SOURCE, `medica-nanites-${state}.png`));
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
      const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width !== FRAME_SIZE || info.height !== FRAME_SIZE) throw new Error(`invalid dimensions: ${framePath}`);
      const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
      if (corners.some((pixel) => data[pixel * 4 + 3] !== 0)) throw new Error(`opaque corner: ${framePath}`);
      roots.push(supportPoint(data, info).y);
    }
    if (Math.max(...roots) - Math.min(...roots) > 1) throw new Error(`unstable root in ${state}: ${roots.join(", ")}`);
  }
  return totalBytes;
}

let totalBytes = Infinity;
let palette = 64;
for (const colours of [64, 48, 32, 24, 16]) {
  await writeFrames(colours);
  totalBytes = await validate();
  palette = colours;
  if (totalBytes <= MAX_TOTAL_BYTES) break;
}
if (totalBytes > MAX_TOTAL_BYTES) {
  throw new Error(`medic frames exceed ${MAX_TOTAL_BYTES} bytes: ${totalBytes}`);
}
console.log(`Médica de Nanites: 32 frames, ${FRAME_SIZE}x${FRAME_SIZE}, ${palette} colors, ${totalBytes} bytes.`);
