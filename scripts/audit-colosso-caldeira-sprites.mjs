import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ENEMIES } from "../src/game/content.js";

const root = path.resolve("src/game/assets/enemy/colossoCaldeira");
const sourceRoot = path.resolve("src/game/assets-source/enemy/colossoCaldeira");
const expected = { spawnAwakening: 12, idle: 8, riftTelegraph: 6, riftAttack: 6, slamTelegraph: 6, slamAttack: 8, fractureTelegraph: 8, fractureAttack: 8, seismicTelegraph: 8, seismicAttack: 8, phaseTransition2: 10, phaseTransition3: 10, finalCollapse: 12, coreExposed: 8, death: 14 };
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
const curation = JSON.parse(await fs.readFile(path.join(sourceRoot, "curation.json"), "utf8"));
const rendererSource = await fs.readFile(path.resolve("src/game/GameCanvas.jsx"), "utf8");
const errors = [];
const hashes = new Map();
const subtleStates = new Set(["idle", "coreExposed"]);
const transitionPairs = [
  ["idle", 7, "riftTelegraph", 0], ["riftTelegraph", 5, "riftAttack", 0], ["riftAttack", 5, "idle", 0],
  ["idle", 7, "slamTelegraph", 0], ["slamTelegraph", 5, "slamAttack", 0], ["slamAttack", 7, "idle", 0],
  ["idle", 7, "fractureTelegraph", 0], ["fractureTelegraph", 7, "fractureAttack", 0], ["fractureAttack", 7, "idle", 0],
  ["idle", 7, "seismicTelegraph", 0], ["seismicTelegraph", 7, "seismicAttack", 0], ["seismicAttack", 7, "idle", 0],
  ["phaseTransition2", 9, "idle", 0], ["phaseTransition3", 9, "idle", 0], ["finalCollapse", 11, "coreExposed", 0],
];
const canonicalRoot = { x: 384, y: 768 * .86 };
if (curation.coordinateSpace !== "normalized-frame") errors.push("curation: expected normalized-frame coordinates");
for (const state of Object.keys(expected)) {
  const curated = curation.states?.[state]?.root;
  if (!curated || !Number.isFinite(curated.x) || !Number.isFinite(curated.y) || curated.x < 0 || curated.x > 1 || curated.y < 0 || curated.y > 1) errors.push(`${state}: missing or invalid curated foot root`);
  const headTop = curation.states?.[state]?.headTop;
  if (!Number.isFinite(headTop) || headTop < 0 || headTop >= curated?.y) errors.push(`${state}: missing or invalid curated headTop`);
}
if (!Number.isFinite(curation.canonicalBodyHeightPx) || curation.canonicalBodyHeightPx <= 0) errors.push("curation: invalid canonicalBodyHeightPx");

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

