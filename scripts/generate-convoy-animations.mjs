import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "tools", "source-art", "convoy");
const outputDir = path.join(root, "src", "game", "assets", "convoy");

export const CONVOY_VEHICLE_ID = "trg_dinamo";

const states = {
  idle: { count: 8, y: [0, -1, -2, -2, -1, 0, 1, 0] },
  energy_spawn: { count: 10, y: [0, -1, -2, -2, -3, 2, -1, 0, 1, 0] },
};

function pad(value) {
  return String(value).padStart(2, "0");
}

async function removeBakedBackdrop(file) {
  const image = sharp(file).ensureAlpha(); const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height); const queue = [];
  const background = (index) => { const r=data[index], g=data[index+1], b=data[index+2]; const max=Math.max(r,g,b), min=Math.min(r,g,b); return max < 24 || (min > 190 && max - min < 28); };
  const visit = (x, y) => { const p=y*info.width+x; if (visited[p]) return; visited[p]=1; const i=p*4; if (!background(i)) return; data[i+3]=0; queue.push([x,y]); };
  for (let x=0;x<info.width;x+=1) { visit(x,0); visit(x,info.height-1); }
  for (let y=1;y<info.height-1;y+=1) { visit(0,y); visit(info.width-1,y); }
  while (queue.length) { const [x,y]=queue.pop(); if(x)visit(x-1,y); if(x+1<info.width)visit(x+1,y); if(y)visit(x,y-1); if(y+1<info.height)visit(x,y+1); }
  return sharp(data,{raw:info}).png();
}

function beaconSvg(frame, state) {
  if (state === "energy_spawn") {
    const charge = [.2, .3, .45, .65, .9, 1, .75, .55, .35, .2][frame];
    const orb = [0, 0, 0, 0, 10, 38, 29, 17, 0, 0][frame];
    const orbY = [218, 218, 218, 218, 210, 196, 176, 158, 218, 218][frame];
    const arcs = frame >= 2 && frame <= 7 ? `<path d="M470 242 L500 214 L520 234 L548 198 L575 222" fill="none" stroke="#dffcff" stroke-width="${2 + charge * 3}" opacity="${charge}"/><path d="M585 242 L558 216 L540 238 L520 203 L495 225" fill="none" stroke="#67e8f9" stroke-width="${1 + charge * 2}" opacity="${charge * .9}"/>` : "";
    const orbSvg = orb ? `<circle cx="530" cy="${orbY}" r="${orb + 15}" fill="#22d3ee" opacity="${charge * .16}"/><circle cx="530" cy="${orbY}" r="${orb}" fill="#67e8f9" opacity="${Math.min(1, charge + .1)}"/><circle cx="530" cy="${orbY}" r="${Math.max(3, orb * .42)}" fill="#fff"/>` : "";
    return `<svg width="1024" height="512" xmlns="http://www.w3.org/2000/svg">${arcs}${orbSvg}<circle cx="530" cy="218" r="${10 + charge * 18}" fill="#67e8f9" opacity="${.16 + charge * .28}"/><circle cx="530" cy="218" r="${4 + charge * 7}" fill="#dffcff" opacity="${.45 + charge * .45}"/></svg>`;
  }
  const progress = .3 + (frame % 3) * .16;
  const opacity = .24 + progress * .72;
  return `<svg width="1024" height="512" xmlns="http://www.w3.org/2000/svg">
    <circle cx="530" cy="218" r="${12 + (frame % 3) * 3}" fill="#67e8f9" opacity="${opacity}"/>
    <circle cx="530" cy="218" r="4" fill="#dffcff" opacity="${Math.min(1, opacity + .28)}"/>
  </svg>`;
}

async function createFrame(master, vehicleId, state, frame) {
  const spec = states[state];
  const shiftX = 0;
  const shiftY = spec.y?.[frame] || 0;
  let hero = master;
  if (state === "energy_spawn") {
    const source = path.join(sourceDir, `${CONVOY_VEHICLE_ID}_energy_spawn_${pad(frame)}.png`);
    hero = await removeBakedBackdrop(source);
    hero = hero
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
      .resize({ width: 850, height: 350, fit: "contain", withoutEnlargement: true, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();
  }
  const body = hero.clone()
    .modulate({ brightness: 1, saturation: 1 })
    .png();
  const bodyBuffer = await body.toBuffer();
  const file = path.join(outputDir, vehicleId, state, `${vehicleId}_${state}_${pad(frame)}.webp`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp({ create: { width: 1024, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: bodyBuffer, left: Math.round(87 + shiftX), top: Math.round(76 + shiftY) },
      ...(state === "energy_spawn" ? [] : [{ input: Buffer.from(beaconSvg(frame, state)), left: 0, top: 0 }]),
    ])
    .webp({ quality: 88, alphaQuality: 100, effort: 5 })
    .toFile(file);
}

async function generateVehicle() {
  const source = path.join(sourceDir, `${CONVOY_VEHICLE_ID}_energy_spawn_09.png`);
  const master = (await removeBakedBackdrop(source))
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({ width: 850, height: 350, fit: "contain", withoutEnlargement: true, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png();
  for (const [state, spec] of Object.entries(states)) {
    for (let frame = 0; frame < spec.count; frame += 1) await createFrame(master, CONVOY_VEHICLE_ID, state, frame);
  }
}

await generateVehicle();
console.log(`Generated convoy frames for ${CONVOY_VEHICLE_ID}.`);
