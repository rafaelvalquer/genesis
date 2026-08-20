import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import { TROOPS } from "./content.js";
import { CELL, createBattleSession, placeTroop, spawnEnemy, stepBattle } from "./battleModel.js";
import { getTideTroopAttackSpeedFactor } from "./tideCycle.js";

describe("Fuzileiro Voltaico — integração com Genesis", () => {
  it("registra configuração, estados visuais e sprites dedicados", () => {
    expect(TROOPS.fuzileiroVoltaico).toMatchObject({
      id: "fuzileiroVoltaico",
      spriteKey: "fuzileiroVoltaico",
      attack: "chainLightning",
      hp: 30,
      damage: 9,
      primaryWaterDamageFactor: 1.2,
      secondaryDamageFactor: 0.2,
      secondaryWaterDamageFactor: 0.4,
      canDeployInFloodedCells: true,
      canDeployInDeepWater: true,
      ignoreTidePressure: true,
      ignoreTideAttackSpeedPenalty: true,
      assetStates: ["idle", "attack", "death"],
    });
  });

  it("permite implantação em água profunda sem liberar outras tropas", () => {
    const phase = CHAPTER_FIVE_PHASES[0];
    const [row, col] = phase.environmentHazard.permanentWaterCells
      .find(([, candidateCol]) => candidateCol >= 1 && candidateCol <= 9);

    const voltaicSession = createBattleSession(
      phase,
      ["fuzileiroVoltaico"],
      55101,
      { sandbox: true },
    );
    const voltaicResult = placeTroop(voltaicSession, "fuzileiroVoltaico", row, col);
    expect(voltaicResult.ok).toBe(true);
    expect(voltaicResult.troop).toMatchObject({
      amphibious: true,
      ignoreTidePressure: true,
      ignoreTideAttackSpeedPenalty: true,
    });
    expect(getTideTroopAttackSpeedFactor(voltaicSession, voltaicResult.troop)).toBe(1);

    const marineSession = createBattleSession(phase, ["marine"], 55102, { sandbox: true });
    const marineResult = placeTroop(marineSession, "marine", row, col);
    expect(marineResult.ok).toBe(false);
  });

  it("não sofre dano de pressão permanecendo em água profunda", () => {
    const phase = CHAPTER_FIVE_PHASES[7];
    const [row, col] = phase.environmentHazard.permanentWaterCells
      .find(([, candidateCol]) => candidateCol >= 1 && candidateCol <= 9);
    const session = createBattleSession(
      phase,
      ["fuzileiroVoltaico"],
      55103,
      { sandbox: true },
    );
    const troop = phase.environmentHazard.permanentWaterCells
      .map(([row, col]) => placeTroop(session, "fuzileiroVoltaico", row, col))
      .find((result) => result.ok)?.troop;
    expect(troop).toBeTruthy();
    const initialHp = troop.hp;

    stepBattle(session, 1);
    stepBattle(session, phase.environmentHazard.pressureGraceMs
      + phase.environmentHazard.pressureDurationMs + 1000);

    expect(troop.dead).toBe(false);
    expect(troop.hp).toBe(initialHp);
  });

  it("libera um raio principal e propaga para inimigos próximos", () => {
    const phase = CHAPTER_FIVE_PHASES[0];
    const session = createBattleSession(
      phase,
      ["fuzileiroVoltaico"],
      55104,
      { sandbox: true, sandboxSettings: { enemySpeedMultiplier: 0 } },
    );
    const troop = placeTroop(session, "fuzileiroVoltaico", 0, 4).troop;
    const primary = spawnEnemy(session, { type: "mordelume", row: 0 }).enemies[0];
    const sameRow = spawnEnemy(session, { type: "mordelume", row: 0 }).enemies[0];
    const adjacentRow = spawnEnemy(session, { type: "mordelume", row: 1 }).enemies[0];
    const distantRow = spawnEnemy(session, { type: "mordelume", row: 3 }).enemies[0];

    primary.x = 9 * CELL.width + 10;
    sameRow.x = primary.x + 24;
    adjacentRow.x = primary.x + 8;
    distantRow.x = primary.x + 8;
    for (const target of [primary, sameRow, adjacentRow, distantRow]) {
      target.previousX = target.x;
      target.previousRenderX = target.x;
      target.speed = 0;
      target.baseSpeed = 0;
      target.hp = 100;
      target.maxHp = 100;
      target.attackReadyAt = Infinity;
    }

    stepBattle(session, 1);
    const events = stepBattle(session, TROOPS.fuzileiroVoltaico.attackVisual.releaseMs);
    const discharge = events.find((event) => event.type === "voltaicDischarge");

    expect(discharge).toBeTruthy();
    expect(discharge.primaryTargetId).toBe(primary.id);
    expect(discharge.primaryInWater).toBe(true);
    expect(discharge.chains.map((entry) => entry.targetId)).toEqual(
      expect.arrayContaining([sameRow.id, adjacentRow.id]),
    );
    expect(discharge.chains.map((entry) => entry.targetId)).not.toContain(distantRow.id);
    expect(primary.hp).toBeLessThan(100);
    expect(sameRow.hp).toBeLessThan(100);
    expect(adjacentRow.hp).toBeLessThan(100);
    expect(distantRow.hp).toBe(100);
    expect(troop.attackReleased).toBe(true);
  });

});
