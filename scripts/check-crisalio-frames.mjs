import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..", "src", "game", "assets", "enemy", "crisalio");
const STATES = ["idle", "walking", "attack", "pulse"];

function bounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 20) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { width: maxX - minX + 1, height: maxY - minY + 1, bottom: maxY };
}

for (const state of STATES) {
  const directory = path.join(ROOT, state);
  const files = (await fs.readdir(directory)).filter((file) => /^frame\d+\.png$/.test(file));
  if (files.length !== 8) throw new Error(`${state}: esperados 8 frames; encontrados ${files.length}.`);
  const metrics = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const file = path.join(directory, `frame${frame}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 256 || info.height !== 256 || info.channels !== 4) {
      throw new Error(`${state}/frame${frame}: esperado PNG RGBA 256x256.`);
    }
    const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
    if (corners.some((index) => data[index * 4 + 3] !== 0)) {
      throw new Error(`${state}/frame${frame}: cantos precisam ser transparentes.`);
    }
    metrics.push(bounds(data, info.width, info.height));
  }
  const bottoms = metrics.map(({ bottom }) => bottom);
  if (Math.max(...bottoms) - Math.min(...bottoms) > 1) throw new Error(`${state}: eixo de chão oscila.`);
  if (["idle", "walking"].includes(state)) {
    const heights = metrics.map(({ height }) => height);
    const widths = metrics.map(({ width }) => width);
    const maxHeightVariation = state === "walking" ? 8 : 4;
    const maxWidthVariation = state === "walking" ? 42 : 4;
    if (
      Math.max(...heights) - Math.min(...heights) > maxHeightVariation ||
      Math.max(...widths) - Math.min(...widths) > maxWidthVariation
    ) {
      throw new Error(`${state}: escala do ciclo varia além da tolerância.`);
    }
  }
  console.log(`${state}: 8 PNGs válidos, raiz estável em y=${bottoms[0]}`);
}
