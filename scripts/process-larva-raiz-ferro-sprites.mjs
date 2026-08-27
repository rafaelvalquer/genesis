import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [, , sourceDirArg, destinationDirArg] = process.argv;
if (!sourceDirArg || !destinationDirArg) {
  console.error('Usage: node scripts/process-larva-raiz-ferro-sprites.mjs <source-dir> <destination-dir>');
  process.exit(1);
}

const sourceDir = path.resolve(sourceDirArg);
const destinationDir = path.resolve(destinationDirArg);
await fs.mkdir(destinationDir, { recursive: true });

const files = (await fs.readdir(sourceDir))
  .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!files.length) throw new Error(`No source images found in ${sourceDir}`);

const isBackgroundPixel = (r, g, b) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const average = (r + g + b) / 3;
  return (max - min < 14 && average > 185) || average > 248;
};

function removeConnectedLightBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queueX = new Int32Array(width * height);
  const queueY = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const add = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    const pixel = index * 4;
    if (!isBackgroundPixel(data[pixel], data[pixel + 1], data[pixel + 2])) return;
    visited[index] = 1;
    queueX[tail] = x;
    queueY[tail] = y;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    add(0, y);
    add(width - 1, y);
  }

  while (head < tail) {
    const x = queueX[head];
    const y = queueY[head];
    head += 1;
    data[(y * width + x) * 4 + 3] = 0;
    add(x + 1, y);
    add(x - 1, y);
    add(x, y + 1);
    add(x, y - 1);
  }
}

function alignBaseline(data, width, height, baseline = 410) {
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) bottom = y;
    }
  }
  if (bottom < 0) return;
  const offset = baseline - bottom;
  if (offset === 0) return;
  const original = Buffer.from(data);
  data.fill(0);
  for (let y = 0; y < height; y += 1) {
    const sourceY = y - offset;
    if (sourceY < 0 || sourceY >= height) continue;
    original.copy(data, y * width * 4, sourceY * width * 4, (sourceY + 1) * width * 4);
  }
}

function alignCenterX(data, width, height, centerX = 256) {
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }
  if (right < 0) return;
  const offset = Math.round(centerX - (left + right) / 2);
  if (offset === 0) return;
  const original = Buffer.from(data);
  data.fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = x - offset;
      if (sourceX < 0 || sourceX >= width) continue;
      const source = (y * width + sourceX) * 4;
      const target = (y * width + x) * 4;
      original.copy(data, target, source, source + 4);
    }
  }
}

for (let index = 0; index < files.length; index += 1) {
  const source = path.join(sourceDir, files[index]);
  const { data, info } = await sharp(source)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  removeConnectedLightBackground(data, info.width, info.height);
  alignBaseline(data, info.width, info.height);
  alignCenterX(data, info.width, info.height);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(path.join(destinationDir, `frame${index}.png`));
}

console.log(`Processed ${files.length} frame(s) into ${destinationDir}`);
