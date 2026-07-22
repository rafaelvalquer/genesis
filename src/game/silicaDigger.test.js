import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import {
  CELL,
  createBattleSession,
  FIELD,
  getLumiKnockbackFactor,
  getSilicaDiggerSwarmSpeedFactor,
  placeTroop,
  spawnEnemy,
  stepBattle,
  stunEnemy,
} from "./battleModel.js";
import { getEnemyAnimation } from "./visualGeometry.js";

const sandbox = (loadout = []) => createBattleSession(PHASES[0], loadout, 7301, { sandbox: true });

const targetTroop = (x = 1000, row = 0) => ({
  id: `target_${row}_${x}`,
  type: "muralhaReforcada",
  row,
  col: Math.floor(x / CELL.width),
  x,
  y: row * 120 + 60,
  hp: 100,
  maxHp: 100,
  dead: false,
});

function summonQueenGuard(session, row = 0) {
  const queen = spawnEnemy(session, { type: "workerQueen", row }).enemies[0];
  queen.x = FIELD.baseX + 8 * CELL.width;
  queen.previousRenderX = queen.x;
  queen.speed = 0;
  queen.queenState = "walking";
  queen.queenStateStartedAt = session.elapsed;
  queen.queenStateEndsAt = Infinity;
  queen.queenNextEggLayAt = Infinity;
  queen.queenWebReadyAt = Infinity;
  queen.queenGuardReadyAt = session.elapsed;
  stepBattle(session, 1);
  return {
    queen,
    guards: session.enemies.filter((enemy) => enemy.queenGuardOwnerId === queen.id),
  };
}

