import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const generated = "C:/Users/Z565244/.codex/generated_images/019fbe55-66c3-7a51-ac2d-72cc352f97c1";
const sources = {
  idle: path.join(generated, "exec-eaa13c86-7d09-43fd-82b6-6c866d72b4f4.png"),
  moveLand: path.join(generated, "exec-84e3242b-bec0-4356-a532-731f2324dc51.png"),
  moveWater: path.join(generated, "exec-bd59770f-a850-4097-939a-ba1c9c8ae140.png"),
  attackClaw: path.join(generated, "exec-386a48bf-329e-4550-9471-e28537e245dc.png"),
  shellGuard: path.join(generated, "exec-f3b59051-5a5b-48e9-be10-9bd3b27a89fa.png"),
  hit: path.join(generated, "exec-3076ea51-7473-4c48-8752-8ebbdef6c89d.png"),
  death: path.join(generated, "exec-049ef766-10d8-494d-963f-bf858a367d4f.png"),
  spawnEmerge: path.join(generated, "exec-1ea25db0-9b37-4da9-a54d-a4d3ae66bcc7.png"),
};
const output = path.join(root, "src/game/assets/enemy/carapacaNereida");
const artOutput = path.join(root, "art/spritesheets/carapacaNereida");

function removeMagenta({ data, info }) {
  for (let pixel = 0; pixel < data.length; pixel += 4) {
    const [r, g, b] = data.subarray(pixel, pixel + 3);
    // Preserve the creature's blue/violet shading while keying the flat backdrop.
    if (r > 185 && b > 130 && g < 110 && r - g > 100) data[pixel + 3] = 0;
  }
  return { data, info };
}

async function sourceFrames(source) {
  const { width, height } = await sharp(source).metadata();
  const cellWidth = width;
  const cellHeight = height;
  const frames = [];
  for (let index = 0; index < 1; index += 1) {
    const left = 0;
    const top = 0;
    const raw = await sharp(source).extract({ left, top, width: cellWidth, height: cellHeight })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const keyed = removeMagenta(raw);
    const alpha = keyed.data.filter((_, i) => i % 4 === 3);
    let minX = keyed.info.width, minY = keyed.info.height, maxX = 0, maxY = 0;
    for (let y = 0; y < keyed.info.height; y += 1) for (let x = 0; x < keyed.info.width; x += 1) {
      if (alpha[y * keyed.info.width + x] > 25) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    }
    const crop = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    const trimmed = await sharp(keyed.data, { raw: keyed.info }).extract(crop).png().toBuffer();
    const fit = await sharp(trimmed).resize(224, 212, { fit: "inside", kernel: "nearest" }).png().toBuffer();
    const meta = await sharp(fit).metadata();
    frames.push(await sharp({ create: { width: 256, height: 256, channels: 4, background: "#00000000" } })
      .composite([{ input: fit, left: Math.round((256 - meta.width) / 2), top: 237 - meta.height }]).png({ palette: true }).toBuffer());
  }
  return frames[0];
}

const [idle, moveLand, moveWater, attackClaw, shellGuard, hit, death, spawnEmerge] = await Promise.all(Object.values(sources).map(sourceFrames));
const transparent = "#00000000";
const motion = {
  idle: { x: [0, 0, -1, 0, 1, 0, 0, 0], angle: [0, -.3, -.6, -.3, 0, .2, .4, .1], scale: [1, 1.006, 1.012, 1.008, 1, 1.004, 1.01, 1.003] },
  moveLand: { x: [0, -2, -3, -2, 0, 2, 3, 2], angle: [0, -.8, -1.2, -.5, 0, .7, 1.1, .5], scale: [1, .995, .99, .995, 1, .995, .99, .995] },
  moveWater: { x: [0, -2, -4, -5, -4, -2, 0, 1], angle: [-.8, -1.2, -1.6, -1.3, -.8, -.3, .2, -.3], scale: [.98, .975, .97, .968, .97, .975, .98, .98] },
  attackClaw: { x: [0, 2, 4, 6, -8, -6, -3, 0], angle: [0, .5, .9, 1.2, -2, -1.4, -.7, 0], scale: [1, 1.01, 1.025, 1.04, 1.06, 1.045, 1.02, 1] },
  shellGuard: { x: [0, 0, -1, -2, -2, -1, 0, 0], angle: [0, -.7, -1.2, -1.7, -2, -1.7, -1.2, -1.5], scale: [1, .99, .98, .975, .97, .97, .975, .975] },
  hit: { x: [0, 3, 6, 4, 1, -1, 0, 0], angle: [0, 1.6, 3, 2, .8, -.4, 0, 0], scale: [1, .985, .97, .978, .99, 1, 1, 1] },
  death: { x: [0, 2, 5, 8, 11, 13, 14, 14], angle: [0, 4, 9, 15, 21, 27, 32, 34], scale: [1, .99, .98, .97, .96, .95, .94, .94] },
  spawnEmerge: { x: [0, 0, 0, 0, 0, 0, 0, 0], angle: [0, -.5, -1, -1.2, -.8, -.4, 0, 0], scale: [.62, .70, .78, .85, .91, .96, .99, 1] },
};

