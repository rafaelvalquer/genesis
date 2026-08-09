import { describe, expect, it } from "vitest";
import { TROOPS } from "../game/content.js";
import { getLoadoutStageVisual } from "./loadoutVisualCatalog.js";
import {
  calculateFullBodyPreviewLayout,
  findOpaquePixelBounds,
} from "./troopPreviewFit.js";

describe("enquadramento de corpo inteiro no loadout", () => {
  it("encontra os limites visíveis pela transparência", () => {
    const width = 4;
    const height = 4;
    const pixels = new Uint8ClampedArray(width * height * 4);

    const setAlpha = (x, y, alpha) => {
      pixels[(y * width + x) * 4 + 3] = alpha;
    };

    setAlpha(1, 1, 255);
    setAlpha(2, 1, 255);
    setAlpha(1, 2, 255);
    setAlpha(2, 3, 255);

    expect(
      findOpaquePixelBounds(pixels, width, height),
    ).toEqual({
      x: 1,
      y: 1,
      width: 2,
      height: 3,
    });
  });

  it("mantém todo o corpo dentro da área segura", () => {
    const layout = calculateFullBodyPreviewLayout({
      containerWidth: 720,
      containerHeight: 520,
      imageWidth: 384,
      imageHeight: 384,
      bounds: {
        x: 58,
        y: 12,
        width: 274,
        height: 365,
      },
      scale: .9,
      paddingX: .045,
      paddingY: .035,
    });

    expect(layout.body.left).toBeGreaterThanOrEqual(720 * .045);
    expect(layout.body.right).toBeLessThanOrEqual(720 * (1 - .045));
    expect(layout.body.top).toBeGreaterThanOrEqual(520 * .035);
    expect(layout.body.bottom).toBeLessThanOrEqual(520 * (1 - .035) + .001);
  });

  it("fornece escala segura para todas as tropas", () => {
    Object.values(TROOPS).forEach((troop) => {
      const visual = getLoadoutStageVisual(troop);

      expect(visual.scale).toBeGreaterThanOrEqual(.55);
      expect(visual.scale).toBeLessThanOrEqual(1);
      expect(Number.isFinite(visual.offsetX)).toBe(true);
      expect(Number.isFinite(visual.offsetY)).toBe(true);
    });
  });

  it("aplica um enquadramento mais aberto à Demolidora de Minas", () => {
    const troop = Object.values(TROOPS).find(
      (entry) => entry.label === "Demolidora de Minas",
    );

    expect(troop).toBeTruthy();
    expect(getLoadoutStageVisual(troop).scale).toBeLessThan(.9);
  });

  it("reduz o enquadramento da Plataforma Térmica no palco", () => {
    const troop = TROOPS.thermalPlatform;

    expect(troop).toBeTruthy();
    expect(getLoadoutStageVisual(troop).scale).toBeCloseTo(.62, 4);
  });
});
