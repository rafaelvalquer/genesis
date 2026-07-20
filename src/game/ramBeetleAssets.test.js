import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const STATES = ["walking", "chargePrep", "charge", "idle", "attack"];
const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "enemy", "ramBeetle");
const SHEET_ROOT = path.join(process.cwd(), "art", "spritesheets", "ramBeetle");

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

describe("assets do Besouro-Aríete", () => {
  it("possui cinco sprite sheets 4x2 e oito frames transparentes por estado", async () => {
    for (const state of STATES) {
      const sheet = await sharp(path.join(SHEET_ROOT, `ram-beetle-${state}.png`)).metadata();
      expect(sheet).toMatchObject({ width: 1024, height: 512, hasAlpha: true, isPalette: true });
      const files = (await fs.readdir(path.join(ASSET_ROOT, state)))
        .filter((filename) => /^frame\d+\.png$/.test(filename));
      expect(files).toHaveLength(8);
    }
  });

  it("mantém geometria, apoio, proporções e orçamento controlados", async () => {
    let totalBytes = 0;
    const allBounds = [];
    for (const state of STATES) {
      const bottoms = [];
      for (let frame = 0; frame < 8; frame += 1) {
        const framePath = path.join(ASSET_ROOT, state, `frame${frame}.png`);
        const metadata = await sharp(framePath).metadata();
        expect(metadata).toMatchObject({ width: 256, height: 256, hasAlpha: true, isPalette: true });
        totalBytes += (await fs.stat(framePath)).size;
        const bounds = await opaqueBounds(framePath);
        bottoms.push(bounds.bottom);
        allBounds.push(bounds);
      }
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...allBounds.map((bounds) => bounds.width))).toBeLessThanOrEqual(244);
    expect(Math.max(...allBounds.map((bounds) => bounds.height))).toBeLessThanOrEqual(238);
    expect(Math.min(...allBounds.map((bounds) => bounds.width))).toBeGreaterThanOrEqual(170);
    expect(totalBytes).toBeLessThanOrEqual(700_000);
  });
});
