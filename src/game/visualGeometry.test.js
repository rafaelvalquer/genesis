import { describe, expect, it } from "vitest";
import { TROOPS } from "./content.js";
import {
  getEnemyHitPoint,
  getMuzzleWorldPosition,
  getTroopAnimation,
  getTroopSpriteRect,
  getWallDamageFrame,
  isEnemyFrozen,
} from "./visualGeometry.js";

describe("geometria visual dos disparos", () => {
  const troop = { id: "marine_1", type: "marine", x: 150, y: 60, lastAttackAt: 32 };

  it("converte os tres canos do marine para a mesma geometria usada pelo sprite", () => {
    const rect = getTroopSpriteRect(troop, TROOPS.marine);
    expect(rect.x).toBeCloseTo(87);
    expect(rect.y).toBeCloseTo(-14.4);
    expect(rect.width).toBe(126);
    expect(rect.height).toBe(126);
    const expected = [[191.58, 70.02], [192.84, 71.28], [204.18, 72.54]];
    expected.forEach(([x, y], shot) => {
      const muzzle = getMuzzleWorldPosition(troop, TROOPS.marine, shot);
      expect(muzzle.x).toBeCloseTo(x);
      expect(muzzle.y).toBeCloseTo(y);
    });
  });

  it("mantem o frame do cano durante o passo fixo que libera cada tiro", () => {
    const counts = { idle: 20, attack: 47 };
    expect(getTroopAnimation(troop, TROOPS.marine, 32, counts)).toEqual({ state: "attack", frame: 8 });
    expect(getTroopAnimation(troop, TROOPS.marine, 160, counts)).toEqual({ state: "attack", frame: 23 });
    expect(getTroopAnimation(troop, TROOPS.marine, 288, counts)).toEqual({ state: "attack", frame: 38 });
  });

  it("ancora o destino visual no torso do inimigo", () => {
    const point = getEnemyHitPoint({ x: 500, y: 60, scale: 1 });
    expect(point.x).toBe(500);
    expect(point.y).toBeCloseTo(54);
  });

  it("mantem o estado visual congelado apenas durante a lentidao", () => {
    const enemy = { dead: false, slowUntil: 1800 };
    expect(isEnemyFrozen(enemy, 1799)).toBe(true);
    expect(isEnemyFrozen(enemy, 1800)).toBe(false);
    expect(isEnemyFrozen({ ...enemy, dead: true }, 1000)).toBe(false);
  });

  it("configura individualmente todas as tropas de ataque a distancia", () => {
    const ranged = ["marine", "caçador", "sniper", "krio", "ranger", "bombardeiro", "guarda"];
    for (const troopId of ranged) {
      expect(TROOPS[troopId].attackVisual?.shots[0]?.muzzle).toBeTruthy();
    }
    expect(TROOPS.bombardeiro.attackVisual.visualCount).toBe(3);
  });

  it.each([
    [100, 0],
    [80, 0],
    [79, 1],
    [30, 1],
    [29, 2],
    [1, 2],
    [0, 2],
  ])("seleciona o frame da muralha para %s%% de HP", (hp, frame) => {
    const wall = { type: "muralhaReforcada", hp, maxHp: 100, lastAttackAt: -Infinity };
    expect(getWallDamageFrame(wall)).toBe(frame);
    expect(getTroopAnimation(wall, TROOPS.muralhaReforcada, 9999, { defense: 3 })).toEqual({ state: "defense", frame });
  });
});
