import sharp from "sharp";

const runtimeRoot = "src/game/assets/enemy/colossoCaldeira/spawnAwakening";

async function interpolate(output, first, second, firstWeight) {
  const [a, b] = await Promise.all([
    sharp(first).ensureAlpha().resize(768, 768).raw().toBuffer({ resolveWithObject: true }),
    sharp(second).ensureAlpha().resize(768, 768).raw().toBuffer({ resolveWithObject: true }),
  ]);
  for (let offset = 0; offset < a.data.length; offset += 1) {
    a.data[offset] = Math.round(a.data[offset] * firstWeight + b.data[offset] * (1 - firstWeight));
  }
  await sharp(a.data, { raw: a.info }).png().toFile(output);
}

// The generated sheet clipped the head in cels 4–5 and 8–11. Rebuild each
// damaged cel directly in runtime space, so all poses retain the same canvas,
// scale, baseline and transparent padding as their intact neighbours.
const early = `${runtimeRoot}/frame3.png`;
// Frame 11 is the intact settled pose; cels 6–10 contain sheet-edge residue.
const awakened = `${runtimeRoot}/frame11.png`;
await interpolate(`${runtimeRoot}/frame4.png`, early, awakened, .66);
await interpolate(`${runtimeRoot}/frame5.png`, early, awakened, .34);
await interpolate(`${runtimeRoot}/frame6.png`, early, awakened, .5);
await interpolate(`${runtimeRoot}/frame7.png`, early, awakened, .75);
await interpolate(`${runtimeRoot}/frame8.png`, early, awakened, .55);
await interpolate(`${runtimeRoot}/frame9.png`, early, awakened, .35);
await interpolate(`${runtimeRoot}/frame10.png`, early, awakened, .15);
