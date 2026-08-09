import { createHash } from "node:crypto";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { LEVIATHAN_AUDIT_RULES as auditRules, analyzeLeviathanComponents, componentTouchesProtectedZone } from "./leviathan-sprite-components.mjs";

const states = ["spawnRise", "idleSurface", "surfaceSwim", "biteAbyss", "biteRecover", "tailSweep", "brineJet", "vortexCast", "submerge", "submergedTravel", "emergeImpact", "tideCommand", "abyssRoar", "delugeCharge", "delugeRelease", "exposedGills", "death"];
const minimumChangedPixelRatio = { idleSurface: .025, surfaceSwim: .06, biteAbyss: .10, biteRecover: .07, tailSweep: .10, brineJet: .08, vortexCast: .08, submerge: .12, submergedTravel: .06, emergeImpact: .12, tideCommand: .08, abyssRoar: .09, delugeCharge: .08, delugeRelease: .12, exposedGills: .04, death: .14, spawnRise: .14 };
const root = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(root, "..", "art", "source", "leviathanNereida");
const outputRoot = join(root, "..", "src", "game", "assets", "enemy", "leviathanNereida");
const sheetsRoot = join(root, "..", "art", "spritesheets", "leviathanNereida");
const specialHeightStates = new Set(["spawnRise", "submerge", "emergeImpact", "death"]);
const cinematicStates = new Set(["spawnRise", "submerge", "emergeImpact", "delugeCharge", "delugeRelease", "death"]);
const normalizationProfiles = { normal: { width: 444, height: 390 }, cinematic: { width: 456, height: 438 }, submerged: { width: 430, height: 330 } };

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
function assertConnectedAnatomy(state, frame, pixels) {
  const analysis = analyzeLeviathanComponents(pixels, 512, 512);
  if (!analysis.main || analysis.mainComponentRatio < .98) fail(`${state}/${frame}: MAIN_COMPONENT_TOO_SMALL — o corpo principal deve representar ao menos 98% dos pixels visíveis.`);
  for (const component of analysis.secondary) {
    const zones = componentTouchesProtectedZone(component, 512, 512, auditRules);
    if (zones.inCorner) fail(`${state}/${frame}: CORNER_CONTAMINATION — componente isolado em zona de canto.`);
    if (zones.touchesMargin) fail(`${state}/${frame}: EDGE_CONTAMINATION — componente isolado junto à margem.`);
    if (component.area > auditRules.warningComponentAreaPx) fail(`${state}/${frame}: ISOLATED_PIXEL_ISLAND — componente desconectado com ${component.area} pixels.`);
    if (component.area / analysis.main.area > auditRules.maximumSecondaryAreaFactor) fail(`${state}/${frame}: SECONDARY_COMPONENT_TOO_LARGE.`);
  }
}
function profileFor(state) {
  if (state === "submergedTravel") return normalizationProfiles.submerged;
  return cinematicStates.has(state) ? normalizationProfiles.cinematic : normalizationProfiles.normal;
}
function keepMainComponent(data) {
  const analysis = analyzeLeviathanComponents(data, 512, 512);
  if (!analysis.main) fail("sprite has no visible main component.");
  const pixels = new Set(analysis.main.pixels);
  const cleaned = Buffer.from(data);
  for (let index = 0; index < 512 * 512; index += 1) if (!pixels.has(index)) cleaned[index * 4 + 3] = 0;
  return cleaned;
}
async function normalize(state, sourcePath, outputPath) {
  const image = sharp(sourcePath).ensureAlpha().resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 512 || info.height !== 512 || info.channels !== 4) fail(`${sourcePath}: PNG RGBA 512×512 exigido.`);
  const cleaned = keepMainComponent(data);
  const box = alphaBox(cleaned);
  if (!box) fail(`${sourcePath}: empty sprite.`);
  const padding = cinematicStates.has(state) ? 24 : 18;
  const left = Math.max(0, box.left - padding); const top = Math.max(0, box.top - padding);
  const width = Math.min(512 - left, box.width + padding * 2); const height = Math.min(512 - top, box.height + padding * 2);
  const profile = profileFor(state);
  const cropped = await sharp(cleaned, { raw: info }).extract({ left, top, width, height })
    .resize(profile.width, profile.height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const croppedInfo = await sharp(cropped).metadata();
  const output = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cropped, left: Math.round((512 - croppedInfo.width) / 2), top: Math.round((512 - croppedInfo.height) / 2) }]).png().toBuffer();
  await sharp(output).toFile(outputPath);
  return sharp(output).raw().toBuffer();
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
    const pixels = await normalize(state, sourcePath, join(outputDir, file));
    boxes.push(assertSafeBounds(state, file, pixels));
    assertConnectedAnatomy(state, file, pixels);
    frames.push(pixels);
  }
  if (hashes.size < 7) fail(`${state}: menos de sete poses diferentes.`);
  if (ratioChanged(frames[0], frames[3]) === 0) fail(`${state}: frame0 e frame3 não podem ser iguais.`);
  const requiredChange = minimumChangedPixelRatio[state];
  for (let index = 1; index < frames.length; index += 1) if (ratioChanged(frames[index - 1], frames[index]) < requiredChange) fail(`${state}: frame${index - 1}→frame${index} muda menos que ${(requiredChange * 100).toFixed(1)}% dos pixels.`);
  if (!specialHeightStates.has(state)) {
    const base = boxes[0];
    for (const box of boxes.slice(1)) {
      if (Math.abs(box.height - base.height) / base.height > .08) fail(`${state}: FRAME_BODY_SCALE_DRIFT — altura aparente varia mais de 8%.`);
      if (Math.abs(box.centerY - base.centerY) > auditRules.maximumAnchorDriftPx) fail(`${state}: ANCHOR_DRIFT — centro da anatomia varia mais de 10 px.`);
    }
  }
  const signature = [...hashes].sort().join("|");
  if (stateSignatures.has(signature)) fail(`${state}: reutiliza a sequência inteira de outro estado.`);
  stateSignatures.add(signature);
  await sharp({ create: { width: 4096, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(files.map((file, index) => ({ input: join(outputDir, file), left: index * 512, top: 0 }))).png().toFile(join(sheetsRoot, `leviathan-${state}.png`));
}
console.log(`Leviatã processado: ${states.length} estados, 136 PNGs e ${states.length} sheets de revisão.`);
