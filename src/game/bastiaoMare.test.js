import { describe, expect, it, vi } from "vitest";
import {
  applyBastiaoOverload,
  calculateBastiaoOverloadDamage,
  getBastiaoFloodedDamageFactor,
  pruneBastiaoEnergyWindow,
  recordBastiaoDamage,
  selectBastiaoOverloadTargets,
  selectBastiaoTarget,
  updateBastiaoMare,
} from "./bastiaoMare.js";
import { pushEventParticles } from "./projectileRenderer.js";

const config = {
  id: "bastiaoMare",
  damage: 3,
  range: 0.9,
  attackEveryMs: 1800,
  attackVisual: { durationMs: 720, impactMs: 360 },
  floodedDamageTakenFactor: 0.85,
  energyDamageThreshold: 18,
  floodedEnergyDamageThreshold: 14,
  energyPickupAmount: 1,
  energyPickupLimit: 5,
  energyPickupWindowMs: 10000,
  energyPickupOffset: { x: 6, y: -68 },
  overloadDamage: 5,
  overloadRadiusTiles: 1.25,
  overloadMaxTargets: 6,
  overloadBossDamageFactor: 0.5,
  overloadColor: "#22d3ee",
  overloadCoreColor: "#ecfeff",
  overloadDurationMs: 420,
  color: "#22d3ee",
};

function troop(overrides = {}) {
  return {
    id: "b1", type: "bastiaoMare", row: 1, col: 4, x: 360, y: 180,
    dead: false, energyChargeProgress: 0, energyPickupSpawnTimes: [],
    state: "idle", stateStartedAt: 0, stateEndsAt: Infinity,
    attackReadyAt: 0, attackReleased: false, attackReleaseAt: Infinity,
    ...overrides,
  };
}

function enemy(id, x, y = 180, overrides = {}) {
  return { id, type: "mordelume", row: 1, x, y, hp: 20, maxHp: 20, dead: false, ...overrides };
}

const overloadDependencies = (overrides = {}) => ({
  cellWidth: 80,
  cellHeight: 120,
  isEnemyTargetable: (target) => !target.dead && target.hp > 0,
  isEnemySubmerged: (target) => Boolean(target.submerged),
  configForEnemy: (target) => ({ boss: target.type === "leviathanNereida" }),
  nextEffectSeed: () => 77,
  ...overrides,
});

