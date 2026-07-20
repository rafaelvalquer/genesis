import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const STATES = ["idle", "walking", "attack"];
const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "enemy", "silicaDigger");

async function opaqueBounds(framePath) {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, right, bottom };
}

describe("assets do Escavador de Sílica", () => {
  it("mantém 24 quadros transparentes, distintos, ancorados e dentro do orçamento", async () => {
    let totalBytes = 0;
    for (const state of STATES) {
      const hashes = new Set();
      const bottoms = [];
      for (let frame = 0; frame < 8; frame += 1) {
        const framePath = path.join(ASSET_ROOT, state, `frame${frame}.png`);
        const buffer = await fs.readFile(framePath);
        const metadata = await sharp(buffer).metadata();
        expect(metadata).toMatchObject({ width: 256, height: 256, hasAlpha: true, isPalette: true });
        const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const corners = [0, info.width - 1, (info.height - 1) * info.width, info.width * info.height - 1];
        expect(corners.every((pixel) => data[pixel * 4 + 3] === 0)).toBe(true);
        const bounds = await opaqueBounds(framePath);
        expect(bounds.left).toBeGreaterThanOrEqual(7);
        expect(bounds.right).toBeLessThanOrEqual(248);
        bottoms.push(bounds.bottom);
        hashes.add(crypto.createHash("sha256").update(buffer).digest("hex"));
        totalBytes += buffer.length;
      }
      expect(hashes.size).toBe(8);
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(2);
    }
    expect(totalBytes).toBeLessThanOrEqual(225_000);
  });
});
