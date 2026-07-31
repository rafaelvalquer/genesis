import { describe, expect, it } from "vitest";
import {
  calculateAdvanceChance,
  calculateRetreatChance,
  createTideCycleHazard,
  createTideCycleState,
  getTideAdjustedEnemySlowFactor,
  getTideCellState,
  getTideEnemySpeedFactor,
  getTidePlacementBlockReason,
  getTideSnapshot,
  recordTideTroopElimination,
  resetTideCycleForWave,
  updateTideCycle,
} from "./tideCycle.js";
import { CELL } from "./visualGeometry.js";

const rows = (col) => Array.from({ length: 5 }, (_, row) => [row, col]);

function hazard(overrides = {}) {
  return createTideCycleHazard(0, {
    permanentWaterCells: rows(9),
    intertidalBands: [
      { level: 1, cells: rows(8) },
      { level: 2, cells: rows(7) },
    ],
    initialLevel: 0,
    maximumLevel: 2,
    minimumLevelByWave: [0, 0, 0, 0, 0, 0],
    minimumSafeCells: 15,
    firstEvaluationDelayMs: 0,
    evaluationIntervalMs: 1000,
    minimumStableMs: 0,
    warningAdvanceMs: 10,
    warningRetreatMs: 10,
    risingMs: 10,
    recedingMs: 10,
    dryingMs: 10,
    minTroops: 1,
    densityStartTroops: 1,
    densityMaximumTroops: 10,
    baseAdvanceChance: 0,
    maximumAdvanceChance: 1,
    maximumDensityBonus: 0.5,
    baseRetreatChance: 0,
    maximumRetreatChance: 1,
    maximumLossRetreatBonus: 0.8,
    lowPopulationBonus: 0,
    retreatPenaltyPerWave: 0,
    stabilityBonusPerStep: 0,
    maximumStabilityBonus: 0,
    pressureMaximumHpRatio: 0.10,
    submergedAttackSpeedFactor: 0.80,
    enemySpeedFactor: 1.20,
    enemySlowResistance: 0.30,
    ...overrides,
  });
}

function troop(id, row, col, extra = {}) {
  return {
    id,
    type: "marine",
    row,
    col,
    x: col * CELL.width + CELL.width / 2,
    y: row * 120 + 60,
    hp: 100,
    maxHp: 100,
    dead: false,
    ...extra,
  };
}

function session(config = hazard(), troops = [], rolls = [0]) {
  const queue = [...rolls];
  const value = {
    phase: { environmentHazard: config },
    tideCycle: createTideCycleState(),
    elapsed: 0,
    waveStartedAt: 0,
    waveIndex: 0,
    waveActive: true,
    troops,
    rng: () => queue.length ? queue.shift() : 0.99,
  };
  resetTideCycleForWave(value, config);
  return value;
}

