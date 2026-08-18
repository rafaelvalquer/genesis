import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets-source/enemy/colossoCaldeira");
const generated = "C:/Users/Z565244/.codex/generated_images/01a0118b-4554-7b61-97d6-81b8d6f707c2";
const sheets = {
  spawnAwakening: ["exec-eceef2fa-983b-4c7b-9fc4-e897b47e7e92.png", 4, 3],
  idle: ["exec-afff3b86-f4c3-4df1-b89a-4705d02052b2.png", 4, 2],
  riftTelegraph: ["exec-89df87ad-1e8c-4556-9f19-b903808d48e0.png", 3, 2],
  riftAttack: ["exec-d7633d36-aa3f-4954-a256-f9f191b86eef.png", 3, 2],
  slamTelegraph: ["exec-4001fcde-f0f1-4a0c-a600-2fe23099e861.png", 3, 2],
  slamAttack: ["exec-ce1b317a-2337-4a3e-8e69-d5677692de9f.png", 4, 2],
  fractureTelegraph: ["exec-7b3ef590-d7fc-4e24-a4e5-a31db39cdbab.png", 4, 2],
  fractureAttack: ["exec-49ab7313-412b-4045-9213-206b1f1fbeae.png", 4, 2],
  seismicTelegraph: ["exec-8d0b6bcb-9649-45a9-818a-c46c71cec6cc.png", 4, 2],
  seismicAttack: ["exec-d4a51def-ac6c-4358-9991-3d4e457b0edd.png", 4, 2],
  phaseTransition2: ["exec-b36f203a-9f61-4500-97af-9aece1588d27.png", 5, 2],
  phaseTransition3: ["exec-db95c4df-568c-48b1-b37e-fc49490ce0c6.png", 5, 2],
  finalCollapse: ["exec-a026588b-69b7-4383-8092-1160ae413561.png", 4, 3],
  coreExposed: ["exec-5ed1fe5c-5899-42f9-8c74-465133f9a01b.png", 4, 2],
  death: ["exec-a4b4e3b2-9bbd-4bfd-b7c3-16bf1c96f020.png", 4, 4],
};

function isBackground(data, offset, channels) {
  const r = data[offset]; const g = data[offset + 1]; const b = data[offset + 2];
  return Math.max(r, g, b) - Math.min(r, g, b) <= 10 && (r + g + b) / 3 >= 125;
}

function removeCheckerboard(data, info) {
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const enqueue = (index, tail) => {
    if (visited[index]) return tail;
    const offset = index * channels;
    if (!isBackground(data, offset, channels)) return tail;
    visited[index] = 1; queue[tail] = index; return tail + 1;
  };
  let tail = 0;
  for (let x = 0; x < width; x += 1) { tail = enqueue(x, tail); tail = enqueue((height - 1) * width + x, tail); }
  for (let y = 1; y < height - 1; y += 1) { tail = enqueue(y * width, tail); tail = enqueue(y * width + width - 1, tail); }
  let head = 0;
  while (head < tail) {
    const index = queue[head++];
    data[index * channels + 3] = 0;
    const x = index % width; const y = Math.floor(index / width);
    if (x > 0) tail = enqueue(index - 1, tail);
    if (x + 1 < width) tail = enqueue(index + 1, tail);
    if (y > 0) tail = enqueue(index - width, tail);
    if (y + 1 < height) tail = enqueue(index + width, tail);
  }
}

for (const [state, [file, columns, rows]] of Object.entries(sheets)) {
  const input = path.join(generated, file);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const folder = path.join(root, state);
  await fs.mkdir(folder, { recursive: true });
  const expected = state === "death" ? 14 : columns * rows;
  for (let frame = 0; frame < expected; frame += 1) {
    const col = frame % columns; const row = Math.floor(frame / columns);
    const left = Math.floor(col * info.width / columns);
    const top = Math.floor(row * info.height / rows);
    const right = Math.floor((col + 1) * info.width / columns);
    const bottom = Math.floor((row + 1) * info.height / rows);
    const cell = await sharp(data, { raw: info }).extract({ left, top, width: right - left, height: bottom - top }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeCheckerboard(cell.data, cell.info);
    await sharp(cell.data, { raw: cell.info }).png().toFile(path.join(folder, `frame${frame}.png`));
  }
  console.log(`Imported ${state}: ${expected} frames`);
}
