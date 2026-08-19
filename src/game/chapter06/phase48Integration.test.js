import { describe, expect, it } from "vitest";
import { CHAPTER_SIX_PHASES } from "../chapterSixPhases.js";
import { ENEMIES } from "../content.js";
import { createBattleSession, forceColossoAttack, startWave, stepBattle } from "../battleModel.js";

const phase48 = () => CHAPTER_SIX_PHASES.find((phase) => phase.id === "fase_48");

describe("encontro integrado da Wave 6 da Fase 48", () => {
  it("mantém a fila real, cria boss e fissuras uma vez, respeita o teto e limpa o encontro após a morte", () => {
    const session = createBattleSession(phase48(), ["marine", "thermalPlatform"], 48048, { sandbox: true });
    session.waveIndex = 5; expect(startWave(session)).toBe(true);
    expect(session.queue.some((entry) => entry.packetId === "boss_encounter")).toBe(true);
    expect(session.queue.some((entry) => entry.packetId !== "boss_encounter")).toBe(true);
    const events = [];
    for (let elapsed = 0; elapsed < 19800; elapsed += 300) events.push(...stepBattle(session, 300));
    const boss = session.enemies.find((enemy) => enemy.type === "colossoCaldeira");
    expect(boss).toBeTruthy(); expect(session.bossEncounter.spawned).toBe(true);
    expect(session.permanentThermalHazards).toEqual([expect.objectContaining({
      sourceEnemyId: boss.id,
      thermalState: "eruption",
      cells: [[0, 9], [1, 9], [2, 9], [3, 9], [4, 9]],
      active: true,
    })]);
    expect(session.enemies.filter((enemy) => !enemy.dead).length).toBeLessThanOrEqual(54);
    for (let elapsed = 0; elapsed < ENEMIES.colossoCaldeira.spawnDurationMs + 9000 && boss.colossoState !== "idle"; elapsed += 100) events.push(...stepBattle(session, 100));
    boss.colossoRifts = [];
    expect(forceColossoAttack(session, "rift").ok).toBe(true);
    for (let elapsed = 0; elapsed < 2300; elapsed += 100) events.push(...stepBattle(session, 100));
    expect(events.some((event) => event.type === "colossoRiftOpened")).toBe(true);
    expect(session.temporaryMagmaHazards.some((hazard) => hazard.sourceEnemyId === boss.id)).toBe(true);
    const reinforcements = session.bossEncounter.reinforcementPackets.size;
    boss.hp = 0; stepBattle(session, 1); stepBattle(session, 2500);
    expect(session.bossEncounter.reinforcementPackets.size).toBe(reinforcements);
    expect(session.queue.some((entry) => entry.block === "boss_rift" || entry.block === "boss_reinforcement")).toBe(false);
    expect(session.temporaryMagmaHazards.filter((hazard) => hazard.sourceEnemyId === boss.id).every((hazard) => !hazard.active)).toBe(true);
  });
});
