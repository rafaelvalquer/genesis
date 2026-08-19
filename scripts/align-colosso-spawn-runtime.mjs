import path from "node:path";
import sharp from "sharp";

const folder = path.resolve("src/game/assets/enemy/colossoCaldeira/spawnAwakening");
for (let frame = 0; frame < 12; frame += 1) {
  const file = path.join(folder, `frame${frame}.png`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) if (data[(y * info.width + x) * info.channels + 3] > 8) maxY = Math.max(maxY, y);
  const dy = 660 - maxY;
  const output = Buffer.alloc(info.width * info.height * info.channels);
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    const targetY = y + dy; if (targetY < 0 || targetY >= info.height) continue;
    const source = (y * info.width + x) * info.channels;
    data.copy(output, (targetY * info.width + x) * info.channels, source, source + info.channels);
  }
  await sharp(output, { raw: info }).png({ palette: true, quality: 46, colours: 48, compressionLevel: 9 }).toFile(file);
}
console.log("Aligned Spawn runtime feet to the canonical ground line.");
