import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const STATES = ["idle", "walking", "attack", "roar"];
const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "enemy", "duneRipper");
const SHEET_ROOT = path.join(process.cwd(), "art", "spritesheets", "duneRipper");

async function opaqueBounds(framePath) {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < 48) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 };
}

describe("assets do Rasga-Dunas", () => {
  it("mantém quatro folhas 4x2 e oito quadros transparentes e distintos por estado", async () => {
    let totalBytes = 0;
    const allBounds = [];
    for (const state of STATES) {
      const sheet = await sharp(path.join(SHEET_ROOT, `duneRipper-${state}.png`)).metadata();
      expect(sheet).toMatchObject({ width: 1024, height: 512, hasAlpha: true, isPalette: true });
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
        hashes.add(crypto.createHash("sha256").update(buffer).digest("hex"));
        totalBytes += buffer.length;
        const bounds = await opaqueBounds(framePath);
        bottoms.push(bounds.bottom);
        allBounds.push(bounds);
      }
      expect(hashes.size).toBe(8);
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(2);
    }
    expect(Math.max(...allBounds.map((bounds) => bounds.width))).toBeLessThanOrEqual(216);
    expect(Math.max(...allBounds.map((bounds) => bounds.height))).toBeLessThanOrEqual(216);
    expect(Math.min(...allBounds.map((bounds) => bounds.width))).toBeGreaterThanOrEqual(120);
    expect(totalBytes).toBeLessThanOrEqual(650_000);
  });
});
