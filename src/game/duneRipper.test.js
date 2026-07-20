import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import {
  CELL,
  FIELD,
  createBattleSession,
  spawnEnemy,
  stepBattle,
  stunEnemy,
} from "./battleModel.js";
import { getEnemyAnimation } from "./visualGeometry.js";

const sandbox = () => createBattleSession(PHASES[16], [], 8813, { sandbox: true });

const blockingTroop = (x = 900, row = 0) => ({
  id: `blocker_${row}_${x}`,
  type: "muralhaReforcada",
  row,
  col: Math.floor(x / CELL.width),
  x,
  y: row * CELL.height + CELL.height / 2,
  hp: 100,
  maxHp: 100,
  dead: false,
});

describe("Rasga-Dunas", () => {
  it("registra o perfil elite, fica fora das ondas e desbloqueia no capítulo 3", () => {
    expect(ENEMIES.duneRipper).toMatchObject({
      hp: 110,
      speed: 24,
      damage: 7,
      attackEveryMs: 1250,
      baseDamage: 24,
      threat: 24,
      scale: 1.25,
      attackRangeTiles: 0.4,
      firstSummonDelayMs: 4500,
      summonEveryMs: 8000,
      summonCount: 3,
      maximumLivingSummons: 6,
      encyclopediaUnlockAt: 16,
      assetStates: ["idle", "walking", "attack", "roar"],
    });
    expect(PHASES.flatMap((phase) => phase.waves)
      .flatMap((wave) => wave.enemies)
      .some((entry) => entry.type === "duneRipper")).toBe(false);
  });

  it("faz o primeiro grito, invoca três Escavadores vinculados e conta o cooldown do fim", () => {
    const session = sandbox();
    const leader = spawnEnemy(session, { type: "duneRipper", row: 2 }).enemies[0];

    stepBattle(session, 4499);
    expect(leader.duneState).toBe("walking");
    stepBattle(session, 1);
    expect(leader.duneState).toBe("roar");
    expect(session.enemies).toHaveLength(1);

    stepBattle(session, 749);
    expect(session.enemies).toHaveLength(1);
    const events = stepBattle(session, 1);
    const summons = session.enemies.filter((enemy) => enemy.type === "silicaDigger");
    expect(events).toContainEqual(expect.objectContaining({
      type: "duneRipperRoar",
      enemyId: leader.id,
      row: 2,
      summonCount: 3,
    }));
    expect(summons).toHaveLength(3);
    expect(summons.map((enemy) => enemy.x)).toEqual([FIELD.spawnX, FIELD.spawnX + 12, FIELD.spawnX + 24]);
    expect(summons.every((enemy) => enemy.row === 2
      && enemy.summoned
      && enemy.summonerId === leader.id)).toBe(true);
    expect(leader.duneNextSummonAt).toBe(5800 + ENEMIES.duneRipper.summonEveryMs);

    stepBattle(session, 550);
    expect(leader.duneState).toBe("walking");
    stepBattle(session, ENEMIES.duneRipper.summonEveryMs - 1);
    expect(leader.duneState).toBe("walking");
    stepBattle(session, 1);
    expect(leader.duneState).toBe("roar");
  });

  it("respeita o limite por invocador, adia lote cheio e completa somente as vagas", () => {
    const session = sandbox();
    const leader = spawnEnemy(session, { type: "duneRipper", row: 1 }).enemies[0];
    leader.duneNextSummonAt = 0;
    const linked = spawnEnemy(session, {
      type: "silicaDigger", row: 1, count: 6, groupInTile: true,
    }).enemies;
    linked.forEach((enemy) => {
      enemy.summoned = true;
      enemy.summonerId = leader.id;
    });
    const natural = spawnEnemy(session, { type: "silicaDigger", row: 1 }).enemies[0];

    stepBattle(session, 1);
    expect(leader.duneState).toBe("walking");
    expect(leader.duneNextSummonAt).toBe(1 + ENEMIES.duneRipper.summonRetryMs);

    linked[0].dead = true;
    linked[1].dead = true;
    stepBattle(session, ENEMIES.duneRipper.summonRetryMs);
    expect(leader.duneState).toBe("roar");
    const events = stepBattle(session, ENEMIES.duneRipper.roarSummonAtMs);
    const livingLinked = session.enemies.filter((enemy) => (
      !enemy.dead && enemy.type === "silicaDigger" && enemy.summonerId === leader.id
    ));
    expect(livingLinked).toHaveLength(6);
    expect(events).toContainEqual(expect.objectContaining({
      type: "duneRipperRoar",
      summonCount: 2,
    }));
    expect(natural.summonerId).toBeNull();
    expect(natural.summoned).toBe(false);
  });

  it("conclui o ataque antes de priorizar o grito e aplica dano somente no impacto", () => {
    const session = sandbox();
    const troop = blockingTroop();
    session.troops = [troop];
    const leader = spawnEnemy(session, { type: "duneRipper", row: 0 }).enemies[0];
    leader.x = troop.x + ENEMIES.duneRipper.attackRangeTiles * CELL.width;
    leader.previousRenderX = leader.x;

    stepBattle(session, 1);
    expect(leader.duneState).toBe("attack");
    leader.duneNextSummonAt = session.elapsed;
    stepBattle(session, ENEMIES.duneRipper.attackVisual.impactMs - 1);
    expect(troop.hp).toBe(100);
    const impact = stepBattle(session, 1);
    expect(troop.hp).toBe(93);
    expect(impact.filter((event) => event.type === "melee")).toHaveLength(1);
    expect(leader.duneState).toBe("attack");

    stepBattle(session, ENEMIES.duneRipper.attackVisual.durationMs
      - ENEMIES.duneRipper.attackVisual.impactMs);
    expect(leader.duneState).toBe("roar");
  });

  it("cancela o grito antes da invocação e preserva criaturas e cooldown depois dela", () => {
    const session = sandbox();
    const leader = spawnEnemy(session, { type: "duneRipper", row: 3 }).enemies[0];
    leader.duneNextSummonAt = 0;
    stepBattle(session, 1);
    stepBattle(session, 300);
    stunEnemy(session, leader, 500);
    expect(leader.duneState).toBe("idle");
    expect(leader.duneNextSummonAt).toBe(session.elapsed + ENEMIES.duneRipper.interruptedSummonRetryMs);
    stepBattle(session, 500);
    expect(session.enemies).toHaveLength(1);
    stepBattle(session, 1500);
    expect(leader.duneState).toBe("roar");

    stepBattle(session, ENEMIES.duneRipper.roarSummonAtMs);
    const nextSummonAt = leader.duneNextSummonAt;
    const summons = session.enemies.filter((enemy) => enemy.type === "silicaDigger");
    expect(summons).toHaveLength(3);
    stunEnemy(session, leader, 500);
    expect(leader.duneState).toBe("idle");
    expect(leader.duneNextSummonAt).toBe(nextSummonAt);

    leader.dead = true;
    stepBattle(session, 1);
    expect(session.enemies.filter((enemy) => enemy.type === "silicaDigger")).toHaveLength(3);
  });

  it("mapeia os quatro estados para animações sincronizadas", () => {
    const config = ENEMIES.duneRipper;
    const counts = { idle: 8, walking: 8, attack: 8, roar: 8 };
    const enemy = { type: "duneRipper", duneStateStartedAt: 0, moving: false };
    expect(getEnemyAnimation({ ...enemy, duneState: "attack" }, config, 330, counts))
      .toEqual({ state: "attack", frame: 4 });
    expect(getEnemyAnimation({ ...enemy, duneState: "roar" }, config, 750, counts))
      .toEqual({ state: "roar", frame: 4 });
    for (const state of ["idle", "walking"]) {
      expect(getEnemyAnimation({ ...enemy, duneState: state }, config, 300, counts).state).toBe(state);
    }
  });
});
