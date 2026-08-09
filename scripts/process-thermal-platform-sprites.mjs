import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "tmp", "thermal-platform");
const outputRoot = path.join(root, "src", "game", "assets", "troop", "thermalPlatform");
const states = ["idle", "heated", "critical", "overheat", "destroyed"];

async function audit() {
  const folders = await fs.readdir(outputRoot, { withFileTypes: true });
  const foundStates = folders.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (JSON.stringify(foundStates) !== JSON.stringify([...states].sort())) throw new Error(`Unexpected states: ${foundStates.join(", ")}`);

  const bounds = [];
  for (const state of states) {
    const folder = path.join(outputRoot, state);
    const files = await fs.readdir(folder);
    if (files.length !== 1 || files[0] !== "frame0.png") throw new Error(`${state} must contain only frame0.png`);
    const file = path.join(folder, "frame0.png");
    const metadata = await sharp(file).metadata();
    if (metadata.width !== 512 || metadata.height !== 512 || !metadata.hasAlpha) throw new Error(`${state} must be a 512px PNG with alpha`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = -1, bottom = -1;
    for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
    }
    if (left < 8 || top < 8 || right > 503 || bottom > 503) throw new Error(`${state} touches the canvas edge`);
    bounds.push({ state, left, top, width: right - left + 1, height: bottom - top + 1 });
  }
  const widths = bounds.map((entry) => entry.width);
  const heights = bounds.map((entry) => entry.height);
  if (Math.max(...widths) - Math.min(...widths) > 70 || Math.max(...heights) - Math.min(...heights) > 70) throw new Error("State bounding boxes are inconsistent");
  console.log(JSON.stringify({ thermalPlatform: { states, bounds } }, null, 2));
}

async function main() {
  await fs.rm(outputRoot, { recursive: true, force: true });

  for (const state of states) {
    const input = path.join(sourceRoot, `${state}.png`);
    const output = path.join(outputRoot, state, "frame0.png");
    await fs.mkdir(path.dirname(output), { recursive: true });
    await sharp(input).resize(512, 512, { fit: "fill" }).png().toFile(output);
  }

  const images = await Promise.all(states.map(async (state) => sharp(path.join(outputRoot, state, "frame0.png")).png().toBuffer()));
  const labels = states.map((state, index) => ({
    input: Buffer.from(`<svg width="512" height="30"><text x="256" y="21" fill="#e5e7eb" font-family="Arial" font-size="16" font-weight="bold" text-anchor="middle">${state.toUpperCase()}</text></svg>`),
    left: index * 512,
    top: 0,
  }));
  await sharp({ create: { width: 2560, height: 542, channels: 4, background: { r: 28, g: 31, b: 38, alpha: 1 } } })
    .composite([...images.map((input, index) => ({ input, left: index * 512, top: 30 })), ...labels])
    .png()
    .toFile(path.join(root, "art", "thermal-platform-states.png"));

  const gameSizeImages = await Promise.all(images.map(async (input) => sharp(input).resize(92, 92).png().toBuffer()));
  await sharp({ create: { width: 580, height: 120, channels: 4, background: { r: 28, g: 31, b: 38, alpha: 1 } } })
    .composite(gameSizeImages.map((input, index) => ({ input, left: index * 116 + 12, top: 14 })))
    .png()
    .toFile(path.join(root, "art", "thermal-platform-game-size.png"));

  await audit();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
