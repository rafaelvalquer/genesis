import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const STATES = ["idle", "heal", "attack", "cooldown"];
const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "troop", "medicaNanites");
const SHEET_ROOT = path.join(process.cwd(), "art", "spritesheets", "medicaNanites");

async function opaqueBottom(framePath) {
  const { data, info } = await sharp(framePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = info.height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] >= 96) return y;
    }
  }
  return -1;
}

describe("assets da Médica de Nanites", () => {
  it("possui quatro sprite sheets 4x2 transparentes com oito frames", async () => {
    for (const state of STATES) {
      const sheetPath = path.join(SHEET_ROOT, `medica-nanites-${state}.png`);
      const metadata = await sharp(sheetPath).metadata();
      expect(metadata).toMatchObject({
        width: 1536, height: 768, hasAlpha: true, isPalette: false,
      });

      const files = (await fs.readdir(path.join(ASSET_ROOT, state)))
        .filter((filename) => /^frame\d+\.png$/.test(filename))
        .sort();
      expect(files).toHaveLength(8);
    }
  });

  it("mantém frames 384x384 RGBA truecolor, transparentes e com apoio estável", async () => {
    for (const state of STATES) {
      const bottoms = [];
      for (let frame = 0; frame < 8; frame += 1) {
        const framePath = path.join(ASSET_ROOT, state, `frame${frame}.png`);
        const metadata = await sharp(framePath).metadata();
        expect(metadata).toMatchObject({
          width: 384, height: 384, hasAlpha: true, isPalette: false,
        });
        const { data } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        expect(data[3]).toBe(0);
        bottoms.push(await opaqueBottom(framePath));
      }
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
    }
  });
});
