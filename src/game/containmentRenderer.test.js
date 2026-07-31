import { describe, expect, it } from "vitest";
import {
  clearContainmentCache,
  getContainmentCacheKey,
  getContainmentStaticLayer,
  getContainmentTheme,
  getContainmentVisualState,
} from "./containmentRenderer.js";
import { createGraphicsRuntime } from "./graphicsRuntime.js";

const phase = {
  arenaId: "test_arena",
  waveIntensity: [0.3, 0.78],
  palette: { primary: "#22d3ee", accent: "#f59e0b" },
  battlefieldTheme: { material: "metal", seed: 17, lane: "#173447", laneAlt: "#1d4052" },
};

describe("contencao superior", () => {
  it("sinaliza ondas perigosas sem mudar o estado de batalha", () => {
    const session = { phase, waveIndex: 1, preparing: false, enemies: [] };
    const snapshot = structuredClone(session);
    expect(getContainmentVisualState(session, createGraphicsRuntime(), 100)).toMatchObject({
      dangerous: true,
      interference: false,
    });
    expect(session).toEqual(snapshot);
  });

  it("mantem interferencia enquanto um Alfa estiver ativo", () => {
    const session = {
      phase, waveIndex: 0, preparing: true,
      enemies: [{ variant: "alpha", dead: false }],
    };
    expect(getContainmentVisualState(session, createGraphicsRuntime(), 100)).toMatchObject({
      bossActive: true,
      interference: true,
    });
  });

  it("ignora reações de spawn e deriva a intensidade sem alterar a sessão", () => {
    const runtime = createGraphicsRuntime();
    runtime.containmentArcs.push({ row: 3, born: 100, life: 500 });
    const session = { phase, waveIndex: 0, preparing: true, enemies: [] };
    const state = getContainmentVisualState(session, runtime, 200);
    expect(state.routeCharge).toHaveLength(5);
    expect(state.routeCharge[3]).toBe(0);
    expect(state.routeCharge[0]).toBe(0);
    expect(state.flowIntensity).toBeGreaterThan(0.2);
  });

  it("realça somente mudanças de estado e não reinicia o pulso a cada spawn", () => {
    const runtime = createGraphicsRuntime();
    const session = { phase, waveIndex: 0, preparing: false, enemies: [], queue: [] };
    getContainmentVisualState(session, runtime, 100);
    session.enemies.push({ id: "near_1", type: "medu", row: 2, x: 118, dead: false });
    const changed = getContainmentVisualState(session, runtime, 200);
    expect(changed.routeTelemetry[2].state).toBe("critical");
    expect(changed.routeCharge[2]).toBe(1);

    session.enemies.push({ id: "near_2", type: "medu", row: 2, x: 120, dead: false });
    const sameState = getContainmentVisualState(session, runtime, 300);
    expect(sameState.routeTelemetry[2].state).toBe("critical");
    expect(sameState.routeCharge[2]).toBeLessThan(1);
  });

  it("adapta materiais de floresta, colmeia e vidro", () => {
    expect(getContainmentTheme({ battlefieldTheme: { material: "earth" }, ambientEffects: ["spores"] }).kind).toBe("natural");
    expect(getContainmentTheme({ battlefieldTheme: { material: "chitin" }, ambientEffects: ["veins"] }).kind).toBe("organic");
    expect(getContainmentTheme({ battlefieldTheme: { material: "obsidian-glass" }, ambientEffects: ["refraction"] }).kind).toBe("glass");
    expect(getContainmentTheme(phase).kind).toBe("industrial");
  });

  it("reutiliza o fundo estatico e invalida por qualidade", () => {
    clearContainmentCache();
    let created = 0;
    const factory = () => {
      created += 1;
      return { id: created, getContext: () => null };
    };
    const high = getContainmentStaticLayer(phase, { quality: "high" }, factory);
    expect(getContainmentStaticLayer(phase, { quality: "high" }, factory)).toBe(high);
    expect(getContainmentStaticLayer(phase, { quality: "low" }, factory)).not.toBe(high);
    expect(created).toBe(2);
    expect(getContainmentCacheKey(phase, { quality: "high" })).not.toBe(getContainmentCacheKey(phase, { quality: "low" }));
  });
});
