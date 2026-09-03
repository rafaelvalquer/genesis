import { describe, expect, it } from "vitest";
import { getEnemyVisualEffects, registerEnemyVisualEffects } from "./enemyEffectsRegistry.js";
import { getTroopVisualEffects, registerTroopVisualEffects } from "./troopEffectsRegistry.js";

describe("visual effect registries", () => {
  it("retorna efeitos registrados e fallback vazio", () => {
    const effect = () => {};
    registerEnemyVisualEffects("testEnemyEffects", { beforeSprite: effect });
    registerTroopVisualEffects("testTroopEffects", { overlay: effect });
    expect(getEnemyVisualEffects("testEnemyEffects").beforeSprite).toBe(effect);
    expect(getTroopVisualEffects("testTroopEffects").overlay).toBe(effect);
    expect(getEnemyVisualEffects("missing")).toEqual({});
    expect(getTroopVisualEffects("missing")).toEqual({});
  });

  it("rejeita registro duplicado", () => {
    registerEnemyVisualEffects("duplicateEnemyEffects", {});
    registerTroopVisualEffects("duplicateTroopEffects", {});
    expect(() => registerEnemyVisualEffects("duplicateEnemyEffects", {})).toThrow(/already registered/);
    expect(() => registerTroopVisualEffects("duplicateTroopEffects", {})).toThrow(/already registered/);
  });
});
