import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const root = path.resolve("src/game/assets/chapter07/trees");
const types = ["fragile", "ferrivore", "mineralized", "spores"];
const stages = ["hp100", "hp75", "hp50", "hp25", "hp0"];
const failures = [];
const hashes = new Map();

for (const type of types) {
  let previousBase = null;
  for (const stage of stages) {
    const file = path.join(root, type, `${stage}.png`);
    const label = `${type}/${stage}`;
    try {
      const image = sharp(file);
      const metadata = await image.metadata();
      if (metadata.width !== 256 || metadata.height !== 256) failures.push(`${label}: expected 256x256`);
      if (metadata.hasAlpha !== true || metadata.channels !== 4) failures.push(`${label}: expected RGBA with alpha`);
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let minX = info.width; let maxX = -1; let minY = info.height; let maxY = -1; let visible = 0;
      for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * info.channels + 3] < 8) continue;
        visible += 1; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      if (!visible) failures.push(`${label}: empty alpha`);
      if (minX < 2 || minY < 2 || maxX > 253 || maxY > 253) failures.push(`${label}: visible pixels touch unsafe edge`);
      const base = visible ? { x: (minX + maxX) / 2, y: maxY } : null;
      if (previousBase && base && (Math.abs(base.x - previousBase.x) > 8 || Math.abs(base.y - previousBase.y) > 8)) failures.push(`${label}: base anchor moved too far`);
      previousBase = base;
      const hash = crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
      if (hashes.has(hash)) failures.push(`${label}: duplicate of ${hashes.get(hash)}`); else hashes.set(hash, label);
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${types.length * stages.length} forest obstacle sprites.`);
}
