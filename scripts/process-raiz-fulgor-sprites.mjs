import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const root = process.cwd();
const tempRoot = path.join(root, ".codex-tmp", "raiz-fulgor");
const rawRoot = path.join(tempRoot, "raw");
const keyedRoot = path.join(tempRoot, "keyed");
const outputRoot = path.join(root, "src", "game", "assets", "enemy", "raizFulgor");
const sheetRoot = path.join(root, "artifacts", "raiz-fulgor", "sheets");
const states = [
  "idle", "walking", "rooting", "rootedIdle", "attackCharge",
  "attackRelease", "unrooting", "stunned", "death",
];
const runFile = promisify(execFile);

async function extract() {
  for (const state of states) {
    const sheet = path.join(sheetRoot, `${state}-sheet.png`);
    const metadata = await sharp(sheet).metadata();
    const cellWidth = Math.floor(metadata.width / 4);
    const cellHeight = Math.floor(metadata.height / 2);
    const stateRoot = path.join(rawRoot, state);
    await fs.mkdir(stateRoot, { recursive: true });
    for (let index = 0; index < 8; index += 1) {
      await sharp(sheet)
        .extract({
          left: (index % 4) * cellWidth,
          top: Math.floor(index / 4) * cellHeight,
          width: cellWidth,
          height: cellHeight,
        })
        .png()
        .toFile(path.join(stateRoot, `frame${index}.png`));
    }
  }
}

async function isolateLargestComponent(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let largest = [];

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (x < 4 || y < 4 || x >= info.width - 4 || y >= info.height - 4) {
        data[(y * info.width + x) * 4 + 3] = 0;
      }
    }
  }

  for (let origin = 0; origin < pixelCount; origin += 1) {
    if (visited[origin] || data[origin * 4 + 3] === 0) continue;
    const component = [];
    let head = 0;
    let tail = 0;
    queue[tail++] = origin;
    visited[origin] = 1;
    while (head < tail) {
      const current = queue[head++];
      component.push(current);
      const x = current % info.width;
      const y = Math.floor(current / info.width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= info.width || ny < 0 || ny >= info.height) continue;
          const next = ny * info.width + nx;
          if (visited[next] || data[next * 4 + 3] === 0) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }

  const keep = new Uint8Array(pixelCount);
  largest.forEach((pixel) => { keep[pixel] = 1; });
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (!keep[pixel]) data[pixel * 4 + 3] = 0;
  }

  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  const bounds = right < left
    ? { left: 0, top: 0, width: 1, height: 1 }
    : { left, top, width: right - left + 1, height: bottom - top + 1 };
  const buffer = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
  return { bounds, buffer };
}

async function keyFrames() {
  const python = process.env.RAIZ_FULGOR_PYTHON || "python";
  const helper = process.env.RAIZ_FULGOR_CHROMA_HELPER;
  if (!helper) throw new Error("Set RAIZ_FULGOR_CHROMA_HELPER to remove_chroma_key.py");
  const work = [];
  for (const state of states) {
    for (let index = 0; index < 8; index += 1) {
      const input = path.join(rawRoot, state, `frame${index}.png`);
      const output = path.join(keyedRoot, state, `frame${index}.png`);
      work.push(async () => {
        await fs.mkdir(path.dirname(output), { recursive: true });
        await runFile(python, [
          helper,
          "--input", input,
          "--out", output,
          "--auto-key", "border",
          "--soft-matte",
          "--transparent-threshold", "12",
          "--opaque-threshold", "220",
          "--despill",
          "--force",
        ], { maxBuffer: 1024 * 1024 });
      });
    }
  }
  let cursor = 0;
  async function worker() {
    while (cursor < work.length) {
      const current = cursor++;
      await work[current]();
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
}

async function finalize() {
  const entries = [];
  for (const state of states) {
    for (let index = 0; index < 8; index += 1) {
      const isolated = await isolateLargestComponent(
        path.join(keyedRoot, state, `frame${index}.png`),
      );
      entries.push({ state, index, ...isolated });
    }
  }

  const maxWidth = Math.max(...entries.map(({ bounds }) => bounds.width));
  const maxHeight = Math.max(...entries.map(({ bounds }) => bounds.height));
  const scale = Math.min(1, 296 / maxWidth, 232 / maxHeight);
  const groundY = 244;

  for (const { state, index, buffer, bounds } of entries) {
    const destinationRoot = path.join(outputRoot, state);
    await fs.mkdir(destinationRoot, { recursive: true });
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    const content = await sharp(buffer)
      .extract(bounds)
      .resize(width, height, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: 320,
        height: 256,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{
        input: content,
        left: Math.floor((320 - width) / 2),
        top: groundY - height,
      }])
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        colours: 48,
        dither: 0.7,
      })
      .toFile(path.join(destinationRoot, `frame${index}.png`));
  }

  process.stdout.write(JSON.stringify({
    frames: entries.length, maxWidth, maxHeight, scale, groundY,
  }, null, 2));
}

const command = process.argv[2];
if (command === "extract") await extract();
else if (command === "key") await keyFrames();
else if (command === "finalize") await finalize();
else throw new Error("Use: node scripts/process-raiz-fulgor-sprites.mjs extract|key|finalize");