describe("Bastião de Maré", () => {
  it("aplica 15% de redução quando alagado", () => {
    expect(getBastiaoFloodedDamageFactor(config, false)).toBe(1);
    expect(getBastiaoFloodedDamageFactor(config, true)).toBe(0.85);
  });

  it("gera uma bola e uma sobrecarga a cada 18 de dano seco", () => {
    const unit = troop();
    const spawn = vi.fn();
    const damageEnemy = vi.fn();
    const target = enemy("e1", 400);
    const events = [];
    const session = { elapsed: 1000, enemies: [target] };
    const dependencies = overloadDependencies({
      config,
      flooded: false,
      spawnEnergyPickup: spawn,
      damageEnemy,
      enemies: session.enemies,
    });
    expect(recordBastiaoDamage(session, unit, 17, events, dependencies)).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
    expect(damageEnemy).not.toHaveBeenCalled();
    expect(recordBastiaoDamage(session, unit, 1, events, dependencies)).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(damageEnemy).toHaveBeenCalledWith(target, 5, expect.objectContaining({
      direct: false, area: true, electric: true, passive: true,
    }));
    expect(events.filter((event) => event.type === "bastiaoOverload")).toHaveLength(1);
  });

  it("gera uma bola a cada 14 de dano na água", () => {
    const unit = troop();
    const spawn = vi.fn();
    const events = [];
    expect(recordBastiaoDamage({ elapsed: 0, enemies: [] }, unit, 14, events, {
      ...overloadDependencies(), config, flooded: true, spawnEnergyPickup: spawn,
    })).toBe(1);
    expect(spawn.mock.calls[0][1]).toMatchObject({ amount: 1, sourceTroopId: "b1" });
    expect(events.some((event) => event.type === "bastiaoOverload")).toBe(true);
  });

  it("preserva progresso proporcional ao mudar de terreno", () => {
    const unit = troop();
    const spawn = vi.fn();
    const dependencies = { ...overloadDependencies(), config, spawnEnergyPickup: spawn };
    recordBastiaoDamage({ elapsed: 0, enemies: [] }, unit, 9, [], { ...dependencies, flooded: false });
    expect(unit.energyChargeProgress).toBeCloseTo(0.5);
    recordBastiaoDamage({ elapsed: 1, enemies: [] }, unit, 7, [], { ...dependencies, flooded: true });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(unit.energyChargeProgress).toBeCloseTo(0);
  });

  it("limita bolas e sobrecargas a cinco em dez segundos", () => {
    const unit = troop();
    const spawn = vi.fn();
    const damageEnemy = vi.fn();
    const events = [];
    const dependencies = {
      ...overloadDependencies(), config, flooded: false,
      spawnEnergyPickup: spawn, damageEnemy,
    };
    expect(recordBastiaoDamage({ elapsed: 5000, enemies: [] }, unit, 180, events, dependencies)).toBe(5);
    expect(spawn).toHaveBeenCalledTimes(5);
    expect(events.filter((event) => event.type === "bastiaoOverload")).toHaveLength(5);
    expect(unit.energyChargeProgress).toBeLessThan(1);
    expect(recordBastiaoDamage({ elapsed: 6000, enemies: [] }, unit, 18, events, dependencies)).toBe(0);
    pruneBastiaoEnergyWindow(unit, 15001, 10000);
    expect(unit.energyPickupSpawnTimes).toHaveLength(0);
  });

  it("recalcula os alvos entre sobrecargas do mesmo impacto", () => {
    const unit = troop();
    const first = enemy("first", 390, 180, { hp: 5 });
    const second = enemy("second", 420, 180, { hp: 20 });
    const session = { elapsed: 0, enemies: [first, second] };
    const events = [];
    const damageEnemy = vi.fn((target, damage) => {
      target.hp -= damage;
      if (target.hp <= 0) target.dead = true;
    });
    recordBastiaoDamage(session, unit, 36, events, {
      ...overloadDependencies(), config, flooded: false,
      enemies: session.enemies,
      spawnEnergyPickup: vi.fn(),
      damageEnemy,
    });
    const overloads = events.filter((event) => event.type === "bastiaoOverload");
    expect(overloads).toHaveLength(2);
    expect(overloads[0].targets.map((target) => target.id)).toContain("first");
    expect(overloads[1].targets.map((target) => target.id)).not.toContain("first");
    expect(overloads[1].delayMs).toBe(70);
  });

  it("seleciona até seis inimigos por distância normalizada e ignora submersos", () => {
    const unit = troop();
    const candidates = [
      enemy("a", 400),
      enemy("b", 420),
      enemy("c", 360, 280, { row: 2 }),
      enemy("d", 430),
      enemy("e", 440),
      enemy("f", 450),
      enemy("g", 455),
      enemy("submerged", 380, 180, { submerged: true }),
      enemy("outside", 480, 360, { row: 3 }),
    ];
    const targets = selectBastiaoOverloadTargets(
      { enemies: candidates }, unit, config,
      overloadDependencies({ enemies: candidates }),
    );
    expect(targets).toHaveLength(6);
    expect(targets.map((target) => target.id)).not.toContain("submerged");
    expect(targets.map((target) => target.id)).not.toContain("outside");
  });

  it("causa metade do dano em chefes e alphas", () => {
    expect(calculateBastiaoOverloadDamage(enemy("common", 400), config, overloadDependencies())).toBe(5);
    expect(calculateBastiaoOverloadDamage(
      enemy("boss", 400, 180, { type: "leviathanNereida" }), config, overloadDependencies(),
    )).toBe(2.5);
    expect(calculateBastiaoOverloadDamage(
      enemy("alpha", 400, 180, { variant: "alpha" }), config, overloadDependencies(),
    )).toBe(2.5);
  });

  it("emite o efeito mesmo quando não há inimigos no raio", () => {
    const unit = troop();
    const events = [];
    expect(applyBastiaoOverload(
      { elapsed: 0, enemies: [] }, unit, config, events,
      overloadDependencies({ enemies: [] }),
    )).toBe(0);
    expect(events[0]).toMatchObject({
      type: "bastiaoOverload", sourceTroopId: "b1", targets: [], radiusTiles: 1.25,
    });
  });

  it("o renderer cria anel, clarão e arcos elétricos", () => {
    const particles = [];
    pushEventParticles(particles, [{
      type: "bastiaoOverload", x: 360, y: 142, centerX: 360, centerY: 180,
      radiusX: 100, radiusY: 150, durationMs: 420, delayMs: 0,
      color: "#22d3ee", coreColor: "#ecfeff", seed: 7,
      targets: [{ id: "e1", x: 420, y: 160, damage: 5 }],
    }], 1000, { quality: "high", reduceMotion: false, floatingDamage: false });
    expect(particles.some((particle) => particle.kind === "ring" && particle.essential)).toBe(true);
    expect(particles.some((particle) => particle.kind === "muzzle" && particle.essential)).toBe(true);
    expect(particles.filter((particle) => particle.kind === "voltaicArc").length).toBeGreaterThan(1);
  });

  it("seleciona o primeiro inimigo da rota para o golpe de escudo", () => {
    const unit = troop();
    const near = enemy("near", 390);
    const far = enemy("far", 420);
    const session = { enemies: [far, near] };
    expect(selectBastiaoTarget(session, unit, config, { cellWidth: 80 })).toBe(near);
  });

  it("aplica o golpe apenas no instante de impacto", () => {
    const unit = troop();
    const target = enemy("e1", 400);
    const damageEnemy = vi.fn();
    const dependencies = {
      cellWidth: 80,
      damageEnemy,
      damageMultiplier: () => 1,
      recoveryFor: (value) => value,
      nextEffectSeed: () => 2,
    };
    const session = { elapsed: 0, enemies: [target] };
    updateBastiaoMare(session, unit, config, [], dependencies);
    expect(unit.state).toBe("attack");
    expect(unit.lastAttackAt).toBe(0);
    session.elapsed = 359;
    updateBastiaoMare(session, unit, config, [], dependencies);
    expect(damageEnemy).not.toHaveBeenCalled();
    session.elapsed = 360;
    updateBastiaoMare(session, unit, config, [], dependencies);
    expect(damageEnemy).toHaveBeenCalledTimes(1);
    session.elapsed = 600;
    updateBastiaoMare(session, unit, config, [], dependencies);
    expect(damageEnemy).toHaveBeenCalledTimes(1);
  });
});
