import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('src/game/assets/enemy/garravinha/latchPrep');
const output = path.resolve('art/qa/remaster/garravinha-latch-prep-v2-preview.png');
const cellSize = 256;

const frames = await Promise.all(
  Array.from({ length: 6 }, async (_, index) => ({
    input: await sharp(path.join(root, `frame${index}.png`))
      .resize(cellSize, cellSize, { fit: 'contain' })
      .png()
      .toBuffer(),
    left: index * cellSize,
    top: 0,
  })),
);

await sharp({
  create: {
    width: cellSize * frames.length,
    height: cellSize,
    channels: 4,
    background: '#08111d',
  },
})
  .composite(frames)
  .png()
  .toFile(output);

console.log(`Prévia criada: ${output}`);
