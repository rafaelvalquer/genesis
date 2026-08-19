import path from "node:path";
import sharp from "sharp";

const folder = path.resolve("src/game/assets-source/enemy/colossoCaldeira/death");
const frame = (index) => path.join(folder, `frame${index}.png`);

async function halfway(left, right, destination) {
  const [leftBuffer, rightBuffer] = await Promise.all([sharp(left).png().toBuffer(), sharp(right).png().toBuffer()]);
  await sharp({ create: { width: 768, height: 768, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: leftBuffer, blend: "over", opacity: .5 },
      { input: rightBuffer, blend: "over", opacity: .5 },
    ])
    .png().toFile(destination);
}

// The authored sheet contains the key poses in its even cells. Synthesize the
// in-betweens here rather than duplicating a frame: this changes neither the
// root nor the baked state scale.
for (const index of [1, 3, 5, 7, 9]) await halfway(frame(index - 1), frame(index + 1), frame(index));

for (const [index, brightness] of [[10, .90], [11, .80], [12, .70]]) {
  await sharp(frame(8)).modulate({ brightness }).png().toFile(frame(index));
}
await sharp(frame(12)).png().toFile(frame(13)); // explicit inert final hold
console.log("Interpolated the 14-frame Colosso death sequence.");
