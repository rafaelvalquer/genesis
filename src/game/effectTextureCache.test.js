import { describe, expect, it } from "vitest";
import {
  clearEffectTextureCache,
  getRadialGlowTexture,
} from "./effectTextureCache.js";

describe("cache de texturas de efeito", () => {
  it("cria o gradiente apenas na primeira consulta da chave", () => {
    clearEffectTextureCache();
    let canvasCreations = 0;
    let gradientCreations = 0;
    const canvasFactory = () => {
      canvasCreations += 1;
      return {
        getContext: () => ({
          createRadialGradient: () => {
            gradientCreations += 1;
            return { addColorStop() {} };
          },
          fillRect() {},
          set fillStyle(value) { this.value = value; },
        }),
      };
    };
    const first = getRadialGlowTexture(
      "test", "#fff", "#0ff", "transparent", 0.5, canvasFactory,
    );
    const second = getRadialGlowTexture(
      "test", "#fff", "#0ff", "transparent", 0.5, canvasFactory,
    );
    expect(second).toBe(first);
    expect(canvasCreations).toBe(1);
    expect(gradientCreations).toBe(1);
  });
});

