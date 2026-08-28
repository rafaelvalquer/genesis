import path from "node:path";
import sharp from "sharp";

const [sheetPath, expectedFrames = "8"] = process.argv.slice(2);
if (!sheetPath) throw new Error("Uso: node scripts/validate-garravinha-direction-sheet.mjs <sheet.png> [frames]");

const frameCount = Number(expectedFrames);
const image = sharp(sheetPath);
const metadata = await image.metadata();
if (!metadata.width || !metadata.height || metadata.channels !== 4 || !metadata.hasAlpha) {
  throw new Error("REPROVADO: a folha precisa ser PNG RGBA com alpha real.");
}

const cellWidth = metadata.width / frameCount;
const edge = Math.max(12, Math.floor(cellWidth * 0.08));
const failures = [];

for (let frame = 0; frame < frameCount; frame += 1) {
  const left = Math.round(frame * cellWidth);
  const width = Math.round((frame + 1) * cellWidth) - left;
  const { data, info } = await image.clone()
    .extract({ left, top: 0, width, height: metadata.height })
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const occupied = (x, y) => data[(y * info.width + x) * 4 + 3] > 20;
  let edgePixels = 0;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if ((x < edge || y < edge || x >= info.width - edge || y >= info.height - edge) && occupied(x, y)) edgePixels += 1;
  }
  if (edgePixels) failures.push(`frame${frame}: alpha na margem de segurança`);

  const seen = new Uint8Array(info.width * info.height);
  const components = [];
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    const start = y * info.width + x;
    if (seen[start] || !occupied(x, y)) continue;
    const queue = [start]; let size = 0; seen[start] = 1;
    while (queue.length) {
      const current = queue.pop(); size += 1;
      const cx = current % info.width; const cy = Math.floor(current / info.width);
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
        const next = ny * info.width + nx;
        if (!seen[next] && occupied(nx, ny)) { seen[next] = 1; queue.push(next); }
      }
    }
    components.push(size);
  }
  const significant = components.filter((size) => size >= 40);
  if (significant.length !== 1) failures.push(`frame${frame}: ${significant.length} silhuetas significativas`);
}

if (failures.length) throw new Error(`REPROVADO:\n${failures.join("\n")}`);
console.log(`APROVADO: ${path.basename(sheetPath)} — ${frameCount} células isoladas.`);
