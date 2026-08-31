import { describe, expect, it } from "vitest";
import { formatDuration, formatTacticalSpecial } from "./tacticalFormatters.js";

describe("tacticalFormatters", () => {
  it("traduz atributos internos para texto de jogador", () => {
    expect(formatTacticalSpecial("energyGenerated", 175)).toEqual({ label: "Energia gerada", value: "175" });
    expect(formatTacticalSpecial("freezeDurationMs", 14200)).toEqual({ label: "Tempo congelado", value: "14,2 s" });
  });

  it("formata durações extensas", () => {
    expect(formatDuration(65000)).toBe("1m 5s");
  });
});
