import { describe, expect, it } from "vitest";
import { PHASE_40_SCENARIO } from "./chapter05/phase40Scenario.js";
import {
  CHAPTER_FIVE_PHASE_BLUEPRINTS,
  CHAPTER_FIVE_PHASES,
} from "./chapterFivePhases.js";

const phase40 = () => CHAPTER_FIVE_PHASES.find(
  (phase) => phase.id === PHASE_40_SCENARIO.id,
);

describe("cenário consolidado da Fase 40", () => {
  it("é a única fonte da defesa inicial e das regras da missão", () => {
    const phase = phase40();

    expect(phase.startingTroops).toBe(PHASE_40_SCENARIO.startingDefense);
    expect(phase.startingTroopRules)
      .toBe(PHASE_40_SCENARIO.startingTroopRules);
    expect(phase.requiredTroopAssetIds)
      .toBe(PHASE_40_SCENARIO.requiredTroopAssetIds);
    expect(phase.troopAssetDependencies)
      .toBe(PHASE_40_SCENARIO.troopAssetDependencies);
  });

  it("declara cinco unidades de cada tipo nas colunas corretas", () => {
    const groups = PHASE_40_SCENARIO.startingDefense.reduce(
      (result, entry) => {
        result[entry.type] ||= [];
        result[entry.type].push(entry);
        return result;
      },
      {},
    );

    expect(groups.bastiaoMare).toEqual(
      Array.from({ length: 5 }, (_, row) => ({
        type: "bastiaoMare", row, col: 6,
      })),
    );
    expect(groups.fuzileiroVoltaico).toEqual(
      Array.from({ length: 5 }, (_, row) => ({
        type: "fuzileiroVoltaico", row, col: 5,
      })),
    );
    expect(groups.medicaNanites).toEqual(
      Array.from({ length: 5 }, (_, row) => ({
        type: "medicaNanites", row, col: 3,
      })),
    );
  });

  it("remove as ondas legadas dos oito blueprints do capítulo", () => {
    expect(CHAPTER_FIVE_PHASE_BLUEPRINTS).toHaveLength(8);
    expect(CHAPTER_FIVE_PHASE_BLUEPRINTS.every(
      (blueprint) => !Object.hasOwn(blueprint, "waves"),
    )).toBe(true);
    expect(CHAPTER_FIVE_PHASE_BLUEPRINTS.map((blueprint) => blueprint.id))
      .toEqual(Array.from(
        { length: 8 },
        (_, index) => `fase_${33 + index}`,
      ));
  });

  it("mantém o contrato final congelado", () => {
    expect(Object.isFrozen(PHASE_40_SCENARIO)).toBe(true);
    expect(Object.isFrozen(PHASE_40_SCENARIO.startingDefense)).toBe(true);
    expect(Object.isFrozen(PHASE_40_SCENARIO.packetSequences)).toBe(true);
    expect(Object.isFrozen(PHASE_40_SCENARIO.bossEncounter)).toBe(true);
    expect(PHASE_40_SCENARIO.maximumLivingEnemies).toBe(48);
  });
});
