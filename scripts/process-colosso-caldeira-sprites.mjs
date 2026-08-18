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
const impact = { riftAttack: { impactFrame: 3, impactMs: 377 }, slamAttack: { impactFrame: 4, impactMs: 527 }, fractureAttack: { impactFrame: 3, impactMs: 798 }, seismicAttack: { impactFrame: 3, impactMs: 630 } };
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

function keepLargestAlphaComponent(data, info) {
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let largest = [];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || data[start * info.channels + 3] < 16) continue;
    const component = []; let head = 0; let tail = 0;
    queue[tail++] = start; visited[start] = 1;
    while (head < tail) {
      const index = queue[head++]; component.push(index);
      const x = index % info.width; const y = Math.floor(index / info.width);
      for (const [dx, dy] of neighbors) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || nx >= info.width || ny < 0 || ny >= info.height) continue;
        const next = ny * info.width + nx;
        if (!visited[next] && data[next * info.channels + 3] >= 16) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const keep = new Uint8Array(pixelCount);
  for (const index of largest) keep[index] = 1;
  for (let index = 0; index < pixelCount; index += 1) if (!keep[index]) data[index * info.channels + 3] = 0;
}

async function normalizeAuthoredFrame(source, destination, trimContent = false) {
  const sourceRaw = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: sourceData, info: sourceInfo } = sourceRaw;
  for (let offset = 0; offset < sourceData.length; offset += sourceInfo.channels) {
    const [red, green, blue] = sourceData.subarray(offset, offset + 3);
    if (green > 150 && green > red * 1.3 && green > blue * 1.3) sourceData[offset + 3] = 0;
  }
  if (trimContent) keepLargestAlphaComponent(sourceData, sourceInfo);
  let sourcePipeline = sharp(sourceData, { raw: sourceInfo });
  if (trimContent) sourcePipeline = sourcePipeline.trim({ background: transparent, threshold: 12 });
  const { data, info } = await sourcePipeline.resize(720, 720, { fit: "contain", background: transparent })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: transparent })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width; let minY = info.height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * info.channels + 3] > 10) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  const anchor = manifest.anchor || { x: .68, y: .72 };
  const aligned = Buffer.alloc(data.length);
  if (maxX >= 0) {
    const sourceAnchorX = minX + (maxX - minX) * anchor.x;
    const sourceAnchorY = minY + (maxY - minY) * anchor.y;
    const dx = Math.round(768 * anchor.x - sourceAnchorX);
    const dy = Math.round(768 * anchor.y - sourceAnchorY);
    for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
      const targetX = x + dx; const targetY = y + dy;
      if (targetX < 0 || targetX >= 768 || targetY < 0 || targetY >= 768) continue;
      const sourceOffset = (y * info.width + x) * info.channels;
      data.copy(aligned, (targetY * 768 + targetX) * info.channels, sourceOffset, sourceOffset + info.channels);
    }
  }
  await sharp(aligned, { raw: { width: 768, height: 768, channels: info.channels } })
    .png({ palette: true, quality: 46, colours: 48, compressionLevel: 9 }).toFile(destination);
}

for (const [state, frames] of Object.entries(required)) {
  const authoredFolder = path.join(sourceRoot, state);
  const runtimeFolder = path.join(runtimeRoot, state);
  await fs.mkdir(runtimeFolder, { recursive: true });
  for (let frame = 0; frame < frames; frame += 1) {
    const sourceFrame = state === "death" && frame === 13 ? 12 : frame;
    const source = path.join(authoredFolder, `frame${sourceFrame}.png`);
    try { await fs.access(source); } catch { throw new Error(`Missing authored pose: ${source}`); }
    await normalizeAuthoredFrame(source, path.join(runtimeFolder, `frame${frame}.png`), state === "death");
  }
}

manifest.animations = Object.fromEntries(Object.entries(required).map(([state, frames]) => [state, {
  frames,
  frameMs: manifest.animationFrameMs?.[state] || (state === "death" ? 330 : 120),
  loop: state === "idle" || state === "coreExposed",
  ...(impact[state] || {}),
}]));
manifest.frameAnchors = Object.fromEntries(Object.entries(required).map(([state, frames]) => [
  state,
  Array.from({ length: frames }, () => ({ x: manifest.anchor?.x ?? .68, y: manifest.anchor?.y ?? .72, scale: 1 })),
]));
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Processed ${Object.values(required).reduce((total, frames) => total + frames, 0)} individually-authored Colosso frames.`);
