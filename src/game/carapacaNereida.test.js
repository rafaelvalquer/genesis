import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import { CELL, createBattleSession, getEnemyDamageTakenFactor, placeTroop, spawnEnemy, stepBattle } from "./battleModel.js";
import { getEnemyAnimation } from "./visualGeometry.js";

function setup() {
  const session = createBattleSession(
    { ...PHASES[32], id: "nereida-test", waves: [] }, Object.keys(TROOPS), 19,
    { sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 } },
  );
  const wall = placeTroop(session, "muralhaReforcada", 0, 3).troop;
  const enemy = spawnEnemy(session, { type: "carapacaNereida", row: 0 }).enemies[0];
  enemy.x = wall.x + ENEMIES.carapacaNereida.attackRangeTiles * CELL.width;
  return { session, wall, enemy };
}

describe("Carapaça de Nereida", () => {
  it("registra os oito estados, nasce no campo de provas e sincroniza o golpe no quinto frame", () => {
    expect(ENEMIES.carapacaNereida.assetStates).toHaveLength(7);
    const { session, wall, enemy } = setup();
    expect(enemy.nereidaState).toBe("spawnEmerge");
    stepBattle(session, 800);
    expect(enemy.nereidaState).toBe("attackClaw");
    const hp = wall.hp;
    stepBattle(session, 399);
    expect(wall.hp).toBe(hp);
    stepBattle(session, 1);
    expect(wall.hp).toBe(hp - ENEMIES.carapacaNereida.damage);
    expect(getEnemyAnimation(enemy, ENEMIES.carapacaNereida, session.elapsed, { attackClaw: 8 }).frame).toBe(4);
  });

  it("reduz somente dano direto frontal, com proteção ampliada na água", () => {
    const { enemy } = setup();
    expect(getEnemyDamageTakenFactor(enemy, { direct: true, sourceX: enemy.x - 1, flooded: false })).toBe(0.85);
    expect(getEnemyDamageTakenFactor(enemy, { direct: true, sourceX: enemy.x - 1, flooded: true })).toBe(0.65);
    expect(getEnemyDamageTakenFactor(enemy, { direct: true, sourceX: enemy.x + 1, flooded: true })).toBe(1);
    expect(getEnemyDamageTakenFactor(enemy, { direct: false, sourceX: enemy.x - 1, flooded: true })).toBe(1);
  });
});
