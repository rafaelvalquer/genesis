import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("art/source/interceptadorIcaro/v2");
const masterFile = path.resolve("art/source/interceptadorIcaro/master-v2-clean.png");
const idle = path.join(root, "idle");
const layers = path.join(root, "layers");
const canvas = 1254;
const breath = [0, 1, 2, 3, 2, 1, 0, 0];

await Promise.all([fs.mkdir(idle, { recursive: true }), fs.mkdir(layers, { recursive: true })]);
await fs.copyFile(masterFile, path.join(root, "master.png"));
const master = await sharp(masterFile).ensureAlpha().png().toBuffer();
const pieces = {
  backpack: [0, 75, 430, 650], wingUpper: [40, 75, 300, 330], wingLower: [0, 325, 350, 390],
  pelvis: [285, 655, 420, 150], thighLeft: [255, 720, 250, 300], thighRight: [490, 720, 245, 300],
  shinLeft: [175, 940, 300, 300], shinRight: [500, 940, 300, 300], footLeft: [150, 1135, 310, 119], footRight: [535, 1135, 300, 119],
  torso: [235, 300, 545, 405], shoulderLeft: [205, 340, 220, 240], shoulderRight: [640, 365, 160, 185],
  armLeft: [190, 410, 390, 300], armRight: [585, 430, 260, 280], weapon: [420, 430, 815, 300],
  neck: [455, 270, 185, 120], head: [370, 20, 340, 350], hair: [370, 20, 340, 155], eyeBionico: [540, 160, 100, 85],
};
for (const [name, [left, top, width, height]] of Object.entries(pieces)) await sharp(master).extract({ left, top, width, height }).png().toFile(path.join(layers, `${name}.png`));
const get = (name) => fs.readFile(path.join(layers, `${name}.png`));
const lower = await sharp(master).extract({ left: 0, top: 680, width: canvas, height: canvas - 680 }).png().toBuffer();
const wings = await get("backpack"), torso = await get("torso"), head = await get("head");
const arms = await sharp(master).extract({ left: 175, top: 385, width: 1060, height: 325 }).png().toBuffer();
for (let frame = 0; frame < 8; frame += 1) {
  const amount = breath[frame] * 4;
  const torsoBreathing = await sharp(torso).resize({ width: 545, height: 405 + amount, kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const rendered = await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
    { input: lower, left: 0, top: 680 },
    { input: wings, left: 0, top: 75 - Math.round(amount * 0.15) },
    { input: torsoBreathing, left: 235, top: 300 - amount },
    { input: arms, left: 175, top: 385 - Math.round(amount * 0.72) },
    { input: head, left: 370, top: 20 - Math.round(amount * 0.25) },
  ]).png({ compressionLevel: 9, effort: 10 }).toBuffer();
  await fs.writeFile(path.join(idle, `frame${frame}.png`), rendered);
}
await fs.writeFile(path.join(root, "rig.json"), `${JSON.stringify({ canvas: { width: canvas, height: canvas, transparent: true }, root: { name: "feet", x: 627, y: 1253 }, hierarchy: ["feet > shin > thigh > pelvis", "pelvis > torso > shoulders > arms > weapon", "torso > neck > head > hair > eyeBionico", "pelvis > backpack > wings"], idle: { frameMs: 130, chestYOffsetRuntime: breath.map((value) => -value), torsoScaleY: [1, 1.004, 1.008, 1.012, 1.009, 1.005, 1.002, 1] } }, null, 2)}\n`);
console.log("Rig v2 do idle do Ícaro reconstruído em alta resolução.");
