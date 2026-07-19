import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const STATES = ["idle", "attack", "transitionIn", "defense", "transitionOut"];
const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "troop", "lumiUrsa7");
const SHEET_ROOT = path.join(process.cwd(), "art", "spritesheets", "lumiUrsa7");

async function opaqueBottom(framePath) {
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = info.height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] >= 96) return y;
    }
  }
  return -1;
}

describe("assets de Lumi e URSA-7", () => {
  it("possui cinco sprite sheets 4x2 e oito frames transparentes por estado", async () => {
    for (const state of STATES) {
      const sheet = await sharp(path.join(SHEET_ROOT, `lumi-ursa7-${state}.png`)).metadata();
      expect(sheet).toMatchObject({ width: 1024, height: 512, hasAlpha: true, isPalette: true });
      const files = (await fs.readdir(path.join(ASSET_ROOT, state)))
        .filter((filename) => /^frame\d+\.png$/.test(filename));
      expect(files).toHaveLength(8);
    }
  });

  it("mantém dimensões, transparência, apoio estável e orçamento controlado", async () => {
    let totalBytes = 0;
    for (const state of STATES) {
      const bottoms = [];
      for (let frame = 0; frame < 8; frame += 1) {
        const framePath = path.join(ASSET_ROOT, state, `frame${frame}.png`);
        const metadata = await sharp(framePath).metadata();
        expect(metadata).toMatchObject({ width: 256, height: 256, hasAlpha: true, isPalette: true });
        totalBytes += (await fs.stat(framePath)).size;
        bottoms.push(await opaqueBottom(framePath));
      }
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
    }
    expect(totalBytes).toBeLessThanOrEqual(700_000);
  });
});
