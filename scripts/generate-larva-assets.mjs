import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../src/game/assets/", import.meta.url));
const source = "C:/Users/Z565244/.codex/generated_images/01a03aa6-4a33-78a3-b005-a6819f5db28e/exec-7ec22b53-a2c7-4127-8643-0c47254ca409.png";
const enemyRoot = `${root}/enemy/larvaRaizFerro`;
const concept = `${root}/enemy/concepts/larvaRaizFerro.webp`;
const states = { idle: 6, walking: 8, attack: 6, emerge: 8, death: 6 };

await mkdir(`${root}/enemy/concepts`, { recursive: true });
await sharp(source).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88 }).toFile(concept);

const base = sharp(source).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
const render = async (state, frame, count) => {
  const progress = count <= 1 ? 0 : frame / (count - 1);
  const angles = {
    idle: [0, -1, 1, 2, -1, 0], walking: [-2, -1, 0, 1, 2, 1, 0, -1],
    attack: [0, -2, -5, 3, 2, 0], emerge: [0, -2, -1, 0, 1, 1, 0, 0], death: [0, 2, 7, 14, 18, 20],
  };
  const scales = state === "emerge" ? [.28, .42, .56, .68, .8, .92, 1, 1]
    : state === "death" ? [1, 1, .98, .94, .9, .86] : Array(count).fill(1);
  const width = Math.round(390 * scales[frame]);
  let image = base.clone().resize({ width, fit: "inside" }).rotate(angles[state][frame], { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const rendered = await image.png().toBuffer();
  const meta = await sharp(rendered).metadata();
  const left = Math.round((512 - meta.width) / 2);
  const baseline = state === "emerge" ? 425 - Math.round(progress * 20) : state === "death" ? 410 + Math.round(progress * 8) : 405;
  const top = Math.max(0, baseline - meta.height);
  return sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: rendered, left, top }]).png().toBuffer();
};

for (const [state, count] of Object.entries(states)) {
  await mkdir(`${enemyRoot}/${state}`, { recursive: true });
  for (let frame = 0; frame < count; frame += 1) {
    const buffer = await render(state, frame, count);
    await sharp(buffer).toFile(`${enemyRoot}/${state}/frame${frame}.png`);
  }
}

const vfxRoot = `${root}/effects/treeBroodBurst`;
await mkdir(vfxRoot, { recursive: true });
for (let frame = 0; frame < 8; frame += 1) {
  const radius = 18 + frame * 12;
  const opacity = 1 - frame / 10;
  const svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-linecap="round"><circle cx="128" cy="178" r="${radius}" stroke="#63e6d6" stroke-width="${4 + frame / 2}" opacity="${opacity}"/><path d="M128 178 L${35 + frame * 8} ${180 - frame * 5} M128 178 L${221 - frame * 8} ${180 - frame * 5} M128 178 L${128 - frame * 4} ${45 + frame * 9} M128 178 L${128 + frame * 4} ${45 + frame * 9}" stroke="#b96536" stroke-width="${2 + frame / 3}" opacity="${opacity}"/><circle cx="128" cy="178" r="${6 + frame * 2}" fill="#9fffee" opacity="${opacity}"/></g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${vfxRoot}/frame${frame}.png`);
}

await copyFile(source, `${root}/enemy/larvaRaizFerro/model_reference.png`);
console.log("Generated Larva de Raiz-Ferro frames and tree brood VFX.");
