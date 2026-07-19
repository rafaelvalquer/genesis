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

  it("deriva carga de rota e intensidade do fluxo sem alterar a sessao", () => {
    const runtime = createGraphicsRuntime();
    runtime.containmentArcs.push({ row: 3, born: 100, life: 500 });
    const session = { phase, waveIndex: 0, preparing: true, enemies: [] };
    const state = getContainmentVisualState(session, runtime, 200);
    expect(state.routeCharge).toHaveLength(5);
    expect(state.routeCharge[3]).toBeCloseTo(0.8);
    expect(state.routeCharge[0]).toBe(0);
    expect(state.flowIntensity).toBeGreaterThan(0.2);
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
