import sharp from "sharp";

async function blend(target, reference, targetWeight = .6) {
  const [a, b] = await Promise.all([
    sharp(target).ensureAlpha().resize(768, 768).raw().toBuffer({ resolveWithObject: true }),
    sharp(reference).ensureAlpha().resize(768, 768).raw().toBuffer({ resolveWithObject: true }),
  ]);
  // Sheets use chroma green before the normal asset pipeline removes it.  A
  // direct RGBA interpolation leaks that green into semi-transparent pixels,
  // producing a large green "ghost" in game. Clear chroma first and blend in
  // premultiplied-alpha space instead.
  const clearChroma = (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const [red, green, blue] = data.subarray(i, i + 3);
      if (green > 145 && green > red * 1.22 && green > blue * 1.22) {
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
      }
    }
  };
  clearChroma(a.data);
  clearChroma(b.data);
  const referenceWeight = 1 - targetWeight;
  for (let i = 0; i < a.data.length; i += 4) {
    const alphaA = a.data[i + 3] / 255;
    const alphaB = b.data[i + 3] / 255;
    const alpha = alphaA * targetWeight + alphaB * referenceWeight;
    if (alpha <= 0) {
      a.data[i] = a.data[i + 1] = a.data[i + 2] = a.data[i + 3] = 0;
      continue;
    }
    for (let channel = 0; channel < 3; channel += 1) {
      a.data[i + channel] = Math.round((a.data[i + channel] * alphaA * targetWeight + b.data[i + channel] * alphaB * referenceWeight) / alpha);
    }
    a.data[i + 3] = Math.round(alpha * 255);
  }
  await sharp(a.data, { raw: a.info }).png().toFile(target);
}

const root = "src/game/assets-source/enemy/colossoCaldeira";
await blend(`${root}/phaseTransition3/frame3.png`, `${root}/phaseTransition3/frame2.png`, .35);
await blend(`${root}/phaseTransition3/frame4.png`, `${root}/phaseTransition3/frame3.png`, .65);
await blend(`${root}/phaseTransition3/frame8.png`, `${root}/phaseTransition3/frame7.png`, .35);
await blend(`${root}/phaseTransition3/frame9.png`, `${root}/idle/frame0.png`, .25);
