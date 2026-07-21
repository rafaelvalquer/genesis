import { describe, expect, it } from "vitest";
import {
  colorModeFilter, consumeGraphicsEvents, createGraphicsRuntime, getCameraOffset,
  getAdaptiveEffects, getHitReaction, getRenderScale, interpolateEntity, updateAdaptiveLevel, updateGraphicsRuntime,
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

  it("registra e expira reacoes da contencao para spawns", () => {
    const runtime = createGraphicsRuntime();
    consumeGraphicsEvents(runtime, [
      { type: "spawn", x: 1140, enemy: { row: 0, variant: "alpha", x: 1140, y: 60 } },
    ], 100, { quality: "high", cameraShake: false });
    expect(runtime.containmentArcs).toMatchObject([{ row: 0, x: 1076, alpha: true }]);
    expect(runtime.containmentInterferenceUntil).toBe(1200);
    updateGraphicsRuntime(runtime, 1001, 16, {});
    expect(runtime.containmentArcs).toHaveLength(0);
  });

  it("mantem feixe, desintegracao e marcas somente pelas duracoes visuais", () => {
    const runtime = createGraphicsRuntime();
    consumeGraphicsEvents(runtime, [
      { type: "pulseFired", row: 2, x0: 96, y0: 300, x1: 1124, y1: 300, seed: 17 },
      {
        type: "enemyDisintegrated",
        enemyId: "enemy_pulse",
        row: 2,
        x: 500,
        y: 300,
        entity: { id: "enemy_pulse", type: "medu", row: 2, x: 500, y: 300 },
      },
    ], 100, { quality: "high", cameraShake: true });
    expect(runtime.pulseBeams).toHaveLength(1);
    expect(runtime.disintegrations).toHaveLength(1);
    expect(runtime.pulseScorches).toHaveLength(8);

    updateGraphicsRuntime(runtime, 521, 16, {});
    expect(runtime.pulseBeams).toHaveLength(0);
    expect(runtime.disintegrations).toHaveLength(0);
    expect(runtime.pulseScorches).toHaveLength(8);
    updateGraphicsRuntime(runtime, 6101, 16, {});
    expect(runtime.pulseScorches).toHaveLength(0);
  });

  it("entra imediatamente e recupera um nivel por vez com histerese de tres segundos", () => {
    const runtime = createGraphicsRuntime();
    expect(updateAdaptiveLevel(runtime, 0, 21, 50)).toBe("busy");
    expect(updateAdaptiveLevel(runtime, 100, 27, 50)).toBe("stress");
    expect(updateAdaptiveLevel(runtime, 1000, 16, 80)).toBe("stress");
    expect(updateAdaptiveLevel(runtime, 3999, 16, 80)).toBe("stress");
    expect(updateAdaptiveLevel(runtime, 4000, 16, 80)).toBe("busy");
    expect(updateAdaptiveLevel(runtime, 5000, 19, 80)).toBe("busy");
    expect(updateAdaptiveLevel(runtime, 6000, 16, 80)).toBe("busy");
    expect(updateAdaptiveLevel(runtime, 9000, 16, 80)).toBe("full");
  });

  it("mantem a qualidade manual como teto e reduz somente efeitos extras", () => {
    const full = getAdaptiveEffects({ quality: "medium" }, "full");
    const busy = getAdaptiveEffects({ quality: "medium" }, "busy");
    const stress = getAdaptiveEffects({ quality: "medium" }, "stress");
    expect(full.quality).toBe("medium");
    expect(busy).toMatchObject({ quality: "medium", bloom: false, reflections: true });
    expect(stress).toMatchObject({ quality: "medium", dynamicLightScale: 0, reflections: false, hideFullHealthEnemies: true });
    expect(stress.particleBudgetScale).toBeLessThan(busy.particleBudgetScale);
  });
});
