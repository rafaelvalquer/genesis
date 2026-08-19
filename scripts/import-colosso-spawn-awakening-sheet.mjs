import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sheet = "C:/Users/Z565244/.codex/generated_images/01a0118b-4554-7b61-97d6-81b8d6f707c2/exec-de523d18-f6b9-4eb7-ab86-84371c6acfbf.png";
const folder = path.resolve("src/game/assets-source/enemy/colossoCaldeira/spawnAwakening");
const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
await fs.mkdir(folder, { recursive: true });
for (let frame = 0; frame < 12; frame += 1) {
  const column = frame % 4; const row = Math.floor(frame / 4);
  const left = Math.floor(column * info.width / 4); const top = Math.floor(row * info.height / 3);
  const right = Math.floor((column + 1) * info.width / 4); const bottom = Math.floor((row + 1) * info.height / 3);
  await sharp(data, { raw: info }).extract({ left, top, width: right - left, height: bottom - top }).png().toFile(path.join(folder, `frame${frame}.png`));
}
console.log("Imported clean Spawn Awakening sheet.");
