import { cpus } from "node:os";
import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("dist/assets");
const concurrency = Math.max(2, Math.min(8, cpus().length));

async function collect(directory, output = [], temporary = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(target, output, temporary);
    else if (path.extname(entry.name).toLowerCase() === ".png") output.push(target);
    else if (entry.name.endsWith(".png.optimized")) temporary.push(target);
  }
  return { output, temporary };
}

async function optimize(file) {
  let before;
  try {
    before = (await stat(file)).size;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const temporary = `${file}.optimized`;
  let metadata;
  try {
    metadata = await sharp(file, { failOn: "error" }).metadata();
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const image = sharp(file, { failOn: "error" });
  const pipeline = Math.max(metadata.width || 0, metadata.height || 0) > 256
    ? image.resize(256, 256, { fit: "inside", withoutEnlargement: true })
    : image;
  await pipeline
    .png({ compressionLevel: 9, effort: 4, palette: true, colours: 192, dither: 1 })
    .toFile(temporary);
  const after = (await stat(temporary)).size;
  if (after < before) {
    await rm(file);
    await rename(temporary, file);
    return { before, after };
  }
  await rm(temporary);
  return { before, after: before };
}

const { output: files, temporary } = await collect(root);
await Promise.all(temporary.map((file) => rm(file, { force: true })));
let before = 0;
let after = 0;
let cursor = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < files.length) {
    const index = cursor;
    cursor += 1;
    const result = await optimize(files[index]);
    if (!result) continue;
    before += result.before;
    after += result.after;
  }
}));

console.log(`PNG de produção: ${files.length} arquivo(s), ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB.`);
