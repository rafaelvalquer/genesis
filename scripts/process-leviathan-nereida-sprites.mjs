import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../src/game/assets/enemy/leviathanNereida/", import.meta.url);
const states = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
if (states.includes("hit")) throw new Error("Leviatã não pode declarar animação hit.");
if (states.length !== 17) throw new Error(`Esperados 17 estados, recebidos ${states.length}.`);
for (const state of states) {
  const folder = new URL(`${state}/`, root);
  const files = (await readdir(folder)).filter((file) => /^frame[0-7]\.png$/.test(file)).sort();
  if (files.length !== 8) throw new Error(`${state}: requer 8 frames.`);
  const hashes = new Set();
  for (const file of files) {
    const path = join(fileURLToPath(folder), file);
    const bytes = await readFile(path);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
    const { width, height, channels, hasAlpha } = await sharp(path).metadata();
    if (width !== 512 || height !== 512 || channels !== 4 || !hasAlpha) throw new Error(`${state}/${file}: PNG RGBA 512×512 exigido.`);
    const corners = await sharp(path).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    if (corners[3] !== 0) throw new Error(`${state}/${file}: canto superior esquerdo deve ser transparente.`);
  }
  if (hashes.size < 7) throw new Error(`${state}: menos de sete poses diferentes.`);
}
console.log(`Leviatã validado: ${states.length} estados, 8 poses RGBA por estado.`);
