import fs from "node:fs";
import path from "node:path";
import { CHAPTERS, PHASES } from "../src/game/content.js";

const root = path.resolve("dist/assets");
if (!fs.existsSync(root)) throw new Error("Build sem diretório de assets.");

const limits = {
  ".png": 700_000,
  ".webp": 450_000,
  ".wav": 9_000_000,
  ".ogg": 4_000_000,
};
const files = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    entry.isDirectory() ? walk(target) : files.push(target);
  }
};
walk(root);
const blocking = files
  .map((file) => ({ file, size: fs.statSync(file).size, limit: limits[path.extname(file).toLowerCase()] }))
  .filter((entry) => entry.limit && entry.size > entry.limit);
const arenas = files.filter((file) => {
  const name = path.basename(file);
  return path.extname(file).toLowerCase() === ".webp" && /^(fase_\d{2}|chapter_\d{2})[-.]/.test(name);
});
const expectedArenaCount = new Set([
  ...PHASES.map((phase) => phase.arenaId),
  ...CHAPTERS.map((chapter) => chapter.coverArenaId),
]).size;
const total = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);

if (arenas.length !== expectedArenaCount) {
  console.error(`Build deve conter ${expectedArenaCount} arenas WebP; encontrou ${arenas.length}.`);
  process.exitCode = 1;
}
if (total > 60 * 1024 * 1024) {
  console.error(`Build excede o orçamento total de 60 MB: ${(total / 1024 / 1024).toFixed(1)} MB.`);
  process.exitCode = 1;
}

if (blocking.length) {
  blocking.forEach((entry) => console.error(`${path.relative(root, entry.file)} excede ${(entry.limit / 1024).toFixed(0)} KB`));
  process.exitCode = 1;
} else {
  console.log(`Assets validados: ${files.length} arquivos, ${(total / 1024 / 1024).toFixed(1)} MB.`);
}
