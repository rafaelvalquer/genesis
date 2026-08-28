import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { CHAPTER_SEVEN_ENEMIES } from "../chapterSevenEnemies.js";
import { getEnemyAnimation } from "../visualGeometry.js";
import { dardifagoBehavior, selectDardifagoTarget } from "../enemies/chapter07/dardifago.js";

const config = CHAPTER_SEVEN_ENEMIES.dardifago;
const runtime = (overrides = {}) => ({ elapsed: 0, troops: () => [], convoyX: () => 900, session: { convoy: { id: "convoy", type: "convoy", x: 900, y: 288 } }, troopBlockDistance: () => 40, moveEnemy: () => {}, ...overrides });
const enemy = (row = 0, overrides = {}) => ({ id: "d", type: "dardifago", row, x: 500, y: row * 72 + 36, dead: false, stunnedUntil: 0, ...dardifagoBehavior.createState({ elapsed: 0 }, {}, config), ...overrides });

describe("Dardífago", () => {
  it("mantém o contrato de arte com oito frames individuais por estado", async () => {
    const root = path.resolve("src/game/assets/enemy/dardifago");
    for (const state of config.assetStates) {
      const files = (await fs.readdir(path.join(root, state))).filter((file) => /^frame[0-7]\.png$/.test(file)).sort();
      expect(files).toEqual(Array.from({ length: 8 }, (_, frame) => `frame${frame}.png`));
    }
  });

  it("is configured as an outer-row ranged enemy", () => {
    expect(config.allowedRows).toEqual([0, 4]);
    expect(config.rangedAttack.releaseMs).toBe(480);
    expect(config.rangedAttack.durationMs).toBe(960);
    expect(config.toxinDart.everyShots).toBe(3);
  });

  it("keeps release timing at the transition from attached frame 3 to detached frame 4", () => {
    expect(config.rangedAttack.durationMs).toBe(960);
    expect(config.rangedAttack.releaseMs).toBe(480);
    expect(config.attackVisual.releaseFrame).toBe(4);
  });

  it("preserva o relógio de walking durante atualizações consecutivas", () => {
    const d = enemy(0); const r = runtime(); const events = [];
    const startedAt = d.dardifagoStateStartedAt;
    r.elapsed = 135; dardifagoBehavior.update(r, d, config, 16, events);
    r.elapsed = 270; dardifagoBehavior.update(r, d, config, 16, events);
    expect(d.dardifagoState).toBe("walking");
    expect(d.dardifagoStateStartedAt).toBe(startedAt);
    expect(getEnemyAnimation(d, config, r.elapsed, { idle: 8, walking: 8 })).toEqual({ state: "walking", frame: 2 });
  });

  it("targets only the adjacent escort route and prioritizes it over convoy", () => {
    const d = enemy(0);
    const troop = { id: "escort", row: 1, x: 520, y: 108, dead: false };
    expect(selectDardifagoTarget(runtime({ troops: () => [troop] }), d, config).id).toBe("escort");
    expect(selectDardifagoTarget(runtime({ troops: () => [{ id: "opposite", row: 3, x: 520, y: 252, dead: false }] }), d, config).id).toBe("convoy");
  });

  it("uses a blocker on its own row before the escort", () => {
    const d = enemy(4);
    const blocker = { id: "blocker", row: 4, x: 470, y: 324, dead: false };
    const escort = { id: "escort", row: 3, x: 520, y: 252, dead: false };
    expect(selectDardifagoTarget(runtime({ troops: () => [blocker, escort] }), d, config).id).toBe("blocker");
  });

  it("starts normal, normal, toxic and interrupts before release", () => {
    const events = []; const launched = [];
    const r = runtime({ elapsed: 1300, troops: () => [{ id: "t", row: 1, x: 520, y: 108, dead: false }], createId: (prefix) => `${prefix}-1`, session: { convoy: { x: 900, y: 288 }, enemyProjectiles: [], chapterSevenMetrics: { dardifagoShots: 0, dardifagoNormalShots: 0, dardifagoToxicShots: 0 } }, moveEnemy: () => {}, ...{ launch: launched } });
    r.session.chapterSevenMetrics = { dardifagoShots: 0, dardifagoNormalShots: 0, dardifagoToxicShots: 0 };
    const d = enemy(0); d.shotReadyAt = 0;
    dardifagoBehavior.update({ ...r, createId: (p) => `${p}-1` }, d, config, 16, events);
    expect(d.dardifagoState).toBe("dartAttack");
    expect(events.at(-1).type).toBe("dardifagoAttackStarted");
    expect(config.toxinDart.attackSpeedFactor).toBe(.70);
  });
});
