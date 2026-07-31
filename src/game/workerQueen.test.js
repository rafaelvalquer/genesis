import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, TROOPS } from "./content.js";
import {
  CELL,
  FIELD,
  createBattleSession,
  getEnemyDamageTakenFactor,
  getSnapshot,
  getTroopRangePenaltyTiles,
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

function actionableTroopAt(session, row, col, hp = 200) {
  const result = placeTroop(session, "marine", row, col);
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
  queen.queenGuardReadyAt = Infinity;
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
      webTriggerRangeTiles: 3,
      webTargetEntireRow: true,
      webRangePenaltyTiles: 1,
      eggsPerLay: 2,
      maximumLivingEggs: 4,
      maximumLivingSummons: 6,
      firstEggLayDelayMs: 3000,
      eggLayEveryMs: 8000,
      guardSummonCooldownMs: 8000,
      guardMaximumLiving: 8,
      guardSpawnOffsetTiles: 1.5,
      guardSpawnSpacingPx: 30,
      guardDistanceTiers: [
        { minDistanceTiles: 8, count: 8 },
        { minDistanceTiles: 6, count: 6 },
        { minDistanceTiles: 4, count: 4 },
        { minDistanceTiles: 0, count: 3 },
      ],
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

  it("invoca a primeira escolta ao concluir a entrada e escala por distância", () => {
    [
      { distanceTiles: 8, count: 8, tier: 8 },
      { distanceTiles: 6, count: 6, tier: 6 },
      { distanceTiles: 4, count: 4, tier: 4 },
      { distanceTiles: 3.99, count: 3, tier: 0 },
    ].forEach(({ distanceTiles, count, tier }) => {
      const session = sandbox();
      const queen = spawnEnemy(session, { type: "workerQueen", row: 2 }).enemies[0];
      queen.x = FIELD.baseX + distanceTiles * CELL.width;
      queen.previousRenderX = queen.x;
      expect(stepBattle(session, ENEMIES.workerQueen.spawnDurationMs - 1))
        .not.toContainEqual(expect.objectContaining({ type: "workerQueenGuardSummoned" }));
      const events = stepBattle(session, 1);
      expect(events).toContainEqual(expect.objectContaining({
        type: "workerQueenGuardSummoned",
        sourceEnemyId: queen.id,
        row: 2,
        summonCount: count,
        tierMinDistanceTiles: tier,
      }));
      const guards = session.enemies.filter((enemy) => enemy.queenGuardOwnerId === queen.id);
      expect(guards).toHaveLength(count);
      expect(guards.every((guard) => guard.type === "silicaDigger"
        && guard.row === queen.row && guard.x < queen.x && guard.summonerId == null)).toBe(true);
      const positions = guards.map((guard) => guard.x).sort((left, right) => left - right);
      const gaps = positions.slice(1).map((x, index) => x - positions[index]);
      expect(gaps.every((gap) => gap === 30)).toBe(true);
      expect(queen.x - positions.at(-1)).toBeGreaterThanOrEqual(44.9);
    });
  });

  it("usa qualquer Escavador à frente na mesma linha como proteção", () => {
    const session = sandbox();
    const queen = readyQueen(session, 2);
    queen.x = FIELD.baseX + 8 * CELL.width;
    queen.speed = 0;
    queen.queenGuardReadyAt = 0;
    const ahead = spawnEnemy(session, { type: "silicaDigger", row: 2 }).enemies[0];
    ahead.x = queen.x - 20;
    expect(stepBattle(session, 1))
      .not.toContainEqual(expect.objectContaining({ type: "workerQueenGuardSummoned" }));

    ahead.dead = true;
    const behind = spawnEnemy(session, { type: "silicaDigger", row: 2 }).enemies[0];
    behind.x = queen.x + 20;
    const otherRow = spawnEnemy(session, { type: "silicaDigger", row: 1 }).enemies[0];
    otherRow.x = queen.x - 20;
    expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({
      type: "workerQueenGuardSummoned", sourceEnemyId: queen.id, summonCount: 8,
    }));
  });

  it("respeita oito segundos de recarga e o limite de oito guardas vivos", () => {
    const session = sandbox();
    const queen = readyQueen(session, 1);
    queen.x = FIELD.baseX + 8 * CELL.width;
    queen.speed = 0;
    queen.queenGuardReadyAt = 0;
    expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({
      type: "workerQueenGuardSummoned", summonCount: 8,
    }));
    session.enemies.filter((enemy) => enemy.queenGuardOwnerId === queen.id)
      .forEach((guard) => { guard.dead = true; });
    expect(stepBattle(session, 7999))
      .not.toContainEqual(expect.objectContaining({ type: "workerQueenGuardSummoned" }));
    expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({
      type: "workerQueenGuardSummoned", summonCount: 8,
    }));

    const guards = session.enemies.filter((enemy) => enemy.queenGuardOwnerId === queen.id);
    guards.forEach((guard) => { guard.x = queen.x + 20; });
    queen.queenGuardReadyAt = session.elapsed;
    expect(stepBattle(session, 1))
      .not.toContainEqual(expect.objectContaining({ type: "workerQueenGuardSummoned" }));
  });

  it("compartilha a proteção entre Rainhas e adia a invocação durante atordoamento", () => {
    const session = sandbox();
    const frontQueen = readyQueen(session, 3);
    const rearQueen = readyQueen(session, 3);
    frontQueen.x = FIELD.baseX + 8 * CELL.width;
    rearQueen.x = FIELD.baseX + 8.5 * CELL.width;
    frontQueen.speed = 0;
    rearQueen.speed = 0;
    frontQueen.queenGuardReadyAt = 0;
    rearQueen.queenGuardReadyAt = 0;
    stunEnemy(session, frontQueen, 500);

    const firstEvents = stepBattle(session, 1);
    expect(firstEvents.filter((event) => event.type === "workerQueenGuardSummoned")).toHaveLength(1);
    expect(firstEvents).toContainEqual(expect.objectContaining({ sourceEnemyId: rearQueen.id }));
    expect(stepBattle(session, 498))
      .not.toContainEqual(expect.objectContaining({ type: "workerQueenGuardSummoned" }));
    expect(stepBattle(session, 1))
      .not.toContainEqual(expect.objectContaining({ type: "workerQueenGuardSummoned" }));
    session.enemies.filter((enemy) => enemy.queenGuardOwnerId === rearQueen.id)
      .forEach((guard) => { guard.dead = true; });
    expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({
      type: "workerQueenGuardSummoned", sourceEnemyId: frontQueen.id,
    }));
  });

  it("repõe a guarda sem alterar ataques ou postura de ovos", () => {
    ["eggLay", "webAttack", "meleeAttack"].forEach((state) => {
      const session = sandbox();
      const queen = readyQueen(session, 4);
      queen.x = FIELD.baseX + 6 * CELL.width;
      queen.queenState = state;
      queen.queenStateStartedAt = session.elapsed;
      queen.queenStateEndsAt = session.elapsed + 1000;
      queen.queenGuardReadyAt = 0;
      const actionEndsAt = queen.queenStateEndsAt;
      expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({
        type: "workerQueenGuardSummoned", sourceEnemyId: queen.id, summonCount: 6,
      }));
      expect(queen.queenState).toBe(state);
      expect(queen.queenStateEndsAt).toBe(actionEndsAt);
    });
  });

  it("não desconta guardas diretos da capacidade de ovos e ninhada", () => {
    const session = sandbox();
    const queen = readyQueen(session, 0);
    queen.x = FIELD.baseX + 8 * CELL.width;
    queen.speed = 0;
    queen.queenGuardReadyAt = 0;
    expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({
      type: "workerQueenGuardSummoned", summonCount: 8,
    }));
    expect(session.enemies.filter((enemy) => enemy.queenGuardOwnerId === queen.id)).toHaveLength(8);

    queen.queenNextEggLayAt = session.elapsed;
    stepBattle(session, 1);
    expect(queen.queenState).toBe("eggLay");
  });

  it("para a três tiles e volta a caminhar quando perde o alvo", () => {
    const session = sandbox();
    const troop = actionableTroopAt(session, 2, 3);
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
    expect(summons.every((enemy) => enemy.summoned && enemy.summonerId === queen.id
      && enemy.moving && enemy.emergeState == null)).toBe(true);
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

  it("ativa a supressão somente com tropa acionável a até três tiles", () => {
    const cases = [
      { type: "marine", troopRow: 0, queenRow: 0, distance: 3, expected: "idle" },
      { type: "reator", troopRow: 0, queenRow: 0, distance: 2, expected: "idle" },
      { type: "medicaNanites", troopRow: 0, queenRow: 0, distance: 2, expected: "idle" },
      { type: "demolidora", troopRow: 0, queenRow: 0, distance: 2, expected: "idle" },
      { type: "colono", troopRow: 0, queenRow: 0, distance: 2, expected: "idle" },
      { type: "marine", troopRow: 0, queenRow: 0, distance: 3.01, expected: "walking" },
      { type: "marine", troopRow: 1, queenRow: 0, distance: 2, expected: "walking" },
      { type: "muralhaReforcada", troopRow: 0, queenRow: 0, distance: 2, expected: "walking" },
    ];
    cases.forEach(({ type, troopRow, queenRow, distance, expected }) => {
      const session = sandbox();
      const troop = placeTroop(session, type, troopRow, 3).troop;
      const queen = readyQueen(session, queenRow);
      queen.x = troop.x + distance * CELL.width;
      queen.previousRenderX = queen.x;
      queen.queenWebReadyAt = Infinity;
      stepBattle(session, 1);
      expect(queen.queenState).toBe(expected);
      expect(queen.moving).toBe(expected === "walking");
    });
  });

  it("sorteia deterministicamente em toda a rota e escolhe novamente a cada disparo", () => {
    const session = sandbox();
    const rear = actionableTroopAt(session, 1, 1);
    actionableTroopAt(session, 1, 4);
    const trigger = actionableTroopAt(session, 1, 7);
    troopAt(session, 1, 6);
    const queen = readyQueen(session, 1);
    queen.x = trigger.x + 2 * CELL.width;
    queen.previousRenderX = queen.x;
    queen.queenWebReadyAt = 0;
    const rolls = [0, 0.999];
    session.rng = () => rolls.shift() ?? 0;

    expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({
      type: "workerQueenWebTargeted", sourceEnemyId: queen.id, targetTroopId: rear.id,
    }));
    stepBattle(session, ENEMIES.workerQueen.webAttackVisual.releaseMs);
    stepBattle(session, ENEMIES.workerQueen.webAttackVisual.durationMs
      - ENEMIES.workerQueen.webAttackVisual.releaseMs);
    const untilReady = queen.queenWebReadyAt - session.elapsed;
    expect(stepBattle(session, untilReady)).toContainEqual(expect.objectContaining({
      type: "workerQueenWebTargeted", sourceEnemyId: queen.id, targetTroopId: trigger.id,
    }));
  });

  it("suspende novas posturas durante a supressão sem interromper postura iniciada", () => {
    const session = sandbox();
    const trigger = actionableTroopAt(session, 4, 4);
    const queen = readyQueen(session, 4);
    queen.x = trigger.x + 2 * CELL.width;
    queen.queenNextEggLayAt = 0;
    queen.queenWebReadyAt = Infinity;
    stepBattle(session, 1);
    expect(queen.queenState).toBe("idle");
    expect(session.enemies.filter((enemy) => enemy.type === "workerQueenEgg")).toEqual([]);

    trigger.dead = true;
    stepBattle(session, 1);
    expect(queen.queenState).toBe("eggLay");
    actionableTroopAt(session, 4, 5);
    stepBattle(session, ENEMIES.workerQueen.eggLayVisual.depositMs);
    expect(session.enemies.filter((enemy) => enemy.type === "workerQueenEgg")).toHaveLength(2);
  });

  it("trava a teia no alvo, ignora interceptores e sobrevive à morte da Rainha", () => {
    const session = sandbox();
    const target = actionableTroopAt(session, 2, 1);
    const interceptor = actionableTroopAt(session, 2, 4);
    const queen = readyQueen(session, 2);
    queen.x = interceptor.x + 2 * CELL.width;
    queen.previousRenderX = queen.x;
    queen.queenWebReadyAt = 0;
    session.rng = () => 0;
    const targetHp = target.hp;
    const interceptorHp = interceptor.hp;

    stepBattle(session, 1);
    stepBattle(session, ENEMIES.workerQueen.webAttackVisual.releaseMs);
    expect(session.enemyProjectiles[0]).toMatchObject({
      kind: "inhibitorWeb", targetTroopId: target.id, targetLocked: true, ignoreInterceptors: true,
    });
    queen.dead = true;
    let impactEvents = [];
    for (let index = 0; index < 120 && target.hp === targetHp; index += 1) {
      impactEvents = stepBattle(session, 32);
    }
    expect(target.hp).toBe(targetHp - 1);
    expect(interceptor.hp).toBe(interceptorHp);
    expect(impactEvents).toContainEqual(expect.objectContaining({
      type: "inhibitorWebImpact",
      sourceEnemyId: queen.id,
      targetTroopId: target.id,
      attackSpeedFactor: 0.7,
      rangePenaltyTiles: 1,
      durationMs: 3000,
    }));
  });

  it("remove a teia travada se o alvo morrer durante o voo", () => {
    const session = sandbox();
    const target = actionableTroopAt(session, 3, 2);
    const queen = readyQueen(session, 3);
    queen.x = target.x + 2 * CELL.width;
    queen.queenWebReadyAt = 0;
    stepBattle(session, 1);
    stepBattle(session, ENEMIES.workerQueen.webAttackVisual.releaseMs);
    expect(session.enemyProjectiles).toHaveLength(1);
    target.dead = true;
    expect(stepBattle(session, 1))
      .not.toContainEqual(expect.objectContaining({ type: "inhibitorWebImpact" }));
    expect(session.enemyProjectiles).toEqual([]);
  });

  it("consome a tentativa se o alvo morrer antes do lançamento", () => {
    const session = sandbox();
    const target = actionableTroopAt(session, 2, 3);
    const queen = readyQueen(session, 2);
    queen.x = target.x + 2 * CELL.width;
    queen.queenWebReadyAt = 0;
    stepBattle(session, 1);
    target.dead = true;
    stepBattle(session, ENEMIES.workerQueen.webAttackVisual.releaseMs);
    expect(session.enemyProjectiles).toEqual([]);
    expect(queen.queenWebReadyAt).toBe(session.elapsed + ENEMIES.workerQueen.webAttackEveryMs);
  });

  it("permite que Rainhas sorteiem independentemente e renovem o mesmo alvo", () => {
    const session = sandbox();
    const target = actionableTroopAt(session, 1, 3);
    const firstQueen = readyQueen(session, 1);
    const secondQueen = readyQueen(session, 1);
    firstQueen.x = target.x + 2 * CELL.width;
    secondQueen.x = target.x + 2.5 * CELL.width;
    firstQueen.queenWebReadyAt = 0;
    secondQueen.queenWebReadyAt = 0;
    session.rng = () => 0;
    const events = stepBattle(session, 1);
    expect(events.filter((event) => event.type === "workerQueenWebTargeted")).toEqual([
      expect.objectContaining({ sourceEnemyId: firstQueen.id, targetTroopId: target.id }),
      expect.objectContaining({ sourceEnemyId: secondQueen.id, targetTroopId: target.id }),
    ]);
  });

  it("aplica teia em alvo único, renova sem acumular e restaura a cadência", () => {
    const session = sandbox();
    const troop = actionableTroopAt(session, 0, 3);
    const queen = readyQueen(session, 0);
    queen.x = troop.x + 2 * CELL.width;
    queen.previousRenderX = queen.x;
    queen.queenWebReadyAt = 0;

    stepBattle(session, 1);
    expect(queen.queenState).toBe("webAttack");
    stepBattle(session, ENEMIES.workerQueen.webAttackVisual.releaseMs);
    for (let index = 0; index < 30 && troop.attackSpeedFactor === 1; index += 1) stepBattle(session, 32);
    expect(troop.attackSpeedFactor).toBe(0.7);
    expect(troop.webRangePenaltyTiles).toBe(1);
    expect(troop.webRangePenaltyUntil).toBe(troop.webSlowUntil);
    expect(getTroopRangePenaltyTiles(session, troop)).toBe(1);
    expect(getSnapshot(session).webDebuffs).toContainEqual(expect.objectContaining({
      troopId: troop.id,
      attackSpeedFactor: 0.7,
      rangePenaltyTiles: 1,
    }));
    const firstUntil = troop.webSlowUntil;

    for (let index = 0; index < 180 && troop.webSlowUntil === firstUntil; index += 1) stepBattle(session, 32);
    expect(troop.attackSpeedFactor).toBe(0.7);
    expect(troop.webSlowUntil).toBeGreaterThan(firstUntil);
    expect(troop.webRangePenaltyTiles).toBe(1);
    expect(troop.webRangePenaltyUntil).toBe(troop.webSlowUntil);

    queen.queenWebReadyAt = Infinity;
    stepBattle(session, ENEMIES.workerQueen.webSlowDurationMs + 1);
    expect(troop.attackSpeedFactor).toBe(1);
    expect(troop.webRangePenaltyTiles).toBe(0);
    expect(getSnapshot(session).webDebuffs).toEqual([]);
  });

  it("soma alcance da teia e tempestade sem reduzir abaixo de um tile", () => {
    const session = sandbox();
    const troop = actionableTroopAt(session, 0, 2);
    troop.webSlowUntil = session.elapsed + 3000;
    troop.webSlowFactor = 0.7;
    troop.webRangePenaltyUntil = session.elapsed + 3000;
    troop.webRangePenaltyTiles = 1;
    expect(getTroopRangePenaltyTiles(session, troop)).toBe(1);

    session.sandstorm.state = "active";
    session.sandstorm.endsAt = Infinity;
    expect(getTroopRangePenaltyTiles(session, troop)).toBe(2);
    session.modifiers.targetingRange = 0.25;
    const enemy = spawnEnemy(session, { type: "silex", row: troop.row }).enemies[0];
    enemy.x = troop.x + CELL.width;
    enemy.previousRenderX = enemy.x;
    enemy.speed = 0;
    stepBattle(session, 1);
    expect(troop.lastAttackAt).toBe(session.elapsed);
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
