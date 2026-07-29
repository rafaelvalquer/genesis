import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const ART_ROOT = path.join(ROOT, "art", "spritesheets", "droneSentinela");
const SOURCE = path.join(ART_ROOT, "drone-source-chroma.png");
const FRAME_ROOT = path.join(ROOT, "src", "game", "assets", "troop", "droneSentinela");
const PREVIEW_ROOT = path.join(ROOT, "artifacts", "drone-sentinela");
const FRAME_WIDTH = 256;
const FRAME_HEIGHT = 192;

async function transparentDrone() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = green - Math.max(red, blue);
    if (green > 120 && dominance > 28) {
      const alpha = Math.max(0, Math.min(255, 255 - (dominance - 28) * 4));
      data[offset + 3] = Math.min(data[offset + 3], alpha);
      data[offset + 1] = Math.min(green, Math.max(red, blue) + 18);
    }
  }
  return sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 82, height: 62, fit: "inside" })
    .png()
    .toBuffer();
}

function positions(level) {
  if (level === 1) return [{ x: 87, y: 59 }];
  if (level === 2) return [{ x: 50, y: 77 }, { x: 118, y: 41 }];
  return [{ x: 31, y: 85 }, { x: 143, y: 85 }, { x: 87, y: 31 }];
}

function svgOverlay(level, state, frame) {
  const sparks = state === "death" && frame >= 2
    ? Array.from({ length: level * 2 }, (_, index) => {
      const x = 76 + ((index * 41 + frame * 17) % 116);
      const y = 58 + ((index * 23 + frame * 13) % 75);
      return `<path d="M${x - 5} ${y} L${x + 5} ${y - 4}" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round"/>`;
    }).join("")
    : "";
  const shotsByLevel = { 1: [3], 2: [2, 5], 3: [1, 3, 5] };
  const flashIndex = shotsByLevel[level]?.indexOf(frame) ?? -1;
  const flashPositions = positions(level);
  const flash = state === "attack" && flashIndex >= 0
    ? `<circle cx="${flashPositions[flashIndex].x + 78}" cy="${flashPositions[flashIndex].y + 31}" r="13" fill="#e0f2fe" opacity=".95"/>
       <circle cx="${flashPositions[flashIndex].x + 78}" cy="${flashPositions[flashIndex].y + 31}" r="22" fill="#38bdf8" opacity=".3"/>`
    : "";
  return Buffer.from(
    `<svg width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${sparks}${flash}</svg>`,
  );
}

async function animatedDrone(base, state, frame, droneIndex) {
  const attackFrames = { 1: [3], 2: [2, 5], 3: [1, 3, 5] };
  let angle = Math.sin((frame + droneIndex * 2) / 8 * Math.PI * 2) * 1.6;
  let brightness = 1 + Math.sin((frame + droneIndex) / 8 * Math.PI * 2) * 0.04;
  if (state === "attack") {
    angle += frame < 4 ? -3 : 2;
    if (attackFrames[3].includes(frame)) brightness += 0.08;
  }
  if (state === "death") {
    angle += (droneIndex % 2 ? 1 : -1) * frame * 7;
    brightness = Math.max(0.25, 1 - frame * 0.1);
  }
  return sharp(base)
    .modulate({ brightness, saturation: state === "death" ? Math.max(0.15, 1 - frame * 0.12) : 1 })
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function renderFrame(base, level, state, frame) {
  const composites = [];
  const formation = positions(level);
  for (let index = 0; index < level; index += 1) {
    const bob = state === "idle"
      ? Math.round(Math.sin((frame + index * 2) / 8 * Math.PI * 2) * 4)
      : state === "death" ? frame * 7 + index * 3 : Math.round(Math.sin(frame / 8 * Math.PI) * 2);
    composites.push({
      input: await animatedDrone(base, state, frame, index),
      left: formation[index].x,
      top: formation[index].y + bob,
    });
  }
  composites.push({ input: svgOverlay(level, state, frame), left: 0, top: 0 });
  return sharp({
    create: {
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites).png().toBuffer();
}

async function main() {
  await fs.mkdir(ART_ROOT, { recursive: true });
  await fs.mkdir(PREVIEW_ROOT, { recursive: true });
  const base = await transparentDrone();
  await fs.writeFile(path.join(ART_ROOT, "drone-source.png"), base);
  for (let level = 1; level <= 3; level += 1) {
    for (const state of ["idle", "attack", "death"]) {
      const assetState = `${state}${level}`;
      const stateDir = path.join(FRAME_ROOT, assetState);
      await fs.mkdir(stateDir, { recursive: true });
      const frames = [];
      for (let frame = 0; frame < 8; frame += 1) {
        const rendered = await renderFrame(base, level, state, frame);
        frames.push(rendered);
        await fs.writeFile(path.join(stateDir, `frame${frame}.png`), rendered);
      }
      await sharp({
        create: {
          width: FRAME_WIDTH * 8,
          height: FRAME_HEIGHT,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).composite(frames.map((input, frame) => ({ input, left: frame * FRAME_WIDTH, top: 0 })))
        .png()
        .toFile(path.join(ART_ROOT, `${assetState}.png`));
      if (state === "idle") {
        await sharp(frames[0])
          .extend({
            top: 32, bottom: 32, left: 32, right: 32,
            background: { r: 5, g: 20, b: 35, alpha: 1 },
          })
          .png()
          .toFile(path.join(PREVIEW_ROOT, `formacao-${level}-drones.png`));
      }
    }
  }
}

await main();
