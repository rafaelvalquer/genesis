import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const requestedState = process.argv[2];
const larvaExpected = {
  idle: 6,
  walking: 8,
  attack: 6,
  emerge: 8,
  death: 6,
};
const dardifagoExpected = { idle: 8, walking: 8, dartAttack: 8, toxicAttack: 8, death: 8 };
const isDardifago = requestedState in dardifagoExpected;
const root = path.resolve(isDardifago ? 'src/game/assets/enemy/dardifago' : 'src/game/assets/enemy/larvaRaizFerro');
const expected = isDardifago ? dardifagoExpected : larvaExpected;
const states = requestedState ? [requestedState] : Object.keys(expected);
const failures = [];

for (const state of states) {
  if (!(state in expected)) {
    failures.push(`Unknown animation state: ${state}`);
    continue;
  }
  const dir = path.join(root, state);
  const files = (await fs.readdir(dir))
    .filter((file) => /^frame\d+\.png$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length !== expected[state]) {
    failures.push(`${state}: expected ${expected[state]} frames, found ${files.length}`);
  }

  const centers = [];
  const baselines = [];
  const hashes = new Set();
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const metadata = await sharp(fullPath).metadata();
    if (metadata.width !== 512 || metadata.height !== 512 || metadata.format !== 'png' || metadata.channels !== 4) {
      failures.push(`${state}/${file}: must be 512x512 PNG RGBA`);
    }
    const { data, info } = await sharp(fullPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width;
    let top = info.height;
    let right = -1;
    let bottom = -1;
    let hasTransparent = false;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha === 0) hasTransparent = true;
        if (alpha > 8) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (!hasTransparent) failures.push(`${state}/${file}: background is fully opaque`);
    if (left < 24 || top < 24 || right > 487 || bottom > 487) {
      failures.push(`${state}/${file}: visible pixels violate the 24px edge margin (${left},${top},${right},${bottom})`);
    }
    centers.push((left + right) / 2);
    baselines.push(bottom);
    const hash = crypto.createHash('sha256').update(await fs.readFile(fullPath)).digest('hex');
    if (hashes.has(hash)) failures.push(`${state}/${file}: duplicate frame`);
    hashes.add(hash);
  }
  if (centers.length) {
    const centerDrift = Math.max(...centers) - Math.min(...centers);
    const baselineDrift = Math.max(...baselines) - Math.min(...baselines);
    if (centerDrift > (state === 'walking' ? 16 : 18)) failures.push(`${state}: centerX drift ${centerDrift.toFixed(1)}px exceeds limit`);
    if (baselineDrift > 12) failures.push(`${state}: baseline drift ${baselineDrift.toFixed(1)}px exceeds limit`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Larva de Raiz-Ferro assets valid: ${states.join(', ')}`);
