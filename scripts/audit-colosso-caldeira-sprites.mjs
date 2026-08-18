import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/enemy/colossoCaldeira");
const expected = { spawnAwakening: 12, idle: 8, riftTelegraph: 6, riftCast: 6, slamTelegraph: 6, slamAttack: 8, fractureTelegraph: 8, fractureAttack: 8, seismicTelegraph: 8, seismicAttack: 8, phaseTransition2: 10, phaseTransition3: 10, finalCollapse: 12, coreExposed: 8, death: 14 };
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
const errors = [];
const hashes = new Map();
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
}
if (!manifest.anchor || !Number.isFinite(manifest.anchor.x) || !Number.isFinite(manifest.anchor.y)) errors.push("invalid anchor");
const totalFrames = Object.values(expected).reduce((total, count) => total + count, 0);
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; } else console.log(`Colosso sprite audit passed: ${totalFrames} unique alpha frames.`);
