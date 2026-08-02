import { createHash } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const states = ["spawnRise", "idleSurface", "surfaceSwim", "biteAbyss", "biteRecover", "tailSweep", "brineJet", "vortexCast", "submerge", "submergedTravel", "emergeImpact", "tideCommand", "abyssRoar", "delugeCharge", "delugeRelease", "exposedGills", "death"];
const minimumChangedPixelRatio = { idleSurface: .025, surfaceSwim: .06, biteAbyss: .10, biteRecover: .07, tailSweep: .10, brineJet: .08, vortexCast: .08, submerge: .12, submergedTravel: .06, emergeImpact: .12, tideCommand: .08, abyssRoar: .09, delugeCharge: .08, delugeRelease: .12, exposedGills: .04, death: .14, spawnRise: .14 };
const root = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(root, "..", "art", "source", "leviathanNereida");
const outputRoot = join(root, "..", "src", "game", "assets", "enemy", "leviathanNereida");
const sheetsRoot = join(root, "..", "art", "spritesheets", "leviathanNereida");
const specialHeightStates = new Set(["spawnRise", "submerge", "emergeImpact", "death"]);

function fail(message) { throw new Error(`Leviatã: ${message}`); }
function ratioChanged(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) changed += 1;
  return changed / (a.length / 4);
}
function alphaBox(pixels) {
  let left = 512; let top = 512; let right = -1; let bottom = -1;
  for (let y = 0; y < 512; y += 1) for (let x = 0; x < 512; x += 1) {
    if (pixels[(y * 512 + x) * 4 + 3] === 0) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right < 0 ? null : { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, centerY: (top + bottom) / 2 };
}
function assertSafeBounds(state, frame, pixels) {
  for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) if (pixels[(y * 512 + x) * 4 + 3] !== 0) fail(`${state}/${frame}: os quatro cantos devem ser transparentes.`);
  const box = alphaBox(pixels);
  if (!box) fail(`${state}/${frame}: sprite vazio.`);
  if (box.left < 8 || box.right > 503 || box.top < 8 || box.bottom > 503) fail(`${state}/${frame}: pixels excedem a margem mínima de 8 px.`);
  if (box.left < 24 || box.right > 487 || box.top < 24 || box.bottom > 491) fail(`${state}/${frame}: excede a margem de segurança artística (24/24/20 px).`);
  return box;
}
async function normalize(sourcePath, outputPath) {
  const image = sharp(sourcePath).ensureAlpha().resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 512 || info.height !== 512 || info.channels !== 4) fail(`${sourcePath}: PNG RGBA 512×512 exigido.`);
  await sharp(data, { raw: info }).png().toFile(outputPath);
  return data;
}

const sourceDirectories = (await readdir(sourceRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
if (sourceDirectories.includes("hit")) fail("não pode existir animação hit.");
if (sourceDirectories.join("|") !== [...states].sort().join("|")) fail("a fonte precisa conter exatamente os 17 estados previstos.");
await mkdir(sheetsRoot, { recursive: true });

const stateSignatures = new Set();
for (const state of states) {
  const sourceDir = join(sourceRoot, state); const outputDir = join(outputRoot, state);
  await mkdir(outputDir, { recursive: true });
  const files = (await readdir(sourceDir)).filter((file) => /^frame[0-7]\.png$/.test(file)).sort();
  if (files.length !== 8) fail(`${state}: requer frame0.png a frame7.png.`);
  const hashes = new Set(); const frames = []; const boxes = [];
  for (const file of files) {
    const sourcePath = join(sourceDir, file); const bytes = await readFile(sourcePath);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
    const pixels = await normalize(sourcePath, join(outputDir, file));
    boxes.push(assertSafeBounds(state, file, pixels));
    frames.push(pixels);
  }
  if (hashes.size < 7) fail(`${state}: menos de sete poses diferentes.`);
  if (ratioChanged(frames[0], frames[3]) === 0) fail(`${state}: frame0 e frame3 não podem ser iguais.`);
  const requiredChange = minimumChangedPixelRatio[state];
  for (let index = 1; index < frames.length; index += 1) if (ratioChanged(frames[index - 1], frames[index]) < requiredChange) fail(`${state}: frame${index - 1}→frame${index} muda menos que ${(requiredChange * 100).toFixed(1)}% dos pixels.`);
  if (!specialHeightStates.has(state)) {
    const base = boxes[0];
    for (const box of boxes.slice(1)) {
      if (Math.abs(box.height - base.height) / base.height > .12) fail(`${state}: altura aparente varia mais de 12%.`);
      if (Math.abs(box.centerY - base.centerY) > 20) fail(`${state}: centro da anatomia varia mais de 20 px.`);
    }
  }
  const signature = [...hashes].sort().join("|");
  if (stateSignatures.has(signature)) fail(`${state}: reutiliza a sequência inteira de outro estado.`);
  stateSignatures.add(signature);
  await sharp({ create: { width: 4096, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(files.map((file, index) => ({ input: join(outputDir, file), left: index * 512, top: 0 }))).png().toFile(join(sheetsRoot, `leviathan-${state}.png`));
}
console.log(`Leviatã processado: ${states.length} estados, 136 PNGs e ${states.length} sheets de revisão.`);
