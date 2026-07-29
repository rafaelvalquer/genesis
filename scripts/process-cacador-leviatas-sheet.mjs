import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const manifestPath = path.join(root, "art", "sprites", "cacadorLeviatas", "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const destination = path.join(root, "src", "game", "assets", "troop", "cacadorLeviatas");
const measurementsPath = path.join(root, "art", "sprites", "cacadorLeviatas", "measurements.json");
const qaPath = path.join(root, "art", "sprites", "cacadorLeviatas", "qa-montage.png");
const gameSizeQaPath = path.join(root, "art", "sprites", "cacadorLeviatas", "qa-montage-game-size.png");

const CANVAS = 512;
const SAFE_MARGIN = 24;
const CONTENT_SIZE = CANVAS - SAFE_MARGIN * 2;
const MAGENTA = { r: 255, g: 0, b: 255 };

function removeChroma(data, info) {
  const output = Buffer.from(data);
  for (let offset = 0; offset < output.length; offset += info.channels) {
    const r = output[offset];
    const g = output[offset + 1];
    const b = output[offset + 2];
    const distance = Math.hypot(r - MAGENTA.r, g - MAGENTA.g, b - MAGENTA.b);
    const magentaDominance = Math.min(r, b) - g;

    let alpha = 255;
    if (distance <= 42 || (magentaDominance > 118 && r > 178 && b > 178)) {
      alpha = 0;
    } else if (distance < 112 && magentaDominance > 48) {
      alpha = Math.round(255 * (distance - 42) / 70);
    }

    output[offset + 3] = Math.min(output[offset + 3], Math.max(0, alpha));
    if (output[offset + 3] < 10) {
      output[offset] = 0;
      output[offset + 1] = 0;
      output[offset + 2] = 0;
      output[offset + 3] = 0;
    } else if (magentaDominance > 34) {
      const spill = Math.min(80, magentaDominance - 34);
      output[offset] = Math.max(g, r - spill);
      output[offset + 2] = Math.max(g, b - spill);
    }
  }
  return output;
}

function opaqueBounds(data, info, alphaThreshold = 16) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  let count = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset + 3] <= alphaThreshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      count += 1;
    }
  }
  if (right < left || bottom < top) throw new Error("Quadro sem personagem após remoção do chroma-key.");
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, count };
}

function findMuzzle(data, info, bounds) {
  const cyan = [];
  const minX = Math.round(bounds.left + bounds.width * 0.48);
  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    for (let x = minX; x <= bounds.right; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const [r, g, b, a] = data.subarray(offset, offset + 4);
      if (a > 80 && g > 145 && b > 150 && g > r * 1.2 && b > r * 1.2) cyan.push({ x, y });
    }
  }
  if (!cyan.length) return null;
  cyan.sort((a, b) => a.x - b.x);
  const openingBand = cyan.slice(0, Math.max(1, Math.ceil(cyan.length * 0.12)));
  return {
    x: Number((openingBand.reduce((sum, point) => sum + point.x, 0) / openingBand.length / CANVAS).toFixed(4)),
    y: Number((openingBand.reduce((sum, point) => sum + point.y, 0) / openingBand.length / CANVAS).toFixed(4)),
  };
}

function findFootAnchor(data, info, bounds) {
  const bandTop = Math.round(bounds.bottom - bounds.height * 0.22);
  const columns = new Array(info.width).fill(0);
  for (let y = bandTop; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      if (data[offset + 3] > 64) columns[x] += 1;
    }
  }
  const activeColumns = columns
    .map((count, x) => ({ count, x }))
    .filter(({ count }) => count >= 3)
    .map(({ x }) => x);
  if (!activeColumns.length) throw new Error("Não foi possível medir a posição dos pés.");
  return {
    x: Number(((activeColumns[0] + activeColumns.at(-1)) / 2 / CANVAS).toFixed(4)),
    y: Number((bounds.bottom / CANVAS).toFixed(4)),
  };
}

