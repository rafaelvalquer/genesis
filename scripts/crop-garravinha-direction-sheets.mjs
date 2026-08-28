import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("art/qa/remaster");
const outputRoot = path.join(root, "garravinha-generated-frames");
const states = {
  idle: 8,
  walking: 8,
  attack: 8,
  latchPrep: 6,
  latchLeap: 6,
  latched: 8,
  death: 8,
};
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

function removeLightMatte(rgb, width, height) {
  const rgba = Buffer.alloc((rgb.length / 3) * 4);
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < rgb.length; sourceIndex += 3, targetIndex += 4) {
    const red = rgb[sourceIndex];
    const green = rgb[sourceIndex + 1];
    const blue = rgb[sourceIndex + 2];
    const minimum = Math.min(red, green, blue);
    const maximum = Math.max(red, green, blue);
    const lightMatte = minimum > 170 && maximum - minimum < 35;
    rgba[targetIndex] = red;
    rgba[targetIndex + 1] = green;
    rgba[targetIndex + 2] = blue;
    rgba[targetIndex + 3] = lightMatte ? 0 : 255;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } });
}

function keepLargestSilhouette(buffer, width, height) {
  const seen = new Uint8Array(width * height);
  let largest = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const start = y * width + x;
    if (seen[start] || buffer[start * 4 + 3] <= 20) continue;
    const queue = [start];
    const component = [];
    seen[start] = 1;
    while (queue.length) {
      const current = queue.pop();
      component.push(current);
      const cx = current % width;
      const cy = Math.floor(current / width);
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!seen[next] && buffer[next * 4 + 3] > 20) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Uint8Array(width * height);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (!keep[pixel]) buffer[pixel * 4 + 3] = 0;
  }
}

for (const [state, frameCount] of Object.entries(states)) {
  const sheet = sharp(path.join(root, `garravinha-${state}-direction-sheet.png`));
  const metadata = await sheet.metadata();
  const cellWidth = metadata.width / 8;
  const cellInset = 24;
  const outputDir = path.join(outputRoot, state);
  await mkdir(outputDir, { recursive: true });

  for (let frame = 0; frame < frameCount; frame += 1) {
    const cellLeft = Math.round(frame * cellWidth);
    const cellRight = Math.round((frame + 1) * cellWidth);
    const left = cellLeft + cellInset;
    const width = cellRight - cellLeft - cellInset * 2;
    const cell = await sheet.clone()
      .extract({ left, top: 0, width, height: metadata.height })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cleanCell = await removeLightMatte(cell.data, cell.info.width, cell.info.height)
      .trim({ background: transparent, threshold: 10 })
      .resize(420, 460, { fit: "contain", background: transparent })
      .extend({ top: 26, bottom: 26, left: 46, right: 46, background: transparent })
      .raw()
      .toBuffer({ resolveWithObject: true });
    keepLargestSilhouette(cleanCell.data, cleanCell.info.width, cleanCell.info.height);
    await sharp(cleanCell.data, { raw: { width: cleanCell.info.width, height: cleanCell.info.height, channels: 4 } })
      .png()
      .toFile(path.join(outputDir, `frame${frame}.png`));
  }
}

console.log("Garravinha: 52 frames individuais gerados para validação.");
