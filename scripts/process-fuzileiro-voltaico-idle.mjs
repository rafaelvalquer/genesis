import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const outputDir = "src/game/assets/troop/fuzileiroVoltaico/idle";
const source = `${outputDir}/frame0.png`;
const canvas = 512;
const floorY = 504;
const scales = [1, 1.006, 1.012, 1.006, 1, 0.994, 0.988, 0.994];

await mkdir(outputDir, { recursive: true });
const trimmed = await sharp(source)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
  .png()
  .toBuffer();
const metadata = await sharp(trimmed).metadata();

for (const [frame, scale] of scales.entries()) {
  const width = Math.round(metadata.width * scale);
  const height = Math.round(metadata.height * scale);
  const subject = await sharp(trimmed).resize(width, height, { kernel: "lanczos3" }).png().toBuffer();
  await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: subject,
      left: Math.round((canvas - width) / 2),
      top: floorY - height,
    }])
    .png()
    .toFile(`${outputDir}/frame${frame}.png`);
}