describe("Escavador de Sílica", () => {
  it("mantém o perfil frágil e se torna a base de todas as ondas do capítulo 3", () => {
    expect(ENEMIES.silicaDigger).toMatchObject({
      hp: 10,
      speed: 62,
      damage: 3,
      attackEveryMs: 600,
      baseDamage: 6,
      threat: 6,
      scale: 0.64,
      assetStates: ["emerging", "walking", "attack", "idle"],
      emergeDurationMs: 960,
    });
    expect(PHASES.slice(0, 16).some((phase) => phase.waves.some((wave) => (
      wave.enemies.some((entry) => entry.type === "silicaDigger")
    )))).toBe(false);
    expect(PHASES.slice(16).every((phase) => phase.waves.every((wave) => (
      wave.enemies.some((entry) => entry.type === "silicaDigger")
    )))).toBe(true);
    expect(getLumiKnockbackFactor({ type: "silicaDigger" })).toBe(1);
  });

  it("aplica emerging somente aos guardas criados diretamente pela Rainha", () => {
    const session = sandbox();
    const natural = spawnEnemy(session, { type: "silicaDigger", row: 0 }).enemies[0];
    expect(natural).toMatchObject({ emergeState: null, emergeStartedAt: -Infinity, emergeEndsAt: -Infinity });

    const { queen, guards } = summonQueenGuard(session, 1);
    expect(guards).toHaveLength(8);
    expect(guards.every((guard) => guard.emergeState === "emerging"
      && guard.emergeStartedAt === session.elapsed
      && guard.emergeEndsAt === session.elapsed + ENEMIES.silicaDigger.emergeDurationMs
      && guard.moving === false
      && guard.attackReadyAt === guard.emergeEndsAt
      && guard.lastAttackAt === -Infinity
      && guard.queenGuardOwnerId === queen.id)).toBe(true);
  });

  it("permanece imóvel e sem atacar durante 960 ms, mas continua recebendo dano", () => {
    const session = sandbox(["incinerador"]);
    const { guards } = summonQueenGuard(session, 0);
    const guard = guards[0];
    const startX = guard.x;
    const target = targetTroop(guard.x - 48, 0);
    session.troops = [target];

    stepBattle(session, ENEMIES.silicaDigger.emergeDurationMs - 1);
    expect(guard.x).toBe(startX);
    expect(guard.moving).toBe(false);
    expect(guard.meleeAttackPending).toBe(false);
    expect(target.hp).toBe(100);

    session.troops = [];
    const incinerator = placeTroop(session, "incinerador", 0, Math.max(1, Math.floor(guard.x / CELL.width) - 1)).troop;
    incinerator.attackReadyAt = 0;
    stepBattle(session, 1);
    expect(guard.hp).toBeLessThan(guard.maxHp);
  });

  it("não recebe nem fornece impulso de enxame enquanto está emergindo", () => {
    const session = sandbox();
    const enemies = spawnEnemy(session, {
      type: "silicaDigger", row: 2, count: 3, groupInTile: true,
    }).enemies;
    enemies[2].emergeState = "emerging";
    enemies[2].emergeStartedAt = 0;
    enemies[2].emergeEndsAt = 960;
    expect(getSilicaDiggerSwarmSpeedFactor(session, enemies[0])).toBe(1);
    expect(getSilicaDiggerSwarmSpeedFactor(session, enemies[2])).toBe(1);
    enemies[2].emergeState = null;
    expect(getSilicaDiggerSwarmSpeedFactor(session, enemies[0])).toBe(1.25);
  });

  it("conclui emerging uma vez e assume o comportamento normal de caminhada", () => {
    const session = sandbox();
    const { queen, guards } = summonQueenGuard(session, 3);
    const guard = guards[0];
    const startX = guard.x;

    const events = stepBattle(session, ENEMIES.silicaDigger.emergeDurationMs);
    expect(guard.emergeState).toBeNull();
    expect(guard.moving).toBe(true);
    expect(guard.x).toBeLessThan(startX);
    expect(events.filter((event) => event.type === "silicaDiggerEmerged")).toContainEqual(
      expect.objectContaining({
        enemyId: guard.id,
        sourceEnemyId: queen.id,
        row: guard.row,
        color: ENEMIES.silicaDigger.color,
      }),
    );
    expect(stepBattle(session, 1).filter((event) => (
      event.type === "silicaDiggerEmerged" && event.enemyId === guard.id
    ))).toHaveLength(0);
  });

  it("percorre os oito frames de emerging sem loop e depois retorna a walking", () => {
    const config = ENEMIES.silicaDigger;
    const enemy = {
      type: "silicaDigger", emergeState: "emerging", emergeStartedAt: 100, moving: false,
      lastAttackAt: -Infinity,
    };
    const counts = { emerging: 8, walking: 8, idle: 8 };
    for (let frame = 0; frame < 8; frame += 1) {
      expect(getEnemyAnimation(enemy, config, 100 + frame * 120, counts))
        .toEqual({ state: "emerging", frame });
    }
    expect(getEnemyAnimation(enemy, config, 1059, counts)).toEqual({ state: "emerging", frame: 7 });
    enemy.emergeState = null;
    enemy.moving = true;
    expect(getEnemyAnimation(enemy, config, 1060, counts).state).toBe("walking");
  });

  it("nasce com 10 HP e recebe +25% de velocidade somente com três ativos no mesmo tile", () => {
    const session = sandbox();
    const pair = spawnEnemy(session, {
      type: "silicaDigger", row: 2, count: 2, groupInTile: true,
    }).enemies;
    expect(pair[0]).toMatchObject({ hp: 10, maxHp: 10 });
    expect(getSilicaDiggerSwarmSpeedFactor(session, pair[0])).toBe(1);

    const third = spawnEnemy(session, {
      type: "silicaDigger", row: 2, count: 1, groupInTile: true,
    }).enemies[0];
    third.x = pair[0].x + 8;
    expect(getSilicaDiggerSwarmSpeedFactor(session, pair[0])).toBe(1.25);

    const startX = pair[0].x;
    stepBattle(session, 100);
    expect(startX - pair[0].x).toBeCloseTo(62 * 1.25 * 0.1, 5);
  });

  it("exclui atordoados do grupo e combina o impulso multiplicativamente com lentidão", () => {
    const session = sandbox();
    const enemies = spawnEnemy(session, {
      type: "silicaDigger", row: 1, count: 3, groupInTile: true,
    }).enemies;
    enemies[0].slowFactor = 0.5;
    enemies[0].slowUntil = 1000;
    const startX = enemies[0].x;
    stepBattle(session, 100);
    expect(startX - enemies[0].x).toBeCloseTo(62 * 1.25 * 0.5 * 0.1, 5);

    stunEnemy(session, enemies[2], 800);
    expect(getSilicaDiggerSwarmSpeedFactor(session, enemies[0])).toBe(1);
    expect(getSilicaDiggerSwarmSpeedFactor(session, enemies[2])).toBe(1);
  });

  it("aplica a mordida no impacto e permite vários atacantes no primeiro alvo", () => {
    const session = sandbox();
    const troop = targetTroop();
    session.troops = [troop];
    const enemies = spawnEnemy(session, {
      type: "silicaDigger", row: 0, count: 2, groupInTile: true,
    }).enemies;
    enemies.forEach((enemy, index) => {
      enemy.x = troop.x + 48 + index * 2;
      enemy.previousRenderX = enemy.x;
    });

    stepBattle(session, 1);
    expect(troop.hp).toBe(100);
    expect(enemies.every((enemy) => enemy.meleeAttackPending)).toBe(true);
    stepBattle(session, 199);
    expect(troop.hp).toBe(100);
    const events = stepBattle(session, 1);
    expect(troop.hp).toBe(94);
    expect(events.filter((event) => event.type === "melee")).toHaveLength(2);
  });

  it("cancela uma mordida pendente quando é atordoado", () => {
    const session = sandbox();
    const troop = targetTroop();
    session.troops = [troop];
    const enemy = spawnEnemy(session, { type: "silicaDigger", row: 0 }).enemies[0];
    enemy.x = troop.x + 48;
    enemy.previousRenderX = enemy.x;

    stepBattle(session, 1);
    expect(enemy.meleeAttackPending).toBe(true);
    stunEnemy(session, enemy, 800);
    expect(enemy).toMatchObject({
      meleeAttackPending: false,
      meleeImpactAt: Infinity,
      meleeTargetId: null,
      lastAttackAt: -Infinity,
    });
    stepBattle(session, 800);
    expect(troop.hp).toBe(100);
  });
});
