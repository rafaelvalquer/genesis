import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets/enemy/dardifago");
const source = path.join(root, "dardifago_model_reference.png");
const states = ["idle", "walking", "dartAttack", "toxicAttack", "death"];
const frameSize = 512;
const svg = (state, frame) => `<svg width="512" height="512"><circle cx="${20 + frame * 5}" cy="20" r="${1 + frame * .05}" fill="#ffffff" opacity=".08"/>${state.includes("Attack") ? `<g fill="none" stroke="${state === "toxicAttack" ? "#c7f34a" : "#d9a66a"}" opacity="${state === "toxicAttack" ? .24 : .12}"><ellipse cx="214" cy="280" rx="${70 + frame * 2}" ry="${120 + frame * 2}" stroke-width="5"/><ellipse cx="214" cy="280" rx="${78 + frame * 2}" ry="${128 + frame * 2}" stroke-width="2"/></g>` : ""}</svg>`;

await fs.mkdir(root, { recursive: true });
const base = await sharp(source).ensureAlpha().resize(430, 430, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
for (const state of states) {
  const dir = path.join(root, state);
  await fs.mkdir(dir, { recursive: true });
  for (let frame = 0; frame < 8; frame += 1) {
    const angle = state === "walking" ? (frame % 4 < 2 ? -1.4 : 1.4) : state === "death" ? frame * 1.1 : state.includes("Attack") ? (frame < 4 ? -frame * .7 : (frame - 4) * .5) : Math.sin(frame / 8 * Math.PI * 2) * .45;
    const left = Math.max(12, Math.round(41 + Math.sin(frame * .8) * 2));
    const top = Math.max(12, Math.round(41 + (state === "death" ? frame * 1.5 : 0)));
    const overlays = svg(state, frame);
    let image = sharp({ create: { width: frameSize, height: frameSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: base, left, top }]);
    if (overlays) image = image.composite([{ input: Buffer.from(overlays), left: 0, top: 0 }]);
    await image.modulate({ brightness: 1 + (frame - 3.5) * .008, saturation: 1 + Math.abs(angle) * .03 }).png().toFile(path.join(dir, `frame${frame}.png`));
  }
  const framePixels = await Promise.all(Array.from({ length: 8 }, (_, frame) => sharp(path.join(dir, `frame${frame}.png`)).ensureAlpha().raw().toBuffer()));
  await sharp(Buffer.concat(framePixels), { raw: { width: 4096, height: 512, channels: 4 } }).png().toFile(path.join(root, `dardifago_${state}_sheet.png`));
}
const projectileRoot = path.resolve("src/game/assets/effects/dardifagoDart");
for (const type of ["normal", "toxic"]) {
  const dir = path.join(projectileRoot, type);
  await fs.mkdir(dir, { recursive: true });
  const accent = type === "toxic" ? "#d7f44a" : "#d6a36a";
  const art = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg"><path d="M14 64 L104 48 L120 64 L104 80 Z" fill="#e9d7a7" stroke="#5b3324" stroke-width="6"/><path d="M48 57 Q62 42 78 55 Q70 64 78 73 Q62 86 48 71 Z" fill="${accent}" opacity="${type === "toxic" ? .8 : .18}"/><path d="M98 52 L120 64 L98 76 Z" fill="#bd713e"/></svg>`;
  await sharp(Buffer.from(art)).png().toFile(path.join(dir, "frame0.png"));
}
const masterRows = await Promise.all(states.map((state) => sharp(path.join(root, `dardifago_${state}_sheet.png`)).ensureAlpha().raw().toBuffer()));
await sharp(Buffer.concat(masterRows), { raw: { width: 4096, height: 5 * 512, channels: 4 } }).png().toFile(path.join(root, "dardifago_master_animation_sheet.png"));
