import { describe, expect, it } from "vitest";
import { ENEMIES, TROOPS } from "./content.js";
import {
  CELL,
  getEnemyHitPoint,
  getEnemyAnimation,
  getEnemyMuzzleWorldPosition,
  getAnchoredSpriteRect,
  getMuzzleWorldPosition,
  getTroopAnimation,
  getTroopFrameAnchor,
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

  it("sincroniza os oito frames do ranger e ancora o laser no cano novo", () => {
    const ranger = { type: "ranger", x: 500, y: 300, lastAttackAt: 100 };
    const counts = { idle: 8, attack: 8 };
    for (let frame = 0; frame < 8; frame += 1) {
      expect(getTroopAnimation(ranger, TROOPS.ranger, 100 + frame * 100, counts))
        .toEqual({ state: "attack", frame });
    }
    expect(getTroopAnimation(ranger, TROOPS.ranger, 900, counts))
      .toEqual({ state: "idle", frame: 0 });
    expect(getTroopAnimation(ranger, TROOPS.ranger, 1149, counts))
      .toEqual({ state: "idle", frame: 0 });
    expect(getTroopAnimation(ranger, TROOPS.ranger, 1150, counts))
      .toEqual({ state: "idle", frame: 1 });
    const muzzle = getMuzzleWorldPosition(ranger, TROOPS.ranger);
    expect(muzzle.x).toBeCloseTo(540.95, 1);
    expect(muzzle.y).toBeCloseTo(285.29, 1);
  });

  it("sincroniza o ciclo criogenico do krio e dispara no primeiro frame", () => {
    const krio = { type: "krio", x: 460, y: 260, lastAttackAt: 100 };
    const counts = { idle: 8, attack: 8 };
    for (let frame = 0; frame < 8; frame += 1) {
      expect(getTroopAnimation(krio, TROOPS.krio, 100 + frame * 80, counts))
        .toEqual({ state: "attack", frame });
    }
    expect(getTroopAnimation(krio, TROOPS.krio, 740, counts))
      .toEqual({ state: "idle", frame: 0 });
    expect(getTroopAnimation(krio, TROOPS.krio, 990, counts))
      .toEqual({ state: "idle", frame: 1 });

    const muzzle = getMuzzleWorldPosition(krio, TROOPS.krio);
    const anchor = TROOPS.krio.attackVisual.frameAnchors.attack[0];
    const rect = getAnchoredSpriteRect(krio, 126, 1, anchor);
    expect(TROOPS.krio.attackVisual.shots[0]).toMatchObject({ atMs: 0, frame: 0 });
    expect(muzzle.x).toBeCloseTo(rect.x + rect.width * 0.78, 5);
    expect(muzzle.y).toBeCloseTo(rect.y + rect.height * 0.51, 5);
  });

  it("sincroniza os oito frames e ancora o cano do novo bombardeiro", () => {
    const bombardeiro = { type: "bombardeiro", x: 420, y: 260, lastAttackAt: 100 };
    const counts = { idle: 8, attack: 8 };
    for (let frame = 0; frame < 8; frame += 1) {
      expect(getTroopAnimation(bombardeiro, TROOPS.bombardeiro, 100 + frame * 90, counts))
        .toEqual({ state: "attack", frame });
    }
    expect(getTroopAnimation(bombardeiro, TROOPS.bombardeiro, 820, counts))
      .toEqual({ state: "idle", frame: 0 });
    expect(getTroopAnimation(bombardeiro, TROOPS.bombardeiro, 1020, counts))
      .toEqual({ state: "idle", frame: 1 });

    const muzzle = getMuzzleWorldPosition(bombardeiro, TROOPS.bombardeiro);
    const anchor = TROOPS.bombardeiro.attackVisual.frameAnchors.attack[0];
    const rect = getAnchoredSpriteRect(bombardeiro, 126, 1, anchor);
    expect(muzzle.x).toBeCloseTo(rect.x + rect.width * 0.8, 5);
    expect(muzzle.y).toBeCloseTo(rect.y + rect.height * 0.595, 5);
  });

  it("mantem o ataque do incinerador em loop durante a canalizacao", () => {
    const incinerador = {
      type: "incinerador", x: 420, y: 260, lastAttackAt: 100,
      channelingAttack: true, attackStartedAt: 100,
    };
    const counts = { idle: 8, attack: 8 };
    for (let frame = 0; frame < 8; frame += 1) {
      expect(getTroopAnimation(incinerador, TROOPS.incinerador, 100 + frame * 80, counts))
        .toEqual({ state: "attack", frame });
    }
    expect(getTroopAnimation(incinerador, TROOPS.incinerador, 740, counts))
      .toEqual({ state: "attack", frame: 0 });
    expect(getTroopAnimation({ ...incinerador, channelingAttack: false }, TROOPS.incinerador, 740, counts))
      .toEqual({ state: "idle", frame: 0 });

    TROOPS.incinerador.attackVisual.frameMuzzles.forEach((frameMuzzle, frame) => {
      const muzzle = getMuzzleWorldPosition(incinerador, TROOPS.incinerador, 0, frame);
      const anchor = TROOPS.incinerador.attackVisual.frameAnchors.attack[frame];
      const rect = getAnchoredSpriteRect(incinerador, 126, 1, anchor);
      expect(muzzle.x).toBeCloseTo(rect.x + rect.width * frameMuzzle.x, 5);
      expect(muzzle.y).toBeCloseTo(rect.y + rect.height * frameMuzzle.y, 5);
    });

    const marineMuzzle = getMuzzleWorldPosition(incinerador, TROOPS.marine);
    const marineRect = getTroopSpriteRect(incinerador, TROOPS.marine);
    expect(marineMuzzle.x).toBeCloseTo(marineRect.x + marineRect.width * TROOPS.marine.attackVisual.shots[0].muzzle.x, 5);
  });

  it("sincroniza o recuo do cacador e ancora a escopeta no cano novo", () => {
    const cacador = { type: "caçador", x: 400, y: 240, lastAttackAt: 100 };
    const counts = { idle: 8, attack: 8 };
    [0, 56, 112, 168, 224, 280, 336, 392].forEach((age, frame) => {
      expect(getTroopAnimation(cacador, TROOPS["caçador"], 100 + age, counts))
        .toEqual({ state: "attack", frame });
    });
    expect(getTroopAnimation(cacador, TROOPS["caçador"], 520, counts))
      .toEqual({ state: "idle", frame: 0 });
    const muzzle = getMuzzleWorldPosition(cacador, TROOPS["caçador"]);
    expect(muzzle.x).toBeCloseTo(444.05, 1);
    expect(muzzle.y).toBeCloseTo(223.65, 1);
  });

  it("reproduz a timeline melee do colono sem tratar quadros como disparos", () => {
    const colono = { type: "colono", lastAttackAt: 100 };
    const counts = { idle: 8, attack: 4 };
    expect(getTroopAnimation(colono, TROOPS.colono, 100, counts)).toEqual({ state: "attack", frame: 0 });
    expect(getTroopAnimation(colono, TROOPS.colono, 196, counts)).toEqual({ state: "attack", frame: 1 });
    expect(getTroopAnimation(colono, TROOPS.colono, 292, counts)).toEqual({ state: "attack", frame: 2 });
    expect(getTroopAnimation(colono, TROOPS.colono, 388, counts)).toEqual({ state: "attack", frame: 3 });
    expect(TROOPS.colono.attackVisual.shots).toBeUndefined();
  });

  it.each([
    [0, 0],
    [174, 0],
    [175, 1],
    [349, 1],
    [350, 2],
    [524, 2],
    [525, 3],
    [699, 3],
    [700, 4],
    [874, 4],
    [875, 5],
    [1049, 5],
    [1050, 6],
    [1224, 6],
    [1225, 7],
    [1399, 7],
    [1400, 0],
  ])("usa no instante %sms o frame %s da respiracao natural", (elapsed, frame) => {
    const colono = { type: "colono", lastAttackAt: -Infinity };
    expect(getTroopAnimation(colono, TROOPS.colono, elapsed, { idle: 8, attack: 4 }))
      .toEqual({ state: "idle", frame });
  });

  it("reinicia o idle do colono no frame zero ao terminar a estocada", () => {
    const colono = { type: "colono", lastAttackAt: 100 };
    const counts = { idle: 8, attack: 4 };
    expect(getTroopAnimation(colono, TROOPS.colono, 519, counts)).toEqual({ state: "attack", frame: 3 });
    expect(getTroopAnimation(colono, TROOPS.colono, 520, counts)).toEqual({ state: "idle", frame: 0 });
    expect(getTroopAnimation(colono, TROOPS.colono, 880, counts)).toEqual({ state: "idle", frame: 2 });
  });

  it("preserva a cadencia de 85ms para tropas sem idleVisual", () => {
    const marine = { type: "marine", lastAttackAt: -Infinity };
    expect(getTroopAnimation(marine, TROOPS.marine, 84, { idle: 20 })).toEqual({ state: "idle", frame: 0 });
    expect(getTroopAnimation(marine, TROOPS.marine, 85, { idle: 20 })).toEqual({ state: "idle", frame: 1 });
  });

  it("completa o ciclo idle do reator a cada dois segundos", () => {
    const reator = { type: "reator", lastAttackAt: -Infinity };
    for (let frame = 0; frame < 8; frame += 1) {
      expect(getTroopAnimation(reator, TROOPS.reator, frame * 250, { idle: 8, attack: 8 }))
        .toEqual({ state: "idle", frame });
    }
    expect(getTroopAnimation(reator, TROOPS.reator, 2000, { idle: 8, attack: 8 }))
      .toEqual({ state: "idle", frame: 0 });
  });

  it("mantem todos os frames do colono presos ao mesmo ponto no chao", () => {
    const colono = { x: 280, y: 240 };
    for (const state of ["idle", "attack"]) {
      TROOPS.colono.attackVisual.frameAnchors[state].forEach((expectedAnchor, frame) => {
        const anchor = getTroopFrameAnchor(TROOPS.colono, state, frame);
        const rect = getAnchoredSpriteRect(colono, 126, 1, anchor);
        expect(anchor).toEqual(expectedAnchor);
        expect(rect.x + rect.width * anchor.x).toBeCloseTo(colono.x, 5);
        expect(rect.y + rect.height * anchor.y).toBeCloseTo(colono.y + CELL.height * 0.43, 5);
      });
    }
  });

  it("mantem os dezesseis frames do cacador presos ao mesmo ponto no chao", () => {
    const cacador = { x: 280, y: 240 };
    for (const state of ["idle", "attack"]) {
      TROOPS["caçador"].attackVisual.frameAnchors[state].forEach((anchor, frame) => {
        const rect = getAnchoredSpriteRect(cacador, 126, 1, anchor);
        expect(getTroopFrameAnchor(TROOPS["caçador"], state, frame)).toEqual(anchor);
        expect(rect.x + rect.width * anchor.x).toBeCloseTo(cacador.x, 5);
        expect(rect.y + rect.height * anchor.y).toBeCloseTo(cacador.y + CELL.height * 0.43, 5);
      });
    }
  });

  it("mantem os dezesseis frames do bombardeiro presos ao mesmo ponto no chao", () => {
    const bombardeiro = { x: 360, y: 220 };
    const attackPixelHeights = [148, 152, 176, 169, 183, 189, 189, 189];
    const idleVisibleHeight = 126 * 193 / 256;
    const attackVisibleHeights = [];
    for (const state of ["idle", "attack"]) {
      TROOPS.bombardeiro.attackVisual.frameAnchors[state].forEach((anchor, frame) => {
        const rect = getAnchoredSpriteRect(bombardeiro, 126, 1, anchor);
        expect(getTroopFrameAnchor(TROOPS.bombardeiro, state, frame)).toEqual(anchor);
        expect(rect.x + rect.width * anchor.x).toBeCloseTo(bombardeiro.x, 5);
        expect(rect.y + rect.height * anchor.y).toBeCloseTo(bombardeiro.y + CELL.height * 0.43, 5);
        if (state === "attack") {
          expect(anchor.scale).toBe(1.0212);
          attackVisibleHeights.push(rect.height * attackPixelHeights[frame] / 256);
        }
      });
    }
    expect(attackVisibleHeights[0]).toBeLessThan(idleVisibleHeight * 0.8);
    attackVisibleHeights.slice(5).forEach((height) => expect(height).toBeCloseTo(idleVisibleHeight, 1));
  });

  it("mantem os dezesseis frames do krio presos ao mesmo ponto no chao", () => {
    const krio = { x: 360, y: 220 };
    for (const state of ["idle", "attack"]) {
      TROOPS.krio.attackVisual.frameAnchors[state].forEach((anchor, frame) => {
        const rect = getAnchoredSpriteRect(krio, 126, 1, anchor);
        expect(getTroopFrameAnchor(TROOPS.krio, state, frame)).toEqual(anchor);
        expect(anchor.scale).toBe(1);
        expect(rect.x + rect.width * anchor.x).toBeCloseTo(krio.x, 5);
        expect(rect.y + rect.height * anchor.y).toBeCloseTo(krio.y + CELL.height * 0.43, 5);
      });
    }
  });

  it("mantem os dezesseis frames do incinerador presos ao mesmo ponto no chao", () => {
    const incinerador = { x: 360, y: 220 };
    const attackPixelHeights = [212, 191, 193, 205, 205, 193, 210, 198];
    for (const state of ["idle", "attack"]) {
      TROOPS.incinerador.attackVisual.frameAnchors[state].forEach((anchor, frame) => {
        const rect = getAnchoredSpriteRect(incinerador, 126, 1, anchor);
        expect(getTroopFrameAnchor(TROOPS.incinerador, state, frame)).toEqual(anchor);
        expect(rect.x + rect.width * anchor.x).toBeCloseTo(incinerador.x, 5);
        expect(rect.y + rect.height * anchor.y).toBeCloseTo(incinerador.y + CELL.height * 0.43, 5);
        if (state === "attack") {
          expect(attackPixelHeights[frame] * anchor.scale).toBeCloseTo(222, 1);
        }
      });
    }
  });

  it("ancora o destino visual no torso do inimigo", () => {
    const point = getEnemyHitPoint({ x: 500, y: 60, scale: 1 });
    expect(point.x).toBe(500);
    expect(point.y).toBeCloseTo(54);
  });

  it("sincroniza carga, lançamento, recarga e caminhada do Mago Abissal", () => {
    const mage = {
      type: "magoAbissal", x: 800, y: 180, scale: 1.18, casting: true,
      castStartedAt: 100, lastAttackAt: -Infinity, moving: false,
    };
    const counts = { idle: 8, walking: 8, attack: 12 };
    expect(getEnemyAnimation(mage, ENEMIES.magoAbissal, 100, counts)).toEqual({ state: "attack", frame: 0 });
    expect(getEnemyAnimation(mage, ENEMIES.magoAbissal, 999, counts)).toEqual({ state: "attack", frame: 7 });

    const released = { ...mage, casting: false, lastAttackAt: 1000 };
    expect(getEnemyAnimation(released, ENEMIES.magoAbissal, 1000, counts)).toEqual({ state: "attack", frame: 8 });
    expect(getEnemyAnimation(released, ENEMIES.magoAbissal, 1399, counts)).toEqual({ state: "attack", frame: 11 });
    expect(getEnemyAnimation(released, ENEMIES.magoAbissal, 1400, counts).state).toBe("idle");
    expect(getEnemyAnimation({ ...released, moving: true, lastAttackAt: -Infinity }, ENEMIES.magoAbissal, 1500, counts).state).toBe("walking");

    const muzzle = getEnemyMuzzleWorldPosition(mage, ENEMIES.magoAbissal);
    expect(muzzle.x).toBeLessThan(mage.x);
    expect(muzzle.y).toBeLessThan(mage.y);
  });

  it("usa jump durante a parábola e idle/attack quando o parasita está anexado", () => {
    const counts = { idle: 12, walking: 12, attack: 12, jump: 12 };
    const jumping = { type: "parasitaSaltador", jumping: true, jumpProgress: 0.5, lastAttackAt: -Infinity };
    expect(getEnemyAnimation(jumping, ENEMIES.parasitaSaltador, 400, counts))
      .toEqual({ state: "jump", frame: 6 });

    const attached = { ...jumping, jumping: false, attachedToTroopId: "troop_1", lastAttackAt: -Infinity };
    expect(getEnemyAnimation(attached, ENEMIES.parasitaSaltador, 400, counts).state).toBe("idle");
    expect(getEnemyAnimation({ ...attached, lastAttackAt: 350 }, ENEMIES.parasitaSaltador, 400, counts).state)
      .toBe("attack");
  });

  it("mantem o estado visual congelado apenas durante a lentidao", () => {
    const enemy = { dead: false, slowUntil: 1800 };
    expect(isEnemyFrozen(enemy, 1799)).toBe(true);
    expect(isEnemyFrozen(enemy, 1800)).toBe(false);
    expect(isEnemyFrozen({ ...enemy, dead: true }, 1000)).toBe(false);
  });

  it("configura individualmente todas as tropas de ataque a distancia", () => {
    const ranged = ["marine", "caçador", "sniper", "krio", "ranger", "bombardeiro", "guarda", "incinerador"];
    for (const troopId of ranged) {
      expect(TROOPS[troopId].attackVisual?.shots[0]?.muzzle).toBeTruthy();
    }
    expect(TROOPS.bombardeiro.attackVisual.visualCount).toBe(3);
  });

  it("seleciona os dois estados de ataque e seus canos para a Demolidora", () => {
    const demolisher = { type: "demolidora", x: 150, y: 180, lastAttackAt: 1000, lastAttackMode: "mine" };
    expect(getTroopAnimation(demolisher, TROOPS.demolidora, 1320, { attackMine: 8, attackGun: 8 }))
      .toEqual({ state: "attackMine", frame: 4 });
    const mineMuzzle = getMuzzleWorldPosition(demolisher, TROOPS.demolidora);
    demolisher.lastAttackMode = "gun";
    expect(getTroopAnimation(demolisher, TROOPS.demolidora, 1180, { attackMine: 8, attackGun: 8 }))
      .toEqual({ state: "attackGun", frame: 3 });
    const gunMuzzle = getMuzzleWorldPosition(demolisher, TROOPS.demolidora);
    expect(mineMuzzle.x).not.toBeCloseTo(gunMuzzle.x);
    expect(mineMuzzle.y).not.toBeCloseTo(gunMuzzle.y);
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
