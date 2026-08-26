import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/enemy/dardifago");
const states = ["idle", "walking", "dartAttack", "toxicAttack", "death"];
const cell = (file, left, top) => ({ input: file, left, top });

for (const state of states) {
  const composites = [];
  for (let frame = 0; frame < 8; frame += 1) composites.push(cell(path.join(root, state, `frame${frame}.png`), frame * 512, 0));
  await sharp({ create: { width: 4096, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites).png().toFile(path.join(root, `dardifago_${state}_sheet.png`));
}

const master = [];
for (let row = 0; row < states.length; row += 1) {
  for (let frame = 0; frame < 8; frame += 1) master.push(cell(path.join(root, states[row], `frame${frame}.png`), frame * 512, row * 512));
}
await sharp({ create: { width: 4096, height: states.length * 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(master).png().toFile(path.join(root, "dardifago_master_animation_sheet.png"));
