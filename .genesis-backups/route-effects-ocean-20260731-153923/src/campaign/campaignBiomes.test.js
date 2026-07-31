import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_BIOMES,
  getCampaignBiome,
} from "./campaignBiomes.js";

describe("identidade visual dos mundos", () => {
  it("define tema completo para os cinco capítulos", () => {
    expect(Object.keys(CAMPAIGN_BIOMES)).toEqual([
      "chapter_01",
      "chapter_02",
      "chapter_03",
      "chapter_04",
      "chapter_05",
    ]);

    Object.values(CAMPAIGN_BIOMES).forEach((theme) => {
      expect(theme.ui.primary).toMatch(/^#/);
      expect(theme.lighting.keyColor).toMatch(/^#/);
      expect(theme.planetEffects.signature.length)
        .toBeGreaterThan(10);
      expect(theme.world.fogDensityCommand)
        .toBeGreaterThan(0);
    });
  });

  it("mantém a luz do capítulo 3 neutra", () => {
    const desert = getCampaignBiome("chapter_03");

    expect(desert.lighting.keyColor).toBe("#fff4e8");
    expect(desert.lighting.fillColor).toBe("#bfe7f5");
    expect(desert.lighting.rimColor).toBe("#f97316");
    expect(desert.lighting.keyColor)
      .not.toBe(desert.atmosphere);
  });

  it("define o Abismo de Nereida em ciano e violeta", () => {
    const abyss = getCampaignBiome("chapter_05");

    expect(abyss.key).toBe("abyss");
    expect(abyss.ui.primary).toBe("#22d3ee");
    expect(abyss.ui.accent).toBe("#c084fc");
    expect(abyss.lighting.fillColor).toBe("#67e8f9");
    expect(abyss.planetEffects.kit).toBe("eclipse");
  });

  it("usa o capítulo 1 como fallback", () => {
    expect(getCampaignBiome("inexistente")).toBe(
      CAMPAIGN_BIOMES.chapter_01,
    );
  });
});
