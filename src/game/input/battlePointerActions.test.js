import { describe, expect, it } from "vitest";
import { getBattleFieldPoint, getBattlePointerPoint } from "./battlePointerActions.js";
import { VIEWPORT } from "../visualGeometry.js";

describe("getBattlePointerPoint", () => {
  it("normaliza o ponteiro para o viewport lógico do campo", () => {
    const point = getBattlePointerPoint({
      clientX: 110,
      clientY: 70,
      currentTarget: { getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }) },
    }, { width: 1000, height: 500 });

    expect(point).toEqual({ x: 500, y: 250 });
  });

  it("recusa geometria de canvas indisponível", () => {
    expect(getBattlePointerPoint({}, { width: 1000, height: 500 })).toBeNull();
  });

  it("aplica o offset fixo do campo depois de normalizar o viewport", () => {
    const point = getBattleFieldPoint({
      clientX: VIEWPORT.width / 2,
      clientY: VIEWPORT.fieldOffsetY + 120,
      currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) },
    }, VIEWPORT);

    expect(point).toEqual({ x: VIEWPORT.width / 2, y: 120 });
  });
});
