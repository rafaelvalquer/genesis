import { describe, expect, it } from "vitest";
import {
  calculateVoltaicDamage,
  selectVoltaicChainTargets,
  selectVoltaicPrimaryTarget,
  updateFuzileiroVoltaico,
} from "./fuzileiroVoltaico.js";

const config = {
  range: 5.5,
  damage: 100,
  attackEveryMs: 1800,
  chainRadiusTiles: 1.35,
  chainMaxTargets: 3,
  primaryWaterDamageFactor: 1.2,
  secondaryDamageFactor: 0.2,
  secondaryWaterDamageFactor: 0.4,
  color: "#22d3ee",
  attackVisual: {
    durationMs: 420,
    releaseMs: 210,
    shots: [{ atMs: 210, frame: 4 }],
  },
};

const enemy = (id, row, x, overrides = {}) => ({
  id,
  type: "mordelume",
  row,
  x,
  y: row * 120 + 60,
  hp: 100,
  maxHp: 100,
  dead: false,
  ...overrides,
});

const troop = () => ({
  id: "voltaic_1",
  type: "fuzileiroVoltaico",
  row: 2,
  col: 3,
  x: 350,
  y: 300,
  state: "idle",
  stateStartedAt: 0,
  stateEndsAt: Infinity,
  attackReadyAt: 0,
  attackReleased: false,
  attackReleaseAt: Infinity,
  attackTargetId: null,
  lastAttackAt: -Infinity,
});

describe("Fuzileiro Voltaico — fórmulas", () => {
  it("aplica 100%/120% no principal e 20%/40% nos secundários", () => {
    expect(calculateVoltaicDamage(100, false, config, true)).toBe(100);
    expect(calculateVoltaicDamage(100, true, config, true)).toBe(120);
    expect(calculateVoltaicDamage(100, false, config, false)).toBe(20);
    expect(calculateVoltaicDamage(100, true, config, false)).toBe(40);
  });

  it("não multiplica o bônus aquático do principal nos secundários", () => {
    expect(calculateVoltaicDamage(100, true, config, false)).toBe(40);
    expect(calculateVoltaicDamage(120, true, config, false)).toBe(48);
  });
});

describe("Fuzileiro Voltaico — seleção de alvos", () => {
  it("sempre escolhe o primeiro inimigo válido à frente na rota", () => {
    const source = troop();
    const session = {
      enemies: [
        enemy("far", 2, 770),
        enemy("behind", 2, 300),
        enemy("near", 2, 520),
        enemy("other-row", 1, 430),
      ],
    };
    expect(selectVoltaicPrimaryTarget(session, source, config)?.id).toBe("near");
  });

  it("ignora a Enguia Rasgamar completamente submersa", () => {
    const source = troop();
    const session = {
      enemies: [
        enemy("eel", 2, 450, {
          type: "enguiaRasgamar",
          rasgamarSubmerged: true,
          rasgamarState: "submergedPatrol",
        }),
        enemy("valid", 2, 520),
      ],
    };
    expect(selectVoltaicPrimaryTarget(session, source, config)?.id).toBe("valid");
  });

  it("seleciona no máximo três secundários próximos, sem repetir o principal", () => {
    const primary = enemy("primary", 2, 700);
    const session = {
      enemies: [
        primary,
        enemy("same-a", 2, 720),
        enemy("same-b", 2, 760),
        enemy("adjacent", 1, 710),
        enemy("fourth", 3, 720),
        enemy("far", 2, 960),
        enemy("two-rows", 0, 705),
      ],
    };
    const selected = selectVoltaicChainTargets(session, primary, config);
    expect(selected).toHaveLength(3);
    expect(selected.map((entry) => entry.id)).not.toContain("primary");
    expect(selected.map((entry) => entry.id)).not.toContain("far");
    expect(selected.map((entry) => entry.id)).not.toContain("two-rows");
  });
});

describe("Fuzileiro Voltaico — ciclo de ataque", () => {
  it("retargeta na liberação e produz somente uma descarga", () => {
    const source = troop();
    const first = enemy("first", 2, 500);
    const replacement = enemy("replacement", 2, 560);
    const adjacent = enemy("adjacent", 2, 600);
    const session = {
      elapsed: 0,
      waveActive: true,
      sandbox: false,
      outcome: null,
      phase: null,
      tideCycle: null,
      enemies: [first, replacement, adjacent],
    };
    const events = [];
    const hits = [];
    let seed = 10;
    const dependencies = {
      occupiesTargetRow: (target, row) => target.row === row,
      damageMultiplier: () => 1,
      damageEnemy: (target, amount, context) => hits.push({ target: target.id, amount, context }),
      getMuzzlePosition: () => ({ x: 390, y: 260 }),
      getTargetPoint: (target) => ({ x: target.x, y: target.y }),
      nextEffectSeed: () => seed++,
      recoveryFor: (milliseconds) => milliseconds,
    };

    updateFuzileiroVoltaico(session, source, config, events, dependencies);
    expect(source).toMatchObject({ state: "attack", attackTargetId: "first", attackReleased: false });
    expect(source.attackReadyAt).toBe(Infinity);
    expect(hits).toHaveLength(0);

    first.dead = true;
    first.hp = 0;
    session.elapsed = 210;
    updateFuzileiroVoltaico(session, source, config, events, dependencies);

    expect(source.attackTargetId).toBe("replacement");
    expect(source.attackReleased).toBe(true);
    expect(source.attackReadyAt).toBe(2010);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "voltaicDischarge",
      primaryTargetId: "replacement",
      sourceTroopId: source.id,
    });
    expect(events[0].chains.map((entry) => entry.targetId)).toEqual(["adjacent"]);
    const primaryHit = hits.find((entry) => entry.target === "replacement");
    const secondaryHit = hits.find((entry) => entry.target === "adjacent");
    expect(primaryHit).toMatchObject({ amount: 100, context: { direct: true, ranged: true } });
    expect(secondaryHit).toMatchObject({ amount: 20, context: { direct: false, ranged: true } });
    expect(hits).toHaveLength(2);

    session.elapsed = 300;
    updateFuzileiroVoltaico(session, source, config, events, dependencies);
    expect(events).toHaveLength(1);
  });
});