async function makeAnimation(base, state) {
  const preset = motion[state];
  return Promise.all(preset.x.map(async (x, frame) => {
    const size = Math.min(248, Math.round(224 * preset.scale[frame]));
    const transformed = await sharp(base)
      .rotate(preset.angle[frame], { background: transparent })
      .resize(size, size, { fit: "contain", background: transparent })
      .png({ palette: true }).toBuffer();
    const meta = await sharp(transformed).metadata();
    return sharp({ create: { width: 256, height: 256, channels: 4, background: transparent } })
      .composite([{ input: transformed, left: Math.round((256 - meta.width) / 2) + x, top: 237 - meta.height }])
      .png({ palette: true }).toBuffer();
  }));
}
let states = {
  idle: makeAnimation(idle, "idle"),
  moveLand: makeAnimation(moveLand, "moveLand"),
  moveWater: makeAnimation(moveWater, "moveWater"),
  attackClaw: makeAnimation(attackClaw, "attackClaw"),
  shellGuard: makeAnimation(shellGuard, "shellGuard"),
  hit: makeAnimation(hit, "hit"),
  death: makeAnimation(death, "death"),
  spawnEmerge: makeAnimation(spawnEmerge, "spawnEmerge"),
};

// The 64 newest generated files are the one-pose sources produced in this
// order.  Each is normalized independently; no generated sprite sheet is cut.
const generatedFiles = await Promise.all((await fs.readdir(generated))
  .filter((name) => /^exec-.*\.png$/i.test(name))
  .map(async (name) => ({ name, mtime: (await fs.stat(path.join(generated, name))).mtimeMs })));
const newestSources = generatedFiles.sort((a, b) => a.mtime - b.mtime).slice(-64).map(({ name }) => path.join(generated, name));
// Generation order includes eight legacy hit sources between guard and death.
// Exclude that segment so the runtime receives only the seven supported states.
const activeSources = [...newestSources.slice(0, 40), ...newestSources.slice(48)];
const sourceOrder = ["attackClaw", "idle", "moveLand", "moveWater", "shellGuard", "death", "spawnEmerge"];
if (activeSources.length === 56) {
  states = Object.fromEntries(await Promise.all(sourceOrder.map(async (state, stateIndex) => {
    const frames = await Promise.all(activeSources.slice(stateIndex * 8, stateIndex * 8 + 8).map(sourceFrames));
    return [state, frames];
  })));
}

for (const [state, frames] of Object.entries(states)) {
  const dir = path.join(output, state);
  await fs.mkdir(dir, { recursive: true });
  const resolved = await frames;
  await Promise.all(resolved.map((frame, index) => fs.writeFile(path.join(dir, `frame${index}.png`), frame)));
  await fs.mkdir(artOutput, { recursive: true });
  await sharp({ create: { width: 2048, height: 256, channels: 4, background: "#00000000" } })
    .composite(resolved.map((input, index) => ({ input, left: index * 256, top: 0 }))).png({ palette: true }).toFile(path.join(artOutput, `carapaca-nereida-${state}.png`));
}
