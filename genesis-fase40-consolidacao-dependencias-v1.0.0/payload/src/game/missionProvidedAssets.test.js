import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import {
  resolveBattleTroopAssetIds,
  resolvePhaseTroopAssetDependencies,
} from "./assetCatalog.js";

const phase40 = () => CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_40");

describe("dependências de assets das tropas da missão", () => {
  it("carrega Bastiões, Fuzileiros e Médicas mesmo fora do loadout da Fase 40", () => {
    const ids = resolvePhaseTroopAssetDependencies(phase40(), ["marine"]);

    expect(ids).toContain("marine");
    expect(ids).toContain("bastiaoMare");
    expect(ids).toContain("fuzileiroVoltaico");
    expect(ids).toContain("medicaNanites");
  });

  it("mantém compatibilidade com resolveBattleTroopAssetIds", () => {
    expect(resolveBattleTroopAssetIds(phase40(), ["marine"]))
      .toEqual(resolvePhaseTroopAssetDependencies(phase40(), ["marine"]));
  });

  it("não duplica assets presentes em mais de uma origem", () => {
    const ids = resolvePhaseTroopAssetDependencies(
      phase40(),
      ["bastiaoMare", "marine", "medicaNanites"],
    );

    expect(ids.filter((id) => id === "bastiaoMare")).toHaveLength(1);
    expect(ids.filter((id) => id === "medicaNanites")).toHaveLength(1);
  });

  it("mantém o comportamento normal nas fases sem dependências adicionais", () => {
    const phase39 = CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_39");

    expect(resolvePhaseTroopAssetDependencies(phase39, ["marine", "reator"]))
      .toEqual(["marine", "reator"]);
  });

  it("considera tropas iniciais, obrigatórias, invocadas, temporárias e transformações", () => {
    const phase = {
      startingTroops: [{ type: "fuzileiroVoltaico" }],
      requiredTroopAssetIds: ["bastiaoMare"],
      troopAssetDependencies: {
        required: ["medicaNanites"],
        alliedSummons: [{ troopId: "reator" }],
        temporaryTroops: ["ranger"],
        transformations: [
          { from: "colono", to: "marine" },
          { sourceType: "krio", targetType: "guarda" },
        ],
      },
    };

    expect(resolvePhaseTroopAssetDependencies(phase, ["sniper"])).toEqual([
      "sniper",
      "fuzileiroVoltaico",
      "bastiaoMare",
      "medicaNanites",
      "reator",
      "ranger",
      "colono",
      "marine",
      "krio",
      "guarda",
    ]);
  });

  it("aceita declarações equivalentes diretamente na fase", () => {
    const phase = {
      alliedSummons: [{ assetTroopId: "reator" }],
      temporaryTroops: [{ type: "ranger" }],
      troopTransformations: [{ from: "colono", transformsInto: "marine" }],
    };

    expect(resolvePhaseTroopAssetDependencies(phase)).toEqual([
      "reator",
      "ranger",
      "colono",
      "marine",
    ]);
  });

  it("ignora entradas inválidas, nulas e IDs inexistentes", () => {
    const phase = {
      startingTroops: [
        { type: "marine" },
        { type: "tropaInexistente" },
        null,
      ],
      troopAssetDependencies: {
        alliedSummons: [null, { type: "outraTropaInexistente" }],
      },
    };

    expect(resolvePhaseTroopAssetDependencies(phase, null)).toEqual(["marine"]);
  });
});
