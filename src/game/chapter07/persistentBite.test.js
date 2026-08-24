import { describe, expect, it } from "vitest";
import { commitPersistentBite, getPersistentBiteMultiplier, resetPersistentBite } from "./persistentBite.js";

describe("Mordida Persistente", () => {
  it("escala somente após impactos confirmados e trava em 120%", () => {
    const enemy = {};
    const config = { multipliers: [1, 1.1, 1.2], maxHitsForScaling: 2 };
    expect(getPersistentBiteMultiplier(enemy, "t1", config)).toBe(1);
    commitPersistentBite(enemy, "t1", config);
    expect(getPersistentBiteMultiplier(enemy, "t1", config)).toBe(1.1);
    commitPersistentBite(enemy, "t1", config);
    expect(getPersistentBiteMultiplier(enemy, "t1", config)).toBe(1.2);
    commitPersistentBite(enemy, "t1", config);
    expect(enemy.persistentBiteHits).toBe(3);
    expect(getPersistentBiteMultiplier(enemy, "t1", config)).toBe(1.2);
  });
  it("trocar o alvo e resetar limpa o frenesi", () => {
    const enemy = {}; const config = { multipliers: [1, 1.1, 1.2], maxHitsForScaling: 2 };
    commitPersistentBite(enemy, "a", config); commitPersistentBite(enemy, "a", config);
    commitPersistentBite(enemy, "b", config);
    expect(enemy.persistentBiteTargetId).toBe("b"); expect(enemy.persistentBiteHits).toBe(1);
    resetPersistentBite(enemy); expect(enemy).toMatchObject({ persistentBiteTargetId: null, persistentBiteHits: 0, frenzyLevel: 0, persistentBiteMultiplier: 1 });
  });
});
