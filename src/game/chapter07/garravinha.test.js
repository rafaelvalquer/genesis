import { describe, expect, it } from "vitest";
import { CHAPTER_SEVEN_ENEMIES } from "../chapterSevenEnemies.js";
import { CELL, getEnemyAnimation } from "../visualGeometry.js";
import { garravinhaBehavior } from "../enemies/chapter07/garravinha.js";
import { enemiesForRow, enemyOccupiesTargetRow } from "../battle/queries.js";
import { getEnemyBehavior } from "../enemies/enemyRegistry.js";
import { getConvoyAttackSummary } from "./convoySummary.js";
import { canReserveConvoyGrapple, commitConvoyGrapple, isConvoyGrappled, releaseConvoyGrapple, reserveConvoyGrapple } from "./convoyGrapple.js";

const config = CHAPTER_SEVEN_ENEMIES.garravinha;
function makeSession(overrides = {}) {
  return {
    elapsed: 0,
    phase: { convoy: { lateralAttackRangeTiles: 1 } },
    convoy: { x: 900, y: 160, row: 2, hp: 1000, maxHp: 1000, invulnerable: false, attackerIds: [], underAttack: false },
    troops: [], chapterSevenMetrics: {}, ...overrides,
  };
}
function makeEnemy(session, id = "g-1", overrides = {}) {
  return {
    id, type: "garravinha", row: 1, x: 900 + CELL.width, y: 1 * CELL.height + CELL.height / 2,
    hp: 72, maxHp: 72, speed: 36, damage: 6, moving: true, dead: false, attackReadyAt: 0,
    spawnedAt: session.elapsed, previousRenderX: 900 + CELL.width, previousRenderY: 0,
    ...garravinhaBehavior.createState(session, {}, config), ...overrides,
  };
}
function runtimeFor(session, events) {
  return {
    session, get elapsed() { return session.elapsed; }, configFor: () => config,
    troops: () => session.troops, closestTroop: (enemy) => session.troops.filter((t) => !t.dead).sort((a, b) => Math.abs(enemy.x - a.x) - Math.abs(enemy.x - b.x))[0],
    troopBlockDistance: () => CELL.width * .62, hasBlockingTroop: (enemy) => session.troops.some((t) => !t.dead && t.row === enemy.row && t.x < enemy.x && enemy.x - t.x <= CELL.width * .62),
    canEnemyReachConvoy: (enemy, cfg) => Math.abs(enemy.x - session.convoy.x) <= cfg.convoyAttackRangeTiles * CELL.width && [1, 3].includes(enemy.row),
    moveEnemy: (enemy, dt) => { enemy.x -= enemy.speed * dt / 1000; }, damageTroop: (troop, amount) => { troop.hp -= amount; }, stunTroop: (troop, ms) => { troop.stunnedUntil = session.elapsed + ms; },
    damageConvoy: (amount) => { session.convoy.hp = Math.max(0, session.convoy.hp - amount); session.convoy.underAttack = true; return amount; }, convoyX: () => session.convoy.x, events,
  };
}

