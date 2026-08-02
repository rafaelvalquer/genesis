import { mkdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const [state, input] = process.argv.slice(2);
if (!state || !input) throw new Error("Uso: node scripts/slice-leviathan-contact-sheet.mjs <estado> <sheet.png>");
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "art", "source", "leviathanNereida", state);
const sheetWidth = 1536; const sheetHeight = 1024;
const cellWidth = sheetWidth / 4; const cellHeight = sheetHeight / 2;
await mkdir(root, { recursive: true });
for (let frame = 0; frame < 8; frame += 1) {
  const left = (frame % 4) * cellWidth; const top = Math.floor(frame / 4) * cellHeight;
  const { data, info } = await sharp(input).resize(sheetWidth, sheetHeight, { fit: "fill" }).extract({ left, top, width: cellWidth, height: cellHeight }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width; let minY = info.height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * 4 + 3] < 8) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < 0) throw new Error(`Frame ${frame} está vazio após remover o chroma.`);
  await sharp(data, { raw: info }).extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize(464, 468, { fit: "fill", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 24, bottom: 20, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(join(root, `frame${frame}.png`));
}
console.log(`Recortados 8 frames de ${basename(input)} para ${state}.`);
