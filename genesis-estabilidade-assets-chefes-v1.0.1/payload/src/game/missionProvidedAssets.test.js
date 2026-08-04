import { describe, expect, it, vi } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import {
  AssetDependencyError,
  resolveBattleTroopAssetIds,
  resolvePhaseEnemyAssetDependencies,
  resolvePhaseEnemyEffectDependencies,
  resolvePhaseTroopAssetDependencies,
} from "./assetCatalog.js";

const phase40 = () => CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_40");

describe("dependências de assets das tropas e inimigos da missão", () => {
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

  it("considera tropas iniciais, obrigatórias, invocadas, temporárias e transformações", () => {
    const phase = {
      id: "fase_teste",
      startingTroops: [{ type: "fuzileiroVoltaico" }],
      troopAssetDependencies: {
        required: ["medicaNanites", "bastiaoMare"],
        alliedSummons: [{ troopId: "reator" }],
        temporaryTroops: ["ranger"],
        transformations: [
          { from: "colono", to: "marine" },
          { sourceType: "krio", targetType: "guarda" },
        ],
      },
    };

    expect(resolvePhaseTroopAssetDependencies(phase, ["sniper"])).toEqual([
      "sniper", "fuzileiroVoltaico", "medicaNanites", "bastiaoMare",
      "reator", "ranger", "colono", "marine", "krio", "guarda",
    ]);
  });

  it("falha no modo estrito e informa fase e origem de um ID inválido", () => {
    expect(() => resolvePhaseTroopAssetDependencies({
      id: "fase_40",
      troopAssetDependencies: { required: ["medicaNanite"] },
    })).toThrowError(AssetDependencyError);

    expect(() => resolvePhaseTroopAssetDependencies({
      id: "fase_40",
      troopAssetDependencies: { required: ["medicaNanite"] },
    })).toThrow(/medicaNanite[\s\S]*fase_40[\s\S]*troopAssetDependencies\.required/);
  });

  it("avisa e continua no modo não estrito", () => {
    const onWarning = vi.fn();
    const ids = resolvePhaseTroopAssetDependencies({
      id: "fase_40",
      startingTroops: [{ type: "marine" }],
      troopAssetDependencies: { required: ["medicaNanite"] },
    }, [], { strict: false, onWarning });

    expect(ids).toEqual(["marine"]);
    expect(onWarning).toHaveBeenCalledOnce();
    expect(onWarning.mock.calls[0][0]).toContain("medicaNanite");
  });

  it("resolve recursivamente as dependências da Rainha Operária", () => {
    expect(resolvePhaseEnemyAssetDependencies(null, ["workerQueen"])).toEqual([
      "workerQueen", "workerQueenEgg", "silicaDigger",
    ]);
  });

  it("inclui o chefe e expõe seus efeitos declarados na Fase 40", () => {
    const enemies = resolvePhaseEnemyAssetDependencies(phase40());
    const effects = resolvePhaseEnemyEffectDependencies(phase40(), enemies);
    expect(enemies).toContain("leviathanNereida");
    expect(effects).toEqual(expect.arrayContaining([
      "leviathanBrine", "leviathanVortex", "leviathanDeluge",
    ]));
  });
});
