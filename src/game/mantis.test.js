import { describe, expect, it } from "vitest";
import { distributeMantisSalvo, selectMantisTargets } from "./mantis.js";
import { PHASES } from "./content.js";
import { createBattleSession, placeTroop, spawnEnemy, stepBattle } from "./battleModel.js";

const config = { range: 6.5, maxTargets: 6, salvoSize: 6 };
const row = (id, x, speed = 30) => ({ id, x, speed, row: 1, hp: 20, dead: false });

describe("MANTIS", () => {
  it("seleciona somente a rota da unidade e prioriza os inimigos mais avançados", () => {
    const session = { enemies: [row("late", 620), row("front", 780, 45), row("other", 760)] };
    const targets = selectMantisTargets(session, { row: 1, x: 400 }, config, {
      enemyOccupiesTargetRow: (enemy, targetRow) => enemy.row === targetRow,
      isEnemyTargetable: (enemy) => !enemy.dead && enemy.hp > 0,
    });
    expect(targets.map((target) => target.id)).toEqual(["front", "late"]);
  });

  it("distribui seis spikes entre alvos e redistribui quando há poucos", () => {
    const targets = [row("a", 500), row("b", 600), row("c", 700)];
    const salvo = distributeMantisSalvo(targets, 6);
    expect(salvo.map((target) => target.id)).toEqual(["a", "b", "c", "a", "b", "c"]);
    expect(distributeMantisSalvo([targets[0]], 6)).toHaveLength(6);
  });

  it("executa uma rajada real na sessão e cria seis projéteis spike", () => {
    const phase = PHASES.find((entry) => entry.id === "fase_45") || PHASES[44];
    const session = createBattleSession(phase, ["mantis"], 4501, { sandbox: true, sandboxSettings: { rulesMode: "free" } });
    expect(placeTroop(session, "mantis", 1, 1).ok).toBe(true);
    for (let index = 0; index < 3; index += 1) {
      const enemy = spawnEnemy(session, { type: "medu", row: 1 }).enemies[0];
      enemy.x = 650 + index * 40;
      enemy.y = 180;
      enemy.speed = 0;
      enemy.previousX = enemy.x;
      enemy.previousRenderX = enemy.x;
    }
    const events = [];
    for (let index = 0; index < 20; index += 1) events.push(...stepBattle(session, 32));
    expect(events.find((event) => event.type === "mantisSalvo")).toMatchObject({ count: 6 });
    expect(session.projectiles.some((projectile) => projectile.kind === "mantisSpike")).toBe(true);
  });
});
