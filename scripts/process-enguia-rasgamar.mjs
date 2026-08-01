import { access, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/enemy/enguiaRasgamar");
const source = path.resolve("tmp/imagegen/enguia-rasgamar-master.png");
const sheetRoot = path.resolve("tmp/imagegen/enguia-sheets");
const states = [
  "spawnSubmerged", "swimSubmerged", "tideEscape", "rangedEmerge", "rangedCharge", "rangedAttack",
  "surfaceRecovery", "coilEmerge", "coilAttack", "coilRelease", "dive", "hitSurface", "deathSurface", "deathSubmerged",
];

await mkdir(root, { recursive: true });
const exists = async (file) => access(file).then(() => true).catch(() => false);
const removeMagenta = async (input) => {
  const rendered = typeof input?.png === "function" ? await input.png().toBuffer() : input;
  const { data, info } = await sharp(rendered).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let pixel = 0; pixel < data.length; pixel += info.channels) {
    if (data[pixel] > 170 && data[pixel + 1] < 105 && data[pixel + 2] > 145) data[pixel + 3] = 0;
  }
  return sharp(data, { raw: info }).png().toBuffer();
};

const normalizeFrame = async (input, submerged) => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const seen = new Uint8Array(width * height);
  const queue = [];
  const add = (x, y) => {
    const index = y * width + x;
    const offset = index * info.channels;
    if (seen[index] || data[offset + 3] === 0 || data[offset] > 48 || data[offset + 1] > 55 || data[offset + 2] > 68) return;
    seen[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < width; x += 1) { add(x, 0); add(x, height - 1); }
  for (let y = 0; y < height; y += 1) { add(0, y); add(width - 1, y); }
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]; const x = index % width; const y = Math.floor(index / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) add(nx, ny);
    }
  }
  for (const index of queue) data[index * info.channels + 3] = 0;
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (data[(y * width + x) * info.channels + 3] < 20) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < minX) return sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const cropped = await sharp(data, { raw: info }).extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }).png().toBuffer();
  const croppedInfo = await sharp(cropped).metadata();
  const left = Math.round((256 - croppedInfo.width) / 2);
  const top = Math.round((submerged ? 215 : 230) - croppedInfo.height);
  return sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cropped, left, top }]).png().toBuffer();
};

for (const [stateIndex, state] of states.entries()) {
  const folder = path.join(root, state);
  await mkdir(folder, { recursive: true });
  const sheet = path.join(sheetRoot, `${state}.png`);
  const hasSheet = await exists(sheet);
  const sheetInfo = hasSheet ? await sharp(sheet).metadata() : null;
  const frames = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const phase = frame / 8 * Math.PI * 2;
    const submerged = ["spawnSubmerged", "swimSubmerged", "tideEscape", "dive", "deathSubmerged"].includes(state);
    const surface = !submerged;
    const x = Math.round(21 + Math.sin(phase + stateIndex) * (submerged ? 6 : 3));
    const y = Math.round(58 + Math.cos(phase * 2 + stateIndex) * (submerged ? 7 : 3));
    const brightness = state === "rangedCharge" || state === "coilAttack" ? 1.18 + frame * .025 : 1;
    const input = hasSheet
      ? await removeMagenta(sharp(sheet).extract({ left: frame % 4 * Math.floor(sheetInfo.width / 4), top: Math.floor(frame / 4) * Math.floor(sheetInfo.height / 2), width: Math.floor(sheetInfo.width / 4), height: Math.floor(sheetInfo.height / 2) }).resize(300, 300, { fit: "contain" }).extract({ left: 22, top: 22, width: 256, height: 256 }).png())
      : await removeMagenta(sharp(source).resize(214, 142, { fit: "inside", withoutEnlargement: true }).png());
    const aligned = await normalizeFrame(input, submerged);
    const frameImage = sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: await sharp(aligned).modulate({ brightness }).png().toBuffer(), left: 0, top: 0 },
      ]);
    if (submerged) frameImage.tint({ r: 130, g: 235, b: 255 });
    const png = await frameImage.png().toBuffer();
    await sharp(png).toFile(path.join(folder, `frame${frame}.png`));
    frames.push({ input: png, left: frame * 256, top: 0 });
  }
  await sharp({ create: { width: 2048, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames)
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(path.join(root, `enguia_rasgamar_${state.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}.webp`));
}

const unexpected = (await readdir(root)).filter((entry) => entry.endsWith(".png"));
if (unexpected.length) throw new Error(`Unexpected root PNG files: ${unexpected.join(", ")}`);
