import { afterEach, describe, expect, it } from "vitest";
import {
  clearTroopPreviewFrameCache,
  getTroopPreviewUrl,
  loadTroopPreviewFrameUrls,
} from "../game/assetCatalog.js";

afterEach(() => clearTroopPreviewFrameCache());

describe("frames lazy do palco", () => {
  it("ordena os frames e reutiliza a mesma promise em cache por tropa e estado", async () => {
    const firstRequest = loadTroopPreviewFrameUrls("colono", "idle");
    const cachedRequest = loadTroopPreviewFrameUrls("colono", "idle");
    expect(cachedRequest).toBe(firstRequest);
    const urls = await firstRequest;
    expect(urls.length).toBeGreaterThan(1);
    expect(urls[0]).toContain("/colono/idle/frame0.png");
    expect(urls[1]).toContain("/colono/idle/frame1.png");
  });

  it("centraliza os estados especiais do drone e da muralha", async () => {
    const [drone, wall] = await Promise.all([
      loadTroopPreviewFrameUrls("droneSentinela"),
      loadTroopPreviewFrameUrls("muralhaReforcada"),
    ]);
    expect(drone[0]).toContain("/droneSentinela/idle/frame0.png");
    expect(wall[0]).toContain("/muralhaReforcada/defense/frame0.png");
  });

  it("mantém preview estático como fallback imediato", () => {
    expect(getTroopPreviewUrl("colono")).toContain("/colono/idle/frame0.png");
    expect(getTroopPreviewUrl("droneSentinela")).toContain("/droneSentinela/idle/frame0.png");
  });
});
