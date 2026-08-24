import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "art", "spritesheets", "macacoEsporos");
const outputRoot = path.join(root, "src", "game", "assets", "enemy", "macacoEsporos");
const states = ["idle", "walking", "attack", "sporeThrow"];
const size = 512;

function removeMagenta(data) {
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (r > 190 && b > 150 && g < 100) data[i + 3] = 0;
  }
}

function bounds(data, info) {
  let left = info.width; let right = -1; let top = info.height; let bottom = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * 4 + 3] < 20) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error("Empty Macaco de Esporos sprite cell");
  return { left, top, width: right - left + 1, height: bottom - top + 1, bottom };
}

async function processState(state) {
  const source = sharp(path.join(sourceRoot, `${state}.png`));
  const meta = await source.metadata();
  const cellW = Math.floor(meta.width / 4); const cellH = Math.floor(meta.height / 2);
  const cells = [];
  for (let index = 0; index < 8; index += 1) {
    const { data, info } = await source.clone().extract({ left: index % 4 * cellW, top: Math.floor(index / 4) * cellH, width: cellW, height: cellH }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeMagenta(data); const box = bounds(data, info);
    cells.push({ data, info, box });
  }
  // One canonical scale for every animation and frame: membranes/arms may expand without shrinking the body.
  const reference = cells[0].box;
  const globalScale = Math.min(420 / reference.height, 430 / reference.width);
  await fs.mkdir(path.join(outputRoot, state), { recursive: true });
  await Promise.all(cells.map(async ({ data, info, box }, index) => {
    const cropped = await sharp(data, { raw: info }).extract({ left: box.left, top: box.top, width: box.width, height: box.height }).resize({ width: Math.round(box.width * globalScale), height: Math.round(box.height * globalScale), kernel: sharp.kernel.lanczos3 }).png().toBuffer();
    const m = await sharp(cropped).metadata();
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, left: Math.round((size - m.width) / 2), top: Math.max(0, 500 - m.height) }])
      .png({ compressionLevel: 9 }).toFile(path.join(outputRoot, state, `frame${index}.png`));
  }));
}

for (const state of states) await processState(state);
console.log(`Processed ${states.length * 8} Macaco de Esporos frames with a global body scale.`);
