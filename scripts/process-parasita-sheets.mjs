import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_ROOT = path.join(ROOT, "art", "spritesheets", "parasitaSaltador");
const TARGET_ROOT = path.join(ROOT, "src", "game", "assets", "enemy", "parasitaSaltador");
const STATES = ["idle", "walking", "attack", "jump"];
const FRAME_SIZE = 256;
const FRAME_COUNT = 12;
const SUBJECT_SIZE = 224;

function connectedComponents(data, width, height) {
  const visited = new Uint8Array(width * height);
  const components = [];
  const queue = new Int32Array(width * height);

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || data[start * 4 + 3] <= 32) continue;
    visited[start] = 1;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!offsetX && !offsetY) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (visited[next] || data[next * 4 + 3] <= 32) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }

    if (area > 500) components.push({ area, minX, minY, maxX, maxY });
  }

  return components
    .sort((left, right) => {
      const leftRow = Math.floor(((left.minY + left.maxY) / 2) * 3 / height);
      const rightRow = Math.floor(((right.minY + right.maxY) / 2) * 3 / height);
      return leftRow - rightRow || left.minX - right.minX;
    });
}

async function splitState(state) {
  const source = path.join(SOURCE_ROOT, `parasita-${state}.png`);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const components = connectedComponents(data, info.width, info.height);
  if (components.length !== FRAME_COUNT) {
    throw new Error(`${state}: esperava ${FRAME_COUNT} criaturas isoladas, encontrou ${components.length}`);
  }
  const maxWidth = Math.max(...components.map(({ minX, maxX }) => maxX - minX + 1));
  const maxHeight = Math.max(...components.map(({ minY, maxY }) => maxY - minY + 1));
  const scale = Math.min(SUBJECT_SIZE / maxWidth, SUBJECT_SIZE / maxHeight);
  const targetDirectory = path.join(TARGET_ROOT, state);
  await fs.mkdir(targetDirectory, { recursive: true });

  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const padding = 3;
    const left = Math.max(0, component.minX - padding);
    const top = Math.max(0, component.minY - padding);
    const width = Math.min(info.width - left, component.maxX - left + 1 + padding);
    const height = Math.min(info.height - top, component.maxY - top + 1 + padding);
    const resizedWidth = Math.max(1, Math.round(width * scale));
    const resizedHeight = Math.max(1, Math.round(height * scale));
    const sprite = await sharp(source)
      .extract({ left, top, width, height })
      .resize(resizedWidth, resizedHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    await sharp({
      create: { width: FRAME_SIZE, height: FRAME_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: sprite, left: Math.round((FRAME_SIZE - resizedWidth) / 2), top: FRAME_SIZE - 12 - resizedHeight }])
      .png({ compressionLevel: 9, palette: true, colors: 256, quality: 94, dither: 0.4 })
      .toFile(path.join(targetDirectory, `frame${index}.png`));
  }

  console.log(`${state}: ${components.length} frames`);
}

for (const state of STATES) await splitState(state);
