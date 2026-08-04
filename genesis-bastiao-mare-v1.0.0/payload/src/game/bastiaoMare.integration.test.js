import { describe, expect, it } from "vitest";
import { TROOPS } from "./content.js";
import { canPlaceTroop, createBattleSession, createTroopEntity } from "./battleModel.js";
import { createTideCycleHazard, getTideCellState } from "./tideCycle.js";

function phase() {
  return {
    id: "bastiao-test",
    energy: 100,
    baseIntegrity: 100,
    supplyLimit: 20,
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
  it("está registrado com os três estados visuais", () => {
    expect(TROOPS.bastiaoMare).toMatchObject({
      spriteKey: "bastiaoMare",
      assetStates: ["idle", "attack", "death"],
      hp: 110,
      maxDeployed: 3,
    });
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
    const troop = createTroopEntity(session, "bastiaoMare", 0, 8);
    expect(troop).toMatchObject({
      canDeployInFloodedCells: true,
      canDeployInDeepWater: true,
      ignoreTidePressure: true,
      ignoreTideAttackSpeedPenalty: true,
      anchoredWhenFlooded: true,
      floodedDamageTakenFactor: 0.85,
      energyChargeProgress: 0,
    });
    expect(troop.energyPickupSpawnTimes).toEqual([]);
  });
});