describe("Garravinha antitransporte", () => {
  it("avança os oito frames de walking na cadência configurada", () => {
    const enemy = { type: "garravinha", garravinhaState: "walking", garravinhaStateStartedAt: 0, garravinhaStateEndsAt: Infinity };
    const frames = { idle: 8, walking: 8 };
    expect([0, 105, 210, 315, 420, 525, 630, 735, 840].map((elapsed) => getEnemyAnimation(enemy, config, elapsed, frames).frame))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
  });
  it("preserva o relógio de walking durante atualizações consecutivas", () => {
    const session = makeSession(); const events = []; const enemy = makeEnemy(session, "g-walking", { x: 1200 }); const runtime = runtimeFor(session, events);
    const startedAt = enemy.garravinhaStateStartedAt;
    session.elapsed = 105; garravinhaBehavior.update(runtime, enemy, config, 16, events);
    session.elapsed = 210; garravinhaBehavior.update(runtime, enemy, config, 16, events);
    expect(enemy.garravinhaState).toBe("walking");
    expect(enemy.garravinhaStateStartedAt).toBe(startedAt);
    expect(getEnemyAnimation(enemy, config, session.elapsed, { idle: 8, walking: 8 })).toEqual({ state: "walking", frame: 2 });
  });
  it("expõe a configuração e o behavior dedicado", () => {
    expect(config).toMatchObject({ hp: 72, speed: 36, threat: 38, convoyAttackRangeTiles: 1.2 });
    expect(config.latch).toMatchObject({ prepMs: 420, leapMs: 480, initialDamage: 8, tickDamage: 14, tickEveryMs: 1000 });
    expect(config.assetStates).toEqual(["idle", "walking", "attack", "latchPrep", "latchLeap", "latched", "death"]);
    expect(getEnemyBehavior("garravinha")).toBe(garravinhaBehavior);
  });
  it("prioriza comboio e ignora tropa não bloqueadora", () => {
    const session = makeSession({ troops: [{ id: "far", row: 1, x: 700, hp: 20, dead: false }] }); const events = []; const enemy = makeEnemy(session); const runtime = runtimeFor(session, events);
    garravinhaBehavior.update(runtime, enemy, config, 16, events);
    expect(enemy.garravinhaState).toBe("latchPrep"); expect(events[0].type).toBe("garravinhaLatchPrep");
  });
  it("ataca somente a tropa que bloqueia o acesso", () => {
    const session = makeSession({ troops: [{ id: "blocker", row: 1, x: 900, hp: 20, dead: false }] }); const enemy = makeEnemy(session, "g-1", { x: 960 }); const events = []; const runtime = runtimeFor(session, events);
    garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(enemy.garravinhaState).toBe("attack");
    session.elapsed = 400; garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(session.troops[0].hp).toBe(14);
  });
  it("reserva uma única vaga e mantém a reserva durante latchPrep", () => {
    const session = makeSession(); expect(canReserveConvoyGrapple(session, "a")).toBe(true); expect(reserveConvoyGrapple(session, "a")).toBe(true); expect(canReserveConvoyGrapple(session, "b")).toBe(false); expect(canReserveConvoyGrapple(session, "a")).toBe(true);
  });
  it("cumpre prep de 420ms, inicia salto de 480ms e termina no comboio", () => {
    const session = makeSession(); const events = []; const enemy = makeEnemy(session); const runtime = runtimeFor(session, events);
    garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 419; garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(enemy.garravinhaState).toBe("latchPrep");
    session.elapsed = 420; garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(enemy.garravinhaState).toBe("latchLeap");
    session.elapsed = 900; garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(enemy.garravinhaState).toBe("latched"); expect(enemy.x).toBe(908); expect(enemy.y).toBe(session.convoy.y - 38);
    expect(session.convoy.hp).toBe(992); expect(events.map((e) => e.type)).toContain("garravinhaLatched");
    expect(enemy.row).toBe(1); expect(enemy.targetableRows).toEqual([1, 3]);
    expect(events.at(-1).targetableRows).toEqual([1, 3]);
  });
  it("fica alvo somente das rotas R2 e R4 depois de agarrar, sem ocupar a rota do transporte", () => {
    const session = makeSession(); const events = []; const enemy = makeEnemy(session); const runtime = runtimeFor(session, events); session.enemies = [enemy];
    expect(enemiesForRow(session, 1)).toContain(enemy); expect(enemiesForRow(session, 3)).not.toContain(enemy);
    garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 420; garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 900; garravinhaBehavior.update(runtime, enemy, config, 16, events);
    expect(enemy.row).toBe(1); expect(enemy.targetableRows).toEqual([1, 3]);
    expect([1, 3].map((row) => enemiesForRow(session, row))).toEqual([[enemy], [enemy]]);
    expect([0, 2, 4].every((row) => !enemyOccupiesTargetRow(enemy, row))).toBe(true);
  });
  it("expõe as mesmas rotas de alvo quando veio da R4", () => {
    const session = makeSession(); const events = []; const enemy = makeEnemy(session, "g-r4", { row: 3, y: 3 * CELL.height + CELL.height / 2 }); const runtime = runtimeFor(session, events); session.enemies = [enemy];
    garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 420; garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 900; garravinhaBehavior.update(runtime, enemy, config, 16, events);
    expect(enemy.row).toBe(3); expect(enemy.targetableRows).toEqual([1, 3]);
    expect(enemiesForRow(session, 1)).toContain(enemy); expect(enemiesForRow(session, 3)).toContain(enemy);
  });
  it("stun cancela prep, libera reservation e aplica cooldown", () => {
    const session = makeSession(); const events = []; const enemy = makeEnemy(session); const runtime = runtimeFor(session, events); garravinhaBehavior.update(runtime, enemy, config, 16, events); enemy.stunnedUntil = 100; session.elapsed = 10; garravinhaBehavior.update(runtime, enemy, config, 16, events);
    expect(enemy.garravinhaState).toBe("walking"); expect(enemy.targetableRows).toBeNull(); expect(session.convoy.grappleReservationEnemyId).toBeNull(); expect(enemy.garravinhaReadyAt).toBe(2210); expect(events.at(-1).type).toBe("garravinhaLatchInterrupted");
  });
  it("aplica dano inicial e no máximo um tick por intervalo", () => {
    const session = makeSession(); const events = []; const enemy = makeEnemy(session); const runtime = runtimeFor(session, events); garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 420; garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 900; garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 1899; garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(session.convoy.hp).toBe(992); session.elapsed = 1900; garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(session.convoy.hp).toBe(978); expect(events.filter((e) => e.type === "garravinhaLatchTick")).toHaveLength(1);
  });
  it("stun latched pausa dano sem soltar e knockback não altera attachment", () => {
    const session = makeSession(); const events = []; const enemy = makeEnemy(session); const runtime = runtimeFor(session, events); garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 420; garravinhaBehavior.update(runtime, enemy, config, 16, events); session.elapsed = 900; garravinhaBehavior.update(runtime, enemy, config, 16, events); enemy.stunnedUntil = 2000; session.elapsed = 1900; garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(isConvoyGrappled(session)).toBe(true); expect(enemy.x).toBe(908); expect(session.convoy.hp).toBe(992); session.elapsed = 2100; garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(session.convoy.hp).toBe(978);
  });
  it("morte libera grapple ou reservation imediatamente", () => {
    const session = makeSession(); const events = []; const enemy = makeEnemy(session, "g-1", { garravinhaState: "latched", targetableRows: [1, 3] }); reserveConvoyGrapple(session, enemy.id); commitConvoyGrapple(session, enemy.id); enemy.dead = true; garravinhaBehavior.onDeath(runtimeFor(session, events), enemy, events); expect(session.convoy.grappledByEnemyId).toBeNull(); expect(session.convoy.grappleReservationEnemyId).toBeNull(); expect(enemy.targetableRows).toBeNull(); expect(events.at(-1).type).toBe("garravinhaReleased");
  });
  it("segunda Garravinha não empilha e pode usar sideAttack", () => {
    const session = makeSession(); reserveConvoyGrapple(session, "a"); commitConvoyGrapple(session, "a"); const events = []; const enemy = makeEnemy(session, "b"); const runtime = runtimeFor(session, events); garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(enemy.garravinhaState).toBe("sideAttack"); session.elapsed = 400; garravinhaBehavior.update(runtime, enemy, config, 16, events); expect(events.at(-1).type).toBe("garravinhaSideAttack");
  });
  it("slot liberado permite que a segunda Garravinha agarre", () => {
    const session = makeSession(); reserveConvoyGrapple(session, "a"); commitConvoyGrapple(session, "a"); releaseConvoyGrapple(session, "a"); const enemy = makeEnemy(session, "b"); const events = []; garravinhaBehavior.update(runtimeFor(session, events), enemy, config, 16, events); expect(enemy.garravinhaState).toBe("latchPrep");
  });
  it("UI dá precedência ao alerta de grapple", () => {
    expect(getConvoyAttackSummary({ underAttack: true, grappledByEnemyId: "g-1", damageState: "normal" }, 4)).toBe("⚠ CRIATURA PRESA AO TRANSPORTE · ELIMINE A GARRAVINHA");
  });
  it("possui 52 frames individuais e sheets nas dimensões corretas", () => {
    const frames = import.meta.glob("../assets/enemy/garravinha/{idle,walking,attack,latchPrep,latchLeap,latched,death}/frame*.png");
    expect(Object.keys(frames)).toHaveLength(52); expect(Object.keys(import.meta.glob("../assets/enemy/garravinha/latchPrep/frame*.png"))).toHaveLength(6); expect(Object.keys(import.meta.glob("../assets/enemy/garravinha/latchLeap/frame*.png"))).toHaveLength(6);
  });
});
