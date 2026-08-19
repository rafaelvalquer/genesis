import { describe, expect, it, vi } from "vitest";
import {
  clearRenderLayer,
  configureRenderLayers,
  createRenderLayers,
  colorModeFilter, consumeGraphicsEvents, createGraphicsRuntime, getCameraOffset,
  getAdaptiveEffects, getHitReaction, getRenderScale, interpolateEntity, updateAdaptiveLevel, updateGraphicsRuntime,
} from "./graphicsRuntime.js";

function fakeCanvas() {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
  };
  return {
    width: 0, height: 0, dataset: {}, style: {},
    getContext: () => context,
    context,
  };
}

describe("camadas HiDPI", () => {
  it.each([1, 1.5, 2])("dimensiona a entity layer para DPR %s sem alterar coordenadas lógicas", (dpr) => {
    const layers = createRenderLayers(fakeCanvas);
    const configured = configureRenderLayers(layers, { quality: "high" }, dpr);
    expect(configured.renderScale).toBe(dpr);
    expect(layers.entityLayer).toMatchObject({
      width: Math.round(1100 * dpr),
      height: Math.round(680 * dpr),
    });
    expect(layers.arenaLayer).toMatchObject({ width: 1100, height: 680 });
    expect(configured.contexts.entityLayer.imageSmoothingQuality).toBe("high");
  });

  it("limpa em pixels físicos e restaura a transformação lógica", () => {
    const canvas = fakeCanvas();
    canvas.width = 2200;
    canvas.height = 1360;
    clearRenderLayer(canvas.context, canvas, 2);
    expect(canvas.context.setTransform.mock.calls).toEqual([
      [1, 0, 0, 1, 0, 0],
      [2, 0, 0, 2, 0, 0],
    ]);
    expect(canvas.context.clearRect).toHaveBeenCalledWith(0, 0, 2200, 1360);
  });

  it("quadruplica a amostragem das entidades em DPR 2 sem ampliar arena e efeitos", () => {
    const layers = createRenderLayers(fakeCanvas);
    configureRenderLayers(layers, { quality: "high" }, 2);
    const logicalPixels = 1100 * 680;
    expect(layers.entityLayer.width * layers.entityLayer.height).toBe(logicalPixels * 4);
    expect(layers.arenaLayer.width * layers.arenaLayer.height).toBe(logicalPixels);
    expect(layers.effectLayer.width * layers.effectLayer.height).toBe(logicalPixels);
  });
});

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

  it("retém feedback determinístico de impacto no núcleo", () => {
    const runtime = createGraphicsRuntime();
    consumeGraphicsEvents(runtime, [{
      type: "colossoCoreHit", bossId: "colosso", coreExposed: false,
      resisted: true, damageFactor: .35, x: 300, y: 180,
    }], 100, { quality: "high", cameraShake: true });
    expect(runtime.colossoCoreHits).toMatchObject([{ bossId: "colosso", resisted: true, life: 150 }]);
    updateGraphicsRuntime(runtime, 251, 16, {});
    expect(runtime.colossoCoreHits).toHaveLength(0);
  });

  it("mantém a morte visual do Voltriz por 600 ms sem prolongar a entidade lógica", () => {
    const runtime = createGraphicsRuntime();
    consumeGraphicsEvents(runtime, [
      { type: "enemyDeath", entity: { id: "voltriz_dead", type: "voltriz", x: 240, y: 96 } },
    ], 100, { quality: "low", cameraShake: false });

    expect(runtime.deaths).toMatchObject([{ kind: "enemy", life: 600 }]);
    updateGraphicsRuntime(runtime, 699, 16, {});
    expect(runtime.deaths).toHaveLength(1);
    updateGraphicsRuntime(runtime, 700, 16, {});
    expect(runtime.deaths).toHaveLength(0);
  });

  it("mantém a morte visual do Nimbarca por 800 ms sem prolongar a entidade lógica", () => {
    const runtime = createGraphicsRuntime();
    consumeGraphicsEvents(runtime, [
      { type: "enemyDeath", entity: { id: "nimbarca_dead", type: "nimbarca", x: 240, y: 96 } },
    ], 100, { quality: "low", cameraShake: false });

    expect(runtime.deaths).toMatchObject([{ kind: "enemy", life: 800 }]);
    updateGraphicsRuntime(runtime, 899, 16, {});
    expect(runtime.deaths).toHaveLength(1);
    updateGraphicsRuntime(runtime, 900, 16, {});
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

  it("mantém a morte visual do Gorjal por 800 ms sem prolongar a entidade lógica", () => {
    const runtime = createGraphicsRuntime();
    consumeGraphicsEvents(runtime, [
      { type: "enemyDeath", entity: { id: "gorjal_dead", type: "gorjal", x: 240, y: 96 } },
    ], 100, { quality: "low", cameraShake: false });

    expect(runtime.deaths).toMatchObject([{ kind: "enemy", life: 800 }]);
    updateGraphicsRuntime(runtime, 899, 16, {});
    expect(runtime.deaths).toHaveLength(1);
    updateGraphicsRuntime(runtime, 900, 16, {});
    expect(runtime.deaths).toHaveLength(0);
  });

  it("mantem a morte visual do Derivante por 800 ms, inclusive na variante alfa", () => {
    const runtime = createGraphicsRuntime();
    consumeGraphicsEvents(runtime, [
      {
        type: "enemyDeath",
        entity: {
          id: "derivante_dead",
          type: "derivante",
          variant: "alpha",
          x: 240,
          y: 180,
          chapterFourState: "jumping",
          deathVisualY: 132,
        },
      },
    ], 100, { quality: "low", cameraShake: false });

    expect(runtime.deaths).toMatchObject([{
      kind: "enemy",
      life: 800,
      entity: { type: "derivante", deathVisualY: 132 },
    }]);
    updateGraphicsRuntime(runtime, 899, 16, {});
    expect(runtime.deaths).toHaveLength(1);
    updateGraphicsRuntime(runtime, 900, 16, {});
    expect(runtime.deaths).toHaveLength(0);
  });
});
