import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const folder = path.resolve("src/game/assets-source/enemy/colossoCaldeira/death");
const cellSize = 768;
const inputs = await Promise.all(Array.from({ length: 14 }, (_, frame) => sharp(path.join(folder, `frame${frame}.png`)).ensureAlpha().png().toBuffer()));
const transparent = await sharp({ create: { width: cellSize, height: cellSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
const composites = inputs.map((input, frame) => ({ input, left: (frame % 4) * cellSize, top: Math.floor(frame / 4) * cellSize }));
composites.push({ input: transparent, left: 2 * cellSize, top: 3 * cellSize });
composites.push({ input: transparent, left: 3 * cellSize, top: 3 * cellSize });
await sharp({ create: { width: cellSize * 4, height: cellSize * 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(path.join(folder, "sheet.png"));
console.log("Rebuilt the 4x4 Colosso death sheet with transparent cells 14 and 15.");
