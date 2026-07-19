import { describe, expect, it } from "vitest";
import { getUnlockedTroops, PHASES, TROOPS } from "./content.js";
import {
  CELL,
  FIELD,
  createBattleSession,
  findAdjacentLumiThreat,
  findRepulsorTarget,
  getLumiKnockbackFactor,
  placeTroop,
  spawnEnemy,
  stepBattle,
} from "./battleModel.js";
import { getMuzzleWorldPosition, getRepulsorKnockbackOffset, getTroopAnimation } from "./visualGeometry.js";

const phase = { ...PHASES[0], id: "teste_lumi_ursa7", waves: [] };

function createSession() {
  return createBattleSession(
    phase,
    ["lumiUrsa7", "marine", "muralhaReforcada"],
    707,
    { sandbox: true },
  );
}

function place(session, type, row, col) {
  const result = placeTroop(session, type, row, col);
  expect(result.ok).toBe(true);
  return result.troop;
}

function addEnemy(session, type, row, col, overrides = {}) {
  const result = spawnEnemy(session, { type, row, variant: overrides.variant });
  expect(result.ok).toBe(true);
  const enemy = result.enemies[0];
  enemy.x = col * CELL.width + CELL.width / 2;
  enemy.previousX = enemy.x;
  enemy.previousRenderX = enemy.x;
  enemy.speed = 0;
  enemy.damage = 0;
  enemy.attackReadyAt = Infinity;
  Object.assign(enemy, overrides);
  return enemy;
}

function advance(session, durationMs, stepMs = 32) {
  const events = [];
  let remaining = durationMs;
  while (remaining > 0) {
    const step = Math.min(stepMs, remaining);
    events.push(...stepBattle(session, step));
    remaining -= step;
  }
  return events;
}

