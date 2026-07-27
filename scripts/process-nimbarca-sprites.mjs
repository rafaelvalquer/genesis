import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const tempRoot = path.join(root, ".codex-tmp", "nimbarca");
const rawRoot = path.join(tempRoot, "raw");
const keyedRoot = path.join(tempRoot, "keyed");
const outputRoot = path.join(root, "src", "game", "assets", "enemy", "nimbarca");
const sheetRoot = path.join(root, "artifacts", "nimbarca", "sheets");
const states = ["flying", "attack", "shieldPulse", "death"];

async function extract() {
  for (const state of states) {
    const sheet = path.join(sheetRoot, `${state}-sheet.png`);
    const stateRoot = path.join(rawRoot, state);
    await fs.mkdir(stateRoot, { recursive: true });
    for (let index = 0; index < 8; index += 1) {
      const column = index % 4;
      const row = Math.floor(index / 4);
      await sharp(sheet)
        .extract({ left: column * 384, top: row * 512 + 64, width: 384, height: 384 })
        .png()
        .toFile(path.join(stateRoot, `frame${index}.png`));
    }
  }
}

async function alphaBounds(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  if (right < left) return { left: 0, top: 0, width: 1, height: 1 };
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function finalize() {
  const entries = [];
  for (const state of states) {
    for (let index = 0; index < 8; index += 1) {
      const file = path.join(keyedRoot, state, `frame${index}.png`);
      entries.push({ state, index, file, bounds: await alphaBounds(file) });
    }
  }

  const maxWidth = Math.max(...entries.map(({ bounds }) => bounds.width));
  const maxHeight = Math.max(...entries.map(({ bounds }) => bounds.height));
  const scale = Math.min(1, 352 / maxWidth, 352 / maxHeight);

  for (const { state, index, file, bounds } of entries) {
    const destinationRoot = path.join(outputRoot, state);
    await fs.mkdir(destinationRoot, { recursive: true });
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    const content = await sharp(file)
      .extract(bounds)
      .resize(width, height, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    await sharp({
      create: { width: 384, height: 384, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: content, left: Math.floor((384 - width) / 2), top: Math.floor((384 - height) / 2) }])
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        colours: 256,
        dither: 0.8,
      })
      .toFile(path.join(destinationRoot, `frame${index}.png`));
  }

  process.stdout.write(JSON.stringify({ frames: entries.length, maxWidth, maxHeight, scale }, null, 2));
}

const command = process.argv[2];
if (command === "extract") await extract();
else if (command === "finalize") await finalize();
else throw new Error("Use: node scripts/process-nimbarca-sprites.mjs extract|finalize");
