import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const STATES = ["idle", "attack", "special"];
const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "troop", "colossoImpacto");

async function opaqueBounds(framePath) {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

describe("assets do Colosso de Impacto", () => {
  it("mantem oito frames 512x512 RGBA transparentes e otimizados por estado", async () => {
    let totalBytes = 0;
    for (const state of STATES) {
      const files = (await fs.readdir(path.join(ASSET_ROOT, state)))
        .filter((filename) => /^frame\d+\.png$/.test(filename));
      expect(files).toHaveLength(8);
      const bottoms = [];
      for (let frame = 0; frame < 8; frame += 1) {
        const framePath = path.join(ASSET_ROOT, state, `frame${frame}.png`);
        const metadata = await sharp(framePath).metadata();
        expect(metadata).toMatchObject({ width: 512, height: 512, hasAlpha: true, isPalette: false });
        const bounds = await opaqueBounds(framePath);
        bottoms.push(bounds.bottom);
        expect(bounds.left).toBeGreaterThanOrEqual(14);
        expect(bounds.right).toBeLessThanOrEqual(497);
        totalBytes += (await fs.stat(framePath)).size;
      }
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(2);
    }
    expect(totalBytes).toBeLessThanOrEqual(12_000_000);
  });

  it("mantem a pose neutra de ataque e esmagamento na proporcao do idle", async () => {
    const heights = await Promise.all(
      STATES.map((state) => opaqueBounds(path.join(ASSET_ROOT, state, "frame0.png")).then((bounds) => bounds.height)),
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2);
  });
});
