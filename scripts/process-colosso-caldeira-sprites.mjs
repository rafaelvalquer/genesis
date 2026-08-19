import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getCuratedRootPlacement } from "../src/game/colossoFootRoot.js";

const runtimeRoot = path.resolve("src/game/assets/enemy/colossoCaldeira");
const sourceRoot = path.resolve("src/game/assets-source/enemy/colossoCaldeira");
const manifestPath = path.join(runtimeRoot, "manifest.json");
const curationPath = path.join(sourceRoot, "curation.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const required = {
  spawnAwakening: 12, idle: 8, riftTelegraph: 6, riftAttack: 6,
  slamTelegraph: 6, slamAttack: 8, fractureTelegraph: 8, fractureAttack: 8,
  seismicTelegraph: 8, seismicAttack: 8, phaseTransition2: 10, phaseTransition3: 10,
  finalCollapse: 12, coreExposed: 8, death: 14,
};
const selectedStates = process.env.COLOSSO_STATES
  ? process.env.COLOSSO_STATES.split(",").map((state) => state.trim()).filter(Boolean)
  : Object.keys(required);
for (const state of selectedStates) {
  if (!(state in required)) throw new Error(`Unknown Colosso state: ${state}`);
}
// The authored death sheet contains a group of intermediate exports with
// detached torso/limb fragments. Those are not usable as full-body poses: the
// cleanup stage rightly removes the disconnected pieces, leaving a visibly
// cropped Colosso. Hold the complete standing poses briefly, then transition
// to the two complete grounded poses instead.
const deathSourceFrames = [0, 0, 1, 1, 2, 2, 3, 3, 12, 12, 12, 12, 12, 12];
const curation = JSON.parse(await fs.readFile(curationPath, "utf8"));
const impact = { riftAttack: { impactFrame: 3, impactMs: 520 }, slamAttack: { impactFrame: 4, impactMs: 720 }, fractureAttack: { impactFrame: 4, impactMs: 798 }, seismicAttack: { impactFrame: 3, impactMs: 630 } };
const frameMs = { idle: 190, riftTelegraph: 185, riftAttack: 220, slamTelegraph: 185, slamAttack: 220, coreExposed: 110 };
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
// The root is the midpoint between the feet, never a value inferred from a
// changing silhouette. Every exported frame uses this same canvas point.
const contentRoot = { x: .5, y: .86 };
const isCalibratedV5 = false;
const finalRootPx = { x: 768 * contentRoot.x, y: 768 * contentRoot.y };
const safetyMargin = 8;

function curatedRootFor(state) {
  const root = curation?.states?.[state]?.root;
  if (!root || !Number.isFinite(root.x) || !Number.isFinite(root.y) || root.x < 0 || root.x > 1 || root.y < 0 || root.y > 1) {
    throw new Error(`Missing or invalid curated foot root for ${state} in ${curationPath}`);
  }
  return root;
}

function curatedHeadTopFor(state) {
  const headTop = curation?.states?.[state]?.headTop;
  const root = curatedRootFor(state);
  if (!Number.isFinite(headTop) || headTop < 0 || headTop >= root.y) throw new Error(`Missing or invalid curated headTop for ${state} in ${curationPath}`);
  return headTop;
}

for (const state of selectedStates) { curatedRootFor(state); curatedHeadTopFor(state); }

