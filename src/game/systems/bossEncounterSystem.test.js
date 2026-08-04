import { describe, expect, it, vi } from "vitest";
import {
  BOSS_ENCOUNTER_PACKET_ID,
  REINFORCEMENT_COMPLETED,
  REINFORCEMENT_PENDING,
  REINFORCEMENT_QUEUED,
  createBossEncounterState,
  enqueueBossReinforcement,
  initializeBossEncounterForWave,
  markBossEncounterSpawned,
  markBossReinforcementSpawned,
  shouldDeferBossAwareSpawn,
  updateBossEncounter,
} from "./bossEncounterSystem.js";

describe("sistema genérico de encontro com chefe", () => {
  it("agenda e marca a entrada do chefe no tempo configurado", () => {
    const session = { queue: [], bossEncounter: null };
    const wave = { bossEncounter: { type: "boss", spawnAtMs: 18000 } };
    initializeBossEncounterForWave(session, wave, session.queue, { row: 2 });
    expect(session.queue).toContainEqual(expect.objectContaining({
      type: "boss", row: 2, packetId: BOSS_ENCOUNTER_PACKET_ID,
      spawnAtMs: 18000,
    }));
    expect(markBossEncounterSpawned(session, session.queue[0])).toBe(true);
    expect(session.bossEncounter.spawned).toBe(true);
  });

  it("reserva uma vaga até a entrada do chefe", () => {
    const session = {
      elapsed: 17000,
      waveStartedAt: 0,
      bossEncounter: createBossEncounterState({
        bossEncounter: { type: "boss", spawnAtMs: 18000 },
      }),
    };
    expect(shouldDeferBossAwareSpawn(session, { packetId: "normal" }, 48, 47)).toBe(true);
    expect(shouldDeferBossAwareSpawn(
      session, { packetId: BOSS_ENCOUNTER_PACKET_ID }, 48, 48,
    )).toBe(false);
  });

  it("mantém o reforço pendente quando todos os tipos estão no limite", () => {
    const session = {
      bossEncounter: {
        maximumLivingByType: { mordelume: 2 },
        reinforcementPackets: new Set(),
        reinforcementStates: new Map([["N", REINFORCEMENT_PENDING]]),
      },
      enemies: [
        { type: "mordelume", dead: false },
        { type: "mordelume", dead: false },
      ],
      queue: [], rng: () => 0, elapsed: 1000, waveStartedAt: 0,
    };
    const packets = { N: { id: "N", units: [{ type: "mordelume", count: 3 }] } };

    expect(enqueueBossReinforcement(session, "N", { packets })).toEqual([]);
    expect(session.bossEncounter.reinforcementStates.get("N")).toBe(REINFORCEMENT_PENDING);
    expect(session.bossEncounter.reinforcementPackets.has("N")).toBe(false);

    session.enemies[0].dead = true;
    expect(enqueueBossReinforcement(session, "N", { packets })).toHaveLength(1);
    expect(session.bossEncounter.reinforcementStates.get("N")).toBe(REINFORCEMENT_QUEUED);
  });

  it("marca o pacote como concluído somente após o último spawn", () => {
    const session = {
      bossEncounter: {
        reinforcementPackets: new Set(["N"]),
        reinforcementStates: new Map([["N", REINFORCEMENT_QUEUED]]),
      },
      queue: [{ block: "boss_reinforcement", reinforcementPacketKey: "N" }],
    };
    const spawned = { block: "boss_reinforcement", reinforcementPacketKey: "N" };
    expect(markBossReinforcementSpawned(session, spawned)).toBe(false);
    session.queue = [];
    expect(markBossReinforcementSpawned(session, spawned)).toBe(true);
    expect(session.bossEncounter.reinforcementStates.get("N")).toBe(REINFORCEMENT_COMPLETED);
  });

  it("aciona no máximo um limiar por atualização e respeita o intervalo", () => {
    const session = {
      elapsed: 1000,
      bossEncounter: {
        type: "boss", spawned: true, reinforcementIntervalMs: 900,
        reinforcements: [
          { hpFactor: 0.85, packet: "A" },
          { hpFactor: 0.70, packet: "B" },
          { hpFactor: 0.55, packet: "C" },
        ],
        reinforcementPackets: new Set(),
        reinforcementStates: new Map([
          ["A", REINFORCEMENT_PENDING],
          ["B", REINFORCEMENT_PENDING],
          ["C", REINFORCEMENT_PENDING],
        ]),
        nextReinforcementAt: 0,
      },
      enemies: [{ type: "boss", hp: 30, maxHp: 100, dead: false }],
    };
    const enqueueReinforcement = vi.fn((packet) => {
      session.bossEncounter.reinforcementStates.set(packet, REINFORCEMENT_QUEUED);
      return [{ packet }];
    });

    expect(updateBossEncounter(session, { enqueueReinforcement })).toEqual(["A"]);
    expect(updateBossEncounter(session, { enqueueReinforcement })).toEqual([]);
    session.elapsed = 1900;
    expect(updateBossEncounter(session, { enqueueReinforcement })).toEqual(["B"]);
    expect(enqueueReinforcement).toHaveBeenCalledTimes(2);
  });
});
