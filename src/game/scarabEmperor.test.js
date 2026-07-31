import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import {
  CELL,
  createBattleSession,
  getEnemyDamageTakenFactor,
  getLumiKnockbackFactor,
  placeTroop,
  spawnEnemy,
  stepBattle,
  stunEnemy,
} from "./battleModel.js";
import { getEnemyAnimation } from "./visualGeometry.js";

function createSession({ withWall = true } = {}) {
  const session = createBattleSession(
    { ...PHASES[16], id: "scarab_emperor_test", waves: [] },
    Object.keys(TROOPS),
    3010,
    { sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 } },
  );
  const wall = withWall ? placeTroop(session, "muralhaReforcada", 0, 3).troop : null;
  const enemy = spawnEnemy(session, { type: "scarabEmperor", row: 0 }).enemies[0];
  if (wall) {
    enemy.x = wall.x + ENEMIES.scarabEmperor.phase1.attackRangeTiles * CELL.width;
    enemy.previousRenderX = enemy.x;
  }
  return { session, enemy, wall };
}

describe("Imperador Escaravelho", () => {
  it("registra as três fases, encerra o capítulo 3 e rejeita variante Alpha", () => {
    expect(ENEMIES.scarabEmperor).toMatchObject({
      hp: 600,
      boss: true,
      allowAlphaVariant: false,
      knockbackImmune: true,
      phase2Threshold: 0.65,
      phase3Threshold: 0.30,
      phase1: { speed: 28, damage: 16, attackEveryMs: 2200, attackImpactMs: 560 },
      phase2: { speed: 52, damage: 10, attackEveryMs: 1500, damageTakenFactor: 1.15 },
      phase3: { speed: 95, damage: 6, attackEveryMs: 650, damageTakenFactor: 1.30 },
    });
    const appearances = PHASES.flatMap((phase, phaseIndex) => phase.waves.flatMap((wave, waveIndex) => (
      wave.enemies.filter((entry) => entry.type === "scarabEmperor").map((entry) => ({ phaseIndex, waveIndex, entry }))
    )));
    expect(appearances).toEqual([{ phaseIndex: 23, waveIndex: 5, entry: { type: "scarabEmperor", count: 1 } }]);

    const { session } = createSession({ withWall: false });
    const alpha = spawnEnemy(session, { type: "scarabEmperor", row: 1, variant: "alpha" }).enemies[0];
    expect(alpha.variant).toBeUndefined();
    expect(alpha.maxHp).toBe(600);
    expect(alpha.bossPhase).toBe(1);
  });

  it("aplica armadura frontal apenas a dano direto e vulnerabilidade nas fases seguintes", () => {
    const { enemy } = createSession({ withWall: false });
    expect(getEnemyDamageTakenFactor(enemy, { direct: true, sourceX: enemy.x - 100 })).toBe(0.6);
    expect(getEnemyDamageTakenFactor(enemy, { direct: true, sourceX: enemy.x + 100 })).toBe(1);
    expect(getEnemyDamageTakenFactor(enemy, { direct: false, sourceX: enemy.x - 100 })).toBe(1);
    expect(getEnemyDamageTakenFactor(enemy)).toBe(1);
    enemy.bossPhase = 2;
    expect(getEnemyDamageTakenFactor(enemy, { direct: true, sourceX: enemy.x - 100 })).toBe(1.15);
    enemy.bossPhase = 3;
    expect(getEnemyDamageTakenFactor(enemy)).toBe(1.3);
  });

  it("sincroniza cada impacto uma única vez com a animação da fase", () => {
    const { session, enemy, wall } = createSession();
    const initialHp = wall.hp;
    stepBattle(session, 1);
    expect(enemy.scarabState).toBe("phase1Attack");
    stepBattle(session, ENEMIES.scarabEmperor.phase1.attackImpactMs - 1);
    expect(wall.hp).toBe(initialHp);
    const impactEvents = stepBattle(session, 1);
    expect(wall.hp).toBe(initialHp - 16);
    expect(impactEvents.filter((event) => event.type === "scarabAttackImpact")).toHaveLength(1);
    stepBattle(session, ENEMIES.scarabEmperor.phase1.attackDurationMs);
    expect(wall.hp).toBe(initialHp - 16);

    enemy.bossPhase = 3;
    enemy.speed = ENEMIES.scarabEmperor.phase3.speed;
    enemy.damage = ENEMIES.scarabEmperor.phase3.damage;
    enemy.attackReadyAt = session.elapsed;
    enemy.scarabState = "phase3Idle";
    enemy.x = wall.x + ENEMIES.scarabEmperor.phase3.attackRangeTiles * CELL.width;
    stepBattle(session, 1);
    stepBattle(session, ENEMIES.scarabEmperor.phase3.attackImpactMs);
    expect(wall.hp).toBe(initialHp - 22);
  });

  it("cancela ataque pendente e executa as transições irreversíveis em sequência", () => {
    const { session, enemy, wall } = createSession();
    const hp = wall.hp;
    stepBattle(session, 1);
    expect(enemy.scarabState).toBe("phase1Attack");
    enemy.hp = enemy.maxHp * 0.29;
    const first = stepBattle(session, 1);
    expect(enemy.scarabState).toBe("transitionPhase1To2");
    expect(first.some((event) => event.type === "scarabTransitionStart" && event.toPhase === 2)).toBe(true);
    stepBattle(session, ENEMIES.scarabEmperor.phase1.attackImpactMs);
    expect(wall.hp).toBe(hp);

    const second = stepBattle(
      session,
      ENEMIES.scarabEmperor.transitionPhase1To2.durationMs
        - ENEMIES.scarabEmperor.phase1.attackImpactMs,
    );
    expect(enemy.bossPhase).toBe(2);
    expect(enemy.scarabState).toBe("transitionPhase2To3");
    expect(second.some((event) => event.type === "scarabTransitionStart" && event.toPhase === 3)).toBe(true);
    stepBattle(session, ENEMIES.scarabEmperor.transitionPhase2To3.durationMs);
    expect(enemy.bossPhase).toBe(3);
    expect(enemy.speed).toBe(95);
    expect(enemy.damage).toBe(6);
    expect(enemy.scarabPhase2Triggered).toBe(true);
    expect(enemy.scarabPhase3Triggered).toBe(true);

    enemy.hp = enemy.maxHp;
    stepBattle(session, 1000);
    expect(enemy.bossPhase).toBe(3);
  });

  it("conclui transformação durante stun e não pode ser empurrado", () => {
    const { session, enemy } = createSession({ withWall: false });
    enemy.hp = enemy.maxHp * 0.6;
    stepBattle(session, 1);
    stunEnemy(session, enemy, 5000);
    stepBattle(session, ENEMIES.scarabEmperor.transitionPhase1To2.durationMs);
    expect(enemy.bossPhase).toBe(2);
    expect(enemy.scarabState).toBe("phase2Idle");
    expect(enemy.stunnedUntil).toBeGreaterThan(session.elapsed);
    expect(getLumiKnockbackFactor(enemy)).toBe(0);

    session.modifiers.concussiveImpact = true;
    const originalX = enemy.x;
    const col = Math.floor(enemy.x / CELL.width);
    session.mines.push({
      id: "scarab_mine", row: enemy.row, col, x: enemy.x, y: enemy.y,
      damage: 1, radius: 20, color: "#f59e0b", active: true, seed: 1,
    });
    stepBattle(session, 1);
    expect(enemy.x).toBe(originalX);
    expect(enemy.knockbackVisualOffset).toBeUndefined();
  });

  it("mapeia caminhada, idle, ataque e ambas as transformações para os frames dedicados", () => {
    const config = ENEMIES.scarabEmperor;
    const counts = Object.fromEntries(config.assetStates.map((state) => [state, 8]));
    const base = { type: "scarabEmperor", bossPhase: 1, scarabStateStartedAt: 0, moving: false };
    expect(getEnemyAnimation({ ...base, scarabState: "phase1Walking" }, config, 300, counts))
      .toEqual({ state: "phase1Walking", frame: 2 });
    expect(getEnemyAnimation({ ...base, scarabState: "phase1Attack" }, config, 560, counts))
      .toEqual({ state: "phase1Attack", frame: 4 });
    expect(getEnemyAnimation({ ...base, scarabState: "transitionPhase1To2" }, config, 900, counts))
      .toEqual({ state: "transitionPhase1To2", frame: 4 });
    expect(getEnemyAnimation({ ...base, bossPhase: 2, scarabState: "transitionPhase2To3" }, config, 800, counts))
      .toEqual({ state: "transitionPhase2To3", frame: 4 });
    expect(getEnemyAnimation({ ...base, bossPhase: 3, scarabState: "phase3Attack" }, config, 220, counts))
      .toEqual({ state: "phase3Attack", frame: 4 });
  });
});