const measurements = {
  generatedAt: new Date().toISOString(),
  canvas: { width: CANVAS, height: CANVAS, safeMargin: SAFE_MARGIN },
  frames: {},
};
const montageInputs = [];
const gameSizeMontageInputs = [];

for (const entry of manifest.frames) {
  const source = path.join(root, entry.source);
  const stateDirectory = path.join(destination, entry.state);
  const outputPath = path.join(stateDirectory, `frame${entry.frame}.png`);
  await fs.mkdir(stateDirectory, { recursive: true });

  const decoded = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (decoded.info.width !== 1024 || decoded.info.height !== 1024) {
    throw new Error(`${entry.id}: fonte deve ter exatamente 1024x1024.`);
  }
  const keyed = removeChroma(decoded.data, decoded.info);
  const sourceBounds = opaqueBounds(keyed, decoded.info);
  const scale = Math.min(CONTENT_SIZE / sourceBounds.width, CONTENT_SIZE / sourceBounds.height);
  const targetWidth = Math.max(1, Math.round(sourceBounds.width * scale));
  const targetHeight = Math.max(1, Math.round(sourceBounds.height * scale));
  const left = Math.round((CANVAS - targetWidth) / 2);
  const top = CANVAS - SAFE_MARGIN - targetHeight;

  const cropped = await sharp(keyed, { raw: decoded.info })
    .extract({
      left: sourceBounds.left,
      top: sourceBounds.top,
      width: sourceBounds.width,
      height: sourceBounds.height,
    })
    .resize(targetWidth, targetHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: cropped, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
    .toFile(outputPath);

  const finalImage = await sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = opaqueBounds(finalImage.data, finalImage.info);
  if (
    bounds.left < SAFE_MARGIN - 1
    || bounds.top < SAFE_MARGIN - 1
    || bounds.right > CANVAS - SAFE_MARGIN
    || bounds.bottom > CANVAS - SAFE_MARGIN
  ) {
    throw new Error(`${entry.id}: conteúdo fora da margem segura.`);
  }

  const key = `${entry.state}/frame${entry.frame}`;
  measurements.frames[key] = {
    bounds,
    center: {
      x: Number(((bounds.left + bounds.right) / 2 / CANVAS).toFixed(4)),
      y: Number(((bounds.top + bounds.bottom) / 2 / CANVAS).toFixed(4)),
    },
    feet: Number((bounds.bottom / CANVAS).toFixed(4)),
    anchor: findFootAnchor(finalImage.data, finalImage.info, bounds),
    muzzle: findMuzzle(finalImage.data, finalImage.info, bounds),
  };
  montageInputs.push({ input: outputPath, left: entry.frame * CANVAS, top: manifest.states.indexOf(entry.state) * CANVAS });
  gameSizeMontageInputs.push({
    input: await sharp(outputPath).resize(148, 148, { fit: "fill" }).png().toBuffer(),
    left: entry.frame * 148,
    top: manifest.states.indexOf(entry.state) * 148,
  });
}

await sharp({
  create: {
    width: CANVAS * 8,
    height: CANVAS * manifest.states.length,
    channels: 4,
    background: { r: 24, g: 21, b: 32, alpha: 1 },
  },
})
  .composite(montageInputs)
  .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
  .toFile(qaPath);

await sharp({
  create: {
    width: 148 * 8,
    height: 148 * manifest.states.length,
    channels: 4,
    background: { r: 24, g: 21, b: 32, alpha: 1 },
  },
})
  .composite(gameSizeMontageInputs)
  .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 })
  .toFile(gameSizeQaPath);

await fs.writeFile(measurementsPath, `${JSON.stringify(measurements, null, 2)}\n`);
console.log(`Caçador de Leviatãs: ${manifest.frames.length} fontes individuais processadas em 512x512.`);
console.log(`Medições: ${path.relative(root, measurementsPath)}`);
console.log(`Montagem QA: ${path.relative(root, qaPath)}`);
console.log(`Montagem QA em tamanho de jogo: ${path.relative(root, gameSizeQaPath)}`);
