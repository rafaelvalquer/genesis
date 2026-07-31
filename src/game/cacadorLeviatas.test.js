import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, TROOPS, getUnlockedTroops } from "./content.js";
import {
  CELL,
  applyStructuralRupture,
  createBattleSession,
  placeTroop,
  selectLeviathanTarget,
  spawnEnemy,
  stepBattle,
} from "./battleModel.js";
import { getTroopAnimation } from "./visualGeometry.js";
import { getTroopInfo } from "./troopInfo.js";

function createHunterBattle() {
  const session = createBattleSession(PHASES[31], ["cacadorLeviatas"], 4411, {
    sandbox: true,
    sandboxSettings: { enemySpeedMultiplier: 0 },
  });
  const troop = placeTroop(session, "cacadorLeviatas", 2, 2).troop;
  return { session, troop };
}

function spawnStationary(session, type, row, x, hp = null) {
  const enemy = spawnEnemy(session, { type, row }).enemies[0];
  enemy.x = x;
  enemy.speed = 0;
  enemy.damage = 0;
  if (hp != null) {
    enemy.hp = hp;
    enemy.maxHp = hp;
  }
  return enemy;
}

describe("Caçador de Leviatãs", () => {
  it("fica disponível na fase final, respeita custo, limite e âncora", () => {
    expect(TROOPS.cacadorLeviatas).toMatchObject({
      price: 42,
      supply: 9,
      maxDeployed: 2,
      deployCooldownMs: 12000,
      windAnchor: true,
      assetStates: ["idle", "charging", "attack", "cooldown"],
      idleVisual: { height: 132 },
      chargingVisual: { height: 132 },
      attackVisual: { height: 132 },
      cooldownVisual: { height: 132 },
    });
    expect(getUnlockedTroops(30).some(({ id }) => id === "cacadorLeviatas")).toBe(false);
    expect(getUnlockedTroops(31).some(({ id }) => id === "cacadorLeviatas")).toBe(true);
    const info = getTroopInfo(TROOPS.cacadorLeviatas);
    expect(info.stats).toContainEqual(expect.objectContaining({
      label: "Ataque",
      value: "Canhão perfurante",
    }));
    expect(info.specials).toContainEqual(expect.objectContaining({ label: "Ruptura Estrutural" }));
  });

  it("seleciona a maior vida na rota e ignora alvos aéreos ou próximos demais", () => {
    const troop = { row: 1, x: 250 };
    const enemies = [
      { id: "near", type: "gorjal", row: 1, x: troop.x + 2 * CELL.width, hp: 999, maxHp: 999 },
      { id: "air", type: "nimbarca", row: 1, x: troop.x + 4 * CELL.width, hp: 999, maxHp: 999 },
      { id: "light", type: "medu", row: 1, x: troop.x + 3 * CELL.width, hp: 100, maxHp: 200 },
      { id: "heavy", type: "gorjal", row: 1, x: troop.x + 5 * CELL.width, hp: 100, maxHp: 200 },
    ].map((enemy) => ({ ...enemy, dead: false }));
    expect(selectLeviathanTarget({ enemies }, troop).id).toBe("heavy");
  });

  it("cancela uma carga perdida e cumpre o cooldown parcial sem trocar de alvo", () => {
    const { session, troop } = createHunterBattle();
    const target = spawnStationary(session, "gorjal", troop.row, troop.x + 4 * CELL.width);
    stepBattle(session, 1);
    expect(troop).toMatchObject({ state: "charging", attackTargetId: target.id });
    target.dead = true;
    target.hp = 0;
    const events = stepBattle(session, 1);
    expect(troop.state).toBe("cooldown");
    expect(troop.cooldownEndsAt - troop.cooldownStartedAt).toBe(2400);
    expect(events).toContainEqual(expect.objectContaining({ type: "leviathanChargeCancelled" }));
    spawnStationary(session, "gorjal", troop.row, troop.x + 3 * CELL.width);
    stepBattle(session, 2399);
    expect(troop.state).toBe("cooldown");
    stepBattle(session, 1);
    expect(troop.state).toBe("idle");
  });

  it("atravessa dois pesados, reduz o segundo impacto e ignora 80% do escudo", () => {
    const { session, troop } = createHunterBattle();
    const first = spawnStationary(session, "gorjal", troop.row, troop.x + 3.2 * CELL.width, 300);
    const second = spawnStationary(session, "gorjal", troop.row, troop.x + 4.1 * CELL.width, 300);
    first.shield = 100;
    first.shieldMax = 100;
    stepBattle(session, 1);
    stepBattle(session, TROOPS.cacadorLeviatas.chargeMs);
    stepBattle(session, TROOPS.cacadorLeviatas.attackReleaseMs);
    for (let index = 0; index < 30 && session.projectiles.length; index += 1) stepBattle(session, 32);

    const armoredDamage = TROOPS.cacadorLeviatas.damage * 0.895;
    expect(first.hp).toBeCloseTo(300 - armoredDamage * 0.8, 4);
    expect(first.shield).toBeCloseTo(100 - armoredDamage * 0.2, 4);
    expect(second.hp).toBeCloseTo(300 - armoredDamage * 0.55, 4);
    expect(first.structuralRuptureHits).toBe(1);
    expect(second.structuralRuptureHits).toBe(1);
  });

  it("aplica Ruptura no terceiro acerto pesado e expõe o fator global de 25%", () => {
    const { session } = createHunterBattle();
    const enemy = spawnStationary(session, "gorjal", 2, 700);
    const events = [];
    applyStructuralRupture(session, enemy, TROOPS.cacadorLeviatas, events);
    applyStructuralRupture(session, enemy, TROOPS.cacadorLeviatas, events);
    applyStructuralRupture(session, enemy, TROOPS.cacadorLeviatas, events);
    expect(enemy).toMatchObject({
      structuralRuptureHits: 3,
      structuralRuptured: true,
      structuralRuptureDamageTakenFactor: 1.25,
    });
    expect(events).toContainEqual(expect.objectContaining({
      type: "structuralRuptureApplied",
      targetId: enemy.id,
    }));
    expect(ENEMIES.gorjal).toMatchObject({ armorClass: "heavy", armorDamageFactor: 0.65 });

    const damageSession = createBattleSession(PHASES[31], ["ranger"], 5512, {
      sandbox: true,
      sandboxSettings: { enemySpeedMultiplier: 0 },
    });
    const ranger = placeTroop(damageSession, "ranger", 1, 2).troop;
    const ruptured = spawnStationary(
      damageSession,
      "gorjal",
      ranger.row,
      ranger.x + 3 * CELL.width,
      300,
    );
    ruptured.structuralRuptured = true;
    ruptured.structuralRuptureDamageTakenFactor = 1.25;
    stepBattle(damageSession, 1);
    expect(ruptured.hp).toBeCloseTo(300 - TROOPS.ranger.damage * 0.65 * 1.25, 5);
  });

  it("resolve oito frames e repete três vezes a animação durante o resfriamento completo", () => {
    const config = TROOPS.cacadorLeviatas;
    const counts = { idle: 8, charging: 8, attack: 8, cooldown: 8 };
    expect(getTroopAnimation(
      { type: config.id, state: "idle", stateStartedAt: 0 },
      config,
      1800,
      counts,
    )).toEqual({ state: "idle", frame: 1 });
    expect(getTroopAnimation(
      { type: config.id, state: "attack", stateStartedAt: 100 },
      config,
      460,
      counts,
    )).toEqual({ state: "attack", frame: 4 });
    expect(getTroopAnimation(
      { type: config.id, state: "cooldown", stateStartedAt: 0 },
      config,
      800,
      counts,
    )).toEqual({ state: "cooldown", frame: 4 });
    expect(getTroopAnimation(
      { type: config.id, state: "cooldown", stateStartedAt: 0 },
      config,
      1600,
      counts,
    )).toEqual({ state: "cooldown", frame: 0 });
    expect(getTroopAnimation(
      { type: config.id, state: "cooldown", stateStartedAt: 0 },
      config,
      3200,
      counts,
    )).toEqual({ state: "cooldown", frame: 0 });
    expect(getTroopAnimation(
      { type: config.id, state: "cooldown", stateStartedAt: 0 },
      config,
      4799,
      counts,
    )).toEqual({ state: "cooldown", frame: 7 });
  });
});
