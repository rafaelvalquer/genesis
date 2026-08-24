import { describe, expect, it } from "vitest";
import { ENEMIES } from "../content.js";
import { macacoEsporosBehavior, selectMacacoEsporosTarget } from "../enemies/chapter07/macacoEsporos.js";
import { applySporeConfusion, isSporeConfused, updateSporeField } from "./sporeField.js";
import { isEscortOperational } from "./convoyEscort.js";

function runtime(troops, elapsed = 3000) {
  const session = { elapsed, troops, sporeFruits: [], sporeClouds: [], chapterSevenMetrics: { sporeFruitsThrown: 0, sporeFruitsHit: 0, sporeTroopsConfused: 0, sporeEscortConfusions: 0, sporeMultiHits: 0, escortLostWhileSporeConfused: 0 }, convoy: { escortTroopIds: ["escort"] }, rng: () => .5 };
  return { session, elapsed, troops: () => troops, escortIds: () => session.convoy.escortTroopIds, closestTroop: () => troops[0], troopBlockDistance: () => 54, moveEnemy: () => {}, damageTroop: () => {}, createId: (kind) => `${kind}-1` };
}
const troop = (id, x, row = 1, extra = {}) => ({ id, x, y: row * 96 + 48, row, hp: 10, dead: false, ...extra });

describe("Macaco de Esporos", () => {
  it("registers the exact low-health support configuration", () => {
    expect(ENEMIES.macacoEsporos).toMatchObject({ hp: 30, speed: 25, damage: 3, attackEveryMs: 1450, baseDamage: 7, threat: 28, canAttackConvoy: false });
    expect(ENEMIES.macacoEsporos.assetStates).toEqual(["idle", "walking", "attack", "sporeThrow"]);
  });
  it("prefers an operational escort, then a grouped target, deterministically", () => {
    const units = [troop("z", 300), troop("group", 310), troop("escort", 260), troop("other", 250)];
    const r = runtime(units); const enemy = { x: 500, y: 144, row: 1 };
    expect(selectMacacoEsporosTarget(r, enemy, ENEMIES.macacoEsporos).id).toBe("escort");
    r.session.convoy.escortTroopIds = [];
    expect(selectMacacoEsporosTarget(r, enemy, ENEMIES.macacoEsporos).id).toBe("group");
  });
  it("uses a non-additive confusion state that disables attacks and operational escort", () => {
    const session = { elapsed: 100, chapterSevenMetrics: {} }; const target = troop("escort", 100, 1, { attackReadyAt: 150 });
    expect(applySporeConfusion(session, target, 1800)).toBe(true);
    expect(isSporeConfused(target, 500)).toBe(true); expect(isEscortOperational(target, { elapsed: 500 })).toBe(false);
    const until = target.sporeConfusedUntil; applySporeConfusion(session, target, 100); expect(target.sporeConfusedUntil).toBe(until);
  });
  it("applies an AoE once, ignores structures and emits a cloud impact", () => {
    const units = [troop("a", 200), troop("structure", 204, 1, { structure: true })]; const r = runtime(units, 1000);
    r.session.sporeFruits.push({ id: "fruit", active: true, targetX: 200, targetY: 144, targetRow: 1, impactAt: 900, radiusTiles: .9, confusionMinMs: 1800, confusionMaxMs: 2200, cloudVisualMs: 950 });
    const events = []; updateSporeField(r.session, events);
    expect(units[0].sporeConfusedUntil).toBe(3000); expect(units[1].sporeConfusedUntil).toBeUndefined();
    expect(events.some((event) => event.type === "sporeFruitImpact")).toBe(true); expect(r.session.sporeClouds).toHaveLength(1);
  });
  it("starts casting after the initial delay and cancels a death-before-release naturally", () => {
    const r = runtime([troop("escort", 260)], 0); const config = ENEMIES.macacoEsporos;
    const enemy = { id: "m", x: 500, y: 144, row: 1, dead: false, moving: true, attackReadyAt: Infinity, ...macacoEsporosBehavior.createState(r.session, {}, config) };
    r.elapsed = 2800; r.session.elapsed = 2800;
    macacoEsporosBehavior.update(r, enemy, config, 16, []); expect(enemy.sporeState).toBe("sporeCast");
    enemy.dead = true; macacoEsporosBehavior.update(r, enemy, config, 16, []); expect(r.session.sporeFruits).toHaveLength(0);
  });
});
