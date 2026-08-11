import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import { createBattleSession, spawnEnemy, stepBattle } from "./battle/engine.js";

const phase = { ...PHASES[0], id: "salamandra-cinerea-test", waves: [] };

describe("Salamandra Cinérea", () => {
  it("expõe o contrato balanceado e os quatro estados visuais", () => {
    expect(ENEMIES.salamandraCinerea).toMatchObject({ hp: 28, speed: 34, damage: 5, attackEveryMs: 1200, baseDamage: 10, threat: 10, magmaImmune: true, testOnly: true, assetStates: ["idle", "walking", "attack", "death"] });
    expect(ENEMIES.salamandraCinerea.assetStates).not.toContain("hit");
    expect(ENEMIES.salamandraCinerea.assetStates).not.toContain("charge");
  });

  it("só pode ser invocada no Campo de Provas", () => {
    const normal = createBattleSession(phase, [], 1);
    expect(spawnEnemy(normal, { type: "salamandraCinerea", row: 0 }).ok).toBe(false);
    const sandbox = createBattleSession(phase, [], 1, { sandbox: true });
    expect(spawnEnemy(sandbox, { type: "salamandraCinerea", row: 0 }).ok).toBe(true);
  });

  it("aguarda o atraso inicial, usa impulso e desfere mordida sem dano extra", () => {
    const session = createBattleSession(phase, [], 1, { sandbox: true, sandboxSettings: { enemySpeedMultiplier: 0, invulnerableBase: true } });
    const troop = { id: "troop", row: 0, x: 600, y: 60, hp: 100, maxHp: 100, dead: false, type: "colono" };
    session.troops.push(troop);
    const result = spawnEnemy(session, { type: "salamandraCinerea", row: 0, x: 850 });
    const enemy = result.enemies[0];
    stepBattle(session, 1400);
    expect(enemy.salamandraCharges).toBe(0);
    stepBattle(session, 1800);
    expect(enemy.salamandraCharges).toBe(1);
    enemy.x = troop.x + 1;
    stepBattle(session, 400);
    stepBattle(session, 400);
    expect(troop.hp).toBe(95);
  });
});
