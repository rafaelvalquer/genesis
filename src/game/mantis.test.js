import { describe, expect, it } from "vitest";
import { createMantisSpike, distributeMantisSalvo, sampleMantisArc, selectMantisTargets } from "./mantis.js";
import { getUnlockedTroops, PHASES, TROOPS } from "./content.js";
import { createBattleSession, placeTroop, spawnEnemy, stepBattle } from "./battleModel.js";

const config = { range: 6.5, maxTargets: 3, salvoSize: 3 };
const row = (id, x, speed = 30) => ({ id, x, speed, row: 1, hp: 20, dead: false });

describe("MANTIS", () => {
  it("é liberada para a Fase 45 e não aparece na Fase 44", () => {
    expect(TROOPS.mantis.unlockAt).toBe(44);
    expect(TROOPS.mantis.healthBarOffset).toBe(60);
    expect(getUnlockedTroops(43).some((troop) => troop.id === "mantis")).toBe(false);
    expect(getUnlockedTroops(44).some((troop) => troop.id === "mantis")).toBe(true);
  });
  it("seleciona somente a rota da unidade e prioriza os inimigos mais avançados", () => {
    const session = { enemies: [row("late", 620), row("front", 780, 45), row("other", 760)] };
    const targets = selectMantisTargets(session, { row: 1, x: 400 }, config, {
      enemyOccupiesTargetRow: (enemy, targetRow) => enemy.row === targetRow,
      isEnemyTargetable: (enemy) => !enemy.dead && enemy.hp > 0,
    });
    expect(targets.map((target) => target.id)).toEqual(["front", "other", "late"]);
  });

  it("distribui seis spikes entre alvos e redistribui quando há poucos", () => {
    const targets = [row("a", 500), row("b", 600), row("c", 700)];
    const salvo = distributeMantisSalvo(targets, 3);
    expect(salvo.map((target) => target.id)).toEqual(["a", "b", "c"]);
    expect(distributeMantisSalvo([targets[0]], 3)).toHaveLength(3);
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
    expect(events.find((event) => event.type === "mantisSpikeSalvo")).toMatchObject({ count: 3 });
    expect(session.projectiles.filter((projectile) => projectile.kind === "mantisSpike")).toHaveLength(3);
    expect(session.projectiles.every((projectile) => ["flight", "attached"].includes(projectile.phase))).toBe(true);
  });

  it("usa fases pending e attached com dano separado", () => {
    const spike = createMantisSpike({
      id: "spike", sourceTroopId: "mantis_1", troopType: "mantis", target: row("target", 700),
      shotIndex: 0, origin: { x: 200, y: 200 }, now: 0,
      config: { spikeFlightMs: 900, spikeArcHeight: 170, impactDamage: 3, detonationDamage: 6, detonationRadius: 58, detonationDelayMs: 500, launchIntervalMs: 80, color: "#e879f9" },
      trail: [], seed: 1, damageMultiplier: () => 1,
    });
    expect(spike.phase).toBe("pending");
    expect(spike.impactDamage).toBe(3);
    expect(spike.detonationDamage).toBe(6);
    expect(spike.detonationDelayMs).toBe(500);
    const start = sampleMantisArc(spike, { x: 700, y: 200 }, 0);
    const apex = sampleMantisArc(spike, { x: 700, y: 200 }, 0.35);
    const end = sampleMantisArc(spike, { x: 700, y: 200 }, 1);
    expect(apex.y).toBeLessThan(start.y);
    expect(end.x).toBeCloseTo(700);
    expect(end.y).toBeCloseTo(200);
  });
});
