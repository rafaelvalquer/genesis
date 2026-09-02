import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const states = [
  "idle", "attackBurst", "interceptionLock", "interceptionFire",
  "interceptionFireUp", "interceptionFireDown", "paralyzed", "death",
];
const roots = [path.resolve("src/game/assets/troop/interceptadorIcaro")];
const errors = [];
for (const root of roots) {
  for (const state of states) {
    const folder = path.join(root, state);
    let entries = [];
    try { entries = await fs.readdir(folder); } catch { errors.push(`${root}: estado ausente ${state}`); continue; }
    const files = entries.filter((name) => /^frame\d+\.png$/.test(name));
    const expected = Array.from({ length: 8 }, (_, index) => `frame${index}.png`);
    const missing = expected.filter((name) => !files.includes(name));
    const extra = entries.filter((name) => name.toLowerCase().endsWith(".png") && !expected.includes(name));
    if (missing.length) errors.push(`${root}/${state}: frames ausentes ${missing.join(", ")}`);
    if (extra.length) errors.push(`${root}/${state}: frames extras ${extra.join(", ")}`);
    if (files.length !== 8) errors.push(`${root}/${state}: esperado exatamente 8 frames, encontrado ${files.length}`);
    for (const file of expected.filter((name) => files.includes(name))) {
      const filePath = path.join(folder, file);
      const image = sharp(filePath);
      const metadata = await image.metadata();
      if (metadata.width !== 384 || metadata.height !== 384 || !metadata.hasAlpha) errors.push(`${filePath}: precisa ser 384x384 RGBA`);
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let left = info.width; let right = -1; let top = info.height; let bottom = -1;
      for (let i = 0; i < info.width * info.height; i += 1) {
        if (data[i * info.channels + 3] <= 3) continue;
        const x = i % info.width; const y = Math.floor(i / info.width);
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      if (right < left || left < 12 || right > 371 || top < 12 || bottom > 371) errors.push(`${filePath}: contaminação/margem inválida`);
      if (state !== "death" && Math.abs(bottom - 371) > 2) errors.push(`${filePath}: baseline fora de ±2px`);
    }
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; } else console.log("Ícaro: 64 frames auditados, 384x384, RGBA, margem segura e baseline válidos.");
