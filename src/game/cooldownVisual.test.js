import { describe, expect, it } from "vitest";
import { TROOPS } from "./content.js";
import { getTroopPreviewUrl } from "./assetCatalog.js";
import { getDeployCooldownProgress } from "./cooldownVisual.js";

describe("cooldown visual das tropas", () => {
  it("calcula o progresso entre o inicio e o fim da recarga", () => {
    expect(getDeployCooldownProgress(4000, 4000)).toBe(0);
    expect(getDeployCooldownProgress(3000, 4000)).toBe(0.25);
    expect(getDeployCooldownProgress(2000, 4000)).toBe(0.5);
    expect(getDeployCooldownProgress(0, 4000)).toBe(1);
  });

  it("limita valores fora da duracao configurada", () => {
    expect(getDeployCooldownProgress(5000, 4000)).toBe(0);
    expect(getDeployCooldownProgress(-100, 4000)).toBe(1);
    expect(getDeployCooldownProgress(100, 0)).toBe(1);
    expect(getDeployCooldownProgress(Number.NaN, 4000)).toBe(1);
  });

  it("resolve um retrato para todas as tropas", () => {
    for (const troopId of Object.keys(TROOPS)) {
      expect(getTroopPreviewUrl(troopId), troopId).toMatch(/frame0.*\.png/i);
    }
  });
});
