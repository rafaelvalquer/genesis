import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "tools", "source-art", "convoy");
const outputDir = path.join(root, "src", "game", "assets", "convoy");

export const CONVOY_VEHICLES = [
  "tr7_pioneiro", "tr7r_peregrino", "tr7a_bastilha", "tr7f_ferrum",
  "tr9_atlas", "tr9p_vertice", "tr9s_sobrevivente", "trx_exodo",
];

const states = {
  idle: { count: 6, y: [0, -1, -2, -1, 0, 1] },
  run: { count: 8, y: [1, -1, -2, 0, 1, -1, -2, 0] },
  destroyed_transition: { count: 10 },
  destroyed_loop: { count: 6, y: [2, 3, 2, 3, 2, 3] },
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function beaconSvg(frame, state) {
  const opacity = state === "destroyed_transition" || state === "destroyed_loop"
    ? 0
    : state === "run" ? .42 + (frame % 2) * .32 : .3 + (frame % 3) * .16;
  return `<svg width="1024" height="512" xmlns="http://www.w3.org/2000/svg">
    <circle cx="760" cy="236" r="${12 + (frame % 3) * 3}" fill="#67e8f9" opacity="${opacity}"/>
    <circle cx="760" cy="236" r="4" fill="#dffcff" opacity="${Math.min(1, opacity + .28)}"/>
  </svg>`;
}

async function createFrame(master, vehicleId, state, frame) {
  const spec = states[state];
  const progress = frame / Math.max(1, spec.count - 1);
  const destroyed = state.startsWith("destroyed");
  const angle = state === "destroyed_transition" ? progress * 9 : state === "destroyed_loop" ? 9 : 0;
  const shiftX = state === "run" ? (frame % 2 ? 1 : -1) : destroyed ? -progress * 7 : 0;
  const shiftY = state === "destroyed_transition" ? progress * 16 : spec.y?.[frame] || 0;
  const body = master.clone()
    .modulate(destroyed ? { brightness: .68, saturation: .18 } : { brightness: 1, saturation: 1 })
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
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

async function generateVehicle(vehicleId) {
  const source = path.join(sourceDir, `${vehicleId}.png`);
  const master = sharp(source)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({ width: 850, height: 350, fit: "contain", withoutEnlargement: true })
    .png();
  for (const [state, spec] of Object.entries(states)) {
    for (let frame = 0; frame < spec.count; frame += 1) await createFrame(master, vehicleId, state, frame);
  }
}

for (const vehicleId of CONVOY_VEHICLES) {
  await generateVehicle(vehicleId);
  console.log(`Generated convoy frames for ${vehicleId}.`);
}