describe("maré territorial progressiva", () => {
  it("mantém água profunda permanente e diferencia a zona intermaré seca", () => {
    const battle = session();

    expect(getTideCellState(battle, 0, 9)).toMatchObject({
      type: "deepWater",
      flooded: true,
      deployable: false,
    });
    expect(getTideCellState(battle, 0, 8)).toMatchObject({
      type: "intertidal",
      status: "dry",
      flooded: false,
      deployable: true,
    });
    expect(getTideCellState(battle, 0, 5)).toMatchObject({
      type: "firmGround",
      flooded: false,
      deployable: true,
    });
  });

  it("bloqueia implantação em água profunda, faixa alagada e faixa secando", () => {
    const battle = session();
    expect(getTidePlacementBlockReason(battle, 0, 9)).toContain("Água profunda");
    expect(getTidePlacementBlockReason(battle, 0, 8)).toBeNull();

    battle.tideCycle.currentLevel = 1;
    battle.tideCycle.targetLevel = 1;
    expect(getTidePlacementBlockReason(battle, 0, 8)).toContain("alagada");

    battle.tideCycle.currentLevel = 0;
    battle.tideCycle.state = "drying";
    battle.tideCycle.dryingCells = [[0, 8]];
    expect(getTidePlacementBlockReason(battle, 0, 8)).toContain("encharcada");
  });

  it("aumenta a chance de avanço conforme a população", () => {
    const config = hazard({ baseAdvanceChance: 0.10, maximumDensityBonus: 0.50 });
    const small = session(config, [troop("a", 0, 1)]);
    const large = session(config, Array.from({ length: 10 }, (_, index) => troop(`t${index}`, index % 5, 1 + Math.floor(index / 5))));

    expect(calculateAdvanceChance(large)).toBeGreaterThan(calculateAdvanceChance(small));
  });

  it("perdas reais reduzem avanço e aumentam recuo", () => {
    const config = hazard({
      baseAdvanceChance: 0.45,
      maximumDensityBonus: 0.20,
      baseRetreatChance: 0.05,
      maximumLossRetreatBonus: 0.80,
    });
    const troops = Array.from({ length: 8 }, (_, index) => troop(`t${index}`, index % 5, 1 + Math.floor(index / 5)));
    const battle = session(config, troops);
    battle.tideCycle.currentLevel = 1;
    battle.tideCycle.targetLevel = 1;
    const advanceBefore = calculateAdvanceChance(battle);
    const retreatBefore = calculateRetreatChance(battle);

    const lost = battle.troops.pop();
    recordTideTroopElimination(battle, lost, "enemy");
    const advanceAfter = calculateAdvanceChance(battle);
    const retreatAfter = calculateRetreatChance(battle);

    expect(advanceAfter).toBeLessThan(advanceBefore);
    expect(retreatAfter).toBeGreaterThan(retreatBefore);
  });

  it("ignora remoção manual na janela de perdas", () => {
    const battle = session(hazard(), [troop("a", 0, 1)]);
    expect(recordTideTroopElimination(battle, battle.troops[0], "manualRemoval")).toBe(false);
    expect(battle.tideCycle.recentTroopLosses).toHaveLength(0);
  });

  it("avança somente um nível por transição", () => {
    const config = hazard({
      baseAdvanceChance: 1,
      maximumAdvanceChance: 1,
      maximumDensityBonus: 0,
    });
    const battle = session(config, [troop("a", 0, 1)], [0]);
    const events = [];

    updateTideCycle(battle, events);
    expect(battle.tideCycle.state).toBe("warningAdvance");
    battle.elapsed = 10;
    updateTideCycle(battle, events);
    expect(battle.tideCycle.state).toBe("rising");
    battle.elapsed = 20;
    updateTideCycle(battle, events);

    expect(battle.tideCycle.currentLevel).toBe(1);
    expect(battle.tideCycle.state).toBe("stable");
    expect(events.some((event) => event.type === "tideAdvanced")).toBe(true);
  });

  it("recuará após perdas quando o sorteio favorecer recuperação", () => {
    const config = hazard({
      baseAdvanceChance: 0,
      maximumDensityBonus: 0,
      baseRetreatChance: 0,
      maximumLossRetreatBonus: 1,
      maximumRetreatChance: 1,
    });
    const troops = Array.from({ length: 5 }, (_, index) => troop(`t${index}`, index, 1));
    const battle = session(config, troops, [0]);
    battle.tideCycle.currentLevel = 1;
    battle.tideCycle.targetLevel = 1;
    const lost = battle.troops.pop();
    recordTideTroopElimination(battle, lost, "enemy");
    battle.tideCycle.nextEvaluationAt = 0;
    const events = [];

    updateTideCycle(battle, events);
    expect(battle.tideCycle.state).toBe("warningRetreat");
    battle.elapsed = 10;
    updateTideCycle(battle, events);
    battle.elapsed = 20;
    updateTideCycle(battle, events);
    expect(battle.tideCycle.currentLevel).toBe(0);
    expect(battle.tideCycle.state).toBe("drying");
  });

  it("mantém o nível territorial entre ondas e respeita o mínimo da próxima onda", () => {
    const config = hazard({ minimumLevelByWave: [0, 1, 1, 1, 1, 1] });
    const battle = session(config);
    battle.tideCycle.currentLevel = 1;
    battle.tideCycle.targetLevel = 1;
    battle.waveIndex = 1;
    battle.elapsed = 100;

    resetTideCycleForWave(battle, config);
    expect(battle.tideCycle.currentLevel).toBe(1);
    expect(battle.tideCycle.minimumLevel).toBe(1);
  });

  it("acelera inimigos e reduz a eficiência da lentidão em qualquer área alagada", () => {
    const battle = session();
    const enemy = { id: "e", row: 0, x: 9 * CELL.width + 10, dead: false };

    expect(getTideEnemySpeedFactor(battle, enemy)).toBeCloseTo(1.20);
    expect(getTideAdjustedEnemySlowFactor(battle, enemy, 0.50)).toBeCloseTo(0.65);
  });

  it("aplica um pulso limitado de pressão à tropa inundada", () => {
    const config = hazard({
      initialLevel: 1,
      pressureGraceMs: 2000,
      pressureDurationMs: 5000,
      pressureMaximumHpRatio: 0.10,
      firstEvaluationDelayMs: 999999,
    });
    const target = troop("submersa", 0, 8);
    const battle = session(config, [target]);
    const events = [];

    updateTideCycle(battle, events);
    expect(target.submerged).toBe(true);
    battle.elapsed = 7000;
    updateTideCycle(battle, events);

    expect(target.hp).toBeCloseTo(90);
    expect(getTideSnapshot(battle).submergedTroopIds).toContain(target.id);
  });
});
