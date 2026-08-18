import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const runtimeRoot = path.resolve("src/game/assets/enemy/colossoCaldeira");
const sourceRoot = path.resolve("src/game/assets-source/enemy/colossoCaldeira");
const manifestPath = path.join(runtimeRoot, "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const required = {
  spawnAwakening: 12, idle: 8, riftTelegraph: 6, riftAttack: 6,
  slamTelegraph: 6, slamAttack: 8, fractureTelegraph: 8, fractureAttack: 8,
  seismicTelegraph: 8, seismicAttack: 8, phaseTransition2: 10, phaseTransition3: 10,
  finalCollapse: 12, coreExposed: 8, death: 14,
};
const impact = { riftAttack: { impactFrame: 3, impactMs: 520 }, slamAttack: { impactFrame: 4, impactMs: 720 }, fractureAttack: { impactFrame: 4, impactMs: 798 }, seismicAttack: { impactFrame: 3, impactMs: 630 } };
const frameMs = { idle: 190, riftTelegraph: 185, riftAttack: 220, slamTelegraph: 185, slamAttack: 220, coreExposed: 110 };
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const contentRoot = manifest.anchor || { x: .68, y: .72 };
const isCalibratedV5 = manifest.frameAnchorStrategy === "calibrated-v5" && !process.argv.includes("--recalibrate");

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
  if (cleanCorners) removeCornerResidue(raw.data, raw.info);
  const box = geometry(raw.data, raw.info);
  const canvasSize = Math.max(raw.info.width, raw.info.height);
  return { ...box, metric: Math.sqrt((box.width / canvasSize) * (box.height / canvasSize)) };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] || 1;
}

async function calibrationForState(state, frames) {
  const authoredFolder = path.join(sourceRoot, state);
  const boxes = await Promise.all(Array.from({ length: frames }, async (_, frame) => {
    const sourceFrame = state === "death" && frame === 13 ? 12 : frame;
    return authoredGeometry(path.join(authoredFolder, `frame${sourceFrame}.png`), state === "death");
  }));
  const baseline = median(boxes.map((box) => box.metric));
  const anchors = boxes.map((box, frame) => {
    const stored = isCalibratedV5 ? manifest.frameAnchors?.[state]?.[frame] : null;
    if (stored) return stored;
    // Death intentionally changes silhouette size; all other states receive a small,
    // bounded correction so pose padding never becomes a visible scale jump.
    const scale = state === "death" ? 1 : Math.max(.96, Math.min(1.04, baseline / Math.max(.001, box.metric)));
    return { x: contentRoot.x, y: contentRoot.y, scale: Number(scale.toFixed(4)) };
  });
  if (state === "death" || isCalibratedV5) return anchors;
  return anchors.reduce((smoothed, anchor) => {
    const previous = smoothed.at(-1);
    smoothed.push(!previous ? anchor : { ...anchor, scale: Number(Math.max(previous.scale - .04, Math.min(previous.scale + .04, anchor.scale)).toFixed(4)) });
    return smoothed;
  }, []);
}

