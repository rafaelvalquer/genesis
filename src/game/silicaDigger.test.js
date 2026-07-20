import { describe, expect, it } from "vitest";
import { ENEMIES, PHASES } from "./content.js";
import {
  CELL,
  createBattleSession,
  getLumiKnockbackFactor,
  getSilicaDiggerSwarmSpeedFactor,
  spawnEnemy,
  stepBattle,
  stunEnemy,
} from "./battleModel.js";

const sandbox = () => createBattleSession(PHASES[0], [], 7301, { sandbox: true });

const targetTroop = (x = 1000, row = 0) => ({
  id: `target_${row}_${x}`,
  type: "muralhaReforcada",
  row,
  col: Math.floor(x / CELL.width),
  x,
  y: row * 120 + 60,
  hp: 100,
  maxHp: 100,
  dead: false,
});

describe("Escavador de Sílica", () => {
  it("mantém o perfil frágil e não aparece em nenhuma fase", () => {
    expect(ENEMIES.silicaDigger).toMatchObject({
      hp: 8,
      speed: 62,
      damage: 3,
      attackEveryMs: 600,
      baseDamage: 6,
      threat: 6,
      scale: 0.64,
    });
    expect(PHASES.some((phase) => phase.waves.some((wave) => (
      wave.enemies.some((entry) => entry.type === "silicaDigger")
    )))).toBe(false);
    expect(getLumiKnockbackFactor({ type: "silicaDigger" })).toBe(1);
  });

  it("nasce com 8 HP e recebe +25% de velocidade somente com três ativos no mesmo tile", () => {
    const session = sandbox();
    const pair = spawnEnemy(session, {
      type: "silicaDigger", row: 2, count: 2, groupInTile: true,
    }).enemies;
    expect(pair[0]).toMatchObject({ hp: 8, maxHp: 8 });
    expect(getSilicaDiggerSwarmSpeedFactor(session, pair[0])).toBe(1);

    const third = spawnEnemy(session, {
      type: "silicaDigger", row: 2, count: 1, groupInTile: true,
    }).enemies[0];
    third.x = pair[0].x + 8;
    expect(getSilicaDiggerSwarmSpeedFactor(session, pair[0])).toBe(1.25);

    const startX = pair[0].x;
    stepBattle(session, 100);
    expect(startX - pair[0].x).toBeCloseTo(62 * 1.25 * 0.1, 5);
  });

  it("exclui atordoados do grupo e combina o impulso multiplicativamente com lentidão", () => {
    const session = sandbox();
    const enemies = spawnEnemy(session, {
      type: "silicaDigger", row: 1, count: 3, groupInTile: true,
    }).enemies;
    enemies[0].slowFactor = 0.5;
    enemies[0].slowUntil = 1000;
    const startX = enemies[0].x;
    stepBattle(session, 100);
    expect(startX - enemies[0].x).toBeCloseTo(62 * 1.25 * 0.5 * 0.1, 5);

    stunEnemy(session, enemies[2], 800);
    expect(getSilicaDiggerSwarmSpeedFactor(session, enemies[0])).toBe(1);
    expect(getSilicaDiggerSwarmSpeedFactor(session, enemies[2])).toBe(1);
  });

  it("aplica a mordida no impacto e permite vários atacantes no primeiro alvo", () => {
    const session = sandbox();
    const troop = targetTroop();
    session.troops = [troop];
    const enemies = spawnEnemy(session, {
      type: "silicaDigger", row: 0, count: 2, groupInTile: true,
    }).enemies;
    enemies.forEach((enemy, index) => {
      enemy.x = troop.x + 48 + index * 2;
      enemy.previousRenderX = enemy.x;
    });

    stepBattle(session, 1);
    expect(troop.hp).toBe(100);
    expect(enemies.every((enemy) => enemy.meleeAttackPending)).toBe(true);
    stepBattle(session, 199);
    expect(troop.hp).toBe(100);
    const events = stepBattle(session, 1);
    expect(troop.hp).toBe(94);
    expect(events.filter((event) => event.type === "melee")).toHaveLength(2);
  });

  it("cancela uma mordida pendente quando é atordoado", () => {
    const session = sandbox();
    const troop = targetTroop();
    session.troops = [troop];
    const enemy = spawnEnemy(session, { type: "silicaDigger", row: 0 }).enemies[0];
    enemy.x = troop.x + 48;
    enemy.previousRenderX = enemy.x;

    stepBattle(session, 1);
    expect(enemy.meleeAttackPending).toBe(true);
    stunEnemy(session, enemy, 800);
    expect(enemy).toMatchObject({
      meleeAttackPending: false,
      meleeImpactAt: Infinity,
      meleeTargetId: null,
      lastAttackAt: -Infinity,
    });
    stepBattle(session, 800);
    expect(troop.hp).toBe(100);
  });
});
