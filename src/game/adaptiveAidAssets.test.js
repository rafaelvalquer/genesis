import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { loadBattleAssets } from "./assetCatalog.js";
import { PHASES } from "./content.js";

const ASSET_ROOT = path.join(process.cwd(), "src", "game", "assets", "effects", "colonyCapsule");
const STATES = { falling: 8, idle: 8, opening: 10 };

describe("assets da Cápsula da Colônia", () => {
  it("mantém 26 quadros transparentes, normalizados e dentro do orçamento", async () => {
    for (const [state, count] of Object.entries(STATES)) {
      const signatures = new Set();
      for (let index = 0; index < count; index += 1) {
        const framePath = path.join(ASSET_ROOT, state, `frame${index}.png`);
        const metadata = await sharp(framePath).metadata();
        expect(metadata).toMatchObject({ width: 256, height: 256, hasAlpha: true });
        const stats = await sharp(framePath).stats();
        expect(stats.channels[3].min).toBe(0);
        expect(stats.channels[3].max).toBe(255);
        const size = (await fs.stat(framePath)).size;
        expect(size).toBeLessThan(120 * 1024);
        signatures.add(size);
      }
      expect(signatures.size).toBe(count);
    }
  }, 15000);

  it("registra todos os estados no carregador de batalha", async () => {
    const assets = await loadBattleAssets({ ...PHASES[0], waves: [] }, [], undefined, { skipDefenses: true });
    expect(assets.effects.colonyCapsule.falling).toHaveLength(8);
    expect(assets.effects.colonyCapsule.idle).toHaveLength(8);
    expect(assets.effects.colonyCapsule.opening).toHaveLength(10);
  });
});
