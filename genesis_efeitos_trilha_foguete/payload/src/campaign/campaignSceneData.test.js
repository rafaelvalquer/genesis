import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_CHAPTER_ROUTES,
  CAMPAIGN_PHASE_LOCATIONS,
  latLonToCartesian,
} from "./campaignSceneData.js";

describe("rota planetária do Capítulo 5", () => {
  it("possui oito coordenadas no hemisfério norte-oeste", () => {
    const route = CAMPAIGN_CHAPTER_ROUTES.chapter_05;

    expect(route).toHaveLength(8);
    route.forEach(([latitude, longitude]) => {
      expect(latitude).toBeGreaterThan(0);
      expect(longitude).toBeLessThan(0);
    });
  });

  it("mapeia todas as fases 33 a 40", () => {
    const points = [];

    for (let number = 33; number <= 40; number += 1) {
      const id = `fase_${String(number).padStart(2, "0")}`;
      const location = CAMPAIGN_PHASE_LOCATIONS[id];

      expect(location).toBeTruthy();
      expect(location.elevation).toBeGreaterThan(0);

      const point = latLonToCartesian(
        location.latitude,
        location.longitude,
      );
      points.push([
        point.x.toFixed(4),
        point.y.toFixed(4),
        point.z.toFixed(4),
      ].join(":"));
    }

    expect(new Set(points).size).toBe(8);
  });

  it("aproxima a câmera na fase final", () => {
    expect(
      CAMPAIGN_PHASE_LOCATIONS.fase_40.cameraDistance,
    ).toBeLessThan(
      CAMPAIGN_PHASE_LOCATIONS.fase_39.cameraDistance,
    );
  });
});
