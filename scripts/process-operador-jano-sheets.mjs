import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceRoot = path.resolve("art/spritesheets/operadorJano");
const outputRoot = path.resolve("src/game/assets/troop/operadorJano");
const characterSize = 512;
const droneSize = 384;
const characterFloorY = Math.round(characterSize * 0.9512);
const alphaThreshold = 20;

const sheets = [
  { state: "idle", file: "operador-jano-idle-alpha.png", layer: "character" },
  { state: "attackFront", file: "operador-jano-attackFront-alpha.png", layer: "character" },
  { state: "syncShot", file: "operador-jano-syncShot-alpha.png", layer: "character" },
  { state: "death", file: "operador-jano-death-alpha.png", layer: "character" },
  { state: "droneIdle", file: "iris-droneIdle-alpha.png", layer: "drone" },
  { state: "droneAttackRear", file: "iris-droneAttackRear-alpha.png", layer: "drone" },
  { state: "droneDisabled", file: "iris-droneDisabled-alpha.png", layer: "drone" },
  { state: "droneRecover", file: "iris-droneRecover-alpha.png", layer: "drone" },
];

function visibleMetrics(data, info) {
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] < alphaThreshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("Frame sem pixels visíveis.");
  return {
    left,
    right,
    top,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

function supportRootX(data, info, metrics) {
  const bandTop = Math.max(metrics.top, metrics.bottom - Math.round(metrics.height * 0.09));
  let left = info.width;
  let right = -1;
  for (let y = bandTop; y <= metrics.bottom; y += 1) {
    for (let x = metrics.left; x <= metrics.right; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] < 48) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return right >= left ? (left + right) / 2 : metrics.centerX;
}

async function translate(buffer, size, dx, dy) {
  const padded = await sharp(buffer)
    .extend({
      left: size,
      right: size,
      top: size,
      bottom: size,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ palette: false })
    .toBuffer();
  return sharp(padded)
    .extract({
      left: size - dx,
      top: size - dy,
      width: size,
      height: size,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: false })
    .toBuffer();
}

async function decode(buffer) {
  return sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function sliceSheet(sheet) {
  const source = path.join(sourceRoot, sheet.file);
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height || metadata.channels !== 4) {
    throw new Error(`${source} precisa ser um PNG RGBA.`);
  }

  const size = sheet.layer === "character" ? characterSize : droneSize;
  const rawFrames = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const column = frame % 4;
    const row = Math.floor(frame / 4);
    const left = Math.round((column * metadata.width) / 4);
    const right = Math.round(((column + 1) * metadata.width) / 4);
    const top = Math.round((row * metadata.height) / 2);
    const bottom = Math.round(((row + 1) * metadata.height) / 2);
    const innerSize = sheet.layer === "drone" ? Math.round(size * 0.9) : size;
    const cell = await sharp(source)
      .extract({ left, top, width: right - left, height: bottom - top })
      .resize(innerSize, innerSize, {
        fit: "contain",
        kernel: sharp.kernel.lanczos3,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ palette: false })
      .toBuffer();
    const buffer = innerSize === size
      ? cell
      : await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).composite([{
        input: cell,
        left: Math.floor((size - innerSize) / 2),
        top: Math.floor((size - innerSize) / 2),
      }]).png({ palette: false }).toBuffer();
    rawFrames.push(buffer);
  }

  const first = await decode(rawFrames[0]);
  const firstMetrics = visibleMetrics(first.data, first.info);
  const dx = sheet.layer === "character"
    ? Math.round(size / 2 - supportRootX(first.data, first.info, firstMetrics))
    : Math.round(size / 2 - firstMetrics.centerX);
  const dy = sheet.layer === "character"
    ? characterFloorY - firstMetrics.bottom
    : Math.round(size / 2 - firstMetrics.centerY);

  const folder = path.join(outputRoot, sheet.state);
  await fs.mkdir(folder, { recursive: true });
  const report = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const rawDecoded = await decode(rawFrames[frame]);
    const rawMetrics = visibleMetrics(rawDecoded.data, rawDecoded.info);
    const frameDy = sheet.layer === "character" && sheet.state !== "death"
      ? characterFloorY - rawMetrics.bottom
      : dy;
    const output = await translate(rawFrames[frame], size, dx, frameDy);
    const decoded = await decode(output);
    const metrics = visibleMetrics(decoded.data, decoded.info);
    const corners = [
      decoded.data[3],
      decoded.data[(size - 1) * decoded.info.channels + 3],
      decoded.data[((size - 1) * size) * decoded.info.channels + 3],
      decoded.data[((size * size) - 1) * decoded.info.channels + 3],
    ];
    if (corners.some((alpha) => alpha > 0)) {
      throw new Error(`${sheet.state}/frame${frame}.png possui canto opaco.`);
    }
    await fs.writeFile(path.join(folder, `frame${frame}.png`), output);
    report.push({
      frame,
      bounds: [metrics.left, metrics.top, metrics.right, metrics.bottom],
      rootX: sheet.layer === "character"
        ? supportRootX(decoded.data, decoded.info, metrics) / size
        : metrics.centerX / size,
      anchorY: sheet.layer === "character" ? characterFloorY / size : 0.5,
    });
  }
  return { state: sheet.state, size, dx, dy, frames: report };
}

if (!outputRoot.endsWith(path.join("assets", "troop", "operadorJano"))) {
  throw new Error(`Pasta de destino inesperada: ${outputRoot}`);
}

await fs.mkdir(outputRoot, { recursive: true });
const report = [];
for (const sheet of sheets) report.push(await sliceSheet(sheet));
await fs.writeFile(
  path.join(sourceRoot, "sprite-metrics.json"),
  `${JSON.stringify({
    characterCanvas: [characterSize, characterSize],
    droneCanvas: [droneSize, droneSize],
    characterAnchorY: characterFloorY / characterSize,
    states: report,
  }, null, 2)}\n`,
  "utf8",
);

console.log(`64 sprites RGBA do Operador Jano gerados em ${outputRoot}`);