async function normalizeAuthoredFrame(source, destination, frameAnchor, cleanCorners = false, state = "") {
  const sourceRaw = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: sourceData, info: sourceInfo } = sourceRaw;
  removeGreen(sourceData, sourceInfo);
  if (cleanCorners) removeCornerResidue(sourceData, sourceInfo);
  // The original spawn sheet had three foreign cels laid across the upper
  // edge of frames 4–6. They are outside the Colosso silhouette and must not
  // survive the cut, even when antialiasing accidentally joins them.
  if (state === "spawnAwakening" && frameAnchor && [4, 5, 6].includes(Number(path.basename(source, ".png").replace("frame", "")))) {
    for (let y = 0; y < 56; y += 1) for (let x = 0; x < sourceInfo.width; x += 1) {
      sourceData[(y * sourceInfo.width + x) * sourceInfo.channels + 3] = 0;
    }
  }
  // Spawn poses have a wider awakening silhouette; give them a little more
  // safety padding before applying the fixed root anchor.
  const contentSize = state === "spawnAwakening" ? 660 : 720;
  const border = (768 - contentSize) / 2;
  const { data, info } = await sharp(sourceData, { raw: sourceInfo }).resize(contentSize, contentSize, { fit: "contain", background: transparent })
    .extend({ top: border, bottom: border, left: border, right: border, background: transparent })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width; let minY = info.height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * info.channels + 3] > 10) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  const aligned = Buffer.alloc(data.length);
  let actualAnchor = frameAnchor;
  if (maxX >= 0) {
    const sourceAnchorX = minX + (maxX - minX) * contentRoot.x;
    const sourceAnchorY = minY + (maxY - minY) * contentRoot.y;
    let dx = Math.round(768 * frameAnchor.x - sourceAnchorX);
    let dy = Math.round(768 * frameAnchor.y - sourceAnchorY);
    // Never let an authored pose clip against the fixed canvas. Keeping a
    // small transparent safety margin is preferable to losing hands, feet or
    // head pixels when an AI sheet uses a slightly wider silhouette.
    dx = Math.min(Math.max(dx, 2 - minX), 765 - maxX);
    dy = Math.min(Math.max(dy, 2 - minY), 765 - maxY);
    actualAnchor = { ...frameAnchor, x: Number(((sourceAnchorX + dx) / 768).toFixed(5)), y: Number(((sourceAnchorY + dy) / 768).toFixed(5)) };
    for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
      const targetX = x + dx; const targetY = y + dy;
      if (targetX < 0 || targetX >= 768 || targetY < 0 || targetY >= 768) continue;
      const sourceOffset = (y * info.width + x) * info.channels;
      data.copy(aligned, (targetY * 768 + targetX) * info.channels, sourceOffset, sourceOffset + info.channels);
    }
  }
  await sharp(aligned, { raw: { width: 768, height: 768, channels: info.channels } })
    .png({ palette: true, quality: 46, colours: 48, compressionLevel: 9 }).toFile(destination);
  // Re-measure the encoded frame. Palette quantization can alter the outer
  // alpha boundary by a pixel or two; store the anchor that exactly maps the
  // final bounding box to the canonical canvas point so the audit and runtime
  // use the same geometry.
  const encoded = await sharp(destination).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let outMinX = encoded.info.width; let outMinY = encoded.info.height;
  let outMaxX = -1; let outMaxY = -1;
  for (let y = 0; y < encoded.info.height; y += 1) for (let x = 0; x < encoded.info.width; x += 1) {
    if (encoded.data[(y * encoded.info.width + x) * encoded.info.channels + 3] > 10) {
      outMinX = Math.min(outMinX, x); outMinY = Math.min(outMinY, y);
      outMaxX = Math.max(outMaxX, x); outMaxY = Math.max(outMaxY, y);
    }
  }
  if (outMaxX >= 0) {
    const spanX = outMaxX - outMinX; const spanY = outMaxY - outMinY;
    const anchorX = spanX >= 768 ? actualAnchor.x : outMinX / Math.max(1, 768 - spanX);
    const anchorY = spanY >= 768 ? actualAnchor.y : outMinY / Math.max(1, 768 - spanY);
    return { ...actualAnchor, x: Number(anchorX.toFixed(5)), y: Number(anchorY.toFixed(5)) };
  }
  return actualAnchor;
}

const frameAnchors = {};
for (const [state, frames] of Object.entries(required)) {
  const authoredFolder = path.join(sourceRoot, state);
  const runtimeFolder = path.join(runtimeRoot, state);
  await fs.mkdir(runtimeFolder, { recursive: true });
  const calibration = await calibrationForState(state, frames);
  frameAnchors[state] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const sourceFrame = state === "death" && frame === 13 ? 12 : frame;
    const source = path.join(authoredFolder, `frame${sourceFrame}.png`);
    try { await fs.access(source); } catch { throw new Error(`Missing authored pose: ${source}`); }
    const smoothStates = new Set(["idle", "riftTelegraph", "riftAttack", "slamTelegraph", "slamAttack"]);
    frameAnchors[state][frame] = await normalizeAuthoredFrame(source, path.join(runtimeFolder, `frame${frame}.png`), calibration[frame], state === "death" || state === "spawnAwakening" || smoothStates.has(state), state);
  }
}

manifest.animations = Object.fromEntries(Object.entries(required).map(([state, frames]) => [state, {
  frames,
  frameMs: manifest.animationFrameMs?.[state] || frameMs[state] || (state === "death" ? 330 : 120),
  loop: state === "idle" || state === "coreExposed",
  ...(impact[state] || {}),
}]));
manifest.frameAnchors = frameAnchors;
manifest.frameAnchorStrategy = "calibrated-v5";
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Processed ${Object.values(required).reduce((total, frames) => total + frames, 0)} individually-authored Colosso frames.`);
