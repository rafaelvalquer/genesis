import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/enemy/colossoCaldeira");
const expected = { spawnAwakening: 12, idle: 8, riftTelegraph: 6, riftCast: 6, slamTelegraph: 6, slamAttack: 8, fractureTelegraph: 8, fractureAttack: 8, seismicTelegraph: 8, seismicAttack: 8, phaseTransition2: 10, phaseTransition3: 10, finalCollapse: 12, coreExposed: 8, death: 14 };
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
const errors = [];
const hashes = new Map();
const subtleStates = new Set(["idle", "coreExposed"]);

async function visualDistance(first, second) {
  const [left, right] = await Promise.all([
    sharp(first).resize(192, 192).ensureAlpha().raw().toBuffer(),
    sharp(second).resize(192, 192).ensureAlpha().raw().toBuffer(),
  ]);
  let total = 0; let samples = 0; let changed = 0;
  for (let offset = 0; offset < left.length; offset += 4) {
    if (left[offset + 3] < 12 && right[offset + 3] < 12) continue;
    const delta = Math.abs(left[offset] - right[offset]) + Math.abs(left[offset + 1] - right[offset + 1]) + Math.abs(left[offset + 2] - right[offset + 2]) + Math.abs(left[offset + 3] - right[offset + 3]);
    total += delta / 4; samples += 1;
    if (delta > 36) changed += 1;
  }
  return { mad: samples ? total / samples : 0, changed: samples ? changed / samples : 0 };
}
for (const [state, count] of Object.entries(expected)) {
  const folder = path.join(root, state);
  const entries = (await fs.readdir(folder)).filter((file) => /^frame\d+\.png$/.test(file)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (entries.length !== count) errors.push(`${state}: expected ${count} frames, found ${entries.length}`);
  for (let index = 0; index < count; index += 1) if (entries[index] !== `frame${index}.png`) errors.push(`${state}: missing frame${index}.png`);
  if (manifest.animations?.[state]?.frames !== count) errors.push(`${state}: manifest frame count mismatch`);
  for (const file of entries) {
    const source = path.join(folder, file); const buffer = await fs.readFile(source); const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    if (hashes.has(hash)) errors.push(`duplicate SHA: ${state}/${file} = ${hashes.get(hash)}`); else hashes.set(hash, `${state}/${file}`);
    const metadata = await sharp(source).metadata();
    if (metadata.width !== 768 || metadata.height !== 768 || !metadata.hasAlpha) errors.push(`${state}/${file}: expected 768x768 with alpha`);
  }
  for (let index = 1; index < count; index += 1) {
    if (state === "death" && index === count - 1) continue; // explicit inert final hold
    const result = await visualDistance(path.join(folder, `frame${index - 1}.png`), path.join(folder, `frame${index}.png`));
    const minMad = subtleStates.has(state) ? 0.24 : 0.36;
    const minChanged = subtleStates.has(state) ? 0.00025 : 0.0005;
    if (result.mad < minMad || result.changed < minChanged) errors.push(`${state}: frames ${index - 1}/${index} are visually too similar (MAD ${result.mad.toFixed(2)}, changed ${(result.changed * 100).toFixed(2)}%)`);
  }
}
if (!manifest.anchor || !Number.isFinite(manifest.anchor.x) || !Number.isFinite(manifest.anchor.y)) errors.push("invalid anchor");
const totalFrames = Object.values(expected).reduce((total, count) => total + count, 0);
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; } else console.log(`Colosso sprite audit passed: ${totalFrames} unique, visibly distinct alpha frames.`);
