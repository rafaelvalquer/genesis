import { describe, expect, it } from "vitest";
import { TROOPS } from "../game/content.js";
import { filterCatalogTroops, getTroopCatalogType, normalizeCatalogSearch, sortCatalogTroops } from "./troopCatalogConfig.js";

describe("configuração do catálogo de tropas", () => {
  it("classifica exatamente todas as tropas", () => {
    expect(Object.keys(TROOPS).every((id) => getTroopCatalogType(TROOPS[id]))).toBe(true);
  });
  it("mantém aparição como ordenação cronológica", () => {
    const troops = sortCatalogTroops(Object.values(TROOPS));
    expect(troops[0].unlockAt).toBe(0);
    expect(troops.every((troop, index) => index === 0 || troops[index - 1].unlockAt <= troop.unlockAt)).toBe(true);
  });
  it("combina categoria e busca sem perder acentos", () => {
    expect(normalizeCatalogSearch("Caçador")).toBe("cacador");
    expect(filterCatalogTroops(Object.values(TROOPS), "specialist", "Ícaro").map((troop) => troop.id)).toContain("interceptadorIcaro");
  });
});
