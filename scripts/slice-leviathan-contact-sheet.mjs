import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { analyzeLeviathanComponents } from "./leviathan-sprite-components.mjs";

const [state, input] = process.argv.slice(2);
if (!state || !input) throw new Error("Uso: node scripts/slice-leviathan-contact-sheet.mjs <estado> <sheet.png>");
const layout = { columns: 4, rows: 2, gutterX: 0, gutterY: 0, outerMarginX: 0, outerMarginY: 0, innerSafeInset: 10 };
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "art", "source", "leviathanNereida", state);
const metadata = await sharp(input).metadata();
const contentWidth = metadata.width - layout.outerMarginX * 2 - layout.gutterX * (layout.columns - 1);
const contentHeight = metadata.height - layout.outerMarginY * 2 - layout.gutterY * (layout.rows - 1);
if (!metadata.width || !metadata.height || contentWidth % layout.columns || contentHeight % layout.rows) throw new Error(`Folha inválida (${metadata.width}×${metadata.height}) para o layout configurado; ajuste gutters/margens explicitamente.`);
const cellWidth = contentWidth / layout.columns; const cellHeight = contentHeight / layout.rows;
await mkdir(root, { recursive: true });
for (let frame = 0; frame < 8; frame += 1) {
  const left = layout.outerMarginX + (frame % layout.columns) * (cellWidth + layout.gutterX) + layout.innerSafeInset;
  const top = layout.outerMarginY + Math.floor(frame / layout.columns) * (cellHeight + layout.gutterY) + layout.innerSafeInset;
  const width = cellWidth - layout.innerSafeInset * 2; const height = cellHeight - layout.innerSafeInset * 2;
  const { data, info } = await sharp(input).ensureAlpha().extract({ left, top, width, height }).raw().toBuffer({ resolveWithObject: true });
  const analysis = analyzeLeviathanComponents(data, info.width, info.height);
  if (!analysis.main) throw new Error(`Frame ${frame} está vazio.`);
  const main = analysis.main; const cropped = Buffer.alloc(info.width * info.height * 4);
  for (const pixel of main.pixels) data.copy(cropped, pixel * 4, pixel * 4, pixel * 4 + 4);
  const crop = { left: main.left, top: main.top, width: main.width, height: main.height };
  await sharp(cropped, { raw: info }).extract(crop).resize(464, 464, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(join(root, `frame${frame}.png`));
}
console.log(`Recortados 8 frames de ${basename(input)} para ${state}, preservando proporção e mantendo somente o componente principal.`);
