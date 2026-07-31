import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createRoutePlacements, getChapterRouteFrames } from "./genesisRouteEffectUtils.js";

describe("posicionamento de efeitos na trilha", () => {
  it("gera amostras para todos os capítulos", () => {
    for (let number = 1; number <= 5; number += 1) {
      const id = `chapter_${String(number).padStart(2, "0")}`;
      expect(getChapterRouteFrames(THREE, id).length).toBeGreaterThan(20);
    }
  });

  it("mantém estruturas próximas, mas fora do centro da trilha", () => {
    const placements = createRoutePlacements({ THREE, chapterId: "chapter_03", count: 24, seed: 1234, minimumSideOffset: .045, maximumSideOffset: .12 });
    const route = getChapterRouteFrames(THREE, "chapter_03", 8);
    placements.forEach((placement) => {
      const nearest = route.reduce((best, frame) => Math.max(best, placement.normal.dot(frame.normal)), -1);
      expect(nearest).toBeGreaterThan(.985);
      expect(Math.abs(placement.normal.length() - 1)).toBeLessThan(.00001);
    });
  });
});
