import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "./chapterSixPhases.js";
import { createBattleSession, createTroopEntity, spawnEnemy, stepBattle } from "./battleModel.js";
import { ENEMIES } from "./content.js";
import { isEnemyTargetable } from "./enemyTargeting.js";
import { getTemporaryMagmaAt, isSessionMagmaCell } from "./thermalTerrain.js";
import { getEnemyAnimation } from "./visualGeometry.js";

describe("Verme Incubador", () => {
  const sandbox = (seed = 1) => createBattleSession(CHAPTER_SIX_PHASES[2], ["colono"], seed, {
    sandbox: true,
    sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 },
  });

  it("nasce com os atributos e estados corretos, sem estado hit", () => {
    const session = sandbox(101);
    const enemy = spawnEnemy(session, { type: "vermeIncubador", row: 2 }).enemies[0];
    expect(enemy).toMatchObject({ hp: 82, maxHp: 82, speed: 12, incubatorState: "crawl", incubatorSubmerged: false });
    expect(ENEMIES.vermeIncubador.assetStates).toEqual(["idle", "attack", "burrowing", "emerging", "death"]);
    expect(ENEMIES.vermeIncubador.assetStates).not.toContain("hit");
    expect(isEnemyTargetable(enemy)).toBe(true);
  });

  it("cria fissura na célula travada, queima a tropa e deixa o verme intocável no trânsito", () => {
    const session = sandbox(102);
    const troop = createTroopEntity(session, "colono", 0, 3);
    session.troops.push(troop);
    const enemy = spawnEnemy(session, { type: "vermeIncubador", row: 2 }).enemies[0];
    enemy.x = troop.x + 200;
    for (let index = 0; index < 340; index += 1) stepBattle(session, 32);
    const hazard = getTemporaryMagmaAt(session, troop.row, troop.col);
    expect(hazard).toMatchObject({ row: troop.row, col: troop.col, thermalState: "eruption", active: true });
    expect(isSessionMagmaCell(session, troop.row, troop.col)).toBe(true);
    expect(troop.thermalBurning).toBe(true);
    expect(enemy.incubatorState).toBe("undergroundReturn");
    expect(isEnemyTargetable(enemy)).toBe(false);
  });

  it("mapeia somente os cinco estados visuais definidos", () => {
    const enemy = { type: "vermeIncubador", incubatorState: "burrowOrigin", incubatorStateStartedAt: 0, incubatorStateEndsAt: 800 };
    expect(getEnemyAnimation(enemy, ENEMIES.vermeIncubador, 400, { idle: 8, attack: 8, burrowing: 8, emerging: 8, death: 8 })).toEqual({ state: "burrowing", frame: 4 });
  });
});
