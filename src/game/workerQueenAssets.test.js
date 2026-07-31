import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const DEFINITIONS = [
  {
    id: "workerQueen",
    prefix: "worker-queen",
    states: ["spawn", "walking", "idle", "webAttack", "eggLay", "meleeAttack", "hit", "stunned", "death"],
    maxBytes: 1_700_000,
  },
  {
    id: "workerQueenEgg",
    prefix: "worker-queen-egg",
    states: ["idle", "hatch", "destroy"],
    maxBytes: 700_000,
  },
];

async function opaqueBottom(framePath) {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = info.height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] >= 96) return y;
    }
  }
  return -1;
}

async function opaqueBounds(framePath) {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const seen = new Uint8Array(info.width * info.height);
  let largest = null;
  for (let pixel = 0; pixel < seen.length; pixel += 1) {
    if (seen[pixel] || data[pixel * 4 + 3] < 32) continue;
    const stack = [pixel];
    seen[pixel] = 1;
    let area = 0;
    let left = info.width;
    let top = info.height;
    let right = -1;
    let bottom = -1;
    while (stack.length) {
      const current = stack.pop();
      const x = current % info.width;
      const y = Math.floor(current / info.width);
      area += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nextX < 0 || nextY < 0 || nextX >= info.width || nextY >= info.height) continue;
        const next = nextY * info.width + nextX;
        if (seen[next] || data[next * 4 + 3] < 32) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (!largest || area > largest.area) {
      largest = { area, width: right - left + 1, height: bottom - top + 1 };
    }
  }
  return largest;
}

async function averageBounds(state) {
  const root = path.join(process.cwd(), "src", "game", "assets", "enemy", "workerQueen", state);
  const bounds = await Promise.all(Array.from({ length: 8 }, (_, frame) => opaqueBounds(path.join(root, `frame${frame}.png`))));
  return {
    width: bounds.reduce((sum, entry) => sum + entry.width, 0) / bounds.length,
    height: bounds.reduce((sum, entry) => sum + entry.height, 0) / bounds.length,
  };
}

describe("assets da Rainha Operária", () => {
  it("mantém a proporção da Rainha durante teia e postura", async () => {
    const walking = await averageBounds("walking");
    const webAttack = await averageBounds("webAttack");
    const eggLay = await averageBounds("eggLay");
    for (const action of [webAttack, eggLay]) {
      expect(action.width / walking.width).toBeGreaterThanOrEqual(0.92);
      expect(action.width / walking.width).toBeLessThanOrEqual(1.12);
      expect(action.height / walking.height).toBeGreaterThanOrEqual(0.92);
      expect(action.height / walking.height).toBeLessThanOrEqual(1.08);
    }
  });

  it("mantém 12 folhas 4x2 e 96 frames transparentes, distintos e ancorados", async () => {
    let totalFrames = 0;
    for (const definition of DEFINITIONS) {
      const assetRoot = path.join(process.cwd(), "src", "game", "assets", "enemy", definition.id);
      const sheetRoot = path.join(process.cwd(), "art", "spritesheets", definition.id);
      let totalBytes = 0;
      for (const state of definition.states) {
        const sheet = await sharp(path.join(sheetRoot, `${definition.prefix}-${state}.png`)).metadata();
        expect(sheet).toMatchObject({ width: 1024, height: 512, hasAlpha: true, isPalette: true });
        const hashes = new Set();
        const bottoms = [];
        for (let frame = 0; frame < 8; frame += 1) {
          const framePath = path.join(assetRoot, state, `frame${frame}.png`);
          const buffer = await fs.readFile(framePath);
          const metadata = await sharp(buffer).metadata();
          expect(metadata).toMatchObject({ width: 256, height: 256, hasAlpha: true, isPalette: true });
          const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
          expect(corners.every((pixel) => data[pixel * 4 + 3] === 0)).toBe(true);
          hashes.add(crypto.createHash("sha256").update(buffer).digest("hex"));
          bottoms.push(await opaqueBottom(framePath));
          totalBytes += buffer.length;
          totalFrames += 1;
        }
        expect(hashes.size).toBe(8);
        expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
      }
      expect(totalBytes).toBeLessThanOrEqual(definition.maxBytes);
    }
    expect(totalFrames).toBe(96);
  }, 30_000);
});
