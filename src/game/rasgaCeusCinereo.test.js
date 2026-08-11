import { describe, expect, it } from "vitest";
import { canTroopTargetEnemy } from "./enemyTargeting.js";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import { createBattleSession, spawnEnemy, stepBattle } from "./battle/engine.js";

const phase = { ...PHASES[0], id: "rasga-ceus-test", waves: [] };

function session() {
  return createBattleSession(phase, Object.keys(TROOPS), 17, { sandbox: true, sandboxSettings: { rulesMode: "free", invulnerableBase: true } });
}

describe("Rasga-Céus Cinéreo", () => {
  it("expõe o contrato aéreo e os três estados de sprite", () => {
    expect(ENEMIES.rasgaCeusCinereo).toMatchObject({ hp: 30, speed: 32, damage: 6, baseDamage: 8, threat: 18, airborne: true, assetStates: ["flying", "diveAttack", "death"] });
    expect(ENEMIES.rasgaCeusCinereo.assetStates).not.toContain("hit");
  });

  it("entra alto, desce até o cruise e nunca altera a rota lógica", () => {
    const current = session();
    const { enemies: [enemy] } = spawnEnemy(current, { type: "rasgaCeusCinereo", row: 2 });
    expect(enemy.flightAltitude).toBe(38);
    expect(enemy.y).toBe(2 * 120 + 60);
    stepBattle(current, 700);
    expect(enemy.rasgaCeusState).toBe("baseApproach");
    expect(enemy.flightAltitude).toBe(30);
    expect(enemy.row).toBe(2);
    expect(enemy.y).toBe(300);
  });

  it("seleciona presa, marca, mergulha e aplica exatamente um strike", () => {
    const current = session();
    const troop = { id: "marine_target", type: "marine", row: 2, x: 1120, y: 300, hp: 100, maxHp: 100, dead: false, unitKind: "offense" };
    current.troops.push(troop);
    const { enemies: [enemy] } = spawnEnemy(current, { type: "rasgaCeusCinereo", row: 2 });
    stepBattle(current, 700);
    enemy.nextDiveAt = current.elapsed;
    stepBattle(current, 1);
    expect(enemy.rasgaCeusState).toBe("targeting");
    expect(enemy.diveTargetId).toBe(troop.id);
    troop.hp = 100;
    stepBattle(current, 900);
    expect(["diving", "strike", "climbing"]).toContain(enemy.rasgaCeusState);
    stepBattle(current, 900);
    expect(troop.hp).toBe(94);
    stepBattle(current, 200);
    expect(troop.hp).toBe(94);
  });

  it("permite AA sempre, e armas terrestres somente abaixo da altitude 18", () => {
    const enemy = { id: "air", type: "rasgaCeusCinereo", hp: 30, dead: false, flightAltitude: 30, groundRangedTargetable: false };
    expect(canTroopTargetEnemy({}, {}, TROOPS.marine, enemy, ENEMIES.rasgaCeusCinereo)).toBe(false);
    expect(canTroopTargetEnemy({}, {}, TROOPS.interceptadorIcaro, enemy, ENEMIES.rasgaCeusCinereo)).toBe(true);
    enemy.flightAltitude = 15;
    enemy.groundRangedTargetable = true;
    expect(canTroopTargetEnemy({}, {}, TROOPS.marine, enemy, ENEMIES.rasgaCeusCinereo)).toBe(true);
  });

  it("não seleciona plataforma térmica como presa", () => {
    const current = session();
    current.troops.push({ id: "platform", type: "thermalPlatform", row: 2, x: 1120, y: 300, hp: 100, maxHp: 100, dead: false, unitKind: "support" });
    const { enemies: [enemy] } = spawnEnemy(current, { type: "rasgaCeusCinereo", row: 2 });
    stepBattle(current, 700);
    enemy.nextDiveAt = current.elapsed;
    stepBattle(current, 1);
    expect(enemy.rasgaCeusState).toBe("baseApproach");
  });

  it("patrulha os limites da formação e só aborda a base quando a rota fica vazia", () => {
    const current = session();
    const left = { id: "left", type: "marine", row: 2, x: 420, y: 300, hp: 100, maxHp: 100, dead: false };
    const right = { id: "right", type: "marine", row: 2, x: 760, y: 300, hp: 100, maxHp: 100, dead: false };
    current.troops.push(left, right);
    const { enemies: [enemy] } = spawnEnemy(current, { type: "rasgaCeusCinereo", row: 2, x: 800 });
    stepBattle(current, 700);
    expect(enemy.rasgaCeusState).toBe("cruise");
    expect(enemy.patrolMinX).toBeLessThan(left.x);
    expect(enemy.patrolMaxX).toBeGreaterThan(right.x);
    expect(current.integrity).toBe(current.integrityMax);
    enemy.nextDiveAt = Infinity;
    enemy.x = enemy.patrolMinX;
    stepBattle(current, 32);
    expect(enemy.flightDirection).toBe(1);
    const turnX = enemy.x;
    stepBattle(current, 32);
    expect(enemy.x).toBeGreaterThan(turnX);
    left.dead = true;
    right.dead = true;
    stepBattle(current, 40);
    expect(enemy.rasgaCeusState).toBe("baseApproach");
  });
});
