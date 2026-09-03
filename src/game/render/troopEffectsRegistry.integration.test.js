import { describe, expect, it } from "vitest";
import "./entityRenderer.js";
import { getTroopVisualEffects, hasTroopVisualEffects } from "./troopEffectsRegistry.js";

describe("troop visual effects registry integration", () => {
  it("registra as tropas com efeitos específicos usados pelo entity renderer", () => {
    expect(hasTroopVisualEffects("lumiUrsa7")).toBe(true);
    expect(hasTroopVisualEffects("medicaNanites")).toBe(true);
    expect(hasTroopVisualEffects("cacadorLeviatas")).toBe(true);
    expect(hasTroopVisualEffects("executorArco")).toBe(true);
    expect(hasTroopVisualEffects("aresT")).toBe(true);
  });

  it("expõe cada efeito no estágio que preserva o z-order histórico", () => {
    expect(getTroopVisualEffects("lumiUrsa7").beforeSpecial).toEqual(expect.any(Function));
    expect(getTroopVisualEffects("medicaNanites").afterSpecial).toEqual(expect.any(Function));
    expect(getTroopVisualEffects("cacadorLeviatas").afterSpecial).toEqual(expect.any(Function));
    expect(getTroopVisualEffects("executorArco").afterSpecial).toEqual(expect.any(Function));
    expect(getTroopVisualEffects("aresT").afterHealth).toEqual(expect.any(Function));
  });
});
