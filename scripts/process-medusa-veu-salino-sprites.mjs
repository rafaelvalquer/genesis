import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const states = ["idle", "moveFloat", "retreat", "healPulse", "attackCast", "attackRelease", "death", "spawnRise"];
const minimumChangedPixelRatio = {
  idle: .025, moveFloat: .06, retreat: .06, healPulse: .08,
  attackCast: .08, attackRelease: .09, death: .10, spawnRise: .12,
};
const sourceRoot = "art/source/medusaVeuSalino";
const outputRoot = "src/game/assets/enemy/medusaVeuSalino";
const sheetRoot = "art/spritesheets/medusaVeuSalino";

async function rawFrame(file) {
  const result = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (result.info.width !== 256 || result.info.height !== 256) throw new Error(`${file} must be 256 × 256.`);
  return result.data;
}

function changedRatio(left, right) {
  let changed = 0;
  for (let index = 0; index < left.length; index += 4) {
    const delta = Math.abs(left[index] - right[index]) + Math.abs(left[index + 1] - right[index + 1])
      + Math.abs(left[index + 2] - right[index + 2]) + Math.abs(left[index + 3] - right[index + 3]);
    if (delta > 60) changed += 1;
  }
  return changed / (256 * 256);
}

for (const state of states) {
  const sourceDir = path.join(sourceRoot, state);
  const sourceFiles = (await fs.readdir(sourceDir)).filter((file) => /^frame[0-7]\.png$/.test(file)).sort();
  if (sourceFiles.length !== 8) throw new Error(`${state} requires exactly 8 source frames.`);
  const frames = await Promise.all(sourceFiles.map((file) => rawFrame(path.join(sourceDir, file))));
  const signatures = new Set(frames.map((frame) => frame.toString("base64")));
  if (signatures.size < 7) throw new Error(`${state} contains repeated source art.`);
  for (let index = 1; index < frames.length; index += 1) {
    if (changedRatio(frames[index - 1], frames[index]) < minimumChangedPixelRatio[state]) {
      throw new Error(`${state} frame${index - 1} → frame${index} lacks visible animation.`);
    }
  }
  if (changedRatio(frames[0], frames[3]) < minimumChangedPixelRatio[state]) {
    throw new Error(`${state} frame0 and frame3 are too similar.`);
  }

  const destination = path.join(outputRoot, state);
  await fs.mkdir(destination, { recursive: true });
  for (const file of sourceFiles) {
    const output = path.join(destination, file);
    await sharp(path.join(sourceDir, file)).ensureAlpha().png().toFile(output);
  }
  await fs.mkdir(sheetRoot, { recursive: true });
  await sharp({ create: { width: 2048, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(sourceFiles.map((file, index) => ({ input: path.join(destination, file), left: index * 256, top: 0 })))
    .png().toFile(path.join(sheetRoot, `medusa-veu-salino-${state}.png`));
}

console.log("Medusa Véu-Salino sprites validated and exported.");
