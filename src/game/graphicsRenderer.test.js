import { describe, expect, it, vi } from "vitest";
import {
  clearSpriteHaloCache,
  getCachedSpriteHalo,
  getSpriteFilter,
  getTroopSpriteFilter,
  presentScene,
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

  it("aplica zoom cinematográfico ao redor do foco sem alterar o renderScale", () => {
    const ctx = {
      setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
      translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), filter: "none",
    };
    presentScene(ctx, {}, {}, 2, { x: 0, y: 0, zoom: 1.04, focusX: 700, focusY: 300 }, { quality: "low" });
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.scale).toHaveBeenCalledWith(1.04, 1.04);
    expect(ctx.translate).toHaveBeenCalledWith(700, 300);
    expect(ctx.translate).toHaveBeenCalledWith(-700, -300);
  });

  it("desenha a cena uma vez e aplica bloom somente à camada emissiva", () => {
    const scene = { id: "scene" };
    const emissive = { id: "emissive" };
    const ctx = {
      setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
      translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), filter: "none",
      globalAlpha: 1, globalCompositeOperation: "source-over",
    };
    presentScene(
      ctx, scene, emissive, 1, { x: 0, y: 0, zoom: 1 },
      { quality: "high" }, { bloom: true },
    );
    expect(ctx.drawImage.mock.calls.filter(([image]) => image === scene)).toHaveLength(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(emissive, 0, 0, 1100, 680);
  });
});
