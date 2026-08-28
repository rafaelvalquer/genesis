import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error("Uso: node scripts/normalize-garravinha-rgba-frame.mjs <source.png> <destination.png>");

const metadata = await sharp(source).metadata();
if (!metadata.hasAlpha || metadata.channels !== 4) throw new Error("O frame precisa ter alpha RGBA real.");

const output = path.resolve(destination);
await mkdir(path.dirname(output), { recursive: true });
await sharp(source)
  .ensureAlpha()
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
  .resize(384, 384, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 64, bottom: 64, left: 64, right: 64, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(output);
console.log(`Frame normalizado: ${output}`);
