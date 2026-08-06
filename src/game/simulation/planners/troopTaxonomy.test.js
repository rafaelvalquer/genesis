import {
  describe,
  expect,
  it,
} from "vitest";
import {
  estimateTroopDps,
  getTroopTags,
} from "./troopTaxonomy.js";

describe("taxonomia do simulador", () => {
  it("classifica economia e frontline", () => {
    expect(
      getTroopTags({
        attack: "energy",
        role: "Economia",
        hp: 18,
      }).has("economy"),
    ).toBe(true);

    expect(
      getTroopTags({
        attack: "melee",
        role: "Linha de frente",
        hp: 80,
        range: .8,
      }).has("frontline"),
    ).toBe(true);
  });

  it("classifica resposta antiaérea e área", () => {
    const tags = getTroopTags({
      attack: "bullet",
      canTargetAir: true,
      burstCount: 4,
      range: 6,
      role: "Antiaéreo / Rajada",
    });

    expect(tags.has("antiAir")).toBe(true);
    expect(tags.has("area")).toBe(true);
    expect(tags.has("ranged")).toBe(true);
  });

  it("calcula DPS usando rajada e intervalo", () => {
    expect(
      estimateTroopDps({
        attack: "bullet",
        damage: 4,
        burst: 3,
        attackEveryMs: 2000,
      }),
    ).toBe(6);
  });
});
