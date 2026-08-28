import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Uso: node scripts/apply-garravinha-atlas.mjs <atlas.png>");

const root = path.resolve("src/game/assets/enemy/garravinha");
const atlas = sharp(source);
const metadata = await atlas.metadata();
const columns = 8;
const rows = 7;
if (metadata.width !== 1536 || metadata.height !== 1024) {
  throw new Error(`Atlas inesperado: ${metadata.width}x${metadata.height}; esperado 1536x1024.`);
}

const states = ["idle", "walking", "attack", "latchPrep", "latchLeap", "latched", "death"];
const cellWidth = metadata.width / columns;
const cellHeight = metadata.height / rows;
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

function removeCheckerboard(rgb, width, height) {
  const rgba = Buffer.alloc((rgb.length / 3) * 4);
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < rgb.length; sourceIndex += 3, targetIndex += 4) {
    const red = rgb[sourceIndex];
    const green = rgb[sourceIndex + 1];
    const blue = rgb[sourceIndex + 2];
    const minimum = Math.min(red, green, blue);
    const maximum = Math.max(red, green, blue);
    const neutral = maximum - minimum < 28;
    const checkerboard = neutral && minimum > 170;
    rgba[targetIndex] = red;
    rgba[targetIndex + 1] = green;
    rgba[targetIndex + 2] = blue;
    rgba[targetIndex + 3] = checkerboard ? 0 : 255;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } });
}

for (let row = 0; row < rows; row += 1) {
  const state = states[row];
  const frameCount = ["latchPrep", "latchLeap"].includes(state) ? 6 : 8;
  const outputDir = path.join(root, state);
  await mkdir(outputDir, { recursive: true });

  for (let frame = 0; frame < frameCount; frame += 1) {
    const left = Math.round(frame * cellWidth);
    const top = Math.round(row * cellHeight);
    const width = Math.round((frame + 1) * cellWidth) - left;
    const height = Math.round((row + 1) * cellHeight) - top;
    const cell = await atlas.clone()
      .extract({ left, top, width, height })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    await removeCheckerboard(cell.data, cell.info.width, cell.info.height)
      .trim({ background: transparent, threshold: 10 })
      .resize(420, 460, { fit: "contain", background: transparent })
      .extend({ top: 26, bottom: 26, left: 46, right: 46, background: transparent })
      .png()
      .toFile(path.join(outputDir, `frame${frame}.png`));
  }
}

console.log(`Garravinha: ${states.reduce((total, state) => total + (["latchPrep", "latchLeap"].includes(state) ? 6 : 8), 0)} frames aplicados.`);
