import { describe, expect, it } from "vitest";
import {
  colorModeFilter, consumeGraphicsEvents, createGraphicsRuntime, getCameraOffset,
  getHitReaction, getRenderScale, interpolateEntity, updateGraphicsRuntime,
} from "./graphicsRuntime.js";

describe("runtime grafico", () => {
  it("limita a escala HiDPI pelo perfil", () => {
    expect(getRenderScale({ quality: "low" }, 3)).toBe(1);
    expect(getRenderScale({ quality: "medium" }, 3)).toBe(1.5);
    expect(getRenderScale({ quality: "high" }, 3)).toBe(2);
  });

  it("gera camera, reacao, morte, luz e decalque a partir dos eventos", () => {
    const runtime = createGraphicsRuntime();
    consumeGraphicsEvents(runtime, [
      { type: "hit", targetId: "enemy", x: 20, y: 30, seed: 2 },
      { type: "fireImpact", x: 20, y: 30, seed: 3, color: "#f90" },
      { type: "enemyDeath", x: 20, y: 30, entity: { id: "enemy", type: "medu", x: 20, y: 30 } },
    ], 100, { quality: "high", cameraShake: true });
    expect(getHitReaction(runtime, "enemy", 180).flash).toBeGreaterThan(0);
    expect(getCameraOffset(runtime, 116, { cameraShake: true })).not.toEqual({ x: 0, y: 0 });
    expect(runtime.deaths).toHaveLength(1);
    expect(runtime.decals).toHaveLength(2);
    expect(runtime.lights).toHaveLength(1);
    updateGraphicsRuntime(runtime, 2000, 16, {});
    expect(runtime.deaths).toHaveLength(0);
  });

  it("interpola sem alterar a entidade logica e respeita acessibilidade", () => {
    const entity = { x: 100, y: 60, previousRenderX: 80, previousRenderY: 60 };
    expect(interpolateEntity(entity, 0.5).x).toBe(90);
    expect(entity.x).toBe(100);
    expect(getCameraOffset(createGraphicsRuntime(), 0, { cameraShake: true, reduceMotion: true })).toEqual({ x: 0, y: 0 });
    expect(colorModeFilter("contrast")).toContain("contrast");
  });
});
