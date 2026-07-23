import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { CHAPTER_FOUR_PHASE_BLUEPRINTS } from "./content.js";
import { getArenaUrl, loadBattleAssets } from "./assetCatalog.js";

const assetPath = (relative) => fileURLToPath(new URL(relative, import.meta.url));

describe("assets do Capitulo 4", () => {
  it.each(Array.from({ length: 8 }, (_, index) => index + 25))(
    "entrega fase_%i como WebP 1100x600",
    async (phaseNumber) => {
      const path = assetPath(`./assets/arenas/fase_${phaseNumber}.webp`);
      expect(existsSync(path)).toBe(true);
      const metadata = await sharp(path).metadata();
      expect(metadata).toMatchObject({ width: 1100, height: 600, format: "webp" });
      expect(statSync(path).size).toBeGreaterThan(50000);
      expect(getArenaUrl(`fase_${phaseNumber}`)).toMatch(/fase_\d{2}.*\.webp/i);
    },
  );

  it.each([
    "wind_warning.ogg",
    "wind_active_loop.ogg",
    "wind_primary_gust.ogg",
    "wind_troop_shift.ogg",
    "wind_ejection.ogg",
    "wind_recovery.ogg",
    "thunder_distant_1.ogg",
    "thunder_distant_2.ogg",
  ])("inclui o som original %s", (filename) => {
    const path = assetPath(`./assets/sfx/${filename}`);
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(1000);
  });

  it("carrega acentos visuais e audios do vento no pacote da batalha", async () => {
    const phase = { ...CHAPTER_FOUR_PHASE_BLUEPRINTS[0], waves: [] };
    const assets = await loadBattleAssets(phase, [], () => {}, { enemyIds: [] });
    expect(assets.effects.windCurrent.dustDebris).toHaveLength(4);
    expect(assets.effects.windCurrent.rockDebris).toHaveLength(4);
    expect(assets.effects.windCurrent.emergencyReturn).toHaveLength(4);
    expect(assets.audio).toHaveProperty("wind_active_loop.ogg");
    expect(assets.audio).toHaveProperty("thunder_distant_2.ogg");
  });
});
