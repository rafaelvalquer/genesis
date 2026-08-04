import { describe, expect, it, vi } from "vitest";
import {
  getBastiaoFloodedDamageFactor,
  pruneBastiaoEnergyWindow,
  recordBastiaoDamage,
  selectBastiaoTarget,
  updateBastiaoMare,
} from "./bastiaoMare.js";

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
  color: "#22d3ee",
};

function troop(overrides = {}) {
  return {
    id: "b1", type: "bastiaoMare", row: 0, col: 4, x: 360, y: 64,
    dead: false, energyChargeProgress: 0, energyPickupSpawnTimes: [],
    state: "idle", stateStartedAt: 0, stateEndsAt: Infinity,
    attackReadyAt: 0, attackReleased: false, attackReleaseAt: Infinity,
    ...overrides,
  };
}

describe("Bastião de Maré", () => {
  it("aplica 15% de redução quando alagado", () => {
    expect(getBastiaoFloodedDamageFactor(config, false)).toBe(1);
    expect(getBastiaoFloodedDamageFactor(config, true)).toBe(0.85);
  });

  it("gera uma bola a cada 18 de dano seco", () => {
    const unit = troop();
    const spawn = vi.fn();
    const session = { elapsed: 1000 };
    expect(recordBastiaoDamage(session, unit, 17, [], { config, flooded: false, spawnEnergyPickup: spawn })).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
    expect(recordBastiaoDamage(session, unit, 1, [], { config, flooded: false, spawnEnergyPickup: spawn })).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("gera uma bola a cada 14 de dano na água", () => {
    const unit = troop();
    const spawn = vi.fn();
    expect(recordBastiaoDamage({ elapsed: 0 }, unit, 14, [], { config, flooded: true, spawnEnergyPickup: spawn })).toBe(1);
    expect(spawn.mock.calls[0][1]).toMatchObject({ amount: 1, sourceTroopId: "b1" });
  });

  it("preserva progresso proporcional ao mudar de terreno", () => {
    const unit = troop();
    const spawn = vi.fn();
    recordBastiaoDamage({ elapsed: 0 }, unit, 9, [], { config, flooded: false, spawnEnergyPickup: spawn });
    expect(unit.energyChargeProgress).toBeCloseTo(0.5);
    recordBastiaoDamage({ elapsed: 1 }, unit, 7, [], { config, flooded: true, spawnEnergyPickup: spawn });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(unit.energyChargeProgress).toBeCloseTo(0);
  });

  it("limita a cinco bolas em dez segundos", () => {
    const unit = troop();
    const spawn = vi.fn();
    expect(recordBastiaoDamage({ elapsed: 5000 }, unit, 180, [], { config, flooded: false, spawnEnergyPickup: spawn })).toBe(5);
    expect(spawn).toHaveBeenCalledTimes(5);
    expect(unit.energyChargeProgress).toBeLessThan(1);
    expect(recordBastiaoDamage({ elapsed: 6000 }, unit, 18, [], { config, flooded: false, spawnEnergyPickup: spawn })).toBe(0);
    pruneBastiaoEnergyWindow(unit, 15001, 10000);
    expect(unit.energyPickupSpawnTimes).toHaveLength(0);
  });

  it("seleciona o primeiro inimigo da rota", () => {
    const unit = troop();
    const near = { id: "near", row: 0, x: 390, hp: 10, dead: false };
    const far = { id: "far", row: 0, x: 420, hp: 10, dead: false };
    const session = { enemies: [far, near] };
    expect(selectBastiaoTarget(session, unit, config, { cellWidth: 80 })).toBe(near);
  });

  it("aplica o golpe apenas no instante de impacto", () => {
    const unit = troop();
    const enemy = { id: "e1", row: 0, x: 400, y: 64, hp: 20, dead: false };
    const damageEnemy = vi.fn();
    const deps = {
      cellWidth: 80,
      damageEnemy,
      damageMultiplier: () => 1,
      recoveryFor: (value) => value,
      nextEffectSeed: () => 2,
    };
    const session = { elapsed: 0, enemies: [enemy] };
    updateBastiaoMare(session, unit, config, [], deps);
    expect(unit.state).toBe("attack");
    session.elapsed = 359;
    updateBastiaoMare(session, unit, config, [], deps);
    expect(damageEnemy).not.toHaveBeenCalled();
    session.elapsed = 360;
    updateBastiaoMare(session, unit, config, [], deps);
    expect(damageEnemy).toHaveBeenCalledTimes(1);
    session.elapsed = 600;
    updateBastiaoMare(session, unit, config, [], deps);
    expect(damageEnemy).toHaveBeenCalledTimes(1);
  });
});
