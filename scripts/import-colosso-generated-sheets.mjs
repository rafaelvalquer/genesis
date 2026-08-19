import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("src/game/assets-source/enemy/colossoCaldeira");
const generated = "C:/Users/Z565244/.codex/generated_images/01a0118b-4554-7b61-97d6-81b8d6f707c2";
const sheets = {
  spawnAwakening: ["exec-827fd333-6117-482a-9caa-d8572af622a5.png", 4, 3],
  idle: ["exec-71326066-f655-4146-977a-4ffd8c973f24.png", 4, 2],
  riftTelegraph: ["exec-6a765132-068e-470c-b789-5766d1cfde4d.png", 3, 2],
  riftAttack: ["exec-e2ae2425-7229-4997-91b0-42351d8bdc7e.png", 3, 2],
  slamTelegraph: ["exec-30abf1ad-f5f8-4a47-8458-d6e04bbe9190.png", 3, 2],
  slamAttack: ["exec-4fbb553f-be63-4a93-ac06-67c775ac6305.png", 4, 2],
  fractureTelegraph: ["exec-70e2df49-d605-47a3-abe2-67cd60d08be8.png", 4, 2],
  fractureAttack: ["exec-6ff9048a-f549-475a-9b84-5c657812e0ca.png", 4, 2],
  seismicTelegraph: ["exec-81f9bf19-6b53-42c7-b4b4-4927e5986108.png", 4, 2],
  seismicAttack: ["exec-1c02ed87-836a-43e7-950e-1bf4dd19008c.png", 4, 2],
  phaseTransition2: ["exec-e5885f5e-be56-4c93-83f6-4e0e5ae5dc69.png", 5, 2],
  phaseTransition3: ["exec-7e65b5ed-852f-4753-9ac3-9039ab9d948e.png", 5, 2],
  finalCollapse: ["exec-2f0e279f-4727-47cf-a306-2da8162c1e29.png", 4, 3],
  coreExposed: ["exec-36d420bf-791b-430b-bc9e-d1a320c250b5.png", 4, 2],
  death: ["exec-bbda3029-760a-4c09-b98b-5776e9042feb.png", 4, 4],
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
