import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import {
  createBattleSession,
  createTroopEntity,
  spawnEnemy,
  stepBattle,
} from "./battle/engine.js";
import { rebuildBattleIndex } from "./battleIndex.js";

const phase = {
  ...PHASES[0],
  id: "cuspidor-brasa-test",
  waves: [],
  environmentHazard: null,
  sandboxMechanics: { none: { environmentHazard: null, chapterMechanic: null, magmaTerrain: null, ambientEffects: [] } },
};

function sandbox() {
  return createBattleSession(phase, [], 1, {
    sandbox: true,
    sandboxSettings: { invulnerableBase: true, enemyDamageMultiplier: 1 },
  });
}

function addTroop(session, id, row, x, hp = 100) {
  const troop = createTroopEntity(session, "colono", row, 6, { id, hp, baseMaxHp: Math.max(100, hp) });
  troop.x = x;
  troop.y = row * 120 + 60;
  session.troops.push(troop);
  rebuildBattleIndex(session);
  return troop;
}

function spawnAt(session, x = 1000, row = 0) {
  const result = spawnEnemy(session, { type: "cuspidorBrasa", row });
  const enemy = result.enemies[0];
  enemy.x = x;
  enemy.previousRenderX = x;
  return enemy;
}

describe("Cuspidor de Brasa", () => {
  it("expõe o contrato de artilharia e os quatro estados sem hit", () => {
    expect(ENEMIES.cuspidorBrasa).toMatchObject({
      hp: 50,
      speed: 15,
      damage: 7,
      splashDamage: 3,
      burnDamagePerSecond: 1.5,
      burnDurationMs: 4000,
      attackEveryMs: 4500,
      chargeMs: 800,
      repositionDistanceTiles: 0.75,
      projectileSpeed: 290,
      magmaImmune: true,
      testOnly: true,
      assetStates: ["idle", "walking", "attack", "death"],
    });
    expect(ENEMIES.cuspidorBrasa.assetStates).not.toContain("hit");
  });

  it("avança sem tropas e para dentro da zona de artilharia", () => {
    const session = sandbox();
    const enemy = spawnAt(session, 1000);
    stepBattle(session, 1000);
    expect(enemy.x).toBeLessThan(1000);
    addTroop(session, "target", 0, 700);
    enemy.x = 1000;
    stepBattle(session, 32);
    expect(enemy.cuspidorState).toBe("attack");
    expect(enemy.moving).toBe(false);
  });

  it("telegrapha 800 ms, lança um projétil travado e resolve dano, AoE e Burn", () => {
    const session = sandbox();
    const direct = addTroop(session, "direct", 0, 700, 100);
    const neighbor = addTroop(session, "neighbor", 0, 610, 100);
    addTroop(session, "other-row", 1, 700, 100);
    const enemy = spawnAt(session, 1000);

    stepBattle(session, 32);
    stepBattle(session, 750);
    expect(session.enemyProjectiles).toHaveLength(0);
    stepBattle(session, 60);
    expect(session.enemyProjectiles).toHaveLength(1);
    const projectile = session.enemyProjectiles[0];
    expect(projectile.kind).toBe("emberGlob");
    expect(projectile.targetX).toBe(700);
    expect(projectile.targetTroopId).toBe(direct.id);
    const lockedX = projectile.targetX;
    direct.x = 620;
    stepBattle(session, 1200);
    expect(projectile.targetX).toBe(lockedX);
    expect(direct.hp).toBe(93);
    expect(neighbor.hp).toBe(97);
    expect(session.troops.find((troop) => troop.id === "other-row").hp).toBe(100);
    expect(direct.emberBurnUntil).toBeGreaterThan(session.elapsed);
    expect(direct.emberBurnNextTickAt).toBeGreaterThan(session.elapsed);
  });

  it("aplica Burn em ticks sem acumular DPS e mantém a renovação", () => {
    const session = sandbox();
    const direct = addTroop(session, "direct", 0, 700, 100);
    const enemy = spawnAt(session, 1000);
    stepBattle(session, 32);
    stepBattle(session, 800);
    stepBattle(session, 1200);
    const firstUntil = direct.emberBurnUntil;
    expect(direct.hp).toBe(93);
    stepBattle(session, 500);
    expect(direct.hp).toBeCloseTo(92.25, 4);
    direct.emberBurnUntil = session.elapsed + 1500;
    const nextTick = direct.emberBurnNextTickAt;
    expect(direct.emberBurnNextTickAt).toBe(nextTick);
    expect(direct.emberBurnUntil).toBeGreaterThan(firstUntil - 2500);
  });

  it("não recua quando a tropa entra na distância curta e continua atacando", () => {
    const session = sandbox();
    addTroop(session, "direct", 0, 950, 100);
    const enemy = spawnAt(session, 1000);
    stepBattle(session, 32);
    const start = enemy.x;
    stepBattle(session, 700);
    expect(enemy.x).toBe(start);
    expect(enemy.cuspidorState).toBe("attack");
  });

  it("reposiciona apÃ³s cada disparo antes de voltar a atacar", () => {
    const session = sandbox();
    addTroop(session, "direct", 0, 700, 100);
    const enemy = spawnAt(session, 1000);

    stepBattle(session, 32);
    stepBattle(session, 800);
    expect(enemy.cuspidorState).toBe("attack");
    expect(enemy.moving).toBe(false);

    stepBattle(session, 500);
    expect(enemy.cuspidorState).toBe("reposition");
    expect(enemy.moving).toBe(true);
    const repositionStartX = enemy.x;

    stepBattle(session, 500);
    expect(enemy.x).toBeLessThan(repositionStartX);
    expect(enemy.cuspidorState).toBe("reposition");

    stepBattle(session, 500);
    expect(enemy.cuspidorState).not.toBe("attack");
    stepBattle(session, 3000);
    expect(enemy.cuspidorState).toBe("attack");
    expect(enemy.x - 700).toBeGreaterThanOrEqual(ENEMIES.cuspidorBrasa.minimumAttackRangeTiles * 64);
  });
});
