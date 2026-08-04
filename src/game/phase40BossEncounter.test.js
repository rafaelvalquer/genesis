import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import {
  WAVE_OUTRO_TIMINGS,
  advanceWaveOutro,
  createBattleSession,
  startWave,
  stepBattle,
} from "./battleModel.js";

const phase40 = () => CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_40");

function finalWaveSession() {
  const session = createBattleSession(phase40(), ["marine"], 4040);
  session.waveIndex = 5;
  expect(startWave(session)).toBe(true);
  const bossEntry = session.queue.find((entry) => entry.packetId === "boss_encounter");
  session.queue = [bossEntry];
  session.nextSpawnAt = session.waveStartedAt + bossEntry.spawnAtMs;
  return session;
}

function spawnBoss(session) {
  expect(stepBattle(session, 17999).some(
    (event) => event.enemy?.type === "leviathanNereida",
  )).toBe(false);
  const events = stepBattle(session, 1);
  expect(events).toContainEqual(expect.objectContaining({
    type: "spawn",
    enemy: expect.objectContaining({ type: "leviathanNereida" }),
  }));
  return session.enemies.find((enemy) => enemy.type === "leviathanNereida");
}

describe("execução do encontro final da Fase 40", () => {
  it("faz o Leviatã entrar aos 18 segundos", () => {
    const session = finalWaveSession();
    const boss = spawnBoss(session);
    expect(boss).toBeTruthy();
    expect(session.elapsed).toBe(18000);
    expect(session.bossEncounter.spawned).toBe(true);
  });

  it("aciona o reforço do limiar uma única vez", () => {
    const session = finalWaveSession();
    const boss = spawnBoss(session);
    boss.hp = boss.maxHp * 0.84;
    stepBattle(session, 1);
    expect(session.bossEncounter.reinforcementPackets.has("N6")).toBe(true);
    const triggered = session.bossEncounter.reinforcementPackets.size;
    stepBattle(session, 1);
    expect(session.bossEncounter.reinforcementPackets.size).toBe(triggered);
  });

  it("conclui a onda final depois que o chefe morre e a fila fica vazia", () => {
    const session = finalWaveSession();
    const boss = spawnBoss(session);
    session.queue = [];
    session.nextSpawnAt = Infinity;
    boss.hp = 0;
    boss.dead = true;
    stepBattle(session, 1);
    expect(session.waveActive).toBe(false);
    expect(session.pendingOutcome).toBe("victory");
    expect(session.waveOutro.finalWave).toBe(true);
    advanceWaveOutro(session, WAVE_OUTRO_TIMINGS.totalMs);
    expect(session.outcome).toBe("victory");
  });
});
