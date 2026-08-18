import sharp from "sharp";

const phase = "src/game/assets-source/enemy/colossoCaldeira/phaseTransition3/frame9.png";
const idle = "src/game/assets-source/enemy/colossoCaldeira/idle/frame0.png";
const [a, b] = await Promise.all([
  sharp(phase).ensureAlpha().resize(768, 768).raw().toBuffer({ resolveWithObject: true }),
  sharp(idle).ensureAlpha().resize(768, 768).raw().toBuffer({ resolveWithObject: true }),
]);
for (let i = 0; i < a.data.length; i += 1) {
  // Blend only the final transition pose toward idle. This preserves the
  // aggressive phase while avoiding a visual pop when the state ends.
  a.data[i] = Math.round(a.data[i] * 0.55 + b.data[i] * 0.45);
}
await sharp(a.data, { raw: a.info }).png().toFile(phase);

const seismic = "src/game/assets-source/enemy/colossoCaldeira/seismicAttack/frame7.png";
const [s, i] = await Promise.all([
  sharp(seismic).ensureAlpha().resize(768, 768).raw().toBuffer({ resolveWithObject: true }),
  sharp(idle).ensureAlpha().resize(768, 768).raw().toBuffer({ resolveWithObject: true }),
]);
for (let n = 0; n < s.data.length; n += 1) s.data[n] = Math.round(s.data[n] * 0.6 + i.data[n] * 0.4);
await sharp(s.data, { raw: s.info }).png().toFile(seismic);
