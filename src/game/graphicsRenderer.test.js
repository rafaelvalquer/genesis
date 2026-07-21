import { describe, expect, it } from "vitest";
import {
  clearSpriteHaloCache,
  getCachedSpriteHalo,
  getSpriteFilter,
  getTroopSpriteFilter,
} from "./graphicsRenderer.js";

describe("politica de filtros e halos", () => {
  it("nao aplica filtro a sprites normais e mantem estados combinados", () => {
    expect(getSpriteFilter()).toBe("none");
    expect(getTroopSpriteFilter(0)).toBe("none");
    expect(getTroopSpriteFilter(0.5)).toContain("brightness");
    const combined = getSpriteFilter(0.5, 2, true, true, true);
    expect(combined).toContain("saturate(.55)");
    expect(combined).toContain("hue-rotate(48deg)");
    expect(combined).toContain("contrast(1.08)");
    expect(combined.endsWith("brightness(1.375)")) .toBe(true);
    expect(combined).not.toContain("drop-shadow");
  });

  it("reutiliza o halo pela chave de cor, qualidade e intensidade", () => {
    clearSpriteHaloCache();
    let creations = 0;
    const canvasFactory = () => {
      creations += 1;
      return {
        getContext: () => ({
          createRadialGradient: () => ({ addColorStop() {} }),
          fillRect() {},
          set fillStyle(value) { this.value = value; },
        }),
      };
    };
    const first = getCachedSpriteHalo("#22d3ee", { quality: "high" }, 1, canvasFactory);
    const second = getCachedSpriteHalo("#22d3ee", { quality: "high" }, 1, canvasFactory);
    const stronger = getCachedSpriteHalo("#22d3ee", { quality: "high" }, 1.4, canvasFactory);
    expect(second).toBe(first);
    expect(stronger).not.toBe(first);
    expect(creations).toBe(2);
  });
});
