import { describe, expect, it } from "vitest";
import { PHASES, TROOPS } from "./content.js";
import {
  CELL,
  createBattleSession,
  placeTroop,
  spawnEnemy,
  stepBattle,
} from "./battleModel.js";
import { createProjectileTrail } from "./projectileTrail.js";

function createPhase39Session() {
  return createBattleSession(
    { ...PHASES[38], id: "fase-39-icaro-protection-test", waves: [] },
    Object.keys(TROOPS),
    3939,
    {
      sandbox: true,
      sandboxSettings: {
        rulesMode: "free",
        enemySpeedMultiplier: 0,
        troopDamageMultiplier: 1,
      },
    },
  );
}

function addIcaroProjectile(session, source, target) {
  const origin = { x: source.x + 24, y: target.y };
  const x = target.x - 8;

  session.projectiles.push({
    id: "projectile-icaro-regression",
    kind: "icaroBullet",
    visualKind: "icaroBullet",
    troopType: source.type,
    sourceTroopId: source.id,
    targetId: target.id,
    lockedTargetId: target.id,
    row: source.row,
    shotIndex: 0,
    x,
    y: target.y,
    previousX: x,
    previousY: target.y,
    previousRenderX: x,
    previousRenderY: target.y,
    origin,
    ageMs: 0,
    trail: createProjectileTrail(4, x, target.y),
    speed: TROOPS.interceptadorIcaro.projectileSpeed,
    baseDamage: TROOPS.interceptadorIcaro.damage,
    special: false,
    color: TROOPS.interceptadorIcaro.color,
    active: true,
    launched: true,
    seed: 3939,
    launchAt: session.elapsed,
  });
}

describe("Fase 39 — impacto do Interceptador Ícaro", () => {
  it("atinge um inimigo escoltado pela Carapaça de Nereida sem lançar ReferenceError", () => {
    const session = createPhase39Session();
    const icaro = placeTroop(session, "interceptadorIcaro", 2, 3).troop;
    const carrier = spawnEnemy(session, { type: "carapacaNereida", row: 2 }).enemies[0];
    const target = spawnEnemy(session, { type: "mordelume", row: 2 }).enemies[0];

    carrier.x = icaro.x + CELL.width * 2;
    carrier.previousRenderX = carrier.x;
    carrier.speed = 0;
    carrier.nereidaState = "idle";

    target.x = carrier.x + CELL.width;
    target.previousRenderX = target.x;
    target.speed = 0;
    target.mordelumeState = "idle";

    addIcaroProjectile(session, icaro, target);

    expect(() => stepBattle(session, 32)).not.toThrow();
    expect(target.hp).toBeLessThan(target.maxHp);
  });
});
