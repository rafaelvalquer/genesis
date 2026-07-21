import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import {
  CELL,
  FIELD,
  createBattleSession,
  getEnemyDamageTakenFactor,
  placeTroop,
  spawnEnemy,
  stepBattle,
  stunEnemy,
} from "./battleModel.js";
import { getEnemyAnimation } from "./visualGeometry.js";

const sandbox = () => createBattleSession(
  { ...PHASES[16], id: "worker_queen_test", waves: [] },
  Object.keys(TROOPS),
  321,
  { sandbox: true },
);

function troopAt(session, row, col, hp = 200) {
  const result = placeTroop(session, "muralhaReforcada", row, col);
  result.troop.hp = hp;
  result.troop.maxHp = hp;
  return result.troop;
}

function readyQueen(session, row = 0) {
  const queen = spawnEnemy(session, { type: "workerQueen", row }).enemies[0];
  queen.queenState = "idle";
  queen.queenStateStartedAt = session.elapsed;
  queen.queenStateEndsAt = Infinity;
  queen.queenNextEggLayAt = Infinity;
  queen.queenWebReadyAt = Infinity;
  return queen;
}

describe("Rainha Operária", () => {
  it("registra o perfil, dependências e estreia na terceira onda da fase 18", () => {
    expect(ENEMIES.workerQueen).toMatchObject({
      hp: 125,
      speed: 10,
      threat: 30,
      holdRangeTiles: 3,
      webDamage: 1,
      webSlowFactor: 0.7,
      webSlowDurationMs: 3000,
      eggsPerLay: 2,
      maximumLivingEggs: 4,
      maximumLivingSummons: 6,
      firstEggLayDelayMs: 3000,
      eggLayEveryMs: 8000,
      spawnProtectionMs: 2000,
      spawnDamageTakenFactor: 0.6,
      encyclopediaUnlockAt: 16,
    });
    expect(ENEMIES.workerQueenEgg).toMatchObject({
      hp: 14,
      stationary: true,
      controlImmune: true,
      hiddenFromCatalog: true,
      hatchAfterMs: 3500,
    });
    expect(PHASES.slice(0, 17).flatMap((phase) => phase.waves)
      .flatMap((wave) => wave.enemies)
      .some((entry) => entry.type === "workerQueen")).toBe(false);
    expect(PHASES[17].waves[2].enemies).toContainEqual({ type: "workerQueen", count: 1 });
  });

  it("para a três tiles e volta a caminhar quando perde o alvo", () => {
    const session = sandbox();
    const troop = troopAt(session, 2, 3);
    const queen = readyQueen(session, 2);
    queen.x = troop.x + ENEMIES.workerQueen.holdRangeTiles * CELL.width;
    queen.previousRenderX = queen.x;

    stepBattle(session, 1);
    expect(queen.queenState).toBe("idle");
    expect(queen.moving).toBe(false);

    troop.dead = true;
    const before = queen.x;
    stepBattle(session, 1000);
    expect(queen.queenState).toBe("walking");
    expect(queen.x).toBeLessThan(before);
  });

  it("deposita dois ovos atrás, preserva o espaçamento e os converte em Escavadores", () => {
    const session = sandbox();
    const queen = readyQueen(session, 1);
    queen.x = FIELD.spawnX - CELL.width;
    queen.previousRenderX = queen.x;
    queen.queenNextEggLayAt = 0;

    stepBattle(session, 1);
    expect(queen.queenState).toBe("eggLay");
    expect(session.enemies.filter((enemy) => enemy.type === "workerQueenEgg")).toHaveLength(0);

    const events = stepBattle(session, ENEMIES.workerQueen.eggLayVisual.depositMs);
    const eggs = session.enemies.filter((enemy) => enemy.type === "workerQueenEgg");
    expect(events.filter((event) => event.type === "workerQueenEggDeposited")).toHaveLength(2);
    expect(eggs).toHaveLength(2);
    expect(eggs.map((egg) => egg.x)).toEqual([
      queen.x + ENEMIES.workerQueen.eggSpawnStartTiles * CELL.width,
      queen.x + (ENEMIES.workerQueen.eggSpawnStartTiles + ENEMIES.workerQueen.eggSpawnSpacingTiles) * CELL.width,
    ]);

    const hatchEvents = stepBattle(session, ENEMIES.workerQueenEgg.hatchAfterMs);
    expect(hatchEvents.filter((event) => event.type === "workerQueenEggHatched")).toHaveLength(2);
    expect(session.enemies.filter((enemy) => enemy.type === "workerQueenEgg")).toHaveLength(0);
    const summons = session.enemies.filter((enemy) => enemy.type === "silicaDigger");
    expect(summons).toHaveLength(2);
    expect(summons.every((enemy) => enemy.summoned && enemy.summonerId === queen.id && enemy.moving)).toBe(true);
  });

  it("cancela postura antes do depósito e reagenda sem apagar ovos já existentes", () => {
    const session = sandbox();
    const queen = readyQueen(session, 3);
    queen.x = FIELD.spawnX - CELL.width;
    queen.queenNextEggLayAt = 0;

    stepBattle(session, 1);
    stunEnemy(session, queen, 500);
    expect(queen.queenState).toBe("idle");
    expect(queen.queenNextEggLayAt).toBe(session.elapsed + ENEMIES.workerQueen.interruptedEggLayRetryMs);
    expect(session.enemies.filter((enemy) => enemy.type === "workerQueenEgg")).toHaveLength(0);

    queen.stunnedUntil = 0;
    queen.queenNextEggLayAt = session.elapsed;
    stepBattle(session, 1);
    stepBattle(session, ENEMIES.workerQueen.eggLayVisual.depositMs);
    const eggs = session.enemies.filter((enemy) => enemy.type === "workerQueenEgg");
    expect(eggs).toHaveLength(2);
    stunEnemy(session, queen, 500);
    expect(session.enemies.filter((enemy) => enemy.type === "workerQueenEgg")).toEqual(eggs);
  });

  it("mantém ovos após a morte da Rainha e não contabiliza sua destruição como abate", () => {
    const session = sandbox();
    const queen = readyQueen(session, 2);
    queen.x = FIELD.spawnX - CELL.width;
    queen.queenNextEggLayAt = 0;
    stepBattle(session, 1);
    stepBattle(session, ENEMIES.workerQueen.eggLayVisual.depositMs);
    const eggs = session.enemies.filter((enemy) => enemy.type === "workerQueenEgg");
    expect(eggs).toHaveLength(2);

    queen.dead = true;
    eggs[0].hp = 1;
    const ranger = placeTroop(session, "ranger", 2, 5).troop;
    ranger.attackReadyAt = 0;
    const killedBefore = session.killed;
    stepBattle(session, 1);

    expect(session.enemies.some((enemy) => enemy.id === queen.id)).toBe(false);
    expect(session.enemies.some((enemy) => enemy.id === eggs[0].id)).toBe(false);
    expect(session.enemies.some((enemy) => enemy.id === eggs[1].id)).toBe(true);
    expect(session.killed).toBe(killedBefore);
  });

  it("reserva capacidade da ninhada e nunca inicia uma postura parcial", () => {
    const session = sandbox();
    const queen = readyQueen(session, 1);
    queen.x = FIELD.spawnX - CELL.width;
    queen.queenNextEggLayAt = 0;
    stepBattle(session, 1);
    stepBattle(session, ENEMIES.workerQueen.eggLayVisual.depositMs);
    session.enemies.filter((enemy) => enemy.type === "workerQueenEgg")
      .forEach((egg) => { egg.eggHatchAt = Infinity; });
    stepBattle(session, ENEMIES.workerQueen.eggLayVisual.durationMs);

    queen.queenNextEggLayAt = session.elapsed;
    stepBattle(session, 1);
    stepBattle(session, ENEMIES.workerQueen.eggLayVisual.depositMs);
    expect(session.enemies.filter((enemy) => enemy.type === "workerQueenEgg")).toHaveLength(4);
    stepBattle(session, ENEMIES.workerQueen.eggLayVisual.durationMs);

    queen.queenNextEggLayAt = session.elapsed;
    stepBattle(session, 1);
    expect(queen.queenState).not.toBe("eggLay");
    expect(queen.queenNextEggLayAt).toBe(session.elapsed + ENEMIES.workerQueen.eggLayRetryMs);
  });

  it("reduz todo dano por dois segundos sem impedir controle", () => {
    const session = sandbox();
    for (const type of ["duneRipper", "workerQueen"]) {
      const enemy = spawnEnemy(session, { type, row: 0 }).enemies[0];
      expect(getEnemyDamageTakenFactor(enemy, { elapsed: enemy.spawnedAt + 1999, direct: false })).toBe(0.6);
      expect(getEnemyDamageTakenFactor(enemy, { elapsed: enemy.spawnedAt + 1999, direct: true, sourceX: 0 })).toBe(0.6);
      expect(getEnemyDamageTakenFactor(enemy, { elapsed: enemy.spawnedAt + 2000 })).toBe(1);
      stunEnemy(session, enemy, 500);
      expect(enemy.stunnedUntil).toBeGreaterThan(session.elapsed);
    }
  });

  it("aplica teia em alvo único, renova sem acumular e restaura a cadência", () => {
    const session = sandbox();
    const troop = troopAt(session, 0, 3);
    const queen = readyQueen(session, 0);
    queen.x = troop.x + 2 * CELL.width;
    queen.previousRenderX = queen.x;
    queen.queenWebReadyAt = 0;

    stepBattle(session, 1);
    expect(queen.queenState).toBe("webAttack");
    stepBattle(session, ENEMIES.workerQueen.webAttackVisual.releaseMs);
    for (let index = 0; index < 30 && troop.attackSpeedFactor === 1; index += 1) stepBattle(session, 32);
    expect(troop.attackSpeedFactor).toBe(0.7);
    const firstUntil = troop.webSlowUntil;

    for (let index = 0; index < 180 && troop.webSlowUntil === firstUntil; index += 1) stepBattle(session, 32);
    expect(troop.attackSpeedFactor).toBe(0.7);
    expect(troop.webSlowUntil).toBeGreaterThan(firstUntil);

    queen.queenWebReadyAt = Infinity;
    stepBattle(session, ENEMIES.workerQueen.webSlowDurationMs + 1);
    expect(troop.attackSpeedFactor).toBe(1);
  });

  it("interrompe produção e usa mordida fraca no mesmo tile", () => {
    const session = sandbox();
    const troop = troopAt(session, 4, 5);
    const queen = readyQueen(session, 4);
    queen.x = troop.x + ENEMIES.workerQueen.meleeAttackRangeTiles * CELL.width;
    queen.previousRenderX = queen.x;
    queen.queenNextEggLayAt = 0;
    const hp = troop.hp;

    stepBattle(session, 1);
    expect(queen.queenState).toBe("meleeAttack");
    expect(session.enemies.filter((enemy) => enemy.type === "workerQueenEgg")).toHaveLength(0);
    stepBattle(session, ENEMIES.workerQueen.meleeAttackVisual.impactMs);
    expect(troop.hp).toBe(hp - ENEMIES.workerQueen.meleeDamage);
  });

  it("mapeia os estados dedicados da Rainha e a eclosão do ovo", () => {
    const queen = {
      type: "workerQueen",
      moving: false,
      queenState: "eggLay",
      queenStateStartedAt: 0,
      stunnedUntil: 0,
    };
    expect(getEnemyAnimation(queen, ENEMIES.workerQueen, 750, { eggLay: 8 }))
      .toEqual({ state: "eggLay", frame: 4 });
    queen.stunnedUntil = 1000;
    expect(getEnemyAnimation(queen, ENEMIES.workerQueen, 800, { stunned: 8 }).state).toBe("stunned");

    const egg = { type: "workerQueenEgg", eggCreatedAt: 0, eggHatchAt: 3500 };
    expect(getEnemyAnimation(egg, ENEMIES.workerQueenEgg, 3000, { idle: 8, hatch: 8 }).state)
      .toBe("hatch");
  });
});
