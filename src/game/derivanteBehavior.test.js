import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import {
  CELL, createBattleSession, placeTroop, spawnEnemy, stepBattle, stunEnemy,
} from "./battleModel.js";
import {
  getEnemyAnimation, getEnemyDeathVisualY, writeEnemyVisualPosition,
} from "./visualGeometry.js";

function createDerivanteBattle(seed = 71) {
  return createBattleSession(PHASES[24], ["colono"], seed, { sandbox: true });
}

describe("comportamento do Derivante", () => {
  it("aplica dano uma vez no impacto de 190 ms e encerra o ataque em 430 ms", () => {
    const session = createDerivanteBattle();
    const troop = placeTroop(session, "colono", 2, 4).troop;
    troop.attackReadyAt = Infinity;
    const enemy = spawnEnemy(session, { type: "derivante", row: 2 }).enemies[0];
    enemy.x = troop.x + 48;
    enemy.nextSpecialAt = Infinity;
    const initialHp = troop.hp;

    stepBattle(session, 1);
    expect(enemy.chapterFourState).toBe("attack");
    expect(troop.hp).toBe(initialHp);
    stepBattle(session, 188);
    expect(troop.hp).toBe(initialHp);
    stepBattle(session, 2);
    expect(getEnemyAnimation(enemy, ENEMIES.derivante, session.elapsed, { attack: 8 }))
      .toMatchObject({ state: "attack", frame: 3 });
    expect(troop.hp).toBe(initialHp - ENEMIES.derivante.damage);
    stepBattle(session, 120);
    expect(troop.hp).toBe(initialHp - ENEMIES.derivante.damage);
    stepBattle(session, 120);
    expect(enemy.chapterFourState).toBe("idle");
  });

  it("interpola a troca de rota, usa arco de 70 px e altera a linha logica apenas no fim", () => {
    const session = createDerivanteBattle(72);
    const troop = placeTroop(session, "colono", 2, 4).troop;
    troop.attackReadyAt = Infinity;
    const enemy = spawnEnemy(session, { type: "derivante", row: 2 }).enemies[0];
    enemy.x = troop.x + 48;
    enemy.blockedSince = -ENEMIES.derivante.blockedThresholdMs;
    enemy.nextSpecialAt = 0;

    stepBattle(session, 1);
    expect(enemy).toMatchObject({
      chapterFourState: "jumpPrepare",
      jumpSourceRow: 2,
      jumpTargetRow: 1,
    });
    stepBattle(session, ENEMIES.derivante.jumpPrepareMs);
    expect(enemy.chapterFourState).toBe("jumpTakeoff");
    stepBattle(session, ENEMIES.derivante.jumpTakeoffMs);
    expect(enemy.chapterFourState).toBe("jumping");
    stepBattle(session, ENEMIES.derivante.jumpingMs / 2);

    const sourceY = 2 * CELL.height + CELL.height / 2;
    const targetY = CELL.height + CELL.height / 2;
    expect(enemy.row).toBe(2);
    expect(enemy.y).toBeCloseTo((sourceY + targetY) / 2);
    const visual = writeEnemyVisualPosition(
      enemy,
      ENEMIES.derivante,
      session.elapsed,
      1,
      false,
    );
    expect(visual.y).toBeCloseTo((sourceY + targetY) / 2 - ENEMIES.derivante.jumpArcHeight);

    stepBattle(session, ENEMIES.derivante.jumpingMs / 2);
    expect(enemy).toMatchObject({ chapterFourState: "landing", row: 1, y: targetY });
    stepBattle(session, ENEMIES.derivante.landingMs);
    expect(enemy.chapterFourState).toBe("walking");
    expect(enemy.nextSpecialAt).toBe(session.elapsed + ENEMIES.derivante.breachCooldownMs);
  });

  it("stun interrompe qualquer fase aerea, limpa o salto e aplica cooldown de 2 s", () => {
    const session = createDerivanteBattle(73);
    const enemy = spawnEnemy(session, { type: "derivante", row: 2 }).enemies[0];
    enemy.chapterFourState = "jumping";
    enemy.chapterFourStateStartedAt = session.elapsed;
    enemy.chapterFourStateEndsAt = session.elapsed + ENEMIES.derivante.jumpingMs;
    enemy.jumpSourceRow = 2;
    enemy.jumpSourceY = 2 * CELL.height + CELL.height / 2;
    enemy.jumpTargetRow = 1;
    enemy.jumpTargetY = CELL.height + CELL.height / 2;
    enemy.jumpProgress = 0.5;
    enemy.y = 2 * CELL.height;
    enemy.jumping = true;

    stunEnemy(session, enemy, 600);

    expect(enemy.chapterFourState).toBe("walking");
    expect(enemy.jumping).toBe(false);
    expect(enemy.jumpProgress).toBe(0);
    expect(enemy.jumpSourceRow).toBeNull();
    expect(enemy.jumpTargetRow).toBeNull();
    expect(enemy.nextSpecialAt).toBe(session.elapsed + ENEMIES.derivante.interruptedJumpCooldownMs);
  });

  it("windMotion ativo substitui o arco e a morte aerea cai ate a rota valida mais proxima", () => {
    const entity = {
      type: "derivante",
      x: 700,
      y: 300,
      previousRenderX: 700,
      previousRenderY: 300,
      jumping: true,
      jumpProgress: 0.5,
      chapterFourState: "windGlide",
      windMotion: {
        fromX: 700,
        fromY: 300,
        toX: 700,
        toY: 180,
        startedAt: 0,
        endsAt: 900,
      },
    };
    const visual = writeEnemyVisualPosition(entity, ENEMIES.derivante, 450, 1, false);
    const windProgress = 0.5;
    const eased = 1 - ((1 - windProgress) ** 3);
    expect(visual.y).toBeCloseTo(300 + (180 - 300) * eased - Math.sin(Math.PI / 2) * 20);

    const death = { ...entity, chapterFourState: "jumping", deathVisualY: 152 };
    expect(getEnemyDeathVisualY(death, 0)).toBe(152);
    expect(getEnemyDeathVisualY(death, 0.5)).toBeGreaterThan(152);
    expect(getEnemyDeathVisualY(death, 1)).toBe(180);
  });
});
