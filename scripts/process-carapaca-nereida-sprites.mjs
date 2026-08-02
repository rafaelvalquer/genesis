import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const states = ["idle", "moveLand", "moveWater", "attackClaw", "shellGuard", "death", "spawnEmerge"];
const sourceRoot = path.join(root, "art", "source", "carapacaNereida");
const outputRoot = path.join(root, "src", "game", "assets", "enemy", "carapacaNereida");
const sheetRoot = path.join(root, "art", "spritesheets", "carapacaNereida");
const transparent = "#00000000";

function removeMagenta({ data, info }) {
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = data.subarray(i, i + 3);
    if (r > 185 && b > 130 && g < 110 && r - g > 100) data[i + 3] = 0;
  }
  return { data, info };
}

async function normalize(source) {
  const raw = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = removeMagenta(raw);
  let left = keyed.info.width, top = keyed.info.height, right = -1, bottom = -1;
  for (let y = 0; y < keyed.info.height; y += 1) for (let x = 0; x < keyed.info.width; x += 1) {
    if (keyed.data[(y * keyed.info.width + x) * 4 + 3] < 26) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error(`Empty source: ${source}`);
  const crop = await sharp(keyed.data, { raw: keyed.info }).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(224, 212, { fit: "inside", kernel: "nearest" }).png().toBuffer();
  const meta = await sharp(crop).metadata();
  return sharp({ create: { width: 256, height: 256, channels: 4, background: transparent } })
    .composite([{ input: crop, left: Math.round((256 - meta.width) / 2), top: 237 - meta.height }]).png({ palette: true }).toBuffer();
}

for (const state of states) {
  const sourceDir = path.join(sourceRoot, state);
  const names = (await fs.readdir(sourceDir)).filter((name) => /^frame[0-7]\.png$/.test(name)).sort();
  if (names.length !== 8) throw new Error(`${state} must have exactly eight source frames`);
  const frames = await Promise.all(names.map((name) => normalize(path.join(sourceDir, name))));
  const signatures = new Set(frames.map((frame) => frame.toString("base64")));
  if (signatures.size < 7) throw new Error(`${state} contains repeated source frames`);
  const destination = path.join(outputRoot, state);
  await fs.mkdir(destination, { recursive: true });
  await Promise.all(frames.map((frame, index) => fs.writeFile(path.join(destination, `frame${index}.png`), frame)));
  await fs.mkdir(sheetRoot, { recursive: true });
  await sharp({ create: { width: 2048, height: 256, channels: 4, background: transparent } })
    .composite(frames.map((input, index) => ({ input, left: index * 256, top: 0 }))).png({ palette: true })
    .toFile(path.join(sheetRoot, `carapaca-nereida-${state}.png`));
}