function removeCornerResidue(data, info) {
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const components = [];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || data[start * info.channels + 3] < 16) continue;
    const component = []; let head = 0; let tail = 0;
    let minX = info.width; let minY = info.height; let maxX = -1; let maxY = -1;
    queue[tail++] = start; visited[start] = 1;
    while (head < tail) {
      const index = queue[head++]; component.push(index);
      const x = index % info.width; const y = Math.floor(index / info.width);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (const [dx, dy] of neighbors) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || nx >= info.width || ny < 0 || ny >= info.height) continue;
        const next = ny * info.width + nx;
        if (!visited[next] && data[next * info.channels + 3] >= 16) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    components.push({ pixels: component, minX, minY, maxX, maxY });
  }
  const main = components.reduce((largest, component) => component.pixels.length > largest.pixels.length ? component : largest, { pixels: [] });
  for (const component of components) {
    if (component === main) continue;
    const nearMain = component.maxX >= main.minX - 40 && component.minX <= main.maxX + 40
      && component.maxY >= main.minY - 40 && component.minY <= main.maxY + 40;
    const touchesOuterEdge = component.minX < 20 || component.minY < 20 || component.maxX >= info.width - 20 || component.maxY >= info.height - 20;
    const separatedFromMain = component.maxX < main.minX - 40 || component.minX > main.maxX + 40
      || component.maxY < main.minY - 40 || component.minY > main.maxY + 40;
    // Keep sparks and rubble near the silhouette, but discard detached sheet
    // leftovers even when they are long thin strips rather than tiny specks.
    // Spawn sheets were assembled from several exports and may contain full
    // strips/limbs from an adjacent frame. Keep only the connected Colosso
    // silhouette; detached components are never valid animation content.
    if (component !== main) {
      for (const index of component.pixels) data[index * info.channels + 3] = 0;
    }
  }
}

function removeGreen(data, info) {
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const [red, green, blue] = data.subarray(offset, offset + 3);
    if (green > 150 && green > red * 1.3 && green > blue * 1.3) data[offset + 3] = 0;
  }
}

function removeLightChecker(data, info) {
  // Some image-generation exports encode the transparency preview as nearly
  // neutral white/grey squares. It is never part of the Colosso artwork and
  // must be cleared before measuring or anchoring Final Collapse frames.
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const [red, green, blue] = data.subarray(offset, offset + 3);
    if (red > 232 && green > 232 && blue > 232 && Math.max(red, green, blue) - Math.min(red, green, blue) < 14) {
      data[offset + 3] = 0;
    }
  }
}

function geometry(data, info) {
  let minX = info.width; let minY = info.height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * info.channels + 3] > 10) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY, width: Math.max(0, maxX - minX + 1), height: Math.max(0, maxY - minY + 1) };
}

async function authoredGeometry(source, cleanCorners = false) {
  const raw = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeGreen(raw.data, raw.info);
  if (source.includes(`${path.sep}finalCollapse${path.sep}`)) removeLightChecker(raw.data, raw.info);
  if (cleanCorners) removeCornerResidue(raw.data, raw.info);
  const box = geometry(raw.data, raw.info);
  const canvasSize = Math.max(raw.info.width, raw.info.height);
  return { ...box, metric: Math.sqrt((box.width / canvasSize) * (box.height / canvasSize)) };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] || 1;
}

const bakedSheetScale = new Map();
async function bakedScaleForState(state) {
  if (bakedSheetScale.has(state)) return bakedSheetScale.get(state);
  const reference = await sharp(path.join(sourceRoot, state, "frame0.png")).metadata();
  const root = curatedRootFor(state); const headTop = curatedHeadTopFor(state);
  const scale = curation.canonicalBodyHeightPx / ((root.y - headTop) * reference.height);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`${state}: cannot derive canonical baked scale`);
  bakedSheetScale.set(state, scale);
  return scale;
}

