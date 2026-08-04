import { describe, expect, it } from "vitest";
import { TROOPS } from "./content.js";
import {
  canPlaceTroop,
  createBattleSession,
  createTroopEntity,
  getTroopDeploymentLimit,
} from "./battleModel.js";
import { createTideCycleHazard, getTideCellState } from "./tideCycle.js";

function phase() {
  return {
    id: "bastiao-test",
    energy: 300,
    baseIntegrity: 100,
    supplyLimit: 100,
    targetDurationMs: 60000,
    waves: [{ enemies: [] }],
    environmentHazard: createTideCycleHazard(0, {
      permanentWaterCells: [[0, 8]],
      intertidalBands: [{ level: 1, cells: [[0, 7]] }],
      initialLevel: 1,
      maximumLevel: 1,
    }),
  };
}

describe("integração do Bastião de Maré", () => {
  it("está registrado com os três estados visuais e limite cinco", () => {
    expect(TROOPS.bastiaoMare).toMatchObject({
      spriteKey: "bastiaoMare",
      assetStates: ["idle", "attack", "death"],
      hp: 110,
      maxDeployed: 5,
      overloadDamage: 5,
      overloadRadiusTiles: 1.25,
      overloadMaxTargets: 6,
      overloadBossDamageFactor: 0.5,
    });
    expect(getTroopDeploymentLimit("bastiaoMare")).toBe(5);
  });

  it("pode ser implantado em água profunda e zona alagada", () => {
    const session = createBattleSession(phase(), ["bastiaoMare"], 7);
    session.tideCycle.initialized = true;
    session.tideCycle.currentLevel = 1;
    session.tideCycle.targetLevel = 1;
    expect(getTideCellState(session, 0, 8).flooded).toBe(true);
    expect(getTideCellState(session, 0, 7).flooded).toBe(true);
    expect(canPlaceTroop(session, "bastiaoMare", 0, 8)).toBeNull();
    expect(canPlaceTroop(session, "bastiaoMare", 0, 7)).toBeNull();
  });

  it("transfere as propriedades anfíbias e econômicas para a entidade", () => {
    const session = createBattleSession(phase(), ["bastiaoMare"], 7);
    const unit = createTroopEntity(session, "bastiaoMare", 0, 8);
    expect(unit).toMatchObject({
      canDeployInFloodedCells: true,
      canDeployInDeepWater: true,
      ignoreTidePressure: true,
      ignoreTideAttackSpeedPenalty: true,
      anchoredWhenFlooded: true,
      floodedDamageTakenFactor: 0.85,
      energyChargeProgress: 0,
    });
    expect(unit.energyPickupSpawnTimes).toEqual([]);
  });

  it("permite cinco unidades e bloqueia a sexta", () => {
    const session = createBattleSession(phase(), ["bastiaoMare"], 7);
    for (let index = 0; index < 5; index += 1) {
      session.troops.push(createTroopEntity(session, "bastiaoMare", index % 5, 1 + index));
    }
    expect(canPlaceTroop(session, "bastiaoMare", 4, 6)).toContain("Limite de 5");
  });
});
