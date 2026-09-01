import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.resolve("art/source/interceptadorIcaro/v3/idle");
const processed = path.join(source, "processed");
const art = path.resolve("art/sprites/interceptadorIcaro/idle");
const runtime = path.resolve("src/game/assets/troop/interceptadorIcaro/idle");
const qa = path.resolve("art/qa/interceptadorIcaro-v3");
const size = 384, safe = 12, rootX = 192, baseline = 371, targetHeight = 327;
await Promise.all([processed, art, runtime, qa].map((dir) => fs.mkdir(dir, { recursive: true })));

async function clean(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // frame0 is the only generation that returned an opaque neutral checkerboard.
  for (let i = 0; i < info.width * info.height; i += 1) {
    const p = i * info.channels, r = data[p], g = data[p + 1], b = data[p + 2];
    if (r > 190 && g > 190 && b > 190 && Math.max(r, g, b) - Math.min(r, g, b) < 24) data[p + 3] = 0;
  }
  return { data, info };
}
function bounds({ data, info }) { let l = info.width, r = -1, t = info.height, b = -1; for (let i = 0; i < info.width * info.height; i += 1) if (data[i * info.channels + 3] > 8) { const x = i % info.width, y = Math.floor(i / info.width); l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); } if (r < l) throw new Error("Sprite sem alpha visível."); return { l, r, t, b, width: r - l + 1, height: b - t + 1 }; }
const candidates = await Promise.all(Array.from({ length: 8 }, (_, i) => clean(path.join(source, `frame${i}-candidate.png`))));
const outputs = [];
for (let i = 0; i < 8; i += 1) {
  const box = bounds(candidates[i]);
  const scale = targetHeight / box.height, width = Math.round(box.width * scale), height = targetHeight;
  const crop = await sharp(candidates[i].data, { raw: candidates[i].info }).extract({ left: box.l, top: box.t, width: box.width, height: box.height }).resize(width, height, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const left = Math.round(rootX - width / 2), top = baseline - height + 1;
  if (left < safe || left + width > size - safe) throw new Error(`frame${i} excede margem segura após normalização.`);
  const output = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: crop, left, top }]).png({ compressionLevel: 9, effort: 10 }).toBuffer();
  await Promise.all([fs.writeFile(path.join(processed, `frame${i}.png`), output), fs.writeFile(path.join(art, `frame${i}.png`), output), fs.writeFile(path.join(runtime, `frame${i}.png`), output)]);
  outputs.push(output);
}
// Individual artwork can vary around the boots despite the locked prompt. Reuse the
// neutral lower section as the fixed gameplay root; all breathing remains above it.
const fixedLower = await sharp(outputs[0]).extract({ left: 0, top: 270, width: size, height: size - 270 }).png().toBuffer();
for (let i = 1; i < 8; i += 1) {
  outputs[i] = await sharp(outputs[i]).composite([{ input: fixedLower, left: 0, top: 270 }]).png({ compressionLevel: 9, effort: 10 }).toBuffer();
  await Promise.all([fs.writeFile(path.join(processed, `frame${i}.png`), outputs[i]), fs.writeFile(path.join(art, `frame${i}.png`), outputs[i]), fs.writeFile(path.join(runtime, `frame${i}.png`), outputs[i])]);
}
await Promise.all([fs.writeFile(path.resolve("art/sprites/interceptadorIcaro/death/frame0.png"), outputs[0]), fs.writeFile(path.resolve("src/game/assets/troop/interceptadorIcaro/death/frame0.png"), outputs[0])]);
await sharp({ create: { width: size * 8, height: size, channels: 4, background: { r: 18, g: 22, b: 34, alpha: 1 } } }).composite(outputs.map((input, i) => ({ input, left: i * size, top: 0 }))).png().toFile(path.join(qa, "idle-runtime-grid.png"));
console.log("Idle v3 individual publicado com root e canvas normalizados.");
