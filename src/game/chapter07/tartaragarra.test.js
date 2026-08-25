import { describe, expect, it } from "vitest";
import { CHAPTER_SEVEN_ENEMIES } from "../chapterSevenEnemies.js";
import { tartaragarraBehavior } from "../enemies/chapter07/tartaragarra.js";

const makeRuntime = (elapsed, enemy, troops = []) => {
  const session = { elapsed, troops, chapterSevenMetrics: {}, convoy: { x: 900, id: "convoy", hp: 1000, maxHp: 1000, attackerIds: [], underAttack: false } };
  const events = [];
  return {
    session, events,
    get elapsed() { return session.elapsed; },
    troops: () => session.troops,
    closestTroop: () => session.troops.filter((troop) => !troop.dead).sort((a, b) => b.x - a.x)[0] || null,
    troopBlockDistance: () => 20,
    moveEnemy: (target, dt) => { target.x -= target.speed * dt / 1000; },
    damageTroop: (troop, amount) => { troop.hp -= amount; },
    stunTroop: (troop, duration) => { troop.controlStunnedUntil = session.elapsed + duration; },
    damageConvoy: (amount, context) => { session.convoy.hp -= amount; session.convoy.underAttack = true; return amount; },
    canEnemyReachConvoy: () => false,
    hasBlockingTroop: () => false,
    convoyX: () => session.convoy.x,
    session,
    enemy,
  };
};

const enemy = (elapsed = 0) => ({
  id: "tartaragarra-1", type: "tartaragarra", row: 1, x: 500, y: 100, speed: 10, damage: 12,
  dead: false, moving: true, attackReadyAt: 0, tartaragarraState: "walking",
  tartaragarraStateStartedAt: elapsed, tartaragarraStateEndsAt: Infinity, chargeReadyAt: 0,
  tartaragarraMetrics: { charges: 0, chargeHits: 0, chargeMisses: 0, troopsStunned: 0, shellHits: 0, shellDamagePrevented: 0, convoyHeadbutts: 0, convoyDamage: 0 },
});

describe("Tartaragarra", () => {
  it("registra o tanque com casco, charge e cabeçada", () => {
    expect(CHAPTER_SEVEN_ENEMIES.tartaragarra).toMatchObject({ hp: 260, speed: 10, threat: 48, armorDamageFactor: 1 });
    expect(CHAPTER_SEVEN_ENEMIES.tartaragarra.charge).toMatchObject({ prepMs: 1000, damage: 28, stunMs: 900, cooldownMs: 8500 });
    expect(CHAPTER_SEVEN_ENEMIES.tartaragarra.convoyHeadbutt).toMatchObject({ damage: 22, attackEveryMs: 3400 });
    expect(CHAPTER_SEVEN_ENEMIES.tartaragarra.attackVisual).toEqual({ durationMs: 1200, impactMs: 700 });
  });

  it("mantém 52 frames finais e quatro frames na investida", () => {
    const frames = import.meta.glob("../assets/enemy/tartaragarra/*/frame*.png");
    const count = (state) => Object.keys(frames).filter((key) => key.includes(`/tartaragarra/${state}/`)).length;
    expect(count("idle")).toBe(8);
    expect(count("walking")).toBe(8);
    expect(count("chargePrep")).toBe(8);
    expect(count("charge")).toBe(4);
    expect(count("chargeRecover")).toBe(8);
    expect(count("attack")).toBe(8);
    expect(count("death")).toBe(8);
    expect(Object.keys(frames)).toHaveLength(52);
  });

  it("telegraphia, atinge uma tropa sem movê-la e entra em recuperação", () => {
    const target = { id: "troop", row: 1, x: 450, y: 100, hp: 100, dead: false };
    const e = enemy();
    let runtime = makeRuntime(0, e, [target]);
    tartaragarraBehavior.update(runtime, e, CHAPTER_SEVEN_ENEMIES.tartaragarra, 16, runtime.events);
    expect(e.tartaragarraState).toBe("chargePrep");
    runtime.session.elapsed = 999;
    tartaragarraBehavior.update(runtime, e, CHAPTER_SEVEN_ENEMIES.tartaragarra, 16, runtime.events);
    expect(e.tartaragarraState).toBe("chargePrep");
    runtime.session.elapsed = 1000;
    tartaragarraBehavior.update(runtime, e, CHAPTER_SEVEN_ENEMIES.tartaragarra, 100, runtime.events);
    expect(e.tartaragarraState).toBe("charge");
    runtime.session.elapsed = 1100;
    tartaragarraBehavior.update(runtime, e, CHAPTER_SEVEN_ENEMIES.tartaragarra, 1000, runtime.events);
    expect(target.x).toBe(450);
    expect(target.hp).toBe(72);
    expect(target.controlStunnedUntil).toBe(2000);
    expect(e.tartaragarraState).toBe("chargeRecover");
  });

  it("interrompe a preparação e aplica cooldown curto", () => {
    const e = enemy(); const target = { id: "troop", row: 1, x: 450, y: 100, hp: 100, dead: false };
    const runtime = makeRuntime(0, e, [target]);
    tartaragarraBehavior.update(runtime, e, CHAPTER_SEVEN_ENEMIES.tartaragarra, 16, runtime.events);
    e.stunnedUntil = 300;
    runtime.session.elapsed = 100;
    tartaragarraBehavior.update(runtime, e, CHAPTER_SEVEN_ENEMIES.tartaragarra, 16, runtime.events);
    expect(e.tartaragarraState).toBe("walking");
    expect(e.chargeReadyAt).toBe(3100);
    expect(runtime.events.some((event) => event.type === "tartaragarraChargeInterrupted")).toBe(true);
  });

  it("aplica o feedback do casco sem ignorar armor pierce", () => {
    const e = enemy(); const runtime = makeRuntime(400, e);
    const context = { ranged: true, armorPierceFactor: .5 };
    tartaragarraBehavior.receiveDamage(runtime, e, 100, runtime.events, context);
    expect(context.armorFactorOverride).toBe(.62);
    expect(e.shellHitUntil).toBe(600);
    expect(runtime.session.chapterSevenMetrics.tartaragarraShellHits).toBe(1);
  });
});
