import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, getEnemyCatalogEntries } from "./content.js";
import { getEnemyBehavior } from "./enemies/enemyRegistry.js";
import { createBattleSession, createTroopEntity, spawnEnemy, stepBattle } from "./battle/engine.js";
import { getEnemyAnimation } from "./visualGeometry.js";

const predatorAssets = import.meta.glob("./assets/enemy/predadorCaldeira/*/frame*.png", { eager: true, query: "?url", import: "default" });

const makeSession = (troopType = "muralhaReforcada") => createBattleSession(PHASES[0], [troopType], 2026, {
  sandbox: true,
  sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 1 },
});

describe("Predador da Caldeira", () => {
  it("registra os atributos e os seis estados sem hit", () => {
    expect(ENEMIES.predadorCaldeira).toMatchObject({
      hp: 72, speed: 22, clawDamage: 4, biteDamage: 6, attackEveryMs: 1800,
      baseDamage: 20, threat: 25, armorDamageFactor: .88, knockbackFactor: .65,
      magmaImmune: true, scale: 1.3, testOnly: true,
      assetStates: ["idle", "walking", "hunting", "attackCombo", "frenzyTransition", "death"],
    });
    expect(getEnemyBehavior("predadorCaldeira")).not.toBeUndefined();
    expect(getEnemyCatalogEntries().some((entry) => entry.id === "predadorCaldeira")).toBe(true);
  });

  it("mantém walking fora da zona de caça e entra em hunting a até 4.5 tiles", () => {
    const session = makeSession();
    const troop = createTroopEntity(session, "muralhaReforcada", 0, 0);
    session.troops.push(troop);
    const enemy = spawnEnemy(session, { type: "predadorCaldeira", row: 0 }).enemies[0];
    enemy.x = troop.x + 5 * 96;
    stepBattle(session, 32);
    expect(enemy.predatorState).toBe("walking");
    enemy.x = troop.x + 4 * 96;
    stepBattle(session, 32);
    expect(enemy.predatorState).toBe("hunting");
    expect(enemy.x).toBeCloseTo(troop.x + 4 * 96 - 34.1 * .032, 1);
    enemy.x = troop.x + 1 * 96;
    stepBattle(session, 32);
    expect(enemy.predatorState).toBe("hunting");
    enemy.x = troop.x + 40;
    stepBattle(session, 32);
    expect(enemy.predatorState).toBe("attackCombo");
  });

  it("inicia combo travado e aplica garrada 4 e mordida 6 em eventos distintos", () => {
    const session = makeSession();
    const troop = createTroopEntity(session, "muralhaReforcada", 0, 0);
    troop.hp = troop.maxHp = 100;
    session.troops.push(troop);
    const enemy = spawnEnemy(session, { type: "predadorCaldeira", row: 0 }).enemies[0];
    enemy.x = troop.x + 40;
    stepBattle(session, 32);
    expect(enemy.predatorState).toBe("attackCombo");
    const before = troop.hp;
    const claw = stepBattle(session, 260);
    expect(troop.hp).toBe(before - 4);
    expect(claw).toContainEqual(expect.objectContaining({ type: "predatorClaw", targetTroopId: troop.id }));
    const bite = stepBattle(session, 280);
    expect(troop.hp).toBe(before - 10);
    expect(bite).toContainEqual(expect.objectContaining({ type: "predatorBite", targetTroopId: troop.id }));
  });

  it("não troca de alvo entre a garrada e a mordida", () => {
    const session = makeSession();
    const first = createTroopEntity(session, "muralhaReforcada", 0, 0);
    first.hp = first.maxHp = 3;
    const second = createTroopEntity(session, "muralhaReforcada", 0, 1);
    second.hp = second.maxHp = 100;
    session.troops.push(first, second);
    const enemy = spawnEnemy(session, { type: "predadorCaldeira", row: 0 }).enemies[0];
    enemy.x = first.x + 40;
    stepBattle(session, 32);
    stepBattle(session, 260);
    const hp = second.hp;
    stepBattle(session, 280);
    expect(second.hp).toBe(hp);
  });

  it("perde a resistência ao cruzar 40%, mas só ativa o frenesi após o combo", () => {
    const session = makeSession();
    const troop = createTroopEntity(session, "muralhaReforcada", 0, 0);
    session.troops.push(troop);
    const enemy = spawnEnemy(session, { type: "predadorCaldeira", row: 0 }).enemies[0];
    enemy.x = troop.x + 40;
    stepBattle(session, 32);
    enemy.hp = 28;
    stepBattle(session, 1);
    expect(enemy.armorDamageFactor).toBe(1);
    expect(enemy.predatorFrenzyTriggered).toBe(true);
    expect(enemy.predatorState).toBe("attackCombo");
    stepBattle(session, 800);
    expect(enemy.predatorState).toBe("frenzyTransition");
    stepBattle(session, 720);
    expect(enemy.predatorFrenzy).toBe(true);
    expect(enemy.speed).toBe(22);
  });

  it("usa a velocidade e a cadência do frenesi sem aumentar os danos", () => {
    const session = makeSession();
    const troop = createTroopEntity(session, "muralhaReforcada", 0, 0);
    session.troops.push(troop);
    const enemy = spawnEnemy(session, { type: "predadorCaldeira", row: 0 }).enemies[0];
    enemy.predatorFrenzy = true;
    enemy.predatorFrenzyTriggered = true;
    enemy.armorDamageFactor = 1;
    enemy.x = troop.x + 40;
    stepBattle(session, 32);
    expect(enemy.predatorState).toBe("attackCombo");
    expect(enemy.attackReadyAt - session.elapsed).toBeCloseTo(1440, 0);
    expect(ENEMIES.predadorCaldeira.clawDamage).toBe(4);
    expect(ENEMIES.predadorCaldeira.biteDamage).toBe(6);
  });

  it("mapeia todos os estados visuais e não solicita hit", () => {
    const counts = { idle: 8, walking: 8, hunting: 8, attackCombo: 8, frenzyTransition: 8, death: 8 };
    for (const state of ENEMIES.predadorCaldeira.assetStates) {
      const animation = getEnemyAnimation({ type: "predadorCaldeira", predatorState: state, predatorStateStartedAt: 0, predatorStateEndsAt: 800 }, ENEMIES.predadorCaldeira, 400, counts);
      expect(animation.state).toBe(state);
    }
    expect(ENEMIES.predadorCaldeira.assetStates).not.toContain("hit");
  });

  it("entra brevemente em idle depois do combo, sem continuar o walking", () => {
    const session = makeSession();
    const troop = createTroopEntity(session, "muralhaReforcada", 0, 0);
    troop.hp = troop.maxHp = 4;
    session.troops.push(troop);
    const enemy = spawnEnemy(session, { type: "predadorCaldeira", row: 0 }).enemies[0];
    enemy.x = troop.x + 40;
    stepBattle(session, 32);
    stepBattle(session, 800);
    expect(enemy.predatorState).toBe("idle");
    expect(getEnemyAnimation(enemy, ENEMIES.predadorCaldeira, session.elapsed, { idle: 8, walking: 8, hunting: 8, attackCombo: 8, frenzyTransition: 8, death: 8 }).state).toBe("idle");
  });

  it("entrega oito frames para cada estado visual e nenhum conjunto proibido", () => {
    for (const state of ENEMIES.predadorCaldeira.assetStates) {
      expect(Object.keys(predatorAssets).filter((key) => key.includes(`/predadorCaldeira/${state}/`))).toHaveLength(8);
    }
    expect(Object.keys(predatorAssets).some((key) => /\/predadorCaldeira\/(hit|hurt|damage)\//.test(key))).toBe(false);
  });
});
