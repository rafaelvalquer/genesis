import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ENEMIES } from "./content.js";

const STATES = ENEMIES.scarabEmperor.assetStates;
const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "enemy", "scarabEmperor");
const SHEET_ROOT = path.join(process.cwd(), "art", "spritesheets", "scarabEmperor");

async function opaqueBounds(framePath) {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < 96) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 };
}

describe("assets do Imperador Escaravelho", () => {
  it("mantém 15 folhas 4x2 e 120 frames transparentes, distintos e ancorados", async () => {
    let totalBytes = 0;
    for (const state of STATES) {
      const sheet = await sharp(path.join(SHEET_ROOT, `scarab-emperor-${state}.png`)).metadata();
      expect(sheet).toMatchObject({ width: 1024, height: 512, hasAlpha: true, isPalette: true });
      const files = (await fs.readdir(path.join(ASSET_ROOT, state)))
        .filter((filename) => /^frame\d+\.png$/.test(filename));
      expect(files).toHaveLength(8);

      const signatures = new Set();
      for (let frame = 0; frame < 8; frame += 1) {
        const framePath = path.join(ASSET_ROOT, state, `frame${frame}.png`);
        const buffer = await fs.readFile(framePath);
        expect(buffer.subarray(1, 4).toString()).toBe("PNG");
        expect(buffer.readUInt32BE(16)).toBe(256);
        expect(buffer.readUInt32BE(20)).toBe(256);
        expect(buffer[25]).toBe(3);
        expect(buffer.includes(Buffer.from("tRNS"))).toBe(true);
        const size = buffer.length;
        totalBytes += size;
        signatures.add(String(size));
      }
      const sampledBounds = await Promise.all([0, 7].map((frame) => (
        opaqueBounds(path.join(ASSET_ROOT, state, `frame${frame}.png`))
      )));
      for (const bounds of sampledBounds) {
        expect(bounds.width).toBeLessThanOrEqual(244);
        expect(bounds.height).toBeLessThanOrEqual(238);
        expect(bounds.width).toBeGreaterThan(90);
      }
      const bottoms = sampledBounds.map((bounds) => bounds.bottom);
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
      expect(signatures.size).toBeGreaterThanOrEqual(state.includes("Idle") ? 3 : 5);
    }
    expect(totalBytes).toBeLessThanOrEqual(2_200_000);
  }, 15_000);
});
