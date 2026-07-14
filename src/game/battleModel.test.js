import { describe, expect, it } from "vitest";
import { PHASES, TROOPS } from "./content.js";
import { createBattleSession, placeTroop, removeTroop, startWave, stepBattle } from "./battleModel.js";
import { getEnemyHitPoint, getMuzzleWorldPosition } from "./visualGeometry.js";

describe("sessão de batalha", () => {
  it("implanta, limita célula e reembolsa metade da energia", () => {
    const session = createBattleSession(PHASES[0], ["colono"], 1);
    expect(placeTroop(session, "colono", 1, 1).ok).toBe(true);
    expect(session.energy).toBe(70);
    expect(placeTroop(session, "colono", 1, 1).reason).toMatch(/ocupada/i);
    expect(removeTroop(session, 1, 1)).toMatchObject({ ok: true, refund: 5 });
    expect(session.energy).toBe(75);
    expect(session.supply).toBe(20);
  });

  it("aplica dano de passagem e derrota somente com base zerada", () => {
    const session = createBattleSession(PHASES[0], ["colono"], 1);
    startWave(session);
    session.queue = [];
    session.enemies = Array.from({ length: 10 }, (_, index) => ({
      id: `leak_${index}`, type: "medu", row: 0, x: 17, y: 60, hp: 1, maxHp: 1,
      speed: 0, damage: 0, attackReadyAt: 0, slowUntil: 0, slowFactor: 1,
      baseDamage: 10, bossPhase: 0, dead: false,
    }));
    stepBattle(session, 32);
    expect(session.integrity).toBe(0);
    expect(session.outcome).toBe("defeat");
  });

  it("mantém pausa/velocidade fora do modelo por passos fixos", () => {
    const normal = createBattleSession(PHASES[0], ["colono"], 1);
    const fast = createBattleSession(PHASES[0], ["colono"], 1);
    stepBattle(normal, 32);
    stepBattle(fast, 32);
    stepBattle(fast, 32);
    expect(fast.elapsed).toBe(normal.elapsed * 2);
  });

  it("dispara a rajada do marine em tres tiros consecutivos", () => {
    const session = createBattleSession(PHASES[0], ["marine"], 1);
    placeTroop(session, "marine", 0, 1);
    startWave(session);
    session.queue = [];
    session.enemies = [{
      id: "target", type: "krakhul", row: 0, x: 500, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    }];

    const firstEvents = stepBattle(session, 32);
    expect(session.projectiles).toHaveLength(3);
    expect(session.projectiles.map((shot) => shot.launchAt)).toEqual([32, 152, 272]);
    session.projectiles.forEach((projectile, shot) => {
      const expected = getMuzzleWorldPosition(session.troops[0], TROOPS.marine, shot);
      expect(projectile.origin.x).toBeCloseTo(expected.x);
      expect(projectile.origin.y).toBeCloseTo(expected.y);
      expect(projectile.shotIndex).toBe(shot);
      expect(projectile.visualKind).toBe("marineBullet");
      expect(projectile.row).toBe(0);
      expect(projectile.straightLane).toBe(true);
      expect(projectile.vy).toBe(0);
    });
    expect(session.projectiles.map((shot) => shot.launched)).toEqual([true, false, false]);
    expect(firstEvents.filter((event) => event.type === "shoot")).toHaveLength(1);

    stepBattle(session, 32);
    stepBattle(session, 32);
    stepBattle(session, 32);
    const secondEvents = stepBattle(session, 32);
    expect(session.projectiles.map((shot) => shot.launched)).toEqual([true, true, false]);
    expect(secondEvents.filter((event) => event.type === "shoot")).toHaveLength(1);

    stepBattle(session, 32);
    stepBattle(session, 32);
    stepBattle(session, 32);
    const thirdEvents = stepBattle(session, 32);
    expect(session.projectiles.map((shot) => shot.launched)).toEqual([true, true, true]);
    expect(thirdEvents.filter((event) => event.type === "shoot")).toHaveLength(1);
  });

  it("mantem as balas do marine retas e sem atingir inimigos de outras linhas", () => {
    const session = createBattleSession(PHASES[0], ["marine"], 2);
    placeTroop(session, "marine", 0, 1);
    startWave(session);
    session.queue = [];
    const originalTarget = {
      id: "same_lane", type: "krakhul", row: 0, x: 500, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    };
    const otherLane = {
      ...originalTarget, id: "other_lane", row: 1, y: 180, hp: 999, maxHp: 999,
    };
    session.enemies = [originalTarget, otherLane];

    stepBattle(session, 32);
    const initialY = session.projectiles[0].y;
    originalTarget.dead = true;
    for (let index = 0; index < 12; index += 1) stepBattle(session, 32);

    expect(otherLane.hp).toBe(999);
    expect(session.projectiles.every((projectile) => projectile.y === projectile.origin.y)).toBe(true);
    expect(session.projectiles[0].y).toBe(initialY);

    for (let index = 0; index < 78; index += 1) stepBattle(session, 32);
    expect(otherLane.hp).toBe(999);
  });

  it("mantem o tiro do sniper reto e restrito a linha de origem", () => {
    const session = createBattleSession(PHASES[2], ["sniper"], 3);
    placeTroop(session, "sniper", 2, 1);
    startWave(session);
    session.queue = [];
    const originalTarget = {
      id: "sniper_lane", type: "krakhul", row: 2, x: 520, y: 300, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    };
    const otherLane = {
      ...originalTarget, id: "sniper_other_lane", row: 3, y: 420, hp: 999, maxHp: 999,
    };
    session.enemies = [originalTarget, otherLane];

    stepBattle(session, 32);
    const projectile = session.projectiles[0];
    expect(projectile.visualKind).toBe("sniperBullet");
    expect(projectile.row).toBe(2);
    expect(projectile.straightLane).toBe(true);
    expect(projectile.vy).toBe(0);
    const initialY = projectile.y;

    originalTarget.dead = true;
    for (let index = 0; index < 12; index += 1) stepBattle(session, 32);
    expect(session.projectiles[0].y).toBe(initialY);
    expect(otherLane.hp).toBe(999);

    for (let index = 0; index < 78; index += 1) stepBattle(session, 32);
    expect(otherLane.hp).toBe(999);
  });

  it("mantem o orbe do krio reto e restrito a linha de origem", () => {
    const session = createBattleSession(PHASES[4], ["krio"], 4);
    placeTroop(session, "krio", 1, 1);
    startWave(session);
    session.queue = [];
    const originalTarget = {
      id: "krio_lane", type: "krakhul", row: 1, x: 520, y: 180, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    };
    const otherLane = {
      ...originalTarget, id: "krio_other_lane", row: 2, y: 300, hp: 999, maxHp: 999,
    };
    session.enemies = [originalTarget, otherLane];

    stepBattle(session, 32);
    const projectile = session.projectiles[0];
    expect(projectile.visualKind).toBe("ice");
    expect(projectile.row).toBe(1);
    expect(projectile.straightLane).toBe(true);
    expect(projectile.vy).toBe(0);
    const initialY = projectile.y;

    originalTarget.dead = true;
    const snowEvents = [];
    for (let index = 0; index < 12; index += 1) snowEvents.push(...stepBattle(session, 32));
    expect(session.projectiles[0].y).toBe(initialY);
    expect(otherLane.hp).toBe(999);
    expect(snowEvents.some((event) => event.type === "iceTrail" && event.variant === "short")).toBe(true);
    expect(snowEvents.some((event) => event.type === "iceTrail" && event.variant === "long")).toBe(true);

    for (let index = 0; index < 78; index += 1) stepBattle(session, 32);
    expect(otherLane.hp).toBe(999);
  });

  it("aplica e renova a lentidao do krio sem acumular o fator", () => {
    const session = createBattleSession(PHASES[4], ["krio"], 5);
    placeTroop(session, "krio", 0, 1);
    startWave(session);
    session.queue = [];
    const target = {
      id: "frozen_target", type: "krakhul", row: 0, x: 300, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, dead: false,
    };
    session.enemies = [target];

    for (let index = 0; index < 30 && target.slowUntil === 0; index += 1) stepBattle(session, 32);
    expect(target.slowFactor).toBe(TROOPS.krio.slowFactor);
    expect(target.slowUntil).toBe(session.elapsed + TROOPS.krio.slowMs);
    const firstSlowUntil = target.slowUntil;

    session.troops[0].attackReadyAt = session.elapsed;
    for (let index = 0; index < 30 && target.slowUntil === firstSlowUntil; index += 1) stepBattle(session, 32);
    expect(target.slowUntil).toBeGreaterThan(firstSlowUntil);
    expect(target.slowFactor).toBe(0.5);
  });

  it.each([
    ["ranger", "beam"],
    ["caçador", "shotgun"],
  ])("inicia o ataque instantaneo de %s no cano da arma", (troopId, eventType) => {
    const session = createBattleSession(PHASES[7], [troopId], 9);
    placeTroop(session, troopId, 0, 1);
    startWave(session);
    session.queue = [];
    session.enemies = [{
      id: "target", type: "krakhul", row: 0, x: 300, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, scale: 1, dead: false,
    }];

    const events = stepBattle(session, 32);
    const event = events.find((entry) => entry.type === eventType);
    const muzzle = getMuzzleWorldPosition(session.troops[0], TROOPS[troopId]);
    expect(event.x0).toBeCloseTo(muzzle.x);
    expect(event.y0).toBeCloseTo(muzzle.y);
    expect(event.sourceTroopId).toBe(session.troops[0].id);
    if (eventType === "beam") {
      const targetPoint = getEnemyHitPoint(session.enemies[0]);
      expect(event.x1).toBeCloseTo(targetPoint.x);
      expect(event.y1).toBeCloseTo(event.y0);
      expect(event.row).toBe(session.troops[0].row);
    }
  });

  it("dispara a bola de fogo do guarda em linha, com alcance e cadencia limitados", () => {
    const session = createBattleSession(PHASES[7], ["guarda"], 10);
    placeTroop(session, "guarda", 0, 1);
    startWave(session);
    session.queue = [];
    const originalTarget = {
      id: "guard_original", type: "krakhul", row: 0, x: 300, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, scale: 1, dead: false,
    };
    const replacement = { ...originalTarget, id: "guard_replacement", x: 350, hp: 999, maxHp: 999 };
    const otherLane = { ...originalTarget, id: "guard_other_lane", row: 1, y: 180, hp: 999, maxHp: 999 };
    session.enemies = [originalTarget, replacement, otherLane];

    const firstEvents = stepBattle(session, 32);
    const projectile = session.projectiles[0];
    const muzzle = getMuzzleWorldPosition(session.troops[0], TROOPS.guarda);
    expect(TROOPS.guarda.attackEveryMs).toBe(900);
    expect(TROOPS.guarda.damage).toBe(9);
    expect(session.troops[0].attackReadyAt - session.troops[0].lastAttackAt).toBe(900);
    expect(projectile).toMatchObject({ kind: "fireball", visualKind: "fireball", row: 0, straightLane: true, vy: 0, maxDistance: 250 });
    expect(projectile.origin.x).toBeCloseTo(muzzle.x);
    expect(projectile.origin.y).toBeCloseTo(muzzle.y);
    expect(firstEvents.some((event) => event.type === "shoot" && event.weapon === "fireball")).toBe(true);

    originalTarget.dead = true;
    const events = [];
    for (let index = 0; index < 30 && replacement.hp === 999; index += 1) events.push(...stepBattle(session, 32));
    expect(replacement.hp).toBe(999 - TROOPS.guarda.damage);
    expect(otherLane.hp).toBe(999);
    expect(events.some((event) => event.type === "fireTrail")).toBe(true);
    expect(events.some((event) => event.type === "fireImpact")).toBe(true);
  });

  it("remove a bola de fogo do guarda ao atingir o alcance maximo", () => {
    const session = createBattleSession(PHASES[7], ["guarda"], 12);
    placeTroop(session, "guarda", 0, 1);
    startWave(session);
    session.queue = [];
    const target = {
      id: "guard_range", type: "krakhul", row: 0, x: 300, y: 60, hp: 999, maxHp: 999,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, scale: 1, dead: false,
    };
    const otherLane = { ...target, id: "guard_range_other_lane", row: 1, y: 180 };
    session.enemies = [target, otherLane];
    stepBattle(session, 32);
    target.dead = true;
    for (let index = 0; index < 30 && session.projectiles.length; index += 1) stepBattle(session, 32);
    expect(session.projectiles).toHaveLength(0);
  });

  it("exibe tres micromisseis sem multiplicar o dano logico do bombardeiro", () => {
    const session = createBattleSession(PHASES[7], ["bombardeiro"], 11);
    placeTroop(session, "bombardeiro", 0, 1);
    startWave(session);
    session.queue = [];
    session.enemies = [{
      id: "target", type: "krakhul", row: 0, x: 300, y: 60, hp: 100, maxHp: 100,
      speed: 0, damage: 0, attackReadyAt: Infinity, slowUntil: 0, slowFactor: 1,
      baseDamage: 30, bossPhase: 0, scale: 1, dead: false,
    }];

    stepBattle(session, 32);
    const projectile = session.projectiles[0];
    expect(projectile.visualKind).toBe("microMissile");
    expect(projectile.visualCount).toBe(3);
    for (let index = 0; index < 30 && session.enemies[0].hp === 100; index += 1) stepBattle(session, 32);
    expect(session.enemies[0].hp).toBe(100 - TROOPS.bombardeiro.damage);
  });
});
