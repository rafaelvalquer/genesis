import { describe, expect, it } from "vitest";
import { isRasgamarSubmerged } from "../../enemyTargeting.js";
import {
  getRasgamarOccupiedRows,
  getRasgamarRelocationDuration,
  hasLivingTroopsForRasgamar,
  hasLivingTroopsInRasgamarRow,
  selectRasgamarRelocationRow,
} from "./enguiaRasgamarTactics.js";

const troop = (id, row, type = "marine", overrides = {}) => ({
  id,
  type,
  row,
  col: overrides.col ?? 4,
  hp: overrides.hp ?? 30,
  maxHp: overrides.maxHp ?? 30,
  energyCost: overrides.energyCost,
  supplyCost: overrides.supplyCost,
  dead: false,
  ...overrides,
});

const eel = (id, row, overrides = {}) => ({
  id,
  type: "enguiaRasgamar",
  row,
  hp: 60,
  maxHp: 60,
  dead: false,
  ...overrides,
});

describe("tática de mudança de rota da Enguia Rasgamar", () => {
  it("detecta tropas vivas no campo e na rota atual", () => {
    const session = { troops: [troop("t1", 2)], enemies: [] };
    expect(hasLivingTroopsForRasgamar(session)).toBe(true);
    expect(hasLivingTroopsInRasgamarRow(session, 2)).toBe(true);
    expect(hasLivingTroopsInRasgamarRow(session, 1)).toBe(false);
  });

  it("prioriza a rota sem Enguia que possui mais tropas", () => {
    const current = eel("eel_current", 0);
    const session = {
      troops: [
        troop("a1", 1),
        troop("a2", 1),
        troop("a3", 1),
        troop("b1", 3),
        troop("b2", 3),
      ],
      enemies: [current],
    };

    expect(selectRasgamarRelocationRow(session, current, [1, 2, 3, 4])).toBe(1);
  });

  it("evita uma rota já ocupada por outra Enguia quando existe alternativa", () => {
    const current = eel("eel_current", 0);
    const session = {
      troops: [
        troop("a1", 1), troop("a2", 1), troop("a3", 1), troop("a4", 1),
        troop("b1", 3), troop("b2", 3),
      ],
      enemies: [current, eel("eel_other", 1)],
    };

    expect(selectRasgamarRelocationRow(session, current, [1, 3])).toBe(3);
  });

  it("considera a rota reservada por uma Enguia em deslocamento", () => {
    const current = eel("eel_current", 0);
    const relocating = eel("eel_other", 4, { rasgamarTargetRow: 2 });
    const session = {
      troops: [troop("a1", 2), troop("a2", 2), troop("b1", 3)],
      enemies: [current, relocating],
    };

    expect(getRasgamarOccupiedRows(session, current.id)).toEqual(new Set([4, 2]));
    expect(selectRasgamarRelocationRow(session, current, [2, 3])).toBe(3);
  });

  it("quando todas as rotas têm Enguia, escolhe a rota com mais tropas", () => {
    const current = eel("eel_current", 0);
    const session = {
      troops: [
        troop("a1", 1), troop("a2", 1), troop("a3", 1),
        troop("b1", 3), troop("b2", 3),
      ],
      enemies: [current, eel("eel_1", 1), eel("eel_3", 3)],
    };

    expect(selectRasgamarRelocationRow(session, current, [1, 3])).toBe(1);
  });

  it("usa o valor estratégico como desempate", () => {
    const current = eel("eel_current", 0);
    const session = {
      troops: [
        troop("cheap", 1, "droneSentinela", { energyCost: 5, supplyCost: 1 }),
        troop("expensive", 3, "colossoImpacto", { energyCost: 40, supplyCost: 9 }),
      ],
      enemies: [current],
    };

    expect(selectRasgamarRelocationRow(session, current, [1, 3])).toBe(3);
  });

  it("retorna null quando não existe outra rota com tropas", () => {
    const current = eel("eel_current", 0);
    const session = { troops: [], enemies: [current] };
    expect(selectRasgamarRelocationRow(session, current, [1, 2, 3, 4])).toBeNull();
  });

  it("calcula o tempo de deslocamento pela distância entre rotas", () => {
    const config = { laneRelocationBaseMs: 450, laneRelocationPerRowMs: 220 };
    expect(getRasgamarRelocationDuration(config, 1, 2)).toBe(670);
    expect(getRasgamarRelocationDuration(config, 0, 4)).toBe(1330);
  });

  it("mantém a Enguia inalvejável durante a mudança de rota", () => {
    expect(isRasgamarSubmerged({
      type: "enguiaRasgamar",
      hp: 60,
      dead: false,
      rasgamarState: "laneRelocation",
      rasgamarSubmerged: true,
    })).toBe(true);
  });
});