async function normalizeAuthoredFrame(source, destination, frameAnchor, cleanCorners = false, state = "") {
  const sourceRaw = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: sourceData, info: sourceInfo } = sourceRaw;
  removeGreen(sourceData, sourceInfo);
  if (state === "finalCollapse") removeLightChecker(sourceData, sourceInfo);
  if (cleanCorners) removeCornerResidue(sourceData, sourceInfo);
  const box = geometry(sourceData, sourceInfo);
  const root = curatedRootFor(state);
  const rootInSource = { x: root.x * sourceInfo.width, y: root.y * sourceInfo.height };
  // Scale around the curated foot root. Never compensate for an extended arm
  // by moving the full sprite: when a pose is too wide/tall, it is reduced
  // uniformly until its alpha bounds fit the fixed 768px canvas.
  const scale = await bakedScaleForState(state);
  const placement = getCuratedRootPlacement({ bounds: box, sourceRoot: rootInSource, targetRoot: finalRootPx, preferredScale: scale, margin: safetyMargin });
  if (Math.abs(placement.scale - scale) > .000001) throw new Error(`${state}: frame cannot fit canonical body scale without clipping; repair the source sheet padding instead`);
  const targetWidth = Math.max(1, Math.round(sourceInfo.width * scale));
  const targetHeight = Math.max(1, Math.round(sourceInfo.height * scale));
  const { data, info } = await sharp(sourceData, { raw: sourceInfo }).resize(targetWidth, targetHeight, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const scaledRoot = { x: root.x * info.width, y: root.y * info.height };
  const dx = Math.round(finalRootPx.x - scaledRoot.x);
  const dy = Math.round(finalRootPx.y - scaledRoot.y);
  const aligned = Buffer.alloc(768 * 768 * info.channels);
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    const targetX = x + dx; const targetY = y + dy;
    if (targetX < 0 || targetX >= 768 || targetY < 0 || targetY >= 768) continue;
    const sourceOffset = (y * info.width + x) * info.channels;
    data.copy(aligned, (targetY * 768 + targetX) * info.channels, sourceOffset, sourceOffset + info.channels);
  }
  const projectedRoot = { x: dx + scaledRoot.x, y: dy + scaledRoot.y };
  if (Math.abs(projectedRoot.x - finalRootPx.x) > 1 || Math.abs(projectedRoot.y - finalRootPx.y) > 1) throw new Error(`${state}: curated root projection drift exceeds 1px`);
  const output = sharp(aligned, { raw: { width: 768, height: 768, channels: info.channels } });
  // Preserve the subtle authored core-fade between death poses. Palette
  // quantization merged those distinct late frames back into duplicates.
  if (state === "death") await output.png({ compressionLevel: 9 }).toFile(destination);
  else await output.png({ palette: true, quality: 46, colours: 48, compressionLevel: 9 }).toFile(destination);
  return { anchor: { x: contentRoot.x, y: contentRoot.y, scale: 1 }, projection: { root: projectedRoot, scale } };
}

const frameAnchors = { ...manifest.frameAnchors };
const rootProjection = { ...(manifest.curation?.rootProjection || {}) };
for (const state of selectedStates) {
  const frames = required[state];
  const authoredFolder = path.join(sourceRoot, state);
  const runtimeFolder = path.join(runtimeRoot, state);
  await fs.mkdir(runtimeFolder, { recursive: true });
  frameAnchors[state] = [];
  rootProjection[state] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const sourceFrame = state === "death" ? deathSourceFrames[frame] : frame;
    const source = path.join(authoredFolder, `frame${sourceFrame}.png`);
    try { await fs.access(source); } catch { throw new Error(`Missing authored pose: ${source}`); }
    const smoothStates = new Set(["idle", "riftTelegraph", "riftAttack", "slamTelegraph", "slamAttack"]);
    // Death poses may legitimately contain separated arms as the body sags;
    // their source frames were already re-framed and audited. Do not erase
    // those authored pose differences as if they were corner debris.
    const normalized = await normalizeAuthoredFrame(source, path.join(runtimeFolder, `frame${frame}.png`), { x: contentRoot.x, y: contentRoot.y, scale: 1 }, smoothStates.has(state), state);
    frameAnchors[state][frame] = normalized.anchor;
    rootProjection[state][frame] = normalized.projection;
  }
}

for (const state of selectedStates) {
  const frames = required[state];
  manifest.animations[state] = {
    frames,
    frameMs: manifest.animationFrameMs?.[state] || frameMs[state] || (state === "death" ? 330 : 120),
    loop: state === "idle" || state === "coreExposed",
    ...(impact[state] || {}),
  };
}
manifest.frameAnchors = frameAnchors;
manifest.anchor = contentRoot;
manifest.frameAnchorStrategy = "curated-feet-v7";
manifest.curation = { version: curation.version, coordinateSpace: curation.coordinateSpace, canonicalBodyHeightPx: curation.canonicalBodyHeightPx, target: finalRootPx, states: curation.states, rootProjection };
const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
let manifestWriteError;
for (let attempt = 0; attempt < 5; attempt += 1) {
  try {
    await fs.writeFile(manifestPath, serializedManifest);
    manifestWriteError = undefined;
    break;
  } catch (error) {
    manifestWriteError = error;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
}
if (manifestWriteError) throw manifestWriteError;
console.log(`Processed ${selectedStates.reduce((total, state) => total + required[state], 0)} individually-authored Colosso frames.`);