async function alphaGeometry(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width; let minY = info.height; let maxX = -1; let maxY = -1;
  const cornerSize = 32;
  let cornerPixels = 0;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    const alpha = data[(y * info.width + x) * info.channels + 3];
    if (alpha < 16) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    if ((x < cornerSize || x >= info.width - cornerSize) && (y < cornerSize || y >= info.height - cornerSize)) cornerPixels += 1;
  }
  return { width: info.width, height: info.height, minX, minY, maxX, maxY, cornerPixels };
}
for (const [state, count] of Object.entries(expected)) {
  const folder = path.join(root, state);
  const entries = (await fs.readdir(folder)).filter((file) => /^frame\d+\.png$/.test(file)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (entries.length !== count) errors.push(`${state}: expected ${count} frames, found ${entries.length}`);
  for (let index = 0; index < count; index += 1) if (entries[index] !== `frame${index}.png`) errors.push(`${state}: missing frame${index}.png`);
  if (manifest.animations?.[state]?.frames !== count) errors.push(`${state}: manifest frame count mismatch`);
  for (const file of entries) {
    const source = path.join(folder, file); const buffer = await fs.readFile(source); const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    if (hashes.has(hash)) {
      const allowedDeathHold = state === "death" && file === "frame13.png" && hashes.get(hash) === "death/frame12.png";
      if (!allowedDeathHold) errors.push(`duplicate SHA: ${state}/${file} = ${hashes.get(hash)}`);
    } else hashes.set(hash, `${state}/${file}`);
    const metadata = await sharp(source).metadata();
    if (metadata.width !== 768 || metadata.height !== 768 || !metadata.hasAlpha) errors.push(`${state}/${file}: expected 768x768 with alpha`);
    const geometry = await alphaGeometry(source);
    if (geometry.maxX < 0) errors.push(`${state}/${file}: empty alpha frame`);
    else {
      const margin = Math.min(geometry.minX, geometry.minY, geometry.width - 1 - geometry.maxX, geometry.height - 1 - geometry.maxY);
      if (margin < 2) errors.push(`${state}/${file}: transparent margin too small (${margin}px)`);
      if (geometry.cornerPixels > 0) errors.push(`${state}/${file}: isolated alpha residue in a corner (${geometry.cornerPixels}px)`);
      const anchor = manifest.frameAnchors?.[state]?.[Number(file.match(/\d+/)[0])] || manifest.anchor;
      if (anchor) {
        if (Math.abs(anchor.x - .5) > .0001 || Math.abs(anchor.y - .86) > .0001) errors.push(`${state}/${file}: root anchor must be the fixed feet midpoint`);
        if (anchor.scale !== 1) errors.push(`${state}/${file}: runtime scale must be baked into the source asset (expected 1)`);
      }
    }
  }
  for (let index = 1; index < count; index += 1) {
    if (state === "death" && index === count - 1) continue; // explicit inert final hold
    const result = await visualDistance(path.join(folder, `frame${index - 1}.png`), path.join(folder, `frame${index}.png`));
    const minMad = subtleStates.has(state) ? 0.24 : 0.36;
    const minChanged = subtleStates.has(state) ? 0.00025 : 0.0005;
    if (result.mad < minMad || result.changed < minChanged) errors.push(`${state}: frames ${index - 1}/${index} are visually too similar (MAD ${result.mad.toFixed(2)}, changed ${(result.changed * 100).toFixed(2)}%)`);
    // A heavy one-arm slam intentionally covers more screen distance than
    // the other poses; it still has intermediate anticipation/recovery frames.
    const maxMad = state === "death" || state === "finalCollapse" ? 95 : (state === "slamTelegraph" || state === "slamAttack" ? 90 : (state === "spawnAwakening" ? 82 : (state === "phaseTransition3" ? 80 : 76)));
    if (result.mad > maxMad) errors.push(`${state}: frames ${index - 1}/${index} change too abruptly (MAD ${result.mad.toFixed(2)} > ${maxMad})`);
  }
  const anchors = manifest.frameAnchors?.[state] || [];
  for (let index = 1; index < anchors.length; index += 1) {
    if (state === "death") continue;
    const previous = anchors[index - 1]; const current = anchors[index];
    if (Math.abs((current?.scale ?? 1) - (previous?.scale ?? 1)) > .0401) errors.push(`${state}: scale jump exceeds 4% at frames ${index - 1}/${index}`);
  }
  const projections = manifest.curation?.rootProjection?.[state] || [];
  if (projections.length !== count) errors.push(`${state}: missing curated root projections`);
  for (let index = 0; index < projections.length; index += 1) {
    const projected = projections[index]?.root;
    if (!projected || Math.abs(projected.x - canonicalRoot.x) > 1 || Math.abs(projected.y - canonicalRoot.y) > 1) errors.push(`${state}/frame${index}: curated root projection exceeds 1px`);
    if (!Number.isFinite(projections[index]?.scale) || projections[index].scale <= 0) errors.push(`${state}/frame${index}: invalid root-fit scale`);
  }
  const reference = await sharp(path.join(sourceRoot, state, "frame0.png")).metadata();
  const curated = curation.states[state].root; const headTop = curation.states[state].headTop;
  const expectedBakedScale = curation.canonicalBodyHeightPx / ((curated.y - headTop) * reference.height);
  for (const projection of projections) if (Math.abs(projection.scale - expectedBakedScale) > .000001) errors.push(`${state}: per-frame source-scale compensation is not allowed`);
}
if (!manifest.anchor || !Number.isFinite(manifest.anchor.x) || !Number.isFinite(manifest.anchor.y)) errors.push("invalid anchor");
if (manifest.frameAnchorStrategy !== "curated-feet-v7") errors.push("manifest does not use curated-feet-v7");
const configuredStates = ENEMIES.colossoCaldeira?.assetStates || [];
if (JSON.stringify(configuredStates) !== JSON.stringify(Object.keys(expected))) errors.push(`logic assetStates mismatch: ${configuredStates.join(",")}`);
if (rendererSource.includes("enemyAssets?.idle?.[0]")) errors.push("silent Colosso fallback to idle[0] still present");
for (const [attack, frame] of Object.entries(ENEMIES.colossoCaldeira?.attackImpactFrame || {})) {
  const state = attack === "rift" ? "riftAttack" : `${attack}Attack`;
  if (!expected[state] || frame < 0 || frame >= expected[state]) errors.push(`${attack}: invalid impactFrame ${frame}`);
  const impactMs = ENEMIES.colossoCaldeira.attackImpactMs?.[attack];
  if (!Number.isFinite(impactMs) || impactMs < 0 || impactMs > ENEMIES.colossoCaldeira.attackExecutionMs[attack]) errors.push(`${attack}: invalid impactMs ${impactMs}`);
  if (manifest.animations?.[state]?.impactFrame !== frame || manifest.animations?.[state]?.impactMs !== impactMs) errors.push(`${attack}: manifest impact metadata mismatch`);
  const timeline = ENEMIES.colossoCaldeira.animationFrameProgress?.[state];
  if (!Array.isArray(timeline) || timeline.length !== expected[state] || timeline.some((at, index) => !Number.isFinite(at) || at < 0 || at > 1 || (index && at <= timeline[index - 1]))) errors.push(`${state}: invalid non-linear frame timeline`);
  else if (Math.abs(timeline[frame] * ENEMIES.colossoCaldeira.attackExecutionMs[attack] - impactMs) > 1) errors.push(`${attack}: impact timeline does not land on impactMs`);
}
const deathHold = await visualDistance(path.join(root, "death", "frame12.png"), path.join(root, "death", "frame13.png"));
if (deathHold.mad > 2 || deathHold.changed > .03) errors.push(`death final hold is not stable (MAD ${deathHold.mad.toFixed(2)})`);
for (const [fromState, fromFrame, toState, toFrame] of transitionPairs) {
  const result = await visualDistance(path.join(root, fromState, `frame${fromFrame}.png`), path.join(root, toState, `frame${toFrame}.png`));
  // Slam starts from a deliberately raised-fist silhouette. The renderer
  // crossfades state boundaries, so permit its heavier readable transition
  // while keeping all other state hand-offs tighter.
  const involvesSlam = fromState.startsWith("slam") || toState.startsWith("slam");
  const involvesRift = fromState.startsWith("rift") || toState.startsWith("rift");
  const involvesSeismic = fromState.startsWith("seismic") || toState.startsWith("seismic");
  const maxMad = fromState === "finalCollapse" ? 100 : (involvesSlam ? 90 : (involvesRift ? 76 : (involvesSeismic ? 72 : 65)));
  if (result.mad > maxMad) errors.push(`${fromState}/${fromFrame} → ${toState}/${toFrame} is too abrupt (MAD ${result.mad.toFixed(2)} > ${maxMad})`);
}
const totalFrames = Object.values(expected).reduce((total, count) => total + count, 0);
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; } else console.log(`Colosso sprite audit passed: ${totalFrames} validated, visibly distinct alpha frames (death final hold allowed).`);