describe("Lumi e URSA-7", () => {
  it("centraliza balanceamento, estados, desbloqueio e disponibilidade no sandbox", () => {
    expect(TROOPS.lumiUrsa7).toMatchObject({
      hp: 68,
      range: 2,
      damage: 7,
      attackEveryMs: 1900,
      projectileSpeed: 430,
      repulsorRangeTiles: 2,
      pushDistanceTiles: 1,
      pushVisualDurationMs: 300,
      stunChance: 0.1,
      stunMs: 2000,
      defenseDamageFactor: 0.5,
      transitionInMs: 720,
      shieldActivationMs: 520,
      defenseExitDelayMs: 350,
      transitionOutMs: 720,
      unlockAt: 11,
      assetStates: ["idle", "attack", "transitionIn", "defense", "transitionOut"],
    });
    expect(getUnlockedTroops(10).some((troop) => troop.id === "lumiUrsa7")).toBe(false);
    expect(getUnlockedTroops(11).some((troop) => troop.id === "lumiUrsa7")).toBe(true);
    expect(Object.keys(TROOPS)).toContain("lumiUrsa7");
  });

  it("alinha a origem do disparo ao núcleo luminoso do cano no frame de liberação", () => {
    const config = TROOPS.lumiUrsa7;
    const troop = { type: "lumiUrsa7", x: 300, y: 240, state: "attack", lastAttackAt: 0 };
    expect(config.idleVisual.height).toBe(164);
    expect(config.attackVisual.height).toBe(190);
    expect(config.defenseVisual.height).toBe(164);
    const muzzle = getMuzzleWorldPosition(troop, config, 0, 4);
    const scale = config.attackVisual.height / 128;
    expect(muzzle.x).toBeCloseTo(troop.x + (105.7 - 56) * scale, 0);
    expect(muzzle.y).toBeCloseTo(troop.y + CELL.height * 0.43 + (72.1 - 124) * scale, 0);
    expect(config.defenseShieldVisual).toMatchObject({
      offsetX: 2, offsetY: -4, radiusX: 67, radiusY: 61,
      transitionOut: { offsetY: -10, radiusY: 69 },
    });
  });

  it("seleciona somente inimigos terrestres à frente em até dois tiles", () => {
    const session = createSession();
    const lumi = place(session, "lumiUrsa7", 1, 1);
    const near = addEnemy(session, "medu", 1, 3);
    addEnemy(session, "medu", 1, 4);
    addEnemy(session, "medu", 2, 2);
    addEnemy(session, "refrator", 1, 2);
    expect(findRepulsorTarget(session, lumi)?.id).toBe(near.id);
    near.dead = true;
    expect(findRepulsorTarget(session, lumi)).toBeNull();
  });

  it("ativa defesa apenas para ameaça adjacente sem tropa protetora", () => {
    const session = createSession();
    const lumi = place(session, "lumiUrsa7", 1, 1);
    const threat = addEnemy(session, "medu", 1, 2);
    expect(findAdjacentLumiThreat(session, lumi)?.id).toBe(threat.id);
    place(session, "marine", 1, 2);
    expect(findAdjacentLumiThreat(session, lumi)).toBeNull();
  });

  it("completa entrada, mantém defesa e sai somente após o atraso e a transição", () => {
    const session = createSession();
    const lumi = place(session, "lumiUrsa7", 1, 1);
    addEnemy(session, "medu", 1, 2);

    advance(session, 1);
    expect(lumi.state).toBe("transitionIn");
    advance(session, 519);
    expect(lumi.defenseActive).toBe(false);
    advance(session, 1);
    expect(lumi.defenseActive).toBe(true);
    advance(session, 200);
    expect(lumi.state).toBe("defense");

    advance(session, 500);
    expect(lumi.state).toBe("defense");
    session.enemies = [];
    advance(session, 1);
    advance(session, 349);
    expect(lumi.state).toBe("defense");
    advance(session, 1);
    expect(lumi.state).toBe("transitionOut");
    expect(lumi.defenseActive).toBe(true);
    advance(session, 720);
    expect(lumi.state).toBe("idle");
    expect(lumi.defenseActive).toBe(false);
  });

  it("retorna diretamente à defesa quando a ameaça reaparece durante a saída", () => {
    const session = createSession();
    const lumi = place(session, "lumiUrsa7", 1, 1);
    addEnemy(session, "medu", 1, 2);
    advance(session, 1);
    advance(session, 720);
    session.enemies = [];
    advance(session, 1);
    advance(session, 350);
    expect(lumi.state).toBe("transitionOut");
    addEnemy(session, "medu", 1, 2);
    advance(session, 1);
    expect(lumi.state).toBe("defense");
    expect(lumi.defenseActive).toBe(true);
  });

  it("reduz pela metade qualquer dano recebido com a proteção ativa", () => {
    const session = createSession();
    const lumi = place(session, "lumiUrsa7", 1, 1);
    const attacker = addEnemy(session, "medu", 1, 1, {
      x: lumi.x + 40,
      previousRenderX: lumi.x + 40,
      damage: 10,
      attackReadyAt: 0,
    });
    lumi.state = "defense";
    lumi.defenseActive = true;
    const protectedHp = lumi.hp;
    const protectedEvents = advance(session, 1);
    expect(lumi.hp).toBe(protectedHp - 5);
    expect(protectedEvents.some((event) => event.type === "shieldHit")).toBe(true);

    attacker.attackReadyAt = 0;
    lumi.state = "idle";
    lumi.defenseActive = false;
    const normalHp = lumi.hp;
    advance(session, 1);
    expect(lumi.hp).toBe(normalHp - 10);
  });

  it("causa dano, empurra e aplica stun quando o sorteio fica abaixo de 10%", () => {
    const session = createSession();
    session.rng = () => 0.099;
    const lumi = place(session, "lumiUrsa7", 1, 1);
    place(session, "muralhaReforcada", 1, 2);
    const target = addEnemy(session, "medu", 1, 2);
    const hp = target.hp;
    const originalX = target.x;

    const events = advance(session, 1200, 20);
    const impact = events.find((event) => event.type === "repulsorImpact");
    expect(impact).toBeTruthy();
    expect(target.hp).toBe(hp - TROOPS.lumiUrsa7.damage);
    expect(target.x).toBe(Math.min(FIELD.spawnX, originalX + CELL.width));
    expect(target.knockbackVisualOffset).toBe(-CELL.width);
    expect(getRepulsorKnockbackOffset(target, target.knockbackVisualStartedAt)).toBe(-CELL.width);
    expect(getRepulsorKnockbackOffset(
      target,
      target.knockbackVisualStartedAt + TROOPS.lumiUrsa7.pushVisualDurationMs / 2,
    )).toBeCloseTo(-CELL.width / 8);
    expect(getRepulsorKnockbackOffset(target, target.knockbackVisualEndsAt)).toBe(0);
    expect(target.stunnedUntil).toBeGreaterThanOrEqual(session.elapsed);
    expect(impact.stunned).toBe(true);
  });

  it("não aplica stun em 10% e respeita resistência e imunidade de chefes", () => {
    const session = createSession();
    session.rng = () => 0.1;
    place(session, "lumiUrsa7", 1, 1);
    place(session, "muralhaReforcada", 1, 2);
    const target = addEnemy(session, "medu", 1, 2);
    const events = advance(session, 1200, 20);
    expect(events.find((event) => event.type === "repulsorImpact")?.stunned).toBe(false);
    expect(target.stunnedUntil).toBe(0);

    expect(getLumiKnockbackFactor({ type: "medu" })).toBe(1);
    expect(getLumiKnockbackFactor({ type: "krulax" })).toBe(0.75);
    expect(getLumiKnockbackFactor({ type: "obsidonte" })).toBe(0.35);
    expect(getLumiKnockbackFactor({ type: "krakhul" })).toBe(0.25);
    expect(getLumiKnockbackFactor({ type: "medu", variant: "alpha" })).toBe(0);
  });

  it("interrompe um soco não lançado, mas conserva o que já saiu da arma", () => {
    const beforeLaunch = createSession();
    const lumiBefore = place(beforeLaunch, "lumiUrsa7", 1, 1);
    place(beforeLaunch, "muralhaReforcada", 1, 2);
    addEnemy(beforeLaunch, "medu", 1, 3);
    advance(beforeLaunch, 1);
    expect(lumiBefore.state).toBe("attack");
    beforeLaunch.troops = beforeLaunch.troops.filter((troop) => troop.id === lumiBefore.id);
    addEnemy(beforeLaunch, "medu", 1, 2);
    advance(beforeLaunch, 1);
    expect(lumiBefore.state).toBe("transitionIn");
    expect(beforeLaunch.projectiles).toHaveLength(0);

    const afterLaunch = createSession();
    const lumiAfter = place(afterLaunch, "lumiUrsa7", 1, 1);
    place(afterLaunch, "muralhaReforcada", 1, 2);
    addEnemy(afterLaunch, "medu", 1, 3);
    advance(afterLaunch, 1);
    advance(afterLaunch, 320);
    const launched = afterLaunch.projectiles.find((projectile) => projectile.kind === "repulsorFist");
    expect(launched?.launched).toBe(true);
    afterLaunch.troops = afterLaunch.troops.filter((troop) => troop.id === lumiAfter.id);
    addEnemy(afterLaunch, "medu", 1, 2);
    advance(afterLaunch, 1);
    expect(lumiAfter.state).toBe("transitionIn");
    expect(afterLaunch.projectiles.some((projectile) => projectile.id === launched.id)).toBe(true);
  });

  it("mapeia os cinco estados lógicos para os oito frames correspondentes", () => {
    const config = TROOPS.lumiUrsa7;
    const counts = { idle: 8, attack: 8, transitionIn: 8, defense: 8, transitionOut: 8 };
    const troop = {
      type: "lumiUrsa7",
      stateStartedAt: 100,
      lastAttackAt: -Infinity,
    };
    expect(getTroopAnimation({ ...troop, state: "transitionIn" }, config, 460, counts))
      .toEqual({ state: "transitionIn", frame: 4 });
    expect(getTroopAnimation({ ...troop, state: "defense" }, config, 1300, counts))
      .toEqual({ state: "defense", frame: 0 });
    expect(getTroopAnimation({ ...troop, state: "transitionOut" }, config, 820, counts))
      .toEqual({ state: "transitionOut", frame: 7 });
  });
});
