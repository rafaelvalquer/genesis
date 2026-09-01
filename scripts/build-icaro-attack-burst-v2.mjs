import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const master = path.resolve("art/source/interceptadorIcaro/master-v2-clean.png");
const output = path.resolve("art/source/interceptadorIcaro/generated/attackBurst-v2");
const qa = path.resolve("art/qa/interceptadorIcaro-v2/attack-burst-full-resolution.png");
const size = 1254;
const recoil = [0, 2, 7, 11, 7, 3, 1, 0];
await fs.mkdir(output, { recursive: true });
const frames = [];
for (let frame = 0; frame < 8; frame += 1) {
  // Lower body is a locked layer. The upper articulated group travels into recoil.
  const lower = await sharp(master).extract({ left: 0, top: 700, width: size, height: size - 700 }).png().toBuffer();
  const upper = await sharp(master).extract({ left: 0, top: 0, width: size, height: 760 }).png().toBuffer();
  const image = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: lower, left: 0, top: 700 }, { input: upper, left: -recoil[frame], top: Math.round(recoil[frame] * .16) }])
    .png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 }).toBuffer();
  await fs.writeFile(path.join(output, `frame${frame}.png`), image); frames.push(image);
}
await sharp({ create: { width: size * 8, height: size, channels: 4, background: { r: 20, g: 22, b: 30, alpha: 1 } } })
  .composite(frames.map((input, frame) => ({ input, left: frame * size, top: 0 }))).png().toFile(qa);
