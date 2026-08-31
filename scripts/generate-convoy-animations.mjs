import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "tools", "source-art", "convoy");
const outputDir = path.join(root, "src", "game", "assets", "convoy");

export const CONVOY_VEHICLE_ID = "trg_dinamo";

const states = {
  idle: { count: 8, y: [0, -1, -2, -2, -1, 0, 1, 0] },
  energy_spawn: { count: 10 },
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function beaconSvg(frame, state) {
  const progress = state === "energy_spawn" ? Math.sin((frame / 9) * Math.PI) : .3 + (frame % 3) * .16;
  const opacity = .24 + progress * .72;
  return `<svg width="1024" height="512" xmlns="http://www.w3.org/2000/svg">
    <circle cx="760" cy="236" r="${12 + (frame % 3) * 3}" fill="#67e8f9" opacity="${opacity}"/>
    <circle cx="760" cy="236" r="4" fill="#dffcff" opacity="${Math.min(1, opacity + .28)}"/>
  </svg>`;
}

async function createFrame(master, vehicleId, state, frame) {
  const spec = states[state];
  const shiftX = 0;
  const shiftY = spec.y?.[frame] || 0;
  const body = master.clone()
    .modulate({ brightness: 1, saturation: 1 })
    .png();
  const bodyBuffer = await body.toBuffer();
  const file = path.join(outputDir, vehicleId, state, `${vehicleId}_${state}_${pad(frame)}.webp`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp({ create: { width: 1024, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: bodyBuffer, left: Math.round(87 + shiftX), top: Math.round(76 + shiftY) },
      { input: Buffer.from(beaconSvg(frame, state)), left: 0, top: 0 },
    ])
    .webp({ quality: 88, alphaQuality: 100, effort: 5 })
    .toFile(file);
}

async function generateVehicle() {
  const source = path.join(sourceDir, `${CONVOY_VEHICLE_ID}.png`);
  const master = sharp(source)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({ width: 850, height: 350, fit: "contain", withoutEnlargement: true })
    .png();
  for (const [state, spec] of Object.entries(states)) {
    for (let frame = 0; frame < spec.count; frame += 1) await createFrame(master, CONVOY_VEHICLE_ID, state, frame);
  }
}

await generateVehicle();
console.log(`Generated convoy frames for ${CONVOY_VEHICLE_ID}.`);
