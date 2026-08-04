import { describe, expect, it } from "vitest";
import { CHAPTER_FIVE_PHASES } from "./chapterFivePhases.js";
import { createBattleSession, startWave, stepBattle } from "./battleModel.js";

const phase40 = () => CHAPTER_FIVE_PHASES.find((phase) => phase.id === "fase_40");

function startFinalEncounter() {
  const session = createBattleSession(phase40(), ["marine"], 4040);
  session.waveIndex = 5;
  expect(startWave(session)).toBe(true);
  return session;
}

describe("encontro completo da Fase 40", () => {
  it("mantém a escolta real, reserva espaço e introduz o Leviatã aos 18 segundos", () => {
    const session = startFinalEncounter();
    const initialQueue = [...session.queue];
    expect(initialQueue.length).toBeGreaterThan(1);
    expect(initialQueue.some((entry) => entry.packetId === "boss_encounter")).toBe(true);
    expect(initialQueue.some((entry) => entry.packetId !== "boss_encounter")).toBe(true);

    const events = [];
    for (let elapsed = 0; elapsed < 18000; elapsed += 250) {
      events.push(...stepBattle(session, 250));
    }

    expect(events).toContainEqual(expect.objectContaining({
      type: "spawn",
      enemy: expect.objectContaining({ type: "leviathanNereida" }),
    }));
    expect(session.bossEncounter.spawned).toBe(true);
    expect(session.enemies.some((enemy) => enemy.type === "leviathanNereida")).toBe(true);
    expect(session.enemies.some((enemy) => enemy.type !== "leviathanNereida")
      || session.queue.some((entry) => entry.packetId !== "boss_encounter")).toBe(true);
    expect(session.enemies.filter((enemy) => !enemy.dead).length).toBeLessThanOrEqual(48);
  });
});
