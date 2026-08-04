import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import { resolveBattleTroopAssetIds } from "./assetCatalog.js";

const phase40 = () => CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_40");

describe("assets das tropas fornecidas pela missão", () => {
  it("carrega Bastiões, Fuzileiros e Médicas mesmo fora do loadout da Fase 40", () => {
    const ids = resolveBattleTroopAssetIds(phase40(), ["marine"]);

    expect(ids).toContain("marine");
    expect(ids).toContain("bastiaoMare");
    expect(ids).toContain("fuzileiroVoltaico");
    expect(ids).toContain("medicaNanites");
  });

  it("não duplica assets quando o jogador também escolhe uma tropa fornecida", () => {
    const ids = resolveBattleTroopAssetIds(
      phase40(),
      ["bastiaoMare", "marine", "medicaNanites"],
    );

    expect(ids.filter((id) => id === "bastiaoMare")).toHaveLength(1);
    expect(ids.filter((id) => id === "medicaNanites")).toHaveLength(1);
  });

  it("mantém o comportamento normal nas fases sem defesa inicial", () => {
    const phase39 = CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_39");
    expect(resolveBattleTroopAssetIds(phase39, ["marine", "reator"]))
      .toEqual(["marine", "reator"]);
  });

  it("ignora entradas inválidas sem interromper o carregamento", () => {
    const phase = {
      startingTroops: [
        { type: "marine" },
        { type: "tropaInexistente" },
        null,
      ],
    };

    expect(resolveBattleTroopAssetIds(phase, null)).toEqual(["marine"]);
  });
});
