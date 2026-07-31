import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import {
  CELL, createBattleSession, placeTroop, spawnEnemy, stepBattle,
} from "./battleModel.js";
import {
  getEnemyAnimation, getEnemyMuzzleWorldPosition, getEnemySpriteRect,
} from "./visualGeometry.js";

function createRaizBattle(seed = 91) {
  return createBattleSession(PHASES[24], ["colono"], seed, { sandbox: true });
}

function setupRootedAttack(seed = 91) {
  const session = createRaizBattle(seed);
  const troop = placeTroop(session, "colono", 2, 4).troop;
  troop.attackReadyAt = Infinity;
  const enemy = spawnEnemy(session, { type: "raizFulgor", row: 2 }).enemies[0];
  enemy.x = troop.x + ENEMIES.raizFulgor.preferredRange * CELL.width - 1;
  enemy.attackReadyAt = Infinity;
  stepBattle(session, 1);
  stepBattle(session, ENEMIES.raizFulgor.rootingMs);
  return { session, troop, enemy };
}

describe("comportamento do Raiz-Fulgor", () => {
  it("permanece imovel durante 900 ms de enraizamento", () => {
    const session = createRaizBattle();
    const troop = placeTroop(session, "colono", 2, 4).troop;
    troop.attackReadyAt = Infinity;
    const enemy = spawnEnemy(session, { type: "raizFulgor", row: 2 }).enemies[0];
    enemy.x = troop.x + ENEMIES.raizFulgor.preferredRange * CELL.width - 1;
    enemy.attackReadyAt = Infinity;
    const startX = enemy.x;

    stepBattle(session, 1);
    expect(enemy).toMatchObject({ rooted: true, moving: false, chapterFourState: "rooting" });
    stepBattle(session, ENEMIES.raizFulgor.rootingMs - 1);
    expect(enemy).toMatchObject({ x: startX, chapterFourState: "rooting" });
    stepBattle(session, 1);
    expect(enemy).toMatchObject({ x: startX, chapterFourState: "rootedIdle" });
  });

  it("trava o alvo na carga e nao redireciona se ele morrer antes da liberacao", () => {
    const { session, troop, enemy } = setupRootedAttack(92);
    const fallback = placeTroop(session, "colono", 2, 3).troop;
    fallback.attackReadyAt = Infinity;
    enemy.attackReadyAt = session.elapsed;

    stepBattle(session, 1);
    expect(enemy).toMatchObject({
      chapterFourState: "attackCharge",
      electricAttackTargetId: troop.id,
    });
    troop.dead = true;
    const fallbackHp = fallback.hp;
    stepBattle(session, ENEMIES.raizFulgor.chargeMs);

    expect(enemy.chapterFourState).toBe("attackRelease");
    expect(enemy.electricAttackTargetId).toBeNull();
    expect(fallback.hp).toBe(fallbackHp);
    expect(enemy.attackReadyAt).toBe(session.elapsed + ENEMIES.raizFulgor.attackEveryMs);
  });

  it("libera dano e carga uma vez, paralisa com duas cargas previas e encadeia sem paralisar", () => {
    const { session, troop, enemy } = setupRootedAttack(93);
    const secondary = placeTroop(session, "colono", 2, 3).troop;
    secondary.attackReadyAt = Infinity;
    secondary.x = troop.x - CELL.width;
    troop.electricStacks = 2;
    troop.electricStacksExpireAt = Infinity;
    enemy.attackReadyAt = session.elapsed;
    const mainHp = troop.hp;
    const secondaryHp = secondary.hp;

    stepBattle(session, 1);
    stepBattle(session, ENEMIES.raizFulgor.chargeMs);

    expect(troop.hp).toBe(mainHp - ENEMIES.raizFulgor.damage);
    expect(troop.electricStacks).toBe(0);
    expect(troop.electricParalyzedUntil)
      .toBe(session.elapsed + ENEMIES.raizFulgor.chargedParalysisMs);
    expect(secondary.hp).toBe(secondaryHp - ENEMIES.raizFulgor.damage * ENEMIES.raizFulgor.chainDamageFactor);
    expect(secondary.electricParalyzedUntil || 0).toBeLessThanOrEqual(session.elapsed);
    const hpAfterRelease = troop.hp;
    stepBattle(session, ENEMIES.raizFulgor.attackVisual.releaseDurationMs);
    expect(troop.hp).toBe(hpAfterRelease);
    expect(enemy.chapterFourState).toBe("rootedIdle");
  });

  it("cancela desenraizamento se um alvo retorna e conserva o estado enraizado", () => {
    const { session, troop, enemy } = setupRootedAttack(94);
    troop.dead = true;
    stepBattle(session, 1);
    expect(enemy.chapterFourState).toBe("unrooting");
    stepBattle(session, ENEMIES.raizFulgor.unrootingMs / 2);
    const returningTroop = placeTroop(session, "colono", 2, 3).troop;
    returningTroop.attackReadyAt = Infinity;
    returningTroop.x = enemy.x - CELL.width;
    stepBattle(session, 1);
    expect(enemy).toMatchObject({ rooted: true, moving: false, chapterFourState: "rootedIdle" });
  });

  it("usa o frame zero de attackRelease para a origem real do feixe", () => {
    const enemy = { type: "raizFulgor", x: 900, y: 300, scale: ENEMIES.raizFulgor.scale };
    const config = ENEMIES.raizFulgor;
    const rect = getEnemySpriteRect(enemy, config, "attackRelease", 0, 1.25);
    const muzzle = getEnemyMuzzleWorldPosition(enemy, config, "attackRelease", 0);
    expect(muzzle.x).toBeCloseTo(rect.x + rect.width * config.attackVisual.muzzle.x);
    expect(muzzle.y).toBeCloseTo(rect.y + rect.height * config.attackVisual.muzzle.y);
  });

  it("mapeia estados temporizados aos oito quadros e mantem loops ciclicos", () => {
    const config = ENEMIES.raizFulgor;
    const enemy = {
      type: "raizFulgor",
      chapterFourState: "attackCharge",
      chapterFourStateStartedAt: 100,
      chapterFourStateEndsAt: 800,
      spawnedAt: 0,
    };
    expect(getEnemyAnimation(enemy, config, 100, { attackCharge: 8 }).frame).toBe(0);
    expect(getEnemyAnimation(enemy, config, 799, { attackCharge: 8 }).frame).toBe(7);
    enemy.chapterFourState = "rootedIdle";
    enemy.chapterFourStateStartedAt = 0;
    enemy.chapterFourStateEndsAt = Infinity;
    expect(getEnemyAnimation(enemy, config, config.animationFrameMs.rootedIdle * 8, { rootedIdle: 8 }).frame).toBe(0);
  });
});
