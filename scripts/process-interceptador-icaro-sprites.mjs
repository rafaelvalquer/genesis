import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceRoot = path.resolve("art/sprites/interceptadorIcaro");
const outputRoot = path.resolve("src/game/assets/troop/interceptadorIcaro");
const frameSize = 384;
const safeMargin = 12;
const standingHeight = 327;
const standingStates = new Set([
  "idle",
  "attackBurst",
  "interceptionLock",
  "interceptionFire",
  "interceptionFireUp",
  "interceptionFireDown",
  "paralyzed",
]);
const states = [
  "idle",
  "attackBurst",
  "interceptionLock",
  "interceptionFire",
  "interceptionFireUp",
  "interceptionFireDown",
  "paralyzed",
  "death",
];

function removeStrayComponents(data, width, height, channels) {
  const opaque = new Uint8Array(width * height);
  for (let index = 0; index < opaque.length; index += 1) {
    opaque[index] = data[index * channels + 3] >= 8 ? 1 : 0;
  }
  const visited = new Uint8Array(opaque.length);
  const components = [];
  const queue = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const seed = y * width + x;
      if (!opaque[seed] || visited[seed]) continue;
      visited[seed] = 1;
      queue.length = 0;
      queue.push(seed);
      const pixels = [];
      let left = x; let right = x; let top = y; let bottom = y;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        const cx = current % width;
        const cy = Math.floor(current / width);
        pixels.push(current);
        left = Math.min(left, cx); right = Math.max(right, cx);
        top = Math.min(top, cy); bottom = Math.max(bottom, cy);
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
          if (opaque[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
        }
      }
      components.push({ pixels, left, right, top, bottom, area: pixels.length });
    }
  }
  components.sort((a, b) => b.area - a.area);
  const main = components[0];
  if (!main) throw new Error("Quadro sem componente principal.");
  for (const component of components.slice(1)) {
    const gapX = Math.max(main.left - component.right, component.left - main.right, 0);
    const gapY = Math.max(main.top - component.bottom, component.top - main.bottom, 0);
    const edgeStray = component.area < 800
      && (component.left < 12 || component.right >= width - 12);
    if (edgeStray || !(component.area >= 48 && Math.hypot(gapX, gapY) <= 18)) {
      for (const pixel of component.pixels) data[pixel * channels + 3] = 0;
    }
  }
}

function alphaBounds(data, width, height, channels, threshold = 8) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alphaIndex = (y * width + x) * channels + 3;
      if (data[alphaIndex] < threshold) {
        data[alphaIndex] = 0;
        continue;
      }
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("Quadro sem pixels visíveis.");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function footRootX(data, width, height, channels) {
  const bandTop = Math.max(0, height - Math.ceil(height * 0.14));
  let left = width;
  let right = -1;
  for (let y = bandTop; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * channels + 3] < 48) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return right >= left ? (left + right) / 2 : width / 2;
}

async function normalizeStanding(source) {
  const decoded = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeStrayComponents(decoded.data, decoded.info.width, decoded.info.height, decoded.info.channels);
  const bounds = alphaBounds(
    decoded.data,
    decoded.info.width,
    decoded.info.height,
    decoded.info.channels,
  );
  const cropped = sharp(decoded.data, { raw: decoded.info }).extract(bounds);
  const resized = await cropped
    .resize({
      width: frameSize - safeMargin * 2,
      height: standingHeight,
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 0.55 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rootX = footRootX(
    resized.data,
    resized.info.width,
    resized.info.height,
    resized.info.channels,
  );
  const left = Math.max(
    safeMargin,
    Math.min(frameSize - safeMargin - resized.info.width, Math.round(frameSize / 2 - rootX)),
  );
  const top = frameSize - safeMargin - resized.info.height;
  return sharp({
    create: {
      width: frameSize,
      height: frameSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{
    input: resized.data,
    raw: resized.info,
    left,
    top,
  }]);
}

async function normalizeDeath(source, frame) {
  if (frame === 0) return normalizeStanding(source);
  const decoded = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeStrayComponents(decoded.data, decoded.info.width, decoded.info.height, decoded.info.channels);
  const bounds = alphaBounds(
    decoded.data,
    decoded.info.width,
    decoded.info.height,
    decoded.info.channels,
  );
  const resized = await sharp(decoded.data, { raw: decoded.info })
    .extract(bounds)
    .resize({
      width: frameSize - safeMargin * 2,
      height: frameSize - safeMargin * 2,
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 0.55 })
    .png()
    .toBuffer();
  const metadata = await sharp(resized).metadata();
  return sharp({
    create: {
      width: frameSize,
      height: frameSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{
    input: resized,
    left: Math.round((frameSize - metadata.width) / 2),
    top: frameSize - safeMargin - metadata.height,
  }]);
}

async function validateMargin(buffer, state, frame) {
  const decoded = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= safeMargin && x < width - safeMargin && y >= safeMargin && y < height - safeMargin) continue;
      if (decoded.data[(y * width + x) * channels + 3] > 3) {
        throw new Error(`${state}/frame${frame}.png contém pixels fora da margem segura.`);
      }
    }
  }
}

if (!outputRoot.endsWith(path.join("assets", "troop", "interceptadorIcaro"))) {
  throw new Error(`Pasta de destino inesperada: ${outputRoot}`);
}

for (const state of states) {
  const folder = path.join(outputRoot, state);
  await fs.rm(folder, { recursive: true, force: true });
  await fs.mkdir(folder, { recursive: true });
  for (let frame = 0; frame < 8; frame += 1) {
    const source = path.join(sourceRoot, state, `frame${frame}.png`);
    const metadata = await sharp(source).metadata();
    if (!metadata.width || !metadata.height || metadata.channels !== 4) {
      throw new Error(`${source} precisa ser um PNG RGBA individual.`);
    }
    const image = standingStates.has(state)
      ? await normalizeStanding(source)
      : await normalizeDeath(source, frame);
    const output = await image
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        effort: 10,
        palette: false,
      })
      .toBuffer();
    await validateMargin(output, state, frame);
    await fs.writeFile(path.join(folder, `frame${frame}.png`), output);
  }
}

console.log(`64 sprites individuais e alinhados do Interceptador Ícaro gerados em ${outputRoot}`);
