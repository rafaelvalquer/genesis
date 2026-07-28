import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CHAPTERS, ENEMIES, PHASES } from "./content.js";
import {
  CELL, createBattleSession, placeTroop, spawnEnemy, stepBattle, stunEnemy,
  tryGorjalFormationPush,
} from "./battleModel.js";
import { CHAPTER_FOUR_ENEMY_IDS } from "./chapterFourEnemies.js";
import { getEnemyAnimation } from "./visualGeometry.js";

describe("inimigos do Capítulo 4", () => {
  it("expõe os cinco inimigos no Campo de Provas e não declara estado hit", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 1, { sandbox: true });
    CHAPTER_FOUR_ENEMY_IDS.forEach((enemyId) => {
      expect(spawnEnemy(session, { type: enemyId, row: 2 }).ok).toBe(true);
      expect(ENEMIES[enemyId].assetStates).not.toContain("hit");
      expect(ENEMIES[enemyId].assetStates.every((state) => (
        existsSync(join(process.cwd(), "src", "game", "assets", "enemy", enemyId, state, "frame0.png"))
      ))).toBe(true);
    });
  });

  it("configura resistências, voo e alcance conforme o papel tático", () => {
    expect(ENEMIES.voltriz).toMatchObject({ airborne: true, range: 3.5, canBeWindEjected: false });
    expect(ENEMIES.nimbarca).toMatchObject({ airborne: true, preferredRange: 2, windResistance: 0.7 });
    expect(ENEMIES.gorjal).toMatchObject({
      chargeDamage: 40,
      knockbackFactor: 0.3,
      meleeContactDistancePx: 115,
    });
    expect(ENEMIES.derivante.assetStates).toContain("windGlide");
    expect(ENEMIES.raizFulgor).toMatchObject({ range: 4.5, preferredRange: 4 });
  });

  it("empurra a rota atomicamente e respeita âncoras absolutas", () => {
    const session = createBattleSession(PHASES[24], ["colono", "muralhaReforcada"], 2, { sandbox: true });
    placeTroop(session, "colono", 1, 4);
    placeTroop(session, "colono", 1, 6);
    const gorjal = spawnEnemy(session, { type: "gorjal", row: 1 }).enemies[0];
    expect(tryGorjalFormationPush(session, gorjal)).toBe(true);
    expect(session.troops.map((troop) => troop.col)).toEqual([3, 5]);
    placeTroop(session, "muralhaReforcada", 1, 7);
    const before = session.troops.map((troop) => troop.col);
    expect(tryGorjalFormationPush(session, gorjal)).toBe(false);
    expect(session.troops.map((troop) => troop.col)).toEqual(before);
  });

  it("torna as oito operações jogáveis com 5/6/7 ondas e loadout sete", () => {
    const chapter = CHAPTERS.find((entry) => entry.id === "chapter_04");
    const phases = PHASES.slice(24, 32);
    expect(chapter.phaseIds).toHaveLength(8);
    expect(phases.map((phase) => phase.waves.length)).toEqual([5, 5, 5, 5, 6, 6, 6, 7]);
    expect(phases.every((phase) => phase.loadoutLimit === 7 && phase.supplyLimit === 35)).toBe(true);
  });

  it("sincroniza o projétil do Nimbarca no quadro de liberação e o cria uma única vez", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 41, { sandbox: true });
    const troop = placeTroop(session, "colono", 2, 4).troop;
    troop.attackReadyAt = Infinity;
    const nimbarca = spawnEnemy(session, { type: "nimbarca", row: 2 }).enemies[0];
    nimbarca.x = troop.x + ENEMIES.nimbarca.range * CELL.width - 4;
    nimbarca.nextSpecialAt = Infinity;

    stepBattle(session, 1);
    expect(nimbarca.chapterFourState).toBe("attack");
    expect(session.enemyProjectiles).toHaveLength(0);
    stepBattle(session, 339);
    expect(session.enemyProjectiles).toHaveLength(0);
    stepBattle(session, 1);
    expect(getEnemyAnimation(nimbarca, ENEMIES.nimbarca, session.elapsed, { attack: 8 })).toMatchObject({
      state: "attack",
      frame: 3,
    });
    expect(session.enemyProjectiles).toHaveLength(1);
    expect(session.enemyProjectiles[0]).toMatchObject({
      sourceEnemyId: nimbarca.id,
      targetTroopId: troop.id,
      visualKind: "ventralBolt",
    });
    stepBattle(session, 200);
    expect(session.enemyProjectiles.filter((projectile) => projectile.sourceEnemyId === nimbarca.id)).toHaveLength(1);
  });

  it("para de disparar e volta a avançar quando o Voltriz paralisa o alvo", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 44, { sandbox: true });
    const troop = placeTroop(session, "colono", 2, 4).troop;
    troop.electricStacks = 2;
    troop.electricStacksExpireAt = Infinity;
    const voltriz = spawnEnemy(session, { type: "voltriz", row: 2 }).enemies[0];
    voltriz.x = troop.x + 220;
    voltriz.attackReadyAt = 0;

    expect(stepBattle(session, 1).some((event) => event.type === "shoot")).toBe(true);
    stepBattle(session, 1000);
    expect(troop.electricParalyzedUntil).toBeGreaterThan(session.elapsed);
    expect(voltriz.voltrizTargetId).toBeNull();
    expect(voltriz.chapterFourState).toBe("flying");
    const xAfterParalysis = voltriz.x;
    stepBattle(session, 100);
    expect(voltriz.x).toBeLessThan(xAfterParalysis);
    expect(session.enemyProjectiles.filter((projectile) => projectile.sourceEnemyId === voltriz.id)).toHaveLength(0);
  });

  it("atravessa uma tropa paralisada e não a readquire depois da imunidade", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 45, { sandbox: true });
    const troop = placeTroop(session, "colono", 2, 4).troop;
    const voltriz = spawnEnemy(session, { type: "voltriz", row: 2 }).enemies[0];
    voltriz.x = troop.x + 100;
    voltriz.attackReadyAt = 0;
    troop.electricParalyzedUntil = session.elapsed + 800;
    troop.electricImmunityUntil = session.elapsed + 3000;
    const duringParalysis = stepBattle(session, 700);
    expect(duringParalysis.some((event) => event.type === "shoot")).toBe(false);

    const afterParalysis = stepBattle(session, 200);
    const projectile = session.enemyProjectiles.find((candidate) => candidate.sourceEnemyId === voltriz.id);
    expect(afterParalysis.some((event) => event.type === "shoot")).toBe(true);
    expect(projectile?.targetTroopId).toBe(troop.id);

    stepBattle(session, 300);
    expect(troop.electricStacks).toBe(0);
    expect(troop.electricParalyzedUntil).toBeLessThanOrEqual(session.elapsed);
  });

  it("ignora a primeira tropa paralisada e seleciona a próxima saudável", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 46, { sandbox: true });
    const front = placeTroop(session, "colono", 2, 4).troop;
    const next = placeTroop(session, "colono", 2, 2).troop;
    front.electricParalyzedUntil = Infinity;
    front.electricImmunityUntil = Infinity;
    front.electricStacks = 1;
    front.electricStacksExpireAt = Infinity;
    const voltriz = spawnEnemy(session, { type: "voltriz", row: 2 }).enemies[0];
    voltriz.x = front.x + 130;
    voltriz.attackReadyAt = 0;

    const events = stepBattle(session, 1);
    expect(session.enemyProjectiles.find((projectile) => projectile.sourceEnemyId === voltriz.id)?.targetTroopId)
      .toBe(next.id);
    expect(events.some((event) => event.type === "shoot")).toBe(true);
    stepBattle(session, 1000);
    expect(front.electricStacks).toBe(1);
  });

  it("continua voando sem atacar tropas já paralisadas ou ultrapassadas", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 47, { sandbox: true });
    const troop = placeTroop(session, "colono", 2, 4).troop;
    troop.electricParalyzedUntil = Infinity;
    troop.electricImmunityUntil = Infinity;
    const voltriz = spawnEnemy(session, { type: "voltriz", row: 2 }).enemies[0];
    voltriz.x = troop.x + 80;
    const firstX = voltriz.x;
    const events = stepBattle(session, 250);
    expect(voltriz.x).toBeLessThan(firstX);
    expect(events.some((event) => event.type === "shoot")).toBe(false);

    troop.electricParalyzedUntil = 0;
    troop.electricImmunityUntil = 0;
    voltriz.x = troop.x - 10;
    const secondEvents = stepBattle(session, 250);
    expect(secondEvents.some((event) => event.type === "shoot")).toBe(false);
  });

  it("mantém shieldPulse acima do ataque e aplica o pulso somente uma vez", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 42, { sandbox: true });
    const troop = placeTroop(session, "colono", 1, 4).troop;
    troop.attackReadyAt = Infinity;
    const nimbarca = spawnEnemy(session, { type: "nimbarca", row: 1 }).enemies[0];
    const voltriz = spawnEnemy(session, { type: "voltriz", row: 1 }).enemies[0];
    nimbarca.x = troop.x + ENEMIES.nimbarca.range * CELL.width - 4;
    voltriz.x = nimbarca.x - CELL.width;
    voltriz.attackReadyAt = 10_000;
    nimbarca.nextSpecialAt = 0;

    const pulseEvents = stepBattle(session, 1).filter((event) => event.type === "stormShieldPulse");
    expect(pulseEvents).toHaveLength(1);
    expect(pulseEvents[0].targetIds).toContain(voltriz.id);
    expect(nimbarca.chapterFourState).toBe("shieldPulse");
    expect(session.enemyProjectiles).toHaveLength(0);
    expect(nimbarca.chapterFourActionApplied).toBe(true);

    const duringPulse = stepBattle(session, 699);
    expect(duringPulse.filter((event) => event.type === "stormShieldPulse")).toHaveLength(0);
    expect(nimbarca.chapterFourState).toBe("shieldPulse");
    expect(session.enemyProjectiles).toHaveLength(0);

    stepBattle(session, 1);
    expect(nimbarca.chapterFourState).toBe("attack");
    expect(session.enemyProjectiles).toHaveLength(0);
  });

  it("sincroniza o ataque comum do Gorjal com o quadro de impacto e aplica o dano uma vez", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 43, { sandbox: true });
    const troop = placeTroop(session, "colono", 2, 4).troop;
    troop.attackReadyAt = Infinity;
    const gorjal = spawnEnemy(session, { type: "gorjal", row: 2 }).enemies[0];
    gorjal.gorjalInitialCharge = false;
    gorjal.chapterFourState = "walking";
    gorjal.x = troop.x + 50;
    gorjal.nextSpecialAt = Infinity;
    const initialHp = troop.hp;

    stepBattle(session, 1);
    expect(gorjal.chapterFourState).toBe("attack");
    expect(gorjal.gorjalAttackTargetId).toBe(troop.id);
    expect(gorjal.x).toBe(troop.x + ENEMIES.gorjal.meleeContactDistancePx);
    stepBattle(session, 389);
    expect(troop.hp).toBe(initialHp);

    stepBattle(session, 1);
    expect(getEnemyAnimation(gorjal, ENEMIES.gorjal, session.elapsed, { attack: 8 }))
      .toEqual({ state: "attack", frame: 4 });
    expect(troop.hp).toBe(initialHp - ENEMIES.gorjal.damage);
    expect(troop.electricConductivityUntil).toBeGreaterThan(session.elapsed);

    stepBattle(session, 200);
    expect(troop.hp).toBe(initialHp - ENEMIES.gorjal.damage);
    stepBattle(session, 170);
    expect(gorjal.chapterFourState).toBe("idle");
    expect(gorjal.gorjalAttackTargetId).toBeNull();
  });

  it("usa 800/700 ms na preparação da carga e reproduz stunned em loop independente", () => {
    const normalSession = createBattleSession(PHASES[24], ["colono"], 44, { sandbox: true });
    const normalTroop = placeTroop(normalSession, "colono", 1, 4).troop;
    const normal = spawnEnemy(normalSession, { type: "gorjal", row: 1 }).enemies[0];
    normal.gorjalInitialCharge = false;
    normal.chapterFourState = "walking";
    normal.x = normalTroop.x + 200;
    normal.nextSpecialAt = 0;
    stepBattle(normalSession, 1);
    expect(normal.chapterFourState).toBe("chargePrep");
    expect(normal.chapterFourStateEndsAt - normal.chapterFourStateStartedAt).toBe(800);

    const alphaSession = createBattleSession(PHASES[24], ["colono"], 45, { sandbox: true });
    const alphaTroop = placeTroop(alphaSession, "colono", 1, 4).troop;
    const alpha = spawnEnemy(alphaSession, { type: "gorjal", row: 1, variant: "alpha" }).enemies[0];
    alpha.gorjalInitialCharge = false;
    alpha.chapterFourState = "walking";
    alpha.x = alphaTroop.x + 200;
    alpha.nextSpecialAt = 0;
    stepBattle(alphaSession, 1);
    expect(alpha.chapterFourStateEndsAt - alpha.chapterFourStateStartedAt).toBe(700);

    stunEnemy(normalSession, normal, 1000);
    expect(getEnemyAnimation(normal, ENEMIES.gorjal, normalSession.elapsed, { stunned: 8 }))
      .toEqual({ state: "stunned", frame: 0 });
    expect(getEnemyAnimation(normal, ENEMIES.gorjal, normalSession.elapsed + 840, { stunned: 8 }))
      .toEqual({ state: "stunned", frame: 0 });
  });

  it("nasce em investida inicial sem depender de alcance ou recarga", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 48, { sandbox: true });
    const gorjal = spawnEnemy(session, { type: "gorjal", row: 2 }).enemies[0];
    expect(gorjal.chapterFourState).toBe("charge");
    expect(gorjal.gorjalInitialCharge).toBe(true);
    expect(gorjal.gorjalInitialChargeCompleted).toBe(false);
    expect(gorjal.nextSpecialAt).toBe(Infinity);
    expect(stepBattle(session, 1)).toContainEqual(expect.objectContaining({
      type: "gorjalInitialChargeStarted",
      sourceEnemyId: gorjal.id,
    }));
  });

  it("atinge a primeira tropa encontrada durante a corrida inicial", () => {
    const session = createBattleSession(PHASES[24], ["colono"], 49, { sandbox: true });
    const troop = placeTroop(session, "colono", 2, 4).troop;
    const gorjal = spawnEnemy(session, { type: "gorjal", row: 2 }).enemies[0];
    const events = stepBattle(session, 5000);
    expect(events).toContainEqual(expect.objectContaining({
      type: "gorjalChargeImpact",
      sourceEnemyId: gorjal.id,
      targetTroopId: troop.id,
      initialCharge: true,
    }));
    expect(gorjal.gorjalInitialCharge).toBe(false);
    expect(gorjal.gorjalInitialChargeCompleted).toBe(true);
  });
});
