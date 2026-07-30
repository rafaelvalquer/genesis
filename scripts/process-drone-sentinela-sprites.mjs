import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const ART_ROOT = path.join(ROOT, "art", "spritesheets", "droneSentinela");
const SOURCE = path.join(ART_ROOT, "drone-source-chroma.png");
const FRAME_ROOT = path.join(ROOT, "src", "game", "assets", "troop", "droneSentinela");
const PREVIEW_ROOT = path.join(ROOT, "artifacts", "drone-sentinela");
const FRAME_WIDTH = 512;
const FRAME_HEIGHT = 384;
const VISUAL_CENTER_X = 175;
const VISUAL_TOP = 25;
const STATES = ["idle", "attack", "death"];

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
    if (dominance > 4) {
      const alpha = Math.max(0, Math.min(255, 255 - (dominance - 4) * 6));
      data[offset + 3] = Math.min(data[offset + 3], alpha);
      data[offset + 1] = Math.min(green, Math.max(red, blue));
    }
  }
  return sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 350, height: 276, fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png({ palette: false, compressionLevel: 9 })
    .toBuffer();
}

function svgOverlay(state, frame) {
  const sparks = state === "death" && frame >= 2
    ? Array.from({ length: 4 }, (_, index) => {
      const x = 145 + ((index * 61 + frame * 23) % 150);
      const y = 118 + ((index * 31 + frame * 17) % 105);
      return `<path d="M${x - 7} ${y + 4} L${x + 7} ${y - 5}" stroke="#7dd3fc" stroke-width="4" stroke-linecap="round"/>`;
    }).join("")
    : "";
  const flash = state === "attack" && frame === 3
    ? `<circle cx="348" cy="184" r="10" fill="#e0f2fe" opacity=".95"/>
       <circle cx="348" cy="184" r="18" fill="#38bdf8" opacity=".3"/>`
    : "";
  return Buffer.from(
    `<svg width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${sparks}${flash}</svg>`,
  );
}

async function animatedDrone(base, state, frame) {
  let angle = Math.sin(frame / 8 * Math.PI * 2) * 1.6;
  let brightness = 1 + Math.sin(frame / 8 * Math.PI * 2) * 0.04;
  if (state === "attack") {
    angle += frame < 4 ? -3 : 2;
    if (frame === 3) brightness += 0.12;
  }
  if (state === "death") {
    angle += frame * 7;
    brightness = Math.max(0.25, 1 - frame * 0.1);
  }
  return sharp(base)
    .modulate({
      brightness,
      saturation: state === "death" ? Math.max(0.15, 1 - frame * 0.12) : 1,
    })
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({
      width: 460,
      height: state === "death" ? Math.max(210, 300 - frame * 8) : 300,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ palette: false, compressionLevel: 9 })
    .toBuffer();
}

async function renderFrame(base, state, frame) {
  const animated = await animatedDrone(base, state, frame);
  const metadata = await sharp(animated).metadata();
  const bob = state === "idle"
    ? Math.round(Math.sin(frame / 8 * Math.PI * 2) * 5)
    : state === "death"
      ? frame * 8
      : Math.round(Math.sin(frame / 8 * Math.PI) * 2);
  return sharp({
    create: {
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    {
      input: animated,
      left: Math.max(0, Math.min(
        FRAME_WIDTH - metadata.width,
        Math.round(VISUAL_CENTER_X - metadata.width / 2),
      )),
      top: Math.max(0, Math.min(FRAME_HEIGHT - metadata.height, VISUAL_TOP + bob)),
    },
    { input: svgOverlay(state, frame), left: 0, top: 0 },
  ]).png({ palette: false, compressionLevel: 9 }).toBuffer();
}

async function validateFrame(framePath) {
  const metadata = await sharp(framePath).metadata();
  if (
    metadata.width !== FRAME_WIDTH
    || metadata.height !== FRAME_HEIGHT
    || !metadata.hasAlpha
    || metadata.isPalette
  ) {
    throw new Error(`invalid individual drone frame: ${framePath}`);
  }
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
  if (corners.some((pixel) => data[pixel * 4 + 3] !== 0)) {
    throw new Error(`opaque corner: ${framePath}`);
  }
}

async function main() {
  await fs.mkdir(ART_ROOT, { recursive: true });
  await fs.mkdir(PREVIEW_ROOT, { recursive: true });
  const base = await transparentDrone();
  await fs.writeFile(path.join(ART_ROOT, "drone-source.png"), base);

  let idlePreview = null;
  for (const state of STATES) {
    const stateDir = path.join(FRAME_ROOT, state);
    await fs.mkdir(stateDir, { recursive: true });
    const frames = [];
    for (let frame = 0; frame < 8; frame += 1) {
      const rendered = await renderFrame(base, state, frame);
      const outputPath = path.join(stateDir, `frame${frame}.png`);
      frames.push(rendered);
      await fs.writeFile(outputPath, rendered);
      await validateFrame(outputPath);
    }
    if (state === "idle") idlePreview = frames[0];
    await sharp({
      create: {
        width: FRAME_WIDTH * 4,
        height: FRAME_HEIGHT * 2,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite(frames.map((input, frame) => ({
      input,
      left: (frame % 4) * FRAME_WIDTH,
      top: Math.floor(frame / 4) * FRAME_HEIGHT,
    })))
      .png({ palette: false, compressionLevel: 9 })
      .toFile(path.join(ART_ROOT, `${state}.png`));
  }

  await sharp(idlePreview)
    .extend({
      top: 32, bottom: 32, left: 32, right: 32,
      background: { r: 5, g: 20, b: 35, alpha: 1 },
    })
    .png()
    .toFile(path.join(PREVIEW_ROOT, "drone-individual.png"));
  console.log("Drone Sentinela: 24 RGBA truecolor frames individuais, 512x384.");
}

await main();
