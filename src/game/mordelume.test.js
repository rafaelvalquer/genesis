import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import { CELL, createBattleSession, FIELD, placeTroop, spawnEnemy, stepBattle } from "./battleModel.js";
import { getEnemyAnimation } from "./visualGeometry.js";

function setup() {
  const session = createBattleSession(
    { ...PHASES[32], id: "mordelume-test", waves: [] }, Object.keys(TROOPS), 31,
    { sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 } },
  );
  const wall = placeTroop(session, "muralhaReforcada", 0, 3).troop;
  const enemy = spawnEnemy(session, { type: "mordelume", row: 0 }).enemies[0];
  return { session, wall, enemy };
}

describe("Mordelume", () => {
  it("fica disponível no Campo de Provas com os sete estados de sprite", () => {
    expect(ENEMIES.mordelume.assetStates).toHaveLength(7);
    const { enemy } = setup();
    expect(enemy.mordelumeState).toBe("spawnEmerge");
  });

  it("aplica duas mordidas nos frames 4 e 6", () => {
    const { session, wall, enemy } = setup();
    enemy.x = wall.x + ENEMIES.mordelume.attackRangeTiles * CELL.width;
    stepBattle(session, ENEMIES.mordelume.spawnDurationMs);
    expect(enemy.mordelumeState).toBe("attackBite");
    const hp = wall.hp;
    stepBattle(session, 279);
    expect(wall.hp).toBe(hp);
    stepBattle(session, 1);
    expect(wall.hp).toBe(hp - ENEMIES.mordelume.damage);
    expect(getEnemyAnimation(enemy, ENEMIES.mordelume, session.elapsed, { attackBite: 8 }).frame).toBe(4);
    stepBattle(session, 139);
    expect(wall.hp).toBe(hp - ENEMIES.mordelume.damage);
    stepBattle(session, 1);
    expect(wall.hp).toBe(hp - ENEMIES.mordelume.damage * 2);
  });

  it("sprinta uma vez ao entrar na água e respeita o cooldown da célula", () => {
    const { session, enemy } = setup();
    enemy.x = FIELD.enemyEntryCol * CELL.width + CELL.width / 2;
    stepBattle(session, ENEMIES.mordelume.spawnDurationMs);
    expect(enemy.mordelumeState).toBe("sprintWater");
    const sprintUntil = enemy.sprintUntil;
    const sprintCell = enemy.lastSprintCellKey;
    stepBattle(session, 100);
    expect(enemy.sprintUntil).toBe(sprintUntil);
    expect(enemy.lastSprintCellKey).toBe(sprintCell);
  });
});
