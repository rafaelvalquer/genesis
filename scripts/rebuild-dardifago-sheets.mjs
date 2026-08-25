import path from "node:path";
import sharp from "sharp";
const root = path.resolve("src/game/assets/enemy/dardifago");
const states = ["idle", "walking", "dartAttack", "toxicAttack", "death"];
for (const state of states) {
  await sharp({ create: { width: 4096, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(Array.from({ length: 8 }, (_, frame) => ({ input: path.join(root, state, `frame${frame}.png`), left: frame * 512, top: 0 }))).png().toFile(path.join(root, `dardifago_${state}_sheet.png`));
}
await sharp({ create: { width: 4096, height: 2560, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(states.map((state, row) => ({ input: path.join(root, `dardifago_${state}_sheet.png`), left: 0, top: row * 512 }))).png().toFile(path.join(root, "dardifago_master_animation_sheet.png"));
console.log("Rebuilt Dardifago sheets from final individual frames.");
