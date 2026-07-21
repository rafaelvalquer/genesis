import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import {
  CELL,
  activateTroopSpecial,
  createBattleSession,
  placeTroop,
  spawnEnemy,
  stepBattle,
} from "./battleModel.js";
import { getEnemyAnimation } from "./visualGeometry.js";

function createRamSession({ troopCols = [3], troopType = "muralhaReforcada" } = {}) {
  const loadout = [...new Set([troopType, "colossoImpacto"])];
  const session = createBattleSession(PHASES[16], loadout, 2401, {
    sandbox: true,
    sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 1 },
  });
  const troops = troopCols.map((col) => placeTroop(session, troopType, 0, col).troop);
  const enemy = spawnEnemy(session, { type: "ramBeetle", row: 0 }).enemies[0];
  enemy.x = troops[0].x + CELL.width;
  enemy.previousRenderX = enemy.x;
  return { session, enemy, troops };
}

describe("Besouro-Aríete", () => {
  it("registra o perfil equilibrado sem entrar em nenhuma onda", () => {
    expect(ENEMIES.ramBeetle).toMatchObject({
      hp: 165,
      speed: 12,
      damage: 12,
      attackEveryMs: 2200,
      baseDamage: 35,
      threat: 30,
      scale: 1.55,
      chargeDamage: 55,
      chargePrepMs: 650,
      chargeSpeed: 240,
      recoverMs: 2000,
      encyclopediaUnlockAt: 16,
      assetStates: ["walking", "chargePrep", "charge", "idle", "attack"],
    });
    expect(PHASES.slice(0, 18).flatMap((phase) => phase.waves)
      .flatMap((wave) => wave.enemies)
      .some((entry) => entry.type === "ramBeetle")).toBe(false);
    expect(PHASES[18].waves[3].enemies).toContainEqual({ type: "ramBeetle", count: 1 });
  });

  it("executa preparo, impacto único, recuperação e ataque normal sincronizado", () => {
    const { session, enemy, troops: [wall] } = createRamSession();
    const initialHp = wall.hp;

    stepBattle(session, 1);
    expect(enemy.ramState).toBe("chargePrep");
    expect(wall.hp).toBe(initialHp);
    stepBattle(session, 649);
    expect(enemy.ramState).toBe("chargePrep");
    stepBattle(session, 1);
    expect(enemy.ramState).toBe("charge");
    expect(enemy.ramChargeConsumed).toBe(true);

    const impactEvents = stepBattle(session, 200);
    expect(impactEvents).toContainEqual(expect.objectContaining({
      type: "ramImpact",
      targetId: wall.id,
      damage: ENEMIES.ramBeetle.chargeDamage,
    }));
    expect(wall.hp).toBe(initialHp - ENEMIES.ramBeetle.chargeDamage);
    expect(enemy.ramState).toBe("idle");
    expect(enemy.ramIdleMode).toBe("recover");

    stepBattle(session, ENEMIES.ramBeetle.recoverMs - 1);
    expect(enemy.ramState).toBe("idle");
    expect(wall.hp).toBe(initialHp - ENEMIES.ramBeetle.chargeDamage);
    stepBattle(session, 1);
    expect(enemy.ramState).toBe("attack");
    stepBattle(session, ENEMIES.ramBeetle.attackVisual.impactMs - 1);
    expect(wall.hp).toBe(initialHp - ENEMIES.ramBeetle.chargeDamage);
    stepBattle(session, 1);
    expect(wall.hp).toBe(initialHp - ENEMIES.ramBeetle.chargeDamage - ENEMIES.ramBeetle.damage);
    stepBattle(session, ENEMIES.ramBeetle.attackVisual.durationMs - ENEMIES.ramBeetle.attackVisual.impactMs);
    expect(enemy.ramState).toBe("idle");
    expect(enemy.ramIdleMode).toBe("cooldown");
  });

  it("atinge somente o primeiro bloqueador e não atravessa tropas agrupadas", () => {
    const { session, enemy, troops: [front, rear] } = createRamSession({ troopCols: [4, 3] });
    enemy.x = front.x + CELL.width;
    const frontHp = front.hp;
    const rearHp = rear.hp;
    stepBattle(session, 1);
    stepBattle(session, ENEMIES.ramBeetle.chargePrepMs);
    stepBattle(session, 200);

    expect(front.hp).toBe(frontHp - ENEMIES.ramBeetle.chargeDamage);
    expect(rear.hp).toBe(rearHp);
    expect(enemy.x).toBeCloseTo(front.x + 54);
  });

  it("cancela o preparo sem consumir a investida quando o alvo desaparece", () => {
    const { session, enemy, troops: [wall] } = createRamSession();
    stepBattle(session, 1);
    wall.dead = true;
    stepBattle(session, 32);
    expect(enemy.ramState).toBe("walking");
    expect(enemy.ramChargeConsumed).toBe(false);
  });

  it("encerra uma investida perdida após um tile e mantém o uso consumido", () => {
    const { session, enemy, troops: [wall] } = createRamSession();
    stepBattle(session, 1);
    stepBattle(session, ENEMIES.ramBeetle.chargePrepMs);
    const chargeStartX = enemy.x;
    wall.dead = true;
    stepBattle(session, 1000);
    expect(enemy.ramState).toBe("idle");
    expect(enemy.ramIdleMode).toBe("recover");
    expect(enemy.ramChargeConsumed).toBe(true);
    expect(enemy.x).toBeCloseTo(chargeStartX - CELL.width);
  });

  it("estende a recuperação quando é atordoado pelo Colosso", () => {
    const session = createBattleSession(PHASES[16], ["colossoImpacto"], 2402, {
      sandbox: true,
      sandboxSettings: { rulesMode: "free" },
    });
    const colosso = placeTroop(session, "colossoImpacto", 0, 1).troop;
    const enemy = spawnEnemy(session, { type: "ramBeetle", row: 0 }).enemies[0];
    enemy.x = colosso.x + CELL.width / 2;
    enemy.ramState = "idle";
    enemy.ramIdleMode = "recover";
    enemy.ramStateStartedAt = 0;
    enemy.ramStateEndsAt = ENEMIES.ramBeetle.recoverMs;
    enemy.moving = false;
    session.waveActive = true;
    colosso.specialReadyAt = 0;
    expect(activateTroopSpecial(session, colosso.id).ok).toBe(true);
    stepBattle(session, 1);
    stepBattle(session, TROOPS.colossoImpacto.attackVisuals.special.impactMs);
    expect(enemy.stunnedUntil - session.elapsed).toBe(TROOPS.colossoImpacto.specialStunMs);
    expect(enemy.ramStateEndsAt).toBe(ENEMIES.ramBeetle.recoverMs + TROOPS.colossoImpacto.specialStunMs);
  });

  it("mapeia os cinco estados lógicos para suas animações", () => {
    const config = ENEMIES.ramBeetle;
    const counts = { walking: 8, chargePrep: 8, charge: 8, idle: 8, attack: 8 };
    const enemy = { type: "ramBeetle", ramStateStartedAt: 0, ramIdleMode: null };
    for (const state of ["walking", "chargePrep", "charge", "attack"]) {
      expect(getEnemyAnimation({ ...enemy, ramState: state }, config, 320, counts).state).toBe(state);
    }
    expect(getEnemyAnimation({ ...enemy, ramState: "idle", ramIdleMode: "recover" }, config, 1000, counts))
      .toEqual({ state: "idle", frame: 4 });
    expect(getEnemyAnimation({ ...enemy, ramState: "idle", ramIdleMode: "cooldown" }, config, 440, counts).frame)
      .toBeGreaterThanOrEqual(6);
  });

  it("não reinicia o ciclo de walking a cada passo da simulação", () => {
    const session = createBattleSession(PHASES[16], [], 2403, {
      sandbox: true,
      sandboxSettings: { rulesMode: "free" },
    });
    const enemy = spawnEnemy(session, { type: "ramBeetle", row: 0 }).enemies[0];
    const startedAt = enemy.ramStateStartedAt;
    stepBattle(session, 240);
    expect(enemy.ramState).toBe("walking");
    expect(enemy.ramStateStartedAt).toBe(startedAt);
    expect(getEnemyAnimation(enemy, ENEMIES.ramBeetle, session.elapsed, {
      walking: 8, chargePrep: 8, charge: 8, idle: 8, attack: 8,
    })).toEqual({ state: "walking", frame: 2 });
  });
});
