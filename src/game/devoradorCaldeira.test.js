import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES, getEnemyCatalogEntries } from "./content.js";
import { getEnemyBehavior } from "./enemies/enemyRegistry.js";
import { getEnemyAnimation, getEnemySpriteRect } from "./visualGeometry.js";
import { createBattleSession, createTroopEntity, spawnEnemy, stepBattle } from "./battle/engine.js";

describe("Devorador da Caldeira", () => {
  it("is registered as a test-only heavy enemy with the complete state contract", () => {
    expect(ENEMIES.devoradorCaldeira).toMatchObject({
      hp: 125, speed: 13, damage: 9, attackEveryMs: 1900, baseDamage: 26,
      armorClass: "heavy", armorDamageFactor: 0.8, knockbackFactor: 0.3,
      magmaImmune: true, crushingBiteStunMs: 900, testOnly: true,
      assetStates: ["idle", "walking", "attack", "crushingBite", "frenzyTransition", "death"],
    });
    expect(getEnemyBehavior("devoradorCaldeira")).not.toBeUndefined();
    expect(getEnemyCatalogEntries().some((enemy) => enemy.id === "devoradorCaldeira")).toBe(true);
  });

  it("uses only the requested animation states, with no hit state", () => {
    const enemy = { type: "devoradorCaldeira", devoradorState: "crushingBite", devoradorStateStartedAt: 0, devoradorStateEndsAt: 900 };
    expect(getEnemyAnimation(enemy, ENEMIES.devoradorCaldeira, 560, {
      idle: 8, walking: 8, attack: 8, crushingBite: 8, frenzyTransition: 8, death: 8,
    })).toEqual({ state: "crushingBite", frame: 4 });
  });

  it("applies the normal bite only at its impact time", () => {
    const session = createBattleSession(PHASES[0], [], 991, { sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 0 } });
    const troop = createTroopEntity(session, "muralhaReforcada", 0, 0);
    session.troops.push(troop);
    const enemy = spawnEnemy(session, { type: "devoradorCaldeira", row: 0 }).enemies[0];
    enemy.x = troop.x + 40;
    stepBattle(session, 1);
    expect(enemy.devoradorState).toBe("attack");
    const hpBeforeImpact = troop.hp;
    stepBattle(session, 449);
    expect(troop.hp).toBe(hpBeforeImpact);
    const impactEvents = stepBattle(session, 1);
    expect(troop.hp).toBe(hpBeforeImpact - 9);
    expect(impactEvents.some((event) => event.type === "devoradorBite")).toBe(true);
  });

  it("keeps advancing when the route has no troops and is grounded by its offset", () => {
    const session = createBattleSession(PHASES[0], [], 1201, { sandbox: true, sandboxSettings: { rulesMode: "free", enemySpeedMultiplier: 1 } });
    const enemy = spawnEnemy(session, { type: "devoradorCaldeira", row: 0 }).enemies[0];
    const before = enemy.x;
    stepBattle(session, 1000);
    expect(enemy.x).toBeLessThan(before);
    expect(enemy.moving).toBe(true);
    expect(ENEMIES.devoradorCaldeira.spriteOffsetY).toBe(40);
    expect(getEnemySpriteRect(enemy, ENEMIES.devoradorCaldeira).y).toBeGreaterThan(0);
  });
});
