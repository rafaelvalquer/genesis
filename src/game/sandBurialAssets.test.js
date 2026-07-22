import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { loadBattleAssets } from "./assetCatalog.js";
import { PHASES } from "./content.js";

const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "effects", "sandBurial", "buried");

describe("assets do soterramento por areia", () => {
  it("mantem oito frames distintos, transparentes e uniformes", async () => {
    const signatures = new Set();
    for (let index = 0; index < 8; index += 1) {
      const framePath = path.join(ASSET_ROOT, `frame${index}.png`);
      const metadata = await sharp(framePath).metadata();
      expect(metadata).toMatchObject({ width: 256, height: 256, hasAlpha: true });
      const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(data[3]).toBe(0);
      expect(data[(info.width * info.height - 1) * 4 + 3]).toBe(0);
      const stats = await sharp(framePath).stats();
      expect(stats.channels[3].min).toBe(0);
      expect(stats.channels[3].max).toBe(255);
      signatures.add((await fs.stat(framePath)).size);
    }
    expect(signatures.size).toBe(8);
  }, 15000);

  it("carrega o overlay apenas para fases com tempestade", async () => {
    const withStorm = await loadBattleAssets({ ...PHASES[16], waves: [] }, [], undefined, { skipDefenses: true });
    const withoutStorm = await loadBattleAssets({ ...PHASES[0], waves: [] }, [], undefined, { skipDefenses: true });
    expect(withStorm.effects.sandBurial.buried).toHaveLength(8);
    expect(withoutStorm.effects).toEqual({});
  });
});
