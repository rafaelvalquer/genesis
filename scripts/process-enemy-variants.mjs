import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENEMY_ROOT = path.join(ROOT, "src", "game", "assets", "enemy");
const SOURCE_ROOT = path.resolve(process.argv[2] || "C:/Users/Z565244/Downloads/jogo");
const FRAME_SIZE = 256;
const MAX_CONCURRENCY = 8;

const variants = [
  { id: "vexar", source: "Alien 1 Cor 2", states: { idle: "Idle", walking: "Walk", attack: "Attack" } },
  { id: "silex", source: "Alien 1 Cor 3", states: { idle: "Idle", walking: "Walk", attack: "Attack" } },
  { id: "neurax", source: "Alien 2 Cor 2", states: { idle: "Idle and Walk", walking: "Idle and Walk", attack: "Attack" } },
  { id: "oculis", source: "Alien 2 Cor 3", states: { idle: "Idle and Walk", walking: "Idle and Walk", attack: "Attack" } },
  { id: "brakor", source: "Alien 3 Cor 2", states: { idle: "Idle", walking: "Walk", attack: "Attack" } },
  { id: "aurakh", source: "Alien 3 Cor 3", states: { idle: "Idle", walking: "Walk", attack: "Attack" } },
  { id: "myrkon", source: "Alien 4 Cor 2", states: { idle: "Idle", walking: "Walk", attack: "Attack" } },
  { id: "zhyra", source: "Alien 4 Cor 3", states: { idle: "Idle", walking: "Walk", attack: "Attack" } },
];

const frameNumber = (file) => Number(/(\d+)\.png$/i.exec(file)?.[1] || 0);
const pngFiles = async (directory) => (await fs.readdir(directory))
  .filter((file) => file.toLowerCase().endsWith(".png"))
  .sort((left, right) => frameNumber(left) - frameNumber(right));

async function optimize(source, target) {
  const buffer = await sharp(source)
    .resize(FRAME_SIZE, FRAME_SIZE, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, palette: true, colors: 256, quality: 92, dither: 0.6 })
    .toBuffer();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
}

async function optimizeFrames(frames) {
  for (let index = 0; index < frames.length; index += MAX_CONCURRENCY) {
    await Promise.all(frames.slice(index, index + MAX_CONCURRENCY).map(({ source, target }) => optimize(source, target)));
  }
}

async function importVariant(variant) {
  const sourceRoot = path.join(SOURCE_ROOT, variant.source);
  const targetRoot = path.join(ENEMY_ROOT, variant.id);
  await fs.rm(targetRoot, { recursive: true, force: true });
  for (const [state, sourceState] of Object.entries(variant.states)) {
    const sourceDirectory = path.join(sourceRoot, sourceState);
    const files = await pngFiles(sourceDirectory);
    await optimizeFrames(files.map((file, index) => ({
      source: path.join(sourceDirectory, file),
      target: path.join(targetRoot, state, `frame${index}.png`),
    })));
    console.log(`${variant.id}/${state}: ${files.length} frames`);
  }
}

async function optimizeExistingEnemies() {
  const variantIds = new Set(variants.map(({ id }) => id));
  const enemyIds = await fs.readdir(ENEMY_ROOT, { withFileTypes: true });
  for (const enemy of enemyIds) {
    if (!enemy.isDirectory() || variantIds.has(enemy.name)) continue;
    const enemyDirectory = path.join(ENEMY_ROOT, enemy.name);
    const states = await fs.readdir(enemyDirectory, { withFileTypes: true });
    for (const state of states) {
      if (!state.isDirectory()) continue;
      const stateDirectory = path.join(enemyDirectory, state.name);
      const files = await pngFiles(stateDirectory);
      await optimizeFrames(files.map((file) => {
        const target = path.join(stateDirectory, file);
        return { source: target, target };
      }));
    }
    console.log(`${enemy.name}: sprites existentes otimizados`);
  }
}

await fs.access(SOURCE_ROOT);
await optimizeExistingEnemies();
for (const variant of variants) await importVariant(variant);
