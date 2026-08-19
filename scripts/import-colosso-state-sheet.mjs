import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sheets = {
  slamTelegraph: ["exec-30abf1ad-f5f8-4a47-8458-d6e04bbe9190.png", 3, 2, 6],
  slamAttack: ["exec-4fbb553f-be63-4a93-ac06-67c775ac6305.png", 4, 2, 8],
  finalCollapse: ["exec-bc28a4ec-0ebc-4b81-9336-c6fc4a0d7223.png", 4, 3, 12],
};
const state = process.argv[2];
const spec = sheets[state];
if (!spec) throw new Error(`Unknown Colosso state: ${state}`);
const [file, columns, rows, frames] = spec;
const sheet = `C:/Users/Z565244/.codex/generated_images/01a0118b-4554-7b61-97d6-81b8d6f707c2/${file}`;
const folder = path.resolve("src/game/assets-source/enemy/colossoCaldeira", state);
const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
await fs.mkdir(folder, { recursive: true });
for (let frame = 0; frame < frames; frame += 1) {
  const column = frame % columns; const row = Math.floor(frame / columns);
  const left = Math.floor(column * info.width / columns); const top = Math.floor(row * info.height / rows);
  const right = Math.floor((column + 1) * info.width / columns); const bottom = Math.floor((row + 1) * info.height / rows);
  await sharp(data, { raw: info }).extract({ left, top, width: right - left, height: bottom - top }).png().toFile(path.join(folder, `frame${frame}.png`));
}
console.log(`Imported clean ${state} sheet.`);
