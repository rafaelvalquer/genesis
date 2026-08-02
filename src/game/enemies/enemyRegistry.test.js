import { describe, expect, it } from "vitest";
import { createEnemyEntity } from "./enemyFactory.js";
import { ENEMY_BEHAVIORS, getEnemyBehavior } from "./enemyRegistry.js";

const HOOKS = ["createState", "onSpawn", "update", "selectTarget", "attack", "receiveDamage", "onDeath"];

describe("enemy behavior registry", () => {
  it("keeps the full behavior contract for every registered enemy", () => {
    Object.values(ENEMY_BEHAVIORS).forEach((behavior) => {
      HOOKS.forEach((hook) => expect(behavior[hook]).toBeTypeOf("function"));
    });
  });

  it("uses the generic behavior for an unregistered type", () => {
    expect(getEnemyBehavior("ordinaryEnemy").update({}, {}, {}, 0, [])).toBe(false);
  });

  it("merges base and behavior state before applying spawn positioning", () => {
    const session = { elapsed: 100, rng: () => 0.5, enemies: [], phase: {}, sandboxSettings: {} };
    const config = { id: "enguiaRasgamar", hp: 10, speed: 1, damage: 2, baseDamage: 2, scale: 1, submergedSpawnMs: 400, idleSurfaceExposureEveryMs: 800 };
    const { enemy } = createEnemyEntity(session, { type: "enguiaRasgamar", row: 2 }, config, () => "enemy_test");
    expect(enemy).toMatchObject({ id: "enemy_test", type: "enguiaRasgamar", rasgamarState: "spawnSubmerged", rasgamarSubmerged: true, moving: false });
    expect(enemy.x).toBeGreaterThan(0);
  });
});
